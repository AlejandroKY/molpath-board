import { useEffect, useRef } from 'react';

/** Atajos de teclado que nunca interfieren con la escritura en formularios. */
export function useShortcuts(map: Record<string, (e: KeyboardEvent) => void>, enabled = true) {
  const ref = useRef(map);
  ref.current = map;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (typing && e.key !== 'Escape') return;
      const handler = ref.current[e.key] ?? ref.current[e.key.toLowerCase()];
      if (handler) handler(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
