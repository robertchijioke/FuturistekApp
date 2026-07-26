import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { addDoc, collection, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import MissionControlMap from "../components/MissionControlMap";
import ResponseETA from "../components/ResponseETA";
import ResponseProgress from "../components/ResponseProgress";
import { useIncident } from "../context/IncidentContext";
import { baseStaff } from "../data/care-staff";
import { db } from "../lib/firebase";
import { nextIncidentStage, resetIncident } from "../utils/incidentEngine";
import { logTimeline } from "../utils/timeline";


type CommandCenterResident = {
  id: string;
  fullName: string;
  room: string;
  status: string;
  activity: string;
  currentActivity?: string;
  fallRisk?: string;
};


const incidentDuration = (createdAt: any) => {
  if (!createdAt?.toDate) return "00:00";

  const started = createdAt.toDate().getTime();
  const now = Date.now();

  const minutes = Math.floor((now - started) / 60000);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }

  return `${minutes}m`;
};

const getEscalationLevel = (createdAt: any, responseStatus?: string) => {
  if (!createdAt?.toDate) return null;
  if (responseStatus === "RESOLVED") return null;

  const started = createdAt.toDate().getTime();
  const minutesOpen = Math.floor((Date.now() - started) / 60000);

  if (minutesOpen >= 10) return "🚑 Emergency services recommended";
  if (minutesOpen >= 5) return "📞 Escalate to care manager";
  if (minutesOpen >= 2) return "🚨 Escalate to shift leader";

  return null;
};

  const getAIRecommendation = (resident: any) => {
    if (resident.status === "CRITICAL") {
      return {
        confidence: "97%",
        title: "Immediate emergency response recommended",
        reason:
          "Possible fall detected. Resident remains in critical state and the incident is still active.",
      };
    }

    if (resident.status === "ATTENTION") {
      return {
        confidence: "86%",
        title: "Staff check recommended",
        reason:
          "Wandering pattern detected. No emergency confirmed, but resident should be checked.",
      };
    }

    return null;
  };

  const getIncidentStage = (resident: any) => {
    if (resident.status !== "CRITICAL") return "NORMAL";

    if (!resident.responseStatus || resident.responseStatus === "PENDING") {
      return "ALERT_CREATED";
    }

    if (resident.responseStatus === "ACKNOWLEDGED") {
      return "STAFF_ASSIGNED";
    }

    if (resident.responseStatus === "IN_PROGRESS") {
      return "RESPONSE_ACTIVE";
    }

    if (resident.responseStatus === "RESOLVED") {
      return "RESOLVED";
    }

    return "ALERT_CREATED";
  };

  const getNextAction = (resident: any) => {
    if (resident.status !== "CRITICAL") return null;

    switch (resident.responseStatus) {
      case "PENDING":
        return {
          icon: "🚨",
          title: "Dispatch nearest care staff",
          color: "#ef4444",
        };

      case "ACKNOWLEDGED":
        return {
          icon: "📹",
          title: "Review live camera feed",
          color: "#0891b2",
        };

      case "IN_PROGRESS":
        return {
          icon: "🚑",
          title: "Assess need for emergency services",
          color: "#f97316",
        };

      default:
        return null;
    }
  };

  const getPriorityScore = (resident: any) => {
    if (resident.status === "CRITICAL") return 1;
    if (resident.status === "ATTENTION") return 2;
    return 3;
  };

  const getBuildingSystems = (resident: any) => {
  if (resident.status === "CRITICAL") {
    return {
      door: "LOCKED",
      camera: "RECORDING",
      lights: "ON",
      pa: "READY",
      alarm: "ACTIVE",
      elevator: "PRIORITY MODE",
    };
  }

  return {
    door: "NORMAL",
    camera: "MONITORING",
    lights: "AUTO",
    pa: "STANDBY",
    alarm: "OFF",
    elevator: "NORMAL",
  };
};

  const responseStages = [
    "ALERT_CREATED",
    "STAFF_ASSIGNED",
    "EN_ROUTE",
    "AT_SCENE",
    "ASSESSMENT",
    "AMBULANCE_REQUESTED",
    "TRANSPORT",
    "RESOLVED",
  ];

export default function CareCommandCenter() {
  const router = useRouter();

  const {
    siteId,
    siteName,
    siteLocation,
    focusIncidentId,
    focusResidentId,
    focusRoom,
  } = useLocalSearchParams<{
    siteId?: string;
    siteName?: string;
    siteLocation?: string;
    focusIncidentId?: string;
    focusResidentId?: string;
    focusRoom?: string;
  }>();

  const selectedSiteId =
    typeof siteId === "string" && siteId.trim()
      ? siteId.trim()
      : "site-1";

  const selectedSiteName =
    typeof siteName === "string" && siteName.trim()
      ? siteName.trim()
      : "Futuristek Care Centre";

  const selectedSiteLocation =
    typeof siteLocation === "string" && siteLocation.trim()
      ? siteLocation.trim()
      : "London";

  const requestedIncidentId =
    typeof focusIncidentId === "string"
      ? focusIncidentId.trim()
      : "";

  const requestedResidentId =
    typeof focusResidentId === "string"
      ? focusResidentId.trim()
      : "";

  const requestedRoom =
    typeof focusRoom === "string"
      ? focusRoom.trim()
      : "";

  const openResidentProfile = (resident: any) => {
    const residentId = String(resident.room)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    console.log("ROOM → RESIDENT PROFILE:", {
      residentId,
      room: resident.room,
      status: resident.status,
    });

    router.push({
      pathname: "/resident-profile",
      params: {
        residentId,
        room: resident.room,
      },
    } as any);
  };

  const {
    incidents,
    incident,
    setIncidents,
    setSelectedIncidentId,
  } = useIncident();
  
  const incidentStage = String(
    incident?.stage ?? "RESOLVED"
  )
    .trim()
    .toUpperCase();

  const incidentRoom = String(
    incident?.room ?? ""
  ).trim();

  const isResolved = incidentStage === "RESOLVED";

  const currentEtaMinutes =
    typeof incident?.etaMinutes === "number"
      ? incident.etaMinutes
      : 3;

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentCareEventId, setCurrentCareEventId] =
  useState<string | null>(null);
  const [allCareEvents, setAllCareEvents] = useState<any[]>([]);
  const [activeCareEvents, setActiveCareEvents] = useState<any[]>([]);
  const [realResidents, setRealResidents] =
  useState<CommandCenterResident[]>([]);

  const [selectedResidentId, setSelectedResidentId] =
    useState("");

  const [residentsLoading, setResidentsLoading] =
    useState(true);

  const selectedResident =
    realResidents.find(
      (resident) => resident.id === selectedResidentId
    ) ?? null;

  const playbackStages = [
    "ALERT_CREATED",
    "STAFF_ASSIGNED",
    "EN_ROUTE",
    "AT_SCENE",
    "ASSESSMENT",
    "AMBULANCE_REQUESTED",
    "TRANSPORT",
    "RESOLVED",
  ];

  const currentStageIndex =
    playbackStages.indexOf(incidentStage);

  useEffect(() => {
    setResidentsLoading(true);
    setRealResidents([]);
    setSelectedResidentId("");

    const residentsQuery = query(
      collection(db, "residents"),
      where("siteId", "==", selectedSiteId)
    );

    const unsubscribe = onSnapshot(
      residentsQuery,
      (snapshot) => {
        const loadedResidents = snapshot.docs
          .map((document) => {
            const data = document.data();

            return {
              id: document.id,

              siteId:
                String(data.siteId ?? selectedSiteId).trim() ||
                selectedSiteId,

              fullName: String(
                data.fullName ??
                  data.name ??
                  "Resident"
              ).trim(),

              room: String(data.room ?? "").trim(),

              status: String(data.status ?? "SAFE")
                .trim()
                .toUpperCase(),

              activity: String(
                data.currentActivity ??
                  data.activity ??
                  "No activity concern"
              ).trim(),

              currentActivity: String(
                data.currentActivity ??
                  data.activity ??
                  ""
              ).trim(),

              fallRisk: String(
                data.fallRisk ?? ""
              ).trim(),
            };
          })
          .filter(
            (resident) =>
              resident.id &&
              resident.fullName &&
              resident.room
          )
          .sort((a, b) =>
            a.room.localeCompare(b.room, undefined, {
              numeric: true,
            })
          );

        setRealResidents(loadedResidents);

        setSelectedResidentId((current) => {
          if (
            current &&
            loadedResidents.some(
              (resident) => resident.id === current
            )
          ) {
            return current;
          }

          return loadedResidents[0]?.id ?? "";
        });

        setResidentsLoading(false);

        console.log(
          "✅ COMMAND CENTER RESIDENTS LOADED:",
          {
            siteId: selectedSiteId,
            count: loadedResidents.length,
          }
        );
      },
      (error) => {
        console.error(
          "Could not load Command Center residents:",
          error
        );

        setRealResidents([]);
        setSelectedResidentId("");
        setResidentsLoading(false);
      }
    );

    return unsubscribe;
  }, [selectedSiteId]);
 
  useEffect(() => {
  if (!isPlaying) return;

  if (currentStageIndex >= playbackStages.length - 1) {
    setIsPlaying(false);
    return;
  }

  const timer = setTimeout(async () => {
    const nextStage =
      playbackStages[currentStageIndex + 1];

    setIncidents((prev: any[]) =>
      prev.map((item) =>
        item.id === incident.id
          ? {
              ...item,
              stage: nextStage,
              status:
                nextStage === "RESOLVED"
                  ? "RESOLVED"
                  : item.status,
            }
          : item
      )
    );

    if (!incidentRoom) {
      return;
    }

    if (nextStage === "RESOLVED") {
      await resolveCareEventForRoom(incidentRoom);
    } else {
      await updateCareEventStageForRoom(
        incidentRoom,
        nextStage
      );
    }
  }, 2000);

  return () => clearTimeout(timer);
}, [isPlaying, currentStageIndex]);

  const assignedStaffStage: string = incidentStage;


  const staffResponding =
    isResolved || assignedStaffStage === "ALERT_CREATED"
      ? 0
      : 1;

  const escalatedIncidents = isResolved ? 0 : 1;

