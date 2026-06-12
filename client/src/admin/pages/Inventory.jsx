import { useEffect, useMemo, useState } from "react";
import { collection } from "firebase/firestore";
import DataTable from "../components/DataTable";
import { db } from "../../firebase";
import { normalizeFirestoreProduct } from "../../lib/catalog";
import { subscribeSafely } from "../../lib/firestoreSubscriptions";
import { exportRowsToExcel } from "../utils/exportExcel";
import { PERIOD_OPTIONS, isWithinDateFilters } from "../utils/dateFilters";
import {
  buildInventoryRows,
  buildInventoryStats,
  subscribeToOrders,
} from "../../lib/adminStore";

const columns = [
  { key: "sku", label: "SKU" },
  { key: "product", label: "Product" },
  { key: "totalStock", label: "Total Stock", align: "right" },
  { key: "orderedStock", label: "Ordered Stock", align: "right" },
  { key: "availableStock", label: "Available Stock", align: "right" },
  { key: "status", label: "Status", type: "status" },
];

const salesColumns = [
  { key: "product", label: "Product" },
  { key: "sku", label: "SKU" },
  { key: "category", label: "Category" },
  { key: "unitsSold", label: "Units Sold", align: "right" },
  { key: "orderCount", label: "Orders", align: "right" },
  { key: "revenueLabel", label: "Revenue", align: "right" },
];

function formatCurrency(value) {
  return `Rs ${Math.max(0, Number(value) || 0).toLocaleString("en-IN")}`;
}

function buildSalesRows(products, orders) {
  const productLookup = products.reduce((lookup, product) => {
    const key = product.documentId || product.id || product.slug || product.name;
    lookup.set(key, product);
    lookup.set(product.id, product);
    lookup.set(product.name, product);
    return lookup;
  }, new Map());
  const salesLookup = new Map();

  orders.forEach((order) => {
    (order.items || []).forEach((item) => {
      const key = item.id || item.slug || item.name;
      const product = productLookup.get(key) || productLookup.get(item.name) || {};
      const resolvedKey = product.documentId || product.id || key || item.name;
      const current = salesLookup.get(resolvedKey) || {
        id: resolvedKey,
        sku: product.sku || "",
        product: product.name || item.name || "Product",
        category: product.category || item.category || "Uncategorized",
        unitsSold: 0,
        orderIds: new Set(),
        revenue: 0,
      };

      current.unitsSold += Math.max(0, Number(item.quantity) || 0);
      current.revenue += Math.max(0, Number(item.price) || 0) * Math.max(0, Number(item.quantity) || 0);
      current.orderIds.add(order.id || order.orderId);
      salesLookup.set(resolvedKey, current);
    });
  });

  return Array.from(salesLookup.values())
    .map((item) => ({
      ...item,
      orderCount: item.orderIds.size,
      revenueLabel: formatCurrency(item.revenue),
    }))
    .sort((left, right) => right.unitsSold - left.unitsSold || left.product.localeCompare(right.product));
}

