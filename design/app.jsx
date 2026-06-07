/* Summer Planner — app shell: nav, routing, theming, tweaks. */

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
  { id: 'paychecks', label: 'Paychecks', icon: 'wallet' },
  { id: 'expenses',  label: 'Expenses',  icon: 'receipt' },
  { id: 'accounts',  label: 'Accounts',  icon: 'bank' },
  { id: 'weekly',    label: 'Weekly',    icon: 'calendar' },
  { id: 'settings',  label: 'Settings',  icon: 'gear' },
];
const SCREENS = {
  dashboard: (go) => <Dashboard go={go} />,
  paychecks: () => <Paychecks />,
  expenses: () => <Expenses />,
  accounts: () => <Accounts />,
  weekly: () => <Weekly />,
  settings: () => <Settings />,
};

const ACCENTS = [
  { hex: '#ec6a4d', name: 'Coral' },
  { hex: '#d6557f', name: 'Magenta' },
  { hex: '#8a6fe0', name: 'Violet' },
  { hex: '#2ba89a', name: 'Teal' },
];
const FONTS = {
  Editorial: "'Bricolage Grotesque', 'Space Grotesk', system-ui, sans-serif",
  Geometric: "'Space Grotesk', 'Bricolage Grotesque', system-ui, sans-serif",
};
const MOTION = { Off: 0, Subtle: 0.6, Lively: 1, Showy: 1.3 };
const CORNERS = { Soft: '20px', Medium: '14px', Sharp: '8px' };

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "dark",
  "accent": "#ec6a4d",
  "motion": "Lively",
  "font": "Editorial",
  "corners": "Soft",
  "fx": true
}/*EDITMODE-END*/;

function VaultMiniTop({ go }) {
  const { summary } = window.SP;
  const v = summary.vault;
  return (
    <button className="vaultmini-top" onClick={() => go('accounts')} style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
      background: 'color-mix(in oklch, var(--ink-1) 5%, transparent)', border: '1px solid var(--hair)', borderRadius: 999, padding: '5px 15px 5px 5px' }}>
      <Ring value={v.pct} size={34} stroke={5} track="var(--ring-track)" gradient={['var(--gold)', 'var(--accent)']}>
        <span style={{ font: '700 10px var(--display)', color: 'var(--ink-1)' }}>{Math.round(v.pct * 100)}</span>
      </Ring>
      <div style={{ textAlign: 'left' }}>
        <div style={{ font: '600 9.5px/1 var(--ui)', letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>Vault</div>
        <div style={{ font: '700 13px/1.25 var(--display)', color: 'var(--ink-1)', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(v.current)}</div>
      </div>
    </button>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [screen, setScreen] = React.useState('dashboard');
  const go = React.useCallback((s) => { setScreen(s); window.scrollTo({ top: 0, behavior: 'smooth' }); }, []);

  // apply theme vars
  window.__SP_MOTION = MOTION[t.motion] != null ? MOTION[t.motion] : 1;
  React.useEffect(() => {
    const r = document.documentElement;
    r.setAttribute('data-theme', t.theme);
    r.style.setProperty('--accent', t.accent);
    r.style.setProperty('--display', FONTS[t.font] || FONTS.Editorial);
    r.style.setProperty('--radius', CORNERS[t.corners] || CORNERS.Soft);
    document.body.classList.toggle('fx-on', t.fx !== false);
  }, [t.theme, t.accent, t.font, t.corners, t.fx]);

  // cursor tilt + spotlight (delegated) + scroll progress
  React.useEffect(() => {
    let raf = 0;
    const onMove = (e) => {
      if ((window.__SP_MOTION || 0) === 0) return;
      const c = e.target.closest && e.target.closest('.fx-card');
      if (!c) return;
      const r = c.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const m = 4.5;
        c.style.setProperty('--ry', ((px - .5) * m * 2).toFixed(2) + 'deg');
        c.style.setProperty('--rx', (-(py - .5) * m * 2).toFixed(2) + 'deg');
        c.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
        c.style.setProperty('--my', (py * 100).toFixed(1) + '%');
        c.style.setProperty('--ty', '-5px');
      });
    };
    const onOut = (e) => {
      const c = e.target.closest && e.target.closest('.fx-card');
      if (!c || (e.relatedTarget && c.contains(e.relatedTarget))) return;
      c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); c.style.setProperty('--ty', '0px');
    };
    const onScroll = () => {
      const bar = document.getElementById('scrollbar');
      if (!bar) return;
      const h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + '%';
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerout', onOut, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => { document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerout', onOut); window.removeEventListener('scroll', onScroll); };
  }, []);

  // decorate grid cards with tilt fx after each screen render
  React.useEffect(() => {
    const id = setTimeout(() => {
      document.querySelectorAll('.bento .card, .stat-grid .card, .net-grid .card, .accounts-journey .card').forEach(c => {
        c.classList.add('fx-card'); c.classList.remove('lift');
      });
    }, 40);
    return () => clearTimeout(id);
  }, [screen, t.motion, t.fx]);

  const current = NAV.find(n => n.id === screen);

  return (
    <div className="app">
      <div className="aurora" aria-hidden="true"><i></i><i></i><i></i></div>
      <div className="grain" aria-hidden="true"></div>
      <div id="scrollbar"></div>
      <header className="topnav">
        <div className="brand">
          <span className="brand-mark"><Icon name="sun" size={18} color="#fff" /></span>
          <span className="wordmark" style={{ font: '700 16px var(--display)', letterSpacing: '-.01em' }}>Summer Planner</span>
        </div>
        <nav className="nav-row">
          {NAV.map(n => (
            <button key={n.id} className="nav-item" data-active={screen === n.id} onClick={() => go(n.id)}>
              <Icon name={n.icon} size={17} /><span className="nav-label">{n.label}</span>
            </button>
          ))}
        </nav>
        <VaultMiniTop go={go} />
      </header>

      <main className="main">
        <div className="screen-enter" key={screen + '-' + t.motion}>
          {SCREENS[screen](go)}
        </div>
      </main>

      {/* Tweaks */}
      <TweaksPanel>
        <TweakSection label="Theme" />
        <TweakRadio label="Mode" value={t.theme} options={['light', 'dark']} onChange={v => setTweak('theme', v)} />
        <TweakColor label="Accent" value={t.accent} options={ACCENTS.map(a => a.hex)} onChange={v => setTweak('accent', v)} />
        <TweakRadio label="Corners" value={t.corners} options={['Soft', 'Medium', 'Sharp']} onChange={v => setTweak('corners', v)} />
        <TweakToggle label="Background FX" value={t.fx !== false} onChange={v => setTweak('fx', v)} />
        <TweakSection label="Type & motion" />
        <TweakRadio label="Display font" value={t.font} options={['Editorial', 'Geometric']} onChange={v => setTweak('font', v)} />
        <TweakSelect label="Motion" value={t.motion} options={['Off', 'Subtle', 'Lively', 'Showy']} onChange={v => setTweak('motion', v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
