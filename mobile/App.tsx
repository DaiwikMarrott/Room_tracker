import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Animated,
  KeyboardAvoidingView,
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

type Status = "pending" | "connected" | "not_answered";
type Room = { roomNumber: string; status: Status; note: string };

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
  const [search, setSearch] = useState("");
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
      note TEXT NOT NULL DEFAULT ''
    );`);
    const insert = db.prepareSync("INSERT OR IGNORE INTO rooms (room_number) VALUES (?)");
    try {
      roomNumbers.forEach((roomNumber) => insert.executeSync(roomNumber));
    } finally {
      insert.finalizeSync();
    }
    setRooms(db.getAllSync<Room>(
      "SELECT room_number as roomNumber, status, note FROM rooms ORDER BY room_number"
    ));
  };

  useEffect(() => loadRooms(), []);

  const counts = useMemo(() => rooms.reduce((result, room) => {
    result[room.status] += 1;
    return result;
  }, { pending: 0, connected: 0, not_answered: 0 } as Record<Status, number>), [rooms]);

  const visibleRooms = rooms.filter((room) =>
    room.roomNumber.includes(search) && (filter === "all" || room.status === filter)
  );

  const updateRoom = (roomNumber: string, changes: Partial<Pick<Room, "status" | "note">>) => {
    db.runSync(
      "UPDATE rooms SET status = COALESCE(?, status), note = COALESCE(?, note) WHERE room_number = ?",
      changes.status ?? null,
      changes.note ?? null,
      roomNumber
    );
    setSelected((current) => current?.roomNumber === roomNumber ? { ...current, ...changes } : current);
    setRooms((current) => current.map((room) => room.roomNumber === roomNumber ? { ...room, ...changes } : room));
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
          <View><Text style={styles.kicker}>COURTYARD RESIDENCE · FLOOR 05</Text><Text style={styles.title}>Room tracker</Text></View>
          <View style={styles.localBadge}><Text style={styles.localBadgeText}>ON DEVICE</Text></View>
        </View>
        <View style={styles.summary}>
          <Text style={styles.kicker}>CHECK-IN PROGRESS</Text>
          <Text style={styles.total}>{counts.connected + counts.not_answered}<Text style={styles.totalSmall}> / {rooms.length}</Text></Text>
          <Text style={styles.subtle}>rooms visited · saved on this phone</Text>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${rooms.length ? ((counts.connected + counts.not_answered) / rooms.length) * 100 : 0}%` }]} /></View>
          <View style={styles.legend}>
            {(["connected", "not_answered", "pending"] as Status[]).map((status) => (
              <Pressable key={status} onPress={() => setFilter(filter === status ? "all" : status)} style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: colors[status] }]} /><Text style={styles.subtle}>{counts[status]} {status === "not_answered" ? "no answer" : status}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={styles.toolbar}>
          <TextInput value={search} onChangeText={setSearch} placeholder="Search room number" placeholderTextColor="#829088" style={styles.search} />
          <View style={styles.filters}>{(["all", "pending", "connected", "not_answered"] as const).map((value) => <Pressable key={value} onPress={() => setFilter(value)} style={[styles.filterButton, filter === value && styles.filterActive]}><Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{value === "all" ? "All" : value === "not_answered" ? "No answer" : value}</Text></Pressable>)}</View>
        </View>
        <FlatList data={visibleRooms} keyExtractor={(room) => room.roomNumber} numColumns={3} columnWrapperStyle={styles.row} contentContainerStyle={styles.grid} renderItem={({ item }) => (
          <Pressable onPress={() => setSelected(item)} style={[styles.card, { backgroundColor: backgrounds[item.status] }]}><Text style={styles.roomNumber}>{item.roomNumber}</Text><Text style={styles.cardStatus}>{labels[item.status]}</Text>{item.note ? <Text style={styles.noteMark}>NOTE</Text> : null}</Pressable>
        )} />
      </View>
      <Modal visible={Boolean(selected)} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalBackdrop}
        >
          <ScrollView
            contentContainerStyle={styles.sheetScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.sheet}>
          <Pressable onPress={() => setSelected(null)} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable>
          <Text style={styles.kicker}>ROOM</Text><Text style={styles.sheetTitle}>{selected?.roomNumber}</Text>
          <Text style={styles.sheetStatus}><View style={[styles.dot, { backgroundColor: colors[selected?.status ?? "pending"] }]} /> {labels[selected?.status ?? "pending"]}</Text>
          <View style={styles.actions}><Pressable style={[styles.action, styles.connect]} onPress={() => selected && updateRoom(selected.roomNumber, { status: "connected" })}><Text style={styles.actionLight}>✓ Connected</Text></Pressable><Pressable style={[styles.action, styles.noAnswer]} onPress={() => selected && updateRoom(selected.roomNumber, { status: "not_answered" })}><Text style={styles.actionDark}>No answer</Text></Pressable><Pressable style={[styles.action, styles.reset]} onPress={() => selected && updateRoom(selected.roomNumber, { status: "pending" })}><Text style={styles.actionDark}>Reset</Text></Pressable></View>
          <Text style={styles.noteLabel}>Conversation notes</Text>
          <TextInput multiline value={selected?.note ?? ""} onChangeText={(note) => {
            if (!selected) return;
            updateRoom(selected.roomNumber, { note });
          }} placeholder="What did you talk about? Add a follow-up..." placeholderTextColor="#829088" style={styles.notes} />
          <Text style={styles.saved}>Saved locally on this device</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const labels: Record<Status, string> = { pending: "Not checked", connected: "Connected", not_answered: "Not answered" };
