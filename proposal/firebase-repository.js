import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import { collection, deleteDoc, doc, getDoc, getDocs, getFirestore, orderBy, query, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const COLLECTION = 'proposalProjects';

function toIso(value) {
  if (!value) return new Date().toISOString();
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  return String(value);
}

function serializable(project, uid) {
  return {
    title: project.title,
    clientName: project.clientName,
    caseType: project.caseType,
    currentUrl: project.currentUrl,
    hearing: project.hearing,
    findings: project.findings,
    createdAt: project.createdAt || new Date().toISOString(),
    createdBy: project.createdBy || uid,
    updatedBy: uid,
    updatedAt: serverTimestamp(),
  };
}

export const authService = {
  observe(callback) { return onAuthStateChanged(auth, callback); },
  signIn(email, password) { return signInWithEmailAndPassword(auth, email, password); },
  signOut() { return signOut(auth); },
};

export const proposalRepository = {
  async isStaff(uid) {
    const snapshot = await getDoc(doc(db, 'staff', uid));
    return snapshot.exists() && snapshot.data().active === true;
  },
  async loadAll() {
    const snapshots = await getDocs(query(collection(db, COLLECTION), orderBy('updatedAt', 'desc')));
    return snapshots.docs.map(snapshot => {
      const data = snapshot.data();
      return { id: snapshot.id, ...data, createdAt: toIso(data.createdAt), updatedAt: toIso(data.updatedAt) };
    });
  },
  async save(project, uid) {
    await setDoc(doc(db, COLLECTION, project.id), serializable(project, uid), { merge: true });
  },
  async remove(id) {
    await deleteDoc(doc(db, COLLECTION, id));
  },
};
