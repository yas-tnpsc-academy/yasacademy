// ============================================================
// PASTE YOUR OWN FIREBASE CONFIG HERE
// Get this from: Firebase Console → Project Settings → General
// → "Your apps" → Web app → SDK setup and configuration
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyA5QI5rokVAJGisEUt_r1mm26FooeKcZqw",
  authDomain: "yas-academy-app.firebaseapp.com",
  projectId: "yas-academy-app",
  storageBucket: "yas-academy-app.firebasestorage.app",
  messagingSenderId: "814539581268",
  appId: "1:814539581268:web:45e5a8285a83e65b39cac1"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const analytics = getAnalytics(app);
const db = firebase.firestore();

