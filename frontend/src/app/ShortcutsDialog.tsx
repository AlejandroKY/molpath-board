import { Dialog } from '../components/ui';

const SHORTCUTS: [string, string][] = [
  ['/', 'Ir a la búsqueda global'],
  ['?', 'Mostrar estos atajos'],
  ['P', 'Presentar el caso abierto'],
  ['F', 'Pizarra: enfocar el nodo seleccionado'],
  ['R', 'Pizarra: alternar Ruta principal / Ver todo'],
  ['Esc', 'Salir del enfoque, cerrar panel o diálogo'],
  ['← →', 'Modo presentación: sección anterior / siguiente'],
];

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="Atajos de teclado" onClose={onClose}>
      <div className="shortcuts">
        {SHORTCUTS.map(([k, d]) => (
          <div key={k} style={{ display: 'contents' }}>
            <span className="kbd">{k}</span>
            <span>{d}</span>
          </div>
        ))}
      </div>
      <p className="tiny muted" style={{ marginTop: 12 }}>Los atajos no se activan mientras se escribe en un campo de texto.</p>
    </Dialog>
  );
}
