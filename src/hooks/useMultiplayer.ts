import { useState, useEffect, useRef, useCallback } from 'react';
import type { MultiplayerPlayer } from '../types';

function getWsUrl(): string {
  const isDev = window.location.port === '5173';
  if (isDev) return 'ws://localhost:3000';
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}`;
}

export type RoomStatus = 'idle' | 'connecting' | 'lobby' | 'playing' | 'disconnected' | 'not_found' | 'kicked';

export interface MultiplayerState {
  status: RoomStatus;
  roomCode: string | null;
  playerId: string | null;
  players: MultiplayerPlayer[];
  isHost: boolean;
  // Game state received from host (for non-host players)
  gameState: any | null;
  // Turn data received from host (private card for active describer)
  turnData: any | null;
  // Actions from players received by host
  lastPlayerAction: { playerId: string; action: string } | null;
  // Game started info
  startedData: { settings: any; teams: any; players: MultiplayerPlayer[] } | null;
}

export function useMultiplayer() {
  const wsRef = useRef<WebSocket | null>(null);
  const [state, setState] = useState<MultiplayerState>({
    status: 'idle',
    roomCode: null,
    playerId: null,
    players: [],
    isHost: false,
    gameState: null,
    turnData: null,
    lastPlayerAction: null,
    startedData: null,
  });

  const send = useCallback((msg: object) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    setState(s => ({ ...s, status: 'connecting' }));

    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {};

    ws.onmessage = (event) => {
      let msg: any;
      try { msg = JSON.parse(event.data); } catch { return; }

      switch (msg.type) {
        case 'room_created':
          setState(s => ({
            ...s,
            status: 'lobby',
            roomCode: msg.roomCode,
            playerId: msg.playerId,
            players: msg.players,
            isHost: true,
          }));
          break;

        case 'room_joined':
          setState(s => ({
            ...s,
            status: 'lobby',
            roomCode: msg.roomCode,
            playerId: msg.playerId,
            players: msg.players,
            isHost: false,
          }));
          break;

        case 'player_joined':
        case 'player_left':
          setState(s => ({ ...s, players: msg.players }));
          break;

        case 'room_not_found':
          setState(s => ({ ...s, status: 'not_found' }));
          break;

        case 'room_already_started':
          setState(s => ({ ...s, status: 'not_found' }));
          break;

        case 'room_full':
          setState(s => ({ ...s, status: 'not_found' }));
          break;

        case 'kicked':
          setState(s => ({ ...s, status: 'kicked', roomCode: null, playerId: null, players: [] }));
          break;

        case 'host_left':
          setState(s => ({ ...s, status: 'disconnected' }));
          break;

        case 'game_started':
          setState(s => ({
            ...s,
            status: 'playing',
            startedData: { settings: msg.settings, teams: msg.teams, players: msg.players },
          }));
          break;

        case 'game_update':
          setState(s => ({ ...s, gameState: msg.state }));
          break;

        case 'turn_data':
          setState(s => ({ ...s, turnData: msg.data }));
          break;

        case 'player_action':
          setState(s => ({ ...s, lastPlayerAction: { playerId: msg.playerId, action: msg.action } }));
          break;

        case 'game_ended':
          setState(s => ({ ...s, status: 'lobby', gameState: null, turnData: null, startedData: null }));
          break;
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      setState(s => s.status === 'idle' ? s : { ...s, status: 'disconnected' });
    };

    ws.onerror = () => ws.close();
  }, []);

  const createRoom = useCallback((playerName: string) => {
    connect();
    // Wait for connection then send
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        clearInterval(interval);
        send({ type: 'create_room', playerName });
      }
    }, 100);
    setTimeout(() => clearInterval(interval), 5000);
  }, [connect, send]);

  const joinRoom = useCallback((roomCode: string, playerName: string) => {
    connect();
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        clearInterval(interval);
        send({ type: 'join_room', roomCode, playerName });
      }
    }, 100);
    setTimeout(() => clearInterval(interval), 5000);
  }, [connect, send]);

  const startGame = useCallback((settings: any, teams: any) => {
    send({ type: 'start_game', settings, teams });
  }, [send]);

  const kickPlayer = useCallback((playerId: string) => {
    send({ type: 'kick_player', playerId });
  }, [send]);

  const sendGameUpdate = useCallback((publicState: any) => {
    send({ type: 'game_update', state: publicState });
  }, [send]);

  const sendTurnData = useCallback((targetPlayerId: string, data: any) => {
    send({ type: 'turn_data', targetPlayerId, data });
  }, [send]);

  const sendPlayerAction = useCallback((action: string) => {
    send({ type: 'player_action', action });
  }, [send]);

  const endGame = useCallback(() => {
    send({ type: 'end_game' });
  }, [send]);

  const clearTurnData = useCallback(() => {
    setState(s => ({ ...s, turnData: null }));
  }, []);

  const clearPlayerAction = useCallback(() => {
    setState(s => ({ ...s, lastPlayerAction: null }));
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setState({
      status: 'idle', roomCode: null, playerId: null, players: [],
      isHost: false, gameState: null, turnData: null, lastPlayerAction: null, startedData: null,
    });
  }, []);

  useEffect(() => () => { wsRef.current?.close(); }, []);

  return {
    ...state,
    createRoom,
    joinRoom,
    startGame,
    kickPlayer,
    sendGameUpdate,
    sendTurnData,
    sendPlayerAction,
    endGame,
    clearTurnData,
    clearPlayerAction,
    disconnect,
  };
}
