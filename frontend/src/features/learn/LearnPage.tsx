import { useState } from 'react';
import { PageHead } from '../../components/ui';
import { GLOSSARY } from '../../education/glossary';

export function LearnPage() {
  const [filter, setFilter] = useState('');
  const items = GLOSSARY.filter((g) => `${g.term} ${g.short}`.toLowerCase().includes(filter.toLowerCase()));
  return (
    <>
      <PageHead title="Modo aprendizaje" sub="«¿Por qué importa esto?» — conceptos clave explicados" />
      <div className="alert info small" style={{ marginBottom: 16 }}>
        <span className="badge edu">Contenido educativo</span> Estas explicaciones son generales y están separadas de cualquier interpretación clínica. No se refieren a ningún caso.
      </div>
      <input placeholder="Buscar concepto" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Buscar concepto" style={{ maxWidth: 360, marginBottom: 16 }} />
      <div className="grid grid-2">
        {items.map((g) => (
          <article key={g.id} className="card" id={g.id}>
            <div className="card-head"><h2>{g.term}</h2><span className="badge edu">Contenido educativo</span></div>
            <div className="card-body stack">
              <p>{g.short}</p>
              <div><strong className="small">¿Por qué importa esto?</strong><p className="small">{g.why}</p></div>
              {g.caveat && <div className="alert warn small">{g.caveat}</div>}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
