// Lógica pura para "enseñar el tumor": resúmenes, ruta principal, enfoque, observaciones objetivas
// y explicaciones deterministas. Nada de aquí infiere conclusiones clínicas: sólo reorganiza y
// verbaliza datos presentes en el agregado del caso.
import type { BoardGraph } from './boardGraph';
import { certaintyDistribution, detectContradictions } from './certainty';
import {
  CERTAINTY_ORDER,
  CERTAINTY_SHORT,
  EVIDENCE_TYPE_LABEL,
  SAMPLE_TYPE_LABEL,
  SOURCE_LABEL,
  TEST_TYPE_LABEL,
  formatDate,
  formatPct,
  variantLabel,
} from './labels';
import { variantKey } from './sampleCompare';
import type { CaseBoard, Certainty, Evidence, EvidenceType, IhcResult, Sample, Variant } from './types';

const byDate = (a: string | null | undefined, b: string | null | undefined) => (a ?? '').localeCompare(b ?? '');

/** Muestra principal = la más reciente con fecha (o la última registrada). */
export function principalSample(board: CaseBoard): Sample | null {
  if (!board.samples.length) return null;
  return [...board.samples].sort((a, b) => byDate(a.collectionDate ?? a.createdAt, b.collectionDate ?? b.createdAt)).at(-1)!;
}

export function variantsOfSample(board: CaseBoard, sampleId: string): Variant[] {
  const tests = new Set(board.molecularTests.filter((t) => t.sampleId === sampleId).map((t) => t.id));
  return board.variants.filter((v) => tests.has(v.molecularTestId));
}

export function evidenceOfVariant(board: CaseBoard, variantId: string): Evidence[] {
  const ids = new Set(board.evidenceLinks.filter((l) => l.variantId === variantId).map((l) => l.evidenceId));
  return board.evidence.filter((e) => ids.has(e.id));
}

// ─── resumen de evidencia ─────────────────────────────────────────────────────
export interface EvidenceSummaryData {
  total: number;
  active: number;
  byCertainty: Record<Certainty, number>;
  byType: [EvidenceType, number][];
  bySource: [string, number][];
  publications: number;
  contradictions: number;
}

