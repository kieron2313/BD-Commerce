import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { clearQueryCache } from '../lib/prefetch';

export interface PlatformSettings {
  general: Record<string, any>;
  commerce: Record<string, any>;
  catalogue: Record<string, any>;
  email: Record<string, any>;
  seo: Record<string, any>;
  invoice?: Record<string, any>;
}

export interface CategoryItem {
  id: number;
  parentId: number | null;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  icon: string;
  seoTitle: string;
  seoDescription: string;
  status: string;
  sortOrder: number;
  priceVisibility: string;
  stockVisibility: string;
  inquiryEnabled: string;
  displayLayout: string;
}

export interface BrandItem {
  id: number;
  name: string;
  slug: string;
  logoUrl: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
}

export interface AttributeItem {
  id: number;
  name: string;
  slug: string;
  displayType: 'swatch' | 'button' | 'dropdown';
  usedForVariations: boolean;
  usedForFiltering: boolean;
  values: Array<{
    id: number;
    attributeId: number;
    value: string;
    slug: string;
    colorHex: string;
  }>;
}

export interface CartItemData {
  id: number;
  productId: number;
  productName: string;
  productSlug: string;
  variationId: number | null;
  sku: string;
  imageUrl: string;
  variationLabel: string;
  quantity: number;
  stockQuantity: number;
  stockStatus: string;
  unitPrice: number | null;
  regularPrice: number | null;
  lineTotal: number | null;
  showPrices: boolean;
  showSku: boolean;
  categoryIds: number[];
}

export interface CartData {
  id: number;
  couponCode: string;
  shippingMethodId: number | null;
  items: CartItemData[];
  subtotal: number;
  itemCount: number;
}

export interface RolePermission {
  module: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

interface PlatformContextValue {
  loading: boolean;
  operatingMode: 'ecommerce' | 'catalogue';
  settings: PlatformSettings;
  categories: CategoryItem[];
  brands: BrandItem[];
  attributes: AttributeItem[];
  pages: Array<{ id: number; title: string; slug: string; sortOrder: number }>;
  redirects: Array<{ sourcePath: string; targetPath: string }>;
  cart: CartData;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  sessionId: string;
  refreshBootstrap: () => Promise<void>;
  addToCart: (params: {
    productId: number;
    variationId?: number | null;
    quantity?: number;
    selectedAttributes?: any[];
  }) => Promise<{ ok: boolean; error?: string }>;
  updateCartQty: (itemId: number, quantity: number) => Promise<void>;
  removeCartItem: (itemId: number) => Promise<void>;
  // Auth & RBAC
  firebaseUser: User | null;
  authLoading: boolean;
  authError: string;
  clearAuthError: () => void;
  dbUser: any;
  userRole: { id: number; name: string; slug: string } | null;
  userPermissions: RolePermission[];
  isAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const PlatformContext = createContext<PlatformContextValue | null>(null);

export const PlatformProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string>(() => localStorage.getItem('ka_session_id') || '');
  const [settings, setSettings] = useState<PlatformSettings>({
    general: {},
    commerce: { operatingMode: 'ecommerce', showPrices: true, showStock: true, showSkus: true },
    catalogue: {},
    email: {},
    seo: {},
    invoice: {},
  });
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [attributes, setAttributes] = useState<AttributeItem[]>([]);
  const [pages, setPages] = useState<Array<{ id: number; title: string; slug: string; sortOrder: number }>>([]);
  const [redirects, setRedirects] = useState<Array<{ sourcePath: string; targetPath: string }>>([]);
  const [cart, setCart] = useState<CartData>({
    id: 0,
    couponCode: '',
    shippingMethodId: null,
    items: [],
    subtotal: 0,
    itemCount: 0,
  });
  const [cartOpen, setCartOpen] = useState(false);

  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [dbUser, setDbUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<{ id: number; name: string; slug: string } | null>(null);
  const [userPermissions, setUserPermissions] = useState<RolePermission[]>([]);

  const refreshBootstrap = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      const storedSession = localStorage.getItem('ka_session_id');
      if (storedSession) headers['x-session-id'] = storedSession;
      const res = await fetch('/api/bootstrap', { headers });
      if (!res.ok) return;
      const data = await res.json();
      if (data.sessionId) {
        localStorage.setItem('ka_session_id', data.sessionId);
        setSessionId(data.sessionId);
      }
      clearQueryCache();
      setSettings(data.settings);
      setCategories(data.categories || []);
      setBrands(data.brands || []);
      setAttributes(data.attributes || []);
      setPages(data.pages || []);
      setRedirects(data.redirects || []);
      setCart(data.cart);
    } catch (err) {
      console.error('Bootstrap load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshBootstrap();
  }, [refreshBootstrap]);

