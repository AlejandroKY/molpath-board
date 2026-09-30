import { BrowserDemoGateway } from '../data/demo/browserDemoGateway';
import { buildBoardGraph, defaultGraphState, visibleGraph } from './boardGraph';
import { civicCertainty, detectContradictions } from './certainty';
import { normalizeProteinChange, toThreeLetter } from './proteinChange';
import { classifyQuery } from './queryClassifier';
import { compareSamples } from './sampleCompare';
import { diffBoards } from './snapshotDiff';
import type { Evidence } from './types';

const DEMO_001 = '20000000-0000-4000-8000-000000000001';
const DEMO_002 = '20000000-0000-4000-8000-000000000002';

async function demoBoard(caseId: string) {
  const g = new BrowserDemoGateway(null);
  g.setSession({ user: (await g.login('molecular.demo')).user, token: null, expiresAt: null });
  return { g, board: await g.getBoard(caseId) };
}

describe('normalización HGVS (misma regla que el backend)', () => {
  it.each([
    ['p.L858R', 'L858R'],
    ['p.Leu858Arg', 'L858R'],
    ['p.(Leu858Arg)', 'L858R'],
    ['p.Val600Glu', 'V600E'],
    ['p.Glu746_Ala750del', 'E746_A750del'],
  ])('%s → %s', (input, expected) => expect(normalizeProteinChange(input)).toBe(expected));
  it('tres letras sólo para sustituciones simples', () => {
    expect(toThreeLetter('L858R')).toBe('Leu858Arg');
    expect(toThreeLetter('E746_A750del')).toBeNull();
  });
});

describe('clasificador de búsqueda', () => {
  it('distingue PMID, variante, símbolo y texto libre', () => {
    expect(classifyQuery('PMID: 24662454').kinds).toEqual(['PMID']);
    const v = classifyQuery('BRAF p.Val600Glu');
    expect(v.kinds[0]).toBe('VARIANT');
    expect(v.proteinChange).toBe('V600E');
    expect(classifyQuery('PD-L1').kinds).toContain('IHC_MARKER');
    expect(classifyQuery('adenocarcinoma pulmonar').kinds).toContain('TUMOR');
  });
});

describe('incertidumbre', () => {
  it('mapeo CIViC documentado', () => {
    expect(['A', 'B', 'C', 'D', 'E', 'X'].map(civicCertainty)).toEqual(['STRONG', 'MODERATE', 'LIMITED', 'LIMITED', 'INSUFFICIENT', 'UNKNOWN']);
  });
  it('detecta contradicción sólo con direcciones opuestas para la misma afirmación', () => {
    const base = { status: 'ACTIVE', geneSymbol: 'TP53', variantDescriptor: 'R273H', evidenceType: 'FUNCTIONAL', sourceSignificance: 'NEOMORPHIC' } as Evidence;
    const a = { ...base, id: 'a', sourceDirection: 'SUPPORTS' } as Evidence;
    const b = { ...base, id: 'b', sourceDirection: 'DOES_NOT_SUPPORT' } as Evidence;
    expect(detectContradictions([b])).toHaveLength(0);
    expect(detectContradictions([a, b])[0].evidenceIds.sort()).toEqual(['a', 'b']);
  });
});

describe('grafo de la pizarra', () => {
  it('separa capas caso / conocimiento / razonamiento con trazabilidad', async () => {
    const { board } = await demoBoard(DEMO_001);
    const graph = buildBoardGraph(board);
    const layerOf = (kind: string) => graph.nodes.find((n) => n.kind === kind)!.layer;
    expect(layerOf('variant')).toBe('case');
    expect(layerOf('evidence')).toBe('knowledge');
    expect(layerOf('pathway')).toBe('knowledge');
    expect(layerOf('interpretation')).toBe('reasoning');
    expect(graph.nodes.filter((n) => n.kind === 'variant').map((n) => n.title)).toEqual(['EGFR p.L858R', 'TP53 p.R273H']);
    const evidenceEdges = graph.edges.filter((e) => e.kind === 'evidence');
    expect(evidenceEdges.every((e) => e.certainty)).toBe(true);
  });

  it('agrupa relaciones numerosas y oculta descendientes de nodos contraídos', async () => {
    const { board } = await demoBoard(DEMO_001);
    const graph = buildBoardGraph(board, { groupThreshold: 1 });
    const state = defaultGraphState(graph);
    expect(state.collapsed.some((id) => id.startsWith('evgroup:'))).toBe(true);
    const visible = visibleGraph(graph, state);
    expect(visible.nodes.some((n) => n.kind === 'evidence' && n.title.includes('EID7530'))).toBe(false);
    const expanded = visibleGraph(graph, { ...state, collapsed: [] });
    expect(expanded.nodes.some((n) => n.title.includes('EID7530'))).toBe(true);
    const noKnowledge = visibleGraph(graph, { collapsed: [], layers: { knowledge: false, reasoning: true } });
    expect(noKnowledge.nodes.every((n) => n.layer !== 'knowledge')).toBe(true);
  });
});

describe('comparación longitudinal (DEMO-002)', () => {
  it('Biopsia 1 vs Biopsia 2: aparición de T790M, cambio de VAF y de PD-L1', async () => {
    const { board } = await demoBoard(DEMO_002);
    const [s1, s2] = board.samples;
    const cmp = compareSamples(board, s1.id, s2.id);
    const t790m = cmp.variants.find((v) => v.label.includes('T790M'))!;
    expect(t790m.status).toBe('appeared');
    const l858r = cmp.variants.find((v) => v.label.includes('L858R'))!;
    expect(l858r.status).toBe('persistent');
    expect(l858r.vafDelta).toBeCloseTo(-22.8);
    expect(cmp.ihc.find((r) => r.marker === 'PD-L1')!.status).toBe('changed');
    expect(cmp.sampleFields.find((f) => f.field === 'anatomicSite')!.changed).toBe(true);
  });
});

describe('snapshots', () => {
  it('diff "qué sabíamos" vs "qué sabemos" y SHA-256 verificable', async () => {
    const { g, board } = await demoBoard(DEMO_001);
    const snap = await g.createSnapshot(DEMO_001, { label: 'Antes', graphState: { collapsed: [], layers: { knowledge: true, reasoning: true } } });
    const evidenceId = board.evidence.find((e) => e.externalId === 'EID397')!.id;
    await g.classifyEvidence(evidenceId, { certainty: 'CONTRADICTORY', status: 'WITHDRAWN', reason: 'Prueba' });
    const detail = await g.getSnapshot(snap.id);
    expect(detail.integrityVerified).toBe(true);
    expect(detail.summary.contentSha256).toMatch(/^[0-9a-f]{64}$/);
    const diff = diffBoards(detail.content.board, await g.getBoard(DEMO_001));
    expect(diff.evidence.changed[0].details.join(' ')).toContain('Certeza');
    expect(diff.evidence.noLongerValid).toHaveLength(1);
    expect(diff.totalChanges).toBeGreaterThan(0);
  });
});
