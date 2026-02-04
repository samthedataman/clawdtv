import { useState } from 'react';
import { useParams } from 'react-router-dom';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import { Terminal } from '../components/terminal/Terminal';

export default function Watch() {
  const { roomId } = useParams<{ roomId: string }>();
  const [terminalBuffer, setTerminalBuffer] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [isJoined, setIsJoined] = useState(false);

  const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = typeof window !== 'undefined' ? `${protocol}://${window.location.host}/ws` : null;

  const { sendJsonMessage, readyState } = useWebSocket(wsUrl, {
    onOpen: () => {
      console.log('✅ Connected');
      const username = `Anon${Math.floor(Math.random() * 10000)}`;
      sendJsonMessage({ type: 'auth', username, role: 'viewer' });
      sendJsonMessage({ type: 'join_stream', roomId });
    },
    onMessage: (event) => {
      const data = JSON.parse(event.data);
      console.log('📨', data.type);

      if (data.type === 'join_stream_response' && data.success) {
        console.log('✅ Joined stream');
        setIsJoined(true);
        if (data.terminalBuffer) setTerminalBuffer(data.terminalBuffer);
        if (data.recentMessages) setMessages(data.recentMessages);
      }

      if (data.type === 'terminal') {
        setTerminalBuffer(prev => prev + data.data);
      }

      if (data.type === 'chat') {
        setMessages(prev => [...prev, data]);
      }
    },
    shouldReconnect: () => true,
  });

  const isConnected = readyState === ReadyState.OPEN;

  return (
    <div style={{ padding: '20px' }}>
      <h1 style={{ color: 'white', marginBottom: '20px' }}>
        {isConnected ? '🔴 LIVE' : '⏸️ Connecting...'}
      </h1>

      <div style={{ display: 'flex', gap: '20px' }}>
        <div style={{ flex: 1, background: 'black', border: '1px solid #333', borderRadius: '8px', overflow: 'hidden', height: '600px' }}>
          <Terminal data={terminalBuffer} />
        </div>

        <div style={{ width: '400px', background: '#1a1a2e', border: '1px solid #333', borderRadius: '8px', padding: '10px' }}>
          <h3 style={{ color: 'white' }}>Chat</h3>
          <div style={{ maxHeight: '500px', overflow: 'auto' }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ color: 'white', marginBottom: '10px' }}>
                <strong>{msg.username}:</strong> {msg.content}
              </div>
            ))}
          </div>
          <input
            type="text"
            placeholder="Type message..."
            style={{ width: '100%', padding: '8px', marginTop: '10px' }}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && isJoined) {
                sendJsonMessage({ type: 'send_chat', content: e.currentTarget.value });
                e.currentTarget.value = '';
              }
            }}
            disabled={!isJoined}
          />
        </div>
      </div>
    </div>
  );
}
