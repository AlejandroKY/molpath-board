import type {
  BiomarkerRequest,
  Biomarker,
  CaseBoard,
  CaseRecord,
  CaseRequest,
  CaseSummary,
  CaseVariantView,
  ClassificationRequest,
  ClinVarAspect,
  ClinVarSearch,
  Comment,
  CommentRevision,
  Dashboard,
  Evidence,
  EvidenceFilter,
  EvidenceHistoryEntry,
  EvidenceLink,
  ExternalEvidenceSearch,
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
  PathwaySearch,
  ProviderInfo,
  Publication,
  Sample,
  SampleRequest,
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
} from '../domain/types';

export type DataMode = 'api' | 'demo';

export interface Session {
  user: UserSummary;
  token: string | null;
  expiresAt: string | null;
}

/**
 * Puerto de acceso a datos. La interfaz no sabe si habla con el backend REST (modo `api`)
 * o con el almacén del navegador (modo `demo`, GitHub Pages). Ver DECISIONS.md, ADR-002.
 */
export interface MolPathGateway {
  readonly mode: DataMode;

  // sesión
  devUsers(): Promise<UserSummary[]>;
  login(username: string): Promise<Session>;
  setSession(session: Session | null): void;

  // casos
  listCases(q: string, page: number, size: number): Promise<Page<CaseSummary>>;
  getCase(id: string): Promise<CaseRecord>;
  createCase(req: CaseRequest): Promise<CaseRecord>;
  updateCase(id: string, req: CaseRequest): Promise<CaseRecord>;
  getBoard(caseId: string): Promise<CaseBoard>;
  caseVariants(caseId: string): Promise<CaseVariantView[]>;

  // muestras
  createSample(caseId: string, req: SampleRequest): Promise<Sample>;
  updateSample(sampleId: string, req: SampleRequest): Promise<Sample>;
  addHistology(sampleId: string, req: HistologyRequest): Promise<Histology>;
  addIhc(sampleId: string, req: IhcRequest): Promise<IhcResult>;
  updateIhc(ihcId: string, req: IhcRequest): Promise<IhcResult>;
  deleteIhc(ihcId: string): Promise<void>;

  // molecular
  createTest(sampleId: string, req: MolecularTestRequest): Promise<MolecularTest>;
  addVariant(testId: string, req: VariantRequest): Promise<Variant>;
  updateVariant(variantId: string, req: VariantRequest): Promise<Variant>;
  addBiomarker(testId: string, req: BiomarkerRequest): Promise<Biomarker>;

  // evidencia y literatura
  listEvidence(filter: EvidenceFilter, page: number, size: number): Promise<Page<Evidence>>;
  getEvidence(id: string): Promise<Evidence>;
  evidenceHistory(id: string): Promise<EvidenceHistoryEntry[]>;
  createManualEvidence(req: ManualEvidenceRequest): Promise<Evidence>;
  classifyEvidence(id: string, req: ClassificationRequest): Promise<Evidence>;
  linkEvidence(variantId: string, evidenceId: string, note: string | null): Promise<EvidenceLink>;
  unlinkEvidence(variantId: string, evidenceId: string): Promise<void>;
  listPublications(q: string, page: number, size: number): Promise<Page<Publication>>;
  importPublication(pmid: string, refresh: boolean): Promise<Publication>;

  // fuentes externas
  providers(): Promise<ProviderInfo[]>;
  searchExternalEvidence(source: string, gene: string, variant: string, size: number, cursor: string | null): Promise<ExternalEvidenceSearch>;
  importExternalEvidence(source: string, externalId: string, variantId: string | null, note: string | null): Promise<Evidence>;
  searchClinVar(gene: string, variant: string): Promise<ClinVarSearch>;
  importClinVar(uid: string, aspect: ClinVarAspect, variantId: string | null, note: string | null): Promise<Evidence>;
  searchPathways(gene: string): Promise<PathwaySearch>;
  importPathways(gene: string, externalIds: string[]): Promise<Pathway[]>;

  // evolución, razonamiento y discusión
  timeline(caseId: string): Promise<TimelineEntry[]>;
  createTimelineEvent(caseId: string, req: TimelineEventRequest): Promise<TimelineEvent>;
  createInterpretation(caseId: string, req: InterpretationRequest): Promise<Interpretation>;
  listComments(caseId: string | null, targetType: TargetType | null, targetId: string | null, page: number, size: number): Promise<Page<Comment>>;
  createComment(caseId: string, targetType: TargetType, targetId: string, body: string): Promise<Comment>;
  editComment(commentId: string, body: string): Promise<Comment>;
  commentRevisions(commentId: string): Promise<CommentRevision[]>;

  // snapshots
  createSnapshot(caseId: string, req: SnapshotRequest): Promise<SnapshotSummary>;
  caseSnapshots(caseId: string): Promise<SnapshotSummary[]>;
  listSnapshots(page: number, size: number): Promise<Page<SnapshotSummary>>;
  getSnapshot(id: string): Promise<SnapshotDetail>;

  // búsqueda y panel
  search(q: string, limit: number): Promise<SearchResponse>;
  dashboard(): Promise<Dashboard>;

  /** Sólo modo demo: restaura el dataset ficticio original. */
  resetDemo?(): Promise<void>;
}

/** Error normalizado (RFC 7807) para ambos modos. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly title: string,
    public readonly detail: string,
    public readonly fieldErrors: { field: string; message: string }[] = [],
  ) {
    super(detail || title);
  }
}
