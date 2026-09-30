import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Empty, ErrorBox, Loading, PageHead, Pager, SourceButton } from '../../components/ui';
import { useGateway } from '../../data/GatewayProvider';
import { formatDateTime } from '../../domain/labels';

export function LiteraturePage() {
  const { gateway } = useGateway();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const [pmid, setPmid] = useState(params.get('pmid') ?? '');
  const [q, setQ] = useState(params.get('pmid') ?? '');
  const [page, setPage] = useState(0);
  const list = useQuery({ queryKey: ['publications', q, page], queryFn: () => gateway.listPublications(q, page, 20), placeholderData: keepPreviousData });
  const imp = useMutation({
    mutationFn: ({ id, refresh }: { id: string; refresh: boolean }) => gateway.importPublication(id, refresh),
    onSuccess: (p) => { qc.invalidateQueries({ queryKey: ['publications'] }); setQ(p.pmid); },
  });
  const submit = (e: FormEvent) => { e.preventDefault(); if (/^\d{1,10}$/.test(pmid.trim())) imp.mutate({ id: pmid.trim(), refresh: false }); };
  return (
    <>
      <PageHead title="Literatura" sub="Publicaciones identificadas por PMID y obtenidas de PubMed (NCBI E-utilities)" />
      <form className="card" onSubmit={submit} style={{ marginBottom: 16 }}>
        <div className="card-body row">
          <label className="field" style={{ maxWidth: 260 }}>
            <span>PMID</span>
            <input value={pmid} onChange={(e) => setPmid(e.target.value)} inputMode="numeric" placeholder="24662454" aria-label="PMID a importar" />
          </label>
          <button className="btn primary" style={{ alignSelf: 'flex-end' }} disabled={imp.isPending || !/^\d{1,10}$/.test(pmid.trim())}>
            {imp.isPending ? 'Consultando PubMed…' : 'Importar desde PubMed'}
          </button>
          <span className="small muted" style={{ alignSelf: 'flex-end' }}>Se guarda el PMID; la URL se genera a partir de él. Un PMID inexistente no se guarda.</span>
        </div>
        <div style={{ padding: '0 16px 12px' }}><ErrorBox error={imp.error} /></div>
      </form>
      <div className="card">
        <div className="card-head">
          <input placeholder="Filtrar por PMID, título, autores o revista" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} style={{ maxWidth: 420 }} aria-label="Filtrar publicaciones" />
          <span className="small muted">{list.data?.totalItems ?? 0} publicación(es)</span>
        </div>
        <ErrorBox error={list.error} />
        {list.isLoading ? <Loading /> : list.data?.items.length === 0 ? <Empty>No hay publicaciones importadas con ese criterio.</Empty> : (
          <ul className="list">
            {list.data?.items.map((p) => (
              <li key={p.id} className="stack" style={{ gap: 4 }}>
                <strong>{p.title}</strong>
                <span className="small muted">{p.authors} · <em>{p.journal}</em> · {p.pubDate}</span>
                <span className="small">PMID <span className="mono">{p.pmid}</span>{p.doi && <> · DOI <span className="mono">{p.doi}</span></>} · consultado {formatDateTime(p.retrievedAt)}</span>
                {p.abstractText ? <details><summary className="small">Abstract</summary><p className="small" style={{ whiteSpace: 'pre-wrap' }}>{p.abstractText}</p></details> : <span className="tiny muted">Abstract no almacenado.</span>}
                <div className="row">
                  <SourceButton href={p.pubmedUrl} label="Ver fuente (PubMed)" />
                  {p.doiUrl && <SourceButton href={p.doiUrl} label="DOI" />}
                  <button className="btn small" disabled={imp.isPending} onClick={() => imp.mutate({ id: p.pmid, refresh: true })}>Refrescar desde PubMed</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Pager page={page} totalPages={list.data?.totalPages ?? 0} onPage={setPage} />
      </div>
    </>
  );
}
