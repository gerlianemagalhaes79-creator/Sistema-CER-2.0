import { 
  collection, 
  doc, 
  getDocs, 
  query, 
  onSnapshot,
  setDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Professional } from '../types';

const CACHE_KEY = 'cer_professionals_cache_v2';

const listeners = new Set<(professionals: Professional[]) => void>();

const getLocalCache = (): Professional[] => {
  try {
    const data = localStorage.getItem(CACHE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed.filter(p => !p.id.startsWith('default-pro-'));
      }
    }
  } catch (e) {
    console.error('Error reading professional cache:', e);
  }
  return [];
};

const saveLocalCache = (items: Professional[]) => {
  try {
    const cleanItems = items.filter(p => !p.id.startsWith('default-pro-'));
    localStorage.setItem(CACHE_KEY, JSON.stringify(cleanItems));
  } catch (e) {
    console.error('Error saving professional cache:', e);
  }
};

const getActiveProfessionals = (): Professional[] => {
  const cache = getLocalCache();
  return cache
    .filter(p => p.status === 'Active' && !p.id.startsWith('default-pro-'))
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
};

const notifySubscribers = () => {
  const active = getActiveProfessionals();
  listeners.forEach(cb => {
    try {
      cb(active);
    } catch (e) {
      console.error('Professional subscriber notification error:', e);
    }
  });
};

const mergeProfessionals = (firestoreDocs: Professional[]): Professional[] => {
  const localCache = getLocalCache();
  const map = new Map<string, Professional>();

  localCache.forEach(p => {
    if (p && p.id && !p.id.startsWith('default-pro-')) {
      map.set(p.id, p);
    }
  });

  firestoreDocs.forEach(p => {
    if (p && p.id && !p.id.startsWith('default-pro-')) {
      const existing = map.get(p.id);
      map.set(p.id, { ...(existing || {}), ...p });
    }
  });

  const merged = Array.from(map.values());
  saveLocalCache(merged);
  return merged.filter(p => p.status === 'Active').sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
};

let firestoreUnsubscribe: (() => void) | null = null;

export const ProfessionalService = {
  getProfessionals: async (): Promise<Professional[]> => {
    const PATH = 'profissionais';
    try {
      const q = query(collection(db, PATH));
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map(doc => doc.data() as Professional);
      if (docs.length > 0) {
        return mergeProfessionals(docs);
      }
      return getActiveProfessionals();
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, PATH);
      return getActiveProfessionals();
    }
  },

  subscribeToProfessionals: (callback: (professionals: Professional[]) => void) => {
    listeners.add(callback);
    callback(getActiveProfessionals());

    if (listeners.size === 1 && !firestoreUnsubscribe) {
      const PATH = 'profissionais';
      try {
        const q = query(collection(db, PATH));
        firestoreUnsubscribe = onSnapshot(q, (snapshot) => {
          const fetched = snapshot.docs.map(doc => doc.data() as Professional);
          mergeProfessionals(fetched);
          notifySubscribers();
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, PATH);
          notifySubscribers();
        });
      } catch (e) {
        notifySubscribers();
      }
    }

    return () => {
      listeners.delete(callback);
      if (listeners.size === 0 && firestoreUnsubscribe) {
        firestoreUnsubscribe();
        firestoreUnsubscribe = null;
      }
    };
  },

  addProfessional: async (professional: Omit<Professional, 'id' | 'createdAt'>): Promise<Professional> => {
    const PATH = 'profissionais';
    const id = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : `pro-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      
    const newProfessional: Professional = {
      ...professional,
      id,
      createdAt: new Date().toISOString(),
    };

    const cache = getLocalCache();
    const updatedCache = [newProfessional, ...cache.filter(p => p.id !== id)];
    saveLocalCache(updatedCache);
    notifySubscribers();

    // Async sync to Firestore
    setDoc(doc(db, PATH, id), newProfessional)
      .catch(error => handleFirestoreError(error, OperationType.CREATE, PATH));

    return newProfessional;
  },

  updateProfessional: async (id: string, updates: Partial<Professional>): Promise<void> => {
    const PATH = 'profissionais';
    const cache = getLocalCache();
    const existing = cache.find(p => p.id === id);
    const updated: Professional = {
      ...(existing || { id, name: '', area: '', status: 'Active', createdAt: new Date().toISOString() }),
      ...updates
    };

    const updatedCache = cache.some(p => p.id === id) 
      ? cache.map(p => p.id === id ? updated : p) 
      : [...cache, updated];

    saveLocalCache(updatedCache);
    notifySubscribers();

    setDoc(doc(db, PATH, id), updated, { merge: true })
      .catch(error => handleFirestoreError(error, OperationType.UPDATE, PATH));
  },

  deleteProfessional: async (id: string): Promise<void> => {
    const PATH = 'profissionais';
    const cache = getLocalCache();
    const existing = cache.find(p => p.id === id);

    const inactive: Professional = {
      ...(existing || { id, name: '', area: '', status: 'Inactive', createdAt: new Date().toISOString() }),
      status: 'Inactive'
    };

    const updatedCache = cache.some(p => p.id === id) 
      ? cache.map(p => p.id === id ? inactive : p) 
      : [...cache, inactive];

    saveLocalCache(updatedCache);
    notifySubscribers();

    setDoc(doc(db, PATH, id), inactive, { merge: true })
      .catch(error => handleFirestoreError(error, OperationType.UPDATE, PATH));
  }
};

