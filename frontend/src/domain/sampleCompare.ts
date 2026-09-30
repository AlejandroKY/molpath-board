import { IHC_RESULT_LABEL, QUALITY_LABEL, SAMPLE_TYPE_LABEL, formatDate, formatPct, variantLabel } from './labels';
import type { CaseBoard, Evidence, IhcResult, Variant } from './types';

export type ChangeStatus = 'appeared' | 'disappeared' | 'persistent' | 'changed' | 'unchanged';

export interface FieldChange {
  field: string;
  label: string;
  a: string;
  b: string;
  changed: boolean;
}

export interface VariantComparison {
  key: string;
  label: string;
  status: 'appeared' | 'disappeared' | 'persistent';
  a: Variant | null;
  b: Variant | null;
  vafA: number | null;
  vafB: number | null;
  vafDelta: number | null;
  /** La variante no aparece en A pero su gen no estaba en el panel de A: su "aparición" no es comparable. */
  notAssessedInA: boolean;
  notAssessedInB: boolean;
}

export interface IhcComparison {
  marker: string;
  status: ChangeStatus;
  a: IhcResult | null;
  b: IhcResult | null;
}

export interface SampleComparison {
  sampleFields: FieldChange[];
  histology: FieldChange[];
  variants: VariantComparison[];
  ihc: IhcComparison[];
  biomarkers: FieldChange[];
  evidenceOnlyInB: Evidence[];
}

/** Clave estable de una variante entre muestras: gen + cambio proteico, o c., o tipo/compañero. */
export function variantKey(v: Variant): string {
  if (v.variantType === 'FUSION') return `${v.geneSymbol}::${v.fusionPartnerSymbol ?? '?'}`;
  if (v.proteinChange) return `${v.geneSymbol}:p:${v.proteinChange.toUpperCase()}`;
  if (v.hgvsC) return `${v.geneSymbol}:c:${v.hgvsC}`;
  return `${v.geneSymbol}:${v.variantType}`;
}

function variantsOf(board: CaseBoard, sampleId: string): Variant[] {
  const tests = new Set(board.molecularTests.filter((t) => t.sampleId === sampleId).map((t) => t.id));
  return board.variants.filter((v) => tests.has(v.molecularTestId));
}

function genesAnalyzed(board: CaseBoard, sampleId: string): Set<string> | null {
  const tests = board.molecularTests.filter((t) => t.sampleId === sampleId);
  const genes = tests.flatMap((t) => t.genesAnalyzed);
  return genes.length ? new Set(genes) : null;
}

const field = (field: string, label: string, a: string, b: string): FieldChange => ({ field, label, a, b, changed: a !== b });
const txt = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v));

