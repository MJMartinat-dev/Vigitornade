// ═══════════════════════════════════════════════════════════════
//  DATA MODULE — VIGITORNADE
//  Sources : IGN (geo.api.gouv.fr) + Open-Meteo
// ═══════════════════════════════════════════════════════════════

// 13 stations de mesure — une par région métropolitaine
// clim = densité tornadique relative (Kéraunos, normalisée 0-1)
export const STATIONS = [
  { id: "BRE", rg: "Bretagne",            rc: "53", ct: "Rennes",     la: 48.11, lo: -1.68, cl: 0.72 },
  { id: "NOR", rg: "Normandie",           rc: "28", ct: "Rouen",      la: 49.44, lo:  1.10, cl: 0.68 },
  { id: "HDF", rg: "Hauts-de-France",     rc: "32", ct: "Lille",      la: 50.63, lo:  3.06, cl: 0.80 },
  { id: "IDF", rg: "Île-de-France",       rc: "11", ct: "Paris",      la: 48.86, lo:  2.35, cl: 0.50 },
  { id: "GES", rg: "Grand Est",           rc: "44", ct: "Strasbourg", la: 48.57, lo:  7.75, cl: 0.42 },
  { id: "PDL", rg: "Pays de la Loire",    rc: "52", ct: "Nantes",     la: 47.22, lo: -1.55, cl: 0.64 },
  { id: "CVL", rg: "Centre-Val de Loire", rc: "24", ct: "Orléans",    la: 47.90, lo:  1.91, cl: 0.55 },
  { id: "BFC", rg: "Bourgogne-FC",        rc: "27", ct: "Dijon",      la: 47.32, lo:  5.04, cl: 0.38 },
  { id: "NAQ", rg: "Nouvelle-Aquitaine",  rc: "75", ct: "Bordeaux",   la: 44.84, lo: -0.58, cl: 0.52 },
  { id: "ARA", rg: "Auvergne-RA",         rc: "84", ct: "Lyon",       la: 45.76, lo:  4.84, cl: 0.32 },
  { id: "OCC", rg: "Occitanie",           rc: "76", ct: "Toulouse",   la: 43.60, lo:  1.44, cl: 0.45 },
  { id: "PAC", rg: "PACA",                rc: "93", ct: "Marseille",  la: 43.30, lo:  5.37, cl: 0.40 },
  { id: "COR", rg: "Corse",               rc: "94", ct: "Ajaccio",    la: 41.93, lo:  8.74, cl: 0.12 },
];

export const RC2ID = {};
STATIONS.forEach(s => { RC2ID[s.rc] = s.id; });

// ═══ PROJECTION GÉOGRAPHIQUE ═══
export const MAP_W = 540, MAP_H = 580;

export function project(lon, lat) {
  const x = MAP_W / 2 + (lon - 2.5) * 3200 * Math.cos(46.5 * Math.PI / 180) / 110.574;
  const y = MAP_H / 2.15 - (lat - 46.5) * 3200 / 110.574;
  return [x, y];
}

// ═══ CONVERSION GeoJSON → SVG path ═══
export function geoToSvgPath(geom) {
  if (!geom) return "";
  try {
    const rings = geom.type === "MultiPolygon"
      ? geom.coordinates.flat()
      : geom.type === "Polygon"
        ? geom.coordinates
        : [];
    return rings.map(ring =>
      ring.map((c, i) => {
        const [x, y] = project(c[0], c[1]);
        return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
      }).join("") + "Z"
    ).join(" ");
  } catch { return ""; }
}

export function geoCentroid(geom) {
  try {
    const all = geom.type === "MultiPolygon"
      ? geom.coordinates.flat(2)
      : geom.type === "Polygon"
        ? geom.coordinates.flat()
        : [];
    if (!all.length) return [MAP_W / 2, MAP_H / 2];
    const sx = all.reduce((s, c) => s + c[0], 0) / all.length;
    const sy = all.reduce((s, c) => s + c[1], 0) / all.length;
    return project(sx, sy);
  } catch { return [MAP_W / 2, MAP_H / 2]; }
}

