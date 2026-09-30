# UX Redesign Plan — MolPath Board

**Principio:** *enseñarle al usuario el tumor*. Reducir la carga cognitiva para que al abrir un caso se entienda en segundos:
tumor → muestra → patología → biología molecular → variantes → vías → evidencia → incertidumbre → evolución.

Restricciones: no se cambia stack, arquitectura, API, modelo de datos ni rutas existentes; no se eliminan funcionalidades; no se inventan datos, relaciones ni certezas; no se generan recomendaciones clínicas.

## 1. Auditoría del estado actual

| Área | Componentes actuales | Problemas detectados |
|---|---|---|
| Vista de caso | `CaseDetailPage` (tarjeta de caso + interpretaciones + `SampleCard` + `TestBlock`) | El usuario tiene que leer tablas antes de entender el caso. No hay resumen: tumor, muestra principal, IHQ, variantes y evidencia están dispersos. |
| Pizarra | `BoardPage` (`Board`, `Legend`, `Outline`, `SnapshotDialog`), `BoardNodeView`, `NodePanel`, `domain/boardGraph` | Se muestra todo el grafo desde el inicio (ruido). La leyenda enseña 9 conceptos a la vez. No hay forma de aislar un nodo y su contexto. Nodos con la misma densidad a cualquier zoom. |
| Pizarra móvil | Media query `≤1100px` apila el panel bajo el grafo | El detalle queda fuera de la vista al tocar un nodo; la experiencia es "escritorio apilado". |
| Navegación de caso | `CaseTabs` (5 pestañas horizontales) | En móvil se convierte en una fila con desplazamiento horizontal. |
| Tablas | `table.data` en IHQ, variantes, evidencias, casos | En móvil sólo scroll horizontal. |
| Controles táctiles | `.btn.small` (≈26px), checkboxes nativas, cierre de diálogo | Por debajo de 44px; texto de acciones de 11–12px. |
| Incertidumbre | `CertaintyBadge`, trazos de arista | Depende sobre todo del color (el badge sí tiene texto; el nodo y la arista no tienen símbolo). |
| Origen del dato | Badges `layer-*` sólo por color y texto variable | No hay iconografía ni texto consistente "Caso / Fuente / Interpretación". |
| Evidencia | `EvidenceCard`, listas | Se muestran registros individuales antes que un resumen por certeza, tipo y fuente. |
| Timeline | `TimelinePage` (lista + comparación tabular) | No se percibe como evolución temporal; no muestra la trayectoria de VAF. |
| Cambios | `SnapshotComparePage` | Sólo accesible desde la lista de snapshots; no hay "qué cambió" en el caso. |
| Reuniones (MTB) | — | No existe modo presentación. |
| Estados vacíos | `Empty` genérico | Mensajes sin acción siguiente. |

## 2. Soluciones y componentes

Se reutiliza todo lo existente (gateway, React Query, `boardGraph`, `sampleCompare`, `snapshotDiff`, `knowledgeComponents`, formularios). La lógica nueva es **pura y testeada** en `src/domain/`; los componentes sólo la presentan.

