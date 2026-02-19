import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc, arrayUnion, onSnapshot, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || '',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.FIREBASE_APP_ID || '',
};

let app: ReturnType<typeof initializeApp> | null = null;
let db: ReturnType<typeof getFirestore> | null = null;
let auth: ReturnType<typeof getAuth> | null = null;
let isInitialized = false;

export const isFirebaseConfigured = (): boolean => {
  return !!(process.env.FIREBASE_API_KEY && process.env.FIREBASE_PROJECT_ID);
};

export const initializeFirebase = async () => {
  if (isInitialized || !isFirebaseConfigured()) return;
  
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    
    await signInAnonymously(auth);
    
    await enableIndexedDbPersistence(db as any);
    
    isInitialized = true;
    console.log('[Firebase] Initialized successfully');
  } catch (error) {
    console.error('[Firebase] Initialization failed:', error);
  }
};

export const getFirebaseDb = () => {
  if (!isInitialized || !db) {
    initializeFirebase();
  }
  return db;
};

export const getCasesCollection = () => {
  const database = getFirebaseDb();
  if (!database) return null;
  return collection(database, 'cases');
};

export const getCaseDoc = (caseId: string) => {
  const database = getFirebaseDb();
  if (!database) return null;
  return doc(database, 'cases', caseId);
};

export { db, auth };
