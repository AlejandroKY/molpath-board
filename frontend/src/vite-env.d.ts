/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_MODE?: 'api' | 'demo';
  readonly VITE_API_BASE_URL?: string;
}
