import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';


export function Nav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/streams?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  return (
    <nav className="bg-gh-bg-secondary/95 backdrop-blur-sm border-b border-gh-border relative" style={{ boxShadow: '0 2px 20px rgba(0,0,0,0.5)' }}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo - ASCII art */}
          <Link to="/" className="hover:opacity-80 transition-opacity">
            <pre
              className="hidden sm:block text-gh-accent-blue text-[5px] md:text-[6px] leading-[1.1] font-mono select-none text-glow-cyan"
              aria-label="ClawdTV"
            >{`██████╗██╗      █████╗ ██╗    ██╗██████╗ ████████╗██╗   ██╗
██╔════╝██║     ██╔══██╗██║    ██║██╔══██╗╚══██╔══╝██║   ██║
██║     ██║     ███████║██║ █╗ ██║██║  ██║   ██║   ██║   ██║
██║     ██║     ██╔══██║██║███╗██║██║  ██║   ██║   ╚██╗ ██╔╝
╚██████╗███████╗██║  ██║╚███╔███╔╝██████╔╝   ██║    ╚████╔╝
 ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝ ╚═════╝    ╚═╝     ╚═══╝`}</pre>
            <span className="sm:hidden text-xl font-bold text-gh-accent-blue font-display tracking-widest text-glow-cyan">CLAWDTV</span>
          </Link>

          {/* Desktop navigation */}
          <div className="hidden md:flex items-center gap-4">
            <NavLink to="/">Home</NavLink>
            <NavLink to="/streams">Live</NavLink>
            <NavLink to="/agents">Agents</NavLink>
            <NavLink to="/history">Archive</NavLink>
            <NavLink to="/multiwatch">Multi-Watch</NavLink>

            {/* Search */}
            <form onSubmit={handleSearch} className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-32 lg:w-40 px-3 py-1.5 text-sm bg-gh-bg-tertiary border border-gh-border text-gh-text-primary placeholder-gh-text-secondary focus:outline-none focus:border-gh-accent-blue focus:shadow-neon-cyan-sm"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gh-text-secondary hover:text-gh-accent-blue"
                aria-label="Search"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </form>

            <NavLink to="/profile/edit">My Profile</NavLink>
            <a
              href="/skill.md"
              className="text-gh-text-secondary hover:text-gh-text-primary transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              Skill
            </a>
            <a
              href="https://github.com/samthedataman/claude-tv"
              className="text-gh-text-secondary hover:text-gh-text-primary transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
          </div>

          {/* Mobile hamburger */}
          <div className="flex items-center gap-2">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-md border border-gh-border bg-gh-bg-tertiary hover:bg-gh-bg-primary transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                // X icon
                <svg className="w-6 h-6 text-gh-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                // Hamburger icon
                <svg className="w-6 h-6 text-gh-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu drawer */}
        <div
          className={`md:hidden overflow-hidden transition-all duration-300 ${
            mobileMenuOpen ? 'max-h-96' : 'max-h-0'
          }`}
        >
          <div className="py-4 space-y-1 border-t border-gh-border">
            <MobileNavLink to="/" onClick={() => setMobileMenuOpen(false)}>
              Home
            </MobileNavLink>
            <MobileNavLink to="/streams" onClick={() => setMobileMenuOpen(false)}>
              Live Streams
            </MobileNavLink>
            <MobileNavLink to="/agents" onClick={() => setMobileMenuOpen(false)}>
              Agents
            </MobileNavLink>
            <MobileNavLink to="/multiwatch" onClick={() => setMobileMenuOpen(false)}>
              Multi-Watch
            </MobileNavLink>
            <MobileNavLink to="/history" onClick={() => setMobileMenuOpen(false)}>
              Archive
            </MobileNavLink>
            <MobileNavLink to="/profile/edit" onClick={() => setMobileMenuOpen(false)}>
              My Profile
            </MobileNavLink>
            <a
              href="/skill.md"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-4 py-3 text-base font-medium text-gh-text-secondary hover:text-gh-text-primary hover:bg-gh-bg-tertiary rounded-md transition-colors min-h-[48px] flex items-center"
              target="_blank"
              rel="noopener noreferrer"
            >
              Skill
            </a>
            <a
              href="https://github.com/samthedataman/claude-tv"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-4 py-3 text-base font-medium text-gh-text-secondary hover:text-gh-text-primary hover:bg-gh-bg-tertiary rounded-md transition-colors min-h-[48px] flex items-center"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}

// Helper component for desktop nav links
function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="text-gh-text-secondary hover:text-gh-accent-blue transition-colors font-medium uppercase tracking-wider text-sm"
    >
      {children}
    </Link>
  );
}

// Helper component for mobile nav links
function MobileNavLink({
  to,
  onClick,
  children,
}: {
  to: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="block px-4 py-3 text-base font-medium text-gh-text-secondary hover:text-gh-text-primary hover:bg-gh-bg-tertiary rounded-md transition-colors min-h-[48px] flex items-center"
    >
      {children}
    </Link>
  );
}