useEffect(() => {
  const q = query(
    collection(db, "careEvents"),
    where("siteId", "==", selectedSiteId),
    orderBy("createdAt", "desc")
  );

  const unsub = onSnapshot(q, (snapshot) => {
    const allEvents: any[] = snapshot.docs.map((document) => {
      const data = document.data();

      return {
        ...data,
        id: document.id,
        incidentId: document.id,
        eventId: document.id,

        siteId:
          String(data.siteId ?? "site-1").trim() ||
          "site-1",
      };
    });

    const siteEvents = allEvents;

    const activeEvents: any[] = siteEvents.filter(
      (event: any) =>
        String(event.status ?? "")
          .trim()
          .toLowerCase() === "active"
    );

    setAllCareEvents(siteEvents);
    setActiveCareEvents(activeEvents);

    const contextIncidents = activeEvents
      .filter(
        (event: any) =>
          Boolean(String(event?.id ?? "").trim()) &&
          Boolean(String(event?.room ?? "").trim())
      )
      .map((event: any) => ({
        ...event,
        id: String(event.id ?? ""),
        incidentId: String(event.id ?? ""),
        eventId: String(event.id ?? ""),

        residentId: String(
          event.residentId ?? ""
        ),
        residentName: String(
          event.residentName ?? "Resident"
        ),
        room: String(event.room ?? "").trim(),
        type: String(
          event.type ?? "Incident"
        ),
        severity: String(
          event.severity ?? "HIGH"
        ),
        stage: String(
          event.stage ?? "ALERT_CREATED"
        ),
        status: String(
          event.status ?? "active"
        ),
      }));

    setIncidents(contextIncidents);

    setSelectedIncidentId((currentSelectedId: string) => {
      const selectedIncidentStillExists = contextIncidents.some(
        (item: any) =>
          String(item?.id ?? "") === currentSelectedId
      );

      if (selectedIncidentStillExists) {
        return currentSelectedId;
      }

      return String(contextIncidents[0]?.id ?? "");
    });
  });

  return unsub;
}, [selectedSiteId]);

useEffect(() => {
  if (!requestedIncidentId) {
    return;
  }

  const targetIncident = incidents.find(
    (item: any) =>
      String(
        item?.id ??
          item?.incidentId ??
          item?.eventId ??
          ""
      ).trim() === requestedIncidentId
  );

  if (!targetIncident) {
    return;
  }

  setSelectedIncidentId(requestedIncidentId);

  const targetResident = realResidents.find(
    (resident: any) => {
      const residentId = String(
        resident?.id ?? ""
      ).trim();

      const residentRoom = String(
        resident?.room ?? ""
      ).trim();

      const incidentResidentId = String(
        targetIncident?.residentId ?? ""
      ).trim();

      const incidentRoom = String(
        targetIncident?.room ?? ""
      ).trim();

      return (
        (requestedResidentId &&
          residentId === requestedResidentId) ||
        (incidentResidentId &&
          residentId === incidentResidentId) ||
        (requestedRoom &&
          residentRoom === requestedRoom) ||
        (incidentRoom &&
          residentRoom === incidentRoom)
      );
    }
  );

  if (targetResident?.id) {
    setSelectedResidentId(
      String(targetResident.id)
    );
  }

  console.log(
    "GLOBAL INCIDENT → COMMAND CENTER FOCUS:",
    {
      siteId: selectedSiteId,
      incidentId: requestedIncidentId,
      residentId:
        targetResident?.id ??
        requestedResidentId,
      room:
        targetResident?.room ??
        requestedRoom,
    }
  );
  }, [
    requestedIncidentId,
    requestedResidentId,
    requestedRoom,
    incidents,
    realResidents,
    selectedSiteId,
  ]);

