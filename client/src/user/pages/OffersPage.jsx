import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Footer from "../../components/Footer";
import { useAuth } from "../../context/useAuth";
import { useCart } from "../../context/useCart";
import { formatPrice } from "../../lib/catalog";
import { getActiveCoupons, subscribeToBanners, subscribeToCoupons } from "../../lib/offers";
import Navbar from "../components/Navbar";
import "../../styles/products-listing.css";
import "../../styles/luxury-spice.css";
import "../../styles/navbar-final.css";

function OffersPage() {
  const navigate = useNavigate();
  const { isAdmin, isAuthenticated, logoutUser } = useAuth();
  const { subtotal, applyCoupon } = useCart();
  const [coupons, setCoupons] = useState([]);
  const [banners, setBanners] = useState([]);
  const [notice, setNotice] = useState("");
  const showCustomerSession = isAuthenticated && !isAdmin;

  useEffect(() => {
    const unsubscribe = subscribeToCoupons(
      setCoupons,
      (error) => console.error("Failed to load offers:", error)
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToBanners(
      setBanners,
      (error) => console.error("Failed to load offer banners:", error)
    );

    return () => unsubscribe();
  }, []);

  const activeCoupons = useMemo(() => getActiveCoupons(coupons), [coupons]);
  const activeBanners = useMemo(
    () => banners.filter((banner) => String(banner.status || "").toLowerCase() === "active"),
    [banners]
  );
  const heroBanner = activeBanners[0] || null;
  // console.log("HERO BANNER:", heroBanner);
  // console.log("IMAGE URL:", heroBanner?.imageUrl);
  const promoBanners = activeBanners.slice(1);

  const handleLogout = async () => {
    await logoutUser();
    navigate("/", { replace: true });
  };

  const handleCouponAction = async (coupon) => {
    if (!showCustomerSession || subtotal <= 0) {
      try {
        await navigator.clipboard?.writeText(coupon.code);
        setNotice(`${coupon.code} copied. Apply it from your cart when you are ready.`);
      } catch {
        setNotice(`Use coupon code ${coupon.code} at cart.`);
      }
      return;
    }

    const result = applyCoupon(coupon.code);
    setNotice(result.success ? `${coupon.code} applied to your cart.` : result.message);
  };

  return (
    <div className="catalog-shell offers-shell">
      <div className="catalog-noise" aria-hidden="true" />

      <Navbar activeSection="offers" onLogout={handleLogout} />

      <main className="catalog-page offers-page">
    

      {
        <section
  className="offers-hero ember-surface"
  style={{
    backgroundImage: `url(${heroBanner?.imageUrl})`,
  }}
>
  <div>
    <span>{heroBanner?.eyebrow || "Fresh Offers"}</span>

    <h1>
      {heroBanner?.title || "Exclusive Coupons & Offers"}
    </h1>

    {/* <p>
      {heroBanner?.subtitle ||
        "Use live offers created by the admin team and save on your next Spice Root order."}
    </p> */}

    {heroBanner?.couponCode ? (
      <strong>Use Code: {heroBanner.couponCode}</strong>
    ) : null}

    <Link
      className="catalog-button"
      to={heroBanner?.buttonLink || "/products"}
    >
      {heroBanner?.buttonText || "Shop Now"}
    </Link>
  </div>
</section>
      }


        {notice ? <div className="offers-notice ember-surface">{notice}</div> : null}

        <section className="offers-category-strip">
          {["Spices", "Masalas", "Whole Spices", "Organic", "New Arrivals", "Best Sellers"].map((item) => (
            <Link key={item} to="/products" className="offers-category-pill ember-surface">
              <span>{item.slice(0, 1)}</span>
              <strong>{item}</strong>
            </Link>
          ))}
        </section>

        {promoBanners.length > 0 ? (
          <section className="offers-banner-grid">
            {promoBanners.map((banner) => (
              <article key={banner.id} className="offers-promo-card ember-surface">
                <img src={banner.imageUrl} alt={banner.title} />
                <div>
                  <span>{banner.eyebrow}</span>
                  <h2>{banner.title}</h2>
                  <p>{banner.subtitle}</p>
                  {banner.couponCode ? <strong>Code: {banner.couponCode}</strong> : null}
                  <Link className="catalog-button" to={banner.buttonLink || "/products"}>
                    {banner.buttonText}
                  </Link>
                </div>
              </article>
            ))}
          </section>
        ) : null}

        <section className="offers-section-head">
          <div>
            <span>Live Firebase Offers</span>
            <h2>Exclusive Coupons & Offers</h2>
          </div>
          <Link to="/products">Shop products</Link>
        </section>

        <section className="offers-coupon-grid">
          {activeCoupons.length === 0 ? (
            <div className="catalog-empty ember-surface">No active offers are available right now.</div>
          ) : (
            activeCoupons.map((coupon) => (
              <article key={coupon.id} className="offers-coupon-card ember-surface">
                <span>{coupon.type}</span>
                <h3>{coupon.code}</h3>
                <p>
                  {coupon.discount} off
                  {coupon.minOrderValue ? ` on orders above ${formatPrice(coupon.minOrderValue)}` : " on eligible orders"}
                </p>
                <small>Valid till {coupon.expires}</small>
                <button type="button" className="catalog-button catalog-button-secondary-alt" onClick={() => handleCouponAction(coupon)}>
                  {showCustomerSession && subtotal > 0 ? "Apply Code" : "Copy Code"}
                </button>
              </article>
            ))
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}

export default OffersPage;
