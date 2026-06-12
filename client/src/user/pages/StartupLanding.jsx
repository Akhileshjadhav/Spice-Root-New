import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FaArrowRight,
  FaBoxOpen,
  FaFlask,
  FaHeadset,
  FaLeaf,
  FaMugHot,
  FaShieldAlt,
  FaShoppingCart,
  FaUserTie,
} from "react-icons/fa";
import Footer from "../../components/Footer";
import Navbar from "../components/Navbar";
import Reveal from "../components/Reveal";
import TiltCard from "../components/TiltCard";
import { formatPrice } from "../../lib/catalog";
import { subscribeToApprovedReviews, subscribeToBestSellers } from "../../lib/adminStore";
import { subscribeToBanners } from "../../lib/offers";
import { featuredProductImages, resolveProductImage } from "../../lib/productImages";
import { useAuth } from "../../context/useAuth";
// import "../../styles/startup-premium.css";
import "../../styles/reference-storefront.css";
import "../../styles/luxury-spice.css";
import "../../styles/navbar-final.css";
import naturalImage from "../../assets/spice-root/100-natural.png";
import farmImage from "../../assets/spice-root/farm-sourced.png";
import zeroImage from "../../assets/spice-root/zero-adulteration.png";
import aromaImage from "../../assets/spice-root/real-aroma-and-taste.png";
import cleanImage from "../../assets/spice-root/clean-sourcing.png";
import smallImage from "../../assets/spice-root/small-batch-processing.png";
import freshImage from "../../assets/spice-root/fresh-packaging.png";
import chemicalImage from "../../assets/spice-root/no-chemical-treatment.png";
import homecookImage from "../../assets/spice-root/home-cook.webp";
import chefImage from "../../assets/spice-root/chef-rohan-patil.webp";
import cloudImage from "../../assets/spice-root/cloud-kitchen.webp";


const NAV_ITEMS = [
  { id: "home", label: "Home" },
  { id: "products", label: "Shop" },
  { id: "features", label: "Features" },
  { id: "about", label: "About Us" },
  { id: "testimonials", label: "Reviews" },
  { id: "contact", label: "Contact" },
];

const spotlightProduct = {
  id: "mirchi-powder",
  label: "Fresh Pick",
  name: "Mirchi Powder",
  image: featuredProductImages.mirchi,
  description:
    "Made from carefully selected sun-dried chillies, this powder delivers natural color, strong aroma, and the right level of heat-without any artificial enhancement. What you see is what you get.",
  trustLine: "No added color. No preservatives. 100% real spice.",
};

const reasons = [
  {
    icon: FaLeaf,
    title: "100% Natural",
    copy: "No chemicals, no artificial color, no hidden mixing. Only pure spices-just like they should be.",
    image: naturalImage,
  
  },
  {
    icon: FaUserTie,
    title: "Farm Sourced",
    copy: "We source directly from farmers, not middlemen. That means fresher spices and better quality in your kitchen.",
    image: farmImage,
  },
  {
    icon: FaShieldAlt,
    title: "Zero Adulteration",
    copy: "What's written on the pack is exactly what's inside. Nothing extra. Nothing fake.",
    image: zeroImage,
  },
  {
    icon: FaMugHot,
    title: "Real Aroma & Taste",
    copy: "Open the pack-you'll smell the difference instantly. That's the freshness most brands lose.",
    image: aromaImage,
  },
];

const trustPoints = [
  {
    icon: FaLeaf,
    title: "Clean sourcing",
    copy: "Carefully sourced spices from trusted farms that follow natural growing practices.",
    image: cleanImage,
  },
  {
    icon: FaMugHot,
    title: "Small batch processing",
    copy: "We process in small batches to retain the natural oils, color, and rich aroma.",
    image: smallImage,
  },
  {
    icon: FaBoxOpen,
    title: "Fresh packing",
    copy: "Packed fresh to lock in flavor and aroma-so you experience it at its best.",
    image: freshImage,
  },
  {
    icon: FaFlask,
    title: "No chemical treatment",
    copy: "Our spices are free from chemicals, artificial colors, and harmful additives.",
    image: chemicalImage,
  },
];

