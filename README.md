# MolPath Board

> *Del microscopio al gen, y del gen a la evidencia.*

**Herramienta de apoyo informativo y de investigación. No sustituye el juicio clínico profesional.**

MolPath Board es una plataforma web para integrar y visualizar información de anatomía patológica, histología, inmunohistoquímica (IHQ) y biología molecular de tumores. Su núcleo es la **Pizarra Molecular Viva**: una sola experiencia que combina

1. un **grafo molecular interactivo** (caso → muestra → IHQ/estudio → variante → gen → pathway/evidencia → publicación);
2. un **mapa de incertidumbre** (fuerte, moderada, limitada, contradictoria, insuficiente, desconocida — nunca inventada);
3. **trazabilidad científica** completa (fuente, PMID, DOI, URL, versión de la base, fecha de consulta, botón «Ver fuente»);
4. **evolución longitudinal** (timeline y comparación Biopsia 1 vs Biopsia 2);
5. **discusión multidisciplinaria** sobre cualquier elemento, con historial de ediciones;
6. **snapshots científicos** inmutables y verificables (SHA-256) para comparar «qué sabíamos» con «qué sabemos».

MolPath **no** diagnostica, **no** recomienda tratamientos y **no** inventa evidencia ni PMIDs. En esta fase sólo trabaja con **casos ficticios**.

---

## Arquitectura

```
┌──────────── navegador ────────────┐        ┌──────── backend ────────┐
│ React + TS (Vite)                  │  REST  │ Spring Boot 4.1 · Java  │──► PostgreSQL 17 (Flyway)
│  ├─ src/domain  (núcleo puro)      │◄──────►│  JWT · OpenAPI          │
│  └─ MolPathGateway                 │  JWT   │  proveedores externos ──┼──► NCBI (PubMed, ClinVar, Gene)
│       ├─ HttpGateway   (modo api)  │        └─────────────────────────┘    CIViC · Reactome · OncoKB (off)
│       └─ BrowserDemoGateway (demo)─┼──────── CORS directo a las mismas APIs oficiales
└────────────────────────────────────┘
```

- **Modo `api`**: frontend + backend + PostgreSQL (Docker Compose o local). Es el modo de referencia.
- **Modo `demo`**: todo en el navegador con el dataset ficticio (así se publica en GitHub Pages). Mismas reglas de negocio; los datos viven en el `localStorage` de cada dispositivo.

Detalle en [ARCHITECTURE.md](ARCHITECTURE.md) · modelo de datos en [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) · decisiones en [DECISIONS.md](DECISIONS.md) · fases en [PLAN.md](PLAN.md).

## Requisitos

| Uso | Necesita |
|---|---|
| Frontend (demo o api) | Node.js ≥ 20.19 (recomendado 22) |
| Backend | JDK 21+ (probado con Temurin 25). Maven **no** es necesario: se usa `./mvnw` |
| Base de datos | PostgreSQL 17 **o** nada: el perfil de desarrollo arranca un PostgreSQL embebido |
| Todo junto | Docker + Docker Compose |

## Instalación y ejecución

### Opción A · Docker Compose (todo)

```bash
cp .env.example .env          # ajuste contraseñas y MOLPATH_JWT_SECRET (≥ 32 bytes)
docker compose up --build
```

- Frontend: http://localhost:8081
- API: http://localhost:8080 · Swagger UI: http://localhost:8080/swagger-ui.html

### Opción B · Local sin Docker

```bash
# Backend con PostgreSQL embebido persistente (backend/.data/pg), login de desarrollo y dataset demo
cd backend
./mvnw spring-boot:test-run            # Windows: mvnw.cmd spring-boot:test-run

# Frontend conectado al backend
cd frontend
npm install
npm run dev                            # http://localhost:5173
```

Contra un PostgreSQL propio: exporte las variables de `.env.example` y ejecute `./mvnw spring-boot:run`.

### Opción C · Sólo el frontend en modo demo

```bash
cd frontend && npm install && npm run dev:demo
```

## Variables de entorno

| Variable | Descripción | Por defecto |
|---|---|---|
| `SPRING_DATASOURCE_URL` / `_USERNAME` / `_PASSWORD` | Conexión PostgreSQL | `jdbc:postgresql://localhost:5432/molpath` |
| `MOLPATH_JWT_SECRET` | Secreto HS256 (≥ 32 bytes). **Obligatorio** | — |
| `MOLPATH_JWT_TTL_MINUTES` | Validez del token | `480` |
| `MOLPATH_DEV_LOGIN_ENABLED` | Selector de usuarios demo. Desactivar en producción | `false` |
| `MOLPATH_DEMO_SEED` | Siembra el dataset ficticio si la BD está vacía | `false` |
| `MOLPATH_CORS_ORIGINS` | Orígenes permitidos (coma) | `http://localhost:5173` |
| `NCBI_API_KEY` / `NCBI_CONTACT_EMAIL` | Opcionales para NCBI E-utilities | — |
| `MOLPATH_ONCOKB_ENABLED` | OncoKB (desactivado, ver ADR-012) | `false` |
| `VITE_DATA_MODE` | Frontend: `api` o `demo` | `api` (`demo` con `--mode demo/pages`) |
| `VITE_API_BASE_URL` | Frontend: URL del backend | `http://localhost:8080` |

