# Esquema de base de datos

Fuente de verdad: migraciones Flyway en [`backend/src/main/resources/db/migration`](backend/src/main/resources/db/migration). Este documento explica el *porqué* del modelo.

## Diagrama ER

```mermaid
erDiagram
    APP_USER ||--o{ TUMOR_CASE : "crea"
    TUMOR_CASE ||--o{ SAMPLE : "tiene"
    SAMPLE ||--o{ HISTOLOGY_FINDING : "describe"
    SAMPLE ||--o{ IHC_RESULT : "marca"
    SAMPLE ||--o{ MOLECULAR_TEST : "se analiza en"
    MOLECULAR_TEST ||--o{ MOLECULAR_TEST_GENE : "genes analizados"
    MOLECULAR_TEST ||--o{ VARIANT : "detecta"
    MOLECULAR_TEST ||--o{ BIOMARKER_RESULT : "mide"
    GENE ||--o{ VARIANT : "afecta"
    GENE ||--o{ GENE_PATHWAY : ""
    PATHWAY ||--o{ GENE_PATHWAY : ""
    GENE ||--o{ EVIDENCE : "sobre"
    VARIANT ||--o{ VARIANT_EVIDENCE_LINK : ""
    EVIDENCE ||--o{ VARIANT_EVIDENCE_LINK : ""
    PUBLICATION ||--o{ EVIDENCE : "cita"
    KNOWLEDGE_SOURCE ||--o{ SOURCE_VERSION : "versiona"
    KNOWLEDGE_SOURCE ||--o{ EVIDENCE : "procede de"
    KNOWLEDGE_SOURCE ||--o{ PATHWAY : "procede de"
    SOURCE_VERSION ||--o{ EVIDENCE : ""
    SOURCE_VERSION ||--o{ PUBLICATION : ""
    SOURCE_VERSION ||--o{ PATHWAY : ""
    SOURCE_VERSION ||--o{ GENE_PATHWAY : ""
    TUMOR_CASE ||--o{ TIMELINE_EVENT : "evoluciona"
    SAMPLE |o--o{ TIMELINE_EVENT : "asociada"
    TUMOR_CASE ||--o{ INTERPRETATION : "razona"
    INTERPRETATION |o--o| INTERPRETATION : "sustituye"
    TUMOR_CASE ||--o{ DISCUSSION_COMMENT : "discute"
    DISCUSSION_COMMENT ||--o{ DISCUSSION_COMMENT_REVISION : "historial"
    APP_USER ||--o{ DISCUSSION_COMMENT : "escribe"
    APP_USER ||--o{ INTERPRETATION : "firma"
    TUMOR_CASE ||--o{ CASE_SNAPSHOT : "congela"

    APP_USER { uuid id PK; string username UK; string display_name; enum role }
    TUMOR_CASE { uuid id PK; string case_code UK; string organ; string tumor_type; string diagnosis; string histologic_subtype; string grade; text notes; bool demo; bigint version }
    SAMPLE { uuid id PK; uuid case_id FK; string label; enum sample_type; string anatomic_site; date collection_date; decimal tumor_cellularity_pct; decimal necrosis_pct; bool dna_available; bool rna_available; enum dna_quality; enum rna_quality }
    HISTOLOGY_FINDING { uuid id PK; uuid sample_id FK; string diagnosis; string histologic_subtype; string grade; string growth_pattern }
    IHC_RESULT { uuid id PK; uuid sample_id FK; string marker; enum result; decimal percentage; enum intensity; string score; string method }
    MOLECULAR_TEST { uuid id PK; uuid sample_id FK; enum test_type; string laboratory; string platform; string panel_name; int mean_depth; decimal limit_of_detection_pct; date test_date }
    MOLECULAR_TEST_GENE { uuid molecular_test_id PK; string gene_symbol PK }
    VARIANT { uuid id PK; uuid molecular_test_id FK; uuid gene_id FK; enum variant_type; string hgvs_c; string hgvs_p; decimal vaf; int coverage; decimal copy_number; string fusion_partner_symbol; enum origin; string classification }
    BIOMARKER_RESULT { uuid id PK; uuid molecular_test_id FK; enum biomarker_type; decimal value_numeric; string value_text; string unit }
    GENE { uuid id PK; string symbol UK; string name; string entrez_id; string uniprot_id }
    PATHWAY { uuid id PK; string source_code FK; string external_id; string name }
    GENE_PATHWAY { uuid gene_id PK; uuid pathway_id PK; uuid source_version_id FK; timestamptz retrieved_at }
    KNOWLEDGE_SOURCE { string code PK; string name; text license_note }
    SOURCE_VERSION { uuid id PK; string source_code FK; string version_label; timestamptz retrieved_at }
    PUBLICATION { uuid id PK; string pmid UK; string doi; text title; text authors; string journal; int pub_year; text abstract_text; timestamptz retrieved_at }
    EVIDENCE { uuid id PK; uuid gene_id FK; string variant_descriptor; enum evidence_type; text description; string disease_context; enum certainty; enum certainty_basis; string source_level; string source_direction; enum interpretation_scope; string source_code FK; string external_id; uuid publication_id FK; enum status }
    VARIANT_EVIDENCE_LINK { uuid variant_id PK; uuid evidence_id PK; timestamptz linked_at; uuid linked_by; string note }
    INTERPRETATION { uuid id PK; uuid case_id FK; string target_type; string target_id; text statement; enum certainty; enum status; uuid supersedes_id FK; uuid author_id FK }
    TIMELINE_EVENT { uuid id PK; uuid case_id FK; enum event_type; date event_date; string title; uuid sample_id FK }
    DISCUSSION_COMMENT { uuid id PK; uuid case_id FK; enum target_type; string target_id; uuid author_id FK; string author_role; text body; timestamptz edited_at }
    DISCUSSION_COMMENT_REVISION { uuid id PK; uuid comment_id FK; text body; timestamptz revised_at }
    CASE_SNAPSHOT { uuid id PK; uuid case_id FK; string label; int schema_version; text content; string content_sha256 }
    AUDIT_EVENT { bigint id PK; uuid actor_id; string action; string entity_type; string entity_id; text before_state; text after_state }
```

