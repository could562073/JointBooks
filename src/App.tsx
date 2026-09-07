import { Icon, ICON_KEYS } from './components/Icon';

export default function App() {
  const debug = new URLSearchParams(location.search).get('debug');

  if (debug === 'icons') {
    return (
      <div data-testid="icon-gallery" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 16 }}>
        {ICON_KEYS.map((k) => (
          <Icon key={k} name={k} size={24} box={44} boxRadius={14} />
        ))}
      </div>
    );
  }

  return <div data-testid="app-root">加拿大共用記帳</div>;
}
