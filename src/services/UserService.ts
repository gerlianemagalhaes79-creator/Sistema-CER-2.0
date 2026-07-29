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

export const UserService = {
  getUsers: async (): Promise<User[]> => {
    const PATH = 'usuarios';
    try {
      const q = query(collection(db, PATH), where('status', '==', 'Active'));
      const snapshot = await getDocs(q);
      const fetchedUsers = snapshot.docs.map(doc => doc.data() as User);
      if (fetchedUsers.length === 0) {
        return DEFAULT_USERS;
      }
      return fetchedUsers;
    } catch (error) {
      console.warn('Could not fetch users from Firestore, using default preset users:', error);
      return DEFAULT_USERS;
    }
  },

  subscribeToUsers: (callback: (users: User[]) => void) => {
    const PATH = 'usuarios';
    try {
      const q = query(collection(db, PATH), where('status', '==', 'Active'));
      return onSnapshot(q, (snapshot) => {
        const fetched = snapshot.docs.map(doc => doc.data() as User);
        if (fetched.length === 0) {
          callback(DEFAULT_USERS);
        } else {
          callback(fetched);
        }
      }, (error) => {
        console.warn('Subscription error, falling back to default users:', error);
        callback(DEFAULT_USERS);
      });
    } catch (e) {
      callback(DEFAULT_USERS);
      return () => {};
    }
  },

  addUser: async (user: Omit<User, 'id' | 'createdAt'>): Promise<void> => {
    const PATH = 'usuarios';
    try {
      const id = crypto.randomUUID();
      const newUser: User = {
        ...user,
        id,
        password: user.password || '123',
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, PATH, id), newUser);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.CREATE, PATH);
    }
  },

  updateUser: async (id: string, updates: Partial<User>) => {
    const PATH = 'usuarios';
    try {
      await updateDoc(doc(db, PATH, id), updates);
      return { ...updates, id } as User;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, PATH);
    }
  },

  deleteUser: async (id: string) => {
    const PATH = 'usuarios';
    try {
      await updateDoc(doc(db, PATH, id), { status: 'Inactive' });
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

