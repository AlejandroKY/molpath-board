-- MolPath Board · esquema base
-- Capas: CASO (datos clínicos ficticios) · CONOCIMIENTO (fuentes externas con procedencia) · RAZONAMIENTO (humano)

-- ============================================================ usuarios
create table app_user (
    id            uuid primary key,
    username      varchar(64)  not null unique,
    display_name  varchar(128) not null,
    role          varchar(32)  not null,
    active        boolean      not null default true,
    created_at    timestamptz  not null default now(),
    constraint ck_app_user_role check (role in ('PATHOLOGY','MOLECULAR_BIOLOGY','ONCOLOGY','GENETICS','BIOINFORMATICS','RESEARCHER','ADMIN'))
);

-- ============================================================ fuentes de conocimiento
create table knowledge_source (
    code          varchar(32)  primary key,
    name          varchar(120) not null,
    homepage_url  varchar(500),
    license_note  text
);

create table source_version (
    id            uuid primary key,
    source_code   varchar(32)  not null references knowledge_source(code),
    version_label varchar(200) not null,
    retrieved_at  timestamptz  not null,
    constraint uq_source_version unique (source_code, version_label)
);

-- ============================================================ caso
create table tumor_case (
    id                  uuid primary key,
    case_code           varchar(32)  not null unique,
    organ               varchar(120) not null,
    tumor_type          varchar(200) not null,
    diagnosis           varchar(500),
    histologic_subtype  varchar(200),
    grade               varchar(60),
    notes               text,
    demo                boolean      not null default true,
    created_at          timestamptz  not null,
    updated_at          timestamptz  not null,
    created_by          uuid references app_user(id),
    version             bigint       not null default 0
);

create table sample (
    id                     uuid primary key,
    case_id                uuid         not null references tumor_case(id) on delete cascade,
    label                  varchar(120) not null,
    sample_type            varchar(32)  not null,
    anatomic_site          varchar(200),
    collection_date        date,
    tumor_cellularity_pct  numeric(5,2) check (tumor_cellularity_pct between 0 and 100),
    necrosis_pct           numeric(5,2) check (necrosis_pct between 0 and 100),
    dna_available          boolean,
    rna_available          boolean,
    dna_quality            varchar(20),
    rna_quality            varchar(20),
    observations           text,
    created_at             timestamptz  not null,
    updated_at             timestamptz  not null,
    version                bigint       not null default 0,
    constraint ck_sample_type check (sample_type in ('BIOPSY','RESECTION','CYTOLOGY','CELL_BLOCK','LIQUID_BIOPSY','BONE_MARROW','OTHER')),
    constraint ck_sample_dna_quality check (dna_quality in ('GOOD','ACCEPTABLE','POOR','FAILED','NOT_ASSESSED')),
    constraint ck_sample_rna_quality check (rna_quality in ('GOOD','ACCEPTABLE','POOR','FAILED','NOT_ASSESSED'))
);
create index ix_sample_case on sample(case_id);

create table histology_finding (
    id                  uuid primary key,
    sample_id           uuid         not null references sample(id) on delete cascade,
    diagnosis           varchar(500) not null,
    histologic_subtype  varchar(200),
    grade               varchar(60),
    growth_pattern      varchar(200),
    description         text,
    created_at          timestamptz  not null,
    updated_at          timestamptz  not null
);
create index ix_histology_sample on histology_finding(sample_id);

create table ihc_result (
    id            uuid primary key,
    sample_id     uuid         not null references sample(id) on delete cascade,
    marker        varchar(80)  not null,
    result        varchar(20)  not null,
    percentage    numeric(5,2) check (percentage between 0 and 100),
    intensity     varchar(20),
    score         varchar(80),
    method        varchar(200),
    observations  text,
    created_at    timestamptz  not null,
    updated_at    timestamptz  not null,
    constraint ck_ihc_result check (result in ('POSITIVE','NEGATIVE','EQUIVOCAL','NOT_EVALUABLE')),
    constraint ck_ihc_intensity check (intensity in ('NONE','WEAK','MODERATE','STRONG','HETEROGENEOUS'))
);
create index ix_ihc_sample on ihc_result(sample_id);
create index ix_ihc_marker on ihc_result(lower(marker));

