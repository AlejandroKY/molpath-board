import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { BRAND } from '../../config/brand';
import { RUNTIME } from '../../config/runtime';
import { Disclaimer, ErrorBox, Loading, PageHead } from '../../components/ui';
import { useGateway } from '../../data/GatewayProvider';

const STATUS_TEXT = { ENABLED: 'Activo', DISABLED: 'Desactivado', LICENSE_REVIEW_REQUIRED: 'Pendiente de revisión de licencia' } as const;

export function SettingsPage() {
  const { gateway, session } = useGateway();
  const qc = useQueryClient();
  const providers = useQuery({ queryKey: ['providers'], queryFn: () => gateway.providers() });
  const [resetDone, setResetDone] = useState(false);
  const reset = async () => {
    if (!gateway.resetDemo || !window.confirm('¿Restaurar el dataset demo? Se perderán los cambios hechos en este navegador.')) return;
    await gateway.resetDemo();
    await qc.invalidateQueries();
    setResetDone(true);
  };
  return (
    <>
      <PageHead title="Configuración" />
      <Disclaimer />
      <div className="grid grid-2">
        <section className="card">
          <div className="card-head"><h2>Aplicación</h2></div>
          <div className="card-body stack">
            <dl className="facts">
              <dt>Producto</dt><dd>{BRAND.name}</dd>
              <dt>Modo de datos</dt><dd>{gateway.mode === 'demo' ? 'Demo en el navegador (localStorage)' : `API REST · ${RUNTIME.apiBaseUrl}`}</dd>
              <dt>Usuario</dt><dd>{session?.user.displayName} · {session?.user.roleLabel}</dd>
              <dt>Autenticación</dt><dd>{gateway.mode === 'demo' ? 'Selección de usuario demo (sin servidor)' : 'JWT emitido por el login de desarrollo (preparado para IdP OIDC)'}</dd>
            </dl>
            {gateway.mode === 'demo' && (
              <div className="stack">
                <p className="small muted">En modo demo, los datos ficticios y sus cambios viven sólo en este navegador. Otros dispositivos ven su propia copia.</p>
                <button className="btn danger" onClick={reset} style={{ alignSelf: 'flex-start' }}>Restaurar dataset demo</button>
                {resetDone && <div className="alert info small">Dataset restaurado.</div>}
              </div>
            )}
          </div>
        </section>
        <section className="card">
          <div className="card-head"><h2>Proveedores externos</h2></div>
          <div className="card-body flush">
            {providers.isLoading && <Loading />}
            <ErrorBox error={providers.error} />
            <ul className="list">
              {providers.data?.map((p) => (
                <li key={p.sourceCode}>
                  <div className="row between">
                    <strong>{p.name}</strong>
                    <span className={`badge ${p.status === 'ENABLED' ? 'c-STRONG' : p.status === 'LICENSE_REVIEW_REQUIRED' ? 'warn' : ''}`}>{STATUS_TEXT[p.status]}</span>
                  </div>
                  <div className="small">{p.capability}</div>
                  <div className="small muted">{p.statusDetail} <a href={p.documentationUrl} target="_blank" rel="noopener noreferrer">Documentación</a></div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </>
  );
}
