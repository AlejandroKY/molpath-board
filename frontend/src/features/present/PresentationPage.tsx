import { ReactFlowProvider } from '@xyflow/react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BRAND } from '../../config/brand';
import { DataOriginBadge, EvidenceSummary, ResponsiveTable } from '../../components/scientific';
import { CertaintyBadge, ErrorBox, Loading } from '../../components/ui';
import { useShortcuts } from '../../hooks/useShortcuts';
import { computeCaseSummary, principalSample, summarizeEvidence, variantEvolution } from '../../domain/caseInsights';
import {
  EVIDENCE_TYPE_LABEL, IHC_RESULT_LABEL, ORIGIN_LABEL, SAMPLE_TYPE_LABEL, SOURCE_LABEL, TEST_TYPE_LABEL, VARIANT_TYPE_LABEL, formatDate, formatPct,
} from '../../domain/labels';
import type { CaseBoard } from '../../domain/types';
import { BoardWorkspace } from '../board/BoardPage';
import { MolecularCaseSummary } from '../cases/MolecularCaseSummary';
import { OpenQuestionsPanel } from '../cases/insightPanels';
import { useCaseBoard } from '../cases/useCaseBoard';

const STEPS = ['Resumen', 'Patología', 'Muestra', 'Molecular', 'Pizarra', 'Evidencia', 'Preguntas abiertas'] as const;

/** Modo presentación para reuniones (Molecular Tumor Board): sin sidebar ni formularios. */
export function PresentationPage() {
  const { caseId } = useParams();
  const board = useCaseBoard(caseId);
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const exit = () => navigate(`/cases/${caseId}`);
  useShortcuts({
    ArrowRight: () => setStep((s) => Math.min(s + 1, STEPS.length - 1)),
    ArrowLeft: () => setStep((s) => Math.max(s - 1, 0)),
    Escape: exit,
  }, STEPS[step] !== 'Pizarra');
  useEffect(() => {
    document.title = `Presentación · ${board.data?.caseRecord.caseCode ?? ''} · ${BRAND.name}`;
  }, [board.data]);
  if (board.isLoading) return <Loading />;
  if (!board.data) return <ErrorBox error={board.error} />;
  const b = board.data;

  return (
    <div className="present">
      <header className="present-top">
        <h1>{b.caseRecord.caseCode} · {b.caseRecord.tumorType}</h1>
        <nav className="present-steps" aria-label="Secciones de la presentación">
          {STEPS.map((s, i) => (
            <button key={s} aria-current={i === step ? 'step' : undefined} onClick={() => setStep(i)}>{i + 1}. {s}</button>
          ))}
        </nav>
        <button className="btn primary" style={{ marginLeft: 'auto' }} onClick={exit}>Salir de presentación</button>
      </header>
      <main className="present-main" aria-live="polite">
        <h2>{STEPS[step]}</h2>
        <Section board={b} step={STEPS[step]} />
      </main>
      <footer className="present-foot">
        <button className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>← Anterior</button>
        <span className="small muted">{BRAND.disclaimer}</span>
        <button className="btn" disabled={step === STEPS.length - 1} onClick={() => setStep(step + 1)}>Siguiente →</button>
      </footer>
    </div>
  );
}

