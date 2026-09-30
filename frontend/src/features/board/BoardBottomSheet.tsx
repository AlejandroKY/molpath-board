import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from '../../components/Icon';

export type SheetState = 'min' | 'half' | 'full';
const ORDER: SheetState[] = ['min', 'half', 'full'];
const LABEL: Record<SheetState, string> = { min: 'minimizado', half: 'media altura', full: 'expandido' };

/**
 * Panel inferior para móvil. Estados: minimizado, media altura, expandido y cerrado.
 * Se controla por arrastre del asa, por botones con nombre accesible y con Escape.
 */
export function BoardBottomSheet({ state, onStateChange, onClose, label, children }: {
  state: SheetState; onStateChange: (s: SheetState) => void; onClose: () => void; label: string; children: ReactNode;
}) {
  const startY = useRef<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const idx = ORDER.indexOf(state);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const onPointerDown = (e: React.PointerEvent) => {
    startY.current = e.clientY;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (startY.current == null) return;
    const dy = e.clientY - startY.current;
    startY.current = null;
    if (Math.abs(dy) < 12) {
      onStateChange(ORDER[(idx + 1) % ORDER.length]); // toque: avanzar de estado
    } else if (dy < -40) {
      onStateChange(ORDER[Math.min(idx + 1, ORDER.length - 1)]);
    } else if (dy > 40) {
      if (idx === 0) onClose();
      else onStateChange(ORDER[idx - 1]);
    }
  };

  return (
    <div ref={ref} className={`bottom-sheet ${state}`} role="dialog" aria-modal="false" aria-label={label}>
      <button
        type="button"
        className="sheet-handle"
        aria-label={`Panel ${LABEL[state]}. Tocar para cambiar de tamaño; arrastrar para ajustar`}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') onStateChange(ORDER[Math.min(idx + 1, 2)]);
          if (e.key === 'ArrowDown') (idx === 0 ? onClose() : onStateChange(ORDER[idx - 1]));
        }}
      >
        <span />
      </button>
      <div className="sheet-bar">
        <div className="grow" />
        {state !== 'min' && <button className="btn small" onClick={() => onStateChange('min')} aria-label="Minimizar panel">Minimizar</button>}
        {state !== 'full' && <button className="btn small" onClick={() => onStateChange(state === 'min' ? 'half' : 'full')} aria-label="Ampliar panel">{state === 'min' ? 'Abrir' : 'Expandir'}</button>}
        <button className="btn small" onClick={onClose} aria-label="Cerrar panel"><Icon name="close" /></button>
      </div>
      <div className="sheet-body">{children}</div>
    </div>
  );
}
