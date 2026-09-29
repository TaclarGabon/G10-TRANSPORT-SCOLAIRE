// G10 Transport Scolaire — Firebase Spark / phase pilote
// Même principe que G10 Interurbain : Auth anonyme + Realtime Database.
const firebaseConfig = {
  apiKey: "AIzaSyCE0usFMkV-vfXg3lFlhXrI5qMoeKJNK1s",
  authDomain: "g10-transport-scolaire.firebaseapp.com",
  // URL attendue pour la base Realtime Database européenne.
  // À vérifier dans la console Firebase dès la création de Realtime Database.
  databaseURL: "https://g10-transport-scolaire-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "g10-transport-scolaire",
  storageBucket: "g10-transport-scolaire.firebasestorage.app",
  messagingSenderId: "85816284523",
  appId: "1:85816284523:web:3da2579e1ec45fdfe3e82e"
};

firebase.initializeApp(firebaseConfig);

window.G10Firebase = {
  app: firebase.app(),
  auth: firebase.auth(),
  db: firebase.database(),
  statePath: "g10Scolaire/state"
};
