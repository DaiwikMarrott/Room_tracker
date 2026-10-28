export type Status = "pending" | "connected" | "not_answered";

export type RoomRecord = {
  roomNumber: string;
  status: Status;
  note: string;
  followUp: number;
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
    "Room,Status,Follow-up,Conversation notes",
    ...rooms.map((room) => [
      escapeCsv(room.roomNumber),
      escapeCsv(labels[room.status]),
      escapeCsv(room.followUp === 1 ? "Yes" : "No"),
      escapeCsv(room.note),
    ].join(",")),
  ].join("\n");
}