const Inventory = () => {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [salesPeriod, setSalesPeriod] = useState("all");
  const [salesFromDate, setSalesFromDate] = useState("");
  const [salesToDate, setSalesToDate] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeSafely(
      collection(db, "products"),
      (snapshot) => {
        const items = snapshot.docs
          .map((docItem) => normalizeFirestoreProduct({ id: docItem.id, ...docItem.data() }))
          .filter(Boolean);

        setProducts(items);
      },
      (error) => console.error("Failed to load products for inventory:", error)
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToOrders(
      (liveOrders) => setOrders(liveOrders),
      (error) => console.error("Failed to load orders for inventory:", error)
    );

    return () => unsubscribe();
  }, []);

  const inventoryRows = useMemo(
    () => buildInventoryRows(products, orders),
    [orders, products]
  );
  const inventoryStats = useMemo(
    () => buildInventoryStats(inventoryRows),
    [inventoryRows]
  );
  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return inventoryRows.filter((item) => {
      const matchesStatus = statusFilter === "All" || item.status === statusFilter;
      const matchesQuery =
        !normalizedQuery ||
        [item.sku, item.product, item.category]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery));

      return matchesStatus && matchesQuery;
    });
  }, [inventoryRows, query, statusFilter]);
  const salesFilteredOrders = useMemo(
    () =>
      orders.filter((order) => {
        const normalizedStatus = String(order.status || "").trim().toLowerCase();

        return (
          normalizedStatus !== "cancelled" &&
          normalizedStatus !== "canceled" &&
          isWithinDateFilters(order.createdAt, salesPeriod, salesFromDate, salesToDate)
        );
      }),
    [orders, salesFromDate, salesPeriod, salesToDate]
  );
  const salesRows = useMemo(
    () => buildSalesRows(products, salesFilteredOrders),
    [products, salesFilteredOrders]
  );
  const totalUnitsSold = useMemo(
    () => salesRows.reduce((total, item) => total + item.unitsSold, 0),
    [salesRows]
  );

  const handleExportInventory = () => {
    exportRowsToExcel({
      title: "Spice Root Inventory",
      fileName: "spice-root-inventory",
      columns,
      rows: filteredRows,
    });
  };

  const handleExportSales = () => {
    exportRowsToExcel({
      title: "Spice Root Inventory Sales",
      fileName: "spice-root-inventory-sales",
      columns: salesColumns,
      rows: salesRows,
    });
  };

  return (
    <section id="inventory" className="admin-module-section admin-search-target">
      <div className="admin-page-head">
        <div>
          <h2>Inventory</h2>
          <p>Track stock position and replenishment risks across live SKUs.</p>
        </div>
        <div className="admin-page-actions">
          <button type="button" className="admin-secondary-button" onClick={handleExportInventory}>
            Export Inventory Excel
          </button>
          <button type="button" className="admin-primary-button" onClick={handleExportSales}>
            Export Sales Excel
          </button>
        </div>
      </div>

      <div className="admin-summary-strip">
        {inventoryStats.map((item) => (
          <div key={item.label} className={`admin-summary-card tone-${item.tone}`}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      <div className="admin-filter-row">
        <input
          className="admin-inline-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter inventory by product, SKU, or category..."
        />

        <select
          className="admin-inline-search"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="All">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Low Stock">Low Stock</option>
          <option value="Out of Stock">Out of Stock</option>
          <option value="Coming Soon">Coming Soon</option>
        </select>
      </div>

      <div className="admin-module-card">
        <DataTable columns={columns} rows={filteredRows} rowKey="id" />
      </div>

      <div className="admin-module-card admin-export-section">
        <div className="admin-page-head compact">
          <div>
            <h3>Product Sales Movement</h3>
            <p>See how many products sold and which products sold in the selected date window.</p>
          </div>
          <button type="button" className="admin-secondary-button" onClick={handleExportSales}>
            Download This Section
          </button>
        </div>

        <div className="admin-filter-row">
          <select
            className="admin-inline-search"
            value={salesPeriod}
            onChange={(event) => setSalesPeriod(event.target.value)}
          >
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            className="admin-inline-search"
            type="date"
            value={salesFromDate}
            onChange={(event) => setSalesFromDate(event.target.value)}
          />
          <input
            className="admin-inline-search"
            type="date"
            value={salesToDate}
            onChange={(event) => setSalesToDate(event.target.value)}
          />
          <div className="admin-filter-total">
            <strong>{totalUnitsSold}</strong>
            <span>products sold</span>
          </div>
        </div>

        <DataTable columns={salesColumns} rows={salesRows} rowKey="id" />
        {salesRows.length === 0 ? (
          <div className="admin-empty-state" style={{ marginTop: "12px" }}>
            No sold products found for the selected date filter.
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default Inventory;