create table molecular_test (
    id                     uuid primary key,
    sample_id              uuid         not null references sample(id) on delete cascade,
    test_type              varchar(20)  not null,
    laboratory             varchar(200),
    platform               varchar(200),
    panel_name             varchar(200),
    mean_depth             integer check (mean_depth >= 0),
    limit_of_detection_pct numeric(5,2) check (limit_of_detection_pct between 0 and 100),
    test_date              date,
    notes                  text,
    created_at             timestamptz  not null,
    updated_at             timestamptz  not null,
    constraint ck_molecular_test_type check (test_type in ('NGS_DNA','NGS_RNA','PCR','FISH','SANGER','RNA_SEQ','OTHER'))
);
create index ix_molecular_test_sample on molecular_test(sample_id);

create table molecular_test_gene (
    molecular_test_id  uuid        not null references molecular_test(id) on delete cascade,
    gene_symbol        varchar(40) not null,
    primary key (molecular_test_id, gene_symbol)
);

-- ============================================================ conocimiento: genes y pathways
create table gene (
    id                 uuid primary key,
    symbol             varchar(40)  not null unique,
    name               varchar(300),
    entrez_id          varchar(20),
    uniprot_id         varchar(20),
    source_version_id  uuid references source_version(id),
    created_at         timestamptz  not null default now()
);

create table pathway (
    id                 uuid primary key,
    source_code        varchar(32)  not null references knowledge_source(code),
    external_id        varchar(60)  not null,
    name               varchar(400) not null,
    source_version_id  uuid references source_version(id),
    created_at         timestamptz  not null default now(),
    constraint uq_pathway_source unique (source_code, external_id)
);

create table gene_pathway (
    gene_id            uuid        not null references gene(id) on delete cascade,
    pathway_id         uuid        not null references pathway(id) on delete cascade,
    source_version_id  uuid references source_version(id),
    retrieved_at       timestamptz not null,
    primary key (gene_id, pathway_id)
);

-- ============================================================ caso: variantes y biomarcadores
create table variant (
    id                     uuid primary key,
    molecular_test_id      uuid         not null references molecular_test(id) on delete cascade,
    gene_id                uuid         not null references gene(id),
    variant_type           varchar(20)  not null,
    transcript             varchar(60),
    hgvs_c                 varchar(200),
    hgvs_p                 varchar(200),
    protein_change_norm    varchar(100),
    vaf                    numeric(6,3) check (vaf between 0 and 100),
    coverage               integer check (coverage >= 0),
    copy_number            numeric(8,2),
    fusion_partner_symbol  varchar(40),
    origin                 varchar(20)  not null default 'UNKNOWN',
    classification         varchar(120),
    classification_system  varchar(120),
    observations           text,
    created_at             timestamptz  not null,
    updated_at             timestamptz  not null,
    constraint ck_variant_type check (variant_type in ('SNV','INDEL','CNV','FUSION','STRUCTURAL')),
    constraint ck_variant_origin check (origin in ('SOMATIC','GERMLINE','UNKNOWN'))
);
create index ix_variant_test on variant(molecular_test_id);
create index ix_variant_gene on variant(gene_id);
create index ix_variant_protein_norm on variant(protein_change_norm);

create table biomarker_result (
    id                 uuid primary key,
    molecular_test_id  uuid          not null references molecular_test(id) on delete cascade,
    biomarker_type     varchar(30)   not null,
    name               varchar(200)  not null,
    value_numeric      numeric(12,4),
    value_text         varchar(200),
    unit               varchar(40),
    observations       text,
    created_at         timestamptz   not null,
    updated_at         timestamptz   not null,
    constraint ck_biomarker_type check (biomarker_type in ('TMB','MSI','HRD','MUTATIONAL_SIGNATURE','RNA_EXPRESSION','OTHER'))
);
create index ix_biomarker_test on biomarker_result(molecular_test_id);

