import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { CertaintyGlyph, DataOriginBadge, EmptyState, EvidenceSummary } from '../../components/scientific';
import { CertaintyBadge, SourceButton } from '../../components/ui';
import { WhyItMatters } from '../../education/WhyItMatters';
import { evidenceOfVariant, explainNode, summarizeEvidence } from '../../domain/caseInsights';
import { detectContradictions } from '../../domain/certainty';
import { KIND_LABEL, commentTarget, type BoardGraph, type BoardNode } from '../../domain/boardGraph';
import {
  EVIDENCE_TYPE_LABEL,
  IHC_INTENSITY_LABEL,
  IHC_RESULT_LABEL,
  ORIGIN_LABEL,
  QUALITY_LABEL,
  ROLE_LABEL,
  SAMPLE_TYPE_LABEL,
  SOURCE_LABEL,
  TEST_TYPE_LABEL,
  VARIANT_TYPE_LABEL,
  formatDate,
  formatDateTime,
  formatPct,
} from '../../domain/labels';
import type { CaseBoard } from '../../domain/types';
import { CommentThread } from '../discussion/CommentThread';
import { ClinVarPanel, EvidenceCard, EvidenceHistory, ExternalEvidenceFinder, PathwayImporter, ReclassifyEvidence } from '../evidence/knowledgeComponents';
import { InterpretationDialog } from '../cases/forms';
import { PublicationActions, VariantActions } from '../cases/QuickActions';

export type PanelTab = 'detail' | 'sources' | 'discussion';

interface Props {
  board: CaseBoard;
  graph: BoardGraph;
  node: BoardNode;
  collapsed: boolean;
  hiddenCount: number;
  onToggle: () => void;
  onSelect: (id: string) => void;
  focused: boolean;
  onFocus: () => void;
  initialTab?: PanelTab;
  readOnly?: boolean;
}

function originDetail(board: CaseBoard, node: BoardNode): string | undefined {
  if (node.kind === 'evidence') {
    const e = board.evidence.find((x) => x.id === node.entityId);
    return e ? `${SOURCE_LABEL[e.sourceCode] ?? e.sourceCode}${e.externalId ? ` ${e.externalId}` : ''}` : undefined;
  }
  if (node.kind === 'pathway') return 'Reactome';
  if (node.kind === 'publication') return 'PubMed';
  if (node.kind === 'gene') return 'NCBI Gene / Reactome';
  if (node.kind === 'interpretation') {
    const i = board.interpretations.find((x) => x.id === node.entityId);
    return i ? `${i.authorName ?? ''} · ${ROLE_LABEL[i.authorRole]} · ${formatDate(i.createdAt)}` : undefined;
  }
  return undefined;
}

