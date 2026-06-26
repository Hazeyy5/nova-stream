# Bot Discord Nova Stream

Bot réservé au **serveur Discord officiel Nova Stream** (modération, `/nova-setup` admin, `/nova-info`).

## Démarrage

```bash
cd discord-bot
npm install
npm run register   # enregistre les commandes slash sur Discord
npm start          # lance le bot (doit rester ouvert)
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
