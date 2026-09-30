import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CaseTabs } from '../../app/Layout';
import { CertaintyBadge, Disclaimer, Empty, ErrorBox, Loading, PageHead } from '../../components/ui';
import { useGateway } from '../../data/GatewayProvider';
import { WhyItMatters } from '../../education/WhyItMatters';
import {
  IHC_INTENSITY_LABEL,
  IHC_RESULT_LABEL,
  ORIGIN_LABEL,
  QUALITY_LABEL,
  ROLE_LABEL,
  SAMPLE_TYPE_LABEL,
  TARGET_LABEL,
  TEST_TYPE_LABEL,
  VARIANT_TYPE_LABEL,
  BIOMARKER_TYPE_LABEL,
  formatDate,
  formatPct,
} from '../../domain/labels';
import type { CaseBoard, Interpretation, MolecularTest, Sample } from '../../domain/types';
import {
  BiomarkerDialog,
  CaseEditDialog,
  HistologyDialog,
  IhcDialog,
  InterpretationDialog,
  SampleDialog,
  TestDialog,
  TimelineEventDialog,
  VariantDialog,
  useInvalidateCase,
} from './forms';
import { useCanEditClinical, useCaseBoard } from './useCaseBoard';
import { MolecularCaseSummary } from './MolecularCaseSummary';
import { CaseChangesSummary, OpenQuestionsPanel } from './insightPanels';
import { SampleActions, VariantActions } from './QuickActions';
import { DataOriginBadge, EmptyState, ResponsiveTable } from '../../components/scientific';

type DialogState =
  | { kind: 'case' }
  | { kind: 'sample'; sample?: Sample }
  | { kind: 'histology' | 'ihc' | 'test'; sampleId: string }
  | { kind: 'variant' | 'biomarker'; testId: string }
  | { kind: 'event' }
  | { kind: 'interpretation'; supersedes?: Interpretation }
  | null;

export function CaseDetailPage() {
  const { caseId } = useParams();
  const board = useCaseBoard(caseId);
  const canEdit = useCanEditClinical();
  const [dialog, setDialog] = useState<DialogState>(null);
  const close = () => setDialog(null);
  const b = board.data;

  if (board.isLoading) return <Loading />;
  if (!b) return <ErrorBox error={board.error} />;
  const c = b.caseRecord;

  return (
    <>
      <PageHead
        title={c.caseCode}
        sub={`${c.tumorType} · ${c.organ}`}
        crumbs={[{ to: '/cases', label: 'Casos' }, { label: c.caseCode }]}
        actions={
          <>
            {canEdit && <button className="btn" onClick={() => setDialog({ kind: 'case' })}>Editar caso</button>}
            <Link className="btn primary" to={`/cases/${c.id}/board`}>Abrir pizarra</Link>
          </>
        }
      />
      <CaseTabs caseId={c.id} />
      <Disclaimer>Caso ficticio de demostración.</Disclaimer>
      <MolecularCaseSummary board={b} />
      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <CaseChangesSummary board={b} />
        <OpenQuestionsPanel board={b} compact />
      </div>
      {!canEdit && <div className="alert info small" style={{ marginBottom: 12 }}>Su rol puede consultar, comentar, documentar interpretaciones y crear snapshots, pero no editar datos de laboratorio.</div>}

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <section className="card">
          <div className="card-head"><h2>Datos del caso</h2><DataOriginBadge origin="case" /></div>
          <div className="card-body">
            <dl className="facts">
              <dt>Case ID</dt><dd className="mono">{c.caseCode}</dd>
              <dt>Órgano</dt><dd>{c.organ}</dd>
              <dt>Tipo tumoral</dt><dd>{c.tumorType}</dd>
              <dt>Diagnóstico</dt><dd>{c.diagnosis ?? '—'}</dd>
              <dt>Subtipo histológico</dt><dd>{c.histologicSubtype ?? '—'}</dd>
              <dt>Grado</dt><dd>{c.grade ?? '—'}</dd>
              <dt>Notas</dt><dd>{c.notes ?? '—'}</dd>
              <dt>Creado</dt><dd>{formatDate(c.createdAt)} {c.createdBy && <span className="muted">· {c.createdBy.displayName}</span>}</dd>
            </dl>
          </div>
        </section>
        <Interpretations board={b} onAdd={(supersedes) => setDialog({ kind: 'interpretation', supersedes })} />
      </div>

      <div className="row between" style={{ margin: '8px 0 12px' }}>
        <h2>Muestras ({b.samples.length})</h2>
        <div className="row">
          {canEdit && <button className="btn" onClick={() => setDialog({ kind: 'event' })}>Añadir evento temporal</button>}
          {canEdit && <button className="btn primary" onClick={() => setDialog({ kind: 'sample' })}>Añadir muestra</button>}
        </div>
      </div>
      {b.samples.length === 0 && (
        <div className="card">
          <EmptyState
            message="Todavía no hay muestras. Añada una para registrar histología, IHQ y estudios moleculares."
            action={canEdit ? { label: 'Registrar la primera muestra', onClick: () => setDialog({ kind: 'sample' }) } : undefined}
          />
        </div>
      )}
      <div className="stack">
        {b.samples.map((s) => (
          <SampleCard key={s.id} board={b} sample={s} canEdit={canEdit} open={setDialog} />
        ))}
      </div>

      {dialog?.kind === 'case' && <CaseEditDialog record={c} onClose={close} />}
      {dialog?.kind === 'sample' && <SampleDialog caseId={c.id} sample={dialog.sample} onClose={close} />}
      {dialog?.kind === 'histology' && <HistologyDialog caseId={c.id} sampleId={dialog.sampleId} onClose={close} />}
      {dialog?.kind === 'ihc' && <IhcDialog caseId={c.id} sampleId={dialog.sampleId} onClose={close} />}
      {dialog?.kind === 'test' && <TestDialog caseId={c.id} sampleId={dialog.sampleId} onClose={close} />}
      {dialog?.kind === 'variant' && <VariantDialog caseId={c.id} testId={dialog.testId} onClose={close} />}
      {dialog?.kind === 'biomarker' && <BiomarkerDialog caseId={c.id} testId={dialog.testId} onClose={close} />}
      {dialog?.kind === 'event' && <TimelineEventDialog caseId={c.id} samples={b.samples} onClose={close} />}
      {dialog?.kind === 'interpretation' && (
        <InterpretationDialog caseId={c.id} targetType="CASE" targetId={c.id} targetLabel={`Caso ${c.caseCode}`} supersedesId={dialog.supersedes?.id} onClose={close} />
      )}
    </>
  );
}

