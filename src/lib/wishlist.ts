import { useEffect, useState, useCallback } from 'react';

const WISHLIST_KEY = 'ka_wishlist';
const WISHLIST_EVENT = 'ka-wishlist-change';

function readWishlist(): number[] {
  try {
    const raw = localStorage.getItem(WISHLIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n) => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

export function removeFromWishlist(productId: number) {
  const next = readWishlist().filter((id) => id !== productId);
  try {
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(WISHLIST_EVENT));
  } catch {
    // ignore storage errors
  }
}

export function useWishlistIds(): number[] {
  const [ids, setIds] = useState<number[]>(() => readWishlist());

  useEffect(() => {
    const sync = () => setIds(readWishlist());
    sync();
    window.addEventListener(WISHLIST_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(WISHLIST_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return ids;
}

export function useWishlist(productId: number) {
  const [saved, setSaved] = useState<boolean>(() => readWishlist().includes(productId));

  useEffect(() => {
    const sync = () => setSaved(readWishlist().includes(productId));
    sync();
    window.addEventListener(WISHLIST_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(WISHLIST_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [productId]);

  const toggle = useCallback(() => {
    const current = readWishlist();
    const exists = current.includes(productId);
    const next = exists ? current.filter((id) => id !== productId) : [...current, productId];
    try {
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(WISHLIST_EVENT));
    } catch {
      // ignore storage errors
    }
    setSaved(!exists);
  }, [productId]);

  return { saved, toggle };
}

