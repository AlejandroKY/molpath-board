import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { CertaintyBadge, Empty, ErrorBox, Field, Loading, SourceButton } from '../../components/ui';
import { useGateway } from '../../data/GatewayProvider';
import { WhyItMatters } from '../../education/WhyItMatters';
import {
  BASIS_LABEL,
  CERTAINTY_LABEL,
  CERTAINTY_ORDER,
  EVIDENCE_TYPE_LABEL,
  SCOPE_LABEL,
  SOURCE_LABEL,
  STATUS_LABEL,
  formatDate,
  formatDateTime,
} from '../../domain/labels';
import type { Certainty, ClinVarAspect, ClinVarClassification, Evidence, EvidenceStatus } from '../../domain/types';

function useInvalidateKnowledge() {
  const qc = useQueryClient();
  return () => {
    for (const key of ['board', 'evidence', 'dashboard', 'publications', 'search', 'external-evidence', 'clinvar', 'pathways', 'evidence-history'])
      qc.invalidateQueries({ queryKey: [key] });
  };
}

/** Ficha de trazabilidad completa de una evidencia. */
export function EvidenceCard({ e, compact }: { e: Evidence; compact?: boolean }) {
  return (
    <div className="stack">
      <div className="row between">
        <div className="row" style={{ gap: 6 }}>
          <span className="badge layer-knowledge">{SOURCE_LABEL[e.sourceCode] ?? e.sourceCode}</span>
          <span className="badge">{EVIDENCE_TYPE_LABEL[e.evidenceType]}</span>
          {e.status !== 'ACTIVE' && <span className="badge danger">{STATUS_LABEL[e.status]}</span>}
        </div>
        <CertaintyBadge certainty={e.certainty} basis={e.certaintyBasis} />
      </div>
      {e.evidenceType === 'PREDICTIVE' || e.evidenceType === 'THERAPEUTIC' ? (
        <div className="alert warn small">Asociación registrada en la fuente para el contexto indicado. No es una recomendación de tratamiento para ningún paciente.</div>
      ) : null}
      <div className="quote">{e.description}</div>
      <dl className="facts">
        <dt>Gen / variante</dt><dd className="mono">{e.geneSymbol ?? '—'} {e.variantDescriptor ?? ''}</dd>
        <dt>Contexto</dt><dd>{e.diseaseContext ?? 'No indicado por la fuente'}</dd>
        <dt>Certeza</dt><dd>{CERTAINTY_LABEL[e.certainty]} <span className="muted small">· {BASIS_LABEL[e.certaintyBasis]}</span></dd>
        <dt>Nivel en la fuente</dt><dd>{e.sourceLevel ?? '—'}{e.sourceDirection && ` · dirección ${e.sourceDirection}`}{e.sourceSignificance && ` · ${e.sourceSignificance}`}{e.sourceRating != null && ` · valoración ${e.sourceRating}`}</dd>
        <dt>Ámbito</dt><dd>{SCOPE_LABEL[e.interpretationScope]}</dd>
        {e.sourceTherapies && (<><dt>Terapias en el registro</dt><dd className="small">{e.sourceTherapies} <span className="muted">(tal como constan en la fuente)</span></dd></>)}
        {!compact && (
          <>
            <dt>Base de datos</dt><dd>{SOURCE_LABEL[e.sourceCode] ?? e.sourceCode}{e.externalId && <> · <span className="mono">{e.externalId}</span></>}</dd>
            <dt>PMID</dt><dd>{e.pmid ? <a href={e.pubmedUrl!} target="_blank" rel="noopener noreferrer" className="mono">{e.pmid}</a> : '—'}</dd>
            <dt>DOI</dt><dd>{e.doi ? <a href={`https://doi.org/${e.doi}`} target="_blank" rel="noopener noreferrer" className="mono">{e.doi}</a> : '—'}</dd>
            <dt>Fecha de publicación</dt><dd>{e.publishedDate ?? '—'}</dd>
            <dt>Versión de la fuente</dt><dd>{e.sourceVersionLabel ?? '—'}</dd>
            <dt>Consultado por MolPath</dt><dd>{formatDateTime(e.retrievedAt)}</dd>
            <dt>Identificador interno</dt><dd className="mono tiny">{e.id}</dd>
            {e.statusReason && (<><dt>Motivo del estado</dt><dd>{e.statusReason}</dd></>)}
          </>
        )}
      </dl>
      <div className="row">
        <SourceButton href={e.url ?? e.pubmedUrl} />
        {e.pubmedUrl && e.url && <SourceButton href={e.pubmedUrl} label="Ver en PubMed" />}
        <WhyItMatters term="evidence-level" label="¿Cómo se asigna la certeza?" />
      </div>
    </div>
  );
}