| Nuevo | Tipo | Resuelve |
|---|---|---|
| `domain/caseInsights.ts` | Lógica pura | Resumen del caso, muestra principal, ruta principal, conjunto de enfoque, preguntas abiertas, explicación de ruta, evolución de VAF, resumen de evidencia, anotaciones de timeline |
| `MolecularCaseSummary` | Componente | Entender el caso en segundos (P0) |
| `DataOriginBadge` | Componente | Caso / Fuente / Interpretación con icono + texto (P1) |
| `CertaintyBadge` (mejorado) + `CERTAINTY_SYMBOL` | Componente | Incertidumbre con símbolo + texto + color (P1) |
| `EvidenceSummary` | Componente | Resumen antes que registros (P1) |
| `BoardWorkspace` | Componente | Pizarra reutilizable en página y en presentación |
| `BoardLegendMenu` | Componente | Leyenda como menús «Capas ▾» y «Certeza ▾» (P1) |
| `BoardBottomSheet` | Componente | Detalle del nodo en móvil: minimizado / media altura / expandido / cerrado (P0) |
| Ruta principal / Ver todo | Estado de vista + `mainPathIds` | Progressive disclosure (P0) |
| Focus Mode | Estado + `focusIds` | Enfocar un nodo y atenuar lo no relacionado (P0) |
| Detalle según zoom | CSS por nivel de zoom de React Flow | Nodos mínimos lejos, detallados cerca (P2) |
| `MobileCaseNavigation` (dentro de `CaseTabs`) | Componente | Resumen · Pizarra · Timeline · Más (P0) |
| `ResponsiveTable` | Componente | Tabla en escritorio, tarjetas en móvil sin duplicar lógica (P0) |
| `TimelineVisual` + `VariantEvolution` | Componentes | Evolución temporal y sparkline de VAF (P1) |
| `CaseChangesSummary` | Componente | «Desde el último snapshot» con `diffBoards` (P1) |
| `OpenQuestionsPanel` | Componente | Observaciones del sistema, separadas de la interpretación clínica (P1) |
| `PresentationMode` | Ruta `/cases/:id/present` | Molecular Tumor Board (P1) |
| `ExplainPath` | Componente | Explicación determinista desde datos estructurados (P1) |
| `QuickActions` | Menú contextual | Copiar HGVS/gen/PMID, enfocar, fuentes, comparar (P2) |
| `useShortcuts` + `ShortcutsDialog` | Hook | F, Esc, /, P, ? (P2) |
| `useMediaQuery` | Hook | Experiencias distintas por dispositivo |

## 3. Prioridades y orden

1. Auditoría + este plan.
2. `MolecularCaseSummary` (+ lógica pura y tests).
3. Pizarra de escritorio refinada (workspace, leyenda en menús, jerarquía).
4. Pizarra móvil con bottom sheet.
5. Ruta principal + Focus Mode.
6. Navegación móvil + tablas/tarjetas + targets táctiles.
7. `EvidenceSummary` + incertidumbre accesible + origen del dato.
8. Timeline visual + evolución de VAF.
9. `CaseChangesSummary` + preguntas abiertas.
10. Modo presentación.
11. «¿Por qué importa?» ampliado + «Explicar esta ruta» + acciones rápidas + atajos.
12. Accesibilidad, responsive, QA, documentación.

## 4. Estrategia responsive

| Rango | Comportamiento |
|---|---|
| ≥ 1280px | Pizarra con grafo protagonista + panel lateral de 400px; resumen del caso en cuadrícula de 4 columnas. |
| 861–1279px | Panel lateral más estrecho (340px); resumen en 2–3 columnas. |
| ≤ 860px (móvil/tablet vertical) | Sidebar en cajón; navegación de caso compacta (3 + «Más»); pizarra a pantalla casi completa con **bottom sheet**; tablas → tarjetas; controles ≥ 44px. |
| `pointer: coarse` | Targets táctiles ≥ 44px independientemente del ancho (tablets). |

Anchos verificados: 320, 360, 390, 430, 768, 1280, 1440, 1920. Regla: ningún contenedor puede provocar overflow horizontal del documento (`min-width: 0` en grids/flex, `overflow-wrap: anywhere` en identificadores largos).

## 5. Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Romper el flujo existente (tests de UI) | Mantener rutas, nombres accesibles y botones existentes; ampliar la suite. |
| Duplicar lógica entre escritorio y móvil | Un solo `NodePanel`; el bottom sheet sólo cambia el contenedor. `ResponsiveTable` usa las mismas columnas para tabla y tarjetas. |
| Rendimiento del grafo (cientos de nodos) | Ruta principal por defecto; detalle por zoom con CSS (sin re-render por nodo); selector de zoom en *buckets*. |
| "Preguntas abiertas" percibidas como consejo clínico | Etiqueta fija «Observación del sistema», reglas objetivas documentadas y sin verbos prescriptivos. |
| Explicación de ruta que invente | Plantillas deterministas que sólo verbalizan campos presentes; si falta un dato se omite la frase. |
| Atajos que interfieren con formularios | Ignorados cuando el foco está en `input`, `textarea`, `select` o `contenteditable`. |
