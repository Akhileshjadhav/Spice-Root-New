import { Suspense, lazy, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import ProtectedRoute from "./user/routes/ProtectedRoute";
import AdminRoute from "./admin/routes/AdminRoute";

const StartupLanding = lazy(() => import("./user/pages/StartupLanding"));
const Account = lazy(() => import("./user/pages/Account"));
const AdminLogin = lazy(() => import("./admin/pages/AdminLogin"));
const AdminRoutes = lazy(() => import("./admin/routes/AdminRoutes"));
const CartPage = lazy(() => import("./user/pages/CartScreen"));
const CheckoutPage = lazy(() => import("./user/pages/CheckoutScreen"));
const ContactPage = lazy(() => import("./pages/Contact"));
const ForgotPassword = lazy(() => import("./user/pages/ForgotPassword"));
const Login = lazy(() => import("./user/pages/Login"));
const OffersPage = lazy(() => import("./user/pages/OffersPage"));
const Register = lazy(() => import("./user/pages/Register"));
const ProductDetailPage = lazy(() => import("./user/pages/ProductDetailPage"));
const ProductsPage = lazy(() => import("./user/pages/ProductsPage"));

function RouteLoader() {
  return <div className="auth-route-loading">Loading...</div>;
}

function HomeSectionRedirect({ sectionId }) {
  return <Navigate to={`/#${sectionId}`} replace />;
}

function App() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      return;
    }

    window.scrollTo({ top: 0, behavior: "auto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <>
      <Routes>
        {/* CUSTOMER WEBSITE ROUTES */}
        <Route
          path="/"
          element={
            <Suspense fallback={<RouteLoader />}>
              <StartupLanding />
            </Suspense>
          }
        />

      <Route
        path="/products"
        element={
          <Suspense fallback={<RouteLoader />}>
            <ProductsPage />
          </Suspense>
        }
      />

      <Route
        path="/products/:productId"
        element={
          <Suspense fallback={<RouteLoader />}>
            <ProductDetailPage />
          </Suspense>
        }
      />

      <Route
        path="/offers"
        element={
          <Suspense fallback={<RouteLoader />}>
            <ProtectedRoute allowAdmins={false}>
              <OffersPage />
            </ProtectedRoute>
          </Suspense>
        }
      />

      <Route
        path="/cart"
        element={
          <Suspense fallback={<RouteLoader />}>
            <ProtectedRoute allowAdmins={false}>
              <CartPage />
            </ProtectedRoute>
          </Suspense>
        }
      />

      <Route
        path="/checkout"
        element={
          <Suspense fallback={<RouteLoader />}>
            <ProtectedRoute allowAdmins={false}>
              <CheckoutPage />
            </ProtectedRoute>
          </Suspense>
        }
      />

      <Route
        path="/contact"
        element={
          <Suspense fallback={<RouteLoader />}>
            <ContactPage />
          </Suspense>
        }
      />

      <Route
        path="/login"
        element={
          <Suspense fallback={<RouteLoader />}>
            <Login />
          </Suspense>
        }
      />

      <Route
        path="/forgot-password"
        element={
          <Suspense fallback={<RouteLoader />}>
            <ForgotPassword />
          </Suspense>
        }
      />

      <Route
        path="/register"
        element={
          <Suspense fallback={<RouteLoader />}>
            <Register />
          </Suspense>
        }
      />

      <Route path="/get-started" element={<Navigate to="/register" replace />} />
      <Route path="/home" element={<Navigate to="/" replace />} />
      <Route path="/features" element={<HomeSectionRedirect sectionId="features" />} />
      <Route path="/about" element={<HomeSectionRedirect sectionId="about" />} />
      <Route path="/testimonials" element={<HomeSectionRedirect sectionId="testimonials" />} />

      <Route
        path="/admin/login"
        element={
          <Suspense fallback={<RouteLoader />}>
            <AdminLogin />
          </Suspense>
        }
      />

      <Route
        path="/account"
        element={
          <Suspense fallback={<RouteLoader />}>
            <ProtectedRoute allowAdmins={false}>
              <Account />
            </ProtectedRoute>
          </Suspense>
        }
      />

      {/* FULL ADMIN PANEL ROUTES */}
      <Route
        path="/admin/*"
        element={
          <Suspense fallback={<RouteLoader />}>
            <AdminRoute>
              <AdminRoutes />
            </AdminRoute>
          </Suspense>
        }
      />

      {/* DEFAULT FALLBACK */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;
