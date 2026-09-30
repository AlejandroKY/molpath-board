import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CertaintyDistribution, DataOriginBadge } from '../../components/scientific';
import { useGateway } from '../../data/GatewayProvider';
import { WhyItMatters } from '../../education/WhyItMatters';
import { computeCaseSummary } from '../../domain/caseInsights';
import { IHC_RESULT_LABEL, SAMPLE_TYPE_LABEL, formatDate, formatDateTime, formatPct, variantLabel } from '../../domain/labels';
import type { CaseBoard, IhcResult } from '../../domain/types';

const ihcShort = (r: IhcResult) => {
  const sign = r.result === 'POSITIVE' ? '+' : r.result === 'NEGATIVE' ? '−' : IHC_RESULT_LABEL[r.result].toLowerCase();
  const value = r.score ?? (r.percentage != null ? `${r.percentage}%` : null);
  return value && r.result === 'POSITIVE' ? value : sign;
};

/**
 * Resumen molecular del caso: permite responder en segundos qué tumor, qué muestra, qué
 * histología, qué IHQ, qué variantes y qué evidencia (con su certeza) hay. Sólo datos registrados.
 */
export function MolecularCaseSummary({ board }: { board: CaseBoard }) {
  const { gateway } = useGateway();
  const c = board.caseRecord;
  const s = computeCaseSummary(board);
  const snapshots = useQuery({ queryKey: ['snapshots', c.id], queryFn: () => gateway.caseSnapshots(c.id) });
  const last = snapshots.data?.[0];

  return (
    <section className="mcs" aria-label="Resumen molecular del caso">
      <div className="mcs-head">
        <div className="mcs-title">
          <span className="code">{c.caseCode}</span>
          <h2>{c.tumorType}</h2>
          <span className="muted small">{c.organ}{c.diagnosis ? ` · ${c.diagnosis}` : ''}</span>
        </div>
        <div className="row">
          <Link className="btn" to={`/cases/${c.id}/present`}>Presentar caso</Link>
          <Link className="btn primary" to={`/cases/${c.id}/board`}>Abrir Pizarra Molecular</Link>
        </div>
      </div>

      <div className="mcs-grid">
        <div className="mcs-cell">
          <div className="kicker">Muestra principal <DataOriginBadge origin="case" /></div>
          {s.sample ? (
            <>
              <div className="mcs-value">{s.sample.label}</div>
              <div className="mcs-sub">{SAMPLE_TYPE_LABEL[s.sample.sampleType]}{s.sample.anatomicSite ? ` · ${s.sample.anatomicSite}` : ''} · {formatDate(s.sample.collectionDate)}</div>
              <div className="mcs-sub">
                Tumor {formatPct(s.sample.tumorCellularityPct)} <WhyItMatters term="tumor-pct" label="¿Por qué importa?" />
              </div>
              {s.sampleCount > 1 && <div className="mcs-sub">{s.sampleCount} muestras en el caso · <Link to={`/cases/${c.id}/timeline`}>ver evolución</Link></div>}
            </>
          ) : <div className="mcs-sub">Sin muestras registradas.</div>}
        </div>

        <div className="mcs-cell">
          <div className="kicker">Histología</div>
          <div className="mcs-value">{s.histology ?? '—'}</div>
          {c.grade && <div className="mcs-sub">Grado: {c.grade}</div>}
        </div>

        <div className="mcs-cell">
          <div className="kicker">Inmunohistoquímica</div>
          {s.ihc.length ? (
            <ul className="mcs-list">
              {s.ihc.map((r) => <li key={r.id}><span>{r.marker}</span><strong>{ihcShort(r)}</strong></li>)}
            </ul>
          ) : <div className="mcs-sub">Sin marcadores en la muestra principal.</div>}
          {s.ihcTotal > s.ihc.length && <div className="mcs-sub">+{s.ihcTotal - s.ihc.length} más</div>}
        </div>

        <div className="mcs-cell">
          <div className="kicker">Molecular</div>
          {s.variants.length ? (
            <ul className="mcs-list">
              {s.variants.map(({ variant: v, evidenceCount }) => (
                <li key={v.id}>
                  <Link className="mono" to={`/cases/${c.id}/board?node=variant:${v.id}`}>{variantLabel(v)}</Link>
                  <span className="small">{v.vaf != null ? `VAF ${formatPct(v.vaf)}` : ''}{evidenceCount ? ` · ${evidenceCount} ev.` : ''}</span>
                </li>
              ))}
            </ul>
          ) : <div className="mcs-sub">Sin variantes en la muestra principal.</div>}
          {s.variantTotal > s.variants.length && <div className="mcs-sub">+{s.variantTotal - s.variants.length} más</div>}
        </div>

        <div className="mcs-cell span-2">
          <div className="kicker">Evidencia enlazada <DataOriginBadge origin="knowledge" /></div>
          {s.evidence.total ? (
            <>
              <div className="mcs-value" style={{ marginBottom: 4 }}>{s.evidence.total} registro(s) · {s.evidence.publications} publicación(es)</div>
              <CertaintyDistribution dist={s.evidence.byCertainty} />
              {s.evidence.contradictions > 0 && <div className="badge danger" style={{ marginTop: 6 }}><span aria-hidden>⇄</span> Evidencia contradictoria detectada</div>}
            </>
          ) : <div className="mcs-sub">No hay evidencia enlazada a las variantes del caso.</div>}
        </div>

        <div className="mcs-cell span-2">
          <div className="kicker">Interpretación <DataOriginBadge origin="reasoning" /></div>
          {board.interpretations.filter((i) => i.status === 'CURRENT').slice(-1).map((i) => (
            <div key={i.id} className="small">
              <span className="muted">{i.authorName} · {formatDate(i.createdAt)}:</span> {i.statement.length > 200 ? `${i.statement.slice(0, 199)}…` : i.statement}
            </div>
          ))}
          {!board.interpretations.some((i) => i.status === 'CURRENT') && <div className="mcs-sub">Sin interpretación documentada.</div>}
        </div>
      </div>

      <div className="mcs-foot">
        <span>Última actualización científica: <strong>{s.lastScientificUpdate ? formatDate(s.lastScientificUpdate) : '—'}</strong></span>
        <span>
          Último snapshot:{' '}
          {last ? <Link to={`/cases/${c.id}/snapshots/${last.id}`}>{last.label} · {formatDateTime(last.createdAt)}</Link> : <strong>ninguno</strong>}
        </span>
      </div>
    </section>
  );
}
