import { detectContradictions } from './certainty';
import {
  CERTAINTY_SHORT,
  EVIDENCE_TYPE_LABEL,
  IHC_RESULT_LABEL,
  ORIGIN_LABEL,
  ROLE_LABEL,
  SAMPLE_TYPE_LABEL,
  SOURCE_LABEL,
  TEST_TYPE_LABEL,
  VARIANT_TYPE_LABEL,
  BIOMARKER_TYPE_LABEL,
  formatDate,
  formatPct,
  variantLabel,
} from './labels';
import type { CaseBoard, Certainty, GraphState, TargetType } from './types';

export type NodeKind =
  | 'case'
  | 'sample'
  | 'histology'
  | 'ihc'
  | 'test'
  | 'variant'
  | 'biomarker'
  | 'gene'
  | 'pathway'
  | 'evidence'
  | 'publication'
  | 'interpretation'
  | 'evgroup'
  | 'pwgroup';

/** Capa de procedencia: datos del caso, conocimiento externo con fuente, o razonamiento humano. */
export type Layer = 'case' | 'knowledge' | 'reasoning';

export interface BoardNode {
  id: string;
  kind: NodeKind;
  layer: Layer;
  entityId: string;
  title: string;
  subtitle: string | null;
  meta: string | null;
  /** Detalle adicional para zoom cercano (sólo datos registrados). */
  extra: string | null;
  certainty: Certainty | null;
  contradiction: boolean;
  inactive: boolean;
  commentCount: number;
}

export type EdgeKind = 'structure' | 'evidence' | 'membership' | 'citation' | 'reasoning';

export interface BoardEdge {
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
  certainty: Certainty | null;
  label: string | null;
}

export interface BoardGraph {
  nodes: BoardNode[];
  edges: BoardEdge[];
  rootId: string;
}

export const LAYER_OF: Record<NodeKind, Layer> = {
  case: 'case',
  sample: 'case',
  histology: 'case',
  ihc: 'case',
  test: 'case',
  variant: 'case',
  biomarker: 'case',
  gene: 'knowledge',
  pathway: 'knowledge',
  evidence: 'knowledge',
  publication: 'knowledge',
  pwgroup: 'knowledge',
  evgroup: 'knowledge',
  interpretation: 'reasoning',
};

export const KIND_LABEL: Record<NodeKind, string> = {
  case: 'Caso',
  sample: 'Muestra',
  histology: 'Histología',
  ihc: 'IHQ',
  test: 'Estudio molecular',
  variant: 'Variante',
  biomarker: 'Biomarcador',
  gene: 'Gen',
  pathway: 'Pathway',
  evidence: 'Evidencia',
  publication: 'Publicación',
  interpretation: 'Interpretación',
  evgroup: 'Grupo de evidencias',
  pwgroup: 'Grupo de pathways',
};

/** Por encima de este número de hijos, evidencias y pathways se agrupan en un nodo colapsable. */
export const GROUP_THRESHOLD = 5;

export interface BuildOptions {
  groupThreshold?: number;
}

