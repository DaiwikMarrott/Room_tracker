export type Status = "pending" | "connected" | "not_answered";

export type RoomRecord = {
  roomNumber: string;
  status: Status;
  note: string;
  followUp: number;
  visitedAt?: string | null;
  priority?: number;
};

export function filterRooms(
  rooms: RoomRecord[],
  search: string,
  filter: Status | "all",
  showFollowUps: boolean
) {
  return rooms.filter((room) =>
    room.roomNumber.includes(search) &&
    (filter === "all" || room.status === filter) &&
    (!showFollowUps || room.followUp === 1)
  );
}

export function progressCount(rooms: RoomRecord[]) {
  return rooms.filter((room) => room.status !== "pending").length;
}

export function escapeCsv(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function roomLogCsv(rooms: RoomRecord[], labels: Record<Status, string>) {
  return [
    "Room,Status,Priority,Follow-up,Last visited,Conversation notes",
    ...rooms.map((room) => [
      escapeCsv(room.roomNumber),
      escapeCsv(labels[room.status]),
      escapeCsv(room.priority === 2 ? "Urgent" : room.priority === 1 ? "Soon" : "Normal"),
      escapeCsv(room.followUp === 1 ? "Yes" : "No"),
      escapeCsv(room.visitedAt ?? ""),
      escapeCsv(room.note),
    ].join(",")),
  ].join("\n");
}

export function recordVisit(room: RoomRecord, visitedAt: string) {
  return { ...room, visitedAt };
}

export function sortByPriority(rooms: RoomRecord[]) {
  return [...rooms].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.roomNumber.localeCompare(b.roomNumber));
}

export function withStatus(rooms: RoomRecord[], status: Status) {
  return rooms.map((room) => ({ ...room, status }));
}

export function resetRooms(rooms: RoomRecord[]) {
  return rooms.map((room) => ({
    ...room,
    status: "pending" as const,
    note: "",
    followUp: 0,
    visitedAt: null,
    priority: 0,
  }));
}
