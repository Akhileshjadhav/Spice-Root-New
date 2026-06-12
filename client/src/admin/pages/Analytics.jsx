import { useEffect, useMemo, useState } from "react";
import ChartCard from "../components/ChartCard";
import DataTable from "../components/DataTable";
import { isPaidOrder, subscribeToOrders, subscribeToUsers } from "../../lib/adminStore";
import { formatPrice, subscribeToCatalog } from "../../lib/catalog";
import { PERIOD_OPTIONS, getRecordTime, isWithinDateFilters } from "../utils/dateFilters";
import { exportRowsToExcel } from "../utils/exportExcel";

const METRIC_OPTIONS = ["All", "Revenue", "Orders", "Customers", "Conversion"];

function linePoints(values) {
  const normalizedValues = values.length > 0 ? values : [{ value: 0 }];
  const max = Math.max(...normalizedValues.map((item) => item.value));
  const min = Math.min(...normalizedValues.map((item) => item.value));
  const range = Math.max(1, max - min);

  return normalizedValues
    .map((item, index) => {
      const x = (index / Math.max(1, normalizedValues.length - 1)) * 100;
      const y = 66 - ((item.value - min) / range) * 54;
      return `${x},${y}`;
    })
    .join(" ");
}

function donutStyle(data) {
  let cursor = 0;
  const colors = {
    amber: "#f59e0b",
    orange: "#f97316",
    green: "#22c55e",
    blue: "#38bdf8",
  };

  const stops = data.map((item) => {
    const start = cursor;
    cursor += item.share;
    return `${colors[item.tone]} ${start}% ${cursor}%`;
  });

  return { background: `conic-gradient(${stops.join(", ")})` };
}

function getPeriodKey(date, period) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  if (period === "yearly") {
    return `${year}`;
  }

  if (period === "monthly") {
    return `${year}-${month}`;
  }

  if (period === "weekly") {
    const firstDay = new Date(year, 0, 1);
    const week = Math.ceil(((date - firstDay) / 86400000 + firstDay.getDay() + 1) / 7);
    return `${year}-W${String(week).padStart(2, "0")}`;
  }

  return `${year}-${month}-${day}`;
}

function formatMetricValue(metric, value) {
  if (metric === "Revenue") {
    return formatPrice(value);
  }

  if (metric === "Conversion") {
    return `${value.toFixed(2)}%`;
  }

  return String(value);
}

function buildAnalyticsRows(orders, users, period) {
  const groups = new Map();
  const groupingPeriod = period === "all" || period === "custom" ? "monthly" : period;

  orders.forEach((order) => {
    const time = getRecordTime(order.createdAt);

    if (!time) {
      return;
    }

    const key = getPeriodKey(new Date(time), groupingPeriod);
    const current = groups.get(key) || {
      period: key,
      revenueValue: 0,
      ordersValue: 0,
      customerIds: new Set(),
    };

    current.ordersValue += 1;
    current.revenueValue += isPaidOrder(order) ? Math.max(0, Number(order.amount) || 0) : 0;

    if (order.userId) {
      current.customerIds.add(order.userId);
    }

    groups.set(key, current);
  });

  users.forEach((user) => {
    const time = getRecordTime(user.createdAt);

    if (!time) {
      return;
    }

    const key = getPeriodKey(new Date(time), groupingPeriod);
    const current = groups.get(key) || {
      period: key,
      revenueValue: 0,
      ordersValue: 0,
      customerIds: new Set(),
    };

    current.customerIds.add(user.uid);
    groups.set(key, current);
  });

  return Array.from(groups.values())
    .map((item) => {
      const customersValue = item.customerIds.size;
      const conversionValue = customersValue > 0 ? (item.ordersValue / customersValue) * 100 : 0;

      return {
        period: item.period,
        revenue: formatMetricValue("Revenue", item.revenueValue),
        revenueValue: item.revenueValue,
        orders: item.ordersValue,
        customers: customersValue,
        conversion: formatMetricValue("Conversion", conversionValue),
        conversionValue,
      };
    })
    .sort((left, right) => left.period.localeCompare(right.period));
}

