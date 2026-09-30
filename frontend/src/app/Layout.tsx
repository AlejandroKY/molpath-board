import { useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BRAND } from '../config/brand';
import { BrandMark, Icon } from '../components/Icon';
import { PageHead } from '../components/ui';
import { useGateway } from '../data/GatewayProvider';

const NAV: { section: string; items: { to: string; label: string; icon: string; end?: boolean }[] }[] = [
  {
    section: 'Trabajo',
    items: [
      { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
      { to: '/search', label: 'Buscar', icon: 'search' },
      { to: '/cases', label: 'Casos', icon: 'cases', end: true },
      { to: '/cases/new', label: 'Crear caso', icon: 'plus' },
    ],
  },
  {
    section: 'Conocimiento',
    items: [
      { to: '/evidence', label: 'Evidencias', icon: 'evidence' },
      { to: '/literature', label: 'Literatura', icon: 'literature' },
    ],
  },
  {
    section: 'Colaboración',
    items: [
      { to: '/discussion', label: 'Discusión', icon: 'discussion' },
      { to: '/snapshots', label: 'Snapshots', icon: 'snapshot' },
    ],
  },
  {
    section: 'Sistema',
    items: [
      { to: '/learn', label: 'Modo aprendizaje', icon: 'learn' },
      { to: '/settings', label: 'Configuración', icon: 'settings' },
    ],
  },
];

export function Layout() {
  const { gateway, session, signOut } = useGateway();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Navegación principal">
        <Link to="/" className="brand" onClick={() => setOpen(false)} style={{ textDecoration: 'none', color: 'inherit' }}>
          <BrandMark />
          <div>
            <div className="brand-name">{BRAND.name}</div>
            <div className="brand-tag">{BRAND.tagline}</div>
          </div>
        </Link>
        {NAV.map((group) => (
          <nav key={group.section} className="nav" aria-label={group.section}>
            <div className="nav-section">{group.section}</div>
            {group.items.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setOpen(false)}>
                <Icon name={item.icon} /> {item.label}
              </NavLink>
            ))}
          </nav>
        ))}
        <div className="sidebar-foot">{BRAND.disclaimer}</div>
      </aside>
      {open && <div className="drawer-backdrop" style={{ zIndex: 40 }} onClick={() => setOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="btn ghost small menu-btn" onClick={() => setOpen(true)} aria-label="Abrir menú">
            <Icon name="menu" />
          </button>
          <form className="global-search" onSubmit={submit} role="search">
            <Icon name="search" />
            <input
              aria-label="Búsqueda global"
              placeholder="Buscar gen, variante, IHQ, tumor, PMID…  (p. ej. EGFR L858R)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </form>
          <div className="topbar-right">
            <span className={`mode-pill ${gateway.mode}`} title={gateway.mode === 'demo' ? 'Datos ficticios guardados en este navegador' : 'Conectado al backend REST'}>
              {gateway.mode === 'demo' ? 'MODO DEMO · navegador' : 'API'}
            </span>
            <span className="who small">
              <strong>{session?.user.displayName}</strong> <span className="muted">· {session?.user.roleLabel}</span>
            </span>
            <button className="btn ghost small" onClick={signOut} title="Cambiar de usuario" aria-label="Cambiar de usuario">
              <Icon name="logout" />
            </button>
          </div>
        </header>
        <main className={`page ${location.pathname.endsWith('/board') ? 'wide' : ''}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function NotFound() {
  return (
    <>
      <PageHead title="Página no encontrada" />
      <p>
        <Link to="/">Volver al dashboard</Link>
      </p>
    </>
  );
}

/** Pestañas de navegación dentro de un caso. */
export function CaseTabs({ caseId }: { caseId: string }) {
  const tabs = [
    { to: `/cases/${caseId}`, label: 'Resumen y datos', end: true },
    { to: `/cases/${caseId}/board`, label: BRAND.boardName },
    { to: `/cases/${caseId}/timeline`, label: 'Timeline' },
    { to: `/cases/${caseId}/discussion`, label: 'Discusión' },
    { to: `/cases/${caseId}/snapshots`, label: 'Snapshots' },
  ];
  return (
    <nav className="tabs" aria-label="Secciones del caso">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end}>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
