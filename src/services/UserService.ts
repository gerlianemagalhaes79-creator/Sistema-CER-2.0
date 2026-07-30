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

const listeners = new Set<(users: User[]) => void>();

const getLocalUsersCache = (): User[] => {
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure default users exist if not already in parsed
        const map = new Map<string, User>();
        DEFAULT_USERS.forEach(u => map.set(u.id, u));
        parsed.forEach(u => map.set(u.id, u));
        return Array.from(map.values());
      }
    }
  } catch (e) {
    console.error('Error reading users cache:', e);
  }
  return DEFAULT_USERS;
};

const saveLocalUsersCache = (users: User[]) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(users));
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

const mergeUsers = (firestoreDocs: User[]): User[] => {
  const localCache = getLocalUsersCache();
  const map = new Map<string, User>();

  // 1. Base default users
  DEFAULT_USERS.forEach(u => map.set(u.id, u));

  // 2. Overlay local cache
  localCache.forEach(u => map.set(u.id, u));

  // 3. Overlay Firestore documents (preserving fields if doc is partial)
  firestoreDocs.forEach(u => {
    const existing = map.get(u.id);
    map.set(u.id, { ...(existing || {}), ...u });
  });

  const mergedAll = Array.from(map.values());
  saveLocalUsersCache(mergedAll);

  return mergedAll.filter(u => u.status !== 'Inactive');
};

export const UserService = {
  getActiveUsers: (): User[] => {
    const cache = getLocalUsersCache();
    return cache.filter(u => u.status !== 'Inactive');
  },

  getUsers: async (): Promise<User[]> => {
    const PATH = 'usuarios';
    const cachedActive = UserService.getActiveUsers();
    try {
      const q = query(collection(db, PATH));
      const snapshot = await getDocs(q);
      const fetched = snapshot.docs.map(doc => doc.data() as User);
      if (fetched.length > 0) {
        return mergeUsers(fetched);
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
        const fetched = snapshot.docs.map(doc => doc.data() as User);
        const active = mergeUsers(fetched);
        callback(active);
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

    try {
      await setDoc(doc(db, PATH, id), newUser);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.CREATE, PATH);
    }
    return newUser;
  },

  updateUser: async (id: string, updates: Partial<User>): Promise<User> => {
    const PATH = 'usuarios';
    const local = getLocalUsersCache();
    const existing = local.find(u => u.id === id) || DEFAULT_USERS.find(u => u.id === id);
    const updatedUser: User = {
      ...(existing || { id, name: '', email: '', role: '', accessType: AccessType.Profissional, status: 'Active' }),
      createdAt: existing?.createdAt || new Date().toISOString(),
      ...updates,
      id
    };

    const exists = local.some(u => u.id === id);
    const updatedCache = exists ? local.map(u => u.id === id ? updatedUser : u) : [...local, updatedUser];
    saveLocalUsersCache(updatedCache);
    notifySubscribers();

    try {
      await setDoc(doc(db, PATH, id), updatedUser, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, PATH);
    }
    return updatedUser;
  },

  deleteUser: async (id: string): Promise<void> => {
    const PATH = 'usuarios';

    const local = getLocalUsersCache();
    const existing = local.find(u => u.id === id) || DEFAULT_USERS.find(u => u.id === id);

    const inactiveUser: User = {
      ...(existing || { 
        id, 
        name: 'Usuário', 
        email: '', 
        role: '', 
        accessType: AccessType.Profissional, 
        createdAt: new Date().toISOString() 
      }),
      status: 'Inactive',
      deletedAt: new Date().toISOString()
    };

    const exists = local.some(u => u.id === id);
    const updatedCache = exists ? local.map(u => u.id === id ? inactiveUser : u) : [...local, inactiveUser];
    saveLocalUsersCache(updatedCache);
    notifySubscribers();

    try {
      await setDoc(doc(db, PATH, id), inactiveUser, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, PATH);
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
    const term = loginInput.trim().toLowerCase();
    const pass = passwordInput.trim();

    if (!term) {
      throw new Error('Informe o nome completo ou e-mail.');
    }
    if (!pass) {
      throw new Error('Informe a senha de acesso.');
    }

    let allUsers: User[] = [];
    try {
      allUsers = await UserService.getUsers();
    } catch (e) {
      allUsers = DEFAULT_USERS;
    }

    // Match exact or partial name, or exact email
    const matched = allUsers.find(
      u => u.name.toLowerCase() === term ||
           u.email.toLowerCase() === term ||
           u.name.toLowerCase().includes(term)
    ) || DEFAULT_USERS.find(
      u => u.name.toLowerCase() === term ||
           u.email.toLowerCase() === term ||
           u.name.toLowerCase().includes(term)
    );

    if (!matched) {
      throw new Error('Usuário não encontrado. Verifique o nome completo ou e-mail digitado.');
    }

    if (matched.status !== 'Active') {
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

  changePassword: async (current: string, newPass: string): Promise<boolean> => {
    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPass);
      }
      return true;
    } catch (error) {
      console.error('Change Password Error:', error);
      return true; // Soft success for local mode
    }
  }
};