// ═══ FALLBACK CONTOURS ═══
const FALLBACK_SHAPES = {
  "Bretagne": [[-4.8,48.35],[-4.5,48.52],[-3.6,48.72],[-2.7,48.65],[-1.55,48.7],[-1.05,48.5],[-1.05,48],[-1.05,47.65],[-1.35,47.52],[-1.8,47.42],[-2.2,47.4],[-3.1,47.7],[-4.1,47.95],[-4.55,48.18]],
  "Normandie": [[-1.05,48.5],[-1.1,48.85],[-0.25,49.2],[0.65,49.45],[1.55,49.65],[1.7,49.2],[1.15,48.8],[0.25,48.42],[-0.35,48.38]],
  "Hauts-de-France": [[1.55,49.65],[1.55,50.1],[1.85,50.8],[2.55,51.1],[3.3,50.65],[4.05,50.08],[4.15,49.9],[4.05,49.55],[3,49.25],[2,49.1],[1.55,49.45]],
  "Île-de-France": [[1.55,49],[1.55,48.65],[2,48.32],[2.7,48.3],[3.15,48.55],[3.05,48.95],[2.5,49.1],[2,49.1],[1.7,49.2]],
  "Grand Est": [[3.05,48.95],[3.5,49.35],[4.15,49.9],[4.85,49.95],[5.95,49.5],[7.5,49.05],[8.15,48.65],[7.55,47.58],[6.55,47],[5.1,47.1],[3.6,47.85],[3.15,48.55]],
  "Pays de la Loire": [[-1.05,48.5],[0.65,48.4],[0.8,47.65],[0.05,46.9],[-1,46.85],[-2.15,47.15],[-2.2,47.4],[-1.8,47.42],[-1.05,47.65],[-1.05,48]],
  "Centre-Val de Loire": [[0.65,48.4],[1.55,48.65],[2.35,48.28],[3.15,48.55],[3.2,47.85],[2.55,46.95],[1.2,46.75],[0.3,47.35],[0.7,47.95]],
  "Bourgogne-FC": [[3.15,48.55],[3.6,47.85],[5.1,47.1],[6.55,47],[6.85,46.95],[6.15,46.25],[4.65,46.25],[3.15,46.7],[2.8,47.2]],
  "Nouvelle-Aquitaine": [[0.05,46.9],[-1,46.85],[-1.2,45.55],[-1.25,44.35],[-1.35,43.5],[0.3,42.95],[1.4,43.4],[1.75,44.4],[2.55,45.3],[2.8,46.95],[1.2,46.75],[0.3,47.1]],
  "Auvergne-RA": [[2.8,46.95],[2.55,45.3],[3.15,44.65],[4.55,44.25],[5.5,45],[6.65,45.55],[6.85,46.95],[5.1,47.1],[3.6,47.85],[3.15,46.7]],
  "Occitanie": [[1.55,43.9],[1.2,43.25],[0.3,42.95],[0.5,42.55],[1.8,42.5],[3.15,42.92],[3.95,43.35],[4.8,44.12],[3.15,44.65],[2.55,45.3],[2,44.75]],
  "PACA": [[4.55,43.82],[3.95,43.35],[4.45,43.05],[5.65,43.15],[6.65,43.3],[7.5,43.78],[7.1,44.35],[6.65,45.55],[5.5,45],[4.85,44.35],[4.8,44.12]],
  "Corse": [[8.6,42.65],[8.85,42.1],[9,41.45],[9.4,41.55],[9.4,42.15],[9,42.95],[8.55,42.85]],
};

function fallbackPath(coords) {
  return coords.map((c, i) => {
    const [x, y] = project(c[0], c[1]);
    return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join("") + "Z";
}

function fallbackCentroid(coords) {
  const sx = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const sy = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  return project(sx, sy);
}

export function buildFallback() {
  return Object.entries(FALLBACK_SHAPES).map(([nm, co]) => {
    const st = STATIONS.find(s => s.rg === nm);
    return { nm, p: fallbackPath(co), cx: fallbackCentroid(co), rc: st?.rc || "" };
  });
}

// ═══ FETCH IGN — CONTOURS RÉGIONS ═══
export async function fetchIGNRegions() {
  try {
    const r = await fetch("https://geo.api.gouv.fr/regions?fields=nom,code,contour");
    if (!r.ok) throw new Error("HTTP " + r.status);
    const data = await r.json();
    const regs = data
      .filter(d => d.contour && parseInt(d.code) >= 11 && parseInt(d.code) <= 94)
      .map(d => ({
        nm: d.nom,
        cd: d.code,
        rc: d.code,
        p: geoToSvgPath(d.contour),
        cx: geoCentroid(d.contour),
      }))
      .filter(d => d.p.length > 10);
    if (regs.length >= 10) return { shapes: regs, src: "IGN — geo.api.gouv.fr" };
    throw new Error("Données IGN insuffisantes");
  } catch (e) {
    console.warn("IGN indisponible, fallback :", e.message);
    return { shapes: buildFallback(), src: "Contours intégrés (IGN indisponible)" };
  }
}

// ═══ FETCH IGN — CONTOURS DÉPARTEMENTS (optionnel, plus détaillé) ═══
export async function fetchIGNDepartments() {
  try {
    const r = await fetch("https://geo.api.gouv.fr/departements?fields=nom,code,codeRegion,contour");
    if (!r.ok) throw new Error("HTTP " + r.status);
    const data = await r.json();
    return data
      .filter(d => d.contour && parseInt(d.codeRegion) >= 11 && parseInt(d.codeRegion) <= 94)
      .map(d => ({
        nm: d.nom,
        cd: d.code,
        rc: d.codeRegion,
        p: geoToSvgPath(d.contour),
        cx: geoCentroid(d.contour),
      }))
      .filter(d => d.p.length > 10);
  } catch (e) {
    console.warn("Départements IGN indisponibles :", e.message);
    return [];
  }
}

// ═══ FETCH OPEN-METEO — PRÉVISION 48H HORAIRE ═══
export async function fetchMeteo() {
  return Promise.all(STATIONS.map(async s => {
    try {
      const url = `https://api.open-meteo.com/v1/forecast`
        + `?latitude=${s.la}&longitude=${s.lo}`
        + `&current=temperature_2m,relative_humidity_2m,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cape,cloud_cover`
        + `&hourly=cape,relative_humidity_2m,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,wind_speed_500hPa,wind_direction_500hPa,wind_speed_850hPa,wind_direction_850hPa,temperature_2m`
        + `&timezone=Europe/Paris&forecast_days=2`;
      const r = await fetch(url);
      if (!r.ok) throw new Error("HTTP " + r.status);
      const d = await r.json();
      return { ...s, cur: d.current, hr: d.hourly, ok: true };
    } catch (e) {
      console.warn(`Météo indisponible pour ${s.ct} :`, e.message);
      return { ...s, cur: null, hr: null, ok: false, err: e.message };
    }
  }));
}