function buildMetricRows(rows) {
  return rows.flatMap((row) => [
    {
      id: `${row.period}-revenue`,
      period: row.period,
      metric: "Revenue",
      value: row.revenue,
      rawValue: row.revenueValue,
    },
    {
      id: `${row.period}-orders`,
      period: row.period,
      metric: "Orders",
      value: row.orders,
      rawValue: row.orders,
    },
    {
      id: `${row.period}-customers`,
      period: row.period,
      metric: "Customers",
      value: row.customers,
      rawValue: row.customers,
    },
    {
      id: `${row.period}-conversion`,
      period: row.period,
      metric: "Conversion",
      value: row.conversion,
      rawValue: row.conversionValue,
    },
  ]);
}

function buildCategoryMixFromOrders(orders = [], products = []) {
  const productLookup = new Map(
    products.map((product) => [product.id || product.slug || product.documentId, product.category])
  );
  const categoryTotals = new Map();
  let totalQuantity = 0;
  const categoryTone = {
    Masala: "amber",
    Flour: "orange",
    Pantry: "blue",
  };

  orders.forEach((order) => {
    (order.items || []).forEach((item) => {
      const quantity = Math.max(0, Number(item.quantity) || 0);

      if (!quantity) {
        return;
      }

      const category =
        productLookup.get(item.id) ||
        productLookup.get(item.slug) ||
        item.category ||
        "Other";

      categoryTotals.set(category, (categoryTotals.get(category) || 0) + quantity);
      totalQuantity += quantity;
    });
  });

  if (totalQuantity === 0) {
    return [];
  }

  return Array.from(categoryTotals.entries())
    .map(([label, quantity]) => ({
      label,
      share: Math.round((quantity / totalQuantity) * 100),
      tone: categoryTone[label] || "amber",
    }))
    .sort((left, right) => right.share - left.share);
}

