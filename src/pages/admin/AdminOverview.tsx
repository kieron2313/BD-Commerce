import React, { useEffect, useState } from 'react';
import { ArrowRight, AlertTriangle } from 'lucide-react';
import { usePlatform } from '../../context/PlatformContext';

interface AdminOverviewProps {
  onNavigateTab: (tab: string) => void;
}

export const AdminOverview: React.FC<AdminOverviewProps> = ({ onNavigateTab }) => {
  const { authFetch, operatingMode, settings, refreshBootstrap } = usePlatform();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

  const currency = settings.general?.currencySymbol || '$';

  const load = () => {
    setLoading(true);
    authFetch('/api/admin/overview')
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [operatingMode]);

  const toggleOperatingMode = async (nextMode: 'ecommerce' | 'catalogue') => {
    setSwitching(true);
    try {
      const updatedCommerce = { ...settings.commerce, operatingMode: nextMode };
      const res = await authFetch('/api/admin/settings/commerce', {
        method: 'PUT',
        body: JSON.stringify({ value: updatedCommerce }),
      });
      if (res.ok) {
        await refreshBootstrap();
      }
    } finally {
      setSwitching(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
          <div key={n} className="h-28 bg-white border border-[#F0F1F3] rounded-3xl animate-pulse" />
        ))}
      </div>
    );
  }

  const s = data.stats;

  return (
    <div className="space-y-6">
      {/* Operating Mode Controller */}
      <div className="bg-white border border-[#F0F1F3] shadow-[0_8px_30px_rgba(17,24,39,0.04)] rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#CCF3C6] text-[#14532D] text-[13px] font-bold mb-2">
            Global Platform Operating Mode
          </span>
          <h2 className="text-lg font-extrabold tracking-tight text-[#111827]">
            {operatingMode === 'ecommerce'
              ? 'eCommerce Mode Active (Cash on Delivery Checkout)'
              : 'Product Catalogue & Inquiry Mode Active (RFQ Workflow)'}
          </h2>
          <p className="text-xs text-[#6B7280] mt-1">
            Switching modes preserves all products, variations, customers, orders, inquiries, and quotations.
          </p>
        </div>
        <div className="inline-flex items-center p-1.5 bg-[#F7F7F8] border border-[#EAECEF] rounded-2xl shrink-0">
          <button
            type="button"
            disabled={switching}
            onClick={() => toggleOperatingMode('ecommerce')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap cursor-pointer ${
              operatingMode === 'ecommerce'
                ? 'bg-[#171717] text-white shadow-xs'
                : 'text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            eCommerce Mode
          </button>
          <button
            type="button"
            disabled={switching}
            onClick={() => toggleOperatingMode('catalogue')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap cursor-pointer ${
              operatingMode === 'catalogue'
                ? 'bg-[#171717] text-white shadow-xs'
                : 'text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            Catalogue / Inquiry Mode
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#F0F1F3] shadow-[0_8px_30px_rgba(17,24,39,0.04)] rounded-3xl p-5">
          <p className="text-xs font-medium text-[#6B7280]">Total Products</p>
          <p className="text-3xl font-extrabold text-[#111827] tabular-nums mt-1">{s.totalProducts}</p>
          <button
            type="button"
            onClick={() => onNavigateTab('products')}
            className="text-xs font-semibold text-[#15803D] hover:underline mt-2 tabular-nums inline-flex items-center gap-1 cursor-pointer"
          >
            <span>{s.totalCategories} categories · Manage</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="bg-white border border-[#F0F1F3] shadow-[0_8px_30px_rgba(17,24,39,0.04)] rounded-3xl p-5">
          <p className="text-xs font-medium text-[#6B7280]">Total Customers</p>
          <p className="text-3xl font-extrabold text-[#111827] tabular-nums mt-1">{s.totalCustomers}</p>
          <button
            type="button"
            onClick={() => onNavigateTab('customers')}
            className="text-xs font-semibold text-[#6B7280] hover:text-[#111827] mt-2 inline-flex items-center gap-1 cursor-pointer"
          >
            <span>Directory</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {operatingMode === 'ecommerce' ? (
          <div className="bg-white border border-[#F0F1F3] shadow-[0_8px_30px_rgba(17,24,39,0.04)] rounded-3xl p-5">
            <p className="text-xs font-medium text-[#6B7280]">Total Sales (eCommerce)</p>
            <p className="text-3xl font-extrabold text-[#111827] tabular-nums mt-1">
              {currency}
              {s.totalSales.toFixed(2)}
            </p>
            <p className="text-xs font-semibold text-amber-700 mt-2 tabular-nums">{s.pendingOrders} pending orders</p>
          </div>
        ) : (
          <div className="bg-white border border-[#F0F1F3] shadow-[0_8px_30px_rgba(17,24,39,0.04)] rounded-3xl p-5">
            <p className="text-xs font-medium text-[#6B7280]">Active Inquiries</p>
            <p className="text-3xl font-extrabold text-[#111827] tabular-nums mt-1">{s.totalInquiries}</p>
            <p className="text-xs font-semibold text-amber-700 mt-2 tabular-nums">{s.newInquiries} new inquiries</p>
          </div>
        )}

        <div className="bg-white border border-[#F0F1F3] shadow-[0_8px_30px_rgba(17,24,39,0.04)] rounded-3xl p-5">
          <p className="text-xs font-medium text-[#6B7280]">Low Stock Alerts</p>
          <p className="text-3xl font-extrabold text-[#111827] tabular-nums mt-1">{s.lowStockCount}</p>
          <button
            type="button"
            onClick={() => onNavigateTab('inventory')}
            className="text-xs font-semibold text-[#111827] hover:underline mt-2 inline-flex items-center gap-1 cursor-pointer"
          >
            <span>Inspect Inventory</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#F0F1F3] shadow-[0_8px_30px_rgba(17,24,39,0.04)] rounded-3xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#6B7280]">Total Orders</p>
            <p className="text-2xl font-extrabold text-[#111827] tabular-nums mt-0.5">{s.totalOrders}</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('orders')}
            className="px-3.5 py-2 text-xs font-semibold bg-[#F7F7F8] hover:bg-[#ECECEE] text-[#111827] rounded-xl cursor-pointer"
          >
            Manage
          </button>
        </div>
        <div className="bg-white border border-[#F0F1F3] shadow-[0_8px_30px_rgba(17,24,39,0.04)] rounded-3xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#6B7280]">Total Inquiries</p>
            <p className="text-2xl font-extrabold text-[#111827] tabular-nums mt-0.5">{s.totalInquiries}</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('inquiries')}
            className="px-3.5 py-2 text-xs font-semibold bg-[#F7F7F8] hover:bg-[#ECECEE] text-[#111827] rounded-xl cursor-pointer"
          >
            Manage
          </button>
        </div>
        <div className="bg-white border border-[#F0F1F3] shadow-[0_8px_30px_rgba(17,24,39,0.04)] rounded-3xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#6B7280]">Total Quotations</p>
            <p className="text-2xl font-extrabold text-[#111827] tabular-nums mt-0.5">{s.totalQuotations}</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('quotations')}
            className="px-3.5 py-2 text-xs font-semibold bg-[#F7F7F8] hover:bg-[#ECECEE] text-[#111827] rounded-xl cursor-pointer"
          >
            Manage
          </button>
        </div>
      </div>

      {/* Recent Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="bg-white border border-[#F0F1F3] shadow-[0_8px_30px_rgba(17,24,39,0.04)] rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[#111827]">Recent Orders</h3>
            <button
              type="button"
              onClick={() => onNavigateTab('orders')}
              className="text-xs font-semibold text-[#6B7280] hover:text-[#111827] cursor-pointer"
            >
              View All
            </button>
          </div>
          <div className="divide-y divide-[#F0F1F3] text-xs">
            {(data.recentOrders || []).map((o: any) => (
              <div key={o.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="font-mono font-bold text-[#111827]">{o.orderNumber}</p>
                  <p className="text-[#6B7280]">
                    {o.customerName} · <span className="capitalize">{o.orderStatus}</span>
                  </p>
                </div>
                <span className="font-extrabold text-[#111827] tabular-nums">
                  {currency}
                  {o.totalAmount.toFixed(2)}
                </span>
              </div>
            ))}
            {(!data.recentOrders || data.recentOrders.length === 0) && (
              <p className="text-[#6B7280] py-4">No orders yet.</p>
            )}
          </div>
        </div>

        {/* Recent Inquiries & Quotations */}
        <div className="bg-white border border-[#F0F1F3] shadow-[0_8px_30px_rgba(17,24,39,0.04)] rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[#111827]">Recent Inquiries & Quotations</h3>
            <button
              type="button"
              onClick={() => onNavigateTab('inquiries')}
              className="text-xs font-semibold text-[#6B7280] hover:text-[#111827] cursor-pointer"
            >
              View All
            </button>
          </div>
          <div className="divide-y divide-[#F0F1F3] text-xs">
            {(data.recentInquiries || []).slice(0, 3).map((inq: any) => (
              <div key={`i-${inq.id}`} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="font-mono font-bold text-[#111827]">{inq.inquiryRef}</p>
                  <p className="text-[#6B7280]">
                    {inq.customerName} {inq.companyName ? `(${inq.companyName})` : ''}
                  </p>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D] font-semibold capitalize">
                  {inq.status}
                </span>
              </div>
            ))}
            {(data.recentQuotations || []).slice(0, 3).map((q: any) => (
              <div key={`q-${q.id}`} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="font-mono font-bold text-[#111827]">{q.quoteRef}</p>
                  <p className="text-[#6B7280]">
                    {q.customerName} · <span className="capitalize">{q.status}</span>
                  </p>
                </div>
                <span className="font-extrabold text-[#111827] tabular-nums">
                  {currency}
                  {q.grandTotal.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Low Stock Watchlist */}
      {data.lowStockItems?.length > 0 && (
        <div className="bg-white border border-[#F0F1F3] shadow-[0_8px_30px_rgba(17,24,39,0.04)] rounded-3xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-bold text-[#111827]">Low Stock Items (≤ 5 units)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-[#6B7280] border-b border-[#F0F1F3]">
                <tr>
                  <th className="py-2 font-semibold">SKU</th>
                  <th className="py-2 font-semibold">Item</th>
                  <th className="py-2 font-semibold">Type</th>
                  <th className="py-2 font-semibold text-right">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F1F3]">
                {data.lowStockItems.map((item: any, idx: number) => (
                  <tr key={idx}>
                    <td className="py-2.5 font-mono">{item.sku}</td>
                    <td className="py-2.5 font-semibold text-[#111827]">{item.name}</td>
                    <td className="py-2.5 text-[#6B7280] capitalize">{item.type}</td>
                    <td className="py-2.5 text-right font-bold text-amber-700 tabular-nums">
                      {item.stockQuantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
