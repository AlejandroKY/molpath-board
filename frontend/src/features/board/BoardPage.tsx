import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Background, Controls, MiniMap, ReactFlow, ReactFlowProvider, useReactFlow, useStore, type Edge } from '@xyflow/react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CaseTabs } from '../../app/Layout';
import { BRAND } from '../../config/brand';
import { Icon } from '../../components/Icon';
import { CertaintyGlyph, DataOriginBadge, Menu } from '../../components/scientific';
import { Dialog, ErrorBox, Field, Loading, PageHead } from '../../components/ui';
import { useGateway } from '../../data/GatewayProvider';
import { WhyItMatters } from '../../education/WhyItMatters';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useShortcuts } from '../../hooks/useShortcuts';
import { KIND_LABEL, buildBoardGraph, defaultGraphState, visibleGraph, type BoardEdge, type BoardGraph } from '../../domain/boardGraph';
import { focusIds, mainPathIds } from '../../domain/caseInsights';
import { CERTAINTY_LABEL, CERTAINTY_ORDER, CERTAINTY_SHORT } from '../../domain/labels';
import type { CaseBoard, Certainty, GraphState } from '../../domain/types';
import { useCaseBoard } from '../cases/useCaseBoard';
import { BoardBottomSheet, type SheetState } from './BoardBottomSheet';
import { MpNode, type MpFlowNode } from './BoardNodeView';
import { layoutGraph } from './layout';
import { NodePanel, type PanelTab } from './NodePanel';

const nodeTypes = { mp: MpNode };

const CERTAINTY_STROKE: Record<Certainty, { color: string; width: number; dash?: string }> = {
  STRONG: { color: 'var(--c-strong)', width: 3 },
  MODERATE: { color: 'var(--c-moderate)', width: 2 },
  LIMITED: { color: 'var(--c-limited)', width: 2, dash: '7 4' },
  CONTRADICTORY: { color: 'var(--c-contradictory)', width: 2.5, dash: '8 3 2 3' },
  INSUFFICIENT: { color: 'var(--c-insufficient)', width: 1.6, dash: '2 4' },
  UNKNOWN: { color: 'var(--c-unknown)', width: 1.4, dash: '1 4' },
};

function edgeStyle(e: BoardEdge): Edge['style'] {
  if (e.kind === 'evidence' && e.certainty) {
    const s = CERTAINTY_STROKE[e.certainty];
    return { stroke: s.color, strokeWidth: s.width, strokeDasharray: s.dash };
  }
  if (e.kind === 'membership') return { stroke: 'var(--layer-knowledge)', strokeWidth: 1.3, strokeDasharray: '5 4' };
  if (e.kind === 'citation') return { stroke: 'var(--layer-knowledge)', strokeWidth: 1.2, strokeDasharray: '1 3' };
  if (e.kind === 'reasoning') return { stroke: 'var(--layer-reasoning)', strokeWidth: 1.5, strokeDasharray: '4 3' };
  return { stroke: 'var(--line-strong)', strokeWidth: 1.3 };
}

export type ViewMode = 'main' | 'all';

export default function BoardPage() {
  const { caseId } = useParams();
  const board = useCaseBoard(caseId);
  if (board.isLoading) return <Loading label="Construyendo la pizarra…" />;
  if (!board.data) return <ErrorBox error={board.error} />;
  const c = board.data.caseRecord;
  return (
    <>
      <PageHead
        title={`${BRAND.boardName} · ${c.caseCode}`}
        sub={`${c.tumorType} · la pizarra organiza información y fuentes; no genera diagnósticos ni recomendaciones.`}
        crumbs={[{ to: '/cases', label: 'Casos' }, { to: `/cases/${c.id}`, label: c.caseCode }, { label: 'Pizarra' }]}
        actions={<Link className="btn" to={`/cases/${c.id}/present`}><Icon name="present" /> Presentar</Link>}
      />
      <CaseTabs caseId={c.id} />
      <ReactFlowProvider>
        <BoardWorkspace board={board.data} />
      </ReactFlowProvider>
    </>
  );
}

/** Nivel de zoom en tramos (evita re-render por cada píxel de zoom). */
function useZoomBucket() {
  return useStore((s) => (s.transform[2] < 0.6 ? 'far' : s.transform[2] > 1.15 ? 'near' : 'mid'));
}

