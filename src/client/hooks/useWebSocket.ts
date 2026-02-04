import { useEffect, useRef, useState, useCallback } from 'react';

interface WebSocketConfig {
  url?: string;
  onMessage: (data: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

export function useWebSocket({ url, onMessage, onConnect, onDisconnect, onError }: WebSocketConfig) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef(false);
  const onMessageRef = useRef(onMessage);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  const connectRef = useRef<(() => void) | null>(null);

  // Keep refs up to date
  useEffect(() => {
    onMessageRef.current = onMessage;
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;
  }, [onMessage, onConnect, onDisconnect]);

  const connect = useCallback(() => {
    // Clear any existing connection (but not if it's still connecting)
    if (wsRef.current && !isConnectingRef.current) {
      wsRef.current.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = url || `${protocol}//${window.location.host}/ws`;

    console.log('[WebSocket] Connecting to:', wsUrl);
    isConnectingRef.current = true;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[WebSocket] Connected');
      isConnectingRef.current = false;
      setIsConnected(true);
      setReconnectAttempts(0);
      onConnectRef.current?.();

      // Start heartbeat to keep connection alive
      heartbeatIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'heartbeat' }));
        }
      }, 30000); // Every 30 seconds
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Ignore heartbeat acknowledgments
        if (data.type !== 'heartbeat_ack') {
          onMessageRef.current(data);
        }
      } catch (e) {
        console.error('[WebSocket] Failed to parse message:', e);
      }
    };

    ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
      isConnectingRef.current = false;
      onError?.(error);
    };

    ws.onclose = () => {
      console.log('[WebSocket] Disconnected');
      isConnectingRef.current = false;
      setIsConnected(false);
      onDisconnectRef.current?.();

      // Clear heartbeat
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }

      // Trigger reconnection by incrementing state (separate effect will handle it)
      setReconnectAttempts(prev => prev + 1);
    };

    wsRef.current = ws;
  }, [url, onError]);

  // Keep connect ref up to date
  connectRef.current = connect;

  // Initial connection - only on mount or URL change
  useEffect(() => {
    connectRef.current?.();

    return () => {
      // Cleanup on unmount
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
  }, [url]); // Only reconnect when URL changes, not when connect function changes

  // Handle reconnection attempts (separate from connect to avoid circular dependency)
  useEffect(() => {
    if (reconnectAttempts > 0 && reconnectAttempts <= 10) {
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);
      console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/10)`);

      reconnectTimeoutRef.current = setTimeout(() => {
        connectRef.current?.(); // Use ref instead of connect directly
      }, delay);

      return () => {
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
      };
    } else if (reconnectAttempts > 10) {
      console.error('[WebSocket] Max reconnection attempts reached');
    }
  }, [reconnectAttempts]); // Remove connect from dependencies

  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
      return true;
    }
    console.warn('[WebSocket] Cannot send - not connected');
    return false;
  }, []);

  return { isConnected, send };
}
