import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

export type UserAddress = {
  id?: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  city: string;
  postcode: string;
  isDefault?: boolean;
};

export async function saveAddress(uid: string, address: UserAddress) {
  const addressesRef = collection(db, "users", uid, "addresses");

  if (address.isDefault) {
    const existing = await getDocs(addressesRef);
    for (const item of existing.docs) {
      await updateDoc(doc(db, "users", uid, "addresses", item.id), {
        isDefault: false,
      });
    }
  }

  const docRef = await addDoc(addressesRef, {
    ...address,
    isDefault: !!address.isDefault,
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}

export async function getAddresses(uid: string): Promise<UserAddress[]> {
  const q = query(
    collection(db, "users", uid, "addresses"),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as Omit<UserAddress, "id">),
  }));
}

export async function setDefaultAddress(uid: string, addressId: string) {
  const addressesRef = collection(db, "users", uid, "addresses");
  const existing = await getDocs(addressesRef);

  for (const item of existing.docs) {
    await updateDoc(doc(db, "users", uid, "addresses", item.id), {
      isDefault: item.id === addressId,
    });
  }
}

export async function deleteAddress(uid: string, addressId: string) {
  await deleteDoc(doc(db, "users", uid, "addresses", addressId));
}