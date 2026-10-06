import { useNetInfo } from '@react-native-community/netinfo';

export interface Connectivity {
  /** false somente quando ha certeza de que nao existe conexao. */
  isOnline: boolean;
}

/**
 * Estado da conexao. Enquanto o sistema ainda nao informou (valor nulo),
 * assume-se online para nao exibir "Offline" por engano na abertura do app.
 */
export function useConnectivity(): Connectivity {
  const info = useNetInfo();
  const isOnline = info.isConnected !== false && info.isInternetReachable !== false;
  return { isOnline };
}
