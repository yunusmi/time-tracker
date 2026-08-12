/** Заглушка для экранов, которые появятся на следующих этапах внедрения. */
export function ComingSoon({ note }: { note: string }) {
  return (
    <div className="card">
      <div className="empty" style={{ padding: '48px 16px' }}>
        <div className="empty-title">Скоро здесь появится этот раздел</div>
        <div className="empty-sub">{note}</div>
      </div>
    </div>
  );
}
