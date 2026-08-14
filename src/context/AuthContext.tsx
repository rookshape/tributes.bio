import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
} from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ensureUserRecord, getUserRecord } from "../lib/account";
import { auth } from "../lib/firebase";
import type { AppUser } from "../lib/types";
import type { User } from "firebase/auth";

type AuthContextValue = {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
  refreshAppUser: () => Promise<AppUser | null>;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  createAccountWithEmail: (email: string, password: string) => Promise<void>;
  sendPasswordReset: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshAppUser = useCallback(async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      setAppUser(null);
      return null;
    }

    const record = await getUserRecord(currentUser.uid);
    setAppUser(record);
    return record;
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);

      if (!nextUser) {
        setAppUser(null);
        setLoading(false);
        return;
      }

      const record = await ensureUserRecord(nextUser);
      setAppUser(record);
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      appUser,
      loading,
      refreshAppUser,
      signInWithGoogle: async () => {
        const result = await signInWithPopup(auth, new GoogleAuthProvider());
        await ensureUserRecord(result.user);
        await refreshAppUser();
      },
      signInWithEmail: async (email, password) => {
        const result = await signInWithEmailAndPassword(auth, email, password);
        await ensureUserRecord(result.user);
        await refreshAppUser();
      },
      createAccountWithEmail: async (email, password) => {
        const result = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );
        await ensureUserRecord(result.user);
        await refreshAppUser();
      },
      sendPasswordReset: async () => {
        if (!auth.currentUser?.email) {
          throw new Error("No email address is attached to this account.");
        }

        await sendPasswordResetEmail(auth, auth.currentUser.email);
      },
      signOut: () => firebaseSignOut(auth),
    }),
    [appUser, loading, refreshAppUser, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return value;
}
