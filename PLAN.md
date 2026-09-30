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
- [x] Vite + React + TS, router, layout (sidebar, breadcrumbs, búsqueda global)
- [x] Sistema de diseño (tokens, tipografía, componentes)
- [x] `MolPathGateway` con `HttpGateway` y `BrowserDemoGateway`
- [x] Sesión (selector de usuario demo / JWT)

## Fase 6 · Casos y datos clínicos (frontend)
- [x] Listado paginado, creación y edición de casos
- [x] Muestras, histología, IHQ
- [x] Estudios moleculares, variantes, biomarcadores

## Fase 7 · Pizarra Molecular Viva
- [x] Núcleo `buildBoardGraph` (capas caso/conocimiento/razonamiento)
- [x] React Flow + layout dagre, selección, panel de detalle, expandir/colapsar grupos, filtros de capa
- [x] Incertidumbre en nodos y aristas + detección de contradicciones
- [x] Trazabilidad ("Ver fuente") en el panel
- [x] Comentarios sobre nodos desde el panel
- [x] Crear snapshot desde la pizarra (incluye estado del grafo)

## Fase 8 · Evidencias y literatura (frontend)
- [x] Biblioteca de evidencias paginada con filtros
- [x] Consulta CIViC / ClinVar e importación con enlace a variante
- [x] Literatura: importar por PMID, ficha con abstract
- [x] Pathways desde Reactome

## Fase 9 · Timeline y comparación longitudinal
- [x] Vista timeline
- [x] Comparación muestra vs muestra (variantes, VAF, IHQ, muestra, evidencia)

## Fase 10 · Discusión multidisciplinaria
- [x] Hilo por caso y por elemento, edición con historial, feed global

## Fase 11 · Snapshots científicos
- [x] Listado y comparación "qué sabíamos" vs "qué sabemos"

## Fase 12 · Búsqueda, aprendizaje, calidad
- [x] Búsqueda global tipada
- [x] Modo aprendizaje "¿Por qué importa esto?" (contenido educativo)
- [x] Tests de componentes y flujo completo
- [x] Revisión de seguridad y UX
- [x] README y documentación final

> **Verificación fases 5–12:** 21 tests de frontend en verde (dominio, gateway demo y flujo completo UI: caso → muestra → IHQ → estudio → variante → pizarra → snapshot). `tsc` sin errores y build de producción correcto.
>
> **Limitaciones conocidas:** relaciones gen→gen de cascadas pendientes de fuente verificada; OncoKB desactivado por licencia; autenticación con login de desarrollo (IdP real pendiente); en modo demo los datos son locales a cada navegador.

## Fase 13 · Publicación
- [ ] Repositorio en GitHub
- [ ] CI (backend + frontend)
- [ ] GitHub Pages (modo demo)
