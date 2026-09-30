import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CertaintyBadge, Dialog, Disclaimer, Empty, ErrorBox, Field, Loading, PageHead, Pager, fieldError, toNull } from '../../components/ui';
import { useGateway } from '../../data/GatewayProvider';
import { WhyItMatters } from '../../education/WhyItMatters';
import { CERTAINTY_LABEL, CERTAINTY_ORDER, EVIDENCE_TYPE_LABEL, SCOPE_LABEL, SOURCE_LABEL, STATUS_LABEL, formatDate } from '../../domain/labels';
import type { Certainty, EvidenceFilter, EvidenceStatus, EvidenceType, InterpretationScope } from '../../domain/types';
import { ClinVarPanel, EvidenceCard, EvidenceHistory, ExternalEvidenceFinder, ReclassifyEvidence } from './knowledgeComponents';

export function EvidencePage() {
  const { gateway } = useGateway();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<EvidenceFilter>({ gene: params.get('gene') ?? '', variant: '', type: '', certainty: '', source: '', status: '', q: '' });
  const [page, setPage] = useState(0);
  const [tab, setTab] = useState<'library' | 'external'>('library');
  const [manual, setManual] = useState(false);
  const list = useQuery({ queryKey: ['evidence', filter, page], queryFn: () => gateway.listEvidence(filter, page, 20), placeholderData: keepPreviousData });
  const openId = params.get('id');
  const set = (k: keyof EvidenceFilter) => (e: { target: { value: string } }) => { setFilter((f) => ({ ...f, [k]: e.target.value })); setPage(0); };

  return (
    <>
      <PageHead title="Evidencias" sub="Biblioteca de evidencias con fuente, versión y fecha de consulta" actions={<button className="btn" onClick={() => setManual(true)}>Registrar evidencia manual</button>} />
      <Disclaimer>Las asociaciones mostradas proceden de fuentes registradas; no son recomendaciones clínicas.</Disclaimer>
      <div className="tabs">
        <button className={tab === 'library' ? 'active' : ''} onClick={() => setTab('library')}>Biblioteca</button>
        <button className={tab === 'external' ? 'active' : ''} onClick={() => setTab('external')}>Consultar fuentes externas</button>
      </div>

      {tab === 'library' && (
        <div className="card">
          <div className="card-body form-grid">
            <Field label="Gen"><input value={filter.gene} onChange={set('gene')} placeholder="EGFR" /></Field>
            <Field label="Variante"><input value={filter.variant} onChange={set('variant')} placeholder="L858R" /></Field>
            <Field label="Tipo"><select value={filter.type} onChange={set('type')}><option value="">Todos</option>{(Object.keys(EVIDENCE_TYPE_LABEL) as EvidenceType[]).map((t) => <option key={t} value={t}>{EVIDENCE_TYPE_LABEL[t]}</option>)}</select></Field>
            <Field label="Certeza"><select value={filter.certainty} onChange={set('certainty')}><option value="">Todas</option>{CERTAINTY_ORDER.map((c) => <option key={c} value={c}>{CERTAINTY_LABEL[c]}</option>)}</select></Field>
            <Field label="Fuente"><select value={filter.source} onChange={set('source')}><option value="">Todas</option>{['CIVIC', 'CLINVAR', 'MANUAL'].map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}</select></Field>
            <Field label="Estado"><select value={filter.status} onChange={set('status')}><option value="">Todos</option>{(Object.keys(STATUS_LABEL) as EvidenceStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></Field>
            <Field label="Texto" className="span-all"><input value={filter.q} onChange={set('q')} placeholder="descripción, contexto, identificador" /></Field>
          </div>
          <ErrorBox error={list.error} />
          {list.isLoading ? <Loading /> : list.data?.items.length === 0 ? <Empty>No hay evidencias con estos filtros.</Empty> : (
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Gen / variante</th><th>Tipo</th><th>Contexto</th><th>Fuente</th><th>Certeza</th><th>Estado</th><th>Consultado</th></tr></thead>
                <tbody>
                  {list.data?.items.map((e) => (
                    <tr key={e.id} className="clickable" onClick={() => setParams({ id: e.id })}>
                      <td className="mono">{e.geneSymbol} {e.variantDescriptor}</td>
                      <td>{EVIDENCE_TYPE_LABEL[e.evidenceType]}</td>
                      <td className="small">{e.diseaseContext ?? '—'}</td>
                      <td className="small">{SOURCE_LABEL[e.sourceCode] ?? e.sourceCode} <span className="mono">{e.externalId}</span></td>
                      <td><CertaintyBadge certainty={e.certainty} basis={e.certaintyBasis} short /></td>
                      <td className="small">{STATUS_LABEL[e.status]}</td>
                      <td className="small muted">{formatDate(e.retrievedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager page={page} totalPages={list.data?.totalPages ?? 0} onPage={setPage} />
        </div>
      )}

      {tab === 'external' && <ExternalSearch />}
      {openId && <EvidenceDialog id={openId} onClose={() => setParams({})} />}
      {manual && <ManualEvidenceDialog onClose={() => setManual(false)} />}
    </>
  );
}

function EvidenceDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { gateway } = useGateway();
  const q = useQuery({ queryKey: ['evidence', 'one', id], queryFn: () => gateway.getEvidence(id) });
  return (
    <Dialog title="Evidencia · trazabilidad" onClose={onClose}>
      {q.isLoading && <Loading />}
      <ErrorBox error={q.error} />
      {q.data && <div className="stack"><EvidenceCard e={q.data} /><ReclassifyEvidence e={q.data} /><EvidenceHistory evidenceId={q.data.id} /></div>}
    </Dialog>
  );
}

function ExternalSearch() {
  const [gene, setGene] = useState('');
  const [variant, setVariant] = useState('');
  const [submitted, setSubmitted] = useState<{ gene: string; variant: string } | null>(null);
  const submit = (e: FormEvent) => { e.preventDefault(); if (gene.trim() && variant.trim()) setSubmitted({ gene: gene.trim().toUpperCase(), variant: variant.trim() }); };
  return (
    <div className="stack">
      <form className="card" onSubmit={submit}>
        <div className="card-body row">
          <Field label="Gen"><input value={gene} onChange={(e) => setGene(e.target.value)} placeholder="BRAF" /></Field>
          <Field label="Variante (p.)"><input value={variant} onChange={(e) => setVariant(e.target.value)} placeholder="V600E o p.Val600Glu" /></Field>
          <button className="btn primary" style={{ alignSelf: 'flex-end' }}>Consultar CIViC y ClinVar</button>
        </div>
      </form>
      {submitted && (
        <div className="grid grid-2">
          <section className="card"><div className="card-head"><h2>CIViC</h2></div><div className="card-body"><ExternalEvidenceFinder gene={submitted.gene} variant={submitted.variant} /></div></section>
          <section className="card"><div className="card-head"><h2>ClinVar</h2></div><div className="card-body"><ClinVarPanel gene={submitted.gene} variant={submitted.variant} /></div></section>
        </div>
      )}
      <p className="small muted">Para enlazar evidencia a una variante concreta de un caso, ábrala desde la pizarra (pestaña «Fuentes externas» del nodo de la variante).</p>
    </div>
  );
}

function ManualEvidenceDialog({ onClose }: { onClose: () => void }) {
  const { gateway } = useGateway();
  const qc = useQueryClient();
  const [v, setV] = useState<Record<string, string>>({ geneSymbol: '', variantDescriptor: '', evidenceType: 'FUNCTIONAL', description: '', diseaseContext: '', certainty: 'UNKNOWN', interpretationScope: 'NOT_APPLICABLE', pmid: '', doi: '', url: '', publishedDate: '' });
  const set = (k: string) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));
  const m = useMutation({
    mutationFn: () => gateway.createManualEvidence({
      geneSymbol: toNull(v.geneSymbol)?.toUpperCase() ?? null, variantDescriptor: toNull(v.variantDescriptor), evidenceType: v.evidenceType as EvidenceType,
      description: v.description.trim(), diseaseContext: toNull(v.diseaseContext), certainty: v.certainty as Certainty,
      interpretationScope: v.interpretationScope as InterpretationScope, pmid: toNull(v.pmid), doi: toNull(v.doi), url: toNull(v.url), publishedDate: toNull(v.publishedDate),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['evidence'] }); qc.invalidateQueries({ queryKey: ['publications'] }); onClose(); },
  });
  return (
    <Dialog title="Registrar evidencia manual" onClose={onClose}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); m.mutate(); }} noValidate>
        <div className="alert info small">Debe citar la fuente con PMID (se verifica en PubMed antes de guardar), DOI o URL. No se aceptan PMIDs inexistentes.</div>
        <div className="form-grid">
          <Field label="Gen" error={fieldError(m.error, 'geneSymbol')}><input value={v.geneSymbol} onChange={set('geneSymbol')} /></Field>
          <Field label="Variante"><input value={v.variantDescriptor} onChange={set('variantDescriptor')} placeholder="p.L858R" /></Field>
          <Field label="Tipo"><select value={v.evidenceType} onChange={set('evidenceType')}>{(Object.keys(EVIDENCE_TYPE_LABEL) as EvidenceType[]).map((t) => <option key={t} value={t}>{EVIDENCE_TYPE_LABEL[t]}</option>)}</select></Field>
          <Field label="Ámbito"><select value={v.interpretationScope} onChange={set('interpretationScope')}>{(Object.keys(SCOPE_LABEL) as InterpretationScope[]).map((t) => <option key={t} value={t}>{SCOPE_LABEL[t]}</option>)}</select></Field>
          <Field label="Extracto / resumen estructurado" className="span-all" error={fieldError(m.error, 'description')}><textarea value={v.description} onChange={set('description')} maxLength={10000} /></Field>
          <Field label="Enfermedad / contexto"><input value={v.diseaseContext} onChange={set('diseaseContext')} /></Field>
          <Field label="Certeza (asignada por usted)"><select value={v.certainty} onChange={set('certainty')}>{CERTAINTY_ORDER.map((c) => <option key={c} value={c}>{CERTAINTY_LABEL[c]}</option>)}</select></Field>
          <Field label="PMID" error={fieldError(m.error, 'pmid')}><input value={v.pmid} onChange={set('pmid')} inputMode="numeric" /></Field>
          <Field label="DOI" error={fieldError(m.error, 'doi')}><input value={v.doi} onChange={set('doi')} placeholder="10.xxxx/..." /></Field>
          <Field label="URL" error={fieldError(m.error, 'url')}><input value={v.url} onChange={set('url')} placeholder="https://" /></Field>
          <Field label="Fecha de publicación"><input value={v.publishedDate} onChange={set('publishedDate')} placeholder="2024 Mar" /></Field>
        </div>
        <WhyItMatters term="evidence-level" label="¿Cómo se asigna la certeza?" />
        <ErrorBox error={m.error} />
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" disabled={m.isPending}>{m.isPending ? 'Verificando…' : 'Registrar'}</button>
        </div>
      </form>
    </Dialog>
  );
}
