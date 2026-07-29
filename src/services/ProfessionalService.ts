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
import { Professional } from '../types';

export const ProfessionalService = {
  getProfessionals: async (): Promise<Professional[]> => {
    const PATH = 'profissionais';
    try {
      const q = query(collection(db, PATH), where('status', '==', 'Active'), orderBy('name', 'asc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as Professional);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, PATH);
      return [];
    }
  },

  subscribeToProfessionals: (callback: (professionals: Professional[]) => void) => {
    const PATH = 'profissionais';
    const q = query(collection(db, PATH), where('status', '==', 'Active'), orderBy('name', 'asc'));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as Professional));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, PATH);
    });
  },

  addProfessional: async (professional: Omit<Professional, 'id' | 'createdAt'>): Promise<void> => {
    const PATH = 'profissionais';
    try {
      const id = crypto.randomUUID();
      const newProfessional: Professional = {
        ...professional,
        id,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, PATH, id), newProfessional);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, PATH);
    }
  },

  updateProfessional: async (id: string, updates: Partial<Professional>) => {
    const PATH = 'profissionais';
    try {
      await updateDoc(doc(db, PATH, id), updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, PATH);
    }
  },

  deleteProfessional: async (id: string) => {
    const PATH = 'profissionais';
    try {
      await updateDoc(doc(db, PATH, id), { status: 'Inactive' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, PATH);
    }
  }
};
