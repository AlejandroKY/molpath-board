import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { FormEvent, ReactNode } from 'react';
import { Dialog, ErrorBox, Field, fieldError, toNull, toNum, useForm } from '../../components/ui';
import { useGateway } from '../../data/GatewayProvider';
import { WhyItMatters } from '../../education/WhyItMatters';
import {
  BIOMARKER_TYPE_LABEL,
  CERTAINTY_LABEL,
  CERTAINTY_ORDER,
  EVENT_TYPE_LABEL,
  IHC_INTENSITY_LABEL,
  IHC_RESULT_LABEL,
  ORIGIN_LABEL,
  QUALITY_LABEL,
  SAMPLE_TYPE_LABEL,
  TEST_TYPE_LABEL,
  VARIANT_TYPE_LABEL,
} from '../../domain/labels';
import type {
  BiomarkerType,
  CaseRecord,
  CaseRequest,
  Certainty,
  IhcIntensity,
  IhcResultValue,
  MolecularTestType,
  NucleicAcidQuality,
  Sample,
  SampleType,
  TargetType,
  TimelineEventType,
  VariantOrigin,
  VariantType,
} from '../../domain/types';

export function useInvalidateCase(caseId?: string) {
  const qc = useQueryClient();
  return () => {
    if (caseId) {
      qc.invalidateQueries({ queryKey: ['board', caseId] });
      qc.invalidateQueries({ queryKey: ['timeline', caseId] });
      qc.invalidateQueries({ queryKey: ['case', caseId] });
    }
    qc.invalidateQueries({ queryKey: ['cases'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
    qc.invalidateQueries({ queryKey: ['search'] });
    qc.invalidateQueries({ queryKey: ['evidence'] });
  };
}

function Options<T extends string>({ labels, empty }: { labels: Record<T, string>; empty?: string }) {
  return (
    <>
      {empty !== undefined && <option value="">{empty}</option>}
      {(Object.keys(labels) as T[]).map((k) => (
        <option key={k} value={k}>
          {labels[k]}
        </option>
      ))}
    </>
  );
}

function FormDialog({ title, onClose, onSubmit, pending, error, children, submitLabel = 'Guardar' }: {
  title: string; onClose: () => void; onSubmit: () => void; pending: boolean; error: unknown; children: ReactNode; submitLabel?: string;
}) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };
  return (
    <Dialog title={title} onClose={onClose}>
      <form onSubmit={submit} className="stack" noValidate>
        {children}
        <ErrorBox error={error} />
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn primary" disabled={pending}>
            {pending ? 'Guardando…' : submitLabel}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

// ─── caso ───────────────────────────────────────────────────────────────────
export function CaseFields({ values, set, error }: { values: Record<string, unknown>; set: (k: string) => (e: { target: { value: string } }) => void; error: unknown }) {
  const v = (k: string) => (values[k] as string) ?? '';
  return (
    <div className="form-grid">
      <Field label="Case ID" hint="identificador ficticio, sin datos del paciente" error={fieldError(error, 'caseCode')}>
        <input value={v('caseCode')} onChange={set('caseCode')} placeholder="DEMO-004" required maxLength={32} />
      </Field>
      <Field label="Órgano" error={fieldError(error, 'organ')}>
        <input value={v('organ')} onChange={set('organ')} required maxLength={120} />
      </Field>
      <Field label="Tipo tumoral" error={fieldError(error, 'tumorType')}>
        <input value={v('tumorType')} onChange={set('tumorType')} required maxLength={200} />
      </Field>
      <Field label="Subtipo histológico">
        <input value={v('histologicSubtype')} onChange={set('histologicSubtype')} maxLength={200} />
      </Field>
      <Field label="Grado">
        <input value={v('grade')} onChange={set('grade')} maxLength={60} />
      </Field>
      <Field label="Diagnóstico anatomopatológico" className="span-all">
        <input value={v('diagnosis')} onChange={set('diagnosis')} maxLength={500} />
      </Field>
      <Field label="Notas" className="span-all">
        <textarea value={v('notes')} onChange={set('notes')} maxLength={10000} />
      </Field>
    </div>
  );
}

export function caseRequestFrom(values: Record<string, unknown>, version?: number | null): CaseRequest {
  return {
    caseCode: String(values.caseCode ?? '').trim(),
    organ: String(values.organ ?? '').trim(),
    tumorType: String(values.tumorType ?? '').trim(),
    diagnosis: toNull(values.diagnosis),
    histologicSubtype: toNull(values.histologicSubtype),
    grade: toNull(values.grade),
    notes: toNull(values.notes),
    version: version ?? null,
  };
}

export function CaseEditDialog({ record, onClose }: { record: CaseRecord; onClose: () => void }) {
  const { gateway } = useGateway();
  const invalidate = useInvalidateCase(record.id);
  const { values, set } = useForm<Record<string, unknown>>({ ...record });
  const m = useMutation({
    mutationFn: () => gateway.updateCase(record.id, caseRequestFrom(values, record.version)),
    onSuccess: () => { invalidate(); onClose(); },
  });
  return (
    <FormDialog title={`Editar caso ${record.caseCode}`} onClose={onClose} onSubmit={() => m.mutate()} pending={m.isPending} error={m.error}>
      <CaseFields values={values} set={set as never} error={m.error} />
    </FormDialog>
  );
}

// ─── muestra ────────────────────────────────────────────────────────────────
export function SampleDialog({ caseId, sample, onClose }: { caseId: string; sample?: Sample; onClose: () => void }) {
  const { gateway } = useGateway();
  const invalidate = useInvalidateCase(caseId);
  const { values, set } = useForm<Record<string, unknown>>({
    label: sample?.label ?? '', sampleType: sample?.sampleType ?? 'BIOPSY', anatomicSite: sample?.anatomicSite ?? '',
    collectionDate: sample?.collectionDate ?? '', tumorCellularityPct: sample?.tumorCellularityPct ?? '', necrosisPct: sample?.necrosisPct ?? '',
    dnaAvailable: sample?.dnaAvailable ?? false, rnaAvailable: sample?.rnaAvailable ?? false, dnaQuality: sample?.dnaQuality ?? '',
    rnaQuality: sample?.rnaQuality ?? '', observations: sample?.observations ?? '',
  });
  const m = useMutation({
    mutationFn: () => {
      const req = {
        label: String(values.label).trim(), sampleType: values.sampleType as SampleType, anatomicSite: toNull(values.anatomicSite),
        collectionDate: toNull(values.collectionDate), tumorCellularityPct: toNum(values.tumorCellularityPct), necrosisPct: toNum(values.necrosisPct),
        dnaAvailable: Boolean(values.dnaAvailable), rnaAvailable: Boolean(values.rnaAvailable),
        dnaQuality: (toNull(values.dnaQuality) as NucleicAcidQuality) ?? null, rnaQuality: (toNull(values.rnaQuality) as NucleicAcidQuality) ?? null,
        observations: toNull(values.observations), version: sample?.version ?? null,
      };
      return sample ? gateway.updateSample(sample.id, req) : gateway.createSample(caseId, req);
    },
    onSuccess: () => { invalidate(); onClose(); },
  });
  const v = (k: string) => (values[k] as string) ?? '';
  return (
    <FormDialog title={sample ? `Editar ${sample.label}` : 'Añadir muestra'} onClose={onClose} onSubmit={() => m.mutate()} pending={m.isPending} error={m.error}>
      <div className="form-grid">
        <Field label="Etiqueta" hint="p. ej. Biopsia 2" error={fieldError(m.error, 'label')}>
          <input value={v('label')} onChange={set('label')} required maxLength={120} />
        </Field>
        <Field label="Tipo de muestra">
          <select value={v('sampleType')} onChange={set('sampleType')}>
            <Options labels={SAMPLE_TYPE_LABEL} />
          </select>
        </Field>
        <Field label="Sitio anatómico">
          <input value={v('anatomicSite')} onChange={set('anatomicSite')} maxLength={200} />
        </Field>
        <Field label="Fecha de obtención">
          <input type="date" value={v('collectionDate')} onChange={set('collectionDate')} />
        </Field>
        <Field label="Porcentaje tumoral (%)" error={fieldError(m.error, 'tumorCellularityPct')}>
          <input inputMode="decimal" value={v('tumorCellularityPct')} onChange={set('tumorCellularityPct')} />
        </Field>
        <Field label="Porcentaje de necrosis (%)" error={fieldError(m.error, 'necrosisPct')}>
          <input inputMode="decimal" value={v('necrosisPct')} onChange={set('necrosisPct')} />
        </Field>
        <Field label="Calidad ADN">
          <select value={v('dnaQuality')} onChange={set('dnaQuality')}>
            <Options labels={QUALITY_LABEL} empty="—" />
          </select>
        </Field>
        <Field label="Calidad ARN">
          <select value={v('rnaQuality')} onChange={set('rnaQuality')}>
            <Options labels={QUALITY_LABEL} empty="—" />
          </select>
        </Field>
        <label className="checkbox">
          <input type="checkbox" checked={Boolean(values.dnaAvailable)} onChange={set('dnaAvailable')} /> ADN disponible
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={Boolean(values.rnaAvailable)} onChange={set('rnaAvailable')} /> ARN disponible
        </label>
        <Field label="Observaciones" className="span-all">
          <textarea value={v('observations')} onChange={set('observations')} />
        </Field>
      </div>
      <div className="row">
        <WhyItMatters term="tumor-pct" label="¿Por qué importa el porcentaje tumoral?" />
      </div>
    </FormDialog>
  );
}

export function HistologyDialog({ caseId, sampleId, onClose }: { caseId: string; sampleId: string; onClose: () => void }) {
  const { gateway } = useGateway();
  const invalidate = useInvalidateCase(caseId);
  const { values, set } = useForm<Record<string, unknown>>({ diagnosis: '', histologicSubtype: '', grade: '', growthPattern: '', description: '' });
  const m = useMutation({
    mutationFn: () => gateway.addHistology(sampleId, {
      diagnosis: String(values.diagnosis).trim(), histologicSubtype: toNull(values.histologicSubtype), grade: toNull(values.grade),
      growthPattern: toNull(values.growthPattern), description: toNull(values.description),
    }),
    onSuccess: () => { invalidate(); onClose(); },
  });
  const v = (k: string) => (values[k] as string) ?? '';
  return (
    <FormDialog title="Añadir hallazgo histológico" onClose={onClose} onSubmit={() => m.mutate()} pending={m.isPending} error={m.error}>
      <div className="form-grid">
        <Field label="Diagnóstico histológico" className="span-all" error={fieldError(m.error, 'diagnosis')}>
          <input value={v('diagnosis')} onChange={set('diagnosis')} required maxLength={500} />
        </Field>
        <Field label="Subtipo"><input value={v('histologicSubtype')} onChange={set('histologicSubtype')} /></Field>
        <Field label="Grado"><input value={v('grade')} onChange={set('grade')} /></Field>
        <Field label="Patrón de crecimiento"><input value={v('growthPattern')} onChange={set('growthPattern')} /></Field>
        <Field label="Descripción" className="span-all"><textarea value={v('description')} onChange={set('description')} /></Field>
      </div>
    </FormDialog>
  );
}

export function IhcDialog({ caseId, sampleId, onClose }: { caseId: string; sampleId: string; onClose: () => void }) {
  const { gateway } = useGateway();
  const invalidate = useInvalidateCase(caseId);
  const { values, set } = useForm<Record<string, unknown>>({ marker: '', result: 'POSITIVE', percentage: '', intensity: '', score: '', method: '', observations: '' });
  const m = useMutation({
    mutationFn: () => gateway.addIhc(sampleId, {
      marker: String(values.marker).trim(), result: values.result as IhcResultValue, percentage: toNum(values.percentage),
      intensity: (toNull(values.intensity) as IhcIntensity) ?? null, score: toNull(values.score), method: toNull(values.method), observations: toNull(values.observations),
    }),
    onSuccess: () => { invalidate(); onClose(); },
  });
  const v = (k: string) => (values[k] as string) ?? '';
  return (
    <FormDialog title="Añadir marcador de inmunohistoquímica" onClose={onClose} onSubmit={() => m.mutate()} pending={m.isPending} error={m.error}>
      <div className="alert small">El resultado se registra tal cual; MolPath no lo interpreta como diagnóstico.</div>
      <div className="form-grid">
        <Field label="Marcador" hint="p. ej. TTF-1, PD-L1" error={fieldError(m.error, 'marker')}>
          <input value={v('marker')} onChange={set('marker')} required maxLength={80} />
        </Field>
        <Field label="Resultado">
          <select value={v('result')} onChange={set('result')}><Options labels={IHC_RESULT_LABEL} /></select>
        </Field>
        <Field label="Porcentaje (%)" error={fieldError(m.error, 'percentage')}>
          <input inputMode="decimal" value={v('percentage')} onChange={set('percentage')} />
        </Field>
        <Field label="Intensidad">
          <select value={v('intensity')} onChange={set('intensity')}><Options labels={IHC_INTENSITY_LABEL} empty="—" /></select>
        </Field>
        <Field label="Score" hint="p. ej. TPS 70%, H-score"><input value={v('score')} onChange={set('score')} maxLength={80} /></Field>
        <Field label="Método / clon"><input value={v('method')} onChange={set('method')} maxLength={200} /></Field>
        <Field label="Observaciones" className="span-all"><textarea value={v('observations')} onChange={set('observations')} /></Field>
      </div>
    </FormDialog>
  );
}

// ─── molecular ──────────────────────────────────────────────────────────────
export function TestDialog({ caseId, sampleId, onClose }: { caseId: string; sampleId: string; onClose: () => void }) {
  const { gateway } = useGateway();
  const invalidate = useInvalidateCase(caseId);
  const { values, set } = useForm<Record<string, unknown>>({ testType: 'NGS_DNA', laboratory: '', platform: '', panelName: '', genesAnalyzed: '', meanDepth: '', limitOfDetectionPct: '', testDate: '', notes: '' });
  const m = useMutation({
    mutationFn: () => gateway.createTest(sampleId, {
      testType: values.testType as MolecularTestType, laboratory: toNull(values.laboratory), platform: toNull(values.platform), panelName: toNull(values.panelName),
      genesAnalyzed: String(values.genesAnalyzed ?? '').split(/[\s,;]+/).map((g) => g.trim()).filter(Boolean),
      meanDepth: toNum(values.meanDepth), limitOfDetectionPct: toNum(values.limitOfDetectionPct), testDate: toNull(values.testDate), notes: toNull(values.notes),
    }),
    onSuccess: () => { invalidate(); onClose(); },
  });
  const v = (k: string) => (values[k] as string) ?? '';
  return (
    <FormDialog title="Añadir estudio molecular" onClose={onClose} onSubmit={() => m.mutate()} pending={m.isPending} error={m.error}>
      <div className="form-grid">
        <Field label="Tipo de estudio">
          <select value={v('testType')} onChange={set('testType')}><Options labels={TEST_TYPE_LABEL} /></select>
        </Field>
        <Field label="Fecha"><input type="date" value={v('testDate')} onChange={set('testDate')} /></Field>
        <Field label="Laboratorio"><input value={v('laboratory')} onChange={set('laboratory')} /></Field>
        <Field label="Plataforma"><input value={v('platform')} onChange={set('platform')} /></Field>
        <Field label="Panel"><input value={v('panelName')} onChange={set('panelName')} /></Field>
        <Field label="Profundidad media (x)" error={fieldError(m.error, 'meanDepth')}><input inputMode="numeric" value={v('meanDepth')} onChange={set('meanDepth')} /></Field>
        <Field label="Límite de detección (%)" error={fieldError(m.error, 'limitOfDetectionPct')}><input inputMode="decimal" value={v('limitOfDetectionPct')} onChange={set('limitOfDetectionPct')} /></Field>
        <Field label="Genes analizados" hint="separados por comas" className="span-all" error={fieldError(m.error, 'genesAnalyzed')}>
          <textarea value={v('genesAnalyzed')} onChange={set('genesAnalyzed')} placeholder="EGFR, KRAS, BRAF, ALK, TP53" style={{ minHeight: 60 }} />
        </Field>
        <Field label="Notas" className="span-all"><textarea value={v('notes')} onChange={set('notes')} /></Field>
      </div>
      <div className="row">
        <WhyItMatters term="ngs" label="¿Qué es NGS?" />
        <WhyItMatters term="coverage" label="¿Por qué importa la cobertura?" />
        <WhyItMatters term="lod" label="¿Qué es el límite de detección?" />
      </div>
    </FormDialog>
  );
}

export function VariantDialog({ caseId, testId, onClose }: { caseId: string; testId: string; onClose: () => void }) {
  const { gateway } = useGateway();
  const invalidate = useInvalidateCase(caseId);
  const { values, set } = useForm<Record<string, unknown>>({
    geneSymbol: '', variantType: 'SNV', transcript: '', hgvsC: '', hgvsP: '', vaf: '', coverage: '', copyNumber: '', fusionPartnerSymbol: '',
    origin: 'SOMATIC', classification: '', classificationSystem: '', observations: '',
  });
  const m = useMutation({
    mutationFn: () => gateway.addVariant(testId, {
      geneSymbol: String(values.geneSymbol).trim(), variantType: values.variantType as VariantType, transcript: toNull(values.transcript),
      hgvsC: toNull(values.hgvsC), hgvsP: toNull(values.hgvsP), vaf: toNum(values.vaf), coverage: toNum(values.coverage), copyNumber: toNum(values.copyNumber),
      fusionPartnerSymbol: toNull(values.fusionPartnerSymbol), origin: values.origin as VariantOrigin, classification: toNull(values.classification),
      classificationSystem: toNull(values.classificationSystem), observations: toNull(values.observations),
    }),
    onSuccess: () => { invalidate(); onClose(); },
  });
  const v = (k: string) => (values[k] as string) ?? '';
  const type = v('variantType');
  return (
    <FormDialog title="Añadir variante" onClose={onClose} onSubmit={() => m.mutate()} pending={m.isPending} error={m.error}>
      <div className="form-grid">
        <Field label="Gen (símbolo HGNC)" error={fieldError(m.error, 'geneSymbol')}><input value={v('geneSymbol')} onChange={set('geneSymbol')} placeholder="EGFR" required /></Field>
        <Field label="Tipo">
          <select value={type} onChange={set('variantType')}><Options labels={VARIANT_TYPE_LABEL} /></select>
        </Field>
        <Field label="Origen">
          <select value={v('origin')} onChange={set('origin')}><Options labels={ORIGIN_LABEL} /></select>
        </Field>
        <Field label="Transcrito"><input value={v('transcript')} onChange={set('transcript')} placeholder="NM_005228.5" /></Field>
        <Field label="HGVS c."><input value={v('hgvsC')} onChange={set('hgvsC')} placeholder="c.2573T>G" /></Field>
        <Field label="HGVS p."><input value={v('hgvsP')} onChange={set('hgvsP')} placeholder="p.L858R o p.Leu858Arg" /></Field>
        <Field label="VAF (%)" error={fieldError(m.error, 'vaf')}><input inputMode="decimal" value={v('vaf')} onChange={set('vaf')} /></Field>
        <Field label="Cobertura (lecturas)"><input inputMode="numeric" value={v('coverage')} onChange={set('coverage')} /></Field>
        {type === 'CNV' && <Field label="Número de copias"><input inputMode="decimal" value={v('copyNumber')} onChange={set('copyNumber')} /></Field>}
        {type === 'FUSION' && <Field label="Gen compañero"><input value={v('fusionPartnerSymbol')} onChange={set('fusionPartnerSymbol')} placeholder="EML4" /></Field>}
        <Field label="Clasificación" hint="introducida por el equipo"><input value={v('classification')} onChange={set('classification')} /></Field>
        <Field label="Sistema de clasificación"><input value={v('classificationSystem')} onChange={set('classificationSystem')} /></Field>
        <Field label="Observaciones" className="span-all"><textarea value={v('observations')} onChange={set('observations')} /></Field>
      </div>
      <div className="row">
        <WhyItMatters term="vaf" label="¿Qué es la VAF?" />
        <WhyItMatters term="hgvs" label="Nomenclatura HGVS" />
        <WhyItMatters term={type === 'CNV' ? 'cnv' : type === 'FUSION' ? 'fusion' : type === 'INDEL' ? 'indel' : 'snv'} label={`¿Qué es ${VARIANT_TYPE_LABEL[type as VariantType]}?`} />
      </div>
    </FormDialog>
  );
}

export function BiomarkerDialog({ caseId, testId, onClose }: { caseId: string; testId: string; onClose: () => void }) {
  const { gateway } = useGateway();
  const invalidate = useInvalidateCase(caseId);
  const { values, set } = useForm<Record<string, unknown>>({ biomarkerType: 'TMB', name: '', valueNumeric: '', valueText: '', unit: '', observations: '' });
  const m = useMutation({
    mutationFn: () => gateway.addBiomarker(testId, {
      biomarkerType: values.biomarkerType as BiomarkerType, name: String(values.name).trim(), valueNumeric: toNum(values.valueNumeric),
      valueText: toNull(values.valueText), unit: toNull(values.unit), observations: toNull(values.observations),
    }),
    onSuccess: () => { invalidate(); onClose(); },
  });
  const v = (k: string) => (values[k] as string) ?? '';
  return (
    <FormDialog title="Añadir biomarcador" onClose={onClose} onSubmit={() => m.mutate()} pending={m.isPending} error={m.error}>
      <div className="form-grid">
        <Field label="Tipo"><select value={v('biomarkerType')} onChange={set('biomarkerType')}><Options labels={BIOMARKER_TYPE_LABEL} /></select></Field>
        <Field label="Nombre" error={fieldError(m.error, 'name')}><input value={v('name')} onChange={set('name')} placeholder="Carga mutacional tumoral" required /></Field>
        <Field label="Valor numérico"><input inputMode="decimal" value={v('valueNumeric')} onChange={set('valueNumeric')} /></Field>
        <Field label="Unidad"><input value={v('unit')} onChange={set('unit')} placeholder="mut/Mb" /></Field>
        <Field label="Valor textual"><input value={v('valueText')} onChange={set('valueText')} placeholder="MSI-H" /></Field>
        <Field label="Observaciones" className="span-all"><textarea value={v('observations')} onChange={set('observations')} /></Field>
      </div>
      <div className="row">
        <WhyItMatters term="tmb" label="¿Qué es TMB?" />
        <WhyItMatters term="msi" label="¿Qué es MSI?" />
      </div>
    </FormDialog>
  );
}

// ─── evolución y razonamiento ───────────────────────────────────────────────
export function TimelineEventDialog({ caseId, samples, onClose }: { caseId: string; samples: Sample[]; onClose: () => void }) {
  const { gateway } = useGateway();
  const invalidate = useInvalidateCase(caseId);
  const { values, set } = useForm<Record<string, unknown>>({ eventType: 'PROGRESSION', eventDate: '', title: '', description: '', sampleId: '' });
  const m = useMutation({
    mutationFn: () => gateway.createTimelineEvent(caseId, {
      eventType: values.eventType as TimelineEventType, eventDate: String(values.eventDate), title: String(values.title).trim(),
      description: toNull(values.description), sampleId: toNull(values.sampleId),
    }),
    onSuccess: () => { invalidate(); onClose(); },
  });
  const v = (k: string) => (values[k] as string) ?? '';
  return (
    <FormDialog title="Añadir evento temporal" onClose={onClose} onSubmit={() => m.mutate()} pending={m.isPending} error={m.error}>
      <div className="form-grid">
        <Field label="Tipo de evento"><select value={v('eventType')} onChange={set('eventType')}><Options labels={EVENT_TYPE_LABEL} /></select></Field>
        <Field label="Fecha" error={fieldError(m.error, 'eventDate')}><input type="date" value={v('eventDate')} onChange={set('eventDate')} required /></Field>
        <Field label="Título" className="span-all" error={fieldError(m.error, 'title')}><input value={v('title')} onChange={set('title')} required maxLength={200} /></Field>
        <Field label="Muestra asociada">
          <select value={v('sampleId')} onChange={set('sampleId')}>
            <option value="">—</option>
            {samples.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Descripción" className="span-all"><textarea value={v('description')} onChange={set('description')} /></Field>
      </div>
    </FormDialog>
  );
}

export function InterpretationDialog({ caseId, targetType, targetId, targetLabel, supersedesId, onClose }: {
  caseId: string; targetType: TargetType; targetId: string; targetLabel: string; supersedesId?: string | null; onClose: () => void;
}) {
  const { gateway } = useGateway();
  const invalidate = useInvalidateCase(caseId);
  const { values, set } = useForm<Record<string, unknown>>({ statement: '', certainty: 'UNKNOWN' });
  const m = useMutation({
    mutationFn: () => gateway.createInterpretation(caseId, {
      targetType, targetId, statement: String(values.statement).trim(), certainty: values.certainty as Certainty, supersedesId: supersedesId ?? null,
    }),
    onSuccess: () => { invalidate(); onClose(); },
  });
  return (
    <FormDialog title={supersedesId ? 'Sustituir interpretación' : 'Documentar interpretación'} onClose={onClose} onSubmit={() => m.mutate()} pending={m.isPending} error={m.error}>
      <p className="small muted">Sobre: <strong>{targetLabel}</strong>. La interpretación queda firmada con su autor, rol y fecha; no se edita, sólo puede sustituirse (la anterior queda visible).</p>
      <Field label="Interpretación documentada" error={fieldError(m.error, 'statement')}>
        <textarea value={(values.statement as string) ?? ''} onChange={set('statement')} maxLength={10000} style={{ minHeight: 120 }} required />
      </Field>
      <Field label="Certeza asignada por usted" hint="explícita, nunca inferida">
        <select value={values.certainty as string} onChange={set('certainty')}>
          {CERTAINTY_ORDER.map((c) => <option key={c} value={c}>{CERTAINTY_LABEL[c]}</option>)}
        </select>
      </Field>
      <div className="alert warn small">Documente razonamiento, no órdenes clínicas: MolPath no emite diagnósticos ni recomendaciones de tratamiento.</div>
    </FormDialog>
  );
}
