-- Schéma relationnel du module ERP « Prévention incendie » (PostgreSQL 14+, compatible Neon).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL,
  nom           TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'exploitant', 'technicien', 'auditeur')),
  password_hash TEXT NOT NULL,                       -- scrypt + sel, jamais le mot de passe
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_uq ON users (lower(email));

CREATE TABLE etablissements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom            TEXT NOT NULL,
  adresse        TEXT NOT NULL DEFAULT '',
  type_activite  TEXT NOT NULL,
  categorie      TEXT NOT NULL CHECK (categorie IN ('1', '2', '3', '4', '5')),
  effectif_max   INTEGER NOT NULL CHECK (effectif_max >= 0),
  email_alertes  TEXT NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Contrôle d'accès par établissement : un utilisateur non-admin ne voit que les établissements listés ici.
CREATE TABLE acces (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  etablissement_id UUID NOT NULL REFERENCES etablissements(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, etablissement_id)
);

CREATE TABLE batiments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id),
  nom              TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX batiments_etab_idx ON batiments (etablissement_id);

CREATE TABLE niveaux (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batiment_id      UUID NOT NULL REFERENCES batiments(id),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id),   -- dénormalisé : filtre d'accès sans jointure
  nom              TEXT NOT NULL,
  ordre            INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX niveaux_bat_idx ON niveaux (batiment_id);

-- Types d'équipement et règles de périodicité : PARAMÉTRABLES (aucune valeur réglementaire dans le code).
CREATE TABLE types_equipement (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                    TEXT NOT NULL UNIQUE,
  libelle                 TEXT NOT NULL,
  periodicite_defaut_mois INTEGER NOT NULL CHECK (periodicite_defaut_mois BETWEEN 1 AND 120),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- categorie NULL = toutes catégories ; une règle propre à une catégorie l'emporte sur la règle générale.
CREATE TABLE regles_periodicite (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_equipement_id  UUID NOT NULL REFERENCES types_equipement(id),
  categorie           TEXT CHECK (categorie IN ('1', '2', '3', '4', '5')),
  periodicite_mois    INTEGER NOT NULL CHECK (periodicite_mois BETWEEN 1 AND 120),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX regles_uq ON regles_periodicite (type_equipement_id, coalesce(categorie, '*'));

CREATE TABLE equipements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id    UUID NOT NULL REFERENCES etablissements(id),
  niveau_id           UUID REFERENCES niveaux(id),
  type_id             UUID NOT NULL REFERENCES types_equipement(id),
  libelle             TEXT NOT NULL,
  emplacement         TEXT NOT NULL DEFAULT '',
  date_mise_en_service DATE NOT NULL,
  qr_code             TEXT NOT NULL UNIQUE,                         -- unique : imprimé sur l'équipement
  statut              TEXT NOT NULL DEFAULT 'en_service' CHECK (statut IN ('en_service', 'hors_service', 'a_remplacer')),
  dernier_controle    DATE,
  prochaine_echeance  DATE NOT NULL,                                -- calculée par le service, indexée pour les alertes
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX equipements_etab_idx    ON equipements (etablissement_id);
CREATE INDEX equipements_echeance_idx ON equipements (prochaine_echeance) WHERE statut <> 'hors_service';

CREATE TABLE documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id),
  nom              TEXT NOT NULL,
  mime             TEXT NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp')),
  taille           INTEGER NOT NULL,
  sha256           CHAR(64) NOT NULL,                               -- empreinte : le contenu est lié au registre
  contenu          TEXT NOT NULL,                                   -- base64 (≤ 1,5 Mo) ; un stockage objet est prévu en production
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE controles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipement_id    UUID NOT NULL REFERENCES equipements(id),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id),
  date             DATE NOT NULL,
  resultat         TEXT NOT NULL CHECK (resultat IN ('conforme', 'non_conforme')),
  observations     TEXT NOT NULL DEFAULT '',
  document_id      UUID REFERENCES documents(id),
  controleur       TEXT NOT NULL,
  auteur_id        TEXT NOT NULL,                                   -- identifiant de l'utilisateur qui a saisi
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX controles_equip_idx ON controles (equipement_id, date DESC);
CREATE INDEX controles_etab_idx  ON controles (etablissement_id, date DESC);

