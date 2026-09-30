import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { BRAND } from '../config/brand';
import { BrandMark } from '../components/Icon';
import { Disclaimer, ErrorBox, Loading } from '../components/ui';
import { useGateway } from '../data/GatewayProvider';

/**
 * Selección de usuario demo. En modo API emite un JWT mediante el login de desarrollo del backend
 * (desactivable con MOLPATH_DEV_LOGIN_ENABLED). Preparado para sustituirse por un IdP real (ADR-009).
 */
export function LoginScreen() {
  const { gateway, signIn } = useGateway();
  const users = useQuery({ queryKey: ['dev-users'], queryFn: () => gateway.devUsers() });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const choose = async (username: string) => {
    setBusy(true);
    setError(null);
    try {
      await signIn(username);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="card login-card">
        <div className="card-body stack">
          <div className="row">
            <BrandMark />
            <div>
              <h1>{BRAND.name}</h1>
              <p className="muted small">{BRAND.tagline}</p>
            </div>
          </div>
          <Disclaimer>Esta versión trabaja exclusivamente con casos ficticios de demostración.</Disclaimer>
          {gateway.mode === 'demo' && (
            <div className="alert info small">
              <strong>Modo demo en el navegador.</strong> Los datos (ficticios) y los cambios se guardan sólo en este
              dispositivo. Las consultas a PubMed, CIViC, ClinVar y Reactome se hacen en vivo a sus APIs oficiales.
            </div>
          )}
          <h2>Seleccione un usuario de demostración</h2>
          <p className="small muted">Cada rol tiene permisos distintos (p. ej. Oncología puede comentar e interpretar, pero no editar datos de laboratorio).</p>
          {users.isLoading && <Loading />}
          <ErrorBox error={users.error ?? error} />
          <div className="user-grid">
            {users.data?.map((u) => (
              <button key={u.id} className="user-choice" onClick={() => choose(u.username)} disabled={busy}>
                <div style={{ fontWeight: 600 }}>{u.displayName}</div>
                <div className="small muted">{u.roleLabel}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
