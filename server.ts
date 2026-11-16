import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import storefrontRouter from './src/server/routes/storefront.ts';
import adminRouter from './src/server/routes/admin.ts';
import { db } from './src/db/index.ts';
import { products, categories, brands, websitePages, settings } from './src/db/schema.ts';
import { eq } from 'drizzle-orm';
import { ensureSeeded } from './src/db/seed.ts';

dotenv.config();

const app = express();
const PORT = 3000;

// Security headers & payload limits
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Lightweight in-memory rate limiter for API mutations
const rateHits = new Map<string, { count: number; resetAt: number }>();
app.use('/api', (req, res, next) => {
  if (req.method === 'GET') return next();
  const key = req.ip || 'unknown';
  const now = Date.now();
  const entry = rateHits.get(key);
  if (!entry || now > entry.resetAt) {
    rateHits.set(key, { count: 1, resetAt: now + 60_000 });
    return next();
  }
  entry.count++;
  if (entry.count > 180) {
    return res.status(429).json({ error: 'Too many requests. Please slow down.' });
  }
  next();
});

// Serve generated & uploaded media assets cleanly with aggressive HTTP caching
app.use(
  '/src/assets/images',
  express.static(path.join(process.cwd(), 'src', 'assets', 'images'), {
    maxAge: '365d',
    immutable: true,
  })
);
app.use(
  '/uploads',
  express.static(path.join(process.cwd(), 'public', 'uploads'), {
    maxAge: '1d',
  })
);

// Dynamic XML Sitemap (SEF URLs)
app.get('/sitemap.xml', async (req, res) => {
  try {
    await ensureSeeded();
    const baseUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const [prods, cats, brds, pgs] = await Promise.all([
      db.select({ slug: products.slug, updatedAt: products.updatedAt }).from(products).where(eq(products.status, 'published')),
      db.select({ id: categories.id, parentId: categories.parentId, slug: categories.slug }).from(categories).where(eq(categories.status, 'active')),
      db.select({ slug: brands.slug }).from(brands).where(eq(brands.status, 'active')),
      db.select({ slug: websitePages.slug, updatedAt: websitePages.updatedAt }).from(websitePages).where(eq(websitePages.isPublished, true)),
    ]);

    const catById = new Map(cats.map((c) => [c.id, c]));
    const urls: Array<{ loc: string; lastmod?: string }> = [
      { loc: `${baseUrl}/` },
      { loc: `${baseUrl}/shop` },
    ];

    for (const c of cats) {
      if (c.parentId && catById.has(c.parentId)) {
        urls.push({ loc: `${baseUrl}/categories/${catById.get(c.parentId)!.slug}/${c.slug}` });
      } else {
        urls.push({ loc: `${baseUrl}/categories/${c.slug}` });
      }
    }
    for (const b of brds) urls.push({ loc: `${baseUrl}/brands/${b.slug}` });
    for (const p of prods) urls.push({ loc: `${baseUrl}/products/${p.slug}`, lastmod: p.updatedAt?.toISOString() });
    for (const pg of pgs) urls.push({ loc: `${baseUrl}/pages/${pg.slug}`, lastmod: pg.updatedAt?.toISOString() });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ''}
  </url>`
  )
  .join('\n')}
</urlset>`;
    res.setHeader('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    console.error('Sitemap error:', err);
    res.status(500).send('Error generating sitemap');
  }
});

// Dynamic Robots.txt (Excludes private/non-indexable routes per Section 19)
app.get('/robots.txt', async (req, res) => {
  await ensureSeeded();
  const baseUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  const seoRow = await db.select().from(settings).where(eq(settings.key, 'seo')).limit(1);
  const policy = (seoRow[0]?.value as any)?.robotsPolicy || 'index, follow';
  const disallowAll = policy.includes('noindex');
  const txt = disallowAll
    ? `User-agent: *\nDisallow: /\n`
    : `User-agent: *
Allow: /
Disallow: /admin
Disallow: /cart
Disallow: /checkout
Disallow: /inquiry
Disallow: /quotation/
Disallow: /account
Disallow: /api/

Sitemap: ${baseUrl}/sitemap.xml
`;
  res.setHeader('Content-Type', 'text/plain');
  res.send(txt);
});

// API Routes
app.use('/api', storefrontRouter);
app.use('/api/admin', adminRouter);

// Health Check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Kanso Atelier server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