export function ReclassifyEvidence({ e }: { e: Evidence }) {
  const { gateway } = useGateway();
  const invalidate = useInvalidateKnowledge();
  const [open, setOpen] = useState(false);
  const [certainty, setCertainty] = useState<Certainty>(e.certainty);
  const [status, setStatus] = useState<EvidenceStatus>(e.status);
  const [reason, setReason] = useState(e.statusReason ?? '');
  const m = useMutation({
    mutationFn: () => gateway.classifyEvidence(e.id, { certainty, status, reason: reason.trim() || null, version: e.version }),
    onSuccess: () => { invalidate(); setOpen(false); },
  });
  if (!open) return <button className="btn small" onClick={() => setOpen(true)}>Clasificar / cambiar estado</button>;
  const submit = (ev: FormEvent) => { ev.preventDefault(); m.mutate(); };
  return (
    <form onSubmit={submit} className="stack" style={{ border: '1px solid var(--line)', borderRadius: 6, padding: 10 }}>
      <p className="small muted">Su clasificación queda registrada como <strong>asignada explícitamente por un usuario</strong> y el estado anterior se conserva en el historial.</p>
      <div className="form-grid">
        <Field label="Certeza">
          <select value={certainty} onChange={(x) => setCertainty(x.target.value as Certainty)}>
            {CERTAINTY_ORDER.map((c) => <option key={c} value={c}>{CERTAINTY_LABEL[c]}</option>)}
          </select>
        </Field>
        <Field label="Estado">
          <select value={status} onChange={(x) => setStatus(x.target.value as EvidenceStatus)}>
            {(Object.keys(STATUS_LABEL) as EvidenceStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </Field>
        <Field label="Motivo" hint="obligatorio si se retira o sustituye" className="span-all">
          <input value={reason} onChange={(x) => setReason(x.target.value)} maxLength={2000} />
        </Field>
      </div>
      <ErrorBox error={m.error} />
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn small" onClick={() => setOpen(false)}>Cancelar</button>
        <button className="btn primary small" disabled={m.isPending}>Guardar clasificación</button>
      </div>
    </form>
  );
}

export function EvidenceHistory({ evidenceId }: { evidenceId: string }) {
  const { gateway } = useGateway();
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ['evidence-history', evidenceId], queryFn: () => gateway.evidenceHistory(evidenceId), enabled: open });
  if (!open) return <button className="btn ghost small" onClick={() => setOpen(true)}>Ver historial</button>;
  return (
    <div className="stack small">
      <strong>Historial (auditoría)</strong>
      {q.isLoading && <Loading />}
      {q.data?.length === 0 && <span className="muted">Sin cambios registrados (dato sembrado del dataset demo).</span>}
      {q.data?.map((h, i) => {
        const before = h.beforeState ? JSON.parse(h.beforeState) : null;
        const after = h.afterState ? JSON.parse(h.afterState) : null;
        return (
          <div key={i}>
            <span className="mono">{formatDateTime(h.occurredAt)}</span> · <strong>{h.action}</strong>
            {before && after && (before.certainty !== after.certainty || before.status !== after.status) && (
              <span> — certeza {before.certainty} → {after.certainty}; estado {before.status} → {after.status}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Consulta en vivo a CIViC (y OncoKB, desactivado) e importación verificada con enlace opcional a variante. */
export function ExternalEvidenceFinder({ gene, variant, variantId }: { gene: string; variant: string; variantId?: string }) {
  const { gateway } = useGateway();
  const invalidate = useInvalidateKnowledge();
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const cursor = cursors[cursors.length - 1];
  const q = useQuery({
    queryKey: ['external-evidence', 'CIVIC', gene, variant, cursor],
    queryFn: () => gateway.searchExternalEvidence('CIVIC', gene, variant, 10, cursor),
    enabled: !!gene && !!variant,
    staleTime: 5 * 60_000,
  });
  const imp = useMutation({
    mutationFn: (externalId: string) => gateway.importExternalEvidence('CIVIC', externalId, variantId ?? null, null),
    onSuccess: invalidate,
  });
  const r = q.data?.result;
  return (
    <div className="stack">
      <div className="small muted">Consulta en vivo a CIViC · perfil «{gene} {variant}». Al importar, el registro se vuelve a verificar en la fuente y se guarda con su versión y fecha de consulta.</div>
      {q.isLoading && <Loading label="Consultando CIViC…" />}
      <ErrorBox error={q.error ?? imp.error} />
      {r && r.items.length === 0 && <Empty>{r.note ?? 'Sin resultados.'}</Empty>}
      {r && r.items.length > 0 && <div className="small muted">{r.totalCount} evidencia(s) aceptada(s) en CIViC para {r.matchedProfile}. {r.note}</div>}
      {r?.items.map((c) => {
        const imported = q.data!.importedEvidenceIds[c.externalId];
        return (
          <div key={c.externalId} className="card" style={{ boxShadow: 'none' }}>
            <div className="card-body stack" style={{ gap: 6 }}>
              <div className="row between">
                <span className="row" style={{ gap: 6 }}>
                  <a className="mono" href={c.url} target="_blank" rel="noopener noreferrer">{c.externalId}</a>
                  <span className="badge">{EVIDENCE_TYPE_LABEL[c.evidenceType]}</span>
                  <span className="badge">Nivel {c.sourceLevel ?? '—'}</span>
                  {c.sourceDirection === 'DOES_NOT_SUPPORT' && <span className="badge warn">No apoya</span>}
                </span>
                <CertaintyBadge certainty={c.mappedCertainty} basis={c.mappedCertainty === 'UNKNOWN' ? 'NONE' : 'SOURCE_MAPPING'} short />
              </div>
              <div className="small">{c.description.length > 320 ? `${c.description.slice(0, 319)}…` : c.description}</div>
              <div className="tiny muted">{c.diseaseContext} · {c.citation}{c.pmid && <> · PMID <span className="mono">{c.pmid}</span></>}{c.therapies.length > 0 && ` · terapias registradas: ${c.therapies.join(', ')}`}</div>
              <div className="row">
                {imported ? <span className="badge c-STRONG">Ya importada{variantId ? '' : ''}</span> : null}
                <button className="btn small" disabled={imp.isPending} onClick={() => imp.mutate(c.externalId)}>
                  {imported ? (variantId ? 'Enlazar a esta variante' : 'Ya en la biblioteca') : variantId ? 'Importar y enlazar' : 'Importar'}
                </button>
              </div>
            </div>
          </div>
        );
      })}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        {cursors.length > 1 && <button className="btn small" onClick={() => setCursors((c) => c.slice(0, -1))}>Anteriores</button>}
        {r?.nextCursor && <button className="btn small" onClick={() => setCursors((c) => [...c, r.nextCursor])}>Siguientes</button>}
      </div>
    </div>
  );
}

function ClassificationBlock({ title, c }: { title: string; c: ClinVarClassification }) {
  return (
    <div>
      <div className="kicker">{title}</div>
      {c.description ? (
        <div className="small">
          <strong>{c.description}</strong> <span className="muted">· {c.reviewStatus}{c.lastEvaluated && ` · evaluado ${c.lastEvaluated}`}</span>
          {c.conditions.length > 0 && <div className="tiny muted">{c.conditions.slice(0, 4).join('; ')}</div>}
        </div>
      ) : <div className="small muted">Sin clasificación registrada.</div>}
    </div>
  );
}

/** ClinVar con interpretación germinal y somática claramente separadas. */
export function ClinVarPanel({ gene, variant, variantId }: { gene: string; variant: string; variantId?: string }) {
  const { gateway } = useGateway();
  const invalidate = useInvalidateKnowledge();
  const q = useQuery({ queryKey: ['clinvar', gene, variant], queryFn: () => gateway.searchClinVar(gene, variant), enabled: !!gene && !!variant, staleTime: 5 * 60_000 });
  const imp = useMutation({
    mutationFn: ({ uid, aspect }: { uid: string; aspect: ClinVarAspect }) => gateway.importClinVar(uid, aspect, variantId ?? null, null),
    onSuccess: invalidate,
  });
  return (
    <div className="stack">
      <div className="row between"><span className="small muted">Consulta en vivo a ClinVar (NCBI E-utilities).</span><WhyItMatters term="germline-somatic" label="Germinal vs somático" /></div>
      {q.isLoading && <Loading label="Consultando ClinVar…" />}
      <ErrorBox error={q.error ?? imp.error} />
      {q.data && q.data.records.length === 0 && <Empty>ClinVar no devolvió registros para esta variante.</Empty>}
      {q.data?.records.map((r) => (
        <div key={r.uid} className="card" style={{ boxShadow: 'none' }}>
          <div className="card-body stack" style={{ gap: 8 }}>
            <div className="row between"><a href={r.url} target="_blank" rel="noopener noreferrer" className="mono small">{r.accession}</a><span className="tiny muted">{r.title}</span></div>
            <div className="grid grid-2" style={{ gap: 10 }}>
              <div style={{ borderLeft: '3px solid var(--layer-reasoning)', paddingLeft: 8 }}>
                <ClassificationBlock title="Interpretación germinal" c={r.germline} />
                {r.germline.description && (
                  <button className="btn small" style={{ marginTop: 6 }} disabled={imp.isPending} onClick={() => imp.mutate({ uid: r.uid, aspect: 'GERMLINE' })}>
                    {q.data!.importedEvidenceIds[`${r.accession}:GERMLINE`] ? 'Importada · enlazar' : 'Importar (germinal)'}
                  </button>
                )}
              </div>
              <div style={{ borderLeft: '3px solid var(--layer-case)', paddingLeft: 8 }} className="stack">
                <ClassificationBlock title="Somático · impacto clínico (sólo referencia)" c={r.somaticClinicalImpact} />
                <ClassificationBlock title="Somático · oncogenicidad" c={r.oncogenicity} />
                {r.oncogenicity.description && (
                  <button className="btn small" disabled={imp.isPending} onClick={() => imp.mutate({ uid: r.uid, aspect: 'ONCOGENICITY' })}>
                    {q.data!.importedEvidenceIds[`${r.accession}:ONCOGENICITY`] ? 'Importada · enlazar' : 'Importar (oncogenicidad)'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
      {q.data?.note && <p className="tiny muted">{q.data.note}</p>}
    </div>
  );
}

/** Pathways de Reactome para un gen: sólo relaciones verificadas en la fuente. */
export function PathwayImporter({ gene }: { gene: string }) {
  const { gateway } = useGateway();
  const invalidate = useInvalidateKnowledge();
  const [selected, setSelected] = useState<string[]>([]);
  const [filter, setFilter] = useState('');
  const q = useQuery({ queryKey: ['pathways', gene], queryFn: () => gateway.searchPathways(gene), staleTime: 10 * 60_000 });
  const imp = useMutation({ mutationFn: () => gateway.importPathways(gene, selected), onSuccess: () => { setSelected([]); invalidate(); } });
  const list = (q.data?.result.pathways ?? []).filter((p) => p.name.toLowerCase().includes(filter.toLowerCase()));
  return (
    <div className="stack">
      <div className="row between"><span className="small muted">Reactome: {gene} → UniProt {q.data?.result.uniprotId ?? '…'} → pathways que lo contienen.</span><WhyItMatters term="pathway" /></div>
      {q.isLoading && <Loading label="Consultando Reactome…" />}
      <ErrorBox error={q.error ?? imp.error} />
      {q.data?.result.note && <Empty>{q.data.result.note}</Empty>}
      {q.data && q.data.result.pathways.length > 0 && (
        <>
          <input placeholder="Filtrar pathways" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filtrar pathways" />
          <div style={{ maxHeight: 260, overflow: 'auto' }}>
            {list.map((p) => {
              const linked = q.data!.alreadyLinked.includes(p.externalId);
              return (
                <label key={p.externalId} className="checkbox" style={{ padding: '3px 0' }}>
                  <input type="checkbox" disabled={linked} checked={linked || selected.includes(p.externalId)}
                    onChange={(e) => setSelected((s) => (e.target.checked ? [...s, p.externalId] : s.filter((x) => x !== p.externalId)))} />
                  <span>{p.name} <a className="mono tiny" href={p.url} target="_blank" rel="noopener noreferrer">{p.externalId}</a>{linked && <span className="tiny muted"> · ya vinculado</span>}</span>
                </label>
              );
            })}
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn primary small" disabled={!selected.length || imp.isPending} onClick={() => imp.mutate()}>Importar {selected.length || ''} relación(es)</button>
          </div>
        </>
      )}
      <p className="tiny muted">Relaciones gen→gen dentro de una cascada (p. ej. EGFR→RAS→RAF): integración pendiente de fuente verificada.</p>
    </div>
  );
}

export function formatEvidenceTitle(e: Evidence) {
  return `${e.geneSymbol ?? ''} ${e.variantDescriptor ?? ''} · ${EVIDENCE_TYPE_LABEL[e.evidenceType]} · ${SOURCE_LABEL[e.sourceCode] ?? e.sourceCode}${e.externalId ? ` ${e.externalId}` : ''}`.trim();
}

export { formatDate };
