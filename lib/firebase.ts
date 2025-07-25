import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: "AIzaSyCah-szwRoYDZGxbc_L32PI0kZSMV7cSZ4",
  authDomain: "bingo-final.firebaseapp.com",
  projectId: "bingo-final",
  storageBucket: "bingo-final.firebasestorage.app",
  messagingSenderId: "880579438390",
  appId: "1:880579438390:web:f39666fb5d20a7593cf597",
  measurementId: "G-4J9E5YVHPB",
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export default app
