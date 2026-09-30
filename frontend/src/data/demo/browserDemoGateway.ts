import { normalizeProteinChange } from '../../domain/proteinChange';
import { classifyQuery } from '../../domain/queryClassifier';
import { CLINICAL_EDITOR_ROLES, ROLE_LABEL, variantLabel } from '../../domain/labels';
import type {
  Biomarker,
  BiomarkerRequest,
  CaseBoard,
  CaseRecord,
  CaseRequest,
  CaseSummary,
  CaseVariantView,
  Certainty,
  ClassificationRequest,
  ClinVarAspect,
  Comment,
  Dashboard,
  Evidence,
  EvidenceCandidate,
  EvidenceFilter,
  EvidenceLink,
  Histology,
  HistologyRequest,
  IhcRequest,
  IhcResult,
  Interpretation,
  InterpretationRequest,
  ManualEvidenceRequest,
  MolecularTest,
  MolecularTestRequest,
  Page,
  Pathway,
  ProviderInfo,
  Publication,
  Sample,
  SampleRequest,
  SearchHit,
  SearchResponse,
  SnapshotDetail,
  SnapshotRequest,
  SnapshotSummary,
  TargetType,
  TimelineEntry,
  TimelineEvent,
  TimelineEventRequest,
  UserSummary,
  Variant,
  VariantRequest,
} from '../../domain/types';
import * as ext from '../external/browserProviders';
import { ApiError, type MolPathGateway, type Session } from '../gateway';
import { DEMO_STATE_VERSION, pubmedUrl, seedDemoState, type DemoState, type StoredCase, type StoredComment, type StoredUser } from './demoState';

const STORAGE_KEY = 'molpath-demo-state-v1';
const CASE_CODE = /^[A-Za-z0-9][A-Za-z0-9_-]{1,31}$/;
const GENE_SYMBOL = /^[A-Za-z0-9][A-Za-z0-9.-]{0,39}$/;
const PMID = /^[0-9]{1,10}$/;
const DOI = /^10\.\d{4,9}\/\S+$/;
const MAX_PAGE = 100;

