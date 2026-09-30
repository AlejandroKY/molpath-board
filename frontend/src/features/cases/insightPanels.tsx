import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../components/scientific';
import { Loading } from '../../components/ui';
import { useGateway } from '../../data/GatewayProvider';
import { openQuestions } from '../../domain/caseInsights';
import { SOURCE_LABEL, formatDateTime } from '../../domain/labels';
import { diffBoards, type BoardDiff } from '../../domain/snapshotDiff';
import type { CaseBoard } from '../../domain/types';

/** Líneas legibles de un diff real. Nunca se inventan cambios. */
export function changeLines(d: BoardDiff): { sign: '+' | '−' | '~'; text: string }[] {
  const out: { sign: '+' | '−' | '~'; text: string }[] = [];
  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
  if (d.samples.added.length) out.push({ sign: '+', text: `${n(d.samples.added.length, 'nueva muestra', 'nuevas muestras')}: ${d.samples.added.join(', ')}` });
  for (const v of d.variants.added) out.push({ sign: '+', text: `Nueva variante ${v}` });
  for (const v of d.variants.removed) out.push({ sign: '−', text: `Variante eliminada ${v}` });
  for (const v of d.variants.changed) out.push({ sign: '~', text: `${v.item}: ${v.details.join('; ')}` });
  if (d.publications.added.length) out.push({ sign: '+', text: n(d.publications.added.length, 'nueva publicación', 'nuevas publicaciones') });
  if (d.evidence.added.length) out.push({ sign: '+', text: n(d.evidence.added.length, 'nueva evidencia enlazada', 'nuevas evidencias enlazadas') });
  if (d.evidence.removed.length) out.push({ sign: '−', text: n(d.evidence.removed.length, 'evidencia desenlazada', 'evidencias desenlazadas') });
  for (const e of d.evidence.changed) out.push({ sign: '~', text: `Evidencia ${e.item.externalId ?? ''}: ${e.details.join('; ')}` });
  for (const x of d.ihc.added) out.push({ sign: '+', text: `IHQ ${x}` });
  for (const x of d.ihc.changed) out.push({ sign: '~', text: x.details.join('; ') });
  for (const x of d.biomarkers.added) out.push({ sign: '+', text: `Biomarcador ${x}` });
  for (const s of d.sourceVersions) out.push({ sign: '~', text: `${SOURCE_LABEL[s.source] ?? s.source}: nueva versión consultada` });
  if (d.interpretations.added.length) out.push({ sign: '+', text: n(d.interpretations.added.length, 'nueva interpretación', 'nuevas interpretaciones') });
  if (d.interpretations.superseded.length) out.push({ sign: '~', text: n(d.interpretations.superseded.length, 'interpretación sustituida', 'interpretaciones sustituidas') });
  return out;
}

/** "Qué cambió": compara el estado actual con un snapshot elegido (por defecto, el último). */
export function CaseChangesSummary({ board }: { board: CaseBoard }) {
  const { gateway } = useGateway();
  const caseId = board.caseRecord.id;
  const list = useQuery({ queryKey: ['snapshots', caseId], queryFn: () => gateway.caseSnapshots(caseId) });
  const [chosen, setChosen] = useState<string | null>(null);
  const snapshotId = chosen ?? list.data?.[0]?.id ?? null;
  const detail = useQuery({ queryKey: ['snapshots', 'detail', snapshotId], queryFn: () => gateway.getSnapshot(snapshotId!), enabled: !!snapshotId });

  return (
    <section className="card">
      <div className="card-head">
        <h2>Qué cambió</h2>
        {list.data && list.data.length > 1 && (
          <select aria-label="Comparar con snapshot" value={snapshotId ?? ''} onChange={(e) => setChosen(e.target.value)} style={{ maxWidth: 230 }}>
            {list.data.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        )}
      </div>
      <div className="card-body">
        {list.isLoading && <Loading />}
        {list.data?.length === 0 && (
          <EmptyState message="Aún no hay snapshots de este caso. Cree uno para poder ver qué cambia desde ese momento." action={{ label: 'Crear snapshot en la pizarra', to: `/cases/${caseId}/board` }} />
        )}
        {detail.data && (() => {
          const lines = changeLines(diffBoards(detail.data.content.board, board));
          return (
            <>
              <p className="small muted" style={{ marginBottom: 6 }}>
                Desde el snapshot «{detail.data.summary.label}» ({formatDateTime(detail.data.summary.createdAt)})
              </p>
              {lines.length === 0 ? <p className="small">Sin cambios registrados desde ese snapshot.</p> : (
                <ul className="changes">
                  {lines.map((l, i) => (
                    <li key={i}><span className={l.sign === '+' ? 'plus' : l.sign === '−' ? 'minus' : 'tilde'} aria-hidden>{l.sign}</span>{l.text}</li>
                  ))}
                </ul>
              )}
              <Link className="small" to={`/cases/${caseId}/snapshots/${detail.data.summary.id}`}>Ver comparación completa →</Link>
            </>
          );
        })()}
      </div>
    </section>
  );
}

/** Observaciones objetivas del sistema. No son interpretación clínica ni recomendaciones. */
export function OpenQuestionsPanel({ board, onSelectNode, compact }: { board: CaseBoard; onSelectNode?: (nodeId: string) => void; compact?: boolean }) {
  const questions = openQuestions(board);
  const shown = compact ? questions.slice(0, 5) : questions;
  return (
    <section className="card">
      <div className="card-head">
        <h2>Preguntas abiertas</h2>
        <span className="sys-tag" title="Generado automáticamente a partir de datos registrados">Observación del sistema</span>
      </div>
      <div className="card-body">
        <p className="tiny muted" style={{ marginBottom: 6 }}>
          Huecos de información o de trazabilidad detectados en los datos. No son interpretaciones clínicas ni recomendaciones.
        </p>
        {questions.length === 0 ? <p className="small">No se detectan huecos de información con las reglas actuales.</p> : (
          <ul className="oq-list">
            {shown.map((q) => (
              <li key={q.id}>
                <span className={`oq-mark ${q.level}`} aria-label={q.level === 'attention' ? 'Requiere atención' : 'Informativo'}>{q.level === 'attention' ? '!' : 'i'}</span>
                <div>
                  <div className="small"><strong>{q.title}</strong></div>
                  <div className="tiny muted">{q.detail}</div>
                  {q.nodeId && (onSelectNode
                    ? <button className="btn ghost small" onClick={() => onSelectNode(q.nodeId!)}>Ver en la pizarra</button>
                    : <Link className="tiny" to={`/cases/${board.caseRecord.id}/board?node=${q.nodeId}`}>Ver en la pizarra →</Link>)}
                </div>
              </li>
            ))}
          </ul>
        )}
        {compact && questions.length > shown.length && <p className="tiny muted">+{questions.length - shown.length} observación(es) más.</p>}
      </div>
    </section>
  );
}

