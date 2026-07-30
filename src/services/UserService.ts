import { 
  signOut, 
  updatePassword,
  User as FirebaseUser,
  onAuthStateChanged
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  getDocs, 
  collection, 
  query, 
  where,
  onSnapshot
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { User, AccessType } from '../types';

export const DEFAULT_USERS: User[] = [
  {
    id: 'user-admin-1',
    name: 'Gerliane Magalhães',
    email: 'gerlianemagalhaes79@gmail.com',
    role: 'Administradora Geral',
    accessType: AccessType.Administrador,
    status: 'Active',
    password: '123',
    createdAt: new Date().toISOString()
  },
  {
    id: 'user-admin-2',
    name: 'CER II Policlínica Sobral',
    email: 'cer2polisobral@gmail.com',
    role: 'Administrador do Sistema',
    accessType: AccessType.Administrador,
    status: 'Active',
    password: '123',
    createdAt: new Date().toISOString()
  },
  {
    id: 'user-coord-1',
    name: 'Coordenação Terapêutica',
    email: 'coordenacao@cer.local',
    role: 'Coordenadora de Área',
    accessType: AccessType.Coordenação,
    status: 'Active',
    password: '123',
    createdAt: new Date().toISOString()
  },
  {
    id: 'user-recep-1',
    name: 'Recepção CER',
    email: 'recepcao@cer.local',
    role: 'Atendente de Recepção',
    accessType: AccessType.Recepção,
    status: 'Active',
    password: '123',
    createdAt: new Date().toISOString()
  },
  {
    id: 'user-prof-1',
    name: 'Dra. Maria Clara',
    email: 'dra.mariaclara@cer.local',
    role: 'Fisioterapeuta Especialista',
    accessType: AccessType.Profissional,
    status: 'Active',
    password: '123',
    createdAt: new Date().toISOString()
  }
];

const LOCAL_STORAGE_KEY = 'cer_logged_user';
const CACHE_KEY = 'cer_users_cache_v2';
const SEED_KEY = 'cer_users_seeded_v1';
const DELETED_USERS_KEY = 'cer_deleted_users_v1';

const getDeletedUserIds = (): Set<string> => {
  try {
    const stored = localStorage.getItem(DELETED_USERS_KEY);
    if (stored) return new Set(JSON.parse(stored));
  } catch (e) {
    console.error('Error reading deleted users set:', e);
  }
  return new Set();
};

const markUserDeleted = (id: string) => {
  const set = getDeletedUserIds();
  set.add(id);
  try {
    localStorage.setItem(DELETED_USERS_KEY, JSON.stringify(Array.from(set)));
  } catch (e) {
    console.error('Error saving deleted users set:', e);
  }
};

const listeners = new Set<(users: User[]) => void>();

const getLocalUsersCache = (): User[] => {
  const deletedIds = getDeletedUserIds();
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.filter(u => u && u.id && !deletedIds.has(u.id));
      }
    }
  } catch (e) {
    console.error('Error reading users cache:', e);
  }
  const base = localStorage.getItem(SEED_KEY) ? [] : DEFAULT_USERS;
  return base.filter(u => u && u.id && !deletedIds.has(u.id));
};

const saveLocalUsersCache = (users: User[]) => {
  const deletedIds = getDeletedUserIds();
  const cleanUsers = users.filter(u => u && u.id && !deletedIds.has(u.id));
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cleanUsers));
  } catch (e) {
    console.error('Error saving users cache:', e);
  }
};

const notifySubscribers = () => {
  const activeUsers = UserService.getActiveUsers();
  listeners.forEach(cb => {
    try {
      cb(activeUsers);
    } catch (e) {
      console.error('Subscriber notification error:', e);
    }
  });
};

