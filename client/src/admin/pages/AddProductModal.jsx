import React, { useEffect, useMemo, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../../firebase";
import { serializeProductForFirestore, slugify } from "../../lib/catalog";
import { getDefaultCategoryDefinitions, getProductStatusOptions, logProductHistory } from "../../lib/adminStore";

const STATUS_OPTIONS = getProductStatusOptions();
const DEFAULT_CATEGORY_OPTIONS = getDefaultCategoryDefinitions().map((item) => item.name);

const DEFAULT_FORM = {
  productName: "",
  category: DEFAULT_CATEGORY_OPTIONS[0] || "Masala",
  price: "",
  discount1Kg: "0",
  discount3Kg: "5",
  discount5Kg: "10",
  stock: "",
  description: "",
  ingredients: "",
  status: "Active",
};

function clampDiscount(value, fallback) {
  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return fallback;
  }

  return Math.min(100, Math.max(0, numericValue));
}

function buildPriceTier(key, label, basePrice, multiplier, discountPercent) {
  const originalPrice = Math.round(basePrice * multiplier);
  const price = Math.round(originalPrice * (1 - discountPercent / 100));

  return {
    key,
    label,
    size: label,
    price,
    originalPrice,
    discountPercent,
    hasDiscount: discountPercent > 0 && price < originalPrice,
  };
}

function readExistingDiscount(editProduct, index, fallbackValue) {
  return String(
    editProduct?.priceTiers?.[index]?.discountPercent ??
      fallbackValue
  );
}

function getSaveProductErrorMessage(error) {
  const code = error?.code || "";

  if (code === "permission-denied") {
    return "Firestore rejected this save. Check your products collection rules and confirm the admin account can write product documents.";
  }

  if (code === "unavailable") {
    return "Firebase is temporarily unavailable. Please check your connection and try saving again.";
  }

  if (code === "storage/unauthenticated") {
    return "Your admin session is not authenticated for Storage. Sign out, sign back in, and try again.";
  }

  if (code === "storage/unauthorized") {
    return "Storage rejected this upload. Check your Firebase Storage rules and confirm admin users are allowed to write to the products folder.";
  }

  if (code === "storage/bucket-not-found" || code === "storage/project-not-found") {
    return "Firebase Storage is not configured correctly for this project. Verify the storage bucket name in frontend/.env and confirm Storage is enabled in Firebase.";
  }

  if (code === "storage/quota-exceeded") {
    return "Firebase Storage is blocked by project quota or plan limits. In Firebase, upgrade the project to the Blaze plan and try the upload again.";
  }

  return "Error saving product. Check the browser console for the exact Firebase Storage error.";
}

async function buildUniqueProductIdentity(name, editProduct) {
  const fallbackSlug = `product-${Date.now()}`;
  const baseSlug = slugify(name) || fallbackSlug;

  if (editProduct) {
    const existingSlug = editProduct.slug || editProduct.id || baseSlug;

    return {
      slug: existingSlug,
      documentId: editProduct.documentId || editProduct.id || existingSlug,
    };
  }

  let candidateSlug = baseSlug;
  let candidateId = baseSlug;
  let suffix = 1;

  while ((await getDoc(doc(db, "products", candidateId))).exists()) {
    suffix += 1;
    candidateSlug = `${baseSlug}-${suffix}`;
    candidateId = candidateSlug;
  }

  return {
    slug: candidateSlug,
    documentId: candidateId,
  };
}

