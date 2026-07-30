import { 
  collection, 
  doc, 
  getDocs, 
  query, 
  onSnapshot,
  setDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Municipality, CITIES } from '../types';

const CACHE_KEY = 'cer_municipalities_cache_v2';

const INITIAL_SEED_CITIES: Municipality[] = CITIES.map((cityName, index) => ({
  id: `muni-seed-${index + 1}`,
  name: cityName,
  status: 'Active',
  createdAt: new Date().toISOString()
}));

const listeners = new Set<(municipalities: Municipality[]) => void>();

const getLocalCache = (): Municipality[] => {
  try {
    const data = localStorage.getItem(CACHE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
    saveLocalCache(INITIAL_SEED_CITIES);
    return INITIAL_SEED_CITIES;
  } catch (e) {
    console.error('Error reading municipality cache:', e);
  }
  return INITIAL_SEED_CITIES;
};

const saveLocalCache = (items: Municipality[]) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Error saving municipality cache:', e);
  }
};

const getActiveMunicipalities = (): Municipality[] => {
  const cache = getLocalCache();
  return cache
    .filter(m => m.status === 'Active')
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
};

const notifySubscribers = () => {
  const active = getActiveMunicipalities();
  listeners.forEach(cb => {
    try {
      cb(active);
    } catch (e) {
      console.error('Municipality subscriber notification error:', e);
    }
  });
};

const mergeMunicipalities = (firestoreDocs: Municipality[]): Municipality[] => {
  const localCache = getLocalCache();
  const map = new Map<string, Municipality>();

  localCache.forEach(m => {
    if (m && m.id) {
      map.set(m.id, m);
    }
  });

  firestoreDocs.forEach(m => {
    if (m && m.id) {
      const existing = map.get(m.id);
      map.set(m.id, { ...(existing || {}), ...m });
    }
  });

  const merged = Array.from(map.values());
  saveLocalCache(merged);
  return merged.filter(m => m.status === 'Active').sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
};

let firestoreUnsubscribe: (() => void) | null = null;

export const MunicipalityService = {
  getMunicipalities: async (): Promise<Municipality[]> => {
    const PATH = 'municipios';
    try {
      const q = query(collection(db, PATH));
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map(doc => doc.data() as Municipality);
      if (docs.length > 0) {
        return mergeMunicipalities(docs);
      }
      return getActiveMunicipalities();
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, PATH);
      return getActiveMunicipalities();
    }
  },

  subscribeToMunicipalities: (callback: (municipalities: Municipality[]) => void) => {
    listeners.add(callback);
    callback(getActiveMunicipalities());

    if (listeners.size === 1 && !firestoreUnsubscribe) {
      const PATH = 'municipios';
      try {
        const q = query(collection(db, PATH));
        firestoreUnsubscribe = onSnapshot(q, (snapshot) => {
          const fetched = snapshot.docs.map(doc => doc.data() as Municipality);
          mergeMunicipalities(fetched);
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

  addMunicipality: async (municipality: Omit<Municipality, 'id' | 'createdAt'>): Promise<Municipality> => {
    const PATH = 'municipios';
    const id = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : `muni-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      
    const newMunicipality: Municipality = {
      ...municipality,
      id,
      createdAt: new Date().toISOString(),
    };

    const cache = getLocalCache();
    const updatedCache = [newMunicipality, ...cache.filter(m => m.id !== id)];
    saveLocalCache(updatedCache);
    notifySubscribers();

    setDoc(doc(db, PATH, id), newMunicipality)
      .catch(error => handleFirestoreError(error, OperationType.CREATE, PATH));

    return newMunicipality;
  },

  updateMunicipality: async (id: string, updates: Partial<Municipality>): Promise<void> => {
    const PATH = 'municipios';
    const cache = getLocalCache();
    const existing = cache.find(m => m.id === id);
    const updated: Municipality = {
      ...(existing || { id, name: '', status: 'Active', createdAt: new Date().toISOString() }),
      ...updates
    };

    const updatedCache = cache.some(m => m.id === id) 
      ? cache.map(m => m.id === id ? updated : m) 
      : [...cache, updated];

    saveLocalCache(updatedCache);
    notifySubscribers();

    setDoc(doc(db, PATH, id), updated, { merge: true })
      .catch(error => handleFirestoreError(error, OperationType.UPDATE, PATH));
  },

  deleteMunicipality: async (id: string): Promise<void> => {
    const PATH = 'municipios';
    const cache = getLocalCache();
    const existing = cache.find(m => m.id === id);

    const inactive: Municipality = {
      ...(existing || { id, name: '', status: 'Inactive', createdAt: new Date().toISOString() }),
      status: 'Inactive'
    };

    const updatedCache = cache.some(m => m.id === id) 
      ? cache.map(m => m.id === id ? inactive : m) 
      : [...cache, inactive];

    saveLocalCache(updatedCache);
    notifySubscribers();

    setDoc(doc(db, PATH, id), inactive, { merge: true })
      .catch(error => handleFirestoreError(error, OperationType.UPDATE, PATH));
  }
};

