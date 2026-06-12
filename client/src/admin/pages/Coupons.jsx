import { useEffect, useMemo, useState } from "react";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import ActionButton from "../components/ActionButton";
import DataTable from "../components/DataTable";
import StatusBadge from "../components/StatusBadge";
import { storage } from "../../firebase";
import {
  deleteBanner,
  deleteCoupon,
  saveBanner,
  saveCoupon,
  subscribeToBanners,
  subscribeToCoupons,
} from "../../lib/offers";

const EMPTY_COUPON_FORM = {
  id: "",
  code: "",
  title: "",
  description: "",
  discountValue: "",
  type: "Percentage",
  minOrderValue: "",
  usageCount: "0",
  usageLimit: "",
  expiresAt: "",
  status: "Active",
};

const EMPTY_BANNER_FORM = {
  id: "",
  title: "",
  subtitle: "",
  eyebrow: "Special Offer",
  buttonText: "Shop Now",
  buttonLink: "/products",
  couponCode: "",
  location: "Offers Page",
  imageUrl: "",
  status: "Active",
  sortOrder: "0",
};

const COUPON_STATUSES = ["Active", "Inactive", "Expired"];
const BANNER_STATUSES = ["Active", "Draft", "Inactive"];
const COUPON_TYPES = ["Percentage", "Flat", "Free Delivery"];
const FIRESTORE_IMAGE_MAX_BYTES = 900 * 1024;

function normalizeSearch(value) {
  return String(value || "").trim().toLowerCase();
}

function toCouponForm(coupon) {
  return {
    id: coupon.id,
    code: coupon.code,
    title: coupon.title,
    description: coupon.description,
    discountValue: String(coupon.discountValue || ""),
    type: coupon.type,
    minOrderValue: String(coupon.minOrderValue || ""),
    usageCount: String(coupon.usageCount || 0),
    usageLimit: String(coupon.usageLimit || ""),
    expiresAt: coupon.expiresInput || "",
    status: coupon.status,
  };
}

function toBannerForm(banner) {
  return {
    id: banner.id,
    title: banner.title,
    subtitle: banner.subtitle,
    eyebrow: banner.eyebrow,
    buttonText: banner.buttonText,
    buttonLink: banner.buttonLink,
    couponCode: banner.couponCode,
    location: banner.location,
    imageUrl: banner.imageUrl,
    status: banner.status,
    sortOrder: String(banner.sortOrder || 0),
  };
}

function getFirebaseError(error, fallback) {
  if (error?.code === "permission-denied") {
    return "Firebase rejected this change. Check Firestore rules for admin writes.";
  }

  if (String(error?.code || "").startsWith("storage/")) {
    return "Firebase Storage rejected the image upload. Check Storage rules and bucket configuration.";
  }

  return fallback;
}

function isStorageError(error) {
  return String(error?.code || "").startsWith("storage/");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Could not read banner image."));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not prepare banner image."));
    image.src = dataUrl;
  });
}

function getDataUrlBytes(dataUrl) {
  return Math.ceil((String(dataUrl).length * 3) / 4);
}

async function compressBannerFileToDataUrl(file) {
  const sourceDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(sourceDataUrl);
  const canvas = document.createElement("canvas");
  const maxWidth = 1400;
  const scale = Math.min(1, maxWidth / image.width);

  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const context = canvas.getContext("2d");

  if (!context) {
    if (file.size <= FIRESTORE_IMAGE_MAX_BYTES) {
      return sourceDataUrl;
    }

    throw new Error("Banner image is too large for Firestore fallback.");
  }

  context.fillStyle = "#1f1209";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  for (const quality of [0.82, 0.72, 0.62, 0.52]) {
    const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);

    if (getDataUrlBytes(compressedDataUrl) <= FIRESTORE_IMAGE_MAX_BYTES) {
      return compressedDataUrl;
    }
  }

  throw new Error("Banner image is too large. Please choose a smaller image.");
}

