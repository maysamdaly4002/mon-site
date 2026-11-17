/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
/** Formulaire de réglages généré à partir du manifeste d'un module. */
import { RotateCcw } from 'lucide-react';
import type { SettingField } from '../../../sdk/index';
import { Button, cx, Field, Input, Section, Select, Switch, Textarea } from '../ui/primitives';
import { TagInput } from '../ui/TagInput';

type Values = Record<string, unknown>;

function FieldControl({ field, value, onChange, error }: { field: SettingField; value: unknown; onChange: (v: unknown) => void; error?: string }) {
  const isDefault = JSON.stringify(value) === JSON.stringify(field.default);
  switch (field.type) {
    case 'boolean':
      return <Switch checked={value === true} onChange={onChange} label={field.label} description={field.help} />;
    case 'select':
      return (
        <Field label={field.label} hint={field.help} error={error}>
          <Select value={String(value ?? '')} onChange={onChange} options={field.options ?? []} />
        </Field>
      );
    case 'number': {
      const n = typeof value === 'number' ? value : Number(field.default);
      if (field.slider) {
        return (
          <Field label={`${field.label} : ${n.toLocaleString('fr-FR')}`} hint={field.help} error={error}>
            <input
              type="range"
              min={field.min ?? 0}
              max={field.max ?? 100}
              step={field.step ?? 1}
              value={n}
              onChange={(e) => onChange(Number(e.target.value))}
              className="w-full accent-brand-600"
            />
          </Field>
        );
      }
      return (
        <Field label={field.label} hint={field.help} error={error}>
          <Input
            type="number"
            min={field.min}
            max={field.max}
            step={field.step}
            value={Number.isFinite(n) ? n : ''}
            onChange={(e) => onChange(e.target.value === '' ? field.default : Number(e.target.value))}
            className="w-44 tabular-nums"
          />
        </Field>
      );
    }
    case 'paths':
      return (
        <Field label={field.label} hint={field.help} error={error}>
          <TagInput value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} placeholder="/contact/ puis Entrée" validate={(v) => v.startsWith('/')} />
        </Field>
      );
    case 'textarea': {
      const text = String(value ?? '');
      return (
        <Field
          label={field.label}
          hint={field.help}
          error={error}
          counter={field.maxLength && field.maxLength <= 2000 ? { value: text.length, max: field.maxLength } : undefined}
        >
          <Textarea
            value={text}
            rows={field.rows ?? 3}
            maxLength={field.maxLength}
            placeholder={field.placeholder}
            onChange={(e) => onChange(e.target.value)}
            className={cx(field.monospace && 'font-mono text-xs leading-relaxed')}
          />
          {!isDefault && (field.rows ?? 3) > 4 ? (
            <div className="mt-2 flex justify-end">
              <Button size="sm" icon={RotateCcw} onClick={() => onChange(field.default)}>
                Revenir à la valeur par défaut
              </Button>
            </div>
          ) : null}
        </Field>
      );
    }
    default:
      return (
        <Field label={field.label} hint={field.help} error={error}>
          <Input
            type={field.type === 'phone' ? 'tel' : 'text'}
            value={String(value ?? '')}
            maxLength={field.maxLength}
            placeholder={field.placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        </Field>
      );
  }
}

/** Variante compacte (sans sections), pour les panneaux étroits de l'éditeur. */
export function SettingsFields({ fields, value, onChange }: { fields: SettingField[]; value: Values; onChange: (patch: Values) => void }) {
  return (
    <div className="space-y-3.5">
      {fields.map((f) => (
        <FieldControl key={f.key} field={f} value={value[f.key] ?? f.default} onChange={(v) => onChange({ [f.key]: v })} />
      ))}
    </div>
  );
}

export function SettingsForm({
  fields,
  value,
  onChange,
  errors = {},
}: {
  fields: SettingField[];
  value: Values;
  onChange: (patch: Values) => void;
  errors?: Record<string, string>;
}) {
  const groups: { title: string; fields: SettingField[] }[] = [];
  for (const f of fields) {
    const title = f.group || 'Réglages';
    const last = groups[groups.length - 1];
    if (last && last.title === title) last.fields.push(f);
    else groups.push({ title, fields: [f] });
  }
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <Section key={g.title} title={g.title}>
          {g.fields.map((f) => (
            <FieldControl key={f.key} field={f} value={value[f.key]} error={errors[f.key]} onChange={(v) => onChange({ [f.key]: v })} />
          ))}
        </Section>
      ))}
    </div>
  );
}
