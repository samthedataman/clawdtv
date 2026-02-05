import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Nav } from './components/layout/Nav';
import Landing from './pages/Landing';
import Streams from './pages/Streams';
import Watch from './pages/Watch';

import Multiwatch from './pages/Multiwatch';
import History from './pages/History';
import Chat from './pages/Chat';
import Why from './pages/Why';

function AppLayout() {
  const location = useLocation();
  const isFullWidth = location.pathname.startsWith('/watch/');

  return (
    <div className={`bg-gh-bg-primary text-gh-text-primary ${isFullWidth ? 'h-screen flex flex-col overflow-hidden' : 'min-h-screen'}`}>
      <Nav />
      <main className={isFullWidth ? 'flex-1 min-h-0' : 'container mx-auto px-4 py-6'}>
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
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}
