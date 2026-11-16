import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { PlatformProvider, usePlatform } from './context/PlatformContext';
import { AdminUiProvider } from './context/AdminUiContext';
import { StorefrontLayout } from './components/StorefrontLayout';
import { HomePage } from './pages/HomePage';
import { routeChunkLoaders } from './lib/prefetch';

const CatalogPage = lazy(() =>
  routeChunkLoaders.catalog().then((m) => ({ default: m.CatalogPage }))
);
const ProductDetailPage = lazy(() =>
  routeChunkLoaders.product().then((m) => ({ default: m.ProductDetailPage }))
);
const CartPage = lazy(() =>
  routeChunkLoaders.cart().then((m) => ({ default: m.CartPage }))
);
const CheckoutPage = lazy(() =>
  routeChunkLoaders.checkout().then((m) => ({ default: m.CheckoutPage }))
);
const InquiryPage = lazy(() =>
  routeChunkLoaders.inquiry().then((m) => ({ default: m.InquiryPage }))
);
const QuotationViewPage = lazy(() =>
  routeChunkLoaders.quotation().then((m) => ({ default: m.QuotationViewPage }))
);
const StaticPage = lazy(() =>
  routeChunkLoaders.staticPage().then((m) => ({ default: m.StaticPage }))
);
const NotFoundPage = lazy(() =>
  routeChunkLoaders.staticPage().then((m) => ({ default: m.NotFoundPage }))
);
const AccountPage = lazy(() =>
  routeChunkLoaders.account().then((m) => ({ default: m.AccountPage }))
);
const AdminDashboard = lazy(() =>
  routeChunkLoaders.admin().then((m) => ({ default: m.AdminDashboard }))
);

const RouteLoadingFallback: React.FC = () => (
  <div className="ka-container py-12">
    <div className="h-7 w-48 bg-[#ECE9E4] rounded animate-pulse mb-6" />
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3].map((n) => (
        <div key={n} className="h-72 bg-white border border-[#E6E3DD] rounded-lg animate-pulse" />
      ))}
    </div>
  </div>
);

const RedirectWatcher: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { redirects } = usePlatform();

  useEffect(() => {
    const state = location.state as { ajaxCatalog?: boolean } | null;
    if (!state?.ajaxCatalog) {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }

    if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/api')) {
      return;
    }

    // Instant 0ms synchronous check against preloaded redirect rules from bootstrap
    const match = redirects.find((r) => r.sourcePath === location.pathname);
    if (match && match.targetPath && match.targetPath !== location.pathname) {
      navigate(match.targetPath, { replace: true });
    }
  }, [location.pathname, location.state, navigate, redirects]);

  return null;
};

export default function App() {
  return (
    <BrowserRouter>
      <PlatformProvider>
        <AdminUiProvider>
          <RedirectWatcher />
          <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            {/* Administration Dashboard (Independent Lazy Bundle) */}
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/:section" element={<AdminDashboard />} />

            {/* Storefront & Catalogue Routes */}
            <Route
              path="*"
              element={
                <StorefrontLayout>
                  <Suspense fallback={<RouteLoadingFallback />}>
                    <Routes>
                      <Route path="/" element={<HomePage />} />
                      <Route path="/shop" element={<CatalogPage mode="shop" />} />
                      <Route path="/categories/:slug" element={<CatalogPage mode="category" />} />
                      <Route path="/categories/:parentSlug/:subslug" element={<CatalogPage mode="category" />} />
                      <Route path="/brands/:slug" element={<CatalogPage mode="brand" />} />
                      <Route path="/search" element={<CatalogPage mode="search" />} />
                      <Route path="/products/:slug" element={<ProductDetailPage />} />
                      <Route path="/cart" element={<CartPage />} />
                      <Route path="/checkout" element={<CheckoutPage />} />
                      <Route path="/inquiry" element={<InquiryPage />} />
                      <Route path="/quotation/:ref" element={<QuotationViewPage />} />
                      <Route path="/pages/:slug" element={<StaticPage />} />
                      <Route path="/account" element={<AccountPage />} />
                      <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                  </Suspense>
                </StorefrontLayout>
              }
            />
          </Routes>
        </Suspense>
        </AdminUiProvider>
      </PlatformProvider>
    </BrowserRouter>
  );
}
