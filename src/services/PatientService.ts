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
import { Patient } from '../types';
import { MovementService } from './MovementService';

const CACHE_KEY = 'cer_patients_cache_v1';

const getLocalCache = (): Patient[] => {
  try {
    const data = localStorage.getItem(CACHE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

const saveLocalCache = (patients: Patient[]) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(patients));
  } catch (e) {
    console.error('Error saving patient cache:', e);
  }
};

export const PatientService = {
  getPatients: async (): Promise<Patient[]> => {
    const PATH = 'pacientes';
    const cached = getLocalCache().filter(p => !p.deletedAt);
    try {
      const q = query(collection(db, PATH));
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient));
      if (docs.length > 0) {
        saveLocalCache(docs);
        return docs.filter(p => !p.deletedAt).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      }
      return cached.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, PATH);
      return cached.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
  },

  subscribeToPatients: (callback: (patients: Patient[]) => void) => {
    const PATH = 'pacientes';
    
    // Emit local cache immediately
    const cachedActive = getLocalCache()
      .filter(p => !p.deletedAt)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    callback(cachedActive);

    const q = query(collection(db, PATH));
    return onSnapshot(q, (snapshot) => {
      const firestoreDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient));
      
      saveLocalCache(firestoreDocs);

      const currentList = getLocalCache();
      const activeList = currentList
        .filter(p => !p.deletedAt)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      callback(activeList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, PATH);
      const currentCache = getLocalCache()
        .filter(p => !p.deletedAt)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      callback(currentCache);
    });
  },

  subscribeToDeletedPatients: (callback: (patients: Patient[]) => void) => {
    const PATH = 'pacientes';
    
    const cachedDeleted = getLocalCache()
      .filter(p => !!p.deletedAt)
      .sort((a, b) => new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime());
    callback(cachedDeleted);

    const q = query(collection(db, PATH));
    return onSnapshot(q, (snapshot) => {
      const firestoreDocs = snapshot.docs.map(doc => doc.data() as Patient);
      if (firestoreDocs.length > 0) {
        saveLocalCache(firestoreDocs);
      }

      const currentList = getLocalCache();
      const deletedList = currentList
        .filter(p => !!p.deletedAt)
        .sort((a, b) => new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime());

      callback(deletedList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, PATH);
      const currentDeleted = getLocalCache()
        .filter(p => !!p.deletedAt)
        .sort((a, b) => new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime());
      callback(currentDeleted);
    });
  },

  addPatient: async (patient: Omit<Patient, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<Patient> => {
    const PATH = 'pacientes';
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const newPatient: Patient = {
      ...patient,
      id,
      createdAt: now,
      updatedAt: now,
      updatedBy: auth.currentUser?.email || 'unknown',
      deletedAt: null
    };
    
    // Save to local cache immediately
    const cache = getLocalCache();
    saveLocalCache([newPatient, ...cache.filter(p => p.id !== id)]);

    setDoc(doc(db, PATH, id), newPatient)
      .catch(error => handleFirestoreError(error, OperationType.CREATE, PATH));

    // Create an automatic 'Entrada' movement record
    MovementService.addMovement({
      patientId: newPatient.id,
      patientName: newPatient.name,
      medicalRecordNumber: newPatient.medicalRecordNumber,
      diagnoses: newPatient.diagnoses || [],
      type: 'Entrada',
      date: newPatient.entryDate || now.substring(0, 10),
      professionals: newPatient.professionals || [],
      responsibleProfessional: auth.currentUser?.email || '',
      observations: 'Admissão inicial do paciente no sistema'
    }).catch(err => console.error('Error creating automatic entry movement:', err));

    return newPatient;
  },

  updatePatient: async (id: string, updates: Partial<Patient>): Promise<void> => {
    const PATH = 'pacientes';
    const updatedData = {
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: auth.currentUser?.email || 'unknown'
    };

    // Update local cache immediately
    const cache = getLocalCache();
    const updatedCache = cache.map(p => p.id === id ? { ...p, ...updatedData } : p);
    saveLocalCache(updatedCache);
    
    updateDoc(doc(db, PATH, id), updatedData)
      .catch(error => handleFirestoreError(error, OperationType.UPDATE, PATH));
  },

  softDeletePatient: async (id: string): Promise<void> => {
    const PATH = 'pacientes';
    const now = new Date().toISOString();
    const deleteUpdates = {
      deletedAt: now,
      updatedAt: now,
      updatedBy: auth.currentUser?.email || 'unknown'
    };

    // Update local cache immediately
    const cache = getLocalCache();
    const updatedCache = cache.map(p => p.id === id ? { ...p, ...deleteUpdates } : p);
    saveLocalCache(updatedCache);

    updateDoc(doc(db, PATH, id), deleteUpdates)
      .catch(error => handleFirestoreError(error, OperationType.UPDATE, PATH));
  },

  restorePatient: async (id: string): Promise<void> => {
    const PATH = 'pacientes';
    const now = new Date().toISOString();
    const restoreUpdates = {
      deletedAt: null,
      updatedAt: now
    };

    // Update local cache immediately
    const cache = getLocalCache();
    const updatedCache = cache.map(p => p.id === id ? { ...p, ...restoreUpdates } : p);
    saveLocalCache(updatedCache);

    updateDoc(doc(db, PATH, id), restoreUpdates)
      .catch(error => handleFirestoreError(error, OperationType.UPDATE, PATH));
  },

  deletePatientPermanently: async (id: string): Promise<void> => {
    const PATH = 'pacientes';

    // Remove from local cache immediately
    const cache = getLocalCache();
    saveLocalCache(cache.filter(p => p.id !== id));

    deleteDoc(doc(db, PATH, id))
      .catch(error => handleFirestoreError(error, OperationType.DELETE, PATH));
  },

  calculateAge: (birthDate: string): number => {
    if (!birthDate) return 0;
    const today = new Date();
    const birth = new Date(birthDate);
    if (isNaN(birth.getTime())) return 0;
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age >= 0 ? age : 0;
  }
};
