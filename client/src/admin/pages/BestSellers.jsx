import { useEffect, useMemo, useState } from "react";
import { collection } from "firebase/firestore";
import ActionButton from "../components/ActionButton";
import DataTable from "../components/DataTable";
import { db } from "../../firebase";
import { formatPrice, normalizeFirestoreProduct } from "../../lib/catalog";
import { subscribeSafely } from "../../lib/firestoreSubscriptions";
import {
  deleteBestSeller,
  saveBestSeller,
  subscribeToBestSellers,
} from "../../lib/adminStore";

const EMPTY_FORM = {
  id: "",
  productName: "",
  category: "",
  price: "",
  stock: "",
  imageUrl: "",
  description: "",
  highlights: "",
  status: "Active",
  sortOrder: "0",
  sourceProductId: "",
};

function toForm(row) {
  return {
    id: row.id || "",
    productName: row.productName || row.name || "",
    category: row.category || "",
    price: String(row.price || ""),
    stock: String(row.stock || ""),
    imageUrl: row.imageUrl || row.image || "",
    description: row.description || "",
    highlights: Array.isArray(row.highlights) ? row.highlights.join(", ") : "",
    status: row.status || "Active",
    sortOrder: String(row.sortOrder || 0),
    sourceProductId: row.sourceProductId || "",
  };
}

function productToBestSeller(product, sortOrder) {
  return {
    sourceProductId: product.documentId || product.id,
    productName: product.name,
    category: product.category,
    price: product.priceTiers?.[0]?.price || product.price,
    stock: product.stock,
    imageUrl: product.image,
    description: product.description || product.story || "",
    highlights: product.highlights || [],
    status: "Active",
    sortOrder,
  };
}