export function BoardWorkspace({ board, readOnly }: { board: CaseBoard; readOnly?: boolean }) {
  const graph = useMemo(() => buildBoardGraph(board), [board]);
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('node');
  const [state, setState] = useState<GraphState>(() => defaultGraphState(graph));
  const [mode, setMode] = useState<ViewMode>('main');
  const [focusId, setFocusId] = useState<string | null>(() => (params.get('focus') === '1' ? params.get('node') : null));
  const [sheet, setSheet] = useState<SheetState>('half');
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const isMobile = useIsMobile();
  const flow = useReactFlow();
  const zoom = useZoomBucket();
  const initialTab = (params.get('tab') as PanelTab | null) ?? 'detail';

  const mainIds = useMemo(() => mainPathIds(graph, board), [graph, board]);
  const visible = useMemo(() => {
    if (mode === 'all') return visibleGraph(graph, state);
    const layerOn = (layer: string) => layer === 'case' || (layer === 'knowledge' ? state.layers.knowledge : state.layers.reasoning);
    const nodes = graph.nodes.filter((n) => mainIds.has(n.id) && layerOn(n.layer));
    const ids = new Set(nodes.map((n) => n.id));
    return { nodes, edges: graph.edges.filter((e) => ids.has(e.source) && ids.has(e.target)), hiddenDescendants: {} as Record<string, number> };
  }, [mode, graph, state, mainIds]);
  const positions = useMemo(() => layoutGraph(visible.nodes, visible.edges), [visible]);
  const focusSet = useMemo(() => (focusId ? focusIds(graph, focusId) : null), [graph, focusId]);

  // Un nodo seleccionado fuera de la vista actual (búsqueda, enlaces) se hace visible.
  useEffect(() => {
    if (selectedId && graph.nodes.some((n) => n.id === selectedId) && !visible.nodes.some((n) => n.id === selectedId)) {
      setMode('all');
      setState({ collapsed: [], layers: { knowledge: true, reasoning: true } });
    }
  }, [selectedId, graph, visible]);

  useEffect(() => {
    const t = setTimeout(() => flow.fitView({ padding: 0.12, duration: 250, nodes: focusSet ? [...focusSet].map((id) => ({ id })) : undefined }), 60);
    return () => clearTimeout(t);
  }, [visible.nodes.length, focusSet, flow]);

  const select = (id: string | null) => {
    const next = new URLSearchParams(params);
    next.delete('tab');
    if (id) next.set('node', id);
    else next.delete('node');
    setParams(next, { replace: true });
    if (id && isMobile) setSheet((s) => (s === 'full' ? 'full' : 'half'));
  };
  const toggleFocus = (id: string | null = selectedId) => setFocusId((f) => (f && (!id || f === id) ? null : id));
  const toggleCollapse = (id: string) =>
    setState((s) => ({ ...s, collapsed: s.collapsed.includes(id) ? s.collapsed.filter((x) => x !== id) : [...s.collapsed, id] }));

  useShortcuts({
    f: () => selectedId && toggleFocus(selectedId),
    r: () => setMode((m) => (m === 'main' ? 'all' : 'main')),
    Escape: () => (focusId ? setFocusId(null) : select(null)),
  });

  const rfNodes: MpFlowNode[] = visible.nodes.map((n) => ({
    id: n.id,
    type: 'mp',
    position: positions.get(n.id) ?? { x: 0, y: 0 },
    data: { node: n, hidden: visible.hiddenDescendants[n.id] ?? 0, collapsed: state.collapsed.includes(n.id), focused: n.id === focusId },
    selected: n.id === selectedId,
    className: focusSet && !focusSet.has(n.id) ? 'dimmed' : undefined,
  }));
  const rfEdges: Edge[] = visible.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    style: edgeStyle(e),
    className: focusSet && !(focusSet.has(e.source) && focusSet.has(e.target)) ? 'dimmed' : undefined,
    label: zoom === 'far' ? undefined : e.label ?? undefined,
    labelStyle: { fontSize: 10, fill: 'var(--ink-3)' },
    labelBgStyle: { fill: 'var(--surface)' },
  }));
  const selected = graph.nodes.find((n) => n.id === selectedId) ?? null;
  const focusNode = graph.nodes.find((n) => n.id === focusId);

  const panel = selected ? (
    <NodePanel
      key={selected.id}
      board={board}
      graph={graph}
      node={selected}
      collapsed={state.collapsed.includes(selected.id)}
      hiddenCount={visible.hiddenDescendants[selected.id] ?? 0}
      onToggle={() => { setMode('all'); toggleCollapse(selected.id); }}
      onSelect={select}
      focused={focusId === selected.id}
      onFocus={() => toggleFocus(selected.id)}
      initialTab={initialTab}
      readOnly={readOnly}
    />
  ) : (
    <Outline graph={graph} visibleIds={new Set(visible.nodes.map((n) => n.id))} onSelect={(id) => { setOutlineOpen(false); select(id); }} />
  );

  return (
    <div className="board-shell">
      <div className="board-bar" role="toolbar" aria-label="Controles de la pizarra">
        <div className="segmented" role="group" aria-label="Vista del grafo">
          <button aria-pressed={mode === 'main'} onClick={() => setMode('main')} title="Atajo: R"><Icon name="route" /> Ruta principal</button>
          <button aria-pressed={mode === 'all'} onClick={() => setMode('all')}>Ver todo</button>
        </div>
        {mode === 'main' && graph.nodes.length > visible.nodes.length && (
          <button className="btn small" onClick={() => setMode('all')}>Mostrar relaciones secundarias (+{graph.nodes.length - visible.nodes.length})</button>
        )}
        <LayersMenu state={state} setState={setState} />
        <CertaintyLegendMenu />
        {mode === 'all' && (
          <Menu label="Grupos" buttonClass="btn small hide-mobile">
            {(close) => (
              <>
                <button className="menu-item" onClick={() => { setState((s) => ({ ...s, collapsed: [] })); close(); }}>Expandir todo</button>
                <button className="menu-item" onClick={() => { setState(defaultGraphState(graph)); close(); }}>Restablecer grupos</button>
              </>
            )}
          </Menu>
        )}
        <button className="btn small" onClick={() => flow.fitView({ padding: 0.12, duration: 250 })} aria-label="Encuadrar el grafo"><Icon name="fit" /><span className="hide-mobile"> Encuadrar</span></button>
        {isMobile && <button className="btn small" onClick={() => { select(null); setOutlineOpen(true); }}>Lista de nodos</button>}
        <span className="spacer" />
        {!readOnly && <button className="btn primary small" onClick={() => setSnapshotOpen(true)}>Crear snapshot</button>}
      </div>

      {focusNode && (
        <div className="focus-banner" role="status">
          <Icon name="focus" /> Enfocado en <strong>{KIND_LABEL[focusNode.kind]}: {focusNode.title}</strong>
          <span className="muted small">Se muestran sus ancestros, padres e hijos directos; el resto queda atenuado.</span>
          <button className="btn small" onClick={() => setFocusId(null)}>Salir de enfoque</button>
        </div>
      )}

      <div className="board-layout">
        <div className={`board-canvas zoom-${zoom}`} aria-label="Grafo del caso">
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            onNodeClick={(_, n) => select(n.id)}
            onNodeDoubleClick={(_, n) => { setMode('all'); toggleCollapse(n.id); }}
            onPaneClick={() => select(null)}
            nodesDraggable
            nodesConnectable={false}
            edgesFocusable={false}
            onlyRenderVisibleElements
            minZoom={0.1}
            maxZoom={1.8}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={18} size={1} color="transparent" />
            <Controls showInteractive={false} aria-label="Controles de zoom" />
            {!isMobile && (
              <MiniMap pannable zoomable nodeStrokeWidth={2} nodeColor={(n) => {
                const layer = (n.data as MpFlowNode['data']).node.layer;
                return layer === 'case' ? 'var(--layer-case)' : layer === 'knowledge' ? 'var(--layer-knowledge)' : 'var(--layer-reasoning)';
              }} />
            )}
          </ReactFlow>
        </div>
        {!isMobile && <aside className="board-panel" aria-label="Detalle del nodo">{panel}</aside>}
      </div>

      {isMobile && (selected || outlineOpen) && (
        <BoardBottomSheet
          state={sheet}
          onStateChange={setSheet}
          onClose={() => { setOutlineOpen(false); select(null); }}
          label={selected ? `Detalle: ${KIND_LABEL[selected.kind]} ${selected.title}` : 'Lista de nodos'}
        >
          {panel}
        </BoardBottomSheet>
      )}
      {isMobile && (selected || outlineOpen) && <div className="board-mobile-spacer" />}

      {snapshotOpen && <SnapshotDialog board={board} state={state} onClose={() => setSnapshotOpen(false)} />}
    </div>
  );
}