Nunca se guardan claves en el código: `.env` está en `.gitignore`.

## Pruebas

```bash
cd backend && ./mvnw test      # 59 tests: unitarios, parsers con fixtures reales, API contra PostgreSQL embebido
cd frontend && npm test        # 21 tests: dominio, gateway demo y flujo completo en la UI
```

El flujo exigido — crear caso → muestra → IHQ → estudio molecular → variante → verla en la pizarra → crear snapshot — está cubierto en ambos lados (`ClinicalFlowApiTest` y `src/app/flow.test.tsx`).

## APIs

Documentación interactiva en `/swagger-ui.html` (OpenAPI en `/v3/api-docs`). Resumen:

| Área | Endpoints principales |
|---|---|
| Auth | `GET /api/auth/dev-users`, `POST /api/auth/dev-login`, `GET /api/auth/me` |
| Casos | `GET/POST /api/cases`, `GET/PUT /api/cases/{id}`, `GET /api/cases/{id}/board` |
| Muestras / IHQ | `GET/POST /api/cases/{id}/samples`, `PUT /api/samples/{id}`, `POST /api/samples/{id}/histology`, `POST /api/samples/{id}/ihc`, `PUT/DELETE /api/ihc/{id}` |
| Molecular | `POST /api/samples/{id}/molecular-tests`, `POST /api/molecular-tests/{id}/variants`, `PUT /api/variants/{id}`, `POST /api/molecular-tests/{id}/biomarkers`, `GET /api/cases/{id}/variants` |
| Evidencia | `GET/POST /api/evidence`, `GET /api/evidence/{id}`, `GET /api/evidence/{id}/history`, `PUT /api/evidence/{id}/classification`, `GET /api/cases/{id}/evidence`, `POST/DELETE /api/variants/{id}/evidence-links[/{evidenceId}]` |
| Literatura / genes | `GET /api/publications`, `GET /api/publications/{pmid}`, `POST /api/publications/import`, `GET /api/genes/{symbol}` |
| Fuentes externas | `GET /api/external/providers`, `GET /api/external/evidence`, `POST /api/external/evidence/import`, `GET /api/external/clinvar`, `POST /api/external/clinvar/import`, `GET /api/external/pathways`, `POST /api/external/pathways/import` |
| Evolución y razonamiento | `GET /api/cases/{id}/timeline`, `POST /api/cases/{id}/timeline-events`, `GET/POST /api/cases/{id}/interpretations` |
| Discusión | `GET /api/comments`, `POST /api/cases/{id}/comments`, `PUT /api/comments/{id}`, `GET /api/comments/{id}/revisions` |
| Snapshots | `GET/POST /api/cases/{id}/snapshots`, `GET /api/snapshots`, `GET /api/snapshots/{id}` |
| Búsqueda / panel | `GET /api/search?q=`, `GET /api/dashboard` |

## Estructura del proyecto

```
├── backend/                 Spring Boot (paquetes por módulo: casefile, sample, molecular, knowledge,
│   │                        provider, board, timeline, interpretation, discussion, snapshot, search…)
│   ├── src/main/resources/db/migration   migraciones Flyway
│   └── src/test/…           tests + fixtures reales (PubMed, CIViC, ClinVar)
├── frontend/
│   └── src/
│       ├── domain/          núcleo puro: grafo, incertidumbre, comparación longitudinal, diff de snapshots
│       ├── data/            MolPathGateway (HTTP y demo) + clientes de fuentes externas
│       ├── features/        páginas: dashboard, cases, board, timeline, evidence, literature,
│       │                    discussion, snapshots, search, settings, learn
│       ├── education/       contenido educativo «¿Por qué importa esto?»
│       └── styles/          sistema de diseño (tokens claro/oscuro)
├── demo-data/               dataset ficticio compartido por backend y frontend
├── docker-compose.yml, .env.example
└── .github/workflows/       CI (tests) y despliegue en GitHub Pages
```

## Datos de demostración

`demo-data/demo-dataset.json` contiene tres casos **ficticios** (DEMO-001 pulmón, DEMO-002 longitudinal con dos biopsias, DEMO-003 colon). Los registros científicos que incluye (evidencias CIViC EID347/EID397/EID7530, publicaciones PubMed, genes NCBI, pathways Reactome v97) son **reales**, se consultaron en las fuentes oficiales el 30-09-2026 y conservan su procedencia. No se usan evidencias terapéuticas en la demo.

## Cambiar el nombre del producto

`frontend/src/config/brand.ts` (interfaz) y `molpath.app.name` en `backend/src/main/resources/application.yml` (OpenAPI).

## Licencias de fuentes

CIViC (CC0), Reactome (CC BY 4.0, requiere atribución), NCBI (políticas de uso de E-utilities). OncoKB **no** está integrado hasta revisar su licencia (ADR-012).