export function NodePanel({ board, graph, node, collapsed, hiddenCount, onToggle, onSelect, focused, onFocus, initialTab = 'detail', readOnly }: Props) {
  const [tab, setTab] = useState<PanelTab>(initialTab);
  const [interpreting, setInterpreting] = useState(false);
  const [explain, setExplain] = useState(false);
  const children = graph.edges.filter((e) => e.source === node.id).map((e) => graph.nodes.find((n) => n.id === e.target)!).filter(Boolean);
  const parents = graph.edges.filter((e) => e.target === node.id).map((e) => graph.nodes.find((n) => n.id === e.source)!).filter(Boolean);
  const variant = node.kind === 'variant' ? board.variants.find((v) => v.id === node.entityId) : undefined;
  const gene = node.kind === 'gene' ? board.genes.find((g) => g.id === node.entityId) : undefined;
  const publication = node.kind === 'publication' ? board.publications.find((p) => p.id === node.entityId) : undefined;
  const target = commentTarget(node);
  const canSearchSources = !readOnly && ((!!variant && !!variant.proteinChange) || !!gene);

  return (
    <div>
      <div className="panel-section panel-head">
        <div className="row between">
          <span className="kicker">{KIND_LABEL[node.kind]}</span>
          <DataOriginBadge origin={node.layer} detail={originDetail(board, node)} />
        </div>
        <h2 style={{ marginTop: 4, overflowWrap: 'anywhere' }}>{node.title}</h2>
        {node.subtitle && <p className="small muted">{node.subtitle}</p>}
        {node.meta && <p className="small">{node.meta}</p>}
        <div className="row" style={{ marginTop: 6, gap: 6 }}>
          {node.certainty && <CertaintyBadge certainty={node.certainty} short />}
          {node.contradiction && <span className="badge danger"><span aria-hidden>⇄</span> Contradicción entre fuentes</span>}
          {node.inactive && <span className="badge danger">No vigente</span>}
        </div>
        <div className="panel-actions">
          <button className={`btn small ${focused ? 'primary' : ''}`} onClick={onFocus} aria-pressed={focused} title="Atajo: F">
            <Icon name="focus" /> {focused ? 'Salir de enfoque' : 'Enfocar'}
          </button>
          <button className="btn small" onClick={() => setExplain((x) => !x)} aria-expanded={explain}>
            <Icon name="route" /> Explicar esta ruta
          </button>
          {children.length > 0 && (
            <button className="btn small" onClick={onToggle} aria-expanded={!collapsed}>
              {collapsed ? `Expandir${hiddenCount ? ` (+${hiddenCount})` : ''}` : 'Contraer'}
            </button>
          )}
          {variant && !readOnly && <VariantActions caseId={board.caseRecord.id} variant={variant} onFocus={onFocus} onSources={() => setTab('sources')} />}
          {publication && <PublicationActions publication={publication} />}
        </div>
        {explain && (
          <div className="explain" style={{ marginTop: 10 }} aria-live="polite">
            <div className="kicker" style={{ marginBottom: 4 }}>Explicación generada a partir de los datos registrados</div>
            {explainNode(board, graph, node.id).map((s, i) => <p key={i}>{s}</p>)}
          </div>
        )}
      </div>

      <div className="tabs" style={{ padding: '0 8px', margin: 0 }} role="tablist">
        <button role="tab" aria-selected={tab === 'detail'} className={tab === 'detail' ? 'active' : ''} onClick={() => setTab('detail')}>Detalle</button>
        {canSearchSources && (
          <button role="tab" aria-selected={tab === 'sources'} className={tab === 'sources' ? 'active' : ''} onClick={() => setTab('sources')}>Fuentes externas</button>
        )}
        {!readOnly && (
          <button role="tab" aria-selected={tab === 'discussion'} className={tab === 'discussion' ? 'active' : ''} onClick={() => setTab('discussion')}>
            Discusión{node.commentCount ? ` (${node.commentCount})` : ''}
          </button>
        )}
      </div>

      {tab === 'detail' && (
        <>
          <div className="panel-section">
            <NodeDetail board={board} node={node} onSelect={onSelect} onSources={canSearchSources ? () => setTab('sources') : undefined} readOnly={readOnly} />
          </div>
          {!readOnly && node.kind !== 'interpretation' && (
            <div className="panel-section">
              <button className="btn small" onClick={() => setInterpreting(true)}><Icon name="pen" /> Documentar interpretación sobre este elemento</button>
            </div>
          )}
          {(parents.length > 0 || children.length > 0) && (
            <div className="panel-section">
              <div className="kicker" style={{ marginBottom: 4 }}>Relaciones</div>
              <ul className="node-outline">
                {parents.map((p) => <li key={p.id}><button onClick={() => onSelect(p.id)}>← {KIND_LABEL[p.kind]}: {p.title}</button></li>)}
                {children.map((c) => <li key={c.id}><button onClick={() => onSelect(c.id)}>→ {KIND_LABEL[c.kind]}: {c.title}</button></li>)}
              </ul>
            </div>
          )}
        </>
      )}

      {tab === 'sources' && canSearchSources && (
        <div className="panel-section stack">
          {variant && variant.proteinChange && (
            <>
              <h3>CIViC · {variant.geneSymbol} {variant.proteinChange}</h3>
              <ExternalEvidenceFinder gene={variant.geneSymbol} variant={variant.proteinChange} variantId={variant.id} />
              <div className="divider" />
              <h3>ClinVar</h3>
              <ClinVarPanel gene={variant.geneSymbol} variant={variant.proteinChange} variantId={variant.id} />
              <div className="divider" />
              <p className="small muted">OncoKB: integración pendiente de revisión de licencia (ver Configuración).</p>
            </>
          )}
          {gene && <PathwayImporter gene={gene.symbol} />}
        </div>
      )}

      {tab === 'discussion' && !readOnly && (
        <div className="panel-section">
          <CommentThread caseId={board.caseRecord.id} targetType={target.targetType} targetId={target.targetId} />
        </div>
      )}

      {interpreting && (
        <InterpretationDialog
          caseId={board.caseRecord.id}
          targetType={target.targetType === 'GRAPH_NODE' ? 'CASE' : target.targetType}
          targetId={target.targetType === 'GRAPH_NODE' ? board.caseRecord.id : target.targetId}
          targetLabel={`${KIND_LABEL[node.kind]} ${node.title}`}
          onClose={() => setInterpreting(false)}
        />
      )}
    </div>
  );
}

