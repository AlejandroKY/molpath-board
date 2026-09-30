import { useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Menu } from '../components/scientific';
import { useShortcuts } from '../hooks/useShortcuts';
import { ShortcutsDialog } from './ShortcutsDialog';
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
  const [shortcuts, setShortcuts] = useState(false);
  const caseMatch = /^\/cases\/([0-9a-f-]{36})/.exec(location.pathname);
  useShortcuts({
    '/': (e) => { e.preventDefault(); document.getElementById('global-search-input')?.focus(); },
    '?': () => setShortcuts(true),
    p: () => { if (caseMatch) navigate(`/cases/${caseMatch[1]}/present`); },
  });

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
              id="global-search-input"
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
            <button className="btn ghost small hide-mobile-inline" onClick={() => setShortcuts(true)} title="Atajos de teclado (?)" aria-label="Atajos de teclado">
              <span className="kbd">?</span>
            </button>
            <button className="btn ghost small" onClick={signOut} title="Cambiar de usuario" aria-label="Cambiar de usuario">
              <Icon name="logout" />
            </button>
          </div>
        </header>
        <main className={`page ${location.pathname.endsWith('/board') ? 'wide' : ''}`}>
          <Outlet />
        </main>
        {shortcuts && <ShortcutsDialog onClose={() => setShortcuts(false)} />}
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

/** Navegación dentro de un caso: pestañas en escritorio; Resumen · Pizarra · Timeline · Más en móvil. */
export function CaseTabs({ caseId }: { caseId: string }) {
  const location = useLocation();
  const tabs = [
    { to: `/cases/${caseId}`, label: 'Resumen y datos', short: 'Resumen', end: true },
    { to: `/cases/${caseId}/board`, label: BRAND.boardName, short: 'Pizarra' },
    { to: `/cases/${caseId}/timeline`, label: 'Timeline', short: 'Timeline' },
    { to: `/cases/${caseId}/discussion`, label: 'Discusión', short: 'Discusión' },
    { to: `/cases/${caseId}/snapshots`, label: 'Snapshots', short: 'Snapshots' },
  ];
  const more = tabs.slice(3);
  const moreActive = more.some((t) => location.pathname.startsWith(t.to));
  return (
    <>
      <nav className="tabs case-tabs-desktop" aria-label="Secciones del caso">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end}>
            {t.label}
          </NavLink>
        ))}
        <Link to={`/cases/${caseId}/present`} style={{ marginLeft: 'auto' }}>Presentar caso</Link>
      </nav>
      <nav className="case-nav-mobile" aria-label="Secciones del caso (móvil)">
        {tabs.slice(0, 3).map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end}>
            {t.short}
          </NavLink>
        ))}
        <div className={`menu-wrap ${moreActive ? 'active' : ''}`} style={{ display: 'contents' }}>
          <Menu label="Más" align="right" buttonClass={moreActive ? 'more-active' : ''}>
            {(close) => (
              <>
                {more.map((t) => (
                  <Link key={t.to} className="menu-item" to={t.to} onClick={close}>{t.label}</Link>
                ))}
                <Link className="menu-item" to={`/evidence`} onClick={close}>Evidencias (biblioteca)</Link>
                <Link className="menu-item" to={`/cases/${caseId}/present`} onClick={close}>Presentar caso</Link>
              </>
            )}
          </Menu>
        </div>
      </nav>
    </>
  );
}
