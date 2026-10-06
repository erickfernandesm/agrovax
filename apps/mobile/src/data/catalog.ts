import type { CatalogDto, CatalogResponse } from '@agrovax/shared';
import type { ApiClient } from '../services/api/client';
import type { StorageAdapter } from './store/adapter';

/**
 * Copia local dos catalogos globais (doencas, sintomas, vigilancia).
 * Fica disponivel offline depois do primeiro download e so e baixada de
 * novo quando a versao no servidor muda.
 */
const SCOPE = 'global';
const COLLECTION = 'catalog';
const ID = 'current';

export async function loadCatalog(adapter: StorageAdapter): Promise<CatalogDto | null> {
  const item = (await adapter.loadAll(SCOPE)).find((i) => i.collection === COLLECTION && i.id === ID);
  return item ? (JSON.parse(item.json) as CatalogDto) : null;
}

/** Devolve o catalogo atualizado, ou null se o que esta no aparelho ja e o atual. */
export async function refreshCatalog(
  api: ApiClient,
  adapter: StorageAdapter,
  current: CatalogDto | null,
): Promise<CatalogDto | null> {
  const query = current ? `?version=${encodeURIComponent(current.version)}` : '';
  const response = await api.get<CatalogResponse>(`/v1/catalog${query}`);
  if ('unchanged' in response) return null;

  await adapter.write(SCOPE, {
    puts: [{ collection: COLLECTION, id: ID, json: JSON.stringify(response) }],
    deletes: [],
  });
  return response;
}

/** Identificador deste aparelho, enviado junto com as operacoes de sincronizacao. */
export async function loadDeviceId(adapter: StorageAdapter, newId: () => string): Promise<string> {
  const item = (await adapter.loadAll(SCOPE)).find((i) => i.collection === 'device' && i.id === 'id');
  if (item) return JSON.parse(item.json) as string;
  const deviceId = newId();
  await adapter.write(SCOPE, {
    puts: [{ collection: 'device', id: 'id', json: JSON.stringify(deviceId) }],
    deletes: [],
  });
  return deviceId;
}
