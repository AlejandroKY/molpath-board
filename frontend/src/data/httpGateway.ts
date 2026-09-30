import type {
  CaseBoard,
  CaseRecord,
  CaseSummary,
  CaseVariantView,
  ClinVarSearch,
  Comment,
  CommentRevision,
  Dashboard,
  Evidence,
  EvidenceHistoryEntry,
  EvidenceLink,
  ExternalEvidenceSearch,
  Page,
  Pathway,
  PathwaySearch,
  ProviderInfo,
  Publication,
  SearchResponse,
  SnapshotDetail,
  SnapshotSummary,
  TimelineEntry,
  UserSummary,
} from '../domain/types';
import { ApiError, type MolPathGateway, type Session } from './gateway';

type Query = Record<string, string | number | null | undefined>;

/** Adaptador REST hacia el backend Spring Boot. */
export class HttpGateway implements MolPathGateway {
  readonly mode = 'api' as const;
  private token: string | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly onUnauthorized: () => void = () => {},
  ) {}

  setSession(session: Session | null) {
    this.token = session?.token ?? null;
  }

  private async request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
    const url = new URL(`${this.baseUrl.replace(/\/$/, '')}${path}`);
    for (const [k, v] of Object.entries(query ?? {})) if (v !== null && v !== undefined && v !== '') url.searchParams.set(k, String(v));
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    let response: Response;
    try {
      response = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      throw new ApiError(0, 'Sin conexión con el servidor', `No se pudo contactar con ${this.baseUrl}. ¿Está el backend en ejecución?`);
    }
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
      if (response.status === 401) this.onUnauthorized();
      throw new ApiError(response.status, data?.title ?? `Error ${response.status}`, data?.detail ?? '', data?.errors ?? []);
    }
    return data as T;
  }

  private get = <T,>(path: string, query?: Query) => this.request<T>('GET', path, undefined, query);
  private post = <T,>(path: string, body: unknown) => this.request<T>('POST', path, body);
  private put = <T,>(path: string, body: unknown) => this.request<T>('PUT', path, body);

  devUsers = () => this.get<UserSummary[]>('/api/auth/dev-users');
  async login(username: string): Promise<Session> {
    const r = await this.post<{ token: string; expiresAt: string; user: UserSummary }>('/api/auth/dev-login', { username });
    return { user: r.user, token: r.token, expiresAt: r.expiresAt };
  }

  listCases = (q: string, page: number, size: number) => this.get<Page<CaseSummary>>('/api/cases', { q, page, size });
  getCase = (id: string) => this.get<CaseRecord>(`/api/cases/${id}`);
  createCase: MolPathGateway['createCase'] = (req) => this.post('/api/cases', req);
  updateCase: MolPathGateway['updateCase'] = (id, req) => this.put(`/api/cases/${id}`, req);
  getBoard = (caseId: string) => this.get<CaseBoard>(`/api/cases/${caseId}/board`);
  caseVariants = (caseId: string) => this.get<CaseVariantView[]>(`/api/cases/${caseId}/variants`);

  createSample: MolPathGateway['createSample'] = (caseId, req) => this.post(`/api/cases/${caseId}/samples`, req);
  updateSample: MolPathGateway['updateSample'] = (id, req) => this.put(`/api/samples/${id}`, req);
  addHistology: MolPathGateway['addHistology'] = (id, req) => this.post(`/api/samples/${id}/histology`, req);
  addIhc: MolPathGateway['addIhc'] = (id, req) => this.post(`/api/samples/${id}/ihc`, req);
  updateIhc: MolPathGateway['updateIhc'] = (id, req) => this.put(`/api/ihc/${id}`, req);
  deleteIhc = (id: string) => this.request<void>('DELETE', `/api/ihc/${id}`);

  createTest: MolPathGateway['createTest'] = (sampleId, req) => this.post(`/api/samples/${sampleId}/molecular-tests`, req);
  addVariant: MolPathGateway['addVariant'] = (testId, req) => this.post(`/api/molecular-tests/${testId}/variants`, req);
  updateVariant: MolPathGateway['updateVariant'] = (id, req) => this.put(`/api/variants/${id}`, req);
  addBiomarker: MolPathGateway['addBiomarker'] = (testId, req) => this.post(`/api/molecular-tests/${testId}/biomarkers`, req);

  listEvidence: MolPathGateway['listEvidence'] = (f, page, size) =>
    this.get<Page<Evidence>>('/api/evidence', { gene: f.gene, variant: f.variant, type: f.type, certainty: f.certainty, source: f.source, status: f.status, q: f.q, page, size });
  getEvidence = (id: string) => this.get<Evidence>(`/api/evidence/${id}`);
  evidenceHistory = (id: string) => this.get<EvidenceHistoryEntry[]>(`/api/evidence/${id}/history`);
  createManualEvidence: MolPathGateway['createManualEvidence'] = (req) => this.post('/api/evidence', req);
  classifyEvidence: MolPathGateway['classifyEvidence'] = (id, req) => this.put(`/api/evidence/${id}/classification`, req);
  linkEvidence = (variantId: string, evidenceId: string, note: string | null) =>
    this.post<EvidenceLink>(`/api/variants/${variantId}/evidence-links`, { evidenceId, note });
  unlinkEvidence = (variantId: string, evidenceId: string) =>
    this.request<void>('DELETE', `/api/variants/${variantId}/evidence-links/${evidenceId}`);
  listPublications = (q: string, page: number, size: number) => this.get<Page<Publication>>('/api/publications', { q, page, size });
  importPublication = (pmid: string, refresh: boolean) => this.post<Publication>('/api/publications/import', { pmid, refresh });

  providers = () => this.get<ProviderInfo[]>('/api/external/providers');
  searchExternalEvidence = (source: string, gene: string, variant: string, size: number, cursor: string | null) =>
    this.get<ExternalEvidenceSearch>('/api/external/evidence', { source, gene, variant, size, cursor });
  importExternalEvidence = (source: string, externalId: string, variantId: string | null, note: string | null) =>
    this.post<Evidence>('/api/external/evidence/import', { source, externalId, variantId, note });
  searchClinVar = (gene: string, variant: string) => this.get<ClinVarSearch>('/api/external/clinvar', { gene, variant });
  importClinVar: MolPathGateway['importClinVar'] = (uid, aspect, variantId, note) =>
    this.post('/api/external/clinvar/import', { uid, aspect, variantId, note });
  searchPathways = (gene: string) => this.get<PathwaySearch>('/api/external/pathways', { gene });
  importPathways = (gene: string, externalIds: string[]) => this.post<Pathway[]>('/api/external/pathways/import', { gene, externalIds });

  timeline = (caseId: string) => this.get<TimelineEntry[]>(`/api/cases/${caseId}/timeline`);
  createTimelineEvent: MolPathGateway['createTimelineEvent'] = (caseId, req) => this.post(`/api/cases/${caseId}/timeline-events`, req);
  createInterpretation: MolPathGateway['createInterpretation'] = (caseId, req) => this.post(`/api/cases/${caseId}/interpretations`, req);
  listComments: MolPathGateway['listComments'] = (caseId, targetType, targetId, page, size) =>
    this.get<Page<Comment>>('/api/comments', { caseId, targetType, targetId, page, size });
  createComment: MolPathGateway['createComment'] = (caseId, targetType, targetId, body) =>
    this.post(`/api/cases/${caseId}/comments`, { targetType, targetId, body });
  editComment = (id: string, body: string) => this.put<Comment>(`/api/comments/${id}`, { body });
  commentRevisions = (id: string) => this.get<CommentRevision[]>(`/api/comments/${id}/revisions`);

  createSnapshot: MolPathGateway['createSnapshot'] = (caseId, req) => this.post(`/api/cases/${caseId}/snapshots`, req);
  caseSnapshots = (caseId: string) => this.get<SnapshotSummary[]>(`/api/cases/${caseId}/snapshots`);
  listSnapshots = (page: number, size: number) => this.get<Page<SnapshotSummary>>('/api/snapshots', { page, size });
  getSnapshot = (id: string) => this.get<SnapshotDetail>(`/api/snapshots/${id}`);

  search = (q: string, limit: number) => this.get<SearchResponse>('/api/search', { q, limit });
  dashboard = () => this.get<Dashboard>('/api/dashboard');
}