export function summarizeEvidence(evidence: Evidence[]): EvidenceSummaryData {
  const count = <K extends string>(keys: K[]) => {
    const m = new Map<K, number>();
    for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const active = evidence.filter((e) => e.status === 'ACTIVE');
  return {
    total: evidence.length,
    active: active.length,
    byCertainty: certaintyDistribution(evidence),
    byType: count(active.map((e) => e.evidenceType)),
    bySource: count(active.map((e) => SOURCE_LABEL[e.sourceCode] ?? e.sourceCode)),
    publications: new Set(active.map((e) => e.pmid).filter(Boolean)).size,
    contradictions: detectContradictions(evidence).length,
  };
}

// ─── resumen molecular del caso ───────────────────────────────────────────────
export interface CaseSummaryData {
  sample: Sample | null;
  sampleCount: number;
  histology: string | null;
  ihc: IhcResult[];
  ihcTotal: number;
  variants: { variant: Variant; evidenceCount: number }[];
  variantTotal: number;
  evidence: EvidenceSummaryData;
  lastScientificUpdate: string | null;
}

export function computeCaseSummary(board: CaseBoard): CaseSummaryData {
  const sample = principalSample(board);
  const ihc = sample ? board.ihc.filter((r) => r.sampleId === sample.id) : [];
  const variants = (sample ? variantsOfSample(board, sample.id) : [])
    .map((variant) => ({ variant, evidenceCount: evidenceOfVariant(board, variant.id).length }))
    .sort((a, b) => b.evidenceCount - a.evidenceCount || (b.variant.vaf ?? -1) - (a.variant.vaf ?? -1));
  const histology = sample ? board.histology.find((h) => h.sampleId === sample.id)?.diagnosis ?? null : null;
  const dates = [
    ...board.evidence.map((e) => e.retrievedAt),
    ...board.publications.map((p) => p.retrievedAt),
    ...board.evidenceLinks.map((l) => l.linkedAt),
    ...board.genePathways.map((g) => g.retrievedAt),
  ].filter((d): d is string => !!d);
  return {
    sample,
    sampleCount: board.samples.length,
    histology: histology ?? board.caseRecord.histologicSubtype,
    ihc: ihc.slice(0, 4),
    ihcTotal: ihc.length,
    variants: variants.slice(0, 4),
    variantTotal: variants.length,
    evidence: summarizeEvidence(board.evidence),
    lastScientificUpdate: dates.length ? dates.sort().at(-1)! : null,
  };
}

// ─── ruta principal y enfoque ─────────────────────────────────────────────────
function certaintyRank(c: Certainty) {
  // Para elegir la evidencia "más sólida" de la ruta: fuerte primero; contradictoria/desconocida al final.
  return ['STRONG', 'MODERATE', 'LIMITED', 'INSUFFICIENT', 'CONTRADICTORY', 'UNKNOWN'].indexOf(c);
}

/**
 * Ruta principal (progressive disclosure): caso → muestra principal → histología → estudios →
 * variantes → gen → primer pathway trazable → evidencia más sólida de cada variante.
 */
export function mainPathIds(graph: BoardGraph, board: CaseBoard): Set<string> {
  const ids = new Set<string>([graph.rootId]);
  const sample = principalSample(board);
  if (sample) {
    ids.add(`sample:${sample.id}`);
    const h = board.histology.find((x) => x.sampleId === sample.id);
    if (h) ids.add(`histology:${h.id}`);
    for (const t of board.molecularTests.filter((x) => x.sampleId === sample.id)) ids.add(`test:${t.id}`);
    for (const v of variantsOfSample(board, sample.id)) {
      ids.add(`variant:${v.id}`);
      ids.add(`gene:${v.geneId}`);
      const gp = board.genePathways.find((x) => x.geneId === v.geneId);
      if (gp) ids.add(`pathway:${gp.pathwayId}`);
      const best = evidenceOfVariant(board, v.id)
        .filter((e) => e.status === 'ACTIVE')
        .sort((a, b) => certaintyRank(a.certainty) - certaintyRank(b.certainty))[0];
      if (best) ids.add(`evidence:${best.id}`);
    }
  }
  // Nodos agrupadores que conectan elementos incluidos.
  for (const e of graph.edges) {
    if (ids.has(e.target) && (e.source.startsWith('evgroup:') || e.source.startsWith('pwgroup:'))) ids.add(e.source);
  }
  return new Set([...ids].filter((id) => graph.nodes.some((n) => n.id === id)));
}

/** Enfoque: el nodo, su cadena de ancestros hasta el caso, sus padres y sus hijos directos. */
export function focusIds(graph: BoardGraph, nodeId: string): Set<string> {
  const parents = new Map<string, string[]>();
  const children = new Map<string, string[]>();
  for (const e of graph.edges) {
    parents.set(e.target, [...(parents.get(e.target) ?? []), e.source]);
    children.set(e.source, [...(children.get(e.source) ?? []), e.target]);
  }
  const ids = new Set<string>([nodeId]);
  const stack = [nodeId];
  while (stack.length) {
    const id = stack.pop()!;
    for (const p of parents.get(id) ?? []) if (!ids.has(p)) { ids.add(p); stack.push(p); }
  }
  for (const c of children.get(nodeId) ?? []) ids.add(c);
  return ids;
}

/** Cadena de títulos desde el caso hasta el nodo (primer padre en cada paso). */
export function pathTo(graph: BoardGraph, nodeId: string): string[] {
  const parent = new Map<string, string>();
  for (const e of graph.edges) if (!parent.has(e.target)) parent.set(e.target, e.source);
  const titles: string[] = [];
  let id: string | undefined = nodeId;
  const guard = new Set<string>();
  while (id && !guard.has(id)) {
    guard.add(id);
    const node = graph.nodes.find((n) => n.id === id);
    if (node) titles.unshift(node.title);
    id = parent.get(id);
  }
  return titles;
}

// ─── explicación determinista ─────────────────────────────────────────────────
const certaintyPhrase = (evidence: Evidence[]) => {
  const d = certaintyDistribution(evidence);
  const parts = CERTAINTY_ORDER.filter((c) => d[c] > 0).map((c) => `${d[c]} ${CERTAINTY_SHORT[c].toLowerCase()}`);
  return parts.length ? ` (certeza: ${parts.join(', ')})` : '';
};

/** Verbaliza sólo datos presentes. Si falta un dato, se omite la frase; nunca se completa. */
export function explainNode(board: CaseBoard, graph: BoardGraph, nodeId: string): string[] {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) return [];
  const out: string[] = [];
  const path = pathTo(graph, nodeId);
  if (path.length > 1) out.push(`Ruta en la pizarra: ${path.join(' → ')}.`);
  const sampleSentences = (s: Sample) => {
    out.push(`La muestra «${s.label}» es de tipo ${SAMPLE_TYPE_LABEL[s.sampleType].toLowerCase()}${s.anatomicSite ? ` (${s.anatomicSite})` : ''}${s.collectionDate ? `, obtenida el ${formatDate(s.collectionDate)}` : ''}.`);
    if (s.tumorCellularityPct != null) out.push(`La muestra registra ${formatPct(s.tumorCellularityPct)} de celularidad tumoral.`);
  };
  switch (node.kind) {
    case 'variant': {
      const v = board.variants.find((x) => x.id === node.entityId)!;
      const t = board.molecularTests.find((x) => x.id === v.molecularTestId);
      const s = t && board.samples.find((x) => x.id === t.sampleId);
      if (t && s) out.push(`Esta variante fue detectada mediante ${TEST_TYPE_LABEL[t.testType]} en la muestra «${s.label}»${t.testDate ? ` (estudio del ${formatDate(t.testDate)})` : ''}.`);
      if (s?.tumorCellularityPct != null) out.push(`La muestra registra ${formatPct(s.tumorCellularityPct)} de celularidad tumoral.`);
      const measures = [v.vaf != null ? `VAF ${formatPct(v.vaf)}` : null, v.coverage != null ? `cobertura ${v.coverage} lecturas` : null].filter(Boolean);
      out.push(`La variante corresponde a ${variantLabel(v)}${v.hgvsC && v.hgvsP ? ` (${v.hgvsC})` : ''}${measures.length ? ` con ${measures.join(' y ')}` : ''}.`);
      if (t?.limitOfDetectionPct != null) out.push(`El estudio declara un límite de detección de ${formatPct(t.limitOfDetectionPct)}.`);
      const ev = evidenceOfVariant(board, v.id);
      out.push(ev.length ? `Existen ${ev.length} registro(s) de evidencia asociados${certaintyPhrase(ev)}.` : 'No hay registros de evidencia enlazados a esta variante.');
      const pw = board.genePathways.filter((g) => g.geneId === v.geneId).length;
      if (pw) out.push(`El gen ${v.geneSymbol} está vinculado a ${pw} pathway(s) trazables en la pizarra.`);
      break;
    }
    case 'sample': sampleSentences(board.samples.find((x) => x.id === node.entityId)!); break;
    case 'test': {
      const t = board.molecularTests.find((x) => x.id === node.entityId)!;
      out.push(`Estudio ${TEST_TYPE_LABEL[t.testType]}${t.panelName ? ` con el panel «${t.panelName}»` : ''}${t.testDate ? ` realizado el ${formatDate(t.testDate)}` : ''}.`);
      if (t.genesAnalyzed.length) out.push(`Analizó ${t.genesAnalyzed.length} gen(es): ${t.genesAnalyzed.join(', ')}.`);
      const n = board.variants.filter((v) => v.molecularTestId === t.id).length;
      out.push(`Registra ${n} variante(s).`);
      break;
    }
    case 'gene': {
      const g = board.genes.find((x) => x.id === node.entityId)!;
      out.push(g.name ? `${g.symbol} (${g.name}) según NCBI Gene${g.entrezId ? ` ${g.entrezId}` : ''}.` : `${g.symbol}: nombre pendiente de fuente verificada.`);
      const pw = board.genePathways.filter((x) => x.geneId === g.id);
      out.push(pw.length ? `Participa en ${pw.length} pathway(s) registrados desde Reactome.` : 'No hay pathways trazables registrados para este gen.');
      break;
    }
    case 'evidence': {
      const e = board.evidence.find((x) => x.id === node.entityId)!;
      out.push(`Registro ${SOURCE_LABEL[e.sourceCode] ?? e.sourceCode}${e.externalId ? ` ${e.externalId}` : ''} de tipo ${EVIDENCE_TYPE_LABEL[e.evidenceType].toLowerCase()}${e.geneSymbol ? ` sobre ${e.geneSymbol} ${e.variantDescriptor ?? ''}`.trimEnd() : ''}.`);
      if (e.diseaseContext) out.push(`El contexto registrado en la fuente es «${e.diseaseContext}».`);
      if (e.sourceLevel) out.push(`Nivel en la fuente: ${e.sourceLevel}${e.sourceDirection ? `, dirección ${e.sourceDirection}` : ''}.`);
      out.push(`Certeza en MolPath: ${CERTAINTY_SHORT[e.certainty].toLowerCase()} (${e.certaintyBasis === 'SOURCE_MAPPING' ? 'mapeada desde la fuente' : e.certaintyBasis === 'USER_ASSIGNED' ? 'asignada por un usuario' : 'sin clasificar'}).`);
      if (e.pmid) out.push(`Cita la publicación PMID ${e.pmid}.`);
      break;
    }
    default:
      if (node.subtitle) out.push(`${node.title}: ${node.subtitle}.`);
  }
  return out;
}

