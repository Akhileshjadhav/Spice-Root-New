import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FaBell,
  FaCalendarAlt,
  FaEnvelope,
  FaExternalLinkAlt,
  FaClipboardList,
  FaSearch,
} from "react-icons/fa";
import { useAuth } from "../../context/useAuth";
import {
  markAdminNotificationAsRead,
  markContactSubmissionAsRead,
  subscribeToAdminNotifications,
  subscribeToContactSubmissions,
  subscribeToOrders,
} from "../../lib/adminStore";

const titleMap = {
  "/admin/dashboard": {
    title: "Admin Overview",
    subtitle: "See revenue, orders, stock health, and customer momentum at a glance.",
  },
  "/admin/products": {
    title: "Products",
    subtitle: "Manage live catalog items, pricing, stock, and publish status.",
  },
  "/admin/best-sellers": {
    title: "Best Sellers",
    subtitle: "Add existing catalog products or manual best-seller cards without duplicating the Products page.",
  },
  "/admin/categories": {
    title: "Categories",
    subtitle: "Manage storefront category groups and keep product counts synced live.",
  },
  "/admin/inventory": {
    title: "Inventory",
    subtitle: "Track stock position and replenishment risks across live SKUs.",
  },
  "/admin/orders": {
    title: "Orders",
    subtitle: "All customer orders stay here, while unread notifications are handled separately in the top bar.",
  },
  "/admin/order-details": {
    title: "Order Details",
    subtitle: "Inspect order items, payment, delivery, and status history.",
  },
  "/admin/customers": {
    title: "Customers",
    subtitle: "See live registered users, total orders, total spend, and account activity status.",
  },
  "/admin/customer-details": {
    title: "Customer Details",
    subtitle: "Review customer profile, order history, and product review activity from the live database.",
  },
  "/admin/coupons": {
    title: "Coupons, Offers & Website Banners",
    subtitle: "Manage live coupon pricing rules and the offer banners shown on the website.",
  },
  "/admin/reviews": {
    title: "Reviews",
    subtitle: "Live customer product and overall store reviews from delivered orders.",
  },
  "/admin/payments": {
    title: "Payments",
    subtitle: "Track Razorpay test transactions, payment status, and paid revenue from live orders.",
  },
  "/admin/shipping": {
    title: "Shipping / Delivery",
    subtitle: "Watch courier movement and delivery deadlines.",
  },
  "/admin/analytics": {
    title: "Analytics",
    subtitle: "Measure revenue, conversion, and product contribution by category.",
  },
  "/admin/queries": {
    title: "Customer Queries",
    subtitle: "Read customer messages, reply from the admin panel, and sync those replies back to the user dashboard.",
  },
  "/admin/register-login": {
    title: "Register / Login",
    subtitle: "Track live registered users and recent logged-in customer activity.",
  },
  "/admin/logs": {
    title: "Logs",
    subtitle: "Audit admin section actions with date, time, admin name, and detail.",
  },
  "/admin/cms": {
    title: "Website CMS - Banners",
    subtitle: "Update homepage, category, and promo assets shown on the live website.",
  },
  "/admin/users": {
    title: "Admin Users",
    subtitle: "Add, update, and remove Firebase-synced admin access records.",
  },
  "/admin/settings": {
    title: "Settings",
    subtitle: "Store-wide configuration, payment preferences, and delivery defaults.",
  },
};

const LOCAL_READ_NOTIFICATION_KEY = "spice-root-admin-read-order-notifications";

function readLocalReadNotifications() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(LOCAL_READ_NOTIFICATION_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalReadNotifications(orderIds) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LOCAL_READ_NOTIFICATION_KEY, JSON.stringify(orderIds));
}