function Section({ board: b, step }: { board: CaseBoard; step: (typeof STEPS)[number] }) {
  const sample = principalSample(b);
  switch (step) {
    case 'Resumen':
      return <MolecularCaseSummary board={b} />;
    case 'Patología':
      return (
        <div className="present-grid">
          {b.samples.map((s) => (
            <section key={s.id} className="card">
              <div className="card-head"><h3>{s.label}</h3><DataOriginBadge origin="case" /></div>
              <div className="card-body stack">
                <div className="present-big">{b.histology.filter((h) => h.sampleId === s.id).map((h) => h.diagnosis).join('; ') || 'Sin histología registrada'}</div>
                <ul className="plain-list">
                  {b.ihc.filter((r) => r.sampleId === s.id).map((r) => (
                    <li key={r.id}><span>{r.marker}</span><strong>{IHC_RESULT_LABEL[r.result]}{r.score ? ` · ${r.score}` : r.percentage != null ? ` · ${r.percentage}%` : ''}</strong></li>
                  ))}
                </ul>
              </div>
            </section>
          ))}
        </div>
      );
    case 'Muestra':
      return (
        <div className="present-grid">
          {b.samples.map((s) => (
            <section key={s.id} className="card" style={s.id === sample?.id ? { borderColor: 'var(--accent)' } : undefined}>
              <div className="card-head"><h3>{s.label}{s.id === sample?.id ? ' · principal' : ''}</h3></div>
              <div className="card-body">
                <dl className="facts">
                  <dt>Tipo</dt><dd>{SAMPLE_TYPE_LABEL[s.sampleType]}</dd><dt>Sitio</dt><dd>{s.anatomicSite ?? '—'}</dd>
                  <dt>Fecha</dt><dd>{formatDate(s.collectionDate)}</dd><dt>% tumoral</dt><dd className="present-big">{formatPct(s.tumorCellularityPct)}</dd>
                  <dt>Necrosis</dt><dd>{formatPct(s.necrosisPct)}</dd>
                </dl>
              </div>
            </section>
          ))}
        </div>
      );
    case 'Molecular': {
      const evo = variantEvolution(b);
      return (
        <div className="stack">
          {b.molecularTests.map((t) => (
            <section key={t.id} className="card">
              <div className="card-head"><h3>{TEST_TYPE_LABEL[t.testType]} · {b.samples.find((s) => s.id === t.sampleId)?.label} · {formatDate(t.testDate)}</h3></div>
              <ResponsiveTable
                rows={b.variants.filter((v) => v.molecularTestId === t.id)}
                rowKey={(v) => v.id}
                columns={[
                  { key: 'v', header: 'Variante', primary: true, cell: (v) => <strong className="mono">{v.geneSymbol} {v.hgvsP ?? v.hgvsC ?? ''}</strong> },
                  { key: 'vaf', header: 'VAF', numeric: true, cell: (v) => formatPct(v.vaf) },
                  { key: 'cov', header: 'Cobertura', numeric: true, cell: (v) => (v.coverage != null ? `${v.coverage}x` : '—') },
                  { key: 't', header: 'Tipo', cell: (v) => VARIANT_TYPE_LABEL[v.variantType] },
                  { key: 'o', header: 'Origen', cell: (v) => ORIGIN_LABEL[v.origin] },
                ]}
              />
            </section>
          ))}
          {evo.length > 0 && (
            <section className="card"><div className="card-body">
              <div className="kicker">Evolución de VAF</div>
              {evo.map((t) => <p key={t.key}><strong className="mono">{t.label}</strong>: {t.points.map((p) => `${formatPct(p.vaf)} (${p.sampleLabel})`).join(' → ')}</p>)}
            </div></section>
          )}
        </div>
      );
    }
    case 'Pizarra':
      return (
        <ReactFlowProvider>
          <BoardWorkspace board={b} readOnly />
        </ReactFlowProvider>
      );
    case 'Evidencia': {
      const summary = computeCaseSummary(b);
      return (
        <div className="stack">
          <section className="card"><div className="card-body"><EvidenceSummary data={summarizeEvidence(b.evidence)} /></div></section>
          {summary.evidence.total === 0 && <p>No hay evidencia enlazada a las variantes del caso.</p>}
          <div className="present-grid">
            {b.evidence.map((e) => (
              <section key={e.id} className="card">
                <div className="card-head"><strong>{e.geneSymbol} {e.variantDescriptor} · {EVIDENCE_TYPE_LABEL[e.evidenceType]}</strong><CertaintyBadge certainty={e.certainty} basis={e.certaintyBasis} short /></div>
                <div className="card-body small stack">
                  <DataOriginBadge origin="knowledge" detail={`${SOURCE_LABEL[e.sourceCode] ?? e.sourceCode} ${e.externalId ?? ''}`} />
                  <span>Contexto: {e.diseaseContext ?? '—'}{e.pmid ? ` · PMID ${e.pmid}` : ''}</span>
                </div>
              </section>
            ))}
          </div>
        </div>
      );
    }
    case 'Preguntas abiertas':
      return (
        <div className="stack">
          <OpenQuestionsPanel board={b} />
          <Link to={`/cases/${b.caseRecord.id}/discussion`}>Ir a la discusión del caso →</Link>
        </div>
      );
  }
}
