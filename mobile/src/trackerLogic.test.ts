import { describe, expect, it } from "vitest";
import {
  escapeCsv,
  filterRooms,
  progressCount,
  recordVisit,
  roomLogCsv,
  sortByPriority,
  withStatus,
  resetRooms,
  type RoomRecord,
} from "./trackerLogic";

const labels = { pending: "Not checked", connected: "Connected", not_answered: "Not answered" } as const;
const rooms: RoomRecord[] = [
  { roomNumber: "5210", status: "pending", note: "", followUp: 0 },
  { roomNumber: "5211", status: "connected", note: 'Said "hello"', followUp: 1 },
  { roomNumber: "5212", status: "not_answered", note: "Try tomorrow", followUp: 0 },
];

describe("room tracker logic", () => {
  it("filters by room number, status, and follow-up", () => {
    expect(filterRooms(rooms, "521", "all", false)).toHaveLength(3);
    expect(filterRooms(rooms, "", "connected", false).map((room) => room.roomNumber)).toEqual(["5211"]);
    expect(filterRooms(rooms, "", "all", true).map((room) => room.roomNumber)).toEqual(["5211"]);
  });

  it("counts visited rooms without changing source records", () => {
    expect(progressCount(rooms)).toBe(2);
    expect(rooms[0].status).toBe("pending");
  });

  it("escapes CSV values and preserves notes", () => {
    expect(escapeCsv('a "quoted" note')).toBe('"a ""quoted"" note"');
    expect(roomLogCsv([recordVisit({ ...rooms[1], priority: 2 }, "2026-10-28T12:00:00.000Z")], labels)).toContain('"5211","Connected","Urgent","Yes","2026-10-28T12:00:00.000Z","Said ""hello"""');
  });

  it("records a visit without mutating the source room", () => {
    const visited = recordVisit(rooms[0], "2026-10-28T12:00:00.000Z");
    expect(visited.visitedAt).toBe("2026-10-28T12:00:00.000Z");
    expect(rooms[0].visitedAt).toBeUndefined();
  });

  it("orders priority rooms first while keeping room order stable", () => {
    const sorted = sortByPriority([
      { ...rooms[2], priority: 1 },
      { ...rooms[0], priority: 2 },
      { ...rooms[1], priority: 2 },
    ]);
    expect(sorted.map((room) => room.roomNumber)).toEqual(["5210", "5211", "5212"]);
  });

  it("applies a bulk status without mutating the source list", () => {
    const updated = withStatus(rooms, "connected");
    expect(updated.every((room) => room.status === "connected")).toBe(true);
    expect(rooms[0].status).toBe("pending");
  });

  it("resets a session while keeping room numbers", () => {
    const reset = resetRooms([{ ...rooms[1], priority: 2, visitedAt: "y" }]);
    expect(reset[0]).toMatchObject({ roomNumber: "5211", status: "pending", note: "", followUp: 0, priority: 0, visitedAt: null });
  });
});
