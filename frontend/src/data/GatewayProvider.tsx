import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { RUNTIME } from '../config/runtime';
import { BrowserDemoGateway } from './demo/browserDemoGateway';
import type { MolPathGateway, Session } from './gateway';
import { HttpGateway } from './httpGateway';

const SESSION_KEY = 'molpath-session-v1';

interface GatewayContextValue {
  gateway: MolPathGateway;
  session: Session | null;
  signIn: (username: string) => Promise<void>;
  signOut: () => void;
}

const GatewayContext = createContext<GatewayContextValue | null>(null);

function readSession(): Session | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (s.expiresAt && new Date(s.expiresAt).getTime() < Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}

function writeSession(s: Session | null) {
  try {
    if (s) window.localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* almacenamiento no disponible: la sesión dura lo que la pestaña */
  }
}

export function createGateway(onUnauthorized: () => void): MolPathGateway {
  return RUNTIME.dataMode === 'demo' ? new BrowserDemoGateway() : new HttpGateway(RUNTIME.apiBaseUrl, onUnauthorized);
}

export function GatewayProvider({ children, gateway: injected }: { children: ReactNode; gateway?: MolPathGateway }) {
  const [session, setSessionState] = useState<Session | null>(() => readSession());
  const [gateway] = useState<MolPathGateway>(() => {
    const g = injected ?? createGateway(() => {
      writeSession(null);
      setSessionState(null);
    });
    g.setSession(readSession());
    return g;
  });

  const signIn = useCallback(
    async (username: string) => {
      const s = await gateway.login(username);
      gateway.setSession(s);
      writeSession(s);
      setSessionState(s);
    },
    [gateway],
  );

  const signOut = useCallback(() => {
    gateway.setSession(null);
    writeSession(null);
    setSessionState(null);
  }, [gateway]);

  const value = useMemo(() => ({ gateway, session, signIn, signOut }), [gateway, session, signIn, signOut]);
  return <GatewayContext.Provider value={value}>{children}</GatewayContext.Provider>;
}

export function useGateway() {
  const ctx = useContext(GatewayContext);
  if (!ctx) throw new Error('useGateway fuera de GatewayProvider');
  return ctx;
}