const truncate = (s: string | null | undefined, n: number) => (!s ? null : s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function buildBoardGraph(board: CaseBoard, options: BuildOptions = {}): BoardGraph {
  const threshold = options.groupThreshold ?? GROUP_THRESHOLD;
  const nodes: BoardNode[] = [];
  const edges: BoardEdge[] = [];
  const seen = new Set<string>();
  const comments = board.commentCounts ?? {};

  const addNode = (n: Omit<BoardNode, 'layer' | 'commentCount' | 'contradiction' | 'inactive' | 'certainty' | 'meta' | 'extra'> &
    Partial<Pick<BoardNode, 'contradiction' | 'inactive' | 'certainty' | 'meta' | 'extra'>>, targetType: TargetType) => {
    if (seen.has(n.id)) return;
    seen.add(n.id);
    nodes.push({
      certainty: null,
      meta: null,
      extra: null,
      contradiction: false,
      inactive: false,
      ...n,
      layer: LAYER_OF[n.kind],
      commentCount: (comments[`${targetType}:${n.entityId}`] ?? 0) + (comments[`GRAPH_NODE:${n.id}`] ?? 0),
    });
  };
  const addEdge = (source: string, target: string, kind: EdgeKind, extra: Partial<BoardEdge> = {}) => {
    const id = `${source}->${target}`;
    if (!edges.some((e) => e.id === id)) edges.push({ id, source, target, kind, certainty: null, label: null, ...extra });
  };

  const c = board.caseRecord;
  const rootId = `case:${c.id}`;
  addNode({ id: rootId, kind: 'case', entityId: c.id, title: c.caseCode, subtitle: c.tumorType, meta: c.organ }, 'CASE');

  for (const s of board.samples) {
    const id = `sample:${s.id}`;
    addNode({
      id,
      kind: 'sample',
      entityId: s.id,
      title: s.label,
      subtitle: [SAMPLE_TYPE_LABEL[s.sampleType], s.anatomicSite].filter(Boolean).join(' · '),
      meta: [formatDate(s.collectionDate), s.tumorCellularityPct != null ? `celularidad ${formatPct(s.tumorCellularityPct)}` : null]
        .filter(Boolean)
        .join(' · '),
      extra: [s.necrosisPct != null ? `necrosis ${formatPct(s.necrosisPct)}` : null, s.dnaAvailable ? 'ADN disponible' : null, s.rnaAvailable ? 'ARN disponible' : null].filter(Boolean).join(' · ') || null,
    }, 'SAMPLE');
    addEdge(rootId, id, 'structure');
  }
  for (const h of board.histology) {
    const id = `histology:${h.id}`;
    addNode({ id, kind: 'histology', entityId: h.id, title: h.diagnosis, subtitle: h.histologicSubtype, meta: h.grade }, 'HISTOLOGY');
    addEdge(`sample:${h.sampleId}`, id, 'structure');
  }
  for (const r of board.ihc) {
    const id = `ihc:${r.id}`;
    const value = r.score ?? (r.percentage != null ? formatPct(r.percentage) : null);
    addNode({ id, kind: 'ihc', entityId: r.id, title: r.marker, subtitle: [IHC_RESULT_LABEL[r.result], value].filter(Boolean).join(' · '), meta: r.method }, 'IHC');
    addEdge(`sample:${r.sampleId}`, id, 'structure');
  }
  for (const t of board.molecularTests) {
    const id = `test:${t.id}`;
    addNode({
      id,
      kind: 'test',
      entityId: t.id,
      title: TEST_TYPE_LABEL[t.testType],
      subtitle: t.panelName,
      meta: [formatDate(t.testDate), t.limitOfDetectionPct != null ? `LoD ${formatPct(t.limitOfDetectionPct)}` : null].filter(Boolean).join(' · '),
      extra: [t.meanDepth != null ? `${t.meanDepth}x` : null, t.genesAnalyzed.length ? `${t.genesAnalyzed.length} genes` : null].filter(Boolean).join(' · ') || null,
    }, 'MOLECULAR_TEST');
    addEdge(`sample:${t.sampleId}`, id, 'structure');
  }

  const geneById = new Map(board.genes.map((g) => [g.id, g]));
  const evidenceById = new Map(board.evidence.map((e) => [e.id, e]));
  const contradictions = detectContradictions(board.evidence);
  const contradictory = new Set(contradictions.flatMap((c) => c.evidenceIds));

  for (const v of board.variants) {
    const id = `variant:${v.id}`;
    const linked = board.evidenceLinks.filter((l) => l.variantId === v.id).map((l) => evidenceById.get(l.evidenceId)).filter(Boolean);
    addNode({
      id,
      kind: 'variant',
      entityId: v.id,
      title: variantLabel(v),
      subtitle: [v.vaf != null ? `VAF ${formatPct(v.vaf)}` : null, VARIANT_TYPE_LABEL[v.variantType], ORIGIN_LABEL[v.origin]].filter(Boolean).join(' · '),
      meta: linked.length ? `${linked.length} evidencia(s) enlazada(s)` : 'Sin evidencia enlazada',
      extra: [v.transcript, v.hgvsC, v.coverage != null ? `cobertura ${v.coverage}x` : null].filter(Boolean).join(' · ') || null,
      contradiction: linked.some((e) => e && contradictory.has(e.id)),
    }, 'VARIANT');
    addEdge(`test:${v.molecularTestId}`, id, 'structure');
    const gene = geneById.get(v.geneId);
    if (gene) addEdge(id, `gene:${gene.id}`, 'structure', { label: 'gen' });
  }
  for (const b of board.biomarkers) {
    const id = `biomarker:${b.id}`;
    const value = b.valueNumeric != null ? `${b.valueNumeric}${b.unit ? ` ${b.unit}` : ''}` : b.valueText;
    addNode({ id, kind: 'biomarker', entityId: b.id, title: `${BIOMARKER_TYPE_LABEL[b.biomarkerType]} — ${value ?? '—'}`, subtitle: b.name }, 'BIOMARKER');
    addEdge(`test:${b.molecularTestId}`, id, 'structure');
  }

  // ── capa de conocimiento ──
  const pathwayById = new Map(board.pathways.map((p) => [p.id, p]));
  for (const g of board.genes) {
    addNode({
      id: `gene:${g.id}`,
      kind: 'gene',
      entityId: g.id,
      title: g.symbol,
      subtitle: g.name ?? 'Nombre pendiente de fuente verificada',
      meta: g.entrezId ? `NCBI Gene ${g.entrezId}` : null,
    }, 'GENE');
    const memberships = board.genePathways.filter((gp) => gp.geneId === g.id);
    let parent = `gene:${g.id}`;
    if (memberships.length > threshold) {
      parent = `pwgroup:${g.id}`;
      addNode({ id: parent, kind: 'pwgroup', entityId: g.id, title: `${memberships.length} pathways`, subtitle: `${g.symbol} · Reactome` }, 'GRAPH_NODE');
      addEdge(`gene:${g.id}`, parent, 'membership');
    }
    for (const gp of memberships) {
      const p = pathwayById.get(gp.pathwayId);
      if (!p) continue;
      const pid = `pathway:${p.id}`;
      addNode({ id: pid, kind: 'pathway', entityId: p.id, title: p.name, subtitle: `${SOURCE_LABEL[p.sourceCode] ?? p.sourceCode} · ${p.externalId}` }, 'PATHWAY');
      addEdge(parent, pid, 'membership', { label: parent.startsWith('gene:') ? SOURCE_LABEL[p.sourceCode] ?? p.sourceCode : null });
    }
  }

  const pubById = new Map(board.publications.map((p) => [p.id, p]));
  for (const v of board.variants) {
    const links = board.evidenceLinks.filter((l) => l.variantId === v.id);
    let parent = `variant:${v.id}`;
    if (links.length > threshold) {
      parent = `evgroup:${v.id}`;
      addNode({ id: parent, kind: 'evgroup', entityId: v.id, title: `${links.length} evidencias`, subtitle: variantLabel(v) }, 'GRAPH_NODE');
      addEdge(`variant:${v.id}`, parent, 'evidence');
    }
    for (const l of links) {
      const e = evidenceById.get(l.evidenceId);
      if (!e) continue;
      const eid = `evidence:${e.id}`;
      addNode({
        id: eid,
        kind: 'evidence',
        entityId: e.id,
        title: `${EVIDENCE_TYPE_LABEL[e.evidenceType]} · ${SOURCE_LABEL[e.sourceCode] ?? e.sourceCode}${e.externalId ? ` ${e.externalId}` : ''}`,
        subtitle: e.diseaseContext,
        meta: e.sourceLevel ? `Nivel en fuente: ${e.sourceLevel}${e.sourceDirection ? ` · ${e.sourceDirection}` : ''}` : null,
        certainty: e.certainty,
        contradiction: contradictory.has(e.id),
        inactive: e.status !== 'ACTIVE',
        extra: [e.pmid ? `PMID ${e.pmid}` : null, e.sourceVersionLabel].filter(Boolean).join(' · ') || null,
      }, 'EVIDENCE');
      addEdge(parent, eid, 'evidence', { certainty: e.certainty, label: parent.startsWith('variant:') ? CERTAINTY_SHORT[e.certainty] : null });
      const pub = e.publicationId ? pubById.get(e.publicationId) : undefined;
      if (pub) {
        const pid = `publication:${pub.id}`;
        addNode({ id: pid, kind: 'publication', entityId: pub.id, title: `PMID ${pub.pmid}`, subtitle: truncate(pub.title, 80), meta: [pub.journal, pub.pubYear].filter(Boolean).join(' · ') }, 'PUBLICATION');
        addEdge(eid, pid, 'citation');
      }
    }
  }

  // ── capa de razonamiento ──
  const targetNode = (type: TargetType, targetId: string): string | null => {
    const prefix: Partial<Record<TargetType, string>> = {
      CASE: 'case', SAMPLE: 'sample', HISTOLOGY: 'histology', IHC: 'ihc', MOLECULAR_TEST: 'test', VARIANT: 'variant',
      BIOMARKER: 'biomarker', EVIDENCE: 'evidence', GENE: 'gene', PATHWAY: 'pathway', PUBLICATION: 'publication', INTERPRETATION: 'interpretation',
    };
    if (type === 'GRAPH_NODE') return seen.has(targetId) ? targetId : null;
    const id = prefix[type] ? `${prefix[type]}:${targetId}` : null;
    return id && seen.has(id) ? id : null;
  };
  for (const i of board.interpretations) {
    const id = `interpretation:${i.id}`;
    addNode({
      id,
      kind: 'interpretation',
      entityId: i.id,
      title: `${i.authorName ?? 'Autor'} · ${ROLE_LABEL[i.authorRole]}`,
      subtitle: truncate(i.statement, 90),
      meta: formatDate(i.createdAt),
      certainty: i.certainty,
      inactive: i.status === 'SUPERSEDED',
    }, 'INTERPRETATION');
    const target = targetNode(i.targetType, i.targetId) ?? rootId;
    addEdge(target, id, 'reasoning', { certainty: i.certainty });
  }

  return { nodes, edges, rootId };
}

/** Grupos colapsados por defecto: los nodos agrupadores (evidencias/pathways numerosos). */
export function defaultGraphState(graph: BoardGraph): GraphState {
  return {
    collapsed: graph.nodes.filter((n) => n.kind === 'evgroup' || n.kind === 'pwgroup').map((n) => n.id),
    layers: { knowledge: true, reasoning: true },
  };
}

export interface VisibleGraph {
  nodes: BoardNode[];
  edges: BoardEdge[];
  hiddenDescendants: Record<string, number>;
}

/**
 * Nodos visibles: alcanzables desde la raíz sin atravesar nodos colapsados y respetando las capas activas.
 * Un gen compartido por varias variantes permanece visible mientras alguna de ellas lo esté.
 */
export function visibleGraph(graph: BoardGraph, state: GraphState): VisibleGraph {
  const collapsed = new Set(state.collapsed);
  const layerOn = (n: BoardNode) =>
    n.layer === 'case' || (n.layer === 'knowledge' ? state.layers.knowledge : state.layers.reasoning);
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const children = new Map<string, string[]>();
  for (const e of graph.edges) children.set(e.source, [...(children.get(e.source) ?? []), e.target]);

  const visible = new Set<string>();
  const queue = [graph.rootId];
  while (queue.length) {
    const id = queue.shift()!;
    const node = byId.get(id);
    if (!node || visible.has(id) || !layerOn(node)) continue;
    visible.add(id);
    if (!collapsed.has(id)) queue.push(...(children.get(id) ?? []));
  }

  const hiddenDescendants: Record<string, number> = {};
  for (const id of collapsed) {
    if (!visible.has(id)) continue;
    const stack = [...(children.get(id) ?? [])];
    const counted = new Set<string>();
    while (stack.length) {
      const c = stack.pop()!;
      if (counted.has(c) || visible.has(c)) continue;
      const node = byId.get(c);
      if (!node || !layerOn(node)) continue;
      counted.add(c);
      stack.push(...(children.get(c) ?? []));
    }
    if (counted.size) hiddenDescendants[id] = counted.size;
  }

  return {
    nodes: graph.nodes.filter((n) => visible.has(n.id)),
    edges: graph.edges.filter((e) => visible.has(e.source) && visible.has(e.target)),
    hiddenDescendants,
  };
}

/** Hijos directos (para "expandir relaciones" desde el panel). */
export function childCount(graph: BoardGraph, nodeId: string): number {
  return graph.edges.filter((e) => e.source === nodeId).length;
}

/** A qué elemento del caso se asocia un comentario hecho sobre un nodo. */
export function commentTarget(node: BoardNode): { targetType: TargetType; targetId: string } {
  const map: Partial<Record<NodeKind, TargetType>> = {
    case: 'CASE', sample: 'SAMPLE', histology: 'HISTOLOGY', ihc: 'IHC', test: 'MOLECULAR_TEST', variant: 'VARIANT',
    biomarker: 'BIOMARKER', evidence: 'EVIDENCE', gene: 'GENE', pathway: 'PATHWAY', publication: 'PUBLICATION',
    interpretation: 'INTERPRETATION',
  };
  const type = map[node.kind];
  return type ? { targetType: type, targetId: node.entityId } : { targetType: 'GRAPH_NODE', targetId: node.id };
}
