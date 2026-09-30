import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { KIND_LABEL, type BoardNode } from '../../domain/boardGraph';
import { CERTAINTY_SHORT } from '../../domain/labels';

export type MpNodeData = { node: BoardNode; hidden: number; collapsed: boolean };
export type MpFlowNode = Node<MpNodeData, 'mp'>;

const LAYER_TAG = { case: 'caso', knowledge: 'fuente', reasoning: 'razonamiento' } as const;

function MpNodeImpl({ data, selected }: NodeProps<MpFlowNode>) {
  const n = data.node;
  return (
    <div
      className={`mp-node layer-${n.layer} kind-${n.kind} ${selected ? 'selected' : ''} ${n.inactive ? 'inactive' : ''} ${n.contradiction ? 'contradiction' : ''}`}
      title={`${KIND_LABEL[n.kind]} · ${n.title}`}
    >
      <Handle type="target" position={Position.Left} />
      <div className="n-kind">
        <span>{KIND_LABEL[n.kind]}</span>
        <span>{LAYER_TAG[n.layer]}</span>
      </div>
      <div className="n-title">{n.title}</div>
      {n.subtitle && <div className="n-sub">{n.subtitle}</div>}
      {n.meta && <div className="n-meta">{n.meta}</div>}
      {(n.certainty || n.commentCount > 0 || data.hidden > 0 || n.contradiction) && (
        <div className="n-foot">
          {n.certainty && (
            <span className={`badge c-${n.certainty}`} style={{ fontSize: 10.5, padding: '0 6px' }}>
              <span className="dot" aria-hidden />
              {CERTAINTY_SHORT[n.certainty]}
            </span>
          )}
          {n.contradiction && <span className="badge danger" style={{ fontSize: 10.5, padding: '0 6px' }}>contradicción</span>}
          {n.commentCount > 0 && <span className="tiny muted">{n.commentCount} coment.</span>}
          {data.collapsed && data.hidden > 0 && <span className="collapse-chip">+{data.hidden}</span>}
        </div>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export const MpNode = memo(MpNodeImpl);
