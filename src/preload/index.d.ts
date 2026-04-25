import type { IncineratorApi } from './index';

declare global {
  interface Window {
    incineratorApi: IncineratorApi;
  }
}

export {};
