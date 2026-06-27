# Déployer le bot Discord sur Railway

Guide pas à pas pour héberger **StreamBot** 24h/24 sur [Railway](https://railway.app).

## Avant de commencer

- [ ] **Arrête le bot local** (`npm start` sur ton PC) — un seul processus par token Discord
- [ ] Token bot et ID serveur sous la main :
  - `DISCORD_TOKEN` → [Discord Developer Portal](https://discord.com/developers/applications) → Bot → Token
  - `DISCORD_GUILD_ID` = `1519398606921011231`

---

## 1. Créer le projet

1. Va sur [railway.app](https://railway.app) et connecte-toi (GitHub).
2. **New Project** → **Deploy from GitHub repo**.
3. Choisis **`Hazeyy5/nova-stream`**.

---

## 2. Configurer le service

1. Clique sur le service créé → onglet **Settings**.
2. **Root Directory** : `discord-bot`  
   *(Railway ne build que ce dossier — obligatoire pour un monorepo.)*
3. **Start Command** : laisse vide ou `npm start`  
   *(déjà défini dans `package.json`.)*
4. **Watch Paths** (optionnel) : `discord-bot/**`  
   *(redéploie seulement quand le bot change.)*

### Builder (recommandé : Nixpacks)

Par défaut Railway détecte Node.js via `package.json` — c’est le plus simple.

Si le build Docker échoue (« Dockerfile not found »), dans **Settings → Build** :
- Builder : **Nixpacks** (pas Docker)

Ou ajoute une variable :
- `RAILWAY_DOCKERFILE_PATH` = `Dockerfile` (uniquement si tu forces Docker)

---

## 3. Variables d'environnement

Onglet **Variables** → **Add variable** :

| Variable | Valeur |
|----------|--------|
| `DISCORD_TOKEN` | `ton_token_bot` |
| `DISCORD_GUILD_ID` | `1519398606921011231` |

Optionnel :

| Variable | Valeur |
|----------|--------|
| `NOVA_WEBSITE_URL` | `https://hazeyy5.github.io/nova-stream` |
| `NOVA_GITHUB_URL` | `https://github.com/Hazeyy5/nova-stream` |

> Railway injecte automatiquement `PORT` — le bot écoute dessus pour le health check.

---

## 4. Exposer le port (health check)

1. Onglet **Settings** → **Networking** → **Generate Domain**.
2. Railway assigne un domaine public (ex. `nova-stream-discord-production.up.railway.app`).
3. Le bot répond `Nova Stream Discord bot OK` sur ce domaine — ça confirme qu’il tourne.

---

## 5. Déployer

1. **Deploy** (ou push sur `main` — Railway redéploie automatiquement).
2. Onglet **Deployments** → clique le déploiement → **View logs**.
3. Tu dois voir :
   ```
   [Nova Discord] Health check : http://0.0.0.0:XXXX
   [Nova Discord] Connecté en tant que StreamBot#5087 — serveur 1519398606921011231
   [Nova Discord] Commandes enregistrées sur le serveur ...
   ```

4. Teste sur Discord : `/nova-info` ou `/sondage`.

---

## 6. Mises à jour

Chaque `git push` sur `main` (dossier `discord-bot/` modifié) redéploie automatiquement.

Ou manuellement : **Deployments** → **Redeploy**.

---

## Dépannage

| Problème | Solution |
|----------|----------|
| Bot offline sur Discord | Vérifie les logs ; token invalide ou bot local encore actif |
| Build échoue « Dockerfile » | Passe le builder en **Nixpacks** ou vérifie Root Directory = `discord-bot` |
| `DISCORD_TOKEN manquant` | Variable mal nommée ou pas redéployé après ajout |
| Commandes slash absentes | Attends 1 min après le démarrage ; ou relance le service |
| Service « crashed » | Logs → erreur token / mémoire ; plan Railway ≥ 512 Mo recommandé |

---

## Coût

Railway facture à l’usage (carte requise). Un bot Discord léger consomme peu (~512 Mo RAM). Surveille l’usage dans **Project → Usage**.
