import type { CrmService } from '../core/services';

/** Jeu de données de démonstration (indépendant du stockage : passe par le service). */
export async function seedDemo(crm: CrmService) {
  const co = {
    nova: await crm.createCompany({ name: 'Nova Digital', website: 'https://nova.example.tn', phone: '+21671000001', address: 'Tunis' }),
    carthage: await crm.createCompany({ name: 'Saveurs de Carthage', website: 'https://saveurs.example.tn', phone: '', address: 'La Marsa' }),
    sahel: await crm.createCompany({ name: 'Sahel Textile', website: '', phone: '+21673000003', address: 'Sousse' }),
  };
  const people: [string, string, string, string | null, string, string[]][] = [
    ['Sami', 'Trabelsi', 'sami@nova.example.tn', co.nova.id, 'formulaire', ['client', 'e-commerce']],
    ['Amel', 'Gharbi', 'amel@nova.example.tn', co.nova.id, 'newsletter', ['prospect']],
    ['Karim', 'Jebali', 'karim@saveurs.example.tn', co.carthage.id, 'formulaire', ['vip']],
    ['Héla', 'Mansouri', 'hela@sahel.example.tn', co.sahel.id, 'recommandation', ['prospect', 'textile']],
    ['Yassine', 'Ben Ammar', 'yassine@mail.tn', null, 'import', []],
    ['Ines', 'Khelifi', 'ines@mail.tn', null, 'formulaire', ['prospect']],
    ['Marwen', 'Dridi', 'marwen@mail.tn', null, 'salon', ['événement']],
    ['Rim', 'Chaabane', 'rim@mail.tn', null, 'newsletter', []],
  ];
  const contacts = [];
  for (const [firstName, lastName, email, companyId, source, tags] of people) contacts.push(await crm.createContact({ firstName, lastName, email, companyId, source, tags }));
  const deals: [number, string, number, string, string][] = [
    [0, 'Refonte site vitrine', 3500, 'gagne', '2026-10-30'],
    [0, 'Boutique en ligne', 8000, 'proposition', '2026-12-15'],
    [1, 'Campagne newsletter', 1200, 'qualifie', '2026-12-01'],
    [2, 'Site de réservation', 5200, 'proposition', '2026-12-20'],
    [3, 'Catalogue produits', 2800, 'nouveau', '2027-01-15'],
    [4, 'Maintenance annuelle', 900, 'perdu', '2026-09-30'],
    [5, 'Landing page', 600, 'nouveau', '2026-12-10'],
    [6, 'Module CRM', 4000, 'qualifie', '2027-01-31'],
  ];
  for (const [i, title, amount, stage, expectedClose] of deals) {
    const d = await crm.createDeal({ contactId: contacts[i].id, title, amount, expectedClose });
    if (stage !== 'nouveau') await crm.moveDeal(d.id, stage);
  }
  await crm.addActivity(contacts[0].id, { type: 'call', note: 'Appel de cadrage : besoin boutique + paiement en ligne.' });
  await crm.addActivity(contacts[0].id, { type: 'email', note: 'Devis envoyé (boutique en ligne).' });
  await crm.addActivity(contacts[2].id, { type: 'note', note: 'Souhaite un module de réservation de tables.' });
}
