import React, { createContext, useContext, useState } from "react";


  const IncidentContext = createContext<any>(null);

  export function IncidentProvider({
    children,
  }: {
    children: React.ReactNode;
  }) {
   
    const [incidents, setIncidents] =
      useState<any[]>([]);

    const [
      selectedIncidentId,
      setSelectedIncidentId,
    ] = useState("");

    const getIncidentCreatedAtMillis = (
      item: any
    ) => {
      const createdAt = item?.createdAt;

      if (
        typeof createdAt?.toMillis === "function"
      ) {
        return createdAt.toMillis();
      }

      if (
        typeof createdAt?.seconds === "number"
      ) {
        return createdAt.seconds * 1000;
      }

      if (createdAt instanceof Date) {
        return createdAt.getTime();
      }

      if (
        typeof createdAt === "string" ||
        typeof createdAt === "number"
      ) {
        const parsedTime =
          new Date(createdAt).getTime();

        return Number.isNaN(parsedTime)
          ? 0
          : parsedTime;
      }

      return 0;
    };

    const latestActiveIncident = [...incidents]
      .filter(
        (item: any) =>
          String(item?.status ?? "")
            .trim()
            .toLowerCase() === "active" &&
          String(item?.stage ?? "")
            .trim()
            .toUpperCase() !== "RESOLVED"
      )
      .sort(
        (a: any, b: any) =>
          getIncidentCreatedAtMillis(b) -
          getIncidentCreatedAtMillis(a)
      )[0];

    const selectedIncident = incidents.find(
      (item: any) =>
        String(item?.id ?? "") ===
        selectedIncidentId
    );

    const incident =
      selectedIncident ??
      latestActiveIncident ??
      null;

    return (
      <IncidentContext.Provider
        value={{
          incidents,
          setIncidents,

          incident,

          selectedIncidentId,
          setSelectedIncidentId,
        }}
      >
        {children}
      </IncidentContext.Provider>
    );
  }

  export function useIncident() {
    const context = useContext(IncidentContext);

    if (!context) {
      throw new Error(
        "useIncident must be used inside IncidentProvider."
      );
    }

    return context;
  }