const updateCareEventStageForRoom = async (
    room: string,
    nextStage: string
  ) => {
    try {
      const activeEventQuery = query(
        collection(db, "careEvents"),
        where("room", "==", room),
        where("status", "==", "active")
      );

      const activeEventSnapshot = await getDocs(activeEventQuery);

      if (activeEventSnapshot.empty) {
        console.warn(
          "No active Firestore care event found for:",
          room,
          nextStage
        );
        return;
      }

      const assignedStaffName =
        String(incident?.assignedStaff ?? "James").trim() || "James";

      const stageUpdates: Record<string, any> = {
        ALERT_CREATED: {
          responseStatus: "PENDING",
          staffResponding: false,
        },

        STAFF_ASSIGNED: {
          responseStatus: "ACKNOWLEDGED",
          staffResponding: true,
          assignedStaff: assignedStaffName,
          etaMinutes: currentEtaMinutes,
        },

        EN_ROUTE: {
          responseStatus: "EN_ROUTE",
          staffResponding: true,
          assignedStaff: assignedStaffName,
          etaMinutes: Math.max(0, currentEtaMinutes - 1),
          currentResponderLocation: "Hallway",
        },

        AT_SCENE: {
          responseStatus: "AT_SCENE",
          staffResponding: true,
          assignedStaff: assignedStaffName,
          etaMinutes: 0,
          currentResponderLocation: incidentRoom,
        },

        ASSESSMENT: {
          responseStatus: "ASSESSMENT",
          staffResponding: true,
        },

        AMBULANCE_REQUESTED: {
          responseStatus: "AMBULANCE_REQUESTED",
          staffResponding: true,
        },

        TRANSPORT: {
          responseStatus: "TRANSPORT",
          staffResponding: true,
        },
      };

      const updateFields = stageUpdates[nextStage] ?? {
        responseStatus: nextStage,
      };

      await Promise.all(
        activeEventSnapshot.docs.map((eventDocument) =>
          updateDoc(doc(db, "careEvents", eventDocument.id), {
            stage: nextStage,
            ...updateFields,
            updatedAt: serverTimestamp(),
          })
        )
      );

      const stageTimelineDetails: Record<
        string,
        { icon: string; message: string; type: string }
      > = {
        STAFF_ASSIGNED: {
          icon: "👩",
          message: `${incident.assignedStaff ?? "Care staff"} assigned`,
          type: "assigned",
        },
        EN_ROUTE: {
          icon: "🚶",
          message: `${incident.assignedStaff ?? "Care staff"} en route`,
          type: "enroute",
        },
        AT_SCENE: {
          icon: "📍",
          message: `${incident.assignedStaff ?? "Care staff"} arrived at scene`,
          type: "scene",
        },
        ASSESSMENT: {
          icon: "🩺",
          message: "Resident assessment started",
          type: "assessment",
        },
        AMBULANCE_REQUESTED: {
          icon: "🚑",
          message: "Ambulance requested",
          type: "ambulance",
        },
        TRANSPORT: {
          icon: "🏥",
          message: "Resident transport started",
          type: "transport",
        },
      };

      const timelineDetails = stageTimelineDetails[nextStage];

      if (timelineDetails) {
        await Promise.all(
          activeEventSnapshot.docs.map((eventDocument) =>
            logTimeline(
              "care",
              room,
              timelineDetails.icon,
              timelineDetails.message,
              timelineDetails.type,
              eventDocument.id
            )
          )
        );
      }

      console.log(
        `✅ Firestore stage updated: ${room} → ${nextStage}`
      );
    } catch (error) {
      console.error(
        `❌ Could not update Firestore stage for ${room}:`,
        error
      );
    }
  };

  const resolveCareEventForRoom = async (room: string) => {
      try {
        const activeEventQuery = query(
          collection(db, "careEvents"),
          where("room", "==", room),
          where("status", "==", "active")
        );

        const activeEventSnapshot = await getDocs(activeEventQuery);

        await Promise.all(
        activeEventSnapshot.docs.map(async (eventDocument) => {
          const eventData = eventDocument.data();

          const preservedAssignedStaff =
            String(eventData?.assignedStaff ?? "James").trim() || "James";

          await updateDoc(doc(db, "careEvents", eventDocument.id), {
            status: "resolved",
            stage: "RESOLVED",
            responseStatus: "RESOLVED",
            staffResponding: false,
            etaMinutes: 0,
            assignedStaff: preservedAssignedStaff,
            resolvedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        })
      );
        await Promise.all(
          activeEventSnapshot.docs.map((eventDocument) =>
            logTimeline(
              "care",
              room,
              "✅",
              "Incident resolved",
              "resolved",
              eventDocument.id
            )
          )
        );
      } catch (error) {
        console.error("Could not resolve care event:", error);
      }
    };

  const triggerTestFallEvent = async () => {
    try {

      if (!selectedResident) {
        alert("Please select a resident before simulating an incident.");
        return false;
      }

      const incidentRoom = selectedResident.room;
      const incidentResidentId = selectedResident.id;
      const incidentResidentName = selectedResident.fullName;

      console.log(
        "🔥 triggerTestFallEvent started for:",
        incidentRoom
      );

      const existingFallQuery = query(
        collection(db, "careEvents"),
        where("room", "==", incidentRoom),
        where("status", "==", "active")
      );

      const existingFallSnapshot = await getDocs(existingFallQuery);

      console.log(
        `🔥 Existing active ${incidentRoom} events:`,
        existingFallSnapshot.size
      );

      if (!existingFallSnapshot.empty) {
        alert(
          `${incidentRoom} already has an active incident.`
        );
        return true;
      }

      const careEventRef = await addDoc(
        collection(db, "careEvents"),
        {
          residentId: incidentResidentId,
          residentName: incidentResidentName,
          room: incidentRoom,
          siteId: selectedSiteId,
          type: "Fall Detection",
          severity: "HIGH",
          status: "active",
          stage: "ALERT_CREATED",
          staffResponding: false,
          responseStatus: "PENDING",
          assignedStaff: null,
          etaMinutes: currentEtaMinutes,
          currentResponderLocation: null,
          createdAt: serverTimestamp(),
        }
      );

      setCurrentCareEventId(careEventRef.id);

      console.log("✅ RESIDENT CARE EVENT CREATED:", {
        careEventId: careEventRef.id,
        residentId: incidentResidentId,
        residentName: incidentResidentName,
        room: incidentRoom,
      });

      await logTimeline(
        "care",
        incidentRoom,
        "🤖",
        `AI detected possible fall for ${incidentResidentName}`,
        "ai_detection",
        careEventRef.id
      );

      return true;
    } catch (error) {
      console.error("❌ Failed to create care event:", error);
      alert("Could not create the Firestore care event. Check the terminal.");
      return false;
    }
  };

  const residents: any[] = realResidents
    .filter(
      (resident: any) =>
        Boolean(String(resident?.id ?? "").trim()) &&
        Boolean(String(resident?.room ?? "").trim())
    )
    .map((resident: any) => {
      const room = String(resident.room).trim();

    const activeEvent = activeCareEvents.find(
      (event: any) =>
        String(event.room ?? "").trim() === room
    );

    const storedStatus = String(
      resident.status ?? "SAFE"
    )
      .trim()
      .toUpperCase();

    if (!activeEvent) {
      const residentActivity = String(
        resident.currentActivity ??
          resident.activity ??
          ""
      )
        .trim()
        .toUpperCase();

      const needsAttention =
        storedStatus === "ATTENTION" ||
        storedStatus === "NEEDS_ATTENTION" ||
        storedStatus === "NEEDS ATTENTION" ||
        residentActivity === "WANDERING";

      const status = needsAttention
        ? "ATTENTION"
        : "SAFE";

      return {
        ...resident,
        id: String(resident.id ?? room),
        fullName: String(
          resident.fullName ?? resident.name ?? "Resident"
        ),
        room,
        status,
        activity: String(
          resident.currentActivity ??
            resident.activity ??
            "No activity concern"
        ),
        color:
          status === "ATTENTION"
            ? "#f59e0b"
            : "#22c55e",
      };
    }

    const severity = String(
      activeEvent.severity ?? "HIGH"
    )
      .trim()
      .toUpperCase();

    const status =
      severity === "HIGH" ||
      severity === "CRITICAL"
        ? "CRITICAL"
        : "ATTENTION";

    return {
      ...resident,
      id: String(resident.id ?? room),
      fullName: String(
        resident.fullName ??
          activeEvent.residentName ??
          "Resident"
      ),
      room,
      status,
      activity: String(
        activeEvent.type ??
          activeEvent.activity ??
          "Care event detected"
      ),
      color:
        status === "CRITICAL"
          ? "#ef4444"
          : "#f59e0b",
      responseStatus: activeEvent.responseStatus,
      staffResponding: activeEvent.staffResponding,
      createdAt: activeEvent.createdAt,
      assignedStaff:
        activeEvent.assignedStaff ?? null,
      etaMinutes:
        activeEvent.etaMinutes ?? null,
      currentResponderLocation:
        activeEvent.currentResponderLocation ?? null,
      incidentId: activeEvent.id,
    };
  });

  const activeIncidents = residents.filter((r) => r.status !== "SAFE");

  const siteBaseStaff = baseStaff.filter(
    (member) => member.siteId === selectedSiteId
  );

  const staff = siteBaseStaff.map((member) => {
    const assignedIncident = activeIncidents.find(
      (activeIncident: any) =>
        activeIncident.assignedStaff === member.name &&
        activeIncident.responseStatus !== "PENDING"
    );

    if (!assignedIncident) {
      return {
        ...member,
        status: "AVAILABLE",
        assignedRoom: "",
        location: "Nurse Station",
      };
    }

    const responseStatus = String(
      assignedIncident.responseStatus ?? ""
    ).toUpperCase();

    const assignedRoom = String(
      assignedIncident?.room ?? ""
    ).trim();

    if (responseStatus === "ACKNOWLEDGED") {
      return {
        ...member,
        status: "ASSIGNED",
        assignedRoom,
        location: "Nurse Station",
      };
    }

    if (responseStatus === "EN_ROUTE") {
      return {
        ...member,
        status: "EN_ROUTE",
        assignedRoom,
        location:
          assignedIncident?.currentResponderLocation ??
          "Hallway",
      };
    }

    if (
      responseStatus === "AT_SCENE" ||
      responseStatus === "ASSESSMENT" ||
      responseStatus === "AMBULANCE_REQUESTED" ||
      responseStatus === "TRANSPORT"
    ) {
      return {
        ...member,
        status: "AT_SCENE",
        assignedRoom,
        location:
          assignedIncident?.currentResponderLocation ??
          assignedRoom,
      };
    }

    return {
      ...member,
      status: "AVAILABLE",
      assignedRoom: "",
      location: "Nurse Station",
    };
  });

  const sortedResidents = [...residents].sort((a, b) => {
  const priority = {
      CRITICAL: 3,
      ATTENTION: 2,
      SAFE: 1,
    };

    return (
      (priority[b.status as keyof typeof priority] || 0) -
      (priority[a.status as keyof typeof priority] || 0)
    );
  });

  const residentsMonitored = sortedResidents.length;

  const criticalEmergencies = sortedResidents.filter(
    (resident: any) =>
      String(resident.status ?? "")
        .trim()
        .toUpperCase() === "CRITICAL"
  ).length;

  const attentionNeeded = sortedResidents.filter(
    (resident: any) =>
      String(resident.status ?? "")
        .trim()
        .toUpperCase() === "ATTENTION"
  ).length;

  const residentsSafe = sortedResidents.filter(
    (resident: any) =>
      String(resident.status ?? "")
        .trim()
        .toUpperCase() === "SAFE"
  ).length;

  const priorityQueue = [...residents]
    .filter((r) => r.status !== "SAFE")
    .sort((a, b) => getPriorityScore(a) - getPriorityScore(b));

  const criticalCount = residents.filter((r) => r.status === "CRITICAL").length;
  const attentionCount = residents.filter((r) => r.status === "ATTENTION").length;
  const safeCount = residents.filter((r) => r.status === "SAFE").length;

  const respondingCount = activeCareEvents.filter(
    (event) => event.staffResponding === true
  ).length;

  const availableStaffCount = staff.filter(
    (member) => member.status === "AVAILABLE"
  ).length;

  const ambulancesAvailable = priorityQueue.some(
    (resident) => resident.status === "CRITICAL"
  )
    ? 1
    : 2;

  const resources = {
    availableStaff: availableStaffCount,
    ambulances: ambulancesAvailable,
    camerasOnline: "12/12",
    emergencyExits: "Secure",
    backupPower: "Online",
    networkStatus: "Healthy",
  };

  const getLiveFeed = (resident: any) => {
    if (resident.status !== "CRITICAL") return null;

    switch (resident.responseStatus) {
      case "PENDING":
        return {
          title: "AI detected possible fall",
          message: "Monitoring resident. AI is assessing the situation.",
        };

      case "ACKNOWLEDGED":
        return {
          title: `${incident.assignedStaff} assigned`,
          message: `${incident.assignedStaff} has accepted the incident and is en route.`,
        };

      case "IN_PROGRESS":
        return {
          title: "Live assessment in progress",
          message: "Care staff has arrived and is assessing the resident.",
        };

      case "RESOLVED":
        return {
          title: "Incident completed",
          message: "Resident is safe. Care staff has returned to normal duties.",
        };

      default:
        return null;
    }
  };

  const stageDetails: Record<string, { title: string; icon: string; color: string }> = {
    ALERT_CREATED: {
      title: "Alert Created",
      icon: "🚨",
      color: "#a855f7",
    },
    STAFF_ASSIGNED: {
      title: "Staff Assigned",
      icon: "👩",
      color: "#60a5fa",
    },
    EN_ROUTE: {
      title: "En Route",
      icon: "🚶",
      color: "#f59e0b",
    },
    AT_SCENE: {
      title: "At Scene",
      icon: "📍",
      color: "#22c55e",
    },
    ASSESSMENT: {
      title: "Assessment",
      icon: "🩺",
      color: "#0ea5e9",
    },
    AMBULANCE_REQUESTED: {
      title: "Ambulance Requested",
      icon: "🚑",
      color: "#ef4444",
    },
    TRANSPORT: {
      title: "Resident Transport",
      icon: "🏥",
      color: "#ec4899",
    },
    RESOLVED: {
      title: "Incident Resolved",
      icon: "✅",
      color: "#22c55e",
    },
  };

  const currentCareEvent = activeCareEvents.find(
    (event: any) =>
      String(event?.room ?? "").trim() === incidentRoom
  );

  const latestIncidentCareEvent = allCareEvents
    .filter(
      (event: any) =>
        String(event?.room ?? "").trim() === incidentRoom
    )
  .sort((a: any, b: any) => {
    const getCreatedAtMillis = (event: any) => {
      if (typeof event.createdAt?.toMillis === "function") {
        return event.createdAt.toMillis();
      }

      if (typeof event.createdAt?.seconds === "number") {
        return event.createdAt.seconds * 1000;
      }

      return 0;
    };

    return getCreatedAtMillis(b) - getCreatedAtMillis(a);
  })[0];

  

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#061826" }}
      contentContainerStyle={{ padding: 24, paddingTop: 70, paddingBottom: 80 }}
    >
      <Text
        style={{
          color: "#fff",
          fontSize: 46,
          fontWeight: "900",
        }}
      >
        🏥 Care Command Center
      </Text>

      <Text
        style={{
          color: "#93c5fd",
          fontSize: 21,
          fontWeight: "700",
          marginTop: 10,
        }}
      >
        {selectedSiteName}
      </Text>

      <Text
        style={{
          color: "#cbd5e1",
          fontSize: 17,
          marginTop: 4,
        }}
      >
        📍 {selectedSiteLocation}
      </Text>

      <Pressable
        onPress={() => router.push("/mission-control" as any)}
        style={{
          backgroundColor: "#7c3aed",
          paddingVertical: 16,
          paddingHorizontal: 18,
          borderRadius: 14,
          marginTop: 18,
        }}
      >
        <Text
          style={{
            color: "#ffffff",
            fontSize: 17,
            fontWeight: "900",
            textAlign: "center",
          }}
        >
          🌍 Open Futuristek Mission Control
        </Text>
      </Pressable>

      <View style={{ marginTop: 16, marginBottom: 20 }}>
        {incidents.map((item: any) => (
          <Pressable
            key={item.id}
            onPress={() => setSelectedIncidentId(item.id)}
            style={{
              backgroundColor: "#081826",
              borderWidth: 1,
              borderColor: "#22c55e",
              borderRadius: 14,
              padding: 14,
              marginBottom: 10,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800" }}>
              🚨 {item.room} • {item.type}
            </Text>
          </Pressable>
        ))}
      </View>

      {activeCareEvents.length > 0 ? (
        <>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 18 }}>
        <Pressable
          onPress={() => {
            setIsPlaying(false);
            setIncidents((prev: any[]) =>
              prev.map((item) =>
                item.id === incident.id ? nextIncidentStage(item) : item
              )
            );
          }}
          style={{
            backgroundColor: "#2563eb",
            padding: 12,
            borderRadius: 12,
            flex: 1,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900", textAlign: "center" }}>
            ▶ Next Stage
          </Text>
        </Pressable>

        <Pressable
          onPress={async () => {
            setIsPlaying(false);

            if (!incidentRoom) {
              console.warn(
                "Cannot resolve incident without a valid room."
              );
              return;
            }

            await resolveCareEventForRoom(incidentRoom);

            setIncidents((prev: any[]) =>
              prev.map((item) =>
                item.id === incident?.id
                  ? {
                      ...resetIncident(item.room, item.assignedStaff),
                      id: item.id,
                      type: item.type,
                      residentName: item.residentName,
                    }
                  : item
              )
            );

            setTimeout(async () => {
              await triggerTestFallEvent();
            }, 500);
          }}
          style={{
            backgroundColor: "#374151",
            padding: 12,
            borderRadius: 12,
            flex: 1,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900", textAlign: "center" }}>
            ↺ Reset
          </Text>
        </Pressable>
      </View>

      <Pressable
        onPress={async () => {
          if (isPlaying) {
            setIsPlaying(false);
            return;
          }

          const eventReady = await triggerTestFallEvent();

          if (eventReady) {
            setIsPlaying(true);
          }
        }}
        style={{
          backgroundColor: isPlaying ? "#dc2626" : "#16a34a",
            padding: 12,
            borderRadius: 12,
            marginTop: 12,
          }}
        >
        <Text
          style={{
            color: "#fff",
            fontWeight: "900",
            textAlign: "center",
          }}
        >
          {isPlaying ? "⏸ Pause Playback" : "▶ Play Incident"}
        </Text>
      </Pressable>

      <Text
        style={{
          color: isPlaying ? "#22c55e" : "#93c5fd",
          fontSize: 18,
          fontWeight: "800",
          marginTop: 10,
        }}
      >
        {isPlaying
          ? `▶ Playing: ${incidentStage}`
          : `Paused: ${incidentStage}`}
      </Text>

        </>
      ) : (
        <View
          style={{
            backgroundColor: "#0f2d49",
            borderWidth: 1,
            borderColor: "#22c55e",
            borderRadius: 18,
            padding: 22,
            marginBottom: 22,
          }}
        >
          <Text
            style={{
              color: "#22c55e",
              fontSize: 26,
              fontWeight: "900",
            }}
          >
            ✅ No active emergency
          </Text>

          <Text
            style={{
              color: "#cfe2ff",
              fontSize: 18,
              lineHeight: 28,
              marginTop: 12,
            }}
          >
            No active emergency incident is currently being managed.
          </Text>
        </View>
      )}

      <Text
        style={{
          color: "#9fc8ff",
          fontSize: 22,
          marginTop: 10,
        }}
      >
        Live resident safety overview
      </Text>

      <View
        style={{
          backgroundColor: "#102a43",
          borderRadius: 18,
          padding: 18,
          marginBottom: 20,
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 28,
            fontWeight: "900",
            marginBottom: 16,
          }}
        >
          🗺️ Live Incident Map
        </Text>

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
         {sortedResidents.map((resident) => {
            const residentRoom = String(
              resident?.room ?? ""
            ).trim();

            const residentLatestIncidentCareEvent =
              allCareEvents.find(
                (event: any) =>
                  String(event?.room ?? "").trim() ===
                  residentRoom
              );

            const reportIncidentId = String(
              residentLatestIncidentCareEvent?.id ??
                residentLatestIncidentCareEvent?.incidentId ??
                residentLatestIncidentCareEvent?.eventId ??
                ""
            ).trim();

            const reportRoom = String(
              residentLatestIncidentCareEvent?.room ?? residentRoom
            ).trim();

            const reportStage = String(
              residentLatestIncidentCareEvent?.stage ??
                residentLatestIncidentCareEvent?.status ??
                ""
            )
              .trim()
              .toUpperCase();

          const reportStatus = String(
            residentLatestIncidentCareEvent?.status ?? ""
          )
            .trim()
            .toUpperCase();

          const hasResolvedAiReport =
            Boolean(reportIncidentId) &&
            Boolean(residentRoom) &&
            reportRoom === residentRoom &&
            (reportStage === "RESOLVED" || reportStatus === "RESOLVED");

            const systems =
              resident.room === incidentRoom && isResolved
                ? {
                    door: "NORMAL",
                    camera: "MONITORING",
                    lights: "NORMAL",
                    pa: "STANDBY",
                  }
                : resident.systems;

            return (
              <Pressable
                key={resident.room}
                onPress={() => {
                  if (resident.status === "CRITICAL") {
                    router.push({
                      pathname: "/care-emergency",
                      params: {
                        residentId: String(resident.room)
                          .trim()
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "-")
                          .replace(/^-|-$/g, ""),
                        room: resident.room,
                      },
                    } as any);

                    return;
                  }

                  openResidentProfile(resident);
                }}
                style={{
                  width: "47%",
                  backgroundColor: resident.color,
                  borderRadius: 14,
                  padding: 14,
                }}
              >
              <Text
                style={{
                  color: "#fff",
                  fontWeight: "900",
                  fontSize: 18,
                }}
              >
                {resident.room}
              </Text>

              <Text
                style={{
                  color: "#fff",
                  marginTop: 6,
                  fontSize: 15,
                }}
              >
                {resident.room === incidentRoom && isResolved
                  ? "SAFE"
                  : resident.status}
              </Text>

              {resident.status === "CRITICAL" && !isResolved && resident.createdAt && (
                <Text style={{ color: "#fff", marginTop: 6, fontSize: 14, fontWeight: "800" }}>
                  ⏱ {incidentDuration(resident.createdAt)}
                </Text>
              )}

              {resident.status === "CRITICAL" && !isResolved && (
                <Text style={{ color: "#fff", marginTop: 4, fontSize: 14 }}>
                  🚑 Emergency
                </Text>
              )}

              {resident.status === "ATTENTION" && (
                <Text style={{ color: "#fff", marginTop: 4, fontSize: 14 }}>
                  🚶 Wandering
                </Text>
              )}
            </Pressable>
            );
          })}
        </View>
        </View>

      <View style={{ backgroundColor: "#0f2d49", borderRadius: 20, padding: 20, marginTop: 24 }}>
        <Text style={{ color: "#fff", fontSize: 30, fontWeight: "900" }}>
          📊 Live Care Status
        </Text>

        <Text style={{ color: "#cfe2ff", fontSize: 20, marginTop: 16 }}>
          👥 Residents monitored: {residentsMonitored}
        </Text>
        <Text style={{ color: "#22c55e", fontSize: 20, marginTop: 8 }}>
          🟢 Residents safe: {residentsSafe}
        </Text>
        <Text style={{ color: "#f59e0b", fontSize: 20, marginTop: 8 }}>
          🟡 Staff attention needed: {attentionNeeded}
        </Text>
        <Text style={{ color: "#ef4444", fontSize: 20, marginTop: 8 }}>
          🔴 Critical emergencies: {criticalEmergencies}
        </Text>
        <Text style={{ color: "#cfe2ff", fontSize: 20, marginTop: 8 }}>
          👩🏿‍⚕️ Staff responding: {staffResponding}
        </Text>
        <Text
          style={{
            color: "#fb7185",
            fontSize: 20,
            marginTop: 8,
          }}
        >
          🚨 Escalated incidents:{" "}
          {
            escalatedIncidents
          }
        </Text>
      </View>

      <View style={{ backgroundColor: "#0f2d49", borderRadius: 20, padding: 18, marginTop: 24 }}>
        <Text style={{ color: "#fff", fontSize: 30, fontWeight: "900" }}>
          🚨 Priority Queue
        </Text>

        {priorityQueue
          .filter(
            (resident) =>
              !(resident.room === incidentRoom && isResolved)
          )
          .map((resident, index) => (
          <View
            key={resident.room}
            style={{
              backgroundColor: "#081826",
              borderRadius: 14,
              padding: 14,
              marginTop: 12,
              borderWidth: 1,
              borderColor: resident.status === "CRITICAL" ? "#ef4444" : "#f59e0b",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 22, fontWeight: "900" }}>
              {index + 1}. {resident.room}
            </Text>

            <Text
              style={{
                color: resident.status === "CRITICAL" ? "#ef4444" : "#f59e0b",
                fontSize: 18,
                fontWeight: "800",
                marginTop: 6,
              }}
            >
              {resident.status === "CRITICAL" ? "🔴 CRITICAL" : "🟠 ATTENTION"}
            </Text>

            {resident.createdAt && (
              <Text style={{ color: "#fbbf24", fontSize: 16, marginTop: 6, fontWeight: "800" }}>
                ⏱ Open {incidentDuration(resident.createdAt)}
              </Text>
            )}

            <Text style={{ color: "#cfe2ff", fontSize: 16, marginTop: 6 }}>
              {resident.activity}
            </Text>

            {staff
            .filter((member) => member.assignedRoom === resident.room)
            .map((member) => (
              <Text
                key={member.name}
                style={{ color: "#60a5fa", fontSize: 16, marginTop: 6, fontWeight: "800" }}
              >
                👩 {member.name} assigned
              </Text>
            ))}
          </View>
        ))}
      </View>

      <View style={{ backgroundColor: "#0f2d49", borderRadius: 20, padding: 18, marginTop: 24 }}>
        <Text style={{ color: "#fff", fontSize: 30, fontWeight: "900" }}>
          🚑 Response Resources
        </Text>

        <Text style={{ color: "#cfe2ff", fontSize: 20, marginTop: 14 }}>
          👩 Available Staff: {resources.availableStaff}
        </Text>

        <Text style={{ color: "#cfe2ff", fontSize: 20, marginTop: 10 }}>
          🚑 Ambulances: {resources.ambulances} Available
        </Text>

        <Text style={{ color: "#22c55e", fontSize: 20, marginTop: 10 }}>
          📹 Cameras Online: {resources.camerasOnline}
        </Text>

        <Text style={{ color: "#22c55e", fontSize: 20, marginTop: 10 }}>
          🚪 Emergency Exits: {resources.emergencyExits}
        </Text>

        <Text style={{ color: "#22c55e", fontSize: 20, marginTop: 10 }}>
          🔋 Backup Power: {resources.backupPower}
        </Text>

        <Text style={{ color: "#22c55e", fontSize: 20, marginTop: 10 }}>
          📡 Network Status: {resources.networkStatus}
        </Text>
      </View>

      <View
        style={{
          backgroundColor: "#0f2d49",
          borderRadius: 20,
          padding: 18,
          marginTop: 24,
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 30,
            fontWeight: "900",
          }}
        >
          🎥 Live Command Feed
        </Text>

        {!isResolved &&
          residents
            .filter((r) => r.status === "CRITICAL")
            .map((resident) => {
            const feed = getLiveFeed(resident);

            if (!feed) return null;

            return (
              <View
                key={resident.room}
                style={{
                  backgroundColor: "#081826",
                  borderRadius: 16,
                  padding: 16,
                  marginTop: 16,
                  borderWidth: 1,
                  borderColor: "#60a5fa",
                }}
              >
                <Text
                  style={{
                    color: "#22c55e",
                    fontSize: 18,
                    fontWeight: "800",
                  }}
                >
                  🟢 LIVE
                </Text>

                <Text
                  style={{
                    color: "#fff",
                    fontSize: 22,
                    fontWeight: "900",
                    marginTop: 10,
                  }}
                >
                  {resident.room}
                </Text>

                <Text
                  style={{
                    color: "#93c5fd",
                    fontSize: 18,
                    fontWeight: "800",
                    marginTop: 12,
                  }}
                >
                  🤖 {feed.title}
                </Text>

                <Text
                  style={{
                    color: "#cfe2ff",
                    fontSize: 16,
                    marginTop: 8,
                    lineHeight: 24,
                  }}
                >
                  {feed.message}
                </Text>
              </View>
            );
          })}
      </View>

      <View
        style={{
          backgroundColor: "#0f2d49",
          borderRadius: 20,
          padding: 18,
          marginTop: 24,
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 30,
            fontWeight: "900",
          }}
        >
          🤖 AI Command Dispatcher
        </Text>

        {!isResolved &&
          residents
            .filter((r) => r.status === "CRITICAL")
          .map((resident) => {
            const action = getNextAction(resident);

            if (!action) return null;

            return (
              <View
                key={resident.room}
                style={{
                  backgroundColor: "#081826",
                  borderRadius: 16,
                  padding: 16,
                  marginTop: 16,
                  borderWidth: 1,
                  borderColor: action.color,
                }}
              >
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 22,
                    fontWeight: "900",
                  }}
                >
                  {resident.room}
                </Text>

                <Text
                  style={{
                    color: "#ef4444",
                    fontSize: 18,
                    fontWeight: "800",
                    marginTop: 6,
                  }}
                >
                  🔴 {resident.status}
                </Text>

                <Text
                  style={{
                    color: isResolved ? "#22c55e" : action.color,
                    fontSize: 18,
                    fontWeight: "800",
                    marginTop: 12,
                  }}
                >
                  {isResolved ? "✅ Incident Completed" : `${action.icon} Next Action`}
                </Text>

                <Text
                  style={{
                    color: "#fff",
                    fontSize: 18,
                    marginTop: 6,
                  }}
                >
                  {isResolved
                    ? "Archive report and return staff to duty"
                    : action.title}
                </Text>
                </View>
            );
          })}
      </View>

        <MissionControlMap
          residents={sortedResidents}
          staff={staff}
          incident={incident}
          isResolved={isResolved}
          onRoomPress={(resident) => {
            if (resident.status === "CRITICAL") {
              router.push({
                pathname: "/care-emergency",
                params: {
                  residentId: String(resident.room)
                    .trim()
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, ""),
                  room: resident.room,
                },
              } as any);

              return;
            }

            openResidentProfile(resident);
          }}
        />

        <View
          style={{
            backgroundColor: "#0f2d49",
            borderRadius: 20,
            padding: 18,
            marginTop: 24,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 30, fontWeight: "900" }}>
            👩‍⚕️ Live Staff Tracking
          </Text>

          {staff
            .filter(
              (member) =>
                !(
                  isResolved &&
                  member.assignedRoom === incidentRoom
                )
            )
            .map((member) => (
            <View
              key={member.name}
                style={{
                  backgroundColor: "#081826",
                  borderRadius: 14,
                  padding: 14,
                  marginTop: 12,
                  borderWidth: 1,
                  borderColor:
                    member.status === "EN_ROUTE"
                      ? "#60a5fa"
                      : member.status === "AT_SCENE"
                      ? "#f59e0b"
                      : "#22c55e",
                }}
            >
              <Text style={{ color: "#fff", fontSize: 22, fontWeight: "900" }}>
                {member.name}
              </Text>

              <Text style={{ color: "#cfe2ff", fontSize: 16, marginTop: 4 }}>
                {member.role}
              </Text>

              <Text
                style={{
                  color:
                    member.status === "EN_ROUTE"
                      ? "#60a5fa"
                      : member.status === "AT_SCENE"
                      ? "#f59e0b"
                      : "#22c55e",
                  fontSize: 18,
                  marginTop: 6,
                  fontWeight: "800",
                }}
              >
                {member.name === "James"
                  ? assignedStaffStage === "ALERT_CREATED"
                    ? "🟢 Available"
                    : assignedStaffStage === "STAFF_ASSIGNED"
                    ? `🧑‍⚕️ Staff assigned to ${incidentRoom}`
                    : assignedStaffStage === "EN_ROUTE"
                    ? `🚶 En route to ${incidentRoom}`
                    : assignedStaffStage === "AT_SCENE"
                    ? `🧑‍⚕️ At scene: ${incidentRoom}`
                    : assignedStaffStage === "ASSESSMENT"
                    ? "🩺 Assessing resident"
                    : assignedStaffStage === "AMBULANCE_REQUESTED"
                    ? "🚑 Supporting ambulance response"
                    : assignedStaffStage === "TRANSPORT"
                    ? "🏥 Supporting resident transport"
                    : "🟢 Available"
                  : member.status === "EN_ROUTE"
                  ? `🚶 En route to ${member.assignedRoom}`
                  : member.status === "AT_SCENE"
                  ? `🙋 At scene: ${member.assignedRoom}`
                  : "🟢 Available"}
              </Text>
            </View>
          ))}
        </View>

          <View
            style={{
              backgroundColor: "#0f2d49",
              borderRadius: 20,
              padding: 18,
              marginTop: 24,
            }}
          >
            <Text
              style={{
                color: "#fff",
                fontSize: 30,
                fontWeight: "900",
                marginBottom: 18,
              }}
            >
              🛏️ Resident Rooms
            </Text>

            {sortedResidents
              .filter(
                (resident, index, residents) =>
                  index ===
                  residents.findIndex(
                    (item) => item.room === resident.room
                  )
              )
              .map((resident) => {
                const residentRoom = String(
                  resident?.room ?? ""
                ).trim();

                const residentRoomEvents = Array.isArray(allCareEvents)
                  ? allCareEvents.filter(
                      (event: any) =>
                        String(event?.room ?? "").trim() ===
                        residentRoom
                    )
                  : [];

                const getResidentEventMillis = (event: any) => {
                  const createdAt = event?.createdAt;

                  if (typeof createdAt?.toMillis === "function") {
                    return createdAt.toMillis();
                  }

                  if (typeof createdAt?.seconds === "number") {
                    return createdAt.seconds * 1000;
                  }

                  if (createdAt instanceof Date) {
                    return createdAt.getTime();
                  }

                  if (
                    typeof createdAt === "string" ||
                    typeof createdAt === "number"
                  ) {
                    const parsedTime = new Date(createdAt).getTime();

                    return Number.isNaN(parsedTime)
                      ? 0
                      : parsedTime;
                  }

                  return 0;
                };

                const residentLatestIncidentCareEvent =
                  [...residentRoomEvents].sort(
                    (a: any, b: any) =>
                      getResidentEventMillis(b) -
                      getResidentEventMillis(a)
                  )[0] ?? null;

                const reportIncidentId = String(
                  residentLatestIncidentCareEvent?.id ??
                    residentLatestIncidentCareEvent?.incidentId ??
                    residentLatestIncidentCareEvent?.eventId ??
                    ""
                ).trim();

                const reportRoom = String(
                  residentLatestIncidentCareEvent?.room ?? ""
                ).trim();

                const reportStage = String(
                  residentLatestIncidentCareEvent?.stage ?? ""
                )
                  .trim()
                  .toUpperCase();

                const reportAssignedStaff =
                  String(
                    residentLatestIncidentCareEvent?.assignedStaff ??
                      "James"
                  ).trim() || "James";

                const hasResolvedAiReport =
                  Boolean(reportIncidentId) &&
                  Boolean(residentRoom) &&
                  reportRoom === residentRoom &&
                  reportStage === "RESOLVED";

                const residentCareEvent = activeCareEvents
                .filter(
                  (event: any) =>
                    event.room === resident.room
                )
                .sort((a: any, b: any) => {
                  const getCreatedAtMillis = (event: any) => {
                    if (
                      typeof event.createdAt?.toMillis ===
                      "function"
                    ) {
                      return event.createdAt.toMillis();
                    }

                    if (
                      typeof event.createdAt?.seconds ===
                      "number"
                    ) {
                      return event.createdAt.seconds * 1000;
                    }

                    return 0;
                  };

                  return (
                    getCreatedAtMillis(b) -
                    getCreatedAtMillis(a)
                  );
                })[0];

              const realIncidentId = residentCareEvent?.id ?? "";

              const activeAssignedStaff =
                String(
                  residentCareEvent?.assignedStaff ?? "James"
                ).trim() || "James";

              const systems =
                resident.room === incidentRoom && isResolved
                  ? {
                      door: "NORMAL",
                      camera: "MONITORING",
                      lights: "NORMAL",
                      pa: "STANDBY",
                      alarm: "OFF",
                      elevator: "NORMAL",
                    }
                  : getBuildingSystems(resident);

            const stageKey =
              resident.room === incidentRoom
                ? (
                    resident.responseStatus === "PENDING"
                      ? "ALERT_CREATED"
                      : resident.responseStatus === "ACKNOWLEDGED"
                      ? "STAFF_ASSIGNED"
                      : resident.responseStatus === "EN_ROUTE"
                      ? "EN_ROUTE"
                      : resident.responseStatus === "AT_SCENE"
                      ? "AT_SCENE"
                      : resident.responseStatus === "ASSESSMENT"
                      ? "ASSESSMENT"
                      : resident.responseStatus === "AMBULANCE_REQUESTED"
                      ? "AMBULANCE_REQUESTED"
                      : resident.responseStatus === "TRANSPORT"
                      ? "TRANSPORT"
                      : resident.responseStatus === "RESOLVED"
                      ? "RESOLVED"
                      : "ALERT_CREATED"
                  )
                : resident.responseStatus === "PENDING"
                  ? "ALERT_CREATED"
                  : resident.responseStatus === "ACKNOWLEDGED"
                  ? "STAFF_ASSIGNED"
                  : resident.responseStatus === "IN_PROGRESS"
                  ? "EN_ROUTE"
                  : resident.responseStatus;

            const stage = stageDetails[stageKey];

            const isIncidentRoom =
              resident.room === incidentRoom;

            const displayStatus =
              isIncidentRoom && isResolved
                ? "SAFE"
                : resident.status;

            const displayColor =
              isIncidentRoom && isResolved
                ? "#22c55e"
                : resident.color;

            const showEmergencyDetails =
              isIncidentRoom && !isResolved;

            return (
              <Pressable
                key={resident.room}
                onPress={() => {
                  if (resident.status === "CRITICAL") {
                    router.push({
                      pathname: "/care-emergency",
                      params: {
                        residentId: String(resident.room)
                          .trim()
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "-")
                          .replace(/^-|-$/g, ""),
                        room: resident.room,
                      },
                    } as any);

                    return;
                  }

                  openResidentProfile(resident);
                }}
                style={{
                  backgroundColor: "#081826",
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 14,
                  borderWidth: 1,
                  borderColor: displayColor,
                }}
              >
                <Text style={{ color: "#fff", fontSize: 24, fontWeight: "900" }}>
                  {resident.room}
                </Text>

                <Text
                  style={{
                    color: displayColor,
                    fontSize: 20,
                    fontWeight: "800",
                    marginTop: 6,
                  }}
                >
                  {displayStatus === "CRITICAL"
                    ? "🔴 Critical"
                    : displayStatus === "ATTENTION"
                    ? "🟡 Needs Attention"
                    : "🟢 Safe"}
                </Text>

                {resident.responseStatus && (
                <Text
                  style={{
                    color: stage?.color ?? "#bfdbfe",
                    fontSize: 16,
                    marginTop: 6,
                    fontWeight: "800",
                  }}
                >
                  {stage?.icon} {stage?.title}
                </Text>
              )}

                {resident.staffResponding && (
                  <Text style={{ color: "#60a5fa", fontSize: 16, marginTop: 6 }}>
                    👩 Staff responding
                  </Text>
                )}

                {resident.createdAt && showEmergencyDetails && (
                  <Text
                    style={{
                      color: "#fbbf24",
                      fontSize: 16,
                      marginTop: 6,
                      fontWeight: "800",
                    }}
                  >
                    ⏱ Open for {incidentDuration(resident.createdAt)}
                  </Text>
                )}

                {!isResolved && getEscalationLevel(resident.createdAt, resident.responseStatus) && (
                  <Text
                    style={{
                      color: "#fb7185",
                      fontSize: 16,
                      marginTop: 6,
                      fontWeight: "800",
                    }}
                  >
                    {getEscalationLevel(resident.createdAt, resident.responseStatus)}
                  </Text>
                )}

            {getAIRecommendation(resident) && !isResolved && (
              <View
                style={{
                  backgroundColor: "#0f2d49",
                  borderRadius: 14,
                  padding: 12,
                  marginTop: 10,
                  borderWidth: 1,
                  borderColor: "#60a5fa",
                }}
              >
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>
                  🤖 AI Recommendation
                </Text>

                <Text style={{ color: "#93c5fd", fontSize: 14, marginTop: 6 }}>
                  Confidence: {getAIRecommendation(resident)?.confidence}
                </Text>

                <Text style={{ color: "#fff", fontSize: 15, marginTop: 6, fontWeight: "800" }}>
                  {getAIRecommendation(resident)?.title}
                </Text>

                <Text style={{ color: "#cfe2ff", fontSize: 14, marginTop: 6 }}>
                  {getAIRecommendation(resident)?.reason}
                </Text>
              </View>
            )}

            {displayStatus !== "SAFE" && !isResolved && (
              <ResponseProgress currentStage={stageKey} />
            )}

            {displayStatus !== "SAFE" && (
              <ResponseETA
                currentStage={stageKey}
                staffName={
                  resident.room === incidentRoom
                    ? String(incident?.assignedStaff ?? "James")
                    : resident.assignedStaff ?? "James"
                }
                room={resident.room}
              />
            )}

            {!isResolved &&
              displayStatus !== "SAFE" &&
              Boolean(realIncidentId) &&
              Boolean(residentCareEvent) && (
              <Pressable
                onPress={() => {
                  const activeReportStage = String(
                    residentCareEvent?.stage ?? incidentStage
                  )
                    .trim()
                    .toUpperCase();

                  console.log("COMMAND CENTER → ACTIVE AI REPORT:", {
                    incidentId: realIncidentId,
                    room: residentRoom,
                    stage: activeReportStage,
                    assignedStaff: activeAssignedStaff,
                  });

                  if (!realIncidentId || !residentRoom) {
                    console.warn("Active incident report details are incomplete.");
                    return;
                  }

                  router.push({
                    pathname: "/care-incident-report",
                    params: {
                      incidentId: realIncidentId,
                      room: residentRoom,
                      stage: activeReportStage,
                      assignedStaff: activeAssignedStaff,
                    },
                  } as any);
                }}
                style={{
                  backgroundColor: "#22c55e",
                  padding: 14,
                  borderRadius: 12,
                  marginTop: 14,
                }}
              >
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 16,
                    fontWeight: "900",
                    textAlign: "center",
                  }}
                >
                  📄 View Active AI Report
                </Text>
              </Pressable>
            )}

            {hasResolvedAiReport && (
              <Pressable
                onPress={() => {
                  console.log("COMMAND CENTER → RESOLVED AI REPORT:", {
                    incidentId: reportIncidentId,
                    room: reportRoom,
                    stage: reportStage,
                    assignedStaff: reportAssignedStaff,
                  });

                  if (!reportIncidentId || !reportRoom) {
                    console.warn("Resolved incident report details are incomplete.");
                    return;
                  }

                  router.push({
                    pathname: "/care-incident-report",
                    params: {
                      incidentId: reportIncidentId,
                      room: reportRoom,
                      stage: reportStage,
                      assignedStaff: reportAssignedStaff,
                    },
                  } as any);
                }}
                style={{
                  backgroundColor: "#22c55e",
                  padding: 14,
                  borderRadius: 12,
                  marginTop: 14,
                }}
              >
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 16,
                    fontWeight: "900",
                    textAlign: "center",
                  }}
                >
                  📄 View Resolved AI Report
                </Text>
              </Pressable>
            )}

           {!isResolved && (
              <View
                style={{
                  backgroundColor: "#081826",
                  borderRadius: 14,
                  padding: 12,
                  marginTop: 10,
                  borderWidth: 1,
                  borderColor: "#7c3aed",
                }}
              >
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>
                  ⚡ Suggested Actions
                </Text>

                <Pressable
                  onPress={() => router.push("/care-emergency" as any)}
                  style={{
                    backgroundColor: "#2563eb",
                    padding: 12,
                    borderRadius: 12,
                    marginTop: 10,
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800", textAlign: "center" }}>
                    👤 Open Response Center
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => router.push("/camera-live" as any)}
                  style={{
                    backgroundColor: "#0891b2",
                    padding: 12,
                    borderRadius: 12,
                    marginTop: 8,
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800", textAlign: "center" }}>
                    📹 Review Camera
                  </Text>
                </Pressable>

                {resident.status === "CRITICAL" && !isResolved && (
                  <Pressable
                    onPress={() => router.push("/care-emergency" as any)}
                    style={{
                      backgroundColor: "#dc2626",
                      padding: 12,
                      borderRadius: 12,
                      marginTop: 8,
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800", textAlign: "center" }}>
                      🚑 Emergency Actions
                    </Text>
                  </Pressable>
                )}
              </View>
            )}

            {(
              resident.status === "CRITICAL" ||
              (resident.room === incidentRoom && isResolved)
            ) && (
              <>
                <Text style={{ color: "#fff", marginTop: 6, fontWeight: "800" }}>
                    🚪 Door: {systems.door}
                </Text>

                <Text style={{ color: "#fff", marginTop: 6, fontWeight: "800" }}>
                    📹 Camera: {systems.camera}
                </Text>

                <Text style={{ color: "#fff", marginTop: 6, fontWeight: "800" }}>
                    💡 Corridor Lights: {systems.lights}
                </Text>

                <Text style={{ color: "#fff", marginTop: 6, fontWeight: "800" }}>
                    🔊 PA System: {systems.pa}
                </Text>

                <Text style={{ color: "#fff", marginTop: 6, fontWeight: "800" }}>
                    🚨 Alarm Zone: {systems.alarm}
                </Text>
              </>
            )}
              {!isResolved && (
                <Text
                  style={{
                    color: "#cfe2ff",
                    fontSize: 18,
                    marginTop: 12,
                  }}
                >
                  {resident.activity}
                </Text>
              )}
          </Pressable>
            );
          })}
        </View>

      <Pressable
        onPress={() => {
          const selectedTimelineCareEvent =
            allCareEvents.find(
              (event: any) =>
                String(event?.id ?? "").trim() ===
                String(currentCareEventId ?? "").trim()
            ) ??
            latestIncidentCareEvent ??
            currentCareEvent ??
            null;

          const timelineIncidentId = String(
            selectedTimelineCareEvent?.id ??
              currentCareEventId ??
              ""
          ).trim();

          const timelineRoom = String(
            selectedTimelineCareEvent?.room ?? ""
          ).trim();

          const timelineStage = String(
            selectedTimelineCareEvent?.stage ?? "RESOLVED"
          )
            .trim()
            .toUpperCase();

          console.log("TIMELINE NAVIGATION:", {
            eventId: timelineIncidentId || null,
            room: timelineRoom || null,
            stage: timelineStage,
          });

          if (!timelineIncidentId || !timelineRoom) {
            console.warn(
              "Timeline navigation blocked because the resolved care event is incomplete.",
              {
                currentCareEventId,
                timelineIncidentId,
                timelineRoom,
                selectedTimelineCareEvent,
              }
            );

            return;
          }

          setSelectedIncidentId(timelineIncidentId);

          router.push({
            pathname: "/care-incident-timeline",
            params: {
              incidentId: timelineIncidentId,
              room: timelineRoom,
              stage: timelineStage,
            },
          } as any);
        }}
        style={{
          backgroundColor: "#2563eb",
          padding: 18,
          borderRadius: 16,
          marginTop: 18,
        }}
      >
        <Text
          style={{
            color: "#fff",
            textAlign: "center",
            fontSize: 22,
            fontWeight: "800",
          }}
        >
          📜 Incident Timeline
        </Text>
      </Pressable>

      <Pressable
          onPress={() => router.push("/care-ai-monitoring" as any)}
          style={{
            backgroundColor: "#7c3aed",
            padding: 18,
            borderRadius: 16,
            marginTop: 18,
          }}
        >
          <Text
            style={{
              color: "#fff",
              textAlign: "center",
              fontSize: 22,
              fontWeight: "800",
            }}
          >
            🤖 AI Monitoring
          </Text>
      </Pressable>

      <View
        style={{
          marginTop: 24,
          backgroundColor: "#0d2942",
          borderRadius: 18,
          padding: 20,
          borderWidth: 1,
          borderColor: "#60a5fa",
        }}
      >
        <Text
          style={{
            color: "#ffffff",
            fontSize: 25,
            fontWeight: "900",
          }}
        >
          👤 Select Test Resident
        </Text>

        <Text
          style={{
            color: "#93c5fd",
            fontSize: 17,
            marginTop: 8,
            marginBottom: 14,
          }}
        >
          Choose the resident who should receive the simulated fall incident.
        </Text>

        {residentsLoading ? (
          <Text
            style={{
              color: "#fbbf24",
              fontSize: 18,
              fontWeight: "700",
            }}
          >
            Loading resident directory...
          </Text>
        ) : realResidents.length === 0 ? (
          <Text
            style={{
              color: "#94a3b8",
              fontSize: 18,
              lineHeight: 26,
              fontWeight: "700",
            }}
          >
            No residents are currently assigned to this care
            site.
          </Text>
        ) : (
          realResidents.map((resident) => {
            const isSelected =
              resident.id === selectedResidentId;

            return (
              <Pressable
                key={resident.id}
                onPress={() =>
                  setSelectedResidentId(resident.id)
                }
                style={{
                  marginTop: 10,
                  backgroundColor: isSelected
                    ? "#14532d"
                    : "#081826",
                  borderRadius: 14,
                  padding: 16,
                  borderWidth: 2,
                  borderColor: isSelected
                    ? "#22c55e"
                    : "#334155",
                }}
              >
                <Text
                  style={{
                    color: "#ffffff",
                    fontSize: 19,
                    fontWeight: "900",
                  }}
                >
                  {isSelected ? "✅ " : "○ "}
                  {resident.fullName}
                </Text>

                <Text
                  style={{
                    color: "#93c5fd",
                    fontSize: 16,
                    marginTop: 5,
                  }}
                >
                  {resident.room}
                </Text>
              </Pressable>
            );
          })
        )}
      </View>

      <Pressable
        onPress={triggerTestFallEvent}
        disabled={
          residentsLoading || !selectedResident
        }
        style={{
          backgroundColor:
            residentsLoading || !selectedResident
              ? "#7f1d1d"
              : "#ef4444",
          opacity:
            residentsLoading || !selectedResident
              ? 0.55
              : 1,
          padding: 18,
          borderRadius: 16,
          marginTop: 16,
        }}
      >
        <Text
          style={{
            color: "#ffffff",
            fontSize: 22,
            fontWeight: "900",
            textAlign: "center",
          }}
        >
          {residentsLoading
            ? "Loading Residents..."
            : realResidents.length === 0
              ? "No Residents Available"
              : "🧪 Simulate Resident Fall"}
        </Text>
      </Pressable>

      <Pressable
        onPress={() =>
          router.push("/care-residents" as any)
        }
        style={{
          backgroundColor: "#7c3aed",
          padding: 18,
          borderRadius: 16,
          marginTop: 16,
        }}
      >
        <Text
          style={{
            color: "#fff",
            textAlign: "center",
            fontSize: 22,
            fontWeight: "900",
          }}
        >
          👥 Residents Directory
        </Text>
      </Pressable>

      <Pressable
        onPress={() => router.push("/care-incident-archive")}
        style={{
          backgroundColor: "#0f766e",
          padding: 18,
          borderRadius: 16,
          marginTop: 18,
        }}
      >
        <Text
          style={{
            color: "#fff",
            textAlign: "center",
            fontWeight: "900",
            fontSize: 22,
          }}
        >
          🗄️ Incident Archive
        </Text>
      </Pressable>

      <Pressable
        onPress={() => router.back()}
        style={{
          backgroundColor: "#2563eb",
          padding: 18,
          borderRadius: 16,
          marginTop: 24,
        }}
      >
        <Text style={{ color: "#fff", textAlign: "center", fontSize: 22, fontWeight: "800" }}>
          ← Back
        </Text>
      </Pressable>
    </ScrollView>
  );
}
































  