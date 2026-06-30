# API Dons Nova Stream (Cloudflare Worker + D1)

Relais multi-streamers : page de tip, **PayPal Standard ou Business**, alertes live **après paiement confirmé**.

## 1. Créer la base D1

```bash
cd workers/donations
npx wrangler d1 create nova-donations
```

Copiez le `database_id` dans `wrangler.toml`.

## 2. Appliquer le schéma SQL

```bash
npx wrangler d1 migrations apply nova-donations --remote
# Dev local :
npx wrangler d1 migrations apply nova-donations --local
```

## 3. App PayPal Developer

1. [developer.paypal.com](https://developer.paypal.com) → **Create App** (Sandbox puis Live).
2. Notez **Client ID** et **Secret**.
3. **Log in with PayPal** (app Sandbox → Features / App settings) :
   - Activer **Log in with PayPal**
   - Cocher les scopes : **openid**, **profile**, **email**
   - **Return URL** :
   `https://VOTRE-WORKER.workers.dev/v1/paypal/callback`
4. (Recommandé) **Webhook** → URL :
   `https://VOTRE-WORKER.workers.dev/v1/webhooks/paypal`
   Événements : `PAYMENT.CAPTURE.COMPLETED`, `CHECKOUT.ORDER.APPROVED`

## 4. Secrets Worker

```bash
cd workers/donations
npx wrangler secret put PAYPAL_CLIENT_ID
npx wrangler secret put PAYPAL_CLIENT_SECRET
npx wrangler secret put PAYPAL_WEBHOOK_ID   # optionnel mais recommandé
npx wrangler secret put GIPHY_API_KEY        # recherche GIF donateurs (≥ 25 €)
```

Variables dans `wrangler.toml` (ou secrets) :

| Variable | Description |
|----------|-------------|
| `PAYPAL_MODE` | `sandbox` ou `live` |
| `PAYPAL_REDIRECT_URI` | URL callback OAuth (exacte, enregistrée chez PayPal) |

Voir `.dev.vars.example` pour le dev local.

## 5. Déployer

```bash
npx wrangler deploy
```

## 6. Configurer Nova Stream

Dans `shared/platform.json` :

```json
"donationsApiUrl": "https://nova-stream-donations.votre-compte.workers.dev"
```

Puis :

```bash
npm run sync-config
```

## Flux streamer (comme Streamlabs)

1. Site → **Dons** → cocher **Activer les dons**.
2. Choisir **Connecter PayPal Standard** ou **Connecter PayPal Business**.
3. Autoriser PayPal → compte lié.
4. **Enregistrer et synchroniser** → Nova Stream desktop reçoit les réglages.
5. Partager `tip.html?u=pseudo_twitch`.

## Flux viewer

1. Choisir montant + message.
2. Payer via **bouton PayPal**.
3. Paiement capturé → statut `pending_alert`.
4. App desktop poll → alerte sur la scène.

## Compte Standard vs Business

Les deux utilisent le **même flux OAuth** ; le streamer indique le type de compte qu'il possède avant la connexion. L'argent est versé sur **son** compte PayPal (token OAuth du streamer).

## Mode legacy PayPal.me

Si PayPal n'est pas connecté, le streamer peut encore renseigner **PayPal.me** : alerte **avant** paiement (sans vérification — déconseillé).

## Endpoints

| Route | Description |
|-------|-------------|
| `GET /v1/paypal/config` | Client ID public + mode sandbox/live |
| `GET /v1/paypal/connect-url` | URL OAuth (Standard ou Business) |
| `GET /v1/paypal/callback` | Retour OAuth PayPal |
| `GET /v1/paypal/status` | Compte connecté (streamer) |
| `POST /v1/paypal/disconnect` | Déconnexion |
| `POST /v1/paypal/create-order` | Créer commande checkout |
| `POST /v1/paypal/capture-order` | Capturer paiement → alerte |
| `POST /v1/webhooks/paypal` | Webhook PayPal (backup) |
| `POST /v1/donate` | Legacy (alerte sans vérif) |
| `GET /v1/giphy/search` | Recherche / trending Giphy (page de don) |
| `GET /v1/giphy/config` | Seuil GIF (25) + statut API |
| `GET /v1/stats` | Statistiques dons (total, mois, top donateurs, 7 jours) |
| `GET /v1/widget-settings` | Sauvegarde cloud réglages widgets (auth Bearer Twitch) |
| `PUT /v1/widget-settings` | Enregistrer réglages widgets dans le cloud |
| `GET /v1/gif-blocklist` | Liste des GIF bloqués (streamer) |
| `POST /v1/gif-blocklist` | Bloquer un GIF |
| `DELETE /v1/gif-blocklist` | Débloquer un GIF |

Les donateurs peuvent ajouter un **GIF Giphy** sur la page de tip pour les dons **≥ 25 €** (ou USD). L'URL est stockée en base (`alert_gif_url`) et affichée sur l'alerte live. Les streamers peuvent **bloquer** des GIF via le dashboard (blocklist D1).

### Migration 0006 (cloud widgets + modération GIF)

```bash
npx wrangler d1 migrations apply nova-donations --remote
npx wrangler deploy
```

## Statuts don

| Statut | Signification |
|--------|---------------|
| `pending_payment` | En attente paiement PayPal |
| `pending_alert` | Payé — en attente poll app |
| `alerted` | Affiché sur le stream |
| `failed` | Paiement échoué |
