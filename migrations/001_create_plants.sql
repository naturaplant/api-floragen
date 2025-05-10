-- migrations/001_create_plants.sql

CREATE TABLE IF NOT EXISTS plants
(
    id                INTEGER PRIMARY KEY,
    name              TEXT NOT NULL,
    language          TEXT NOT NULL,
    scientific_name   TEXT,
    title             TEXT,
    brief_description TEXT,
    content           TEXT,
    slug              TEXT NOT NULL,
    UNIQUE (slug, language)
);

