export function getDeviceStatus(device: any) {
  const isOn =
    device?.isOn === true ||
    device?.status === true ||
    device?.online === true ||
    String(device?.status || "").toLowerCase() === "online";

  return {
    isOnline: isOn,
    label: isOn ? "Online" : "Offline",
    needsAttention: !isOn,
  };
}