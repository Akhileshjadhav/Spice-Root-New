import { useState } from "react";
import { addDoc, collection } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import Footer from "../components/Footer";
import { useAuth } from "../context/useAuth";
import { db, serverTimestamp } from "../firebase";
import Navbar from "../user/components/Navbar";
import "../styles/products-listing.css";
import "../styles/luxury-spice.css";
import "../styles/navbar-final.css";

function Contact() {
  const navigate = useNavigate();
  const { currentUser, logoutUser, userProfile } = useAuth();
  const defaultName =
    userProfile?.name || userProfile?.firstName || currentUser?.displayName || "";
  const defaultEmail = userProfile?.email || currentUser?.email || "";
  const [form, setForm] = useState({
    name: defaultName,
    email: defaultEmail,
    message: "",
  });
  const [errors, setErrors] = useState({});
  const [submitState, setSubmitState] = useState({ loading: false, error: "", success: "" });

  const handleLogout = async () => {
    await logoutUser();
    navigate("/", { replace: true });
  };

  const handleChange = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
    setSubmitState((current) => ({ ...current, error: "", success: "" }));
  };

  const validate = () => {
    const nextErrors = {};

    if (!form.name.trim()) {
      nextErrors.name = "Please enter your name.";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      nextErrors.email = "Please enter a valid email address.";
    }

    if (!form.message.trim()) {
      nextErrors.message = "Please share your message with us.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    try {
      setSubmitState({ loading: true, error: "", success: "" });

      // await addDoc(collection(db, "contactSubmissions"), {
      //   ...(currentUser?.uid ? { userId: currentUser.uid } : {}),
      //   name: form.name.trim(),
      //   email: form.email.trim(),
      //   message: form.message.trim(),
      //   status: "New",
      //   adminSeen: false,
      //   adminReply: "",
      //   adminReplyAt: null,
      //   userReplySeen: true,
      //   createdAt: serverTimestamp(),
      //   updatedAt: serverTimestamp(),
      // });
      await addDoc(collection(db, "contactSubmissions"), {
        userId: currentUser?.uid || null,
        name: form.name.trim(),
        email: form.email.trim(),
        message: form.message.trim(),
        status: "New",
        adminSeen: false,
        adminReply: "",
        adminReplyAt: null,
        userReplySeen: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setForm((current) => ({
        ...current,
        message: "",
      }));
      setSubmitState({
        loading: false,
        error: "",
        success: "Your message has been saved. We will get back to you soon.",
      });
    } catch (error) {
      console.error("Contact form submission error:", error);
      setSubmitState({
        loading: false,
        error: `We could not save your message right now (${error.message || "Unknown error"}). Please try again.`,
        success: "",
      });
    }
  };

  return (
    <div className="catalog-shell contact-shell">
      <div className="catalog-noise" aria-hidden="true" />

      <Navbar activeSection="contact" onLogout={handleLogout} />

      <main className="catalog-page">
        <section className="catalog-hero">
          <div className="catalog-title-line" />
          <p>Contact Us</p>
          <h1>Send your message directly to the Spice Root team.</h1>
          <span>Your email is prefilled from your account when available, and you can still edit it before sending.</span>
        </section>

        <form className="checkout-form-panel ember-surface" onSubmit={handleSubmit}>
          <div className="cart-panel-head">
            <div>
              <span className="checkout-section-kicker">We are listening</span>
              <h2>Tell us how we can help</h2>
            </div>
          </div>

          <div className="checkout-form-grid">
            <label>
              <span>Name</span>
              <input
                type="text"
                value={form.name}
                onChange={(event) => handleChange("name", event.target.value)}
                placeholder="Your name"
              />
              {errors.name ? <small>{errors.name}</small> : null}
            </label>

            <label>
              <span>Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => handleChange("email", event.target.value)}
                placeholder="your@email.com"
              />
              {errors.email ? <small>{errors.email}</small> : null}
            </label>

            <label className="checkout-field-full">
              <span>Your message for us</span>
              <textarea
                rows="6"
                value={form.message}
                onChange={(event) => handleChange("message", event.target.value)}
                placeholder="How can we help you today?"
              />
              {errors.message ? <small>{errors.message}</small> : null}
            </label>
          </div>

          {submitState.error ? <div className="auth-route-error">{submitState.error}</div> : null}
          {submitState.success ? <div className="auth-route-message">{submitState.success}</div> : null}

          <button type="submit" className="catalog-button cart-checkout-button" disabled={submitState.loading}>
            {submitState.loading ? "Sending..." : "Send Message"}
          </button>
        </form>
      </main>

      <Footer />
    </div>
  );
}

export default Contact;
