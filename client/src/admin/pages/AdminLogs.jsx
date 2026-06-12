import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DataTable from "../components/DataTable";
import { PERIOD_OPTIONS, isWithinDateFilters } from "../utils/dateFilters";
import { subscribeToAdminLogs } from "../../lib/adminLogs";

function AdminLogs() {
  const [searchParams] = useSearchParams();
  const initialSection = searchParams.get("section") || "All";
  const [logs, setLogs] = useState([]);
  const [query, setQuery] = useState("");
  const [section, setSection] = useState(initialSection);
  const [period, setPeriod] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    const unsubscribe = subscribeToAdminLogs(
      setLogs,
      (error) => console.error("Failed to load admin logs:", error)
    );

    return () => unsubscribe();
  }, []);

  const sections = useMemo(
    () => ["All", ...new Set(logs.map((log) => log.section).filter(Boolean))],
    [logs]
  );

  const filteredLogs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return logs
      .filter((log) => section === "All" || log.section === section)
      .filter((log) => isWithinDateFilters(log.createdAt, period, fromDate, toDate))
      .filter((log) => {
        if (!normalizedQuery) {
          return true;
        }

        return [log.section, log.action, log.target, log.adminName, log.details, log.dateTime]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery));
      });
  }, [fromDate, logs, period, query, section, toDate]);

  const columns = [
    { key: "section", label: "Section" },
    { key: "action", label: "Action" },
    { key: "target", label: "Target" },
    { key: "adminName", label: "Admin" },
    { key: "details", label: "Details" },
    { key: "dateTime", label: "Day, Date & Time" },
  ];

  return (
    <section className="admin-module-section">
      <div className="admin-page-head">
        <div>
          <h2>Logs</h2>
          <p>Section activity with action detail, admin name, day, date, and time.</p>
        </div>
      </div>

      <div className="admin-module-card admin-export-section">
        <div className="admin-page-head compact">
          <div>
            <h3>Log Filters</h3>
            <p>Filter logs by section, date, admin, target, or action detail.</p>
          </div>
        </div>

        <div className="admin-filter-row">
          <input
            className="admin-inline-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search action, target, admin, details..."
          />
          <select className="admin-inline-search" value={section} onChange={(event) => setSection(event.target.value)}>
            {sections.map((item) => (
              <option key={item} value={item}>
                {item === "All" ? "All Sections" : item}
              </option>
            ))}
          </select>
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
        <DataTable columns={columns} rows={filteredLogs} rowKey="id" />
        {filteredLogs.length === 0 ? (
          <div className="admin-empty-state" style={{ marginTop: "12px" }}>
            No logs match the selected filters yet.
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default AdminLogs;
