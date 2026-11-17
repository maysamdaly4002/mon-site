/**
 * Snapify — module Boutique
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ExternalLink, Save, Star, Trash2 } from 'lucide-react';
import {
  Alert,
  Button,
  ErrorState,
  Field,
  ImageField,
  Input,
  PageHeader,
  PageSkeleton,
  RichTextEditor,
  Section,
  Segmented,
  Switch,
  Textarea,
  errorMessage,
  fmtDateTime,
  slugify,
  toast,
  useAsync,
  useConfirm,
  type AdminPageProps,
} from '@snapify/sdk/admin';
import { COMMERCE_PATHS, formatMoney } from '@snapify/sdk/commerce';
import type { Product, Settings } from '../types';
import type { AdminCategory } from './ProductsPage';

type Form = Omit<Product, 'onSale' | 'inStock' | 'sales' | 'price' | 'compareAtPrice' | 'stock' | 'position'> & {
  price: string;
  compareAtPrice: string;
  stock: string;
};

const EMPTY: Form = {
  name: '',
  slug: '',
  sku: '',
  price: '',
  compareAtPrice: '',
  stock: '10',
  trackStock: true,
  images: [],
  description: '',
  shortDescription: '',
  categoryIds: [],
  status: 'active',
  featured: false,
  badge: '',
  seoTitle: '',
  seoDescription: '',
};

type Stored = Product & { id: string; createdAt: string; updatedAt: string };

const toForm = (p: Stored): Form => ({
  name: p.name,
  slug: p.slug,
  sku: p.sku,
  price: String(p.price),
  compareAtPrice: p.compareAtPrice ? String(p.compareAtPrice) : '',
  stock: String(p.stock),
  trackStock: p.trackStock,
  images: p.images,
  description: p.description,
  shortDescription: p.shortDescription,
  categoryIds: p.categoryIds,
  status: p.status,
  featured: p.featured,
  badge: p.badge,
  seoTitle: p.seoTitle || '',
  seoDescription: p.seoDescription || '',
});

export function ProductEditor({ productId, api, navigate, settings }: AdminPageProps<Settings> & { productId: string | null }) {
  const confirm = useConfirm();
  const loaded = useAsync(() => (productId ? api.get<{ product: Stored }>(`/products/${productId}`) : Promise.resolve(null)), [productId]);
  const cats = useAsync(() => api.get<{ categories: AdminCategory[] }>('/categories'), []);
  const [form, setForm] = useState<Form | null>(productId ? null : EMPTY);
  const [baseline, setBaseline] = useState(JSON.stringify(productId ? null : EMPTY));
  const [slugTouched, setSlugTouched] = useState(!!productId);
  const [saving, setSaving] = useState(false);
  const currency = settings.currency || 'TND';

  useEffect(() => {
    if (loaded.data?.product) {
      const f = toForm(loaded.data.product);
      setForm(f);
      setBaseline(JSON.stringify(f));
    }
  }, [loaded.data]);

  const dirty = form !== null && JSON.stringify(form) !== baseline;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const discount = useMemo(() => {
    const p = Number(form?.price.replace(',', '.'));
    const c = Number(form?.compareAtPrice.replace(',', '.'));
    return p > 0 && c > p ? Math.round(((c - p) / c) * 100) : 0;
  }, [form?.price, form?.compareAtPrice]);

  if (loaded.error) return <ErrorState message={loaded.error} onRetry={loaded.reload} />;
  if (!form) return <PageSkeleton />;

  const back = async () => {
    if (dirty && !(await confirm({ title: 'Quitter sans enregistrer ?', message: 'Vos modifications seront perdues.', confirmLabel: 'Quitter', danger: true }))) return;
    navigate('');
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = { ...form, price: form.price, compareAtPrice: form.compareAtPrice || null, stock: Number(form.stock) || 0 };
      const r = productId ? await api.put<{ product: Stored }>(`/products/${productId}`, body) : await api.post<{ product: Stored }>('/products', body);
      const f = toForm(r.product);
      setForm(f);
      setBaseline(JSON.stringify(f));
      toast.success(productId ? 'Produit enregistré' : 'Produit créé');
      if (!productId) navigate(`/${r.product.id}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!productId || !(await confirm({ title: 'Supprimer ce produit ?', message: 'Cette action est définitive.', confirmLabel: 'Supprimer', danger: true }))) return;
    try {
      await api.delete(`/products/${productId}`);
      toast.success('Produit supprimé');
      navigate('');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const images = form.images;
  const product = loaded.data?.product;

  return (
    <div
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
          e.preventDefault();
          if (dirty && !saving) void save();
        }
      }}
    >
      <PageHeader
        breadcrumb={
          <button type="button" onClick={() => void back()} className="inline-flex items-center gap-1 hover:text-slate-800">
            <ArrowLeft className="h-3.5 w-3.5" /> Produits
          </button>
        }
        title={form.name || (productId ? 'Produit' : 'Nouveau produit')}
        description={product ? `Modifié le ${fmtDateTime(product.updatedAt)} · ${product.sales || 0} vente${(product.sales || 0) > 1 ? 's' : ''}` : 'Renseignez au minimum le nom et le prix.'}
        actions={
          <>
            {productId && product?.status === 'active' ? (
              <Button icon={ExternalLink} onClick={() => window.open(COMMERCE_PATHS.product(product.slug), '_blank', 'noopener')}>
                Voir
              </Button>
            ) : null}
            {productId ? (
              <Button variant="ghost" icon={Trash2} onClick={() => void remove()}>
                Supprimer
              </Button>
            ) : null}
            <Button variant="primary" icon={Save} loading={saving} disabled={!dirty && !!productId} onClick={() => void save()}>
              Enregistrer
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Section title="Informations">
            <Field label="Nom du produit">
              <Input
                value={form.name}
                maxLength={160}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm((f) => (f ? { ...f, name, slug: slugTouched ? f.slug : slugify(name) } : f));
                }}
                placeholder="Ex. Vase en céramique de Nabeul"
              />
            </Field>
            <Field label="Adresse" hint={`${COMMERCE_PATHS.product(form.slug || 'adresse-du-produit')}`}>
              <Input
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set('slug', slugify(e.target.value));
                }}
                prefix="/produit/"
              />
            </Field>
            <Field label="Résumé" hint="Affiché sous le prix et dans les résultats de recherche." counter={{ value: form.shortDescription.length, max: 400 }}>
              <Textarea value={form.shortDescription} onChange={(e) => set('shortDescription', e.target.value)} rows={3} maxLength={400} />
            </Field>
            <Field label="Description complète">
              <RichTextEditor value={form.description} onChange={(html) => set('description', html)} placeholder="Matières, dimensions, conseils d’entretien…" />
            </Field>
          </Section>

          <Section title="Images" description="La première image est l’image principale. Survolez une image pour la remplacer ou la retirer.">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {images.map((src, i) => (
                <div key={`${src}-${i}`} className="space-y-1.5">
                  <ImageField value={src} aspect="aspect-square" onChange={(url) => set('images', url ? images.map((x, j) => (j === i ? url : x)) : images.filter((_, j) => j !== i))} />
                  {i === 0 ? (
                    <p className="text-center text-xs font-medium text-brand-700">Image principale</p>
                  ) : (
                    <button type="button" onClick={() => set('images', [src, ...images.filter((_, j) => j !== i)])} className="block w-full text-center text-xs text-slate-500 hover:text-slate-800">
                      Définir comme principale
                    </button>
                  )}
                </div>
              ))}
              {images.length < 12 ? <ImageField value="" aspect="aspect-square" emptyLabel="Ajouter" onChange={(url) => url && set('images', [...images, url])} /> : null}
            </div>
          </Section>

          <Section title="Prix">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={`Prix de vente (${currency})`}>
                <Input inputMode="decimal" value={form.price} onChange={(e) => set('price', e.target.value.replace(/[^\d.,]/g, ''))} placeholder="0,000" />
              </Field>
              <Field label={`Prix barré (${currency})`} hint={discount ? `Remise affichée : −${discount} %` : 'Facultatif : prix avant remise, supérieur au prix de vente.'}>
                <Input inputMode="decimal" value={form.compareAtPrice} onChange={(e) => set('compareAtPrice', e.target.value.replace(/[^\d.,]/g, ''))} placeholder="—" />
              </Field>
            </div>
            {Number(form.price.replace(',', '.')) > 0 ? <p className="text-sm text-slate-500">Affiché sur le site : <strong className="text-slate-800">{formatMoney(Number(form.price.replace(',', '.')), currency)}</strong></p> : null}
          </Section>

          <Section title="Stock">
            <Switch checked={form.trackStock} onChange={(v) => set('trackStock', v)} label="Suivre le stock" description="Le stock diminue à chaque commande ; le produit est indiqué « Épuisé » à zéro." />
            <div className="grid gap-4 sm:grid-cols-2">
              {form.trackStock ? (
                <Field label="Quantité en stock">
                  <Input inputMode="numeric" value={form.stock} onChange={(e) => set('stock', e.target.value.replace(/\D/g, ''))} />
                </Field>
              ) : null}
              <Field label="Référence (SKU)">
                <Input value={form.sku} maxLength={60} onChange={(e) => set('sku', e.target.value)} placeholder="Ex. CER-VAS-01" />
              </Field>
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Publication">
            <Segmented
              value={form.status}
              onChange={(v) => set('status', v)}
              options={[
                { value: 'active', label: 'En ligne' },
                { value: 'draft', label: 'Brouillon' },
              ]}
            />
            <Switch checked={form.featured} onChange={(v) => set('featured', v)} label={<span className="inline-flex items-center gap-1.5"><Star className="h-3.5 w-3.5 text-amber-500" /> Mis en avant</span>} description="Affiché en priorité dans la boutique et le widget « Produits mis en avant »." />
            <Field label="Étiquette" hint="Courte mention sur la photo : Nouveau, Fait main…">
              <Input value={form.badge} maxLength={24} onChange={(e) => set('badge', e.target.value)} />
            </Field>
          </Section>

          <Section title="Catégories">
            {cats.data?.categories.length ? (
              <div className="space-y-2">
                {cats.data.categories.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.categoryIds.includes(c.id)}
                      onChange={(e) => set('categoryIds', e.target.checked ? [...form.categoryIds, c.id] : form.categoryIds.filter((x) => x !== c.id))}
                      className="h-4 w-4 rounded border-slate-300 accent-[#00a89d]"
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            ) : (
              <Alert tone="neutral">
                Aucune catégorie.{' '}
                <button type="button" className="font-medium underline" onClick={() => navigate('/m/novalabs.shop/categories', { absolute: true })}>
                  Créer une catégorie
                </button>
              </Alert>
            )}
          </Section>

          <Section title="Référencement" description="Facultatif : par défaut, le nom et le résumé sont utilisés.">
            <Field label="Titre pour Google" counter={{ value: form.seoTitle.length, max: 70 }}>
              <Input value={form.seoTitle} maxLength={70} onChange={(e) => set('seoTitle', e.target.value)} placeholder={form.name} />
            </Field>
            <Field label="Description pour Google" counter={{ value: form.seoDescription.length, max: 200 }}>
              <Textarea value={form.seoDescription} maxLength={200} rows={3} onChange={(e) => set('seoDescription', e.target.value)} placeholder={form.shortDescription} />
            </Field>
          </Section>
        </div>
      </div>
    </div>
  );
}
