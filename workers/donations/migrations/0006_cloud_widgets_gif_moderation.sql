-- Sauvegarde cloud des réglages widgets + modération GIF

CREATE TABLE IF NOT EXISTS widget_settings_cloud (
  streamer_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  settings_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS gif_blocklist (
  id TEXT PRIMARY KEY,
  streamer_id TEXT NOT NULL,
  gif_url TEXT NOT NULL,
  gif_id TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  UNIQUE(streamer_id, gif_url)
);

CREATE INDEX IF NOT EXISTS idx_gif_blocklist_streamer ON gif_blocklist(streamer_id);
