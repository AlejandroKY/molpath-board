import { useState } from 'react';
import { Dialog } from '../components/ui';
import { GLOSSARY_BY_ID } from './glossary';

/** Botón "¿Por qué importa esto?" que abre contenido educativo, separado de la interpretación clínica. */
export function WhyItMatters({ term, label }: { term: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const entry = GLOSSARY_BY_ID[term];
  if (!entry) return null;
  return (
    <>
      <button type="button" className="btn ghost small" onClick={() => setOpen(true)} title={entry.short}>
        {label ?? '¿Por qué importa esto?'}
      </button>
      {open && (
        <Dialog title={entry.term} onClose={() => setOpen(false)}>
          <div className="stack">
            <span className="badge edu" style={{ alignSelf: 'flex-start' }}>
              Contenido educativo
            </span>
            <p>{entry.short}</p>
            <div>
              <h3 style={{ marginBottom: 4 }}>¿Por qué importa esto?</h3>
              <p>{entry.why}</p>
            </div>
            {entry.caveat && <div className="alert warn">{entry.caveat}</div>}
            <p className="tiny muted">
              Contenido educativo general. No constituye interpretación clínica ni se refiere a ningún caso concreto.
            </p>
          </div>
        </Dialog>
      )}
    </>
  );
}
