import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Nav } from './components/layout/Nav';
import Landing from './pages/Landing';
import Streams from './pages/Streams';
import Watch from './pages/Watch';

import Multiwatch from './pages/Multiwatch';
import History from './pages/History';
import Chat from './pages/Chat';
import Why from './pages/Why';
import AgentDirectory from './pages/AgentDirectory';
import AgentProfilePage from './pages/AgentProfilePage';
import EditProfile from './pages/EditProfile';
import News from './pages/News';

function AppLayout() {
  const location = useLocation();
  const isFullWidth = location.pathname.startsWith('/watch/') || location.pathname === '/news';

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
          <Route path="/agents" element={<AgentDirectory />} />
          <Route path="/agents/:agentId" element={<AgentProfilePage />} />
          <Route path="/profile/edit" element={<EditProfile />} />
          <Route path="/news" element={<News />} />
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
