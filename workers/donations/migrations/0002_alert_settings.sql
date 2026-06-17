-- Alertes don (texte personnalisable)
ALTER TABLE streamers ADD COLUMN alert_title TEXT NOT NULL DEFAULT 'Don';
ALTER TABLE streamers ADD COLUMN alert_default_message TEXT NOT NULL DEFAULT '';
ALTER TABLE streamers ADD COLUMN alert_message_template TEXT NOT NULL DEFAULT '{amount} — {message}';
