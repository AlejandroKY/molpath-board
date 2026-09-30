import { buildBoardGraph } from './boardGraph';
import { CERTAINTY_SHORT, STATUS_LABEL, IHC_RESULT_LABEL, variantLabel } from './labels';
import type { CaseBoard, Evidence, Interpretation, Publication } from './types';

export interface Change<T> {
  item: T;
  details: string[];
}

export interface BoardDiff {
  publications: { added: Publication[]; removed: Publication[] };
  evidence: { added: Evidence[]; removed: Evidence[]; changed: Change<Evidence>[]; noLongerValid: Evidence[] };
  variants: { added: string[]; removed: string[]; changed: Change<string>[] };
  ihc: { added: string[]; removed: string[]; changed: Change<string>[] };
  samples: { added: string[]; removed: string[] };
  biomarkers: { added: string[]; removed: string[] };
  sourceVersions: { source: string; before: string[]; after: string[] }[];
  interpretations: { added: Interpretation[]; superseded: Interpretation[] };
  relations: { added: string[]; removed: string[] };
  totalChanges: number;
}

const byId = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]));

function setDiff<T extends { id: string }>(before: T[], after: T[]) {
  const b = byId(before);
  const a = byId(after);
  return {
    added: after.filter((x) => !b.has(x.id)),
    removed: before.filter((x) => !a.has(x.id)),
    both: after.filter((x) => b.has(x.id)).map((x) => [b.get(x.id)!, x] as const),
  };
}

/**
 * Compara el agregado congelado en un snapshot ("qué sabíamos") con el estado actual ("qué sabemos").
 * Función pura y determinista: el mismo par de entradas produce siempre el mismo resultado.
 */