function NodeDetail({ board, node, onSelect, onSources, readOnly }: { board: CaseBoard; node: BoardNode; onSelect: (id: string) => void; onSources?: () => void; readOnly?: boolean }) {
  const id = node.entityId;
  switch (node.kind) {
    case 'case': {
      const c = board.caseRecord;
      return (
        <dl className="facts">
          <dt>Órgano</dt><dd>{c.organ}</dd>
          <dt>Tipo tumoral</dt><dd>{c.tumorType}</dd>
          <dt>Diagnóstico</dt><dd>{c.diagnosis ?? '—'}</dd>
          <dt>Subtipo</dt><dd>{c.histologicSubtype ?? '—'}</dd>
          <dt>Grado</dt><dd>{c.grade ?? '—'}</dd>
          <dt>Muestras</dt><dd>{board.samples.length}</dd>
          <dt>Variantes</dt><dd>{board.variants.length}</dd>
        </dl>
      );
    }
    case 'sample': {
      const s = board.samples.find((x) => x.id === id)!;
      return (
        <>
          <dl className="facts">
            <dt>Tipo</dt><dd>{SAMPLE_TYPE_LABEL[s.sampleType]}</dd>
            <dt>Sitio</dt><dd>{s.anatomicSite ?? '—'}</dd>
            <dt>Fecha</dt><dd>{formatDate(s.collectionDate)}</dd>
            <dt>% tumoral</dt><dd>{formatPct(s.tumorCellularityPct)}</dd>
            <dt>% necrosis</dt><dd>{formatPct(s.necrosisPct)}</dd>
            <dt>ADN / ARN</dt><dd>{s.dnaAvailable ? 'ADN sí' : 'ADN no'}{s.dnaQuality && ` (${QUALITY_LABEL[s.dnaQuality]})`} · {s.rnaAvailable ? 'ARN sí' : 'ARN no'}{s.rnaQuality && ` (${QUALITY_LABEL[s.rnaQuality]})`}</dd>
            {s.observations && (<><dt>Observaciones</dt><dd>{s.observations}</dd></>)}
          </dl>
          <WhyItMatters term="tumor-pct" />
        </>
      );
    }
    case 'histology': {
      const h = board.histology.find((x) => x.id === id)!;
      return <dl className="facts"><dt>Diagnóstico</dt><dd>{h.diagnosis}</dd><dt>Subtipo</dt><dd>{h.histologicSubtype ?? '—'}</dd><dt>Grado</dt><dd>{h.grade ?? '—'}</dd><dt>Descripción</dt><dd>{h.description ?? '—'}</dd></dl>;
    }
    case 'ihc': {
      const r = board.ihc.find((x) => x.id === id)!;
      return (
        <>
          <dl className="facts">
            <dt>Marcador</dt><dd>{r.marker}</dd><dt>Resultado</dt><dd>{IHC_RESULT_LABEL[r.result]}</dd><dt>%</dt><dd>{formatPct(r.percentage)}</dd>
            <dt>Intensidad</dt><dd>{r.intensity ? IHC_INTENSITY_LABEL[r.intensity] : '—'}</dd><dt>Score</dt><dd>{r.score ?? '—'}</dd><dt>Método</dt><dd>{r.method ?? '—'}</dd>
          </dl>
          <p className="tiny muted">Resultado registrado; MolPath no lo interpreta como diagnóstico.</p>
          <WhyItMatters term="ihc" />
        </>
      );
    }
    case 'test': {
      const t = board.molecularTests.find((x) => x.id === id)!;
      return (
        <>
          <dl className="facts">
            <dt>Tipo</dt><dd>{TEST_TYPE_LABEL[t.testType]}</dd><dt>Fecha</dt><dd>{formatDate(t.testDate)}</dd><dt>Laboratorio</dt><dd>{t.laboratory ?? '—'}</dd>
            <dt>Plataforma</dt><dd>{t.platform ?? '—'}</dd><dt>Panel</dt><dd>{t.panelName ?? '—'}</dd><dt>Profundidad</dt><dd>{t.meanDepth != null ? `${t.meanDepth}x` : '—'}</dd>
            <dt>LoD</dt><dd>{formatPct(t.limitOfDetectionPct)}</dd><dt>Genes analizados</dt><dd className="mono small">{t.genesAnalyzed.join(', ') || '—'}</dd>
          </dl>
          <div className="row"><WhyItMatters term={t.testType === 'FISH' ? 'fish' : 'ngs'} /><WhyItMatters term="coverage" label="Cobertura" /><WhyItMatters term="lod" label="Límite de detección" /></div>
        </>
      );
    }
    case 'variant': {
      const v = board.variants.find((x) => x.id === id)!;
      const test = board.molecularTests.find((t) => t.id === v.molecularTestId);
      const sample = board.samples.find((s) => s.id === test?.sampleId);
      const linked = evidenceOfVariant(board, v.id);
      const contradictions = detectContradictions(linked);
      const belowLod = v.vaf != null && test?.limitOfDetectionPct != null && v.vaf < test.limitOfDetectionPct * 2;
      return (
        <div className="stack">
          <dl className="facts">
            <dt>Gen</dt><dd>{v.geneSymbol}</dd><dt>HGVS c.</dt><dd className="mono">{v.hgvsC ?? '—'}</dd><dt>HGVS p.</dt><dd className="mono">{v.hgvsP ?? '—'}</dd>
            <dt>Transcrito</dt><dd className="mono">{v.transcript ?? '—'}</dd><dt>Tipo</dt><dd>{VARIANT_TYPE_LABEL[v.variantType]}</dd>
            <dt>VAF</dt><dd>{formatPct(v.vaf)}</dd><dt>Cobertura</dt><dd>{v.coverage != null ? `${v.coverage}x` : '—'}</dd><dt>Origen</dt><dd>{ORIGIN_LABEL[v.origin]}</dd>
            <dt>Clasificación</dt><dd>{v.classification ?? '—'}{v.classificationSystem && ` (${v.classificationSystem})`}</dd>
            <dt>Muestra</dt><dd>{sample?.label} · {formatDate(test?.testDate)}</dd>
            <dt>% tumoral muestra</dt><dd>{formatPct(sample?.tumorCellularityPct)}</dd>
          </dl>
          {belowLod && <div className="alert warn small">La VAF registrada está cerca del límite de detección declarado del estudio ({formatPct(test?.limitOfDetectionPct)}). Dato mostrado como contexto, no como conclusión.</div>}
          <div className="row"><WhyItMatters term="vaf" /><WhyItMatters term="coverage" label="Cobertura" /><WhyItMatters term={v.variantType === 'CNV' ? 'cnv' : v.variantType === 'FUSION' ? 'fusion' : v.variantType === 'INDEL' ? 'indel' : 'snv'} label={`¿Qué es ${VARIANT_TYPE_LABEL[v.variantType]}?`} /></div>
          <div className="divider" />
          {linked.length === 0 ? (
            <EmptyState message="No existen evidencias vinculadas a esta variante." action={onSources && !readOnly ? { label: 'Buscar evidencia', onClick: onSources } : undefined} />
          ) : (
            <>
              <EvidenceSummary data={summarizeEvidence(linked)} title="Mapa de incertidumbre" />
              {contradictions.map((c) => <div key={c.key} className="alert error small"><span aria-hidden>⇄</span> Contradicción detectada entre registros de fuentes: {c.description}</div>)}
              <div className="kicker">Registros</div>
              <ul className="node-outline" style={{ maxHeight: 'none' }}>
                {linked.map((e) => (
                  <li key={e.id}>
                    <button onClick={() => onSelect(`evidence:${e.id}`)}>
                      <CertaintyGlyph certainty={e.certainty} /> {EVIDENCE_TYPE_LABEL[e.evidenceType]} · {SOURCE_LABEL[e.sourceCode] ?? e.sourceCode} {e.externalId}
                      <span className="muted"> · {e.diseaseContext ?? 'contexto no indicado'}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <WhyItMatters term="evidence-level" label="¿Qué significa la certeza?" />
            </>
          )}
        </div>
      );
    }
    case 'biomarker': {
      const b = board.biomarkers.find((x) => x.id === id)!;
      return <dl className="facts"><dt>Nombre</dt><dd>{b.name}</dd><dt>Valor</dt><dd>{b.valueNumeric ?? b.valueText ?? '—'} {b.unit}</dd><dt>Observaciones</dt><dd>{b.observations ?? '—'}</dd></dl>;
    }
    case 'gene': {
      const g = board.genes.find((x) => x.id === id)!;
      const version = board.sourceVersions.find((v) => v.id === g.sourceVersionId);
      return (
        <div className="stack">
          <dl className="facts">
            <dt>Símbolo</dt><dd>{g.symbol}</dd>
            <dt>Nombre</dt><dd>{g.name ?? <span className="pending-source">Integración pendiente de fuente verificada.</span>}</dd>
            <dt>NCBI Gene</dt><dd>{g.entrezId ?? '—'}</dd><dt>UniProt</dt><dd>{g.uniprotId ?? '—'}</dd>
            <dt>Fuente</dt><dd>{version ? `${version.versionLabel} · ${formatDateTime(version.retrievedAt)}` : '—'}</dd>
          </dl>
          <div className="row"><SourceButton href={g.ncbiUrl} label="Ver en NCBI Gene" /><WhyItMatters term="driver" label="¿Qué es un driver?" /></div>
          <p className="tiny muted">Relaciones gen→gen (cascadas de señalización): integración pendiente de fuente verificada.</p>
        </div>
      );
    }
    case 'pathway': {
      const p = board.pathways.find((x) => x.id === id)!;
      const gp = board.genePathways.find((x) => x.pathwayId === p.id);
      const version = board.sourceVersions.find((v) => v.id === (gp?.sourceVersionId ?? p.sourceVersionId));
      return (
        <div className="stack">
          <dl className="facts"><dt>Fuente</dt><dd>{SOURCE_LABEL[p.sourceCode] ?? p.sourceCode}</dd><dt>Identificador</dt><dd className="mono">{p.externalId}</dd><dt>Versión</dt><dd>{version?.versionLabel ?? '—'}</dd><dt>Consultado</dt><dd>{formatDateTime(gp?.retrievedAt)}</dd></dl>
          <div className="row"><SourceButton href={p.url} /><WhyItMatters term="pathway" /></div>
        </div>
      );
    }
    case 'evidence': {
      const e = board.evidence.find((x) => x.id === id)!;
      return <div className="stack"><EvidenceCard e={e} />{!readOnly && <ReclassifyEvidence e={e} />}<EvidenceHistory evidenceId={e.id} /></div>;
    }
    case 'publication': {
      const p = board.publications.find((x) => x.id === id)!;
      return (
        <div className="stack">
          <p><strong>{p.title}</strong></p>
          <dl className="facts">
            <dt>PMID</dt><dd className="mono">{p.pmid}</dd><dt>Autores</dt><dd>{p.authors ?? '—'}</dd><dt>Revista</dt><dd>{p.journal ?? '—'}</dd>
            <dt>Fecha</dt><dd>{p.pubDate ?? '—'}</dd><dt>DOI</dt><dd className="mono">{p.doi ?? '—'}</dd><dt>Consultado</dt><dd>{formatDateTime(p.retrievedAt)}</dd>
          </dl>
          {p.abstractText ? <details><summary className="small">Abstract</summary><p className="small" style={{ whiteSpace: 'pre-wrap' }}>{p.abstractText}</p></details> : <p className="tiny muted">Abstract no almacenado; puede refrescarse desde Literatura.</p>}
          <SourceButton href={p.pubmedUrl} label="Ver en PubMed" />
        </div>
      );
    }
    case 'interpretation': {
      const i = board.interpretations.find((x) => x.id === id)!;
      return (
        <div className="stack">
          <p style={{ whiteSpace: 'pre-wrap' }}>{i.statement}</p>
          <dl className="facts"><dt>Autor</dt><dd>{i.authorName} · {ROLE_LABEL[i.authorRole]}</dd><dt>Fecha</dt><dd>{formatDateTime(i.createdAt)}</dd><dt>Estado</dt><dd>{i.status === 'CURRENT' ? 'Vigente' : 'Sustituida'}</dd></dl>
          <p className="tiny muted">Certeza asignada explícitamente por su autor.</p>
        </div>
      );
    }
    case 'evgroup':
    case 'pwgroup':
      return <p className="small">Grupo que agrupa relaciones numerosas para mantener la pizarra legible. Expándalo para ver cada elemento.</p>;
  }
}
