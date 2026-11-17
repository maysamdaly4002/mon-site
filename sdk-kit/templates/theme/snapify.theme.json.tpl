{
  "id": "__ID__",
  "name": "__NAME__",
  "version": "1.0.0",
  "description": "Thème de départ : en-tête, pied de page, articles et blocs principaux du constructeur, aux couleurs de l’identité visuelle du site.",
  "author": { "name": "__AUTHOR__", "email": "__EMAIL__" },
  "pricing": "free",
  "category": "Polyvalent",
  "engines": { "snapify": "^__API_VERSION__" },
  "entries": { "public": "src/index.tsx" },
  "settings": [
    {
      "key": "headerStyle", "type": "select", "group": "En-tête", "label": "Style de l’en-tête", "default": "light",
      "options": [
        { "value": "light", "label": "Clair" },
        { "value": "dark", "label": "Foncé" }
      ]
    },
    { "key": "stickyHeader", "type": "boolean", "group": "En-tête", "label": "En-tête fixe", "default": true },
    { "key": "footerText", "type": "textarea", "group": "Pied de page", "label": "Texte de présentation", "default": "{{societe}} — Contactez-nous au {{telephone}}.", "help": "Variables disponibles : {{societe}}, {{telephone}}, {{email}}, {{annee}}.", "rows": 2 }
  ]
}