const AddProductModal = ({ closeModal, editProduct, categoryOptions = [], onSaved, defaultFeatured = false }) => {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [saving, setSaving] = useState(false);
  const resolvedCategoryOptions = categoryOptions.length ? categoryOptions : DEFAULT_CATEGORY_OPTIONS;

  useEffect(() => {
    if (!editProduct) {
      setForm({
        ...DEFAULT_FORM,
        category: resolvedCategoryOptions[0] || DEFAULT_FORM.category,
      });
      setImagePreview("");
      setImageFile(null);
      return;
    }

    setForm({
      productName: editProduct.name || editProduct.productName || "",
      category: editProduct.category || resolvedCategoryOptions[0] || DEFAULT_FORM.category,
      price: String(editProduct.basePrice || editProduct.price || ""),
      discount1Kg: readExistingDiscount(editProduct, 0, 0),
      discount3Kg: readExistingDiscount(editProduct, 1, 5),
      discount5Kg: readExistingDiscount(editProduct, 2, 10),
      stock: String(editProduct.stock || ""),
      description: editProduct.description || editProduct.story || "",
      ingredients: editProduct.ingredients || "",
      status: editProduct.status || "Active",
    });
    setImagePreview(editProduct.image || editProduct.imageUrl || "");
    setImageFile(null);
  }, [editProduct, resolvedCategoryOptions]);

  const computedPricing = useMemo(() => {
    const basePrice = Math.round(Number(form.price) || 0);
    const discount1Kg = clampDiscount(form.discount1Kg, 0);
    const discount3Kg = clampDiscount(form.discount3Kg, 5);
    const discount5Kg = clampDiscount(form.discount5Kg, 10);

    return {
      basePrice,
      discount1Kg,
      discount3Kg,
      discount5Kg,
      price1Kg: buildPriceTier("1kg", "1 KG", basePrice, 1, discount1Kg),
      price3Kg: buildPriceTier("3kg", "3 KG", basePrice, 3, discount3Kg),
      price5Kg: buildPriceTier("5kg", "5 KG", basePrice, 5, discount5Kg),
    };
  }, [form.discount1Kg, form.discount3Kg, form.discount5Kg, form.price]);

  const handleChange = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0] || null;
    setImageFile(file);

    if (file) {
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSaveProduct = async () => {
    if (!form.productName.trim() || !form.category || !form.price || !form.stock) {
      window.alert("Please fill all required fields.");
      return;
    }

    const basePrice = computedPricing.basePrice;
    const stockCount = Number(form.stock);

    if (basePrice <= 0) {
      window.alert("Please enter a valid product price.");
      return;
    }

    if (!Number.isFinite(stockCount) || stockCount < 0) {
      window.alert("Please enter a valid stock quantity.");
      return;
    }

    try {
      setSaving(true);
      let imageUrl = editProduct?.image || editProduct?.imageUrl || "";

      if (!imageFile && !imageUrl) {
        window.alert("Please upload a product image before saving.");
        setSaving(false);
        return;
      }

      if (imageFile) {
        const safeFileName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const imageRef = ref(storage, `products/${Date.now()}-${safeFileName}`);
        const snapshot = await uploadBytes(imageRef, imageFile, { contentType: imageFile.type || "image/jpeg" });
        imageUrl = await getDownloadURL(snapshot.ref);
      }

      const { slug: productSlug, documentId } = await buildUniqueProductIdentity(
        form.productName,
        editProduct
      );
      const description = form.description.trim();
      const ingredients = form.ingredients.trim();

      const productForSave = {
        id: productSlug,
        slug: productSlug,
        name: form.productName.trim(),
        category: form.category,
        basePrice,
        price: basePrice,
        stock: stockCount,
        description,
        story: description,
        ingredients,
        status: form.status,
        image: imageUrl,
        unit: "1 KG",
        featured: editProduct ? Boolean(editProduct.featured) : Boolean(defaultFeatured),
        rating: editProduct?.rating || 4.8,
        ratingCount: editProduct?.ratingCount || 100,
        highlights: editProduct?.highlights || ["Premium quality", "Freshly packed", "Crafted for modern kitchens"],
        priceTiers: [
          computedPricing.price1Kg,
          computedPricing.price3Kg,
          computedPricing.price5Kg,
        ],
      };
      const payload = serializeProductForFirestore(productForSave);
      const productPayload = editProduct
        ? payload
        : {
            ...payload,
            createdAt: serverTimestamp(),
          };

      await setDoc(doc(db, "products", documentId), productPayload, { merge: true });
      await logProductHistory(editProduct ? "Updated" : "Added", {
        ...productForSave,
        documentId,
      });

      onSaved?.(editProduct ? "Product updated successfully." : "Product added successfully.");
      closeModal();
    } catch (error) {
      console.error("Error saving product:", error);
      window.alert(getSaveProductErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2>{editProduct ? "Edit Product" : "Add New Product"}</h2>
          <button type="button" style={styles.close} onClick={closeModal}>
            x
          </button>
        </div>

        <label style={styles.label}>Product Name</label>
        <input
          style={styles.input}
          value={form.productName}
          onChange={(event) => handleChange("productName", event.target.value)}
          placeholder="Mirchi Powder"
        />

        <label style={styles.label}>Category</label>
        <select
          style={styles.input}
          value={form.category}
          onChange={(event) => handleChange("category", event.target.value)}
        >
          {resolvedCategoryOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <div style={styles.row}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>1 KG Base Price</label>
            <input
              style={styles.inputHalf}
              type="number"
              min="0"
              placeholder="550"
              value={form.price}
              onChange={(event) => handleChange("price", event.target.value)}
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Stock</label>
            <input
              style={styles.inputHalf}
              type="number"
              min="0"
              placeholder="100"
              value={form.stock}
              onChange={(event) => handleChange("stock", event.target.value)}
            />
          </div>
        </div>

        <div style={styles.row}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>1 KG Discount %</label>
            <input
              style={styles.inputHalf}
              type="number"
              min="0"
              max="100"
              placeholder="0"
              value={form.discount1Kg}
              onChange={(event) => handleChange("discount1Kg", event.target.value)}
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>3 KG Discount %</label>
            <input
              style={styles.inputHalf}
              type="number"
              min="0"
              max="100"
              placeholder="5"
              value={form.discount3Kg}
              onChange={(event) => handleChange("discount3Kg", event.target.value)}
            />
          </div>
        </div>

        <div style={styles.row}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>5 KG Discount %</label>
            <input
              style={styles.inputHalf}
              type="number"
              min="0"
              max="100"
              placeholder="10"
              value={form.discount5Kg}
              onChange={(event) => handleChange("discount5Kg", event.target.value)}
            />
          </div>
        </div>

        <div style={styles.pricingPreview}>
          <strong>Auto pricing preview</strong>
          <span>
            1 KG: Rs. {computedPricing.price1Kg.price || 0} ({computedPricing.discount1Kg}% discount)
          </span>
          <span>
            3 KG: Rs. {computedPricing.price3Kg.price || 0} ({computedPricing.discount3Kg}% discount)
          </span>
          <span>
            5 KG: Rs. {computedPricing.price5Kg.price || 0} ({computedPricing.discount5Kg}% discount)
          </span>
        </div>

        <label style={styles.label}>Description</label>
        <textarea
          style={styles.textarea}
          value={form.description}
          onChange={(event) => handleChange("description", event.target.value)}
          placeholder="Short description for the product detail page"
        />

        <label style={styles.label}>Ingredients (Optional)</label>
        <textarea
          style={styles.ingredients}
          value={form.ingredients}
          onChange={(event) => handleChange("ingredients", event.target.value)}
          placeholder="Example: Red chilli, garlic, cumin, coriander"
        />

        <label style={styles.label}>Status</label>
        <select
          style={styles.input}
          value={form.status}
          onChange={(event) => handleChange("status", event.target.value)}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <label style={styles.label}>Product Image</label>
        <input type="file" accept="image/*" onChange={handleImageChange} />

        {imagePreview ? <img src={imagePreview} alt="preview" style={styles.preview} /> : null}

        <button style={styles.saveBtn} onClick={handleSaveProduct} disabled={saving}>
          {saving ? "Saving..." : editProduct ? "Update Product" : "Save Product"}
        </button>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0, 0, 0, 0.75)",
    backdropFilter: "blur(4px)",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    paddingTop: "80px",
    overflowY: "auto",
    zIndex: 999,
  },
  modal: {
    width: "560px",
    background: "linear-gradient(145deg, #111111, #1d1d1d)",
    border: "1px solid rgba(255,165,0,0.2)",
    borderRadius: "18px",
    padding: "30px",
    boxShadow: "0 0 25px rgba(255,165,0,0.15)",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    maxHeight: "85vh",
    overflowY: "auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: "#f7a400",
  },
  close: {
    cursor: "pointer",
    background: "transparent",
    color: "#f7a400",
    border: 0,
    fontSize: "1rem",
  },
  label: { color: "#ccc" },
  input: {
    padding: "10px",
    background: "#000",
    color: "#fff",
    border: "1px solid #333",
    borderRadius: "8px",
  },
  row: { display: "flex", gap: "10px" },
  fieldGroup: { flex: 1, display: "flex", flexDirection: "column", gap: "8px" },
  inputHalf: {
    width: "100%",
    padding: "10px",
    background: "#000",
    color: "#fff",
    border: "1px solid #333",
    borderRadius: "8px",
  },
  textarea: {
    minHeight: "120px",
    padding: "10px",
    background: "#000",
    color: "#fff",
    border: "1px solid #333",
    borderRadius: "8px",
  },
  ingredients: {
    minHeight: "90px",
    padding: "10px",
    background: "#000",
    color: "#d8d8d8",
    border: "1px solid #333",
    borderRadius: "8px",
    fontSize: "0.92rem",
  },
  pricingPreview: {
    display: "grid",
    gap: "6px",
    padding: "14px",
    borderRadius: "12px",
    background: "rgba(247, 164, 0, 0.08)",
    border: "1px solid rgba(247, 164, 0, 0.16)",
    color: "#f6d9a2",
  },
  preview: {
    width: "120px",
    height: "120px",
    objectFit: "cover",
    borderRadius: "10px",
  },
  saveBtn: {
    background: "#f7a400",
    padding: "12px",
    borderRadius: "8px",
    border: "none",
    fontWeight: "bold",
    cursor: "pointer",
  },
};

export default AddProductModal;
