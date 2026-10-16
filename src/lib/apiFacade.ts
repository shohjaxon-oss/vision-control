import { api, isMockMode } from './api';
import type { mockApi } from '@/dev-mock/mockApi';

type ApiType = typeof api;

export function getApi(): Promise<ApiType> {
  if (isMockMode() && import.meta.env.DEV) {
    return import('@/dev-mock/mockApi').then((m) => m.mockApi as unknown as ApiType);
  }
  return Promise.resolve(api);
}

export async function callApi<T>(
  fn: (api: ApiType) => Promise<T>
): Promise<T> {
  const a = await getApi();
  return fn(a);
}
