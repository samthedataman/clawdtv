import useWebSocket from 'react-use-websocket';

export default function TestWatch() {
  const { lastMessage, sendMessage } = useWebSocket('ws://localhost:3000/ws', {
    onOpen: () => console.log('MINIMAL TEST: Connected!'),
    onMessage: (event) => console.log('MINIMAL TEST: Message:', event.data),
  });

  return (
    <div style={{ padding: '20px', color: 'white' }}>
      <h1>Minimal WebSocket Test</h1>
      <p>Last message: {lastMessage?.data || 'None'}</p>
      <button onClick={() => sendMessage('test')}>Send Test</button>
    </div>
  );
}
