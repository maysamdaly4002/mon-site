-- Bonus : visites de la commission de sécurité (+ prescriptions) et plans d'étage (+ positionnement des équipements).

-- Le registre accueille deux nouveaux types d'entrée. (Le trigger d'immuabilité ne porte que sur UPDATE/DELETE de lignes :
-- modifier la contrainte CHECK n'altère aucune entrée existante.)
ALTER TABLE journal_registre DROP CONSTRAINT journal_registre_type_check;
ALTER TABLE journal_registre ADD CONSTRAINT journal_registre_type_check
  CHECK (type IN ('controle', 'non_conformite', 'action', 'levee', 'exercice', 'intervention', 'correction', 'visite', 'prescription'));

CREATE TABLE visites_commission (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id),
  date             DATE NOT NULL,
  avis             TEXT NOT NULL CHECK (avis IN ('favorable', 'defavorable')),
  president        TEXT NOT NULL DEFAULT '',
  observations     TEXT NOT NULL DEFAULT '',
  prochaine_visite DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (prochaine_visite IS NULL OR prochaine_visite > date)
);
CREATE INDEX visites_etab_idx ON visites_commission (etablissement_id, date DESC);

CREATE TABLE prescriptions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visite_id        UUID NOT NULL REFERENCES visites_commission(id),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id),
  description      TEXT NOT NULL,
  responsable      TEXT NOT NULL,
  echeance         DATE NOT NULL,
  statut           TEXT NOT NULL DEFAULT 'a_faire' CHECK (statut IN ('a_faire', 'en_cours', 'levee')),
  levee_at         TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((statut = 'levee') = (levee_at IS NOT NULL))
);
CREATE INDEX prescriptions_visite_idx ON prescriptions (visite_id);
CREATE INDEX prescriptions_etab_idx ON prescriptions (etablissement_id, statut);

-- Un plan par niveau (remplacé en changeant document_id : l'ancien fichier reste dans documents, rien n'est supprimé).
CREATE TABLE plans_etage (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id),
  niveau_id        UUID NOT NULL REFERENCES niveaux(id),
  nom              TEXT NOT NULL DEFAULT '',
  document_id      UUID NOT NULL REFERENCES documents(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (niveau_id)
);

-- x / y en % de la largeur / hauteur de l'image (indépendant de la résolution) ; NULL = équipement non placé (retiré du plan).
CREATE TABLE positions_plan (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id          UUID NOT NULL REFERENCES plans_etage(id),
  equipement_id    UUID NOT NULL REFERENCES equipements(id),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id),
  x                DOUBLE PRECISION CHECK (x BETWEEN 0 AND 100),
  y                DOUBLE PRECISION CHECK (y BETWEEN 0 AND 100),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, equipement_id),
  CHECK ((x IS NULL) = (y IS NULL))
);
