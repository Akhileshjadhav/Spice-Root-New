import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  FaBoxOpen,
  FaChevronDown,
  FaCommentDots,
  FaHome,
  FaPhoneAlt,
  FaRegStar,
  FaTags,
  FaUser,
  FaUserPlus,
  FaUsers,
} from "react-icons/fa";
import { useAuth } from "../../context/useAuth";
import { useCart } from "../../context/useCart";
import UserNotificationBell from "./UserNotificationBell";

const NAV_ITEMS = [
  { id: "home", label: "Home", to: "/", icon: FaHome },
  { id: "products", label: "Products", to: "/products", icon: FaBoxOpen, hasChevron: true },
  { id: "features", label: "Features", to: "/#features", sectionId: "features", icon: FaRegStar },
  { id: "offers", label: "Offers", to: "/offers", customerOnly: true, icon: FaTags },
  { id: "about", label: "About Us", to: "/#about", sectionId: "about", icon: FaUsers },
  { id: "testimonials", label: "Testimonials", to: "/#testimonials", sectionId: "testimonials", icon: FaCommentDots },
  { id: "contact", label: "Contact", to: "/contact", icon: FaPhoneAlt },
];

function Navbar({ activeSection = "home", onNavigate, onLogout }) {
  const location = useLocation();
  const { currentUser, isAdmin, isAuthenticated, loading, logoutUser, userProfile } = useAuth();
  const { itemCount } = useCart();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const showCustomerSession = isAuthenticated && !isAdmin;
  const firstName =
    userProfile?.firstName ||
    userProfile?.name?.trim().split(/\s+/)[0] ||
    currentUser?.displayName?.trim().split(/\s+/)[0] ||
    "User";

  const visibleNavItems = NAV_ITEMS.filter((item) => !item.customerOnly || showCustomerSession);

  const handleNavClick = (item, event) => {
    setIsMenuOpen(false);

    if (item.sectionId && onNavigate && location.pathname === "/") {
      event.preventDefault();
      onNavigate(item.sectionId);
      return;
    }

    if (item.id === "home" && onNavigate && location.pathname === "/") {
      event.preventDefault();
      onNavigate("home");
    }
  };

  const handleLogout = async () => {
    setIsMenuOpen(false);
    await logoutUser();

    if (onLogout) {
      onLogout();
    }
  };

  return (
    <header className="ember-navbar">
      <div className="ember-navbar-inner">
        <div className="ember-navbar-media" aria-hidden="true" />

        <Link to="/" className="ember-brand" onClick={(event) => handleNavClick(NAV_ITEMS[0], event)}>
          <img className="ember-brand-logo" src="/images/spice-root-logo.png" alt="Spice Root" />
        </Link>

        <nav className="ember-nav" aria-label="Primary">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.id}
                to={item.to}
                className={activeSection === item.id || location.pathname === item.to ? "active" : ""}
                onClick={(event) => handleNavClick(item, event)}
              >
                {Icon ? <Icon className="ember-nav-item-icon" aria-hidden="true" /> : null}
                <span>{item.label}</span>
                {item.hasChevron ? <FaChevronDown className="ember-nav-chevron" aria-hidden="true" /> : null}
              </Link>
            );
          })}
        </nav>

        <div className="ember-nav-actions">
          {loading ? null : showCustomerSession ? (
            <>
              <span className="ember-user-greeting">{`Hello, ${firstName}`}</span>
              <UserNotificationBell variant="ember" />
              <Link
                to="/cart"
                className="ember-icon-button"
                aria-label={`View cart (${itemCount} item${itemCount === 1 ? "" : "s"})`}
              >
                <span aria-hidden="true">&#128722;</span>
              </Link>
              <button type="button" className="ember-button ember-button-primary ember-small-button" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="ember-button ember-button-ghost ember-small-button">
                <FaUser />
                Login
              </Link>
              <Link to="/register" className="ember-button ember-button-primary ember-small-button">
                <FaUserPlus />
                Register
              </Link>
            </>
          )}

          <button
            type="button"
            className={`ember-menu-toggle${isMenuOpen ? " open" : ""}`}
            aria-expanded={isMenuOpen}
            aria-label="Toggle navigation"
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            <span />
            <span />
          </button>
        </div>
      </div>

      <div className={`ember-mobile-nav${isMenuOpen ? " open" : ""}`}>
        {loading ? null : showCustomerSession ? (
          <div className="ember-mobile-user-line">{`Hello, ${firstName}`}</div>
        ) : null}

        {visibleNavItems.map((item) => {
          const Icon = item.icon;

          return (
            <Link key={item.id} to={item.to} onClick={(event) => handleNavClick(item, event)}>
              {Icon ? <Icon aria-hidden="true" /> : null}
              <span>{item.label}</span>
            </Link>
          );
        })}

        {loading ? null : showCustomerSession ? (
          <>
            <Link
              to="/cart"
              className="ember-mobile-icon-button"
              aria-label={`View cart (${itemCount} item${itemCount === 1 ? "" : "s"})`}
              onClick={() => setIsMenuOpen(false)}
            >
              <span aria-hidden="true">&#128722;</span>
              <span>Cart</span>
            </Link>
            <UserNotificationBell variant="ember" />
            <button type="button" onClick={handleLogout}>
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" onClick={() => setIsMenuOpen(false)}>
              Login
            </Link>
            <Link to="/register" onClick={() => setIsMenuOpen(false)}>
              Register
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

export default Navbar;
