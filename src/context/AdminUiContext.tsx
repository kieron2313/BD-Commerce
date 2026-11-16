import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { EmailStudioTab } from '../pages/admin/AdminEmails';
import type { SettingsTab } from '../pages/admin/AdminSystem';

const STORAGE_KEY = 'ka_admin_ui_state_v1';

interface AdminUiPersistedState {
  collapsedDomains: string[];
  lastActiveRoute: string;
  emailSubTab: EmailStudioTab;
  settingsSubTab: SettingsTab;
  sidebarScrollTop: number;
}

const DEFAULT_STATE: AdminUiPersistedState = {
  collapsedDomains: [],
  lastActiveRoute: '/admin',
  emailSubTab: 'templates',
  settingsSubTab: 'commerce',
  sidebarScrollTop: 0,
};

function loadPersistedState(): AdminUiPersistedState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<AdminUiPersistedState>;
    return {
      collapsedDomains: Array.isArray(parsed.collapsedDomains) ? parsed.collapsedDomains : [],
      lastActiveRoute:
        typeof parsed.lastActiveRoute === 'string' && parsed.lastActiveRoute.startsWith('/admin')
          ? parsed.lastActiveRoute
          : '/admin',
      emailSubTab: parsed.emailSubTab || 'templates',
      settingsSubTab: parsed.settingsSubTab || 'commerce',
      sidebarScrollTop: typeof parsed.sidebarScrollTop === 'number' ? parsed.sidebarScrollTop : 0,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

interface AdminUiContextValue {
  collapsedDomains: string[];
  lastActiveRoute: string;
  emailSubTab: EmailStudioTab;
  settingsSubTab: SettingsTab;
  sidebarScrollTop: number;
  toggleDomainCollapse: (domainId: string) => void;
  ensureDomainExpanded: (domainId: string) => void;
  setLastActiveRoute: (route: string) => void;
  setEmailSubTab: (tab: EmailStudioTab) => void;
  setSettingsSubTab: (tab: SettingsTab) => void;
  setSidebarScrollTop: (scrollTop: number) => void;
}

const AdminUiContext = createContext<AdminUiContextValue | null>(null);

export const AdminUiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AdminUiPersistedState>(() => loadPersistedState());

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota or private-mode errors gracefully
    }
  }, [state]);

  const toggleDomainCollapse = useCallback((domainId: string) => {
    setState((prev) => {
      const exists = prev.collapsedDomains.includes(domainId);
      return {
        ...prev,
        collapsedDomains: exists
          ? prev.collapsedDomains.filter((id) => id !== domainId)
          : [...prev.collapsedDomains, domainId],
      };
    });
  }, []);

  const ensureDomainExpanded = useCallback((domainId: string) => {
    setState((prev) => {
      if (!prev.collapsedDomains.includes(domainId)) return prev;
      return {
        ...prev,
        collapsedDomains: prev.collapsedDomains.filter((id) => id !== domainId),
      };
    });
  }, []);

  const setLastActiveRoute = useCallback((route: string) => {
    if (!route.startsWith('/admin')) return;
    setState((prev) => (prev.lastActiveRoute === route ? prev : { ...prev, lastActiveRoute: route }));
  }, []);

  const setEmailSubTab = useCallback((tab: EmailStudioTab) => {
    setState((prev) => (prev.emailSubTab === tab ? prev : { ...prev, emailSubTab: tab }));
  }, []);

  const setSettingsSubTab = useCallback((tab: SettingsTab) => {
    setState((prev) => (prev.settingsSubTab === tab ? prev : { ...prev, settingsSubTab: tab }));
  }, []);

  const setSidebarScrollTop = useCallback((scrollTop: number) => {
    setState((prev) =>
      Math.abs(prev.sidebarScrollTop - scrollTop) < 8 ? prev : { ...prev, sidebarScrollTop: scrollTop }
    );
  }, []);

  return (
    <AdminUiContext.Provider
      value={{
        ...state,
        toggleDomainCollapse,
        ensureDomainExpanded,
        setLastActiveRoute,
        setEmailSubTab,
        setSettingsSubTab,
        setSidebarScrollTop,
      }}
    >
      {children}
    </AdminUiContext.Provider>
  );
};

export function useAdminUi(): AdminUiContextValue {
  const ctx = useContext(AdminUiContext);
  if (!ctx) {
    throw new Error('useAdminUi must be used inside AdminUiProvider');
  }
  return ctx;
}
