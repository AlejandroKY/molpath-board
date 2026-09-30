# Registro de decisiones de arquitectura (ADR)

Formato: **Decisión · Opciones consideradas · Motivo**. Las decisiones se añaden en orden; si una se revoca se marca como *Reemplazada* y se enlaza la nueva, nunca se borra.

---

## ADR-001 · Stack base

- **Decisión:** Frontend React + TypeScript + Vite. Backend Java 21 (compilado/verificado con JDK 25) + Spring Boot 4.1. PostgreSQL 17. Flyway. REST + OpenAPI (springdoc 3).
- **Opciones:** Spring Boot 3.5 (API más conocida) vs 4.1 (actual).
- **Motivo:** el repositorio estaba vacío, así que se adopta el stack preferido. Spring Boot 3.5 terminó su soporte OSS en junio de 2026; iniciar un proyecto nuevo sobre una línea sin soporte sería deuda técnica desde el día 1. Se compila con `--release 21` para máxima compatibilidad de despliegue.

## ADR-002 · Doble modo de datos en el frontend (API / demo en navegador)

- **Decisión:** el frontend accede a los datos exclusivamente a través de la interfaz `MolPathGateway`. Hay dos implementaciones:
  - `HttpGateway` → backend Spring Boot (modo `api`, el modo de referencia).
  - `BrowserDemoGateway` → almacenamiento local del navegador, sembrado con el mismo dataset demo ficticio (modo `demo`).
- **Opciones:** (a) sólo backend; (b) desplegar backend en un PaaS; (c) modo demo estático.
- **Motivo:** se pidió poder abrir la aplicación desde móvil/ordenador vía GitHub. GitHub Pages sólo sirve contenido estático. (b) requiere cuentas y costes de terceros que el usuario no ha autorizado. El modo demo permite usar el producto completo (con datos ficticios, por navegador) y el backend queda como camino de producción. El modo activo se muestra siempre en la interfaz.

## ADR-003 · Proyecciones de dominio en un núcleo TypeScript puro (`src/domain`)

- **Decisión:** la construcción del grafo de la pizarra, la comparación entre muestras (Biopsia 1 vs 2) y la comparación de snapshots son **funciones puras** en `frontend/src/domain`, que operan sobre el *agregado del caso* (`CaseBoard`) que devuelve el backend (`GET /api/cases/{id}/board`).
- **Opciones:** implementar en Java y duplicar en TS para modo demo; o sólo en Java.
- **Motivo:** son proyecciones de presentación deterministas. Tenerlas en un único lugar garantiza resultados idénticos en ambos modos y evita duplicar lógica. El backend es responsable de lo que requiere autoridad: persistencia, validación, inmutabilidad y hash de snapshots, integraciones externas, búsqueda y permisos. El agregado lleva `schemaVersion` para que los diffs sean reproducibles; mover el cálculo al servidor en el futuro no cambia el contrato.

## ADR-004 · Evidencia a nivel de conocimiento, enlazada a variantes del caso

- **Decisión:** `evidence` es una entidad de conocimiento (gen + descriptor de variante + contexto de enfermedad + fuente). Las variantes del caso se enlazan mediante `variant_evidence_link`.
- **Opciones:** evidencia embebida en cada variante de cada caso.
- **Motivo:** la misma evidencia (p. ej. CIViC EID2994) aplica a muchos casos; duplicarla rompe la trazabilidad y hace imposible detectar "nueva evidencia disponible" entre snapshots.

## ADR-005 · Nivel de certeza nunca inventado

- **Decisión:** cada evidencia guarda `certainty` (FUERTE, MODERADA, LIMITADA, CONTRADICTORIA, INSUFICIENTE, DESCONOCIDA) **y** `certainty_basis` (`SOURCE_MAPPING`, `USER_ASSIGNED`, `NONE`), además del nivel crudo de la fuente (`source_level`).
  - Valor por defecto: `UNKNOWN` / `NONE`.
  - Importado de CIViC: se aplica la tabla de mapeo publicada en `ARCHITECTURE.md` (nivel A→FUERTE, B→MODERADA, C/D→LIMITADA, E→INSUFICIENTE) y se conserva el nivel y la dirección originales.
  - ClinVar: el `review_status` se guarda como nivel crudo; la certeza queda `UNKNOWN` salvo asignación explícita del usuario.
  - **CONTRADICTORIA** no se asigna por mapeo de un único registro: la dirección *DOES_NOT_SUPPORT* de CIViC significa "evidencia en contra de la afirmación", no "evidencia en conflicto". La contradicción se **detecta** (función pura `detectContradictions`) cuando, para una misma variante, tipo de evidencia y significado, existen registros con direcciones opuestas (SUPPORTS vs DOES_NOT_SUPPORT); o la asigna el usuario explícitamente.
- **Motivo:** requisito explícito de no convertir incertidumbre en certeza. El mapeo es una regla documentada, visible en la ficha ("mapeado desde CIViC nivel B"), no una inferencia.

## ADR-006 · Snapshots como documentos inmutables con hash

