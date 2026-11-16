import React, { useEffect } from 'react';

interface SeoHeadProps {
  title: string;
  description?: string;
  canonicalPath?: string;
  noIndex?: boolean;
  ogImage?: string;
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
}

function setMetaTag(attrName: 'name' | 'property', attrValue: string, content: string) {
  let el = document.querySelector(`meta[${attrName}="${attrValue}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export const SeoHead: React.FC<SeoHeadProps> = ({
  title,
  description = '',
  canonicalPath,
  noIndex = false,
  ogImage,
  jsonLd,
}) => {
  useEffect(() => {
    document.title = title;
    if (description) {
      setMetaTag('name', 'description', description);
      setMetaTag('property', 'og:description', description);
      setMetaTag('name', 'twitter:description', description);
    }
    setMetaTag('property', 'og:title', title);
    setMetaTag('name', 'twitter:title', title);
    setMetaTag('name', 'robots', noIndex ? 'noindex, nofollow' : 'index, follow');

    const canonicalUrl =
      window.location.origin + (canonicalPath !== undefined ? canonicalPath : window.location.pathname);
    setMetaTag('property', 'og:url', canonicalUrl);

    if (ogImage) {
      const fullImg = ogImage.startsWith('http') ? ogImage : window.location.origin + ogImage;
      setMetaTag('property', 'og:image', fullImg);
    }

    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonicalUrl);

    const existingScript = document.getElementById('kanso-json-ld');
    if (existingScript) existingScript.remove();
    if (jsonLd) {
      const script = document.createElement('script');
      script.id = 'kanso-json-ld';
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }

    return () => {
      const s = document.getElementById('kanso-json-ld');
      if (s) s.remove();
    };
  }, [title, description, canonicalPath, noIndex, ogImage, jsonLd]);

  return null;
};
