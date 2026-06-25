# Bot Discord Nova Stream

Bot réservé au **serveur Discord officiel Nova Stream** (modération, `/nova-setup` admin, `/nova-info`).

## Démarrage

```bash
cd discord-bot
npm install
cp .env.example .env
# Token + DISCORD_GUILD_ID du serveur Nova Stream
npm start
```

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
