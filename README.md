# Nova Stream

Application de streaming desktop + site web — alternative à Streamlabs OBS.

🌐 **Site web** : [hazeyy5.github.io/nova-stream](https://hazeyy5.github.io/nova-stream)  
📦 **Repo** : [github.com/Hazeyy5/nova-stream](https://github.com/Hazeyy5/nova-stream)

## Fonctionnalités (v0.9)

### Alertes & widgets
- File d'attente d'alertes (affichage séquentiel)
- Alertes Bits/Cheers Twitch (EventSub)
- Sons personnalisables par type d'alerte
- GIF Giphy sur les dons (seuil configurable, modération)
- Overlays navigateur live (alertes + sons depuis l'app desktop)

### Dons
- PayPal OAuth (Standard / Business) avec alertes après paiement confirmé
- Historique des dons enrichi (montant, GIF, statut)
- Page tip publique partageable

### Intégrations
- Twitch EventSub (follow, sub, raid, cheer)
- Chat Twitch, objectifs followers/subs, compteur viewers
- Bot Discord Nova Stream (`/nova-setup`, `/sondage`)
- Annonces automatiques dans `#mises-a-jour` à chaque release

### Interface
- Layout studio professionnel (scènes, sources, aperçu, mixeur)
- Thème sombre moderne avec panneaux latéraux
- Aperçu multi-sources sur canvas (composition en temps réel)
- Glisser-déposer des sources dans l'aperçu
- Propriétés par source (position, taille, presets)

### Sources
- Capture écran
- Webcam
- Image (URL)
- Texte / overlay

### Streaming & enregistrement
- RTMP vers Twitch, YouTube, Kick
- Enregistrement local MP4
- Stream + enregistrement simultané (tee FFmpeg)
- Encodeur CPU (x264) ou GPU NVIDIA (NVENC)
- Composition écran + webcam (Picture-in-Picture)

### Audio
- Mixeur avec volume micro
- Capture audio bureau (DirectShow)
- Détection automatique des périphériques

### Scènes
- Création, suppression, renommage (double-clic)
- Réordonnancement des sources
- Transitions (coupe / fondu)
- Persistance locale

### Site web & connexions
- Connexion Twitch sur [le site GitHub Pages](https://hazeyy5.github.io/nova-stream)
- Liaison web → app desktop en un clic
- Chat Box, Alert Box et mini flux synchronisés
- OAuth PKCE (sans backend serveur)

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
React UI
  ├── Canvas Preview (composition)
  ├── Scene / Source manager
  └── IPC → Electron Main
              ├── Device Manager (DirectShow)
              ├── FFmpeg Builder (filtres, overlay, tee)
              └── Stream Manager (processus FFmpeg)
```

## Déploiement du site (GitHub Pages)

1. Configurez `docs/js/config.js` avec votre Twitch Client ID
2. Ajoutez les Redirect URLs sur dev.twitch.tv (voir `docs/SETUP.md`)
3. Poussez sur `main` — le workflow déploie automatiquement le dossier `docs/`

## Roadmap

- [x] Site web + liaison Twitch
- [ ] Connexion Kick sur le site
- [ ] EventSub Twitch (alertes réelles)
- [ ] Filtres vidéo (chroma key)
- [ ] macOS / Linux
