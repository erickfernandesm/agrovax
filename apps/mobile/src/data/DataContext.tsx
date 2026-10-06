import {
  computeAlerts,
  planNotifications,
  todayIso,
  type CatalogDto,
  type EntityName,
  type EntityRecord,
  type HealthAlert,
  type HerdRecords,
  type SyncPullResponse,
  type SyncPushResponse,
} from '@agrovax/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../features/auth/AuthContext';
import { useConnectivity } from '../hooks/useConnectivity';
import { newId } from '../lib/id';
import { api } from '../services/container';
import { getNotificationPermission, scheduleNotifications } from '../services/notifications';
import { colors, spacing, typography } from '../theme/tokens';
import { loadCatalog, loadDeviceId, refreshCatalog } from './catalog';
import { LocalStore } from './store/LocalStore';
import { platformAdapter } from './store/platformAdapter';
import { SyncEngine, type SyncStatus, type SyncTransport } from './sync/SyncEngine';

/**
 * Liga o banco local e o motor de sincronizacao a interface.
 * Abre o banco da fazenda ativa, sincroniza ao abrir, ao reconectar, apos
 * cada gravacao e periodicamente, e reagenda as notificacoes locais.
 */

const PERIODIC_SYNC_MS = 5 * 60 * 1000;

const transport: SyncTransport = {
  push: (farmId, body) => api.post<SyncPushResponse>(`/v1/farms/${farmId}/sync/push`, body),
  pull: (farmId, cursor, limit) =>
    api.get<SyncPullResponse>(`/v1/farms/${farmId}/sync/pull?cursor=${cursor}&limit=${limit}`),
};

interface DataValue {
  store: LocalStore;
  engine: SyncEngine;
  catalog: CatalogDto | null;
}

const DataContext = createContext<DataValue | null>(null);

type AlertState = Record<string, { dismissedAt?: string }>;

export function DataProvider({ children }: { children: ReactNode }) {
  const { activeFarm, refreshProfile } = useAuth();
  const { isOnline } = useConnectivity();
  const farmId = activeFarm?.id ?? null;

  const onlineRef = useRef(isOnline);
  onlineRef.current = isOnline;

  const [value, setValue] = useState<DataValue | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const catalogRef = useRef<CatalogDto | null>(null);

  const updateCatalog = useCallback(async () => {
    const fresh = await refreshCatalog(api, platformAdapter, catalogRef.current).catch(() => null);
    if (fresh) {
      catalogRef.current = fresh;
      setValue((current) => (current ? { ...current, catalog: fresh } : current));
    }
  }, []);

  useEffect(() => {
    if (!farmId) return;
    let disposed = false;
    let engine: SyncEngine | null = null;
    setValue(null);
    setFailure(null);

    void (async () => {
      try {
        const [store, deviceId, catalog] = await Promise.all([
          LocalStore.open(farmId, platformAdapter, { newId, now: () => new Date() }),
          loadDeviceId(platformAdapter, newId),
          loadCatalog(platformAdapter),
        ]);
        if (disposed) return;

        engine = new SyncEngine(store, transport, { deviceId, isOnline: () => onlineRef.current });
        const current = engine;
        store.onLocalChange = () => current.requestSync();
        catalogRef.current = catalog;
        setValue({ store, engine: current, catalog });

        void current.sync();
        void updateCatalog();
      } catch (error) {
        if (!disposed) {
          setFailure(error instanceof Error ? error.message : 'Não foi possível abrir os dados locais.');
        }
      }
    })();

    return () => {
      disposed = true;
      engine?.stop();
    };
  }, [farmId, updateCatalog]);

  const engine = value?.engine ?? null;

  // Reconexao: avisa o motor, que envia a fila pendente.
  useEffect(() => {
    engine?.connectivityChanged();
    if (isOnline && engine) void updateCatalog();
  }, [isOnline, engine, updateCatalog]);

  // Sincronizacao periodica e ao voltar para o app.
  useEffect(() => {
    if (!engine) return;
    const refresh = () => {
      void engine.sync();
      void updateCatalog();
      void refreshProfile();
    };
    const timer = setInterval(refresh, PERIODIC_SYNC_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [engine, updateCatalog, refreshProfile]);

  if (failure) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{failure}</Text>
      </View>
    );
  }
  if (!value) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loading}>Abrindo os dados da fazenda...</Text>
      </View>
    );
  }

  return (
    <DataContext.Provider value={value}>
      <NotificationScheduler />
      {children}
    </DataContext.Provider>
  );
}