const baseTestimonials = [
  {
    image: homecookImage,
    quote:
      "The aroma is the first thing you notice. Even a simple dal tastes richer and more complete with these spices.",
    name: "Aditi Mehra",
    title: "Home Cook",
  },
  {
    image: chefImage,
    quote:
      "The biggest difference is the freshness. The spices are easy to use and give consistent results every time.",
    name: "Chef Rohan Patil",
    title: "Cafe Menu Consultant",
  },
  {
    image: cloudImage,
    quote:
      "We started using these in our kitchen and customers noticed the change instantly. Pure, strong, and reliable.",
    name: "Neha Kulkarni",
    title: "Cloud Kitchen Founder",
  },
];

const shopProducts = [
  {
    id: "turmeric-aromatic",
    name: "Turmeric Powder",
    image: featuredProductImages.turmeric,
    description:
      "Balanced turmeric with rich natural color and deep aroma. Perfect for adding warmth, color, and health to everyday meals.",
  },
  {
    id: "garam-masala",
    name: "Garam Masala",
    image: featuredProductImages.garamMasala,
    description:
      "A carefully blended mix of whole spices that brings depth, warmth, and authentic flavor to your cooking.",
  },
];

function SectionTitle({ kicker, title, body, align = "center" }) {
  return (
    <Reveal className={`ember-section-title${align === "left" ? " left" : ""}`}>
      {kicker ? <span>{kicker}</span> : null}
      <h2>{title}</h2>
      {body ? <p>{body}</p> : null}
    </Reveal>
  );
}

