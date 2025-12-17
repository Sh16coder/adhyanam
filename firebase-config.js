// Replace with your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCJoAlb3v82-Y_alzd9Wl73Y4O1QPF2hDM",
  authDomain: "adhyanam-511eb.firebaseapp.com",
  projectId: "adhyanam-511eb",
  storageBucket: "adhyanam-511eb.firebasestorage.app",
  messagingSenderId: "242165230864",
  appId: "1:242165230864:web:aecb28689cff0895718995"
};

try {
    firebase.initializeApp(firebaseConfig);
    console.log("Firebase initialized successfully");
    
    // Make available globally
    window.firebaseAuth = firebase.auth();
    window.firebaseDb = firebase.firestore();
} catch (error) {
    console.error("Firebase initialization error:", error);
    
    // Fallback for testing without Firebase
    window.firebaseAuth = null;
    window.firebaseDb = null;
    
    // Show error but continue in local mode
    if (window.showMessage) {
        window.showMessage("Firebase not configured. Running in local mode.", "warning");
    }
}
