// Estado del modo demo (navegador) sembrado desde el dataset compartido /demo-data/demo-dataset.json.
import dataset from '../../../../demo-data/demo-dataset.json';
import { normalizeProteinChange } from '../../domain/proteinChange';
import type {
  Biomarker,
  CaseRecord,
  Comment,
  CommentRevision,
  Evidence,
  EvidenceLink,
  Gene,
  GenePathway,
  Histology,
  IhcResult,
  Interpretation,
  MolecularTest,
  Pathway,
  Publication,
  Sample,
  SnapshotSummary,
  SourceVersion,
  TimelineEvent,
  UserRole,
  Variant,
} from '../../domain/types';

export const DEMO_STATE_VERSION = 1;

export interface StoredUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
}

export type StoredCase = Omit<CaseRecord, 'createdBy'> & { createdById: string | null };
export type StoredComment = Omit<Comment, 'caseCode' | 'authorName' | 'authorRoleLabel'>;
export type StoredRevision = CommentRevision & { commentId: string };
export type StoredSnapshot = { summary: Omit<SnapshotSummary, 'caseCode' | 'createdByName'>; content: string };

export interface AuditEntry {
  occurredAt: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId: string | null;
  before: string | null;
  after: string | null;
}

export interface DemoState {
  version: number;
  users: StoredUser[];
  cases: StoredCase[];
  samples: Sample[];
  histology: Histology[];
  ihc: IhcResult[];
  tests: MolecularTest[];
  variants: Variant[];
  biomarkers: Biomarker[];
  genes: Gene[];
  pathways: Pathway[];
  genePathways: GenePathway[];
  publications: Publication[];
  evidence: Evidence[];
  links: EvidenceLink[];
  sourceVersions: SourceVersion[];
  interpretations: Interpretation[];
  timelineEvents: TimelineEvent[];
  comments: StoredComment[];
  revisions: StoredRevision[];
  snapshots: StoredSnapshot[];
  audit: AuditEntry[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

export function geneFromDataset(g: Json): Gene {
  return {
    id: g.id,
    symbol: g.symbol,
    name: g.name ?? null,
    entrezId: g.entrezId ?? null,
    uniprotId: g.uniprotId ?? null,
    ncbiUrl: g.entrezId ? `https://www.ncbi.nlm.nih.gov/gene/${g.entrezId}` : null,
    sourceVersionId: g.sourceVersionId ?? null,
  };
}

export function pubmedUrl(pmid: string | null | undefined): string | null {
  return pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : null;
}

export function seedDemoState(): DemoState {
  const d = dataset as Json;
  const roles = new Map<string, UserRole>(d.users.map((u: Json) => [u.id, u.role]));
  const names = new Map<string, string>(d.users.map((u: Json) => [u.id, u.displayName]));
  const sourceVersions: SourceVersion[] = d.sourceVersions.map((v: Json) => ({ ...v }));
  const genes: Gene[] = d.genes.map(geneFromDataset);
  const publications: Publication[] = d.publications.map((p: Json) => ({
    ...p,
    pubmedUrl: pubmedUrl(p.pmid)!,
    doiUrl: p.doi ? `https://doi.org/${p.doi}` : null,
  }));
  const pathways: Pathway[] = d.pathways.map((p: Json) => ({
    ...p,
    url: p.sourceCode === 'REACTOME' ? `https://reactome.org/content/detail/${p.externalId}` : null,
  }));
  const evidence: Evidence[] = d.evidence.map((e: Json) => {
    const pub = publications.find((p) => p.id === e.publicationId);
    return {
      ...e,
      geneSymbol: genes.find((g) => g.id === e.geneId)?.symbol ?? null,
      sourceTherapies: null,
      pmid: pub?.pmid ?? null,
      pubmedUrl: pubmedUrl(pub?.pmid),
      doi: pub?.doi ?? null,
      publishedDate: pub?.pubDate ?? null,
      sourceVersionLabel: sourceVersions.find((v) => v.id === e.sourceVersionId)?.versionLabel ?? null,
      statusReason: null,
      createdAt: e.retrievedAt,
      version: 0,
    };
  });

  const state: DemoState = {
    version: DEMO_STATE_VERSION,
    users: d.users.map((u: Json) => ({ ...u })),
    cases: [],
    samples: [],
    histology: [],
    ihc: [],
    tests: [],
    variants: [],
    biomarkers: [],
    genes,
    pathways,
    genePathways: d.genePathways.map((gp: Json) => ({ ...gp })),
    publications,
    evidence,
    links: [],
    sourceVersions,
    interpretations: [],
    timelineEvents: [],
    comments: [],
    revisions: [],
    snapshots: [],
    audit: [],
  };

  for (const c of d.cases) {
    state.cases.push({
      id: c.id, caseCode: c.caseCode, organ: c.organ, tumorType: c.tumorType, diagnosis: c.diagnosis ?? null,
      histologicSubtype: c.histologicSubtype ?? null, grade: c.grade ?? null, notes: c.notes ?? null, demo: true,
      createdAt: c.createdAt, updatedAt: c.createdAt, createdById: c.createdBy ?? null, version: 0,
    });
    for (const s of c.samples) {
      const { histology, ihc, molecularTests, ...sample } = s;
      state.samples.push({ ...sample, caseId: c.id, createdAt: c.createdAt, version: 0 });
      for (const h of histology) state.histology.push({ ...h, sampleId: s.id });
      for (const r of ihc) state.ihc.push({ ...r, sampleId: s.id });
      for (const t of molecularTests) {
        const { variants, biomarkers, ...test } = t;
        state.tests.push({ ...test, sampleId: s.id, genesAnalyzed: [...test.genesAnalyzed].sort() });
        for (const v of variants) {
          let gene = state.genes.find((g) => g.symbol === v.geneSymbol);
          if (!gene) {
            gene = { id: crypto.randomUUID(), symbol: v.geneSymbol, name: null, entrezId: null, uniprotId: null, ncbiUrl: null, sourceVersionId: null };
            state.genes.push(gene);
          }
          state.variants.push({
            ...v, molecularTestId: t.id, geneId: gene.id, proteinChange: normalizeProteinChange(v.hgvsP),
            copyNumber: v.copyNumber ?? null, fusionPartnerSymbol: v.fusionPartnerSymbol ?? null, createdAt: c.createdAt,
          });
        }
        for (const b of biomarkers) state.biomarkers.push({ ...b, molecularTestId: t.id });
      }
    }
    for (const e of c.timelineEvents) state.timelineEvents.push({ ...e, caseId: c.id });
    for (const l of c.evidenceLinks) state.links.push({ variantId: l.variantId, evidenceId: l.evidenceId, linkedAt: c.createdAt, linkedBy: null, note: l.note ?? null });
    for (const i of c.interpretations) {
      state.interpretations.push({
        ...i, caseId: c.id, status: 'CURRENT', supersedesId: null, authorName: names.get(i.authorId) ?? null,
        authorRole: roles.get(i.authorId)!,
      });
    }
    for (const m of c.comments) {
      state.comments.push({ ...m, caseId: c.id, authorRole: roles.get(m.authorId)!, editedAt: null });
    }
  }
  return state;
}
