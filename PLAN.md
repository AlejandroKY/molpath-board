# Plan de implementación — MolPath Board

Leyenda: `[x]` hecho y verificado con pruebas · `[~]` parcial / con limitación documentada · `[ ]` pendiente.

Orden ajustado respecto a la propuesta original (ver ADR-015): las entidades clínicas del backend (fases 2, 4 y 5 originales) forman un único agregado y se implementan juntas; el frontend se construye después sobre una API estable.

## Fase 1 · Arquitectura y configuración
- [x] Análisis del repositorio (vacío) y del entorno (sin Java/Docker → JDK y Maven portables)
- [x] Verificación en vivo de APIs externas (NCBI, CIViC, Reactome) y CORS
- [x] `ARCHITECTURE.md`, `DECISIONS.md`, `DATABASE_SCHEMA.md`, `PLAN.md`
- [x] Estructura monorepo `backend/`, `frontend/`, `demo-data/`
- [x] Dataset demo compartido (casos ficticios + registros científicos reales con procedencia)
- [x] Docker Compose, `.env.example`, `.gitignore`

## Fase 2 · Base de datos y backend núcleo clínico
- [x] Proyecto Spring Boot 4.1 + Maven Wrapper
- [x] Migración Flyway V1 (esquema completo)
- [x] Entidades JPA y repositorios
- [x] Manejo global de errores (ProblemDetail), validación, sanitización
- [x] Seguridad JWT + login de desarrollo + CORS + roles
- [x] CRUD de casos, muestras, histología, IHQ, estudios, variantes, biomarcadores
- [x] Agregado `CaseBoard`
- [x] Siembra del dataset demo
- [x] OpenAPI / Swagger
- [x] Tests (unitarios, servicios, API) con PostgreSQL embebido

## Fase 3 · Evidencias, literatura y proveedores
- [x] Evidencias manuales con certeza/base obligatoria
- [x] Enlaces variante↔evidencia
- [x] PubMedProvider (PMID → metadata, abstract, DOI)
- [x] CivicProvider + mapeo de certeza documentado
- [x] ClinVarProvider (germinal / somático separados)
- [x] ReactomeProvider (gen → pathways)
- [x] OncoKbProvider desactivado (licencia)
- [x] Tests de parsers y mapeos

## Fase 4 · Timeline, interpretación, discusión, snapshots, búsqueda, dashboard (backend)
- [x] Timeline (eventos explícitos + derivados)
- [x] Interpretaciones con sustitución versionada
- [x] Comentarios con revisiones
- [x] Snapshots inmutables con SHA-256
- [x] Clasificador de consultas y búsqueda tipada
- [x] Dashboard
- [x] Auditoría
- [x] Tests

> **Verificación fases 1–4:** 59 tests de backend en verde (unitarios, parsers con fixtures reales, API contra PostgreSQL embebido). Prueba de humo en vivo contra CIViC, ClinVar, Reactome y PubMed superada.

## Fase 5 · Frontend base
- [ ] Vite + React + TS, router, layout (sidebar, breadcrumbs, búsqueda global)
- [ ] Sistema de diseño (tokens, tipografía, componentes)
- [ ] `MolPathGateway` con `HttpGateway` y `BrowserDemoGateway`
- [ ] Sesión (selector de usuario demo / JWT)

## Fase 6 · Casos y datos clínicos (frontend)
- [ ] Listado paginado, creación y edición de casos
- [ ] Muestras, histología, IHQ
- [ ] Estudios moleculares, variantes, biomarcadores

## Fase 7 · Pizarra Molecular Viva
- [ ] Núcleo `buildBoardGraph` (capas caso/conocimiento/razonamiento)
- [ ] React Flow + layout dagre, selección, panel de detalle, expandir/colapsar grupos, filtros de capa
- [ ] Incertidumbre en nodos y aristas + detección de contradicciones
- [ ] Trazabilidad ("Ver fuente") en el panel
- [ ] Comentarios sobre nodos desde el panel
- [ ] Crear snapshot desde la pizarra (incluye estado del grafo)

## Fase 8 · Evidencias y literatura (frontend)
- [ ] Biblioteca de evidencias paginada con filtros
- [ ] Consulta CIViC / ClinVar e importación con enlace a variante
- [ ] Literatura: importar por PMID, ficha con abstract
- [ ] Pathways desde Reactome

## Fase 9 · Timeline y comparación longitudinal
- [ ] Vista timeline
- [ ] Comparación muestra vs muestra (variantes, VAF, IHQ, muestra, evidencia)

## Fase 10 · Discusión multidisciplinaria
- [ ] Hilo por caso y por elemento, edición con historial, feed global

## Fase 11 · Snapshots científicos
- [ ] Listado y comparación "qué sabíamos" vs "qué sabemos"

## Fase 12 · Búsqueda, aprendizaje, calidad
- [ ] Búsqueda global tipada
- [ ] Modo aprendizaje "¿Por qué importa esto?" (contenido educativo)
- [ ] Tests de componentes y flujo completo
- [ ] Revisión de seguridad y UX
- [ ] README y documentación final

## Fase 13 · Publicación
- [ ] Repositorio en GitHub
- [ ] CI (backend + frontend)
- [ ] GitHub Pages (modo demo)
