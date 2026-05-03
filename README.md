# 🌪️ VIGITORNADE

**Surveillance tornadique en temps réel pour la France**
Données IGN officielles + Open-Meteo + Algorithme STP multiplicatif

---

## 🚀 Installation rapide (5 minutes)

### Prérequis
- **Node.js** version 18 ou supérieure ([télécharger ici](https://nodejs.org))
- Un terminal (Terminal sur Mac, PowerShell sur Windows, bash sur Linux)

### Étapes

```bash
# 1. Aller dans le dossier du projet
cd vigitornade

# 2. Installer les dépendances
npm install

# 3. Lancer en mode développement
npm run dev
```

Ouvrez ensuite votre navigateur à l'adresse affichée (généralement `http://localhost:3000`).

L'application se connecte automatiquement aux APIs officielles :
- **IGN** (`geo.api.gouv.fr`) — contours administratifs des régions
- **Open-Meteo** (`api.open-meteo.com`) — météo temps réel + prévision 48h

---

## 🌐 Déploiement en production (gratuit)

### Option 1 : Vercel (recommandé, le plus simple)

```bash
# Installer Vercel CLI
npm install -g vercel

# Déployer
vercel
```

Suivez les instructions. En 2 minutes votre app est en ligne avec une URL `https://vigitornade-xxx.vercel.app`.

### Option 2 : Netlify

1. Créer un compte sur [netlify.com](https://netlify.com)
2. `npm run build`
3. Glisser-déposer le dossier `dist/` sur Netlify

### Option 3 : Build statique pour n'importe quel hébergeur

```bash
npm run build
```

Le dossier `dist/` contient l'app prête à être uploadée par FTP, sur OVH, Infomaniak, GitHub Pages, etc.

---

## 📁 Structure du projet

```
vigitornade/
├── package.json          # Dépendances npm
├── vite.config.js        # Configuration build
├── index.html            # Point d'entrée HTML
├── src/
│   ├── main.jsx          # Bootstrap React
│   ├── App.jsx           # Composant principal (carte, UI)
│   ├── data.js           # Stations, projection, fetchers IGN/Open-Meteo
│   └── stp.js            # Algorithme STP + Bunkers
└── README.md             # Ce fichier
```

---

## 🛠️ Fonctionnalités

### Carte interactive
- 13 régions métropolitaines colorées par indice de risque
- Contours officiels IGN (BD ADMIN EXPRESS via geo.api.gouv.fr)
- Stations de mesure cliquables avec halo pulsant si risque élevé
- **Trajectoires orageuses** animées (méthode Bunkers)
- **Icônes tornades** apparaissant quand l'indice dépasse 20
- Flèches de vent sur chaque station

### Slider temporel 48h
- Prévision heure par heure pour les 2 prochains jours
- Histogramme cliquable d'évolution dans le panneau de détail

### Algorithme STP multiplicatif
```
STP = f(CAPE) × f(Cisaillement) × f(Humidité) × (1 + f(Pression) × 0.4)
```

Calibré sur la climatologie française (Kéraunos). Le **cisaillement vertical** est calculé par décomposition vectorielle réelle entre le vent au sol et le vent à 500 hPa (~5 500 m), grâce aux données altitude d'Open-Meteo.

### Onglets
1. **🗺️ Carte & Prévisions** — vue principale avec slider
2. **⚠️ Alertes** — fiches détaillées des zones à risque (indice ≥ 25)
3. **📖 Comprendre** — climatologie française, mécanique des tornades
4. **🛡️ Sauver des vies** — protocoles de sécurité (bâtiment, voiture, extérieur)

---

## 🔧 Personnalisation

### Ajouter des stations
Éditez `src/data.js`, tableau `STATIONS`. Chaque station nécessite :
- `id` : identifiant court unique
- `rg` : nom de la région
- `rc` : code IGN de la région
- `ct` : ville de la station
- `la`, `lo` : latitude, longitude
- `cl` : coefficient climatologique [0-1] (densité tornadique relative)

### Modifier les seuils de risque
Dans `src/stp.js`, fonction `riskLevel()`. Par défaut :
- **70+** : Critique (rouge)
- **45-70** : Élevé (orange)
- **25-45** : Modéré (jaune)
- **10-25** : Faible (vert)
- **<10** : Minimal (gris)

### Changer la fréquence d'actualisation
Dans `src/App.jsx`, ligne `setInterval(load, 600000)` — actuellement 10 minutes. Mettez par exemple `300000` pour 5 minutes.

---

## 📡 APIs utilisées

### IGN — geo.api.gouv.fr
- **Endpoint** : `https://geo.api.gouv.fr/regions?fields=nom,code,contour`
- **Documentation** : https://geo.api.gouv.fr/decoupage-administratif
- **Source** : BD ADMIN EXPRESS de l'IGN
- **CORS** : activé, gratuit, sans clé

### Open-Meteo — api.open-meteo.com
- **Endpoint** : `https://api.open-meteo.com/v1/forecast`
- **Documentation** : https://open-meteo.com/en/docs
- **Modèles** : GFS, ECMWF, ICON
- **CORS** : activé, gratuit, sans clé
- **Variables utilisées** : `cape`, `wind_speed_10m`, `wind_gusts_10m`, `wind_direction_10m`, `relative_humidity_2m`, `pressure_msl`, `wind_speed_500hPa`, `wind_direction_500hPa`, `wind_speed_850hPa`, `wind_direction_850hPa`

---

## ⚠️ Avertissement légal

Ce prototype est un **outil de démonstration**. Il ne remplace en aucun cas les services officiels de prévision météorologique.

**En cas de danger réel, consultez exclusivement :**
- [vigilance.meteofrance.com](https://vigilance.meteofrance.com)
- L'application **Météo-France** sur smartphone
- France Info **105.5 FM**

**En cas d'urgence vitale : 112** (Europe) ou **18** (pompiers)

---

## 📚 Références scientifiques

- **STP (Significant Tornado Parameter)** : Thompson et al. (2003), Storm Prediction Center NOAA
- **Méthode Bunkers** : Bunkers et al. (2000), prévision du déplacement des supercellules
- **Climatologie tornadique française** : [Observatoire Kéraunos](https://keraunos.org)
- **Échelle EF** : Enhanced Fujita Scale (NOAA)

---

## 📝 Licence

Code source libre. Données IGN et Open-Meteo sous leurs licences respectives.

---

**Pour sauver des vies. 🌪️**
