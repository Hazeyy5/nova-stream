-- GIF Giphy choisi par le donateur (don ≥ 25 €)
ALTER TABLE donations ADD COLUMN alert_gif_url TEXT NOT NULL DEFAULT '';
