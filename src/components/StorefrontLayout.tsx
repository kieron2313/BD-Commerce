import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, ShoppingBag, FileText, User, X, Trash2, Plus, Minus, Menu, ArrowRight } from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { SafeImage } from './SafeImage';
import { AjaxSearchEngine } from './AjaxSearchEngine';
import { preloadRouteChunk, prefetchCatalog, prefetchPage } from '../lib/prefetch';

export const StorefrontLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    settings,
    operatingMode,
    categories,
    pages,
    cart,
    cartOpen,
    setCartOpen,
    updateCartQty,
    removeCartItem,
    firebaseUser,
    isAdmin,
  } = usePlatform();

  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const siteName = settings.general?.siteName || 'Kanso Atelier';
  const currency = settings.general?.currencySymbol || '$';
  const parentCategories = categories.filter((c) => !c.parentId).slice(0, 3);

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F7F8] text-[#111827]">
      {/* Crisp 3-Zone Top Bar */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-[#EAECEF]">
        <div className="ka-container h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 -ml-2 text-[#111827] hover:bg-[#F3F4F6] rounded-xl"
              aria-label="Toggle Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link
              to="/"
              className="text-xl font-extrabold tracking-tight text-[#111827] whitespace-nowrap shrink-0"
            >
              {siteName}
            </Link>
          </div>

          {/* Zone 2: Concise single-line nav links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#6B7280]">
            <Link
              to="/shop"
              onMouseEnter={() => prefetchCatalog()}
              onFocus={() => prefetchCatalog()}
              className="hover:text-[#111827] transition-colors whitespace-nowrap shrink-0"
            >
              Shop All
            </Link>
            {parentCategories.map((cat) => (
              <Link
                key={cat.id}
                to={`/categories/${cat.slug}`}
                onMouseEnter={() => prefetchCatalog({ category: cat.slug })}
                onFocus={() => prefetchCatalog({ category: cat.slug })}
                className="hover:text-[#111827] transition-colors whitespace-nowrap shrink-0"
              >
                {cat.name.split(' ')[0]}
              </Link>
            ))}
            <Link
              to="/pages/about-us"
              onMouseEnter={() => prefetchPage('about-us')}
              onFocus={() => prefetchPage('about-us')}
              className="hover:text-[#111827] transition-colors whitespace-nowrap shrink-0"
            >
              Atelier
            </Link>
            <Link
              to="/admin"
              onMouseEnter={() => preloadRouteChunk('admin')}
              onFocus={() => preloadRouteChunk('admin')}
              className="text-[#15803D] font-semibold hover:text-[#14532D] transition-colors whitespace-nowrap shrink-0"
            >
              Admin
            </Link>
          </nav>

          {/* Zone 3: Single compact action cluster */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              onMouseEnter={() => preloadRouteChunk('catalog')}
              className="w-9 h-9 inline-flex items-center justify-center text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] rounded-full transition-colors cursor-pointer"
              aria-label="Search Catalogue"
            >
              <Search className="w-4 h-4" />
            </button>
            <Link
              to="/account"
              onMouseEnter={() => preloadRouteChunk('account')}
              onFocus={() => preloadRouteChunk('account')}
              className="w-9 h-9 inline-flex items-center justify-center text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] rounded-full transition-colors"
              aria-label={firebaseUser ? 'Customer Dashboard' : 'Sign In'}
              title={firebaseUser ? 'Customer Dashboard' : 'Sign In'}
            >
              <User className="w-4 h-4" />
            </Link>
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold ka-oak-btn rounded-2xl whitespace-nowrap shrink-0 tabular-nums cursor-pointer"
            >
              {operatingMode === 'catalogue' ? (
                <>
                  <FileText className="w-3.5 h-3.5" />
                  <span>Inquiry ({cart.itemCount})</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Bag ({cart.itemCount})</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#EAECEF] bg-white px-4 py-4 space-y-2">
            <Link
              to="/shop"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-semibold text-[#111827]"
            >
              Shop All Products
            </Link>
            {parentCategories.map((cat) => (
              <Link
                key={cat.id}
                to={`/categories/${cat.slug}`}
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-sm text-[#6B7280]"
              >
                {cat.name}
              </Link>
            ))}
            <Link
              to="/pages/about-us"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm text-[#6B7280]"
            >
              About Atelier
            </Link>
            <Link
              to="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-semibold text-[#15803D]"
            >
              Admin Dashboard
            </Link>
          </div>
        )}
      </header>

      {/* Main Content with Compositor-Only Route Transition */}
      <main
        key={/^\/(shop|categories|brands|search)/.test(location.pathname) ? '/catalog-shell' : location.pathname}
        className="flex-1 ka-page-transition"
      >
        {children}
      </main>

      {/* Modern Minimal Dark Footer */}
      <footer className="bg-[#171717] text-[#E5E7EB] mt-20">
        <div className="ka-container py-14 grid grid-cols-1 md:grid-cols-4 gap-10">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-white mb-3">{siteName}</h2>
            <p className="text-sm text-[#9CA3AF] leading-relaxed mb-4">
              {settings.general?.tagline || 'Architectural Home & Office Furniture'}
            </p>
            <div className="text-xs text-[#9CA3AF] space-y-1">
              <p>{settings.general?.address}</p>
              <p>{settings.general?.contactEmail}</p>
              <p className="tabular-nums">{settings.general?.phone}</p>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold tracking-wider text-white mb-4">Collections</h3>
            <ul className="space-y-2.5 text-sm text-[#9CA3AF]">
              <li>
                <Link to="/shop" className="hover:text-white transition-colors">
                  All Products
                </Link>
              </li>
              {parentCategories.map((c) => (
                <li key={c.id}>
                  <Link to={`/categories/${c.slug}`} className="hover:text-white transition-colors">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold tracking-wider text-white mb-4">Information</h3>
            <ul className="space-y-2.5 text-sm text-[#9CA3AF]">
              {pages.map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/pages/${p.slug}`}
                    onMouseEnter={() => prefetchPage(p.slug)}
                    className="hover:text-white transition-colors"
                  >
                    {p.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold tracking-wider text-white mb-4">Portal & Console</h3>
            <ul className="space-y-2.5 text-sm text-[#9CA3AF]">
              <li>
                <Link
                  to="/account"
                  onMouseEnter={() => preloadRouteChunk('account')}
                  className="hover:text-white transition-colors"
                >
                  Customer Portal
                </Link>
              </li>
              <li>
                <Link
                  to={operatingMode === 'catalogue' ? '/inquiry' : '/cart'}
                  onMouseEnter={() => preloadRouteChunk(operatingMode === 'catalogue' ? 'inquiry' : 'cart')}
                  className="hover:text-white transition-colors"
                >
                  {operatingMode === 'catalogue' ? 'Inquiry Cart' : 'Shopping Bag'}
                </Link>
              </li>
              <li>
                <Link
                  to="/admin"
                  onMouseEnter={() => preloadRouteChunk('admin')}
                  className="hover:text-white transition-colors text-[#CCF3C6]"
                >
                  Administration Dashboard
                </Link>
              </li>
              <li>
                <a href="/sitemap.xml" className="hover:text-white transition-colors">
                  XML Sitemap
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="ka-container py-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#9CA3AF]">
            <span>
              © {new Date().getFullYear()} {siteName}. All rights reserved.
            </span>
            <span>
              Active Mode:{' '}
              {operatingMode === 'catalogue' ? 'Product Catalogue & Inquiry' : 'eCommerce Store (Cash on Delivery)'}
            </span>
          </div>
        </div>
      </footer>

      {/* Big Live AJAX Search Overlay */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-start justify-center pt-14 sm:pt-20 px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSearchOpen(false);
          }}
        >
          <div className="w-full max-w-3xl ka-scale-appear">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-sm font-bold text-white drop-shadow-xs">Live Catalogue Search</span>
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="w-9 h-9 rounded-full bg-white text-[#111827] shadow-md flex items-center justify-center hover:bg-[#F3F4F6] cursor-pointer"
                aria-label="Close search"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <AjaxSearchEngine
              variant="modal"
              autoFocus
              onNavigateDone={() => setSearchOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Persistent Slide-Over Cart / Inquiry Drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/35 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl border-l border-[#EAECEF]">
            <div className="px-6 py-5 border-b border-[#EAECEF] flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#111827]">
                  {operatingMode === 'catalogue' ? 'Inquiry Cart' : 'Shopping Bag'}
                </h2>
                <p className="text-xs text-[#6B7280] tabular-nums">
                  {cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'} selected
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className="w-8 h-8 rounded-full bg-[#F3F4F6] flex items-center justify-center text-[#6B7280] hover:text-[#111827] cursor-pointer"
                aria-label="Close drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cart.items.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-sm text-[#6B7280] mb-5">
                    {operatingMode === 'catalogue'
                      ? 'Your inquiry list is empty. Browse products to request a formal quotation.'
                      : 'Your shopping bag is currently empty.'}
                  </p>
                  <Link
                    to="/shop"
                    onClick={() => setCartOpen(false)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold ka-oak-btn rounded-2xl"
                  >
                    Browse Products
                  </Link>
                </div>
              ) : (
                cart.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-4 p-3 rounded-2xl bg-[#F7F7F8] border border-[#F0F1F3]"
                  >
                    <div className="w-20 h-20 rounded-xl overflow-hidden bg-[#ECECEE] shrink-0">
                      <SafeImage
                        src={item.imageUrl}
                        alt={item.productName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link
                        to={`/products/${item.productSlug}`}
                        onClick={() => setCartOpen(false)}
                        className="text-sm font-bold text-[#111827] hover:underline block truncate"
                      >
                        {item.productName}
                      </Link>
                      {item.variationLabel && (
                        <p className="text-xs text-[#6B7280] mt-0.5">{item.variationLabel}</p>
                      )}
                      {item.showSku && (
                        <p className="text-[11px] font-mono text-[#9CA3AF] mt-0.5">SKU: {item.sku}</p>
                      )}
                      <div className="flex items-center justify-between mt-3">
                        <div className="inline-flex items-center bg-white border border-[#E5E7EB] rounded-xl">
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.id, item.quantity - 1)}
                            className="p-1.5 hover:bg-[#F3F4F6] text-[#111827] rounded-l-xl cursor-pointer"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-3 text-xs font-semibold tabular-nums">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.id, item.quantity + 1)}
                            className="p-1.5 hover:bg-[#F3F4F6] text-[#111827] rounded-r-xl cursor-pointer"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="flex items-center gap-3">
                          {item.showPrices && item.lineTotal !== null && (
                            <span className="text-sm font-extrabold text-[#111827] tabular-nums">
                              {currency}
                              {item.lineTotal.toFixed(2)}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => removeCartItem(item.id)}
                            className="p-1 text-[#9CA3AF] hover:text-red-600 cursor-pointer"
                            aria-label="Remove item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.items.length > 0 && (
              <div className="p-6 border-t border-[#EAECEF] bg-[#F7F7F8] space-y-4">
                {operatingMode === 'ecommerce' && settings.commerce?.showPrices !== false && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#6B7280] font-medium">Subtotal</span>
                    <span className="font-extrabold text-base text-[#111827] tabular-nums">
                      {currency}
                      {cart.subtotal.toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <Link
                    to="/cart"
                    onMouseEnter={() => preloadRouteChunk('cart')}
                    onClick={() => setCartOpen(false)}
                    className="text-center py-3 px-4 text-xs font-semibold bg-white border border-[#E5E7EB] text-[#111827] rounded-2xl hover:bg-[#F3F4F6] transition-colors whitespace-nowrap"
                  >
                    {operatingMode === 'catalogue' ? 'Review List' : 'View Bag'}
                  </Link>
                  <Link
                    to={operatingMode === 'catalogue' ? '/inquiry' : '/checkout'}
                    onMouseEnter={() => preloadRouteChunk(operatingMode === 'catalogue' ? 'inquiry' : 'checkout')}
                    onClick={() => setCartOpen(false)}
                    className="inline-flex items-center justify-center gap-1.5 py-3 px-4 text-xs font-semibold ka-oak-btn rounded-2xl whitespace-nowrap"
                  >
                    <span>{operatingMode === 'catalogue' ? 'Request Quote' : 'Checkout'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
