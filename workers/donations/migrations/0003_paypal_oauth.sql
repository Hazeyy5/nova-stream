-- PayPal OAuth : email + payer_id pour affichage
ALTER TABLE paypal_accounts ADD COLUMN email TEXT NOT NULL DEFAULT '';
ALTER TABLE paypal_accounts ADD COLUMN payer_id TEXT NOT NULL DEFAULT '';

-- Suivi paiement confirmé
ALTER TABLE donations ADD COLUMN paid_at INTEGER;
