/**
 * Snapify — module Espace client
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { useState } from 'react';
import { GOVERNORATES, validateAddress, type Address, type SavedAddress } from '@snapify/sdk/commerce';
import { Button, Checkbox, FormField, Notice, SelectInput, TextInput } from '@snapify/sdk/ui/commerce';

export interface AddressDraft {
  address: Address;
  label: string;
  isDefault: boolean;
}

export const emptyAddress = (first = '', last = '', phone = ''): Address => ({ firstName: first, lastName: last, phone, line1: '', line2: '', city: '', governorate: '', postalCode: '' });

export function AddressForm({
  initial,
  canSetDefault,
  onSubmit,
  onCancel,
}: {
  initial: SavedAddress | Address;
  canSetDefault: boolean;
  onSubmit: (d: AddressDraft) => Promise<void>;
  onCancel: () => void;
}) {
  const saved = 'id' in initial ? (initial as SavedAddress) : null;
  const [a, setA] = useState<Address>({ ...emptyAddress(), ...initial });
  const [label, setLabel] = useState(saved?.label ?? '');
  const [isDefault, setIsDefault] = useState(!!saved?.isDefault);
  const [errors, setErrors] = useState<Partial<Record<keyof Address, string>>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (patch: Partial<Address>) => {
    setA((x) => ({ ...x, ...patch }));
    setErrors((e) => {
      const n = { ...e };
      for (const k of Object.keys(patch)) delete n[k as keyof Address];
      return n;
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validateAddress(a);
    setErrors(v.errors);
    if (Object.keys(v.errors).length) return;
    setBusy(true);
    setError('');
    try {
      await onSubmit({ address: v.value, label: label.trim(), isDefault });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      {error ? (
        <Notice tone="danger" className="sm:col-span-2">
          {error}
        </Notice>
      ) : null}
      <FormField label="Nom de l’adresse" hint="Maison, bureau, parents…" className="sm:col-span-2">
        <TextInput value={label} maxLength={40} placeholder="Maison" onChange={(e) => setLabel(e.target.value)} />
      </FormField>
      <FormField label="Prénom" error={errors.firstName} required>
        <TextInput autoComplete="given-name" value={a.firstName} invalid={!!errors.firstName} onChange={(e) => set({ firstName: e.target.value })} />
      </FormField>
      <FormField label="Nom" error={errors.lastName} required>
        <TextInput autoComplete="family-name" value={a.lastName} invalid={!!errors.lastName} onChange={(e) => set({ lastName: e.target.value })} />
      </FormField>
      <FormField label="Téléphone" error={errors.phone} required className="sm:col-span-2">
        <TextInput type="tel" autoComplete="tel" placeholder="+216 20 000 000" value={a.phone} invalid={!!errors.phone} onChange={(e) => set({ phone: e.target.value })} />
      </FormField>
      <FormField label="Adresse" error={errors.line1} required className="sm:col-span-2">
        <TextInput autoComplete="address-line1" placeholder="N°, rue, quartier" value={a.line1} invalid={!!errors.line1} onChange={(e) => set({ line1: e.target.value })} />
      </FormField>
      <FormField label="Complément" className="sm:col-span-2">
        <TextInput autoComplete="address-line2" placeholder="Bâtiment, étage, repère…" value={a.line2 ?? ''} onChange={(e) => set({ line2: e.target.value })} />
      </FormField>
      <FormField label="Ville" error={errors.city} required>
        <TextInput autoComplete="address-level2" value={a.city} invalid={!!errors.city} onChange={(e) => set({ city: e.target.value })} />
      </FormField>
      <div className="grid grid-cols-[1fr_110px] gap-3">
        <FormField label="Gouvernorat" error={errors.governorate} required>
          <SelectInput value={a.governorate} onChange={(v) => set({ governorate: v })} options={GOVERNORATES} placeholder="Choisir…" invalid={!!errors.governorate} />
        </FormField>
        <FormField label="Code postal" error={errors.postalCode}>
          <TextInput inputMode="numeric" maxLength={4} autoComplete="postal-code" value={a.postalCode} invalid={!!errors.postalCode} onChange={(e) => set({ postalCode: e.target.value.replace(/\D/g, '') })} />
        </FormField>
      </div>
      {canSetDefault ? (
        <div className="sm:col-span-2">
          <Checkbox checked={isDefault} onChange={setIsDefault}>
            Utiliser comme adresse par défaut
          </Checkbox>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-3 sm:col-span-2">
        <Button type="submit" loading={busy}>
          Enregistrer l’adresse
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