export function diffBoards(before: CaseBoard, after: CaseBoard): BoardDiff {
  const pubs = setDiff(before.publications, after.publications);

  const ev = setDiff(before.evidence, after.evidence);
  const changed: Change<Evidence>[] = [];
  for (const [b, a] of ev.both) {
    const details: string[] = [];
    if (b.certainty !== a.certainty) details.push(`Certeza: ${CERTAINTY_SHORT[b.certainty]} → ${CERTAINTY_SHORT[a.certainty]}`);
    if (b.certaintyBasis !== a.certaintyBasis) details.push(`Base de la certeza: ${b.certaintyBasis} → ${a.certaintyBasis}`);
    if (b.status !== a.status) details.push(`Estado: ${STATUS_LABEL[b.status]} → ${STATUS_LABEL[a.status]}${a.statusReason ? ` (${a.statusReason})` : ''}`);
    if (b.sourceLevel !== a.sourceLevel) details.push(`Nivel en la fuente: ${b.sourceLevel ?? '—'} → ${a.sourceLevel ?? '—'}`);
    if (b.sourceVersionLabel !== a.sourceVersionLabel) details.push(`Versión de fuente: ${b.sourceVersionLabel ?? '—'} → ${a.sourceVersionLabel ?? '—'}`);
    if (details.length) changed.push({ item: a, details });
  }
  const noLongerValid = ev.both.filter(([b, a]) => b.status === 'ACTIVE' && a.status !== 'ACTIVE').map(([, a]) => a);

  const vLabel = (board: CaseBoard) => new Map(board.variants.map((v) => [v.id, v]));
  const vb = vLabel(before);
  const va = vLabel(after);
  const variants = {
    added: [...va.values()].filter((v) => !vb.has(v.id)).map((v) => variantLabel(v)),
    removed: [...vb.values()].filter((v) => !va.has(v.id)).map((v) => variantLabel(v)),
    changed: [...va.values()]
      .filter((v) => vb.has(v.id))
      .map((v) => {
        const old = vb.get(v.id)!;
        const details: string[] = [];
        if (old.vaf !== v.vaf) details.push(`VAF: ${old.vaf ?? '—'}% → ${v.vaf ?? '—'}%`);
        if (old.classification !== v.classification) details.push(`Clasificación: ${old.classification ?? '—'} → ${v.classification ?? '—'}`);
        if (old.hgvsP !== v.hgvsP || old.hgvsC !== v.hgvsC) details.push('Nomenclatura HGVS modificada');
        return { item: variantLabel(v), details };
      })
      .filter((c) => c.details.length),
  };

  const ihcKey = (b: CaseBoard) => new Map(b.ihc.map((r) => [r.id, r]));
  const ib = ihcKey(before);
  const ia = ihcKey(after);
  const ihcText = (r: { marker: string; result: keyof typeof IHC_RESULT_LABEL; score: string | null; percentage: number | null }) =>
    `${r.marker} ${IHC_RESULT_LABEL[r.result]}${r.score ? ` ${r.score}` : r.percentage != null ? ` ${r.percentage}%` : ''}`;
  const ihc = {
    added: [...ia.values()].filter((r) => !ib.has(r.id)).map(ihcText),
    removed: [...ib.values()].filter((r) => !ia.has(r.id)).map(ihcText),
    changed: [...ia.values()]
      .filter((r) => ib.has(r.id) && ihcText(ib.get(r.id)!) !== ihcText(r))
      .map((r) => ({ item: r.marker, details: [`${ihcText(ib.get(r.id)!)} → ${ihcText(r)}`] })),
  };

  const samples = setDiff(before.samples, after.samples);
  const bio = setDiff(before.biomarkers, after.biomarkers);
  const bioText = (x: { biomarkerType: string; valueNumeric: number | null; valueText: string | null }) =>
    `${x.biomarkerType} ${x.valueNumeric ?? x.valueText ?? ''}`.trim();

  const versionsBySource = (b: CaseBoard) => {
    const m = new Map<string, Set<string>>();
    for (const v of b.sourceVersions) m.set(v.sourceCode, (m.get(v.sourceCode) ?? new Set()).add(v.versionLabel));
    return m;
  };
  const svb = versionsBySource(before);
  const sva = versionsBySource(after);
  const sourceVersions = [...new Set([...svb.keys(), ...sva.keys()])]
    .map((source) => ({ source, before: [...(svb.get(source) ?? [])].sort(), after: [...(sva.get(source) ?? [])].sort() }))
    .filter((s) => s.before.join('|') !== s.after.join('|'));

  const ib2 = byId(before.interpretations);
  const interpretations = {
    added: after.interpretations.filter((i) => !ib2.has(i.id)),
    superseded: after.interpretations.filter((i) => ib2.get(i.id)?.status === 'CURRENT' && i.status === 'SUPERSEDED'),
  };

  // Relaciones: aristas del grafo completo (sin agrupar), identificadas por entidades.
  const rel = (b: CaseBoard) => {
    const g = buildBoardGraph(b, { groupThreshold: Number.POSITIVE_INFINITY });
    const title = new Map(g.nodes.map((n) => [n.id, n.title]));
    return new Map(g.edges.map((e) => [e.id, `${title.get(e.source) ?? e.source} → ${title.get(e.target) ?? e.target}`]));
  };
  const rb = rel(before);
  const ra = rel(after);
  const relations = {
    added: [...ra.entries()].filter(([k]) => !rb.has(k)).map(([, v]) => v),
    removed: [...rb.entries()].filter(([k]) => !ra.has(k)).map(([, v]) => v),
  };

  const diff: Omit<BoardDiff, 'totalChanges'> = {
    publications: { added: pubs.added, removed: pubs.removed },
    evidence: { added: ev.added, removed: ev.removed, changed, noLongerValid },
    variants,
    ihc,
    samples: { added: samples.added.map((s) => s.label), removed: samples.removed.map((s) => s.label) },
    biomarkers: { added: bio.added.map(bioText), removed: bio.removed.map(bioText) },
    sourceVersions,
    interpretations,
    relations,
  };
  const totalChanges =
    pubs.added.length + pubs.removed.length + ev.added.length + ev.removed.length + changed.length +
    variants.added.length + variants.removed.length + variants.changed.length + ihc.added.length + ihc.removed.length +
    ihc.changed.length + diff.samples.added.length + diff.samples.removed.length + diff.biomarkers.added.length +
    diff.biomarkers.removed.length + sourceVersions.length + interpretations.added.length + interpretations.superseded.length;
  return { ...diff, totalChanges };
}
