-- Seuil GIF configurable et option de désactivation par streamer
ALTER TABLE streamers ADD COLUMN donation_gif_min_amount REAL NOT NULL DEFAULT 25;
ALTER TABLE streamers ADD COLUMN donation_gif_enabled INTEGER NOT NULL DEFAULT 1;
