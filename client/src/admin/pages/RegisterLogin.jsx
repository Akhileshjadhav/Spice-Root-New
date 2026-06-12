import { useEffect, useMemo, useState } from "react";
import DataTable from "../components/DataTable";
import { PERIOD_OPTIONS, isWithinDateFilters } from "../utils/dateFilters";
import { subscribeToUsers } from "../../lib/adminStore";

function getTime(value) {
  if (typeof value?.toMillis === "function") {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  const parsed = new Date(value || 0);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function formatDateTime(value) {
  const time = getTime(value);

  if (!time) {
    return "Not logged in yet";
  }

  return new Date(time).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ACTIVE_LOGIN_WINDOW = 30 * 60 * 1000;

function RegisterLogin() {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const unsubscribe = subscribeToUsers(
      setUsers,
      (error) => console.error("Failed to load register/login users:", error)
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);

    return () => window.clearInterval(timer);
  }, []);

  const activeLoginUsers = useMemo(
    () => (now ? users.filter((user) => now - getTime(user.lastLoginAt) <= ACTIVE_LOGIN_WINDOW) : []),
    [now, users]
  );

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return users
      .filter((user) => isWithinDateFilters(user.createdAt, period, fromDate, toDate))
      .filter((user) => {
        if (!normalizedQuery) {
          return true;
        }

        return [user.name, user.email, user.city, user.state]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery));
      })
      .map((user) => ({
        id: user.uid,
        name: user.name,
        email: user.email,
        joined: formatDateTime(user.createdAt),
        lastLogin: formatDateTime(user.lastLoginAt),
        loginState: activeLoginUsers.some((item) => item.uid === user.uid) ? "Logged In" : "Offline",
      }));
  }, [activeLoginUsers, fromDate, period, query, toDate, users]);

  const columns = [
    { key: "name", label: "User" },
    { key: "email", label: "Email" },
    { key: "joined", label: "Registered" },
    { key: "lastLogin", label: "Last Login" },
    { key: "loginState", label: "Login State", type: "status" },
  ];

  return (
    <section className="admin-module-section">
      <div className="admin-page-head">
        <div>
          <h2>Register / Login</h2>
          <p>Live registered users and recent login activity from Firebase.</p>
        </div>
      </div>

      <section className="admin-dashboard-grid admin-register-login-grid">
        <article className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <h2>Registered Users</h2>
              <small>Total live user profiles</small>
            </div>
          </div>
          <strong className="admin-big-number">{users.length}</strong>
        </article>

        <article className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <h2>Login Users</h2>
              <small>Active in the last 30 minutes</small>
            </div>
          </div>
          <strong className="admin-big-number">{activeLoginUsers.length}</strong>
        </article>
      </section>

      <div className="admin-module-card admin-export-section">
        <div className="admin-page-head compact">
          <div>
            <h3>Register / Login Filters</h3>
            <p>Filter by registered date, name, email, city, or state.</p>
          </div>
        </div>

        <div className="admin-filter-row">
          <input
            className="admin-inline-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search user name, email, city, state..."
          />
          <select className="admin-inline-search" value={period} onChange={(event) => setPeriod(event.target.value)}>
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input className="admin-inline-search" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          <input className="admin-inline-search" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </div>
      </div>

      <div className="admin-module-card">
        <DataTable columns={columns} rows={filteredRows} rowKey="id" />
      </div>
    </section>
  );
}

export default RegisterLogin;
