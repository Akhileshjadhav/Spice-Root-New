import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import StatusBadge from "../components/StatusBadge";
import { subscribeToBanners } from "../../lib/offers";

const CMS = () => {
  const [banners, setBanners] = useState([]);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeToBanners(
      setBanners,
      (error) => {
        console.error("Failed to load live CMS banners:", error);
        setLoadError("Could not load website banners from Firebase.");
      }
    );

    return () => unsubscribe();
  }, []);

  return (
    <section className="admin-module-section">
      <div className="admin-page-head">
        <div>
          <h2>Website CMS - Banners</h2>
          <p>Live homepage and offer banners synced from Firebase. Manage them from Offers &amp; Website CMS.</p>
        </div>
        <div className="admin-page-actions">
          <Link to="/admin/coupons" className="admin-primary-button">
            Manage Banners
          </Link>
        </div>
      </div>

      {loadError ? <div className="admin-empty-state">{loadError}</div> : null}

      <div className="admin-banner-list">
        {banners.length === 0 && !loadError ? (
          <div className="admin-empty-state">
            No live banners yet. Add one from the Offers &amp; Website CMS page.
          </div>
        ) : null}

        {banners.map((item) => (
          <article key={item.id} className="admin-banner-card">
            <img src={item.imageUrl || item.image} alt={item.title} />
            <div className="admin-banner-copy">
              <strong>{item.title}</strong>
              <span>{item.location || item.subtitle || "Website banner"}</span>
            </div>
            <StatusBadge status={item.status} />
          </article>
        ))}
      </div>
    </section>
  );
};

export default CMS;
