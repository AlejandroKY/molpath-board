import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BRAND } from '../../config/brand';
import { CertaintyBadge, Disclaimer, Empty, ErrorBox, Loading, PageHead } from '../../components/ui';
import { useGateway } from '../../data/GatewayProvider';
import { EVIDENCE_TYPE_LABEL, SOURCE_LABEL, TARGET_LABEL, formatDate, formatDateTime, formatPct, variantLabel } from '../../domain/labels';

export function DashboardPage() {
  const { gateway, session } = useGateway();
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => gateway.dashboard() });
  const d = q.data;
  const stats: [string, string][] = [
    ['cases', 'Casos'], ['samples', 'Muestras'], ['variants', 'Variantes'], ['evidence', 'Evidencias'],
    ['publications', 'Publicaciones'], ['snapshots', 'Snapshots'], ['comments', 'Comentarios'],
  ];
  return (
    <>
      <PageHead title="Dashboard" sub={`Hola, ${session?.user.displayName}. ${BRAND.tagline}`} actions={<Link className="btn primary" to="/cases/new">Crear caso</Link>} />
      <Disclaimer>Todos los casos de esta fase son ficticios.</Disclaimer>
      <ErrorBox error={q.error} />
      {q.isLoading && <Loading />}
      {d && (
        <>
          <div className="stats">
            {stats.map(([k, label]) => (
              <div className="stat" key={k}>
                <div className="value">{d.counts[k] ?? 0}</div>
                <div className="label">{label}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-2">
            <section className="card">
              <div className="card-head"><h2>Casos recientes</h2><Link to="/cases" className="small">Ver todos</Link></div>
              <div className="card-body flush">
                {d.recentCases.length === 0 ? <Empty>Sin casos.</Empty> : (
                  <ul className="list">
                    {d.recentCases.map((c) => (
                      <li key={c.id} className="row between">
                        <div>
                          <Link to={`/cases/${c.id}`}><strong>{c.caseCode}</strong></Link> <span className="muted">· {c.tumorType}</span>
                          <div className="small muted">{c.organ} · {c.sampleCount} muestra(s) · {c.variantCount} variante(s)</div>
                        </div>
                        <Link className="btn small" to={`/cases/${c.id}/board`}>Pizarra</Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
            <section className="card">
              <div className="card-head"><h2>Variantes registradas recientemente</h2></div>
              <div className="card-body flush">
                {d.recentVariants.length === 0 ? <Empty>Sin variantes.</Empty> : (
                  <ul className="list">
                    {d.recentVariants.map((v) => (
                      <li key={v.variant.id}>
                        <Link to={`/cases/${v.caseId}/board?node=variant:${v.variant.id}`} className="mono">{variantLabel(v.variant)}</Link>
                        <div className="small muted">{v.caseCode} · {v.sampleLabel} · VAF {formatPct(v.variant.vaf)} · {formatDate(v.testDate)}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
            <section className="card">
              <div className="card-head"><h2>Evidencias incorporadas</h2><Link to="/evidence" className="small">Biblioteca</Link></div>
              <div className="card-body flush">
                {d.recentEvidence.length === 0 ? <Empty>Sin evidencias.</Empty> : (
                  <ul className="list">
                    {d.recentEvidence.map((e) => (
                      <li key={e.id}>
                        <div className="row between">
                          <Link to={`/evidence?id=${e.id}`}>
                            {e.geneSymbol} {e.variantDescriptor} · {EVIDENCE_TYPE_LABEL[e.evidenceType]}
                          </Link>
                          <CertaintyBadge certainty={e.certainty} basis={e.certaintyBasis} short />
                        </div>
                        <div className="small muted">{SOURCE_LABEL[e.sourceCode] ?? e.sourceCode} {e.externalId} · {e.diseaseContext ?? 'contexto no indicado'} · consultado {formatDate(e.retrievedAt)}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
            <section className="card">
              <div className="card-head"><h2>Snapshots y discusión</h2></div>
              <div className="card-body flush">
                <ul className="list">
                  {d.recentSnapshots.map((s) => (
                    <li key={s.id}>
                      <Link to={`/cases/${s.caseId}/snapshots/${s.id}`}>{s.label}</Link>
                      <div className="small muted">{s.caseCode} · {formatDateTime(s.createdAt)} · {s.createdByName}</div>
                    </li>
                  ))}
                  {d.recentComments.map((c) => (
                    <li key={c.id}>
                      <div className="small"><strong>{c.authorName}</strong> <span className="muted">({c.authorRoleLabel}) sobre {TARGET_LABEL[c.targetType]} · {c.caseCode}</span></div>
                      <div className="small">{c.body.length > 140 ? `${c.body.slice(0, 139)}…` : c.body}</div>
                    </li>
                  ))}
                  {d.recentSnapshots.length + d.recentComments.length === 0 && <Empty>Sin actividad todavía.</Empty>}
                </ul>
              </div>
            </section>
          </div>
        </>
      )}
    </>
  );
}
