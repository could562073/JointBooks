import type { ReactNode } from 'react';
import { Icon, ICON_KEYS } from '../components/Icon';
import { Mantou } from '../components/Mantou';

// 每個未來的視覺元件只在這裡加一個 key，不再需要碰 App.tsx。
// App.tsx 只負責在 dev 模式下、依 ?debug= 這個 query key lazy 載入這個檔案，
// 本身永遠只有一個 debug 分支。
const GALLERIES: Record<string, ReactNode> = {
  icons: (
    <div data-testid="icon-gallery" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 16 }}>
      {ICON_KEYS.map((k) => (
        <Icon key={k} name={k} size={24} box={44} boxRadius={14} />
      ))}
    </div>
  ),
  mantou: (
    <div style={{ padding: 40, display: 'flex', gap: 24, alignItems: 'flex-end' }}>
      <Mantou data-testid="mantou-breathing" variant="full" width={72} breathing />
      <Mantou variant="tab" width={22} />
      <Mantou variant="empty" width={64} />
    </div>
  ),
};

type Props = {
  debugKey: string;
};

export default function DebugGallery({ debugKey }: Props) {
  return <>{GALLERIES[debugKey] ?? null}</>;
}
