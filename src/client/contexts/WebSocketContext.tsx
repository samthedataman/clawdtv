import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { useAuthStore } from '../store/authStore';

interface WebSocketContextValue {
  isConnected: boolean;
  subscribe: (roomId: string, callback: (data: any) => void) => () => void;
  send: (data: any) => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within WebSocketProvider');
  }
  return context;
}

interface WebSocketProviderProps {
  children: ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const subscribersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());
  const joinedRoomsRef = useRef<Set<string>>(new Set());
  const authCompletedRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const username = useAuthStore(state => state.username);

  useEffect(() => {
    mountedRef.current = true;

    function connect() {
      if (!mountedRef.current) return;

      // Clear existing connection
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      console.log('[WebSocket] Connecting to:', wsUrl);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (!mountedRef.current) {
          ws.close();
          return;
        }

        console.log('[WebSocket] Connected');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;

        // Send auth immediately
        const authUsername = username || localStorage.getItem('username') || `Anon${Math.floor(Math.random() * 10000)}`;
        ws.send(JSON.stringify({ type: 'auth', username: authUsername, role: 'viewer' }));

        // Start heartbeat
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'heartbeat' }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle auth response
          if (data.type === 'auth_response') {
            authCompletedRef.current = true;
            console.log('[WebSocket] Authenticated as:', data.username);

            // Auto-join any rooms that were requested during auth
            joinedRoomsRef.current.forEach(roomId => {
              console.log('[WebSocket] Auto-joining room:', roomId);
              ws.send(JSON.stringify({ type: 'join_stream', roomId }));
            });
          }

          // Ignore heartbeat acks
          if (data.type === 'heartbeat_ack') return;

          // Route message to all subscribers (global)
          subscribersRef.current.forEach((callbacks) => {
            callbacks.forEach(cb => cb(data));
          });

          // Route message to room-specific subscribers
          const roomId = getRoomIdFromMessage(data);
          if (roomId) {
            subscribersRef.current.get(roomId)?.forEach(cb => cb(data));
          }
        } catch (e) {
          console.error('[WebSocket] Failed to parse message:', e);
        }
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };

      ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        setIsConnected(false);
        authCompletedRef.current = false;

        // Clear heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }

        // Try to reconnect
        if (mountedRef.current && reconnectAttemptsRef.current < 10) {
          reconnectAttemptsRef.current += 1;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current - 1), 30000);
          console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/10)`);

          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              connect();
            }
          }, delay);
        }
      };

      wsRef.current = ws;
    }

    // Helper to extract roomId from different message types
    function getRoomIdFromMessage(data: any): string | null {
      // Messages with explicit roomId
      if (data.roomId) return data.roomId;

      // join_stream_response has stream.id
      if (data.type === 'join_stream_response' && data.stream?.id) {
        return data.stream.id;
      }

      return null;
    }

    // Start connection
    connect();

    // Cleanup
    return () => {
      mountedRef.current = false;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }

      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [username]);

  const subscribe = useCallback((roomId: string, callback: (data: any) => void) => {
    // Add subscriber
    if (!subscribersRef.current.has(roomId)) {
      subscribersRef.current.set(roomId, new Set());
    }
    subscribersRef.current.get(roomId)!.add(callback);

    console.log(`[WebSocket] Subscribed to room: ${roomId}`);

    // Return cleanup function
    return () => {
      subscribersRef.current.get(roomId)?.delete(callback);
      if (subscribersRef.current.get(roomId)?.size === 0) {
        subscribersRef.current.delete(roomId);
        console.log(`[WebSocket] Unsubscribed from room: ${roomId}`);
      }
    };
  }, []);

  const joinRoom = useCallback((roomId: string) => {
    joinedRoomsRef.current.add(roomId);

    if (authCompletedRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Joining room:', roomId);
      wsRef.current.send(JSON.stringify({ type: 'join_stream', roomId }));
    } else {
      console.log('[WebSocket] Room join queued (waiting for auth):', roomId);
    }
  }, []);

  const leaveRoom = useCallback((roomId: string) => {
    joinedRoomsRef.current.delete(roomId);
    console.log('[WebSocket] Left room:', roomId);
  }, []);

  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
      return true;
    }
    console.warn('[WebSocket] Cannot send - not connected');
    return false;
  }, []);

  const value: WebSocketContextValue = {
    isConnected,
    subscribe,
    send,
    joinRoom,
    leaveRoom,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}
