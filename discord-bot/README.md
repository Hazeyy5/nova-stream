# Bot Discord Nova Stream

Bot réservé au **serveur Discord officiel Nova Stream** (modération, `/nova-setup` admin, `/nova-info`, `/sondage`).

> **Important :** si le bot tourne sur ton PC (`npm start`), il s’arrête quand tu éteins l’ordinateur. Pour qu’il reste en ligne **24h/24**, déploie-le sur Fly.io (gratuit, ~5 min) — voir [Hébergement 24/7](#hébergement-247-flyio) ci-dessous.

## Démarrage local (tests uniquement)

```bash
cd discord-bot
npm install
npm run register   # enregistre les commandes slash sur Discord
npm start          # lance le bot (s'arrête si tu fermes le terminal ou éteins le PC)
```

## Hébergement 24/7 (Fly.io)

Fly.io permet de faire tourner le bot en permanence **sans laisser ton PC allumé**. Plan gratuit suffisant pour un bot Discord (~256 Mo RAM).

### Prérequis

1. Compte gratuit : [fly.io/app/sign-up](https://fly.io/app/sign-up)
2. CLI Fly : [fly.io/docs/hands-on/install-flyctl](https://fly.io/docs/hands-on/install-flyctl/)  
   Windows (PowerShell) : `iwr https://fly.io/install.ps1 -useb | iex`
3. **Arrête le bot local** avant le déploiement (un seul processus par token Discord).

### Déploiement (une fois)

```bash
cd discord-bot
fly auth login
fly launch --no-deploy --copy-config --name nova-stream-discord
```

Si Fly demande de créer l’app, confirme. Puis :

```bash
fly secrets set DISCORD_TOKEN="votre_token" DISCORD_GUILD_ID="1519398606921011231"
fly deploy
```

Enregistrer les commandes slash (une fois après le premier déploiement) :

```bash
# En local avec le même .env, ou :
fly ssh console -C "node src/register-commands.js"
```

*(Les commandes sont aussi ré-enregistrées au démarrage du bot via `index.js`.)*

### Commandes utiles

| Commande | Action |
|----------|--------|
| `fly status` | Voir si le bot tourne |
| `fly logs` | Logs en direct |
| `fly deploy` | Redéployer après une mise à jour du code |
| `fly apps restart nova-stream-discord` | Redémarrer |
| `fly scale count 0` | Arrêter (économiser) |
| `fly scale count 1` | Relancer |

### Mise à jour du bot

Après un `git pull` sur le repo :

```bash
cd discord-bot
fly deploy
```

### Alternative : Railway / VPS

- **Railway** : connecte le repo GitHub, dossier `discord-bot`, variables `DISCORD_TOKEN` + `DISCORD_GUILD_ID`, commande de start `npm start`.
- **VPS** (Oracle Cloud free, OVH, etc.) : `docker build -t nova-discord . && docker run -d --env-file .env nova-discord`

## Portail Discord Developer

1. [discord.com/developers/applications](https://discord.com/developers/applications) → votre app
2. **Bot** → Reset Token → `.env`
3. **Public Bot** → **Désactivé** (le bot ne doit pas être invitable ailleurs)
4. **Privileged Gateway Intents** → rien à activer
5. Invitez le bot **une seule fois** sur le serveur Nova Stream (OAuth2, scope `bot` + `applications.commands`, permission Administrateur pour le setup initial)

## Commandes (serveur Nova Stream uniquement)

| Commande | Description |
|----------|-------------|
| `/nova-setup` | [Admin] Crée ou complète rôles et salons |
| `/nova-info` | Liens site, GitHub, rappel des features |
| `/sondage` ou `/nova-sondage` | Créer un sondage (2 à 5 options, votes par boutons) |

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