function BestSellers() {
  const [products, setProducts] = useState([]);
  const [bestSellers, setBestSellers] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [feedback, setFeedback] = useState("");
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeSafely(
      collection(db, "products"),
      (snapshot) => {
        const rows = snapshot.docs
          .map((item) => normalizeFirestoreProduct({ id: item.id, ...item.data() }))
          .filter(Boolean);

        setProducts(rows);
        setLoadError("");
      },
      (error) => {
        console.error("Failed to load products for best sellers:", error);
        setLoadError("Could not load available products from Firebase.");
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToBestSellers(
      setBestSellers,
      (error) => {
        console.error("Failed to load best sellers:", error);
        setLoadError("Could not load best sellers from Firebase.");
      }
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

  const selectedBestSellerIds = useMemo(
    () => new Set(bestSellers.map((item) => item.sourceProductId).filter(Boolean)),
    [bestSellers]
  );
  const availableProducts = useMemo(
    () =>
      products.filter((product) => {
        const productId = product.documentId || product.id;
        return !selectedBestSellerIds.has(productId);
      }),
    [products, selectedBestSellerIds]
  );
  const selectedProduct = availableProducts.find((product) => (product.documentId || product.id) === selectedProductId);
  const nextSortOrder = bestSellers.length + 1;
  const categoryOptions = useMemo(
    () => ["Masala", "Flour", "Pantry", ...new Set(products.map((product) => product.category).filter(Boolean))]
      .filter((item, index, list) => list.indexOf(item) === index),
    [products]
  );

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      updateForm("imageUrl", String(reader.result || ""));
    };
    reader.readAsDataURL(file);
  };

  const addExistingProduct = async () => {
    if (!selectedProduct) {
      return;
    }

    await saveBestSeller(productToBestSeller(selectedProduct, nextSortOrder));
    setSelectedProductId("");
    setFeedback(`${selectedProduct.name} added to Best Sellers.`);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.productName.trim()) {
      setLoadError("Best seller product name is required.");
      return;
    }

    try {
      setSaving(true);
      setLoadError("");
      await saveBestSeller({
        ...form,
        highlights: form.highlights
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      });
      setFeedback(form.id ? "Best seller updated successfully." : "Best seller added successfully.");
      setForm(EMPTY_FORM);
    } catch (error) {
      console.error("Failed to save best seller:", error);
      setLoadError(error.message || "Could not save best seller right now.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Remove ${row.productName} from Best Sellers?`)) {
      return;
    }

    await deleteBestSeller(row.id);
    setFeedback(`${row.productName} removed from Best Sellers.`);
  };

  const columns = [
    {
      key: "image",
      label: "Image",
      render: (row) => (
        <img
          src={row.imageUrl || row.image || "https://via.placeholder.com/50"}
          alt={row.productName}
          style={{ width: 50, height: 50, borderRadius: 8, objectFit: "cover" }}
        />
      ),
    },
    { key: "productName", label: "Product" },
    { key: "category", label: "Category" },
    {
      key: "price",
      label: "Price",
      render: (row) => formatPrice(row.price),
    },
    { key: "stock", label: "Total Count", align: "right" },
    { key: "status", label: "Status", type: "status" },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className="admin-row-actions">
          <button type="button" className="admin-panel-action-link" onClick={() => setForm(toForm(row))}>
            Update
          </button>
          <button type="button" className="admin-panel-action-link danger" onClick={() => handleDelete(row)}>
            Remove
          </button>
        </div>
      ),
    },
  ];

  return (
    <section className="admin-module-section admin-search-target">
      {feedback ? <div className="admin-toast-success">{feedback}</div> : null}

      <div className="admin-page-head">
        <div>
          <h2>Best Sellers</h2>
          <p>Add existing catalog products or manual best-seller cards without duplicating the Products page.</p>
        </div>
      </div>

      {loadError ? <div className="admin-empty-state">{loadError}</div> : null}

      <div className="admin-combined-grid">
        <div className="admin-module-card admin-live-form">
          <div className="admin-page-head compact">
            <div>
              <h3>Add Existing Product</h3>
              <p>Only products not already in Best Sellers appear here.</p>
            </div>
          </div>
          <div className="admin-filter-row">
            <select
              className="admin-inline-search"
              value={selectedProductId}
              onChange={(event) => setSelectedProductId(event.target.value)}
            >
              <option value="">Select available product</option>
              {availableProducts.map((product) => (
                <option key={product.documentId || product.id} value={product.documentId || product.id}>
                  {product.name}
                </option>
              ))}
            </select>
            <ActionButton onClick={addExistingProduct} disabled={!selectedProduct}>
              Add to Best Sellers
            </ActionButton>
          </div>
        </div>

        <form className="admin-module-card admin-live-form" onSubmit={handleSubmit}>
          <div className="admin-page-head compact">
            <div>
              <h3>{form.id ? "Update Best Seller" : "Manual Add Best Seller"}</h3>
              <p>Manual entries show only in Best Sellers, not on the Products page.</p>
            </div>
            {form.id ? (
              <button type="button" className="admin-panel-action-link" onClick={() => setForm(EMPTY_FORM)}>
                Clear
              </button>
            ) : null}
          </div>

          <div className="admin-field-grid">
            <label>
              <span>Product Name</span>
              <input value={form.productName} onChange={(event) => updateForm("productName", event.target.value)} />
            </label>
            <label>
              <span>Category</span>
              <select value={form.category} onChange={(event) => updateForm("category", event.target.value)}>
                <option value="">Select category</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Price</span>
              <input type="number" min="0" value={form.price} onChange={(event) => updateForm("price", event.target.value)} />
            </label>
            <label>
              <span>Total Count</span>
              <input type="number" min="0" value={form.stock} onChange={(event) => updateForm("stock", event.target.value)} />
            </label>
            <label>
              <span>Status</span>
              <select value={form.status} onChange={(event) => updateForm("status", event.target.value)}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </label>
            <label>
              <span>Sort Order</span>
              <input type="number" value={form.sortOrder} onChange={(event) => updateForm("sortOrder", event.target.value)} />
            </label>
            <div className="admin-field-full admin-best-seller-image-field">
              <span>Product Image</span>
              <input type="file" accept="image/*" onChange={handleImageChange} />
              {form.imageUrl ? (
                <img src={form.imageUrl} alt="Best seller preview" />
              ) : null}
            </div>
            <label className="admin-field-full">
              <span>Description</span>
              <textarea value={form.description} onChange={(event) => updateForm("description", event.target.value)} />
            </label>
            <label className="admin-field-full">
              <span>Highlights</span>
              <input value={form.highlights} onChange={(event) => updateForm("highlights", event.target.value)} placeholder="Fresh, Popular, Premium" />
            </label>
          </div>

          <ActionButton type="submit" variant="primary" className="admin-form-submit" disabled={saving}>
            {saving ? "Saving..." : form.id ? "Update Best Seller" : "Add Best Seller"}
          </ActionButton>
        </form>
      </div>

      <div className="admin-module-card">
        <DataTable columns={columns} rows={bestSellers} rowKey="id" />
      </div>
    </section>
  );
}

export default BestSellers;
