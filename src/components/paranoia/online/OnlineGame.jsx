const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from "react";

import { getSessionId } from "@/lib/session";
import OnlineLobby from "@/components/paranoia/online/OnlineLobby";
import HostLobby from "@/components/paranoia/online/HostLobby";
import PlayerLobby from "@/components/paranoia/online/PlayerLobby";
import OnlineQuestionScreen from "@/components/paranoia/online/OnlineQuestionScreen";
import OnlineWaitingScreen from "@/components/paranoia/online/OnlineWaitingScreen";
import OnlineResultScreen from "@/components/paranoia/online/OnlineResultScreen";
import OnlineGameEnd from "@/components/paranoia/online/OnlineGameEnd";

export default function OnlineGame({ onExit }) {
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const sessionId = getSessionId();

  useEffect(() => {
    if (!roomCode) {
      setRoom(null);
      setPlayers([]);
      return;
    }

    let cancelled = false;

    const fetchRoom = async () => {
      try {
        const rooms = await db.entities.GameRoom.filter({ room_code: roomCode });
        if (!cancelled && rooms.length > 0) {
          setRoom(rooms[0]);
        } else if (!cancelled) {
          setRoomCode("");
        }
      } catch (e) {
        if (!cancelled) setRoomCode("");
      }
    };

    const fetchPlayers = async () => {
      try {
        const ps = await db.entities.RoomPlayer.filter({ room_code: roomCode });
        if (!cancelled) {
          setPlayers(ps.sort((a, b) => (a.order || 0) - (b.order || 0)));
        }
      } catch (e) {}
    };

    fetchRoom();
    fetchPlayers();

    const unsubRoom = db.entities.GameRoom.subscribe((event) => {
      if (event.data?.room_code !== roomCode) return;
      if (event.type === "update" || event.type === "create") {
        setRoom(event.data);
      } else if (event.type === "delete") {
        setRoom(null);
        setRoomCode("");
      }
    });

    const unsubPlayers = db.entities.RoomPlayer.subscribe((event) => {
      if (event.data?.room_code === roomCode) {
        fetchPlayers();
      }
    });

    return () => {
      cancelled = true;
      unsubRoom();
      unsubPlayers();
    };
  }, [roomCode]);

  const handleExit = () => {
    setRoomCode("");
    setRoom(null);
    setPlayers([]);
    onExit();
  };

  if (!roomCode) {
    return (
      <OnlineLobby
        onRoomCreated={(code) => setRoomCode(code)}
        onRoomJoined={(code) => setRoomCode(code)}
        onExit={handleExit}
      />
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-zinc-800 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  const isHost = room.host_session_id === sessionId;

  if (room.status === "lobby") {
    return isHost ? (
      <HostLobby room={room} players={players} onExit={handleExit} />
    ) : (
      <PlayerLobby room={room} players={players} onExit={handleExit} />
    );
  }

  if (room.status === "ended") {
    return <OnlineGameEnd onExit={handleExit} />;
  }

  const currentAsker = room.players?.[room.asker_idx];
  const isMyTurn = currentAsker?.session_id === sessionId;

  if (room.phase === "question") {
    if (isMyTurn && currentAsker) {
      const others = (room.players || [])
        .filter((_, i) => i !== room.asker_idx)
        .map((p) => p.name);
      return (
        <OnlineQuestionScreen
          question={room.current_question}
          asker={currentAsker.name}
          others={others}
          roomId={room.id}
        />
      );
    }
    return <OnlineWaitingScreen asker={currentAsker?.name || "?"} phase="question" />;
  }

  if (room.phase === "result") {
    return (
      <OnlineResultScreen
        coinResult={room.coin_result}
        question={room.current_question}
        asker={currentAsker?.name || "?"}
        isAsker={isMyTurn}
        roomId={room.id}
        room={room}
      />
    );
  }

  return null;
}