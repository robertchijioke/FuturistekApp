import * as FileSystem from "expo-file-system/legacy";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, View,
} from "react-native";
import { db } from "../lib/firebase";


export default function CarePackageActions() {
  const router = useRouter();

  const { incidentId } = useLocalSearchParams<{
    incidentId?: string;
  }>();

  const currentIncidentId =
    typeof incidentId === "string"
      ? incidentId.trim()
      : "";

  const [busyAction, setBusyAction] = useState<
    "view" | "download" | "share" | null
  >(null);

  const [packageRecord, setPackageRecord] =
    useState<any>(null);

  const [loadingPackage, setLoadingPackage] =
    useState(true);

  useEffect(() => {
    const loadPackage = async () => {
      try {
        setLoadingPackage(true);

        if (!currentIncidentId) {
          throw new Error("Incident ID is missing.");
        }

        const packageSnapshot = await getDoc(
          doc(
            db,
            "incidentPackages",
            currentIncidentId
          )
        );

        if (!packageSnapshot.exists()) {
          throw new Error(
            "Archived package was not found."
          );
        }

        const data = packageSnapshot.data();

        const storedIncidentId = String(
          data.incidentId ?? ""
        ).trim();

        if (
          storedIncidentId &&
          storedIncidentId !== currentIncidentId
        ) {
          throw new Error(
            "The archived package identity does not match the requested incident."
          );
        }

        console.log("✅ PACKAGE ACTION DATA LOADED:", {
          incidentId: currentIncidentId,
          room: data.room,
          hasPdfDownloadUrl: Boolean(
            data.pdfDownloadUrl
          ),
        });

        setPackageRecord({
          ...data,
          id: packageSnapshot.id,
          incidentId: currentIncidentId,
        });

      } catch (error) {
        console.error(
          "Could not load archived package:",
          error
        );

        setPackageRecord(null);

        Alert.alert(
          "Package unavailable",
          "The archived incident package could not be loaded."
        );
      } finally {
        setLoadingPackage(false);
      }
    };

    loadPackage();
  }, [currentIncidentId]);


  const currentRoom =
    typeof packageRecord?.room === "string"
      ? packageRecord.room.trim()
      : "";

  const currentIncidentType =
    typeof packageRecord?.incidentType === "string"
      ? packageRecord.incidentType
      : "Incident";

  const currentPdfUrl =
    typeof packageRecord?.pdfDownloadUrl === "string"
      ? packageRecord.pdfDownloadUrl
      : "";

  const hasValidPackageIdentity =
    Boolean(currentIncidentId) && Boolean(currentRoom);

  const safeIncidentId = hasValidPackageIdentity
    ? currentIncidentId.replace(/[^a-zA-Z0-9-_]/g, "-")
    : "";

  const localPdfUri =
    `${FileSystem.cacheDirectory}` +
    `Futuristek-Incident-${safeIncidentId}.pdf`;

    const requireValidPackageIdentity = () => {
      if (hasValidPackageIdentity) {
        return true;
      }

      Alert.alert(
        "Package unavailable",
        "This incident package does not have a valid incident ID and room."
      );

      return false;
    };

  const ensurePackageDownloaded = async () => {

    if (!requireValidPackageIdentity()) {
      throw new Error("Invalid incident package identity.");
    }

    if (!currentPdfUrl) {
      throw new Error("The archived PDF URL is missing.");
    }
    await FileSystem.deleteAsync(localPdfUri, {
      idempotent: true,
    });

    console.log("📥 DOWNLOADING INCIDENT PACKAGE:", {
      incidentId: currentIncidentId,
      localPdfUri,
    });

    const result = await FileSystem.downloadAsync(
      currentPdfUrl,
      localPdfUri,
      {
        headers: {
          Accept: "application/pdf",
        },
      }
    );

    if (result.status < 200 || result.status >= 300) {
      await FileSystem.deleteAsync(localPdfUri, {
        idempotent: true,
      });

      throw new Error(
        `Package download failed with status ${result.status}.`
      );
    }

    const downloadedFile = await FileSystem.getInfoAsync(result.uri);

    const downloadedSize =
      downloadedFile.exists &&
      typeof downloadedFile.size === "number"
        ? downloadedFile.size
        : 0;

    console.log("✅ INCIDENT PACKAGE DOWNLOADED:", {
      incidentId: currentIncidentId,
      uri: result.uri,
      size: downloadedSize,
    });

    if (downloadedSize < 1000) {
      await FileSystem.deleteAsync(result.uri, {
        idempotent: true,
      });

      throw new Error(
        `Downloaded package is invalid or incomplete: ${downloadedSize} bytes.`
      );
    }

    return result.uri;
  };

  const viewPackage = async () => {
    try {
      if (!requireValidPackageIdentity()) {
        return;
      }

      setBusyAction("view");

      if (!currentPdfUrl) {
        throw new Error("The archived PDF URL is missing.");
      }

      const supported = await Linking.canOpenURL(currentPdfUrl);

      if (!supported) {
        throw new Error("This device cannot open the PDF URL.");
      }

      await Linking.openURL(currentPdfUrl);
    } catch (error) {
      console.error("Could not view incident package:", error);

      Alert.alert(
        "Could not view package",
        "The incident package could not be opened."
      );
    } finally {
      setBusyAction(null);
    }
  };

  const downloadPackage = async () => {
    try {
      if (!requireValidPackageIdentity()) {
        return;
      }

      setBusyAction("download");

      const uri = await ensurePackageDownloaded();

      Alert.alert(
        "Package ready",
        "The incident package has been downloaded to the app cache.",
        [
          {
            text: "Open or save",
            onPress: async () => {
              const sharingAvailable =
                await Sharing.isAvailableAsync();

              if (!sharingAvailable) {
                Alert.alert(
                  "Sharing unavailable",
                  "This device cannot open the native file menu."
                );
                return;
              }

              await Sharing.shareAsync(uri, {
                mimeType: "application/pdf",
                dialogTitle:
                  `Save ${currentRoom} Incident Package`,
                UTI: "com.adobe.pdf",
              });
            },
          },
          {
            text: "OK",
            style: "cancel",
          },
        ]
      );
    } catch (error) {
      console.error("Could not download incident package:", error);

      Alert.alert(
        "Download failed",
        "The incident package could not be downloaded."
      );
    } finally {
      setBusyAction(null);
    }
  };

  const sharePackage = async () => {
    try {
      if (!requireValidPackageIdentity()) {
        return;
      }

      setBusyAction("share");

      const uri = await ensurePackageDownloaded();

      const sharingAvailable =
        await Sharing.isAvailableAsync();

      if (!sharingAvailable) {
        Alert.alert(
          "Sharing unavailable",
          "Sharing is not available on this device."
        );
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle:
          `Share ${currentRoom} Incident Package`,
        UTI: "com.adobe.pdf",
      });

      console.log("✅ INCIDENT PACKAGE SHARED:", {
        incidentId: currentIncidentId,
        uri,
      });
    } catch (error) {
      console.error("Could not share incident package:", error);

      Alert.alert(
        "Share failed",
        "The incident package could not be shared."
      );
    } finally {
      setBusyAction(null);
    }
  };

  const actionDisabled = busyAction !== null;

    if (loadingPackage) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#061826",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" />

        <Text
          style={{
            color: "#93c5fd",
            fontSize: 18,
            marginTop: 14,
          }}
        >
          Loading archived package...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{
        flex: 1,
        backgroundColor: "#061826",
      }}
      contentContainerStyle={{
        padding: 24,
        paddingTop: 50,
        paddingBottom: 100,
      }}
    >
      <Text
        style={{
          color: "#fff",
          fontSize: 42,
          fontWeight: "900",
        }}
      >
        📦 Package Actions
      </Text>

      <Text
        style={{
          color: "#93c5fd",
          fontSize: 20,
          marginTop: 8,
        }}
      >
        {currentRoom} • {currentIncidentType}
      </Text>

      <View
        style={{
          marginTop: 26,
          backgroundColor: "#081826",
          borderRadius: 18,
          padding: 20,
          borderWidth: 1,
          borderColor: "#22c55e",
        }}
      >
        <Text
          style={{
            color: "#22c55e",
            fontSize: 28,
            fontWeight: "900",
          }}
        >
          ✅ Archived Package Ready
        </Text>

        <Text
          style={{
            color: "#cfe2ff",
            fontSize: 16,
            marginTop: 14,
          }}
        >
          Incident ID: {currentIncidentId}
        </Text>

        <Text
          style={{
            color: "#cfe2ff",
            fontSize: 16,
            marginTop: 8,
          }}
        >
          Room: {currentRoom}
        </Text>
      </View>

      {busyAction && (
        <View
          style={{
            marginTop: 24,
            alignItems: "center",
          }}
        >
          <ActivityIndicator size="large" />

          <Text
            style={{
              color: "#93c5fd",
              fontSize: 17,
              marginTop: 12,
            }}
          >
            Preparing package...
          </Text>
        </View>
      )}

      <Pressable
        disabled={actionDisabled}
        onPress={viewPackage}
        style={{
          backgroundColor: "#2563eb",
          padding: 18,
          borderRadius: 16,
          marginTop: 28,
          opacity: actionDisabled ? 0.6 : 1,
        }}
      >
        <Text
          style={{
            color: "#fff",
            textAlign: "center",
            fontSize: 21,
            fontWeight: "900",
          }}
        >
          👁️ View Package
        </Text>
      </Pressable>

      <Pressable
        disabled={actionDisabled}
        onPress={downloadPackage}
        style={{
          backgroundColor: "#0f766e",
          padding: 18,
          borderRadius: 16,
          marginTop: 16,
          opacity: actionDisabled ? 0.6 : 1,
        }}
      >
        <Text
          style={{
            color: "#fff",
            textAlign: "center",
            fontSize: 21,
            fontWeight: "900",
          }}
        >
          ⬇️ Download / Save
        </Text>
      </Pressable>

      <Pressable
        disabled={actionDisabled}
        onPress={sharePackage}
        style={{
          backgroundColor: "#7c3aed",
          padding: 18,
          borderRadius: 16,
          marginTop: 16,
          opacity: actionDisabled ? 0.6 : 1,
        }}
      >
        <Text
          style={{
            color: "#fff",
            textAlign: "center",
            fontSize: 21,
            fontWeight: "900",
          }}
        >
          📤 Share Package
        </Text>
      </Pressable>

      <Pressable
        disabled={actionDisabled}
        onPress={() => router.back()}
        style={{
          backgroundColor: "#374151",
          padding: 18,
          borderRadius: 16,
          marginTop: 24,
          opacity: actionDisabled ? 0.6 : 1,
        }}
      >
        <Text
          style={{
            color: "#fff",
            textAlign: "center",
            fontSize: 20,
            fontWeight: "900",
          }}
        >
          ← Back
        </Text>
      </Pressable>
    </ScrollView>
  );
}