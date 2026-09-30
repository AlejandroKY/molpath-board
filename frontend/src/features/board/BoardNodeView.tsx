import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { Icon } from '../../components/Icon';
import { KIND_LABEL, type BoardNode } from '../../domain/boardGraph';
import { CERTAINTY_SHORT, CERTAINTY_SYMBOL } from '../../domain/labels';

export type MpNodeData = { node: BoardNode; hidden: number; collapsed: boolean; focused: boolean };
export type MpFlowNode = Node<MpNodeData, 'mp'>;

/** Origen del dato con icono + texto (no sólo color): caso, fuente o interpretación. */
const ORIGIN_MARK = {
  case: { icon: 'person', text: 'caso' },
  knowledge: { icon: 'globe', text: 'fuente' },
  reasoning: { icon: 'pen', text: 'interpretación' },
} as const;

function MpNodeImpl({ data, selected }: NodeProps<MpFlowNode>) {
  const n = data.node;
  const origin = ORIGIN_MARK[n.layer];
  return (
    <div
      className={`mp-node layer-${n.layer} kind-${n.kind} ${selected ? 'selected' : ''} ${data.focused ? 'focused' : ''} ${n.inactive ? 'inactive' : ''} ${n.contradiction ? 'contradiction' : ''}`}
      title={`${KIND_LABEL[n.kind]} · ${n.title} (${origin.text})`}
    >
      <Handle type="target" position={Position.Left} />
      <div className="n-kind">
        <span>{KIND_LABEL[n.kind]}</span>
        <span className="origin-mark"><Icon name={origin.icon} />{origin.text}</span>
      </div>
      <div className="n-title">{n.title}</div>
      {n.subtitle && <div className="n-sub">{n.subtitle}</div>}
      {n.meta && <div className="n-meta">{n.meta}</div>}
      {n.extra && <div className="n-extra">{n.extra}</div>}
      {(n.certainty || n.commentCount > 0 || data.hidden > 0 || n.contradiction) && (
        <div className="n-foot">
          {n.certainty && (
            <span className={`badge c-${n.certainty}`} style={{ fontSize: 10.5, padding: '0 6px' }}>
              <span className="glyph" aria-hidden>{CERTAINTY_SYMBOL[n.certainty]}</span>
              {CERTAINTY_SHORT[n.certainty]}
            </span>
          )}
          {n.contradiction && <span className="badge danger" style={{ fontSize: 10.5, padding: '0 6px' }}><span aria-hidden>⇄</span> contradicción</span>}
          {n.commentCount > 0 && <span className="tiny muted">{n.commentCount} coment.</span>}
          {data.collapsed && data.hidden > 0 && <span className="collapse-chip">+{data.hidden}</span>}
        </div>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export const MpNode = memo(MpNodeImpl);
