import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Sparkline } from '../../components/scientific';
import { newVariantsByTest, variantEvolution } from '../../domain/caseInsights';
import type { TimelineEntry } from '../../domain/types';
import { CaseTabs } from '../../app/Layout';
import { Empty, ErrorBox, Loading, PageHead } from '../../components/ui';
import { useGateway } from '../../data/GatewayProvider';
import { EVENT_TYPE_LABEL, EVIDENCE_TYPE_LABEL, IHC_RESULT_LABEL, SOURCE_LABEL, formatDate, formatPct } from '../../domain/labels';
import { compareSamples } from '../../domain/sampleCompare';
import type { CaseBoard, TimelineEventType } from '../../domain/types';
import { TimelineEventDialog } from '../cases/forms';
import { useCanEditClinical, useCaseBoard } from '../cases/useCaseBoard';

const KIND_TEXT = { EVENT: 'Evento', SAMPLE: 'Muestra', MOLECULAR_TEST: 'Estudio molecular', SNAPSHOT: 'Snapshot' } as const;

export function TimelinePage() {
  const { caseId } = useParams();
  const { gateway } = useGateway();
  const board = useCaseBoard(caseId);
  const timeline = useQuery({ queryKey: ['timeline', caseId], queryFn: () => gateway.timeline(caseId!), enabled: !!caseId });
  const canEdit = useCanEditClinical();
  const [adding, setAdding] = useState(false);
  if (board.isLoading) return <Loading />;
  if (!board.data) return <ErrorBox error={board.error} />;
  const b = board.data;
  return (
    <>
      <PageHead
        title={`Evolución longitudinal · ${b.caseRecord.caseCode}`}
        crumbs={[{ to: '/cases', label: 'Casos' }, { to: `/cases/${b.caseRecord.id}`, label: b.caseRecord.caseCode }, { label: 'Timeline' }]}
        actions={canEdit && <button className="btn" onClick={() => setAdding(true)}>Añadir evento</button>}
      />
      <CaseTabs caseId={b.caseRecord.id} />
      <div className="grid grid-2">
        <section className="card">
          <div className="card-head"><h2>Evolución del caso</h2><span className="small muted">diagnóstico · muestras · estudios · snapshots</span></div>
          <div className="card-body">
            <ErrorBox error={timeline.error} />
            {timeline.isLoading && <Loading />}
            {timeline.data?.length === 0 && <Empty>Sin eventos registrados.</Empty>}
            {timeline.data && <TimelineVisual entries={timeline.data} board={b} />}
          </div>
        </section>
        <div className="stack">
          <VariantEvolutionCard board={b} />
          <SampleComparison board={b} />
        </div>
      </div>
      {adding && <TimelineEventDialog caseId={b.caseRecord.id} samples={b.samples} onClose={() => setAdding(false)} />}
    </>
  );
}

