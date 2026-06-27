# Bot Discord Nova Stream

Bot réservé au **serveur Discord officiel Nova Stream** (modération, `/nova-setup` admin, `/nova-info`, `/sondage`).

> **Important :** si le bot tourne sur ton PC (`npm start`), il s’arrête quand tu éteins l’ordinateur. Pour qu’il reste en ligne **24h/24**, héberge-le dans le cloud — voir [Hébergement 24/7](#hébergement-247) ci-dessous.

## Démarrage local (tests uniquement)

```bash
cd discord-bot
npm install
npm run register   # enregistre les commandes slash sur Discord
npm start          # s'arrête si tu fermes le terminal ou éteins le PC
```

## Hébergement 24/7

**Arrête le bot local** avant tout déploiement (un seul processus par token Discord).

Variables d'environnement requises partout :

| Variable | Description |
|----------|-------------|
| `DISCORD_TOKEN` | Token du bot (portail Discord Developer) |
| `DISCORD_GUILD_ID` | ID du serveur Nova Stream (`1519398606921011231`) |

Optionnelles : `NOVA_WEBSITE_URL`, `NOVA_GITHUB_URL`, `PORT` (défaut `8080`, health check HTTP).

---

### Option A — JustRunMy.App (recommandé, sans carte bancaire)

[justrunmy.app](https://justrunmy.app/discord-bots) — hébergement bot 24/7, déploiement Docker ou Git, **pas de carte requise** sur le plan gratuit.

1. Crée un compte sur [justrunmy.app](https://justrunmy.app)
2. **New app** → déploiement **Docker** ou **Git**
3. Si Git : repo `Hazeyy5/nova-stream`, **root directory** = `discord-bot`
4. Variables d'environnement :
   - `DISCORD_TOKEN` = ton token
   - `DISCORD_GUILD_ID` = `1519398606921011231`
5. Port exposé : **8080** (health check — le bot Discord tourne en parallèle)
6. **Deploy** → vérifie les logs : `Connecté en tant que StreamBot#...`

---

### Option B — MonkeyBytes (sans carte bancaire)

[monkey-network.xyz](https://monkey-network.xyz/) — panel type Pterodactyl, Node.js, 24/7 gratuit.

1. Crée un compte et un serveur **Discord bot / Node.js**
2. Upload le contenu de `discord-bot/` (SFTP ou file manager)
3. Console : `npm install`
4. Variables / `.env` : `DISCORD_TOKEN`, `DISCORD_GUILD_ID`
5. Commande de démarrage : `node src/index.js`
6. Lance le serveur depuis le panel

---

### Option C — Fly.io (carte bancaire obligatoire)

Fly.io **demande une carte** même pour le quota gratuit (vérification d'identité). Si tu acceptes :

```bash
cd discord-bot
fly auth login
fly apps create nova-stream-discord   # peut exiger la facturation
fly secrets set DISCORD_TOKEN="..." DISCORD_GUILD_ID="1519398606921011231"
fly deploy
```

> Ne pas utiliser `fly launch` avec un `fly.toml` existant (bug `region not found`).

---

### Option D — Railway (recommandé si tu as une carte)

Guide détaillé : **[RAILWAY.md](./RAILWAY.md)**

Résumé :

1. [railway.app](https://railway.app) → **New Project** → repo `Hazeyy5/nova-stream`
2. **Settings** → **Root Directory** = `discord-bot`
3. **Variables** : `DISCORD_TOKEN`, `DISCORD_GUILD_ID` = `1519398606921011231`
4. **Networking** → **Generate Domain** (health check)
5. Vérifie les logs : `Connecté en tant que StreamBot#...`

Builder : **Nixpacks** (automatique). En cas d’erreur Docker, ne pas forcer le Dockerfile.

---

### Option E — VPS Oracle Cloud (gratuit à vie, carte pour vérification)

Oracle Cloud **Always Free** : 1 VM ARM gratuite permanente. Carte demandée pour vérification (pas de débit si tu restes dans le free tier).

```bash
# Sur la VM (Ubuntu)
git clone https://github.com/Hazeyy5/nova-stream.git
cd nova-stream/discord-bot
cp .env.example .env   # puis édite DISCORD_TOKEN et DISCORD_GUILD_ID
docker build -t nova-discord .
docker run -d --restart unless-stopped --env-file .env -p 8080:8080 nova-discord
```

---

### Mise à jour du bot (cloud)

- **JustRunMy.App / Railway / Fly** : redeploy depuis le dashboard ou `git push` si Git connecté
- **MonkeyBytes** : upload des fichiers modifiés + redémarrage
- **Docker VPS** : `git pull && docker build ... && docker run ...`

Les commandes slash sont **ré-enregistrées au démarrage** du bot (`index.js`).

## Portail Discord Developer

1. [discord.com/developers/applications](https://discord.com/developers/applications) → votre app
2. **Bot** → Reset Token → `.env` / variables cloud
3. **Public Bot** → **Désactivé** (le bot ne doit pas être invitable ailleurs)
4. **Privileged Gateway Intents** → rien à activer
5. Invitez le bot **une seule fois** sur le serveur Nova Stream (OAuth2, scope `bot` + `applications.commands`, permission Administrateur pour le setup initial)

## Commandes (serveur Nova Stream uniquement)

| Commande | Description |
|----------|-------------|
| `/nova-setup` | [Admin] Crée ou complète rôles et salons |
| `/nova-info` | Liens site, GitHub, rappel des features |
| `/ticket-panel` | [Admin] Publie le panel d'ouverture de tickets |
| `/ticket-close` | Fermer le ticket (auteur ou staff) |
| `/ticket-add` | [Staff] Ajouter un membre au ticket |
| `/ticket-remove` | [Staff] Retirer un membre du ticket |
| `/sondage` ou `/nova-sondage` | Créer un sondage (2 à 5 options, votes par boutons) |

### Système de tickets

1. Les membres vont dans **`#ouvrir-ticket`** et cliquent sur une catégorie (Application, Bug, Widgets & Dons, Autre).
2. Un salon privé **`ticket-XXX-pseudo`** est créé — visible par l'auteur et le staff (`Modérateur`, `Nova Admin`).
3. **Fermer** : bouton 🔒 dans le ticket ou `/ticket-close [raison]`.
4. Les fermetures sont archivées dans **`#logs-tickets`** (staff).

Pour installer sur un serveur déjà configuré : `/nova-setup` (ajoute la catégorie 🎫 TICKETS et `#ouvrir-ticket`) ou `/ticket-panel` dans un salon de votre choix.

### `/sondage`

Exemple :

```
/sondage question:Quel widget ajouter en priorité ? option1:Alertes Bits option2:Kick option3:macOS duree:48
```

- **2 à 5 options** (option1 et option2 obligatoires)
- **duree** : 1 à 168 heures (défaut 24 h)
- **multi** : `true` pour autoriser plusieurs votes par personne
- Les membres votent en cliquant sur les boutons ; les résultats se mettent à jour en direct
- Le sondage se clôt automatiquement après la durée choisie

## Lien public sur le site

Dans `shared/platform.json`, ajoutez l'invite permanente du serveur (pas du bot) :

```json
"discordCommunityInviteUrl": "https://discord.gg/votre-lien"
```

Puis `npm run sync-config` et push.

Le site affiche alors **Rejoindre le Discord Nova Stream** (accueil + dashboard).

## Sécurité

- Ne commitez jamais `.env`
- Régénérez le token si exposé
- `DISCORD_GUILD_ID` obligatoire — le bot ignore les autres serveurs
