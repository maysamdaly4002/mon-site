/**
 * Active la boutique et installe un catalogue démo (catégories + produits).
 */
import 'dotenv/config';
import { runMigrations } from '../server/db/client';
import { loadSnapshot } from '../server/cms/store';
import { initModules, setModuleEnabled } from '../server/modules/manager';
import { createCollection } from '../server/modules/records';
import type { Category, Product } from '../modules/shop/src/types';

const SHOP = 'novalabs.shop';
const ECOM = ['novalabs.shop', 'novalabs.cart', 'novalabs.checkout', 'novalabs.customers'] as const;

const PHOTOS = [
  '/images/photos/sidi-bou-said-port.webp',
  '/images/photos/ruelle-bleue-medina.jpg',
  '/images/photos/terrasse-blanche-mer-voilier.jpg',
  '/images/photos/hammamet-medina-plage.jpg',
  '/images/photos/maison-campagne-collines.webp',
  '/images/photos/caravane-chameaux-desert.webp',
  '/images/photos/maisons-troglodytes-desert.jpg',
  '/images/photos/panorama-ville.jpg',
];

await runMigrations();
await loadSnapshot();
await initModules();

for (const id of ECOM) {
  try {
    await setModuleEnabled(id, true);
    console.log(`[seed] module activé : ${id}`);
  } catch (e) {
    console.warn(`[seed] activation ${id} :`, (e as Error).message);
  }
}

const categories = createCollection<Category>(SHOP, 'categories');
const products = createCollection<Product>(SHOP, 'products');

if ((await products.count()) > 0) {
  console.log(`[seed] déjà ${await products.count()} produit(s) — rien à faire`);
  process.exit(0);
}

const catDefs: Omit<Category, never>[] = [
  { name: 'Maison & déco', slug: 'maison-deco', description: 'Objets déco et art de la table inspirés de la Méditerranée.', image: PHOTOS[0], position: 1 },
  { name: 'Mode', slug: 'mode', description: 'Pièces légères pour le quotidien et les weekends.', image: PHOTOS[1], position: 2 },
  { name: 'Bien-être', slug: 'bien-etre', description: 'Soins, huiles et rituels pour se ressourcer.', image: PHOTOS[2], position: 3 },
  { name: 'Gourmet', slug: 'gourmet', description: 'Épicerie fine et saveurs du terroir tunisien.', image: PHOTOS[3], position: 4 },
];

const catIds: string[] = [];
for (const c of catDefs) {
  const row = await categories.insert(c, { id: `cat-${c.slug}` });
  catIds.push(row.id);
  console.log(`[seed] catégorie ${row.name}`);
}

type Demo = {
  name: string;
  slug: string;
  sku: string;
  price: number;
  compareAtPrice?: number | null;
  stock: number;
  featured?: boolean;
  badge?: string;
  cats: number[];
  photo: number;
  short: string;
};

const demos: Demo[] = [
  { name: 'Vase Sidi Bou', slug: 'vase-sidi-bou', sku: 'DEC-001', price: 89, compareAtPrice: 120, stock: 24, featured: true, badge: 'Promo', cats: [0], photo: 0, short: 'Céramique artisanale, émail bleu méditerranée.' },
  { name: 'Plateau olivier', slug: 'plateau-olivier', sku: 'DEC-002', price: 65, stock: 18, featured: true, cats: [0], photo: 4, short: 'Plateau en bois d’olivier, finition huile naturelle.' },
  { name: 'Coussin Medina', slug: 'coussin-medina', sku: 'DEC-003', price: 45, compareAtPrice: 59, stock: 40, badge: '-24 %', cats: [0, 1], photo: 1, short: 'Housse en coton brodé, motifs de la médina.' },
  { name: 'Chemise lin Hammamet', slug: 'chemise-lin-hammamet', sku: 'MOD-001', price: 129, stock: 15, featured: true, cats: [1], photo: 3, short: 'Chemise en lin lavé, coupe décontractée.' },
  { name: 'Sandales Cap Bon', slug: 'sandales-cap-bon', sku: 'MOD-002', price: 79, stock: 22, cats: [1], photo: 2, short: 'Sandales en cuir souple, semelle confort.' },
  { name: 'Écharpe mer & ciel', slug: 'echarpe-mer-ciel', sku: 'MOD-003', price: 55, stock: 30, cats: [1], photo: 2, short: 'Foulard léger, dégradé bleu et blanc.' },
  { name: 'Huile d’argan bio', slug: 'huile-argan-bio', sku: 'WEL-001', price: 42, compareAtPrice: 52, stock: 50, featured: true, badge: 'Best-seller', cats: [2], photo: 5, short: 'Huile pressée à froid, 50 ml.' },
  { name: 'Savon noir traditionnel', slug: 'savon-noir', sku: 'WEL-002', price: 18, stock: 80, cats: [2], photo: 6, short: 'Savon noir à l’huile d’olive, rituel hammam.' },
  { name: 'Bougie jasmin de Nabeul', slug: 'bougie-jasmin', sku: 'WEL-003', price: 28, stock: 35, cats: [2, 0], photo: 7, short: 'Cire végétale, parfum jasmin tunisien.' },
  { name: 'Huile d’olive fruitée', slug: 'huile-olive-fruitee', sku: 'GOU-001', price: 32, stock: 60, featured: true, cats: [3], photo: 4, short: 'Extra vierge, première pression, 50 cl.' },
  { name: 'Miel de thym', slug: 'miel-de-thym', sku: 'GOU-002', price: 38, stock: 25, cats: [3], photo: 5, short: 'Miel artisanal du Cap Bon, 250 g.' },
  { name: 'Épices ras el hanout', slug: 'ras-el-hanout', sku: 'GOU-003', price: 14, stock: 100, badge: 'Nouveau', cats: [3], photo: 6, short: 'Mélange d’épices pour tajines et grillades.' },
];

let i = 0;
for (const d of demos) {
  i += 1;
  const compareAtPrice = d.compareAtPrice && d.compareAtPrice > d.price ? d.compareAtPrice : null;
  const data: Product = {
    name: d.name,
    slug: d.slug,
    sku: d.sku,
    price: d.price,
    compareAtPrice,
    onSale: compareAtPrice !== null,
    stock: d.stock,
    trackStock: true,
    inStock: d.stock > 0,
    images: [PHOTOS[d.photo % PHOTOS.length]],
    description: `<p>${d.short}</p><p>Produit démo Snapify — catalogue Tunisie. Livraison illustrative.</p>`,
    shortDescription: d.short,
    categoryIds: d.cats.map((ci) => catIds[ci]),
    status: 'active',
    featured: !!d.featured,
    badge: d.badge || '',
    sales: Math.floor(Math.random() * 40),
    position: i,
    seoTitle: `${d.name} — Boutique démo`,
    seoDescription: d.short,
  };
  await products.insert(data, { id: `prod-${d.slug}` });
  console.log(`[seed] produit ${d.name} (${d.price} TND)`);
}

console.log(`[seed] OK — ${catIds.length} catégories, ${demos.length} produits`);
process.exit(0);
