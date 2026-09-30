# UX Changelog — rediseño "enseñar el tumor"

Objetivo: reducir la carga cognitiva para que, al abrir un caso, se entienda en segundos el flujo
**tumor → muestra → patología → molecular → variantes → vías → evidencia → incertidumbre → evolución**.
No se cambió stack, API, modelo de datos ni rutas existentes; se añadió la ruta `/cases/:id/present`.

## Qué cambió y por qué

| Cambio | Por qué | Archivos |
|---|---|---|
| **Resumen molecular del caso** (`MolecularCaseSummary`): muestra principal, % tumoral, histología, IHQ, variantes con VAF, evidencia por certeza, contradicciones, interpretación vigente, última actualización científica y último snapshot | Responder las 10 preguntas clave antes de leer tablas | `features/cases/MolecularCaseSummary.tsx`, `domain/caseInsights.ts` |
| **Qué cambió** (`CaseChangesSummary`): diff real contra el snapshot elegido (por defecto el último) | Mostrar evolución del conocimiento sin inventar cambios; no hay registro de "última visita", por eso se compara con snapshots | `features/cases/insightPanels.tsx`, `domain/snapshotDiff.ts` |
| **Preguntas abiertas** (`OpenQuestionsPanel`): variantes sin evidencia, muestras sin % tumoral o sin estudio, VAF cerca del LoD, contradicciones, evidencia sin enlace de fuente, evidencia no vigente, versiones antiguas de fuentes, genes sin metadatos | Señalar huecos objetivos. Etiqueta fija «Observación del sistema»; sin recomendaciones | `domain/caseInsights.ts#openQuestions` |
| **Pizarra: Ruta principal / Ver todo** | Progressive disclosure: primero caso → muestra principal → histología → estudio → variantes → gen → pathway → evidencia más sólida; «Mostrar relaciones secundarias» abre el resto | `domain/caseInsights.ts#mainPathIds`, `features/board/BoardPage.tsx` |
| **Focus Mode** («Enfocar» / «Salir de enfoque», tecla F / Esc) | Aislar un nodo con sus ancestros, padres e hijos; el resto se atenúa (no se elimina) | `domain/caseInsights.ts#focusIds`, `BoardPage.tsx` |
| **Leyenda en menús** («Capas ▾», «Certeza ▾», «Grupos ▾») | Menos conceptos simultáneos en pantalla, sobre todo en móvil | `BoardPage.tsx`, `components/scientific.tsx#Menu` |
| **Detalle según zoom** (lejos: título; medio: resumen; cerca: transcrito, HGVS c., cobertura, PMID, versión) | Legibilidad a cualquier escala sin re-render por nodo (zoom en tramos + CSS) | `BoardNodeView.tsx`, `domain/boardGraph.ts` (`extra`) |
| **Bottom sheet móvil** (minimizado / media altura / expandido / cerrado; arrastre, botones con nombre accesible, Esc, flechas) | En teléfono el detalle queda junto al grafo, no debajo | `features/board/BoardBottomSheet.tsx` |
| **Explicar esta ruta** | Explicación determinista que verbaliza sólo datos presentes (sin IA) | `domain/caseInsights.ts#explainNode`, `NodePanel.tsx` |
| **Evidencia primero como resumen** (`EvidenceSummary`: certeza, tipos, fuentes, publicaciones, contradicciones) | Ver el panorama antes que los PMIDs | `components/scientific.tsx`, `NodePanel.tsx`, `EvidencePage.tsx` |
| **Origen del dato** (`DataOriginBadge`): Caso (persona, rectángulo sólido), Fuente (globo, discontinuo), Interpretación (pluma, redondeado) | Diferenciar sin depender del color | `components/scientific.tsx`, nodos, panel, resumen |
| **Incertidumbre accesible**: ● fuerte · ◐ moderada · △ limitada · ⇄ contradictoria · ○ insuficiente · ? desconocida (símbolo + texto + color) | Accesibilidad para daltonismo e impresión en gris. ⇄ representa direcciones opuestas entre fuentes | `domain/labels.ts#CERTAINTY_SYMBOL`, `CertaintyBadge`, nodos |
| **Timeline visual** agrupada por mes, con marca de variantes nuevas por estudio | Percibir la evolución temporal | `features/timeline/TimelinePage.tsx`, `domain/caseInsights.ts#newVariantsByTest` |
| **Evolución de VAF** con pasos y sparkline | Trayectoria compacta de variantes presentes en ≥ 2 muestras | `variantEvolution`, `components/scientific.tsx#Sparkline` |
| **Modo presentación** (`/cases/:id/present`): Resumen · Patología · Muestra · Molecular · Pizarra · Evidencia · Preguntas abiertas; ← → para navegar; «Salir de presentación» | Reuniones de Molecular Tumor Board en monitor, proyector o tablet; sin sidebar ni formularios | `features/present/PresentationPage.tsx` |
| **Navegación móvil del caso**: Resumen · Pizarra · Timeline · Más | Evitar la fila interminable de pestañas | `app/Layout.tsx#CaseTabs` |
| **Tablas responsive** (`ResponsiveTable`): tabla en escritorio, tarjetas en móvil con la misma definición de columnas | Sin scroll horizontal eterno y sin duplicar lógica | IHQ, variantes, evidencias, presentación |
| **Acciones rápidas** (menús): variante (copiar HGVS/gen, enfocar, fuentes, evidencias del gen), publicación (copiar PMID, PubMed, DOI), muestra (enfocar, ver estudios, comparar) | Acciones frecuentes sin llenar la interfaz de botones | `features/cases/QuickActions.tsx` |
| **Estados vacíos útiles** con acción siguiente | Guiar al usuario en lugar de "No hay resultados" | `components/scientific.tsx#EmptyState` |
| **«¿Por qué importa?»** ampliado (cobertura, driver, evidencia, snapshot, NGS/FISH, CNV, fusión…) | Contenido educativo contextual, separado de la interpretación | `education/glossary.ts` |
| **Atajos**: `/` buscar · `?` atajos · `P` presentar · `F` enfocar · `R` ruta/todo · `Esc` salir · `←` `→` presentación | Velocidad en escritorio; nunca se activan mientras se escribe | `hooks/useShortcuts.ts`, `app/ShortcutsDialog.tsx` |
| **Targets táctiles** ≥ 44px en móvil y con puntero grueso; inputs a 16px (sin zoom automático en iOS) | Uso cómodo en teléfono y tablet | `styles/redesign.css` |

