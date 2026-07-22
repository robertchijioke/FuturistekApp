import { addDoc, collection, doc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";

import { auth, db } from "./firebase";

export async function turnDeviceOn(deviceName: string) {
  return updateDeviceStatus(deviceName, true);
}

export async function turnDeviceOff(deviceName: string) {
  return updateDeviceStatus(deviceName, false);
}

async function updateDeviceStatus(
  deviceName: string,
  status: boolean
) {
  const user = auth.currentUser;
  if (!user) return "Please log in first.";

  const devicesRef = collection(db, "users", user.uid, "devices");
  const snapshot = await getDocs(devicesRef);

  const target = snapshot.docs.find((deviceDoc) => {
    const device = deviceDoc.data();

    return String(device.name)
      .toLowerCase()
      .includes(deviceName.toLowerCase());
  });

  if (!target) {
    return `I could not find ${deviceName}.`;
  }

  await updateDoc(
    doc(db, "users", user.uid, "devices", target.id),
    {
      status,
      brightness: status ? 100 : 0,
    }
  );

  return `${deviceName} turned ${status ? "ON" : "OFF"}.`;
}

export async function getDeviceSummary() {
  const user = auth.currentUser;
  if (!user) return "Please log in first.";

  const devicesRef = collection(db, "users", user.uid, "devices");
  const snapshot = await getDocs(devicesRef);

  const devices = snapshot.docs.map((doc) => doc.data());

  if (devices.length === 0) {
    return "No smart devices found yet.";
  }

  const onlineDevices = devices.filter((d) => d.status);
  const offlineDevices = devices.filter((d) => !d.status);

  const onlineNames = onlineDevices.map((d) => d.name).join(", ");
  const offlineNames = offlineDevices.map((d) => d.name).join(", ");

  return `📊 Device Summary

Total devices: ${devices.length}

🟢 Online: ${onlineDevices.length}
${onlineNames || "None"}

🔴 Offline: ${offlineDevices.length}
${offlineNames || "None"}`;
}

export async function runGoodNightScene() {
  const user = auth.currentUser;
  if (!user) return "Please log in first.";

  const devicesRef = collection(db, "users", user.uid, "devices");
  const snapshot = await getDocs(devicesRef);

  const updates = snapshot.docs.map((deviceDoc) => {
    const device = deviceDoc.data();
    const type = String(device.type).toLowerCase();

    const isSensor = type.includes("sensor");

    return updateDoc(doc(db, "users", user.uid, "devices", deviceDoc.id), {
      status: isSensor,
      brightness: isSensor ? device.brightness ?? 100 : 0,
    });
  });

  await Promise.all(updates);

  await addDoc(collection(db, "users", user.uid, "activityLog"), {
    event: "Scene activated",
    action: "Good Night mode activated",
    automation: "Good Night",
    createdAt: serverTimestamp(),
  });

  return "🌙 Good Night scene activated.";
}

export async function runMovieModeScene() {
  const user = auth.currentUser;
  if (!user) return "Please log in first.";

  const devicesRef = collection(db, "users", user.uid, "devices");
  const snapshot = await getDocs(devicesRef);

  const updates = snapshot.docs.map((deviceDoc) => {
    const device = deviceDoc.data();
    const type = String(device.type).toLowerCase();
    const room = String(device.room).toLowerCase();

    let newStatus = device.status;

    if (type.includes("light")) {
      newStatus = room.includes("living");
    }

    if (
      type.includes("plug") ||
      type.includes("camera") ||
      type.includes("remote") ||
      type.includes("sensor")
    ) {
      newStatus = true;
    }

    return updateDoc(doc(db, "users", user.uid, "devices", deviceDoc.id), {
      status: newStatus,
      brightness: newStatus ? 100 : 0,
    });
  });

  await Promise.all(updates);

  await addDoc(collection(db, "users", user.uid, "activityLog"), {
    event: "Scene activated",
    action: "Movie Mode activated",
    automation: "Movie Mode",
    createdAt: serverTimestamp(),
  });

  return "🎬 Movie Mode activated.";
}

export async function runMorningModeScene() {
  const user = auth.currentUser;
  if (!user) return "Please log in first.";

  const devicesRef = collection(db, "users", user.uid, "devices");
  const snapshot = await getDocs(devicesRef);

  const updates = snapshot.docs.map((deviceDoc) =>
    updateDoc(doc(db, "users", user.uid, "devices", deviceDoc.id), {
      status: true,
      brightness: 100,
    })
  );

  await Promise.all(updates);

  await addDoc(collection(db, "users", user.uid, "activityLog"), {
    event: "Scene activated",
    action: "Morning Mode activated",
    automation: "Morning",
    createdAt: serverTimestamp(),
  });

  return "☀️ Morning Mode activated.";
}

export async function runAwayModeScene() {
  const user = auth.currentUser;
  if (!user) return "Please log in first.";

  const devicesRef = collection(db, "users", user.uid, "devices");
  const snapshot = await getDocs(devicesRef);

  const updates = snapshot.docs.map((deviceDoc) => {
    const device = deviceDoc.data();
    const type = String(device.type).toLowerCase();

    const shouldStayOn = type.includes("camera") || type.includes("sensor");

    return updateDoc(doc(db, "users", user.uid, "devices", deviceDoc.id), {
      status: shouldStayOn,
      brightness: shouldStayOn ? device.brightness ?? 100 : 0,
    });
  });

  await Promise.all(updates);

  await addDoc(collection(db, "users", user.uid, "activityLog"), {
    event: "Scene activated",
    action: "Away Mode activated",
    automation: "Away Mode",
    createdAt: serverTimestamp(),
  });

  return "🚪 Away Mode activated.";
}