export function compareSamples(board: CaseBoard, sampleAId: string, sampleBId: string): SampleComparison {
  const a = board.samples.find((s) => s.id === sampleAId);
  const b = board.samples.find((s) => s.id === sampleBId);
  if (!a || !b) throw new Error('Muestra no encontrada en el caso');

  const sampleFields = [
    field('sampleType', 'Tipo de muestra', SAMPLE_TYPE_LABEL[a.sampleType], SAMPLE_TYPE_LABEL[b.sampleType]),
    field('anatomicSite', 'Sitio anatómico', txt(a.anatomicSite), txt(b.anatomicSite)),
    field('collectionDate', 'Fecha', formatDate(a.collectionDate), formatDate(b.collectionDate)),
    field('tumorCellularityPct', 'Celularidad tumoral', formatPct(a.tumorCellularityPct), formatPct(b.tumorCellularityPct)),
    field('necrosisPct', 'Necrosis', formatPct(a.necrosisPct), formatPct(b.necrosisPct)),
    field('dnaQuality', 'Calidad ADN', a.dnaQuality ? QUALITY_LABEL[a.dnaQuality] : '—', b.dnaQuality ? QUALITY_LABEL[b.dnaQuality] : '—'),
    field('rnaQuality', 'Calidad ARN', a.rnaQuality ? QUALITY_LABEL[a.rnaQuality] : '—', b.rnaQuality ? QUALITY_LABEL[b.rnaQuality] : '—'),
  ];

  const histA = board.histology.filter((h) => h.sampleId === a.id).map((h) => h.diagnosis).join('; ');
  const histB = board.histology.filter((h) => h.sampleId === b.id).map((h) => h.diagnosis).join('; ');
  const histology = [field('diagnosis', 'Diagnóstico histológico', txt(histA), txt(histB))];

  const va = new Map(variantsOf(board, a.id).map((v) => [variantKey(v), v]));
  const vb = new Map(variantsOf(board, b.id).map((v) => [variantKey(v), v]));
  const panelA = genesAnalyzed(board, a.id);
  const panelB = genesAnalyzed(board, b.id);
  const variants: VariantComparison[] = [...new Set([...va.keys(), ...vb.keys()])].map((key) => {
    const x = va.get(key) ?? null;
    const y = vb.get(key) ?? null;
    const gene = (x ?? y)!.geneSymbol;
    const vafA = x?.vaf ?? null;
    const vafB = y?.vaf ?? null;
    return {
      key,
      label: variantLabel((x ?? y)!),
      status: x && y ? 'persistent' : y ? 'appeared' : 'disappeared',
      a: x,
      b: y,
      vafA,
      vafB,
      vafDelta: vafA != null && vafB != null ? Math.round((vafB - vafA) * 100) / 100 : null,
      notAssessedInA: !x && panelA !== null && !panelA.has(gene),
      notAssessedInB: !y && panelB !== null && !panelB.has(gene),
    };
  });
  const order = { appeared: 0, disappeared: 1, persistent: 2 };
  variants.sort((p, q) => order[p.status] - order[q.status] || p.label.localeCompare(q.label));

  const ihcA = new Map(board.ihc.filter((r) => r.sampleId === a.id).map((r) => [r.marker.toUpperCase(), r]));
  const ihcB = new Map(board.ihc.filter((r) => r.sampleId === b.id).map((r) => [r.marker.toUpperCase(), r]));
  const ihcValue = (r: IhcResult) => `${IHC_RESULT_LABEL[r.result]}|${r.percentage ?? ''}|${r.score ?? ''}|${r.intensity ?? ''}`;
  const ihc: IhcComparison[] = [...new Set([...ihcA.keys(), ...ihcB.keys()])].sort().map((m) => {
    const x = ihcA.get(m) ?? null;
    const y = ihcB.get(m) ?? null;
    const status: ChangeStatus = !x ? 'appeared' : !y ? 'disappeared' : ihcValue(x) === ihcValue(y) ? 'unchanged' : 'changed';
    return { marker: (x ?? y)!.marker, status, a: x, b: y };
  });

  const bioOf = (sampleId: string) => {
    const tests = new Set(board.molecularTests.filter((t) => t.sampleId === sampleId).map((t) => t.id));
    return new Map(board.biomarkers.filter((x) => tests.has(x.molecularTestId)).map((x) => [x.biomarkerType, x]));
  };
  const ba = bioOf(a.id);
  const bb = bioOf(b.id);
  const bioVal = (x?: { valueNumeric: number | null; valueText: string | null; unit: string | null }) =>
    !x ? '—' : x.valueNumeric != null ? `${x.valueNumeric}${x.unit ? ` ${x.unit}` : ''}` : txt(x.valueText);
  const biomarkers = [...new Set([...ba.keys(), ...bb.keys()])].map((t) => field(t, t, bioVal(ba.get(t)), bioVal(bb.get(t))));

  const linkedTo = (vs: Variant[]) => new Set(board.evidenceLinks.filter((l) => vs.some((v) => v.id === l.variantId)).map((l) => l.evidenceId));
  const evA = linkedTo([...va.values()]);
  const evB = linkedTo([...vb.values()]);
  const evidenceOnlyInB = board.evidence.filter((e) => evB.has(e.id) && !evA.has(e.id));

  return { sampleFields, histology, variants, ihc, biomarkers, evidenceOnlyInB };
}
