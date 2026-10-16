import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signOut as fbSignOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, call } from '../firebase';
import { personFrom } from '../data';
import type { Person, Role, UserDoc } from '../../shared/types';

export interface AuthState {
  status: 'loading' | 'signedOut' | 'needsName' | 'ready' | 'error';
  uid?: string;
  user?: UserDoc;
  person?: Person;
  roles: Role[];
  signOut: () => Promise<void>;
  refresh?: () => void;
}

const initial: AuthState = { status: 'loading', roles: [], signOut: async () => {} };
export const AuthContext = createContext<AuthState>(initial);

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [profileState, setProfileState] = useState<'pending' | 'needsName' | 'ok' | 'error'>('pending');
  const [user, setUser] = useState<UserDoc>();
  const [person, setPerson] = useState<Person>();
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);
  const signOut = useCallback(() => fbSignOut(auth), []);

  useEffect(() => onAuthStateChanged(auth, (u) => setUid(u ? u.uid : null)), []);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    setProfileState('pending');
    const viaFunction = () =>
      call<object, { needsName: boolean }>('ensureProfile', {})
        .then((r) => !cancelled && setProfileState(r.needsName ? 'needsName' : 'ok'))
        .catch(() => !cancelled && setProfileState('error'));
    // An existing profile (from the server, or the offline cache) is enough to start; the
    // callable is only needed on first login, so the door scanner still opens without internet.
    getDoc(doc(db, 'users', uid))
      .then((s) => {
        if (cancelled) return;
        if (s.exists()) setProfileState('ok');
        else viaFunction();
      })
      .catch(() => !cancelled && viaFunction());
    return () => {
      cancelled = true;
    };
  }, [uid, tick]);

  useEffect(() => {
    if (!uid || profileState !== 'ok') return;
    return onSnapshot(doc(db, 'users', uid), (s) => {
      if (!s.exists()) return;
      const d = s.data();
      setUser({ uid, personId: d.personId, householdId: d.householdId, roles: d.roles ?? [], lang: d.lang });
    });
  }, [uid, profileState]);

  useEffect(() => {
    if (!user?.personId) return;
    return onSnapshot(doc(db, 'people', user.personId), (s) => s.exists() && setPerson(personFrom(s)));
  }, [user?.personId]);

  let value: AuthState;
  if (uid === undefined) value = { ...initial, signOut };
  else if (uid === null) value = { status: 'signedOut', roles: [], signOut };
  else if (profileState === 'needsName') value = { status: 'needsName', uid, roles: [], signOut, refresh };
  else if (profileState === 'error') value = { status: 'error', uid, roles: [], signOut, refresh };
  else if (!user) value = { status: 'loading', uid, roles: [], signOut };
  else value = { status: 'ready', uid, user, person, roles: user.roles, signOut, refresh };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
