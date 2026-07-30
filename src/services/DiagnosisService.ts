import { 
  collection, 
  doc, 
  getDocs, 
  query, 
  onSnapshot,
  setDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Diagnosis, DIAGNOSES } from '../types';

const CACHE_KEY = 'cer_diagnoses_cache_v2';

const INITIAL_SEED_DIAGNOSES: Diagnosis[] = DIAGNOSES.map((diagName, index) => ({
  id: `diag-seed-${index + 1}`,
  name: diagName,
  status: 'Active',
  createdAt: new Date().toISOString()
}));

const listeners = new Set<(diagnoses: Diagnosis[]) => void>();

const getLocalCache = (): Diagnosis[] => {
  try {
    const data = localStorage.getItem(CACHE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
    saveLocalCache(INITIAL_SEED_DIAGNOSES);
    return INITIAL_SEED_DIAGNOSES;
  } catch (e) {
    console.error('Error reading diagnosis cache:', e);
  }
  return INITIAL_SEED_DIAGNOSES;
};

const saveLocalCache = (items: Diagnosis[]) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Error saving diagnosis cache:', e);
  }
};

const getActiveDiagnoses = (): Diagnosis[] => {
  const cache = getLocalCache();
  return cache
    .filter(d => d.status === 'Active')
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
};

const notifySubscribers = () => {
  const active = getActiveDiagnoses();
  listeners.forEach(cb => {
    try {
      cb(active);
    } catch (e) {
      console.error('Diagnosis subscriber notification error:', e);
    }
  });
};

const mergeDiagnoses = (firestoreDocs: Diagnosis[]): Diagnosis[] => {
  const localCache = getLocalCache();
  const map = new Map<string, Diagnosis>();

  localCache.forEach(d => {
    if (d && d.id) {
      map.set(d.id, d);
    }
  });

  firestoreDocs.forEach(d => {
    if (d && d.id) {
      const existing = map.get(d.id);
      map.set(d.id, { ...(existing || {}), ...d });
    }
  });

  const merged = Array.from(map.values());
  saveLocalCache(merged);
  return merged.filter(d => d.status === 'Active').sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
};

let firestoreUnsubscribe: (() => void) | null = null;

export const DiagnosisService = {
  getDiagnoses: async (): Promise<Diagnosis[]> => {
    const PATH = 'diagnosticos';
    try {
      const q = query(collection(db, PATH));
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map(doc => doc.data() as Diagnosis);
      if (docs.length > 0) {
        return mergeDiagnoses(docs);
      }
      return getActiveDiagnoses();
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, PATH);
      return getActiveDiagnoses();
    }
  },

  subscribeToDiagnoses: (callback: (diagnoses: Diagnosis[]) => void) => {
    listeners.add(callback);
    callback(getActiveDiagnoses());

    if (listeners.size === 1 && !firestoreUnsubscribe) {
      const PATH = 'diagnosticos';
      try {
        const q = query(collection(db, PATH));
        firestoreUnsubscribe = onSnapshot(q, (snapshot) => {
          const fetched = snapshot.docs.map(doc => doc.data() as Diagnosis);
          mergeDiagnoses(fetched);
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

  addDiagnosis: async (diagnosis: Omit<Diagnosis, 'id' | 'createdAt'>): Promise<Diagnosis> => {
    const PATH = 'diagnosticos';
    const id = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : `diag-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      
    const newDiagnosis: Diagnosis = {
      ...diagnosis,
      id,
      createdAt: new Date().toISOString(),
    };

    const cache = getLocalCache();
    const updatedCache = [newDiagnosis, ...cache.filter(d => d.id !== id)];
    saveLocalCache(updatedCache);
    notifySubscribers();

    setDoc(doc(db, PATH, id), newDiagnosis)
      .catch(error => handleFirestoreError(error, OperationType.CREATE, PATH));

    return newDiagnosis;
  },

  updateDiagnosis: async (id: string, updates: Partial<Diagnosis>): Promise<void> => {
    const PATH = 'diagnosticos';
    const cache = getLocalCache();
    const existing = cache.find(d => d.id === id);
    const updated: Diagnosis = {
      ...(existing || { id, name: '', status: 'Active', createdAt: new Date().toISOString() }),
      ...updates
    };

    const updatedCache = cache.some(d => d.id === id) 
      ? cache.map(d => d.id === id ? updated : d) 
      : [...cache, updated];

    saveLocalCache(updatedCache);
    notifySubscribers();

    setDoc(doc(db, PATH, id), updated, { merge: true })
      .catch(error => handleFirestoreError(error, OperationType.UPDATE, PATH));
  },

  deleteDiagnosis: async (id: string): Promise<void> => {
    const PATH = 'diagnosticos';
    const cache = getLocalCache();
    const existing = cache.find(d => d.id === id);

    const inactive: Diagnosis = {
      ...(existing || { id, name: '', status: 'Inactive', createdAt: new Date().toISOString() }),
      status: 'Inactive'
    };

    const updatedCache = cache.some(d => d.id === id) 
      ? cache.map(d => d.id === id ? inactive : d) 
      : [...cache, inactive];

    saveLocalCache(updatedCache);
    notifySubscribers();

    setDoc(doc(db, PATH, id), inactive, { merge: true })
      .catch(error => handleFirestoreError(error, OperationType.UPDATE, PATH));
  }
};

