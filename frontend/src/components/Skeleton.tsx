/**
 * Скелетоны загрузки: размеры совпадают с реальным контентом, чтобы
 * лэйаут не «прыгал» (ТЗ, «обязательно при реализации», п. 1).
 */
export function Skeleton({
  height = 14,
  width = '100%',
  radius = 8,
  style,
}: {
  height?: number | string;
  width?: number | string;
  radius?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="sk"
      style={{ height, width, borderRadius: radius, ...style }}
    />
  );
}

/** Список строк-скелетонов (записи, задачи, участники, уведомления). */
export function SkeletonRows({
  rows = 3,
  height = 44,
}: {
  rows?: number;
  height?: number;
}) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="sk sk-row" style={{ height }} />
      ))}
    </div>
  );
}

/** Скелетон карточки статистики (Трекер, Отчёты). */
export function SkeletonStats({ count = 3 }: { count?: number }) {
  return (
    <div className="grid-stats">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="sk" style={{ height: 78, borderRadius: 10 }} />
      ))}
    </div>
  );
}
