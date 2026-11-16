import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Upload,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  Plus,
  Edit3,
  Save,
  X,
  Mail,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Image as ImageIcon,
} from 'lucide-react';
import { usePlatform } from '../../context/PlatformContext';
import { SafeImage } from '../../components/SafeImage';
import { DEFAULT_HERO_SLIDES } from '../../components/HeroShowcase';

const ALL_ADMIN_MODULES = [
  'dashboard',
  'products',
  'categories',
  'brands',
  'attributes',
  'variations',
  'inventory',
  'orders',
  'inquiries',
  'quotations',
  'customers',
  'coupons',
  'shipping',
  'import_export',
  'media',
  'seo',
  'pages',
  'email_templates',
  'users',
  'settings',
];

export type SettingsTab = 'general' | 'commerce' | 'catalogue' | 'email' | 'seo';

export const AdminSystem: React.FC<{
  section: 'media' | 'seo' | 'pages' | 'users' | 'settings';
  activeSettingsTab?: SettingsTab;
  onChangeSettingsTab?: (tab: SettingsTab) => void;
}> = ({ section, activeSettingsTab, onChangeSettingsTab }) => {
  const { authFetch, settings, refreshBootstrap } = usePlatform();
  const [msg, setMsg] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Media state
  const [mediaList, setMediaList] = useState<any[]>([]);
  const [mediaUrlInput, setMediaUrlInput] = useState('');
  const [mediaAltInput, setMediaAltInput] = useState('');
  const [mediaFolderInput, setMediaFolderInput] = useState('products');
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // SEO & Redirects state
  const [redirects, setRedirects] = useState<any[]>([]);
  const [redirectForm, setRedirectForm] = useState({ sourcePath: '', targetPath: '', statusCode: 301 });
  const [seoSettingsForm, setSeoSettingsForm] = useState<Record<string, any>>({});

  // Pages CMS state
  const [pagesList, setPagesList] = useState<any[]>([]);
  const [pageForm, setPageForm] = useState<any>({
    id: null,
    title: '',
    slug: '',
    content: '',
    seoTitle: '',
    metaDescription: '',
    isPublished: true,
    sortOrder: 0,
  });

  // Users & RBAC Roles state
  const [usersList, setUsersList] = useState<any[]>([]);
  const [rolesList, setRolesList] = useState<any[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [rolePermsDraft, setRolePermsDraft] = useState<Record<string, any>>({});

  // Platform Settings state
  const [internalSettingsTab, setInternalSettingsTab] = useState<SettingsTab>(activeSettingsTab || 'commerce');
  const settingsTab = activeSettingsTab ?? internalSettingsTab;
  const setSettingsTab = (t: SettingsTab) => {
    setInternalSettingsTab(t);
    onChangeSettingsTab?.(t);
  };
  const [settingsDraft, setSettingsDraft] = useState<Record<string, any>>({
    general: {},
    commerce: {},
    catalogue: {},
    email: {},
    seo: {},
  });

  const loadSectionData = async () => {
    setMsg('');
    if (section === 'media') {
      const res = await authFetch('/api/admin/media');
      if (res.ok) setMediaList((await res.json()).media || []);
    } else if (section === 'seo') {
      const res = await authFetch('/api/admin/seo');
      if (res.ok) {
        const d = await res.json();
        setRedirects(d.redirects || []);
        setSeoSettingsForm(d.seoSettings || settings.seo || {});
      }
    } else if (section === 'pages') {
      const res = await authFetch('/api/admin/pages');
      if (res.ok) setPagesList((await res.json()).pages || []);
    } else if (section === 'users') {
      const res = await authFetch('/api/admin/users');
      if (res.ok) {
        const d = await res.json();
        setUsersList(d.users || []);
        const rList = d.roles || [];
        setRolesList(rList);
        if (rList.length > 0) {
          const targetRole = rList.find((r: any) => r.id === selectedRoleId) || rList[0];
          setSelectedRoleId(targetRole.id);
          hydrateRolePermsDraft(targetRole);
        }
      }
    } else if (section === 'settings') {
      const [sRes, mRes] = await Promise.all([
        authFetch('/api/admin/settings'),
        authFetch('/api/admin/media'),
      ]);
      if (sRes.ok) {
        const d = await sRes.json();
        setSettingsDraft(d.settings || settings);
      }
      if (mRes.ok) {
        setMediaList((await mRes.json()).media || []);
      }
    }
  };

  const hydrateRolePermsDraft = (role: any) => {
    const map: Record<string, any> = {};
    for (const mod of ALL_ADMIN_MODULES) {
      const found = (role.permissions || []).find((p: any) => p.module === mod);
      map[mod] = {
        module: mod,
        canView: Boolean(found?.canView),
        canCreate: Boolean(found?.canCreate),
        canEdit: Boolean(found?.canEdit),
        canDelete: Boolean(found?.canDelete),
      };
    }
    setRolePermsDraft(map);
  };

  useEffect(() => {
    loadSectionData();
  }, [section]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMedia(true);
    setMsg('');
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await authFetch('/api/admin/media/upload', {
        method: 'POST',
        body: JSON.stringify({
          filename: file.name,
          dataUrl,
          altText: mediaAltInput || file.name,
          folder: mediaFolderInput,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMsg(d.error || 'Upload failed.');
      } else {
        setMsg(`Uploaded ${d.media.filename}`);
        setMediaAltInput('');
        await loadSectionData();
      }
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleAddMediaUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mediaUrlInput.trim()) return;
    const res = await authFetch('/api/admin/media/upload', {
      method: 'POST',
      body: JSON.stringify({
        url: mediaUrlInput.trim(),
        altText: mediaAltInput || 'Studio asset',
        folder: mediaFolderInput,
      }),
    });
    if (res.ok) {
      setMediaUrlInput('');
      setMediaAltInput('');
      setMsg('Media asset added.');
      await loadSectionData();
    }
  };

  const saveSettingsGroup = async (key: 'general' | 'commerce' | 'catalogue' | 'email' | 'seo', payload: any) => {
    const res = await authFetch(`/api/admin/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value: payload }),
    });
    if (res.ok) {
      setMsg(`Saved ${key} configuration.`);
      await refreshBootstrap();
      const d = await res.json();
      if (d.settings) setSettingsDraft(d.settings);
    } else {
      setMsg('Failed to save settings.');
    }
  };

  return (
    <div className="space-y-6 text-xs">
      {msg && (
        <div className="bg-[#171717] text-white px-4 py-3 rounded-2xl shadow-sm flex items-center justify-between">
          <span className="font-medium">{msg}</span>
          <button type="button" onClick={() => setMsg('')} className="p-1 rounded-lg hover:bg-white/10 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ==================== MEDIA LIBRARY ==================== */}
      {section === 'media' && (
        <div className="space-y-6">
          <div className="bg-white border border-[#F0F1F3] shadow-[0_8px_30px_rgba(17,24,39,0.04)] rounded-3xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">Upload or Register Image Asset</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                placeholder="Alt text description"
                value={mediaAltInput}
                onChange={(e) => setMediaAltInput(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-md"
              />
              <select
                value={mediaFolderInput}
                onChange={(e) => setMediaFolderInput(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                <option value="products">Folder: products</option>
                <option value="categories">Folder: categories</option>
                <option value="banners">Folder: banners</option>
                <option value="general">Folder: general</option>
              </select>
              <label className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#171717] text-white rounded-xl font-semibold cursor-pointer hover:bg-[#0A0A0A] shadow-xs transition-all">
                <Upload className="w-3.5 h-3.5" />
                <span>{uploadingMedia ? 'Uploading...' : 'Upload Image File (≤5MB)'}</span>
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
            <form onSubmit={handleAddMediaUrl} className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-[#F0F1F3]">
              <input
                placeholder="Or register existing image URL (e.g. /src/assets/images/...)"
                value={mediaUrlInput}
                onChange={(e) => setMediaUrlInput(e.target.value)}
                className="flex-1 px-3.5 py-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] rounded-xl font-semibold transition-all cursor-pointer"
              >
                Register URL
              </button>
            </form>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {mediaList.map((m) => (
              <div key={m.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">
                <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                  <SafeImage src={m.url} alt={m.altText || m.filename} className="w-full h-full object-cover" />
                </div>
                <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900 truncate">{m.filename}</p>
                    <p className="text-[13px] text-slate-500 truncate">{m.folder} · {m.url}</p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(m.url);
                        setCopiedId(m.id);
                        setTimeout(() => setCopiedId(null), 1500);
                      }}
                      className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 font-medium"
                    >
                      {copiedId === m.id ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedId === m.id ? 'Copied' : 'Copy URL'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await authFetch(`/api/admin/media/${m.id}`, { method: 'DELETE' });
                        await loadSectionData();
                      }}
                      className="text-slate-500 hover:text-red-600"
                      title="Delete Asset"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== SEO & 301 REDIRECTS ==================== */}
      {section === 'seo' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Global SEO & Crawler Directives</h3>
                <p className="text-slate-500 mt-0.5">
                  Dynamic XML sitemap and robots directives reflect active storefront catalog routes.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href="/sitemap.xml"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-md font-medium hover:bg-slate-50"
                >
                  <span>sitemap.xml</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href="/robots.txt"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-md font-medium hover:bg-slate-50"
                >
                  <span>robots.txt</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium mb-1">Default Meta Title</label>
                <input
                  value={seoSettingsForm.defaultMetaTitle || ''}
                  onChange={(e) => setSeoSettingsForm({ ...seoSettingsForm, defaultMetaTitle: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Robots Policy</label>
                <select
                  value={seoSettingsForm.robotsPolicy || 'index, follow'}
                  onChange={(e) => setSeoSettingsForm({ ...seoSettingsForm, robotsPolicy: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
                >
                  <option value="index, follow">index, follow</option>
                  <option value="noindex, nofollow">noindex, nofollow</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block font-medium mb-1">Default Meta Description</label>
                <textarea
                  rows={2}
                  value={seoSettingsForm.defaultMetaDescription || ''}
                  onChange={(e) => setSeoSettingsForm({ ...seoSettingsForm, defaultMetaDescription: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Canonical Base URL (Optional)</label>
                <input
                  value={seoSettingsForm.canonicalBaseUrl || ''}
                  onChange={(e) => setSeoSettingsForm({ ...seoSettingsForm, canonicalBaseUrl: e.target.value })}
                  placeholder="https://kansoatelier.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Default OpenGraph Image</label>
                <input
                  value={seoSettingsForm.ogDefaultImage || ''}
                  onChange={(e) => setSeoSettingsForm({ ...seoSettingsForm, ogDefaultImage: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => saveSettingsGroup('seo', seoSettingsForm)}
              className="px-4 py-2 bg-slate-900 text-white rounded-md font-medium"
            >
              Save Global SEO Settings
            </button>
          </div>

          {/* 301 Redirects Manager */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const res = await authFetch('/api/admin/redirects', {
                  method: 'POST',
                  body: JSON.stringify(redirectForm),
                });
                if (res.ok) {
                  setRedirectForm({ sourcePath: '', targetPath: '', statusCode: 301 });
                  setMsg('URL redirect rule added.');
                  await loadSectionData();
                } else {
                  const d = await res.json();
                  setMsg(d.error || 'Failed to add redirect.');
                }
              }}
              className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-3 h-fit"
            >
              <h3 className="text-sm font-semibold text-slate-900">Add 301 / 302 Redirect</h3>
              <div>
                <label className="block font-medium mb-1">Source Path</label>
                <input
                  required
                  placeholder="/old-product-url"
                  value={redirectForm.sourcePath}
                  onChange={(e) => setRedirectForm({ ...redirectForm, sourcePath: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Target Path</label>
                <input
                  required
                  placeholder="/products/monolith-articulated-task-lamp"
                  value={redirectForm.targetPath}
                  onChange={(e) => setRedirectForm({ ...redirectForm, targetPath: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">HTTP Code</label>
                <select
                  value={redirectForm.statusCode}
                  onChange={(e) => setRedirectForm({ ...redirectForm, statusCode: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
                >
                  <option value={301}>301 Permanent Redirect</option>
                  <option value={302}>302 Temporary Redirect</option>
                </select>
              </div>
              <button type="submit" className="w-full py-2 bg-slate-900 text-white rounded-md font-medium">
                Create Redirect Rule
              </button>
            </form>

            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Source</th>
                    <th className="py-3 px-4 font-semibold">Target</th>
                    <th className="py-3 px-4 font-semibold">Code</th>
                    <th className="py-3 px-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {redirects.map((r) => (
                    <tr key={r.id}>
                      <td className="py-3 px-4 font-mono">{r.sourcePath}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{r.targetPath}</td>
                      <td className="py-3 px-4 tabular-nums">{r.statusCode}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={async () => {
                            await authFetch(`/api/admin/redirects/${r.id}`, { method: 'DELETE' });
                            await loadSectionData();
                          }}
                          className="text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                  {redirects.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-500">
                        No URL redirects configured yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== WEBSITE PAGES CMS ==================== */}
      {section === 'pages' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const isNew = !pageForm.id;
              const res = await authFetch(
                isNew ? '/api/admin/pages' : `/api/admin/pages/${pageForm.id}`,
                { method: isNew ? 'POST' : 'PUT', body: JSON.stringify(pageForm) }
              );
              if (res.ok) {
                setPageForm({
                  id: null,
                  title: '',
                  slug: '',
                  content: '',
                  seoTitle: '',
                  metaDescription: '',
                  isPublished: true,
                  sortOrder: 0,
                });
                setMsg(isNew ? 'Page created.' : 'Page updated.');
                await loadSectionData();
                await refreshBootstrap();
              }
            }}
            className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-3 h-fit"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{pageForm.id ? 'Edit Page' : 'Create Static Page'}</h3>
              {pageForm.id && (
                <button
                  type="button"
                  onClick={() =>
                    setPageForm({
                      id: null,
                      title: '',
                      slug: '',
                      content: '',
                      seoTitle: '',
                      metaDescription: '',
                      isPublished: true,
                      sortOrder: 0,
                    })
                  }
                  className="text-slate-500 hover:text-slate-900"
                >
                  New Page
                </button>
              )}
            </div>
            <input
              required
              placeholder="Page Title"
              value={pageForm.title}
              onChange={(e) => setPageForm({ ...pageForm, title: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md"
            />
            <input
              placeholder="URL Slug (auto-generated if blank)"
              value={pageForm.slug}
              onChange={(e) => setPageForm({ ...pageForm, slug: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
            />
            <textarea
              rows={6}
              required
              placeholder="HTML or plain text page body..."
              value={pageForm.content}
              onChange={(e) => setPageForm({ ...pageForm, content: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
            />
            <input
              placeholder="SEO Title"
              value={pageForm.seoTitle}
              onChange={(e) => setPageForm({ ...pageForm, seoTitle: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md"
            />
            <textarea
              rows={2}
              placeholder="Meta Description"
              value={pageForm.metaDescription}
              onChange={(e) => setPageForm({ ...pageForm, metaDescription: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md"
            />
            <div className="flex items-center justify-between">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(pageForm.isPublished)}
                  onChange={(e) => setPageForm({ ...pageForm, isPublished: e.target.checked })}
                />
                <span>Published</span>
              </label>
              <input
                type="number"
                value={pageForm.sortOrder}
                onChange={(e) => setPageForm({ ...pageForm, sortOrder: Number(e.target.value) })}
                placeholder="Sort"
                className="w-20 px-2 py-1 border border-slate-300 rounded tabular-nums"
              />
            </div>
            <button type="submit" className="w-full py-2.5 bg-[#171717] hover:bg-[#0A0A0A] text-white rounded-xl font-semibold shadow-xs transition-all cursor-pointer">
              {pageForm.id ? 'Update Page' : 'Publish Page'}
            </button>
          </form>

          <div className="lg:col-span-7 bg-white border border-[#F0F1F3] shadow-[0_8px_30px_rgba(17,24,39,0.04)] rounded-3xl overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-[#F7F7F8] border-b border-[#F0F1F3]">
                <tr>
                  <th className="py-3 px-4 font-semibold">Page</th>
                  <th className="py-3 px-4 font-semibold">Slug</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F1F3]">
                {pagesList.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 px-4 font-semibold text-[#111827]">{p.title}</td>
                    <td className="py-3 px-4 font-mono text-[#6B7280]">/pages/{p.slug}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[13px] font-semibold ${p.isPublished ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#F3F4F6] text-[#6B7280]'}`}>
                        {p.isPublished ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button type="button" onClick={() => setPageForm(p)} className="px-3 py-1.5 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] rounded-xl font-semibold cursor-pointer">
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await authFetch(`/api/admin/pages/${p.id}`, { method: 'DELETE' });
                          await loadSectionData();
                          await refreshBootstrap();
                        }}
                        className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl font-semibold cursor-pointer"
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

      {/* ==================== USERS & RBAC PERMISSIONS MATRIX ==================== */}
      {section === 'users' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-semibold">
              Registered Platform Users & Role Assignment
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-3 px-4 font-semibold">User</th>
                    <th className="py-3 px-4 font-semibold">Email</th>
                    <th className="py-3 px-4 font-semibold">Assigned Role</th>
                    <th className="py-3 px-4 font-semibold">Account Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usersList.map((u) => (
                    <tr key={u.id}>
                      <td className="py-3 px-4 font-medium">{u.name || 'User'}</td>
                      <td className="py-3 px-4">{u.email}</td>
                      <td className="py-3 px-4">
                        <select
                          value={u.roleId || ''}
                          onChange={async (e) => {
                            const res = await authFetch(`/api/admin/users/${u.id}`, {
                              method: 'PUT',
                              body: JSON.stringify({ roleId: Number(e.target.value), isActive: u.isActive }),
                            });
                            if (res.ok) {
                              setMsg(`Updated role for ${u.email}`);
                              await loadSectionData();
                            }
                          }}
                          className="px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                        >
                          {rolesList.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(u.isActive)}
                            onChange={async (e) => {
                              await authFetch(`/api/admin/users/${u.id}`, {
                                method: 'PUT',
                                body: JSON.stringify({ roleId: u.roleId, isActive: e.target.checked }),
                              });
                              await loadSectionData();
                            }}
                          />
                          <span>{u.isActive ? 'Active' : 'Suspended'}</span>
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Role-Based Access Control (RBAC) Matrix</h3>
                <p className="text-slate-500">
                  Configure granular View, Create, Edit, and Delete permissions per role across all 20 admin modules.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={selectedRoleId || ''}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setSelectedRoleId(id);
                    const found = rolesList.find((r) => r.id === id);
                    if (found) hydrateRolePermsDraft(found);
                  }}
                  className="px-3 py-2 border border-slate-300 rounded-md bg-white font-medium"
                >
                  {rolesList
                    .filter((r) => r.slug !== 'customer')
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        Role: {r.name}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={async () => {
                    if (!selectedRoleId) return;
                    const res = await authFetch(`/api/admin/roles/${selectedRoleId}/permissions`, {
                      method: 'PUT',
                      body: JSON.stringify({ perms: Object.values(rolePermsDraft) }),
                    });
                    if (res.ok) {
                      setMsg('Saved role permissions matrix.');
                      await loadSectionData();
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-md font-medium"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Matrix</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-md">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Module</th>
                    <th className="py-2.5 px-4 font-semibold text-center">View</th>
                    <th className="py-2.5 px-4 font-semibold text-center">Create</th>
                    <th className="py-2.5 px-4 font-semibold text-center">Edit</th>
                    <th className="py-2.5 px-4 font-semibold text-center">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ALL_ADMIN_MODULES.map((mod) => {
                    const row = rolePermsDraft[mod] || {
                      module: mod,
                      canView: false,
                      canCreate: false,
                      canEdit: false,
                      canDelete: false,
                    };
                    return (
                      <tr key={mod}>
                        <td className="py-2.5 px-4 font-mono capitalize">{mod.replace('_', ' ')}</td>
                        {(['canView', 'canCreate', 'canEdit', 'canDelete'] as const).map((flag) => (
                          <td key={flag} className="py-2.5 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={Boolean(row[flag])}
                              onChange={(e) =>
                                setRolePermsDraft({
                                  ...rolePermsDraft,
                                  [mod]: { ...row, [flag]: e.target.checked },
                                })
                              }
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== PLATFORM SETTINGS ==================== */}
      {section === 'settings' && (
        <div className="bg-white border border-[#F0F1F3] shadow-[0_8px_30px_rgba(17,24,39,0.04)] rounded-3xl overflow-hidden">
          <div className="p-5 border-b border-[#F0F1F3] bg-[#FAFAFB]">
            {activeSettingsTab ? (
              <div>
                <h2 className="text-base font-bold text-[#111827]">
                  {settingsTab === 'commerce'
                    ? 'Operating Mode & eCommerce Settings'
                    : settingsTab === 'catalogue'
                    ? 'Catalogue & RFQ Mode Settings'
                    : settingsTab === 'general'
                    ? 'General Store Information'
                    : settingsTab === 'email'
                    ? 'Email Routing Defaults'
                    : 'SEO Defaults'}
                </h2>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Changes apply immediately across the storefront and admin platform upon saving.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="inline-flex items-center gap-1.5 p-1.5 bg-[#F3F4F6] border border-[#E5E7EB] rounded-2xl">
                  {(['commerce', 'catalogue', 'general', 'email', 'seo'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSettingsTab(t)}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition-all cursor-pointer ${
                        settingsTab === t
                          ? 'bg-[#171717] text-white shadow-xs'
                          : 'text-[#6B7280] hover:text-[#111827] hover:bg-white'
                      }`}
                    >
                      {t === 'commerce'
                        ? 'Operating Mode & eCommerce'
                        : t === 'catalogue'
                        ? 'Catalogue & RFQ Mode'
                        : `${t} Settings`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="p-6 space-y-5">
            {settingsTab === 'commerce' && (
              <div className="space-y-5 max-w-3xl">
                <div className="p-5 bg-[#F7F7F8] border border-[#EAECEF] rounded-2xl space-y-3">
                  <label className="block font-bold text-[#111827]">Global Platform Operating Mode</label>
                  <p className="text-[#6B7280]">
                    Controls whether the public storefront operates as a full Cash on Delivery store or a Product Catalogue & RFQ Inquiry platform. All catalog, customer, order, and inquiry records remain intact when switching.
                  </p>
                  <div className="inline-flex flex-wrap gap-2 p-1.5 bg-white border border-[#E5E7EB] rounded-2xl">
                    {(['ecommerce', 'catalogue'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() =>
                          setSettingsDraft({
                            ...settingsDraft,
                            commerce: { ...settingsDraft.commerce, operatingMode: m },
                          })
                        }
                        className={`px-4 py-2.5 rounded-xl font-semibold transition-all cursor-pointer ${
                          settingsDraft.commerce?.operatingMode === m
                            ? 'bg-[#171717] text-white shadow-xs'
                            : 'text-[#6B7280] hover:text-[#111827]'
                        }`}
                      >
                        {m === 'ecommerce' ? 'eCommerce Mode (Checkout Enabled)' : 'Catalogue / Inquiry Mode (RFQ Enabled)'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    ['showPrices', 'Show Prices Globally (eCommerce)'],
                    ['showSalePrices', 'Show Sale Prices & Badges'],
                    ['showStock', 'Show Stock Levels on Storefront'],
                    ['showSkus', 'Show Product & Variation SKUs'],
                    ['guestCheckoutEnabled', 'Allow Guest Checkout (No Account Required)'],
                    ['codEnabled', 'Enable Cash on Delivery (COD)'],
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2.5 p-3 border border-slate-200 rounded-md">
                      <input
                        type="checkbox"
                        checked={Boolean(settingsDraft.commerce?.[key])}
                        onChange={(e) =>
                          setSettingsDraft({
                            ...settingsDraft,
                            commerce: { ...settingsDraft.commerce, [key]: e.target.checked },
                          })
                        }
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-medium mb-1">Tax Rate (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={settingsDraft.commerce?.taxRate ?? 8.5}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          commerce: { ...settingsDraft.commerce, taxRate: Number(e.target.value) },
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-md tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Tax Label</label>
                    <input
                      value={settingsDraft.commerce?.taxLabel || 'Sales Tax'}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          commerce: { ...settingsDraft.commerce, taxLabel: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Low Stock Threshold</label>
                    <input
                      type="number"
                      value={settingsDraft.commerce?.lowStockThreshold ?? 5}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          commerce: { ...settingsDraft.commerce, lowStockThreshold: Number(e.target.value) },
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-md tabular-nums"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium mb-1">Cash on Delivery Instructions</label>
                  <input
                    value={settingsDraft.commerce?.codInstructions || ''}
                    onChange={(e) =>
                      setSettingsDraft({
                        ...settingsDraft,
                        commerce: { ...settingsDraft.commerce, codInstructions: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => saveSettingsGroup('commerce', settingsDraft.commerce)}
                  className="px-5 py-2.5 bg-[#171717] hover:bg-[#0A0A0A] text-white rounded-xl font-semibold shadow-xs transition-all cursor-pointer"
                >
                  Save eCommerce & Mode Settings
                </button>
              </div>
            )}

            {settingsTab === 'catalogue' && (
              <div className="space-y-5 max-w-3xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    ['inquiryCartEnabled', 'Enable Multi-Product Inquiry Cart'],
                    ['enableInquiries', 'Enable Direct Product Inquiries'],
                    ['enableQuantitySelection', 'Allow Quantity Selection on Inquiries'],
                    ['enableQuotations', 'Enable Quotation Generation & Portal'],
                    ['showPricesInCatalogue', 'Show Prices in Catalogue Mode'],
                    ['showStockInCatalogue', 'Show Stock Levels in Catalogue Mode'],
                    ['showSkusInCatalogue', 'Show SKUs in Catalogue Mode'],
                    ['collectShippingPreference', 'Collect Preferred Shipping in Inquiry'],
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2.5 p-3.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-2xl cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(settingsDraft.catalogue?.[key])}
                        onChange={(e) =>
                          setSettingsDraft({
                            ...settingsDraft,
                            catalogue: { ...settingsDraft.catalogue, [key]: e.target.checked },
                          })
                        }
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
                <div>
                  <label className="block font-medium mb-1">Inquiry Confirmation Message</label>
                  <textarea
                    rows={3}
                    value={settingsDraft.catalogue?.inquiryConfirmationMessage || ''}
                    onChange={(e) =>
                      setSettingsDraft({
                        ...settingsDraft,
                        catalogue: { ...settingsDraft.catalogue, inquiryConfirmationMessage: e.target.value },
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => saveSettingsGroup('catalogue', settingsDraft.catalogue)}
                  className="px-5 py-2.5 bg-[#171717] hover:bg-[#0A0A0A] text-white rounded-xl font-semibold shadow-xs transition-all cursor-pointer"
                >
                  Save Catalogue & RFQ Settings
                </button>
              </div>
            )}

            {settingsTab === 'general' && (() => {
              const currentSlides: Array<{ id: string; imageUrl: string; headline: string }> =
                Array.isArray(settingsDraft.general?.heroSlides) && settingsDraft.general.heroSlides.length > 0
                  ? settingsDraft.general.heroSlides
                  : DEFAULT_HERO_SLIDES;

              const setSlides = (nextSlides: Array<{ id: string; imageUrl: string; headline: string }>) => {
                setSettingsDraft({
                  ...settingsDraft,
                  general: {
                    ...settingsDraft.general,
                    heroSlides: nextSlides,
                  },
                });
              };

              const uploadSlideFile = async (file: File, targetIndex?: number) => {
                setUploadingMedia(true);
                setMsg('');
                try {
                  const dataUrl = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result));
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                  });
                  const res = await authFetch('/api/admin/media/upload', {
                    method: 'POST',
                    body: JSON.stringify({
                      filename: file.name,
                      dataUrl,
                      altText: file.name,
                      folder: 'banners',
                    }),
                  });
                  const d = await res.json();
                  if (!res.ok) {
                    setMsg(d.error || 'Hero image upload failed.');
                    return;
                  }
                  const uploadedUrl = d.media?.url;
                  if (uploadedUrl) {
                    setMediaList((prev) => [d.media, ...prev]);
                    if (typeof targetIndex === 'number') {
                      const next = currentSlides.map((s, idx) =>
                        idx === targetIndex ? { ...s, imageUrl: uploadedUrl } : s
                      );
                      setSlides(next);
                    } else {
                      setSlides([
                        ...currentSlides,
                        {
                          id: `slide-${Date.now()}`,
                          imageUrl: uploadedUrl,
                          headline: 'FURNITURE THAT LASTS',
                        },
                      ]);
                    }
                    setMsg(`Uploaded ${d.media.filename} and assigned to Hero Slides. Click Save General Settings to publish.`);
                  }
                } finally {
                  setUploadingMedia(false);
                }
              };

              const badgePreviewText = String(settingsDraft.general?.heroBadgeText || 'SHOP FURNITURE').trim() || 'SHOP FURNITURE';

              return (
                <div className="space-y-6 max-w-4xl">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-medium mb-1">Site Name</label>
                      <input
                        value={settingsDraft.general?.siteName || ''}
                        onChange={(e) =>
                          setSettingsDraft({
                            ...settingsDraft,
                            general: { ...settingsDraft.general, siteName: e.target.value },
                          })
                        }
                        className="w-full px-3.5 py-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-medium mb-1">Tagline</label>
                      <input
                        value={settingsDraft.general?.tagline || ''}
                        onChange={(e) =>
                          setSettingsDraft({
                            ...settingsDraft,
                            general: { ...settingsDraft.general, tagline: e.target.value },
                          })
                        }
                        className="w-full px-3.5 py-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-medium mb-1">Contact Email</label>
                      <input
                        value={settingsDraft.general?.contactEmail || ''}
                        onChange={(e) =>
                          setSettingsDraft({
                            ...settingsDraft,
                            general: { ...settingsDraft.general, contactEmail: e.target.value },
                          })
                        }
                        className="w-full px-3.5 py-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-medium mb-1">Phone</label>
                      <input
                        value={settingsDraft.general?.phone || ''}
                        onChange={(e) =>
                          setSettingsDraft({
                            ...settingsDraft,
                            general: { ...settingsDraft.general, phone: e.target.value },
                          })
                        }
                        className="w-full px-3.5 py-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-medium mb-1">Currency Code</label>
                      <input
                        value={settingsDraft.general?.currency || 'USD'}
                        onChange={(e) =>
                          setSettingsDraft({
                            ...settingsDraft,
                            general: { ...settingsDraft.general, currency: e.target.value },
                          })
                        }
                        className="w-full px-3.5 py-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-medium mb-1">Currency Symbol</label>
                      <input
                        value={settingsDraft.general?.currencySymbol || '$'}
                        onChange={(e) =>
                          setSettingsDraft({
                            ...settingsDraft,
                            general: { ...settingsDraft.general, currencySymbol: e.target.value },
                          })
                        }
                        className="w-full px-3.5 py-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium mb-1">Studio Address</label>
                    <input
                      value={settingsDraft.general?.address || ''}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          general: { ...settingsDraft.general, address: e.target.value },
                        })
                      }
                      className="w-full px-3.5 py-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl"
                    />
                  </div>

                  {/* Hero Showcase Rotating Slides & Pulsing CTA Builder */}
                  <div className="p-5 bg-[#FAF6F0] border border-[#E5D7C6] rounded-3xl space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E5D7C6]">
                      <div>
                        <h3 className="text-sm font-bold text-[#231912]">
                          Homepage Hero Showcase — Rotating Images, Headlines &amp; Pulsing CTA
                        </h3>
                        <p className="text-xs text-[#6E5644] mt-0.5">
                          Upload and assign hero images. Each slide pairs an interior image with its own cutout headline (e.g. &ldquo;FURNITURE THAT LASTS&rdquo;).
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl ka-oak-btn font-semibold cursor-pointer whitespace-nowrap">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{uploadingMedia ? 'Uploading...' : 'Upload & Add Slide'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void uploadSlideFile(f);
                              e.target.value = '';
                            }}
                            className="hidden"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setSlides([
                              ...currentSlides,
                              {
                                id: `slide-${Date.now()}`,
                                imageUrl: DEFAULT_HERO_SLIDES[currentSlides.length % DEFAULT_HERO_SLIDES.length].imageUrl,
                                headline: 'FURNITURE THAT LASTS',
                              },
                            ])
                          }
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#DECFC0] text-[#231912] font-semibold hover:bg-[#F8F3EC] cursor-pointer whitespace-nowrap"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Slide</span>
                        </button>
                      </div>
                    </div>

                    {/* Pulsing Circular Button Configuration */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-white rounded-2xl border border-[#EAECEF]">
                      <div>
                        <label className="block font-semibold text-[#111827] mb-1">
                          Pulsing Circle Text
                        </label>
                        <input
                          value={settingsDraft.general?.heroBadgeText ?? 'SHOP FURNITURE'}
                          onChange={(e) =>
                            setSettingsDraft({
                              ...settingsDraft,
                              general: { ...settingsDraft.general, heroBadgeText: e.target.value },
                            })
                          }
                          placeholder="SHOP FURNITURE"
                          className="w-full px-3 py-2 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl font-semibold uppercase"
                        />
                        <p className="text-[11px] text-[#6B7280] mt-1">
                          Preview ring: &bull; {badgePreviewText.toUpperCase()} &bull;
                        </p>
                      </div>
                      <div>
                        <label className="block font-semibold text-[#111827] mb-1">
                          Circle Button Link
                        </label>
                        <input
                          value={settingsDraft.general?.heroBadgeLink ?? '/shop'}
                          onChange={(e) =>
                            setSettingsDraft({
                              ...settingsDraft,
                              general: { ...settingsDraft.general, heroBadgeLink: e.target.value },
                            })
                          }
                          placeholder="/shop"
                          className="w-full px-3 py-2 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl font-mono"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-[#111827] mb-1">
                          Rotation Speed (Seconds)
                        </label>
                        <input
                          type="number"
                          min={2}
                          max={20}
                          value={settingsDraft.general?.heroRotateSeconds ?? 5}
                          onChange={(e) =>
                            setSettingsDraft({
                              ...settingsDraft,
                              general: { ...settingsDraft.general, heroRotateSeconds: Number(e.target.value) },
                            })
                          }
                          className="w-full px-3 py-2 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl tabular-nums"
                        />
                      </div>
                    </div>

                    {/* Assigned Hero Slides List */}
                    <div className="space-y-3">
                      {currentSlides.map((slide, idx) => (
                        <div
                          key={slide.id || idx}
                          className="p-4 bg-white border border-[#EAECEF] rounded-2xl grid grid-cols-1 md:grid-cols-12 gap-4 items-center"
                        >
                          <div className="md:col-span-3">
                            <div className="aspect-[16/10] rounded-xl overflow-hidden bg-[#ECECEE] border border-[#E5E7EB]">
                              <SafeImage
                                src={slide.imageUrl}
                                alt={slide.headline}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </div>

                          <div className="md:col-span-7 space-y-2.5">
                            <div>
                              <label className="block font-semibold text-[#111827] mb-1">
                                Slide {idx + 1} Headline Text
                              </label>
                              <input
                                value={slide.headline}
                                onChange={(e) => {
                                  const next = currentSlides.map((s, i) =>
                                    i === idx ? { ...s, headline: e.target.value } : s
                                  );
                                  setSlides(next);
                                }}
                                placeholder="FURNITURE THAT LASTS"
                                className="w-full px-3 py-2 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl font-bold uppercase"
                              />
                            </div>

                            <div className="flex flex-wrap gap-2 items-center">
                              <input
                                value={slide.imageUrl}
                                onChange={(e) => {
                                  const next = currentSlides.map((s, i) =>
                                    i === idx ? { ...s, imageUrl: e.target.value } : s
                                  );
                                  setSlides(next);
                                }}
                                placeholder="/assets/... or uploaded URL"
                                className="flex-1 min-w-[180px] px-3 py-1.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl font-mono text-[11px]"
                              />
                              <label className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] font-semibold cursor-pointer whitespace-nowrap">
                                <Upload className="w-3 h-3" />
                                <span>Upload</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) void uploadSlideFile(f, idx);
                                    e.target.value = '';
                                  }}
                                  className="hidden"
                                />
                              </label>
                              {mediaList.length > 0 && (
                                <select
                                  value=""
                                  onChange={(e) => {
                                    if (!e.target.value) return;
                                    const next = currentSlides.map((s, i) =>
                                      i === idx ? { ...s, imageUrl: e.target.value } : s
                                    );
                                    setSlides(next);
                                  }}
                                  className="px-2.5 py-1.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl text-[11px] max-w-[165px]"
                                >
                                  <option value="">Assign uploaded...</option>
                                  {mediaList.map((m) => (
                                    <option key={m.id} value={m.url}>
                                      {m.filename}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          </div>

                          <div className="md:col-span-2 flex md:flex-col items-center justify-end gap-1.5">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => {
                                  const next = [...currentSlides];
                                  [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                                  setSlides(next);
                                }}
                                className="p-1.5 rounded-lg bg-[#F3F4F6] hover:bg-[#E5E7EB] disabled:opacity-40 cursor-pointer"
                                title="Move Up"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === currentSlides.length - 1}
                                onClick={() => {
                                  const next = [...currentSlides];
                                  [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                                  setSlides(next);
                                }}
                                className="p-1.5 rounded-lg bg-[#F3F4F6] hover:bg-[#E5E7EB] disabled:opacity-40 cursor-pointer"
                                title="Move Down"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            {currentSlides.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setSlides(currentSlides.filter((_, i) => i !== idx))}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-semibold cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Remove</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Stat Callouts Customization */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-white rounded-2xl border border-[#EAECEF]">
                      <div className="space-y-1.5">
                        <label className="block font-semibold text-[#111827]">Top-Right Stat</label>
                        <div className="flex gap-2">
                          <input
                            value={settingsDraft.general?.heroStatTopValue ?? '15+'}
                            onChange={(e) =>
                              setSettingsDraft({
                                ...settingsDraft,
                                general: { ...settingsDraft.general, heroStatTopValue: e.target.value },
                              })
                            }
                            placeholder="15+"
                            className="w-20 px-2.5 py-1.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-lg font-bold tabular-nums"
                          />
                          <input
                            value={settingsDraft.general?.heroStatTopLabel ?? 'YEARS DESIGNING'}
                            onChange={(e) =>
                              setSettingsDraft({
                                ...settingsDraft,
                                general: { ...settingsDraft.general, heroStatTopLabel: e.target.value },
                              })
                            }
                            placeholder="YEARS DESIGNING"
                            className="flex-1 px-2.5 py-1.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-lg uppercase"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block font-semibold text-[#111827]">Floating Card Stat</label>
                        <div className="flex gap-2">
                          <input
                            value={settingsDraft.general?.heroStatMidValue ?? '420+'}
                            onChange={(e) =>
                              setSettingsDraft({
                                ...settingsDraft,
                                general: { ...settingsDraft.general, heroStatMidValue: e.target.value },
                              })
                            }
                            placeholder="420+"
                            className="w-20 px-2.5 py-1.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-lg font-bold tabular-nums"
                          />
                          <input
                            value={settingsDraft.general?.heroStatMidLabel ?? 'COLLECTIONS CREATED'}
                            onChange={(e) =>
                              setSettingsDraft({
                                ...settingsDraft,
                                general: { ...settingsDraft.general, heroStatMidLabel: e.target.value },
                              })
                            }
                            placeholder="COLLECTIONS CREATED"
                            className="flex-1 px-2.5 py-1.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-lg uppercase"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block font-semibold text-[#111827]">Bottom-Left Stat</label>
                        <div className="flex gap-2">
                          <input
                            value={settingsDraft.general?.heroStatBottomValue ?? '95+'}
                            onChange={(e) =>
                              setSettingsDraft({
                                ...settingsDraft,
                                general: { ...settingsDraft.general, heroStatBottomValue: e.target.value },
                              })
                            }
                            placeholder="95+"
                            className="w-20 px-2.5 py-1.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-lg font-bold tabular-nums"
                          />
                          <input
                            value={settingsDraft.general?.heroStatBottomLabel ?? 'GLOBAL PARTNERS'}
                            onChange={(e) =>
                              setSettingsDraft({
                                ...settingsDraft,
                                general: { ...settingsDraft.general, heroStatBottomLabel: e.target.value },
                              })
                            }
                            placeholder="GLOBAL PARTNERS"
                            className="flex-1 px-2.5 py-1.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-lg uppercase"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      saveSettingsGroup('general', {
                        ...settingsDraft.general,
                        heroSlides: currentSlides,
                      })
                    }
                    className="px-5 py-2.5 ka-oak-btn rounded-xl font-semibold shadow-xs transition-all cursor-pointer"
                  >
                    Save General &amp; Hero Showcase Settings
                  </button>
                </div>
              );
            })()}

            {settingsTab === 'email' && (
              <div className="space-y-4 max-w-3xl">
                <div className="p-4 rounded-2xl bg-[#FAF6F0] border border-[#E5D7C6] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white border border-[#E5D7C6] text-[#8B5D36] flex items-center justify-center shrink-0">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-[#231912]">
                        Looking to edit transactional email templates &amp; visual design?
                      </p>
                      <p className="text-xs text-[#6E5644] mt-0.5">
                        All 7 order, inquiry, and quotation email templates, colors, hero banners, and live previews live in the Visual Email Studio.
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/admin/emails?tab=templates"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl ka-oak-btn text-xs font-semibold whitespace-nowrap shrink-0"
                  >
                    <span>Open Email Templates</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-medium mb-1">Sender Name</label>
                    <input
                      value={settingsDraft.email?.senderName || ''}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          email: { ...settingsDraft.email, senderName: e.target.value },
                        })
                      }
                      className="w-full px-3.5 py-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Sender Address</label>
                    <input
                      value={settingsDraft.email?.senderAddress || ''}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          email: { ...settingsDraft.email, senderAddress: e.target.value },
                        })
                      }
                      className="w-full px-3.5 py-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-medium mb-1">Admin Notification Email</label>
                    <input
                      value={settingsDraft.email?.adminNotificationEmail || ''}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          email: { ...settingsDraft.email, adminNotificationEmail: e.target.value },
                        })
                      }
                      className="w-full px-3.5 py-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    ['notifyAdminOnOrder', 'Notify Admin on New Order'],
                    ['notifyCustomerOnOrder', 'Email Customer Order Confirmation'],
                    ['notifyAdminOnInquiry', 'Notify Admin on New Inquiry'],
                    ['notifyCustomerOnInquiry', 'Email Customer Inquiry Receipt'],
                    ['notifyCustomerOnQuotation', 'Email Customer Quotation Portal Link'],
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2.5 p-3.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-2xl cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(settingsDraft.email?.[key])}
                        onChange={(e) =>
                          setSettingsDraft({
                            ...settingsDraft,
                            email: { ...settingsDraft.email, [key]: e.target.checked },
                          })
                        }
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => saveSettingsGroup('email', settingsDraft.email)}
                  className="px-5 py-2.5 bg-[#171717] hover:bg-[#0A0A0A] text-white rounded-xl font-semibold shadow-xs transition-all cursor-pointer"
                >
                  Save Email Settings
                </button>
              </div>
            )}

            {settingsTab === 'seo' && (
              <div className="space-y-4 max-w-3xl">
                <div>
                  <label className="block font-medium mb-1">Default Meta Title</label>
                  <input
                    value={settingsDraft.seo?.defaultMetaTitle || ''}
                    onChange={(e) =>
                      setSettingsDraft({
                        ...settingsDraft,
                        seo: { ...settingsDraft.seo, defaultMetaTitle: e.target.value },
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Default Meta Description</label>
                  <textarea
                    rows={3}
                    value={settingsDraft.seo?.defaultMetaDescription || ''}
                    onChange={(e) =>
                      setSettingsDraft({
                        ...settingsDraft,
                        seo: { ...settingsDraft.seo, defaultMetaDescription: e.target.value },
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => saveSettingsGroup('seo', settingsDraft.seo)}
                  className="px-5 py-2.5 bg-[#171717] hover:bg-[#0A0A0A] text-white rounded-xl font-semibold shadow-xs transition-all cursor-pointer"
                >
                  Save SEO Settings
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
