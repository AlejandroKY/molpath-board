import type { DataMode } from '../data/gateway';

/**
 * Modo de datos fijado en build:
 *   VITE_DATA_MODE=api  → backend REST (VITE_API_BASE_URL)
 *   VITE_DATA_MODE=demo → datos ficticios en el navegador (GitHub Pages)
 * Sin variable: `vite --mode demo|pages` y los tests usan demo; el resto, api.
 */
const env = import.meta.env;
const fallback: DataMode = ['demo', 'pages', 'test'].includes(env.MODE) ? 'demo' : 'api';

export const RUNTIME = {
  dataMode: ((env.VITE_DATA_MODE as DataMode | undefined) ?? fallback) as DataMode,
  apiBaseUrl: (env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8080',
};
