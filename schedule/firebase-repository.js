import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import { collection, deleteDoc, doc, getDoc, getDocs, getFirestore, orderBy, query, serverTimestamp, writeBatch } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

function toIso(value) {
  if (!value) return new Date().toISOString();
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  return String(value);
}

function projectData(project) {
  return { name: project.name, clientName: project.clientName, startDate: project.startDate, endDate: project.endDate, publishDate: project.publishDate, publishLabel: project.publishLabel || '', status: project.status, createdAt: project.createdAt || new Date().toISOString(), updatedAt: serverTimestamp() };
}

function taskData(task, sortOrder) {
  return { name: task.name, startDate: task.startDate, endDate: task.endDate, type: task.type, sortOrder, updatedAt: serverTimestamp() };
}

export const authService = {
  observe(callback) { return onAuthStateChanged(auth, callback); },
  async signIn(email, password) { return signInWithEmailAndPassword(auth, email, password); },
  async signOut() { return signOut(auth); },
};

export const projectRepository = {
  async isStaff(uid) {
    const snapshot = await getDoc(doc(db, 'staff', uid));
    return snapshot.exists() && snapshot.data().active === true;
  },

  async loadProjects() {
    const projectSnapshots = await getDocs(query(collection(db, 'projects'), orderBy('updatedAt', 'desc')));
    const projects = [];
    for (const projectSnapshot of projectSnapshots.docs) {
      const data = projectSnapshot.data();
      const taskSnapshots = await getDocs(query(collection(db, 'projects', projectSnapshot.id, 'tasks'), orderBy('sortOrder')));
      projects.push({ id: projectSnapshot.id, ...data, createdAt: toIso(data.createdAt), updatedAt: toIso(data.updatedAt), tasks: taskSnapshots.docs.map(taskSnapshot => ({ id: taskSnapshot.id, ...taskSnapshot.data() })) });
    }
    return projects;
  },

  async saveProject(project) {
    const projectRef = doc(db, 'projects', project.id);
    const existingTasks = await getDocs(collection(projectRef, 'tasks'));
    const nextIds = new Set(project.tasks.map(task => task.id));
    const batch = writeBatch(db);
    batch.set(projectRef, projectData(project), { merge: true });
    existingTasks.docs.forEach(snapshot => { if (!nextIds.has(snapshot.id)) batch.delete(snapshot.ref); });
    project.tasks.forEach((task, index) => batch.set(doc(projectRef, 'tasks', task.id), taskData(task, index), { merge: true }));
    await batch.commit();
  },

  async deleteTask(projectId, taskId) {
    await deleteDoc(doc(db, 'projects', projectId, 'tasks', taskId));
  },

  async replaceAll(projects) {
    const current = await this.loadProjects();
    if (current.length) {
      const deletions = writeBatch(db);
      current.forEach(project => {
        project.tasks.forEach(task => deletions.delete(doc(db, 'projects', project.id, 'tasks', task.id)));
        deletions.delete(doc(db, 'projects', project.id));
      });
      await deletions.commit();
    }
    for (const project of projects) await this.saveProject(project);
  },
};