function Interpretations({ board, onAdd }: { board: CaseBoard; onAdd: (supersedes?: Interpretation) => void }) {
  return (
    <section className="card">
      <div className="card-head">
        <h2>Interpretación documentada</h2>
        <button className="btn small" onClick={() => onAdd()}>Documentar</button>
      </div>
      <div className="card-body flush">
        {board.interpretations.length === 0 ? <Empty>Sin interpretaciones. Las interpretaciones son razonamiento humano firmado, con certeza explícita.</Empty> : (
          <ul className="list">
            {[...board.interpretations].reverse().map((i) => (
              <li key={i.id} style={{ opacity: i.status === 'SUPERSEDED' ? 0.6 : 1 }}>
                <div className="row between">
                  <span className="small"><strong>{i.authorName}</strong> <span className="muted">· {ROLE_LABEL[i.authorRole]} · {formatDate(i.createdAt)} · sobre {TARGET_LABEL[i.targetType]}</span></span>
                  <span className="row" style={{ gap: 6 }}>
                    <CertaintyBadge certainty={i.certainty} short />
                    {i.status === 'SUPERSEDED' ? <span className="badge">Sustituida</span> : i.targetType === 'CASE' && <button className="btn ghost small" onClick={() => onAdd(i)}>Sustituir</button>}
                  </span>
                </div>
                <p style={{ marginTop: 4 }}>{i.statement}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function SampleCard({ board, sample, canEdit, open }: { board: CaseBoard; sample: Sample; canEdit: boolean; open: (d: DialogState) => void }) {
  const histology = board.histology.filter((h) => h.sampleId === sample.id);
  const ihc = board.ihc.filter((r) => r.sampleId === sample.id);
  const tests = board.molecularTests.filter((t) => t.sampleId === sample.id);
  const { gateway } = useGateway();
  const invalidate = useInvalidateCase(board.caseRecord.id);
  const del = useMutation({ mutationFn: (id: string) => gateway.deleteIhc(id), onSuccess: invalidate });
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>{sample.label}</h2>
          <div className="small muted">{SAMPLE_TYPE_LABEL[sample.sampleType]} · {sample.anatomicSite ?? 'sitio no indicado'} · {formatDate(sample.collectionDate)}</div>
        </div>
        <div className="row">
          <SampleActions caseId={board.caseRecord.id} sample={sample} canCompare={board.samples.length > 1} />
          {canEdit && <button className="btn small" onClick={() => open({ kind: 'sample', sample })}>Editar muestra</button>}
        </div>
      </div>
      <div className="card-body stack">
        <dl className="facts">
          <dt>Porcentaje tumoral</dt><dd>{formatPct(sample.tumorCellularityPct)} <WhyItMatters term="tumor-pct" /></dd>
          <dt>Necrosis</dt><dd>{formatPct(sample.necrosisPct)}</dd>
          <dt>ADN</dt><dd>{sample.dnaAvailable ? 'Disponible' : 'No disponible'}{sample.dnaQuality && ` · calidad ${QUALITY_LABEL[sample.dnaQuality].toLowerCase()}`}</dd>
          <dt>ARN</dt><dd>{sample.rnaAvailable ? 'Disponible' : 'No disponible'}{sample.rnaQuality && ` · calidad ${QUALITY_LABEL[sample.rnaQuality].toLowerCase()}`}</dd>
          {sample.observations && (<><dt>Observaciones</dt><dd>{sample.observations}</dd></>)}
        </dl>

        <div>
          <div className="row between"><h3>Histología</h3>{canEdit && <button className="btn small" onClick={() => open({ kind: 'histology', sampleId: sample.id })}>Añadir</button>}</div>
          {histology.length === 0 ? <p className="small muted">Sin hallazgos histológicos registrados para esta muestra.</p> : histology.map((h) => (
            <p key={h.id} className="small"><strong>{h.diagnosis}</strong>{h.histologicSubtype && ` · ${h.histologicSubtype}`}{h.grade && ` · grado ${h.grade}`}{h.description && <span className="muted"> — {h.description}</span>}</p>
          ))}
        </div>

        <div>
          <div className="row between"><h3>Inmunohistoquímica</h3>{canEdit && <button className="btn small" onClick={() => open({ kind: 'ihc', sampleId: sample.id })}>Añadir marcador</button>}</div>
          {ihc.length === 0 ? (
            <EmptyState message="No hay marcadores de inmunohistoquímica registrados para esta muestra." action={canEdit ? { label: 'Registrar marcador IHQ', onClick: () => open({ kind: 'ihc', sampleId: sample.id }) } : undefined} />
          ) : (
            <ResponsiveTable
              caption={`Inmunohistoquímica de ${sample.label}`}
              rows={ihc}
              rowKey={(r) => r.id}
              columns={[
                { key: 'marker', header: 'Marcador', primary: true, cell: (r) => <strong>{r.marker}</strong> },
                { key: 'result', header: 'Resultado', cell: (r) => IHC_RESULT_LABEL[r.result] },
                { key: 'pct', header: '%', numeric: true, cell: (r) => r.percentage ?? '—' },
                { key: 'score', header: 'Score', cell: (r) => r.score ?? '—' },
                { key: 'int', header: 'Intensidad', hideOnCard: true, cell: (r) => (r.intensity ? IHC_INTENSITY_LABEL[r.intensity] : '—') },
                { key: 'method', header: 'Método', hideOnCard: true, cell: (r) => <span className="small muted">{r.method ?? '—'}</span> },
                { key: 'obs', header: 'Observaciones', hideOnCard: true, cell: (r) => <span className="small">{r.observations ?? '—'}</span> },
                ...(canEdit ? [{ key: 'del', header: 'Acción', cell: (r: typeof ihc[number]) => <button className="btn ghost small danger" onClick={() => window.confirm(`¿Eliminar ${r.marker}? El estado previo queda en auditoría.`) && del.mutate(r.id)}>Eliminar</button> }] : []),
              ]}
            />
          )}
          <ErrorBox error={del.error} />
        </div>

        <div>
          <div className="row between"><h3>Estudios moleculares</h3>{canEdit && <button className="btn small" onClick={() => open({ kind: 'test', sampleId: sample.id })}>Añadir estudio</button>}</div>
          <div id={`tests-${sample.id}`} />
          {tests.length === 0 ? (
            <EmptyState message="No existen estudios moleculares registrados para esta muestra." action={canEdit ? { label: 'Registrar estudio molecular', onClick: () => open({ kind: 'test', sampleId: sample.id }) } : undefined} />
          ) : tests.map((t) => <TestBlock key={t.id} board={board} test={t} canEdit={canEdit} open={open} />)}
        </div>
      </div>
    </section>
  );
}

function TestBlock({ board, test, canEdit, open }: { board: CaseBoard; test: MolecularTest; canEdit: boolean; open: (d: DialogState) => void }) {
  const variants = board.variants.filter((v) => v.molecularTestId === test.id);
  const biomarkers = board.biomarkers.filter((b) => b.molecularTestId === test.id);
  const evidenceCount = (variantId: string) => board.evidenceLinks.filter((l) => l.variantId === variantId).length;
  return (
    <fieldset style={{ marginTop: 8 }}>
      <legend>{TEST_TYPE_LABEL[test.testType]} · {formatDate(test.testDate)}</legend>
      <div className="small muted" style={{ marginBottom: 8 }}>
        {[test.laboratory, test.platform, test.panelName].filter(Boolean).join(' · ') || 'Sin datos de laboratorio'}
        {test.meanDepth != null && ` · profundidad media ${test.meanDepth}x`}
        {test.limitOfDetectionPct != null && ` · LoD ${formatPct(test.limitOfDetectionPct)}`}
        {test.genesAnalyzed.length > 0 && <> · genes analizados: <span className="mono">{test.genesAnalyzed.join(', ')}</span></>}
      </div>
      <div className="row between"><strong className="small">Variantes</strong>{canEdit && <button className="btn small" onClick={() => open({ kind: 'variant', testId: test.id })}>Añadir variante</button>}</div>
      {variants.length === 0 ? (
        <EmptyState message="No hay variantes registradas en este estudio." action={canEdit ? { label: 'Registrar la primera variante', onClick: () => open({ kind: 'variant', testId: test.id }) } : undefined} />
      ) : (
        <ResponsiveTable
          caption="Variantes del estudio"
          rows={variants}
          rowKey={(v) => v.id}
          columns={[
            { key: 'gene', header: 'Variante', primary: true, cell: (v) => <><strong>{v.geneSymbol}</strong>{v.fusionPartnerSymbol && `::${v.fusionPartnerSymbol}`} <span className="mono">{v.hgvsP ?? ''}</span></> },
            { key: 'c', header: 'HGVS c.', cell: (v) => <span className="mono">{v.hgvsC ?? '—'}</span> },
            { key: 'vaf', header: 'VAF', numeric: true, cell: (v) => formatPct(v.vaf) },
            { key: 'cov', header: 'Cobertura', numeric: true, cell: (v) => (v.coverage != null ? `${v.coverage}x` : '—') },
            { key: 'type', header: 'Tipo', cell: (v) => <>{VARIANT_TYPE_LABEL[v.variantType]}{v.copyNumber != null && ` (${v.copyNumber} copias)`}</> },
            { key: 'origin', header: 'Origen', cell: (v) => ORIGIN_LABEL[v.origin] },
            { key: 'cls', header: 'Clasificación', hideOnCard: true, cell: (v) => <span className="small">{v.classification ?? '—'}</span> },
            { key: 'ev', header: 'Evidencias', cell: (v) => <Link className="small" to={`/cases/${board.caseRecord.id}/board?node=variant:${v.id}`}>{evidenceCount(v.id)} →</Link> },
            { key: 'act', header: 'Acciones', cell: (v) => <VariantActions caseId={board.caseRecord.id} variant={v} /> },
          ]}
        />
      )}
      <div className="row between" style={{ marginTop: 8 }}><strong className="small">Biomarcadores</strong>{canEdit && <button className="btn small" onClick={() => open({ kind: 'biomarker', testId: test.id })}>Añadir biomarcador</button>}</div>
      {biomarkers.length === 0 ? <p className="small muted">Sin biomarcadores (TMB, MSI, HRD…).</p> : (
        <p className="small">{biomarkers.map((b) => `${BIOMARKER_TYPE_LABEL[b.biomarkerType]}: ${b.valueNumeric ?? b.valueText ?? '—'}${b.unit ? ` ${b.unit}` : ''}`).join(' · ')}</p>
      )}
    </fieldset>
  );
}