function LayersMenu({ state, setState }: { state: GraphState; setState: (fn: (s: GraphState) => GraphState) => void }) {
  return (
    <Menu label="Capas" buttonClass="btn small">
      {() => (
        <>
          <label className="checkbox menu-item"><input type="checkbox" checked disabled /> <DataOriginBadge origin="case" /> datos del caso</label>
          <label className="checkbox menu-item">
            <input type="checkbox" checked={state.layers.knowledge} onChange={(e) => setState((s) => ({ ...s, layers: { ...s.layers, knowledge: e.target.checked } }))} />
            <DataOriginBadge origin="knowledge" /> fuentes externas
          </label>
          <label className="checkbox menu-item">
            <input type="checkbox" checked={state.layers.reasoning} onChange={(e) => setState((s) => ({ ...s, layers: { ...s.layers, reasoning: e.target.checked } }))} />
            <DataOriginBadge origin="reasoning" /> razonamiento humano
          </label>
        </>
      )}
    </Menu>
  );
}

function CertaintyLegendMenu() {
  return (
    <Menu label="Certeza" buttonClass="btn small">
      {() => (
        <>
          <div className="menu-note">Trazo de la relación variante → evidencia</div>
          {CERTAINTY_ORDER.map((c) => (
            <div key={c} className="menu-item" style={{ cursor: 'default' }}>
              <CertaintyGlyph certainty={c} />
              <span className="swatch" style={{ display: 'inline-block', width: 26, borderTop: `${CERTAINTY_STROKE[c].width}px ${CERTAINTY_STROKE[c].dash ? 'dashed' : 'solid'} ${CERTAINTY_STROKE[c].color}` }} />
              {CERTAINTY_LABEL[c]}
            </div>
          ))}
          <div className="menu-note">La certeza procede de la fuente (regla documentada) o de un usuario; nunca se infiere.</div>
        </>
      )}
    </Menu>
  );
}

