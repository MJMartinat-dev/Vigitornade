// ═══════════════════════════════════════════════════════════════
//  ALGORITHME STP — Significant Tornado Parameter
//  Multiplicatif (chaque facteur DOIT être > 0)
//  Calibré sur la climatologie française (Kéraunos)
// ═══════════════════════════════════════════════════════════════

/**
 * Calcule l'indice de risque tornadique pour une heure donnée.
 * @param {Object} hr - Données horaires Open-Meteo
 * @param {number} idx - Index de l'heure dans les tableaux
 * @param {number} cl - Coefficient climatologique régional [0-1]
 * @returns {Object} { idx, stp, factors, motion }
 */
export function calculateSTP(hr, idx, cl) {
  if (!hr || !hr.cape || idx < 0 || idx >= hr.cape.length) {
    return {
      idx: 0, stp: 0,
      f: { cape: 0, rh: 0, ws: 0, wg: 0, wd: 0, pr: 1013, shear: 0, shSrc: "—",
           fC: 0, fS: 0, fH: 0, fP: 0, w5: null, d5: null, w8: null, d8: null },
      mot: null
    };
  }

  // Variables de surface
  const cape = hr.cape[idx] ?? 0;
  const rh = hr.relative_humidity_2m?.[idx] ?? 50;
  const ws = hr.wind_speed_10m?.[idx] ?? 0;
  const wg = hr.wind_gusts_10m?.[idx] ?? 0;
  const wd = hr.wind_direction_10m?.[idx] ?? 0;
  const pr = hr.pressure_msl?.[idx] ?? 1013;

  // Vents en altitude
  const w5 = hr.wind_speed_500hPa?.[idx];
  const d5 = hr.wind_direction_500hPa?.[idx];
  const w8 = hr.wind_speed_850hPa?.[idx];
  const d8 = hr.wind_direction_850hPa?.[idx];

  // ═══ CISAILLEMENT VECTORIEL RÉEL ═══
  // Différence vectorielle entre vent surface et vent à 500 hPa (~5500 m)
  let shear = Math.max(wg - ws, 0) * 1.6;
  let shSrc = "proxy rafales";
  if (w5 != null && d5 != null) {
    const u0 = ws * Math.sin(wd * Math.PI / 180);
    const v0 = ws * Math.cos(wd * Math.PI / 180);
    const u5 = w5 * Math.sin(d5 * Math.PI / 180);
    const v5 = w5 * Math.cos(d5 * Math.PI / 180);
    shear = Math.sqrt((u5 - u0) ** 2 + (v5 - v0) ** 2);
    shSrc = "vecteur 500 hPa";
  }

  // ═══ FACTEURS NORMALISÉS ═══
  const fC = Math.min(cape / 1500, 2.5);                    // CAPE
  const fS = Math.min(shear / 40, 2.0);                     // Cisaillement
  const fH = rh > 55 ? Math.min((rh - 45) / 35, 1.5) : 0;   // Humidité
  const fP = pr < 1008 ? Math.min((1018 - pr) / 15, 1.2)
           : pr < 1013 ? 0.2 : 0;                           // Pression

  // ═══ STP MULTIPLICATIF ═══
  // Tous les facteurs doivent être > 0 pour qu'un risque existe
  const stp = fC * fS * fH * (1 + fP * 0.4);

  // ═══ CONVERSION EN INDICE 0-100 ═══
  // Calibration : courbe sigmoïde × climatologie régionale
  const raw = (1 - Math.exp(-stp * 0.5)) * 100;
  const risk = Math.min(Math.round(raw * (0.5 + cl * 0.7)), 100);

  // ═══ VECTEUR DE DÉPLACEMENT ORAGEUX (Bunkers) ═══
  // Vent moyen sol↔500hPa, dévié 20° à droite
  let mot = null;
  if (cape > 30 && stp > 0.05) {
    let uM, vM;
    if (w5 != null) {
      const u0 = ws * Math.sin(wd * Math.PI / 180);
      const v0 = ws * Math.cos(wd * Math.PI / 180);
      const u5 = w5 * Math.sin((d5 ?? 0) * Math.PI / 180);
      const v5 = w5 * Math.cos((d5 ?? 0) * Math.PI / 180);
      uM = (u0 + u5) / 2;
      vM = (v0 + v5) / 2;
    } else {
      uM = wg * 0.5 * Math.sin(wd * Math.PI / 180);
      vM = wg * 0.5 * Math.cos(wd * Math.PI / 180);
    }
    const c20 = Math.cos(0.349), s20 = Math.sin(0.349);
    const uS = uM * c20 + vM * s20;
    const vS = -uM * s20 + vM * c20;
    mot = {
      uS, vS,
      spd: Math.sqrt(uS ** 2 + vS ** 2),
      dir: (Math.atan2(uS, vS) * 180 / Math.PI + 360) % 360,
    };
  }

  return {
    idx: risk, stp,
    f: { fC, fS, fH, fP, shear, shSrc, cape, rh, ws, wg, wd, pr, w5, d5, w8, d8 },
    mot
  };
}

// ═══ NIVEAUX DE RISQUE ═══
export function riskLevel(idx) {
  if (idx >= 70) return { l: "CRITIQUE", c: "#ff1744", bg: "rgba(255,23,68,.12)", desc: "Conditions extrêmes — tornade très probable" };
  if (idx >= 45) return { l: "ÉLEVÉ",    c: "#ff6d00", bg: "rgba(255,109,0,.10)", desc: "Conditions fortement favorables" };
  if (idx >= 25) return { l: "MODÉRÉ",   c: "#ffd600", bg: "rgba(255,214,0,.08)", desc: "Instabilité notable — vigilance" };
  if (idx >= 10) return { l: "FAIBLE",   c: "#00e676", bg: "rgba(0,230,118,.06)", desc: "Conditions peu propices" };
  return            { l: "MINIMAL",  c: "#546e7a", bg: "rgba(84,110,122,.04)", desc: "Aucun risque significatif" };
}

// ═══ DIRECTIONS CARDINALES ═══
const DIRS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
export function dirName(d) {
  return d == null ? "—" : DIRS[Math.round(d / 22.5) % 16];
}
