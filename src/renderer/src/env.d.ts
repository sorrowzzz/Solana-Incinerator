/// <reference types="vite/client" />
import type { IncineratorApi } from '../../preload/index';

declare global {
  interface Window {
    incineratorApi: IncineratorApi;
  }
}

export {};
