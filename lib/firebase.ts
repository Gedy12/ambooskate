import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: "AIzaSyDEI7kqamz_QtDidCtDVCYO0TGX9VpIxbI",
  authDomain: "amboo-shagga-skate.firebaseapp.com",
  projectId: "amboo-shagga-skate",
  storageBucket: "amboo-shagga-skate.firebasestorage.app",
  messagingSenderId: "671208597188",
  appId: "1:671208597188:web:53c64276b43efbf32a0b91",
  measurementId: "G-E5FRPW8ETG"
};

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
