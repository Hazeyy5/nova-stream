# Bot Discord Nova Stream

Configure automatiquement un serveur Discord pour la communauté Nova Stream (rôles, catégories, salons, message de bienvenue).

> **Limitation Discord** : un bot **ne peut pas créer** un serveur Discord via l’API. Vous créez un serveur vide en 2 clics, vous invitez le bot, puis `/nova-setup` (ou setup auto si le serveur est vide).

## Démarrage rapide

```bash
cd discord-bot
npm install
cp .env.example .env
# Éditez .env avec votre token
npm start
```

## Portail Discord Developer — quoi activer

Allez sur [discord.com/developers/applications](https://discord.com/developers/applications) et sélectionnez votre application.

### 1. General Information

- **Name** : `Nova Stream` (ou au choix)
- **Icon** : logo Nova Stream (optionnel)

### 2. Bot

| Option | Valeur |
|--------|--------|
| **Reset Token** | ⚠️ Régénérez le token si vous l’avez partagé publiquement, puis mettez-le dans `.env` |
| **Public Bot** | ✅ Activé (pour inviter sur n’importe quel serveur) |
| **Requires OAuth2 Code Grant** | ❌ Désactivé |
| **Privileged Gateway Intents** | **Aucun requis** pour ce bot (commandes slash uniquement) |

- ❌ **Presence Intent** — pas nécessaire  
- ❌ **Server Members Intent** — pas nécessaire  
- ❌ **Message Content Intent** — pas nécessaire  

### 3. OAuth2 → URL Generator

Cochez :

**Scopes**

- ✅ `bot`
- ✅ `applications.commands`

**Bot Permissions** (cochez **Administrateur** pour le setup initial, ou au minimum) :

- Manage Roles  
- Manage Channels  
- Send Messages  
- Embed Links  
- Read Message History  
- Use Slash Commands  

Copiez l’**URL générée**, ouvrez-la dans le navigateur, choisissez votre serveur.

### 4. Inviter le bot

1. Discord → **Ajouter un serveur** → **Pour moi et mes amis** → nommez-le (ex. `Nova Stream Community`)
2. Ouvrez l’URL OAuth2 → sélectionnez ce serveur → autorisez
3. Dans Discord, tapez `/nova-setup` (ou attendez le setup auto si le serveur est vide)

### 5. (Optionnel) Commandes instantanées en dev

Dans `.env`, ajoutez l’ID du serveur pour enregistrer les slash commands immédiatement :

```env
DISCORD_GUILD_ID=123456789012345678
```

(Clic droit sur l’icône du serveur → **Copier l’identifiant du serveur** — mode développeur activé dans Discord)

## Commandes

| Commande | Description |
|----------|-------------|
| `/nova-setup` | Crée rôles, catégories et salons Nova Stream |
| `/nova-info` | Liens site, GitHub, rappel des fonctionnalités |
| `/nova-aide` | Guide d’invitation et de configuration |

## Structure créée

- **Rôles** : Nova Admin, Modérateur, Streamer, Membre, Bot  
- **Catégories** : Informations, Communauté, Nova Stream, Support, Vocal  
- **Salons** : bienvenue, annonces, général, aide-app, widgets-dons, support, etc.

Le setup est **idempotent** : relancer `/nova-setup` ne duplique pas les salons déjà présents.

## Sécurité

- Ne commitez **jamais** le fichier `.env`
- Régénérez le token bot si exposé (chat, screenshot, GitHub)
- En production, hébergez le bot (VPS, Railway, Render, etc.) avec le token en variable d’environnement
