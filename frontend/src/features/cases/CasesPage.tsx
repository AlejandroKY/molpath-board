import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Empty, ErrorBox, Loading, PageHead, Pager } from '../../components/ui';
import { useGateway } from '../../data/GatewayProvider';
import { formatDate } from '../../domain/labels';

export function CasesPage() {
  const { gateway } = useGateway();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const cases = useQuery({ queryKey: ['cases', q, page], queryFn: () => gateway.listCases(q, page, 20), placeholderData: keepPreviousData });
  return (
    <>
      <PageHead title="Casos" sub="Casos ficticios de demostración" actions={<Link className="btn primary" to="/cases/new">Crear caso</Link>} />
      <div className="card">
        <div className="card-head">
          <input aria-label="Filtrar casos" placeholder="Filtrar por código, órgano, tumor o diagnóstico" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} style={{ maxWidth: 420 }} />
          <span className="small muted">{cases.data?.totalItems ?? 0} caso(s)</span>
        </div>
        <ErrorBox error={cases.error} />
        {cases.isLoading ? <Loading /> : cases.data && cases.data.items.length === 0 ? <Empty>No hay casos que coincidan.</Empty> : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>Case ID</th><th>Órgano</th><th>Tipo tumoral</th><th>Diagnóstico</th><th className="num">Muestras</th><th className="num">Variantes</th><th>Actualizado</th><th /></tr>
              </thead>
              <tbody>
                {cases.data?.items.map((c) => (
                  <tr key={c.id} className="clickable" onClick={() => navigate(`/cases/${c.id}`)}>
                    <td><Link to={`/cases/${c.id}`} onClick={(e) => e.stopPropagation()}><strong className="mono">{c.caseCode}</strong></Link> {c.demo && <span className="badge">ficticio</span>}</td>
                    <td>{c.organ}</td>
                    <td>{c.tumorType}</td>
                    <td className="muted">{c.diagnosis ?? '—'}</td>
                    <td className="num">{c.sampleCount}</td>
                    <td className="num">{c.variantCount}</td>
                    <td className="small muted">{formatDate(c.updatedAt)}</td>
                    <td><Link className="btn small" to={`/cases/${c.id}/board`} onClick={(e) => e.stopPropagation()}>Pizarra</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} totalPages={cases.data?.totalPages ?? 0} onPage={setPage} />
      </div>
    </>
  );
}
