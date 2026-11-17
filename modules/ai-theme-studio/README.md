# Atelier thème IA

Générez une identité visuelle Snapify + une page d’accueil CMS à partir d’un brief, via OpenAI, Claude ou Gemini.

## Compatibilité éditeur

Le rendu s’appuie sur le thème **AI Canvas** (`hamdiayari.ai-canvas`) qui expose les **25 blocs** du constructeur. L’IA ne génère pas de React arbitraire : elle produit un JSON validé (couleurs, polices autorisées, blocs CMS), puis l’atelier applique :

1. Identité visuelle (Apparence)
2. Activation / réglages AI Canvas
3. Blocs de la page d’accueil (toujours éditables ensuite)

## Réglages

Clé API + fournisseur dans les réglages du module (jamais exposés au public).
