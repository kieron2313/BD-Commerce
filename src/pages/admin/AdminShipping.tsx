import React, { useEffect, useMemo, useState } from 'react';
import {
  Truck,
  MapPin,
  Plus,
  Edit3,
  Trash2,
  Check,
  X,
  Search,
  Calculator,
  Copy,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { usePlatform } from '../../context/PlatformContext';

interface ShippingRuleForm {
  id: number | null;
  zoneId: string;
  name: string;
  description: string;
  price: string;
  freeShippingThreshold: string;
  estimatedDeliveryTime: string;
  countriesText: string;
  regionsText: string;
  postalCodesText: string;
  sortOrder: string;
  isActive: boolean;
}

const EMPTY_FORM: ShippingRuleForm = {
  id: null,
  zoneId: '',
  name: '',
  description: '',
  price: '15.00',
  freeShippingThreshold: '',
  estimatedDeliveryTime: '3-5 business days',
  countriesText: 'United States, Canada',
  regionsText: '',
  postalCodesText: '',
  sortOrder: '1',
  isActive: true,
};

const QUICK_LOCATIONS = [
  'United States',
  'Canada',
  'Cyprus',
  'Germany',
  'France',
  'United Kingdom',
  'Greece',
  'Worldwide',
];

function parseList(text: string): string[] {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const AdminShipping: React.FC = () => {
  const { authFetch, settings } = usePlatform();
  const currency = settings.general?.currencySymbol || '$';

  const [zones, setZones] = useState<any[]>([]);
  const [methods, setMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  const [form, setForm] = useState<ShippingRuleForm>(EMPTY_FORM);
  const [search, setSearch] = useState('');

  // Zone creator state
  const [showZoneForm, setShowZoneForm] = useState(false);
  const [zoneForm, setZoneForm] = useState({
    name: '',
    countriesText: '',
    regionsText: '',
    postalCodesText: '',
  });

  // Live Shipping Rate & Location Simulator
  const [sim, setSim] = useState({
    country: 'United States',
    region: '',
    city: '',
    postalCode: '',
    subtotal: '250',
  });
  const [simResults, setSimResults] = useState<any[] | null>(null);
  const [simBusy, setSimBusy] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await authFetch('/api/admin/shipping');
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d?.error || `Failed to load shipping rules (HTTP ${r.status}).`);
      }
      const d = await r.json();
      setZones(d.zones || []);
      setMethods(d.methods || []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load shipping configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const runSimulator = async (overrideSim = sim) => {
    setSimBusy(true);
    try {
      const r = await fetch('/api/shipping/available', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country: overrideSim.country,
          region: overrideSim.region,
          city: overrideSim.city,
          postalCode: overrideSim.postalCode,
          subtotal: Number(overrideSim.subtotal) || 0,
        }),
      });
      if (r.ok) {
        const d = await r.json();
        setSimResults(d.methods || []);
      }
    } finally {
      setSimBusy(false);
    }
  };

  useEffect(() => {
    if (!loading) {
      void runSimulator();
    }
  }, [loading, methods.length]);

  const zoneMap = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);

  const toggleQuickCountry = (country: string) => {
    if (country === 'Worldwide') {
      setForm((f) => ({ ...f, countriesText: 'Worldwide' }));
      return;
    }
    const existing = parseList(form.countriesText).filter(
      (c) => c.toLowerCase() !== 'worldwide'
    );
    const exists = existing.some((c) => c.toLowerCase() === country.toLowerCase());
    const next = exists
      ? existing.filter((c) => c.toLowerCase() !== country.toLowerCase())
      : [...existing, country];
    setForm((f) => ({ ...f, countriesText: next.join(', ') }));
  };

  const handleZoneSelect = (zoneIdStr: string) => {
    if (!zoneIdStr) {
      setForm((f) => ({ ...f, zoneId: '' }));
      return;
    }
    const z = zones.find((item) => String(item.id) === zoneIdStr);
    if (!z) {
      setForm((f) => ({ ...f, zoneId: zoneIdStr }));
      return;
    }
    setForm((f) => ({
      ...f,
      zoneId: zoneIdStr,
      countriesText: (z.countries || []).join(', ') || f.countriesText,
      regionsText: (z.regions || []).join(', ') || f.regionsText,
      postalCodesText: (z.postalCodes || []).join(', ') || f.postalCodesText,
    }));
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = {
        zoneId: form.zoneId ? Number(form.zoneId) : null,
        name: form.name.trim(),
        description: form.description.trim(),
        price: Math.max(0, Number(form.price) || 0),
        freeShippingThreshold: form.freeShippingThreshold.trim()
          ? Number(form.freeShippingThreshold)
          : null,
        estimatedDeliveryTime: form.estimatedDeliveryTime.trim() || '3-5 business days',
        countries: parseList(form.countriesText),
        regions: parseList(form.regionsText),
        postalCodes: parseList(form.postalCodesText),
        sortOrder: Number(form.sortOrder) || 0,
        isActive: form.isActive,
      };
      const isEdit = Boolean(form.id);
      const r = await authFetch(
        isEdit ? `/api/admin/shipping-methods/${form.id}` : '/api/admin/shipping-methods',
        {
          method: isEdit ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        }
      );
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d?.error || 'Failed to save shipping rule.');
      }
      setToast(
        isEdit
          ? `Updated shipping rule "${payload.name}".`
          : `Created shipping rule "${payload.name}".`
      );
      setForm({
        ...EMPTY_FORM,
        sortOrder: String(methods.length + 2),
      });
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Could not save shipping rule.');
    } finally {
      setBusy(false);
    }
  };

  const startEditMethod = (m: any) => {
    setForm({
      id: m.id,
      zoneId: m.zoneId ? String(m.zoneId) : '',
      name: m.name || '',
      description: m.description || '',
      price: String(m.price ?? 0),
      freeShippingThreshold:
        m.freeShippingThreshold !== null && m.freeShippingThreshold !== undefined
          ? String(m.freeShippingThreshold)
          : '',
      estimatedDeliveryTime: m.estimatedDeliveryTime || '',
      countriesText: (m.countries || []).join(', '),
      regionsText: (m.regions || []).join(', '),
      postalCodesText: (m.postalCodes || []).join(', '),
      sortOrder: String(m.sortOrder ?? 0),
      isActive: m.isActive !== false,
    });
  };

  const duplicateMethod = (m: any) => {
    setForm({
      id: null,
      zoneId: m.zoneId ? String(m.zoneId) : '',
      name: `${m.name} (Copy)`,
      description: m.description || '',
      price: String(m.price ?? 0),
      freeShippingThreshold:
        m.freeShippingThreshold !== null && m.freeShippingThreshold !== undefined
          ? String(m.freeShippingThreshold)
          : '',
      estimatedDeliveryTime: m.estimatedDeliveryTime || '',
      countriesText: (m.countries || []).join(', '),
      regionsText: (m.regions || []).join(', '),
      postalCodesText: (m.postalCodes || []).join(', '),
      sortOrder: String((methods.length || 0) + 1),
      isActive: true,
    });
  };

  const toggleMethodActive = async (m: any) => {
    setBusy(true);
    try {
      const r = await authFetch(`/api/admin/shipping-methods/${m.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...m,
          isActive: !m.isActive,
        }),
      });
      if (r.ok) {
        setToast(`"${m.name}" is now ${!m.isActive ? 'active' : 'paused'}.`);
        await loadData();
      }
    } finally {
      setBusy(false);
    }
  };

  const deleteMethod = async (m: any) => {
    setBusy(true);
    try {
      const r = await authFetch(`/api/admin/shipping-methods/${m.id}`, { method: 'DELETE' });
      if (r.ok) {
        if (form.id === m.id) setForm(EMPTY_FORM);
        setToast(`Deleted shipping rule "${m.name}".`);
        await loadData();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleCreateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await authFetch('/api/admin/shipping-zones', {
        method: 'POST',
        body: JSON.stringify({
          name: zoneForm.name.trim(),
          countries: parseList(zoneForm.countriesText),
          regions: parseList(zoneForm.regionsText),
          postalCodes: parseList(zoneForm.postalCodesText),
        }),
      });
      if (r.ok) {
        setZoneForm({ name: '', countriesText: '', regionsText: '', postalCodesText: '' });
        setShowZoneForm(false);
        setToast(`Added geographic zone "${zoneForm.name.trim()}".`);
        await loadData();
      }
    } finally {
      setBusy(false);
    }
  };

  const deleteZone = async (id: number, name: string) => {
    setBusy(true);
    try {
      const r = await authFetch(`/api/admin/shipping-zones/${id}`, { method: 'DELETE' });
      if (r.ok) {
        setToast(`Removed geographic zone "${name}".`);
        await loadData();
      }
    } finally {
      setBusy(false);
    }
  };

  const filteredMethods = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return methods;
    return methods.filter((m) => {
      const linkedZone = m.zoneId ? zoneMap.get(m.zoneId) : null;
      const locStr = [
        ...(m.countries || []),
        ...(m.regions || []),
        ...(m.postalCodes || []),
        linkedZone?.name || '',
      ]
        .join(' ')
        .toLowerCase();
      return (
        (m.name || '').toLowerCase().includes(q) ||
        (m.description || '').toLowerCase().includes(q) ||
        locStr.includes(q)
      );
    });
  }, [methods, search, zoneMap]);

  const stats = useMemo(() => {
    const active = methods.filter((m) => m.isActive);
    const countrySet = new Set<string>();
    for (const m of active) {
      const cList = m.countries?.length ? m.countries : zoneMap.get(m.zoneId)?.countries || [];
      for (const c of cList) countrySet.add(c);
    }
    const prices = active.map((m) => Number(m.price) || 0);
    const minRate = prices.length ? Math.min(...prices) : 0;
    const maxRate = prices.length ? Math.max(...prices) : 0;
    const freeCount = active.filter((m) => m.freeShippingThreshold != null || Number(m.price) === 0).length;
    return {
      activeCount: active.length,
      locationCount: countrySet.size,
      minRate,
      maxRate,
      freeCount,
    };
  }, [methods, zoneMap]);

  const formatLocationSummary = (m: any) => {
    const linkedZone = m.zoneId ? zoneMap.get(m.zoneId) : null;
    const countries = m.countries?.length ? m.countries : linkedZone?.countries || [];
    const regions = m.regions?.length ? m.regions : linkedZone?.regions || [];
    const postalCodes = m.postalCodes?.length ? m.postalCodes : linkedZone?.postalCodes || [];

    const parts: string[] = [];
    parts.push(countries.length > 0 ? countries.join(', ') : 'Worldwide (All Countries)');
    if (regions.length > 0) parts.push(`Cities/Regions: ${regions.join(', ')}`);
    if (postalCodes.length > 0) parts.push(`Postal: ${postalCodes.join(', ')}`);
    return { primary: parts[0], secondary: parts.slice(1).join(' · '), zoneName: linkedZone?.name };
  };

  return (
    <div className="space-y-5 text-xs">
      {/* Status Toast & Error Banner */}
      {toast && (
        <div className="bg-[#171717] text-white px-4 py-3 rounded-2xl shadow-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-medium">
            <Check className="w-4 h-4 text-[#CCF3C6] shrink-0" />
            <span>{toast}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast('')}
            className="p-1 rounded-lg hover:bg-white/10 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3.5 rounded-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-red-200 font-semibold cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#F0F1F3] rounded-3xl p-5">
          <p className="text-[#6B7280] font-medium">Active Shipping Rules</p>
          <p className="text-2xl font-extrabold text-[#111827] tabular-nums mt-1">
            {stats.activeCount} <span className="text-xs font-medium text-[#6B7280]">of {methods.length}</span>
          </p>
        </div>
        <div className="bg-white border border-[#F0F1F3] rounded-3xl p-5">
          <p className="text-[#6B7280] font-medium">Covered Markets</p>
          <p className="text-2xl font-extrabold text-[#111827] tabular-nums mt-1">
            {stats.locationCount} <span className="text-xs font-medium text-[#6B7280]">country codes</span>
          </p>
        </div>
        <div className="bg-white border border-[#F0F1F3] rounded-3xl p-5">
          <p className="text-[#6B7280] font-medium">Rate Spectrum</p>
          <p className="text-2xl font-extrabold text-[#111827] tabular-nums mt-1">
            {currency}
            {stats.minRate.toFixed(0)} – {currency}
            {stats.maxRate.toFixed(0)}
          </p>
        </div>
        <div className="bg-white border border-[#F0F1F3] rounded-3xl p-5">
          <p className="text-[#6B7280] font-medium">Free-Shipping Options</p>
          <p className="text-2xl font-extrabold text-[#111827] tabular-nums mt-1">{stats.freeCount}</p>
        </div>
      </div>

      {/* Main Combined Workspace: Rule Builder (Left) + Matrix & Calculator (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left: Combined Method + Location + Cost Builder */}
        <form
          onSubmit={handleSaveRule}
          className="xl:col-span-5 bg-white border border-[#F0F1F3] shadow-[0_8px_30px_rgba(17,24,39,0.04)] rounded-3xl p-6 space-y-5"
        >
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#F0F1F3]">
            <div>
              <h3 className="text-sm font-bold text-[#111827]">
                {form.id ? `Edit Shipping Rule: ${form.name}` : 'Combine Method, Location & Cost'}
              </h3>
              <p className="text-[#6B7280] mt-0.5">
                Define the courier service, target locations, and shipping fee in one rule.
              </p>
            </div>
            {form.id && (
              <button
                type="button"
                onClick={() => setForm(EMPTY_FORM)}
                className="px-3 py-1.5 rounded-xl bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] font-semibold cursor-pointer whitespace-nowrap shrink-0"
              >
                Cancel Edit
              </button>
            )}
          </div>

          {/* 1. Method Details */}
          <div className="space-y-3">
            <p className="font-bold text-[#111827] flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-[#8B5D36]" />
              <span>01. Shipping Method</span>
            </p>
            <div>
              <label className="block font-semibold text-[#111827] mb-1">Method Name *</label>
              <input
                required
                placeholder="e.g. Nicosia White-Glove Delivery"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl focus:outline-none focus:border-[#111827]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-[#111827] mb-1">Estimated Delivery</label>
                <input
                  placeholder="e.g. 2-4 business days"
                  value={form.estimatedDeliveryTime}
                  onChange={(e) => setForm({ ...form, estimatedDeliveryTime: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#111827] mb-1">Display Order</label>
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl tabular-nums"
                />
              </div>
            </div>
            <div>
              <label className="block font-semibold text-[#111827] mb-1">Service Description</label>
              <input
                placeholder="Tracked freight with room-of-choice placement"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl"
              />
            </div>
          </div>

          {/* 2. Target Locations */}
          <div className="space-y-3 pt-4 border-t border-[#F0F1F3]">
            <p className="font-bold text-[#111827] flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#8B5D36]" />
              <span>02. Target Location(s)</span>
            </p>

            {zones.length > 0 && (
              <div>
                <label className="block font-semibold text-[#111827] mb-1">
                  Geographic Zone Preset (Optional)
                </label>
                <select
                  value={form.zoneId}
                  onChange={(e) => handleZoneSelect(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl"
                >
                  <option value="">Custom Location Rule (No Zone Link)</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} ({(z.countries || []).join(', ') || 'All'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-semibold text-[#111827]">Quick-Add Countries</label>
                <span className="text-[11px] text-[#6B7280]">Click to toggle</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {QUICK_LOCATIONS.map((country) => {
                  const selected = parseList(form.countriesText).some(
                    (c) => c.toLowerCase() === country.toLowerCase()
                  );
                  return (
                    <button
                      key={country}
                      type="button"
                      onClick={() => toggleQuickCountry(country)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        selected
                          ? 'bg-[#171717] text-white border-[#171717]'
                          : 'bg-[#F7F7F8] text-[#111827] border-[#E5E7EB] hover:border-[#8B5D36]'
                      }`}
                    >
                      {country}
                    </button>
                  );
                })}
              </div>
              <input
                placeholder="Countries (comma separated, or Worldwide / leave blank for All)"
                value={form.countriesText}
                onChange={(e) => setForm({ ...form, countriesText: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-[#111827] mb-1">
                  Cities / States / Regions
                </label>
                <input
                  placeholder="e.g. Nicosia, Limassol, CA"
                  value={form.regionsText}
                  onChange={(e) => setForm({ ...form, regionsText: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#111827] mb-1">
                  Postal / ZIP Prefixes
                </label>
                <input
                  placeholder="e.g. 941, 10, 30"
                  value={form.postalCodesText}
                  onChange={(e) => setForm({ ...form, postalCodesText: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl font-mono"
                />
              </div>
            </div>
          </div>

          {/* 3. Cost & Free Threshold */}
          <div className="space-y-3 pt-4 border-t border-[#F0F1F3]">
            <p className="font-bold text-[#111827]">03. Shipping Cost</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-[#111827] mb-1">
                  Base Rate ({currency}) *
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl tabular-nums font-semibold"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#111827] mb-1">
                  Free Shipping Over ({currency})
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Optional"
                  value={form.freeShippingThreshold}
                  onChange={(e) => setForm({ ...form, freeShippingThreshold: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl tabular-nums"
                />
              </div>
            </div>

            <label className="inline-flex items-center gap-2 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              <span className="font-medium text-[#111827]">
                Rule Active (visible to matching checkout &amp; cart locations)
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 px-4 ka-oak-btn font-semibold rounded-2xl disabled:opacity-60 cursor-pointer whitespace-nowrap"
          >
            {form.id ? 'Save Shipping Rule' : 'Create Combined Shipping Rule'}
          </button>
        </form>

        {/* Right: Combined Shipping Matrix + Live Calculator + Zones */}
        <div className="xl:col-span-7 space-y-5">
          {/* Interactive Location + Cost Rate Simulator */}
          <div className="bg-white border border-[#F0F1F3] shadow-[0_8px_30px_rgba(17,24,39,0.04)] rounded-3xl p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-[#8B5D36]" />
                <h3 className="text-sm font-bold text-[#111827]">
                  Live Location &amp; Cost Preview
                </h3>
              </div>
              <button
                type="button"
                disabled={simBusy}
                onClick={() => void runSimulator()}
                className="px-3 py-1.5 rounded-xl bg-[#171717] hover:bg-[#0A0A0A] text-white font-semibold cursor-pointer whitespace-nowrap shrink-0"
              >
                {simBusy ? 'Checking...' : 'Calculate Matching Rates'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <input
                placeholder="Country (e.g. Cyprus)"
                value={sim.country}
                onChange={(e) => setSim({ ...sim, country: e.target.value })}
                className="px-3 py-2 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl"
              />
              <input
                placeholder="City (e.g. Nicosia)"
                value={sim.city}
                onChange={(e) => setSim({ ...sim, city: e.target.value })}
                className="px-3 py-2 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl"
              />
              <input
                placeholder="State / Region"
                value={sim.region}
                onChange={(e) => setSim({ ...sim, region: e.target.value })}
                className="px-3 py-2 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl"
              />
              <input
                placeholder="Postal / ZIP"
                value={sim.postalCode}
                onChange={(e) => setSim({ ...sim, postalCode: e.target.value })}
                className="px-3 py-2 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl font-mono"
              />
              <input
                type="number"
                min="0"
                step="1"
                placeholder="Subtotal ($)"
                value={sim.subtotal}
                onChange={(e) => setSim({ ...sim, subtotal: e.target.value })}
                className="px-3 py-2 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl tabular-nums"
              />
            </div>

            {simResults !== null && (
              <div className="pt-2 border-t border-[#F0F1F3]">
                {simResults.length === 0 ? (
                  <p className="text-[#6B7280] py-1">
                    No active shipping rules matched <strong>{sim.country || 'any country'}</strong>
                    {sim.city ? ` · ${sim.city}` : ''}. Add a rule or mark a rule Worldwide.
                  </p>
                ) : (
                  <div className="divide-y divide-[#F0F1F3]">
                    {simResults.map((m) => (
                      <div key={m.id} className="py-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-[#111827] truncate">{m.name}</p>
                          <p className="text-[11px] text-[#6B7280] truncate">
                            {m.estimatedDeliveryTime}
                            {m.zoneName ? ` · Zone: ${m.zoneName}` : ''}
                            {m.qualifiesFree ? ' · Qualifies for free shipping threshold' : ''}
                          </p>
                        </div>
                        <span className="font-extrabold text-[#111827] tabular-nums shrink-0">
                          {m.effectivePrice === 0
                            ? 'Free'
                            : `${currency}${Number(m.effectivePrice).toFixed(2)}`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Combined Rules Table */}
          <div className="bg-white border border-[#F0F1F3] shadow-[0_8px_30px_rgba(17,24,39,0.04)] rounded-3xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#F0F1F3] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[#111827]">
                  Shipping Methods, Locations &amp; Rates ({filteredMethods.length})
                </h3>
                <p className="text-[#6B7280] mt-0.5">
                  Click Edit on any row to adjust its method, location coverage, or cost.
                </p>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter method or location..."
                  className="pl-8 pr-3 py-2 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl w-full sm:w-56"
                />
              </div>
            </div>

            {loading ? (
              <div className="p-5 space-y-2.5">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-12 rounded-2xl bg-[#F3F4F6] animate-pulse" />
                ))}
              </div>
            ) : filteredMethods.length === 0 ? (
              <div className="p-10 text-center text-[#6B7280]">
                No shipping rules found. Use the builder on the left to combine a method, location, and cost.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#F7F7F8] border-b border-[#F0F1F3] text-[#6B7280]">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Method</th>
                      <th className="py-3 px-4 font-semibold">Location Coverage</th>
                      <th className="py-3 px-4 font-semibold text-right">Cost</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F1F3]">
                    {filteredMethods.map((m) => {
                      const loc = formatLocationSummary(m);
                      const isEditing = form.id === m.id;
                      return (
                        <tr
                          key={m.id}
                          className={isEditing ? 'bg-[#FAF6F0]' : 'hover:bg-[#FAFAFB]'}
                        >
                          <td className="py-3.5 px-4 align-top">
                            <p className="font-bold text-[#111827]">{m.name}</p>
                            <p className="text-[11px] text-[#6B7280] mt-0.5">
                              {m.estimatedDeliveryTime}
                              {loc.zoneName ? ` · ${loc.zoneName}` : ''}
                            </p>
                          </td>
                          <td className="py-3.5 px-4 align-top text-[#111827]">
                            <p className="font-medium">{loc.primary}</p>
                            {loc.secondary && (
                              <p className="text-[11px] text-[#6B7280] mt-0.5">{loc.secondary}</p>
                            )}
                          </td>
                          <td className="py-3.5 px-4 align-top text-right tabular-nums">
                            <p className="font-extrabold text-[#111827]">
                              {Number(m.price) === 0 ? 'Free' : `${currency}${Number(m.price).toFixed(2)}`}
                            </p>
                            {m.freeShippingThreshold ? (
                              <p className="text-[11px] text-[#15803D] font-semibold mt-0.5">
                                Free ≥ {currency}
                                {Number(m.freeShippingThreshold).toFixed(0)}
                              </p>
                            ) : (
                              <p className="text-[11px] text-[#9CA3AF] mt-0.5">Flat rate</p>
                            )}
                          </td>
                          <td className="py-3.5 px-4 align-top">
                            <button
                              type="button"
                              onClick={() => toggleMethodActive(m)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer whitespace-nowrap ${
                                m.isActive
                                  ? 'bg-[#DCFCE7] text-[#15803D] hover:bg-[#CCF3C6]'
                                  : 'bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]'
                              }`}
                            >
                              {m.isActive ? 'Active' : 'Paused'}
                            </button>
                          </td>
                          <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => startEditMethod(m)}
                                title="Edit shipping rule"
                                className="p-1.5 rounded-lg bg-[#F3F4F6] hover:bg-[#171717] hover:text-white text-[#111827] cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => duplicateMethod(m)}
                                title="Duplicate rule for another location"
                                className="p-1.5 rounded-lg bg-[#F3F4F6] hover:bg-[#171717] hover:text-white text-[#111827] cursor-pointer"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteMethod(m)}
                                title="Delete rule"
                                className="p-1.5 rounded-lg bg-red-50 hover:bg-red-600 hover:text-white text-red-700 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Geographic Zones Manager */}
          <div className="bg-white border border-[#F0F1F3] shadow-[0_8px_30px_rgba(17,24,39,0.04)] rounded-3xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-[#111827]">
                  Reusable Location Zones ({zones.length})
                </h3>
                <p className="text-[#6B7280]">
                  Group countries, cities, or postal regions once and reuse across shipping methods.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowZoneForm((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] font-semibold cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showZoneForm ? 'Close' : 'Add Zone'}</span>
              </button>
            </div>

            {showZoneForm && (
              <form
                onSubmit={handleCreateZone}
                className="p-4 bg-[#F7F7F8] border border-[#E5E7EB] rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-2.5"
              >
                <input
                  required
                  placeholder="Zone Name (e.g. Cyprus Metro)"
                  value={zoneForm.name}
                  onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
                  className="px-3 py-2 bg-white border border-[#E5E7EB] rounded-xl"
                />
                <input
                  placeholder="Countries (e.g. Cyprus, Greece)"
                  value={zoneForm.countriesText}
                  onChange={(e) => setZoneForm({ ...zoneForm, countriesText: e.target.value })}
                  className="px-3 py-2 bg-white border border-[#E5E7EB] rounded-xl"
                />
                <input
                  placeholder="Cities / Regions (e.g. Nicosia, Limassol)"
                  value={zoneForm.regionsText}
                  onChange={(e) => setZoneForm({ ...zoneForm, regionsText: e.target.value })}
                  className="px-3 py-2 bg-white border border-[#E5E7EB] rounded-xl"
                />
                <div className="flex gap-2">
                  <input
                    placeholder="Postal Prefixes (optional)"
                    value={zoneForm.postalCodesText}
                    onChange={(e) => setZoneForm({ ...zoneForm, postalCodesText: e.target.value })}
                    className="flex-1 px-3 py-2 bg-white border border-[#E5E7EB] rounded-xl font-mono"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="px-4 py-2 bg-[#171717] text-white font-semibold rounded-xl cursor-pointer whitespace-nowrap"
                  >
                    Save Zone
                  </button>
                </div>
              </form>
            )}

            <div className="divide-y divide-[#F0F1F3]">
              {zones.map((z) => (
                <div key={z.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#111827]">{z.name}</p>
                    <p className="text-[11px] text-[#6B7280] truncate">
                      {(z.countries || []).join(', ') || 'All Countries'}
                      {z.regions?.length ? ` · Regions: ${z.regions.join(', ')}` : ''}
                      {z.postalCodes?.length ? ` · Postal: ${z.postalCodes.join(', ')}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteZone(z.id, z.name)}
                    className="text-red-600 hover:underline font-semibold cursor-pointer shrink-0"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
