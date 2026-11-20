-- LMS : cours, leçons, inscriptions, progression, quiz, certificats.
-- Règle de conception : progressions, tentatives et certificats sont APPEND-ONLY (triggers ci-dessous) ;
-- le contenu pédagogique n'est jamais supprimé (colonne archive).

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  nom           TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'instructeur', 'apprenant', 'auditeur')),
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE courses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  niveau          TEXT NOT NULL CHECK (niveau IN ('debutant', 'intermediaire', 'avance')),
  statut          TEXT NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'publie', 'archive')),
  instructeur_id  TEXT NOT NULL,          -- id de l'utilisateur (UUID en API autonome, identifiant du CMS dans Snapify) : volontairement non contraint
  instructeur_nom TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE chapters (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id  UUID NOT NULL REFERENCES courses(id),
  titre      TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  archive    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX chapters_course_idx ON chapters (course_id);

CREATE TABLE lessons (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id  UUID NOT NULL REFERENCES courses(id),
  chapter_id UUID NOT NULL REFERENCES chapters(id),
  titre      TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('texte', 'video', 'lien')),
  contenu    TEXT NOT NULL,
  duree_min  INTEGER NOT NULL DEFAULT 0 CHECK (duree_min BETWEEN 0 AND 600),
  position   INTEGER NOT NULL DEFAULT 0,
  archive    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (type = 'texte' OR contenu ~ '^https://')   -- une vidéo ou un lien n'est jamais qu'une adresse https
);
CREATE INDEX lessons_course_idx ON lessons (course_id);

CREATE TABLE quizzes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id      UUID NOT NULL UNIQUE REFERENCES courses(id),   -- un quiz final par cours
  titre          TEXT NOT NULL,
  seuil          INTEGER NOT NULL CHECK (seuil BETWEEN 1 AND 100),
  tentatives_max INTEGER NOT NULL CHECK (tentatives_max BETWEEN 0 AND 20), -- 0 = illimité
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE questions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id    UUID NOT NULL REFERENCES quizzes(id),
  course_id  UUID NOT NULL REFERENCES courses(id),
  enonce     TEXT NOT NULL,
  choix      JSONB NOT NULL CHECK (jsonb_typeof(choix) = 'array' AND jsonb_array_length(choix) BETWEEN 2 AND 6),
  bonnes     JSONB NOT NULL CHECK (jsonb_typeof(bonnes) = 'array' AND jsonb_array_length(bonnes) >= 1),
  position   INTEGER NOT NULL DEFAULT 0,
  archive    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX questions_quiz_idx ON questions (quiz_id);

CREATE TABLE enrollments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id       UUID NOT NULL REFERENCES courses(id),
  apprenant_id    TEXT NOT NULL,          -- utilisateur ou « inv_… » (apprenant sans compte, inscrit par e-mail)
  apprenant_nom   TEXT NOT NULL,
  apprenant_email TEXT NOT NULL DEFAULT '',
  inscrit_par     TEXT NOT NULL,
  inscrit_at      TIMESTAMPTZ NOT NULL,
  statut          TEXT NOT NULL DEFAULT 'en_cours' CHECK (statut IN ('en_cours', 'termine')),
  termine_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, apprenant_id),       -- on ne s'inscrit qu'une fois à un cours
  CHECK ((statut = 'termine') = (termine_at IS NOT NULL))
);
CREATE INDEX enrollments_apprenant_idx ON enrollments (apprenant_id);

CREATE TABLE progressions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES enrollments(id),
  course_id     UUID NOT NULL REFERENCES courses(id),
  apprenant_id  TEXT NOT NULL,
  lesson_id     UUID NOT NULL REFERENCES lessons(id),
  fait_at       TIMESTAMPTZ NOT NULL,
  saisi_par     TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, lesson_id)       -- une leçon ne se termine qu'une fois
);

CREATE TABLE tentatives (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id       UUID NOT NULL REFERENCES quizzes(id),
  course_id     UUID NOT NULL REFERENCES courses(id),
  enrollment_id UUID NOT NULL REFERENCES enrollments(id),
  apprenant_id  TEXT NOT NULL,
  numero        INTEGER NOT NULL CHECK (numero >= 1),
  passe_at      TIMESTAMPTZ NOT NULL,
  score         INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  reussi        BOOLEAN NOT NULL,
  reponses      JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, numero)          -- deux tentatives simultanées ne peuvent pas porter le même numéro
);

CREATE TABLE certificats (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id     UUID NOT NULL REFERENCES courses(id),
  apprenant_id  TEXT NOT NULL,
  apprenant_nom TEXT NOT NULL,
  cours_titre   TEXT NOT NULL,
  code          TEXT NOT NULL UNIQUE CHECK (code ~ '^CERT-[A-Z0-9]{10}$'),
  delivre_at    TIMESTAMPTZ NOT NULL,
  hash          TEXT NOT NULL CHECK (hash ~ '^[0-9a-f]{64}$'),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, apprenant_id)        -- un seul certificat par cours et par apprenant
);

-- Append-only : ni UPDATE ni DELETE, même pour le propriétaire de l'application.
CREATE FUNCTION lms_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% est en écriture seule : % interdit', TG_TABLE_NAME, TG_OP USING ERRCODE = 'integrity_constraint_violation';
END $$;
CREATE TRIGGER progressions_append_only BEFORE UPDATE OR DELETE ON progressions FOR EACH ROW EXECUTE FUNCTION lms_append_only();
CREATE TRIGGER tentatives_append_only   BEFORE UPDATE OR DELETE ON tentatives   FOR EACH ROW EXECUTE FUNCTION lms_append_only();
CREATE TRIGGER certificats_append_only  BEFORE UPDATE OR DELETE ON certificats  FOR EACH ROW EXECUTE FUNCTION lms_append_only();
