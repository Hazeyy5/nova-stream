# API Dons Nova Stream (Cloudflare Worker)

Relais central pour les pages de dons (comme Streamlabs) : les viewers envoient un don sur le site, l'app desktop récupère les alertes en temps réel.

## Déploiement (mainteneur)

```bash
cd workers/donations
npx wrangler kv namespace create DONATIONS_KV
# Copiez l'id dans wrangler.toml (binding DONATIONS_KV)

npx wrangler deploy
```

Notez l'URL du worker (ex. `https://nova-stream-donations.votre-compte.workers.dev`).

Dans `shared/platform.json` :

```json
"donationsApiUrl": "https://nova-stream-donations.votre-compte.workers.dev"
```

Puis :

```bash
npm run sync-config
```

## Flux

1. Le streamer active les dons sur **Tableau de bord → Dons** et synchronise avec Nova Stream.
2. Il partage son lien `tip.html?u=pseudo`.
3. Un viewer envoie un don → le worker met le don en file.
4. Nova Stream interroge `/v1/poll` toutes les 2,5 s → alerte sur la scène + événement dans le panneau.

## PayPal (optionnel)

Le streamer peut renseigner son identifiant **PayPal.me** : après l'envoi du don, le viewer est invité à payer via PayPal.

## Endpoints

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/v1/health` | Santé |
| GET | `/v1/streamer?username=` | Infos publiques page de don |
| POST | `/v1/register` | Enregistrement streamer (dashboard) |
| POST | `/v1/donate` | Envoi d'un don (viewer) |
| GET | `/v1/poll?streamerId=&key=&since=` | Récupération alertes (app desktop) |
