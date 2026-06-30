# Nova Stream

Application de streaming desktop + site web — alternative à Streamlabs OBS.

🌐 **Site web** : [hazeyy5.github.io/nova-stream](https://hazeyy5.github.io/nova-stream)  
📦 **Repo** : [github.com/Hazeyy5/nova-stream](https://github.com/Hazeyy5/nova-stream)

## Fonctionnalités (v1.0)

### Nouveautés v1.0
- **Thèmes d'application** — Nova, Midnight, Ocean, Forest ou accent personnalisé (Paramètres → Apparence)
- **Packs scènes live** — Starting Soon, scène principale, BRB et fin de stream (Gaming, Just Chatting, IRL, Creative, Minimal)
- **TTS points de chaîne Twitch** — lecture vocale des messages via EventSub (Apps → TTS, capture audio bureau pour le stream)

### Alertes & widgets
- File d'attente d'alertes (affichage séquentiel)
- Alertes Bits/Cheers Twitch (EventSub)
- Sons personnalisables par type d'alerte
- GIF Giphy sur les dons (seuil configurable, modération par blocklist)
- Overlays navigateur live (alertes + sons depuis l'app desktop)
- **Sauvegarde cloud** des réglages widgets (par compte Twitch, D1)

### Dons
- PayPal OAuth (Standard / Business) avec alertes après paiement confirmé
- Historique et **statistiques** (total, mois, top donateurs, graphique 7 jours)
- Modération GIF (blocklist streamer)
- Page tip publique partageable

### Intégrations
- Twitch EventSub (follow, sub, raid, cheer/bits, **points de chaîne TTS**)
- Chat Twitch, objectifs followers/subs, compteur viewers, sondages
- Connexion Twitch **in-app** ou via le site web
- Bot Discord Nova Stream (`/nova-setup`, `/nova-status`, tickets, sondages)
- Annonces automatiques dans `#mises-a-jour` (releases app + déploiements site)

### Interface
- Layout studio professionnel (scènes, sources, aperçu, mixeur)
- Thèmes d'interface (5 presets + couleur accent personnalisée)
- Thème sombre moderne avec panneaux latéraux
- Aperçu multi-sources sur canvas (composition en temps réel)
- Glisser-déposer des sources dans l'aperçu
- Propriétés par source (position, taille, presets)
- Chroma key dans l'aperçu (preview canvas)

### Sources
- Capture écran
- Webcam
- Image (URL)
- Texte / overlay

### Streaming & enregistrement
- RTMP vers Twitch, YouTube, Kick (URL manuelle)
- Enregistrement local MP4
- Stream + enregistrement simultané (tee FFmpeg)
- Encodeur CPU (x264) ou GPU NVIDIA (NVENC)
- Composition écran + webcam (Picture-in-Picture)

### Audio
- Mixeur avec volume micro
- Capture audio bureau (DirectShow)
- Détection automatique des périphériques

### Scènes
- Packs live prêts à l'emploi (galerie à l'accueil et dans Paramètres → Scènes)
- Création, suppression, renommage (double-clic)
- Réordonnancement des sources
- Transitions (coupe / fondu)
- Export / import de scènes et collections
- Persistance locale

### Site web & connexions
- Connexion Twitch sur [le site GitHub Pages](https://hazeyy5.github.io/nova-stream)
- Liaison web → app desktop en un clic (port 3847)
- Sync automatique site → app + **backup cloud** des réglages
- Guide utilisateur structuré (`help.html`)
- Chat Box, Alert Box et widgets synchronisés
- OAuth implicit flow (token côté navigateur)

## Prérequis

- Node.js 18+
- Windows 10/11
- FFmpeg (inclus via `ffmpeg-static`)
- Carte NVIDIA (optionnel, pour NVENC)

## Installation & lancement

```bash
npm install
npm run dev
```

## Utilisation

1. **Paramètres** → configurer plateforme, clé de stream, périphériques
2. Composer votre scène (écran + facecam par exemple)
3. Ajuster la position de la webcam dans l'aperçu (glisser-déposer)
4. **Stream** pour diffuser, **Enregistrer** pour un fichier local, ou **Stream + REC**

Les enregistrements sont sauvegardés dans `~/Videos/NovaStream/` par défaut.

## Architecture

```
React UI (Electron)
  ├── Canvas Preview (composition + chroma key preview)
  ├── Scene / Source manager
  └── IPC → Electron Main
              ├── Device Manager (DirectShow)
              ├── FFmpeg Builder (filtres, overlay, tee)
              ├── Twitch EventSub / Chat / Helix
              └── Stream Manager (processus FFmpeg)

Site GitHub Pages
  ├── OAuth Twitch → widget-settings (local + cloud D1)
  └── Liaison locale → app (http://127.0.0.1:3847)

Cloudflare Worker + D1
  ├── Dons PayPal
  ├── Stats & modération GIF
  └── Sauvegarde réglages widgets
```

## Déploiement du site (GitHub Pages)

1. `npm run sync-config` synchronise `shared/platform.json` → `docs/js/config.js`
2. Ajoutez les Redirect URLs Twitch sur dev.twitch.tv (voir `docs/SETUP.md`)
3. Poussez sur `main` — le workflow déploie `docs/` et annonce sur Discord

## Worker dons & cloud settings

```bash
cd workers/donations
npx wrangler d1 migrations apply nova-donations --remote
npx wrangler deploy
```

## Roadmap

- [x] Site web + liaison Twitch
- [x] EventSub Twitch (alertes réelles)
- [x] Chroma key (aperçu canvas)
- [x] Sauvegarde cloud des réglages widgets
- [x] Stats dons + modération GIF
- [x] Bot Discord (tickets, `/nova-status`, transcripts)
- [x] Annonces Discord automatiques (app + site)
- [ ] Chroma key dans le flux FFmpeg (stream live)
- [ ] Connexion Kick sur le site
- [ ] YouTube OAuth / Go Live
- [ ] macOS / Linux
