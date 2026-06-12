import { useEffect, useMemo, useState } from "react";
import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import ActionButton from "../components/ActionButton";
import { db } from "../../firebase";
import { normalizeFirestoreProduct, slugify } from "../../lib/catalog";
import { subscribeSafely } from "../../lib/firestoreSubscriptions";
import {
  buildCategoryPayload,
  deleteCategory,
  mergeCategoriesWithProducts,
  saveCategory,
  subscribeToCategories,
} from "../../lib/adminStore";

const DEFAULT_FORM = {
  name: "",
  image: "",
  description: "",
};

const Categories = () => {
  const [categoryDocs, setCategoryDocs] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeToCategories(
      (categories) => setCategoryDocs(categories),
      (error) => console.error("Failed to load categories:", error)
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeSafely(
      collection(db, "products"),
      (snapshot) => {
        const items = snapshot.docs
          .map((docItem) => normalizeFirestoreProduct({ id: docItem.id, ...docItem.data() }))
          .filter(Boolean);

        setProducts(items);
      },
      (error) => console.error("Failed to load products for categories:", error)
    );

    return () => unsubscribe();
  }, []);

  const categories = useMemo(
    () => mergeCategoriesWithProducts(categoryDocs, products),
    [categoryDocs, products]
  );

  const handleChange = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleEditCategory = (category) => {
    setEditingCategoryId(category.id);
    setForm({
      name: category.name || "",
      image: category.image || "",
      description: category.description || "",
    });
  };

  const handleResetForm = () => {
    setEditingCategoryId("");
    setForm(DEFAULT_FORM);
  };

  const handleAddCategory = async (event) => {
    event.preventDefault();

    if (!form.name.trim()) {
      window.alert("Category name is required.");
      return;
    }

    try {
      setSaving(true);
      const nextCategoryId = slugify(form.name);
      const payload = buildCategoryPayload(form);

      await saveCategory(nextCategoryId, payload);

      if (editingCategoryId && editingCategoryId !== nextCategoryId) {
        await deleteCategory(editingCategoryId);
      }

      handleResetForm();
    } catch (error) {
      console.error("Failed to save category:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (category) => {
    if (!category?.id) {
      return;
    }

    const productsInCategory = products.filter((product) => product.category === category.name);
    const message = productsInCategory.length
      ? `Delete ${category.name}? ${productsInCategory.length} product${productsInCategory.length === 1 ? "" : "s"} will move to Uncategorized.`
      : `Delete ${category.name}?`;

    if (!window.confirm(message)) {
      return;
    }

    try {
      if (productsInCategory.length > 0) {
        const batch = writeBatch(db);

        productsInCategory.forEach((product) => {
          batch.update(doc(db, "products", product.documentId || product.id), {
            category: "Uncategorized",
            updatedAt: serverTimestamp(),
          });
        });

        await batch.commit();
      }

      await deleteCategory(category.id);
      if (editingCategoryId === category.id) {
        handleResetForm();
      }
    } catch (error) {
      console.error("Failed to delete category:", error);
    }
  };

  return (
    <section id="categories" className="admin-module-section admin-search-target">
      <div className="admin-page-head">
        <div>
          <h2>Categories</h2>
          <p>Manage storefront category groups and keep product counts synced live.</p>
        </div>
      </div>

      <div style={styles.layout}>
        <form className="admin-module-card" style={styles.formCard} onSubmit={handleAddCategory}>
          <div style={styles.formHead}>
            <div>
              <h3 style={styles.formTitle}>{editingCategoryId ? "Update Category" : "Add Category"}</h3>
              <p style={styles.formCopy}>Create a category once, then assign products to it from the product form.</p>
            </div>
            <div style={styles.formActions}>
              {editingCategoryId ? (
                <ActionButton onClick={handleResetForm}>Cancel</ActionButton>
              ) : null}
              <ActionButton type="submit" variant="primary">
                {saving ? "Saving..." : editingCategoryId ? "Update Category" : "Save Category"}
              </ActionButton>
            </div>
          </div>

          <label style={styles.label}>
            <span>Category Name</span>
            <input
              className="admin-inline-search"
              value={form.name}
              onChange={(event) => handleChange("name", event.target.value)}
              placeholder="Example: Instant Mixes"
            />
          </label>

          <label style={styles.label}>
            <span>Image URL (Optional)</span>
            <input
              className="admin-inline-search"
              value={form.image}
              onChange={(event) => handleChange("image", event.target.value)}
              placeholder="https://..."
            />
          </label>

          <label style={styles.label}>
            <span>Description (Optional)</span>
            <textarea
              style={styles.textarea}
              value={form.description}
              onChange={(event) => handleChange("description", event.target.value)}
              placeholder="Short storefront note for this category"
            />
          </label>
        </form>

        <div className="admin-category-grid">
          {categories.map((item) => {
            const defaultImage = item.image || "/images/mirchi.png";

            return (
              <article key={item.id} className="admin-category-card">
                <img src={defaultImage} alt={item.name} />
                <div>
                  <div style={styles.cardTitleRow}>
                    <strong>{item.name}</strong>
                    <span style={styles.cardCount}>{item.productCount} Product{item.productCount === 1 ? "" : "s"}</span>
                  </div>
                  {item.description ? <small style={styles.cardNote}>{item.description}</small> : null}
                  <div style={styles.cardActions}>
                    <button type="button" style={styles.cardButton} onClick={() => handleEditCategory(item)}>
                      Update
                    </button>
                    <button type="button" style={styles.deleteButton} onClick={() => handleDeleteCategory(item)}>
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

const styles = {
  layout: {
    display: "grid",
    gap: "24px",
  },
  formCard: {
    display: "grid",
    gap: "16px",
    padding: "24px",
  },
  formHead: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
  },
  formActions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  formTitle: {
    margin: 0,
    color: "#fff2d0",
  },
  formCopy: {
    margin: "6px 0 0",
    color: "#bca885",
  },
  label: {
    display: "grid",
    gap: "8px",
    color: "#e2d6bf",
  },
  textarea: {
    minHeight: "96px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(7, 7, 7, 0.9)",
    color: "#f6f0e6",
    padding: "12px 14px",
    resize: "vertical",
  },
  cardNote: {
    display: "block",
    marginTop: "6px",
    color: "#cfbf9c",
    fontSize: "0.82rem",
    lineHeight: 1.4,
  },
  cardTitleRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "center",
  },
  cardCount: {
    color: "#caa66b",
    fontSize: "0.82rem",
    whiteSpace: "nowrap",
  },
  cardActions: {
    display: "flex",
    gap: "10px",
    marginTop: "12px",
  },
  cardButton: {
    background: "transparent",
    border: 0,
    color: "#f7c56d",
    cursor: "pointer",
    padding: 0,
  },
  deleteButton: {
    background: "transparent",
    border: 0,
    color: "#fca5a5",
    cursor: "pointer",
    padding: 0,
  },
};

export default Categories;
