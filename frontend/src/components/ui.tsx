import { useEffect, useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BRAND } from '../config/brand';
import { ApiError } from '../data/gateway';
import { BASIS_LABEL, CERTAINTY_LABEL, CERTAINTY_SHORT, CERTAINTY_SYMBOL } from '../domain/labels';
import type { Certainty, CertaintyBasis } from '../domain/types';
import { Icon } from './Icon';

export function Disclaimer({ children }: { children?: ReactNode }) {
  return (
    <div className="disclaimer" role="note">
      <Icon name="info" />
      <span>
        <strong>{BRAND.disclaimer}</strong>
        {children ? <> {children}</> : null}
      </span>
    </div>
  );
}

export function PageHead({ title, sub, crumbs, actions }: { title: ReactNode; sub?: ReactNode; crumbs?: { to?: string; label: string }[]; actions?: ReactNode }) {
  useEffect(() => {
    if (typeof title === 'string') document.title = `${title} · ${BRAND.name}`;
  }, [title]);
  return (
    <>
      {crumbs && crumbs.length > 0 && (
        <nav className="crumbs" aria-label="Ruta de navegación">
          {crumbs.map((c, i) => (
            <span key={i} className="row" style={{ gap: 6 }}>
              {i > 0 && <span aria-hidden>/</span>}
              {c.to ? <Link to={c.to}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
            </span>
          ))}
        </nav>
      )}
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          {sub && <p className="sub">{sub}</p>}
        </div>
        {actions && <div className="row">{actions}</div>}
      </div>
    </>
  );
}

export function CertaintyBadge({ certainty, basis, short }: { certainty: Certainty; basis?: CertaintyBasis; short?: boolean }) {
  const title = `${CERTAINTY_LABEL[certainty]}${basis ? ` — ${BASIS_LABEL[basis]}` : ''}`;
  return (
    <span className={`badge c-${certainty}`} title={title}>
      <span className="glyph" aria-hidden>{CERTAINTY_SYMBOL[certainty]}</span>
      {short ? CERTAINTY_SHORT[certainty] : CERTAINTY_LABEL[certainty]}
    </span>
  );
}

/** Botón "Ver fuente". Si no hay URL verificable, lo dice explícitamente en lugar de inventarla. */
export function SourceButton({ href, label = 'Ver fuente' }: { href: string | null | undefined; label?: string }) {
  if (!href) return <span className="pending-source">Sin enlace de fuente registrado</span>;
  return (
    <a className="btn small" href={href} target="_blank" rel="noopener noreferrer">
      <Icon name="external" /> {label}
    </a>
  );
}

export function PendingSource({ what }: { what?: string }) {
  return <span className="pending-source">{what ? `${what}: ` : ''}Integración pendiente de fuente verificada.</span>;
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  const e = error instanceof ApiError ? error : null;
  return (
    <div className="alert error" role="alert">
      <strong>{e?.title ?? 'Error'}</strong>
      {e?.detail ? ` — ${e.detail}` : !e && error instanceof Error ? ` — ${error.message}` : null}
      {e?.fieldErrors?.length ? (
        <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
          {e.fieldErrors.map((f, i) => (
            <li key={i}>
              <code>{f.field}</code>: {f.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="empty" role="status" aria-live="polite">
      {label}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Dialog({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const id = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby={id}>
        <div className="dialog-head">
          <h2 id={id}>{title}</h2>
          <button className="btn ghost small" onClick={onClose} aria-label="Cerrar">
            <Icon name="close" />
          </button>
        </div>
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-foot">{footer}</div>}
      </div>
    </>
  );
}

export function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="row" style={{ justifyContent: 'flex-end', padding: '10px 16px' }}>
      <button className="btn small" disabled={page <= 0} onClick={() => onPage(page - 1)}>
        Anterior
      </button>
      <span className="small muted">
        Página {page + 1} de {totalPages}
      </span>
      <button className="btn small" disabled={page + 1 >= totalPages} onClick={() => onPage(page + 1)}>
        Siguiente
      </button>
    </div>
  );
}

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}

export function Field({ label, hint, error, children, className }: FieldProps) {
  return (
    <label className={`field ${error ? 'invalid' : ''} ${className ?? ''}`}>
      <span>
        {label} {hint && <span className="hint">· {hint}</span>}
      </span>
      {children}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

/** Estado local de formulario con conversión de vacíos a null. */
export function useForm<T extends Record<string, unknown>>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const set = <K extends keyof T>(key: K) => (e: { target: { value: string; type?: string; checked?: boolean } }) => {
    const raw = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setValues((v) => ({ ...v, [key]: raw }));
  };
  return { values, setValues, set };
}

export const toNull = (v: unknown): string | null => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());
export const toNum = (v: unknown): number | null => {
  const s = toNull(v);
  if (s === null) return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export function fieldError(error: unknown, field: string): string | undefined {
  return error instanceof ApiError ? error.fieldErrors.find((f) => f.field === field)?.message : undefined;
}
