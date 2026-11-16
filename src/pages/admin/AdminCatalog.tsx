import React, { useEffect, useState } from 'react';
import { Plus, Copy, Trash2, Edit3, Sparkles, X } from 'lucide-react';
import { usePlatform } from '../../context/PlatformContext';
import { SafeImage } from '../../components/SafeImage';

export const AdminCatalog: React.FC<{
  section: 'products' | 'categories' | 'brands' | 'attributes' | 'variations' | 'inventory';
}> = ({ section }) => {
  const { authFetch, refreshBootstrap, settings } = usePlatform();
  const currency = settings.general?.currencySymbol || '$';

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [attributes, setAttributes] = useState<any[]>([]);
  const [variations, setVariations] = useState<any[]>([]);
  const [inventoryLogs, setInventoryLogs] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState('');

  // Product Editor Modal
  const [editingProd, setEditingProd] = useState<any>(null);
  const [prodTab, setProdTab] = useState<'general' | 'commercial' | 'visibility' | 'variations' | 'seo'>('general');

  // Variation Bulk Edit Selection
  const [selectedVarIds, setSelectedVarIds] = useState<number[]>([]);
  const [bulkPrice, setBulkPrice] = useState('');
  const [bulkStock, setBulkStock] = useState('');

  // Category / Brand / Attribute forms
  const [catForm, setCatForm] = useState<any>({
    id: null,
    name: '',
    slug: '',
    parentId: '',
    description: '',
    imageUrl: '',
    priceVisibility: 'inherit',
    stockVisibility: 'inherit',
    inquiryEnabled: 'inherit',
    displayLayout: 'grid',
    sortOrder: 0,
  });
  const [brandForm, setBrandForm] = useState<any>({
    id: null,
    name: '',
    slug: '',
    description: '',
    seoTitle: '',
    seoDescription: '',
  });
  const [newAttr, setNewAttr] = useState({ name: '', displayType: 'button', usedForVariations: true });
  const [newAttrVal, setNewAttrVal] = useState<{ attributeId: number; value: string; colorHex: string }>({
    attributeId: 0,
    value: '',
    colorHex: '#18181B',
  });

  const loadAll = async () => {
    const [pRes, cRes, bRes, aRes, vRes, invRes] = await Promise.all([
      authFetch('/api/admin/products').then((r) => (r.ok ? r.json() : { products: [] })),
      authFetch('/api/admin/categories').then((r) => (r.ok ? r.json() : { categories: [] })),
      authFetch('/api/admin/brands').then((r) => (r.ok ? r.json() : { brands: [] })),
      authFetch('/api/admin/attributes').then((r) => (r.ok ? r.json() : { attributes: [] })),
      authFetch('/api/admin/variations').then((r) => (r.ok ? r.json() : { variations: [] })),
      authFetch('/api/admin/inventory').then((r) => (r.ok ? r.json() : { logs: [] })),
    ]);
    setProducts(pRes.products || []);
    setCategories(cRes.categories || []);
    setBrands(bRes.brands || []);
    setAttributes(aRes.attributes || []);
    setVariations(vRes.variations || []);
    setInventoryLogs(invRes.logs || []);
  };

  useEffect(() => {
    loadAll();
  }, [section]);

  const openNewProduct = () => {
    setProdTab('general');
    setEditingProd({
      id: null,
      name: '',
      sku: '',
      slug: '',
      shortDescription: '',
      fullDescription: '',
      mainImageUrl: '/src/assets/images/product_monolith_lamp_1794681042729.jpg',
      galleryImages: [],
      brandId: '',
      status: 'published',
      isFeatured: false,
      isNew: true,
      productType: 'simple',
      regularPrice: 100,
      salePrice: '',
      costPrice: 40,
      stockQuantity: 10,
      stockStatus: 'in_stock',
      allowBackorder: false,
      minOrderQty: 1,
      weight: 1,
      dimensions: { length: 20, width: 20, height: 20, unit: 'cm' },
      specifications: [],
      categoryIds: categories[0] ? [categories[0].id] : [],
      assignedAttributes: [],
      variations: [],
      priceVisibility: 'inherit',
      salePriceVisibility: 'inherit',
      stockVisibility: 'inherit',
      skuVisibility: 'inherit',
      inquiryEnabled: 'inherit',
      quantityEnabled: 'inherit',
      quoteEnabled: 'inherit',
      seoTitle: '',
      metaDescription: '',
      canonicalUrl: '',
    });
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    const isNew = !editingProd.id;
    const url = isNew ? '/api/admin/products' : `/api/admin/products/${editingProd.id}`;
    const res = await authFetch(url, {
      method: isNew ? 'POST' : 'PUT',
      body: JSON.stringify(editingProd),
    });
    const d = await res.json();
    if (!res.ok) {
      setMsg(d.error || 'Error saving product.');
      return;
    }
    setMsg('Product saved.');
    await loadAll();
    await refreshBootstrap();
    if (isNew && d.product) {
      setEditingProd({ ...editingProd, id: d.product.id, slug: d.product.slug, sku: d.product.sku });
    } else {
      setEditingProd(null);
    }
  };

  const generateCombinations = async () => {
    if (!editingProd?.id) {
      setMsg('Save the product first before generating variation combinations.');
      return;
    }
    // Save assigned attributes first
    await authFetch(`/api/admin/products/${editingProd.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        productType: 'variable',
        assignedAttributes: editingProd.assignedAttributes,
      }),
    });
    const res = await authFetch(`/api/admin/products/${editingProd.id}/variations/generate`, {
      method: 'POST',
      body: JSON.stringify({ assignedAttributes: editingProd.assignedAttributes }),
    });
    const d = await res.json();
    if (res.ok) {
      setMsg(`Generated ${d.createdCount} new variation combination(s).`);
      setEditingProd((prev: any) => ({ ...prev, productType: 'variable', variations: d.variations }));
      await loadAll();
    } else {
      setMsg(d.error || 'Failed to generate combinations.');
    }
  };

  const saveVariationInline = async (v: any) => {
    const res = await authFetch(`/api/admin/variations/${v.id}`, {
      method: 'PUT',
      body: JSON.stringify(v),
    });
    if (res.ok) {
      setMsg(`Saved variation ${v.sku}`);
      await loadAll();
    }
  };

  const handleBulkEditVariations = async () => {
    if (selectedVarIds.length === 0) return;
    const res = await authFetch('/api/admin/variations/bulk-edit', {
      method: 'POST',
      body: JSON.stringify({
        variationIds: selectedVarIds,
        regularPrice: bulkPrice !== '' ? Number(bulkPrice) : undefined,
        stockQuantity: bulkStock !== '' ? Number(bulkStock) : undefined,
      }),
    });
    if (res.ok) {
      setMsg(`Bulk updated ${selectedVarIds.length} variations.`);
      setSelectedVarIds([]);
      setBulkPrice('');
      setBulkStock('');
      await loadAll();
    }
  };

  const adjustInventory = async (productId: number, variationId: number | null, sku: string, delta: number) => {
    await authFetch('/api/admin/inventory/adjust', {
      method: 'POST',
      body: JSON.stringify({ productId, variationId, sku, delta, reason: 'Admin quick stock adjustment' }),
    });
    await loadAll();
  };

  return (
    <div className="space-y-6">
      {msg && (
        <div className="bg-[#171717] text-white text-xs px-4 py-3 rounded-2xl shadow-sm flex items-center justify-between">
          <span className="font-medium">{msg}</span>
          <button type="button" onClick={() => setMsg('')} className="p-1 rounded-lg hover:bg-white/10 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ==================== PRODUCTS ==================== */}
      {section === 'products' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <input
              type="text"
              placeholder="Search products by name or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-4 py-2.5 text-xs bg-white border border-[#E5E7EB] rounded-2xl w-full sm:w-80 shadow-xs"
            />
            <button
              type="button"
              onClick={openNewProduct}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold bg-[#171717] text-white rounded-xl hover:bg-[#0A0A0A] shadow-xs transition-all whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Product</span>
            </button>
          </div>

          <div className="bg-white border border-[#F0F1F3] shadow-[0_8px_30px_rgba(17,24,39,0.04)] rounded-3xl overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-3 px-4 font-semibold">Product</th>
                  <th className="py-3 px-4 font-semibold">SKU</th>
                  <th className="py-3 px-4 font-semibold">Type</th>
                  <th className="py-3 px-4 font-semibold text-right">Price</th>
                  <th className="py-3 px-4 font-semibold text-right">Stock</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products
                  .filter((p) => {
                    const q = search.toLowerCase();
                    return !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
                  })
                  .map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded overflow-hidden bg-slate-100 shrink-0">
                            <SafeImage src={p.mainImageUrl} alt={p.name} className="w-full h-full object-cover" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{p.name}</p>
                            <p className="text-[13px] text-slate-500">/{p.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono">{p.sku}</td>
                      <td className="py-3 px-4 capitalize">
                        {p.productType} {p.variations?.length ? `(${p.variations.length})` : ''}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        {currency}
                        {p.regularPrice.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        {p.productType === 'variable'
                          ? p.variations?.reduce((a: number, v: any) => a + v.stockQuantity, 0)
                          : p.stockQuantity}
                      </td>
                      <td className="py-3 px-4 capitalize">{p.status}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setProdTab('general');
                              setEditingProd(p);
                            }}
                            title="Edit"
                            className="p-1.5 text-slate-600 hover:text-slate-900"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await authFetch(`/api/admin/products/${p.id}/duplicate`, { method: 'POST' });
                              await loadAll();
                            }}
                            title="Duplicate"
                            className="p-1.5 text-slate-600 hover:text-slate-900"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await authFetch(`/api/admin/products/${p.id}`, { method: 'DELETE' });
                              await loadAll();
                              await refreshBootstrap();
                            }}
                            title="Delete"
                            className="p-1.5 text-slate-500 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Product Editor Modal */}
          {editingProd && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl border border-[#F0F1F3] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="px-6 py-4 border-b border-[#F0F1F3] flex items-center justify-between">
                  <h3 className="text-base font-bold text-[#111827]">
                    {editingProd.id ? `Edit: ${editingProd.name}` : 'Create New Product'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditingProd(null)}
                    className="p-1.5 rounded-xl hover:bg-[#F3F4F6] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Modal Tabs */}
                <div className="px-6 py-3 border-b border-[#F0F1F3] bg-[#FAFAFB] overflow-x-auto">
                  <div className="inline-flex items-center gap-1.5 p-1 bg-[#F3F4F6] border border-[#E5E7EB] rounded-2xl text-xs font-semibold">
                    {(['general', 'commercial', 'visibility', 'variations', 'seo'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setProdTab(t)}
                        className={`px-3.5 py-2 rounded-xl capitalize whitespace-nowrap transition-all cursor-pointer ${
                          prodTab === t
                            ? 'bg-[#171717] text-white shadow-xs'
                            : 'text-[#6B7280] hover:text-[#111827] hover:bg-white'
                        }`}
                      >
                        {t === 'variations' ? 'Attributes & Variations' : t}
                      </button>
                    ))}
                  </div>
                </div>

                <form onSubmit={saveProduct} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
                  {prodTab === 'general' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block font-medium mb-1">Product Name *</label>
                          <input
                            required
                            value={editingProd.name}
                            onChange={(e) => setEditingProd({ ...editingProd, name: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block font-medium mb-1">SKU *</label>
                          <input
                            required
                            value={editingProd.sku}
                            onChange={(e) => setEditingProd({ ...editingProd, sku: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                          />
                        </div>
                        <div>
                          <label className="block font-medium mb-1">Product Type</label>
                          <select
                            value={editingProd.productType}
                            onChange={(e) => setEditingProd({ ...editingProd, productType: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
                          >
                            <option value="simple">Simple Product</option>
                            <option value="variable">Variable Product</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-medium mb-1">Brand</label>
                          <select
                            value={editingProd.brandId || ''}
                            onChange={(e) => setEditingProd({ ...editingProd, brandId: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
                          >
                            <option value="">No Brand</option>
                            {brands.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block font-medium mb-1">Status</label>
                          <select
                            value={editingProd.status}
                            onChange={(e) => setEditingProd({ ...editingProd, status: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
                          >
                            <option value="published">Published</option>
                            <option value="draft">Draft</option>
                            <option value="archived">Archived</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-medium mb-1">Main Image URL</label>
                          <input
                            value={editingProd.mainImageUrl}
                            onChange={(e) => setEditingProd({ ...editingProd, mainImageUrl: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block font-medium mb-1">Categories (Multi-select)</label>
                        <div className="flex flex-wrap gap-2">
                          {categories.map((c) => {
                            const checked = (editingProd.categoryIds || []).includes(c.id);
                            return (
                              <label
                                key={c.id}
                                className={`px-2.5 py-1 border rounded cursor-pointer ${
                                  checked ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-300'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  className="hidden"
                                  checked={checked}
                                  onChange={() => {
                                    const next = checked
                                      ? editingProd.categoryIds.filter((id: number) => id !== c.id)
                                      : [...(editingProd.categoryIds || []), c.id];
                                    setEditingProd({ ...editingProd, categoryIds: next });
                                  }}
                                />
                                {c.name}
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="block font-medium mb-1">Short Description</label>
                        <textarea
                          rows={2}
                          value={editingProd.shortDescription}
                          onChange={(e) => setEditingProd({ ...editingProd, shortDescription: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-md"
                        />
                      </div>

                      <div>
                        <label className="block font-medium mb-1">Full Description</label>
                        <textarea
                          rows={4}
                          value={editingProd.fullDescription}
                          onChange={(e) => setEditingProd({ ...editingProd, fullDescription: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-md"
                        />
                      </div>

                      <div className="flex gap-6">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={Boolean(editingProd.isFeatured)}
                            onChange={(e) => setEditingProd({ ...editingProd, isFeatured: e.target.checked })}
                          />
                          <span>Featured Product</span>
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={Boolean(editingProd.isNew)}
                            onChange={(e) => setEditingProd({ ...editingProd, isNew: e.target.checked })}
                          />
                          <span>New Arrival Badge</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {prodTab === 'commercial' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block font-medium mb-1">Regular Price ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editingProd.regularPrice}
                          onChange={(e) => setEditingProd({ ...editingProd, regularPrice: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-md tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block font-medium mb-1">Sale Price ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editingProd.salePrice ?? ''}
                          onChange={(e) =>
                            setEditingProd({
                              ...editingProd,
                              salePrice: e.target.value === '' ? null : Number(e.target.value),
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-md tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block font-medium mb-1">Cost Price (Admin Only)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editingProd.costPrice ?? 0}
                          onChange={(e) => setEditingProd({ ...editingProd, costPrice: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-md tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block font-medium mb-1">Stock Quantity</label>
                        <input
                          type="number"
                          value={editingProd.stockQuantity}
                          onChange={(e) => setEditingProd({ ...editingProd, stockQuantity: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-md tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block font-medium mb-1">Stock Status</label>
                        <select
                          value={editingProd.stockStatus}
                          onChange={(e) => setEditingProd({ ...editingProd, stockStatus: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
                        >
                          <option value="in_stock">In Stock</option>
                          <option value="out_of_stock">Out of Stock</option>
                          <option value="on_backorder">On Backorder</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-medium mb-1">Weight (kg)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={editingProd.weight ?? 0}
                          onChange={(e) => setEditingProd({ ...editingProd, weight: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-md tabular-nums"
                        />
                      </div>
                    </div>
                  )}

                  {prodTab === 'visibility' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        ['priceVisibility', 'Price Visibility'],
                        ['salePriceVisibility', 'Sale Price Visibility'],
                        ['stockVisibility', 'Stock Visibility'],
                        ['skuVisibility', 'SKU Visibility'],
                        ['inquiryEnabled', 'Product Inquiries'],
                        ['quantityEnabled', 'Quantity Selector'],
                        ['quoteEnabled', 'Quotation Requests'],
                      ].map(([field, label]) => (
                        <div key={field}>
                          <label className="block font-medium mb-1">{label}</label>
                          <select
                            value={editingProd[field] || 'inherit'}
                            onChange={(e) => setEditingProd({ ...editingProd, [field]: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
                          >
                            <option value="inherit">Inherit (Category / Global)</option>
                            {field.includes('Enabled') ? (
                              <>
                                <option value="enable">Force Enable</option>
                                <option value="disable">Force Disable</option>
                              </>
                            ) : (
                              <>
                                <option value="show">Force Show</option>
                                <option value="hide">Force Hide</option>
                              </>
                            )}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}

                  {prodTab === 'variations' && (
                    <div className="space-y-5">
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-md space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-slate-900">
                            1. Assign Variation Attributes
                          </h4>
                          <button
                            type="button"
                            onClick={generateCombinations}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-md hover:bg-slate-800"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Generate All Combinations</span>
                          </button>
                        </div>
                        <div className="space-y-3">
                          {attributes.map((attr) => {
                            const assigned = (editingProd.assignedAttributes || []).find(
                              (a: any) => a.attributeId === attr.id
                            );
                            const selectedIds: number[] = assigned?.valueIds || [];
                            return (
                              <div key={attr.id} className="bg-white p-3 border border-slate-200 rounded">
                                <p className="font-medium mb-2">{attr.name}</p>
                                <div className="flex flex-wrap gap-2">
                                  {attr.values.map((val: any) => {
                                    const active = selectedIds.includes(val.id);
                                    return (
                                      <button
                                        key={val.id}
                                        type="button"
                                        onClick={() => {
                                          const current = editingProd.assignedAttributes || [];
                                          const nextIds = active
                                            ? selectedIds.filter((id) => id !== val.id)
                                            : [...selectedIds, val.id];
                                          const filtered = current.filter(
                                            (a: any) => a.attributeId !== attr.id
                                          );
                                          if (nextIds.length > 0) {
                                            filtered.push({
                                              attributeId: attr.id,
                                              valueIds: nextIds,
                                              usedForVariations: true,
                                            });
                                          }
                                          setEditingProd({ ...editingProd, assignedAttributes: filtered });
                                        }}
                                        className={`px-2.5 py-1 rounded border text-xs ${
                                          active
                                            ? 'bg-slate-900 text-white border-slate-900'
                                            : 'bg-white border-slate-300 text-slate-700'
                                        }`}
                                      >
                                        {val.value}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold text-slate-900 mb-2">
                          2. Individual Variation Combinations ({editingProd.variations?.length || 0})
                        </h4>
                        <div className="space-y-2">
                          {(editingProd.variations || []).map((v: any, idx: number) => (
                            <div
                              key={v.id}
                              className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-3 border border-slate-200 rounded"
                            >
                              <div className="sm:col-span-3 font-medium">
                                {(v.attributes || []).map((a: any) => a.value).join(' · ') || 'Variation'}
                              </div>
                              <input
                                value={v.sku}
                                onChange={(e) => {
                                  const next = [...editingProd.variations];
                                  next[idx] = { ...v, sku: e.target.value };
                                  setEditingProd({ ...editingProd, variations: next });
                                }}
                                placeholder="SKU"
                                className="sm:col-span-3 px-2 py-1 border border-slate-300 rounded font-mono"
                              />
                              <input
                                type="number"
                                value={v.regularPrice}
                                onChange={(e) => {
                                  const next = [...editingProd.variations];
                                  next[idx] = { ...v, regularPrice: Number(e.target.value) };
                                  setEditingProd({ ...editingProd, variations: next });
                                }}
                                placeholder="Price"
                                className="sm:col-span-2 px-2 py-1 border border-slate-300 rounded tabular-nums"
                              />
                              <input
                                type="number"
                                value={v.stockQuantity}
                                onChange={(e) => {
                                  const next = [...editingProd.variations];
                                  next[idx] = { ...v, stockQuantity: Number(e.target.value) };
                                  setEditingProd({ ...editingProd, variations: next });
                                }}
                                placeholder="Stock"
                                className="sm:col-span-2 px-2 py-1 border border-slate-300 rounded tabular-nums"
                              />
                              <div className="sm:col-span-2 flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => saveVariationInline(v)}
                                  className="px-2.5 py-1 bg-slate-900 text-white rounded"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await authFetch(`/api/admin/variations/${v.id}`, { method: 'DELETE' });
                                    const next = editingProd.variations.filter((x: any) => x.id !== v.id);
                                    setEditingProd({ ...editingProd, variations: next });
                                    await loadAll();
                                  }}
                                  className="p-1 text-red-600"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {prodTab === 'seo' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block font-medium mb-1">Custom URL Slug</label>
                        <input
                          value={editingProd.slug}
                          onChange={(e) => setEditingProd({ ...editingProd, slug: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                        />
                        <p className="text-[13px] text-slate-500 mt-1">
                          Changing an existing slug automatically registers a 301 redirect.
                        </p>
                      </div>
                      <div>
                        <label className="block font-medium mb-1">SEO Title</label>
                        <input
                          value={editingProd.seoTitle}
                          onChange={(e) => setEditingProd({ ...editingProd, seoTitle: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block font-medium mb-1">Meta Description</label>
                        <textarea
                          rows={3}
                          value={editingProd.metaDescription}
                          onChange={(e) => setEditingProd({ ...editingProd, metaDescription: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-md"
                        />
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-[#F0F1F3] flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setEditingProd(null)}
                      className="px-4 py-2.5 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] font-semibold rounded-xl transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-[#171717] text-white font-semibold rounded-xl hover:bg-[#0A0A0A] shadow-xs transition-all cursor-pointer"
                    >
                      Save Product
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== CATEGORIES ==================== */}
      {section === 'categories' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const isNew = !catForm.id;
              const res = await authFetch(
                isNew ? '/api/admin/categories' : `/api/admin/categories/${catForm.id}`,
                { method: isNew ? 'POST' : 'PUT', body: JSON.stringify(catForm) }
              );
              if (res.ok) {
                setCatForm({
                  id: null,
                  name: '',
                  slug: '',
                  parentId: '',
                  description: '',
                  imageUrl: '',
                  priceVisibility: 'inherit',
                  stockVisibility: 'inherit',
                  inquiryEnabled: 'inherit',
                  displayLayout: 'grid',
                  sortOrder: 0,
                });
                await loadAll();
                await refreshBootstrap();
              }
            }}
            className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-3 text-xs h-fit"
          >
            <h3 className="text-sm font-semibold">{catForm.id ? 'Edit Category' : 'Add Category'}</h3>
            <input
              required
              placeholder="Category Name"
              value={catForm.name}
              onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md"
            />
            <select
              value={catForm.parentId || ''}
              onChange={(e) => setCatForm({ ...catForm, parentId: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
            >
              <option value="">Top-Level Category</option>
              {categories
                .filter((c) => c.id !== catForm.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    Parent: {c.name}
                  </option>
                ))}
            </select>
            <textarea
              rows={2}
              placeholder="Description"
              value={catForm.description}
              onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={catForm.priceVisibility}
                onChange={(e) => setCatForm({ ...catForm, priceVisibility: e.target.value })}
                className="px-2.5 py-2 border border-slate-300 rounded-md bg-white"
              >
                <option value="inherit">Price: Inherit</option>
                <option value="show">Price: Show</option>
                <option value="hide">Price: Hide</option>
              </select>
              <select
                value={catForm.displayLayout}
                onChange={(e) => setCatForm({ ...catForm, displayLayout: e.target.value })}
                className="px-2.5 py-2 border border-slate-300 rounded-md bg-white"
              >
                <option value="grid">Layout: Grid</option>
                <option value="list">Layout: List</option>
              </select>
            </div>
            <button type="submit" className="w-full py-2 bg-slate-900 text-white rounded-md font-medium">
              {catForm.id ? 'Update Category' : 'Create Category'}
            </button>
          </form>

          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-semibold">Category</th>
                  <th className="py-3 px-4 font-semibold">Slug</th>
                  <th className="py-3 px-4 font-semibold">Price Override</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.map((c) => {
                  const parent = c.parentId ? categories.find((p) => p.id === c.parentId) : null;
                  return (
                    <tr key={c.id}>
                      <td className="py-3 px-4 font-medium">
                        {parent ? `${parent.name} → ${c.name}` : c.name}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">{c.slug}</td>
                      <td className="py-3 px-4 capitalize">{c.priceVisibility}</td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button type="button" onClick={() => setCatForm(c)} className="text-slate-700 hover:underline">
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await authFetch(`/api/admin/categories/${c.id}`, { method: 'DELETE' });
                            await loadAll();
                            await refreshBootstrap();
                          }}
                          className="text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== BRANDS ==================== */}
      {section === 'brands' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const isNew = !brandForm.id;
              const res = await authFetch(
                isNew ? '/api/admin/brands' : `/api/admin/brands/${brandForm.id}`,
                { method: isNew ? 'POST' : 'PUT', body: JSON.stringify(brandForm) }
              );
              if (res.ok) {
                setBrandForm({ id: null, name: '', slug: '', description: '', seoTitle: '', seoDescription: '' });
                await loadAll();
                await refreshBootstrap();
              }
            }}
            className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-3 text-xs h-fit"
          >
            <h3 className="text-sm font-semibold">{brandForm.id ? 'Edit Brand' : 'Add Brand'}</h3>
            <input
              required
              placeholder="Brand Name"
              value={brandForm.name}
              onChange={(e) => setBrandForm({ ...brandForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md"
            />
            <textarea
              rows={3}
              placeholder="Brand Description"
              value={brandForm.description}
              onChange={(e) => setBrandForm({ ...brandForm, description: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md"
            />
            <button type="submit" className="w-full py-2 bg-slate-900 text-white rounded-md font-medium">
              {brandForm.id ? 'Update Brand' : 'Create Brand'}
            </button>
          </form>

          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-semibold">Brand</th>
                  <th className="py-3 px-4 font-semibold">Slug</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {brands.map((b) => (
                  <tr key={b.id}>
                    <td className="py-3 px-4 font-medium">{b.name}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{b.slug}</td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button type="button" onClick={() => setBrandForm(b)} className="hover:underline">
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await authFetch(`/api/admin/brands/${b.id}`, { method: 'DELETE' });
                          await loadAll();
                        }}
                        className="text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== ATTRIBUTES ==================== */}
      {section === 'attributes' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-6">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await authFetch('/api/admin/attributes', {
                  method: 'POST',
                  body: JSON.stringify(newAttr),
                });
                setNewAttr({ name: '', displayType: 'button', usedForVariations: true });
                await loadAll();
                await refreshBootstrap();
              }}
              className="bg-white border border-slate-200 rounded-lg p-5 space-y-3 text-xs"
            >
              <h3 className="text-sm font-semibold">Create Attribute</h3>
              <input
                required
                placeholder="Attribute Name (e.g. Material)"
                value={newAttr.name}
                onChange={(e) => setNewAttr({ ...newAttr, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
              <select
                value={newAttr.displayType}
                onChange={(e) => setNewAttr({ ...newAttr, displayType: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                <option value="button">Button Selector</option>
                <option value="swatch">Color Swatches</option>
                <option value="dropdown">Dropdown Menu</option>
              </select>
              <button type="submit" className="w-full py-2 bg-slate-900 text-white rounded-md font-medium">
                Add Attribute
              </button>
            </form>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newAttrVal.attributeId) return;
                await authFetch('/api/admin/attribute-values', {
                  method: 'POST',
                  body: JSON.stringify(newAttrVal),
                });
                setNewAttrVal({ ...newAttrVal, value: '' });
                await loadAll();
                await refreshBootstrap();
              }}
              className="bg-white border border-slate-200 rounded-lg p-5 space-y-3 text-xs"
            >
              <h3 className="text-sm font-semibold">Add Attribute Value</h3>
              <select
                required
                value={newAttrVal.attributeId || ''}
                onChange={(e) => setNewAttrVal({ ...newAttrVal, attributeId: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                <option value="">Select Attribute...</option>
                {attributes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <input
                required
                placeholder="Value (e.g. Brushed Steel)"
                value={newAttrVal.value}
                onChange={(e) => setNewAttrVal({ ...newAttrVal, value: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
              <div className="flex items-center gap-2">
                <span className="text-slate-600">Swatch Color:</span>
                <input
                  type="color"
                  value={newAttrVal.colorHex}
                  onChange={(e) => setNewAttrVal({ ...newAttrVal, colorHex: e.target.value })}
                />
              </div>
              <button type="submit" className="w-full py-2 bg-slate-900 text-white rounded-md font-medium">
                Add Value
              </button>
            </form>
          </div>

          <div className="lg:col-span-8 space-y-4">
            {attributes.map((attr) => (
              <div key={attr.id} className="bg-white border border-slate-200 rounded-lg p-5 text-xs">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-semibold">{attr.name}</h4>
                    <p className="text-slate-500">
                      Display: {attr.displayType} · Slug: {attr.slug}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await authFetch(`/api/admin/attributes/${attr.id}`, { method: 'DELETE' });
                      await loadAll();
                    }}
                    className="text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {attr.values.map((v: any) => (
                    <span
                      key={v.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-slate-200 rounded bg-slate-50"
                    >
                      {v.colorHex && (
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: v.colorHex }}
                        />
                      )}
                      <span>{v.value}</span>
                      <button
                        type="button"
                        onClick={async () => {
                          await authFetch(`/api/admin/attribute-values/${v.id}`, { method: 'DELETE' });
                          await loadAll();
                        }}
                        className="text-slate-400 hover:text-red-600 ml-1"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== ALL VARIATIONS & BULK EDIT ==================== */}
      {section === 'variations' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center gap-3 text-xs">
            <span className="font-semibold">
              Bulk Edit ({selectedVarIds.length} selected):
            </span>
            <input
              type="number"
              placeholder="New Regular Price"
              value={bulkPrice}
              onChange={(e) => setBulkPrice(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-md w-36 tabular-nums"
            />
            <input
              type="number"
              placeholder="New Stock Qty"
              value={bulkStock}
              onChange={(e) => setBulkStock(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-md w-32 tabular-nums"
            />
            <button
              type="button"
              disabled={selectedVarIds.length === 0}
              onClick={handleBulkEditVariations}
              className="px-4 py-1.5 bg-slate-900 text-white rounded-md disabled:opacity-40"
            >
              Apply Bulk Update
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 w-8">
                    <input
                      type="checkbox"
                      checked={variations.length > 0 && selectedVarIds.length === variations.length}
                      onChange={(e) =>
                        setSelectedVarIds(e.target.checked ? variations.map((v) => v.id) : [])
                      }
                    />
                  </th>
                  <th className="py-3 px-4 font-semibold">Product</th>
                  <th className="py-3 px-4 font-semibold">SKU</th>
                  <th className="py-3 px-4 font-semibold">Options</th>
                  <th className="py-3 px-4 font-semibold text-right">Price</th>
                  <th className="py-3 px-4 font-semibold text-right">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {variations.map((v) => (
                  <tr key={v.id}>
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={selectedVarIds.includes(v.id)}
                        onChange={(e) =>
                          setSelectedVarIds((prev) =>
                            e.target.checked ? [...prev, v.id] : prev.filter((id) => id !== v.id)
                          )
                        }
                      />
                    </td>
                    <td className="py-3 px-4 font-medium">{v.productName}</td>
                    <td className="py-3 px-4 font-mono">{v.sku}</td>
                    <td className="py-3 px-4">
                      {(v.attributes || []).map((a: any) => `${a.attributeName}: ${a.value}`).join(' · ')}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      {currency}
                      {v.regularPrice.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums">{v.stockQuantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== INVENTORY ==================== */}
      {section === 'inventory' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-semibold">SKU</th>
                  <th className="py-3 px-4 font-semibold">Item</th>
                  <th className="py-3 px-4 font-semibold text-right">On Hand</th>
                  <th className="py-3 px-4 font-semibold text-right">Adjust</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products
                  .filter((p) => p.productType === 'simple')
                  .map((p) => (
                    <tr key={`p-${p.id}`}>
                      <td className="py-3 px-4 font-mono">{p.sku}</td>
                      <td className="py-3 px-4 font-medium">{p.name}</td>
                      <td className="py-3 px-4 text-right font-semibold tabular-nums">
                        {p.stockQuantity}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1">
                        <button
                          type="button"
                          onClick={() => adjustInventory(p.id, null, p.sku, -1)}
                          className="px-2 py-1 border border-slate-300 rounded"
                        >
                          -1
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustInventory(p.id, null, p.sku, 5)}
                          className="px-2 py-1 border border-slate-300 rounded"
                        >
                          +5
                        </button>
                      </td>
                    </tr>
                  ))}
                {variations.map((v) => (
                  <tr key={`v-${v.id}`}>
                    <td className="py-3 px-4 font-mono">{v.sku}</td>
                    <td className="py-3 px-4">
                      {v.productName} ({(v.attributes || []).map((a: any) => a.value).join(' · ')})
                    </td>
                    <td className="py-3 px-4 text-right font-semibold tabular-nums">
                      {v.stockQuantity}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1">
                      <button
                        type="button"
                        onClick={() => adjustInventory(v.productId, v.id, v.sku, -1)}
                        className="px-2 py-1 border border-slate-300 rounded"
                      >
                        -1
                      </button>
                      <button
                        type="button"
                        onClick={() => adjustInventory(v.productId, v.id, v.sku, 5)}
                        className="px-2 py-1 border border-slate-300 rounded"
                      >
                        +5
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h3 className="text-sm font-semibold mb-3">Stock Movement Ledger</h3>
            <div className="divide-y divide-slate-100 text-xs">
              {inventoryLogs.map((l) => (
                <div key={l.id} className="py-2 flex items-center justify-between gap-4">
                  <div>
                    <span className="font-mono font-medium mr-2">{l.sku}</span>
                    <span className="text-slate-600">{l.reason}</span>
                  </div>
                  <div className="tabular-nums font-mono">
                    {l.changeAmount > 0 ? `+${l.changeAmount}` : l.changeAmount} ({l.previousStock} →{' '}
                    {l.newStock})
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
