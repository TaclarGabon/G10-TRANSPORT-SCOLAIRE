// G10 Transport Scolaire — Firebase dédié
const firebaseConfig = {
  apiKey: "AIzaSyCE0usFMkV-vfXg3lFlhXrI5qMoeKJNK1s",
  authDomain: "g10-transport-scolaire.firebaseapp.com",
  projectId: "g10-transport-scolaire",
  storageBucket: "g10-transport-scolaire.firebasestorage.app",
  messagingSenderId: "85816284523",
  appId: "1:85816284523:web:3da2579e1ec45fdfe3e82e"
};

firebase.initializeApp(firebaseConfig);

window.G10Firebase = {
  app: firebase.app(),
  auth: firebase.auth(),
  db: firebase.firestore(),
  FieldValue: firebase.firestore.FieldValue,
  Timestamp: firebase.firestore.Timestamp,
  apiBase: "https://europe-west1-g10-transport-scolaire.cloudfunctions.net/api",
  pinAuthUrl: "https://europe-west1-g10-transport-scolaire.cloudfunctions.net/pinAuth"
};
