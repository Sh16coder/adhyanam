// Replace with your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCJoAlb3v82-Y_alzd9Wl73Y4O1QPF2hDM",
  authDomain: "adhyanam-511eb.firebaseapp.com",
  projectId: "adhyanam-511eb",
  storageBucket: "adhyanam-511eb.firebasestorage.app",
  messagingSenderId: "242165230864",
  appId: "1:242165230864:web:aecb28689cff0895718995"
};
// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
