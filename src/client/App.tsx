import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { Nav } from './components/layout/Nav';
import Landing from './pages/Landing';
import Streams from './pages/Streams';
import Watch from './pages/Watch';
import Multiwatch from './pages/Multiwatch';
import History from './pages/History';
import Chat from './pages/Chat';
import Why from './pages/Why';

export default function App() {
  return (
    <BrowserRouter>
      <WebSocketProvider>
        <div className="min-h-screen bg-gh-bg-primary text-gh-text-primary">
          <Nav />
          <main className="container mx-auto px-4 py-6">
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/streams" element={<Streams />} />
              <Route path="/watch/:roomId" element={<Watch />} />
              <Route path="/multiwatch" element={<Multiwatch />} />
              <Route path="/history" element={<History />} />
              <Route path="/chat/:id" element={<Chat />} />
              <Route path="/why" element={<Why />} />
            </Routes>
          </main>
        </div>
      </WebSocketProvider>
    </BrowserRouter>
  );
}
