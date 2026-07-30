import { 
  collection, 
  doc, 
  getDocs, 
  updateDoc,
  deleteDoc, 
  query, 
  onSnapshot,
  setDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { Movement } from '../types';
import { PatientService } from './PatientService';

const CACHE_KEY = 'cer_movements_cache_v1';

const getLocalCache = (): Movement[] => {
  try {
    const data = localStorage.getItem(CACHE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

const saveLocalCache = (movements: Movement[]) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(movements));
  } catch (e) {
    console.error('Error saving movement cache:', e);
  }
};

export const MovementService = {
  getMovements: async (): Promise<Movement[]> => {
    const PATH = 'movimentacoes';
    const cached = getLocalCache().filter(m => !m.deletedAt);
    try {
      const q = query(collection(db, PATH));
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map(doc => doc.data() as Movement);
      if (docs.length > 0) {
        saveLocalCache(docs);
        return docs.filter(m => !m.deletedAt).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }
      return cached.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, PATH);
      return cached.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
  },

  subscribeToMovements: (callback: (movements: Movement[]) => void) => {
    const PATH = 'movimentacoes';
    
    // Emit local cache immediately
    const cachedActive = getLocalCache()
      .filter(m => !m.deletedAt)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    callback(cachedActive);

    const q = query(collection(db, PATH));
    return onSnapshot(q, (snapshot) => {
      const firestoreDocs = snapshot.docs.map(doc => doc.data() as Movement);
      
      if (firestoreDocs.length > 0) {
        saveLocalCache(firestoreDocs);
      } else {
        const localCache = getLocalCache();
        if (localCache.length > 0) {
          localCache.forEach(m => {
            setDoc(doc(db, PATH, m.id), m).catch(err => console.error('Error syncing local movement to Firestore:', err));
          });
        }
      }

      const currentList = getLocalCache();
      const activeList = currentList
        .filter(m => !m.deletedAt)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      callback(activeList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, PATH);
      const currentCache = getLocalCache()
        .filter(m => !m.deletedAt)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      callback(currentCache);
    });
  },

  subscribeToDeletedMovements: (callback: (movements: Movement[]) => void) => {
    const PATH = 'movimentacoes';
    
    const cachedDeleted = getLocalCache()
      .filter(m => !!m.deletedAt)
      .sort((a, b) => new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime());
    callback(cachedDeleted);

    const q = query(collection(db, PATH));
    return onSnapshot(q, (snapshot) => {
      const firestoreDocs = snapshot.docs.map(doc => doc.data() as Movement);
      
      if (firestoreDocs.length > 0) {
        saveLocalCache(firestoreDocs);
      }

      const currentList = getLocalCache();
      const deletedList = currentList
        .filter(m => !!m.deletedAt)
        .sort((a, b) => new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime());

      callback(deletedList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, PATH);
      const currentDeleted = getLocalCache()
        .filter(m => !!m.deletedAt)
        .sort((a, b) => new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime());
      callback(currentDeleted);
    });
  },

  addMovement: async (movement: Omit<Movement, 'id' | 'createdAt' | 'deletedAt'>): Promise<Movement> => {
    const PATH = 'movimentacoes';
    const id = crypto.randomUUID();
    const newMovement: Movement = {
      ...movement,
      id,
      createdAt: new Date().toISOString(),
      createdBy: auth.currentUser?.email || 'unknown',
      deletedAt: null
    };
    
    // Save to local cache immediately
    const cache = getLocalCache();
    saveLocalCache([newMovement, ...cache.filter(m => m.id !== id)]);

    setDoc(doc(db, PATH, id), newMovement)
      .catch(error => handleFirestoreError(error, OperationType.CREATE, PATH));

    if (movement.type === 'Alta') {
      PatientService.updatePatient(movement.patientId, { 
        status: 'Alta',
        dischargeDate: movement.date 
      }).catch(err => console.error('Error updating patient status on discharge:', err));
    }

    return newMovement;
  },

  updateMovement: async (id: string, updates: Partial<Movement>): Promise<void> => {
    const PATH = 'movimentacoes';
    
    const cache = getLocalCache();
    const updatedCache = cache.map(m => m.id === id ? { ...m, ...updates } : m);
    saveLocalCache(updatedCache);

    updateDoc(doc(db, PATH, id), updates)
      .catch(error => handleFirestoreError(error, OperationType.UPDATE, PATH));
  },

  softDeleteMovement: async (id: string): Promise<void> => {
    const PATH = 'movimentacoes';
    const now = new Date().toISOString();
    const deleteUpdates = {
      deletedAt: now,
      updatedBy: auth.currentUser?.email || 'unknown'
    };

    const cache = getLocalCache();
    const updatedCache = cache.map(m => m.id === id ? { ...m, ...deleteUpdates } : m);
    saveLocalCache(updatedCache);

    updateDoc(doc(db, PATH, id), deleteUpdates)
      .catch(error => handleFirestoreError(error, OperationType.UPDATE, PATH));
  },

  restoreMovement: async (id: string): Promise<void> => {
    const PATH = 'movimentacoes';
    const restoreUpdates = {
      deletedAt: null
    };

    const cache = getLocalCache();
    const updatedCache = cache.map(m => m.id === id ? { ...m, ...restoreUpdates } : m);
    saveLocalCache(updatedCache);

    updateDoc(doc(db, PATH, id), restoreUpdates)
      .catch(error => handleFirestoreError(error, OperationType.UPDATE, PATH));
  },

  deleteMovementPermanently: async (id: string): Promise<void> => {
    const PATH = 'movimentacoes';

    const cache = getLocalCache();
    saveLocalCache(cache.filter(m => m.id !== id));

    deleteDoc(doc(db, PATH, id))
      .catch(error => handleFirestoreError(error, OperationType.DELETE, PATH));
  }
};