const colors: Record<Status, string> = { pending: "#aeb8ad", connected: "#287d65", not_answered: "#d2805d" };
const backgrounds: Record<Status, string> = { pending: "#ffffff", connected: "#e7f3df", not_answered: "#fff0e9" };
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#08121a" }, background: { ...StyleSheet.absoluteFill, overflow: "hidden", backgroundColor: "#08121a" }, orb: { position: "absolute", borderRadius: 999 }, orbOne: { width: 300, height: 300, backgroundColor: "#00d6b4", top: -110, right: -80 }, orbTwo: { width: 260, height: 260, backgroundColor: "#7d5cff", bottom: 80, left: -150 }, container: { flex: 1, paddingHorizontal: 18 },
  header: { paddingTop: 18, paddingBottom: 22, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }, kicker: { fontSize: 10, letterSpacing: 1.2, color: "#8da2ac", fontWeight: "700", marginBottom: 7 }, title: { fontSize: 36, letterSpacing: -1.8, fontWeight: "800", color: "#f5fbff" }, localBadge: { borderRadius: 20, borderWidth: 1, borderColor: "#29444f", paddingHorizontal: 10, paddingVertical: 7 }, localBadgeText: { fontSize: 9, color: "#62f0d5", fontWeight: "800" },
  summary: { backgroundColor: "#102b35", borderRadius: 20, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: "#1d4650" }, total: { fontSize: 48, lineHeight: 51, fontWeight: "800", letterSpacing: -2, color: "#f5fbff" }, totalSmall: { fontSize: 18, letterSpacing: 0 }, subtle: { color: "#a9bcc3", fontSize: 12 }, progressTrack: { height: 10, backgroundColor: "#1b4550", borderRadius: 10, marginVertical: 17, overflow: "hidden" }, progressFill: { height: "100%", backgroundColor: "#62f0d5", borderRadius: 10 }, legend: { flexDirection: "row", gap: 12, flexWrap: "wrap" }, legendItem: { flexDirection: "row", alignItems: "center" }, dot: { width: 9, height: 9, borderRadius: 5, marginRight: 5 },
  toolbar: { marginBottom: 12 }, search: { borderBottomWidth: 1, borderBottomColor: "#c9d0c4", paddingVertical: 10, fontSize: 15, color: "#10261f", marginBottom: 10 }, filters: { flexDirection: "row", gap: 6 }, filterButton: { paddingVertical: 7, paddingHorizontal: 10, borderRadius: 15, backgroundColor: "#e8ebe4" }, filterActive: { backgroundColor: "#10261f" }, filterText: { fontSize: 11, color: "#526159" }, filterTextActive: { color: "#fff" },
  grid: { paddingBottom: 25 }, row: { gap: 8, marginBottom: 8 }, card: { flex: 1, minHeight: 94, borderRadius: 13, padding: 12, justifyContent: "space-between", borderWidth: 1, borderColor: "#e0e4dc" }, roomNumber: { fontSize: 16, fontWeight: "700", color: "#10261f" }, cardStatus: { fontSize: 10, color: "#718078" }, noteMark: { fontSize: 9, color: "#287d65", fontWeight: "800" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "#10261f66" }, sheetScrollContent: { justifyContent: "flex-end", flexGrow: 1 }, sheet: { backgroundColor: "#fdfdf9", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 26, paddingBottom: 36 }, close: { position: "absolute", right: 18, top: 12, padding: 8 }, closeText: { fontSize: 30, color: "#718078" }, sheetTitle: { fontSize: 48, letterSpacing: -2, fontWeight: "800", color: "#10261f" }, sheetStatus: { color: "#526159", marginTop: 5, marginBottom: 22 }, actions: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 24 }, action: { paddingVertical: 11, paddingHorizontal: 13, borderRadius: 9 }, connect: { backgroundColor: "#287d65" }, noAnswer: { backgroundColor: "#f4d0be" }, reset: { backgroundColor: "#e9ebe4" }, actionLight: { color: "#fff", fontWeight: "700", fontSize: 12 }, actionDark: { color: "#526159", fontWeight: "700", fontSize: 12 }, noteLabel: { fontWeight: "700", fontSize: 13, color: "#10261f" }, notes: { minHeight: 150, maxHeight: 260, borderWidth: 1, borderColor: "#d5d9ce", borderRadius: 12, marginTop: 9, padding: 13, textAlignVertical: "top", color: "#10261f", backgroundColor: "#fff" }, saved: { marginTop: 10, color: "#738078", fontSize: 11 },
});

export default App;
