import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { FaFlask, FaLeaf, FaSearch, FaShieldAlt, FaShoppingCart } from "react-icons/fa";
import Footer from "../../components/Footer";
import TiltCard from "../components/TiltCard";
import { subscribeToApprovedReviews } from "../../lib/adminStore";
import { formatPrice, subscribeToCatalog } from "../../lib/catalog";
import { useAuth } from "../../context/useAuth";
import Navbar from "../components/Navbar";
import "../../styles/products-listing.css";
import "../../styles/reference-storefront.css";
import "../../styles/luxury-spice.css";
import "../../styles/navbar-final.css";

const MotionArticle = motion.article;

const productClaims = [
  { icon: FaLeaf, title: "100%", copy: "Natural" },
  { icon: FaFlask, title: "No", copy: "Additives" },
  { icon: FaShieldAlt, title: "Pure", copy: "& Safe" },
];

const productBenefits = [
  { icon: FaLeaf, title: "Farm Sourced", copy: "Sourced directly from trusted farmers." },
  { icon: FaLeaf, title: "Pure & Natural", copy: "No additives. No fillers. Just pure spices." },
  { icon: FaShieldAlt, title: "Quality Assured", copy: "Hygienically processed and quality tested." },
  { icon: FaLeaf, title: "Safe Packaging", copy: "Packed with care to retain freshness." },
];

const revealCard = (index) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.68, delay: Math.min(index * 0.05, 0.3), ease: [0.16, 1, 0.3, 1] },
});

function ProductsPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [status, setStatus] = useState("loading");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const deferredQuery = useDeferredValue(query);

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
    const unsubscribe = subscribeToApprovedReviews(
      setReviews,
      (error) => console.error("Failed to load product listing reviews:", error)
    );

    return () => unsubscribe();
  }, []);
  const categories = useMemo(
    () => ["All", ...new Set(products.map((item) => item.category))],
    [products]
  );

  const filteredProducts = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    return products.filter((item) => {
      const matchesCategory = category === "All" || item.category === category;
      const matchesSearch =
        !normalizedQuery ||
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.category.toLowerCase().includes(normalizedQuery);

      return matchesCategory && matchesSearch;
    });
  }, [category, deferredQuery, products]);
  const approvedReviewLookup = useMemo(
    () =>
      reviews
        .filter((item) => item.type === "product" && item.productId)
        .reduce((lookup, item) => {
          const current = lookup.get(item.productId) || { total: 0, count: 0 };
          current.total += item.rating;
          current.count += 1;
          lookup.set(item.productId, current);
          return lookup;
        }, new Map()),
    [reviews]
  );

  const { logoutUser } = useAuth();

  const handleLogout = async () => {
    await logoutUser();
    navigate("/", { replace: true });
  };

  return (
    <div className="catalog-shell">
      <div className="catalog-noise" aria-hidden="true" />

      <Navbar activeSection="products" onLogout={handleLogout} />

      <main className="catalog-page">
        <section className="catalog-hero">
          <p><FaLeaf aria-hidden="true" /> Product List</p>
          <h1>
            Premium spices and pantry essentials, now synced with the <em>live catalog.</em>
          </h1>
          <span>
            Browse the original Spice Root collection plus any new products added by the admin team.
          </span>
        </section>

        <section className="catalog-controls ember-surface">
          <div className="catalog-search-mark" aria-hidden="true">
            <FaSearch />
          </div>
          <label>
            <span>Search products</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search products..."
            />
          </label>

          <label>
            <span>Category</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <div className="catalog-count">
            <FaLeaf aria-hidden="true" />
            <strong>{filteredProducts.length}</strong>
            <span>products visible</span>
          </div>
        </section>

        {status === "loading" ? (
          <div className="catalog-empty">Loading products...</div>
        ) : null}

        {status === "ready" ? (
          <section className="catalog-grid">
            {filteredProducts.map((product, index) => (
              <MotionArticle key={product.id} {...revealCard(index)}>
                <TiltCard className="catalog-card ember-surface" maxTilt={12} scale={1.03}>
                  <div className="catalog-card-inner">
                    <div className="catalog-card-image">
                      <img
                        src={product.image}
                        alt={product.name}
                        loading={index < 6 ? "eager" : "lazy"}
                        fetchPriority={index < 2 ? "high" : "auto"}
                        decoding="async"
                      />
                    </div>
                    <div className="catalog-card-copy">
                      <span className="catalog-card-brand">
                        <FaLeaf aria-hidden="true" />
                        Spice Root
                      </span>
                      <h2>{product.name}</h2>
                      <p className="catalog-rating-line">
                        <span aria-hidden="true">&#9733;</span>
                        {approvedReviewLookup.has(product.id)
                          ? `${(approvedReviewLookup.get(product.id).total / approvedReviewLookup.get(product.id).count).toFixed(1)} / 5`
                          : `${product.rating.toFixed(1)}`}{" "}
                        <small>
                          ({approvedReviewLookup.get(product.id)?.count || product.ratingCount || 0} reviews)
                        </small>
                      </p>
                      <div className="catalog-claim-row">
                        {productClaims.map((claim) => {
                          const Icon = claim.icon;

                          return (
                            <span key={claim.copy}>
                              <Icon aria-hidden="true" />
                              <b>{claim.title}</b>
                              {claim.copy}
                            </span>
                          );
                        })}
                      </div>
                      <p className="catalog-price-line">
                        From <strong>{formatPrice(product.price)}</strong> <span>({product.unit})</span>
                      </p>
                      <Link className="catalog-button" to={`/products/${product.id}`}>
                        <FaShoppingCart aria-hidden="true" />
                        View Details
                      </Link>
                    </div>
                  </div>
                </TiltCard>
              </MotionArticle>
            ))}
          </section>
        ) : null}

        {status === "ready" && products.length === 0 ? (
          <div className="catalog-empty">
            No products are available in the live catalog yet. Ask an admin to add products or restore
            the original catalog.
          </div>
        ) : null}

        {status === "ready" && products.length > 0 && filteredProducts.length === 0 ? (
          <div className="catalog-empty">No products match that search yet.</div>
        ) : null}

        <section className="catalog-benefit-band" aria-label="Spice Root promises">
          {productBenefits.map((item) => {
            const Icon = item.icon;

            return (
            <div key={item.title}>
              <span aria-hidden="true"><Icon /></span>
              <strong>{item.title}</strong>
              <p>{item.copy}</p>
            </div>
            );
          })}
        </section>
      </main>

      <Footer />
    </div>
  );
}

export default ProductsPage;

