import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBmE1p_qhMVGGr_NDmOVvFY7ipyeNQVOC4",
  authDomain: "management-project-bf767.firebaseapp.com",
  projectId: "management-project-bf767",
  storageBucket: "management-project-bf767.firebasestorage.app",
  messagingSenderId: "200210418664",
  appId: "1:200210418664:web:bb744d15f07f7ddffe725d",
};

let app: FirebaseApp;
let db: Firestore;

const isConfigured = Object.values(firebaseConfig).every(Boolean);

if (isConfigured) {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
  db = getFirestore(app);
}

export { db, isConfigured };
