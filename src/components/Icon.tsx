import styles from './Icon.module.css';

// Dynamically construct SVG URLs for each icon
const SRC: Record<string, string> = Object.fromEntries([
  'house', 'shield', 'cup', 'drink', 'basket', 'fruit', 'ticket', 'film',
  'bus', 'phone', 'pill', 'gift', 'bag', 'bolt', 'coin',
].map((key) => [key, new URL(`../assets/icons/${key}.svg`, import.meta.url).href]));

export const ICON_KEYS = [
  'house', 'shield', 'cup', 'drink', 'basket', 'fruit', 'ticket', 'film',
  'bus', 'phone', 'pill', 'gift', 'bag', 'bolt', 'coin',
] as const;

export type IconKey = (typeof ICON_KEYS)[number];

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
