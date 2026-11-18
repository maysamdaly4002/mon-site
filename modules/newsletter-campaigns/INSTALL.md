# Module Campagnes newsletter — test local

1. Copier ce dossier dans `mon-site\modules\newsletter-campaigns\`.
2. Dans `mon-site\.env`, ajouter (mode développeur, jamais en production) :
   SNAPIFY_MODULES_DEV_MODE=true
   BREVO_API_KEY=<votre clé API Brevo>
3. Compiler sans signature :
   npm run module -- build modules/newsletter-campaigns --unsigned
4. Redémarrer `npm run dev`, puis Marketplace > importer
   `marketplace\packages\ziyneb.newsletter-campaigns-0.1.0.snapmod`.
5. Page du module : renseigner nom/adresse d'expéditeur (adresse validée chez Brevo)
   et l'URL publique (http://localhost:3000).
6. Placer le widget « Formulaire d'inscription » dans une page, s'inscrire avec une
   vraie adresse, confirmer, créer une campagne, envoyer un test, puis envoyer.