function StartupLanding() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("home");
  const [bestSellerRows, setBestSellerRows] = useState([]);
  const [banners, setBanners] = useState([]);
  const [reviews, setReviews] = useState([]);

  const scrollToSection = (sectionId, behavior = "auto") => {
    const target = document.getElementById(sectionId);

    if (!target) {
      return;
    }

    const navOffset = 104;
    const top = target.getBoundingClientRect().top + window.scrollY - navOffset;
    window.scrollTo({ top: Math.max(0, top), behavior });
  };

  const testimonialCards = useMemo(() => {
    const approvedReviews = reviews.filter((item) => item.review).slice(0, 3);

    if (approvedReviews.length > 0) {
      return approvedReviews.map((item) => ({ 
        image: resolveProductImage(
          item.productId,
          item.productName,
          item.type === "overall" ? featuredProductImages.mirchi : featuredProductImages.turmeric
        ),
        quote: item.review,
        name: item.customer,
        title: item.type === "overall" ? "Verified Customer" : `${item.productName} buyer`,
      }));
    }

    return baseTestimonials.slice(0, 3);
  }, [reviews]);
  const bestSellerProducts = useMemo(() => {
    const featuredProducts = bestSellerRows
      .filter((product) => String(product.status || "").toLowerCase() === "active")
      .slice(0, 4);

    return featuredProducts.map((product) => ({
      id: product.id,
      sourceProductId: product.sourceProductId,
      name: product.productName || product.name,
      image: resolveProductImage(product.sourceProductId || product.id, product.productName || product.name, product.imageUrl || product.image),
      points: product.highlights?.slice(0, 3) || ["Premium quality", "Freshly packed", "Crafted for daily cooking"],
      microcopy:
        product.description ||
        product.story ||
        "A kitchen-ready favorite made with clean sourcing, careful processing, and bold natural aroma for everyday meals.",
      price: product.price,
    }));
  }, [bestSellerRows]);
  const activeBanners = useMemo(
    () => banners.filter((banner) => String(banner.status || "").toLowerCase() === "active").slice(0, 2),
    [banners]
  );

  useEffect(() => {
    const unsubscribe = subscribeToApprovedReviews(
      setReviews,
      (error) => console.error("Failed to load landing reviews:", error)
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToBestSellers(
      setBestSellerRows,
      (error) => console.error("Failed to load best sellers:", error)
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToBanners(
      setBanners,
      (error) => console.error("Failed to load landing banners:", error)
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const sections = NAV_ITEMS.map((item) => document.getElementById(item.id)).filter(Boolean);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-30% 0px -45% 0px", threshold: 0.18 }
    );

    sections.forEach((section) => observer.observe(section));

    return () => {
      sections.forEach((section) => observer.unobserve(section));
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const targetId = location.hash ? location.hash.slice(1) : "home";

    const timer = window.setTimeout(() => {
      if (targetId === "home") {
        window.scrollTo({ top: 0, behavior: location.state?.scrollBehavior || "auto" });
        return;
      }

      scrollToSection(targetId, location.state?.scrollBehavior || "auto");
    }, 20);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.hash]);

  const goToSection = (sectionId) => {
    const nextHash = sectionId === "home" ? "" : `#${sectionId}`;

    if (location.pathname === "/" && location.hash === nextHash) {
      if (sectionId === "home") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        scrollToSection(sectionId, "smooth");
      }

      return;
    }

    if (sectionId === "home") {
      navigate("/", { state: { scrollBehavior: "smooth" } });
      return;
    }

    navigate(
      {
        pathname: "/",
        hash: nextHash,
      },
      { state: { scrollBehavior: "smooth" } }
    );
  };

  const { logoutUser } = useAuth();

  const handleLogout = async () => {
    await logoutUser();
    navigate("/", { replace: true });
  };

  return (
    <div className="ember-home-shell">
      <div className="ember-noise" aria-hidden="true" />
      <Navbar activeSection={activeSection} onNavigate={goToSection} onLogout={handleLogout} />
      <div className="ember-navbar-spacer" />

      <main className="ember-page">
        <section id="home" className="ember-hero ember-reveal is-visible">
          <div className="ember-hero-frame">
            {/* <img
              className="ember-hero-reference ember-hero-reference-light"
              src="/images/home-dark.png"
              alt=""
              aria-hidden="true"
              loading="eager"
              decoding="async"
              fetchPriority="high"
            /> */}
            <img
              className="ember-hero-reference ember-hero-reference-light"
              // className="ember-hero-reference"
              src="/images/home-light.png"
              alt=""
              aria-hidden="true"
              loading="eager"
              decoding="async"
              fetchPriority="high"
            />
            <div className="ember-hero-copy">
              <span className="ember-hero-kicker">
                <FaLeaf aria-hidden="true" />
                100% Natural &bull; Farm Sourced
              </span>
              <h1>
                <span className="ember-hero-green">Rooted in Nature,</span><br />
                <span className="ember-hero-orange">Rich in Goodness!</span>
              </h1>
              <p>
                Honest spices. Real aroma. Naturally delicious.
              </p>
              <div className="ember-hero-actions">
                <Link to="/products" className="ember-button ember-button-primary">
                  <FaShoppingCart aria-hidden="true" />
                  Shop Now
                </Link>
                <Link to="/#about" className="ember-button ember-button-ghost" onClick={(event) => {
                  event.preventDefault();
                  goToSection("about");
                }}>
                  <FaLeaf aria-hidden="true" />
                  Explore More
                </Link>
              </div>
            </div>
          </div>
        </section>

        {activeBanners.length > 0 ? (
          <section className="ember-section ember-live-banner-section">
            <div className="ember-live-banner-grid">
              {activeBanners.map((banner, index) => (
                <Reveal key={banner.id} delay={index * 0.05}>
                  <article
                    className="ember-live-banner ember-card-glass"
                    style={{ backgroundImage: `linear-gradient(90deg, rgba(24, 18, 12, 0.88), rgba(24, 18, 12, 0.28)), url("${banner.imageUrl}")` }}
                  >
                    <div className="ember-card-content">
                      <span>{banner.eyebrow}</span>
                      <h2>{banner.title}</h2>
                      <p>{banner.subtitle}</p>
                      {banner.couponCode ? <strong>Use Code: {banner.couponCode}</strong> : null}
                      <Link className="ember-button ember-button-primary ember-small-button" to={banner.buttonLink || "/products"}>
                        {banner.buttonText}
                      </Link>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </section>
        ) : null}

        <section id="features" className="ember-section">
          <SectionTitle
            kicker={<FaLeaf aria-hidden="true" />}
            title="Because What You Eat Should Be Clean and Honest"
            body="Real ingredients. Real sources. Real trust."
          />

          <div className="ember-reason-grid">
            {reasons.map((reason, index) => {
              const Icon = reason.icon;

              return (
              <Reveal key={reason.title} delay={index * 0.05}>
                <TiltCard className="ember-reason-card ember-card-glass" maxTilt={12}>
                  <div className="ember-card-content">
                    <img className="ember-card-photo" src={reason.image} alt="" loading="lazy" decoding="async" />
                    <span className="ember-reason-icon" aria-hidden="true">
                      <Icon />
                    </span>
                    <h3>{reason.title}</h3>
                    <p>{reason.copy}</p>
                  </div>
                </TiltCard>
              </Reveal>
              );
            })}
          </div>
          <Link className="ember-honest-pill" to="/products">
            <FaLeaf aria-hidden="true" />
            Honest by nature. Trusted by you.
          </Link>
        </section>

        {bestSellerProducts.length > 0 ? (
          <section id="products" className="ember-section ember-products-section">
            <SectionTitle
              title="Our Bestsellers"
              body="Fresh, honest essentials for everyday Indian cooking."
            />

            <div className="ember-product-grid ember-product-grid-featured">
              {bestSellerProducts.map((product, index) => (
                <Reveal key={product.id} delay={index * 0.05}>
                  <TiltCard className="ember-product-card ember-card-glass">
                    <div className="ember-card-content">
                      <div className="ember-product-image-shell">
                        <img src={product.image} alt={product.name} loading="lazy" decoding="async" fetchPriority="low" />
                      </div>
                      <div className="ember-product-card-copy">
                        <h3>{product.name}</h3>
                        {product.price ? <strong>{formatPrice(product.price)}</strong> : null}
                        <p>{product.microcopy}</p>
                      </div>
                      {product.sourceProductId ? (
                        <Link className="ember-button ember-button-secondary ember-small-button" to={`/products/${product.sourceProductId}`}>
                          View Details
                        </Link>
                      ) : (
                        <Link className="ember-button ember-button-secondary ember-small-button" to="/products">
                          Shop Now
                        </Link>
                      )}
                    </div>
                  </TiltCard>
                </Reveal>
              ))}
            </div>
          </section>
        ) : null}

        <section className="ember-section">
          <SectionTitle
            kicker={<FaLeaf aria-hidden="true" />}
            title="No Marketing Tricks. Just Real Quality."
            body="We don't rely on heavy branding or fake promises. Our spices speak for themselves-from the moment you open the pack to the taste in your food."
          />

          <div className="ember-reason-grid">
            {trustPoints.map((point, index) => {
              const Icon = point.icon;

              return (
                <Reveal key={point.title} delay={index * 0.05}>
                  <TiltCard className="ember-reason-card ember-card-glass" maxTilt={10}>
                    <div className="ember-card-content ember-trust-point-card">
                      <img className="ember-card-photo" src={point.image} alt="" loading="lazy" decoding="async" />
                      <span className="ember-reason-icon" aria-hidden="true">
                        <Icon />
                      </span>
                      <h3>{point.title}</h3>
                      <p>{point.copy}</p>
                    </div>
                  </TiltCard>
                </Reveal>
              );
            })}
          </div>
        </section>

        <section className="ember-section ember-emotional-section">
          <Reveal>
            <TiltCard className="ember-newsletter-card ember-card-glass" maxTilt={8}>
              <div className="ember-card-content">
                <h3>Taste That Feels Like Home</h3>
                <p>
                  The kind of aroma that fills your kitchen. The kind of flavor that reminds you of real
                  homemade food. That's what we aim to deliver-every single time.
                </p>
              </div>
            </TiltCard>
          </Reveal>
        </section>

        <section id="about" className="ember-section ember-story-section">
          <SectionTitle
            kicker={<FaLeaf aria-hidden="true" />}
            title="From Farms to Your Kitchen"
            body="Honest spices. Real aroma. Naturally delicious."
          />

          <div className="ember-story-layout">
            <Reveal className="ember-story-media-wrap">
              <TiltCard className="ember-story-media ember-card-glass" maxTilt={8}>
                <div className="ember-card-content ember-story-media-content">
                  <img src={spotlightProduct.image} alt={spotlightProduct.name} loading="lazy" decoding="async" fetchPriority="low" />
                  <div>
                    <h3>From Farms to Your Kitchen</h3>
                    <p>
                      At Spice Root, everything starts at the source. We work closely with farmers to
                      bring you spices that are grown naturally, harvested at the right time, and
                      processed with care. No shortcuts. No artificial enhancement. Just honest
                      ingredients that keep their real aroma, color, and taste. Because good food begins
                      with clean, trustworthy spices.
                    </p>
                    <Link to="/products" className="ember-button ember-button-primary ember-small-button">
                      <FaLeaf aria-hidden="true" />
                      Shop Fresh Spices
                    </Link>
                  </div>
                </div>
              </TiltCard>
            </Reveal>

            <div className="ember-story-stack">
              {shopProducts.map((product, index) => (
                <Reveal key={product.id} delay={index * 0.06}>
                  <TiltCard className="ember-story-mini ember-card-glass" maxTilt={10}>
                    <div className="ember-card-content ember-story-mini-content">
                      <img src={product.image} alt={product.name} loading="lazy" decoding="async" fetchPriority="low" />
                      <div>
                        <h3>{product.name}</h3>
                        <p>{product.description}</p>
                      </div>
                    </div>
                  </TiltCard>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="testimonials" className="ember-section">
          <SectionTitle
            kicker={<FaLeaf aria-hidden="true" />}
            title="What Our Customers Feel"
            body="Real stories from real kitchens. Honest feedback from those who matter most."
          />

          <div className="ember-testimonial-grid">
            {testimonialCards.map((item, index) => (
              <Reveal key={`${item.name}-${index}`} delay={index * 0.06}>
                <TiltCard className="ember-testimonial-card ember-card-glass" maxTilt={10}>
                  <div className="ember-card-content">
                    <img className="ember-testimonial-photo" src={item.image} alt="" loading="lazy" decoding="async" />
                    <span className="ember-quote-badge" aria-hidden="true">&ldquo;</span>
                    <span className="ember-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
                    <p>{item.quote}</p>
                    <div className="ember-reviewer">
                      <span aria-hidden="true">{item.name.slice(0, 1)}</span>
                      <div>
                        <strong>{item.name}</strong>
                        <small>{item.title}</small>
                      </div>
                    </div>
                  </div>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </section>

        <section id="contact" className="ember-section ember-contact-section">
          <div className="ember-contact-grid">
            <Reveal>
              <TiltCard className="ember-contact-card ember-card-glass" maxTilt={8}>
                <div className="ember-card-content">
                  <span className="ember-contact-icon" aria-hidden="true">
                    <FaHeadset />
                  </span>
                  <h3>Contact Us</h3>
                  <p>
                    Have questions or want to partner with us? We're here to help you choose the right
                    spices for your home or business.
                  </p>
                  <Link to="/contact" className="ember-button ember-button-primary ember-small-button">
                    Contact Us
                    <FaArrowRight aria-hidden="true" />
                  </Link>
                </div>
              </TiltCard>
            </Reveal>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

export default StartupLanding;