const searchTargets = [
  { label: "Dashboard Overview", path: "/admin/dashboard", keywords: ["dashboard", "dashboard overview", "overview", "admin dashboard"] },
  { label: "Revenue Overview", path: "/admin/dashboard#revenue-overview", keywords: ["revenue", "revenue overview", "sales overview", "income"] },
  { label: "Products", path: "/admin/products", keywords: ["products", "product list", "catalog"] },
  { label: "Best Sellers", path: "/admin/best-sellers", keywords: ["best sellers", "best seller", "featured products", "popular products"] },
  { label: "Categories", path: "/admin/categories", keywords: ["categories", "category"] },
  { label: "Inventory", path: "/admin/inventory", keywords: ["inventory", "stock", "warehouse"] },
  { label: "Orders", path: "/admin/orders", keywords: ["orders"] },
  { label: "Order Details", path: "/admin/order-details", keywords: ["order details", "order detail"] },
  { label: "Customers", path: "/admin/customers", keywords: ["customers", "customer"] },
  { label: "Customer Details", path: "/admin/customer-details", keywords: ["customer details", "customer detail"] },
  { label: "Offers & Website CMS", path: "/admin/coupons", keywords: ["coupons", "offers", "discounts", "coupon", "cms", "banner", "banners"] },
  { label: "Reviews", path: "/admin/reviews", keywords: ["reviews", "product reviews"] },
  { label: "Payments", path: "/admin/payments", keywords: ["payments", "payment"] },
  { label: "Shipping", path: "/admin/shipping", keywords: ["shipping", "delivery", "dispatch"] },
  { label: "Analytics", path: "/admin/analytics", keywords: ["analytics", "report", "reports"] },
  { label: "Customer Queries", path: "/admin/queries", keywords: ["queries", "customer queries", "support"] },
  { label: "Register / Login", path: "/admin/register-login", keywords: ["register login", "registered users", "login users", "active users"] },
  { label: "Logs", path: "/admin/logs", keywords: ["logs", "admin logs", "activity logs", "section logs"] },
  { label: "Admin Users", path: "/admin/users", keywords: ["admin users", "team", "staff"] },
  { label: "Settings", path: "/admin/settings", keywords: ["settings", "store settings"] },
  { label: "Orders Overview", path: "/admin/dashboard#orders-overview", keywords: ["orders overview", "order overview", "orders chart"] },
  { label: "Top Selling Products", path: "/admin/dashboard#top-selling-masalas", keywords: ["top selling", "top selling products", "best sellers", "top products"] },
  { label: "Low Stock Alerts", path: "/admin/dashboard#low-stock-alerts", keywords: ["low stock", "stock alerts", "low stock alerts", "reorder"] },
  { label: "Recent Orders", path: "/admin/dashboard#recent-orders", keywords: ["recent orders", "latest orders"] },
  { label: "New Customers", path: "/admin/dashboard#new-customers", keywords: ["new customers", "recent customers"] },
];

const normalizeSearch = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const findSearchTarget = (value) => {
  const normalizedValue = normalizeSearch(value);

  if (!normalizedValue) {
    return null;
  }

  const exactMatch = searchTargets.find((target) =>
    target.keywords.some((keyword) => normalizeSearch(keyword) === normalizedValue)
  );

  if (exactMatch) {
    return exactMatch;
  }

  return (
    searchTargets.find((target) =>
      target.keywords.some((keyword) => normalizeSearch(keyword).includes(normalizedValue))
    ) ||
    searchTargets.find((target) =>
      target.keywords.some((keyword) => normalizedValue.includes(normalizeSearch(keyword)))
    ) ||
    null
  );
};

const AdminTopbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { adminProfile, currentUser } = useAuth();
  const [query, setQuery] = useState("");
  const [orders, setOrders] = useState([]);
  const [adminNotifications, setAdminNotifications] = useState([]);
  const [queries, setQueries] = useState([]);
  const [localReadNotifications, setLocalReadNotifications] = useState(() => readLocalReadNotifications());
  const [notificationPanelType, setNotificationPanelType] = useState("");
  const [markingNotificationId, setMarkingNotificationId] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const pageMeta = titleMap[location.pathname] || titleMap["/admin/dashboard"];
  const displayName = adminProfile?.name || currentUser?.displayName || "Admin User";
  const displayEmail = adminProfile?.email || currentUser?.email || "admin@spiceroot.com";
  const visibleSearchTargets = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);

    if (!normalizedQuery) {
      return searchTargets.slice(0, 8);
    }

    return searchTargets
      .filter((target) =>
        [target.label, ...target.keywords]
          .some((value) => normalizeSearch(value).includes(normalizedQuery))
      )
      .slice(0, 8);
  }, [query]);
  const unreadOrderNotifications = useMemo(() => {
    const liveNotificationRows = adminNotifications
      .filter((item) => item.isUnread)
      .map((item) => ({
        ...item,
        id: `admin-notification-${item.id}`,
        adminNotificationId: item.id,
        orderDocumentId: item.orderDocumentId || item.orderId,
        notificationType: "order",
      }));
    const notifiedOrderIds = new Set(
      liveNotificationRows
        .flatMap((item) => [item.orderDocumentId, item.orderId])
        .filter(Boolean)
    );
    const fallbackRows = orders
      .filter((item) => {
        const normalizedStatus = String(item.status || "").trim().toLowerCase();

        return (
          !notifiedOrderIds.has(item.id) &&
          !notifiedOrderIds.has(item.orderId) &&
          !localReadNotifications.includes(item.id) &&
          normalizedStatus !== "delivered" &&
          normalizedStatus !== "cancel" &&
          normalizedStatus !== "cancelled" &&
          normalizedStatus !== "canceled"
        );
      })
      .map((item) => ({
        id: `order-${item.id}`,
        source: "order",
        userId: item.userId,
        orderId: item.orderId,
        orderDocumentId: item.id,
        customerName: item.customerName,
        customerEmail: item.customerEmail,
        createdAt: item.createdAt,
        message: `Order ${item.orderId} is waiting for admin review.`,
        isUnread: true,
        notificationType: "order",
      }))
    return [...liveNotificationRows, ...fallbackRows].sort((left, right) => {
      const leftTime = typeof left.createdAt?.toMillis === "function" ? left.createdAt.toMillis() : 0;
      const rightTime = typeof right.createdAt?.toMillis === "function" ? right.createdAt.toMillis() : 0;
      return rightTime - leftTime;
    });
  }, [adminNotifications, localReadNotifications, orders]);
  const unreadQueryNotifications = useMemo(() => {
    return queries
      .filter((item) => !item.adminSeen)
      .map((item) => ({
        id: `query-${item.id}`,
        queryId: item.id,
        userId: item.userId,
        customerName: item.name,
        customerEmail: item.email,
        createdAt: item.createdAt,
        message: item.preview || "A customer sent a new message.",
        isUnread: true,
        notificationType: "query",
      }))
      .sort((left, right) => {
        const leftTime = typeof left.createdAt?.toMillis === "function" ? left.createdAt.toMillis() : 0;
        const rightTime = typeof right.createdAt?.toMillis === "function" ? right.createdAt.toMillis() : 0;
        return rightTime - leftTime;
      });
  }, [queries]);
  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    []
  );

  const handleSubmit = (event) => {
    event.preventDefault();
    const target = findSearchTarget(query);

    if (target) {
      handleSearchNavigate(target);
    }
  };

  const handleSearchNavigate = (target) => {
    setQuery("");
    setSearchOpen(false);
    navigate(target.path);
  };

  const markNotificationAsHandled = async (notification) => {
    if (!notification?.isUnread) {
      return;
    }

    if (notification.notificationType === "query") {
      await markContactSubmissionAsRead(notification.queryId);
      return;
    }

    if (notification.adminNotificationId) {
      await markAdminNotificationAsRead(notification.adminNotificationId);
      return;
    }

    setLocalReadNotifications((current) => {
      const next = Array.from(new Set([...current, notification.orderDocumentId || notification.orderId]));
      writeLocalReadNotifications(next);
      return next;
    });
  };

  const handleOpenNotificationOrder = async (notification) => {
    if (!notification) {
      return;
    }

    if (notification.notificationType !== "query" && !notification.userId) {
      return;
    }

    try {
      if (notification.isUnread) {
        setMarkingNotificationId(notification.id);
        await markNotificationAsHandled(notification);
      }

      navigate(
        notification.notificationType === "query"
          ? `/admin/queries?query=${encodeURIComponent(notification.queryId)}`
          : `/admin/orders?user=${encodeURIComponent(notification.userId)}&order=${encodeURIComponent(
            notification.orderDocumentId || notification.orderId
          )}`
      );
      setNotificationPanelType("");
    } catch (error) {
      console.error("Failed to open admin order notification:", error);
    } finally {
      setMarkingNotificationId("");
    }
  };

  const handleMarkAsRead = async (notification) => {
    try {
      setMarkingNotificationId(notification.id);
      await markNotificationAsHandled(notification);
    } catch (error) {
      console.error("Failed to mark admin notification as read:", error);
    } finally {
      setMarkingNotificationId("");
    }
  };

  useEffect(() => {
    const unsubscribe = subscribeToAdminNotifications(
      setAdminNotifications,
      (error) => console.error("Failed to load admin notifications:", error)
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToOrders(
      setOrders,
      (error) => console.error("Failed to load topbar order counts:", error)
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToContactSubmissions(
      setQueries,
      (error) => console.error("Failed to load topbar query counts:", error)
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setNotificationPanelType("");
  }, [location.pathname, location.search]);

  return (
    <div className="admin-topbar">
      <div className="admin-title-block">
        <span className="admin-kicker">Spice Root Admin</span>
        <h1>
          <span>{pageMeta.title}</span>
          <small>{` - ${pageMeta.subtitle}`}</small>
        </h1>
      </div>

      <form className="admin-search-shell" aria-label="Search admin dashboard" onSubmit={handleSubmit}>
        <span><FaSearch /></span>
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setSearchOpen(false);
            }
          }}
          placeholder="Search pages or sections..."
        />
        <button type="submit" className="admin-search-submit" aria-label="Jump to admin page or section">
          <FaSearch />
        </button>

        {searchOpen && visibleSearchTargets.length > 0 ? (
          <div className="admin-search-suggestions" role="listbox">
            {visibleSearchTargets.map((target) => (
              <button
                key={`${target.label}-${target.path}`}
                type="button"
                role="option"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSearchNavigate(target)}
              >
                <strong>{target.label}</strong>
                <span>{target.path.replace("/admin/", "Admin / ")}</span>
              </button>
            ))}
          </div>
        ) : null}
      </form>

      <div className="admin-top-actions">
        <Link to="/" className="admin-secondary-button admin-link-button" target="_blank" rel="noreferrer">
          <FaExternalLinkAlt />
          <span>Preview Website</span>
        </Link>

        <Link
          to={`/admin/logs?section=${encodeURIComponent(pageMeta.title)}`}
          className="admin-secondary-button admin-link-button"
        >
          <FaClipboardList />
          <span>Logs</span>
        </Link>

        <button type="button" className="admin-secondary-button admin-date-chip">
          <FaCalendarAlt />
          <span>{todayLabel}</span>
        </button>

        <div className="admin-notification-shell">
          <button
            type="button"
            className="admin-notify-icon admin-notify-button"
            title={`${unreadOrderNotifications.length} unread order notification${unreadOrderNotifications.length === 1 ? "" : "s"}`}
            onClick={() =>
              setNotificationPanelType((current) => (current === "orders" ? "" : "orders"))
            }
          >
            <FaBell />
            <span>{unreadOrderNotifications.length}</span>
          </button>

          {notificationPanelType === "orders" ? (
            <div className="admin-notification-panel">
              <div className="admin-notification-panel-head">
                <div>
                  <strong>Order Notifications</strong>
                  <small>Unread order alerts disappear after they are marked as read.</small>
                </div>
              </div>

              <div className="admin-notification-list">
                {unreadOrderNotifications.length === 0 ? (
                  <div className="admin-empty-state">No new order notifications right now.</div>
                ) : (
                  unreadOrderNotifications.map((notification) => (
                    <article
                      key={notification.id}
                      className={`admin-notification-card${notification.isUnread ? " unread" : ""}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleOpenNotificationOrder(notification)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleOpenNotificationOrder(notification);
                        }
                      }}
                    >
                      <div className="admin-notification-meta">
                        <strong>{notification.customerName}</strong>
                        <span>{notification.orderId}</span>
                      </div>
                      <p>{notification.message}</p>
                      <div className="admin-notification-actions">
                        <button
                          type="button"
                          className="admin-panel-action-link"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleOpenNotificationOrder(notification);
                          }}
                        >
                          Open order
                        </button>
                        <button
                          type="button"
                          className="admin-panel-action-link"
                          disabled={!notification.isUnread || markingNotificationId === notification.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleMarkAsRead(notification);
                          }}
                        >
                          {markingNotificationId === notification.id
                            ? "Saving..."
                            : notification.isUnread
                              ? "Mark as read"
                              : "Read"}
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div className="admin-notification-shell">
          <button
            type="button"
            className="admin-notify-icon admin-notify-button"
            title={`${unreadQueryNotifications.length} unread customer quer${unreadQueryNotifications.length === 1 ? "y" : "ies"}`}
            onClick={() =>
              setNotificationPanelType((current) => (current === "queries" ? "" : "queries"))
            }
          >
            <FaEnvelope />
            <span>{unreadQueryNotifications.length}</span>
          </button>

          {notificationPanelType === "queries" ? (
            <div className="admin-notification-panel">
              <div className="admin-notification-panel-head">
                <div>
                  <strong>Customer Queries</strong>
                  <small>Unread customer messages move here until the admin reads them.</small>
                </div>
              </div>

              <div className="admin-notification-list">
                {unreadQueryNotifications.length === 0 ? (
                  <div className="admin-empty-state">No new customer queries right now.</div>
                ) : (
                  unreadQueryNotifications.map((notification) => (
                    <article
                      key={notification.id}
                      className={`admin-notification-card${notification.isUnread ? " unread" : ""}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleOpenNotificationOrder(notification)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleOpenNotificationOrder(notification);
                        }
                      }}
                    >
                      <div className="admin-notification-meta">
                        <strong>{notification.customerName}</strong>
                        <span>{`Query ${notification.queryId}`}</span>
                      </div>
                      <p>{notification.message}</p>
                      <div className="admin-notification-actions">
                        <button
                          type="button"
                          className="admin-panel-action-link"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleOpenNotificationOrder(notification);
                          }}
                        >
                          Open query
                        </button>
                        <button
                          type="button"
                          className="admin-panel-action-link"
                          disabled={!notification.isUnread || markingNotificationId === notification.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleMarkAsRead(notification);
                          }}
                        >
                          {markingNotificationId === notification.id ? "Saving..." : "Mark as read"}
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div className="admin-user-chip">
          <div className="admin-avatar">
            {displayName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <strong>{displayName}</strong>
            <span>{displayEmail}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminTopbar;
