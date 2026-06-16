-- Nova Stream — donations (D1)
-- Apply: npx wrangler d1 migrations apply nova-donations

CREATE TABLE IF NOT EXISTS streamers (
  streamer_id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  avatar_url TEXT NOT NULL DEFAULT '',
  donation_key TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  min_amount REAL NOT NULL DEFAULT 1,
  suggested_amounts TEXT NOT NULL DEFAULT '[1,3,5,10,20]',
  page_title TEXT NOT NULL DEFAULT '',
  page_message TEXT NOT NULL DEFAULT '',
  thank_you_message TEXT NOT NULL DEFAULT 'Merci pour votre soutien !',
  paypal_username TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_streamers_username ON streamers(username);

CREATE TABLE IF NOT EXISTS donations (
  id TEXT PRIMARY KEY,
  streamer_id TEXT NOT NULL,
  donor_name TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  status TEXT NOT NULL DEFAULT 'pending_alert',
  payment_provider TEXT NOT NULL DEFAULT 'manual',
  payment_ref TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  alerted_at INTEGER,
  FOREIGN KEY (streamer_id) REFERENCES streamers(streamer_id)
);

CREATE INDEX IF NOT EXISTS idx_donations_streamer_created ON donations(streamer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_donations_pending ON donations(streamer_id, status, created_at);

-- Préparé pour PayPal Connect (OAuth) — prochaine étape
CREATE TABLE IF NOT EXISTS paypal_accounts (
  streamer_id TEXT PRIMARY KEY,
  account_type TEXT NOT NULL DEFAULT '',
  merchant_id TEXT NOT NULL DEFAULT '',
  access_token_enc TEXT NOT NULL DEFAULT '',
  refresh_token_enc TEXT NOT NULL DEFAULT '',
  token_expires_at INTEGER,
  connected_at INTEGER,
  FOREIGN KEY (streamer_id) REFERENCES streamers(streamer_id)
);
