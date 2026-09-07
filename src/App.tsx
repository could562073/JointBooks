import { Icon, ICON_KEYS } from './components/Icon';
import { Mantou } from './components/Mantou';

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

  if (debug === 'mantou') {
    return (
      <div style={{ padding: 40, display: 'flex', gap: 24, alignItems: 'flex-end' }}>
        <Mantou data-testid="mantou-breathing" variant="full" width={72} breathing />
        <Mantou variant="tab" width={22} />
        <Mantou variant="empty" width={64} />
      </div>
    );
  }

  return <div data-testid="app-root">加拿大共用記帳</div>;
}
