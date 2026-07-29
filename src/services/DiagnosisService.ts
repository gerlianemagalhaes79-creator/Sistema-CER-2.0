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
import { Diagnosis } from '../types';

export const DiagnosisService = {
  getDiagnoses: async (): Promise<Diagnosis[]> => {
    const PATH = 'diagnosticos';
    try {
      const q = query(collection(db, PATH), where('status', '==', 'Active'), orderBy('name', 'asc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as Diagnosis);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, PATH);
      return [];
    }
  },

  subscribeToDiagnoses: (callback: (diagnoses: Diagnosis[]) => void) => {
    const PATH = 'diagnosticos';
    const q = query(collection(db, PATH), where('status', '==', 'Active'), orderBy('name', 'asc'));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as Diagnosis));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, PATH);
    });
  },

  addDiagnosis: async (diagnosis: Omit<Diagnosis, 'id' | 'createdAt'>): Promise<void> => {
    const PATH = 'diagnosticos';
    try {
      const id = crypto.randomUUID();
      const newDiagnosis: Diagnosis = {
        ...diagnosis,
        id,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, PATH, id), newDiagnosis);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, PATH);
    }
  },

  updateDiagnosis: async (id: string, updates: Partial<Diagnosis>) => {
    const PATH = 'diagnosticos';
    try {
      await updateDoc(doc(db, PATH, id), updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, PATH);
    }
  },

  deleteDiagnosis: async (id: string) => {
    const PATH = 'diagnosticos';
    try {
      await updateDoc(doc(db, PATH, id), { status: 'Inactive' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, PATH);
    }
  }
};
