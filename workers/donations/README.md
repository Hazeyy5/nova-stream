# API Dons Nova Stream (Cloudflare Worker + D1)

Relais central multi-streamers : page de tip, alertes live, **historique persistant** (comme Streamlabs).

## 1. Créer la base D1

```bash
cd workers/donations
npx wrangler d1 create nova-donations
```

Copiez le `database_id` dans `wrangler.toml` (`REPLACE_WITH_D1_DATABASE_ID`).

## 2. Appliquer le schéma SQL

```bash
npx wrangler d1 migrations apply nova-donations --remote
# Dev local :
npx wrangler d1 migrations apply nova-donations --local
```

## 3. Déployer le worker

```bash
npx wrangler deploy
```

Notez l’URL (ex. `https://nova-stream-donations.votre-compte.workers.dev`).

## 4. Configurer Nova Stream

Dans `shared/platform.json` :

```json
"donationsApiUrl": "https://nova-stream-donations.votre-compte.workers.dev"
```

Puis :

```bash
npm run sync-config
```

## Schéma D1

| Table | Rôle |
|-------|------|
| `streamers` | 1 ligne par streamer Twitch (réglages, clé secrète) |
| `donations` | Chaque don (montant, message, statut, horodatage) |
| `paypal_accounts` | Réservé PayPal OAuth (prochaine étape) |

## Endpoints

| Route | Description |
|-------|-------------|
| `GET /v1/health` | Santé + `storage: d1` |
| `GET /v1/streamer?username=` | Infos publiques page tip |
| `POST /v1/register` | Enregistrement / MAJ streamer (dashboard) |
| `POST /v1/donate` | Envoi d’un don (viewer) |
| `GET /v1/poll?streamerId=&key=&since=` | Alertes en attente (app desktop) |
| `GET /v1/history?streamerId=&key=&limit=` | Historique + stats (dashboard) |

## Flux

1. Streamer → **Dons** sur le site → synchronise avec Nova Stream.
2. Viewer → `tip.html?u=pseudo` → don enregistré en D1.
3. App desktop poll `/v1/poll` → alerte sur la scène.
4. Dashboard → **Historique des pourboires** via `/v1/history`.

## Migration depuis KV

Si vous aviez l’ancienne version KV : les streamers doivent **ré-enregistrer** leurs réglages (bouton Enregistrer sur la page Dons). Les anciens dons KV ne sont pas migrés automatiquement.

## Prochaine étape : PayPal Connect

La table `paypal_accounts` est prête pour OAuth PayPal (Standard / Business) — alertes déclenchées après webhook `payment completed`.
