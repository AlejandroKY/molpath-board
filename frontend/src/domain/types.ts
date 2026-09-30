// Tipos del dominio: espejo de los DTO JSON del backend (docs en /swagger-ui.html).
// Fechas: `Instant` → ISO-8601 con zona; `LocalDate` → 'YYYY-MM-DD'.

export type UUID = string;

export type UserRole =
  | 'PATHOLOGY'
  | 'MOLECULAR_BIOLOGY'
  | 'ONCOLOGY'
  | 'GENETICS'
  | 'BIOINFORMATICS'
  | 'RESEARCHER'
  | 'ADMIN';

export interface UserSummary {
  id: UUID;
  username: string;
  displayName: string;
  role: UserRole;
  roleLabel: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

// ─── casos ────────────────────────────────────────────────────────────────────
export interface CaseRecord {
  id: UUID;
  caseCode: string;
  organ: string;
  tumorType: string;
  diagnosis: string | null;
  histologicSubtype: string | null;
  grade: string | null;
  notes: string | null;
  demo: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: UserSummary | null;
  version: number | null;
}

export interface CaseSummary {
  id: UUID;
  caseCode: string;
  organ: string;
  tumorType: string;
  diagnosis: string | null;
  demo: boolean;
  createdAt: string;
  updatedAt: string;
  sampleCount: number;
  variantCount: number;
}

export interface CaseRequest {
  caseCode: string;
  organ: string;
  tumorType: string;
  diagnosis?: string | null;
  histologicSubtype?: string | null;
  grade?: string | null;
  notes?: string | null;
  version?: number | null;
}

// ─── muestras ─────────────────────────────────────────────────────────────────
export type SampleType = 'BIOPSY' | 'RESECTION' | 'CYTOLOGY' | 'CELL_BLOCK' | 'LIQUID_BIOPSY' | 'BONE_MARROW' | 'OTHER';
export type NucleicAcidQuality = 'GOOD' | 'ACCEPTABLE' | 'POOR' | 'FAILED' | 'NOT_ASSESSED';
export type IhcResultValue = 'POSITIVE' | 'NEGATIVE' | 'EQUIVOCAL' | 'NOT_EVALUABLE';
export type IhcIntensity = 'NONE' | 'WEAK' | 'MODERATE' | 'STRONG' | 'HETEROGENEOUS';

export interface Sample {
  id: UUID;
  caseId: UUID;
  label: string;
  sampleType: SampleType;
  anatomicSite: string | null;
  collectionDate: string | null;
  tumorCellularityPct: number | null;
  necrosisPct: number | null;
  dnaAvailable: boolean | null;
  rnaAvailable: boolean | null;
  dnaQuality: NucleicAcidQuality | null;
  rnaQuality: NucleicAcidQuality | null;
  observations: string | null;
  createdAt: string;
  version: number | null;
}

export type SampleRequest = Omit<Sample, 'id' | 'caseId' | 'createdAt' | 'version'> & { version?: number | null };

export interface Histology {
  id: UUID;
  sampleId: UUID;
  diagnosis: string;
  histologicSubtype: string | null;
  grade: string | null;
  growthPattern: string | null;
  description: string | null;
}

export type HistologyRequest = Omit<Histology, 'id' | 'sampleId'>;

export interface IhcResult {
  id: UUID;
  sampleId: UUID;
  marker: string;
  result: IhcResultValue;
  percentage: number | null;
  intensity: IhcIntensity | null;
  score: string | null;
  method: string | null;
  observations: string | null;
}

export type IhcRequest = Omit<IhcResult, 'id' | 'sampleId'>;

// ─── molecular ────────────────────────────────────────────────────────────────
export type MolecularTestType = 'NGS_DNA' | 'NGS_RNA' | 'PCR' | 'FISH' | 'SANGER' | 'RNA_SEQ' | 'OTHER';
export type VariantType = 'SNV' | 'INDEL' | 'CNV' | 'FUSION' | 'STRUCTURAL';
export type VariantOrigin = 'SOMATIC' | 'GERMLINE' | 'UNKNOWN';
export type BiomarkerType = 'TMB' | 'MSI' | 'HRD' | 'MUTATIONAL_SIGNATURE' | 'RNA_EXPRESSION' | 'OTHER';

export interface MolecularTest {
  id: UUID;
  sampleId: UUID;
  testType: MolecularTestType;
  laboratory: string | null;
  platform: string | null;
  panelName: string | null;
  genesAnalyzed: string[];
  meanDepth: number | null;
  limitOfDetectionPct: number | null;
  testDate: string | null;
  notes: string | null;
}

export type MolecularTestRequest = Omit<MolecularTest, 'id' | 'sampleId'>;

export interface Variant {
  id: UUID;
  molecularTestId: UUID;
  geneId: UUID;
  geneSymbol: string;
  variantType: VariantType;
  transcript: string | null;
  hgvsC: string | null;
  hgvsP: string | null;
  proteinChange: string | null;
  vaf: number | null;
  coverage: number | null;
  copyNumber: number | null;
  fusionPartnerSymbol: string | null;
  origin: VariantOrigin;
  classification: string | null;
  classificationSystem: string | null;
  observations: string | null;
  createdAt: string;
}

export interface VariantRequest {
  geneSymbol: string;
  variantType: VariantType;
  transcript?: string | null;
  hgvsC?: string | null;
  hgvsP?: string | null;
  vaf?: number | null;
  coverage?: number | null;
  copyNumber?: number | null;
  fusionPartnerSymbol?: string | null;
  origin?: VariantOrigin | null;
  classification?: string | null;
  classificationSystem?: string | null;
  observations?: string | null;
}

export interface Biomarker {
  id: UUID;
  molecularTestId: UUID;
  biomarkerType: BiomarkerType;
  name: string;
  valueNumeric: number | null;
  valueText: string | null;
  unit: string | null;
  observations: string | null;
}

export type BiomarkerRequest = Omit<Biomarker, 'id' | 'molecularTestId'>;

export interface CaseVariantView {
  variant: Variant;
  caseId: UUID;
  caseCode: string;
  sampleId: UUID;
  sampleLabel: string;
  testDate: string | null;
}

// ─── conocimiento ─────────────────────────────────────────────────────────────
export type EvidenceType =
  | 'ONCOGENIC'
  | 'FUNCTIONAL'
  | 'DIAGNOSTIC'
  | 'PROGNOSTIC'
  | 'PREDICTIVE'
  | 'THERAPEUTIC'
  | 'PREDISPOSITION';
export type Certainty = 'STRONG' | 'MODERATE' | 'LIMITED' | 'CONTRADICTORY' | 'INSUFFICIENT' | 'UNKNOWN';
export type CertaintyBasis = 'SOURCE_MAPPING' | 'USER_ASSIGNED' | 'NONE';
export type InterpretationScope = 'SOMATIC' | 'GERMLINE' | 'NOT_APPLICABLE';
export type EvidenceStatus = 'ACTIVE' | 'WITHDRAWN' | 'SUPERSEDED';

export interface SourceVersion {
  id: UUID;
  sourceCode: string;
  versionLabel: string;
  retrievedAt: string;
}

export interface Gene {
  id: UUID;
  symbol: string;
  name: string | null;
  entrezId: string | null;
  uniprotId: string | null;
  ncbiUrl: string | null;
  sourceVersionId: UUID | null;
}

export interface Pathway {
  id: UUID;
  sourceCode: string;
  externalId: string;
  name: string;
  url: string | null;
  sourceVersionId: UUID | null;
}

export interface GenePathway {
  geneId: UUID;
  pathwayId: UUID;
  sourceVersionId: UUID | null;
  retrievedAt: string;
}

export interface Publication {
  id: UUID;
  pmid: string;
  pubmedUrl: string;
  doi: string | null;
  doiUrl: string | null;
  title: string;
  authors: string | null;
  journal: string | null;
  pubYear: number | null;
  pubDate: string | null;
  abstractText: string | null;
  sourceVersionId: UUID | null;
  retrievedAt: string;
}

export interface Evidence {
  id: UUID;
  geneId: UUID | null;
  geneSymbol: string | null;
  variantDescriptor: string | null;
  evidenceType: EvidenceType;
  description: string;
  diseaseContext: string | null;
  certainty: Certainty;
  certaintyBasis: CertaintyBasis;
  sourceLevel: string | null;
  sourceDirection: string | null;
  sourceSignificance: string | null;
  sourceRating: number | null;
  sourceTherapies: string | null;
  interpretationScope: InterpretationScope;
  sourceCode: string;
  externalId: string | null;
  url: string | null;
  publicationId: UUID | null;
  pmid: string | null;
  pubmedUrl: string | null;
  doi: string | null;
  publishedDate: string | null;
  sourceVersionId: UUID | null;
  sourceVersionLabel: string | null;
  retrievedAt: string | null;
  status: EvidenceStatus;
  statusReason: string | null;
  createdAt: string;
  version: number | null;
}

export interface EvidenceLink {
  variantId: UUID;
  evidenceId: UUID;
  linkedAt: string;
  linkedBy: UUID | null;
  note: string | null;
}

export interface ManualEvidenceRequest {
  geneSymbol?: string | null;
  variantDescriptor?: string | null;
  evidenceType: EvidenceType;
  description: string;
  diseaseContext?: string | null;
  certainty?: Certainty | null;
  interpretationScope?: InterpretationScope | null;
  pmid?: string | null;
  doi?: string | null;
  url?: string | null;
  publishedDate?: string | null;
  linkToVariantId?: UUID | null;
  linkNote?: string | null;
}

export interface ClassificationRequest {
  certainty: Certainty;
  status: EvidenceStatus;
  reason?: string | null;
  version?: number | null;
}

export interface EvidenceFilter {
  gene?: string;
  variant?: string;
  type?: EvidenceType | '';
  certainty?: Certainty | '';
  source?: string;
  status?: EvidenceStatus | '';
  q?: string;
}

export interface EvidenceHistoryEntry {
  occurredAt: string;
  action: string;
  actorId: UUID | null;
  beforeState: string | null;
  afterState: string | null;
}

// ─── proveedores externos ─────────────────────────────────────────────────────
export type ProviderStatus = 'ENABLED' | 'DISABLED' | 'LICENSE_REVIEW_REQUIRED';

export interface ProviderInfo {
  sourceCode: string;
  name: string;
  capability: string;
  status: ProviderStatus;
  statusDetail: string;
  documentationUrl: string;
}

export interface EvidenceCandidate {
  sourceCode: string;
  externalId: string;
  geneSymbol: string | null;
  variantDescriptor: string | null;
  molecularProfile: string | null;
  evidenceType: EvidenceType;
  description: string;
  diseaseContext: string | null;
  sourceLevel: string | null;
  sourceDirection: string | null;
  sourceSignificance: string | null;
  sourceRating: number | null;
  therapies: string[];
  interpretationScope: InterpretationScope;
  mappedCertainty: Certainty;
  url: string;
  pmid: string | null;
  citation: string | null;
  publicationYear: number | null;
}

export interface ExternalEvidenceSearch {
  result: {
    sourceCode: string;
    query: string;
    matchedProfile: string | null;
    items: EvidenceCandidate[];
    totalCount: number;
    nextCursor: string | null;
    note: string | null;
  };
  importedEvidenceIds: Record<string, UUID>;
}

export interface ClinVarClassification {
  description: string | null;
  reviewStatus: string | null;
  lastEvaluated: string | null;
  conditions: string[];
}

export interface ClinVarRecord {
  uid: string;
  accession: string;
  title: string;
  proteinChange: string | null;
  url: string;
  germline: ClinVarClassification;
  somaticClinicalImpact: ClinVarClassification;
  oncogenicity: ClinVarClassification;
}

export type ClinVarAspect = 'GERMLINE' | 'ONCOGENICITY';

export interface ClinVarSearch {
  records: ClinVarRecord[];
  importedEvidenceIds: Record<string, UUID>;
  note: string | null;
}

export interface PathwayCandidate {
  externalId: string;
  name: string;
  url: string;
}

export interface PathwaySearch {
  result: { geneSymbol: string; uniprotId: string | null; pathways: PathwayCandidate[]; note: string | null };
  alreadyLinked: string[];
}

// ─── razonamiento humano ──────────────────────────────────────────────────────
export type TargetType =
  | 'CASE'
  | 'SAMPLE'
  | 'HISTOLOGY'
  | 'IHC'
  | 'MOLECULAR_TEST'
  | 'VARIANT'
  | 'BIOMARKER'
  | 'EVIDENCE'
  | 'GENE'
  | 'PATHWAY'
  | 'PUBLICATION'
  | 'INTERPRETATION'
  | 'GRAPH_NODE';

export interface Interpretation {
  id: UUID;
  caseId: UUID;
  targetType: TargetType;
  targetId: string;
  statement: string;
  certainty: Certainty;
  status: 'CURRENT' | 'SUPERSEDED';
  supersedesId: UUID | null;
  authorId: UUID;
  authorName: string | null;
  authorRole: UserRole;
  createdAt: string;
}

export interface InterpretationRequest {
  targetType: TargetType;
  targetId: string;
  statement: string;
  certainty: Certainty;
  supersedesId?: UUID | null;
}

export interface Comment {
  id: UUID;
  caseId: UUID;
  caseCode: string | null;
  targetType: TargetType;
  targetId: string;
  authorId: UUID;
  authorName: string | null;
  authorRole: UserRole;
  authorRoleLabel: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
}

export interface CommentRevision {
  id: UUID;
  body: string;
  revisedAt: string;
  revisedBy: UUID | null;
}

// ─── timeline ─────────────────────────────────────────────────────────────────
export type TimelineEventType =
  | 'DIAGNOSIS'
  | 'INITIAL_BIOPSY'
  | 'SURGERY'
  | 'REBIOPSY'
  | 'PROGRESSION'
  | 'RECURRENCE'
  | 'METASTASIS'
  | 'MOLECULAR_STUDY'
  | 'NEW_BIOMARKER'
  | 'OTHER';

export interface TimelineEvent {
  id: UUID;
  caseId: UUID;
  eventType: TimelineEventType;
  eventDate: string;
  title: string;
  description: string | null;
  sampleId: UUID | null;
}

export interface TimelineEventRequest {
  eventType: TimelineEventType;
  eventDate: string;
  title: string;
  description?: string | null;
  sampleId?: UUID | null;
}

export interface TimelineEntry {
  date: string;
  kind: 'EVENT' | 'SAMPLE' | 'MOLECULAR_TEST' | 'SNAPSHOT';
  eventType: string;
  title: string;
  detail: string | null;
  refId: UUID;
  sampleId: UUID | null;
}

// ─── agregado del caso ────────────────────────────────────────────────────────
export interface CaseBoard {
  schemaVersion: number;
  generatedAt: string;
  caseRecord: CaseRecord;
  samples: Sample[];
  histology: Histology[];
  ihc: IhcResult[];
  molecularTests: MolecularTest[];
  variants: Variant[];
  biomarkers: Biomarker[];
  genes: Gene[];
  pathways: Pathway[];
  genePathways: GenePathway[];
  evidence: Evidence[];
  evidenceLinks: EvidenceLink[];
  publications: Publication[];
  sourceVersions: SourceVersion[];
  interpretations: Interpretation[];
  timelineEvents: TimelineEvent[];
  commentCounts: Record<string, number>;
}

// ─── snapshots ────────────────────────────────────────────────────────────────
export interface GraphState {
  collapsed: string[];
  layers: { knowledge: boolean; reasoning: boolean };
}

export interface SnapshotRequest {
  label: string;
  note?: string | null;
  graphState?: GraphState | null;
}

export interface SnapshotSummary {
  id: UUID;
  caseId: UUID;
  caseCode: string | null;
  label: string;
  note: string | null;
  schemaVersion: number;
  contentSha256: string;
  createdAt: string;
  createdBy: UUID | null;
  createdByName: string | null;
}

export interface SnapshotContent {
  schemaVersion: number;
  capturedAt: string;
  label: string;
  note: string | null;
  board: CaseBoard;
  graphState: GraphState | null;
}

export interface SnapshotDetail {
  summary: SnapshotSummary;
  content: SnapshotContent;
  integrityVerified: boolean;
}

// ─── búsqueda y dashboard ─────────────────────────────────────────────────────
export type EntityKind = 'PMID' | 'VARIANT' | 'GENE' | 'IHC_MARKER' | 'BIOMARKER' | 'CASE' | 'TUMOR' | 'PATHWAY' | 'EVIDENCE';

export interface SearchHit {
  kind: EntityKind;
  id: string;
  title: string;
  subtitle: string | null;
  caseId: UUID | null;
  caseCode: string | null;
  route: string | null;
}

export interface SearchResponse {
  query: string;
  interpretedAs: EntityKind[];
  geneSymbol: string | null;
  proteinChange: string | null;
  pmid: string | null;
  groups: { kind: EntityKind; label: string; items: SearchHit[] }[];
}

export interface Dashboard {
  counts: Record<string, number>;
  recentCases: CaseSummary[];
  recentVariants: CaseVariantView[];
  recentEvidence: Evidence[];
  recentSnapshots: SnapshotSummary[];
  recentComments: Comment[];
}
