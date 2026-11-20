-- Séances en direct (Google Meet) et formulaire d'avis par cours : trois champs facultatifs.
-- Les cours existants reçoivent '' : rien ne change pour eux.
-- Comme les autres adresses du module, ce ne sont jamais que des adresses https:// (vérifié aussi ici, pas seulement dans l'application).

ALTER TABLE courses ADD COLUMN meet_url     TEXT NOT NULL DEFAULT '';
ALTER TABLE courses ADD COLUMN meet_horaire TEXT NOT NULL DEFAULT '';
ALTER TABLE courses ADD COLUMN feedback_url TEXT NOT NULL DEFAULT '';

ALTER TABLE courses ADD CONSTRAINT courses_meet_url_valid     CHECK (meet_url = '' OR meet_url LIKE 'https://meet.google.com/%');
ALTER TABLE courses ADD CONSTRAINT courses_feedback_url_valid CHECK (feedback_url = '' OR feedback_url LIKE 'https://%');
