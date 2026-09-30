// Iconos de trazo (1.6px) propios, sin dependencia externa.
const PATHS: Record<string, string> = {
  dashboard: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4.3-4.3',
  cases: 'M4 6h16v13H4zM9 6V4h6v2M4 11h16',
  plus: 'M12 5v14M5 12h14',
  board: 'M5 6a2 2 0 1 0 0 .1M19 6a2 2 0 1 0 0 .1M12 18a2 2 0 1 0 0 .1M6.7 7.2l4 9M17.3 7.2l-4 9M7 6h10',
  timeline: 'M12 3v18M12 7h6M12 12H6M12 17h5',
  evidence: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5',
  literature: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M8 7h8',
  discussion: 'M4 5h16v11H9l-5 4z',
  snapshot: 'M4 8h3l2-3h6l2 3h3v11H4zM12 11a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19 12l2-1-1-3-2 .2-1.3-1.5.3-2-3-1-1 1.8h-2L10 3.7l-3 1 .3 2L6 8.2 4 8l-1 3 2 1v0l-2 1 1 3 2-.2 1.3 1.5-.3 2 3 1 1-1.8h2l1 1.8 3-1-.3-2 1.3-1.5 2 .2 1-3z',
  learn: 'M3 8l9-4 9 4-9 4zM7 10v5c3 2 7 2 10 0v-5',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5v.1',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'M6 6l12 12M18 6L6 18',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  expand: 'M12 5v14M5 12h14',
  collapse: 'M5 12h14',
  fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  check: 'M5 12l5 5 9-10',
  warning: 'M12 3l10 18H2zM12 10v5M12 18v.1',
  person: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21a8 8 0 0 1 16 0',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18',
  pen: 'M15 4l5 5L9 20H4v-5zM13 6l5 5',
  chevron: 'M6 9l6 6 6-6',
  focus: 'M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  route: 'M6 3v6a3 3 0 0 0 3 3h6a3 3 0 0 1 3 3v6M6 3a1.5 1.5 0 1 0 0 .1M18 21a1.5 1.5 0 1 0 0 .1',
  present: 'M3 4h18v12H3zM12 16v4M8 20h8',
  copy: 'M8 8h12v12H8zM4 16V4h12',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  history: 'M4 12a8 8 0 1 0 2.3-5.7L4 8.6M4 4v4.6h4.6M12 8v4l3 2',
};

export function Icon({ name, title }: { name: keyof typeof PATHS | string; title?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      <path d={PATHS[name] ?? PATHS.info} />
    </svg>
  );
}

export function BrandMark() {
  // Tres nodos conectados: microscopio → gen → evidencia.
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden>
      <rect x="1" y="1" width="30" height="30" rx="7" fill="var(--accent)" />
      <path d="M9 21L16 11L23 21" stroke="var(--accent-ink)" strokeWidth="1.6" fill="none" />
      <circle cx="9" cy="21" r="3" fill="var(--accent-ink)" />
      <circle cx="16" cy="11" r="3" fill="none" stroke="var(--accent-ink)" strokeWidth="1.6" />
      <circle cx="23" cy="21" r="3" fill="none" stroke="var(--accent-ink)" strokeWidth="1.6" strokeDasharray="2 1.5" />
    </svg>
  );
}
