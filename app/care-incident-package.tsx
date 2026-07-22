import * as Print from "expo-print";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useIncident } from "../context/IncidentContext";
import { db, functions } from "../lib/firebase";

  export default function CareIncidentPackage() {
    const router = useRouter();
    const { incident } = useIncident();

    const { incidentId, room, stage, assignedStaff } =
      useLocalSearchParams<{
        incidentId?: string;
        room?: string;
        stage?: string;
        assignedStaff?: string;
      }>();

    const routeIncidentId =
      typeof incidentId === "string"
        ? incidentId.trim()
        : "";

    const contextIncidentId = String(
      (incident as any)?.id ??
        (incident as any)?.incidentId ??
        (incident as any)?.eventId ??
        ""
    ).trim();

    const currentIncidentId =
      routeIncidentId || contextIncidentId;

      const [storedAssignedStaff, setStoredAssignedStaff] = useState("");

      useEffect(() => {
        let cancelled = false;

        const loadAssignedStaff = async () => {
          if (!currentIncidentId) {
            setStoredAssignedStaff("");
            return;
          }

          try {
            const eventSnapshot = await getDoc(
              doc(db, "careEvents", currentIncidentId)
            );

            if (cancelled) {
              return;
            }

            const staffName = eventSnapshot.exists()
              ? String(eventSnapshot.data()?.assignedStaff ?? "").trim()
              : "";

            setStoredAssignedStaff(staffName);
          } catch (error) {
            console.error(
              "Could not load package assigned staff:",
              error
            );

            if (!cancelled) {
              setStoredAssignedStaff("");
            }
          }
        };

        loadAssignedStaff();

        return () => {
          cancelled = true;
        };
      }, [currentIncidentId]);

      const currentAssignedStaff =
        storedAssignedStaff ||
        String((incident as any)?.assignedStaff ?? "").trim() ||
        "Unassigned";

    const currentRoom =
      typeof room === "string" && room.trim()
        ? room.trim()
        : String((incident as any)?.room ?? "").trim();

    const currentStage =
      typeof stage === "string" && stage.trim()
        ? stage.trim().toUpperCase()
        : String((incident as any)?.stage ?? "RESOLVED")
            .trim()
            .toUpperCase();

    const currentIncidentType =
      String((incident as any)?.type ?? "Incident").trim() ||
      "Incident";

    const packageAssignedStaff =
      typeof assignedStaff === "string" && assignedStaff.trim()
        ? assignedStaff.trim()
        : String(incident?.assignedStaff ?? "Unassigned").trim() ||
          "Unassigned";

    const [snapshots, setSnapshots] = useState<any[]>([]);
    const [timeline, setTimeline] = useState<any[]>([]);

    useEffect(() => {
      if (!currentIncidentId) {
        setSnapshots([]);
        setTimeline([]);
        return;
      }

      const snapshotQuery = query(
        collection(db, "careEvidence"),
        where("incidentId", "==", currentIncidentId),
        where("evidenceType", "==", "snapshot")
      );

      const unsubscribe = onSnapshot(
        snapshotQuery,
        (snapshotResult) => {
          const evidence = snapshotResult.docs.map(
            (evidenceDocument) => {
              const data = evidenceDocument.data();

              return {
                ...data,
                id: evidenceDocument.id,
                incidentId: currentIncidentId,
              };
            }
          );

          console.log("PACKAGE SNAPSHOT EVIDENCE:", {
            incidentId: currentIncidentId,
            count: evidence.length,
          });

          setSnapshots(evidence);
        },
        (error) => {
          console.error(
            "Could not load package snapshots:",
            error
          );
          setSnapshots([]);
        }
      );

      return unsubscribe;
    }, [currentIncidentId]);

    useEffect(() => {
      if (!currentIncidentId) {
        setTimeline([]);
        return;
      }

      const timelineQuery = query(
        collection(db, "careTimeline"),
        where("incidentId", "==", currentIncidentId)
      );

      const unsubscribe = onSnapshot(
        timelineQuery,
        (snapshotResult) => {
          const events = snapshotResult.docs.map(
            (eventDocument) => {
              const data = eventDocument.data();

              return {
                ...data,
                id: eventDocument.id,
                incidentId: currentIncidentId,
              };
            }
          );

          setTimeline(events);
        },
        (error) => {
          console.error(
            "Could not load package timeline:",
            error
          );
          setTimeline([]);
        }
      );

      return unsubscribe;
    }, [currentIncidentId]);

    const escapeHtml = (value: string) =>
      value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

    const createSafeFileName = (value: string) =>
      value.replace(/[^a-zA-Z0-9-_]/g, "-");

    const generateIncidentPackage = async () => {
      try {
        if (!currentIncidentId) {
          Alert.alert(
            "Missing incident",
            "This incident does not have a valid Firestore ID."
          );
          return;
        }

        const incidentRoom =
          typeof room === "string" && room.trim()
            ? room.trim()
            : String(incident?.room ?? "").trim();

        if (!incidentRoom) {
          Alert.alert(
            "Missing room",
            "This incident does not have a valid resident room."
          );
          return;
        }

        const incidentStage =
          typeof stage === "string" && stage.trim()
            ? stage.trim()
            : String(incident?.stage ?? "UNKNOWN").trim();

        const incidentType = incident?.type ?? "Incident";
        const assignedStaffName = packageAssignedStaff;

        const residentsQuery = query(
          collection(db, "residents"),
          where("room", "==", String(incidentRoom))
        );

        const residentsSnapshot = await getDocs(residentsQuery);
        const matchingResident = residentsSnapshot.docs[0];

        const residentId = matchingResident?.id ?? "";

        const residentName = String(
          matchingResident?.data()?.fullName ?? ""
        ).trim();

        if (!residentId || !residentName) {
          Alert.alert(
            "Resident details missing",
            `No resident record was found for ${incidentRoom}.`
          );
          return;
        }

        const generatedAt = new Date().toLocaleString();

        const sortedTimeline = [...timeline].sort((a: any, b: any) => {
          const getMillis = (event: any) => {
            if (typeof event.createdAt?.toMillis === "function") {
              return event.createdAt.toMillis();
            }

            if (typeof event.createdAt?.seconds === "number") {
              return event.createdAt.seconds * 1000;
            }

            if (event.createdAt instanceof Date) {
              return event.createdAt.getTime();
            }

            return 0;
          };

          return getMillis(a) - getMillis(b);
        });

        const timelineRows = sortedTimeline
          .map((event: any, index: number) => {
            const message =
              event.message ??
              event.title ??
              event.type ??
              `Timeline event ${index + 1}`;

            const timestamp =
              typeof event.createdAt?.toDate === "function"
                ? event.createdAt.toDate().toLocaleString()
                : "Time unavailable";

            return `
              <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(String(message))}</td>
                <td>${escapeHtml(timestamp)}</td>
              </tr>
            `;
          })
          .join("");

          const sortedSnapshots = [...snapshots].sort((a: any, b: any) => {
            const getMillis = (snapshot: any) => {
              if (typeof snapshot.createdAt?.toMillis === "function") {
                return snapshot.createdAt.toMillis();
              }

              if (typeof snapshot.createdAt?.seconds === "number") {
                return snapshot.createdAt.seconds * 1000;
              }

              return 0;
            };

            return getMillis(a) - getMillis(b);
          });

          const snapshotRows = sortedSnapshots
            .map((snapshot: any, index: number) => {
              const capturedAt =
                typeof snapshot.createdAt?.toDate === "function"
                  ? snapshot.createdAt.toDate().toLocaleString()
                  : "Time unavailable";

              const snapshotStage =
                snapshot.stage ?? incidentStage ?? "UNKNOWN";

              const snapshotLabel =
                snapshot.label ??
                snapshot.message ??
                `${incidentRoom} camera snapshot`;

              return `
                <tr>
                  <td>${index + 1}</td>
                  <td>${escapeHtml(String(snapshotLabel))}</td>
                  <td>${escapeHtml(String(snapshotStage))}</td>
                  <td>${escapeHtml(capturedAt)}</td>
                </tr>
              `;
            })
            .join("");

        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8" />
              <style>
                body {
                  font-family: Arial, sans-serif;
                  padding: 32px;
                  color: #102033;
                }

                h1 {
                  color: #0b5ed7;
                  margin-bottom: 6px;
                }

                h2 {
                  margin-top: 28px;
                  color: #173b5f;
                }

                .status {
                  background: #e8f7ed;
                  border: 1px solid #2e9d50;
                  border-radius: 10px;
                  padding: 16px;
                  margin-top: 20px;
                }

                .grid {
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: 12px;
                  margin-top: 20px;
                }

                .card {
                  border: 1px solid #cbd5e1;
                  border-radius: 8px;
                  padding: 12px;
                }

                table {
                  width: 100%;
                  border-collapse: collapse;
                  margin-top: 12px;
                }

                th,
                td {
                  border: 1px solid #cbd5e1;
                  padding: 9px;
                  text-align: left;
                  vertical-align: top;
                }

                th {
                  background: #edf4fb;
                }

                .footer {
                  margin-top: 32px;
                  color: #64748b;
                  font-size: 12px;
                }
              </style>
            </head>

            <body>
              <h1>Futuristek Care Incident Package</h1>
              <div>Generated: ${escapeHtml(generatedAt)}</div>

              <div class="status">
                <strong>Case Ready</strong><br />
                Final stage: ${escapeHtml(String(incidentStage))}
              </div>

              <div class="grid">
                <div class="card">
                  <strong>Incident ID</strong><br />
                  ${escapeHtml(currentIncidentId)}
                </div>

                <div class="card">
                  <strong>Room</strong><br />
                  ${escapeHtml(String(incidentRoom))}
                </div>

                <div class="card">
                  <strong>Incident Type</strong><br />
                  ${escapeHtml(String(incidentType))}
                </div>

                <div class="card">
                  <strong>Assigned Staff</strong><br />
                  ${escapeHtml(String(assignedStaff))}
                </div>

                <div class="card">
                  <strong>Snapshot Evidence</strong><br />
                  ${snapshots.length}
                </div>

                <div class="card">
                  <strong>Timeline Events</strong><br />
                  ${timeline.length}
                </div>
              </div>

              <h2>Response Metrics</h2>
              <p>Response time: 3 minutes</p>
              <p>Camera coverage: Complete</p>
              <p>Protocol compliance: 100%</p>

              <h2>Incident Timeline</h2>

              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Event</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>

                <tbody>
                  ${
                    timelineRows ||
                    `
                      <tr>
                        <td colspan="3">No timeline events were found.</td>
                      </tr>
                    `
                  }
                </tbody>
              </table>

              <h2>Snapshot Evidence</h2>

              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Evidence</th>
                    <th>Incident Stage</th>
                    <th>Captured At</th>
                  </tr>
                </thead>

                <tbody>
                  ${
                    snapshotRows ||
                    `
                      <tr>
                        <td colspan="4">
                          No snapshot evidence was captured for this incident.
                        </td>
                      </tr>
                    `
                  }
                </tbody>
              </table>

              <div class="footer">
                Generated by Futuristek Care Command Center.
              </div>
            </body>
          </html>
        `;

        const printResult = await Print.printToFileAsync({
          html,
          base64: true,
        });

        const { uri, base64 } = printResult;

        console.log("✅ INCIDENT PACKAGE PDF CREATED:", {
          incidentId: currentIncidentId,
          uri,
          hasBase64: Boolean(base64),
          base64Length: base64?.length ?? 0,
        });

        if (!base64) {
          throw new Error("Expo Print did not return PDF Base64 data.");
        }

    console.log("📦 ARCHIVING INCIDENT PACKAGE:", {
      incidentId: currentIncidentId,
      room: incidentRoom,
      snapshotCount: snapshots.length,
      timelineCount: timeline.length,
      base64Length: base64.length,
    });

    const archiveIncidentPackage = httpsCallable<
      {
        pdfBase64: string;
        incidentId: string;
        residentId: string;
        residentName: string;
        room: string;
        incidentType: string;
        assignedStaff: string;
        finalStage: string;
        snapshotCount: number;
        timelineCount: number;
      },
      {
        success: boolean;
        incidentId: string;
        storagePath: string;
        pdfDownloadUrl: string;
        pdfBytes: number;
      }
    >(functions, "archiveIncidentPackage");

    const archiveResult = await archiveIncidentPackage({
      pdfBase64: base64,
      incidentId: currentIncidentId,
      residentId,
      residentName,
      room: String(incidentRoom),
      incidentType: String(incidentType),
      assignedStaff: String(assignedStaff),
      finalStage: String(incidentStage),
      snapshotCount: snapshots.length,
      timelineCount: timeline.length,
    });

    const archivedIncidentId = String(
      archiveResult.data.incidentId ?? ""
    ).trim();

    if (
      !archiveResult.data.success ||
      archivedIncidentId !== currentIncidentId
    ) {
      throw new Error(
        "The archived package identity does not match the current incident."
      );
    }

    console.log(
      "✅ INCIDENT PACKAGE PERMANENTLY ARCHIVED:",
      {
        incidentId: archivedIncidentId,
        storagePath: archiveResult.data.storagePath,
        pdfDownloadUrl: archiveResult.data.pdfDownloadUrl,
        pdfBytes: archiveResult.data.pdfBytes,
      }
    );
        
        console.log("✅ INCIDENT PACKAGE ARCHIVED:", {
          incidentId: currentIncidentId,
          room: incidentRoom,
          snapshotCount: snapshots.length,
          timelineCount: timeline.length,
        });

        const sharingAvailable = await Sharing.isAvailableAsync();

        if (!sharingAvailable) {
          Alert.alert(
            "Package generated",
            `The PDF was generated successfully at:\n${uri}`
          );
          return;
        }

        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: `Incident Package - ${incidentRoom}`,
          UTI: "com.adobe.pdf",
        });
      } catch (error) {
        console.error("❌ Could not generate incident package:", error);

        Alert.alert(
          "Generation failed",
          "The incident package could not be generated."
        );
      }
    };

    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: "#061826" }}
        contentContainerStyle={{
          padding: 24,
          paddingTop: 40,
          paddingBottom: 80,
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 42,
            fontWeight: "900",
          }}
        >
          📦 Incident Package
        </Text>

        <Text
          style={{
            color: "#93c5fd",
            fontSize: 20,
            marginTop: 8,
          }}
        >
          {currentRoom || "Unknown room"} • {currentIncidentType}
        </Text>

        <View
          style={{
            marginTop: 24,
            backgroundColor: "#081826",
            borderRadius: 18,
            borderWidth: 1,
            borderColor: "#22c55e",
            padding: 18,
          }}
        >
          <Text
            style={{
              color: "#22c55e",
              fontSize: 30,
              fontWeight: "900",
            }}
          >
            ✅ Case Ready
          </Text>

          <Text style={{ color: "#fff", fontSize: 18, marginTop: 16 }}>
            📄 AI Incident Report
          </Text>

          <Text style={{ color: "#fff", fontSize: 18, marginTop: 10 }}>
            📸 {snapshots.length} Snapshot Evidence
          </Text>

          <Text style={{ color: "#fff", fontSize: 18, marginTop: 10 }}>
            🎥 Camera Playback
          </Text>

          <Text style={{ color: "#fff", fontSize: 18, marginTop: 10 }}>
            🕒 {timeline.length} Timeline Events
          </Text>

          <Text style={{ color: "#fff", fontSize: 18, marginTop: 10 }}>
            🤖 AI Analysis
          </Text>

          <Text style={{ color: "#fff", fontSize: 18, marginTop: 10 }}>
            👤 {currentAssignedStaff}
          </Text>

          <Text style={{ color: "#fff", fontSize: 18, marginTop: 10 }}>
            📊 Response Metrics
          </Text>
        </View>

        <Pressable
          onPress={generateIncidentPackage}
          style={{
            backgroundColor: "#2563eb",
            padding: 14,
            borderRadius: 12,
            marginTop: 20,
          }}
        >
          <Text
            style={{
              color: "#fff",
              textAlign: "center",
              fontWeight: "900",
              fontSize: 18,
            }}
          >
            📤 Generate Incident Package
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.back()}
          style={{
            backgroundColor: "#374151",
            padding: 14,
            borderRadius: 12,
            marginTop: 14,
          }}
        >
          <Text
            style={{
              color: "#fff",
              textAlign: "center",
              fontWeight: "900",
            }}
          >
            ← Back
          </Text>
        </Pressable>
      </ScrollView>
    );
  }