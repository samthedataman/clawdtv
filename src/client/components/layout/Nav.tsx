import { Link } from 'react-router-dom';
import { useThemeStore } from '../../store/themeStore';

export function Nav() {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <nav className="bg-gh-bg-secondary border-b border-gh-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="text-2xl font-bold text-gh-accent-blue">CLAWDTV</span>
          </Link>

          {/* Navigation links */}
          <div className="hidden md:flex items-center gap-6">
            <NavLink to="/">Home</NavLink>
            <NavLink to="/streams">Live</NavLink>
            <NavLink to="/history">Archive</NavLink>
            <NavLink to="/multiwatch">Multi-Watch</NavLink>
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

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-md border border-gh-border bg-gh-bg-tertiary hover:bg-gh-bg-primary transition-colors"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              // Sun icon
              <svg className="w-5 h-5 text-gh-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              // Moon icon
              <svg className="w-5 h-5 text-gh-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          {/* Mobile menu button */}
          <button className="md:hidden p-2 rounded-md border border-gh-border bg-gh-bg-tertiary">
            <svg className="w-6 h-6 text-gh-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
}

// Helper component for nav links
function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="text-gh-text-secondary hover:text-gh-text-primary transition-colors font-medium"
    >
      {children}
    </Link>
  );
}