function SampleComparison({ board }: { board: CaseBoard }) {
  const samples = board.samples;
  const [params] = useSearchParams();
  const pre = params.get('compare');
  const [a, setA] = useState(pre && samples.some((s) => s.id === pre) ? pre : samples[0]?.id ?? '');
  const [bId, setB] = useState(samples[samples.length - 1]?.id ?? '');
  useEffect(() => {
    if (!samples.some((s) => s.id === a)) setA(samples[0]?.id ?? '');
    if (!samples.some((s) => s.id === bId)) setB(samples[samples.length - 1]?.id ?? '');
  }, [samples, a, bId]);
  if (samples.length < 2) {
    return (
      <section className="card">
        <div className="card-head"><h2>Comparar muestras</h2></div>
        <Empty>Se necesitan al menos dos muestras para comparar (p. ej. Biopsia 1 vs Biopsia 2).</Empty>
      </section>
    );
  }
  const cmp = a && bId && a !== bId ? compareSamples(board, a, bId) : null;
  const labelA = samples.find((s) => s.id === a)?.label;
  const labelB = samples.find((s) => s.id === bId)?.label;
  return (
    <section className="card">
      <div className="card-head"><h2>Comparar muestras</h2></div>
      <div className="card-body stack">
        <div className="row">
          <select value={a} onChange={(e) => setA(e.target.value)} aria-label="Muestra A" style={{ maxWidth: 220 }}>
            {samples.map((s) => <option key={s.id} value={s.id}>{s.label} · {formatDate(s.collectionDate)}</option>)}
          </select>
          <span className="muted">vs.</span>
          <select value={bId} onChange={(e) => setB(e.target.value)} aria-label="Muestra B" style={{ maxWidth: 220 }}>
            {samples.map((s) => <option key={s.id} value={s.id}>{s.label} · {formatDate(s.collectionDate)}</option>)}
          </select>
        </div>
        {!cmp ? <p className="small muted">Seleccione dos muestras distintas.</p> : (
          <>
            <h3>Variantes</h3>
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Variante</th><th>Cambio</th><th className="num">VAF {labelA}</th><th className="num">VAF {labelB}</th><th className="num">Δ VAF</th></tr></thead>
                <tbody>
                  {cmp.variants.length === 0 && <tr><td colSpan={5} className="muted">Sin variantes en ninguna de las dos muestras.</td></tr>}
                  {cmp.variants.map((v) => (
                    <tr key={v.key}>
                      <td className="mono">{v.label}</td>
                      <td>
                        <span className={`status-${v.status}`}>{v.status === 'appeared' ? 'Aparece' : v.status === 'disappeared' ? 'No detectada' : 'Persiste'}</span>
                        {(v.notAssessedInA || v.notAssessedInB) && <div className="tiny muted">gen no incluido en el panel de una de las muestras: no comparable</div>}
                      </td>
                      <td className="num">{formatPct(v.vafA)}</td>
                      <td className="num">{formatPct(v.vafB)}</td>
                      <td className="num">{v.vafDelta == null ? '—' : `${v.vafDelta > 0 ? '+' : ''}${v.vafDelta}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="tiny muted">«No detectada» no equivale a ausente: depende del panel, la celularidad tumoral y el límite de detección de cada estudio.</p>

            <h3>Inmunohistoquímica</h3>
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Marcador</th><th>{labelA}</th><th>{labelB}</th><th>Cambio</th></tr></thead>
                <tbody>
                  {cmp.ihc.map((r) => {
                    const val = (x: typeof r.a) => (x ? `${IHC_RESULT_LABEL[x.result]}${x.score ? ` · ${x.score}` : x.percentage != null ? ` · ${x.percentage}%` : ''}` : '—');
                    return (
                      <tr key={r.marker}>
                        <td><strong>{r.marker}</strong></td><td>{val(r.a)}</td><td>{val(r.b)}</td>
                        <td>{r.status === 'changed' ? <span className="badge warn">cambia</span> : r.status === 'unchanged' ? <span className="muted small">igual</span> : r.status === 'appeared' ? 'sólo en B' : 'sólo en A'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <h3>Muestra</h3>
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Campo</th><th>{labelA}</th><th>{labelB}</th></tr></thead>
                <tbody>
                  {[...cmp.sampleFields, ...cmp.histology, ...cmp.biomarkers].map((f) => (
                    <tr key={f.field}><td>{f.label}</td><td>{f.a}</td><td style={{ fontWeight: f.changed ? 600 : 400 }}>{f.b}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3>Evidencia enlazada sólo en {labelB}</h3>
            {cmp.evidenceOnlyInB.length === 0 ? <p className="small muted">Ninguna.</p> : (
              <ul className="small">
                {cmp.evidenceOnlyInB.map((e) => <li key={e.id}>{SOURCE_LABEL[e.sourceCode] ?? e.sourceCode} {e.externalId} · {EVIDENCE_TYPE_LABEL[e.evidenceType]} · {e.geneSymbol} {e.variantDescriptor}</li>)}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  );
}

const MONTH = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString('es', { month: 'short', year: 'numeric' }).toUpperCase();
const MARK: Record<TimelineEntry['kind'], string> = { EVENT: '◆', SAMPLE: 'M', MOLECULAR_TEST: 'NGS', SNAPSHOT: '▣' };

/** Línea temporal visual agrupada por mes, con las variantes que aparecen por primera vez. */
function TimelineVisual({ entries, board }: { entries: TimelineEntry[]; board: CaseBoard }) {
  const fresh = newVariantsByTest(board);
  const firstTest = [...board.molecularTests].sort((x, y) => (x.testDate ?? '').localeCompare(y.testDate ?? ''))[0]?.id;
  let lastMonth = '';
  return (
    <ol className="tl" aria-label="Línea de tiempo">
      {entries.map((e, i) => {
        const month = MONTH(e.date);
        const header = month !== lastMonth ? month : null;
        lastMonth = month;
        const test = e.kind === 'MOLECULAR_TEST' ? board.molecularTests.find((t) => t.id === e.refId) : undefined;
        const newVariants = e.kind === 'MOLECULAR_TEST' ? fresh.get(e.refId) ?? [] : [];
        return (
          <li key={`${e.refId}-${i}`}>
            {header && <div className="tl-month">{header}</div>}
            <div className="tl-item">
              <span className={`tl-dot k-${e.kind}`} aria-hidden>{e.kind === 'MOLECULAR_TEST' ? (test?.testType === 'FISH' ? 'F' : 'Mol') : MARK[e.kind]}</span>
              <div className="tl-body">
                <div className="tl-kind">{formatDate(e.date)} · {KIND_TEXT[e.kind]}{e.kind === 'EVENT' && ` · ${EVENT_TYPE_LABEL[e.eventType as TimelineEventType] ?? e.eventType}`}</div>
                {e.kind === 'SNAPSHOT' ? <Link to={`/cases/${board.caseRecord.id}/snapshots/${e.refId}`}><strong>{e.title}</strong></Link> : <strong>{e.title}</strong>}
                {e.detail && <div className="small muted">{e.detail}</div>}
                {newVariants.length > 0 && (
                  <div className="tl-new">{e.refId === firstTest ? 'Variantes detectadas' : '+ Nueva variante'}: <span className="mono">{newVariants.join(', ')}</span></div>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Evolución de la VAF de variantes presentes en varias muestras. */
function VariantEvolutionCard({ board }: { board: CaseBoard }) {
  const trajectories = variantEvolution(board);
  return (
    <section className="card">
      <div className="card-head"><h2>Evolución de VAF</h2><span className="small muted">variantes presentes en ≥ 2 muestras</span></div>
      <div className="card-body">
        {trajectories.length === 0 ? <p className="small muted">Ninguna variante aparece todavía en más de una muestra.</p> : trajectories.map((t) => (
          <div key={t.key} className="vaf-evo">
            <strong className="mono" style={{ minWidth: 130 }}>{t.label}</strong>
            <div className="vaf-steps">
              {t.points.map((p, k) => (
                <span key={p.sampleId} style={{ display: 'contents' }}>
                  {k > 0 && <span aria-hidden className="muted">→</span>}
                  <span className="step"><strong>{formatPct(p.vaf)}</strong><small>{p.sampleLabel} · {formatDate(p.date)}</small></span>
                </span>
              ))}
            </div>
            {t.points.length >= 2 && <Sparkline values={t.points.map((p) => p.vaf)} label={`Trayectoria de VAF de ${t.label}`} />}
          </div>
        ))}
        <p className="tiny muted" style={{ marginTop: 6 }}>La VAF depende también del porcentaje tumoral de cada muestra: compare ambos datos antes de extraer conclusiones.</p>
      </div>
    </section>
  );
}
