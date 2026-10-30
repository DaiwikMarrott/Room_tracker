import type { RoomRecord } from "./trackerLogic";

export type RoomChanges = Partial<Pick<RoomRecord, "status" | "note" | "followUp" | "visitedAt" | "priority">>;

export const requiredRoomColumns = [
  "room_number",
  "status",
  "note",
  "follow_up",
  "visited_at",
  "priority",
] as const;

export function hasRequiredRoomColumns(columns: readonly string[]) {
  return requiredRoomColumns.every((column) => columns.includes(column));
}

export function applyRoomChanges(room: RoomRecord, changes: RoomChanges): RoomRecord {
  return {
    ...room,
    ...(changes.status === undefined ? {} : { status: changes.status }),
    ...(changes.note === undefined ? {} : { note: changes.note }),
    ...(changes.followUp === undefined ? {} : { followUp: changes.followUp }),
    ...(changes.visitedAt === undefined ? {} : { visitedAt: changes.visitedAt }),
    ...(changes.priority === undefined ? {} : { priority: changes.priority }),
  };
}
