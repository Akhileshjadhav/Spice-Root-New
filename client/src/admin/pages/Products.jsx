import React, { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, getDocs, query, where } from "firebase/firestore";
import ActionButton from "../components/ActionButton";
import DataTable from "../components/DataTable";
import { db } from "../../firebase";
import { subscribeSafely } from "../../lib/firestoreSubscriptions";
import {
  formatPrice,
  normalizeFirestoreProduct,
  seedMissingCatalogProducts,
} from "../../lib/catalog";
import {
  logProductHistory,
  mergeCategoriesWithProducts,
  subscribeToCategories,
  subscribeToProductHistory,
} from "../../lib/adminStore";
import { exportRowsToExcel } from "../utils/exportExcel";
import AddProductModal from "./AddProductModal";

const VIEW_MODES = [
  { key: "catalog", label: "Live Catalog" },
  { key: "base", label: "1 KG Base Pricing" },
  { key: "discounts", label: "3 KG + 5 KG Discounts" },
];

const Products = () => {
  const [showModal, setShowModal] = useState(false);
  const [products, setProducts] = useState([]);
  const [editProduct, setEditProduct] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [viewMode, setViewMode] = useState("catalog");
  const [restoring, setRestoring] = useState(false);
  const [categoryDocs, setCategoryDocs] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [productHistory, setProductHistory] = useState([]);
  const [showStockDetails, setShowStockDetails] = useState(false);
  const [stockDateFilter, setStockDateFilter] = useState("");
  const [stockActionFilter, setStockActionFilter] = useState("All");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeSafely(
      collection(db, "products"),
      (snapshot) => {
        const firebaseProducts = snapshot.docs
          .map((docItem) => normalizeFirestoreProduct({ id: docItem.id, ...docItem.data() }))
          .filter(Boolean);

        setLoadError("");
        setProducts(firebaseProducts);
      },
      (error) => {
        console.error("Failed to load live products:", error);
        setLoadError("Could not load live products from Firebase. Check Firestore rules and connection.");
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToCategories(
      (categories) => setCategoryDocs(categories),
      (error) => console.error("Failed to load categories:", error)
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToProductHistory(
      setProductHistory,
      (error) => console.error("Failed to load product history:", error)
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }

    const timer = window.setTimeout(() => setFeedback(""), 3200);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const categoryOptions = useMemo(
    () => mergeCategoriesWithProducts(categoryDocs, products).map((item) => item.name),
    [categoryDocs, products]
  );

  const handleDelete = async (row) => {
    const confirmDelete = window.confirm("Delete this product?");
    if (!confirmDelete) {
      return;
    }

    try {
      await logProductHistory("Deleted", row);
      await deleteDoc(doc(db, "products", row.documentId || row.id));

      // Cascade: remove any Best Seller entries that reference this product
      const productId = row.documentId || row.id || row.slug;
      if (productId) {
        const bestSellersSnap = await getDocs(
          query(collection(db, "bestSellers"), where("sourceProductId", "==", productId))
        );
        await Promise.all(bestSellersSnap.docs.map((bsDoc) => deleteDoc(bsDoc.ref)));
      }

      setFeedback("Product deleted successfully.");
    } catch (error) {
      console.error("Failed to delete product:", error);
      setFeedback("Could not delete product. Please try again.");
    }
  };

  const handleEdit = (row) => {
    setEditProduct(row);
    setShowModal(true);
  };

  const handleSeedMissingProducts = async () => {
    const confirmed = window.confirm(
      "Add missing fallback catalog products only. Existing Firestore products will not be changed. Continue?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setRestoring(true);
      const { added } = await seedMissingCatalogProducts();
      setFeedback(
        added > 0
          ? `Added ${added} missing catalog product${added === 1 ? "" : "s"} to Firebase.`
          : "All fallback catalog products are already in Firebase."
      );
    } catch (error) {
      console.error("Failed to seed missing products:", error);
      window.alert("Could not seed missing catalog products right now.");
    } finally {
      setRestoring(false);
    }
  };

  const handleExportProducts = () => {
    const timestamp = new Date();
    const dateTimeLabel = timestamp.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    exportRowsToExcel({
      title: `Spice Root Products Export - ${dateTimeLabel}`,
      fileName: `spice-root-products-${timestamp.toISOString().slice(0, 16)}`,
      columns: [
        { key: "name", label: "Product Name" },
        { key: "category", label: "Category" },
        { key: "price1kg", label: "1 KG Discounted Price", value: (row) => row.priceTiers?.[0]?.price || row.price || 0 },
        { key: "discount1kg", label: "1 KG Discount %", value: (row) => row.priceTiers?.[0]?.discountPercent || 0 },
        { key: "price3kg", label: "3 KG Discounted Price", value: (row) => row.priceTiers?.[1]?.price || 0 },
        { key: "discount3kg", label: "3 KG Discount %", value: (row) => row.priceTiers?.[1]?.discountPercent || 0 },
        { key: "price5kg", label: "5 KG Discounted Price", value: (row) => row.priceTiers?.[2]?.price || 0 },
        { key: "discount5kg", label: "5 KG Discount %", value: (row) => row.priceTiers?.[2]?.discountPercent || 0 },
        { key: "stock", label: "Total Count" },
        { key: "status", label: "Status" },
        { key: "exportedAt", label: "Exported Date & Time", value: () => dateTimeLabel },
      ],
      rows: filteredProducts,
    });
    setFeedback("Products exported to Excel successfully.");
  };

  const filteredProducts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return products.filter((row) => {
      const matchesStatus = statusFilter === "All" || row.status === statusFilter;
      const matchesCategory = categoryFilter === "All" || row.category === categoryFilter;
      const matchesQuery =
        !normalizedQuery ||
        [row.name, row.category, row.slug, row.ingredients]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery));

      return matchesStatus && matchesCategory && matchesQuery;
    });
  }, [categoryFilter, products, searchQuery, statusFilter]);

  const columns = useMemo(() => {
    const imageColumn = {
      key: "image",
      label: "Image",
      render: (row) => (
        <img
          src={row.image || "https://via.placeholder.com/50"}
          alt={row.name || "product"}
          style={{
            width: "50px",
            height: "50px",
            borderRadius: "8px",
            objectFit: "cover",
          }}
        />
      ),
    };

    const actionColumn = {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <button
            type="button"
            onClick={() => handleEdit(row)}
            style={buttonStyles.edit}
          >
            Edit
          </button>

          <button
            type="button"
            onClick={() => handleDelete(row)}
            style={buttonStyles.delete}
          >
            Delete
          </button>
        </div>
      ),
    };

    if (viewMode === "base") {
      return [
        imageColumn,
        { key: "name", label: "Product" },
        { key: "category", label: "Category" },
        {
          key: "basePrice",
          label: "1 KG Original Price",
          render: (row) => formatPrice(row.priceTiers?.[0]?.originalPrice || row.basePrice || row.price),
        },
        {
          key: "discount1kg",
          label: "1 KG Discount",
          render: (row) => `${row.priceTiers?.[0]?.discountPercent || 0}%`,
        },
        {
          key: "price1kg",
          label: "1 KG Discounted Price",
          render: (row) => formatPrice(row.priceTiers?.[0]?.price || row.price),
        },
        { key: "stock", label: "Stock", align: "right" },
        { key: "status", label: "Status", type: "status" },
        actionColumn,
      ];
    }

    if (viewMode === "discounts") {
      return [
        imageColumn,
        { key: "name", label: "Product" },
        {
          key: "original3kg",
          label: "3 KG Original Price",
          render: (row) => formatPrice(row.priceTiers?.[1]?.originalPrice || 0),
        },
        {
          key: "price3kg",
          label: "3 KG Discounted Price",
          render: (row) => formatPrice(row.priceTiers?.[1]?.price || 0),
        },
        {
          key: "discount3kg",
          label: "3 KG Discount",
          render: (row) => `${row.priceTiers?.[1]?.discountPercent || 0}%`,
        },
        {
          key: "original5kg",
          label: "5 KG Original Price",
          render: (row) => formatPrice(row.priceTiers?.[2]?.originalPrice || 0),
        },
        {
          key: "price5kg",
          label: "5 KG Discounted Price",
          render: (row) => formatPrice(row.priceTiers?.[2]?.price || 0),
        },
        {
          key: "discount5kg",
          label: "5 KG Discount",
          render: (row) => `${row.priceTiers?.[2]?.discountPercent || 0}%`,
        },
        actionColumn,
      ];
    }

    return [
      imageColumn,
      { key: "name", label: "Product" },
      { key: "category", label: "Category" },
      {
        key: "basePrice",
        label: "1 KG Price",
        render: (row) => formatPrice(row.basePrice || row.price),
      },
      { key: "stock", label: "Stock", align: "right" },
      { key: "status", label: "Status", type: "status" },
      actionColumn,
    ];
  }, [viewMode]);

  const stockRows = useMemo(() => {
    const rows = productHistory.length
      ? productHistory
      : products.map((product) => ({
          id: product.documentId || product.id,
          action: "Current",
          productName: product.name,
          category: product.category,
          totalCount: product.stock,
          price: product.priceTiers?.[0]?.price || product.price,
          priceLabel: formatPrice(product.priceTiers?.[0]?.price || product.price),
          status: product.status,
          date: "Live",
          time: "Now",
          dateTime: "Live catalog",
          createdAt: null,
        }));

    return rows.filter((row) => {
      const matchesAction = stockActionFilter === "All" || row.action === stockActionFilter;

      if (!stockDateFilter) {
        return matchesAction;
      }

      if (!row.createdAt) {
        return false;
      }

      const rowDate = typeof row.createdAt?.toDate === "function"
        ? row.createdAt.toDate()
        : new Date(row.createdAt);
      const rowDateInput = Number.isNaN(rowDate.getTime()) ? "" : rowDate.toISOString().slice(0, 10);

      return matchesAction && rowDateInput === stockDateFilter;
    });
  }, [productHistory, products, stockActionFilter, stockDateFilter]);

  const stockColumns = [
    { key: "action", label: "Change" },
    { key: "productName", label: "Product Name" },
    { key: "category", label: "Category" },
    { key: "totalCount", label: "Total Count", align: "right" },
    { key: "priceLabel", label: "Price" },
    { key: "date", label: "Date" },
    { key: "time", label: "Time" },
    { key: "status", label: "Status", type: "status" },
  ];

  return (
    <section id="products" className="admin-module-section admin-search-target">
      {feedback ? <div className="admin-toast-success">{feedback}</div> : null}

      <div className="admin-page-head">
        <div>
          <h2>Products</h2>
          <p>Manage live catalog items, pricing, stock, and publish status.</p>
        </div>

        <div className="admin-page-actions">
          <div
            onClick={() => {
              setEditProduct(null);
              setShowModal(true);
            }}
          >
            <ActionButton variant="primary">+ Add Product</ActionButton>
          </div>

          <ActionButton onClick={() => setShowStockDetails((current) => !current)}>
            Stock Details
          </ActionButton>

          <ActionButton onClick={handleSeedMissingProducts} disabled={restoring}>
            {restoring ? "Seeding..." : "Seed Missing Products"}
          </ActionButton>

          <ActionButton onClick={handleExportProducts}>Export to Excel</ActionButton>
        </div>
      </div>

      <div className="admin-filter-row">
        <input
          className="admin-inline-search"
          placeholder="Search products or ingredients..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />

        <select
          className="admin-inline-search"
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
        >
          <option value="All">All Categories</option>
          {categoryOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <select
          className="admin-inline-search"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="All">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Low Stock">Low Stock</option>
          <option value="Coming Soon">Coming Soon</option>
        </select>

        <div className="admin-pill-list">
          {VIEW_MODES.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`admin-filter-chip${viewMode === item.key ? " active" : ""}`}
              onClick={() => setViewMode(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {loadError ? <div className="admin-empty-state">{loadError}</div> : null}

      {showStockDetails ? (
        <div className="admin-module-card">
          <div className="admin-page-head compact">
            <div>
              <h3>Stock Details</h3>
              <p>Live Firebase product history with product name, total count, price, date, and time.</p>
            </div>
          </div>

          <div className="admin-filter-row">
            <input
              className="admin-inline-search"
              type="date"
              value={stockDateFilter}
              onChange={(event) => setStockDateFilter(event.target.value)}
            />
            <select
              className="admin-inline-search"
              value={stockActionFilter}
              onChange={(event) => setStockActionFilter(event.target.value)}
            >
              <option value="All">All Changes</option>
              <option value="Added">Added</option>
              <option value="Updated">Updated</option>
              <option value="Deleted">Deleted</option>
              <option value="Current">Current</option>
            </select>
            <button type="button" className="admin-filter-chip" onClick={() => setStockDateFilter("")}>
              Clear Date
            </button>
          </div>

          <DataTable columns={stockColumns} rows={stockRows} rowKey="id" />
        </div>
      ) : null}

      <div className="admin-module-card">
        <DataTable columns={columns} rows={filteredProducts} rowKey="id" />
      </div>

      {showModal ? (
        <AddProductModal
          closeModal={() => {
            setShowModal(false);
            setEditProduct(null);
          }}
          editProduct={editProduct}
          categoryOptions={categoryOptions}
          onSaved={setFeedback}
        />
      ) : null}
    </section>
  );
};

const buttonStyles = {
  edit: {
    cursor: "pointer",
    color: "#f7a400",
    fontSize: "0.95rem",
    background: "transparent",
    border: 0,
  },
  delete: {
    cursor: "pointer",
    color: "#ff7373",
    fontSize: "0.95rem",
    background: "transparent",
    border: 0,
  },
};

export default Products;
