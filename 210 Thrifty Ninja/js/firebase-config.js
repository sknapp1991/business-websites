/* Firebase project config — public client keys, safe to expose (Firestore
   security rules are what actually control access, not this file). */
const firebaseConfig = {
  apiKey: "AIzaSyAm1Znx9sQLx770HwXItLQByMbjdUZWAfA",
  authDomain: "thrifty-ninja-8fa14.firebaseapp.com",
  projectId: "thrifty-ninja-8fa14",
  storageBucket: "thrifty-ninja-8fa14.firebasestorage.app",
  messagingSenderId: "140158273326",
  appId: "1:140158273326:web:2c6562ac0f11058d9f9cbf"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
