import { Text, View } from "react-native";

export default function ResponseETA({
  currentStage,
  staffName,
  room,
}: {
  currentStage: string;
  staffName: string;
  room: string;
}) {
  let title = "";
  let eta = "";
  let progress = 0;

  switch (currentStage) {
    case "ALERT_CREATED":
      title = "Awaiting staff dispatch";
      eta = "--";
      progress = 5;
      break;

    case "STAFF_ASSIGNED":
      title = `${staffName} assigned`;
      eta = "3 min";
      progress = 20;
      break;

    case "EN_ROUTE":
      title = `${staffName} en route to ${room}`;
      eta = "2 min";
      progress = 45;
      break;

    case "AT_SCENE":
      title = `${staffName} arrived`;
      eta = "Arrived";
      progress = 65;
      break;

    case "ASSESSMENT":
      title = "Resident assessment";
      eta = "In progress";
      progress = 80;
      break;

    case "AMBULANCE_REQUESTED":
      title = "Ambulance responding";
      eta = "4 min";
      progress = 90;
      break;

    case "TRANSPORT":
      title = "Resident transport";
      eta = "Active";
      progress = 97;
      break;

    case "RESOLVED":
      title = "Incident completed";
      eta = "Finished";
      progress = 100;
      break;

    default:
      title = "Monitoring";
      eta = "--";
      progress = 0;
  }

  return (
    <View
      style={{
        backgroundColor: "#081826",
        borderRadius: 14,
        padding: 12,
        marginTop: 12,
        borderWidth: 1,
        borderColor: "#0ea5e9",
      }}
    >
      <Text
        style={{
          color: "#fff",
          fontSize: 17,
          fontWeight: "900",
        }}
      >
        ⏱ Live Response Tracker
      </Text>

      <Text
        style={{
          color: "#93c5fd",
          marginTop: 10,
          fontSize: 15,
          fontWeight: "800",
        }}
      >
        {title}
      </Text>

      <Text
        style={{
          color: "#cfe2ff",
          marginTop: 4,
          fontSize: 14,
        }}
      >
        ETA: {eta}
      </Text>

      <View
        style={{
          marginTop: 10,
          height: 10,
          backgroundColor: "#1e293b",
          borderRadius: 6,
        }}
      >
        <View
          style={{
            width: `${progress}%`,
            height: 10,
            borderRadius: 6,
            backgroundColor: "#22c55e",
          }}
        />
      </View>

      <Text
        style={{
          color: "#22c55e",
          marginTop: 6,
          fontSize: 13,
          fontWeight: "800",
        }}
      >
        {progress}% Complete
      </Text>
    </View>
  );
}