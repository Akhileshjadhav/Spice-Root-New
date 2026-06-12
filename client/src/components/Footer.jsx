import { Link } from "react-router-dom";
import { FaFacebookF, FaInstagram, FaWhatsapp } from "react-icons/fa";
import { useAuth } from "../context/useAuth";

function Footer() {
  const { isAdmin, isAuthenticated } = useAuth();
  const showOffers = isAuthenticated && !isAdmin;

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-about">
          <Link to="/" className="site-footer-brand" aria-label="Spice Root home">
            <img className="site-footer-logo" src="/images/spice-root-logo.png" alt="Spice Root" />
          </Link>
          <p className="site-footer-copy">
            Premium masalas, pantry essentials, and honest flavors for everyday kitchens.
          </p>
        </div>

        <nav className="site-footer-links" aria-label="Footer navigation">
          <Link to="/">Home</Link>
          <Link to="/products">Products</Link>
          <Link to="/#features">Features</Link>
          {showOffers ? <Link to="/offers">Offers</Link> : null}
          <Link to="/#about">About Us</Link>
          <Link to="/#testimonials">Testimonials</Link>
          <Link to="/contact">Contact</Link>
        </nav>

        <div className="site-footer-social" aria-label="Follow Spice Root">
          <strong>Follow Us</strong>
          <div>
            <a href="https://www.instagram.com/" aria-label="Instagram">
              <FaInstagram />
            </a>
            <a href="https://www.facebook.com/" aria-label="Facebook">
              <FaFacebookF />
            </a>
            <a href="https://wa.me/" aria-label="WhatsApp">
              <FaWhatsapp />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
