import type {
  FarmDto,
  LoginInput,
  RegisterInput,
  UpdateFarmInput,
  UserDto,
} from '@agrovax/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { onSessionExpired } from '../../services/container';
import type { StoredProfile } from '../../services/session/sessionStorage';
import { authService } from './authService';

type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; profile: StoredProfile };

interface AuthContextValue {
  status: AuthState['status'];
  user: UserDto | null;
  farms: FarmDto[];
  activeFarm: FarmDto | null;
  signIn: (input: LoginInput) => Promise<void>;
  signUp: (input: RegisterInput) => Promise<void>;
  signOut: () => Promise<void>;
  updateActiveFarm: (input: UpdateFarmInput) => Promise<void>;
  /** Atualiza usuario, fazendas e plano a partir do servidor (silencioso se offline). */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const profile = await authService.restore().catch(() => null);
      if (cancelled) return;
      if (!profile) {
        setState({ status: 'signedOut' });
        return;
      }
      // Entra imediatamente com os dados locais; a atualizacao pelo servidor
      // e opcional e falha em silencio quando nao ha internet.
      setState({ status: 'signedIn', profile });
      const fresh = await authService.refreshProfile(profile).catch(() => null);
      if (!cancelled && fresh && stateRef.current.status === 'signedIn') {
        setState({ status: 'signedIn', profile: fresh });
      }
    })();

    const unsubscribe = onSessionExpired(() => {
      void authService.clearLocalSession().finally(() => setState({ status: 'signedOut' }));
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (input: LoginInput) => {
    setState({ status: 'signedIn', profile: await authService.signIn(input) });
  }, []);

  const signUp = useCallback(async (input: RegisterInput) => {
    setState({ status: 'signedIn', profile: await authService.signUp(input) });
  }, []);

  const signOut = useCallback(async () => {
    await authService.signOut();
    setState({ status: 'signedOut' });
  }, []);

  const updateActiveFarm = useCallback(async (input: UpdateFarmInput) => {
    const current = stateRef.current;
    if (current.status !== 'signedIn' || !current.profile.activeFarmId) return;
    const profile = await authService.updateFarm(
      current.profile,
      current.profile.activeFarmId,
      input,
    );
    setState({ status: 'signedIn', profile });
  }, []);

  const refreshProfile = useCallback(async () => {
    const current = stateRef.current;
    if (current.status !== 'signedIn') return;
    const profile = await authService.refreshProfile(current.profile).catch(() => null);
    if (profile && stateRef.current.status === 'signedIn') setState({ status: 'signedIn', profile });
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const profile = state.status === 'signedIn' ? state.profile : null;
    return {
      status: state.status,
      user: profile?.user ?? null,
      farms: profile?.farms ?? [],
      activeFarm: profile?.farms.find((farm) => farm.id === profile.activeFarmId) ?? null,
      signIn,
      signUp,
      signOut,
      updateActiveFarm,
      refreshProfile,
    };
  }, [state, signIn, signUp, signOut, updateActiveFarm, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth precisa estar dentro de <AuthProvider>.');
  return value;
}
