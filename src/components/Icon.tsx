import styles from './Icon.module.css';

const KEYS = [
  'house', 'shield', 'cup', 'drink', 'basket', 'fruit', 'ticket', 'film',
  'bus', 'phone', 'pill', 'gift', 'bag', 'bolt', 'coin',
] as const;

export const ICON_KEYS = KEYS;
export type IconKey = (typeof KEYS)[number];

// Use new URL(path, import.meta.url).href instead of import.meta.glob with ?url.
// Vite statically analyses the dynamic template-literal form and emits hashed assets
// in the production build. Verified: npm run build emits all 15 icons with correct
// hash resolution, no 404s when served via npm run preview.
const SRC: Record<IconKey, string> = Object.fromEntries(
  KEYS.map((key) => [key, new URL(`../assets/icons/${key}.svg`, import.meta.url).href])
) as Record<IconKey, string>;

type Props = {
  name: IconKey;
  size: number;
  box?: number;
  boxRadius?: number;
  tint?: string;
};

export function Icon({ name, size, box, boxRadius, tint }: Props) {
  const img = (
    <img
      className={styles.img}
      src={SRC[name]}
      alt={name}
      width={size}
      height={size}
      draggable={false}
    />
  );

  if (box === undefined) return img;

  return (
    <span
      data-box=""
      className={styles.box}
      style={{
        width: `${box}px`,
        height: `${box}px`,
        borderRadius: `${boxRadius ?? 13}px`,
        background: tint ?? 'var(--c-tint)',
      }}
    >
      {img}
    </span>
  );
}