  const syncAuthUser = useCallback(async (u: User | null) => {
    if (!u) {
      setDbUser(null);
      setUserRole(null);
      setUserPermissions([]);
      setAuthLoading(false);
      return;
    }
    try {
      const token = await u.getIdToken();
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDbUser(data.user);
        setUserRole(data.role);
        setUserPermissions(data.permissions || []);
        setAuthError('');
      } else {
        const errData = await res.json().catch(() => ({}));
        setAuthError(errData.error || 'Failed to verify administrator permissions.');
      }
    } catch (err) {
      console.error('Auth sync error:', err);
      setAuthError('Unable to reach authentication verification endpoint.');
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    getRedirectResult(auth).catch((err) => {
      if (err?.code && err.code !== 'auth/no-current-user') {
        setAuthError(err.message || 'Google sign-in redirect failed.');
      }
    });
    const unsub = onAuthStateChanged(auth, (u) => {
      setFirebaseUser(u);
      syncAuthUser(u);
    });
    return () => unsub();
  }, [syncAuthUser]);

  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const headers: Record<string, string> = {
        ...(options.headers as Record<string, string>),
      };
      if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
      }
      const sid = localStorage.getItem('ka_session_id');
      if (sid) headers['x-session-id'] = sid;
      if (auth.currentUser) {
        const token = await auth.currentUser.getIdToken();
        headers['Authorization'] = `Bearer ${token}`;
      }
      return fetch(url, { ...options, headers });
    },
    []
  );

  const addToCart = useCallback(
    async (params: {
      productId: number;
      variationId?: number | null;
      quantity?: number;
      selectedAttributes?: any[];
    }) => {
      const res = await authFetch('/api/cart/items', {
        method: 'POST',
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.error || 'Could not add item.' };
      }
      setCart(data);
      setCartOpen(true);
      return { ok: true };
    },
    [authFetch]
  );

  const updateCartQty = useCallback(
    async (itemId: number, quantity: number) => {
      const res = await authFetch(`/api/cart/items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity }),
      });
      if (res.ok) {
        setCart(await res.json());
      }
    },
    [authFetch]
  );

  const removeCartItem = useCallback(
    async (itemId: number) => {
      const res = await authFetch(`/api/cart/items/${itemId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setCart(await res.json());
      }
    },
    [authFetch]
  );

  const signInWithGoogle = useCallback(async () => {
    setAuthError('');
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      await syncAuthUser(cred.user);
    } catch (err: any) {
      const code = err?.code || '';
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment'
      ) {
        await signInWithRedirect(auth, googleAuthProvider);
        return;
      }
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setAuthError('Sign-in popup was closed before completion. Please try again.');
        return;
      }
      setAuthError(err?.message || 'Google sign-in failed. Please allow popups or try again.');
    }
  }, [syncAuthUser]);

  const logout = useCallback(async () => {
    await signOut(auth);
    setAuthError('');
    setDbUser(null);
    setUserRole(null);
    setUserPermissions([]);
  }, []);

  const clearAuthError = useCallback(() => setAuthError(''), []);

  const operatingMode = (settings.commerce?.operatingMode || 'ecommerce') as 'ecommerce' | 'catalogue';
  const isAdmin = Boolean(
    userRole && userRole.slug !== 'customer'
  );

  return (
    <PlatformContext.Provider
      value={{
        loading,
        operatingMode,
        settings,
        categories,
        brands,
        attributes,
        pages,
        redirects,
        cart,
        cartOpen,
        setCartOpen,
        sessionId,
        refreshBootstrap,
        addToCart,
        updateCartQty,
        removeCartItem,
        firebaseUser,
        authLoading,
        authError,
        clearAuthError,
        dbUser,
        userRole,
        userPermissions,
        isAdmin,
        signInWithGoogle,
        logout,
        authFetch,
      }}
    >
      {children}
    </PlatformContext.Provider>
  );
};

export function usePlatform() {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error('usePlatform must be used within PlatformProvider');
  return ctx;
}
