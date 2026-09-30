import { ApiError } from '../gateway';
import { BrowserDemoGateway } from './browserDemoGateway';

async function as(username: string) {
  const g = new BrowserDemoGateway(null);
  g.setSession(await g.login(username));
  return g;
}

describe('BrowserDemoGateway: mismas reglas que el backend', () => {
  it('exige sesión', async () => {
    const g = new BrowserDemoGateway(null);
    await expect(g.listCases('', 0, 10)).rejects.toMatchObject({ status: 401 });
  });

  it('aplica la matriz de roles: Oncología no edita datos clínicos pero puede comentar', async () => {
    const g = await as('oncologia.demo');
    await expect(g.createCase({ caseCode: 'X-1', organ: 'Pulmón', tumorType: 'Adenocarcinoma' })).rejects.toMatchObject({ status: 403 });
    const caseId = '20000000-0000-4000-8000-000000000001';
    const c = await g.createComment(caseId, 'CASE', caseId, 'Comentario de prueba');
    expect(c.authorRoleLabel).toBe('Oncología');
  });

  it('valida el identificador del caso y detecta duplicados', async () => {
    const g = await as('patologia.demo');
    const err = await g.createCase({ caseCode: 'Juan Pérez', organ: '', tumorType: 'x' }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).fieldErrors.map((f) => f.field)).toEqual(expect.arrayContaining(['caseCode', 'organ']));
    await expect(g.createCase({ caseCode: 'demo-001', organ: 'Pulmón', tumorType: 'x' })).rejects.toMatchObject({ status: 409 });
  });

  it('reglas de variante por tipo', async () => {
    const g = await as('molecular.demo');
    const testId = '24000000-0000-4000-8000-000000000001';
    await expect(g.addVariant(testId, { geneSymbol: 'EGFR', variantType: 'SNV' })).rejects.toMatchObject({ status: 422 });
    await expect(g.addVariant(testId, { geneSymbol: 'ALK', variantType: 'FUSION' })).rejects.toMatchObject({ status: 422 });
    const v = await g.addVariant(testId, { geneSymbol: 'kras', variantType: 'SNV', hgvsP: 'p.Gly12Asp', vaf: 12 });
    expect(v.geneSymbol).toBe('KRAS');
    expect(v.proteinChange).toBe('G12D');
  });

  it('evidencia manual: exige fuente; certeza del usuario queda marcada como tal', async () => {
    const g = await as('molecular.demo');
    await expect(g.createManualEvidence({ evidenceType: 'FUNCTIONAL', description: 'sin fuente' })).rejects.toMatchObject({ status: 422 });
    const e = await g.createManualEvidence({ evidenceType: 'FUNCTIONAL', description: 'registro de prueba', url: 'https://example.org/x', certainty: 'LIMITED' });
    expect(e.certaintyBasis).toBe('USER_ASSIGNED');
    expect(e.sourceCode).toBe('MANUAL');
  });

  it('comentarios: sólo el autor edita y se conserva la revisión anterior', async () => {
    const author = await as('patologia.demo');
    const caseId = '20000000-0000-4000-8000-000000000001';
    const c = await author.createComment(caseId, 'CASE', caseId, 'v1');
    author.setSession(await author.login('oncologia.demo'));
    await expect(author.editComment(c.id, 'intruso')).rejects.toMatchObject({ status: 403 });
    author.setSession(await author.login('patologia.demo'));
    await author.editComment(c.id, 'v2');
    expect((await author.commentRevisions(c.id)).map((r) => r.body)).toEqual(['v1']);
  });

  it('búsqueda tipada sobre el dataset', async () => {
    const g = await as('patologia.demo');
    const r = await g.search('EGFR L858R', 10);
    expect(r.interpretedAs[0]).toBe('VARIANT');
    expect(r.groups[0].items.map((i) => i.subtitle).join(' ')).toContain('DEMO-001');
    const ihc = await g.search('TTF-1', 10);
    expect(ihc.groups.map((x) => x.kind)).toContain('IHC_MARKER');
  });
});
