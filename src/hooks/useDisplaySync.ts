import { useState, useEffect, useRef, useCallback } from 'react';
import type { PublicDisplayState } from '../types/display';

function getWsUrl(): string {
  // In dev (Vite on 5173), connect to the Express server on 3000
  // In production, connect to the same host
  const isDev = window.location.port === '5173';
  if (isDev) return 'ws://localhost:3000';
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}`;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'not_found';

/**
 * Hook that connects to the WebSocket server as a DISPLAY client.
 * Receives public display state only — never card/word data.
 */
export function useDisplaySync(gameId: string) {
  const [state, setState] = useState<PublicDisplayState | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const gameIdRef = useRef(gameId);
  gameIdRef.current = gameId;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus('connecting');
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', gameId: gameIdRef.current }));
    };

    ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (msg.type) {
        case 'connected':
          setStatus('connected');
          break;
        case 'not_found':
          setStatus('not_found');
          break;
        case 'state':
          setState(msg.data as PublicDisplayState);
          setStatus('connected');
          break;
        case 'host_disconnected':
          // Keep last state visible, just update status
          setStatus('disconnected');
          break;
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      setStatus((prev) => prev === 'not_found' ? 'not_found' : 'disconnected');
      // Reconnect after 3s unless game not found
      reconnectTimerRef.current = setTimeout(() => {
        setStatus((prev) => {
          if (prev !== 'not_found') connect();
          return prev;
        });
      }, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect, gameId]);

  return { state, status };
}
