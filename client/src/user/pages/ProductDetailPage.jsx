import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import Footer from "../../components/Footer";
import TiltCard from "../components/TiltCard";
import Navbar from "../components/Navbar";
import { useAuth } from "../../context/useAuth";
import { useCart } from "../../context/useCart";
import { submitReview, subscribeToApprovedProductReviews } from "../../lib/adminStore";
import {
  findProductByRouteParam,
  formatPrice,
  getRelatedProducts,
  subscribeToCatalog,
} from "../../lib/catalog";
import "../../styles/products-listing.css";
import "../../styles/luxury-spice.css";
import "../../styles/navbar-final.css";

const MotionArticle = motion.article;
const MotionDiv = motion.div;

const reasons = [
  { title: "100% Natural", subtitle: "Pure and organic" },
  { title: "Farm Fresh Sourced", subtitle: "Direct from farms" },
  { title: "No Chemicals", subtitle: "No additives" },
  { title: "Rich Aroma", subtitle: "Amazing flavor" },
];

function ProductDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { productId } = useParams();
  const { currentUser, isAdmin, isAuthenticated, loading: authLoading, logoutUser, userProfile } = useAuth();
  const { addItem } = useCart();
  const showCustomerSession = isAuthenticated && !isAdmin;
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState("loading");
  const [reviews, setReviews] = useState([]);
  const [reviewDraft, setReviewDraft] = useState({ rating: 5, review: "" });
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [selection, setSelection] = useState({
    productId,
    selectedSize: 0,
    quantity: 1,
  });

  useEffect(() => {
    setSelection({
      productId,
      selectedSize: 0,
      quantity: 1,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [productId]);

  useEffect(() => {
    const unsubscribe = subscribeToCatalog(
      (catalog) => {
        setProducts(catalog);
        setStatus("ready");
      },
      (error) => {
        console.error("Failed to subscribe to catalog:", error);
        setStatus("ready");
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToApprovedProductReviews(
      productId,
      setReviews,
      (error) => console.error("Failed to load product reviews:", error)
    );

    return () => unsubscribe();
  }, [productId]);

  const product = useMemo(
    () => findProductByRouteParam(products, productId),
    [productId, products]
  );

  const relatedProducts = useMemo(
    () => getRelatedProducts(products, productId, 4),
    [productId, products]
  );
  const approvedProductReviews = reviews;
  const displayedRating = useMemo(() => {
    if (approvedProductReviews.length === 0) {
      return {
        average: product?.rating || 5,
        count: product?.ratingCount || 0,
      };
    }

    const totalRating = approvedProductReviews.reduce((sum, item) => sum + item.rating, 0);
    return {
      average: totalRating / approvedProductReviews.length,
      count: approvedProductReviews.length,
    };
  }, [approvedProductReviews, product?.rating, product?.ratingCount]);
  const existingUserReview = useMemo(
    () =>
      reviews.find(
        (item) =>
          item.type === "product" &&
          item.productId === productId &&
          item.userId === currentUser?.uid
      ) || null,
    [currentUser?.uid, productId, reviews]
  );

  const selectedSize = selection.productId === productId ? selection.selectedSize : 0;
  const quantity = selection.productId === productId ? selection.quantity : 1;
  const selectedTier = product?.priceTiers?.[selectedSize] || product?.priceTiers?.[0] || null;

  const handleLogout = async () => {
    await logoutUser();
    navigate("/", { replace: true });
  };

  const handleAddToCart = () => {
    if (!product) {
      return;
    }

    if (authLoading || !showCustomerSession) {
      navigate("/login", {
        state: {
          from: `${location.pathname}${location.search}${location.hash}`,
        },
      });
      return;
    }

    const selectedVariant = selectedTier?.label || product.unit || "";
    const added = addItem(
      {
        ...product,
        price: selectedTier?.price || product.price,
        unit: "",
      },
      quantity,
      selectedVariant
    );

    if (added) {
      navigate("/cart");
    }
  };

  const handleSubmitReview = async () => {
    const review = reviewDraft.review.trim();

    if (!showCustomerSession) {
      navigate("/login", {
        state: {
          from: `${location.pathname}${location.search}${location.hash}`,
        },
      });
      return;
    }

    if (!review) {
      setReviewFeedback("Please write a short review before submitting.");
      return;
    }

    try {
      setSubmittingReview(true);
      setReviewFeedback("");
      await submitReview({
        userId: currentUser.uid,
        customerName: userProfile?.name || currentUser.displayName || "Customer",
        customerEmail: userProfile?.email || currentUser.email || "",
        orderId: "",
        productId: product.id,
        productName: product.name,
        type: "product",
        rating: reviewDraft.rating,
        review,
      });
      setReviewDraft({ rating: 5, review: "" });
      setReviewFeedback("Your review was submitted and is waiting for admin approval.");
    } catch (error) {
      console.error("Failed to submit product review:", error);
      setReviewFeedback("We could not submit your review right now. Please try again.");
    } finally {
      setSubmittingReview(false);
    }
  };

  if (status === "loading") {
    return <div className="catalog-empty catalog-empty-page">Loading product details...</div>;
  }

  if (!product) {
    if (status === "ready" && products.length === 0) {
      return <div className="catalog-empty catalog-empty-page">Loading products from live database...</div>;
    }

    return (
      <div className="catalog-empty catalog-empty-page">
        Product "{productId}" not found. <Link to="/products">Back to catalog</Link>
      </div>
    );
  }

  return (
    <div className="catalog-shell detail-shell">
      <div className="catalog-noise" aria-hidden="true" />

      <Navbar activeSection="products" onLogout={handleLogout} />

      <main className="catalog-page detail-page">
        <section className="detail-hero">
          <TiltCard className="detail-media ember-surface" maxTilt={8}>
            <div className="detail-media-inner">
              <img src={product.image} alt={product.name} />
              <div className="detail-description">
                <h2>Description</h2>
                <p>{product.story}</p>
                {product.ingredients ? (
                  <p style={styles.ingredients}>
                    <strong>Ingredients:</strong> {product.ingredients}
                  </p>
                ) : null}
              </div>
            </div>
          </TiltCard>

          <MotionDiv
            className="detail-copy ember-surface"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.72, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="detail-category">{product.category}</span>
            <h1>{product.name}</h1>
            <p className="detail-rating">
              {displayedRating.average.toFixed(1)} / 5 <span>({displayedRating.count} reviews)</span>
            </p>
            <div className="detail-price-block">
              <strong className="detail-price">{formatPrice(selectedTier?.price || product.price)}</strong>
              {selectedTier?.hasDiscount ? (
                <>
                  <span className="detail-price-original">{formatPrice(selectedTier.originalPrice)}</span>
                  <span className="detail-price-badge">Save {selectedTier.discountPercent}%</span>
                </>
              ) : null}
            </div>

            <div className="detail-size-row">
              {product.priceTiers.map((tier, index) => (
                <button
                  key={tier.key}
                  type="button"
                  className={selectedSize === index ? "active" : ""}
                  onClick={() =>
                    setSelection({
                      productId,
                      selectedSize: index,
                      quantity,
                    })
                  }
                >
                  {tier.label}
                </button>
              ))}
            </div>

            <div className="detail-cart-row">
              <div className="detail-quantity">
                <button
                  type="button"
                  onClick={() =>
                    setSelection({
                      productId,
                      selectedSize,
                      quantity: Math.max(1, quantity - 1),
                    })
                  }
                >
                  -
                </button>
                <span>{quantity}</span>
                <button
                  type="button"
                  onClick={() =>
                    setSelection({
                      productId,
                      selectedSize,
                      quantity: quantity + 1,
                    })
                  }
                >
                  +
                </button>
              </div>
              <button
                type="button"
                className="catalog-button detail-cart-button"
                onClick={handleAddToCart}
              >
                Add to Cart
              </button>
            </div>

            <ul className="detail-highlight-list">
              {product.highlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <Link to="/products" className="detail-more-link">
              + Back to catalog
            </Link>
          </MotionDiv>
        </section>

        <section className="detail-section">
          <div className="catalog-section-heading">
            <span>Product Reviews</span>
            <h2>Customer ratings and product feedback.</h2>
          </div>

          <div className="detail-review-section" style={styles.reviewSection}>
            <div style={styles.reviewSummaryCard} className="ember-surface">
              <strong style={styles.reviewAverage}>{displayedRating.average.toFixed(1)} / 5</strong>
              <p style={styles.reviewMuted}>{displayedRating.count} approved review{displayedRating.count === 1 ? "" : "s"} visible on this product.</p>
            </div>

            <div style={styles.reviewFormCard} className="ember-surface detail-review-form-card">
              <div style={styles.reviewFormHead}>
                <div>
                  <strong>Rate this product</strong>
                  <p style={styles.reviewMuted}>Share quick feedback after trying it.</p>
                </div>
                {existingUserReview ? (
                  <span style={styles.reviewBadge(existingUserReview.status)}>{existingUserReview.status}</span>
                ) : null}
              </div>

              {existingUserReview ? (
                <div style={styles.reviewExisting}>
                  <strong>{existingUserReview.rating} / 5</strong>
                  <p style={styles.reviewMuted}>{existingUserReview.review}</p>
                </div>
              ) : (
                <>
                  <label style={styles.reviewField}>
                    <span>Rating</span>
                    <select
                      value={reviewDraft.rating}
                      onChange={(event) =>
                        setReviewDraft((current) => ({ ...current, rating: Number(event.target.value) }))
                      }
                    >
                      {[5, 4, 3, 2, 1].map((value) => (
                        <option key={value} value={value}>
                          {value} / 5
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={styles.reviewField}>
                    <span>Your review</span>
                    <textarea
                      rows="3"
                      value={reviewDraft.review}
                      onChange={(event) =>
                        setReviewDraft((current) => ({ ...current, review: event.target.value }))
                      }
                      placeholder="Share your experience with this product."
                    />
                  </label>

                  {reviewFeedback ? (
                    <div style={styles.reviewFeedback}>{reviewFeedback}</div>
                  ) : null}

                  <button
                    type="button"
                    className="catalog-button"
                    disabled={submittingReview}
                    onClick={handleSubmitReview}
                  >
                    {submittingReview ? "Submitting..." : "Submit Review"}
                  </button>
                </>
              )}
            </div>

            <div style={styles.reviewList}>
              {approvedProductReviews.length === 0 ? (
                <div style={styles.reviewEmpty} className="ember-surface">
                  Approved customer reviews will appear here after admin approval.
                </div>
              ) : (
                approvedProductReviews.map((item) => (
                  <article key={item.id} style={styles.reviewCard} className="ember-surface">
                    <div style={styles.reviewRow}>
                      <strong>{item.customer}</strong>
                      <span style={styles.reviewMuted}>{item.rating} / 5</span>
                    </div>
                    <p style={styles.reviewMuted}>{item.review}</p>
                    <span style={styles.reviewMeta}>{item.date}</span>
                  </article>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="detail-section">
          <div className="catalog-section-heading">
            <span>Detail Displays</span>
            <h2>More products from the same glowing catalog.</h2>
          </div>
          <div className="catalog-grid catalog-grid-compact">
            {relatedProducts.map((item, index) => (
              <MotionArticle
                key={item.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.66, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
              >
                <TiltCard className="catalog-card ember-surface" maxTilt={10}>
                  <div className="catalog-card-inner">
                    <div className="catalog-card-image">
                      <img src={item.image} alt={item.name} loading="lazy" decoding="async" />
                    </div>
                    <div className="catalog-card-copy">
                      <h2>{item.name}</h2>
                    </div>
                    <Link className="catalog-button" to={`/products/${item.id}`}>
                      View Details
                    </Link>
                  </div>
                </TiltCard>
              </MotionArticle>
            ))}
          </div>
        </section>

        <section className="detail-section">
          <div className="catalog-section-heading">
            <span>Why Choose Spice Root</span>
            <h2>Trust signals that match the premium storefront.</h2>
          </div>
          <div className="detail-reason-grid">
            {reasons.map((item, index) => (
              <MotionDiv
                key={item.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.66, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
              >
                <TiltCard className="detail-reason-card ember-surface" maxTilt={10}>
                  <div className="detail-reason-card-inner">
                    <h3>{item.title}</h3>
                    <p>{item.subtitle}</p>
                  </div>
                </TiltCard>
              </MotionDiv>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

const styles = {
  ingredients: {
    marginTop: "10px",
    fontSize: "0.82rem",
    lineHeight: 1.55,
    color: "var(--sr-text-soft)",
  },
  reviewSection: {
    display: "grid",
    gridTemplateColumns: "minmax(170px, 0.34fr) minmax(260px, 0.66fr)",
    gap: "14px",
    alignItems: "start",
  },
  reviewSummaryCard: {
    padding: "14px",
  },
  reviewAverage: {
    display: "block",
    fontSize: "1.45rem",
    marginBottom: "4px",
  },
  reviewFormCard: {
    display: "grid",
    gap: "10px",
    padding: "14px",
  },
  reviewFormHead: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start",
  },
  reviewField: {
    display: "grid",
    gap: "6px",
  },
  reviewMuted: {
    margin: 0,
    color: "var(--sr-text-soft)",
    lineHeight: 1.45,
    fontSize: "0.86rem",
  },
  reviewFeedback: {
    padding: "12px 14px",
    borderRadius: "14px",
    background: "var(--sr-surface-muted)",
    color: "var(--sr-gold)",
  },
  reviewExisting: {
    display: "grid",
    gap: "8px",
  },
  reviewBadge: (status) => ({
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 10px",
    borderRadius: "999px",
    background:
      status === "Approved"
        ? "rgba(34, 197, 94, 0.12)"
        : status === "Hidden"
          ? "rgba(239, 68, 68, 0.12)"
          : "rgba(245, 158, 11, 0.14)",
    color:
      status === "Approved"
        ? "#bbf7d0"
        : status === "Hidden"
          ? "#fca5a5"
          : "#fde68a",
    fontSize: "0.82rem",
    fontWeight: 600,
  }),
  reviewList: {
    display: "grid",
    gridColumn: "1 / -1",
    gap: "10px",
  },
  reviewEmpty: {
    padding: "14px",
  },
  reviewCard: {
    padding: "14px",
    display: "grid",
    gap: "8px",
  },
  reviewRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
  },
  reviewMeta: {
    color: "var(--sr-text-muted)",
    fontSize: "0.85rem",
  },
};

export default ProductDetailPage;
