function ChartCard({ kicker, title, subtitle, actions, className = "", children, ...props }) {
  return (
    <section className={`admin-panel${className ? ` ${className}` : ""}`} {...props}>
      <div className="admin-panel-head">
        <div className="admin-panel-head-title">
          {kicker ? <span className="admin-kpi-label">{kicker}</span> : null}
          <div className="admin-panel-title-line">
            <h2>{title}</h2>
            {subtitle ? <small>{subtitle}</small> : null}
          </div>
        </div>
        {actions ? <div className="admin-panel-actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export default ChartCard;