-- ============================================================ conocimiento: publicaciones y evidencia
create table publication (
    id                 uuid primary key,
    pmid               varchar(12)  not null unique,
    doi                varchar(200),
    title              text         not null,
    authors            text,
    journal            varchar(300),
    pub_year           integer,
    pub_date           varchar(40),
    abstract_text      text,
    source_version_id  uuid references source_version(id),
    retrieved_at       timestamptz  not null,
    constraint ck_publication_pmid check (pmid ~ '^[0-9]{1,10}$')
);

create table evidence (
    id                    uuid primary key,
    gene_id               uuid         references gene(id),
    variant_descriptor    varchar(200),
    evidence_type         varchar(20)  not null,
    description           text         not null,
    disease_context       varchar(300),
    certainty             varchar(20)  not null default 'UNKNOWN',
    certainty_basis       varchar(20)  not null default 'NONE',
    source_level          varchar(80),
    source_direction      varchar(40),
    source_significance   varchar(80),
    source_rating         integer,
    source_therapies      varchar(1000),
    interpretation_scope  varchar(20)  not null default 'NOT_APPLICABLE',
    source_code           varchar(32)  not null references knowledge_source(code),
    external_id           varchar(80),
    url                   varchar(1000),
    publication_id        uuid         references publication(id),
    doi                   varchar(200),
    published_date        varchar(40),
    source_version_id     uuid         references source_version(id),
    retrieved_at          timestamptz,
    status                varchar(20)  not null default 'ACTIVE',
    status_reason         text,
    created_at            timestamptz  not null,
    created_by            uuid         references app_user(id),
    updated_at            timestamptz  not null,
    version               bigint       not null default 0,
    constraint ck_evidence_type check (evidence_type in ('ONCOGENIC','FUNCTIONAL','DIAGNOSTIC','PROGNOSTIC','PREDICTIVE','THERAPEUTIC','PREDISPOSITION')),
    constraint ck_evidence_certainty check (certainty in ('STRONG','MODERATE','LIMITED','CONTRADICTORY','INSUFFICIENT','UNKNOWN')),
    constraint ck_evidence_certainty_basis check (certainty_basis in ('SOURCE_MAPPING','USER_ASSIGNED','NONE')),
    constraint ck_evidence_scope check (interpretation_scope in ('SOMATIC','GERMLINE','NOT_APPLICABLE')),
    constraint ck_evidence_status check (status in ('ACTIVE','WITHDRAWN','SUPERSEDED')),
    -- regla: una certeza distinta de UNKNOWN exige una base declarada
    constraint ck_evidence_certainty_has_basis check (certainty = 'UNKNOWN' or certainty_basis <> 'NONE')
);
create unique index uq_evidence_external on evidence(source_code, external_id) where external_id is not null;
create index ix_evidence_gene on evidence(gene_id);
create index ix_evidence_descriptor on evidence(lower(variant_descriptor));

create table variant_evidence_link (
    variant_id   uuid        not null references variant(id) on delete cascade,
    evidence_id  uuid        not null references evidence(id),
    linked_at    timestamptz not null,
    linked_by    uuid        references app_user(id),
    note         varchar(1000),
    primary key (variant_id, evidence_id)
);
create index ix_vel_evidence on variant_evidence_link(evidence_id);

-- ============================================================ razonamiento humano
create table interpretation (
    id             uuid primary key,
    case_id        uuid         not null references tumor_case(id) on delete cascade,
    target_type    varchar(20)  not null,
    target_id      varchar(80)  not null,
    statement      text         not null,
    certainty      varchar(20)  not null default 'UNKNOWN',
    status         varchar(20)  not null default 'CURRENT',
    supersedes_id  uuid         references interpretation(id),
    author_id      uuid         not null references app_user(id),
    author_role    varchar(32)  not null,
    created_at     timestamptz  not null,
    constraint ck_interpretation_certainty check (certainty in ('STRONG','MODERATE','LIMITED','CONTRADICTORY','INSUFFICIENT','UNKNOWN')),
    constraint ck_interpretation_status check (status in ('CURRENT','SUPERSEDED'))
);
create index ix_interpretation_case on interpretation(case_id);

