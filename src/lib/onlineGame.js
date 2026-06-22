import {
  db,
} from "./firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
} from "firebase/firestore";
import { QUESTIONS, shuffle } from "./gameData";
import { getSessionId, generateRoomCode } from "./session";

export async function createRoom(hostName, categories) {
  const code = generateRoomCode();
  const sessionId = getSessionId();

  await setDoc(doc(db, "game_rooms", code), {
    room_code: code,
    status: "lobby",
    phase: "question",
    host_session_id: sessionId,
    host_name: hostName,
    categories,
    questions: [],
    players: [],
    round: 0,
    asker_idx: 0,
    current_question: "",
    coin_result: "",
  });

  await addDoc(collection(db, "room_players"), {
    room_code: code,
    name: hostName,
    session_id: sessionId,
    order: 0,
    is_host: true,
  });

  return code;
}

export async function joinRoom(code, name) {
  const sessionId = getSessionId();
  const upperCode = code.toUpperCase().trim();

  const roomRef = doc(db, "game_rooms", upperCode);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) throw new Error("Room not found");

  const room = roomSnap.data();
  if (room.status === "ended") throw new Error("This game has ended");

  const existingQuery = query(
    collection(db, "room_players"),
    where("room_code", "==", upperCode),
    where("session_id", "==", sessionId)
  );
  const existingSnap = await getDocs(existingQuery);

  if (existingSnap.empty) {
    if (room.status === "playing") throw new Error("Game already in progress");
    const allPlayersQuery = query(
      collection(db, "room_players"),
      where("room_code", "==", upperCode)
    );
    const allPlayersSnap = await getDocs(allPlayersQuery);
    await addDoc(collection(db, "room_players"), {
      room_code: upperCode,
      name,
      session_id: sessionId,
      order: allPlayersSnap.size,
      is_host: false,
    });
  }

  return upperCode;
}

export async function startGame(roomCode, categories, players) {
  const shuffledPlayers = shuffle(
    players.map((p) => ({ name: p.name, session_id: p.session_id }))
  );
  const selectedCats = Object.entries(categories)
    .filter(([_, enabled]) => enabled)
    .map(([cat]) => cat);
  const allQuestions = selectedCats.flatMap((cat) => QUESTIONS[cat]);
  const shuffledQ = shuffle(allQuestions);

  await updateDoc(doc(db, "game_rooms", roomCode), {
    status: "playing",
    phase: "question",
    round: 0,
    asker_idx: 0,
    players: shuffledPlayers,
    questions: shuffledQ,
    current_question: shuffledQ[0],
    coin_result: "",
  });
}

export async function flipCoin(roomCode) {
  const result = Math.random() < 0.5 ? "heads" : "tails";
  await updateDoc(doc(db, "game_rooms", roomCode), {
    phase: "result",
    coin_result: result,
  });
}

export async function nextRound(roomCode, room) {
  const nextRoundNum = room.round + 1;
  const playerCount = room.players?.length || 1;

  if (nextRoundNum >= (room.questions?.length || 0)) {
    await updateDoc(doc(db, "game_rooms", roomCode), { status: "ended" });
    return;
  }

  const nextAsker = nextRoundNum % playerCount;
  await updateDoc(doc(db, "game_rooms", roomCode), {
    round: nextRoundNum,
    asker_idx: nextAsker,
    phase: "question",
    current_question: room.questions[nextRoundNum],
    coin_result: "",
  });
}