## Comportamiento por dispositivo

**Escritorio (≥ 1280px):** grafo protagonista + panel lateral de 400–440px; resumen del caso en 4 columnas; minimapa; leyenda en menús; atajos de teclado.

**Tablet / portátil pequeño (861–1279px):** panel lateral de 340px; resumen en 2 columnas.

**Móvil (≤ 860px):** sidebar en cajón; navegación de caso de 4 entradas; pizarra casi a pantalla completa sin minimapa; detalle en bottom sheet; «Lista de nodos» accesible; tablas convertidas en tarjetas; controles ≥ 44px.

## Decisiones UX

- La **ruta principal** es la vista por defecto; si se llega a un nodo que no está en ella (búsqueda, enlace), se pasa automáticamente a «Ver todo».
- El **enfoque atenúa** en lugar de ocultar, para no perder el contexto espacial.
- La **muestra principal** es la más reciente con fecha: es la que mejor representa "el tumor ahora".
- «Qué cambió» usa **snapshots** porque no existe registro fiable de la última visita de cada usuario.
- Ninguna vista nueva genera conclusiones clínicas: las explicaciones y observaciones son plantillas deterministas sobre datos registrados.

## Verificación

- `npm run typecheck` sin errores; `npm test`: **34 tests** (antes 21), incluidos pizarra (ruta/todo, enfoque, explicar ruta), bottom sheet móvil, presentación y el flujo completo original.
- `npm run build` correcto; la pizarra y la presentación se cargan bajo demanda.
- No existe script de lint en el proyecto; el typecheck estricto (`noUnused*`, `strict`) actúa como control estático.
- Limitación: la verificación de anchos (320–1920px) se hizo por diseño de CSS y tests jsdom con `matchMedia` simulado, no con capturas en navegadores reales.
