import { 
  collection, 
  doc, 
  getDocs, 
  updateDoc, 
  query, 
  where,
  onSnapshot,
  setDoc,
  orderBy
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Municipality } from '../types';

export const MunicipalityService = {
  getMunicipalities: async (): Promise<Municipality[]> => {
    const PATH = 'municipios';
    try {
      const q = query(collection(db, PATH), where('status', '==', 'Active'), orderBy('name', 'asc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as Municipality);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, PATH);
      return [];
    }
  },

  subscribeToMunicipalities: (callback: (municipalities: Municipality[]) => void) => {
    const PATH = 'municipios';
    const q = query(collection(db, PATH), where('status', '==', 'Active'), orderBy('name', 'asc'));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as Municipality));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, PATH);
    });
  },

  addMunicipality: async (municipality: Omit<Municipality, 'id' | 'createdAt'>): Promise<void> => {
    const PATH = 'municipios';
    try {
      const id = crypto.randomUUID();
      const newMunicipality: Municipality = {
        ...municipality,
        id,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, PATH, id), newMunicipality);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, PATH);
    }
  },

  updateMunicipality: async (id: string, updates: Partial<Municipality>) => {
    const PATH = 'municipios';
    try {
      await updateDoc(doc(db, PATH, id), updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, PATH);
    }
  },

  deleteMunicipality: async (id: string) => {
    const PATH = 'municipios';
    try {
      await updateDoc(doc(db, PATH, id), { status: 'Inactive' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, PATH);
    }
  }
};
