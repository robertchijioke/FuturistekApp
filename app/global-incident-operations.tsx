import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp, writeBatch,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { auth, db } from "../lib/firebase";


type CareSite = {
  id: string;
  name: string;
  location: string;
};

type GlobalIncident = {
  id: string;
  siteId: string;
  room: string;
  residentId: string;
  residentName: string;
  type: string;
  severity: string;
  stage: string;
  status: string;
  assignedStaff: string;
  createdAt?: any;
  enterpriseEscalationAcknowledged: boolean;
  enterpriseEscalationAcknowledgedAt?: any;
  enterpriseEscalationAcknowledgedBy: string;
};

type EnterpriseEscalationAudit = {
  id: string;
  action: string;
  incidentId: string;
  siteId: string;
  siteName: string;
  siteLocation: string;
  room: string;
  residentId: string;
  residentName: string;
  severity: string;
  stage: string;
  acknowledgedBy: string;
  acknowledgedAt?: any;
  slaState: SlaState;
  elapsedMilliseconds: number;
  targetMinutes: number;
  responseProgress: number;
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

const formatStageLabel = (stage: string) =>
  stage
    .toLowerCase()
    .split("_")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ");

const getStageProgress = (stage: string) => {
  const stageIndex = responseStages.indexOf(
    stage.toUpperCase()
  );

  if (stageIndex < 0) {
    return 0;
  }

  return Math.round(
    ((stageIndex + 1) / responseStages.length) * 100
  );
};

const severityPriority: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

const getSeverityPriority = (severity: string) =>
  severityPriority[severity.toUpperCase()] ?? 0;

const getStagePriority = (stage: string) => {
  const index = responseStages.indexOf(stage.toUpperCase());

  return index >= 0 ? index : responseStages.length;
};

type SlaState =
  | "ON_TRACK"
  | "AT_RISK"
  | "BREACHED"
  | "UNKNOWN";

const slaTargetsMinutes: Record<string, number> = {
  CRITICAL: 5,
  HIGH: 10,
  MEDIUM: 20,
  LOW: 30,
};

const formatElapsedDuration = (milliseconds: number) => {
  const totalSeconds = Math.max(
    0,
    Math.floor(milliseconds / 1000)
  );

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(
    (totalSeconds % 3600) / 60
  );
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(
      2,
      "0"
    )}m ${String(seconds).padStart(2, "0")}s`;
  }

  return `${minutes}m ${String(seconds).padStart(
    2,
    "0"
  )}s`;
};

const getSlaDetails = (
  createdAt: any,
  severity: string,
  currentTime: number
) => {
  const createdTimestamp = getTimestamp(createdAt);

  const targetMinutes =
    slaTargetsMinutes[severity.toUpperCase()] ?? 20;

  const targetMilliseconds =
    targetMinutes * 60 * 1000;

  if (!createdTimestamp) {
    return {
      state: "UNKNOWN" as SlaState,
      elapsedMilliseconds: 0,
      remainingMilliseconds: 0,
      targetMinutes,
    };
  }

  const elapsedMilliseconds = Math.max(
    0,
    currentTime - createdTimestamp
  );

  const remainingMilliseconds =
    targetMilliseconds - elapsedMilliseconds;

  let state: SlaState = "ON_TRACK";

  if (remainingMilliseconds <= 0) {
    state = "BREACHED";
  } else if (
    remainingMilliseconds <=
    Math.min(
      5 * 60 * 1000,
      targetMilliseconds * 0.25
    )
  ) {
    state = "AT_RISK";
  }

  return {
    state,
    elapsedMilliseconds,
    remainingMilliseconds,
    targetMinutes,
  };
};

const slaPriority: Record<SlaState, number> = {
  BREACHED: 4,
  AT_RISK: 3,
  ON_TRACK: 2,
  UNKNOWN: 1,
};

const getSlaPriority = (state: SlaState) =>
  slaPriority[state] ?? 0;

const getTimestamp = (value: any): number => {
  if (typeof value?.toMillis === "function") {
    return value.toMillis();
  }

  if (typeof value?.toDate === "function") {
    return value.toDate().getTime();
  }

  const parsedDate = value ? new Date(value) : null;

  return parsedDate && !Number.isNaN(parsedDate.getTime())
    ? parsedDate.getTime()
    : 0;
};

const formatTimestamp = (value: any): string => {
  const timestamp = getTimestamp(value);

  if (!timestamp) {
    return "Time unavailable";
  }

  return new Date(timestamp).toLocaleString();
};

type GlobalOperationsAccess =
  | "checking"
  | "allowed"
  | "denied";

export default function GlobalIncidentOperations() {
  const router = useRouter();

  const [accessState, setAccessState] =
    useState<GlobalOperationsAccess>("checking");

  const [careSites, setCareSites] =
    useState<Record<string, CareSite>>({});

  const [allIncidents, setAllIncidents] =
    useState<GlobalIncident[]>([]);

  const [currentTime, setCurrentTime] = useState(
    Date.now()
  );

  const [
    escalationAudit,
    setEscalationAudit,
  ] = useState<EnterpriseEscalationAudit[]>([]);

  const [
    acknowledgingIncidentId,
    setAcknowledgingIncidentId,
  ] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null =
      null;

    const unsubscribeAuth = onAuthStateChanged(
      auth,
      (user) => {
        unsubscribeProfile?.();
        unsubscribeProfile = null;

        if (!user) {
          setAccessState("denied");
          return;
        }

        setAccessState("checking");

        unsubscribeProfile = onSnapshot(
          doc(
            db,
            "userAccessProfiles",
            user.uid
          ),
          (snapshot) => {
            if (!snapshot.exists()) {
              console.warn(
                "GLOBAL OPERATIONS ACCESS PROFILE MISSING:",
                {
                  uid: user.uid,
                }
              );

              setAccessState("denied");
              return;
            }

            const data = snapshot.data();

            const role = String(data.role ?? "")
              .trim()
              .toUpperCase();

            const isEnterpriseAdmin =
              data.enabled === true &&
              role === "ENTERPRISE_ADMIN";

            console.log(
              "GLOBAL OPERATIONS ACCESS CHECK:",
              {
                enabled: data.enabled === true,
                role,
                allowed: isEnterpriseAdmin,
              }
            );

            setAccessState(
              isEnterpriseAdmin
                ? "allowed"
                : "denied"
            );
          },
          (error) => {
            console.error(
              "GLOBAL OPERATIONS ACCESS PROFILE ERROR:",
              error
            );

            setAccessState("denied");
          }
        );
      }
    );

    return () => {
      unsubscribeProfile?.();
      unsubscribeAuth();
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (accessState !== "allowed") {
      setCareSites({});
      return;
    }

    const unsubscribeSites = onSnapshot(
      collection(db, "careSites"),
      (snapshot) => {
        const enabledSites: Record<string, CareSite> = {};

        snapshot.docs.forEach((document) => {
          const data = document.data();

          if (data.enabled === false) {
            return;
          }

          enabledSites[document.id] = {
            id: document.id,
            name:
              String(data.name ?? "Unnamed Care Site").trim() ||
              "Unnamed Care Site",
            location:
              String(data.location ?? "Unknown location").trim() ||
              "Unknown location",
          };
        });

        setCareSites(enabledSites);

        console.log("GLOBAL OPERATIONS CARE SITES:", {
          count: Object.keys(enabledSites).length,
          sites: Object.values(enabledSites),
        });
      },
      (error) => {
        console.error(
          "GLOBAL OPERATIONS CARE SITES ERROR:",
          error
        );
      }
    );

    return unsubscribeSites;
  }, [accessState]);

  useEffect(() => {
    if (accessState !== "allowed") {
      setAllIncidents([]);
      return;
    }

    const unsubscribeIncidents = onSnapshot(
      collection(db, "careEvents"),
      (snapshot) => {
        const loadedIncidents: GlobalIncident[] =
          snapshot.docs.map((document) => {
            const data = document.data();

            return {
              id: document.id,

              siteId:
                String(data.siteId ?? "site-1").trim() ||
                "site-1",

              room:
                String(data.room ?? "Unknown room").trim() ||
                "Unknown room",

              residentId:
                String(data.residentId ?? "").trim(),

              residentName:
                String(
                  data.residentName ?? "Unknown resident"
                ).trim() || "Unknown resident",

              type:
                String(data.type ?? "Incident").trim() ||
                "Incident",

              severity:
                String(data.severity ?? "HIGH")
                  .trim()
                  .toUpperCase(),

              stage:
                String(data.stage ?? "ALERT_CREATED")
                  .trim()
                  .toUpperCase(),

              status:
                String(data.status ?? "")
                  .trim()
                  .toLowerCase(),

              assignedStaff:
                String(
                  data.assignedStaff ??
                    "Awaiting assignment"
                ).trim() || "Awaiting assignment",

              createdAt: data.createdAt,

              enterpriseEscalationAcknowledged:
              data.enterpriseEscalationAcknowledged === true,

              enterpriseEscalationAcknowledgedAt:
                data.enterpriseEscalationAcknowledgedAt,

              enterpriseEscalationAcknowledgedBy:
                String(
                  data.enterpriseEscalationAcknowledgedBy ?? ""
                ).trim(),
            };
          });

        setAllIncidents(loadedIncidents);

        console.log("GLOBAL OPERATIONS INCIDENTS LOADED:", {
          count: loadedIncidents.length,
        });
      },
      (error) => {
        console.error(
          "GLOBAL OPERATIONS INCIDENTS ERROR:",
          error
        );
      }
    );

    return unsubscribeIncidents;
  }, [accessState]);

  useEffect(() => {
    if (accessState !== "allowed") {
      setEscalationAudit([]);
      return;
    }

    const unsubscribeAudit = onSnapshot(
      collection(db, "enterpriseEscalationAudit"),
      (snapshot) => {
        const loadedAuditEvents =
          snapshot.docs
            .map((document) => {
              const data = document.data();

              return {
                id: document.id,

                action: String(
                  data.action ??
                    "ENTERPRISE_ESCALATION_ACKNOWLEDGED"
                ),

                incidentId: String(
                  data.incidentId ?? ""
                ),

                siteId: String(
                  data.siteId ?? "site-1"
                ),

                siteName: String(
                  data.siteName ?? "Unknown site"
                ),

                siteLocation: String(
                  data.siteLocation ??
                    "Unknown location"
                ),

                room: String(
                  data.room ?? "Unknown room"
                ),

                residentId: String(
                  data.residentId ?? ""
                ),

                residentName: String(
                  data.residentName ??
                    "Unknown resident"
                ),

                severity: String(
                  data.severity ?? "HIGH"
                ).toUpperCase(),

                stage: String(
                  data.stage ?? "ALERT_CREATED"
                ).toUpperCase(),

                acknowledgedBy: String(
                  data.acknowledgedBy ??
                    "Global Operations"
                ),

                acknowledgedAt:
                  data.acknowledgedAt ??
                  data.createdAt,

                slaState:
                  String(
                    data.slaState ?? "UNKNOWN"
                  ) as SlaState,

                elapsedMilliseconds: Number(
                  data.elapsedMilliseconds ?? 0
                ),

                targetMinutes: Number(
                  data.targetMinutes ?? 0
                ),

                responseProgress: Number(
                  data.responseProgress ?? 0
                ),
              };
            })
            .sort(
              (firstEvent, secondEvent) =>
                getTimestamp(
                  secondEvent.acknowledgedAt
                ) -
                getTimestamp(
                  firstEvent.acknowledgedAt
                )
            );

        setEscalationAudit(loadedAuditEvents);

        console.log(
          "GLOBAL ESCALATION AUDIT LOADED:",
          {
            count: loadedAuditEvents.length,
          }
        );
      },
      (error) => {
        console.error(
          "GLOBAL ESCALATION AUDIT ERROR:",
          error
        );
      }
    );

    return unsubscribeAudit;
  }, [accessState]);

  const activeIncidents = useMemo(
    () =>
      allIncidents
        .filter(
          (incident) =>
            incident.status === "active" &&
            Boolean(careSites[incident.siteId])
        )
        .sort((firstIncident, secondIncident) => {
          const firstSla = getSlaDetails(
            firstIncident.createdAt,
            firstIncident.severity,
            currentTime
          );

          const secondSla = getSlaDetails(
            secondIncident.createdAt,
            secondIncident.severity,
            currentTime
          );

          const slaDifference =
            getSlaPriority(secondSla.state) -
            getSlaPriority(firstSla.state);

          if (slaDifference !== 0) {
            return slaDifference;
          }

          const severityDifference =
            getSeverityPriority(secondIncident.severity) -
            getSeverityPriority(firstIncident.severity);

          if (severityDifference !== 0) {
            return severityDifference;
          }

          const firstAwaitingAssignment =
            !firstIncident.assignedStaff ||
            firstIncident.assignedStaff ===
              "Awaiting assignment";

          const secondAwaitingAssignment =
            !secondIncident.assignedStaff ||
            secondIncident.assignedStaff ===
              "Awaiting assignment";

          if (
            firstAwaitingAssignment !==
            secondAwaitingAssignment
          ) {
            return firstAwaitingAssignment ? -1 : 1;
          }

          const stageDifference =
            getStagePriority(firstIncident.stage) -
            getStagePriority(secondIncident.stage);

          if (stageDifference !== 0) {
            return stageDifference;
          }

          return (
            getTimestamp(secondIncident.createdAt) -
            getTimestamp(firstIncident.createdAt)
          );
        }),
    [allIncidents, careSites, currentTime]
  );

  const affectedSiteCount = useMemo(
    () =>
      new Set(
        activeIncidents.map(
          (incident) => incident.siteId
        )
      ).size,
    [activeIncidents]
  );

  const urgentIncidentCount = useMemo(
  () =>
    activeIncidents.filter((incident) =>
      ["CRITICAL", "HIGH"].includes(
        incident.severity.toUpperCase()
      )
    ).length,
  [activeIncidents]
);

const awaitingAssignmentCount = useMemo(
  () =>
    activeIncidents.filter(
      (incident) =>
        !incident.assignedStaff ||
        incident.assignedStaff ===
          "Awaiting assignment"
    ).length,
  [activeIncidents]
);

const breachedIncidentCount = useMemo(
  () =>
    activeIncidents.filter((incident) => {
      const sla = getSlaDetails(
        incident.createdAt,
        incident.severity,
        currentTime
      );

      return sla.state === "BREACHED";
    }).length,
  [activeIncidents, currentTime]
);

const visibleAuditEvents = useMemo(
  () =>
    escalationAudit
      .filter((event) =>
        Boolean(careSites[event.siteId])
      )
      .slice(0, 10),
  [escalationAudit, careSites]
);

const acknowledgeEnterpriseEscalation = async (
  incident: GlobalIncident
) => {
  if (
    incident.enterpriseEscalationAcknowledged ||
    acknowledgingIncidentId === incident.id
  ) {
    return;
  }

  try {
    setAcknowledgingIncidentId(incident.id);

    const site = careSites[incident.siteId];

    const sla = getSlaDetails(
      incident.createdAt,
      incident.severity,
      Date.now()
    );

    const batch = writeBatch(db);

    const incidentReference = doc(
      db,
      "careEvents",
      incident.id
    );

    const auditReference = doc(
      collection(
        db,
        "enterpriseEscalationAudit"
      )
    );

    const acknowledgedAt = serverTimestamp();

    batch.update(incidentReference, {
      enterpriseEscalationAcknowledged: true,
      enterpriseEscalationAcknowledgedAt:
        acknowledgedAt,
      enterpriseEscalationAcknowledgedBy:
        "Global Operations",
    });

    batch.set(auditReference, {
      action:
        "ENTERPRISE_ESCALATION_ACKNOWLEDGED",

      incidentId: incident.id,
      siteId: incident.siteId,

      siteName:
        site?.name ?? "Unknown site",

      siteLocation:
        site?.location ?? "Unknown location",

      room: incident.room,
      residentId: incident.residentId,
      residentName: incident.residentName,
      severity: incident.severity,
      stage: incident.stage,

      acknowledgedBy: "Global Operations",
      acknowledgedAt,

      slaState: sla.state,

      elapsedMilliseconds:
        sla.elapsedMilliseconds,

      targetMinutes: sla.targetMinutes,

      responseProgress:
        getStageProgress(incident.stage),

      createdAt: acknowledgedAt,
      source: "GLOBAL_INCIDENT_OPERATIONS",
    });

    await batch.commit();

    Alert.alert(
      "Escalation acknowledged",
      "Global Operations has acknowledged this escalation. A permanent audit event has been recorded, and the clinical response stage has not been changed."
    );
  } catch (error) {
    console.error(
      "GLOBAL ESCALATION ACKNOWLEDGEMENT ERROR:",
      error
    );

    Alert.alert(
      "Acknowledgement failed",
      "The escalation could not be acknowledged. Check the connection and try again."
    );
  } finally {
    setAcknowledgingIncidentId(null);
  }
};

  const openSiteCommandCentre = (
    incident: GlobalIncident
  ) => {
    const site = careSites[incident.siteId];

    if (!site) {
      return;
    }

    router.push({
      pathname: "/care-command-center",
      params: {
        siteId: site.id,
        siteName: site.name,
        siteLocation: site.location,
      },
    } as any);
  };

  if (accessState === "checking") {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#061826",
          alignItems: "center",
          justifyContent: "center",
          padding: 28,
        }}
      >
        <Text
          style={{
            color: "#ffffff",
            fontSize: 26,
            fontWeight: "900",
            textAlign: "center",
          }}
        >
          Verifying Enterprise Admin access...
        </Text>

        <Text
          style={{
            color: "#93c5fd",
            fontSize: 17,
            lineHeight: 25,
            textAlign: "center",
            marginTop: 14,
          }}
        >
          Global operational data will load after your
          access profile is confirmed.
        </Text>
      </View>
    );
  }

  if (accessState === "denied") {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#061826",
          alignItems: "center",
          justifyContent: "center",
          padding: 28,
        }}
      >
        <Text
          style={{
            color: "#f87171",
            fontSize: 31,
            fontWeight: "900",
            textAlign: "center",
          }}
        >
          🔒 Access Restricted
        </Text>

        <Text
          style={{
            color: "#cbd5e1",
            fontSize: 18,
            lineHeight: 28,
            textAlign: "center",
            marginTop: 18,
          }}
        >
          Global Incident Operations is available only
          to enabled Enterprise Admin accounts.
        </Text>

        <Pressable
          onPress={() =>
            router.replace(
              "/mission-control" as any
            )
          }
          style={{
            backgroundColor: "#2563eb",
            borderRadius: 16,
            paddingHorizontal: 24,
            paddingVertical: 16,
            marginTop: 28,
          }}
        >
          <Text
            style={{
              color: "#ffffff",
              fontSize: 18,
              fontWeight: "900",
            }}
          >
            ← Return to Mission Control
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Pressable
        onPress={() =>
          router.replace("/mission-control" as any)
        }
        style={styles.backButton}
      >
        <Text style={styles.backButtonText}>
          ← Mission Control
        </Text>
      </Pressable>

      <Text style={styles.title}>
        🚨 Global Incident Operations
      </Text>

      <Text style={styles.subtitle}>
        Live cross-site emergency monitoring and dispatch
      </Text>

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>
            {Object.keys(careSites).length}
          </Text>
          <Text style={styles.summaryLabel}>
            Enabled Sites
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <Text
            style={[
              styles.summaryValue,
              activeIncidents.length > 0 &&
                styles.warningText,
            ]}
          >
            {activeIncidents.length}
          </Text>
          <Text style={styles.summaryLabel}>
            Active Incidents
          </Text>
        </View>

        <View style={styles.summaryCardWide}>
          <Text style={styles.summaryValue}>
            {affectedSiteCount}
          </Text>
          <Text style={styles.summaryLabel}>
            Sites Requiring Attention
          </Text>
        </View>
      </View>

      {urgentIncidentCount > 0 && (
        <View style={styles.urgentBanner}>
          <Text style={styles.urgentBannerTitle}>
            🚨 Urgent Response Required
          </Text>

          <Text style={styles.urgentBannerText}>
            {urgentIncidentCount} high-priority{" "}
            {urgentIncidentCount === 1
              ? "incident requires"
              : "incidents require"}{" "}
            immediate coordination.
          </Text>

          {awaitingAssignmentCount > 0 && (
            <Text style={styles.assignmentWarning}>
              ⚠️ {awaitingAssignmentCount}{" "}
              {awaitingAssignmentCount === 1
                ? "incident is"
                : "incidents are"}{" "}
              awaiting staff assignment.
            </Text>
          )}

          {breachedIncidentCount > 0 && (
            <Text style={styles.slaEscalationWarning}>
              ⏱️ {breachedIncidentCount}{" "}
              {breachedIncidentCount === 1
                ? "incident has"
                : "incidents have"}{" "}
              exceeded the configured response target.
            </Text>
          )}
        </View>
      )}

      <View style={styles.aiCard}>
        <Text style={styles.sectionTitle}>
          🤖 AI Operations Summary
        </Text>

        <Text style={styles.aiText}>
          {activeIncidents.length > 0
            ? `${activeIncidents.length} active ${
                activeIncidents.length === 1
                  ? "incident is"
                  : "incidents are"
              } currently being managed across ${affectedSiteCount} ${
                affectedSiteCount === 1
                  ? "site"
                  : "sites"
              }.`
            : "All enabled care sites are operational. No active emergency incidents currently require cross-site coordination."}
        </Text>

        <Text style={styles.liveText}>
          ● Global monitoring live
        </Text>
      </View>

      <Text style={styles.sectionHeading}>
        🚑 Live Incident Queue
      </Text>

      {activeIncidents.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>
            ✅ No active global incidents
          </Text>

          <Text style={styles.emptyText}>
            All enabled care sites are currently operating
            without an active emergency response.
          </Text>
        </View>
      ) : (
        activeIncidents.map((incident) => {
          const site = careSites[incident.siteId];

          const sla = getSlaDetails(
            incident.createdAt,
            incident.severity,
            currentTime
          );

          return (
            <View
              key={incident.id}
              style={styles.incidentCard}
            >
              <View style={styles.incidentHeader}>
                <View style={styles.incidentHeaderText}>
                  <Text style={styles.siteName}>
                    {site?.name ?? "Unknown site"}
                  </Text>

                  <Text style={styles.location}>
                    📍 {site?.location ?? "Unknown location"}
                  </Text>
                </View>

                <Text style={styles.activeBadge}>
                  ● ACTIVE
                </Text>
              </View>

              <Text style={styles.incidentTitle}>
                {incident.type}
              </Text>

              <View style={styles.severityRow}>
                <Text
                  style={[
                    styles.severityBadge,
                    incident.severity === "CRITICAL"
                      ? styles.criticalSeverity
                      : incident.severity === "HIGH"
                        ? styles.highSeverity
                        : styles.standardSeverity,
                  ]}
                >
                  {incident.severity}
                </Text>

                <View style={styles.priorityInfo}>
                  <Text style={styles.priorityText}>
                    Priority #{activeIncidents.indexOf(incident) + 1}
                  </Text>

                  <Text
                    style={[
                      styles.priorityReason,
                      sla.state === "BREACHED"
                        ? styles.priorityReasonBreached
                        : sla.state === "AT_RISK"
                          ? styles.priorityReasonAtRisk
                          : styles.priorityReasonStandard,
                    ]}
                  >
                    {sla.state === "BREACHED"
                      ? "SLA breached"
                      : sla.state === "AT_RISK"
                        ? "SLA at risk"
                        : sla.state === "ON_TRACK"
                          ? "On track"
                          : "Time unknown"}
                  </Text>
                </View>
              </View>

              <Text style={styles.detailText}>
                🏠 Room: {incident.room}
              </Text>

              <Text style={styles.detailText}>
                👤 Resident: {incident.residentName}
              </Text>

              <View style={styles.progressSection}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>
                    Response Progress
                  </Text>

                  <Text style={styles.progressPercentage}>
                    {getStageProgress(incident.stage)}%
                  </Text>
                </View>

                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${getStageProgress(
                          incident.stage
                        )}%`,
                      },
                    ]}
                  />
                </View>

                <View
                  style={[
                    styles.slaPanel,
                    sla.state === "BREACHED"
                      ? styles.slaPanelBreached
                      : sla.state === "AT_RISK"
                        ? styles.slaPanelAtRisk
                        : sla.state === "ON_TRACK"
                          ? styles.slaPanelOnTrack
                          : styles.slaPanelUnknown,
                  ]}
                >
                  <View style={styles.slaHeader}>
                    <Text style={styles.slaTitle}>
                      ⏱ Response Clock
                    </Text>

                    <Text style={styles.slaTimer}>
                      {formatElapsedDuration(
                        sla.elapsedMilliseconds
                      )}
                    </Text>

                  </View>

                  <Text
                    style={[
                      styles.slaStatus,
                      sla.state === "BREACHED"
                        ? styles.slaStatusBreached
                        : sla.state === "AT_RISK"
                          ? styles.slaStatusAtRisk
                          : sla.state === "ON_TRACK"
                            ? styles.slaStatusOnTrack
                            : styles.slaStatusUnknown,
                    ]}
                  >
                    {sla.state === "BREACHED"
                      ? `Escalation required • exceeded by ${formatElapsedDuration(
                          Math.abs(sla.remainingMilliseconds)
                        )}`
                      : sla.state === "AT_RISK"
                        ? `At risk • ${formatElapsedDuration(
                            sla.remainingMilliseconds
                          )} remaining`
                        : sla.state === "ON_TRACK"
                          ? `On track • ${formatElapsedDuration(
                              sla.remainingMilliseconds
                            )} remaining`
                          : "Incident start time unavailable"}
                  </Text>

                  <Text style={styles.slaTarget}>
                    Configured target: {sla.targetMinutes} minutes
                    for {` ${incident.severity}`} incidents
                  </Text>
                </View>

                <Text style={styles.stageText}>
                  📊 {formatStageLabel(incident.stage)}
                </Text>
              </View>

              <Text style={styles.detailText}>
                🧑‍⚕️ Staff: {incident.assignedStaff}
              </Text>

              <Text style={styles.detailText}>
                🕒 {formatTimestamp(incident.createdAt)}
              </Text>

              {["BREACHED", "AT_RISK"].includes(
                sla.state
              ) &&
                (incident.enterpriseEscalationAcknowledged ? (
                  <View style={styles.acknowledgedPanel}>
                    <Text style={styles.acknowledgedTitle}>
                      ✅ Enterprise escalation acknowledged
                    </Text>

                    <Text style={styles.acknowledgedText}>
                      Acknowledged by{" "}
                      {incident.enterpriseEscalationAcknowledgedBy ||
                        "Global Operations"}
                    </Text>

                    <Text style={styles.acknowledgedTime}>
                      {incident.enterpriseEscalationAcknowledgedAt
                        ? formatTimestamp(
                            incident.enterpriseEscalationAcknowledgedAt
                          )
                        : "Acknowledgement recorded"}
                    </Text>
                  </View>
                ) : (
                  <Pressable
                    disabled={
                      acknowledgingIncidentId === incident.id
                    }
                    onPress={() =>
                      acknowledgeEnterpriseEscalation(incident)
                    }
                    style={[
                      styles.acknowledgeButton,
                      acknowledgingIncidentId === incident.id &&
                        styles.acknowledgeButtonDisabled,
                    ]}
                  >
                    <Text style={styles.acknowledgeButtonText}>
                      {acknowledgingIncidentId === incident.id
                        ? "Acknowledging…"
                        : "✓ Acknowledge Enterprise Escalation"}
                    </Text>
                  </Pressable>
                ))}

              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/care-command-center",
                    params: {
                      siteId: site.id,
                      siteName: site.name,
                      siteLocation: site.location,
                      focusIncidentId: incident.id,
                      focusResidentId: incident.residentId,
                      focusRoom: incident.room,
                    },
                  } as any)
                }
                style={styles.openButton}
              >
                <Text style={styles.openButtonText}>
                   Open Site Command Centre →
                </Text>
              </Pressable>
            </View>
          );
        })
      )}

      <Text style={styles.sectionHeading}>
        🧾 Enterprise Escalation Audit
      </Text>

      {visibleAuditEvents.length === 0 ? (
        <View style={styles.auditEmptyCard}>
          <Text style={styles.auditEmptyTitle}>
            No audit events recorded
          </Text>

          <Text style={styles.auditEmptyText}>
            Enterprise escalation acknowledgements
            will appear here permanently.
          </Text>
        </View>
      ) : (
        visibleAuditEvents.map((event) => (
          <View
            key={event.id}
            style={styles.auditCard}
          >
            <View style={styles.auditHeader}>
              <Text style={styles.auditSiteName}>
                {event.siteName}
              </Text>

              <Text style={styles.auditBadge}>
                ACKNOWLEDGED
              </Text>
            </View>

            <Text style={styles.auditLocation}>
              📍 {event.siteLocation}
            </Text>

            <Text style={styles.auditIncident}>
              🚨 {event.severity} • {event.room}
            </Text>

            <Text style={styles.auditDetail}>
              👤 {event.residentName}
            </Text>

            <Text style={styles.auditDetail}>
              📊 Stage at acknowledgement:{" "}
              {formatStageLabel(event.stage)}
            </Text>

            <Text style={styles.auditDetail}>
              ⏱ SLA state:{" "}
              {event.slaState.replace("_", " ")}
            </Text>

            <Text style={styles.auditDetail}>
              📈 Response progress:{" "}
              {event.responseProgress}%
            </Text>

            <Text style={styles.auditDetail}>
              ✅ Acknowledged by{" "}
              {event.acknowledgedBy}
            </Text>

            <Text style={styles.auditTime}>
              {formatTimestamp(
                event.acknowledgedAt
              )}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#061826",
  },

  content: {
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 80,
  },

  backButton: {
    alignSelf: "flex-start",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
    marginBottom: 24,
  },

  backButtonText: {
    color: "#cbd5e1",
    fontSize: 16,
    fontWeight: "800",
  },

  title: {
    color: "#ffffff",
    fontSize: 43,
    fontWeight: "900",
    lineHeight: 50,
  },

  subtitle: {
    color: "#93c5fd",
    fontSize: 20,
    lineHeight: 29,
    marginTop: 13,
    marginBottom: 28,
  },

  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  summaryCard: {
    width: "48%",
    backgroundColor: "#143453",
    borderColor: "#2563eb",
    borderWidth: 1,
    borderRadius: 20,
    padding: 22,
    marginBottom: 14,
  },

  summaryCardWide: {
    width: "100%",
    backgroundColor: "#143453",
    borderColor: "#2563eb",
    borderWidth: 1,
    borderRadius: 20,
    padding: 22,
  },

  summaryValue: {
    color: "#ffffff",
    fontSize: 42,
    fontWeight: "900",
  },

  warningText: {
    color: "#fbbf24",
  },

  summaryLabel: {
    color: "#cbd5e1",
    fontSize: 17,
    marginTop: 8,
  },

  aiCard: {
    borderColor: "#7c3aed",
    borderWidth: 1,
    borderRadius: 22,
    padding: 24,
    marginTop: 26,
  },

  sectionTitle: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "900",
  },

  aiText: {
    color: "#cbd5e1",
    fontSize: 18,
    lineHeight: 28,
    marginTop: 17,
  },

  liveText: {
    color: "#22c55e",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 20,
  },

  sectionHeading: {
    color: "#ffffff",
    fontSize: 31,
    fontWeight: "900",
    marginTop: 34,
    marginBottom: 18,
  },

  emptyCard: {
    borderColor: "#22c55e",
    borderWidth: 1,
    borderRadius: 22,
    padding: 25,
  },

  emptyTitle: {
    color: "#22c55e",
    fontSize: 25,
    fontWeight: "900",
  },

  emptyText: {
    color: "#cbd5e1",
    fontSize: 18,
    lineHeight: 28,
    marginTop: 15,
  },

  incidentCard: {
    borderColor: "#f59e0b",
    borderWidth: 1,
    borderRadius: 22,
    padding: 23,
    marginBottom: 20,
  },

  incidentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  incidentHeaderText: {
    flex: 1,
    paddingRight: 12,
  },

  siteName: {
    color: "#ffffff",
    fontSize: 25,
    fontWeight: "900",
  },

  location: {
    color: "#93c5fd",
    fontSize: 17,
    marginTop: 7,
  },

  activeBadge: {
    color: "#f59e0b",
    fontSize: 14,
    fontWeight: "900",
  },

  incidentTitle: {
    color: "#fbbf24",
    fontSize: 25,
    fontWeight: "900",
    marginTop: 22,
    marginBottom: 14,
  },

  detailText: {
    color: "#cbd5e1",
    fontSize: 17,
    lineHeight: 28,
  },

  openButton: {
    backgroundColor: "#2563eb",
    borderRadius: 15,
    paddingVertical: 17,
    paddingHorizontal: 16,
    marginTop: 22,
  },

  openButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
  },

  progressSection: {
    marginTop: 18,
    marginBottom: 8,
  },

  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  progressLabel: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },

  progressPercentage: {
    color: "#fbbf24",
    fontSize: 16,
    fontWeight: "900",
  },

  progressTrack: {
    height: 12,
    backgroundColor: "#1e293b",
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 10,
  },

  progressFill: {
    height: "100%",
    backgroundColor: "#22c55e",
    borderRadius: 999,
  },

  stageText: {
    color: "#93c5fd",
    fontSize: 17,
    fontWeight: "800",
    marginTop: 10,
  },

  urgentBanner: {
    backgroundColor: "#3f1d0d",
    borderColor: "#f97316",
    borderWidth: 1,
    borderRadius: 22,
    padding: 23,
    marginTop: 26,
  },

  urgentBannerTitle: {
    color: "#fb923c",
    fontSize: 25,
    fontWeight: "900",
  },

  urgentBannerText: {
    color: "#fed7aa",
    fontSize: 18,
    lineHeight: 28,
    marginTop: 12,
  },

  assignmentWarning: {
    color: "#fbbf24",
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 25,
    marginTop: 12,
  },

  severityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  severityBadge: {
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 7,
    fontSize: 14,
    fontWeight: "900",
    overflow: "hidden",
  },

  criticalSeverity: {
    color: "#ffffff",
    backgroundColor: "#dc2626",
  },

  highSeverity: {
    color: "#111827",
    backgroundColor: "#f59e0b",
  },

  standardSeverity: {
    color: "#ffffff",
    backgroundColor: "#2563eb",
  },

  priorityText: {
    color: "#93c5fd",
    fontSize: 15,
    fontWeight: "800",
  },

  slaEscalationWarning: {
    color: "#fca5a5",
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 25,
    marginTop: 12,
  },

  slaPanel: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    marginBottom: 8,
  },

  slaPanelOnTrack: {
    backgroundColor: "#052e24",
    borderColor: "#22c55e",
  },

  slaPanelAtRisk: {
    backgroundColor: "#3f2a08",
    borderColor: "#f59e0b",
  },

  slaPanelBreached: {
    backgroundColor: "#450a0a",
    borderColor: "#ef4444",
  },

  slaPanelUnknown: {
    backgroundColor: "#1e293b",
    borderColor: "#64748b",
  },

  slaHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  slaTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },

  slaTimer: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
  },

  slaStatus: {
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 23,
    marginTop: 10,
  },

  slaStatusOnTrack: {
    color: "#4ade80",
  },

  slaStatusAtRisk: {
    color: "#fbbf24",
  },

  slaStatusBreached: {
    color: "#fca5a5",
  },

  slaStatusUnknown: {
    color: "#cbd5e1",
  },

  slaTarget: {
    color: "#94a3b8",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 7,
  },

  priorityInfo: {
    alignItems: "flex-end",
  },

  priorityReason: {
    fontSize: 13,
    fontWeight: "900",
    marginTop: 4,
  },

  priorityReasonBreached: {
    color: "#fca5a5",
  },

  priorityReasonAtRisk: {
    color: "#fbbf24",
  },

  priorityReasonStandard: {
    color: "#4ade80",
  },

  acknowledgeButton: {
    backgroundColor: "#b91c1c",
    borderRadius: 15,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginTop: 18,
  },

  acknowledgeButtonDisabled: {
    opacity: 0.6,
  },

  acknowledgeButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },

  acknowledgedPanel: {
    backgroundColor: "#052e24",
    borderColor: "#22c55e",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginTop: 18,
  },

  acknowledgedTitle: {
    color: "#4ade80",
    fontSize: 17,
    fontWeight: "900",
  },

  acknowledgedText: {
    color: "#d1fae5",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 8,
  },

  acknowledgedTime: {
    color: "#94a3b8",
    fontSize: 14,
    marginTop: 5,
  },

  auditEmptyCard: {
    borderColor: "#64748b",
    borderWidth: 1,
    borderRadius: 20,
    padding: 22,
  },

  auditEmptyTitle: {
    color: "#ffffff",
    fontSize: 21,
    fontWeight: "900",
  },

  auditEmptyText: {
    color: "#94a3b8",
    fontSize: 16,
    lineHeight: 25,
    marginTop: 10,
  },

  auditCard: {
    backgroundColor: "#052e24",
    borderColor: "#22c55e",
    borderWidth: 1,
    borderRadius: 20,
    padding: 21,
    marginBottom: 16,
  },

  auditHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  auditSiteName: {
    flex: 1,
    color: "#ffffff",
    fontSize: 21,
    fontWeight: "900",
    paddingRight: 10,
  },

  auditBadge: {
    color: "#4ade80",
    fontSize: 12,
    fontWeight: "900",
  },

  auditLocation: {
    color: "#93c5fd",
    fontSize: 16,
    marginTop: 7,
  },

  auditIncident: {
    color: "#fbbf24",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 16,
  },

  auditDetail: {
    color: "#d1fae5",
    fontSize: 15,
    lineHeight: 24,
    marginTop: 5,
  },

  auditTime: {
    color: "#94a3b8",
    fontSize: 14,
    marginTop: 12,
  },
});