const Analytics = () => {
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [metricFilter, setMetricFilter] = useState("All");
  const [period, setPeriod] = useState("monthly");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeToOrders(
      setOrders,
      (error) => console.error("Failed to load analytics orders:", error)
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToUsers(
      setUsers,
      (error) => console.error("Failed to load analytics customers:", error)
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToCatalog(
      setProducts,
      (error) => console.error("Failed to load analytics catalog:", error)
    );

    return () => unsubscribe();
  }, []);

  const filteredOrders = useMemo(
    () => orders.filter((order) => isWithinDateFilters(order.createdAt, period, fromDate, toDate)),
    [fromDate, orders, period, toDate]
  );
  const filteredUsers = useMemo(
    () => users.filter((user) => isWithinDateFilters(user.createdAt, period, fromDate, toDate)),
    [fromDate, period, toDate, users]
  );
  const analyticsRows = useMemo(
    () => buildAnalyticsRows(filteredOrders, filteredUsers, period),
    [filteredOrders, filteredUsers, period]
  );
  const metricRows = useMemo(() => buildMetricRows(analyticsRows), [analyticsRows]);
  const visibleMetricRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return metricRows.filter((row) => {
      const matchesMetric = metricFilter === "All" || row.metric === metricFilter;
      const matchesQuery =
        !normalizedQuery ||
        [row.metric, row.period, row.value, "daily", "weekly", "monthly", "yearly"]
          .some((value) => String(value).toLowerCase().includes(normalizedQuery));

      return matchesMetric && matchesQuery;
    });
  }, [metricFilter, metricRows, query]);
  const summary = useMemo(() => {
    const paidRevenue = filteredOrders
      .filter(isPaidOrder)
      .reduce((total, order) => total + Math.max(0, Number(order.amount) || 0), 0);
    const uniqueCustomerIds = new Set([
      ...filteredUsers.map((user) => user.uid),
      ...filteredOrders.map((order) => order.userId).filter(Boolean),
    ]);
    const conversion = uniqueCustomerIds.size > 0 ? (filteredOrders.length / uniqueCustomerIds.size) * 100 : 0;

    return [
      { label: "Revenue", value: formatPrice(paidRevenue), change: `${period} view` },
      { label: "Orders", value: String(filteredOrders.length), change: `${period} view` },
      { label: "Customers", value: String(uniqueCustomerIds.size), change: `${period} view` },
      { label: "Conversion", value: `${conversion.toFixed(2)}%`, change: `${period} view` },
    ];
  }, [filteredOrders, filteredUsers, period]);
  const revenueTrend = useMemo(
    () =>
      analyticsRows.map((row) => ({
        day: row.period,
        value: row.revenueValue,
      })),
    [analyticsRows]
  );
  const categoryMix = useMemo(
    () => buildCategoryMixFromOrders(filteredOrders, products),
    [filteredOrders, products]
  );

  const handleExport = () => {
    exportRowsToExcel({
      title: "Spice Root Analytics Details",
      fileName: "spice-root-analytics-details",
      columns: [
        { key: "period", label: "Period" },
        { key: "metric", label: "Metric" },
        { key: "value", label: "Value" },
      ],
      rows: visibleMetricRows,
    });
  };

  return (
    <section className="admin-module-section">
      <div className="admin-page-head">
        <div>
          <h2>Analytics</h2>
          <p>Measure revenue, conversion, and product contribution by category.</p>
        </div>
        <div className="admin-page-actions">
          <button type="button" className="admin-primary-button" onClick={handleExport}>
            Export Analytics Details Excel
          </button>
        </div>
      </div>

      <div className="admin-module-card admin-export-section">
        <div className="admin-page-head compact">
          <div>
            <h3>Analytics Filters</h3>
            <p>Filter Revenue, Orders, Customers, and Conversion by daily, weekly, monthly, yearly, or custom dates.</p>
          </div>
          <button type="button" className="admin-secondary-button" onClick={handleExport}>
            Download This Section
          </button>
        </div>
        <div className="admin-filter-row">
          <input
            className="admin-inline-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search revenue, orders, customers, conversion, period..."
          />
          <select
            className="admin-inline-search"
            value={metricFilter}
            onChange={(event) => setMetricFilter(event.target.value)}
          >
            {METRIC_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {item === "All" ? "All Metrics" : item}
              </option>
            ))}
          </select>
          <select
            className="admin-inline-search"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
          >
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input className="admin-inline-search" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          <input className="admin-inline-search" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </div>
      </div>

      <div className="admin-summary-strip">
        {summary.map((item) => (
          <div key={item.label} className="admin-summary-card">
            <strong>{item.value}</strong>
            <span>{item.label}</span>
            <small>{item.change}</small>
          </div>
        ))}
      </div>

      <div className="admin-dashboard-grid analytics-grid">
        <ChartCard className="admin-panel-wide" kicker="Revenue Trend" title="Revenue Trend" subtitle="Monthly growth movement.">
          <div className="admin-line-chart">
            <svg className="admin-chart-svg" viewBox="0 0 100 72" preserveAspectRatio="none" aria-hidden="true">
              <polyline
                points={linePoints(revenueTrend)}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="admin-line-labels">
              {revenueTrend.map((item) => (
                <span key={item.day}>{item.day}</span>
              ))}
            </div>
          </div>
        </ChartCard>

        <ChartCard kicker="Category Mix" title="Order Share by Category" subtitle="Live contribution from order line items.">
          <div className="admin-donut-layout">
            {categoryMix.length > 0 ? (
              <>
                <div className="admin-donut" style={donutStyle(categoryMix)}>
                  <div className="admin-donut-center">
                    <strong>100%</strong>
                    <span>Order mix</span>
                  </div>
                </div>
                <div className="admin-donut-legend">
                  {categoryMix.map((item) => (
                    <div key={item.label}>
                      <span className={`admin-color-dot tone-${item.tone}`} />
                      <strong>{item.label}</strong>
                      <small>{item.share}%</small>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="admin-empty-state">No order data yet for category mix.</div>
            )}
          </div>
        </ChartCard>
      </div>

      <div className="admin-module-card admin-export-section">
        <DataTable
          columns={[
            { key: "period", label: "Period" },
            { key: "metric", label: "Metric" },
            { key: "value", label: "Value" },
          ]}
          rows={visibleMetricRows}
          rowKey="id"
        />
        {visibleMetricRows.length === 0 ? (
          <div className="admin-empty-state" style={{ marginTop: "12px" }}>
            No analytics records match the selected filters.
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default Analytics;
