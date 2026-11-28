import { createContext, useContext } from 'react';
import type { User } from 'firebase/auth';
import type { PerfilPassageiro } from '../api/mapa';

export interface AuthContextValue {
  user: User | null;
  perfil: PerfilPassageiro | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signInWithToken: (customToken: string) => Promise<void>;
  refreshPerfil: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
