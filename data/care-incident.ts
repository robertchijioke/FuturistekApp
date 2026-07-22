  export const careIncident = {
    id: "INC-ROOM12-001",
    room: "Room 12",
    residentName: "Resident",
    assignedStaff: "James",
    type: "Fall Detection",
    status: "RESOLVED",
    stage: "RESOLVED",

  timeline: [
    {
      time: "13:42",
      status: "critical",
      icon: "🚨",
      title: "Fall detected",
      note: "AI detected possible fall",
    },
    {
      time: "13:43",
      status: "assigned",
      icon: "👩‍⚕️",
      title: "Staff assigned",
      note: "James assigned to Room 12",
    },
    {
      time: "13:44",
      status: "enroute",
      icon: "🚶",
      title: "En route",
      note: "James is on the way",
    },
    {
      time: "13:45",
      status: "scene",
      icon: "📍",
      title: "At scene",
      note: "James arrived at Room 12",
    },
    {
      time: "13:46",
      status: "assessment",
      icon: "🩺",
      title: "Assessment",
      note: "Resident assessment started",
    },
    {
      time: "14:00",
      status: "ambulance",
      icon: "🚑",
      title: "Ambulance requested",
      note: "Emergency support requested",
    },
    {
      time: "14:02",
      status: "transport",
      icon: "🏥",
      title: "Resident transport",
      note: "Resident transported safely",
    },
    {
      time: "14:20",
      status: "resolved",
      icon: "✅",
      title: "Incident resolved",
      note: "Resident marked safe",
    },
  ],

  snapshots: [
    {
      icon: "📸",
      time: "21:42:18",
      label: "Room 12 snapshot",
    },
    {
      icon: "📸",
      time: "21:43:07",
      label: "Staff arrival snapshot",
    },
    {
      icon: "📸",
      time: "21:44:11",
      label: "Assessment snapshot",
    },
  ],
 };