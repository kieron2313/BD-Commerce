import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Download,
  Eye,
  FileText,
  Heart,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  Printer,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { SeoHead } from '../components/SeoHead';
import { SafeImage } from '../components/SafeImage';
import { InvoicePreviewSheet, printInvoiceDocument } from '../components/InvoicePreviewSheet';
import { InvoiceOrderData, formatInvoiceNumber } from '../utils/invoiceRenderer';
import { downloadInvoicePdf, downloadQuotationPdf } from '../utils/pdf';
import { removeFromWishlist, useWishlistIds } from '../lib/wishlist';

type CustomerDashboardTab = 'overview' | 'orders' | 'quotes' | 'wishlist' | 'profile';

export const AccountPage: React.FC = () => {
  const {
    firebaseUser,
    authLoading,
    authError,
    userRole,
    isAdmin,
    signInWithGoogle,
    logout,
    authFetch,
    settings,
  } = usePlatform();

  const [activeTab, setActiveTab] = useState<CustomerDashboardTab>('overview');
  const [history, setHistory] = useState<{
    profile: any;
    orders: any[];
    inquiries: any[];
    quotations: any[];
    summary?: {
      totalOrders: number;
      totalSpent: number;
      activeOrders: number;
      openInquiries: number;
      openQuotations: number;
    };
  } | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    companyName: '',
    shippingAddress: '',
    city: '',
    stateRegion: '',
    postalCode: '',
    country: 'United States',
  });
  const [savedMsg, setSavedMsg] = useState('');

  const [invoiceModalOrder, setInvoiceModalOrder] = useState<InvoiceOrderData | null>(null);

  const wishlistIds = useWishlistIds();
  const [allCatalogProducts, setAllCatalogProducts] = useState<any[]>([]);

  const currency = settings.general?.currencySymbol || '$';
  const invoicePrefix = settings.invoice?.invoiceNumberPrefix || 'INV-';

  useEffect(() => {
    if (!firebaseUser) return;
    setLoadingHistory(true);
    authFetch('/api/customer/history')
      .then((r) => r.json())
      .then((d) => {
        setHistory(d);
        if (d.profile) {
          setProfileForm({
            firstName: d.profile.firstName || '',
            lastName: d.profile.lastName || '',
            phone: d.profile.phone || '',
            companyName: d.profile.companyName || '',
            shippingAddress: d.profile.shippingAddress || '',
            city: d.profile.city || '',
            stateRegion: d.profile.stateRegion || '',
            postalCode: d.profile.postalCode || '',
            country: d.profile.country || 'United States',
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [firebaseUser, authFetch]);

  useEffect(() => {
    if (wishlistIds.length === 0) return;
    fetch('/api/products?limit=100')
      .then((r) => r.json())
      .then((d) => setAllCatalogProducts(d.products || []))
      .catch(() => {});
  }, [wishlistIds.length]);

  const savedProducts = useMemo(
    () => allCatalogProducts.filter((p) => wishlistIds.includes(p.id)),
    [allCatalogProducts, wishlistIds]
  );

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavedMsg('');
    const res = await authFetch('/api/customer/profile', {
      method: 'PATCH',
      body: JSON.stringify(profileForm),
    });
    if (res.ok) {
      const updated = await res.json();
      setHistory((prev) => (prev ? { ...prev, profile: updated.profile } : prev));
      setSavedMsg('Profile & delivery address saved.');
    }
  };

  if (authLoading) {
    return (
      <div className="ka-container py-16">
        <div className="h-56 bg-white border border-[#F0F1F3] rounded-3xl animate-pulse" />
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <>
        <SeoHead title="Account Sign In | Kanso Atelier" noIndex />
        <div className="max-w-md mx-auto px-4 py-24">
          <div className="bg-white border border-[#F0F1F3] shadow-[0_12px_32px_rgba(17,24,39,0.06)] rounded-3xl p-8 text-center space-y-5">
            <h1 className="text-3xl font-extrabold tracking-tight text-[#111827]">
              Customer Dashboard
            </h1>
            <p className="text-sm text-[#6B7280] leading-relaxed">
              Sign in with Google to track purchases, download branded PDF invoices, manage inquiries & quotations, and save delivery addresses.
            </p>
            {authError && (
              <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 text-left">
                {authError}
              </div>
            )}
            <button
              type="button"
              onClick={signInWithGoogle}
              className="w-full h-12 px-5 text-sm font-semibold bg-[#171717] text-white rounded-2xl hover:bg-[#0A0A0A] cursor-pointer"
            >
              Sign in with Google
            </button>
          </div>
        </div>
      </>
    );
  }

  const orders = history?.orders || [];
  const inquiries = history?.inquiries || [];
  const quotations = history?.quotations || [];
  const totalOrders = history?.summary?.totalOrders ?? orders.length;
  const totalSpent =
    history?.summary?.totalSpent ??
    orders.reduce((s, o) => s + Number(o.totalAmount || 0), 0);
  const quotesAndInquiriesCount = inquiries.length + quotations.length;

  const inputClass =
    'w-full px-3.5 py-2.5 text-xs bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#171717] text-[#111827]';

  const navTabs: Array<{
    key: CustomerDashboardTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'orders', label: `Purchases & Invoices (${orders.length})`, icon: Package },
    { key: 'quotes', label: `Inquiries & Quotes (${quotesAndInquiriesCount})`, icon: FileText },
    { key: 'wishlist', label: `Saved Items (${wishlistIds.length})`, icon: Heart },
    { key: 'profile', label: 'Profile & Addresses', icon: MapPin },
  ];

  const displayName =
    `${profileForm.firstName} ${profileForm.lastName}`.trim() ||
    firebaseUser.displayName ||
    firebaseUser.email;

  return (
    <>
      <SeoHead title="Customer Dashboard | Kanso Atelier" noIndex />
      <div className="ka-container py-10 space-y-6">
        {/* Top Portal Identity Header */}
        <div className="bg-white border border-[#F0F1F3] shadow-[0_8px_30px_rgba(17,24,39,0.04)] rounded-3xl p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            {firebaseUser.photoURL ? (
              <img
                src={firebaseUser.photoURL}
                alt={displayName || 'Account'}
                className="w-14 h-14 rounded-2xl object-cover border border-[#E5E7EB] shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-[#171717] text-white font-extrabold text-lg flex items-center justify-center shrink-0">
                {(displayName || 'C').slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111827]">
                {displayName}
              </h1>
              <p className="text-xs text-[#6B7280] mt-1">
                {firebaseUser.email} · {userRole?.name || 'Registered Customer'}
                {profileForm.companyName ? ` · ${profileForm.companyName}` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {isAdmin && (
              <Link
                to="/admin"
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold bg-[#171717] text-white rounded-2xl hover:bg-[#0A0A0A] whitespace-nowrap"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Open Admin Dashboard</span>
              </Link>
            )}
            <Link
              to="/shop"
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold ka-oak-btn rounded-2xl whitespace-nowrap"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Browse Catalogue</span>
            </Link>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold bg-[#F3F4F6] text-[#111827] rounded-2xl hover:bg-[#E5E7EB] cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* 4-Column Customer KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-[#F0F1F3] rounded-2xl p-5">
            <p className="text-xs font-medium text-[#6B7280]">Total Orders</p>
            <p className="text-2xl font-extrabold text-[#111827] mt-1 tabular-nums">
              {totalOrders}
            </p>
          </div>
          <div className="bg-white border border-[#F0F1F3] rounded-2xl p-5">
            <p className="text-xs font-medium text-[#6B7280]">Total Purchased</p>
            <p className="text-2xl font-extrabold text-[#111827] mt-1 tabular-nums">
              {currency}
              {Number(totalSpent).toFixed(2)}
            </p>
          </div>
          <div className="bg-white border border-[#F0F1F3] rounded-2xl p-5">
            <p className="text-xs font-medium text-[#6B7280]">Inquiries & Quotes</p>
            <p className="text-2xl font-extrabold text-[#111827] mt-1 tabular-nums">
              {quotesAndInquiriesCount}
            </p>
          </div>
          <div className="bg-white border border-[#F0F1F3] rounded-2xl p-5">
            <p className="text-xs font-medium text-[#6B7280]">Saved Items</p>
            <p className="text-2xl font-extrabold text-[#111827] mt-1 tabular-nums">
              {wishlistIds.length}
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white border border-[#F0F1F3] rounded-2xl p-1.5 flex flex-wrap gap-1">
          {navTabs.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-[#171717] text-white shadow-xs'
                    : 'text-[#4B5563] hover:bg-[#F3F4F6] hover:text-[#111827]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* ==================== OVERVIEW TAB ==================== */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-white border border-[#F0F1F3] rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-extrabold text-[#111827]">
                  Recent Purchases & Invoices
                </h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('orders')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#111827] hover:underline cursor-pointer"
                >
                  <span>View all</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {loadingHistory ? (
                <p className="text-xs text-[#6B7280] py-4">Loading purchases...</p>
              ) : orders.length === 0 ? (
                <div className="py-10 text-center space-y-3 bg-[#F7F7F8] rounded-2xl">
                  <p className="text-sm font-semibold text-[#111827]">No purchases placed yet</p>
                  <p className="text-xs text-[#6B7280]">
                    Once you place an order, itemized purchase receipts and branded PDF invoices appear here.
                  </p>
                  <Link
                    to="/shop"
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold ka-oak-btn rounded-xl"
                  >
                    <span>Explore Furniture</span>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.slice(0, 4).map((o) => (
                    <div
                      key={o.id}
                      className="p-4 rounded-2xl border border-[#EAECEF] bg-[#FAFAFB] flex flex-wrap items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <p className="font-mono text-sm font-bold text-[#111827]">
                          {o.orderNumber} · {formatInvoiceNumber(o.orderNumber, invoicePrefix)}
                        </p>
                        <p className="text-xs text-[#6B7280] capitalize">
                          {new Date(o.createdAt).toLocaleDateString()} · {o.orderStatus} · Payment:{' '}
                          {o.paymentStatus} · {(o.items || []).length} line items
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-[#111827] tabular-nums mr-2">
                          {currency}
                          {Number(o.totalAmount).toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setInvoiceModalOrder(o)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-white border border-[#E5E7EB] hover:border-[#171717] rounded-xl cursor-pointer whitespace-nowrap"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Invoice</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            downloadInvoicePdf({
                              order: o,
                              invoiceSettings: settings.invoice,
                              generalSettings: settings.general,
                              currency,
                            })
                          }
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-[#171717] text-white rounded-xl cursor-pointer whitespace-nowrap"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white border border-[#F0F1F3] rounded-3xl p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-extrabold text-[#111827]">Default Delivery</h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('profile')}
                    className="text-xs font-semibold text-[#111827] hover:underline cursor-pointer"
                  >
                    Edit
                  </button>
                </div>
                <div className="text-xs text-[#4B5563] space-y-1 leading-relaxed">
                  <p className="font-bold text-[#111827]">{displayName}</p>
                  {profileForm.companyName && <p>{profileForm.companyName}</p>}
                  <p>
                    {[
                      profileForm.shippingAddress,
                      profileForm.city,
                      profileForm.stateRegion,
                      profileForm.postalCode,
                      profileForm.country,
                    ]
                      .filter(Boolean)
                      .join(', ') || 'No saved address yet'}
                  </p>
                  {profileForm.phone && <p>{profileForm.phone}</p>}
                </div>
              </div>

              <div className="bg-white border border-[#F0F1F3] rounded-3xl p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-extrabold text-[#111827]">Active Quotations</h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('quotes')}
                    className="text-xs font-semibold text-[#111827] hover:underline cursor-pointer"
                  >
                    View all
                  </button>
                </div>
                {quotations.length === 0 ? (
                  <p className="text-xs text-[#6B7280]">No quotations issued yet.</p>
                ) : (
                  <div className="space-y-2">
                    {quotations.slice(0, 3).map((q) => (
                      <Link
                        key={q.id}
                        to={`/quotation/${q.quoteRef}?token=${q.secureToken}`}
                        className="block p-3 rounded-2xl bg-[#F7F7F8] hover:bg-[#EFEFF1] transition-colors"
                      >
                        <div className="flex justify-between text-xs font-bold text-[#111827]">
                          <span className="font-mono">{q.quoteRef}</span>
                          <span className="tabular-nums">
                            {currency}
                            {Number(q.grandTotal).toFixed(2)}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#6B7280] capitalize mt-0.5">
                          Status: {q.status}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== PURCHASES & INVOICES TAB ==================== */}
        {activeTab === 'orders' && (
          <div className="space-y-5">
            {orders.length === 0 ? (
              <div className="bg-white border border-[#F0F1F3] rounded-3xl p-12 text-center space-y-3">
                <p className="text-base font-bold text-[#111827]">No purchases found</p>
                <p className="text-xs text-[#6B7280]">
                  Complete an order on the storefront to access itemized order tracking and invoices.
                </p>
                <Link
                  to="/shop"
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold ka-oak-btn rounded-2xl"
                >
                  <span>Shop Collection</span>
                </Link>
              </div>
            ) : (
              orders.map((o) => (
                <div
                  key={o.id}
                  className="bg-white border border-[#F0F1F3] shadow-[0_8px_30px_rgba(17,24,39,0.04)] rounded-3xl overflow-hidden"
                >
                  <div className="px-6 py-4 bg-[#F7F7F8] border-b border-[#EAECEF] flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="font-mono text-sm font-extrabold text-[#111827]">
                        Order {o.orderNumber} · Invoice{' '}
                        {formatInvoiceNumber(o.orderNumber, invoicePrefix)}
                      </p>
                      <p className="text-xs text-[#6B7280] capitalize mt-0.5">
                        Placed {new Date(o.createdAt).toLocaleDateString()} · Status: {o.orderStatus}{' '}
                        · Payment: {o.paymentStatus} ·{' '}
                        {o.shippingMethodName || 'Standard Shipping'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-extrabold text-[#111827] tabular-nums mr-2">
                        {currency}
                        {Number(o.totalAmount).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setInvoiceModalOrder(o)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white border border-[#E5E7EB] hover:border-[#171717] text-[#111827] rounded-xl cursor-pointer whitespace-nowrap"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Invoice</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          downloadInvoicePdf({
                            order: o,
                            invoiceSettings: settings.invoice,
                            generalSettings: settings.general,
                            currency,
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#171717] text-white rounded-xl cursor-pointer whitespace-nowrap"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          printInvoiceDocument({
                            order: o,
                            invoiceSettings: settings.invoice,
                            generalSettings: settings.general,
                            currency,
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] rounded-xl cursor-pointer whitespace-nowrap"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-6 space-y-5">
                    <div className="divide-y divide-[#F0F1F3]">
                      {(o.items || []).map((it: any) => (
                        <div
                          key={it.id}
                          className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            {it.productImage && (
                              <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#ECECEE] shrink-0">
                                <SafeImage
                                  src={it.productImage}
                                  alt={it.productName}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-[#111827] truncate">
                                {it.productName}
                              </p>
                              <p className="text-xs text-[#6B7280] font-mono">
                                SKU: {it.sku}
                                {it.variationLabel ? ` · ${it.variationLabel}` : ''}
                              </p>
                            </div>
                          </div>
                          <div className="text-right tabular-nums shrink-0">
                            <p className="text-xs font-semibold text-[#111827]">
                              Qty {it.quantity} × {currency}
                              {Number(it.unitPrice).toFixed(2)}
                            </p>
                            <p className="text-sm font-extrabold text-[#111827]">
                              {currency}
                              {Number(it.lineTotal).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {Array.isArray(o.history) && o.history.length > 0 && (
                      <div className="pt-4 border-t border-[#F0F1F3]">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280] mb-2">
                          Order Timeline
                        </p>
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-[#4B5563]">
                          {o.history.map((h: any) => (
                            <span key={h.id}>
                              <strong className="text-[#111827] capitalize">{h.status}</strong> ·{' '}
                              {new Date(h.createdAt).toLocaleDateString()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ==================== INQUIRIES & QUOTES TAB ==================== */}
        {activeTab === 'quotes' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-[#F0F1F3] rounded-3xl p-6 space-y-4">
              <h2 className="text-base font-extrabold text-[#111827]">
                Formal Quotations ({quotations.length})
              </h2>
              {quotations.length === 0 ? (
                <p className="text-xs text-[#6B7280]">No quotations issued yet.</p>
              ) : (
                <div className="space-y-3">
                  {quotations.map((q) => (
                    <div
                      key={q.id}
                      className="p-4 rounded-2xl bg-[#F7F7F8] border border-[#EAECEF] space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-sm font-bold text-[#111827]">
                            {q.quoteRef}
                          </p>
                          <p className="text-xs text-[#6B7280] capitalize">
                            Status: {q.status}
                            {q.expiresAt
                              ? ` · Expires ${new Date(q.expiresAt).toLocaleDateString()}`
                              : ''}
                          </p>
                        </div>
                        <span className="text-sm font-extrabold text-[#111827] tabular-nums">
                          {currency}
                          {Number(q.grandTotal).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/quotation/${q.quoteRef}?token=${q.secureToken}`}
                          className="px-3.5 py-2 text-xs font-semibold ka-oak-btn rounded-xl"
                        >
                          Review & Respond
                        </Link>
                        <button
                          type="button"
                          onClick={() =>
                            downloadQuotationPdf({
                              ...q,
                              items: q.items || [],
                              company: settings.general,
                            })
                          }
                          className="inline-flex items-center gap-1 px-3.5 py-2 text-xs font-semibold bg-white border border-[#E5E7EB] rounded-xl cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Quote PDF</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-[#F0F1F3] rounded-3xl p-6 space-y-4">
              <h2 className="text-base font-extrabold text-[#111827]">
                Product Inquiries ({inquiries.length})
              </h2>
              {inquiries.length === 0 ? (
                <p className="text-xs text-[#6B7280]">No product inquiries submitted yet.</p>
              ) : (
                <div className="space-y-3">
                  {inquiries.map((inq) => (
                    <div
                      key={inq.id}
                      className="p-4 rounded-2xl bg-[#F7F7F8] border border-[#EAECEF] space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-mono text-xs font-bold text-[#111827]">
                          {inq.inquiryRef}
                        </p>
                        <span className="text-xs font-semibold capitalize text-[#111827]">
                          {inq.status}
                        </span>
                      </div>
                      {inq.message && (
                        <p className="text-xs text-[#4B5563]">{inq.message}</p>
                      )}
                      {Array.isArray(inq.items) && inq.items.length > 0 && (
                        <p className="text-[11px] text-[#6B7280]">
                          Items: {inq.items.map((i: any) => `${i.productName} (×${i.quantity})`).join(', ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== SAVED ITEMS TAB ==================== */}
        {activeTab === 'wishlist' && (
          <div className="bg-white border border-[#F0F1F3] rounded-3xl p-6 space-y-5">
            <h2 className="text-base font-extrabold text-[#111827]">
              Saved Pieces ({wishlistIds.length})
            </h2>
            {wishlistIds.length === 0 ? (
              <div className="py-12 text-center space-y-3 bg-[#F7F7F8] rounded-2xl">
                <p className="text-sm font-semibold text-[#111827]">Your saved list is empty</p>
                <p className="text-xs text-[#6B7280]">
                  Click the heart icon on any product card to bookmark furniture for your workspace or home.
                </p>
                <Link
                  to="/shop"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold ka-oak-btn rounded-xl"
                >
                  <span>Explore Catalogue</span>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {savedProducts.map((p) => {
                  const displayPrice = p.salePrice ?? p.regularPrice;
                  return (
                    <div
                      key={p.id}
                      className="rounded-2xl border border-[#EAECEF] bg-[#FAFAFB] p-4 flex flex-col justify-between gap-4"
                    >
                      <Link to={`/products/${p.slug}`} className="flex items-center gap-3.5">
                        <div className="w-20 h-20 rounded-xl overflow-hidden bg-[#ECECEE] shrink-0">
                          <SafeImage
                            src={p.mainImageUrl}
                            alt={p.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#111827] truncate">{p.name}</p>
                          <p className="text-xs text-[#6B7280] font-mono mt-0.5">{p.sku}</p>
                          {displayPrice !== null && displayPrice !== undefined && (
                            <p className="text-sm font-extrabold text-[#111827] tabular-nums mt-1">
                              {currency}
                              {Number(displayPrice).toFixed(2)}
                            </p>
                          )}
                        </div>
                      </Link>
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#EAECEF]">
                        <Link
                          to={`/products/${p.slug}`}
                          className="text-xs font-semibold text-[#111827] hover:underline"
                        >
                          View Piece
                        </Link>
                        <button
                          type="button"
                          onClick={() => removeFromWishlist(p.id)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================== PROFILE & ADDRESSES TAB ==================== */}
        {activeTab === 'profile' && (
          <form
            onSubmit={handleSaveProfile}
            className="bg-white border border-[#F0F1F3] shadow-[0_8px_30px_rgba(17,24,39,0.04)] rounded-3xl p-6 sm:p-8 max-w-2xl space-y-5"
          >
            <div>
              <h2 className="text-base font-extrabold text-[#111827]">
                Account Profile & Delivery Address
              </h2>
              <p className="text-xs text-[#6B7280] mt-0.5">
                Keep your contact and shipping preferences up to date for faster checkout and accurate invoices.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#4B5563] mb-1">
                  First Name
                </label>
                <input
                  value={profileForm.firstName}
                  onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#4B5563] mb-1">
                  Last Name
                </label>
                <input
                  value={profileForm.lastName}
                  onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#4B5563] mb-1">
                  Company / Studio Name
                </label>
                <input
                  value={profileForm.companyName}
                  onChange={(e) => setProfileForm({ ...profileForm, companyName: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#4B5563] mb-1">Phone</label>
                <input
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4B5563] mb-1">
                Street Shipping Address
              </label>
              <input
                value={profileForm.shippingAddress}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, shippingAddress: e.target.value })
                }
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#4B5563] mb-1">City</label>
                <input
                  value={profileForm.city}
                  onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#4B5563] mb-1">
                  State / Region
                </label>
                <input
                  value={profileForm.stateRegion}
                  onChange={(e) => setProfileForm({ ...profileForm, stateRegion: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#4B5563] mb-1">
                  Postal Code
                </label>
                <input
                  value={profileForm.postalCode}
                  onChange={(e) => setProfileForm({ ...profileForm, postalCode: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#4B5563] mb-1">Country</label>
                <input
                  value={profileForm.country}
                  onChange={(e) => setProfileForm({ ...profileForm, country: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex items-center gap-4 pt-2">
              <button
                type="submit"
                className="px-6 py-2.5 text-xs font-semibold bg-[#171717] text-white rounded-2xl hover:bg-[#0A0A0A] cursor-pointer"
              >
                Save Profile & Address
              </button>
              {savedMsg && <span className="text-xs font-semibold text-[#15803D]">{savedMsg}</span>}
            </div>
          </form>
        )}
      </div>

      {/* Customer Visual Invoice Modal */}
      {invoiceModalOrder && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-start justify-center overflow-y-auto p-4 sm:p-8"
          onClick={(e) => {
            if (e.target === e.currentTarget) setInvoiceModalOrder(null);
          }}
        >
          <div className="w-full max-w-4xl space-y-4 my-auto">
            <div className="bg-white rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xl">
              <div>
                <p className="text-sm font-extrabold text-[#111827]">
                  {formatInvoiceNumber(invoiceModalOrder.orderNumber, invoicePrefix)}
                </p>
                <p className="text-xs text-[#6B7280]">
                  Order {invoiceModalOrder.orderNumber} ·{' '}
                  {new Date(invoiceModalOrder.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    downloadInvoicePdf({
                      order: invoiceModalOrder,
                      invoiceSettings: settings.invoice,
                      generalSettings: settings.general,
                      currency,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] rounded-xl cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    printInvoiceDocument({
                      order: invoiceModalOrder,
                      invoiceSettings: settings.invoice,
                      generalSettings: settings.general,
                      currency,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold ka-oak-btn rounded-xl cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Invoice</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInvoiceModalOrder(null)}
                  className="p-2 rounded-xl bg-[#F3F4F6] text-[#111827] hover:bg-[#E5E7EB] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <InvoicePreviewSheet
              order={invoiceModalOrder}
              invoiceSettings={settings.invoice}
              generalSettings={settings.general}
              currency={currency}
            />
          </div>
        </div>
      )}
    </>
  );
};
