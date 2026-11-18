-- Schéma relationnel du module CRM (PostgreSQL 14+, compatible Neon).
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         CITEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'viewer')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE companies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  website    TEXT NOT NULL DEFAULT '',
  phone      TEXT NOT NULL DEFAULT '',
  address    TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE contacts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL DEFAULT '',
  last_name  TEXT NOT NULL,
  email      CITEXT UNIQUE,                       -- NULL autorisé, doublons interdits
  phone      TEXT NOT NULL DEFAULT '',
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  source     TEXT NOT NULL DEFAULT 'manuel',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX contacts_company_idx ON contacts (company_id);
CREATE INDEX contacts_source_idx  ON contacts (source);
CREATE INDEX contacts_created_idx ON contacts (created_at DESC, id);
-- Recherche « contient » sur 100 000+ contacts : index trigramme (au lieu d'un scan complet).
CREATE INDEX contacts_search_idx ON contacts USING gin (
  (lower(first_name || ' ' || last_name || ' ' || coalesce(email::text, '') || ' ' || phone)) gin_trgm_ops
);

CREATE TABLE deals (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id     UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  stage          TEXT NOT NULL DEFAULT 'nouveau' CHECK (stage IN ('nouveau','qualifie','proposition','gagne','perdu')),
  amount         NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  expected_close DATE,
  position       INTEGER NOT NULL DEFAULT 0,       -- ordre dans la colonne du kanban
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX deals_stage_idx   ON deals (stage, position);
CREATE INDEX deals_contact_idx ON deals (contact_id);

CREATE TABLE activities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('note','call','email')),
  note        TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX activities_contact_idx ON activities (contact_id, occurred_at DESC);

CREATE TABLE tags (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name CITEXT UNIQUE NOT NULL
);
CREATE TABLE contact_tags (
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tag_id     UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (contact_id, tag_id)
);
CREATE INDEX contact_tags_tag_idx ON contact_tags (tag_id);
