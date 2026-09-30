import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Empty, ErrorBox, Loading } from '../../components/ui';
import { useGateway } from '../../data/GatewayProvider';
import { TARGET_LABEL, formatDateTime } from '../../domain/labels';
import type { Comment, TargetType } from '../../domain/types';

export function useInvalidateComments() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['comments'] });
    qc.invalidateQueries({ queryKey: ['board'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };
}

export function CommentItem({ c, showTarget }: { c: Comment; showTarget?: boolean }) {
  const { gateway, session } = useGateway();
  const invalidate = useInvalidateComments();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(c.body);
  const [showRevisions, setShowRevisions] = useState(false);
  const revisions = useQuery({ queryKey: ['comments', 'revisions', c.id], queryFn: () => gateway.commentRevisions(c.id), enabled: showRevisions });
  const edit = useMutation({ mutationFn: () => gateway.editComment(c.id, body), onSuccess: () => { setEditing(false); invalidate(); } });
  const canEdit = session?.user.id === c.authorId || session?.user.role === 'ADMIN';
  return (
    <li>
      <div className="row between">
        <span className="small">
          <strong>{c.authorName}</strong> <span className="muted">· {c.authorRoleLabel} · {formatDateTime(c.createdAt)}</span>
          {showTarget && <span className="muted"> · {c.caseCode} · {TARGET_LABEL[c.targetType]}</span>}
        </span>
        <span className="row" style={{ gap: 4 }}>
          {c.editedAt && <button className="btn ghost small" onClick={() => setShowRevisions((v) => !v)}>editado · historial</button>}
          {canEdit && !editing && <button className="btn ghost small" onClick={() => setEditing(true)}>Editar</button>}
        </span>
      </div>
      {editing ? (
        <div className="stack" style={{ marginTop: 6 }}>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} aria-label="Editar comentario" />
          <ErrorBox error={edit.error} />
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn small" onClick={() => { setEditing(false); setBody(c.body); }}>Cancelar</button>
            <button className="btn primary small" disabled={edit.isPending} onClick={() => edit.mutate()}>Guardar</button>
          </div>
        </div>
      ) : (
        <p style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{c.body}</p>
      )}
      {showRevisions && (
        <div className="small muted" style={{ marginTop: 6, borderLeft: '2px solid var(--line)', paddingLeft: 8 }}>
          {revisions.data?.map((r) => (
            <div key={r.id}><span className="mono">{formatDateTime(r.revisedAt)}</span> — versión anterior: «{r.body}»</div>
          ))}
        </div>
      )}
    </li>
  );
}

/** Hilo de discusión asociado a un elemento concreto del caso (o al caso completo). */
export function CommentThread({ caseId, targetType, targetId }: { caseId: string; targetType: TargetType; targetId: string }) {
  const { gateway } = useGateway();
  const invalidate = useInvalidateComments();
  const [body, setBody] = useState('');
  const q = useQuery({ queryKey: ['comments', caseId, targetType, targetId], queryFn: () => gateway.listComments(caseId, targetType, targetId, 0, 50) });
  const add = useMutation({ mutationFn: () => gateway.createComment(caseId, targetType, targetId, body), onSuccess: () => { setBody(''); invalidate(); } });
  const submit = (e: FormEvent) => { e.preventDefault(); if (body.trim()) add.mutate(); };
  return (
    <div className="stack">
      {q.isLoading && <Loading />}
      {q.data && q.data.items.length === 0 && <Empty>Sin comentarios sobre este elemento.</Empty>}
      <ul className="list" style={{ margin: '0 -16px' }}>
        {q.data?.items.map((c) => <CommentItem key={c.id} c={c} />)}
      </ul>
      <form onSubmit={submit} className="stack">
        <textarea placeholder="Añadir comentario multidisciplinario…" value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} aria-label="Nuevo comentario" style={{ minHeight: 64 }} />
        <ErrorBox error={add.error} />
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn primary small" disabled={!body.trim() || add.isPending}>Comentar</button>
        </div>
      </form>
    </div>
  );
}
