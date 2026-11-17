/**
 * Snapify — module Boutique
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { defineServerModule, type FindQuery, type ModuleRequest, type RecordFilter, type ServerContext, type StoredRecord } from '@snapify/sdk';
import { roundMoney, type LineRef, type PricedLine, type ProductCard, type ShopServices } from '@snapify/sdk/commerce';
import { cleanHtml, slugify } from './shared';
import type { Category, Product, Settings } from './types';

const SORTS: Record<string, FindQuery['orderBy']> = {
  featured: [{ field: 'featured', dir: 'desc' }, { field: 'position', dir: 'asc', numeric: true }, { field: 'createdAt', dir: 'desc' }],
  latest: [{ field: 'createdAt', dir: 'desc' }],
  'price-asc': [{ field: 'price', dir: 'asc', numeric: true }],
  'price-desc': [{ field: 'price', dir: 'desc', numeric: true }],
  name: [{ field: 'name', dir: 'asc' }],
  bestsellers: [{ field: 'sales', dir: 'desc', numeric: true }, { field: 'createdAt', dir: 'desc' }],
};

const MAX_IMAGES = 12;
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.replace(',', '.')) : NaN);
const int = (v: unknown, def: number, min: number, max: number) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
const isUrl = (v: string) => /^(\/[^\s]*|https:\/\/[^\s]+)$/.test(v);

export default defineServerModule<Settings>({
  activate(ctx: ServerContext<Settings>) {
    const products = ctx.db.collection<Product>('products');
    const categories = ctx.db.collection<Category>('categories');
    const s = () => ctx.settings();

    /* ---------------------------------------------------------------- Présentation */

    const toCard = (p: StoredRecord<Product>): ProductCard => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      image: p.images[0] ?? '',
      images: p.images.slice(0, 2),
      badge: p.badge,
      inStock: p.inStock,
      stock: p.trackStock ? p.stock : null,
      currency: s().currency,
      shortDescription: p.shortDescription,
    });

    const publicCategory = (c: StoredRecord<Category>, count?: number) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      image: c.image,
      ...(count !== undefined ? { count } : {}),
    });

    let categoryCache: { at: number; list: ReturnType<typeof publicCategory>[] } | null = null;
    const invalidate = () => {
      categoryCache = null;
    };

    const visibleWhere = (): { where: Record<string, unknown> } => ({ where: s().hideOutOfStock ? { status: 'active', inStock: true } : { status: 'active' } });

    async function listCategories() {
      if (categoryCache && Date.now() - categoryCache.at < 30_000) return categoryCache.list;
      const { items } = await categories.find({ orderBy: [{ field: 'position', dir: 'asc', numeric: true }, { field: 'name', dir: 'asc' }], limit: 200 });
      const counts = await Promise.all(items.map((c) => products.count({ ...visibleWhere(), filters: [{ field: 'categoryIds', op: 'contains', value: c.id }] })));
      const list = items.map((c, i) => publicCategory(c, counts[i]));
      categoryCache = { at: Date.now(), list };
      return list;
    }

    /* ---------------------------------------------------------------- Services */

    async function priceLines(lines: LineRef[]) {
      const clean = normalizeLines(lines);
      const found = new Map((await products.getMany(clean.map((l) => l.productId))).map((p) => [p.id, p]));
      const out: PricedLine[] = [];
      const issues: { productId: string; message: string }[] = [];
      for (const l of clean) {
        const p = found.get(l.productId);
        if (!p || p.status !== 'active') {
          issues.push({ productId: l.productId, message: 'Ce produit n’est plus disponible.' });
          continue;
        }
        const maxQty = p.trackStock ? Math.max(0, p.stock) : null;
        if (maxQty === 0) {
          issues.push({ productId: p.id, message: `« ${p.name} » est épuisé.` });
          continue;
        }
        let qty = l.qty;
        if (maxQty !== null && qty > maxQty) {
          issues.push({ productId: p.id, message: `Plus que ${maxQty} « ${p.name} » en stock : quantité ajustée.` });
          qty = maxQty;
        }
        out.push({ productId: p.id, name: p.name, slug: p.slug, sku: p.sku, image: p.images[0] ?? '', price: p.price, qty, lineTotal: roundMoney(p.price * qty), maxQty });
      }
      return { lines: out, subtotal: roundMoney(out.reduce((n, l) => n + l.lineTotal, 0)), currency: s().currency, issues };
    }

    const services: ShopServices = {
      currency: () => s().currency,
      priceLines,
      decrementStock: (lines) =>
        ctx.lock('stock', async () => {
          const clean = normalizeLines(lines);
          const found = new Map((await products.getMany(clean.map((l) => l.productId))).map((p) => [p.id, p]));
          for (const l of clean) {
            const p = found.get(l.productId);
            if (!p || p.status !== 'active') throw ctx.error(409, 'Un produit de votre panier n’est plus disponible.');
            if (p.trackStock && p.stock < l.qty) throw ctx.error(409, p.stock > 0 ? `Plus que ${p.stock} « ${p.name} » en stock.` : `« ${p.name} » vient d’être épuisé.`);
          }
          for (const l of clean) {
            const p = found.get(l.productId)!;
            const stock = p.trackStock ? p.stock - l.qty : p.stock;
            await products.update(p.id, { stock, inStock: !p.trackStock || stock > 0, sales: (p.sales || 0) + l.qty });
          }
          invalidate();
        }),
      restoreStock: (lines) =>
        ctx.lock('stock', async () => {
          const clean = normalizeLines(lines);
          for (const p of await products.getMany(clean.map((l) => l.productId))) {
            const qty = clean.find((l) => l.productId === p.id)!.qty;
            const stock = p.trackStock ? p.stock + qty : p.stock;
            await products.update(p.id, { stock, inStock: !p.trackStock || stock > 0, sales: Math.max(0, (p.sales || 0) - qty) });
          }
          invalidate();
        }),
    };
    ctx.provide(services);

    /* ---------------------------------------------------------------- Routes publiques */

    ctx.http.get('/catalog', async (req) => {
      const q = req.query;
      const perPage = int(q.perPage, s().perPage, 4, 48);
      const page = int(q.page, 1, 1, 1000);
      const filters: RecordFilter[] = [];
      let category: ReturnType<typeof publicCategory> | null = null;
      if (q.category) {
        const c = await categories.findOne({ slug: str(q.category, 80) });
        if (!c) throw ctx.error(404, 'Catégorie introuvable');
        category = publicCategory(c);
        filters.push({ field: 'categoryIds', op: 'contains', value: c.id });
      }
      const min = num(q.min);
      const max = num(q.max);
      if (Number.isFinite(min) && min > 0) filters.push({ field: 'price', op: 'gte', value: min });
      if (Number.isFinite(max) && max > 0) filters.push({ field: 'price', op: 'lte', value: max });
      const base = visibleWhere();
      const where = { ...base.where, ...(q.stock === '1' ? { inStock: true } : {}), ...(q.sale === '1' ? { onSale: true } : {}) };
      const text = str(q.q, 100);
      const { items, total } = await products.find({
        where,
        filters,
        search: text ? { fields: ['name', 'shortDescription', 'sku'], text } : undefined,
        orderBy: SORTS[q.sort] ?? SORTS[s().defaultSort] ?? SORTS.featured,
        limit: perPage,
        offset: (page - 1) * perPage,
      });
      return { items: items.map(toCard), total, page, perPage, pages: Math.max(1, Math.ceil(total / perPage)), category, categories: await listCategories() };
    });

    ctx.http.get('/categories', async () => ({ categories: await listCategories() }));

    ctx.http.get('/products/:slug', async (req) => {
      const p = await products.findOne({ slug: str(req.params.slug, 120), status: 'active' });
      if (!p) throw ctx.error(404, 'Produit introuvable');
      const cats = await categories.getMany(p.categoryIds);
      const { items: related } = p.categoryIds.length
        ? await products.find({
            ...visibleWhere(),
            filters: [
              { field: 'categoryIds', op: 'contains', value: p.categoryIds[0] },
              { field: 'id', op: 'ne', value: p.id },
            ],
            orderBy: SORTS.bestsellers,
            limit: 4,
          })
        : { items: [] };
      return {
        product: {
          ...toCard(p),
          images: p.images,
          sku: p.sku,
          description: p.description,
          seoTitle: p.seoTitle || '',
          seoDescription: p.seoDescription || p.shortDescription,
          lowStock: p.trackStock && p.stock > 0 && p.stock <= s().lowStockThreshold,
        },
        categories: cats.map((c) => publicCategory(c)),
        related: related.map(toCard),
      };
    });

    ctx.http.get('/widget/products', async (req) => {
      const q = req.query;
      const limit = int(q.limit, 8, 1, 24);
      const where: Record<string, unknown> = { ...visibleWhere().where };
      const filters: RecordFilter[] = [];
      let orderBy = SORTS.featured;
      switch (q.source) {
        case 'featured':
          where.featured = true;
          break;
        case 'latest':
          orderBy = SORTS.latest;
          break;
        case 'sale':
          where.onSale = true;
          break;
        case 'bestsellers':
          orderBy = SORTS.bestsellers;
          break;
        case 'category': {
          const c = q.category ? await categories.findOne({ slug: str(q.category, 80) }) : null;
          if (!c) return { items: [], category: null };
          filters.push({ field: 'categoryIds', op: 'contains', value: c.id });
          const { items } = await products.find({ where, filters, orderBy, limit });
          return { items: items.map(toCard), category: publicCategory(c) };
        }
      }
      let { items } = await products.find({ where, filters, orderBy, limit });
      // Aucun produit mis en avant : la sélection reprend les nouveautés plutôt que d'afficher un bloc vide.
      if (!items.length && q.source === 'featured') ({ items } = await products.find({ ...visibleWhere(), orderBy: SORTS.latest, limit }));
      return { items: items.map(toCard), category: null };
    });

    ctx.http.get('/search', async (req) => {
      const text = str(req.query.q, 100);
      if (text.length < 2) return { items: [] };
      const { items } = await products.find({ ...visibleWhere(), search: { fields: ['name', 'shortDescription', 'sku'], text }, orderBy: SORTS.bestsellers, limit: 6 });
      return { items: items.map(toCard) };
    });

    ctx.http.post('/lookup', async (req) => {
      const ids = Array.isArray((req.body as { ids?: unknown })?.ids) ? ((req.body as { ids: unknown[] }).ids.filter((x) => typeof x === 'string') as string[]).slice(0, 200) : [];
      const found = await products.getMany(ids);
      return { items: found.filter((p) => p.status === 'active').map(toCard) };
    });

    /* ---------------------------------------------------------------- Administration */

    function cleanProduct(input: unknown, current?: StoredRecord<Product>): Product {
      const b = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
      const name = str(b.name ?? current?.name, 160);
      if (!name) throw ctx.error(422, 'Le nom du produit est obligatoire.');
      const slug = slugify(str(b.slug, 120) || name).slice(0, 120);
      if (!slug) throw ctx.error(422, 'Adresse du produit invalide.');
      const price = roundMoney(num(b.price));
      if (!Number.isFinite(price) || price < 0 || price > 10_000_000) throw ctx.error(422, 'Prix invalide.');
      const cmpRaw = b.compareAtPrice === null || b.compareAtPrice === '' || b.compareAtPrice === undefined ? null : roundMoney(num(b.compareAtPrice));
      if (cmpRaw !== null && (!Number.isFinite(cmpRaw) || cmpRaw < 0)) throw ctx.error(422, 'Prix barré invalide.');
      const compareAtPrice = cmpRaw && cmpRaw > price ? cmpRaw : null;
      const trackStock = b.trackStock !== false;
      const stock = int(b.stock, 0, 0, 1_000_000);
      const images = (Array.isArray(b.images) ? b.images : [])
        .filter((x): x is string => typeof x === 'string')
        .map((x) => x.trim())
        .filter(isUrl)
        .slice(0, MAX_IMAGES);
      const categoryIds = (Array.isArray(b.categoryIds) ? b.categoryIds : []).filter((x): x is string => typeof x === 'string').slice(0, 20);
      return {
        name,
        slug,
        sku: str(b.sku, 60),
        price,
        compareAtPrice,
        onSale: compareAtPrice !== null,
        stock,
        trackStock,
        inStock: !trackStock || stock > 0,
        images,
        description: cleanHtml(str(b.description, 60_000)),
        shortDescription: str(b.shortDescription, 400),
        categoryIds,
        status: b.status === 'draft' ? 'draft' : 'active',
        featured: b.featured === true,
        badge: str(b.badge, 24),
        sales: current?.sales ?? 0,
        position: int(b.position, current?.position ?? 0, 0, 100_000),
        seoTitle: str(b.seoTitle, 70),
        seoDescription: str(b.seoDescription, 200),
      };
    }

    async function assertUniqueSlug(slug: string, id?: string) {
      const other = await products.findOne({ slug });
      if (other && other.id !== id) throw ctx.error(409, `L’adresse « ${slug} » est déjà utilisée par « ${other.name} ».`);
    }

    async function checkCategories(ids: string[]) {
      const found = await categories.getMany(ids);
      return found.map((c) => c.id);
    }

    const adminRow = (p: StoredRecord<Product>) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      stock: p.stock,
      trackStock: p.trackStock,
      image: p.images[0] ?? '',
      status: p.status,
      featured: p.featured,
      categoryIds: p.categoryIds,
      sales: p.sales || 0,
      lowStock: p.trackStock && p.stock <= s().lowStockThreshold,
      updatedAt: p.updatedAt,
    });

    ctx.admin.get('/products', async (req: ModuleRequest) => {
      const q = req.query;
      const size = int(q.size, 25, 1, 100);
      const page = int(q.page, 1, 1, 10_000);
      const where: Record<string, unknown> = {};
      const filters: RecordFilter[] = [];
      if (q.status === 'active' || q.status === 'draft') where.status = q.status;
      if (q.category) filters.push({ field: 'categoryIds', op: 'contains', value: str(q.category, 64) });
      if (q.stock === 'out') where.inStock = false;
      if (q.stock === 'low') {
        where.trackStock = true;
        filters.push({ field: 'stock', op: 'lte', value: s().lowStockThreshold });
      }
      if (q.featured === '1') where.featured = true;
      const text = str(q.q, 100);
      const { items, total } = await products.find({
        where,
        filters,
        search: text ? { fields: ['name', 'sku', 'slug'], text } : undefined,
        orderBy: SORTS[q.sort] ?? [{ field: 'updatedAt', dir: 'desc' }],
        limit: size,
        offset: (page - 1) * size,
      });
      return { items: items.map(adminRow), total };
    });

    ctx.admin.get('/products/:id', async (req) => {
      const p = await products.get(req.params.id);
      if (!p) throw ctx.error(404, 'Produit introuvable');
      return { product: p };
    });

    ctx.admin.post('/products', async (req) => {
      const data = cleanProduct(req.body);
      await assertUniqueSlug(data.slug);
      data.categoryIds = await checkCategories(data.categoryIds);
      const p = await products.insert(data);
      invalidate();
      return { product: p };
    });

    ctx.admin.put('/products/:id', async (req) => {
      const current = await products.get(req.params.id);
      if (!current) throw ctx.error(404, 'Produit introuvable');
      const data = cleanProduct(req.body, current);
      await assertUniqueSlug(data.slug, current.id);
      data.categoryIds = await checkCategories(data.categoryIds);
      const p = await ctx.lock('stock', () => products.update(current.id, data));
      invalidate();
      return { product: p };
    });

    ctx.admin.post('/products/:id/duplicate', async (req) => {
      const p = await products.get(req.params.id);
      if (!p) throw ctx.error(404, 'Produit introuvable');
      const { id: _id, createdAt: _c, updatedAt: _u, ...data } = p;
      let slug = `${p.slug}-copie`;
      for (let i = 2; await products.findOne({ slug }); i++) slug = `${p.slug}-copie-${i}`;
      const copy = await products.insert({ ...data, name: `${p.name} (copie)`, slug, status: 'draft', sales: 0, featured: false });
      invalidate();
      return { product: copy };
    });

    ctx.admin.delete('/products/:id', async (req) => {
      if (!(await products.delete(req.params.id))) throw ctx.error(404, 'Produit introuvable');
      invalidate();
      return { ok: true };
    });

    ctx.admin.post('/products/bulk', async (req) => {
      const b = (req.body ?? {}) as { ids?: unknown; action?: unknown };
      const ids = Array.isArray(b.ids) ? (b.ids.filter((x) => typeof x === 'string') as string[]).slice(0, 500) : [];
      let done = 0;
      for (const id of ids) {
        if (b.action === 'delete') done += (await products.delete(id)) ? 1 : 0;
        else if (b.action === 'activate' || b.action === 'draft') done += (await products.update(id, { status: b.action === 'activate' ? 'active' : 'draft' })) ? 1 : 0;
        else if (b.action === 'feature' || b.action === 'unfeature') done += (await products.update(id, { featured: b.action === 'feature' })) ? 1 : 0;
        else throw ctx.error(400, 'Action inconnue');
      }
      invalidate();
      return { done };
    });

    ctx.admin.get('/categories', async () => {
      const { items } = await categories.find({ orderBy: [{ field: 'position', dir: 'asc', numeric: true }, { field: 'name', dir: 'asc' }], limit: 200 });
      const counts = await Promise.all(items.map((c) => products.count({ filters: [{ field: 'categoryIds', op: 'contains', value: c.id }] })));
      return { categories: items.map((c, i) => ({ ...c, count: counts[i] })) };
    });

    function cleanCategory(input: unknown, current?: Category): Category {
      const b = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
      const name = str(b.name, 80);
      if (!name) throw ctx.error(422, 'Le nom de la catégorie est obligatoire.');
      const slug = slugify(str(b.slug, 80) || name).slice(0, 80);
      if (!slug) throw ctx.error(422, 'Adresse de la catégorie invalide.');
      const image = str(b.image, 400);
      return { name, slug, description: str(b.description, 1000), image: image && isUrl(image) ? image : '', position: int(b.position, current?.position ?? 0, 0, 10_000) };
    }

    async function assertUniqueCategorySlug(slug: string, id?: string) {
      const other = await categories.findOne({ slug });
      if (other && other.id !== id) throw ctx.error(409, `L’adresse « ${slug} » est déjà utilisée par la catégorie « ${other.name} ».`);
    }

    ctx.admin.post('/categories', async (req) => {
      const data = cleanCategory(req.body);
      await assertUniqueCategorySlug(data.slug);
      data.position = (await categories.count()) + 1;
      const c = await categories.insert(data);
      invalidate();
      return { category: c };
    });

    ctx.admin.put('/categories/:id', async (req) => {
      const current = await categories.get(req.params.id);
      if (!current) throw ctx.error(404, 'Catégorie introuvable');
      const data = cleanCategory(req.body, current);
      await assertUniqueCategorySlug(data.slug, current.id);
      const c = await categories.update(current.id, data);
      invalidate();
      return { category: c };
    });

    ctx.admin.post('/categories/reorder', async (req) => {
      const ids = Array.isArray((req.body as { ids?: unknown })?.ids) ? ((req.body as { ids: unknown[] }).ids.filter((x) => typeof x === 'string') as string[]).slice(0, 200) : [];
      for (const [i, id] of ids.entries()) await categories.update(id, { position: i + 1 });
      invalidate();
      return { ok: true };
    });

    ctx.admin.delete('/categories/:id', async (req) => {
      const id = req.params.id;
      if (!(await categories.delete(id))) throw ctx.error(404, 'Catégorie introuvable');
      for (;;) {
        const { items } = await products.find({ filters: [{ field: 'categoryIds', op: 'contains', value: id }], limit: 200 });
        if (!items.length) break;
        for (const p of items) await products.update(p.id, { categoryIds: p.categoryIds.filter((c) => c !== id) });
      }
      invalidate();
      return { ok: true };
    });

    ctx.admin.status(async () => {
      const threshold = s().lowStockThreshold;
      const [active, drafts, out, low] = await Promise.all([
        products.count({ where: { status: 'active' } }),
        products.count({ where: { status: 'draft' } }),
        products.count({ where: { status: 'active', inStock: false } }),
        products.count({ where: { status: 'active', trackStock: true, inStock: true }, filters: [{ field: 'stock', op: 'lte', value: threshold }] }),
      ]);
      return {
        stats: [
          { label: 'Produits en ligne', value: active },
          { label: 'Brouillons', value: drafts },
          { label: 'Épuisés', value: out },
          { label: 'Stock faible', value: low, hint: `≤ ${threshold}` },
        ],
        alerts: out ? [{ tone: 'warning', text: `${out} produit${out > 1 ? 's' : ''} en ligne ${out > 1 ? 'sont épuisés' : 'est épuisé'}.` }] : [],
      };
    });
  },
});

function normalizeLines(lines: LineRef[]): LineRef[] {
  const merged = new Map<string, number>();
  for (const l of Array.isArray(lines) ? lines.slice(0, 100) : []) {
    if (!l || typeof l.productId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(l.productId)) continue;
    const qty = Math.floor(Number(l.qty));
    if (!Number.isFinite(qty) || qty <= 0) continue;
    merged.set(l.productId, Math.min(999, (merged.get(l.productId) ?? 0) + qty));
  }
  return [...merged].map(([productId, qty]) => ({ productId, qty }));
}
