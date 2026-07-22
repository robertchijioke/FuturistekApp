import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

export type AppUser = {
  uid: string;
  email: string;
  fullName?: string;
  phone?: string;
  role?: "customer" | "admin";
  createdAt?: any;
  updatedAt?: any;
};

export async function ensureUserDocument(params: {
  uid: string;
  email: string;
}) {
  const userRef = doc(db, "users", params.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    await setDoc(userRef, {
      uid: params.uid,
      email: params.email,
      fullName: "",
      phone: "",
      role: "customer",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return;
  }

  await updateDoc(userRef, {
    email: params.email,
    updatedAt: serverTimestamp(),
  });
}

export async function getUserProfile(uid: string) {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) return null;
  return snap.data() as AppUser;
}

export async function updateUserProfile(
  uid: string,
  data: {
    fullName?: string;
    phone?: string;
  }
) {
  const userRef = doc(db, "users", uid);

  await updateDoc(userRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}