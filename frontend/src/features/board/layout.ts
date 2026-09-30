import dagre from '@dagrejs/dagre';
import type { BoardEdge, BoardNode } from '../../domain/boardGraph';

export const NODE_W = 216;
export const NODE_H = 96;

/**
 * Layout jerárquico izquierda → derecha, que sigue el flujo del producto:
 * caso → muestra → IHQ/estudio → variante → gen/evidencia → pathway/publicación.
 */
export function layoutGraph(nodes: BoardNode[], edges: BoardEdge[]): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 18, ranksep: 70, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes) g.setNode(n.id, { width: n.kind === 'case' ? 240 : NODE_W, height: NODE_H });
  for (const e of edges) g.setEdge(e.source, e.target);
  dagre.layout(g);
  const positions = new Map<string, { x: number; y: number }>();
  for (const n of nodes) {
    const p = g.node(n.id);
    if (p) positions.set(n.id, { x: p.x - (p.width ?? NODE_W) / 2, y: p.y - (p.height ?? NODE_H) / 2 });
  }
  return positions;
}
