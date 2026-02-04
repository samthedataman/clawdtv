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
          console.log('[WebSocket] ⚠️ Opened but component unmounted, closing');
          ws.close();
          return;
        }

        console.log('[WebSocket] ✅ Connected successfully');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;

        // Send auth immediately
        const authUsername = username || localStorage.getItem('username') || `Anon${Math.floor(Math.random() * 10000)}`;
        console.log('[WebSocket] 🔐 Sending auth for username:', authUsername);
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

          console.log('[WebSocket] 📨 Received message:', data.type, data);

          // Handle auth response
          if (data.type === 'auth_response') {
            authCompletedRef.current = true;
            console.log('[WebSocket] ✅ Authenticated as:', data.username);
            // Note: join_stream messages already sent immediately, no need to queue
          }

          // Ignore heartbeat acks
          if (data.type === 'heartbeat_ack') return;

          // Route message to all subscribers (global)
          const globalSubscriberCount = Array.from(subscribersRef.current.values()).reduce((sum, set) => sum + set.size, 0);
          console.log('[WebSocket] 📡 Routing to', globalSubscriberCount, 'total subscribers');

          subscribersRef.current.forEach((callbacks, subRoomId) => {
            console.log(`[WebSocket]   → Room ${subRoomId}: ${callbacks.size} subscriber(s)`);
            callbacks.forEach(cb => cb(data));
          });

          // Route message to room-specific subscribers
          const roomId = getRoomIdFromMessage(data);
          if (roomId) {
            const roomSubscribers = subscribersRef.current.get(roomId);
            if (roomSubscribers) {
              console.log(`[WebSocket] 🎯 Routing ${data.type} to room ${roomId}: ${roomSubscribers.size} subscriber(s)`);
              roomSubscribers.forEach(cb => cb(data));
            }
          }
        } catch (e) {
          console.error('[WebSocket] ❌ Failed to parse message:', e);
        }
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };

      ws.onclose = () => {
        console.log('[WebSocket] 🔌 Disconnected');
        console.log('[WebSocket] 📊 State at disconnect:', {
          mountedRef: mountedRef.current,
          reconnectAttempts: reconnectAttemptsRef.current,
          joinedRooms: Array.from(joinedRoomsRef.current),
          subscribers: subscribersRef.current.size
        });
        setIsConnected(false);
        authCompletedRef.current = false;

        // Clear heartbeat
        if (heartbeatIntervalRef.current) {
          console.log('[WebSocket] 💓 Clearing heartbeat interval');
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }

        // Try to reconnect
        if (mountedRef.current && reconnectAttemptsRef.current < 10) {
          reconnectAttemptsRef.current += 1;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current - 1), 30000);
          console.log(`[WebSocket] 🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/10)`);

          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              console.log('[WebSocket] 🔄 Attempting reconnection now...');
              connect();
            }
          }, delay);
        } else {
          console.error('[WebSocket] ❌ Max reconnection attempts reached or component unmounted');
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
      console.log(`[WebSocket] 📝 Creating new subscriber set for room: ${roomId}`);
    }
    subscribersRef.current.get(roomId)!.add(callback);

    const subscriberCount = subscribersRef.current.get(roomId)!.size;
    console.log(`[WebSocket] ➕ Subscribed to room ${roomId} (${subscriberCount} total subscribers)`);
    console.log(`[WebSocket] 📊 Total rooms with subscribers: ${subscribersRef.current.size}`);

    // Return cleanup function
    return () => {
      subscribersRef.current.get(roomId)?.delete(callback);
      const remainingCount = subscribersRef.current.get(roomId)?.size || 0;
      console.log(`[WebSocket] ➖ Unsubscribed from room ${roomId} (${remainingCount} remaining)`);

      if (remainingCount === 0) {
        subscribersRef.current.delete(roomId);
        console.log(`[WebSocket] 🗑️ No more subscribers for room ${roomId}, removed from map`);
      }
    };
  }, []);

  const joinRoom = useCallback((roomId: string) => {
    console.log(`[WebSocket] 🚪 joinRoom called for: ${roomId}`);
    console.log(`[WebSocket] 📊 Connection state:`, {
      wsState: wsRef.current?.readyState,
      isOpen: wsRef.current?.readyState === WebSocket.OPEN
    });

    joinedRoomsRef.current.add(roomId);

    // Just send join_stream immediately (like old vanilla JS code did)
    // Server processes messages in order, so auth will complete first
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log(`[WebSocket] ✅ Sending join_stream for room: ${roomId} (not waiting for auth)`);
      wsRef.current.send(JSON.stringify({ type: 'join_stream', roomId }));
    } else {
      console.log(`[WebSocket] ⏳ Cannot join - WebSocket not open yet. Will retry when connected.`);
    }
  }, []);

  const leaveRoom = useCallback((roomId: string) => {
    joinedRoomsRef.current.delete(roomId);
    console.log('[WebSocket] Left room:', roomId);
  }, []);

  const send = useCallback((data: any) => {
    console.log('[WebSocket] 📤 Attempting to send:', data.type);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] ✅ Sending message:', data);
      wsRef.current.send(JSON.stringify(data));
      return true;
    }
    console.warn('[WebSocket] ⚠️ Cannot send - WebSocket not open. State:', wsRef.current?.readyState);
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
