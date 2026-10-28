import { describe, expect, it } from "vitest";
import {
  escapeCsv,
  filterRooms,
  progressCount,
  recordVisit,
  roomLogCsv,
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
    expect(roomLogCsv([recordVisit(rooms[1], "2026-10-28T12:00:00.000Z")], labels)).toContain('"5211","Connected","Yes","2026-10-28T12:00:00.000Z","Said ""hello"""');
  });

  it("records a visit without mutating the source room", () => {
    const visited = recordVisit(rooms[0], "2026-10-28T12:00:00.000Z");
    expect(visited.visitedAt).toBe("2026-10-28T12:00:00.000Z");
    expect(rooms[0].visitedAt).toBeUndefined();
  });
});
