import type { User } from 'firebase/auth';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { isAdmin as checkIsAdmin, signIn, signOut, watchAuthState } from '@/firebase/auth';
import { isFirebaseConfigured } from '@/firebase/config';
import { handleError } from '@/utils/errors';

/**
 * Sign-in state plus the separate question of whether that user is an admin.
 *
 * The two are tracked independently on purpose. `user` says who is signed in; `admin`
 * says whether the `admins/{uid}` document exists for them. A protected route needs
 * both, and conflating them is exactly the bug that would let any signed-up stranger
 * into the dashboard.
 *
 * `status` distinguishes "still checking" from "checked, not an admin". Without that
 * distinction a refresh on /admin flashes the login screen before the session resolves.
 */

export type AuthStatus = 'loading' | 'signedOut' | 'unauthorised' | 'admin';

interface AuthValue {
  user: User | null;
  status: AuthStatus;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>(
    isFirebaseConfigured() ? 'loading' : 'signedOut',
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured()) return;

    // Guard against a slow admin check resolving after the user signed out again.
    let current = true;

    const unsubscribe = watchAuthState(async (nextUser) => {
      if (!current) return;
      setUser(nextUser);

      if (!nextUser) {
        setStatus('signedOut');
        return;
      }

      setStatus('loading');
      const authorised = await checkIsAdmin(nextUser);
      if (!current) return;
      setStatus(authorised ? 'admin' : 'unauthorised');
    });

    return () => {
      current = false;
      unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      // `watchAuthState` picks it up from here and runs the admin check.
      await signIn(email, password);
    } catch (caught) {
      setStatus('signedOut');
      const message = handleError('useAuth.login', caught, 'Could not sign in.');
      setError(message);
      throw new Error(message);
    }
  }, []);

  const logout = useCallback(async () => {
    setError(null);
    try {
      await signOut();
    } catch (caught) {
      setError(handleError('useAuth.logout', caught, 'Could not sign out.'));
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<AuthValue>(
    () => ({ user, status, error, login, logout, clearError }),
    [user, status, error, login, logout, clearError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}
