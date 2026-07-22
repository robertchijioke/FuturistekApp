import { randomUUID } from "node:crypto";

import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import * as logger from "firebase-functions/logger";
import { HttpsError, onCall } from "firebase-functions/v2/https";

initializeApp({
  storageBucket: "futuristekapp.firebasestorage.app",
});

type ArchiveIncidentPackageData = {
  pdfBase64?: unknown;
  incidentId?: unknown;
  residentId?: unknown;
  residentName?: unknown;
  room?: unknown;
  incidentType?: unknown;
  assignedStaff?: unknown;
  finalStage?: unknown;
  snapshotCount?: unknown;
  timelineCount?: unknown;
};

const requireText = (
  value: unknown,
  fieldName: string,
  maximumLength = 200
): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpsError(
      "invalid-argument",
      `${fieldName} must be a non-empty string.`
    );
  }

  const cleanValue = value.trim();

  if (cleanValue.length > maximumLength) {
    throw new HttpsError(
      "invalid-argument",
      `${fieldName} is too long.`
    );
  }

  return cleanValue;
};

const safeCount = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
};

const createSafeFileName = (value: string): string =>
  value.replace(/[^a-zA-Z0-9_-]/g, "-");

export const archiveIncidentPackage = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 120,
    memory: "512MiB",
    maxInstances: 10,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be signed in to archive an incident package."
      );
    }

    const data = request.data as ArchiveIncidentPackageData;

    const incidentId = requireText(
      data.incidentId,
      "incidentId"
    );

    const room = requireText(
      data.room,
      "room"
    );

    const residentId = requireText(
      data.residentId,
      "residentId"
    );

    const residentName = requireText(
      data.residentName,
      "residentName"
    );

    const incidentType = requireText(
      data.incidentType,
      "incidentType"
    );
    const assignedStaff = requireText(
      data.assignedStaff,
      "assignedStaff"
    );
    const finalStage = requireText(data.finalStage, "finalStage");

    if (
      typeof data.pdfBase64 !== "string" ||
      !data.pdfBase64.trim()
    ) {
      throw new HttpsError(
        "invalid-argument",
        "pdfBase64 must contain the generated PDF."
      );
    }

    const cleanBase64 = data.pdfBase64.replace(
      /^data:application\/pdf;base64,/,
      ""
    );

    let pdfBuffer: Buffer;

    try {
      pdfBuffer = Buffer.from(cleanBase64, "base64");
    } catch (error) {
      logger.error("Could not decode incident PDF Base64.", error);

      throw new HttpsError(
        "invalid-argument",
        "The supplied PDF data is invalid."
      );
    }

    if (pdfBuffer.length === 0) {
      throw new HttpsError(
        "invalid-argument",
        "The generated PDF is empty."
      );
    }

    const maximumPdfBytes = 15 * 1024 * 1024;

    if (pdfBuffer.length > maximumPdfBytes) {
      throw new HttpsError(
        "invalid-argument",
        "The incident package exceeds the 15 MB upload limit."
      );
    }

    const safeIncidentId = createSafeFileName(incidentId);

    const storagePath =
      `incidentPackages/${safeIncidentId}/incident-package.pdf`;

    const downloadToken = randomUUID();
    const bucket = getStorage().bucket();
    const file = bucket.file(storagePath);

    try {
      await file.save(pdfBuffer, {
        resumable: false,
        contentType: "application/pdf",
        metadata: {
          cacheControl: "private, max-age=0, no-transform",
          metadata: {
            firebaseStorageDownloadTokens: downloadToken,
            incidentId,
            room,
            generatedByUid: request.auth.uid,
          },
        },
      });

      const encodedStoragePath = encodeURIComponent(storagePath);

      const pdfDownloadUrl =
        `https://firebasestorage.googleapis.com/v0/b/` +
        `${bucket.name}/o/${encodedStoragePath}` +
        `?alt=media&token=${downloadToken}`;

      await getFirestore()
        .collection("incidentPackages")
        .doc(incidentId)
        .set(
          {
            incidentId,
            residentId,
            residentName,
            room,
            incidentType,
            assignedStaff,
            finalStage,
            snapshotCount: safeCount(
              data.snapshotCount
            ),
            timelineCount: safeCount(
              data.timelineCount
            ),

            pdfDownloadUrl,
            storagePath,
            storageBucket: bucket.name,

            status: "READY",
            generatedByUid: request.auth.uid,
            generatedAt:
              FieldValue.serverTimestamp(),
            updatedAt:
              FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

      logger.info("Incident package archived successfully.", {
        incidentId,
        room,
        storagePath,
        pdfBytes: pdfBuffer.length,
        generatedByUid: request.auth.uid,
      });

      return {
        success: true,
        incidentId,
        storagePath,
        pdfDownloadUrl,
        pdfBytes: pdfBuffer.length,
      };
    } catch (error) {
      const errorDetails =
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : {
              value: String(error),
            };

      logger.error("Incident package archive failed.", {
        incidentId,
        room,
        bucketName: bucket.name,
        storagePath,
        errorDetails,
      });

      throw new HttpsError(
        "internal",
        "The incident package could not be archived."
      );
    }
  }
);