function Coupons() {
  const [coupons, setCoupons] = useState([]);
  const [banners, setBanners] = useState([]);
  const [couponForm, setCouponForm] = useState(EMPTY_COUPON_FORM);
  const [bannerForm, setBannerForm] = useState(EMPTY_BANNER_FORM);
  const [bannerFile, setBannerFile] = useState(null);
  const [couponSearch, setCouponSearch] = useState("");
  const [discountFilter, setDiscountFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [usageFilter, setUsageFilter] = useState("");
  const [expiresFilter, setExpiresFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [savingCoupon, setSavingCoupon] = useState(false);
  const [savingBanner, setSavingBanner] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeToCoupons(
      setCoupons,
      (error) => {
        console.error("Failed to load live coupons:", error);
        setErrorMessage("Could not load coupons from Firebase.");
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToBanners(
      setBanners,
      (error) => {
        console.error("Failed to load live banners:", error);
        setErrorMessage("Could not load website banners from Firebase.");
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

  const filteredCoupons = useMemo(() => {
    const search = normalizeSearch(couponSearch);
    const discount = normalizeSearch(discountFilter);
    const usage = normalizeSearch(usageFilter);
    const expires = normalizeSearch(expiresFilter);

    return coupons.filter((coupon) => {
      const matchesSearch =
        !search ||
        [coupon.code, coupon.title, coupon.description]
          .filter(Boolean)
          .some((value) => normalizeSearch(value).includes(search));
      const matchesDiscount = !discount || normalizeSearch(coupon.discount).includes(discount);
      const matchesType = typeFilter === "All" || coupon.type === typeFilter;
      const matchesUsage = !usage || normalizeSearch(coupon.usage).includes(usage);
      const matchesExpires = !expires || normalizeSearch(coupon.expires).includes(expires) || coupon.expiresInput === expiresFilter;
      const matchesStatus = statusFilter === "All" || coupon.status === statusFilter;

      return matchesSearch && matchesDiscount && matchesType && matchesUsage && matchesExpires && matchesStatus;
    });
  }, [couponSearch, coupons, discountFilter, expiresFilter, statusFilter, typeFilter, usageFilter]);

  const activeCoupons = coupons.filter((coupon) => coupon.status === "Active").length;
  const activeBanners = banners.filter((banner) => banner.status === "Active").length;

  const updateCouponForm = (key, value) => {
    setCouponForm((current) => ({ ...current, [key]: value }));
    setErrorMessage("");
    setFeedback("");
  };

  const updateBannerForm = (key, value) => {
    setBannerForm((current) => ({ ...current, [key]: value }));
    setErrorMessage("");
    setFeedback("");
  };

  const handleSaveCoupon = async (event) => {
    event.preventDefault();

    if (!couponForm.code.trim()) {
      setErrorMessage("Coupon code is required.");
      return;
    }

    if (!Number(couponForm.discountValue)) {
      setErrorMessage("Discount value is required.");
      return;
    }

    try {
      setSavingCoupon(true);
      await saveCoupon(couponForm);
      setFeedback(couponForm.id ? "Coupon updated successfully." : "Coupon added successfully.");
      setCouponForm(EMPTY_COUPON_FORM);
    } catch (error) {
      console.error("Failed to save coupon:", error);
      setErrorMessage(getFirebaseError(error, "Could not save coupon right now."));
    } finally {
      setSavingCoupon(false);
    }
  };

  const handleDeleteCoupon = async (coupon) => {
    if (!window.confirm(`Delete coupon ${coupon.code}?`)) {
      return;
    }

    try {
      await deleteCoupon(coupon.id);
      setFeedback("Coupon deleted successfully.");
    } catch (error) {
      console.error("Failed to delete coupon:", error);
      setErrorMessage(getFirebaseError(error, "Could not delete coupon right now."));
    }
  };

  const handleBannerFile = (event) => {
    const file = event.target.files?.[0] || null;
    setBannerFile(file);

    if (file) {
      updateBannerForm("imageUrl", URL.createObjectURL(file));
    }
  };

  const handleSaveBanner = async (event) => {
    event.preventDefault();

    if (!bannerForm.title.trim()) {
      setErrorMessage("Banner title is required.");
      return;
    }

    try {
      setSavingBanner(true);
      let imageUrl = bannerForm.imageUrl;

      if (!bannerFile && String(imageUrl || "").startsWith("blob:")) {
        imageUrl = "";
      }

      if (bannerFile) {
        const safeFileName = bannerFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const imageRef = ref(storage, `banners/${Date.now()}-${safeFileName}`);
        try {
          const snapshot = await uploadBytes(imageRef, bannerFile, { contentType: bannerFile.type || "image/jpeg" });
          imageUrl = await getDownloadURL(snapshot.ref);
        } catch (uploadError) {
          if (!isStorageError(uploadError)) {
            throw uploadError;
          }

          console.warn("Firebase Storage upload failed. Saving compressed banner image in Firestore instead.", uploadError);
          imageUrl = await compressBannerFileToDataUrl(bannerFile);
        }
      }

      await saveBanner({ ...bannerForm, imageUrl });
      setFeedback(bannerForm.id ? "Banner updated successfully." : "Banner added successfully.");
      setBannerForm(EMPTY_BANNER_FORM);
      setBannerFile(null);
    } catch (error) {
      console.error("Failed to save banner:", error);
      setErrorMessage(getFirebaseError(error, "Could not save banner right now."));
    } finally {
      setSavingBanner(false);
    }
  };

  const handleDeleteBanner = async (banner) => {
    if (!window.confirm(`Delete banner ${banner.title}?`)) {
      return;
    }

    try {
      await deleteBanner(banner.id);
      setFeedback("Banner deleted successfully.");
    } catch (error) {
      console.error("Failed to delete banner:", error);
      setErrorMessage(getFirebaseError(error, "Could not delete banner right now."));
    }
  };

  const couponColumns = [
    { key: "code", label: "Coupon Code" },
    { key: "discount", label: "Discount" },
    { key: "type", label: "Type" },
    { key: "usage", label: "Usage" },
    { key: "expires", label: "Expires" },
    { key: "status", label: "Status", type: "status" },
    {
      key: "actions",
      label: "Action",
      render: (row) => (
        <div className="admin-row-actions">
          <button type="button" className="admin-panel-action-link" onClick={() => setCouponForm(toCouponForm(row))}>
            Update
          </button>
          <button
            type="button"
            className="admin-panel-action-link danger"
            onClick={() => handleDeleteCoupon(row)}
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <section className="admin-module-section admin-search-target">
      <div className="admin-page-head">
        <div>
          <h2>Coupons, Offers & Website Banners</h2>
          <p>Manage live coupon pricing rules and the offer banners shown on the website.</p>
        </div>
      </div>

      {feedback ? <div className="admin-toast-success">{feedback}</div> : null}
      {errorMessage ? <div className="admin-empty-state">{errorMessage}</div> : null}

      <div className="admin-combined-grid admin-offers-editor-grid">
        <form className="admin-module-card admin-live-form admin-offer-editor-card" onSubmit={handleSaveCoupon}>
          <div className="admin-page-head compact">
            <div>
              <h3>{couponForm.id ? "Update Coupon" : "Add Coupon"}</h3>
              <p>Coupon discounts sync with cart and checkout totals.</p>
            </div>
            <div className="admin-page-actions">
              <div className="admin-filter-total admin-filter-total-compact">
                <strong>{activeCoupons}</strong>
                <span>active coupons</span>
              </div>
              {couponForm.id ? (
                <button type="button" className="admin-panel-action-link" onClick={() => setCouponForm(EMPTY_COUPON_FORM)}>
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          <div className="admin-field-grid">
            <label>
              <span>Coupon Code</span>
              <input value={couponForm.code} onChange={(event) => updateCouponForm("code", event.target.value.toUpperCase())} />
            </label>
            <label>
              <span>Discount</span>
              <input type="number" min="0" value={couponForm.discountValue} onChange={(event) => updateCouponForm("discountValue", event.target.value)} />
            </label>
            <label>
              <span>Type</span>
              <select value={couponForm.type} onChange={(event) => updateCouponForm("type", event.target.value)}>
                {COUPON_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <label>
              <span>Minimum Order</span>
              <input type="number" min="0" value={couponForm.minOrderValue} onChange={(event) => updateCouponForm("minOrderValue", event.target.value)} />
            </label>
            <label>
              <span>Usage Count</span>
              <input type="number" min="0" value={couponForm.usageCount} onChange={(event) => updateCouponForm("usageCount", event.target.value)} />
            </label>
            <label>
              <span>Usage Limit</span>
              <input type="number" min="0" value={couponForm.usageLimit} onChange={(event) => updateCouponForm("usageLimit", event.target.value)} />
            </label>
            <label>
              <span>Expires</span>
              <input type="date" value={couponForm.expiresAt} onChange={(event) => updateCouponForm("expiresAt", event.target.value)} />
            </label>
            <label>
              <span>Status</span>
              <select value={couponForm.status} onChange={(event) => updateCouponForm("status", event.target.value)}>
                {COUPON_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <label className="admin-field-full">
              <span>Offer Title</span>
              <input value={couponForm.title} onChange={(event) => updateCouponForm("title", event.target.value)} />
            </label>
            <label className="admin-field-full">
              <span>Description</span>
              <textarea value={couponForm.description} onChange={(event) => updateCouponForm("description", event.target.value)} />
            </label>
          </div>

          <ActionButton type="submit" variant="primary" className="admin-form-submit" disabled={savingCoupon}>
            {savingCoupon ? "Saving..." : couponForm.id ? "Update Coupon" : "Add Coupon"}
          </ActionButton>
        </form>

        <form className="admin-module-card admin-live-form admin-offer-editor-card" onSubmit={handleSaveBanner}>
          <div className="admin-page-head compact">
            <div>
              <h3>{bannerForm.id ? "Update Website Banner" : "Add Website Banner"}</h3>
              <p>Active banners appear on the Offers page and can link to any store route.</p>
            </div>
            <div className="admin-page-actions">
              <div className="admin-filter-total admin-filter-total-compact">
                <strong>{activeBanners}</strong>
                <span>active banners</span>
              </div>
              {bannerForm.id ? (
                <button type="button" className="admin-panel-action-link" onClick={() => setBannerForm(EMPTY_BANNER_FORM)}>
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          <div className="admin-field-grid">
            <label>
              <span>Title</span>
              <input value={bannerForm.title} onChange={(event) => updateBannerForm("title", event.target.value)} />
            </label>
            <label>
              <span>Eyebrow</span>
              <input value={bannerForm.eyebrow} onChange={(event) => updateBannerForm("eyebrow", event.target.value)} />
            </label>
            <label className="admin-field-full">
              <span>Subtitle</span>
              <input value={bannerForm.subtitle} onChange={(event) => updateBannerForm("subtitle", event.target.value)} />
            </label>
            <label>
              <span>Button Text</span>
              <input value={bannerForm.buttonText} onChange={(event) => updateBannerForm("buttonText", event.target.value)} />
            </label>
            <label>
              <span>Button Link</span>
              <input value={bannerForm.buttonLink} onChange={(event) => updateBannerForm("buttonLink", event.target.value)} />
            </label>
            <label>
              <span>Coupon Code</span>
              <input value={bannerForm.couponCode} onChange={(event) => updateBannerForm("couponCode", event.target.value.toUpperCase())} />
            </label>
            <label>
              <span>Location</span>
              <input value={bannerForm.location} onChange={(event) => updateBannerForm("location", event.target.value)} />
            </label>
            <label>
              <span>Sort Order</span>
              <input type="number" value={bannerForm.sortOrder} onChange={(event) => updateBannerForm("sortOrder", event.target.value)} />
            </label>
            <label>
              <span>Status</span>
              <select value={bannerForm.status} onChange={(event) => updateBannerForm("status", event.target.value)}>
                {BANNER_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <label className="admin-field-full">
              <span>Banner Image URL</span>
              <input
                value={bannerForm.imageUrl.startsWith("blob:") ? "" : bannerForm.imageUrl}
                placeholder="/images/home-light.png or https://..."
                onChange={(event) => {
                  setBannerFile(null);
                  updateBannerForm("imageUrl", event.target.value);
                }}
              />
            </label>
            <label className="admin-field-full">
              <span>Banner Image</span>
              <input type="file" accept="image/*" onChange={handleBannerFile} />
            </label>
          </div>

          {bannerForm.imageUrl ? (
            <img className="admin-banner-preview" src={bannerForm.imageUrl} alt="Banner preview" />
          ) : null}

          <ActionButton type="submit" variant="primary" className="admin-form-submit" disabled={savingBanner}>
            {savingBanner ? "Saving..." : bannerForm.id ? "Update Banner" : "Add Banner"}
          </ActionButton>
        </form>
      </div>

      <div className="admin-module-card">
        <div className="admin-page-head compact">
          <div>
            <h3>Coupons & Offers</h3>
            <p>Filter by Coupon Code, Discount, Type, Usage, Expires, and Status.</p>
          </div>
        </div>

        <div className="admin-filter-row admin-coupon-filter-row">
          <input className="admin-inline-search" placeholder="Coupon code..." value={couponSearch} onChange={(event) => setCouponSearch(event.target.value)} />
          <input className="admin-inline-search" placeholder="Discount..." value={discountFilter} onChange={(event) => setDiscountFilter(event.target.value)} />
          <select className="admin-inline-search" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="All">All Types</option>
            {COUPON_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <input className="admin-inline-search" placeholder="Usage..." value={usageFilter} onChange={(event) => setUsageFilter(event.target.value)} />
          <input className="admin-inline-search" type="date" value={expiresFilter} onChange={(event) => setExpiresFilter(event.target.value)} />
          <select className="admin-inline-search admin-compact-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="All">All Status</option>
            {COUPON_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </div>

        <DataTable columns={couponColumns} rows={filteredCoupons} rowKey="id" />
      </div>

      <div className="admin-module-card">
        <div className="admin-page-head compact">
          <div>
            <h3>Website CMS Banners</h3>
            <p>Add, update, delete, and publish live website offer banners.</p>
          </div>
        </div>

        <div className="admin-banner-list admin-live-banner-list">
          {banners.length === 0 ? (
            <div className="admin-empty-state">No banners yet. Add a banner to publish it on the Offers page.</div>
          ) : (
            banners.map((banner) => (
              <article key={banner.id} className="admin-banner-card">
                <img src={banner.imageUrl} alt={banner.title} />
                <div className="admin-banner-copy">
                  <strong>{banner.title}</strong>
                  <span>{banner.location}</span>
                  <small>{banner.couponCode ? `Code: ${banner.couponCode}` : banner.subtitle}</small>
                </div>
                <StatusBadge status={banner.status} />
                <div className="admin-row-actions">
                  <button type="button" className="admin-panel-action-link" onClick={() => setBannerForm(toBannerForm(banner))}>
                    Update
                  </button>
                  <button type="button" className="admin-panel-action-link danger" onClick={() => handleDeleteBanner(banner)}>
                    Delete
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

export default Coupons;
