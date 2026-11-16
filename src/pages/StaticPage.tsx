import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { SeoHead } from '../components/SeoHead';
import { fetchCachedQuery, getCachedQuery } from '../lib/prefetch';

export const StaticPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const url = slug ? `/api/pages/${slug}` : '';
  const initialCached = url ? getCachedQuery<{ page: any }>(url) : null;

  const [page, setPage] = useState<any>(() => initialCached?.page || null);
  const [loading, setLoading] = useState(() => !initialCached);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    const pageUrl = `/api/pages/${slug}`;
    const cached = getCachedQuery<{ page: any }>(pageUrl);
    setNotFound(false);

    if (cached?.page) {
      setPage(cached.page);
      setLoading(false);
    } else {
      setLoading(true);
    }

    fetchCachedQuery<{ page: any }>(pageUrl, {
      onRevalidate: (fresh) => {
        if (active && fresh?.page) setPage(fresh.page);
      },
    })
      .then((d) => {
        if (active && d?.page) setPage(d.page);
      })
      .catch(() => {
        if (active && !cached) setNotFound(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 space-y-4">
        <div className="h-10 bg-[#ECECEE] rounded-2xl w-1/2 animate-pulse" />
        <div className="h-48 bg-white rounded-3xl animate-pulse" />
      </div>
    );
  }

  if (notFound || !page) {
    return <NotFoundPage />;
  }

  return (
    <>
      <SeoHead
        title={page.seoTitle || `${page.title} | Kanso Atelier`}
        description={page.metaDescription || ''}
        canonicalPath={`/pages/${page.slug}`}
      />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <nav className="text-xs text-[#6B7280] mb-6 flex items-center gap-2">
          <Link to="/" className="hover:text-[#111827]">
            Home
          </Link>
          <span>/</span>
          <span className="text-[#111827] font-semibold">{page.title}</span>
        </nav>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-[#111827] mb-8">
          {page.title}
        </h1>
        <div className="bg-white border border-[#F0F1F3] shadow-[0_12px_32px_rgba(17,24,39,0.05)] rounded-3xl p-8 sm:p-10 text-base text-[#374151] leading-relaxed whitespace-pre-line">
          {page.content}
        </div>
      </div>
    </>
  );
};

export const NotFoundPage: React.FC = () => (
  <div className="max-w-xl mx-auto px-4 py-24 text-center">
    <SeoHead title="404 — Page Not Found | Kanso Atelier" noIndex />
    <div className="bg-white border border-[#F0F1F3] shadow-[0_12px_32px_rgba(17,24,39,0.06)] rounded-3xl p-10">
      <p className="text-xs font-mono font-bold text-[#6B7280] mb-2">404</p>
      <h1 className="text-3xl font-extrabold tracking-tight text-[#111827] mb-3">Page Not Found</h1>
      <p className="text-sm text-[#6B7280] mb-8">
        The page or object you are looking for does not exist or has been relocated.
      </p>
      <Link
        to="/shop"
        className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold ka-oak-btn rounded-2xl"
      >
        Browse Catalogue
      </Link>
    </div>
  </div>
);
