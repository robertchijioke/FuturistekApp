import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";

export async function logTimeline(
  domain: "care" | "home" | "business" | "campus",
  room: string,
  icon: string,
  message: string,
  type: string,
  incidentId?: string
) {
  const cleanRoom = room.trim();
  const cleanIncidentId =
    typeof incidentId === "string"
      ? incidentId.trim()
      : "";

  if (!cleanRoom) {
    console.warn("Timeline event was not saved: room is missing.", {
      domain,
      type,
      incidentId: cleanIncidentId || null,
    });

    return null;
  }

  if (domain === "care" && !cleanIncidentId) {
    console.warn(
      "Care timeline event was not saved: incidentId is missing.",
      {
        room: cleanRoom,
        type,
        message,
      }
    );

    return null;
  }

  const timelineReference = await addDoc(
    collection(db, `${domain}Timeline`),
    {
      room: cleanRoom,
      icon,
      message,
      type,

      incidentId: cleanIncidentId || null,

      createdAt: serverTimestamp(),
    }
  );

  return timelineReference.id;
}
