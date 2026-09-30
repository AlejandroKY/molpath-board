import '@testing-library/jest-dom/vitest';

// jsdom no implementa ResizeObserver ni DOMMatrix, que usa React Flow.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? (ResizeObserverStub as unknown as typeof ResizeObserver);

// jsdom no implementa matchMedia. Por defecto se comporta como escritorio; los tests pueden
// redefinir `window.__mobile = true` para simular un teléfono.
declare global {
  interface Window { __mobile?: boolean }
}
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: query.includes('max-width') ? !!window.__mobile : false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});
Object.assign(navigator, { clipboard: { writeText: async () => {} } });