function useData(): DataValue {
  const value = useContext(DataContext);
  if (!value) throw new Error('Os dados só estão disponíveis dentro de <DataProvider>.');
  return value;
}

export function useStore(): LocalStore {
  return useData().store;
}

export function useSyncEngine(): SyncEngine {
  return useData().engine;
}

export function useCatalog(): CatalogDto | null {
  return useData().catalog;
}

/** Registros nao excluidos de uma entidade; a tela e atualizada a cada alteracao. */
export function useRecords<K extends EntityName>(entity: K): EntityRecord<K>[] {
  const store = useStore();
  return useSyncExternalStore(
    store.subscribe,
    () => store.all(entity),
    () => store.all(entity),
  );
}

export function useRecord<K extends EntityName>(entity: K, id: string | undefined): EntityRecord<K> | null {
  const records = useRecords(entity);
  return useMemo(() => records.find((record) => record.id === id) ?? null, [records, id]);
}

export function useHerdRecords(): HerdRecords {
  const animals = useRecords('animal');
  const lots = useRecords('lot');
  const vaccinations = useRecords('vaccination');
  const treatments = useRecords('treatment');
  const symptomRecords = useRecords('symptomRecord');
  const healthEvents = useRecords('healthEvent');
  return useMemo(
    () => ({ animals, lots, vaccinations, treatments, symptomRecords, healthEvents }),
    [animals, lots, vaccinations, treatments, symptomRecords, healthEvents],
  );
}

export function useSyncStatus(): SyncStatus {
  const engine = useSyncEngine();
  return useSyncExternalStore(engine.subscribe, engine.getStatus, engine.getStatus);
}

function useStoreRevision(): number {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, store.getRevision, store.getRevision);
}

export interface AlertCenter {
  /** Alertas ativos (nao dispensados), calculados com os dados locais. */
  alerts: HealthAlert[];
  dismissed: HealthAlert[];
  dismiss: (key: string) => Promise<void>;
  restore: (key: string) => Promise<void>;
}

export function useAlerts(): AlertCenter {
  const store = useStore();
  const records = useHerdRecords();
  const revision = useStoreRevision();

  return useMemo(() => {
    void revision;
    const state = store.getMeta<AlertState>('alertState', {});
    const all = computeAlerts(records, todayIso());
    const isDismissed = (alert: HealthAlert) => Boolean(state[alert.key]?.dismissedAt);

    const save = (next: AlertState) => {
      // Guarda apenas o estado de alertas que ainda existem.
      const keys = new Set(all.map((alert) => alert.key));
      return store.setMeta(
        'alertState',
        Object.fromEntries(Object.entries(next).filter(([key]) => keys.has(key))),
      );
    };

    return {
      alerts: all.filter((alert) => !isDismissed(alert)),
      dismissed: all.filter(isDismissed),
      dismiss: (key) => save({ ...state, [key]: { dismissedAt: new Date().toISOString() } }),
      restore: (key) => {
        const { [key]: _removed, ...rest } = state;
        return save(rest);
      },
    };
  }, [store, records, revision]);
}

/** Reagenda as notificacoes locais sempre que vacinas ou tratamentos mudam. */
function NotificationScheduler() {
  const records = useHerdRecords();

  useEffect(() => {
    const timer = setTimeout(() => {
      void (async () => {
        if ((await getNotificationPermission()) !== 'granted') return;
        await scheduleNotifications(planNotifications(records, todayIso()));
      })().catch(() => undefined);
    }, 2_000);
    return () => clearTimeout(timer);
  }, [records]);

  return null;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  loading: { ...typography.body, color: colors.textMuted },
  error: { ...typography.body, color: colors.danger, textAlign: 'center' },
});