create table timeline_event (
    id           uuid primary key,
    case_id      uuid         not null references tumor_case(id) on delete cascade,
    event_type   varchar(30)  not null,
    event_date   date         not null,
    title        varchar(200) not null,
    description  text,
    sample_id    uuid         references sample(id) on delete set null,
    created_at   timestamptz  not null,
    created_by   uuid         references app_user(id),
    constraint ck_timeline_event_type check (event_type in ('DIAGNOSIS','INITIAL_BIOPSY','SURGERY','REBIOPSY','PROGRESSION','RECURRENCE','METASTASIS','MOLECULAR_STUDY','NEW_BIOMARKER','OTHER'))
);
create index ix_timeline_case on timeline_event(case_id, event_date);

create table discussion_comment (
    id           uuid primary key,
    case_id      uuid         not null references tumor_case(id) on delete cascade,
    target_type  varchar(20)  not null,
    target_id    varchar(80)  not null,
    author_id    uuid         not null references app_user(id),
    author_role  varchar(32)  not null,
    body         text         not null,
    created_at   timestamptz  not null,
    edited_at    timestamptz,
    constraint ck_comment_target check (target_type in ('CASE','SAMPLE','HISTOLOGY','IHC','MOLECULAR_TEST','VARIANT','BIOMARKER','EVIDENCE','GENE','PATHWAY','PUBLICATION','INTERPRETATION','GRAPH_NODE'))
);
create index ix_comment_case on discussion_comment(case_id, created_at desc);
create index ix_comment_target on discussion_comment(target_type, target_id);

create table discussion_comment_revision (
    id          uuid primary key,
    comment_id  uuid        not null references discussion_comment(id) on delete cascade,
    body        text        not null,
    revised_at  timestamptz not null,
    revised_by  uuid        references app_user(id)
);
create index ix_comment_revision_comment on discussion_comment_revision(comment_id);

-- ============================================================ snapshots
create table case_snapshot (
    id              uuid primary key,
    case_id         uuid         not null references tumor_case(id) on delete cascade,
    label           varchar(200) not null,
    note            text,
    schema_version  integer      not null,
    -- text (no jsonb): se preserva el JSON byte a byte para verificar content_sha256
    content         text         not null,
    content_sha256  varchar(64)  not null,
    created_at      timestamptz  not null,
    created_by      uuid         references app_user(id)
);
create index ix_snapshot_case on case_snapshot(case_id, created_at desc);

-- ============================================================ auditoría
create table audit_event (
    id            bigserial primary key,
    occurred_at   timestamptz  not null default now(),
    actor_id      uuid,
    action        varchar(20)  not null,
    entity_type   varchar(40)  not null,
    entity_id     varchar(80)  not null,
    case_id       uuid,
    before_state  text,
    after_state   text
);
create index ix_audit_entity on audit_event(entity_type, entity_id);
create index ix_audit_case on audit_event(case_id, occurred_at desc);

-- ============================================================ catálogo de fuentes
insert into knowledge_source (code, name, homepage_url, license_note) values
 ('PUBMED',    'PubMed (NCBI)',            'https://pubmed.ncbi.nlm.nih.gov/', 'Metadatos bibliográficos vía NCBI E-utilities. Respetar las políticas de uso de NCBI (máx. 3 req/s sin API key).'),
 ('CIVIC',     'CIViC',                    'https://civicdb.org/',             'Contenido de conocimiento publicado bajo CC0 1.0.'),
 ('CLINVAR',   'ClinVar (NCBI)',           'https://www.ncbi.nlm.nih.gov/clinvar/', 'Datos públicos de NCBI vía E-utilities. Interpretaciones germinales y somáticas separadas.'),
 ('ONCOKB',    'OncoKB',                   'https://www.oncokb.org/',          'Requiere token y aceptación de términos de licencia. Integración desactivada hasta revisión legal (ADR-012).'),
 ('REACTOME',  'Reactome',                 'https://reactome.org/',            'Datos de Reactome bajo CC BY 4.0: atribución requerida.'),
 ('NCBI_GENE', 'NCBI Gene',                'https://www.ncbi.nlm.nih.gov/gene/', 'Datos públicos de NCBI vía E-utilities.'),
 ('MANUAL',    'Registro manual de usuario', null,                            'Evidencia introducida manualmente por un usuario; la cita/fuente debe indicarse en el registro.');
