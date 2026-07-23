import { useRouter } from "expo-router";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { baseStaff } from "../data/care-staff";
import { db } from "../lib/firebase";

type CareSite = {
  id: string;
  name: string;
  location: string;
  status: "OPERATIONAL" | "ATTENTION";
  activeIncidents: number;
  residents: number;
  staffOnDuty: number;
};

const getStaffCountForSite = (siteId: string) =>
  baseStaff.filter(
    (member) => member.siteId === siteId
  ).length;

const initialCareSites: CareSite[] = [
  {
    id: "site-1",
    name: "Futuristek Care Centre",
    location: "London",
    status: "ATTENTION",
    activeIncidents: 1,
    residents: 7,
    staffOnDuty: getStaffCountForSite("site-1"),
  },
  {
    id: "site-2",
    name: "Futuristek Riverside Home",
    location: "Kent",
    status: "OPERATIONAL",
    activeIncidents: 0,
    residents: 12,
    staffOnDuty: getStaffCountForSite("site-2"),
  },
  {
    id: "site-3",
    name: "Futuristek Central Hospital",
    location: "Manchester",
    status: "OPERATIONAL",
    activeIncidents: 0,
    residents: 24,
    staffOnDuty: getStaffCountForSite("site-3"),
  },
];

export default function MissionControl() {
  const router = useRouter();

  const [careSites, setCareSites] =
    useState<CareSite[]>(initialCareSites);

  useEffect(() => {
    const unsubscribeCareSites = onSnapshot(
      collection(db, "careSites"),
      (snapshot) => {
        if (snapshot.empty) {
          console.warn(
            "MISSION CONTROL CARE SITES: No Firestore sites found"
          );
          return;
        }

        setCareSites((currentSites) => {
          const currentSitesById = new Map(
            currentSites.map((site) => [site.id, site])
          );

          return snapshot.docs
            .filter((document) => {
              const data = document.data();

              return data.enabled !== false;
            })
            .map((document) => {
              const data = document.data();
              const existingSite =
                currentSitesById.get(document.id);

              const firestoreSite: CareSite = {
                id: document.id,

                name:
                  String(
                    data.name ??
                      existingSite?.name ??
                      "Unnamed Care Site"
                  ).trim() || "Unnamed Care Site",

                location:
                  String(
                    data.location ??
                      existingSite?.location ??
                      "Unknown location"
                  ).trim() || "Unknown location",

                residents:
                  existingSite?.residents ?? 0,

                staffOnDuty:
                  getStaffCountForSite(document.id),

                activeIncidents:
                  existingSite?.activeIncidents ?? 0,

                status:
                  existingSite?.status ?? "OPERATIONAL",
              };

              return firestoreSite;
            })
            .sort((firstSite, secondSite) =>
              firstSite.id.localeCompare(
                secondSite.id,
                undefined,
                { numeric: true }
              )
            );
        });

        console.log("MISSION CONTROL CARE SITES:", {
          count: snapshot.size,
          sites: snapshot.docs.map((document) => ({
            id: document.id,
            name: document.data().name,
            location: document.data().location,
            enabled: document.data().enabled,
          })),
        });
      },
      (error) => {
        console.error(
          "MISSION CONTROL CARE SITES ERROR:",
          error
        );
      }
    );

    return unsubscribeCareSites;
  }, []);

  useEffect(() => {
    const residentsRef = collection(db, "residents");

    const activeIncidentsQuery = query(
      collection(db, "careEvents"),
      where("status", "==", "active")
    );

    const unsubscribeResidents = onSnapshot(
      residentsRef,
      (snapshot) => {
        const residentCountsBySite: Record<string, number> = {};

        snapshot.docs.forEach((document) => {
          const data = document.data();

          const residentSiteId =
            String(data.siteId ?? "site-1").trim() ||
            "site-1";

          residentCountsBySite[residentSiteId] =
            (residentCountsBySite[residentSiteId] ?? 0) + 1;
        });

        setCareSites((currentSites) =>
          currentSites.map((site) => ({
            ...site,
            residents: residentCountsBySite[site.id] ?? 0,
          }))
        );

        console.log("MISSION CONTROL RESIDENTS BY SITE:", {
          counts: residentCountsBySite,
        });
      },
      (error) => {
        console.error(
          "MISSION CONTROL RESIDENTS ERROR:",
          error
        );
      }
    );

    const unsubscribeIncidents = onSnapshot(
      activeIncidentsQuery,
      (snapshot) => {
        const incidentCountsBySite: Record<string, number> = {};

        snapshot.docs.forEach((document) => {
          const data = document.data();

          const incidentSiteId =
            String(data.siteId ?? "site-1").trim() ||
            "site-1";

          incidentCountsBySite[incidentSiteId] =
            (incidentCountsBySite[incidentSiteId] ?? 0) + 1;
        });

        setCareSites((currentSites) =>
          currentSites.map((site) => {
            const activeIncidentCount =
              incidentCountsBySite[site.id] ?? 0;

            return {
              ...site,
              activeIncidents: activeIncidentCount,
              status:
                activeIncidentCount > 0
                  ? "ATTENTION"
                  : "OPERATIONAL",
            };
          })
        );

        console.log("MISSION CONTROL INCIDENTS BY SITE:", {
          counts: incidentCountsBySite,
        });
      },
      (error) => {
        console.error(
          "MISSION CONTROL INCIDENTS ERROR:",
          error
        );
      }
    );

    return () => {
      unsubscribeResidents();
      unsubscribeIncidents();
    };
  }, []);

  const totalResidents = careSites.reduce(
    (total, site) => total + site.residents,
    0
  );

  const totalStaff = careSites.reduce(
    (total, site) => total + site.staffOnDuty,
    0
  );

  const totalIncidents = careSites.reduce(
    (total, site) => total + site.activeIncidents,
    0
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>🌍 Futuristek Mission Control</Text>

      <Text style={styles.subtitle}>
        Enterprise multi-site care monitoring
      </Text>

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{careSites.length}</Text>
          <Text style={styles.summaryLabel}>Care Sites</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{totalResidents}</Text>
          <Text style={styles.summaryLabel}>Residents</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{totalStaff}</Text>
          <Text style={styles.summaryLabel}>Staff On Duty</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text
            style={[
              styles.summaryValue,
              totalIncidents > 0 && styles.warningText,
            ]}
          >
            {totalIncidents}
          </Text>
          <Text style={styles.summaryLabel}>Active Incidents</Text>
        </View>
      </View>

      <View style={styles.commandCard}>
        <Text style={styles.sectionTitle}>🤖 AI Command Centre</Text>

        <Text style={styles.commandText}>
          {totalIncidents > 0
            ? `All connected sites are being monitored. ${totalIncidents} active ${
                totalIncidents === 1
                  ? "incident requires"
                  : "incidents require"
              } attention.`
            : "All connected sites are being monitored. No active incidents currently require attention."}
        </Text>

        <View style={styles.commandStatus}>
          <Text style={styles.liveDot}>●</Text>
          <Text style={styles.liveText}>Enterprise monitoring live</Text>
        </View>
      </View>

      <Text style={styles.sectionHeading}>🏥 Connected Care Sites</Text>

      {careSites.map((site) => {
        const needsAttention = site.status === "ATTENTION";

        return (
          <View
            key={site.id}
            style={[
              styles.siteCard,
              needsAttention
                ? styles.attentionBorder
                : styles.operationalBorder,
            ]}
          >
            <View style={styles.siteHeader}>
              <View style={styles.siteHeaderText}>
                <Text style={styles.siteName}>{site.name}</Text>
                <Text style={styles.siteLocation}>📍 {site.location}</Text>
              </View>

              <Text
                style={[
                  styles.statusText,
                  needsAttention
                    ? styles.attentionText
                    : styles.operationalText,
                ]}
              >
                {needsAttention ? "● ATTENTION" : "● OPERATIONAL"}
              </Text>
            </View>

            <View style={styles.siteStats}>
              <Text style={styles.siteStat}>
                👥 {site.residents} residents
              </Text>

              <Text style={styles.siteStat}>
                🧑‍⚕️ {site.staffOnDuty} staff
              </Text>

              <Text style={styles.siteStat}>
                🚨 {site.activeIncidents} active
              </Text>
            </View>

            <Pressable
              onPress={() => {
                console.log("MISSION CONTROL → SITE:", {
                  siteId: site.id,
                  siteName: site.name,
                  siteLocation: site.location,
                });

                router.push({
                  pathname: "/care-command-center",
                  params: {
                    siteId: site.id,
                    siteName: site.name,
                    siteLocation: site.location,
                  },
                } as any);
              }}
              style={styles.openButton}
            >
              <Text style={styles.openButtonText}>
                Open Site Command Centre →
              </Text>
            </Pressable>
          </View>
        );
      })}

      <Pressable
        onPress={() =>
          router.push("/global-incident-operations" as any)
        }
        style={styles.enterpriseButton}
      >
        <Text style={styles.enterpriseButtonText}>
          🚨 Open Global Incident Operations
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#061826",
  },
  content: {
    padding: 22,
    paddingTop: 55,
    paddingBottom: 90,
  },
  title: {
    color: "#ffffff",
    fontSize: 40,
    fontWeight: "900",
    lineHeight: 48,
  },
  subtitle: {
    color: "#93c5fd",
    fontSize: 19,
    marginTop: 8,
    marginBottom: 26,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  summaryCard: {
    width: "48%",
    backgroundColor: "#102f4d",
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#2563eb",
  },
  summaryValue: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "900",
  },
  summaryLabel: {
    color: "#bfdbfe",
    fontSize: 15,
    marginTop: 5,
  },
  warningText: {
    color: "#fbbf24",
  },
  commandCard: {
    backgroundColor: "#081826",
    borderRadius: 20,
    padding: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#7c3aed",
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 25,
    fontWeight: "900",
  },
  commandText: {
    color: "#cbd5e1",
    fontSize: 17,
    lineHeight: 25,
    marginTop: 12,
  },
  commandStatus: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
  },
  liveDot: {
    color: "#22c55e",
    fontSize: 18,
    marginRight: 8,
  },
  liveText: {
    color: "#22c55e",
    fontSize: 16,
    fontWeight: "800",
  },
  sectionHeading: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 30,
    marginBottom: 16,
  },
  siteCard: {
    backgroundColor: "#081826",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
  },
  attentionBorder: {
    borderColor: "#f59e0b",
  },
  operationalBorder: {
    borderColor: "#22c55e",
  },
  siteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  siteHeaderText: {
    flex: 1,
    paddingRight: 12,
  },
  siteName: {
    color: "#ffffff",
    fontSize: 21,
    fontWeight: "900",
  },
  siteLocation: {
    color: "#93c5fd",
    fontSize: 15,
    marginTop: 5,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "900",
  },
  attentionText: {
    color: "#f59e0b",
  },
  operationalText: {
    color: "#22c55e",
  },
  siteStats: {
    marginTop: 16,
  },
  siteStat: {
    color: "#dbeafe",
    fontSize: 16,
    marginTop: 7,
  },
  openButton: {
    backgroundColor: "#2563eb",
    borderRadius: 13,
    padding: 14,
    marginTop: 18,
  },
  openButtonText: {
    color: "#ffffff",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "900",
  },
  enterpriseButton: {
    backgroundColor: "#7c3aed",
    borderRadius: 16,
    padding: 18,
    marginTop: 10,
  },
  enterpriseButtonText: {
    color: "#ffffff",
    textAlign: "center",
    fontSize: 17,
    fontWeight: "900",
  },
});