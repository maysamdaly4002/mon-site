-- Médias complémentaires d'une leçon : tableau JSON ordonné de { type, titre, url }.
-- Les leçons existantes reçoivent '[]' : rien ne change pour elles.
-- Comme le contenu principal, un média n'est jamais qu'une adresse https:// (vérifié aussi ici, pas seulement dans l'application).

ALTER TABLE lessons ADD COLUMN medias JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE lessons ADD CONSTRAINT lessons_medias_array
  CHECK (jsonb_typeof(medias) = 'array' AND jsonb_array_length(medias) <= 20);

ALTER TABLE lessons ADD CONSTRAINT lessons_medias_valid
  CHECK (NOT jsonb_path_exists(medias,
    '$[*] ? (!exists(@.url) || !exists(@.type) || !(@.url like_regex "^https://") || !(@.type == "video" || @.type == "image" || @.type == "document" || @.type == "lien"))'));
