import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

type AlertSeverity = "low" | "medium" | "high";

function getRecommendedActions(type: string, threatLevel: string) {
  if (threatLevel === "HIGH") {
    return [
      "View Live Camera",
      "Sound Siren",
      "Turn On Lights",
      "Notify Owner",
    ];
  }

  if (threatLevel === "MEDIUM") {
    return [
      "View Live Camera",
      "Save Snapshot",
      "Monitor Activity",
    ];
  }

  return [
    "Save Snapshot",
    "Ignore",
  ];
}

export async function createSecurityAlert({
  userId,
  cameraId,
  cameraName,
  room,
  type,
  message,
  severity = "medium",
  snapshotId = null,
  snapshotImage,
  image,
  thumbnail,
  confidence,
}: {
  userId: string;
  cameraId: string;
  cameraName?: string;
  room?: string;
  type: string;
  message: string;
  severity?: AlertSeverity;
  snapshotId?: string | null;
  confidence?: number;
  threatLevel?: string;
  snapshotImage?: string;
  image?: string;
  thumbnail?: string;
}) {
  if (!userId || !cameraId) return;

  const threatLevel =
  type === "Unknown Motion"
    ? "HIGH"
    : type === "Person Detected"
    ? "MEDIUM"
    : type === "Pet Detected"
    ? "LOW"
    : type === "Package Delivered"
    ? "LOW"
    : "MEDIUM";

  const alertRef = await addDoc(collection(db, "users", userId, "securityAlerts"), {
  cameraId,
  cameraName: cameraName || room || "Camera",
  room: room || "",
  type,
  message,
  severity,
  threatLevel,
  recommendedActions: getRecommendedActions(type, threatLevel),
  snapshotId,
  read: false,
  responseExecuted: false,
  createdAt: serverTimestamp(),
  timeline: [
    {
      label: "Motion detected",
      createdAt: new Date(),
    },
    {
      label: "AI classified event",
      createdAt: new Date(),
    },
    {
      label: "Snapshot captured",
      createdAt: new Date(),
    },
  ],
  });

await addDoc(collection(db, "securityCaptures"), {
  cameraId,
  cameraName: cameraName || room || "Camera",
  room: room || "Unknown",
  type: type || "Motion Capture",
  image: snapshotImage || image || thumbnail || "",
  thumbnail: snapshotImage || image || thumbnail || "",
  snapshotId: snapshotId || null,
  alertId: alertRef.id,
  threatLevel: threatLevel || "UNKNOWN",
  recommendedActions: getRecommendedActions(type, threatLevel),
  timeline: [
    { label: "Motion detected", createdAt: new Date() },
    { label: "AI classified event", createdAt: new Date() },
    { label: "Snapshot captured", createdAt: new Date() },
  ],
  createdAt: serverTimestamp(),
});
}