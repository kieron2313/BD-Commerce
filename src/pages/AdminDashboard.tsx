import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Award,
  SlidersHorizontal,
  Layers,
  Warehouse,
  ShoppingBag,
  MessageSquare,
  FileText,
  Users,
  TicketPercent,
  Truck,
  FileSpreadsheet,
  Image as ImageIcon,
  Globe,
  FileCode2,
  Mail,
  Palette,
  History,
  ShieldCheck,
  Settings,
  ArrowLeft,
  LogOut,
  Store,
  ChevronRight,
  Menu,
  X,
  ToggleRight,
  BookOpen,
  Receipt,
} from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { useAdminUi } from '../context/AdminUiContext';
import { SeoHead } from '../components/SeoHead';
import { AdminOverview } from './admin/AdminOverview';
import { AdminCatalog } from './admin/AdminCatalog';
import { AdminSales } from './admin/AdminSales';
import { AdminImportExport } from './admin/AdminImportExport';
import { AdminSystem, SettingsTab } from './admin/AdminSystem';
import { AdminEmails, EmailStudioTab } from './admin/AdminEmails';
import { AdminInvoices } from './admin/AdminInvoices';

interface SidebarItem {
  key: string;
  moduleId: string;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  subTab?: string;
}

interface DomainTheme {
  accent: string;
  softBg: string;
  softHover: string;
  border: string;
  ink: string;
}

interface SidebarDomain {
  domainId: string;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  theme: DomainTheme;
  items: SidebarItem[];
}