// ─── preguntas abiertas (observaciones objetivas) ─────────────────────────────
export interface OpenQuestion {
  id: string;
  level: 'attention' | 'info';
  title: string;
  detail: string;
  nodeId: string | null;
}

/**
 * Observaciones del sistema derivadas de datos presentes. No son interpretaciones clínicas ni
 * recomendaciones: señalan huecos de información o de trazabilidad.
 */
export function openQuestions(board: CaseBoard): OpenQuestion[] {
  const q: OpenQuestion[] = [];
  for (const s of board.samples) {
    if (s.tumorCellularityPct == null) q.push({ id: `pct-${s.id}`, level: 'attention', title: `«${s.label}» sin porcentaje tumoral`, detail: 'Sin este dato no puede contextualizarse la VAF ni la sensibilidad del estudio.', nodeId: `sample:${s.id}` });
    if (!board.molecularTests.some((t) => t.sampleId === s.id)) q.push({ id: `test-${s.id}`, level: 'info', title: `«${s.label}» sin estudio molecular registrado`, detail: 'La muestra no tiene estudios moleculares asociados en MolPath.', nodeId: `sample:${s.id}` });
  }
  for (const v of board.variants) {
    const ev = evidenceOfVariant(board, v.id);
    if (!ev.length) q.push({ id: `ev-${v.id}`, level: 'attention', title: `${variantLabel(v)} sin evidencia asociada`, detail: 'No hay registros de evidencia enlazados. Puede consultarse CIViC/ClinVar desde la pizarra.', nodeId: `variant:${v.id}` });
    const t = board.molecularTests.find((x) => x.id === v.molecularTestId);
    if (v.vaf != null && t?.limitOfDetectionPct != null && v.vaf < t.limitOfDetectionPct * 2)
      q.push({ id: `lod-${v.id}`, level: 'info', title: `${variantLabel(v)} con VAF cercana al límite de detección`, detail: `VAF ${formatPct(v.vaf)} frente a un límite declarado de ${formatPct(t.limitOfDetectionPct)}.`, nodeId: `variant:${v.id}` });
  }
  for (const c of detectContradictions(board.evidence)) {
    q.push({ id: `contra-${c.key}`, level: 'attention', title: 'Evidencia contradictoria entre registros de fuentes', detail: c.description, nodeId: `evidence:${c.evidenceIds[0]}` });
  }
  for (const e of board.evidence) {
    if (!e.url && !e.pmid && !e.doi) q.push({ id: `src-${e.id}`, level: 'attention', title: 'Evidencia sin enlace de fuente', detail: `${e.sourceCode} ${e.externalId ?? ''}: no registra URL, PMID ni DOI.`, nodeId: `evidence:${e.id}` });
    if (e.status !== 'ACTIVE') q.push({ id: `st-${e.id}`, level: 'info', title: `Evidencia ${e.externalId ?? ''} no vigente pero enlazada`, detail: `Estado: ${e.status}${e.statusReason ? ` — ${e.statusReason}` : ''}.`, nodeId: `evidence:${e.id}` });
  }
  // Evidencia consultada con una versión de la fuente anterior a otra presente en el caso.
  const latestBySource = new Map<string, string>();
  for (const v of board.sourceVersions) if ((latestBySource.get(v.sourceCode) ?? '') < v.retrievedAt) latestBySource.set(v.sourceCode, v.retrievedAt);
  for (const e of board.evidence) {
    const version = board.sourceVersions.find((v) => v.id === e.sourceVersionId);
    if (version && latestBySource.get(version.sourceCode)! > version.retrievedAt)
      q.push({ id: `old-${e.id}`, level: 'info', title: `Evidencia ${e.externalId ?? ''} consultada con una versión anterior de ${SOURCE_LABEL[version.sourceCode] ?? version.sourceCode}`, detail: `Versión registrada: ${version.versionLabel}.`, nodeId: `evidence:${e.id}` });
  }
  for (const g of board.genes) if (!g.name) q.push({ id: `gene-${g.id}`, level: 'info', title: `${g.symbol} sin metadatos verificados`, detail: 'Nombre e identificadores pendientes de fuente verificada.', nodeId: `gene:${g.id}` });
  return q;
}

