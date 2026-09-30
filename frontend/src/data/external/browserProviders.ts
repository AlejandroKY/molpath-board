// Adaptadores de fuentes externas para el modo demo (navegador). Consultan las mismas APIs oficiales
// que el backend (todas admiten CORS). Mismo contrato y mismas reglas de mapeo que los adaptadores Java.
import { civicCertainty, civicEvidenceType, civicScope } from '../../domain/certainty';
import { normalizeProteinChange, toThreeLetter } from '../../domain/proteinChange';
import type { ClinVarClassification, ClinVarRecord, EvidenceCandidate, PathwayCandidate } from '../../domain/types';
import { ApiError } from '../gateway';

const NCBI = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const CIVIC = 'https://civicdb.org/api/graphql';
const REACTOME = 'https://reactome.org/ContentService';
const TOOL = 'molpath-board';

async function fetchText(source: string, url: string, init?: RequestInit): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new ApiError(502, 'Fuente externa no disponible', `No se pudo contactar con ${source}. Compruebe la conexión.`);
  }
  if (response.status === 404) return '';
  if (!response.ok) throw new ApiError(502, 'Fuente externa no disponible', `${source} respondió ${response.status}.`);
  return response.text();
}

// NCBI: 3 peticiones/s sin API key.
let lastNcbi = 0;
async function ncbi(source: string, utility: string, params: Record<string, string>): Promise<string> {
  const wait = lastNcbi + 350 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNcbi = Date.now();
  const qs = new URLSearchParams({ ...params, tool: TOOL });
  return fetchText(source, `${NCBI}/${utility}?${qs}`);
}

// ─── PubMed ───────────────────────────────────────────────────────────────────
export interface PubMedRecord {
  pmid: string;
  doi: string | null;
  title: string;
  authors: string | null;
  journal: string | null;
  pubYear: number | null;
  pubDate: string | null;
  abstractText: string | null;
}

const clean = (s: string | null | undefined) => {
  const v = (s ?? '').replace(/\s+/g, ' ').trim();
  return v.length ? v : null;
};

export function parsePubMedXml(xml: string): PubMedRecord[] {
  // DOMParser no resuelve entidades externas ni descarga DTD.
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new ApiError(502, 'Respuesta no válida', 'XML de PubMed no válido');
  const child = (el: Element | null | undefined, tag: string) =>
    el ? (Array.from(el.children).find((c) => c.tagName === tag) ?? null) : null;
  return Array.from(doc.getElementsByTagName('PubmedArticle')).map((article) => {
    const citation = child(article, 'MedlineCitation');
    const art = child(citation, 'Article');
    const journal = child(art, 'Journal');
    const pubDateEl = child(child(journal, 'JournalIssue'), 'PubDate');
    const medline = clean(child(pubDateEl, 'MedlineDate')?.textContent);
    const pubDate = medline ?? (['Year', 'Month', 'Day'].map((t) => clean(child(pubDateEl, t)?.textContent)).filter(Boolean).join(' ') || null);
    const year = pubDate ? /(\d{4})/.exec(pubDate)?.[1] : undefined;
    const authorEls = Array.from(child(art, 'AuthorList')?.getElementsByTagName('Author') ?? []);
    const names = authorEls
      .map((a) => clean(child(a, 'CollectiveName')?.textContent) ?? [clean(child(a, 'LastName')?.textContent), clean(child(a, 'Initials')?.textContent)].filter(Boolean).join(' '))
      .filter((n) => n && n.length);
    const authors = names.length ? names.slice(0, 6).join(', ') + (names.length > 6 ? ', et al.' : '') : null;
    const abstractParts = Array.from(child(art, 'Abstract')?.getElementsByTagName('AbstractText') ?? []).map((p) => {
      const label = p.getAttribute('Label');
      const text = clean(p.textContent);
      return text ? (label ? `${label}: ${text}` : text) : null;
    });
    const doiEl = Array.from(article.getElementsByTagName('ArticleId')).find((e) => e.getAttribute('IdType') === 'doi') ??
      Array.from(art?.getElementsByTagName('ELocationID') ?? []).find((e) => e.getAttribute('EIdType') === 'doi');
    return {
      pmid: clean(child(citation, 'PMID')?.textContent) ?? '',
      doi: clean(doiEl?.textContent),
      title: clean(child(art, 'ArticleTitle')?.textContent) ?? '',
      authors,
      journal: clean(child(journal, 'ISOAbbreviation')?.textContent) ?? clean(child(journal, 'Title')?.textContent),
      pubYear: year ? Number(year) : null,
      pubDate,
      abstractText: abstractParts.filter(Boolean).join('\n\n') || null,
    };
  });
}

export async function fetchPubMed(pmid: string): Promise<PubMedRecord | null> {
  const xml = await ncbi('PubMed', 'efetch.fcgi', { db: 'pubmed', id: pmid, retmode: 'xml' });
  if (!xml.trim()) return null;
  return parsePubMedXml(xml).find((r) => r.pmid === pmid && r.title) ?? null;
}

