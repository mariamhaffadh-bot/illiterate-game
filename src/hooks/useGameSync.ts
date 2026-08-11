import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import { createPublicDisplayState } from '../utils/publicState';

function getWsUrl(): string {
  // In dev (Vite on 5173), connect to the Express server on 3000
  // In production, connect to the same host
  const isDev = window.location.port === '5173';
  if (isDev) return 'ws://localhost:3000';
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}`;
}

/**
 * Hook that connects to the WebSocket server as the game HOST
 * and pushes public display state on every store change.
 * Only active when a gameId exists.
 */
export function useGameSync() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const gameIdRef = useRef<string | null>(null);

  const connect = useCallback((gameId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'host', gameId }));
      // Push current state immediately
      pushState(gameId);
    };

    ws.onclose = () => {
      wsRef.current = null;
      // Reconnect after 2s
      if (gameIdRef.current) {
        reconnectTimerRef.current = setTimeout(() => {
          if (gameIdRef.current) connect(gameIdRef.current);
        }, 2000);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  const pushState = useCallback((gameId: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const s = useGameStore.getState();
    const publicState = createPublicDisplayState(gameId, {
      phase: s.phase,
      players: s.players,
      teams: s.teams,
      settings: s.settings,
      boardSpaces: s.boardSpaces,
      currentTeamIndex: s.currentTeamIndex,
      isPaused: s.isPaused,
      animatingTeamId: s.animatingTeamId,
      animationPath: s.animationPath,
      winnerTeamId: s.winnerTeamId,
      finishedTeamIds: s.finishedTeamIds,
      redemptionMode: s.redemptionMode,
      playingForPlacements: s.playingForPlacements,
      liveTurnCategory: s.liveTurn?.category ?? null,
      liveTurnScore: s.liveTurn?.cardResults.filter((c) => c.markedCorrect).length ?? 0,
      confirmedScore: null,
      turnStartedAt: s.turnStartedAt ?? null,
      pausedWithRemaining: s.pausedWithRemaining ?? null,
    });

    ws.send(JSON.stringify({ type: 'state', data: publicState }));
  }, []);

  // Subscribe to store changes and push state
  useEffect(() => {
    const unsub = useGameStore.subscribe((state, prevState) => {
      const gameId = state.gameId;
      if (!gameId) return;

      // Connect on first gameId
      if (gameId !== gameIdRef.current) {
        gameIdRef.current = gameId;
        connect(gameId);
      }

      // Push state on any relevant change
      if (
        state.phase !== prevState.phase ||
        state.teams !== prevState.teams ||
        state.liveTurn !== prevState.liveTurn ||
        state.isPaused !== prevState.isPaused ||
        state.animatingTeamId !== prevState.animatingTeamId ||
        state.animationPath !== prevState.animationPath ||
        state.currentTeamIndex !== prevState.currentTeamIndex ||
        state.winnerTeamId !== prevState.winnerTeamId ||
        state.finishedTeamIds !== prevState.finishedTeamIds ||
        state.turnStartedAt !== prevState.turnStartedAt ||
        state.pausedWithRemaining !== prevState.pausedWithRemaining
      ) {
        pushState(gameId);
      }
    });

    return () => {
      unsub();
      clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
      gameIdRef.current = null;
    };
  }, [connect, pushState]);
}
