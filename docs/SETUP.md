# Configuration du site Nova Stream (GitHub Pages)

## 1. Application Twitch

Sur [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps), créez une application avec :

| Champ | Valeur |
|-------|--------|
| OAuth Redirect URLs | `https://hazeyy5.github.io/nova-stream/oauth/callback.html` |
| | `http://localhost:3456/auth/twitch/callback` (app desktop) |
| Category | Website Integration |

## 2. Client ID sur le site

Éditez `docs/js/config.js` :

```javascript
TWITCH_CLIENT_ID: 'votre_client_id_ici',
```

## 3. App desktop (.env)

Le site web utilise le **flux implicite** (sans secret). L'app desktop utilise le **flux authorization code**, qui exige le Client Secret :

```env
TWITCH_CLIENT_ID=votre_client_id
TWITCH_CLIENT_SECRET=votre_client_secret
```

Le Client Secret se trouve sur [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps) → votre app → **Manage** → **New Secret**.

## 4. Déploiement GitHub Pages

1. Poussez le code sur `main`
2. GitHub → Settings → Pages → Source : **GitHub Actions**
3. Le workflow `.github/workflows/pages.yml` déploie automatiquement le dossier `docs/`

Site : **https://hazeyy5.github.io/nova-stream**

## 5. Flux utilisateur

1. L'utilisateur ouvre le site et se connecte avec Twitch
2. Il lance Nova Stream sur son PC
3. Sur le tableau de bord web, il clique **Lier à Nova Stream**
4. L'app reçoit le token via `localhost:3847` et active chat + alertes

## 6. Publier une release (installateur Windows)

1. Mettez à jour la version dans `package.json` et `shared/platform.json`
2. Exécutez `npm run sync-config` (met à jour le badge du site)
3. Commitez, puis créez et poussez un tag :
   ```bash
   git tag v0.6.0
   git push origin v0.6.0
   ```
4. GitHub Actions (`.github/workflows/release.yml`) compile **Nova-Stream-Setup-x.x.x.exe** et le publie sur [Releases](https://github.com/Hazeyy5/nova-stream/releases)
5. Le site récupère automatiquement la dernière release via l'API GitHub — les boutons **Télécharger** pointent vers l'installateur

Test local de l'installateur (sans publier) :
```bash
npm run dist:win
```
Le fichier apparaît dans le dossier `release/`.
