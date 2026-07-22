import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { doc, getDoc, getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";


  export async function getOrderById(orderId: string) {
  console.log("Fetching doc:", `orders/${orderId}`);
  const ref = doc(db, "orders", orderId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;
  return { ...snap.data(), _docId: snap.id };
}

const firebaseConfig = {
  apiKey: "AIzaSyAo2OUSeBRSjN1D_wz5SaGg6AazfJ4K0jk",
  authDomain: "futuristekapp.firebaseapp.com",
  projectId: "futuristekapp",
  storageBucket: "futuristekapp.firebasestorage.app",
  messagingSenderId: "902298067474",
  appId: "1:902298067474:web:51c479cd4d55fed0c9eecb"
};

const app = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, "us-central1");