export const UserService = {
  getActiveUsers: (): User[] => {
    const cache = getLocalUsersCache();
    const deletedIds = getDeletedUserIds();
    return cache.filter(u => u.status !== 'Inactive' && !deletedIds.has(u.id));
  },

  getUsers: async (): Promise<User[]> => {
    const PATH = 'usuarios';
    const cachedActive = UserService.getActiveUsers();
    try {
      const q = query(collection(db, PATH));
      const snapshot = await getDocs(q);
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      if (fetched.length > 0) {
        localStorage.setItem(SEED_KEY, 'true');
        saveLocalUsersCache(fetched);
        return UserService.getActiveUsers();
      }
      return cachedActive;
    } catch (error) {
      return cachedActive;
    }
  },

  subscribeToUsers: (callback: (users: User[]) => void) => {
    listeners.add(callback);
    
    // Immediately emit local active users
    callback(UserService.getActiveUsers());

    const PATH = 'usuarios';
    try {
      const q = query(collection(db, PATH));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
        if (fetched.length === 0 && !localStorage.getItem(SEED_KEY)) {
          localStorage.setItem(SEED_KEY, 'true');
          const deletedIds = getDeletedUserIds();
          const initialSeed = DEFAULT_USERS.filter(u => !deletedIds.has(u.id));
          initialSeed.forEach(u => {
            setDoc(doc(db, PATH, u.id), u).catch(err => console.error('Error seeding default user:', err));
          });
          saveLocalUsersCache(initialSeed);
          callback(UserService.getActiveUsers());
        } else {
          localStorage.setItem(SEED_KEY, 'true');
          saveLocalUsersCache(fetched);
          callback(UserService.getActiveUsers());
        }
      }, (error) => {
        console.warn('Subscription error on usuarios:', error);
        callback(UserService.getActiveUsers());
      });

      return () => {
        listeners.delete(callback);
        unsubscribe();
      };
    } catch (e) {
      callback(UserService.getActiveUsers());
      return () => {
        listeners.delete(callback);
      };
    }
  },

  addUser: async (user: Omit<User, 'id' | 'createdAt'>): Promise<User> => {
    const PATH = 'usuarios';
    const id = `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newUser: User = {
      ...user,
      id,
      password: user.password || '123',
      status: user.status || 'Active',
      createdAt: new Date().toISOString(),
    };

    // Update local cache immediately
    const local = getLocalUsersCache();
    const updatedCache = [newUser, ...local.filter(u => u.id !== id)];
    saveLocalUsersCache(updatedCache);
    notifySubscribers();

    setDoc(doc(db, PATH, id), newUser)
      .catch(error => handleFirestoreError(error, OperationType.CREATE, PATH));

    return newUser;
  },

  updateUser: async (id: string, updates: Partial<User>): Promise<User> => {
    const PATH = 'usuarios';
    const local = getLocalUsersCache();
    const existing = local.find(u => u.id === id) || DEFAULT_USERS.find(u => u.id === id);

    // If password in updates is empty string or undefined, preserve existing password!
    const cleanUpdates = { ...updates };
    if (cleanUpdates.password !== undefined && (!cleanUpdates.password || !cleanUpdates.password.trim())) {
      delete cleanUpdates.password;
    }

    const updatedUser: User = {
      ...(existing || { id, name: '', email: '', role: '', accessType: AccessType.Profissional, status: 'Active' }),
      createdAt: existing?.createdAt || new Date().toISOString(),
      ...cleanUpdates,
      id
    };

    const exists = local.some(u => u.id === id);
    const updatedCache = exists ? local.map(u => u.id === id ? updatedUser : u) : [...local, updatedUser];
    saveLocalUsersCache(updatedCache);
    notifySubscribers();

    setDoc(doc(db, PATH, id), updatedUser, { merge: true })
      .catch(error => handleFirestoreError(error, OperationType.UPDATE, PATH));

    return updatedUser;
  },

  deleteUser: async (id: string): Promise<void> => {
    const PATH = 'usuarios';
    markUserDeleted(id);

    const local = getLocalUsersCache();
    const updatedCache = local.filter(u => u.id !== id);
    saveLocalUsersCache(updatedCache);
    notifySubscribers();

    try {
      await deleteDoc(doc(db, PATH, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, PATH);
    }
  },

  loginDirectly: (user: User): User => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(user));
    } catch (e) {
      console.error('Failed to save session to localStorage:', e);
    }
    return user;
  },

  loginWithCredentials: async (loginInput: string, passwordInput: string): Promise<User> => {
    const term = loginInput.trim();
    const pass = passwordInput.trim();

    if (!term) {
      throw new Error('Informe o nome do funcionário ou e-mail cadastrado.');
    }
    if (!pass) {
      throw new Error('Informe a senha de acesso.');
    }

    const normalize = (str: string) => str.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const normalizedTerm = normalize(term);

    // 1. Check local cache / default users first for instant login (<10ms)
    const localUsers = UserService.getActiveUsers();
    let matched = localUsers.find(u => 
      normalize(u.name) === normalizedTerm || 
      normalize(u.email) === normalizedTerm
    );

    // 2. If not found in local cache, fallback to fetching from Firestore
    if (!matched) {
      try {
        const firestoreUsers = await UserService.getUsers();
        matched = firestoreUsers.find(u => 
          normalize(u.name) === normalizedTerm || 
          normalize(u.email) === normalizedTerm
        );
      } catch (e) {
        console.warn('Firestore fetch user fallback error:', e);
      }
    }

    if (!matched) {
      throw new Error('Usuário não encontrado. Digite o nome completo do funcionário ou e-mail cadastrado.');
    }

    if (matched.status === 'Inactive') {
      throw new Error('Esta conta de usuário está inativa. Contate a administração.');
    }

    const expectedPassword = matched.password || '123';
    if (expectedPassword !== pass) {
      throw new Error('Senha incorreta. Tente novamente.');
    }

    return UserService.loginDirectly(matched);
  },

  logout: async () => {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      await signOut(auth);
    } catch (error) {
      console.error('Logout Error:', error);
    }
  },

  getCurrentUser: async (): Promise<User | null> => {
    // 1. Try local storage session
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as User;
      }
    } catch (e) {
      console.error('Error reading session from localStorage:', e);
    }

    // 2. Try firebase user if any
    const firebaseUser = auth.currentUser;
    if (firebaseUser) {
      try {
        const userDoc = await getDoc(doc(db, 'usuarios', firebaseUser.uid));
        if (userDoc.exists()) {
          return userDoc.data() as User;
        }
      } catch (e) {
        console.warn('Firestore user fetch failed:', e);
      }
    }
    
    return null;
  },

  changePassword: async (userId: string, currentPass: string, newPass: string): Promise<boolean> => {
    const PATH = 'usuarios';
    const local = getLocalUsersCache();
    let existing = local.find(u => u.id === userId) || DEFAULT_USERS.find(u => u.id === userId);

    if (!existing) {
      try {
        const userDoc = await getDoc(doc(db, PATH, userId));
        if (userDoc.exists()) {
          existing = userDoc.data() as User;
        }
      } catch (e) {
        console.error('Error fetching user for password change:', e);
      }
    }

    if (!existing) {
      throw new Error('Usuário não encontrado.');
    }

    const currentActualPassword = existing.password || '123';
    if (currentActualPassword !== currentPass.trim()) {
      throw new Error('A senha atual informada está incorreta.');
    }

    const updatedUser: User = {
      ...existing,
      password: newPass.trim()
    };

    // Update local cache
    const existsInLocal = local.some(u => u.id === userId);
    const updatedCache = existsInLocal 
      ? local.map(u => u.id === userId ? updatedUser : u) 
      : [...local, updatedUser];
    saveLocalUsersCache(updatedCache);
    notifySubscribers();

    // Update active session if changing logged in user's password
    try {
      const storedSession = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedSession) {
        const parsedSession = JSON.parse(storedSession) as User;
        if (parsedSession.id === userId) {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedUser));
        }
      }
    } catch (e) {
      console.error('Error updating logged user session:', e);
    }

    // Persist to Firestore
    await setDoc(doc(db, PATH, userId), updatedUser, { merge: true });

    if (auth.currentUser) {
      try {
        await updatePassword(auth.currentUser, newPass);
      } catch (e) {
        console.warn('Firebase Auth password update skipped/failed:', e);
      }
    }

    return true;
  }
};

