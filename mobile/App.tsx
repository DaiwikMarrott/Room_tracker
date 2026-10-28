import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as SQLite from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { filterRooms, progressCount, recordVisit, roomLogCsv } from "./src/trackerLogic";

type Status = "pending" | "connected" | "not_answered";
type Room = { roomNumber: string; status: Status; note: string; followUp: number; visitedAt?: string | null };
type StatusChange = { roomNumber: string; previousStatus: Status };
const NOTE_MAX_LENGTH = 500;

const roomNumbers = [
  "5210", "5211", "5212", "5213", "5214", "5215", "5216", "5217", "5218", "5219",
  "5220", "5221", "5222", "5223", "5224", "5225", "5226", "5227", "5228", "5229",
  "5230", "5231", "5232", "5251", "5252", "5253", "5254", "5255", "5256", "5257",
  "5258", "5259", "5260", "5261", "5262", "5263", "5264", "5265", "5266", "5267", "5268",
];

const db = SQLite.openDatabaseSync("courtyard-room-tracker.db");

function App() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selected, setSelected] = useState<Room | null>(null);
  const [filter, setFilter] = useState<Status | "all">("all");
  const [showFollowUps, setShowFollowUps] = useState(false);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [lastStatusChange, setLastStatusChange] = useState<StatusChange | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const ambient = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(ambient, { toValue: 1, duration: 5200, useNativeDriver: true }),
        Animated.timing(ambient, { toValue: 0, duration: 5200, useNativeDriver: true }),
      ])
    ).start();
  }, [ambient]);

  const loadRooms = () => {
    db.execSync(`CREATE TABLE IF NOT EXISTS rooms (
      room_number TEXT PRIMARY KEY NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      note TEXT NOT NULL DEFAULT '',
      follow_up INTEGER NOT NULL DEFAULT 0,
      visited_at TEXT
    );`);
    const columns = db.getAllSync<{ name: string }>("PRAGMA table_info(rooms)");
    if (!columns.some((column) => column.name === "follow_up")) {
      db.execSync("ALTER TABLE rooms ADD COLUMN follow_up INTEGER NOT NULL DEFAULT 0");
    }
    if (!columns.some((column) => column.name === "visited_at")) {
      db.execSync("ALTER TABLE rooms ADD COLUMN visited_at TEXT");
    }
    const insert = db.prepareSync("INSERT OR IGNORE INTO rooms (room_number) VALUES (?)");
    try {
      roomNumbers.forEach((roomNumber) => insert.executeSync(roomNumber));
    } finally {
      insert.finalizeSync();
    }
    setRooms(db.getAllSync<Room>(
      "SELECT room_number as roomNumber, status, note, follow_up as followUp, visited_at as visitedAt FROM rooms ORDER BY room_number"
    ));
  };

  useEffect(() => loadRooms(), []);

  const counts = useMemo(() => rooms.reduce((result, room) => {
    result[room.status] += 1;
    return result;
  }, { pending: 0, connected: 0, not_answered: 0 } as Record<Status, number>), [rooms]);

  const visibleRooms = filterRooms(rooms, search, filter, showFollowUps);
  const nextRoom = rooms.find((room) => room.status === "pending");

  const updateRoom = (roomNumber: string, changes: Partial<Pick<Room, "status" | "note" | "followUp" | "visitedAt">>) => {
    db.runSync(
      "UPDATE rooms SET status = COALESCE(?, status), note = COALESCE(?, note), follow_up = COALESCE(?, follow_up), visited_at = COALESCE(?, visited_at) WHERE room_number = ?",
      changes.status ?? null,
      changes.note ?? null,
      changes.followUp ?? null,
      changes.visitedAt ?? null,
      roomNumber
    );
    setSelected((current) => current?.roomNumber === roomNumber ? { ...current, ...changes } : current);
    setRooms((current) => current.map((room) => room.roomNumber === roomNumber ? { ...room, ...changes } : room));
  };

  const closeSelected = () => {
    Keyboard.dismiss();
    setSelected(null);
  };

  const setSelectedStatus = (status: Status) => {
    if (!selected) return;
    changeStatus(selected.roomNumber, status, selected.status);
    closeSelected();
  };

  const changeStatus = (roomNumber: string, status: Status, previousStatus: Status) => {
    if (status === previousStatus) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const room = rooms.find((item) => item.roomNumber === roomNumber);
    updateRoom(roomNumber, recordVisit({ ...room!, status }, new Date().toISOString()));
    setLastStatusChange({ roomNumber, previousStatus });
  };

  const undoStatusChange = () => {
    if (!lastStatusChange) return;
    const room = rooms.find((item) => item.roomNumber === lastStatusChange.roomNumber);
    if (!room) return;
    changeStatus(room.roomNumber, lastStatusChange.previousStatus, room.status);
    setLastStatusChange(null);
  };

  const exportRooms = async () => {
    if (exporting) return;
    setExportError(null);
    setExporting(true);
    try {
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error("Sharing is not available on this device.");
      }
      const csv = roomLogCsv(rooms, labels);
      const file = new File(Paths.cache, `courtyard-room-log-${new Date().toISOString().slice(0, 10)}.csv`);
      file.create({ overwrite: true });
      file.write(csv);
      await Sharing.shareAsync(file.uri, {
        mimeType: "text/csv",
        dialogTitle: "Share room log",
      });
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "The room log could not be exported.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.background}>
        <Animated.View style={[styles.orb, styles.orbOne, { opacity: ambient.interpolate({ inputRange: [0, 1], outputRange: [0.26, 0.52] }), transform: [{ translateY: ambient.interpolate({ inputRange: [0, 1], outputRange: [0, 42] }) }, { scale: ambient.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }] }]} />
        <Animated.View style={[styles.orb, styles.orbTwo, { opacity: ambient.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.38] }), transform: [{ translateX: ambient.interpolate({ inputRange: [0, 1], outputRange: [0, -34] }) }, { scale: ambient.interpolate({ inputRange: [0, 1], outputRange: [1.12, 0.92] }) }] }]} />
      </View>
      <View style={styles.container}>
        <View style={styles.header}>
        <View style={styles.brandBlock}><View style={styles.brandMark}><Text style={styles.brandMarkText}>CP</Text></View><View><Text style={styles.kicker}>COURTYARD RESIDENCE · FLOOR 05</Text><Text style={styles.title}>Room tracker</Text></View></View>
        <View style={styles.headerActions}>
          <Pressable accessibilityLabel="Export room log" accessibilityRole="button" disabled={exporting} onPress={exportRooms} style={({ pressed }) => [styles.exportButton, pressed && styles.exportPressed, exporting && styles.exportDisabled]}>
            <Text style={styles.exportIcon}>{exporting ? "…" : "↑"}</Text><Text style={styles.exportText}>{exporting ? "Preparing" : "Export"}</Text>
          </Pressable>
          <View style={styles.localBadge}><Text style={styles.localBadgeText}>ON DEVICE</Text></View>
        </View>
        </View>
        {exportError ? <View style={styles.errorBanner}><Text style={styles.errorText}>{exportError}</Text><Pressable accessibilityLabel="Dismiss export error" accessibilityRole="button" onPress={() => setExportError(null)}><Text style={styles.errorDismiss}>×</Text></Pressable></View> : null}
        <View style={styles.summary}>
          <View style={styles.summaryHeading}><Text style={styles.kicker}>CHECK-IN PROGRESS</Text><Text style={styles.summaryLive}>● LIVE</Text></View>
          <Text style={styles.total}>{progressCount(rooms)}<Text style={styles.totalSmall}> / {rooms.length}</Text></Text>
          <Text style={styles.subtle}>rooms visited · saved on this phone</Text>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${rooms.length ? ((counts.connected + counts.not_answered) / rooms.length) * 100 : 0}%` }]} /></View>
          <Pressable
            accessibilityLabel={nextRoom ? `Open next pending room ${nextRoom.roomNumber}` : "All rooms checked"}
            accessibilityRole="button"
            disabled={!nextRoom}
            onPress={() => nextRoom && setSelected(nextRoom)}
            style={({ pressed }) => [styles.nextRoomButton, !nextRoom && styles.nextRoomDisabled, pressed && nextRoom && styles.nextRoomPressed]}
          >
            <Text style={styles.nextRoomIcon}>{nextRoom ? "→" : "✓"}</Text>
            <View style={styles.nextRoomCopy}>
              <Text style={[styles.nextRoomEyebrow, !nextRoom && styles.nextRoomDisabledText]}>{nextRoom ? "KEEP MOVING" : "FLOOR COMPLETE"}</Text>
              <Text style={[styles.nextRoomTitle, !nextRoom && styles.nextRoomDisabledText]}>{nextRoom ? `Open room ${nextRoom.roomNumber}` : "Every room has a status"}</Text>
            </View>
            {nextRoom ? <Text style={styles.nextRoomArrow}>›</Text> : null}
          </Pressable>
          <View style={styles.legend}>
            {(["connected", "not_answered", "pending"] as Status[]).map((status) => (
              <Pressable key={status} onPress={() => setFilter(filter === status ? "all" : status)} style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: colors[status] }]} /><Text style={styles.subtle}>{counts[status]} {status === "not_answered" ? "no answer" : status}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        {lastStatusChange ? (
          <View style={styles.undoBanner}>
            <Text style={styles.undoText}>Room {lastStatusChange.roomNumber} updated</Text>
            <Pressable accessibilityLabel="Undo last room status change" accessibilityRole="button" onPress={undoStatusChange} style={({ pressed }) => [styles.undoButton, pressed && styles.quickActionPressed]}>
              <Text style={styles.undoButtonText}>Undo</Text>
            </Pressable>
          </View>
        ) : null}
        <View style={styles.toolbar}>
          <View style={styles.directoryHeading}><Text style={styles.directoryTitle}>ROOM DIRECTORY</Text><Text style={styles.directoryCount}>{visibleRooms.length} shown</Text></View>
          <Animated.View style={[styles.searchShell, searchFocused && styles.searchShellFocused]}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput value={search} onChangeText={setSearch} onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} placeholder="Search room number" placeholderTextColor="#718894" style={styles.search} />
            {search.length > 0 && <Pressable accessibilityLabel="Clear room search" accessibilityRole="button" hitSlop={10} onPress={() => setSearch("")} style={styles.clearSearch}><Text style={styles.clearSearchText}>×</Text></Pressable>}
          </Animated.View>
          <View style={styles.filters}>{(["all", "pending", "connected", "not_answered"] as const).map((value) => <Pressable key={value} onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setFilter(value); }} style={[styles.filterButton, filter === value && !showFollowUps && styles.filterActive]}><Text style={[styles.filterText, filter === value && !showFollowUps && styles.filterTextActive]}>{value === "all" ? "All" : value === "not_answered" ? "No answer" : value}</Text></Pressable>)}<Pressable onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setShowFollowUps((current) => !current); }} style={[styles.filterButton, showFollowUps && styles.followUpActive]}><Text style={[styles.filterText, showFollowUps && styles.filterTextActive]}>↗ Follow-up</Text></Pressable></View>
        </View>
        <FlatList data={visibleRooms} keyExtractor={(room) => room.roomNumber} numColumns={3} columnWrapperStyle={styles.row} contentContainerStyle={styles.grid} ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}><Text style={styles.emptyIconText}>{search ? "⌕" : "✓"}</Text></View>
            <Text style={styles.emptyTitle}>{search ? "No rooms found" : "Nothing in this view"}</Text>
            <Text style={styles.emptyText}>{search ? `No room matches “${search}”. Try another number.` : "Try a different status or follow-up filter."}</Text>
          </View>
        } renderItem={({ item }) => (
          <Pressable accessibilityLabel={`Open room ${item.roomNumber}`} accessibilityHint="Edit room status and conversation notes" accessibilityRole="button" onPress={() => setSelected(item)} style={({ pressed }) => [styles.card, { backgroundColor: backgrounds[item.status] }, pressed && styles.cardPressed]}>
            <View style={styles.cardTop}><Text style={styles.roomNumber}>{item.roomNumber}</Text>{item.followUp === 1 ? <View style={styles.followUpBadge}><Text style={styles.followUpBadgeText}>↗</Text></View> : null}</View>
            <View style={styles.cardStatusRow}><View style={[styles.statusRail, { backgroundColor: colors[item.status] }]} /><Text style={styles.cardStatus}>{labels[item.status]}</Text></View>
            <Text style={styles.visitTime}>{item.visitedAt ? `Visited ${new Date(item.visitedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Not visited yet"}</Text>
            {item.note ? <Text style={styles.noteMark}>NOTE ADDED</Text> : <Text style={styles.notePlaceholder}>No notes yet</Text>}
            {item.status === "pending" ? (
              <Pressable
                accessibilityLabel={`Mark room ${item.roomNumber} connected`}
                accessibilityRole="button"
                onPress={() => {
                  changeStatus(item.roomNumber, "connected", item.status);
                }}
                style={({ pressed }) => [styles.quickAction, pressed && styles.quickActionPressed]}
              >
                <Text style={styles.quickActionText}>✓ Visit</Text>
              </Pressable>
            ) : null}
          </Pressable>
        )} />
      </View>
      <Modal visible={Boolean(selected)} animationType="slide" transparent onRequestClose={closeSelected}>
        <Pressable onPress={closeSelected} style={styles.modalBackdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            pointerEvents="box-none"
            style={styles.modalKeyboard}
          >
          <ScrollView
            contentContainerStyle={styles.sheetScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Pressable onPress={() => undefined} style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Pressable
            accessibilityLabel="Close room details"
            accessibilityRole="button"
            hitSlop={12}
            onPress={closeSelected}
            style={styles.close}
          >
            <Text style={styles.closeText}>×</Text>
          </Pressable>
          <Text style={styles.kicker}>ROOM</Text><Text style={styles.sheetTitle}>{selected?.roomNumber}</Text>
          <Text style={styles.sheetStatus}><View style={[styles.dot, { backgroundColor: colors[selected?.status ?? "pending"] }]} /> {labels[selected?.status ?? "pending"]}</Text>
          <Text style={styles.actionLabel}>UPDATE ROOM STATUS</Text>
          <View style={styles.actions}><Pressable accessibilityLabel="Mark room connected" accessibilityRole="button" style={[styles.action, styles.connect]} onPress={() => setSelectedStatus("connected")}><Text style={styles.actionLight}>✓ Connected</Text></Pressable><Pressable accessibilityLabel="Mark room no answer" accessibilityRole="button" style={[styles.action, styles.noAnswer]} onPress={() => setSelectedStatus("not_answered")}><Text style={styles.actionDark}>No answer</Text></Pressable><Pressable accessibilityLabel="Reset room status" accessibilityRole="button" style={[styles.action, styles.reset]} onPress={() => setSelectedStatus("pending")}><Text style={styles.actionDark}>Reset</Text></Pressable></View>
          <Pressable accessibilityLabel={selected?.followUp ? "Remove room follow-up flag" : "Flag room for follow-up"} accessibilityRole="checkbox" accessibilityState={{ checked: selected?.followUp === 1 }} onPress={() => {
            if (!selected) return;
            updateRoom(selected.roomNumber, { followUp: selected.followUp === 1 ? 0 : 1 });
          }} style={styles.followUpToggle}>
            <View style={[styles.followUpBox, selected?.followUp === 1 && styles.followUpBoxChecked]}><Text style={styles.followUpCheck}>{selected?.followUp === 1 ? "✓" : ""}</Text></View>
            <View><Text style={styles.followUpTitle}>Needs follow-up</Text><Text style={styles.followUpHint}>Keep this room in your action queue</Text></View>
          </Pressable>
          <Text style={styles.noteLabel}>CONVERSATION NOTES</Text>
          <TextInput multiline maxLength={NOTE_MAX_LENGTH} value={selected?.note ?? ""} onChangeText={(note) => {
            if (!selected) return;
            updateRoom(selected.roomNumber, { note });
          }} placeholder="What did you talk about? Add a follow-up..." placeholderTextColor="#829088" style={styles.notes} />
          <View style={styles.noteFooter}><Text style={styles.saved}>Saved locally on this device</Text><Text style={styles.noteCount}>{selected?.note.length ?? 0}/{NOTE_MAX_LENGTH}</Text></View>
            </Pressable>
          </ScrollView>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const labels: Record<Status, string> = { pending: "Not checked", connected: "Connected", not_answered: "Not answered" };
const colors: Record<Status, string> = { pending: "#aeb8ad", connected: "#287d65", not_answered: "#d2805d" };
const backgrounds: Record<Status, string> = { pending: "#10232d", connected: "#123d3c", not_answered: "#3c292d" };
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#08121a" }, background: { ...StyleSheet.absoluteFill, overflow: "hidden", backgroundColor: "#08121a" }, orb: { position: "absolute", borderRadius: 999 }, orbOne: { width: 300, height: 300, backgroundColor: "#00d6b4", top: -110, right: -80 }, orbTwo: { width: 260, height: 260, backgroundColor: "#7d5cff", bottom: 80, left: -150 }, container: { flex: 1, paddingHorizontal: 18 },
  header: { paddingTop: 18, paddingBottom: 22, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }, brandBlock: { flexDirection: "row", alignItems: "center", gap: 11 }, brandMark: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#62f0d5", shadowColor: "#62f0d5", shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }, brandMarkText: { color: "#08121a", fontSize: 14, fontWeight: "900", letterSpacing: -0.5 }, kicker: { fontSize: 10, letterSpacing: 1.2, color: "#8da2ac", fontWeight: "700", marginBottom: 7 }, title: { fontSize: 36, letterSpacing: -1.8, fontWeight: "800", color: "#f5fbff" }, headerActions: { alignItems: "flex-end", gap: 8 }, exportButton: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 18, backgroundColor: "#62f0d5", paddingHorizontal: 11, paddingVertical: 7 }, exportPressed: { transform: [{ scale: 0.94 }], backgroundColor: "#b1fff0" }, exportDisabled: { opacity: 0.65 }, exportIcon: { color: "#08121a", fontSize: 16, fontWeight: "900" }, exportText: { color: "#08121a", fontSize: 10, fontWeight: "800" }, localBadge: { borderRadius: 20, borderWidth: 1, borderColor: "#29444f", paddingHorizontal: 10, paddingVertical: 7 }, localBadgeText: { fontSize: 9, color: "#62f0d5", fontWeight: "800" },
  errorBanner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#4b282c", borderRadius: 12, borderWidth: 1, borderColor: "#a95455", padding: 11, marginBottom: 12 }, errorText: { flex: 1, color: "#ffd6d0", fontSize: 12 }, errorDismiss: { color: "#ffd6d0", fontSize: 22, paddingLeft: 10 },
  summary: { backgroundColor: "#102b35", borderRadius: 24, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: "#1d4650", shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 5 }, summaryHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, summaryLive: { color: "#62f0d5", fontSize: 10, fontWeight: "800", letterSpacing: 1 }, total: { fontSize: 52, lineHeight: 56, fontWeight: "800", letterSpacing: -2.5, color: "#f5fbff" }, totalSmall: { fontSize: 18, letterSpacing: 0 }, subtle: { color: "#a9bcc3", fontSize: 12 }, progressTrack: { height: 10, backgroundColor: "#1b4550", borderRadius: 10, marginVertical: 17, overflow: "hidden" }, progressFill: { height: "100%", backgroundColor: "#62f0d5", borderRadius: 10 }, nextRoomButton: { flexDirection: "row", alignItems: "center", backgroundColor: "#62f0d5", borderRadius: 13, padding: 11, marginBottom: 17 }, nextRoomDisabled: { backgroundColor: "#23434a" }, nextRoomPressed: { transform: [{ scale: 0.98 }], backgroundColor: "#a5fff0" }, nextRoomIcon: { color: "#08121a", fontSize: 23, fontWeight: "800", width: 30, textAlign: "center" }, nextRoomCopy: { flex: 1 }, nextRoomEyebrow: { color: "#246357", fontSize: 9, fontWeight: "800", letterSpacing: 1 }, nextRoomTitle: { color: "#08121a", fontSize: 13, fontWeight: "800", marginTop: 2 }, nextRoomDisabledText: { color: "#9bb6b8" }, nextRoomArrow: { color: "#08121a", fontSize: 25, fontWeight: "300" }, legend: { flexDirection: "row", gap: 12, flexWrap: "wrap" }, legendItem: { flexDirection: "row", alignItems: "center" }, dot: { width: 9, height: 9, borderRadius: 5, marginRight: 5 },
  undoBanner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#18343e", borderRadius: 13, borderWidth: 1, borderColor: "#2b5961", paddingVertical: 9, paddingHorizontal: 13, marginBottom: 12 }, undoText: { color: "#c5d5d8", fontSize: 12, fontWeight: "600" }, undoButton: { backgroundColor: "#f0c674", borderRadius: 9, paddingHorizontal: 12, paddingVertical: 6 }, undoButtonText: { color: "#08121a", fontSize: 11, fontWeight: "800" },
  toolbar: { marginBottom: 12 }, directoryHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8, paddingHorizontal: 2 }, directoryTitle: { color: "#d7e5e7", fontSize: 11, fontWeight: "800", letterSpacing: 1.4 }, directoryCount: { color: "#718894", fontSize: 11, fontWeight: "600" }, searchShell: { flexDirection: "row", alignItems: "center", backgroundColor: "#10232d", borderWidth: 1, borderColor: "#28424d", borderRadius: 16, paddingHorizontal: 13, marginBottom: 10, minHeight: 52 }, searchShellFocused: { borderColor: "#62f0d5", shadowColor: "#62f0d5", shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } }, searchIcon: { color: "#62f0d5", fontSize: 22, marginRight: 5 }, search: { flex: 1, paddingVertical: 12, fontSize: 15, color: "#f5fbff" }, clearSearch: { padding: 4 }, clearSearchText: { color: "#a9bcc3", fontSize: 21 }, filters: { flexDirection: "row", gap: 6, flexWrap: "wrap" }, filterButton: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 15, backgroundColor: "#142c37", borderWidth: 1, borderColor: "#28424d" }, filterActive: { backgroundColor: "#62f0d5", borderColor: "#62f0d5" }, followUpActive: { backgroundColor: "#f0c674", borderColor: "#f0c674" }, filterText: { fontSize: 11, color: "#a9bcc3", fontWeight: "600" }, filterTextActive: { color: "#08121a", fontWeight: "800" },
  grid: { paddingBottom: 25 }, emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 52, paddingHorizontal: 28 }, emptyIcon: { width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#18343e", borderWidth: 1, borderColor: "#2b5961", marginBottom: 15 }, emptyIconText: { color: "#62f0d5", fontSize: 27, fontWeight: "700" }, emptyTitle: { color: "#f5fbff", fontSize: 18, fontWeight: "800", marginBottom: 6 }, emptyText: { color: "#8da2ac", fontSize: 13, lineHeight: 20, textAlign: "center" }, row: { gap: 8, marginBottom: 8 }, card: { flex: 1, minHeight: 112, borderRadius: 16, padding: 12, justifyContent: "space-between", borderWidth: 1, borderColor: "#28424d", shadowColor: "#000", shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 }, cardPressed: { transform: [{ scale: 0.97 }], opacity: 0.9 }, cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }, roomNumber: { fontSize: 17, fontWeight: "800", color: "#f5fbff", letterSpacing: 0.2 }, followUpBadge: { width: 22, height: 22, borderRadius: 7, alignItems: "center", justifyContent: "center", backgroundColor: "#f0c674" }, followUpBadgeText: { color: "#08121a", fontSize: 14, fontWeight: "900" }, cardStatusRow: { flexDirection: "row", alignItems: "center", marginTop: 10 }, statusRail: { width: 4, height: 14, borderRadius: 3, marginRight: 6 }, cardStatus: { fontSize: 10, color: "#c2d0d2", fontWeight: "700" }, visitTime: { fontSize: 9, color: "#718894", marginTop: 4 }, noteMark: { fontSize: 9, color: "#62f0d5", fontWeight: "800", letterSpacing: 0.4 }, notePlaceholder: { fontSize: 9, color: "#718894", fontWeight: "600" }, quickAction: { alignSelf: "flex-start", marginTop: 7, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: "#62f0d5" }, quickActionPressed: { backgroundColor: "#b1fff0", transform: [{ scale: 0.95 }] }, quickActionText: { color: "#08121a", fontSize: 10, fontWeight: "800" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "#00000099" }, modalKeyboard: { flex: 1, justifyContent: "flex-end" }, sheetScrollContent: { justifyContent: "flex-end", flexGrow: 1 }, sheet: { backgroundColor: "#0d1d26", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 26, paddingTop: 31, paddingBottom: 36, borderWidth: 1, borderColor: "#28424d", shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 22, shadowOffset: { width: 0, height: -8 }, elevation: 10 }, sheetHandle: { position: "absolute", top: 10, alignSelf: "center", width: 42, height: 4, borderRadius: 3, backgroundColor: "#52717a" }, close: { position: "absolute", right: 12, top: 8, width: 44, height: 44, alignItems: "center", justifyContent: "center", zIndex: 1 }, closeText: { fontSize: 30, lineHeight: 34, color: "#a9bcc3" }, sheetTitle: { fontSize: 52, letterSpacing: -2.5, fontWeight: "800", color: "#f5fbff" }, sheetStatus: { color: "#a9bcc3", marginTop: 5, marginBottom: 22 }, actionLabel: { color: "#718894", fontSize: 10, letterSpacing: 1.1, fontWeight: "800", marginBottom: 9 }, actions: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 24 }, action: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 11 }, connect: { backgroundColor: "#287d65" }, noAnswer: { backgroundColor: "#d2805d" }, reset: { backgroundColor: "#28424d" }, actionLight: { color: "#fff", fontWeight: "700", fontSize: 12 }, actionDark: { color: "#f5fbff", fontWeight: "700", fontSize: 12 }, followUpToggle: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, borderColor: "#385766", backgroundColor: "#10232d", padding: 13, marginBottom: 19 }, followUpBox: { width: 24, height: 24, borderRadius: 7, borderWidth: 1, borderColor: "#6d8b91", marginRight: 10, alignItems: "center", justifyContent: "center" }, followUpBoxChecked: { backgroundColor: "#f0c674", borderColor: "#f0c674" }, followUpCheck: { color: "#08121a", fontWeight: "900" }, followUpTitle: { color: "#f5fbff", fontSize: 13, fontWeight: "800" }, followUpHint: { color: "#8da2ac", fontSize: 11, marginTop: 2 }, noteLabel: { fontWeight: "800", fontSize: 11, letterSpacing: 1.1, color: "#718894" }, notes: { minHeight: 180, maxHeight: 300, borderWidth: 1, borderColor: "#385766", borderRadius: 14, marginTop: 9, padding: 13, textAlignVertical: "top", color: "#f5fbff", backgroundColor: "#10232d" }, noteFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, saved: { marginTop: 10, color: "#8da2ac", fontSize: 11 }, noteCount: { marginTop: 10, color: "#8da2ac", fontSize: 11 },
});

export default App;
