export function incidentDuration(createdAt: any) {
  if (!createdAt) return "0m";

  const start =
    createdAt?.toDate?.() instanceof Date
      ? createdAt.toDate()
      : new Date(createdAt);

  const diffMs = Date.now() - start.getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60000));

  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return `${hours}h ${remainingMinutes}m`;
}