export async function pubmedVersionLabel(): Promise<string> {
  const json = JSON.parse(await ncbi('PubMed', 'einfo.fcgi', { db: 'pubmed', retmode: 'json' }));
  return `NCBI E-utilities (PubMed lastupdate ${json?.einforesult?.dbinfo?.[0]?.lastupdate ?? 'desconocido'})`;
}

// ─── CIViC ────────────────────────────────────────────────────────────────────
const EVIDENCE_FIELDS = `fragment EvidenceFields on EvidenceItem {
  id name evidenceType evidenceLevel evidenceDirection significance evidenceRating description variantOrigin
  disease { name } therapies { name } molecularProfile { name }
  source { citationId sourceType citation publicationYear }
}`;

async function civicQuery(query: string, variables: Record<string, unknown>) {
  const text = await fetchText('CIViC', CIVIC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = JSON.parse(text || '{}');
  if (json.errors?.length) throw new ApiError(502, 'Fuente externa no disponible', `CIViC: ${json.errors[0].message}`);
  return json.data;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function civicToCandidate(node: any): EvidenceCandidate | null {
  const type = civicEvidenceType(node?.evidenceType);
  if (!type || !node?.description || node?.id == null) return null;
  const profile: string | null = node.molecularProfile?.name ?? null;
  const simple = profile ? /^([A-Za-z0-9.-]+) (\S+)$/.exec(profile) : null;
  const pmid = String(node.source?.sourceType ?? '').toUpperCase() === 'PUBMED' ? node.source?.citationId ?? null : null;
  return {
    sourceCode: 'CIVIC',
    externalId: `EID${node.id}`,
    geneSymbol: simple ? simple[1].toUpperCase() : null,
    variantDescriptor: simple ? simple[2] : profile,
    molecularProfile: profile,
    evidenceType: type,
    description: String(node.description).trim(),
    diseaseContext: node.disease?.name ?? null,
    sourceLevel: node.evidenceLevel ?? null,
    sourceDirection: node.evidenceDirection ?? null,
    sourceSignificance: node.significance ?? null,
    sourceRating: node.evidenceRating ?? null,
    therapies: (node.therapies ?? []).map((t: { name: string }) => t.name).filter(Boolean),
    interpretationScope: civicScope(node.variantOrigin),
    mappedCertainty: civicCertainty(node.evidenceLevel),
    url: `https://civicdb.org/evidence/${node.id}/summary`,
    pmid,
    citation: node.source?.citation ?? null,
    publicationYear: node.source?.publicationYear ?? null,
  };
}

export async function civicSearch(gene: string, proteinChange: string, size: number, cursor: string | null) {
  const profileName = `${gene} ${proteinChange}`;
  const data = await civicQuery('query($name: String!) { molecularProfiles(name: $name, first: 25) { nodes { id name } } }', { name: profileName });
  const match = (data?.molecularProfiles?.nodes ?? []).find((p: { name: string }) => p.name?.toLowerCase() === profileName.toLowerCase());
  if (!match) {
    return { sourceCode: 'CIVIC', query: profileName, matchedProfile: null, items: [], totalCount: 0, nextCursor: null, note: `CIViC no tiene un perfil molecular con nombre exacto '${profileName}'.` };
  }
  const q = `query($mp: Int!, $first: Int!, $after: String) {
    evidenceItems(molecularProfileId: $mp, status: ACCEPTED, first: $first, after: $after) {
      totalCount pageInfo { endCursor hasNextPage } nodes { ...EvidenceFields } } }\n${EVIDENCE_FIELDS}`;
  const items = (await civicQuery(q, { mp: match.id, first: Math.min(Math.max(size, 1), 50), after: cursor }))?.evidenceItems;
  return {
    sourceCode: 'CIVIC',
    query: profileName,
    matchedProfile: match.name as string,
    items: (items?.nodes ?? []).map(civicToCandidate).filter(Boolean) as EvidenceCandidate[],
    totalCount: items?.totalCount ?? 0,
    nextCursor: items?.pageInfo?.hasNextPage ? items.pageInfo.endCursor : null,
    note: 'Sólo evidencias con estado ACCEPTED en CIViC.',
  };
}

export async function civicFetch(externalId: string): Promise<EvidenceCandidate | null> {
  const digits = externalId.replace(/^EID/i, '');
  if (!/^\d{1,9}$/.test(digits)) throw new ApiError(400, 'Parámetro no válido', `Identificador CIViC no válido: ${externalId}`);
  const data = await civicQuery(`query($id: Int!) { evidenceItem(id: $id) { ...EvidenceFields } }\n${EVIDENCE_FIELDS}`, { id: Number(digits) });
  return data?.evidenceItem ? civicToCandidate(data.evidenceItem) : null;
}

export async function civicVersionLabel(): Promise<string> {
  const data = await civicQuery('{ dataReleases { name } }', {});
  const latest = (data?.dataReleases ?? []).map((r: { name: string }) => r.name).find((n: string) => n && n.toLowerCase() !== 'nightly');
  return latest ? `API GraphQL en vivo (release mensual más reciente: ${latest})` : 'API GraphQL en vivo';
}

// ─── ClinVar ──────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function classification(node: any): ClinVarClassification {
  const last = node?.last_evaluated && !String(node.last_evaluated).startsWith('1/01/01') ? node.last_evaluated : null;
  return {
    description: node?.description || null,
    reviewStatus: node?.review_status || null,
    lastEvaluated: last,
    conditions: (node?.trait_set ?? []).map((t: { trait_name?: string }) => t.trait_name).filter(Boolean),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseClinVarSummaries(result: any): ClinVarRecord[] {
  return (result?.uids ?? []).filter((uid: string) => result[uid]).map((uid: string) => {
    const doc = result[uid];
    return {
      uid,
      accession: doc.accession,
      title: doc.title,
      proteinChange: doc.protein_change || null,
      url: `https://www.ncbi.nlm.nih.gov/clinvar/variation/${uid}/`,
      germline: classification(doc.germline_classification),
      somaticClinicalImpact: classification(doc.clinical_impact_classification),
      oncogenicity: classification(doc.oncogenicity_classification),
    };
  });
}

async function clinvarSummaries(ids: string[]) {
  const json = JSON.parse(await ncbi('ClinVar', 'esummary.fcgi', { db: 'clinvar', id: ids.join(','), retmode: 'json' }));
  return parseClinVarSummaries(json.result);
}

export async function clinvarSearch(gene: string, proteinChange: string): Promise<ClinVarRecord[]> {
  const one = normalizeProteinChange(proteinChange);
  const three = toThreeLetter(one);
  const term = `${gene}[gene] AND "${three ?? one}"`;
  const json = JSON.parse(await ncbi('ClinVar', 'esearch.fcgi', { db: 'clinvar', term, retmode: 'json', retmax: '20' }));
  const ids: string[] = json?.esearchresult?.idlist ?? [];
  if (!ids.length) return [];
  return (await clinvarSummaries(ids)).filter((r) => {
    const byOne = one ? (r.proteinChange ?? '').toUpperCase().split(/,\s*/).includes(one.toUpperCase()) : false;
    const byThree = three ? r.title.includes(`p.${three})`) : false;
    return byOne || byThree;
  });
}

export async function clinvarFetch(uid: string): Promise<ClinVarRecord | null> {
  if (!/^\d{1,12}$/.test(uid)) throw new ApiError(400, 'Parámetro no válido', `UID de ClinVar no válido: ${uid}`);
  return (await clinvarSummaries([uid]))[0] ?? null;
}

export async function clinvarVersionLabel(): Promise<string> {
  const json = JSON.parse(await ncbi('ClinVar', 'einfo.fcgi', { db: 'clinvar', retmode: 'json' }));
  return `NCBI E-utilities (ClinVar lastupdate ${json?.einforesult?.dbinfo?.[0]?.lastupdate ?? 'desconocido'})`;
}

// ─── Reactome ─────────────────────────────────────────────────────────────────
const stripHtml = (s: string | null | undefined) => (s ?? '').replace(/<[^>]{0,500}>/g, '').replace(/&amp;/g, '&').trim();

export async function reactomePathways(gene: string): Promise<{ uniprotId: string | null; pathways: PathwayCandidate[]; note: string | null }> {
  const qs = new URLSearchParams({ query: gene, species: 'Homo sapiens', types: 'Protein', cluster: 'true' });
  const searchText = await fetchText('Reactome', `${REACTOME}/search/query?${qs}`);
  const search = searchText ? JSON.parse(searchText) : { results: [] };
  let uniprot: string | null = null;
  for (const group of search.results ?? []) {
    for (const entry of group.entries ?? []) {
      if (stripHtml(entry.referenceName).toUpperCase() === gene.toUpperCase() && String(entry.databaseName).toLowerCase() === 'uniprot') {
        uniprot = entry.referenceIdentifier;
        break;
      }
    }
    if (uniprot) break;
  }
  if (!uniprot) return { uniprotId: null, pathways: [], note: `Reactome no devolvió una proteína humana con nombre de referencia exacto '${gene}'.` };
  const text = await fetchText('Reactome', `${REACTOME}/data/mapping/UniProt/${encodeURIComponent(uniprot)}/pathways?species=9606`);
  const list = text ? JSON.parse(text) : [];
  return {
    uniprotId: uniprot,
    pathways: list
      .filter((p: { stId?: string; displayName?: string }) => p.stId && p.displayName)
      .map((p: { stId: string; displayName: string }) => ({ externalId: p.stId, name: stripHtml(p.displayName), url: `https://reactome.org/content/detail/${p.stId}` })),
    note: null,
  };
}

export async function reactomeVersionLabel(): Promise<string> {
  const v = await fetchText('Reactome', `${REACTOME}/data/database/version`);
  return `Reactome v${v.trim() || '?'}`;
}
