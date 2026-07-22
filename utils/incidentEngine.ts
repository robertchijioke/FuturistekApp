  export const incidentStages = [
    "ALERT_CREATED",
    "STAFF_ASSIGNED",
    "EN_ROUTE",
    "AT_SCENE",
    "ASSESSMENT",
    "AMBULANCE_REQUESTED",
    "TRANSPORT",
    "RESOLVED",
  ] as const;

  export type IncidentStage = typeof incidentStages[number];

  export interface IncidentState {
    room: string;
    stage: IncidentStage;
    assignedStaff: string;
    etaMinutes: number;
    progress: number;
    ambulanceRequested: boolean;
    resolved: boolean;
  }

  export const createIncident = (
    room: string,
    assignedStaff = "James"
  ): IncidentState => ({
    room,
    stage: "ALERT_CREATED",
    assignedStaff,
    etaMinutes: 3,
    progress: 5,
    ambulanceRequested: false,
    resolved: false,
  });

  export function nextIncidentStage(
    incident: IncidentState
  ): IncidentState {

    const index = incidentStages.indexOf(incident.stage);

    if (index === incidentStages.length - 1) {
      return incident;
    }

    const nextStage = incidentStages[index + 1];

    return {
      ...incident,
      stage: nextStage,
      progress: Math.min(100, incident.progress + 15),
      etaMinutes: Math.max(0, incident.etaMinutes - 1),
      ambulanceRequested:
        nextStage === "AMBULANCE_REQUESTED"
          ? true
          : incident.ambulanceRequested,
      resolved: nextStage === "RESOLVED",
    };
  }

  export function resetIncident(
    room: string,
    assignedStaff = "James"
  ) {
    return createIncident(room, assignedStaff);
  }