## Decisiones de modelado

### Normalización
- **Muestra, fecha y caso de una variante no se duplican**: se derivan de `variant → molecular_test → sample → tumor_case`. La fecha de la variante es `molecular_test.test_date`.
- **Genes como entidad** (`gene`) referenciada por `variant.gene_id` y `evidence.gene_id`. Se crean por símbolo normalizado (mayúsculas) al registrar una variante; `name`, `entrez_id` y `uniprot_id` sólo se rellenan desde una fuente (NCBI Gene / Reactome), nunca a mano sin fuente.
- **Genes analizados** de un estudio en tabla propia (`molecular_test_gene`) en lugar de texto separado por comas: permite búsqueda ("¿qué estudios analizaron ALK?") y validación.
- **Histología por muestra** (`histology_finding`) además de los campos de resumen del caso: la histología puede cambiar entre biopsias (evolución longitudinal).

### Evidencia (ADR-004/005)
- Entidad de conocimiento reutilizable; se enlaza a variantes del caso con `variant_evidence_link` (quién y cuándo enlazó).
- `(source_code, external_id)` es único: la misma evidencia CIViC no puede importarse dos veces.
- Restricción `ck_evidence_certainty_has_basis`: la base de datos **impide** guardar una certeza distinta de `UNKNOWN` sin base declarada.
- `interpretation_scope` separa interpretación **germinal** de **somática** (ClinVar).
- `status` (`ACTIVE`/`WITHDRAWN`/`SUPERSEDED`) + `status_reason`: una evidencia retirada no se borra; los snapshots muestran que "dejó de considerarse válida".
- PubMed: `publication.pmid` es la clave natural (con `CHECK` numérico). La URL **no se almacena**: se genera desde el PMID.

### Trazabilidad por registro
| Requisito | Columna(s) |
|---|---|
| fuente / base de datos | `evidence.source_code → knowledge_source` |
| PMID | `publication.pmid` vía `evidence.publication_id` |
| DOI | `publication.doi` / `evidence.doi` |
| URL | `evidence.url` (registro en la fuente); URL PubMed derivada |
| fecha de publicación | `publication.pub_date`, `evidence.published_date` |
| fecha de consulta | `retrieved_at` |
| versión de la base | `source_version_id → source_version.version_label` |
| tipo / nivel | `evidence_type`, `source_level`, `certainty`, `certainty_basis` |
| extracto | `description` |
| identificador interno | `id` (UUID) |

### Referencias polimórficas
`discussion_comment` e `interpretation` apuntan a cualquier elemento del caso con `(target_type, target_id)` sin FK. Motivo: un comentario puede referirse a un nodo del grafo que no es una fila (p. ej. un pathway en el contexto de un caso). La integridad se valida en el servicio y el `case_id` sí es FK, de modo que borrar un caso borra su discusión.

### Historial
- `tumor_case`, `sample`, `evidence` tienen `version` para bloqueo optimista (evita que dos usuarios se pisen).
- `audit_event` guarda antes/después como JSON (`text`).
- `discussion_comment_revision` conserva cada versión anterior de un comentario.
- `interpretation` no se actualiza: se sustituye (`supersedes_id`, `status = SUPERSEDED`).
- `case_snapshot.content` es inmutable (no existe `UPDATE` en la aplicación, entidad `@Immutable`) y lleva `content_sha256`. Se guarda como `text` y no `jsonb` porque `jsonb` reordena claves y rompería la verificación byte a byte del hash.

### Extensibilidad
`biomarker_result.biomarker_type` admite TMB, MSI, HRD, firmas mutacionales y expresión RNA; `value_numeric`/`value_text`/`unit` cubren valores cuantitativos y categóricos sin nuevas tablas.
