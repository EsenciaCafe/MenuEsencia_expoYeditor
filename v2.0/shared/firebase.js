// v2.0/shared/firebase.js
// @ts-nocheck
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyC3s3zwSDg4a9PawVExNlKK7OoU6ciZ8d4",
    authDomain: "menu-expo-y-editor.firebaseapp.com",
    projectId: "menu-expo-y-editor",
    storageBucket: "menu-expo-y-editor.appspot.com",
    messagingSenderId: "722189403517",
    appId: "1:722189403517:web:0914f053b2b59880a5b814",
    measurementId: "G-PHCXWY0KRE"
  };

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// 👇 Promesa que avisa cuando hay sesión lista
window.firebaseAuthReady = new Promise(resolve => onAuthStateChanged(auth, u => resolve(u)));

window.firebaseDb = db;
window.firebaseApp = app;

// Inicia sesión anónima
signInAnonymously(auth).catch(console.error);