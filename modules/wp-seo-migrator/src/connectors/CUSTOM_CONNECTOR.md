# Gabarit — connecteur SEO personnalisé (groupe G)

Tout connecteur implémente `SeoConnector` (`src/types.ts`) :

```ts
import type { SeoConnector } from '../types';
import { pathFromUrl, slugFromPath } from './utils';
// ou createCsvSeoConnector depuis ./csvSeoFactory

export const monConnector: SeoConnector = {
  id: 'mon-plugin',          // unique, kebab-case
  name: 'Mon plugin SEO',
  fields: ['url', 'seoTitle', 'metaDescription'],
  detect(ctx) {
    const found = ctx.textFiles.some((f) => f.name.includes('mon-plugin'));
    return { id: 'mon-plugin', name: 'Mon plugin SEO', found };
  },
  extract(ctx) {
    return { records: [], redirects: [], warnings: [] };
  },
};
```

1. Ajoutez le fichier dans `src/connectors/`.
2. Enregistrez-le dans `CONNECTORS` (`src/connectors/index.ts`).
3. Ajoutez une fixture + un test dans `tests/`.
4. Rebuild / republiez le module (`npm run module -- build modules/wp-seo-migrator`).

Pour un CSV simple, préférez `createCsvSeoConnector({ id, name, detectHints, columns })`.

**Limite SDK** : pas d’hôte `net:` dynamique — un connecteur live REST vers un WordPress arbitraire nécessite une évolution core (`net:outbound` SSRF-safe) ; en attendant, fournissez un export fichier ou le plugin Snapify Exporter.
