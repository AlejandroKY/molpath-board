import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Background, Controls, MiniMap, ReactFlow, ReactFlowProvider, useReactFlow, type Edge } from '@xyflow/react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CaseTabs } from '../../app/Layout';
import { BRAND } from '../../config/brand';
import { Dialog, Disclaimer, ErrorBox, Field, Loading, PageHead } from '../../components/ui';
import { useGateway } from '../../data/GatewayProvider';
import {
  KIND_LABEL,
  buildBoardGraph,
  defaultGraphState,
  visibleGraph,
  type BoardEdge,
  type BoardGraph,
} from '../../domain/boardGraph';
import { CERTAINTY_SHORT } from '../../domain/labels';
import type { CaseBoard, Certainty, GraphState } from '../../domain/types';
import { useCaseBoard } from '../cases/useCaseBoard';
import { MpNode, type MpFlowNode } from './BoardNodeView';
import { layoutGraph } from './layout';
import { NodePanel } from './NodePanel';

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

export default function BoardPage() {
  const { caseId } = useParams();
  const board = useCaseBoard(caseId);
  if (board.isLoading) return <Loading label="Construyendo la pizarra…" />;
  if (!board.data) return <ErrorBox error={board.error} />;
  return (
    <ReactFlowProvider>
      <Board board={board.data} />
    </ReactFlowProvider>
  );
}

function Board({ board }: { board: CaseBoard }) {
  const graph = useMemo(() => buildBoardGraph(board), [board]);
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('node');
  const [state, setState] = useState<GraphState>(() => defaultGraphState(graph));
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const flow = useReactFlow();

  const visible = useMemo(() => visibleGraph(graph, state), [graph, state]);
  const positions = useMemo(() => layoutGraph(visible.nodes, visible.edges), [visible]);

  // Un nodo seleccionado desde la URL (búsqueda, dashboard) se hace visible expandiendo los grupos.
  useEffect(() => {
    if (selectedId && graph.nodes.some((n) => n.id === selectedId) && !visible.nodes.some((n) => n.id === selectedId)) {
      setState({ collapsed: [], layers: { knowledge: true, reasoning: true } });
    }
  }, [selectedId, graph, visible]);

  useEffect(() => {
    const t = setTimeout(() => flow.fitView({ padding: 0.12, duration: 250 }), 60);
    return () => clearTimeout(t);
  }, [visible.nodes.length, flow]);

  const rfNodes: MpFlowNode[] = visible.nodes.map((n) => ({
    id: n.id,
    type: 'mp',
    position: positions.get(n.id) ?? { x: 0, y: 0 },
    data: { node: n, hidden: visible.hiddenDescendants[n.id] ?? 0, collapsed: state.collapsed.includes(n.id) },
    selected: n.id === selectedId,
  }));
  const rfEdges: Edge[] = visible.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    style: edgeStyle(e),
    label: e.label ?? undefined,
    labelStyle: { fontSize: 10, fill: 'var(--ink-3)' },
    labelBgStyle: { fill: 'var(--surface)' },
  }));

  const select = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('node', id);
    else next.delete('node');
    setParams(next, { replace: true });
  };
  const toggle = (id: string) =>
    setState((s) => ({ ...s, collapsed: s.collapsed.includes(id) ? s.collapsed.filter((x) => x !== id) : [...s.collapsed, id] }));
  const selected = graph.nodes.find((n) => n.id === selectedId) ?? null;

  return (
    <>
      <PageHead
        title={`${BRAND.boardName} · ${board.caseRecord.caseCode}`}
        sub={`${board.caseRecord.tumorType} · ${graph.nodes.length} nodos, ${visible.nodes.length} visibles`}
        crumbs={[{ to: '/cases', label: 'Casos' }, { to: `/cases/${board.caseRecord.id}`, label: board.caseRecord.caseCode }, { label: 'Pizarra' }]}
        actions={<button className="btn primary" onClick={() => setSnapshotOpen(true)}>Crear snapshot</button>}
      />
      <CaseTabs caseId={board.caseRecord.id} />
      <Disclaimer>La pizarra organiza información y fuentes; no genera diagnósticos ni recomendaciones.</Disclaimer>

      <div className="board-toolbar">
        <label className="checkbox"><input type="checkbox" checked={state.layers.knowledge} onChange={(e) => setState((s) => ({ ...s, layers: { ...s.layers, knowledge: e.target.checked } }))} /> Capa de conocimiento</label>
        <label className="checkbox"><input type="checkbox" checked={state.layers.reasoning} onChange={(e) => setState((s) => ({ ...s, layers: { ...s.layers, reasoning: e.target.checked } }))} /> Capa de razonamiento</label>
        <button className="btn small" onClick={() => setState((s) => ({ ...s, collapsed: [] }))}>Expandir todo</button>
        <button className="btn small" onClick={() => setState(defaultGraphState(graph))}>Restablecer grupos</button>
        <button className="btn small" onClick={() => flow.fitView({ padding: 0.12, duration: 250 })}>Encuadrar</button>
        <Legend />
      </div>

      <div className="board-layout">
        <div className="board-canvas" aria-label="Grafo del caso">
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            onNodeClick={(_, n) => select(n.id)}
            onNodeDoubleClick={(_, n) => toggle(n.id)}
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
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable nodeStrokeWidth={2} nodeColor={(n) => ((n.data as MpFlowNode['data']).node.layer === 'case' ? 'var(--layer-case)' : (n.data as MpFlowNode['data']).node.layer === 'knowledge' ? 'var(--layer-knowledge)' : 'var(--layer-reasoning)')} />
          </ReactFlow>
        </div>
        <aside className="board-panel" aria-label="Detalle del nodo">
          {selected ? (
            <NodePanel
              key={selected.id}
              board={board}
              graph={graph}
              node={selected}
              collapsed={state.collapsed.includes(selected.id)}
              hiddenCount={visible.hiddenDescendants[selected.id] ?? 0}
              onToggle={() => toggle(selected.id)}
              onSelect={select}
            />
          ) : (
            <Outline graph={graph} visibleIds={new Set(visible.nodes.map((n) => n.id))} onSelect={select} />
          )}
        </aside>
      </div>

      {snapshotOpen && <SnapshotDialog board={board} state={state} onClose={() => setSnapshotOpen(false)} />}
    </>
  );
}