const SIDEBAR_DOMAINS: SidebarDomain[] = [
  {
    domainId: 'overview',
    label: 'Overview',
    icon: LayoutDashboard,
    theme: {
      accent: '#7C502B',
      softBg: '#FAF3EC',
      softHover: '#F3E6D8',
      border: '#E5D2BE',
      ink: '#543419',
    },
    items: [
      { key: 'dashboard', moduleId: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    domainId: 'catalog',
    label: 'Catalogue',
    icon: Package,
    theme: {
      accent: '#2E5A47',
      softBg: '#EFF6F2',
      softHover: '#E2EFE8',
      border: '#C4DDD0',
      ink: '#1E4032',
    },
    items: [
      { key: 'products', moduleId: 'products', label: 'Products', icon: Package },
      { key: 'categories', moduleId: 'categories', label: 'Categories', icon: FolderTree },
      { key: 'brands', moduleId: 'brands', label: 'Brands', icon: Award },
      { key: 'attributes', moduleId: 'attributes', label: 'Attributes', icon: SlidersHorizontal },
      { key: 'variations', moduleId: 'variations', label: 'Variations', icon: Layers },
      { key: 'inventory', moduleId: 'inventory', label: 'Inventory', icon: Warehouse },
    ],
  },
  {
    domainId: 'sales',
    label: 'Orders & Quotes',
    icon: ShoppingBag,
    theme: {
      accent: '#2D4C68',
      softBg: '#EFF4F9',
      softHover: '#E1EAF3',
      border: '#C5D5E5',
      ink: '#1E374D',
    },
    items: [
      { key: 'orders', moduleId: 'orders', label: 'Orders', icon: ShoppingBag },
      { key: 'invoices', moduleId: 'orders', label: 'Invoices', icon: Receipt },
      { key: 'inquiries', moduleId: 'inquiries', label: 'Inquiries', icon: MessageSquare },
      { key: 'quotations', moduleId: 'quotations', label: 'Quotations', icon: FileText },
      { key: 'customers', moduleId: 'customers', label: 'Customers', icon: Users },
      { key: 'coupons', moduleId: 'coupons', label: 'Coupons', icon: TicketPercent },
      { key: 'shipping', moduleId: 'shipping', label: 'Shipping', icon: Truck },
    ],
  },
  {
    domainId: 'emails',
    label: 'Emails',
    icon: Mail,
    theme: {
      accent: '#8C4735',
      softBg: '#FBF1EE',
      softHover: '#F5E3DD',
      border: '#E8C9BF',
      ink: '#622E21',
    },
    items: [
      {
        key: 'emails:templates',
        moduleId: 'email_templates',
        label: 'Templates & Copy',
        icon: Mail,
        subTab: 'templates',
      },
      {
        key: 'emails:design',
        moduleId: 'email_templates',
        label: 'Design & Branding',
        icon: Palette,
        subTab: 'design',
      },
      {
        key: 'emails:triggers',
        moduleId: 'email_templates',
        label: 'Sender & Triggers',
        icon: SlidersHorizontal,
        subTab: 'triggers',
      },
      {
        key: 'emails:logs',
        moduleId: 'email_templates',
        label: 'Sent Email Log',
        icon: History,
        subTab: 'logs',
      },
    ],
  },
  {
    domainId: 'content',
    label: 'Content & Data',
    icon: FileCode2,
    theme: {
      accent: '#5D4360',
      softBg: '#F6F1F7',
      softHover: '#EDE3EE',
      border: '#D8C7DA',
      ink: '#412D44',
    },
    items: [
      { key: 'pages', moduleId: 'pages', label: 'Pages CMS', icon: FileCode2 },
      { key: 'media', moduleId: 'media', label: 'Media Library', icon: ImageIcon },
      { key: 'seo', moduleId: 'seo', label: 'SEO & Redirects', icon: Globe },
      { key: 'import_export', moduleId: 'import_export', label: 'Import / Export', icon: FileSpreadsheet },
    ],
  },
  {
    domainId: 'system',
    label: 'Settings & Access',
    icon: Settings,
    theme: {
      accent: '#555832',
      softBg: '#F4F5EC',
      softHover: '#EAEBD9',
      border: '#D4D6B8',
      ink: '#3A3C20',
    },
    items: [
      {
        key: 'settings:commerce',
        moduleId: 'settings',
        label: 'eCommerce & Mode',
        icon: ToggleRight,
        subTab: 'commerce',
      },
      {
        key: 'settings:catalogue',
        moduleId: 'settings',
        label: 'Catalogue & RFQ',
        icon: BookOpen,
        subTab: 'catalogue',
      },
      {
        key: 'settings:general',
        moduleId: 'settings',
        label: 'General Store Info',
        icon: Store,
        subTab: 'general',
      },
      {
        key: 'settings:email',
        moduleId: 'settings',
        label: 'Email Defaults',
        icon: Mail,
        subTab: 'email',
      },
      {
        key: 'settings:seo',
        moduleId: 'settings',
        label: 'SEO Defaults',
        icon: Globe,
        subTab: 'seo',
      },
      {
        key: 'users',
        moduleId: 'users',
        label: 'Users & Roles',
        icon: ShieldCheck,
      },
    ],
  },
];

export const AdminDashboard: React.FC = () => {
  const { section } = useParams<{ section?: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    firebaseUser,
    authLoading,
    authError,
    userRole,
    userPermissions,
    isAdmin,
    operatingMode,
    signInWithGoogle,
    logout,
  } = usePlatform();

  const {
    lastActiveRoute,
    emailSubTab,
    settingsSubTab,
    sidebarScrollTop,
    setLastActiveRoute,
    setEmailSubTab,
    setSettingsSubTab,
    setSidebarScrollTop,
  } = useAdminUi();

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const hasRestoredRouteRef = useRef(false);
  const desktopNavRef = useRef<HTMLElement | null>(null);

  const normalizedSection = section === 'emails' ? 'email_templates' : section || 'dashboard';
  const queryTab = searchParams.get('tab');
  const emailTabParam = (
    normalizedSection === 'email_templates' && queryTab ? queryTab : emailSubTab
  ) as EmailStudioTab;
  const settingsTabParam = (
    normalizedSection === 'settings' && queryTab ? queryTab : settingsSubTab
  ) as SettingsTab;

  // On initial bare /admin mount, restore the last active tab route if preserved from prior session
  useEffect(() => {
    if (hasRestoredRouteRef.current) return;
    hasRestoredRouteRef.current = true;
    if (!section && lastActiveRoute && lastActiveRoute !== '/admin') {
      navigate(lastActiveRoute, { replace: true });
    }
  }, [section, lastActiveRoute, navigate]);

  // Keep persisted active route & sub-tab synced whenever the admin navigates
  useEffect(() => {
    if (!location.pathname.startsWith('/admin')) return;
    const fullRoute = `${location.pathname}${location.search}`;
    setLastActiveRoute(fullRoute);
    if (normalizedSection === 'email_templates' && queryTab) {
      setEmailSubTab(queryTab as EmailStudioTab);
    }
    if (normalizedSection === 'settings' && queryTab) {
      setSettingsSubTab(queryTab as SettingsTab);
    }
  }, [
    location.pathname,
    location.search,
    normalizedSection,
    queryTab,
    setLastActiveRoute,
    setEmailSubTab,
    setSettingsSubTab,
  ]);

  // Restore sidebar scroll position on refresh/mount
  useEffect(() => {
    if (desktopNavRef.current && sidebarScrollTop > 0) {
      desktopNavRef.current.scrollTop = sidebarScrollTop;
    }
  }, [isAdmin]);

  const canViewModule = (mod: string) => {
    if (userRole?.slug === 'super-administrator') return true;
    const perm = userPermissions.find((p) => p.module === mod);
    return Boolean(perm?.canView);
  };

  const visibleDomains = SIDEBAR_DOMAINS.map((domain) => ({
    ...domain,
    items: domain.items.filter((i) => canViewModule(i.moduleId)),
  })).filter((domain) => domain.items.length > 0);

  const activeItemKey =
    normalizedSection === 'email_templates'
      ? `emails:${emailTabParam}`
      : normalizedSection === 'settings'
      ? `settings:${settingsTabParam}`
      : normalizedSection;

  const activeDomain =
    visibleDomains.find((d) => d.items.some((i) => i.key === activeItemKey)) ||
    visibleDomains.find((d) => d.items.some((i) => i.moduleId === normalizedSection)) ||
    visibleDomains[0];

  const activeMeta =
    SIDEBAR_DOMAINS.flatMap((g) => g.items).find((i) => i.key === activeItemKey) ||
    SIDEBAR_DOMAINS.flatMap((g) => g.items).find((i) => i.moduleId === normalizedSection) ||
    SIDEBAR_DOMAINS[0].items[0];

  const handleSelectItem = (item: SidebarItem) => {
    setMobileDrawerOpen(false);
    if (item.moduleId === 'dashboard') {
      setLastActiveRoute('/admin');
      navigate('/admin');
    } else if (item.key === 'invoices') {
      navigate('/admin/invoices');
    } else if (item.moduleId === 'email_templates') {
      const nextTab = (item.subTab || 'templates') as EmailStudioTab;
      setEmailSubTab(nextTab);
      navigate(`/admin/emails?tab=${nextTab}`);
    } else if (item.moduleId === 'settings') {
      const nextTab = (item.subTab || 'commerce') as SettingsTab;
      setSettingsSubTab(nextTab);
      navigate(`/admin/settings?tab=${nextTab}`);
    } else {
      navigate(`/admin/${item.moduleId}`);
    }
  };

  const handleSelectDomain = (domain: typeof visibleDomains[number]) => {
    setMobileDrawerOpen(false);
    if (domain.domainId === activeDomain?.domainId) return;
    if (domain.domainId === 'emails') {
      const matchingSub =
        domain.items.find((i) => i.subTab === emailSubTab) || domain.items[0];
      if (matchingSub) handleSelectItem(matchingSub);
      return;
    }
    if (domain.domainId === 'system') {
      const matchingSub =
        domain.items.find((i) => i.subTab === settingsSubTab) || domain.items[0];
      if (matchingSub) handleSelectItem(matchingSub);
      return;
    }
    if (domain.items[0]) {
      handleSelectItem(domain.items[0]);
    }
  };

  const handleNavigateTab = (moduleId: string) => {
    setMobileDrawerOpen(false);
    if (moduleId === 'dashboard') {
      setLastActiveRoute('/admin');
      navigate('/admin');
    } else if (moduleId === 'email_templates') {
      navigate(`/admin/emails?tab=${emailSubTab}`);
    } else if (moduleId === 'settings') {
      navigate(`/admin/settings?tab=${settingsSubTab}`);
    } else {
      navigate(`/admin/${moduleId}`);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F7F7F8] flex items-center justify-center text-xs font-medium text-[#6B7280]">
        Verifying administrator session...
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div className="min-h-screen bg-[#F7F7F8] flex items-center justify-center p-6">
        <SeoHead title="Admin Sign In | Kanso Atelier" noIndex />
        <div className="bg-white border border-[#F0F1F3] shadow-[0_12px_32px_rgba(17,24,39,0.06)] rounded-3xl max-w-md w-full p-8 space-y-5 text-center">
          <span className="inline-block px-3 py-1 rounded-full bg-[#CCF3C6] text-[#14532D] text-xs font-bold">
            eCommerce & Catalogue Control Center
          </span>
          <p className="text-2xl font-extrabold tracking-tight text-[#111827]">Kanso Atelier</p>
          <div className="space-y-2">
            <h1 className="text-lg font-bold text-[#111827]">Backend Administration</h1>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              Sign in with Google (<span className="font-semibold text-[#111827]">ebazarcyprus@gmail.com</span>) to manage products, variations, stock, COD orders, inquiries, quotations, emails, and store settings.
            </p>
          </div>
          {authError && (
            <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 text-left">
              {authError}
            </div>
          )}
          <button
            type="button"
            onClick={() => signInWithGoogle()}
            className="w-full py-3 px-4 bg-[#171717] text-white text-xs font-semibold rounded-2xl hover:bg-[#0A0A0A] cursor-pointer shadow-sm transition-all"
          >
            Sign in with Google
          </button>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6B7280] hover:text-[#111827]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Storefront</span>
          </Link>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#F7F7F8] flex items-center justify-center p-6">
        <SeoHead title="Restricted Access | Kanso Atelier" noIndex />
        <div className="bg-white border border-[#F0F1F3] shadow-[0_12px_32px_rgba(17,24,39,0.06)] rounded-3xl max-w-md w-full p-8 space-y-4 text-center">
          <h1 className="text-lg font-bold text-[#111827]">Administrator Role Required</h1>
          <p className="text-xs text-[#6B7280] leading-relaxed">
            Signed in as <span className="font-semibold text-[#111827]">{firebaseUser.email}</span> (
            {userRole?.name || 'Customer'}). This account does not have administrative permissions. Sign in as the store owner or ask a Super Administrator to assign an admin role in Users & Roles.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              to="/"
              className="px-5 py-2.5 bg-[#171717] text-white text-xs font-semibold rounded-2xl hover:bg-[#0A0A0A]"
            >
              Back to Storefront
            </Link>
            <button
              type="button"
              onClick={() => logout()}
              className="px-5 py-2.5 bg-[#F3F4F6] text-xs font-semibold rounded-2xl text-[#111827] hover:bg-[#E5E7EB] cursor-pointer"
            >
              Switch Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  const ActiveDomainIcon = activeDomain?.icon || LayoutDashboard;
  const activeTheme = activeDomain?.theme || SIDEBAR_DOMAINS[0].theme;

  const ActiveSubmenuList = (
    <div className="flex flex-col h-full bg-white">
      {/* Contextual Submenu Header */}
      <div
        className="px-4 py-4 border-b flex items-center justify-between gap-2 shrink-0 transition-colors duration-200"
        style={{
          backgroundColor: activeTheme.softBg,
          borderColor: activeTheme.border,
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-xl text-white flex items-center justify-center shrink-0 shadow-xs transition-colors duration-200"
            style={{ backgroundColor: activeTheme.accent }}
          >
            <ActiveDomainIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p
              className="text-xs font-extrabold tracking-tight truncate transition-colors duration-200"
              style={{ color: activeTheme.ink }}
            >
              {activeDomain?.label}
            </p>
            <p className="text-[11px] text-[#6B7280] tabular-nums">
              {activeDomain?.items.length || 0}{' '}
              {(activeDomain?.items.length || 0) === 1 ? 'view' : 'views'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(false)}
          className="lg:hidden p-1.5 rounded-xl text-[#6B7280] hover:bg-white/70 hover:text-[#111827] cursor-pointer"
          aria-label="Close submenu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Submenu Items for the Current Main Menu Only */}
      <nav
        ref={desktopNavRef}
        onScroll={(e) => setSidebarScrollTop(e.currentTarget.scrollTop)}
        aria-label={`${activeDomain?.label || 'Admin'} Submenu`}
        className="flex-1 overflow-y-auto p-3 space-y-1.5"
      >
        {(activeDomain?.items || []).map((item) => {
          const ItemIcon = item.icon;
          const isActive =
            item.key === activeItemKey ||
            (!item.subTab && normalizedSection === item.key);
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleSelectItem(item)}
              style={
                {
                  '--sub-bg': isActive ? activeTheme.softBg : 'transparent',
                  '--sub-hover': isActive ? activeTheme.softBg : activeTheme.softBg,
                  '--sub-border': isActive ? activeTheme.border : 'transparent',
                  '--sub-text': isActive ? activeTheme.ink : '#4B5563',
                  '--sub-hover-text': activeTheme.ink,
                } as React.CSSProperties
              }
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs transition-all duration-150 cursor-pointer whitespace-nowrap bg-[var(--sub-bg)] hover:bg-[var(--sub-hover)] border-[var(--sub-border)] text-[var(--sub-text)] hover:text-[var(--sub-hover-text)] ${
                isActive ? 'font-bold shadow-2xs' : 'font-medium'
              }`}
            >
              <span
                className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-150"
                style={{
                  backgroundColor: isActive ? activeTheme.accent : '#F3F4F6',
                  color: isActive ? '#FFFFFF' : activeTheme.accent,
                }}
              >
                <ItemIcon className="w-3.5 h-3.5" />
              </span>
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Quiet Mode Summary */}
      <div className="p-4 border-t border-[#ECEAE5] bg-[#FAF9F7] shrink-0">
        <p className="text-xs font-semibold text-[#111827] truncate">
          {operatingMode === 'ecommerce' ? 'eCommerce Mode (COD)' : 'Catalogue / Inquiry Mode'}
        </p>
        <p className="text-[11px] text-[#6B7280] truncate mt-0.5">
          {firebaseUser.displayName || firebaseUser.email}
        </p>
      </div>
    </div>
  );

  return (
    <div
      className="min-h-screen text-[#111827] flex flex-col transition-colors duration-200"
      style={{
        backgroundColor: '#F6F5F2',
        backgroundImage: `linear-gradient(180deg, ${activeTheme.softBg}99 0%, #F6F5F2 240px)`,
      }}
    >
      <SeoHead title={`${activeMeta.label} | Kanso Atelier Admin`} noIndex />

      {/* Top Navigation Shell: Brand/Actions + Distinct Matching Main Menu Tabs */}
      <header className="sticky top-0 z-30 bg-white border-b border-[#ECEAE5]">
        <div
          className="h-[2px] w-full transition-colors duration-200"
          style={{ backgroundColor: activeTheme.accent }}
        />

        {/* Row 1: Brand Lockup & Quick Utility Actions */}
        <div className="h-12 sm:h-14 px-4 sm:px-6 flex items-center justify-between gap-6 border-b border-[#F1EFEA]">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-[#F5F4F0] text-[#111827] hover:bg-[#EAE8E1] cursor-pointer shrink-0"
              aria-label="Open submenu"
            >
              <Menu className="w-4 h-4" />
            </button>

            <Link to="/admin" className="flex items-center gap-2.5 min-w-0 shrink-0">
              <div
                className="w-8 h-8 rounded-xl text-white flex items-center justify-center font-extrabold text-xs shrink-0 shadow-xs transition-colors duration-200"
                style={{ backgroundColor: activeTheme.accent }}
              >
                K
              </div>
              <span className="text-sm font-extrabold tracking-tight text-[#111827] whitespace-nowrap">
                Kanso Atelier
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden md:flex items-center gap-1.5 text-xs text-[#6B7280] pr-3 border-r border-[#ECEAE5]">
              <span className="font-semibold text-[#111827] truncate max-w-[180px]">
                {firebaseUser.displayName || firebaseUser.email}
              </span>
              <span aria-hidden="true">·</span>
              <span className="whitespace-nowrap">{userRole?.name}</span>
            </div>

            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#F5F4F0] hover:bg-[#EAE8E1] text-[#111827] rounded-xl transition-all whitespace-nowrap shrink-0"
            >
              <Store className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Storefront</span>
            </Link>

            <button
              type="button"
              onClick={() => logout()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white border border-[#E6E4DD] hover:border-red-300 hover:bg-red-50 hover:text-red-700 text-[#4B5563] rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Row 2: Main Menu Horizontal Tabs — Harmonious Distinct Atelier Palette */}
        <nav
          aria-label="Admin Main Menu Tabs"
          className="h-12 sm:h-[52px] px-4 sm:px-6 bg-[#FAF9F7] flex items-center gap-2 overflow-x-auto no-scrollbar"
        >
          {visibleDomains.map((domain) => {
            const DomainIcon = domain.icon;
            const isDomainActive = activeDomain?.domainId === domain.domainId;
            const t = domain.theme;
            return (
              <button
                key={domain.domainId}
                type="button"
                onClick={() => handleSelectDomain(domain)}
                aria-current={isDomainActive ? 'page' : undefined}
                style={
                  {
                    '--tab-bg': isDomainActive ? t.accent : t.softBg,
                    '--tab-hover': isDomainActive ? t.accent : t.softHover,
                    '--tab-border': isDomainActive ? t.accent : t.border,
                    '--tab-text': isDomainActive ? '#FFFFFF' : t.ink,
                    boxShadow: isDomainActive ? `0 4px 12px -2px ${t.accent}3D` : undefined,
                  } as React.CSSProperties
                }
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs transition-all duration-150 cursor-pointer whitespace-nowrap shrink-0 bg-[var(--tab-bg)] hover:bg-[var(--tab-hover)] border-[var(--tab-border)] text-[var(--tab-text)] ${
                  isDomainActive ? 'font-bold' : 'font-semibold'
                }`}
              >
                <DomainIcon
                  className="w-3.5 h-3.5 shrink-0 transition-colors duration-150"
                  style={{ color: isDomainActive ? '#FFFFFF' : t.accent }}
                />
                <span>{domain.label}</span>
              </button>
            );
          })}
        </nav>
      </header>

      {/* Workspace Body: Left Submenu Sidebar (Current Main Menu Only) + Content */}
      <div className="flex-1 flex min-w-0">
        {/* Desktop Contextual Left Sidebar */}
        <aside className="hidden lg:block w-[248px] shrink-0 border-r border-[#ECEAE5] bg-white sticky top-[112px] h-[calc(100vh-112px)]">
          {ActiveSubmenuList}
        </aside>

        {/* Mobile Contextual Submenu Drawer */}
        {mobileDrawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-black/35 backdrop-blur-xs"
              onClick={() => setMobileDrawerOpen(false)}
            />
            <aside className="relative z-10 w-[264px] max-w-[85vw] h-full border-r border-[#ECEAE5] bg-white shadow-2xl">
              {ActiveSubmenuList}
            </aside>
          </div>
        )}

        {/* Active Module Viewport */}
        <main className="flex-1 min-w-0 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
          {/* Contextual Breadcrumb Trail */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs">
            <span
              className="font-semibold whitespace-nowrap transition-colors duration-200"
              style={{ color: activeTheme.accent }}
            >
              {activeDomain?.label}
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0" />
            <span className="text-[#111827] font-bold whitespace-nowrap">
              {activeMeta.label}
            </span>
          </nav>

          <div key={activeItemKey} className="ka-page-transition">
            {!canViewModule(normalizedSection === 'invoices' ? 'orders' : normalizedSection) ? (
              <div className="bg-white border border-[#F0F1F3] rounded-3xl p-8 text-center text-xs text-[#6B7280] shadow-xs">
                Your role ({userRole?.name}) does not have permission to view the {activeMeta.label} module.
              </div>
            ) : normalizedSection === 'dashboard' ? (
              <AdminOverview onNavigateTab={handleNavigateTab} />
            ) : ['products', 'categories', 'brands', 'attributes', 'variations', 'inventory'].includes(normalizedSection) ? (
              <AdminCatalog section={normalizedSection as any} />
            ) : normalizedSection === 'invoices' ? (
              <AdminInvoices />
            ) : ['orders', 'inquiries', 'quotations', 'customers', 'coupons', 'shipping'].includes(normalizedSection) ? (
              <AdminSales section={normalizedSection as any} />
            ) : normalizedSection === 'email_templates' ? (
              <AdminEmails
                activeSubTab={emailTabParam}
                onChangeSubTab={(tab) => {
                  setEmailSubTab(tab);
                  navigate(`/admin/emails?tab=${tab}`);
                }}
              />
            ) : normalizedSection === 'import_export' ? (
              <AdminImportExport />
            ) : ['media', 'seo', 'pages', 'users', 'settings'].includes(normalizedSection) ? (
              <AdminSystem
                section={normalizedSection as any}
                activeSettingsTab={normalizedSection === 'settings' ? settingsTabParam : undefined}
                onChangeSettingsTab={(tab) => {
                  setSettingsSubTab(tab);
                  navigate(`/admin/settings?tab=${tab}`);
                }}
              />
            ) : (
              <AdminOverview onNavigateTab={handleNavigateTab} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
