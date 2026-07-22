import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";

import { auth, db } from "./firebase";
import { sendPushNotification } from "./sendPush";

export function startAutomationEngine() {
  const user = auth.currentUser;

  if (!user) return;

  const devicesRef = collection(
    db,
    "users",
    user.uid,
    "devices"
  );

  const sensorQuery = query(
    devicesRef,
    where("type", "==", "Sensor")
  );

  onSnapshot(sensorQuery, async (snapshot) => {

    
    for (const sensorDoc of snapshot.docs) {
      const sensor = sensorDoc.data();


      if (!sensor.status) continue;

      const automationsRef = collection(
        db,
        "users",
        user.uid,
        "automations"
      );

      const automationSnapshot =
        await getDocs(automationsRef);

      for (const automationDoc of automationSnapshot.docs) {
        const automation = automationDoc.data();


        if (!automation.enabled) continue;

        const hour = new Date().getHours();

        if (
          automation.enabled &&
          automation.trigger === "Motion Detected" &&
          automation.action === "Turn ON" &&
          automation.actionDeviceId &&
          (hour >= 23 || hour < 6)
        ) {

          const devicesSnapshot =
            await getDocs(devicesRef);

          for (const deviceDoc of devicesSnapshot.docs) {
            const device = deviceDoc.data();

            const isTargetDevice =
                deviceDoc.id === automation.actionDeviceId;

              if (isTargetDevice) {
              await updateDoc(
                doc(
                  db,
                  "users",
                  user.uid,
                  "devices",
                  deviceDoc.id
                ),
                {
                  status: "Online",
                }
              );
              await addDoc(
                collection(db, "users", user.uid, "activityLog"),
                {
                  event: "Motion detected",
                  action: `${automation.actionDeviceName} turned ON`,
                  automation: automation.name || "Night Motion Light",
                  createdAt: serverTimestamp(),
                }
              );

              const userRef = doc(db, "users", user.uid);
              const userSnap = await getDoc(userRef);

              if (userSnap.exists()) {
                const userData = userSnap.data();
                const expoPushToken = userData?.expoPushToken;

                if (automation.notify !== false && expoPushToken) {
                  await sendPushNotification(
                    expoPushToken,
                    "🏠 Motion detected",
                    `${automation.name} turned on ${automation.actionDeviceName}.`,
                    {
                      type: "automation",
                      automation: automation.name || "Night Motion Light",
                      action: `${automation.actionDeviceName} turned ON`,
                    }
                  );
                }
              }
            }
          }
        }
      }
    }
  });
}