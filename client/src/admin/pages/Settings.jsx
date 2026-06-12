import { useEffect, useState } from "react";
import ActionButton from "../components/ActionButton";
import {
  STORE_SETTINGS_SECTIONS,
  saveStoreSettings,
  subscribeToStoreSettings,
} from "../../lib/storeSettings";

const Settings = () => {
  const [draft, setDraft] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeToStoreSettings(
      (nextSettings) => {
        setDraft(nextSettings);
        setLoadError("");
      },
      (error) => {
        console.error("Failed to load store settings:", error);
        setLoadError("Could not load store settings from Firebase.");
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

  const handleChange = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async () => {
    if (!draft) {
      return;
    }

    try {
      setSaving(true);
      const savedSettings = await saveStoreSettings(draft);
      setDraft(savedSettings);
      setFeedback("Store settings saved to Firebase.");
    } catch (error) {
      console.error("Failed to save store settings:", error);
      setFeedback("Could not save store settings right now.");
    } finally {
      setSaving(false);
    }
  };

  if (!draft) {
    return (
      <section className="admin-module-section">
        <div className="admin-empty-state">
          {loadError || "Loading store settings..."}
        </div>
      </section>
    );
  }

  return (
    <section className="admin-module-section">
      <div className="admin-page-head">
        <div>
          <h2>Settings</h2>
          <p>Store-wide configuration synced with the live Firebase database.</p>
        </div>
      </div>

      {feedback ? <div className="admin-toast-success">{feedback}</div> : null}

      <div className="admin-settings-grid">
        {STORE_SETTINGS_SECTIONS.map((section) => (
          <article key={section.title} className="admin-settings-card">
            <div className="admin-page-head compact">
              <div>
                <h3>{section.title}</h3>
                <p>Editable live configuration.</p>
              </div>
            </div>

            <div className="admin-field-grid">
              {section.fields.map((field) => (
                <label key={field.key}>
                  <span>{field.label}</span>
                  <input
                    type="text"
                    value={draft[field.key] || ""}
                    onChange={(event) => handleChange(field.key, event.target.value)}
                  />
                </label>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className="admin-page-actions">
        <ActionButton variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </ActionButton>
      </div>
    </section>
  );
};

export default Settings;