CREATE TABLE non_conformites (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  controle_id      UUID NOT NULL REFERENCES controles(id),
  equipement_id    UUID NOT NULL REFERENCES equipements(id),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id),
  description      TEXT NOT NULL,
  statut           TEXT NOT NULL DEFAULT 'ouverte' CHECK (statut IN ('ouverte', 'en_cours', 'levee')),
  levee_at         TIMESTAMPTZ,
  levee_note       TEXT NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((statut = 'levee') = (levee_at IS NOT NULL))
);
CREATE INDEX nc_etab_idx ON non_conformites (etablissement_id, statut);

CREATE TABLE actions_correctives (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  non_conformite_id  UUID NOT NULL REFERENCES non_conformites(id),
  etablissement_id   UUID NOT NULL REFERENCES etablissements(id),
  description        TEXT NOT NULL,
  responsable        TEXT NOT NULL,
  echeance           DATE NOT NULL,
  statut             TEXT NOT NULL DEFAULT 'a_faire' CHECK (statut IN ('a_faire', 'en_cours', 'terminee')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX actions_nc_idx ON actions_correctives (non_conformite_id);

-- Exercices d'évacuation ET formations (colonne type) : une seule table, une seule logique de recyclage.
CREATE TABLE exercices (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id   UUID NOT NULL REFERENCES etablissements(id),
  type               TEXT NOT NULL CHECK (type IN ('evacuation', 'formation')),
  date               DATE NOT NULL,
  participants       INTEGER NOT NULL CHECK (participants >= 0),
  duree_min          INTEGER NOT NULL CHECK (duree_min > 0),
  observations       TEXT NOT NULL DEFAULT '',
  recyclage_mois     INTEGER,
  prochain_recyclage DATE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Alertes déjà envoyées : la clé unique rend la tâche planifiée idempotente (pas de doublon, reprise après panne).
CREATE TABLE alertes_envoyees (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cle        TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═════════ Registre de sécurité : ajout seul + chaîne de hachage ═════════
CREATE TABLE journal_registre (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE RESTRICT,
  seq              INTEGER NOT NULL CHECK (seq >= 1),
  type             TEXT NOT NULL CHECK (type IN ('controle', 'non_conformite', 'action', 'levee', 'exercice', 'intervention', 'correction')),
  occurred_at      TIMESTAMPTZ NOT NULL,                            -- horodatage serveur
  auteur           TEXT NOT NULL,
  payload          JSONB NOT NULL,
  corrige_id       UUID REFERENCES journal_registre(id),            -- correction = nouvelle ligne qui pointe vers l'originale
  prev_hash        CHAR(64) NOT NULL,
  hash             CHAR(64) NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (etablissement_id, seq)                                    -- empêche deux entrées de même rang (fourche de la chaîne)
);

CREATE FUNCTION journal_registre_immuable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'journal_registre est en ajout seul : % interdit (corrigez par une nouvelle entrée)', TG_OP USING ERRCODE = 'restrict_violation';
END $$;
CREATE TRIGGER journal_registre_no_update BEFORE UPDATE ON journal_registre FOR EACH ROW EXECUTE FUNCTION journal_registre_immuable();
CREATE TRIGGER journal_registre_no_delete BEFORE DELETE ON journal_registre FOR EACH ROW EXECUTE FUNCTION journal_registre_immuable();

-- En production : le rôle de l'application n'a que SELECT/INSERT sur cette table (TRUNCATE reste réservé au propriétaire).
--   REVOKE ALL ON journal_registre FROM app_role; GRANT SELECT, INSERT ON journal_registre TO app_role;
