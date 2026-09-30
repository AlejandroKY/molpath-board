import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CERTAINTY_LABEL, CERTAINTY_ORDER, CERTAINTY_SHORT, CERTAINTY_SYMBOL, EVIDENCE_TYPE_LABEL } from '../domain/labels';
import type { EvidenceSummaryData } from '../domain/caseInsights';
import type { Certainty } from '../domain/types';
import { Icon } from './Icon';

// ─── origen del dato: caso / fuente / razonamiento ─────────────────────────────
export type DataOrigin = 'case' | 'knowledge' | 'reasoning';

const ORIGIN: Record<DataOrigin, { icon: string; label: string; hint: string }> = {
  case: { icon: 'person', label: 'Caso', hint: 'Dato registrado en el caso' },
  knowledge: { icon: 'globe', label: 'Fuente', hint: 'Conocimiento de una fuente externa con procedencia' },
  reasoning: { icon: 'pen', label: 'Interpretación', hint: 'Razonamiento humano firmado (usuario, rol y fecha)' },
};

/** Distingue el origen con icono + texto + forma (no sólo color). Consistente en toda la app. */
export function DataOriginBadge({ origin, detail }: { origin: DataOrigin; detail?: string }) {
  const o = ORIGIN[origin];
  return (
    <span className={`origin-badge origin-${origin}`} title={o.hint}>
      <Icon name={o.icon} />
      <span className="origin-label">{o.label}</span>
      {detail && <span className="origin-detail">· {detail}</span>}
    </span>
  );
}

export function CertaintyGlyph({ certainty }: { certainty: Certainty }) {
  return <span className={`glyph c-${certainty}`} aria-hidden>{CERTAINTY_SYMBOL[certainty]}</span>;
}

/** Distribución de certeza como fila escaneable: símbolo + número + texto. */
export function CertaintyDistribution({ dist, compact }: { dist: Record<Certainty, number>; compact?: boolean }) {
  const present = CERTAINTY_ORDER.filter((c) => dist[c] > 0);
  if (!present.length) return <span className="muted small">Sin evidencia enlazada</span>;
  return (
    <ul className={`cert-dist ${compact ? 'compact' : ''}`} aria-label="Distribución de certeza">
      {present.map((c) => (
        <li key={c} className={`c-${c}`} title={CERTAINTY_LABEL[c]}>
          <CertaintyGlyph certainty={c} />
          <strong>{dist[c]}</strong> <span>{CERTAINTY_SHORT[c].toLowerCase()}</span>
        </li>
      ))}
    </ul>
  );
}

/** Resumen de evidencia antes que la lista de registros. */
export function EvidenceSummary({ data, title }: { data: EvidenceSummaryData; title?: string }) {
  if (data.total === 0) return null;
  return (
    <div className="evidence-summary">
      {title && <div className="kicker">{title}</div>}
      <div className="es-head">
        <span className="es-total"><strong>{data.active}</strong> evidencia(s) vigente(s)</span>
        {data.total > data.active && <span className="small muted">+{data.total - data.active} no vigente(s)</span>}
        {data.contradictions > 0 && <span className="badge danger"><span aria-hidden>⇄</span> {data.contradictions} contradicción(es)</span>}
      </div>
      <div className="es-grid">
        <div>
          <div className="kicker">Certeza</div>
          <CertaintyDistribution dist={data.byCertainty} />
        </div>
        <div>
          <div className="kicker">Tipos</div>
          <ul className="plain-list">{data.byType.map(([t, n]) => <li key={t}>{EVIDENCE_TYPE_LABEL[t]} <strong>{n}</strong></li>)}</ul>
        </div>
        <div>
          <div className="kicker">Fuentes</div>
          <ul className="plain-list">
            {data.bySource.map(([s, n]) => <li key={s}>{s} <strong>{n}</strong></li>)}
            {data.publications > 0 && <li>PubMed (publicaciones citadas) <strong>{data.publications}</strong></li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ─── menú desplegable accesible ────────────────────────────────────────────────
export function Menu({ label, icon, children, align = 'left', buttonClass = 'btn' }: {
  label: ReactNode; icon?: string; children: (close: () => void) => ReactNode; align?: 'left' | 'right'; buttonClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className="menu" ref={ref}>
      <button type="button" className={buttonClass} aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        {icon && <Icon name={icon} />} {label} <Icon name="chevron" />
      </button>
      {open && (
        <div id={id} className={`menu-pop ${align}`} role="group">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

// ─── tabla responsive: tabla en escritorio, tarjetas en móvil ─────────────────
export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Se muestra como título de la tarjeta en móvil. */
  primary?: boolean;
  numeric?: boolean;
  /** Se oculta en la tarjeta móvil (dato secundario). */
  hideOnCard?: boolean;
}

/** Una sola definición de columnas; el CSS decide tabla o tarjetas. Sin duplicar lógica. */
export function ResponsiveTable<T>({ rows, columns, rowKey, caption, onRowClick }: {
  rows: T[]; columns: Column<T>[]; rowKey: (row: T) => string; caption?: string; onRowClick?: (row: T) => void;
}) {
  return (
    <div className="rtable">
      <table className="data">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>{columns.map((c) => <th key={c.key} className={c.numeric ? 'num' : undefined}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} className={onRowClick ? 'clickable' : undefined} onClick={onRowClick ? () => onRowClick(r) : undefined}>
              {columns.map((c) => (
                <td key={c.key} data-label={c.header} className={[c.numeric ? 'num' : '', c.primary ? 'cell-primary' : '', c.hideOnCard ? 'cell-secondary' : ''].join(' ')}>
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── estado vacío útil ────────────────────────────────────────────────────────
export function EmptyState({ message, action }: { message: string; action?: { label: string; onClick?: () => void; to?: string } }) {
  return (
    <div className="empty-state">
      <p>{message}</p>
      {action && (action.to ? <Link className="btn" to={action.to}>{action.label}</Link> : <button className="btn" onClick={action.onClick}>{action.label}</button>)}
    </div>
  );
}

// ─── mini visualización de trayectoria ────────────────────────────────────────
export function Sparkline({ values, label }: { values: (number | null)[]; label: string }) {
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v != null);
  if (pts.length < 2) return null;
  const w = 96, h = 28, pad = 3;
  const max = Math.max(...pts.map((p) => p.v), 1);
  const x = (i: number) => pad + (i * (w - 2 * pad)) / Math.max(values.length - 1, 1);
  const y = (v: number) => h - pad - (v / max) * (h - 2 * pad);
  const d = pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  return (
    <svg className="sparkline" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" />
      {pts.map((p) => <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r="2.2" fill="currentColor" />)}
    </svg>
  );
}
