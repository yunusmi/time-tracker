/**
 * Единый знак «Хронос»: скруглённый квадрат + часы 12→14:00.
 * Используется в сайдбаре, на страницах входа, лендинге и публичных отчётах
 * (тот же контур экспортирован в favicon и OG-превью).
 */
export function Logo({
  size = 24,
  color = '#6366f1',
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ flexShrink: 0 }}
      aria-hidden="true"
    >
      <rect width="24" height="24" rx="7" fill={color} />
      <circle
        cx="12"
        cy="12"
        r="6.3"
        stroke="#fff"
        strokeWidth="1.8"
        fill="none"
      />
      <path
        d="M12 8.6V12l2.6 1.7"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/** Аватар пользователя: фото или инициалы на подложке акцента. */
export function Avatar({
  name,
  src,
  size = 26,
}: {
  name: string;
  src?: string | null;
  size?: number;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--asoft)',
        color: 'var(--accent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(size * 0.42),
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initials || '·'}
    </div>
  );
}

/** Квадратная плитка компании: логотип или инициалы на фирменном цвете. */
export function WorkspaceBadge({
  name,
  logoUrl,
  color,
  size = 24,
}: {
  name: string;
  logoUrl?: string | null;
  color: string;
  size?: number;
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={name}
        style={{
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.28),
          objectFit: 'cover',
          flexShrink: 0,
        }}
      />
    );
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        background: color,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(size * 0.42),
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initials || '·'}
    </div>
  );
}
