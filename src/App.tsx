import { ErrorBoundary } from './app/ErrorBoundary';
import { About } from './app/pages/About';
import { Home } from './app/pages/Home';
import { Label } from './app/pages/Label';
import { CheckFlow } from './app/flow/CheckFlow';
import { Icon, Logo } from './app/icons';
import { RecordDetail } from './app/records/RecordDetail';
import { Records } from './app/records/Records';
import { useRoute } from './app/router';
import { useTheme } from './app/theme';
import { LangProvider, LangSelect } from './app/lang';

export function App() {
  const route = useRoute();
  const [theme, toggleTheme] = useTheme();
  const wide = true;
  const current = (name: string) => (route.name === name || (name === 'records' && route.name === 'record') ? 'page' : undefined);

  return (
    <LangProvider>
    <div className="app">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="header">
        <div className={`container ${wide ? 'wide' : ''} header-inner`}>
          <a className="brand" href="#/">
            <span className="brand-mark"><Logo size={34} /></span>
            <span className="brand-text">
              Tandem
              <small>OneAquaHealth stream check</small>
            </span>
          </a>
          <nav className="nav" aria-label="Main">
            <a href="#/check" aria-current={current('check')}>New check</a>
            <a href="#/records" aria-current={current('records')}>Records</a>
            <a href="#/about" className="hide-sm" aria-current={current('about')}>How the AI works</a>
          </nav>
          <LangSelect />
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
          </button>
        </div>
      </header>

      <main id="main">
        <div className={`container ${wide ? 'wide' : ''}`}>
          <ErrorBoundary key={route.name}>
          {route.name === 'home' && <Home />}
          {route.name === 'check' && <CheckFlow />}
          {route.name === 'records' && <Records />}
          {route.name === 'record' && <RecordDetail id={route.id} />}
          {route.name === 'about' && <About />}
          {route.name === 'label' && <Label />}
          </ErrorBoundary>
        </div>
      </main>

      <footer className="footer">
        <div className={`container ${wide ? 'wide' : ''} row between`}>
          <span>Tandem · OneAquaHealth IEEE Global Hackathon 2026 · Track 3: AI-Supported Assessment</span>
          <span>
            <a href="#/about">Model card & privacy</a>
          </span>
        </div>
      </footer>
    </div>
    </LangProvider>
  );
}