- **Decisión:** un snapshot almacena el agregado completo del caso (incluidas evidencias, publicaciones y versiones de fuentes) como JSON en una columna `text` (no `jsonb`, que reordena claves e impediría verificar el hash byte a byte), con `schema_version` y `content_sha256`. No existe endpoint de modificación de snapshots.
- **Opciones:** tablas relacionales versionadas (temporal tables) para cada entidad.
- **Motivo:** un documento congelado es la representación más fiel de "qué sabíamos en esa fecha", es trivial de verificar (hash) y no se ve afectado por futuras migraciones del esquema relacional. Coste: más almacenamiento, aceptable.

## ADR-007 · Historial en lugar de sobrescritura

- **Decisión:** las ediciones de evidencias, casos y comentarios generan un `audit_event` con estado anterior y posterior (JSON). Los comentarios además guardan revisiones propias (`discussion_comment_revision`). Las interpretaciones no se editan: una nueva interpretación *sustituye* a la anterior (`supersedes_id`) y la anterior queda visible como `SUPERSEDED`.
- **Motivo:** "no sobrescribir silenciosamente el conocimiento histórico" y preparar auditoría.

## ADR-008 · Rol único por usuario (enum) en lugar de tabla Role

- **Decisión:** `app_user.role` es un enum (PATHOLOGY, MOLECULAR_BIOLOGY, ONCOLOGY, GENETICS, BIOINFORMATICS, RESEARCHER, ADMIN).
- **Opciones:** tabla `role` + tabla puente usuario-rol.
- **Motivo:** el rol se usa como *disciplina* visible en la discusión y como autoridad de seguridad. Un enum es suficiente para la fase actual; migrar a N:M es una migración Flyway directa si se necesitan roles múltiples.

## ADR-009 · Autenticación JWT (HS256) con login de desarrollo

- **Decisión:** Spring Security como *resource server* JWT. En desarrollo existe `POST /api/auth/dev-login` (desactivable por `MOLPATH_DEV_LOGIN_ENABLED`) que emite un JWT para un usuario demo. El secreto viene de `MOLPATH_JWT_SECRET`.
- **Motivo:** arquitectura compatible con un IdP real (OIDC/Keycloak) cambiando sólo el `JwtDecoder`, sin contraseñas falsas en esta fase.

## ADR-010 · Pruebas de backend con PostgreSQL embebido (sin Docker)

- **Decisión:** `io.zonky.test:embedded-postgres` para tests de integración y para el perfil de desarrollo sin Docker (`mvnw spring-boot:test-run`).
- **Opciones:** H2 (no es PostgreSQL: `jsonb`, tipos y SQL difieren), Testcontainers (requiere Docker, no disponible en el equipo de desarrollo).
- **Motivo:** probar contra un PostgreSQL real sin exigir Docker.

## ADR-011 · Proveedores externos mediante puertos/adaptadores

- **Decisión:** interfaces `PublicationProvider`, `EvidenceProvider`, `ClinicalSignificanceProvider`, `PathwayProvider`. Implementaciones: `PubMedProvider` (E-utilities, sin scraping), `CivicProvider` (GraphQL oficial, CC0), `ClinVarProvider` (E-utilities), `ReactomeProvider` (ContentService), `OncoKbProvider` (desactivado).
- **Motivo:** no acoplar la aplicación a una API concreta; cada proveedor informa su estado (`ENABLED`, `DISABLED`, `LICENSE_REVIEW_REQUIRED`).

## ADR-012 · OncoKB desactivado

- **Decisión:** el adaptador existe pero devuelve estado `LICENSE_REVIEW_REQUIRED` y no realiza llamadas.
- **Motivo:** la API de OncoKB requiere token y sus términos restringen el uso/almacenamiento de datos según el tipo de licencia. No se puede asumir reutilización libre sin una revisión legal por parte del titular del proyecto. Ver `ARCHITECTURE.md › Integraciones`.

## ADR-013 · Pathways sólo desde fuente trazable (Reactome)

- **Decisión:** la relación gen→pathway sólo se crea importándola desde Reactome (símbolo → UniProt → pathways) o introduciéndola manualmente con fuente citada. No se siembran cascadas tipo EGFR→RAS→RAF→MEK→ERK.
- **Motivo:** no inventar relaciones. Las relaciones gen→gen dentro de una cascada quedan como *Integración pendiente de fuente verificada*.

## ADR-014 · HashRouter en el frontend

- **Decisión:** enrutado con `HashRouter` (`/#/cases/...`).
- **Motivo:** GitHub Pages no soporta reescritura de rutas; el hash funciona igual en Pages, Nginx y Vite dev sin configuración adicional.

## ADR-015 · Orden de fases ajustado

- **Decisión:** se agrupan las fases 2, 4 y 5 del backend (entidades clínicas) y se adelantan evidencias antes que la pizarra final.
- **Motivo:** el modelo relacional de caso→muestra→IHQ→estudio→variante es un único agregado; implementarlo de una vez evita migraciones intermedias innecesarias. Ver `PLAN.md`.

## ADR-016 · Sin librería de UI de terceros; CSS propio con tokens

- **Decisión:** sistema de diseño propio con variables CSS (tipografía IBM Plex Sans/Mono, paleta neutra con un único acento y una escala de certeza).
- **Motivo:** se pidió explícitamente evitar el aspecto de plantilla Bootstrap/dashboard colorido. Las librerías de componentes imponen su estética.
