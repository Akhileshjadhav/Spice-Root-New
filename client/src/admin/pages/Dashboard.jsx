import { useEffect, useMemo, useState } from "react";
import {
  FaBoxOpen,
  FaMoneyBillWave,
  FaShoppingCart,
  FaTruck,
} from "react-icons/fa";
import ChartCard from "../components/ChartCard";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import { subscribeToCatalog } from "../../lib/catalog";
import {
  buildDashboardData,
  subscribeToOrders,
  subscribeToReviews,
  subscribeToUsers,
} from "../../lib/adminStore";

function buildLinePoints(values, minValue, maxValue) {
  const points = values.map((item) => item.value);
  const max = maxValue ?? Math.max(...points, 1);
  const min = minValue ?? Math.min(...points, 0);
  const range = Math.max(1, max - min);

  return values
    .map((item, index) => {
      const x = (index / Math.max(1, values.length - 1)) * 100;
      const y = 68 - ((item.value - min) / range) * 52;
      return `${x},${y}`;
    })
    .join(" ");
}

const iconMap = {
  revenue: <FaMoneyBillWave />,
  orders: <FaShoppingCart />,
  customers: <FaBoxOpen />,
  deliveries: <FaTruck />,
};

const Dashboard = () => {
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    const unsubscribe = subscribeToCatalog(
      setProducts,
      (error) => console.error("Failed to load dashboard catalog:", error)
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToUsers(
      setUsers,
      (error) => console.error("Failed to load dashboard users:", error)
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToOrders(
      setOrders,
      (error) => console.error("Failed to load dashboard orders:", error)
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToReviews(
      setReviews,
      (error) => console.error("Failed to load dashboard reviews:", error)
    );

    return () => unsubscribe();
  }, []);

  const dashboardData = useMemo(
    () => buildDashboardData(products, users, orders, reviews),
    [orders, products, reviews, users]
  );
  const revenueScale = [...dashboardData.revenueTrend, ...dashboardData.previousRevenueTrend].map(
    (item) => item.value
  );
  const revenueMax = Math.max(...revenueScale, 1);
  const revenueMin = Math.min(...revenueScale, 0);
  const orderMax = Math.max(...dashboardData.orderVolume.map((item) => item.total), 1);

  return (
    <>
      <section id="dashboard-summary" className="admin-kpi-grid admin-search-target">
        {dashboardData.dashboardStats.map((item) => (
          <StatCard key={item.id} {...item} icon={iconMap[item.id]} />
        ))}
      </section>

      <section className="admin-dashboard-grid">
        <ChartCard
          id="revenue-overview"
          className="admin-panel-wide admin-search-target"
          kicker="Revenue Overview"
          title="Revenue Overview"
          subtitle="Live revenue from customer orders over the last seven days."
          actions={<button type="button" className="admin-panel-action-link">Live</button>}
        >
          <div className="admin-chart-card admin-revenue-card">
            <div className="admin-panel-legend">
              <span><i className="tone-green" /> Last 7 Days</span>
              <span><i className="tone-blue" /> Previous 7 Days</span>
            </div>
            <svg className="admin-chart-svg admin-revenue-svg" viewBox="0 0 100 72" preserveAspectRatio="none" aria-hidden="true">
              <line x1="0" y1="16" x2="100" y2="16" className="admin-grid-line" />
              <line x1="0" y1="34" x2="100" y2="34" className="admin-grid-line" />
              <line x1="0" y1="52" x2="100" y2="52" className="admin-grid-line" />
              <polyline
                points={buildLinePoints(dashboardData.previousRevenueTrend, revenueMin, revenueMax)}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline
                points={buildLinePoints(dashboardData.revenueTrend, revenueMin, revenueMax)}
                fill="none"
                stroke="#84cc16"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="admin-line-labels">
              {dashboardData.revenueTrend.map((item) => (
                <span key={item.day}>{item.day}</span>
              ))}
            </div>
          </div>
        </ChartCard>

        <ChartCard
          id="top-selling-masalas"
          className="admin-search-target"
          kicker="Top Selling Products"
          title="Top Selling Products"
          subtitle="Best performing products based on live order quantities."
          actions={<button type="button" className="admin-panel-action-link">Live</button>}
        >
          <div className="admin-product-stack">
            {dashboardData.topSellingProducts.length === 0 ? (
              <div className="admin-empty-state">Top-selling products will appear after orders are placed.</div>
            ) : (
              dashboardData.topSellingProducts.map((item) => (
                <div key={item.name} className="admin-product-row">
                  <img src={item.image} alt={item.name} />
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.sku}</span>
                  </div>
                  <div className="admin-product-metrics">
                    <strong>{item.sales}</strong>
                    <span>Top mover</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </ChartCard>

        <ChartCard
          id="orders-overview"
          className="admin-panel-wide admin-search-target"
          kicker="Orders Overview"
          title="Orders Overview"
          subtitle="Daily order flow during the last seven days."
          actions={<button type="button" className="admin-panel-action-link">Live</button>}
        >
          <div className="admin-bars">
            {dashboardData.orderVolume.map((item, index) => (
              <div key={item.label} className="admin-bar-column">
                <div className="admin-bar-shell">
                  <div
                    className={`admin-bar-fill${index % 2 === 1 ? " admin-bar-fill-alt" : ""}`}
                    style={{ height: `${Math.max(22, Math.round((item.total / orderMax) * 100))}%` }}
                  />
                </div>
                <strong>{item.total}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard
          id="low-stock-alerts"
          className="admin-search-target"
          kicker="Low Stock Alerts"
          title="Low Stock Alerts"
          subtitle="Products that need replenishment soon."
          actions={<button type="button" className="admin-panel-action-link">Live</button>}
        >
          <div className="admin-alert-list">
            {dashboardData.lowStockProducts.length === 0 ? (
              <div className="admin-empty-state">No low-stock alerts right now.</div>
            ) : (
              dashboardData.lowStockProducts.map((item) => (
                <div key={item.name} className="admin-alert-row">
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.stock}</span>
                  </div>
                  <span className={`admin-tag admin-tag-${item.tone}`}>
                    {item.tone === "danger" ? "Critical" : "Monitor"}
                  </span>
                </div>
              ))
            )}
          </div>
        </ChartCard>

        <ChartCard
          id="recent-orders"
          className="admin-search-target"
          kicker="Recent Orders"
          title="Recent Orders"
          subtitle="Latest checkout activity from the live database."
          actions={<button type="button" className="admin-panel-action-link">Live</button>}
        >
          <div className="admin-orders-mini-table">
            <div className="admin-orders-mini-head">
              <span>Order ID</span>
              <span>Customer</span>
              <span>Amount</span>
              <span>Status</span>
            </div>
            {dashboardData.recentOrders.length === 0 ? (
              <div className="admin-empty-state">Recent orders will appear here automatically.</div>
            ) : (
              dashboardData.recentOrders.map((item) => (
                <div key={item.orderId} className="admin-orders-mini-row">
                  <strong>{item.orderId}</strong>
                  <span>{item.customerName}</span>
                  <span>{item.amountLabel}</span>
                  <StatusBadge status={item.status} />
                </div>
              ))
            )}
          </div>
        </ChartCard>

        <ChartCard
          id="new-customers"
          className="admin-search-target"
          kicker="New Customers"
          title="New Customers"
          subtitle="Newest accounts registered in the database."
          actions={<button type="button" className="admin-panel-action-link">Live</button>}
        >
          <div className="admin-customer-stack">
            {dashboardData.newCustomers.length === 0 ? (
              <div className="admin-empty-state">New customers will appear here after sign-up.</div>
            ) : (
              dashboardData.newCustomers.map((item) => (
                <div key={`${item.name}-${item.joined}`} className="admin-customer-row admin-customer-mini-row">
                  <div className="admin-avatar-small">{item.name.slice(0, 2).toUpperCase()}</div>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.city}</span>
                  </div>
                  <span>{item.joined}</span>
                </div>
              ))
            )}
          </div>
        </ChartCard>
      </section>
    </>
  );
};

export default Dashboard;
