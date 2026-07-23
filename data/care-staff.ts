export type CareStaffMember = {
  name: string;
  role: string;
  status: string;
  assignedRoom: string;
  location: string;
  siteId: string;
};

export const baseStaff: CareStaffMember[] = [
  {
    name: "Alice",
    role: "Nurse",
    status: "AVAILABLE",
    assignedRoom: "",
    location: "Nurse Station",
    siteId: "site-1",
  },
  {
    name: "James",
    role: "Care Staff",
    status: "AVAILABLE",
    assignedRoom: "",
    location: "Nurse Station",
    siteId: "site-1",
  },
  {
    name: "Sarah",
    role: "Supervisor",
    status: "AVAILABLE",
    assignedRoom: "",
    location: "Nurse Station",
    siteId: "site-1",
  },
];