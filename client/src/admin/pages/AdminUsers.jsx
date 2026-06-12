import { useEffect, useState } from "react";
import ActionButton from "../components/ActionButton";
import DataTable from "../components/DataTable";
import {
  deleteAdminUser,
  saveAdminUser,
  subscribeToAdminUsers,
} from "../../lib/adminStore";

const EMPTY_FORM = {
  id: "",
  uid: "",
  name: "",
  email: "",
  role: "admin",
  status: "active",
};

function toForm(row) {
  return {
    id: row.id,
    uid: row.uid,
    name: row.name,
    email: row.email,
    role: row.role,
    status: String(row.status || "active").toLowerCase(),
  };
}

const AdminUsers = () => {
  const [adminRows, setAdminRows] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeToAdminUsers(
      setAdminRows,
      (error) => {
        console.error("Failed to load admin users:", error);
        setErrorMessage("Could not load admin users from Firebase.");
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }

    const timer = window.setTimeout(() => setFeedback(""), 3200);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrorMessage("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      await saveAdminUser(form);
      setFeedback(form.id ? "Admin user updated successfully." : "Admin user added successfully.");
      setForm(EMPTY_FORM);
    } catch (error) {
      console.error("Failed to save admin user:", error);
      setErrorMessage(error.message || "Could not save admin user right now.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Remove admin access for ${row.email}?`)) {
      return;
    }

    try {
      await deleteAdminUser(row.id);
      setFeedback("Admin user removed successfully.");
    } catch (error) {
      console.error("Failed to remove admin user:", error);
      setErrorMessage("Could not remove admin user right now.");
    }
  };

  const columns = [
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "uid", label: "Firebase UID" },
    { key: "role", label: "Role" },
    { key: "lastLogin", label: "Last Login" },
    { key: "status", label: "Status", type: "status" },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className="admin-row-actions">
          <button type="button" className="admin-panel-action-link" onClick={() => setForm(toForm(row))}>
            Update
          </button>
          <button type="button" className="admin-panel-action-link danger" onClick={() => handleDelete(row)}>
            Remove
          </button>
        </div>
      ),
    },
  ];

  return (
    <section className="admin-module-section">
      {feedback ? <div className="admin-toast-success">{feedback}</div> : null}

      <div className="admin-page-head">
        <div>
          <h2>Admin Users</h2>
          <p>Add, update, and remove Firebase-synced admin access records.</p>
        </div>
      </div>

      {errorMessage ? <div className="admin-empty-state">{errorMessage}</div> : null}

      <form className="admin-module-card admin-live-form" onSubmit={handleSubmit}>
        <div className="admin-page-head compact">
          <div>
            <h3>{form.id ? "Update Admin User" : "Add Admin User"}</h3>
            <p>Use the Firebase Auth UID of the account that should access the admin panel.</p>
          </div>
          {form.id ? (
            <button type="button" className="admin-panel-action-link" onClick={() => setForm(EMPTY_FORM)}>
              Clear
            </button>
          ) : null}
        </div>

        <div className="admin-field-grid">
          <label>
            <span>Firebase Auth UID</span>
            <input
              value={form.uid}
              disabled={Boolean(form.id)}
              onChange={(event) => updateForm("uid", event.target.value.trim())}
            />
          </label>
          <label>
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => updateForm("email", event.target.value)}
            />
          </label>
          <label>
            <span>Name</span>
            <input value={form.name} onChange={(event) => updateForm("name", event.target.value)} />
          </label>
          <label>
            <span>Role</span>
            <select value={form.role} onChange={(event) => updateForm("role", event.target.value)}>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="support">Support</option>
            </select>
          </label>
          <label>
            <span>Status</span>
            <select value={form.status} onChange={(event) => updateForm("status", event.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
        </div>

        <ActionButton type="submit" variant="primary" className="admin-form-submit" disabled={saving}>
          {saving ? "Saving..." : form.id ? "Update Admin User" : "Add Admin User"}
        </ActionButton>
      </form>

      <div className="admin-module-card" style={{ marginTop: 14 }}>
        <DataTable columns={columns} rows={adminRows} rowKey="id" />
      </div>
    </section>
  );
};

export default AdminUsers;