/** Listado accesible de todos los nodos (lectores de pantalla, móvil y búsqueda rápida). */
function Outline({ graph, visibleIds, onSelect }: { graph: BoardGraph; visibleIds: Set<string>; onSelect: (id: string) => void }) {
  const [filter, setFilter] = useState('');
  const nodes = graph.nodes.filter((n) => `${KIND_LABEL[n.kind]} ${n.title} ${n.subtitle ?? ''}`.toLowerCase().includes(filter.toLowerCase()));
  return (
    <div className="panel-section stack">
      <div>
        <h2>Elementos del caso</h2>
        <p className="small muted">Seleccione un nodo para ver su detalle, su trazabilidad y su discusión. «Enfocar» (F) aísla su contexto; Esc sale.</p>
      </div>
      <input placeholder="Filtrar nodos" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filtrar nodos" />
      <ul className="node-outline" style={{ maxHeight: 'none' }} aria-label="Nodos del grafo">
        {nodes.map((n) => (
          <li key={n.id}>
            <button onClick={() => onSelect(n.id)} style={{ opacity: visibleIds.has(n.id) ? 1 : 0.6 }}>
              <span className="kicker">{KIND_LABEL[n.kind]}</span> {n.title}
              {n.certainty && <span className="muted"> · {CERTAINTY_SHORT[n.certainty]}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SnapshotDialog({ board, state, onClose }: { board: CaseBoard; state: GraphState; onClose: () => void }) {
  const { gateway } = useGateway();
  const qc = useQueryClient();
  const today = new Date().toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const [label, setLabel] = useState(`Snapshot ${today}`);
  const [note, setNote] = useState('');
  const m = useMutation({
    mutationFn: () => gateway.createSnapshot(board.caseRecord.id, { label, note: note || null, graphState: state }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['snapshots'] });
      qc.invalidateQueries({ queryKey: ['timeline'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
  return (
    <Dialog title="Crear snapshot científico" onClose={onClose}>
      {m.data ? (
        <div className="stack">
          <div className="alert info">Snapshot «{m.data.label}» creado. Huella SHA-256: <code>{m.data.contentSha256.slice(0, 16)}…</code></div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={onClose}>Cerrar</button>
            <Link className="btn primary" to={`/cases/${board.caseRecord.id}/snapshots/${m.data.id}`}>Comparar con el estado actual</Link>
          </div>
        </div>
      ) : (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
          <p className="small">
            Se congelará: estado del caso, resultados moleculares, {board.evidence.length} evidencia(s), {board.publications.length} publicación(es),
            {' '}{board.sourceVersions.length} versión(es) de fuentes, interpretaciones y el estado actual del grafo. El snapshot es inmutable y verificable.
          </p>
          <WhyItMatters term="snapshot" label="¿Por qué importa un snapshot?" />
          <Field label="Etiqueta"><input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={200} required /></Field>
          <Field label="Nota"><textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={5000} /></Field>
          <ErrorBox error={m.error} />
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={onClose}>Cancelar</button>
            <button className="btn primary" disabled={m.isPending || !label.trim()}>Crear snapshot</button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
