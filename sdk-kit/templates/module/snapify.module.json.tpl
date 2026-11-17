{
  "id": "__ID__",
  "name": "__NAME__",
  "version": "1.0.0",
  "description": "Bannière d’accueil flottante, widget de message et compteur de clics consultable dans l’administration.",
  "author": { "name": "__AUTHOR__", "email": "__EMAIL__" },
  "pricing": "free",
  "category": "Marketing",
  "icon": "sparkles",
  "engines": { "snapify": "^__API_VERSION__" },
  "permissions": ["http:routes", "admin:routes", "storage"],
  "slots": ["floating"],
  "entries": { "public": "src/public.tsx", "server": "src/server.ts", "admin": "src/admin.tsx" },
  "adminPages": [{ "id": "statistiques", "label": "Statistiques", "icon": "chart-bar" }],
  "widgets": [
    {
      "id": "message",
      "label": "Message",
      "description": "Encadré avec un titre, un texte et un bouton.",
      "fields": [
        { "key": "title", "type": "text", "label": "Titre", "default": "Bienvenue", "maxLength": 80 },
        { "key": "text", "type": "textarea", "label": "Texte", "default": "Découvrez nos nouveautés.", "rows": 3 },
        { "key": "buttonLabel", "type": "text", "label": "Bouton", "default": "En savoir plus", "maxLength": 40 },
        { "key": "buttonLink", "type": "text", "label": "Lien du bouton", "default": "/contact/", "placeholder": "/contact/" }
      ]
    }
  ],
  "settings": [
    { "key": "enabled", "type": "boolean", "group": "Bannière", "label": "Afficher la bannière", "default": true, "public": true },
    { "key": "message", "type": "text", "group": "Bannière", "label": "Message", "default": "Bienvenue sur notre site !", "public": true, "maxLength": 80 },
    { "key": "showOnPages", "type": "paths", "group": "Bannière", "label": "Pages", "help": "Laisser vide pour toutes les pages. Ex. / ou /blog/*", "default": [], "public": true }
  ]
}
