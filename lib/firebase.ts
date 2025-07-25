import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: "AIzaSyA90EJm0jAVmGPaMD8Q3e8foetYaPTIPTs",
  authDomain: "bingo-guilax.firebaseapp.com",
  projectId: "bingo-guilax",
  storageBucket: "bingo-guilax.firebasestorage.app",
  messagingSenderId: "1049005993056",
  appId: "1:1049005993056:web:d63c67be831078b895a705",
  measurementId: "G-YV2ZDY4MDF"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export default app
