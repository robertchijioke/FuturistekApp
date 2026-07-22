import { Pressable, Text, View } from "react-native";
import { incidentDuration } from "../utils/incidentDuration";


export default function MissionControlMap({
  residents = [],
  staff = [],
onRoomPress,
incident,
isResolved,
}: {
residents: any[];
staff: any[];
onRoomPress: (resident: any) => void;
incident: any;
isResolved: boolean;
}) {


  return (
    <View
      style={{
        backgroundColor: "#102a43",
        borderRadius: 18,
        padding: 18,
      }}
    >
      <Text
        style={{
          color: "#fff",
          fontSize: 28,
          fontWeight: "900",
          marginBottom: 10,
        }}
      >
        🏥 Mission Control
      </Text>

      <Text
        style={{
          color: "#9fb3c8",
          marginBottom: 18,
        }}
      >
        Live Building Layout
      </Text>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        {renderRoom(residents[0], staff, onRoomPress, incident, isResolved)}
        {renderRoom(residents[1], staff, onRoomPress, incident, isResolved)}
      </View>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginTop: 12,
        }}
      >
        {renderRoom(residents[2], staff, onRoomPress, incident, isResolved)}
        {renderRoom(residents[3], staff, onRoomPress, incident, isResolved)}
      </View>

      <View
        style={{
          alignItems: "center",
          marginVertical: 18,
        }}
      >
        <View
          style={{
            backgroundColor: "#1e293b",
            borderRadius: 12,
            padding: 10,
            width: "90%",
          }}
        >
          <Text
            style={{
              color: "#fff",
              textAlign: "center",
              fontWeight: "800",
            }}
          >
            👩 Nurse Station
          </Text>
        </View>
      </View>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        {renderRoom(residents[4], staff, onRoomPress, incident, isResolved)}
        {renderRoom(residents[5], staff, onRoomPress, incident, isResolved)}
      </View>
    </View>
  );
}

function renderRoom(
  resident: any,
  staff: any[],
  onRoomPress: (resident: any) => void,
  incident: any,
  isResolved: boolean
) {
  if (!resident) {
    return null;
  }

  const residentRoom = String(resident.room ?? "").trim();
  const incidentRoom = String(incident?.room ?? "").trim();

  const isIncidentRoom =
    Boolean(incidentRoom) &&
    residentRoom === incidentRoom;

  const displayStatus =
    isIncidentRoom && isResolved
      ? "SAFE"
      : String(resident.status ?? "SAFE");

  const displayColor =
    isIncidentRoom && isResolved
      ? "#22c55e"
      : String(resident.color ?? "#22c55e");

  const showEmergencyDetails =
    isIncidentRoom && !isResolved;

  return (
    <Pressable
      key={resident.room}
      onPress={() => onRoomPress(resident)}
      style={{
        width: "46%",
        backgroundColor: displayColor,
        borderRadius: 14,
        padding: 14,
      }}
    >
      <Text
        style={{
          color: "#fff",
          fontSize: 20,
          fontWeight: "900",
        }}
      >
        {resident.room}
      </Text>

      <Text
        style={{
          color: "#fff",
          marginTop: 8,
        }}
      >
        {displayStatus}
      </Text>

      {resident.status === "CRITICAL" && resident.createdAt && (
        <Text style={{ color: "#fff", marginTop: 6, fontWeight: "800" }}>
          ⏱ {incidentDuration(resident.createdAt)}
        </Text>
      )}

      {showEmergencyDetails && (
        <Text style={{ color: "#fff", marginTop: 6 }}>
          🚑 Emergency
        </Text>
      )}

      {showEmergencyDetails && (
      <>
        <Text style={{ color: "#fff", marginTop: 6, fontWeight: "800" }}>
          📹 Camera Active
        </Text>

        <Text style={{ color: "#fff", marginTop: 6, fontWeight: "800" }}>
          🚪 Door Secure
        </Text>

        <Text style={{ color: "#fff", marginTop: 6, fontWeight: "800" }}>
          🚨 Alarm Zone Active
        </Text>
      </>
    )}

      {showEmergencyDetails &&
        staff
          ?.filter((member) => member.assignedRoom === resident.room)
        .map((member) => (
          <Text
            key={member.name}
            style={{
              color: "#fde68a",
              marginTop: 6,
              fontWeight: "800",
            }}
          >
            👩 {member.name}
          </Text>
        ))}

      {resident.status === "ATTENTION" && (
        <Text style={{ color: "#fff", marginTop: 6 }}>
          🚶 Wandering
        </Text>
      )}
    </Pressable>
  );
}