import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CaseTabs } from '../../app/Layout';
import { Empty, ErrorBox, Loading, PageHead, Pager } from '../../components/ui';
import { useGateway } from '../../data/GatewayProvider';
import { TARGET_LABEL } from '../../domain/labels';
import { useCaseBoard } from '../cases/useCaseBoard';
import { CommentItem, CommentThread } from './CommentThread';

/** Actividad de discusión de todos los casos. */
export function DiscussionPage() {
  const { gateway } = useGateway();
  const [page, setPage] = useState(0);
  const q = useQuery({ queryKey: ['comments', 'all', page], queryFn: () => gateway.listComments(null, null, null, page, 20), placeholderData: keepPreviousData });
  return (
    <>
      <PageHead title="Discusión multidisciplinaria" sub="Actividad reciente en todos los casos" />
      <div className="card">
        <ErrorBox error={q.error} />
        {q.isLoading ? <Loading /> : q.data?.items.length === 0 ? <Empty>Sin comentarios todavía.</Empty> : (
          <ul className="list">
            {q.data?.items.map((c) => (
              <div key={c.id}>
                <CommentItem c={c} showTarget />
                <div style={{ padding: '0 16px 8px' }}><Link className="small" to={`/cases/${c.caseId}/discussion`}>Ir a la discusión de {c.caseCode} →</Link></div>
              </div>
            ))}
          </ul>
        )}
        <Pager page={page} totalPages={q.data?.totalPages ?? 0} onPage={setPage} />
      </div>
    </>
  );
}

/** Discusión de un caso: hilo general y comentarios por elemento. */
export function CaseDiscussionPage() {
  const { caseId } = useParams();
  const { gateway } = useGateway();
  const board = useCaseBoard(caseId);
  const all = useQuery({ queryKey: ['comments', caseId, 'all'], queryFn: () => gateway.listComments(caseId!, null, null, 0, 100), enabled: !!caseId });
  if (board.isLoading) return <Loading />;
  if (!board.data) return <ErrorBox error={board.error} />;
  const c = board.data.caseRecord;
  const byElement = (all.data?.items ?? []).filter((x) => x.targetType !== 'CASE');
  return (
    <>
      <PageHead title={`Discusión · ${c.caseCode}`} crumbs={[{ to: '/cases', label: 'Casos' }, { to: `/cases/${c.id}`, label: c.caseCode }, { label: 'Discusión' }]} />
      <CaseTabs caseId={c.id} />
      <div className="grid grid-2">
        <section className="card">
          <div className="card-head"><h2>Hilo general del caso</h2></div>
          <div className="card-body"><CommentThread caseId={c.id} targetType="CASE" targetId={c.id} /></div>
        </section>
        <section className="card">
          <div className="card-head"><h2>Comentarios sobre elementos</h2><span className="small muted">muestras, variantes, evidencias, nodos</span></div>
          <div className="card-body flush">
            {byElement.length === 0 ? <Empty>Sin comentarios sobre elementos. Puede comentar cualquier nodo desde la pizarra.</Empty> : (
              <ul className="list">
                {byElement.map((x) => (
                  <div key={x.id}>
                    <div style={{ padding: '8px 16px 0' }}>
                      <span className="badge">{TARGET_LABEL[x.targetType]}</span>{' '}
                      <Link className="small" to={`/cases/${c.id}/board?node=${nodeIdFor(x.targetType, x.targetId)}`}>ver en la pizarra</Link>
                    </div>
                    <CommentItem c={x} />
                  </div>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function nodeIdFor(type: string, id: string) {
  const prefix: Record<string, string> = { SAMPLE: 'sample', HISTOLOGY: 'histology', IHC: 'ihc', MOLECULAR_TEST: 'test', VARIANT: 'variant', BIOMARKER: 'biomarker', EVIDENCE: 'evidence', GENE: 'gene', PATHWAY: 'pathway', PUBLICATION: 'publication', INTERPRETATION: 'interpretation' };
  return type === 'GRAPH_NODE' ? id : `${prefix[type] ?? 'case'}:${id}`;
}
