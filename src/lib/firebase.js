import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Replace these with your Firebase project credentials
// Get them from: Firebase Console → Project Settings → General → Your apps → SDK setup
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDBx9ooN1RNK1vsNyrNgC-4B-ePy9VIjfM",
  authDomain: "paranoia-game-549b9.firebaseapp.com",
  databaseURL: "https://paranoia-game-549b9-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "paranoia-game-549b9",
  storageBucket: "paranoia-game-549b9.firebasestorage.app",
  messagingSenderId: "426674405580",
  appId: "1:426674405580:web:ac092ca343c83d572ec269",
  measurementId: "G-YYDD8JJBJG"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
