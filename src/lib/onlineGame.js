const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };


import { QUESTIONS, shuffle } from "./gameData";
import { getSessionId, generateRoomCode } from "./session";

export async function createRoom(hostName, categories) {
  const code = generateRoomCode();
  const sessionId = getSessionId();

  await db.entities.GameRoom.create({
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

  await db.entities.RoomPlayer.create({
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

  const rooms = await db.entities.GameRoom.filter({ room_code: upperCode });
  if (rooms.length === 0) throw new Error("Room not found");

  const room = rooms[0];
  if (room.status === "ended") throw new Error("This game has ended");

  const existing = await db.entities.RoomPlayer.filter({
    room_code: upperCode,
    session_id: sessionId,
  });

  if (existing.length === 0) {
    if (room.status === "playing") throw new Error("Game already in progress");
    const players = await db.entities.RoomPlayer.filter({ room_code: upperCode });
    await db.entities.RoomPlayer.create({
      room_code: upperCode,
      name,
      session_id: sessionId,
      order: players.length,
      is_host: false,
    });
  }

  return upperCode;
}

export async function startGame(roomId, categories, players) {
  const shuffledPlayers = shuffle(
    players.map((p) => ({ name: p.name, session_id: p.session_id }))
  );
  const selectedCats = Object.entries(categories)
    .filter(([_, enabled]) => enabled)
    .map(([cat]) => cat);
  const allQuestions = selectedCats.flatMap((cat) => QUESTIONS[cat]);
  const shuffledQ = shuffle(allQuestions);

  await db.entities.GameRoom.update(roomId, {
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

export async function flipCoin(roomId) {
  const result = Math.random() < 0.5 ? "heads" : "tails";
  await db.entities.GameRoom.update(roomId, {
    phase: "result",
    coin_result: result,
  });
}

export async function nextRound(roomId, room) {
  const nextRoundNum = room.round + 1;
  const playerCount = room.players?.length || 1;

  if (nextRoundNum >= (room.questions?.length || 0)) {
    await db.entities.GameRoom.update(roomId, { status: "ended" });
    return;
  }

  const nextAsker = nextRoundNum % playerCount;
  await db.entities.GameRoom.update(roomId, {
    round: nextRoundNum,
    asker_idx: nextAsker,
    phase: "question",
    current_question: room.questions[nextRoundNum],
    coin_result: "",
  });
}