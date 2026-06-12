const toneMap = {
  amber: "#f59e0b",
  orange: "#f97316",
  red: "#ef4444",
  gold: "#fbbf24",
  green: "#22c55e",
  blue: "#38bdf8",
};

function buildSparkline(points = []) {
  if (!points.length) {
    return "";
  }

  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = Math.max(1, max - min);

  return points
    .map((point, index) => {
      const x = (index / Math.max(1, points.length - 1)) * 100;
      const y = 28 - ((point - min) / range) * 24;
      return `${x},${y}`;
    })
    .join(" ");
}

function StatCard({ label, value, change, note, tone = "amber", points = [], icon }) {
  const color = toneMap[tone] || toneMap.amber;

  return (
    <article className="admin-kpi-card" style={{ "--admin-icon-color": color }}>
      <div className="admin-kpi-top">
        <div>
          <span className="admin-kpi-label">{label}</span>
          <strong className="admin-kpi-value">{value}</strong>
        </div>
        <div className="admin-kpi-icon">{icon}</div>
      </div>

      <div className="admin-kpi-bottom">
        <small>{note}</small>
        <span className="admin-kpi-change">{change}</span>
      </div>

      <svg className="admin-kpi-sparkline" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
        <polyline
          points={buildSparkline(points)}
          fill="none"
          stroke={color}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </article>
  );
}

export default StatCard;
