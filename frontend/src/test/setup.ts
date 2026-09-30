import '@testing-library/jest-dom/vitest';

// jsdom no implementa ResizeObserver ni DOMMatrix, que usa React Flow.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? (ResizeObserverStub as unknown as typeof ResizeObserver);
