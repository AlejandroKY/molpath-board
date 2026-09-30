import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Empty, ErrorBox, Loading, PageHead } from '../../components/ui';
import { useGateway } from '../../data/GatewayProvider';
import type { EntityKind } from '../../domain/types';

const KIND_TEXT: Record<EntityKind, string> = {
  PMID: 'PMID', VARIANT: 'variante', GENE: 'gen', IHC_MARKER: 'marcador IHQ', BIOMARKER: 'biomarcador', CASE: 'caso', TUMOR: 'tumor / órgano', PATHWAY: 'pathway', EVIDENCE: 'evidencia',
};
const EXAMPLES = ['EGFR', 'EGFR L858R', 'BRAF V600E', 'TP53', 'TTF-1', 'PD-L1', 'adenocarcinoma pulmonar', 'PMID: 24662454'];

export function SearchPage() {
  const { gateway } = useGateway();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [input, setInput] = useState(q);
  useEffect(() => setInput(q), [q]);
  const result = useQuery({ queryKey: ['search', q], queryFn: () => gateway.search(q, 10), enabled: q.trim().length > 0 });
  const submit = (e: FormEvent) => { e.preventDefault(); if (input.trim()) setParams({ q: input.trim() }); };
  return (
    <>
      <PageHead title="Buscar" sub="Tumor, órgano, gen, variante, biomarcador, inmunohistoquímica, pathway o PMID" />
      <form onSubmit={submit} className="row" style={{ marginBottom: 12 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="p. ej. EGFR L858R" aria-label="Consulta" style={{ maxWidth: 520 }} />
        <button className="btn primary">Buscar</button>
      </form>
      <div className="row small" style={{ marginBottom: 16 }}>
        <span className="muted">Ejemplos:</span>
        {EXAMPLES.map((x) => <button key={x} className="btn small" onClick={() => setParams({ q: x })}>{x}</button>)}
      </div>
      {result.isLoading && <Loading />}
      <ErrorBox error={result.error} />
      {result.data && (
        <div className="stack">
          <p className="small muted">
            Interpretado como: {result.data.interpretedAs.map((k) => KIND_TEXT[k]).join(', ') || '—'}
            {result.data.geneSymbol && <> · gen <span className="mono">{result.data.geneSymbol}</span></>}
            {result.data.proteinChange && <> · cambio proteico <span className="mono">{result.data.proteinChange}</span></>}
            {result.data.pmid && <> · PMID <span className="mono">{result.data.pmid}</span></>}
          </p>
          {result.data.groups.length === 0 && <div className="card"><Empty>Sin resultados para «{q}».</Empty></div>}
          {result.data.groups.map((g) => (
            <section key={g.kind} className="card">
              <div className="card-head"><h2>{g.label}</h2><span className="small muted">{g.items.length}</span></div>
              <ul className="list">
                {g.items.map((h) => (
                  <li key={`${h.kind}-${h.id}`}>
                    {h.route ? (h.route.startsWith('http') ? <a href={h.route} target="_blank" rel="noopener noreferrer">{h.title}</a> : <Link to={h.route}>{h.title}</Link>) : <strong>{h.title}</strong>}
                    {h.subtitle && <div className="small muted">{h.subtitle}</div>}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
