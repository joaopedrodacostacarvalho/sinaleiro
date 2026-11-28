import {
  onAuthStateChanged,
  signInWithCustomToken,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { auth, googleProvider } from './firebase';
import { syncPerfilPassageiro, type PerfilPassageiro } from '../api/mapa';
import { AuthContext } from './useAuth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<PerfilPassageiro | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshPerfil = useCallback(async () => {
    if (!auth.currentUser) {
      setPerfil(null);
      return;
    }
    try {
      const dados = await syncPerfilPassageiro();
      setPerfil(dados);
    } catch {
      setPerfil(null);
    }
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        await refreshPerfil();
      } else {
        setPerfil(null);
      }
      setLoading(false);
    });
  }, [refreshPerfil]);

  const signIn = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const signInWithToken = async (customToken: string) => {
    await signInWithCustomToken(auth, customToken.trim());
  };

  const signOutUser = async () => {
    await signOut(auth);
    setPerfil(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        perfil,
        loading,
        signIn,
        signInWithToken,
        refreshPerfil,
        signOutUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