// ─── evolución longitudinal ───────────────────────────────────────────────────
export interface VariantTrajectory {
  key: string;
  label: string;
  points: { sampleId: string; sampleLabel: string; date: string | null; vaf: number | null }[];
}

/** Variantes presentes en ≥ 2 muestras, con su VAF en orden cronológico. */
export function variantEvolution(board: CaseBoard): VariantTrajectory[] {
  const samples = [...board.samples].sort((a, b) => byDate(a.collectionDate, b.collectionDate));
  const map = new Map<string, VariantTrajectory>();
  for (const s of samples) {
    for (const v of variantsOfSample(board, s.id)) {
      const key = variantKey(v);
      const t = map.get(key) ?? { key, label: variantLabel(v), points: [] };
      t.points.push({ sampleId: s.id, sampleLabel: s.label, date: s.collectionDate, vaf: v.vaf });
      map.set(key, t);
    }
  }
  return [...map.values()].filter((t) => t.points.length >= 2);
}

/** Variantes que aparecen por primera vez en cada estudio molecular (orden cronológico). */
export function newVariantsByTest(board: CaseBoard): Map<string, string[]> {
  const seen = new Set<string>();
  const out = new Map<string, string[]>();
  const tests = [...board.molecularTests].sort((a, b) => byDate(a.testDate, b.testDate));
  for (const t of tests) {
    const fresh: string[] = [];
    for (const v of board.variants.filter((x) => x.molecularTestId === t.id)) {
      const k = variantKey(v);
      if (!seen.has(k)) fresh.push(variantLabel(v));
      seen.add(k);
    }
    out.set(t.id, fresh);
  }
  return out;
}
