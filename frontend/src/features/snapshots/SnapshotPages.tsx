import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CaseTabs } from '../../app/Layout';
import { CertaintyBadge, Empty, ErrorBox, Loading, PageHead, Pager } from '../../components/ui';
import { useGateway } from '../../data/GatewayProvider';
import { EVIDENCE_TYPE_LABEL, ROLE_LABEL, SOURCE_LABEL, formatDateTime } from '../../domain/labels';
import { diffBoards } from '../../domain/snapshotDiff';
import type { SnapshotSummary } from '../../domain/types';
import { useCaseBoard } from '../cases/useCaseBoard';

function SnapshotTable({ items, showCase }: { items: SnapshotSummary[]; showCase?: boolean }) {
  return (
    <div className="table-wrap">
      <table className="data">
        <thead><tr>{showCase && <th>Caso</th>}<th>Snapshot</th><th>Creado</th><th>Autor</th><th>SHA-256</th><th /></tr></thead>
        <tbody>
          {items.map((s) => (
            <tr key={s.id}>
              {showCase && <td className="mono">{s.caseCode}</td>}
              <td><strong>{s.label}</strong>{s.note && <div className="small muted">{s.note}</div>}</td>
              <td className="small">{formatDateTime(s.createdAt)}</td>
              <td className="small">{s.createdByName ?? '—'}</td>
              <td className="mono tiny" title={s.contentSha256}>{s.contentSha256.slice(0, 12)}…</td>
              <td><Link className="btn small" to={`/cases/${s.caseId}/snapshots/${s.id}`}>Comparar con hoy</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SnapshotsPage() {
  const { gateway } = useGateway();
  const [page, setPage] = useState(0);
  const q = useQuery({ queryKey: ['snapshots', 'all', page], queryFn: () => gateway.listSnapshots(page, 20), placeholderData: keepPreviousData });
  return (
    <>
      <PageHead title="Snapshots científicos" sub="«Qué sabíamos entonces» frente a «qué sabemos ahora»" />
      <div className="card">
        <ErrorBox error={q.error} />
        {q.isLoading ? <Loading /> : q.data?.items.length === 0 ? <Empty>Aún no hay snapshots. Créelos desde la pizarra de un caso.</Empty> : <SnapshotTable items={q.data!.items} showCase />}
        <Pager page={page} totalPages={q.data?.totalPages ?? 0} onPage={setPage} />
      </div>
    </>
  );
}

export function CaseSnapshotsPage() {
  const { caseId } = useParams();
  const { gateway } = useGateway();
  const board = useCaseBoard(caseId);
  const q = useQuery({ queryKey: ['snapshots', caseId], queryFn: () => gateway.caseSnapshots(caseId!), enabled: !!caseId });
  if (!board.data) return board.isLoading ? <Loading /> : <ErrorBox error={board.error} />;
  const c = board.data.caseRecord;
  return (
    <>
      <PageHead title={`Snapshots · ${c.caseCode}`} crumbs={[{ to: '/cases', label: 'Casos' }, { to: `/cases/${c.id}`, label: c.caseCode }, { label: 'Snapshots' }]}
        actions={<Link className="btn primary" to={`/cases/${c.id}/board`}>Crear snapshot desde la pizarra</Link>} />
      <CaseTabs caseId={c.id} />
      <div className="card">
        {q.isLoading ? <Loading /> : q.data?.length === 0 ? <Empty>Este caso no tiene snapshots.</Empty> : <SnapshotTable items={q.data ?? []} />}
      </div>
    </>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section className="card">
      <div className="card-head"><h3>{title}</h3><span className={`badge ${count ? 'warn' : ''}`}>{count} cambio(s)</span></div>
      <div className="card-body small">{count === 0 ? <span className="muted">Sin cambios.</span> : children}</div>
    </section>
  );
}

export function SnapshotComparePage() {
  const { caseId, snapshotId } = useParams();
  const { gateway } = useGateway();
  const current = useCaseBoard(caseId);
  const snap = useQuery({ queryKey: ['snapshots', 'detail', snapshotId], queryFn: () => gateway.getSnapshot(snapshotId!), enabled: !!snapshotId });
  const diff = useMemo(() => (snap.data && current.data ? diffBoards(snap.data.content.board, current.data) : null), [snap.data, current.data]);
  if (snap.isLoading || current.isLoading) return <Loading label="Comparando…" />;
  if (!snap.data || !current.data || !diff) return <ErrorBox error={snap.error ?? current.error} />;
  const s = snap.data.summary;
  const c = current.data.caseRecord;
  return (
    <>
      <PageHead
        title={`Qué sabíamos · ${s.label}`}
        sub={`Snapshot del ${formatDateTime(s.createdAt)} comparado con el estado actual del caso ${c.caseCode}`}
        crumbs={[{ to: '/cases', label: 'Casos' }, { to: `/cases/${c.id}`, label: c.caseCode }, { to: `/cases/${c.id}/snapshots`, label: 'Snapshots' }, { label: s.label }]}
      />
      <CaseTabs caseId={c.id} />
      <div className="row" style={{ marginBottom: 14 }}>
        {snap.data.integrityVerified
          ? <span className="badge c-STRONG">Integridad verificada (SHA-256)</span>
          : <span className="badge danger">La huella SHA-256 no coincide: el contenido no es fiable</span>}
        <span className="mono tiny muted">{s.contentSha256}</span>
        <span className="badge">{diff.totalChanges} cambio(s) desde el snapshot</span>
      </div>
      <div className="grid grid-2">
        <Section title="Nuevas publicaciones" count={diff.publications.added.length + diff.publications.removed.length}>
          <ul>
            {diff.publications.added.map((p) => <li key={p.id}>+ PMID <span className="mono">{p.pmid}</span> — {p.title}</li>)}
            {diff.publications.removed.map((p) => <li key={p.id}>− PMID <span className="mono">{p.pmid}</span> ya no está enlazada</li>)}
          </ul>
        </Section>
        <Section title="Nueva evidencia" count={diff.evidence.added.length + diff.evidence.removed.length}>
          <ul>
            {diff.evidence.added.map((e) => <li key={e.id}>+ {SOURCE_LABEL[e.sourceCode] ?? e.sourceCode} {e.externalId} · {EVIDENCE_TYPE_LABEL[e.evidenceType]} · {e.geneSymbol} {e.variantDescriptor} <CertaintyBadge certainty={e.certainty} short /></li>)}
            {diff.evidence.removed.map((e) => <li key={e.id}>− {SOURCE_LABEL[e.sourceCode] ?? e.sourceCode} {e.externalId} desenlazada del caso</li>)}
          </ul>
        </Section>
        <Section title="Cambios en clasificación" count={diff.evidence.changed.length}>
          <ul>{diff.evidence.changed.map((c2) => <li key={c2.item.id}>{c2.item.externalId ?? c2.item.id.slice(0, 8)}: {c2.details.join('; ')}</li>)}</ul>
        </Section>
        <Section title="Dejaron de considerarse válidos" count={diff.evidence.noLongerValid.length + diff.interpretations.superseded.length}>
          <ul>
            {diff.evidence.noLongerValid.map((e) => <li key={e.id}>Evidencia {e.externalId ?? ''} ahora «{e.status}»{e.statusReason && `: ${e.statusReason}`}</li>)}
            {diff.interpretations.superseded.map((i) => <li key={i.id}>Interpretación de {i.authorName} ({ROLE_LABEL[i.authorRole]}) sustituida</li>)}
          </ul>
        </Section>
        <Section title="Relaciones del grafo" count={diff.relations.added.length + diff.relations.removed.length}>
          <ul>
            {diff.relations.added.slice(0, 40).map((r) => <li key={r}>+ {r}</li>)}
            {diff.relations.removed.slice(0, 40).map((r) => <li key={r}>− {r}</li>)}
          </ul>
        </Section>
        <Section title="Versiones de bases externas" count={diff.sourceVersions.length}>
          <ul>{diff.sourceVersions.map((v) => <li key={v.source}><strong>{SOURCE_LABEL[v.source] ?? v.source}</strong>: {v.before.join(', ') || '—'} → {v.after.join(', ') || '—'}</li>)}</ul>
        </Section>
        <Section title="Resultados del caso" count={diff.variants.added.length + diff.variants.removed.length + diff.variants.changed.length + diff.ihc.added.length + diff.ihc.removed.length + diff.ihc.changed.length + diff.samples.added.length + diff.samples.removed.length + diff.biomarkers.added.length + diff.biomarkers.removed.length}>
          <ul>
            {diff.samples.added.map((x) => <li key={`s+${x}`}>+ Muestra {x}</li>)}
            {diff.samples.removed.map((x) => <li key={`s-${x}`}>− Muestra {x}</li>)}
            {diff.variants.added.map((x) => <li key={`v+${x}`}>+ Variante {x}</li>)}
            {diff.variants.removed.map((x) => <li key={`v-${x}`}>− Variante {x}</li>)}
            {diff.variants.changed.map((x) => <li key={`v~${x.item}`}>~ {x.item}: {x.details.join('; ')}</li>)}
            {diff.ihc.added.map((x) => <li key={`i+${x}`}>+ IHQ {x}</li>)}
            {diff.ihc.removed.map((x) => <li key={`i-${x}`}>− IHQ {x}</li>)}
            {diff.ihc.changed.map((x) => <li key={`i~${x.item}`}>~ {x.details.join('; ')}</li>)}
            {diff.biomarkers.added.map((x) => <li key={`b+${x}`}>+ {x}</li>)}
            {diff.biomarkers.removed.map((x) => <li key={`b-${x}`}>− {x}</li>)}
          </ul>
        </Section>
        <Section title="Nuevas interpretaciones" count={diff.interpretations.added.length}>
          <ul>{diff.interpretations.added.map((i) => <li key={i.id}>{i.authorName} ({ROLE_LABEL[i.authorRole]}): {i.statement.slice(0, 160)}</li>)}</ul>
        </Section>
      </div>
      <p className="tiny muted" style={{ marginTop: 12 }}>
        El snapshot es inmutable: el conocimiento histórico no se sobrescribe. Estado del grafo congelado: {snap.data.content.graphState?.collapsed.length ?? 0} grupo(s) contraído(s).
      </p>
    </>
  );
}
