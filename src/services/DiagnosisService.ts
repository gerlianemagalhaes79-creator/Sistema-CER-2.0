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

const CACHE_KEY = 'cer_diagnoses_cache_v1';

const DEFAULT_DIAGNOSES: Diagnosis[] = DIAGNOSES.map((diagName, index) => ({
  id: `default-diag-${index + 1}`,
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
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error reading diagnosis cache:', e);
  }
  return DEFAULT_DIAGNOSES;
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

  DEFAULT_DIAGNOSES.forEach(d => map.set(d.id, d));
  localCache.forEach(d => map.set(d.id, d));
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
    
    // Emit active items immediately
    callback(getActiveDiagnoses());

    const PATH = 'diagnosticos';
    try {
      const q = query(collection(db, PATH));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetched = snapshot.docs.map(doc => doc.data() as Diagnosis);
        const active = mergeDiagnoses(fetched);
        callback(active);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, PATH);
        callback(getActiveDiagnoses());
      });

      return () => {
        listeners.delete(callback);
        unsubscribe();
      };
    } catch (e) {
      callback(getActiveDiagnoses());
      return () => {
        listeners.delete(callback);
      };
    }
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

    try {
      await setDoc(doc(db, PATH, id), newDiagnosis);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, PATH);
    }

    return newDiagnosis;
  },

  updateDiagnosis: async (id: string, updates: Partial<Diagnosis>): Promise<void> => {
    const PATH = 'diagnosticos';
    const cache = getLocalCache();
    const existing = cache.find(d => d.id === id) || DEFAULT_DIAGNOSES.find(d => d.id === id);
    const updated: Diagnosis = {
      ...(existing || { id, name: '', status: 'Active', createdAt: new Date().toISOString() }),
      ...updates
    };

    const updatedCache = cache.some(d => d.id === id) 
      ? cache.map(d => d.id === id ? updated : d) 
      : [...cache, updated];

    saveLocalCache(updatedCache);
    notifySubscribers();

    try {
      await setDoc(doc(db, PATH, id), updated, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, PATH);
    }
  },

  deleteDiagnosis: async (id: string): Promise<void> => {
    const PATH = 'diagnosticos';
    const cache = getLocalCache();
    const existing = cache.find(d => d.id === id) || DEFAULT_DIAGNOSES.find(d => d.id === id);

    const inactive: Diagnosis = {
      ...(existing || { id, name: '', status: 'Inactive', createdAt: new Date().toISOString() }),
      status: 'Inactive'
    };

    const updatedCache = cache.some(d => d.id === id) 
      ? cache.map(d => d.id === id ? inactive : d) 
      : [...cache, inactive];

    saveLocalCache(updatedCache);
    notifySubscribers();

    try {
      await setDoc(doc(db, PATH, id), inactive, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, PATH);
    }
  }
};