function Legend() {
  return (
    <div className="legend" aria-label="Leyenda">
      <span><span className="badge layer-case">caso</span></span>
      <span><span className="badge layer-knowledge">fuente</span></span>
      <span><span className="badge layer-reasoning">razonamiento</span></span>
      {(Object.keys(CERTAINTY_STROKE) as Certainty[]).map((c) => (
        <span key={c}>
          <span className="swatch" style={{ borderTopColor: CERTAINTY_STROKE[c].color, borderTopStyle: CERTAINTY_STROKE[c].dash ? 'dashed' : 'solid', borderTopWidth: CERTAINTY_STROKE[c].width }} />
          {CERTAINTY_SHORT[c]}
        </span>
      ))}
    </div>
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
        <p className="small muted">Seleccione un nodo para ver su detalle, su trazabilidad y su discusión. Doble clic en un nodo expande o contrae sus relaciones.</p>
      </div>
      <input placeholder="Filtrar nodos" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filtrar nodos" />
      <ul className="node-outline" style={{ maxHeight: 'none' }} aria-label="Nodos del grafo">
        {nodes.map((n) => (
          <li key={n.id}>
            <button onClick={() => onSelect(n.id)} style={{ opacity: visibleIds.has(n.id) ? 1 : 0.55 }}>
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
            {' '}{board.sourceVersions.length} versión(es) de fuentes, interpretaciones y el estado actual del grafo ({state.collapsed.length} grupo(s) contraído(s)).
            El snapshot es inmutable y verificable.
          </p>
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