// ─── utilidades ────────────────────────────────────────────────────────────────
const clean = (v: string | null | undefined): string | null => {
  if (v === null || v === undefined) return null;
  // eslint-disable-next-line no-control-regex
  const s = String(v).normalize('NFC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  return s.length ? s : null;
};
const upper = (v: string | null | undefined) => clean(v)?.toUpperCase() ?? null;
const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();
const badRequest = (errors: { field: string; message: string }[]) =>
  new ApiError(400, 'Datos de entrada no válidos', 'Revise los campos indicados.', errors);
const rule = (m: string) => new ApiError(422, 'Regla de dominio incumplida', m);
const notFound = (what: string, id: string) => new ApiError(404, 'Recurso no encontrado', `${what} no encontrado: ${id}`);
const conflict = (m: string) => new ApiError(409, 'Conflicto', m);
const forbidden = (m = 'Su rol no permite realizar esta acción.') => new ApiError(403, 'Acceso denegado', m);

function paginate<T>(items: T[], page: number, size: number): Page<T> {
  const s = Math.min(Math.max(size || 20, 1), MAX_PAGE);
  const p = Math.max(page || 0, 0);
  return { items: items.slice(p * s, p * s + s), page: p, size: s, totalItems: items.length, totalPages: Math.ceil(items.length / s) };
}

function pctError(field: string, v: number | null | undefined) {
  return v !== null && v !== undefined && (Number.isNaN(Number(v)) || v < 0 || v > 100) ? [{ field, message: 'debe estar entre 0 y 100' }] : [];
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function safeStorage(): Storage | null {
  try {
    const s = window.localStorage;
    const k = '__molpath_probe__';
    s.setItem(k, '1');
    s.removeItem(k);
    return s;
  } catch {
    return null;
  }
}

/**
 * Implementación del puerto en el navegador (modo demo / GitHub Pages).
 * Reproduce las reglas del backend: permisos por rol, validación, certeza con base declarada,
 * historial de cambios, snapshots inmutables con SHA-256. Los datos viven en localStorage de este
 * navegador y sólo contienen el dataset ficticio y lo que el usuario añada.
 */
export class BrowserDemoGateway implements MolPathGateway {
  readonly mode = 'demo' as const;
  private state: DemoState;
  private session: Session | null = null;

  constructor(private readonly storage: Storage | null = safeStorage()) {
    this.state = this.load();
  }

  // ─── persistencia ───────────────────────────────────────────────────────────
  private load(): DemoState {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DemoState;
        if (parsed.version === DEMO_STATE_VERSION) return parsed;
      }
    } catch {
      /* estado corrupto o almacenamiento bloqueado: se vuelve al dataset */
    }
    return seedDemoState();
  }

  private persist() {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      /* cuota o modo privado: el estado sigue en memoria durante la sesión */
    }
  }

  private mutate<T>(fn: (s: DemoState) => T): T {
    const result = fn(this.state);
    this.persist();
    return result;
  }

  async resetDemo() {
    this.state = seedDemoState();
    this.persist();
  }

  // ─── sesión y permisos ──────────────────────────────────────────────────────
  setSession(session: Session | null) {
    this.session = session;
  }

  private summary(u: StoredUser): UserSummary {
    return { id: u.id, username: u.username, displayName: u.displayName, role: u.role, roleLabel: ROLE_LABEL[u.role] };
  }

  private user(): StoredUser {
    const u = this.session && this.state.users.find((x) => x.id === this.session!.user.id);
    if (!u) throw new ApiError(401, 'No autenticado', 'Seleccione un usuario demo para continuar.');
    return u;
  }

  private requireClinicalEditor() {
    if (!CLINICAL_EDITOR_ROLES.includes(this.user().role)) throw forbidden();
  }

  private audit(action: string, entityType: string, entityId: string, before: unknown, after: unknown) {
    this.state.audit.push({
      occurredAt: now(),
      action,
      entityType,
      entityId,
      actorId: this.session?.user.id ?? null,
      before: before === null || before === undefined ? null : JSON.stringify(before),
      after: after === null || after === undefined ? null : JSON.stringify(after),
    });
  }

  async devUsers() {
    return [...this.state.users].sort((a, b) => a.role.localeCompare(b.role)).map((u) => this.summary(u));
  }

  async login(username: string): Promise<Session> {
    const u = this.state.users.find((x) => x.username === username.trim());
    if (!u) throw notFound('Usuario', username);
    return { user: this.summary(u), token: null, expiresAt: null };
  }

  // ─── casos ──────────────────────────────────────────────────────────────────
  private caseDto(c: StoredCase): CaseRecord {
    const { createdById, ...rest } = c;
    const creator = this.state.users.find((u) => u.id === createdById);
    return { ...rest, createdBy: creator ? this.summary(creator) : null };
  }

  private requireCase(id: string): StoredCase {
    const c = this.state.cases.find((x) => x.id === id);
    if (!c) throw notFound('Caso', id);
    return c;
  }

  private validateCase(req: CaseRequest) {
    const errors = [];
    if (!clean(req.caseCode)) errors.push({ field: 'caseCode', message: 'obligatorio' });
    else if (!CASE_CODE.test(clean(req.caseCode)!))
      errors.push({ field: 'caseCode', message: 'Use sólo letras, números, guion o guion bajo (sin datos identificables del paciente)' });
    if (!clean(req.organ)) errors.push({ field: 'organ', message: 'obligatorio' });
    if (!clean(req.tumorType)) errors.push({ field: 'tumorType', message: 'obligatorio' });
    if (errors.length) throw badRequest(errors);
  }

  async listCases(q: string, page: number, size: number): Promise<Page<CaseSummary>> {
    this.user();
    const needle = clean(q)?.toLowerCase();
    const items = this.state.cases
      .filter((c) => !needle || [c.caseCode, c.organ, c.tumorType, c.diagnosis, c.histologicSubtype].some((f) => f?.toLowerCase().includes(needle)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((c) => {
        const sampleIds = new Set(this.state.samples.filter((s) => s.caseId === c.id).map((s) => s.id));
        const testIds = new Set(this.state.tests.filter((t) => sampleIds.has(t.sampleId)).map((t) => t.id));
        return {
          id: c.id, caseCode: c.caseCode, organ: c.organ, tumorType: c.tumorType, diagnosis: c.diagnosis, demo: c.demo,
          createdAt: c.createdAt, updatedAt: c.updatedAt, sampleCount: sampleIds.size,
          variantCount: this.state.variants.filter((v) => testIds.has(v.molecularTestId)).length,
        };
      });
    return paginate(items, page, size);
  }

  async getCase(id: string) {
    this.user();
    return this.caseDto(this.requireCase(id));
  }

  async createCase(req: CaseRequest) {
    this.requireClinicalEditor();
    this.validateCase(req);
    const code = upper(req.caseCode)!;
    if (this.state.cases.some((c) => c.caseCode.toUpperCase() === code)) throw conflict(`Ya existe un caso con el identificador ${code}`);
    return this.mutate(() => {
      const t = now();
      const c: StoredCase = {
        id: uuid(), caseCode: code, organ: clean(req.organ)!, tumorType: clean(req.tumorType)!, diagnosis: clean(req.diagnosis),
        histologicSubtype: clean(req.histologicSubtype), grade: clean(req.grade), notes: clean(req.notes), demo: true,
        createdAt: t, updatedAt: t, createdById: this.user().id, version: 0,
      };
      this.state.cases.push(c);
      this.audit('CREATE', 'CASE', c.id, null, c);
      return this.caseDto(c);
    });
  }

  async updateCase(id: string, req: CaseRequest) {
    this.requireClinicalEditor();
    this.validateCase(req);
    const c = this.requireCase(id);
    if (req.version != null && req.version !== c.version) throw conflict('El caso fue modificado por otra persona. Recargue antes de guardar.');
    const code = upper(req.caseCode)!;
    if (code !== c.caseCode && this.state.cases.some((x) => x.caseCode.toUpperCase() === code)) throw conflict(`Ya existe un caso con el identificador ${code}`);
    return this.mutate(() => {
      const before = { ...c };
      Object.assign(c, {
        caseCode: code, organ: clean(req.organ), tumorType: clean(req.tumorType), diagnosis: clean(req.diagnosis),
        histologicSubtype: clean(req.histologicSubtype), grade: clean(req.grade), notes: clean(req.notes),
        updatedAt: now(), version: (c.version ?? 0) + 1,
      });
      this.audit('UPDATE', 'CASE', id, before, c);
      return this.caseDto(c);
    });
  }

  private touchCase(caseId: string) {
    const c = this.state.cases.find((x) => x.id === caseId);
    if (c) c.updatedAt = now();
  }

  // ─── agregado ───────────────────────────────────────────────────────────────
  private buildBoard(caseId: string, includeDiscussion: boolean): CaseBoard {
    const s = this.state;
    const caseRecord = this.caseDto(this.requireCase(caseId));
    const samples = s.samples.filter((x) => x.caseId === caseId).sort((a, b) => (a.collectionDate ?? '').localeCompare(b.collectionDate ?? ''));
    const sampleIds = new Set(samples.map((x) => x.id));
    const tests = s.tests.filter((t) => sampleIds.has(t.sampleId));
    const testIds = new Set(tests.map((t) => t.id));
    const variants = s.variants.filter((v) => testIds.has(v.molecularTestId));
    const variantIds = new Set(variants.map((v) => v.id));
    const links = s.links.filter((l) => variantIds.has(l.variantId));
    const evidence = s.evidence.filter((e) => links.some((l) => l.evidenceId === e.id));
    const geneIds = new Set([...variants.map((v) => v.geneId), ...evidence.map((e) => e.geneId).filter((x): x is string => !!x)]);
    const genes = s.genes.filter((g) => geneIds.has(g.id));
    const genePathways = s.genePathways.filter((gp) => geneIds.has(gp.geneId));
    const pathways = s.pathways.filter((p) => genePathways.some((gp) => gp.pathwayId === p.id));
    const publications = s.publications.filter((p) => evidence.some((e) => e.publicationId === p.id));
    const versionIds = new Set(
      [...evidence.map((e) => e.sourceVersionId), ...publications.map((p) => p.sourceVersionId), ...pathways.map((p) => p.sourceVersionId),
        ...genePathways.map((g) => g.sourceVersionId), ...genes.map((g) => g.sourceVersionId)].filter(Boolean),
    );
    const commentCounts: Record<string, number> = {};
    if (includeDiscussion) {
      for (const c of s.comments.filter((x) => x.caseId === caseId)) {
        const k = `${c.targetType}:${c.targetId}`;
        commentCounts[k] = (commentCounts[k] ?? 0) + 1;
      }
    }
    return structuredClone({
      schemaVersion: 1,
      generatedAt: now(),
      caseRecord,
      samples,
      histology: s.histology.filter((h) => sampleIds.has(h.sampleId)),
      ihc: s.ihc.filter((r) => sampleIds.has(r.sampleId)),
      molecularTests: tests,
      variants,
      biomarkers: s.biomarkers.filter((b) => testIds.has(b.molecularTestId)),
      genes,
      pathways,
      genePathways,
      evidence,
      evidenceLinks: links,
      publications,
      sourceVersions: s.sourceVersions.filter((v) => versionIds.has(v.id)),
      interpretations: s.interpretations.filter((i) => i.caseId === caseId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      timelineEvents: s.timelineEvents.filter((e) => e.caseId === caseId).sort((a, b) => a.eventDate.localeCompare(b.eventDate)),
      commentCounts,
    });
  }

  async getBoard(caseId: string) {
    this.user();
    return this.buildBoard(caseId, true);
  }

  private variantContext(v: Variant): CaseVariantView | null {
    const t = this.state.tests.find((x) => x.id === v.molecularTestId);
    const sample = t && this.state.samples.find((x) => x.id === t.sampleId);
    const c = sample && this.state.cases.find((x) => x.id === sample.caseId);
    return t && sample && c ? { variant: v, caseId: c.id, caseCode: c.caseCode, sampleId: sample.id, sampleLabel: sample.label, testDate: t.testDate } : null;
  }

  async caseVariants(caseId: string) {
    this.user();
    return this.buildBoard(caseId, false).variants.map((v) => this.variantContext(v)!).filter(Boolean);
  }

  // ─── muestras ───────────────────────────────────────────────────────────────
  private validateSample(req: SampleRequest) {
    const errors = [
      ...(clean(req.label) ? [] : [{ field: 'label', message: 'obligatorio' }]),
      ...(req.sampleType ? [] : [{ field: 'sampleType', message: 'obligatorio' }]),
      ...pctError('tumorCellularityPct', req.tumorCellularityPct),
      ...pctError('necrosisPct', req.necrosisPct),
    ];
    if (errors.length) throw badRequest(errors);
  }

  private requireSample(id: string): Sample {
    const s = this.state.samples.find((x) => x.id === id);
    if (!s) throw notFound('Muestra', id);
    return s;
  }

  async createSample(caseId: string, req: SampleRequest) {
    this.requireClinicalEditor();
    this.requireCase(caseId);
    this.validateSample(req);
    return this.mutate(() => {
      const sample: Sample = {
        ...req, id: uuid(), caseId, label: clean(req.label)!, anatomicSite: clean(req.anatomicSite), observations: clean(req.observations),
        createdAt: now(), version: 0,
      };
      this.state.samples.push(sample);
      this.touchCase(caseId);
      this.audit('CREATE', 'SAMPLE', sample.id, null, sample);
      return structuredClone(sample);
    });
  }

  async updateSample(sampleId: string, req: SampleRequest) {
    this.requireClinicalEditor();
    this.validateSample(req);
    const s = this.requireSample(sampleId);
    if (req.version != null && req.version !== s.version) throw conflict('La muestra fue modificada por otra persona. Recargue antes de guardar.');
    return this.mutate(() => {
      const before = { ...s };
      Object.assign(s, { ...req, label: clean(req.label), anatomicSite: clean(req.anatomicSite), observations: clean(req.observations), version: (s.version ?? 0) + 1 });
      this.touchCase(s.caseId);
      this.audit('UPDATE', 'SAMPLE', sampleId, before, s);
      return structuredClone(s);
    });
  }

  async addHistology(sampleId: string, req: HistologyRequest) {
    this.requireClinicalEditor();
    const sample = this.requireSample(sampleId);
    if (!clean(req.diagnosis)) throw badRequest([{ field: 'diagnosis', message: 'obligatorio' }]);
    return this.mutate(() => {
      const h: Histology = {
        id: uuid(), sampleId, diagnosis: clean(req.diagnosis)!, histologicSubtype: clean(req.histologicSubtype), grade: clean(req.grade),
        growthPattern: clean(req.growthPattern), description: clean(req.description),
      };
      this.state.histology.push(h);
      this.touchCase(sample.caseId);
      this.audit('CREATE', 'HISTOLOGY', h.id, null, h);
      return { ...h };
    });
  }

  private validateIhc(req: IhcRequest) {
    const errors = [
      ...(clean(req.marker) ? [] : [{ field: 'marker', message: 'obligatorio' }]),
      ...(req.result ? [] : [{ field: 'result', message: 'obligatorio' }]),
      ...pctError('percentage', req.percentage),
    ];
    if (errors.length) throw badRequest(errors);
  }

  async addIhc(sampleId: string, req: IhcRequest) {
    this.requireClinicalEditor();
    const sample = this.requireSample(sampleId);
    this.validateIhc(req);
    return this.mutate(() => {
      const r: IhcResult = { ...req, id: uuid(), sampleId, marker: clean(req.marker)!, score: clean(req.score), method: clean(req.method), observations: clean(req.observations) };
      this.state.ihc.push(r);
      this.touchCase(sample.caseId);
      this.audit('CREATE', 'IHC', r.id, null, r);
      return { ...r };
    });
  }

  async updateIhc(ihcId: string, req: IhcRequest) {
    this.requireClinicalEditor();
    this.validateIhc(req);
    const r = this.state.ihc.find((x) => x.id === ihcId);
    if (!r) throw notFound('Resultado IHQ', ihcId);
    return this.mutate(() => {
      const before = { ...r };
      Object.assign(r, { ...req, marker: clean(req.marker), score: clean(req.score), method: clean(req.method), observations: clean(req.observations) });
      this.touchCase(this.requireSample(r.sampleId).caseId);
      this.audit('UPDATE', 'IHC', ihcId, before, r);
      return { ...r };
    });
  }

  async deleteIhc(ihcId: string) {
    this.requireClinicalEditor();
    const r = this.state.ihc.find((x) => x.id === ihcId);
    if (!r) throw notFound('Resultado IHQ', ihcId);
    this.mutate(() => {
      this.audit('DELETE', 'IHC', ihcId, r, null);
      this.state.ihc = this.state.ihc.filter((x) => x.id !== ihcId);
    });
  }

  // ─── molecular ──────────────────────────────────────────────────────────────
  async createTest(sampleId: string, req: MolecularTestRequest) {
    this.requireClinicalEditor();
    const sample = this.requireSample(sampleId);
    const genes = [...new Set((req.genesAnalyzed ?? []).map((g) => g.trim().toUpperCase()).filter(Boolean))];
    const errors = [
      ...(req.testType ? [] : [{ field: 'testType', message: 'obligatorio' }]),
      ...pctError('limitOfDetectionPct', req.limitOfDetectionPct),
      ...(genes.every((g) => GENE_SYMBOL.test(g)) ? [] : [{ field: 'genesAnalyzed', message: 'símbolo génico no válido' }]),
      ...(req.meanDepth != null && req.meanDepth < 0 ? [{ field: 'meanDepth', message: 'debe ser ≥ 0' }] : []),
    ];
    if (errors.length) throw badRequest(errors);
    return this.mutate(() => {
      const t: MolecularTest = {
        ...req, id: uuid(), sampleId, genesAnalyzed: genes.sort(), laboratory: clean(req.laboratory), platform: clean(req.platform),
        panelName: clean(req.panelName), notes: clean(req.notes),
      };
      this.state.tests.push(t);
      this.touchCase(sample.caseId);
      this.audit('CREATE', 'MOLECULAR_TEST', t.id, null, t);
      return structuredClone(t);
    });
  }

  private validateVariant(req: VariantRequest) {
    const gene = upper(req.geneSymbol);
    const errors = [
      ...(gene && GENE_SYMBOL.test(gene) ? [] : [{ field: 'geneSymbol', message: 'símbolo génico no válido' }]),
      ...(req.variantType ? [] : [{ field: 'variantType', message: 'obligatorio' }]),
      ...pctError('vaf', req.vaf),
    ];
    if (errors.length) throw badRequest(errors);
    const hgvsC = clean(req.hgvsC);
    const hgvsP = clean(req.hgvsP);
    const obs = clean(req.observations);
    switch (req.variantType) {
      case 'SNV':
      case 'INDEL':
        if (!hgvsC && !hgvsP) throw rule(`Una variante ${req.variantType} requiere HGVS c. o HGVS p.`);
        break;
      case 'CNV':
        if (req.copyNumber == null && !obs) throw rule('Una CNV requiere número de copias u observaciones que la describan.');
        break;
      case 'FUSION':
        if (!clean(req.fusionPartnerSymbol)) throw rule('Una fusión requiere el gen compañero.');
        break;
      case 'STRUCTURAL':
        if (!hgvsC && !obs) throw rule('Una variante estructural requiere HGVS u observaciones.');
        break;
    }
    if (hgvsC && !/^([a-z]{2}_\d+(\.\d+)?:)?[cgnr]\..+/i.test(hgvsC)) throw rule("HGVS c. debe comenzar por 'c.' (p. ej. c.2573T>G).");
    if (hgvsP && !hgvsP.startsWith('p.')) throw rule("HGVS p. debe comenzar por 'p.' (p. ej. p.L858R o p.Leu858Arg).");
  }

  private geneFor(symbol: string) {
    const s = symbol.toUpperCase();
    let g = this.state.genes.find((x) => x.symbol === s);
    if (!g) {
      g = { id: uuid(), symbol: s, name: null, entrezId: null, uniprotId: null, ncbiUrl: null, sourceVersionId: null };
      this.state.genes.push(g);
    }
    return g;
  }

  private variantFrom(req: VariantRequest, base: Pick<Variant, 'id' | 'molecularTestId' | 'createdAt'>): Variant {
    const gene = this.geneFor(upper(req.geneSymbol)!);
    return {
      ...base, geneId: gene.id, geneSymbol: gene.symbol, variantType: req.variantType, transcript: clean(req.transcript), hgvsC: clean(req.hgvsC),
      hgvsP: clean(req.hgvsP), proteinChange: normalizeProteinChange(clean(req.hgvsP)), vaf: req.vaf ?? null, coverage: req.coverage ?? null,
      copyNumber: req.copyNumber ?? null, fusionPartnerSymbol: upper(req.fusionPartnerSymbol), origin: req.origin ?? 'UNKNOWN',
      classification: clean(req.classification), classificationSystem: clean(req.classificationSystem), observations: clean(req.observations),
    };
  }

  async addVariant(testId: string, req: VariantRequest) {
    this.requireClinicalEditor();
    const test = this.state.tests.find((t) => t.id === testId);
    if (!test) throw notFound('Estudio molecular', testId);
    this.validateVariant(req);
    return this.mutate(() => {
      const v = this.variantFrom(req, { id: uuid(), molecularTestId: testId, createdAt: now() });
      this.state.variants.push(v);
      this.touchCase(this.requireSample(test.sampleId).caseId);
      this.audit('CREATE', 'VARIANT', v.id, null, v);
      return { ...v };
    });
  }

  async updateVariant(variantId: string, req: VariantRequest) {
    this.requireClinicalEditor();
    const idx = this.state.variants.findIndex((v) => v.id === variantId);
    if (idx < 0) throw notFound('Variante', variantId);
    this.validateVariant(req);
    return this.mutate(() => {
      const before = this.state.variants[idx];
      const v = this.variantFrom(req, { id: before.id, molecularTestId: before.molecularTestId, createdAt: before.createdAt });
      this.state.variants[idx] = v;
      this.audit('UPDATE', 'VARIANT', variantId, before, v);
      return { ...v };
    });
  }

  async addBiomarker(testId: string, req: BiomarkerRequest) {
    this.requireClinicalEditor();
    const test = this.state.tests.find((t) => t.id === testId);
    if (!test) throw notFound('Estudio molecular', testId);
    if (!req.biomarkerType || !clean(req.name)) throw badRequest([{ field: 'name', message: 'obligatorio' }]);
    if (req.valueNumeric == null && !clean(req.valueText)) throw rule('Indique un valor numérico o textual para el biomarcador.');
    return this.mutate(() => {
      const b: Biomarker = { ...req, id: uuid(), molecularTestId: testId, name: clean(req.name)!, valueText: clean(req.valueText), unit: clean(req.unit), observations: clean(req.observations) };
      this.state.biomarkers.push(b);
      this.touchCase(this.requireSample(test.sampleId).caseId);
      this.audit('CREATE', 'BIOMARKER', b.id, null, b);
      return { ...b };
    });
  }

  // ─── evidencia ──────────────────────────────────────────────────────────────
  async listEvidence(f: EvidenceFilter, page: number, size: number) {
    this.user();
    const gene = upper(f.gene);
    const variant = f.variant ? normalizeProteinChange(f.variant)?.toLowerCase() : null;
    const q = clean(f.q)?.toLowerCase();
    const items = this.state.evidence
      .filter((e) => !gene || e.geneSymbol === gene)
      .filter((e) => !variant || (e.variantDescriptor ?? '').toLowerCase() === variant)
      .filter((e) => !f.type || e.evidenceType === f.type)
      .filter((e) => !f.certainty || e.certainty === f.certainty)
      .filter((e) => !f.source || e.sourceCode === f.source.toUpperCase())
      .filter((e) => !f.status || e.status === f.status)
      .filter((e) => !q || [e.description, e.diseaseContext, e.externalId].some((x) => x?.toLowerCase().includes(q)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return structuredClone(paginate(items, page, size));
  }

  private requireEvidence(id: string) {
    const e = this.state.evidence.find((x) => x.id === id);
    if (!e) throw notFound('Evidencia', id);
    return e;
  }

  async getEvidence(id: string) {
    this.user();
    return structuredClone(this.requireEvidence(id));
  }

  async evidenceHistory(id: string) {
    this.user();
    this.requireEvidence(id);
    return this.state.audit
      .filter((a) => a.entityType === 'EVIDENCE' && a.entityId === id)
      .map((a) => ({ occurredAt: a.occurredAt, action: a.action, actorId: a.actorId, beforeState: a.before, afterState: a.after }));
  }

  private async ensurePublication(pmid: string, refresh = false): Promise<Publication> {
    const existing = this.state.publications.find((p) => p.pmid === pmid);
    if (existing && !refresh) return existing;
    const record = await ext.fetchPubMed(pmid);
    if (!record) throw notFound('PMID en PubMed', pmid);
    const version = this.resolveVersion('PUBMED', await ext.pubmedVersionLabel());
    const before = existing ? { ...existing } : null;
    const pub: Publication = {
      id: existing?.id ?? uuid(), pmid, pubmedUrl: pubmedUrl(pmid)!, doi: record.doi, doiUrl: record.doi ? `https://doi.org/${record.doi}` : null,
      title: record.title, authors: record.authors, journal: record.journal, pubYear: record.pubYear, pubDate: record.pubDate,
      abstractText: record.abstractText, sourceVersionId: version.id, retrievedAt: now(),
    };
    this.mutate(() => {
      this.state.publications = [...this.state.publications.filter((p) => p.pmid !== pmid), pub];
      this.audit(before ? 'UPDATE' : 'IMPORT', 'PUBLICATION', pmid, before, pub);
    });
    return pub;
  }

  private resolveVersion(sourceCode: string, label: string) {
    let v = this.state.sourceVersions.find((x) => x.sourceCode === sourceCode && x.versionLabel === label);
    if (!v) {
      v = { id: uuid(), sourceCode, versionLabel: label, retrievedAt: now() };
      this.state.sourceVersions.push(v);
    }
    return v;
  }

  private newEvidence(fields: Omit<Evidence, 'id' | 'createdAt' | 'version' | 'status' | 'statusReason' | 'geneSymbol' | 'pmid' | 'pubmedUrl' | 'sourceVersionLabel'>): Evidence {
    if (fields.certainty !== 'UNKNOWN' && fields.certaintyBasis === 'NONE') {
      throw rule(`La certeza '${fields.certainty}' requiere una base: mapeo de la fuente o asignación explícita del usuario.`);
    }
    const pub = this.state.publications.find((p) => p.id === fields.publicationId);
    const e: Evidence = {
      ...fields,
      id: uuid(),
      certaintyBasis: fields.certainty === 'UNKNOWN' ? 'NONE' : fields.certaintyBasis,
      geneSymbol: this.state.genes.find((g) => g.id === fields.geneId)?.symbol ?? null,
      pmid: pub?.pmid ?? null,
      pubmedUrl: pubmedUrl(pub?.pmid),
      doi: fields.doi ?? pub?.doi ?? null,
      publishedDate: fields.publishedDate ?? pub?.pubDate ?? null,
      sourceVersionLabel: this.state.sourceVersions.find((v) => v.id === fields.sourceVersionId)?.versionLabel ?? null,
      status: 'ACTIVE',
      statusReason: null,
      createdAt: now(),
      version: 0,
    };
    this.state.evidence.push(e);
    return e;
  }

  async createManualEvidence(req: ManualEvidenceRequest) {
    this.user();
    const pmid = clean(req.pmid);
    const doi = clean(req.doi);
    const url = clean(req.url);
    const errors = [
      ...(req.evidenceType ? [] : [{ field: 'evidenceType', message: 'obligatorio' }]),
      ...(clean(req.description) ? [] : [{ field: 'description', message: 'obligatorio' }]),
      ...(pmid && !PMID.test(pmid) ? [{ field: 'pmid', message: 'PMID numérico' }] : []),
      ...(doi && !DOI.test(doi) ? [{ field: 'doi', message: 'DOI con formato 10.xxxx/...' }] : []),
      ...(url && !/^https?:\/\/\S+$/.test(url) ? [{ field: 'url', message: 'URL http(s) válida' }] : []),
      ...(req.geneSymbol && !GENE_SYMBOL.test(req.geneSymbol) ? [{ field: 'geneSymbol', message: 'símbolo génico no válido' }] : []),
    ];
    if (errors.length) throw badRequest(errors);
    if (!pmid && !doi && !url) throw rule('Toda evidencia debe citar su fuente: indique PMID, DOI o URL.');
    const publication = pmid ? await this.ensurePublication(pmid) : null;
    const certainty: Certainty = req.certainty ?? 'UNKNOWN';
    const e = this.mutate(() => {
      const created = this.newEvidence({
        geneId: req.geneSymbol ? this.geneFor(req.geneSymbol).id : null,
        variantDescriptor: normalizeProteinChange(clean(req.variantDescriptor)),
        evidenceType: req.evidenceType, description: clean(req.description)!, diseaseContext: clean(req.diseaseContext), certainty,
        certaintyBasis: certainty === 'UNKNOWN' ? 'NONE' : 'USER_ASSIGNED', sourceLevel: null, sourceDirection: null, sourceSignificance: null,
        sourceRating: null, sourceTherapies: null, interpretationScope: req.interpretationScope ?? 'NOT_APPLICABLE', sourceCode: 'MANUAL',
        externalId: null, url, publicationId: publication?.id ?? null, doi, publishedDate: clean(req.publishedDate), sourceVersionId: null,
        retrievedAt: now(),
      });
      this.audit('CREATE', 'EVIDENCE', created.id, null, created);
      return created;
    });
    if (req.linkToVariantId) await this.linkEvidence(req.linkToVariantId, e.id, clean(req.linkNote));
    return structuredClone(e);
  }

  async classifyEvidence(id: string, req: ClassificationRequest) {
    this.user();
    const e = this.requireEvidence(id);
    if (req.version != null && req.version !== e.version) throw conflict('La evidencia fue modificada por otra persona. Recargue antes de guardar.');
    const reason = clean(req.reason);
    if (req.status !== 'ACTIVE' && !reason) throw rule('Retirar o sustituir una evidencia requiere indicar el motivo.');
    return this.mutate(() => {
      const before = { ...e };
      if (req.certainty !== e.certainty) {
        e.certainty = req.certainty;
        e.certaintyBasis = req.certainty === 'UNKNOWN' ? 'NONE' : 'USER_ASSIGNED';
      }
      e.status = req.status;
      e.statusReason = reason;
      e.version = (e.version ?? 0) + 1;
      this.audit('UPDATE', 'EVIDENCE', id, before, e);
      return { ...e };
    });
  }

  async linkEvidence(variantId: string, evidenceId: string, note: string | null): Promise<EvidenceLink> {
    this.user();
    const v = this.state.variants.find((x) => x.id === variantId);
    if (!v) throw notFound('Variante', variantId);
    this.requireEvidence(evidenceId);
    if (this.state.links.some((l) => l.variantId === variantId && l.evidenceId === evidenceId)) throw conflict('La evidencia ya está enlazada a esta variante.');
    return this.mutate(() => {
      const link: EvidenceLink = { variantId, evidenceId, linkedAt: now(), linkedBy: this.user().id, note: clean(note) };
      this.state.links.push(link);
      const ctx = this.variantContext(v);
      if (ctx) this.touchCase(ctx.caseId);
      this.audit('LINK', 'VARIANT_EVIDENCE', `${variantId}:${evidenceId}`, null, link);
      return { ...link };
    });
  }

  async unlinkEvidence(variantId: string, evidenceId: string) {
    this.user();
    const link = this.state.links.find((l) => l.variantId === variantId && l.evidenceId === evidenceId);
    if (!link) throw notFound('Enlace variante-evidencia', `${variantId}:${evidenceId}`);
    this.mutate(() => {
      this.audit('UNLINK', 'VARIANT_EVIDENCE', `${variantId}:${evidenceId}`, link, null);
      this.state.links = this.state.links.filter((l) => l !== link);
    });
  }

  async listPublications(q: string, page: number, size: number) {
    this.user();
    const needle = clean(q)?.toLowerCase();
    const items = this.state.publications
      .filter((p) => !needle || [p.pmid, p.title, p.authors, p.journal].some((x) => x?.toLowerCase().includes(needle)))
      .sort((a, b) => b.retrievedAt.localeCompare(a.retrievedAt));
    return structuredClone(paginate(items, page, size));
  }

  async importPublication(pmid: string, refresh: boolean) {
    this.user();
    if (!PMID.test(pmid.trim())) throw badRequest([{ field: 'pmid', message: 'PMID numérico' }]);
    return structuredClone(await this.ensurePublication(pmid.trim(), refresh));
  }

  // ─── fuentes externas ───────────────────────────────────────────────────────
  async providers(): Promise<ProviderInfo[]> {
    return [
      { sourceCode: 'CIVIC', name: 'CIViC', capability: 'Evidencia clínica de variantes en cáncer (CC0)', status: 'ENABLED', statusDetail: 'API GraphQL oficial, consultada desde el navegador.', documentationUrl: 'https://griffithlab.github.io/civic-v2/' },
      { sourceCode: 'CLINVAR', name: 'ClinVar (NCBI E-utilities)', capability: 'Clasificación germinal, impacto clínico somático y oncogenicidad (separados)', status: 'ENABLED', statusDetail: 'API oficial de NCBI.', documentationUrl: 'https://www.ncbi.nlm.nih.gov/clinvar/docs/maintenance_use/' },
      { sourceCode: 'ONCOKB', name: 'OncoKB', capability: 'Anotación oncológica de variantes', status: 'LICENSE_REVIEW_REQUIRED', statusDetail: 'Integración pendiente de revisión de licencia y términos de uso de OncoKB (ver DECISIONS.md, ADR-012).', documentationUrl: 'https://www.oncokb.org/api-access' },
      { sourceCode: 'PUBMED', name: 'PubMed (NCBI E-utilities)', capability: 'PMID → título, autores, revista, año, abstract, DOI', status: 'ENABLED', statusDetail: 'API oficial de NCBI. Sin scraping.', documentationUrl: 'https://www.ncbi.nlm.nih.gov/books/NBK25501/' },
      { sourceCode: 'REACTOME', name: 'Reactome', capability: 'Gen → pathways (CC BY 4.0)', status: 'ENABLED', statusDetail: 'ContentService oficial.', documentationUrl: 'https://reactome.org/ContentService/' },
    ];
  }

  private importedMap(source: string, ids: string[]) {
    const out: Record<string, string> = {};
    for (const id of ids) {
      const e = this.state.evidence.find((x) => x.sourceCode === source && x.externalId === id);
      if (e) out[id] = e.id;
    }
    return out;
  }

  async searchExternalEvidence(source: string, gene: string, variant: string, size: number, cursor: string | null) {
    this.user();
    const code = source.toUpperCase();
    if (code === 'ONCOKB') throw new ApiError(503, 'Integración desactivada', 'OncoKB: integración pendiente de revisión de licencia (ADR-012).');
    if (code !== 'CIVIC') throw new ApiError(400, 'Parámetro no válido', `Fuente de evidencia desconocida: ${source}`);
    const symbol = upper(gene);
    const protein = normalizeProteinChange(clean(variant));
    if (!symbol || !protein) throw new ApiError(400, 'Parámetro no válido', 'Indique gen y variante.');
    const result = await ext.civicSearch(symbol, protein, size, cursor);
    return { result, importedEvidenceIds: this.importedMap('CIVIC', result.items.map((i) => i.externalId)) };
  }

  async importExternalEvidence(source: string, externalId: string, variantId: string | null, note: string | null) {
    this.user();
    const code = source.toUpperCase();
    if (code !== 'CIVIC') throw new ApiError(code === 'ONCOKB' ? 503 : 400, 'Fuente no disponible', `No se puede importar desde ${source}.`);
    let e = this.state.evidence.find((x) => x.sourceCode === 'CIVIC' && x.externalId === externalId);
    if (!e) {
      const c: EvidenceCandidate | null = await ext.civicFetch(externalId);
      if (!c) throw notFound('Registro CIVIC', externalId);
      const pub = c.pmid ? await this.ensurePublication(c.pmid) : null;
      const label = await ext.civicVersionLabel();
      e = this.mutate(() => {
        const version = this.resolveVersion('CIVIC', label);
        const created = this.newEvidence({
          geneId: c.geneSymbol ? this.geneFor(c.geneSymbol).id : null, variantDescriptor: normalizeProteinChange(c.variantDescriptor),
          evidenceType: c.evidenceType, description: c.description, diseaseContext: c.diseaseContext, certainty: c.mappedCertainty,
          certaintyBasis: c.mappedCertainty === 'UNKNOWN' ? 'NONE' : 'SOURCE_MAPPING', sourceLevel: c.sourceLevel, sourceDirection: c.sourceDirection,
          sourceSignificance: c.sourceSignificance, sourceRating: c.sourceRating, sourceTherapies: c.therapies.length ? c.therapies.join('; ') : null,
          interpretationScope: c.interpretationScope, sourceCode: 'CIVIC', externalId: c.externalId, url: c.url, publicationId: pub?.id ?? null,
          doi: null, publishedDate: c.publicationYear ? String(c.publicationYear) : null, sourceVersionId: version.id, retrievedAt: now(),
        });
        this.audit('IMPORT', 'EVIDENCE', created.id, null, created);
        return created;
      });
    }
    if (variantId && !this.state.links.some((l) => l.variantId === variantId && l.evidenceId === e!.id)) await this.linkEvidence(variantId, e.id, note);
    return structuredClone(e);
  }

  async searchClinVar(gene: string, variant: string) {
    this.user();
    const symbol = upper(gene);
    const protein = normalizeProteinChange(clean(variant));
    if (!symbol || !protein) throw new ApiError(400, 'Parámetro no válido', 'Indique gen y variante.');
    const records = await ext.clinvarSearch(symbol, protein);
    return {
      records,
      importedEvidenceIds: this.importedMap('CLINVAR', records.flatMap((r) => [`${r.accession}:GERMLINE`, `${r.accession}:ONCOGENICITY`])),
      note: 'Clasificación germinal y somática se muestran por separado. El impacto clínico somático se muestra como referencia y no se importa en esta versión.',
    };
  }

  async importClinVar(uid: string, aspect: ClinVarAspect, variantId: string | null, note: string | null) {
    this.user();
    const record = await ext.clinvarFetch(uid);
    if (!record) throw notFound('Registro ClinVar', uid);
    const externalId = `${record.accession}:${aspect}`;
    let e = this.state.evidence.find((x) => x.sourceCode === 'CLINVAR' && x.externalId === externalId);
    if (!e) {
      const cls = aspect === 'GERMLINE' ? record.germline : record.oncogenicity;
      if (!cls.description) throw rule(`ClinVar no registra una clasificación ${aspect === 'GERMLINE' ? 'germinal' : 'de oncogenicidad'} para ${record.accession}`);
      const label = await ext.clinvarVersionLabel();
      const geneSymbol = /\(([A-Z0-9-]+)\):/.exec(record.title)?.[1] ?? null;
      e = this.mutate(() => {
        const version = this.resolveVersion('CLINVAR', label);
        const created = this.newEvidence({
          geneId: geneSymbol ? this.geneFor(geneSymbol).id : null, variantDescriptor: record.proteinChange?.split(',')[0].trim() ?? null,
          evidenceType: aspect === 'GERMLINE' ? 'PREDISPOSITION' : 'ONCOGENIC',
          description: `ClinVar ${record.accession} · ${record.title}. Clasificación ${aspect === 'GERMLINE' ? 'germinal' : 'de oncogenicidad (somática)'}: «${cls.description}». Estado de revisión: ${cls.reviewStatus}${cls.conditions.length ? `. Condiciones: ${cls.conditions.join('; ')}` : ''}${cls.lastEvaluated ? `. Última evaluación: ${cls.lastEvaluated}` : ''}.`,
          diseaseContext: cls.conditions.join('; ').slice(0, 300) || null, certainty: 'UNKNOWN', certaintyBasis: 'NONE', sourceLevel: cls.reviewStatus,
          sourceDirection: null, sourceSignificance: cls.description, sourceRating: null, sourceTherapies: null,
          interpretationScope: aspect === 'GERMLINE' ? 'GERMLINE' : 'SOMATIC', sourceCode: 'CLINVAR', externalId, url: record.url, publicationId: null,
          doi: null, publishedDate: cls.lastEvaluated, sourceVersionId: version.id, retrievedAt: now(),
        });
        this.audit('IMPORT', 'EVIDENCE', created.id, null, created);
        return created;
      });
    }
    if (variantId && !this.state.links.some((l) => l.variantId === variantId && l.evidenceId === e!.id)) await this.linkEvidence(variantId, e.id, note);
    return structuredClone(e);
  }

  async searchPathways(gene: string) {
    this.user();
    const symbol = upper(gene);
    if (!symbol) throw new ApiError(400, 'Parámetro no válido', 'Indique un gen.');
    const r = await ext.reactomePathways(symbol);
    const g = this.state.genes.find((x) => x.symbol === symbol);
    const linked = g
      ? this.state.genePathways.filter((gp) => gp.geneId === g.id).map((gp) => this.state.pathways.find((p) => p.id === gp.pathwayId)?.externalId).filter((x): x is string => !!x)
      : [];
    return { result: { geneSymbol: symbol, ...r }, alreadyLinked: linked };
  }

  async importPathways(gene: string, externalIds: string[]) {
    this.user();
    const symbol = upper(gene)!;
    const r = await ext.reactomePathways(symbol);
    const label = await ext.reactomeVersionLabel();
    const verified = new Map(r.pathways.map((p) => [p.externalId, p]));
    for (const id of externalIds) if (!verified.has(id)) throw rule(`REACTOME no asocia ${id} a ${symbol}: no se importa una relación no verificada.`);
    return this.mutate(() => {
      const version = this.resolveVersion('REACTOME', label);
      const g = this.geneFor(symbol);
      if (r.uniprotId) g.uniprotId = r.uniprotId;
      g.sourceVersionId = g.sourceVersionId ?? version.id;
      return externalIds.map((id) => {
        const c = verified.get(id)!;
        let p = this.state.pathways.find((x) => x.sourceCode === 'REACTOME' && x.externalId === id);
        if (!p) {
          p = { id: uuid(), sourceCode: 'REACTOME', externalId: id, name: c.name, url: c.url, sourceVersionId: version.id };
          this.state.pathways.push(p);
        }
        if (!this.state.genePathways.some((gp) => gp.geneId === g.id && gp.pathwayId === p!.id)) {
          this.state.genePathways.push({ geneId: g.id, pathwayId: p.id, sourceVersionId: version.id, retrievedAt: now() });
          this.audit('IMPORT', 'GENE_PATHWAY', `${symbol}:${id}`, null, { gene: symbol, pathway: id, version: label });
        }
        return { ...p } as Pathway;
      });
    });
  }

  // ─── timeline ───────────────────────────────────────────────────────────────
  async timeline(caseId: string): Promise<TimelineEntry[]> {
    this.user();
    const b = this.buildBoard(caseId, false);
    const entries: TimelineEntry[] = [
      ...b.timelineEvents.map((e) => ({ date: e.eventDate, kind: 'EVENT' as const, eventType: e.eventType, title: e.title, detail: e.description, refId: e.id, sampleId: e.sampleId })),
      ...b.samples.filter((s) => s.collectionDate).map((s) => ({
        date: s.collectionDate!, kind: 'SAMPLE' as const, eventType: s.sampleType, title: `Obtención de muestra: ${s.label}`,
        detail: [s.sampleType, s.anatomicSite, s.tumorCellularityPct != null ? `celularidad tumoral ${s.tumorCellularityPct}%` : null].filter(Boolean).join(' · '),
        refId: s.id, sampleId: s.id,
      })),
      ...b.molecularTests.filter((t) => t.testDate).map((t) => ({
        date: t.testDate!, kind: 'MOLECULAR_TEST' as const, eventType: t.testType,
        title: `Estudio ${t.testType} sobre ${b.samples.find((s) => s.id === t.sampleId)?.label ?? 'muestra'}`,
        detail: `${b.variants.filter((v) => v.molecularTestId === t.id).length} variante(s), ${b.biomarkers.filter((x) => x.molecularTestId === t.id).length} biomarcador(es)`,
        refId: t.id, sampleId: t.sampleId,
      })),
      ...this.state.snapshots.filter((s) => s.summary.caseId === caseId).map((s) => ({
        date: s.summary.createdAt.slice(0, 10), kind: 'SNAPSHOT' as const, eventType: 'SNAPSHOT', title: `Snapshot: ${s.summary.label}`,
        detail: s.summary.note, refId: s.summary.id, sampleId: null,
      })),
    ];
    const order = { EVENT: 0, SAMPLE: 1, MOLECULAR_TEST: 2, SNAPSHOT: 3 };
    return entries.sort((x, y) => x.date.localeCompare(y.date) || order[x.kind] - order[y.kind]);
  }

  async createTimelineEvent(caseId: string, req: TimelineEventRequest) {
    this.requireClinicalEditor();
    this.requireCase(caseId);
    const errors = [
      ...(req.eventType ? [] : [{ field: 'eventType', message: 'obligatorio' }]),
      ...(req.eventDate ? [] : [{ field: 'eventDate', message: 'obligatorio' }]),
      ...(clean(req.title) ? [] : [{ field: 'title', message: 'obligatorio' }]),
    ];
    if (errors.length) throw badRequest(errors);
    if (req.sampleId && this.state.samples.find((s) => s.id === req.sampleId)?.caseId !== caseId) throw rule('La muestra indicada no pertenece al caso.');
    return this.mutate(() => {
      const e: TimelineEvent = { id: uuid(), caseId, eventType: req.eventType, eventDate: req.eventDate, title: clean(req.title)!, description: clean(req.description), sampleId: req.sampleId ?? null };
      this.state.timelineEvents.push(e);
      this.audit('CREATE', 'TIMELINE_EVENT', e.id, null, e);
      return { ...e };
    });
  }

  // ─── razonamiento y discusión ───────────────────────────────────────────────
  private validateTarget(caseId: string, type: TargetType, targetId: string) {
    const s = this.state;
    const sampleInCase = (sampleId: string) => s.samples.find((x) => x.id === sampleId)?.caseId === caseId;
    const testInCase = (testId: string) => { const t = s.tests.find((x) => x.id === testId); return !!t && sampleInCase(t.sampleId); };
    const ok = (() => {
      switch (type) {
        case 'CASE': return targetId === caseId;
        case 'SAMPLE': return sampleInCase(targetId);
        case 'HISTOLOGY': { const h = s.histology.find((x) => x.id === targetId); return !!h && sampleInCase(h.sampleId); }
        case 'IHC': { const r = s.ihc.find((x) => x.id === targetId); return !!r && sampleInCase(r.sampleId); }
        case 'MOLECULAR_TEST': return testInCase(targetId);
        case 'VARIANT': { const v = s.variants.find((x) => x.id === targetId); return !!v && testInCase(v.molecularTestId); }
        case 'BIOMARKER': { const b = s.biomarkers.find((x) => x.id === targetId); return !!b && testInCase(b.molecularTestId); }
        case 'EVIDENCE': return s.evidence.some((x) => x.id === targetId);
        case 'GENE': return s.genes.some((x) => x.id === targetId);
        case 'PATHWAY': return s.pathways.some((x) => x.id === targetId);
        case 'PUBLICATION': return s.publications.some((x) => x.id === targetId);
        case 'INTERPRETATION': return s.interpretations.some((x) => x.id === targetId);
        case 'GRAPH_NODE': return /^[a-z_]{2,20}:[A-Za-z0-9:._-]{1,70}$/.test(targetId);
      }
    })();
    if (!ok) throw rule(`El elemento ${type} ${targetId} no existe o no pertenece al caso.`);
  }

  async createInterpretation(caseId: string, req: InterpretationRequest): Promise<Interpretation> {
    const author = this.user();
    this.requireCase(caseId);
    if (!clean(req.statement)) throw badRequest([{ field: 'statement', message: 'obligatorio' }]);
    if (!req.certainty) throw badRequest([{ field: 'certainty', message: 'obligatorio' }]);
    this.validateTarget(caseId, req.targetType, req.targetId);
    return this.mutate(() => {
      if (req.supersedesId) {
        const prev = this.state.interpretations.find((i) => i.id === req.supersedesId);
        if (!prev || prev.caseId !== caseId || prev.status !== 'CURRENT') throw rule('Sólo puede sustituirse una interpretación vigente del mismo caso.');
        prev.status = 'SUPERSEDED';
      }
      const i: Interpretation = {
        id: uuid(), caseId, targetType: req.targetType, targetId: req.targetId, statement: clean(req.statement)!, certainty: req.certainty,
        status: 'CURRENT', supersedesId: req.supersedesId ?? null, authorId: author.id, authorName: author.displayName, authorRole: author.role, createdAt: now(),
      };
      this.state.interpretations.push(i);
      this.audit('CREATE', 'INTERPRETATION', i.id, null, i);
      return { ...i };
    });
  }

  private commentDto(c: StoredComment): Comment {
    const author = this.state.users.find((u) => u.id === c.authorId);
    return { ...c, caseCode: this.state.cases.find((x) => x.id === c.caseId)?.caseCode ?? null, authorName: author?.displayName ?? null, authorRoleLabel: ROLE_LABEL[c.authorRole] };
  }

  async listComments(caseId: string | null, targetType: TargetType | null, targetId: string | null, page: number, size: number) {
    this.user();
    const items = this.state.comments
      .filter((c) => !caseId || c.caseId === caseId)
      .filter((c) => !caseId || !targetType || !targetId || (c.targetType === targetType && c.targetId === targetId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((c) => this.commentDto(c));
    return paginate(items, page, size);
  }

  async createComment(caseId: string, targetType: TargetType, targetId: string, body: string) {
    const author = this.user();
    this.requireCase(caseId);
    const text = clean(body);
    if (!text) throw badRequest([{ field: 'body', message: 'obligatorio' }]);
    if (text.length > 5000) throw badRequest([{ field: 'body', message: 'máximo 5000 caracteres' }]);
    this.validateTarget(caseId, targetType, targetId);
    return this.mutate(() => {
      const c: StoredComment = { id: uuid(), caseId, targetType, targetId, authorId: author.id, authorRole: author.role, body: text, createdAt: now(), editedAt: null };
      this.state.comments.push(c);
      this.audit('CREATE', 'COMMENT', c.id, null, c);
      return this.commentDto(c);
    });
  }

  async editComment(commentId: string, body: string) {
    const editor = this.user();
    const c = this.state.comments.find((x) => x.id === commentId);
    if (!c) throw notFound('Comentario', commentId);
    if (c.authorId !== editor.id && editor.role !== 'ADMIN') throw forbidden('Sólo el autor o un administrador pueden editar este comentario.');
    const text = clean(body);
    if (!text) throw badRequest([{ field: 'body', message: 'obligatorio' }]);
    if (text === c.body) return this.commentDto(c);
    return this.mutate(() => {
      this.state.revisions.push({ id: uuid(), commentId, body: c.body, revisedAt: now(), revisedBy: editor.id });
      const before = { ...c };
      c.body = text;
      c.editedAt = now();
      this.audit('UPDATE', 'COMMENT', commentId, before, c);
      return this.commentDto(c);
    });
  }

  async commentRevisions(commentId: string) {
    this.user();
    if (!this.state.comments.some((c) => c.id === commentId)) throw notFound('Comentario', commentId);
    return this.state.revisions.filter((r) => r.commentId === commentId).map(({ commentId: _c, ...r }) => r);
  }

  // ─── snapshots ──────────────────────────────────────────────────────────────
  private snapshotSummary(s: DemoState['snapshots'][number]): SnapshotSummary {
    return {
      ...s.summary,
      caseCode: this.state.cases.find((c) => c.id === s.summary.caseId)?.caseCode ?? null,
      createdByName: this.state.users.find((u) => u.id === s.summary.createdBy)?.displayName ?? null,
    };
  }

  async createSnapshot(caseId: string, req: SnapshotRequest) {
    const author = this.user();
    const label = clean(req.label);
    if (!label) throw badRequest([{ field: 'label', message: 'obligatorio' }]);
    const board = this.buildBoard(caseId, false);
    const capturedAt = now();
    const content = JSON.stringify({ schemaVersion: 1, capturedAt, label, note: clean(req.note), board, graphState: req.graphState ?? null });
    const hash = await sha256(content);
    return this.mutate(() => {
      const snap = { summary: { id: uuid(), caseId, label, note: clean(req.note), schemaVersion: 1, contentSha256: hash, createdAt: capturedAt, createdBy: author.id }, content };
      this.state.snapshots.push(snap);
      this.audit('CREATE', 'SNAPSHOT', snap.summary.id, null, snap.summary);
      return this.snapshotSummary(snap);
    });
  }

  async caseSnapshots(caseId: string) {
    this.user();
    return this.state.snapshots.filter((s) => s.summary.caseId === caseId).sort((a, b) => b.summary.createdAt.localeCompare(a.summary.createdAt)).map((s) => this.snapshotSummary(s));
  }

  async listSnapshots(page: number, size: number) {
    this.user();
    const items = [...this.state.snapshots].sort((a, b) => b.summary.createdAt.localeCompare(a.summary.createdAt)).map((s) => this.snapshotSummary(s));
    return paginate(items, page, size);
  }

  async getSnapshot(id: string): Promise<SnapshotDetail> {
    this.user();
    const s = this.state.snapshots.find((x) => x.summary.id === id);
    if (!s) throw notFound('Snapshot', id);
    return { summary: this.snapshotSummary(s), content: JSON.parse(s.content), integrityVerified: (await sha256(s.content)) === s.summary.contentSha256 };
  }

  // ─── búsqueda y panel ───────────────────────────────────────────────────────
  async search(q: string, limit: number): Promise<SearchResponse> {
    this.user();
    const cq = classifyQuery(q);
    const s = this.state;
    const lim = Math.min(Math.max(limit || 10, 1), 50);
    const needle = cq.normalized.toLowerCase();
    const caseOfSample = (sampleId: string) => s.cases.find((c) => c.id === s.samples.find((x) => x.id === sampleId)?.caseId);
    const variantHits = (vs: Variant[]): SearchHit[] =>
      vs.slice(0, lim).map((v) => {
        const ctx = this.variantContext(v);
        return {
          kind: 'VARIANT', id: v.id, title: variantLabel(v), subtitle: `${ctx ? `${ctx.caseCode} · ${ctx.sampleLabel}` : ''}${v.vaf != null ? ` · VAF ${v.vaf}%` : ''}`,
          caseId: ctx?.caseId ?? null, caseCode: ctx?.caseCode ?? null, route: ctx ? `/cases/${ctx.caseId}/board?node=variant:${v.id}` : null,
        };
      });
    const evidenceHits = (es: Evidence[]): SearchHit[] =>
      es.slice(0, lim).map((e) => ({ kind: 'EVIDENCE', id: e.id, title: `${e.sourceCode}${e.externalId ? ` ${e.externalId}` : ''} · ${e.evidenceType}`, subtitle: e.description.slice(0, 160), caseId: null, caseCode: null, route: `/evidence?id=${e.id}` }));
    const caseHits = (): SearchHit[] =>
      s.cases.filter((c) => [c.caseCode, c.organ, c.tumorType, c.diagnosis, c.histologicSubtype].some((f) => f?.toLowerCase().includes(needle))).slice(0, lim)
        .map((c) => ({ kind: 'CASE', id: c.id, title: `${c.caseCode} · ${c.tumorType}`, subtitle: `${c.organ}${c.diagnosis ? ` · ${c.diagnosis}` : ''}`, caseId: c.id, caseCode: c.caseCode, route: `/cases/${c.id}` }));

    const groups: SearchResponse['groups'] = [];
    const push = (kind: SearchHit['kind'], label: string, items: SearchHit[]) => {
      if (items.length && !groups.some((g) => g.kind === kind)) groups.push({ kind, label, items });
    };
    for (const kind of cq.kinds) {
      switch (kind) {
        case 'PMID': {
          const p = s.publications.find((x) => x.pmid === cq.pmid);
          push('PMID', 'Publicación (PMID)', [p
            ? { kind: 'PMID', id: p.pmid, title: p.title, subtitle: `PMID ${p.pmid}${p.journal ? ` · ${p.journal}` : ''}${p.pubYear ? ` · ${p.pubYear}` : ''}`, caseId: null, caseCode: null, route: `/literature?pmid=${p.pmid}` }
            : { kind: 'PMID', id: cq.pmid!, title: `PMID ${cq.pmid} no importado`, subtitle: 'Puede consultarse en PubMed e importarse desde Literatura', caseId: null, caseCode: null, route: `/literature?pmid=${cq.pmid}` }]);
          break;
        }
        case 'VARIANT': {
          const gene = s.genes.find((g) => g.symbol === cq.geneSymbol);
          if (!gene) break;
          const vs = s.variants.filter((v) => v.geneId === gene.id && (cq.proteinChange ? v.proteinChange?.toLowerCase() === cq.proteinChange.toLowerCase() : v.hgvsC?.toLowerCase().includes(cq.hgvsC!.toLowerCase())));
          const es = cq.proteinChange ? s.evidence.filter((e) => e.geneId === gene.id && (e.variantDescriptor ?? '').toLowerCase() === cq.proteinChange!.toLowerCase()) : [];
          push('VARIANT', 'Variantes y evidencia', [...variantHits(vs), ...evidenceHits(es)]);
          break;
        }
        case 'GENE': {
          const genes = s.genes.filter((g) => g.symbol.toLowerCase().includes(cq.geneSymbol!.toLowerCase()) || g.name?.toLowerCase().includes(needle)).slice(0, lim);
          const hits: SearchHit[] = genes.map((g) => ({ kind: 'GENE', id: g.id, title: g.symbol, subtitle: `${g.name ?? 'Nombre pendiente de fuente verificada'} · ${s.variants.filter((v) => v.geneId === g.id).length} variante(s) registradas`, caseId: null, caseCode: null, route: `/evidence?gene=${g.symbol}` }));
          const exact = genes.find((g) => g.symbol === cq.geneSymbol);
          if (exact) hits.push(...variantHits(s.variants.filter((v) => v.geneId === exact.id)));
          push('GENE', 'Genes', hits);
          break;
        }
        case 'IHC_MARKER':
          push('IHC_MARKER', 'Inmunohistoquímica', s.ihc.filter((r) => r.marker.toLowerCase().includes(needle)).slice(0, lim).map((r) => {
            const c = caseOfSample(r.sampleId);
            const sample = s.samples.find((x) => x.id === r.sampleId);
            return { kind: 'IHC_MARKER', id: r.id, title: `${r.marker} — ${r.result}${r.score ? ` · ${r.score}` : r.percentage != null ? ` · ${r.percentage}%` : ''}`, subtitle: `${c?.caseCode ?? ''} · ${sample?.label ?? ''}`, caseId: c?.id ?? null, caseCode: c?.caseCode ?? null, route: c ? `/cases/${c.id}` : null };
          }));
          break;
        case 'BIOMARKER':
          push('BIOMARKER', 'Biomarcadores', s.biomarkers.filter((b) => [b.name, b.biomarkerType, b.valueText].some((x) => x?.toLowerCase().includes(needle))).slice(0, lim).map((b) => {
            const t = s.tests.find((x) => x.id === b.molecularTestId);
            const c = t ? caseOfSample(t.sampleId) : undefined;
            return { kind: 'BIOMARKER', id: b.id, title: `${b.biomarkerType} — ${b.valueNumeric ?? b.valueText ?? ''}${b.unit ? ` ${b.unit}` : ''}`, subtitle: `${b.name}${c ? ` · ${c.caseCode}` : ''}`, caseId: c?.id ?? null, caseCode: c?.caseCode ?? null, route: c ? `/cases/${c.id}` : null };
          }));
          break;
        case 'CASE':
        case 'TUMOR':
          push('CASE', 'Casos (tumor, órgano, diagnóstico)', caseHits());
          break;
        case 'PATHWAY':
          push('PATHWAY', 'Pathways', s.pathways.filter((p) => p.name.toLowerCase().includes(needle) || p.externalId.toLowerCase().includes(needle)).slice(0, lim)
            .map((p) => ({ kind: 'PATHWAY', id: p.id, title: p.name, subtitle: `${p.sourceCode} · ${p.externalId}`, caseId: null, caseCode: null, route: p.url })));
          break;
        case 'EVIDENCE':
          push('EVIDENCE', 'Evidencias', evidenceHits(s.evidence.filter((e) => [e.description, e.diseaseContext, e.variantDescriptor, e.externalId].some((x) => x?.toLowerCase().includes(needle)))));
          break;
      }
    }
    return { query: cq.normalized, interpretedAs: cq.kinds, geneSymbol: cq.geneSymbol, proteinChange: cq.proteinChange, pmid: cq.pmid, groups };
  }

  async dashboard(): Promise<Dashboard> {
    this.user();
    const s = this.state;
    const cases = await this.listCases('', 0, 5);
    const recentVariants = [...s.variants].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8)
      .map((v) => this.variantContext(v)).filter((x): x is CaseVariantView => !!x);
    const comments = await this.listComments(null, null, null, 0, 6);
    return structuredClone({
      counts: { cases: s.cases.length, samples: s.samples.length, variants: s.variants.length, evidence: s.evidence.length, publications: s.publications.length, snapshots: s.snapshots.length, comments: s.comments.length },
      recentCases: cases.items,
      recentVariants,
      recentEvidence: [...s.evidence].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8),
      recentSnapshots: (await this.listSnapshots(0, 5)).items,
      recentComments: comments.items,
    });
  }
}
