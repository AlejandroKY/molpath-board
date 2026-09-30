import { BrowserDemoGateway } from '../data/demo/browserDemoGateway';
import { buildBoardGraph } from './boardGraph';
import {
  computeCaseSummary,
  explainNode,
  focusIds,
  mainPathIds,
  newVariantsByTest,
  openQuestions,
  principalSample,
  summarizeEvidence,
  variantEvolution,
} from './caseInsights';

const DEMO_001 = '20000000-0000-4000-8000-000000000001';
const DEMO_002 = '20000000-0000-4000-8000-000000000002';
const DEMO_003 = '20000000-0000-4000-8000-000000000003';

async function board(caseId: string) {
  const g = new BrowserDemoGateway(null);
  g.setSession(await g.login('patologia.demo'));
  return g.getBoard(caseId);
}

describe('resumen molecular del caso', () => {
  it('resume DEMO-001 con datos presentes', async () => {
    const b = await board(DEMO_001);
    const s = computeCaseSummary(b);
    expect(s.sample?.label).toBe('Biopsia 1');
    expect(s.histology).toBe('Adenocarcinoma');
    expect(s.ihc.map((r) => r.marker)).toEqual(['TTF-1', 'Napsina A', 'PD-L1', 'ALK']);
    expect(s.variants[0].variant.geneSymbol).toBe('TP53'); // más evidencia enlazada primero
    expect(s.evidence.total).toBe(3);
    expect(s.evidence.byCertainty.MODERATE).toBe(2);
    expect(s.evidence.byCertainty.LIMITED).toBe(1);
    expect(s.evidence.publications).toBe(3);
    expect(s.lastScientificUpdate).toBe('2026-09-30T18:00:00Z');
  });

  it('usa la muestra más reciente como principal', async () => {
    expect(principalSample(await board(DEMO_002))?.label).toBe('Biopsia 2');
  });

  it('agrega evidencia por certeza, tipo y fuente', async () => {
    const e = summarizeEvidence((await board(DEMO_001)).evidence);
    expect(e.byType).toEqual([['PROGNOSTIC', 2], ['FUNCTIONAL', 1]]);
    expect(e.bySource).toEqual([['CIViC', 3]]);
  });
});

describe('ruta principal y enfoque', () => {
  it('la ruta principal reduce el grafo al flujo caso → muestra → estudio → variante → gen → pathway → evidencia', async () => {
    const b = await board(DEMO_001);
    const g = buildBoardGraph(b);
    const ids = mainPathIds(g, b);
    expect(ids.size).toBeLessThan(g.nodes.length);
    const kinds = new Set([...ids].map((id) => id.split(':')[0]));
    expect(kinds).toEqual(new Set(['case', 'sample', 'histology', 'test', 'variant', 'gene', 'pathway', 'evidence']));
    expect([...ids].some((id) => id.startsWith('ihc:'))).toBe(false);
  });

  it('en DEMO-002 la ruta principal parte de la Biopsia 2', async () => {
    const b = await board(DEMO_002);
    const ids = mainPathIds(buildBoardGraph(b), b);
    expect(ids.has(`sample:${b.samples[1].id}`)).toBe(true);
    expect(ids.has(`sample:${b.samples[0].id}`)).toBe(false);
  });

  it('el enfoque conserva ancestros, padres e hijos directos', async () => {
    const b = await board(DEMO_001);
    const g = buildBoardGraph(b);
    const tp53 = b.variants.find((v) => v.geneSymbol === 'TP53')!;
    const ids = focusIds(g, `variant:${tp53.id}`);
    expect(ids.has(g.rootId)).toBe(true);
    expect(ids.has(`test:${tp53.molecularTestId}`)).toBe(true);
    expect(ids.has(`gene:${tp53.geneId}`)).toBe(true);
    const egfr = b.variants.find((v) => v.geneSymbol === 'EGFR')!;
    expect(ids.has(`variant:${egfr.id}`)).toBe(false);
  });
});

describe('explicación determinista', () => {
  it('verbaliza sólo datos presentes de una variante', async () => {
    const b = await board(DEMO_001);
    const g = buildBoardGraph(b);
    const egfr = b.variants.find((v) => v.geneSymbol === 'EGFR')!;
    const text = explainNode(b, g, `variant:${egfr.id}`).join(' ');
    expect(text).toContain('NGS ADN');
    expect(text).toContain('Biopsia 1');
    expect(text).toContain('40%');
    expect(text).toContain('EGFR p.L858R');
    expect(text).toContain('32,5%');
    expect(text).toContain('1 registro(s) de evidencia');
    expect(text).not.toMatch(/tratamiento|recomend/i);
  });
});

describe('preguntas abiertas', () => {
  it('detecta la variante sin evidencia de DEMO-003 y no inventa observaciones en DEMO-001', async () => {
    const q3 = openQuestions(await board(DEMO_003));
    expect(q3.some((q) => q.title.includes('BRAF p.V600E sin evidencia'))).toBe(true);
    const q1 = openQuestions(await board(DEMO_001));
    expect(q1.some((q) => q.title.includes('sin evidencia'))).toBe(false);
    expect(q1.every((q) => !/tratamiento|recomend/i.test(q.title + q.detail))).toBe(true);
  });
});

describe('evolución longitudinal', () => {
  it('traza la VAF de EGFR L858R entre biopsias y marca T790M como nueva', async () => {
    const b = await board(DEMO_002);
    const [l858r] = variantEvolution(b);
    expect(l858r.label).toBe('EGFR p.L858R');
    expect(l858r.points.map((p) => p.vaf)).toEqual([41, 18.2]);
    const fresh = newVariantsByTest(b);
    const secondTest = b.molecularTests.find((t) => t.testDate === '2026-03-05')!;
    expect(fresh.get(secondTest.id)).toEqual(['EGFR p.T790M']);
  });
});
