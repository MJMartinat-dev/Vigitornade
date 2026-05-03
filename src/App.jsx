import { useState, useEffect, useMemo, useCallback } from "react";
import { STATIONS, RC2ID, MAP_W, MAP_H, project, fetchIGNRegions, fetchMeteo } from "./data.js";
import { calculateSTP, riskLevel, dirName } from "./stp.js";

// ═══ COMPOSANT JAUGE ═══
function Gauge({ label, value, unit, lo, hi, warn, tip }) {
  const pct = Math.max(0, Math.min(((value - lo) / (hi - lo)) * 100, 100));
  const bad = warn != null && value >= warn;
  return (
    <div style={{ marginBottom: 11 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#b0bec5" }}>{label}</span>
        <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: bad ? "#ff1744" : "#eceff1" }}>
          {typeof value === "number" ? (Number.isInteger(value) ? value : value.toFixed(1)) : value} {unit}
        </span>
      </div>
      <div style={{ height: 4, background: "rgba(255,255,255,.06)", borderRadius: 2 }}>
        <div style={{
          height: "100%", width: `${pct}%`, borderRadius: 2, transition: "width .6s",
          background: bad ? "#ff1744" : pct > 60 ? "#ff6d00" : pct > 30 ? "#29b6f6" : "#00e676"
        }} />
      </div>
      {tip && <div style={{ fontSize: 9, color: "#546e7a", marginTop: 2 }}>{tip}</div>}
    </div>
  );
}

// ═══ APPLICATION ═══
export default function App() {
  const [shapes, setShapes] = useState([]);
  const [mapSrc, setMapSrc] = useState("");
  const [meteo, setMeteo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");
  const [hourIdx, setHourIdx] = useState(() => new Date().getHours());
  const [sel, setSel] = useState(null);
  const [tab, setTab] = useState("carte");
  const [ts, setTs] = useState(null);
  const [tick, setTick] = useState(0);
  const [demoMode, setDemoMode] = useState(false);

  // Chargement initial
  const load = useCallback(async () => {
    setLoading(true); setErrMsg("");
    try {
      const [g, m] = await Promise.all([fetchIGNRegions(), fetchMeteo()]);
      setShapes(g.shapes); setMapSrc(g.src); setMeteo(m); setTs(new Date());
      const errs = m.filter(x => !x.ok);
      if (errs.length === STATIONS.length) {
        setErrMsg("Aucune donnée météo disponible. Vérifiez votre connexion internet.");
      } else if (errs.length > 0) {
        setErrMsg(`${errs.length}/${STATIONS.length} stations indisponibles`);
      }
    } catch (e) {
      setErrMsg("Erreur de chargement : " + e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const iv = setInterval(load, 600000); return () => clearInterval(iv); }, [load]);
  useEffect(() => { const iv = setInterval(() => setTick(t => t + 1), 900); return () => clearInterval(iv); }, []);

  // Calcul du risque pour chaque station à l'heure sélectionnée
  const stations = useMemo(() => meteo.map(s => {
    let risk;
    if (demoMode) {
      // MODE DÉMO : injection de conditions orageuses sévères pour visualiser les animations
      // Scénario type : épisode supercellulaire estival (Hauts-de-France, Bretagne très exposés)
      const fakeRisk = Math.round(20 + s.cl * 70 + Math.sin(s.la + s.lo + tick * 0.3) * 15);
      const idx = Math.max(0, Math.min(fakeRisk, 95));
      const stp = idx / 30;
      const dir = (s.lo * 30 + s.la * 5 + tick * 2) % 360;
      const spd = 30 + s.cl * 40;
      const rad = dir * Math.PI / 180;
      risk = {
        idx, stp,
        f: { fC: 1.5, fS: 1.3, fH: 1.2, fP: 0.4,
             shear: 50 + s.cl * 30, shSrc: "DÉMO",
             cape: 1500 + s.cl * 1200, rh: 75, ws: 25, wg: 70,
             wd: dir, pr: 1003, w5: 80, d5: 240, w8: 45, d8: 200 },
        mot: { uS: Math.sin(rad) * spd / 3.6, vS: Math.cos(rad) * spd / 3.6,
               spd, dir }
      };
    } else {
      risk = calculateSTP(s.hr, hourIdx, s.cl);
    }
    return { ...s, risk, rl: riskLevel(risk.idx) };
  }), [meteo, hourIdx, demoMode, tick]);

  // Timeline 24h pour la station sélectionnée
  const timeline = useMemo(() => {
    const s = stations.find(x => x.id === sel);
    if (!s?.hr?.cape) return [];
    return Array.from({ length: Math.min(s.hr.cape.length, 48) }, (_, i) => {
      const r = calculateSTP(s.hr, i, s.cl);
      const t = s.hr.time?.[i];
      return { h: t ? new Date(t).getHours() : i % 24, idx: r.idx, day: t ? new Date(t).getDate() : 0 };
    });
  }, [stations, sel]);

  const sorted = useMemo(() => [...stations].sort((a, b) => b.risk.idx - a.risk.idx), [stations]);
  const alerts = useMemo(() => stations.filter(s => s.risk.idx >= 25).sort((a, b) => b.risk.idx - a.risk.idx), [stations]);
  const selSt = stations.find(s => s.id === sel);
  const mx = Math.max(...stations.map(s => s.risk.idx), 0);
  const gR = riskLevel(mx);

  const maxHour = meteo[0]?.hr?.time?.length ? Math.min(meteo[0].hr.time.length - 1, 47) : 47;
  const curTimeLabel = meteo[0]?.hr?.time?.[hourIdx]
    ? new Date(meteo[0].hr.time[hourIdx]).toLocaleString("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit" })
    : `H+${hourIdx}`;

  // ── ÉCRAN DE CHARGEMENT ──
  if (loading && !meteo.length) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#080c15" }}>
        <div style={{ fontSize: 56, animation: "sp 2.5s linear infinite", marginBottom: 16 }}>🌪️</div>
        <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 1 }}>VIGITORNADE</div>
        <div style={{ fontSize: 12, color: "#546e7a", marginTop: 8 }}>Chargement IGN + Open-Meteo (48h)…</div>
      </div>
    );
  }

  return (
    <div style={{ background: "#080c15", minHeight: "100vh", color: "#eceff1" }}>
      {/* ═══ HEADER ═══ */}
      <header style={{
        background: "linear-gradient(135deg,#0d1321,#151d30)",
        borderBottom: "1px solid rgba(255,255,255,.06)",
        padding: "10px 16px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 8
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 28 }}>🌪️</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: .5 }}>VIGITORNADE</div>
            <div style={{ fontSize: 8, color: "#546e7a", letterSpacing: 1.5, fontWeight: 600 }}>
              PRÉVISION TORNADIQUE 48H · DONNÉES TEMPS RÉEL
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <button onClick={() => setDemoMode(!demoMode)} style={{
            background: demoMode ? "rgba(255,109,0,.2)" : "rgba(255,255,255,.04)",
            border: demoMode ? "1px solid #ff6d00" : "1px solid rgba(255,255,255,.06)",
            borderRadius: 4, color: demoMode ? "#ff6d00" : "#546e7a",
            padding: "3px 10px", fontSize: 9, fontWeight: 700, letterSpacing: .5
          }}>{demoMode ? "🌪️ DÉMO ON" : "DÉMO"}</button>
          {mx >= 25 && (
            <div style={{
              padding: "3px 8px", borderRadius: 4, fontSize: 9, fontWeight: 800,
              background: gR.bg, color: gR.c, border: `1px solid ${gR.c}40`,
              animation: "blink 2s infinite"
            }}>⚠ {gR.l}</div>
          )}
          <span style={{ fontSize: 9, color: "#37474f", fontFamily: "monospace" }}>
            {ts?.toLocaleTimeString("fr-FR")}
          </span>
          <button onClick={load} style={{
            background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.06)",
            borderRadius: 4, color: "#546e7a", padding: "3px 8px", fontSize: 9
          }}>↻ Actualiser</button>
        </div>
      </header>

      {errMsg && (
        <div style={{
          background: "rgba(255,109,0,.08)", borderBottom: "1px solid rgba(255,109,0,.15)",
          padding: "4px 16px", fontSize: 10, color: "#ffab40"
        }}>⚠ {errMsg}</div>
      )}

      {/* ═══ NAV ═══ */}
      <nav style={{
        display: "flex", background: "rgba(255,255,255,.02)",
        borderBottom: "1px solid rgba(255,255,255,.04)", padding: "0 16px", overflowX: "auto"
      }}>
        {[
          { k: "carte",   l: "🗺️ Carte & Prévisions" },
          { k: "alertes", l: `⚠️ Alertes${alerts.length ? ` (${alerts.length})` : ""}` },
          { k: "info",    l: "📖 Comprendre" },
          { k: "vie",     l: "🛡️ Sauver des vies" }
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{
            background: "none", border: "none",
            borderBottom: tab === t.k ? "2px solid #ff6d00" : "2px solid transparent",
            padding: "9px 12px", fontSize: 11,
            fontWeight: tab === t.k ? 700 : 500,
            color: tab === t.k ? "#eceff1" : "#546e7a", whiteSpace: "nowrap"
          }}>{t.l}</button>
        ))}
      </nav>

      <main style={{ padding: 12, maxWidth: 1300, margin: "0 auto" }}>

        {tab === "carte" && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 480px", minWidth: 320 }}>

              {/* ── SLIDER 48H ── */}
              <div style={{
                background: "rgba(255,255,255,.02)", borderRadius: 8,
                border: "1px solid rgba(255,255,255,.05)", padding: "8px 14px", marginBottom: 10
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#78909c" }}>
                    🕐 PRÉVISION TEMPORELLE
                  </span>
                  <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#ff6d00" }}>
                    {curTimeLabel}
                  </span>
                </div>
                <input type="range" min={0} max={maxHour} value={hourIdx}
                  onChange={e => setHourIdx(+e.target.value)} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "#37474f", marginTop: 2 }}>
                  <span>Maintenant</span><span>+12h</span><span>+24h</span><span>+36h</span><span>+48h</span>
                </div>
              </div>

              {/* ── CARTE SVG ── */}
              <div style={{
                background: "linear-gradient(180deg,#0b1120,#0f1828)",
                borderRadius: 10, border: "1px solid rgba(255,255,255,.06)", overflow: "hidden"
              }}>
                <div style={{
                  padding: "6px 14px", borderBottom: "1px solid rgba(255,255,255,.03)",
                  display: "flex", justifyContent: "space-between", fontSize: 10
                }}>
                  <span style={{ fontWeight: 700, color: "#78909c" }}>
                    Indice tornadique — {curTimeLabel}
                  </span>
                  <span style={{ color: "#37474f" }}>{mapSrc}</span>
                </div>

                <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} style={{ width: "100%", display: "block", background: "#070b14" }}>
                  <defs>
                    <marker id="wa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4" markerHeight="4" orient="auto">
                      <path d="M0,1L10,5L0,9" fill="none" stroke="rgba(56,189,248,.5)" strokeWidth="2" />
                    </marker>
                    <marker id="ta" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
                      <path d="M0,0L8,4L0,8z" fill="#ff1744" opacity=".6" />
                    </marker>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="3" result="b" />
                      <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                    <radialGradient id="storm">
                      <stop offset="0%" stopColor="#ff1744" stopOpacity=".25" />
                      <stop offset="100%" stopColor="#ff1744" stopOpacity="0" />
                    </radialGradient>
                  </defs>

                  {/* Radar décoratif */}
                  {[100, 200, 280].map(r => (
                    <circle key={r} cx={MAP_W / 2} cy={MAP_H / 2.2} r={r}
                      fill="none" stroke="rgba(0,230,118,.015)" strokeWidth=".5" />
                  ))}
                  <line x1={MAP_W / 2} y1={MAP_H / 2.2} x2={MAP_W} y2={MAP_H / 2.2}
                    stroke="rgba(0,230,118,.06)" strokeWidth=".5"
                    style={{
                      transformOrigin: `${MAP_W / 2}px ${MAP_H / 2.2}px`,
                      animation: "sweep 8s linear infinite"
                    }} />

                  {/* Régions */}
                  {shapes.map(sh => {
                    const sid = RC2ID[sh.rc] || STATIONS.find(s => s.rg === sh.nm)?.id;
                    const st = stations.find(s => s.id === sid);
                    const idx = st ? st.risk.idx : 0;
                    const r = riskLevel(idx);
                    const op = 0.04 + idx * .008;
                    return (
                      <g key={sh.nm} onClick={() => setSel(sid)} style={{ cursor: "pointer" }}>
                        <path d={sh.p} fill={r.c} fillOpacity={Math.min(op, .65)}
                          stroke={sel === sid ? "#fbbf24" : "rgba(148,163,184,.12)"}
                          strokeWidth={sel === sid ? 2.5 : .8} strokeLinejoin="round" />
                        <text x={sh.cx[0]} y={sh.cx[1]} textAnchor="middle" dy=".35em"
                          fontSize={sh.nm.length > 16 ? 5.5 : 7} fontWeight="600"
                          fill={idx > 15 ? "rgba(255,255,255,.5)" : "rgba(200,210,220,.2)"}
                          pointerEvents="none">{sh.nm}</text>
                      </g>
                    );
                  })}

                  {/* Stations dynamiques */}
                  {stations.map(s => {
                    const [cx, cy] = project(s.lo, s.la);
                    const m = s.risk.mot;
                    const idx = s.risk.idx;
                    const r = riskLevel(idx);

                    // Trajectoire orageuse
                    let traj = null;
                    if (m && idx >= 8) {
                      const sc = .45, N = 8;
                      const pts = Array.from({ length: N }, (_, i) => ({
                        x: cx + m.uS * sc * (5 + i * 7),
                        y: cy - m.vS * sc * (5 + i * 7)
                      }));
                      const d = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("");
                      const w = idx >= 45 ? 6 : idx >= 25 ? 4 : 2;
                      traj = (
                        <g>
                          <path d={d} fill="none" stroke={idx >= 45 ? "#ff1744" : "#ff6d00"}
                            strokeWidth={w + 4} strokeLinecap="round" opacity=".06" filter="url(#glow)" />
                          <path d={d} fill="none" stroke={idx >= 45 ? "#ff1744" : "#ff6d00"}
                            strokeWidth={w} strokeDasharray="6,4" strokeLinecap="round"
                            opacity=".6" filter="url(#glow)" markerEnd="url(#ta)"
                            style={{ animation: "dsh .7s linear infinite" }} />
                          {pts.slice(1).map((p, i) => (
                            <circle key={i} cx={p.x} cy={p.y} r={1.5}
                              fill={idx >= 45 ? "#ff1744" : "#ff6d00"} opacity={.5 - i * .06} />
                          ))}
                          <text x={pts[N - 1].x + 5} y={pts[N - 1].y - 3}
                            fontSize="7" fill={r.c} fontWeight="700" fontFamily="monospace" opacity=".7">
                            {dirName(m.dir)} {Math.round(m.spd)}km/h
                          </text>
                        </g>
                      );
                    }

                    // Storm cell pulsante
                    const storm = idx >= 25 ? (
                      <>
                        <circle cx={cx} cy={cy} r={18 + idx * .15}
                          fill="url(#storm)" opacity={.3 + idx * .003} />
                        <circle cx={cx} cy={cy} r="16" fill="none" stroke={r.c} strokeWidth="1.5"
                          style={{ animation: "pls 2s infinite" }} />
                      </>
                    ) : null;

                    // Icône tornade animée
                    const bounce = Math.sin(tick * .6 + cx * .01) * 3;
                    const rot = (tick * 8) % 360;
                    const tornado = idx >= 15 ? (
                      <g transform={`translate(${cx}, ${cy - 20 + bounce})`} pointerEvents="none">
                        <text textAnchor="middle"
                          fontSize={idx >= 70 ? 24 : idx >= 45 ? 20 : idx >= 25 ? 17 : 14}
                          style={idx >= 45 ? { transformOrigin: "center", animation: "sp 2s linear infinite" } : {}}>
                          🌪️
                        </text>
                      </g>
                    ) : null;

                    return (
                      <g key={s.id} onClick={() => setSel(s.id)} style={{ cursor: "pointer" }}>
                        {traj}{storm}{tornado}
                        <circle cx={cx} cy={cy} r="4.5" fill={r.c} stroke="#070b14" strokeWidth="1.5" />
                        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="5.5"
                          fill="rgba(148,163,184,.3)" fontFamily="monospace" pointerEvents="none">{s.ct}</text>
                        {idx >= 3 && (
                          <text x={cx + 8} y={cy - 5} fontSize="8" fontWeight="700"
                            fill={r.c} fontFamily="monospace" pointerEvents="none">{idx}</text>
                        )}
                        {/* Flèche vent */}
                        {s.risk.f.wd != null && (() => {
                          const rad = s.risk.f.wd * Math.PI / 180;
                          const len = 8 + s.risk.f.ws * .2;
                          return (
                            <line x1={cx} y1={cy}
                              x2={cx + Math.sin(rad) * len} y2={cy - Math.cos(rad) * len}
                              stroke="rgba(56,189,248,.25)" strokeWidth="1" markerEnd="url(#wa)" />
                          );
                        })()}
                      </g>
                    );
                  })}
                </svg>

                {/* Légende */}
                <div style={{
                  padding: "5px 14px", borderTop: "1px solid rgba(255,255,255,.03)",
                  display: "flex", gap: 8, flexWrap: "wrap", fontSize: 8, color: "#37474f"
                }}>
                  {[
                    { c: "#ff1744", l: "≥70 Critique" },
                    { c: "#ff6d00", l: "≥45 Élevé" },
                    { c: "#ffd600", l: "≥25 Modéré" },
                    { c: "#00e676", l: "≥10 Faible" },
                    { c: "#546e7a", l: "Minimal" }
                  ].map(x => (
                    <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: x.c }} />{x.l}
                    </div>
                  ))}
                  <span style={{ color: "#38bdf8" }}>→ vent</span>
                  <span style={{ color: "#ff6d00" }}>⤑ trajectoire</span>
                  <span>🌪️ tornade</span>
                </div>
              </div>

              {/* ── TABLEAU ── */}
              <div style={{
                background: "rgba(255,255,255,.02)", borderRadius: 8,
                border: "1px solid rgba(255,255,255,.04)", overflow: "hidden", marginTop: 10
              }}>
                <div style={{
                  padding: "6px 14px", borderBottom: "1px solid rgba(255,255,255,.03)",
                  fontSize: 11, fontWeight: 700, color: "#78909c"
                }}>Classement — {curTimeLabel}</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                    <thead><tr>
                      {["Région", "Indice", "STP", "CAPE", "Cisail.", "Rafales", "Hum.", "Press.", "Direction"].map(h => (
                        <th key={h} style={{
                          padding: "6px 5px", textAlign: "left", fontSize: 8, fontWeight: 700,
                          color: "#37474f", borderBottom: "1px solid rgba(255,255,255,.03)"
                        }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>{sorted.map(s => {
                      const f = s.risk.f;
                      return (
                        <tr key={s.id} onClick={() => setSel(s.id)} style={{
                          cursor: "pointer",
                          background: sel === s.id ? "rgba(41,182,246,.06)"
                                    : s.risk.idx >= 25 ? s.rl.bg : "transparent"
                        }}>
                          <td style={{ padding: "6px 5px", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,.02)", color: "#b0bec5" }}>{s.rg}</td>
                          <td style={{ padding: "6px 5px", borderBottom: "1px solid rgba(255,255,255,.02)" }}>
                            <span style={{ padding: "1px 6px", borderRadius: 8, fontSize: 10, fontWeight: 700, color: s.rl.c, background: s.rl.bg }}>{s.risk.idx}</span>
                          </td>
                          <td style={{ padding: "6px 5px", fontFamily: "monospace", fontSize: 9, borderBottom: "1px solid rgba(255,255,255,.02)", color: s.risk.stp > 1 ? "#ff6d00" : "#546e7a" }}>{s.risk.stp.toFixed(2)}</td>
                          <td style={{ padding: "6px 5px", fontFamily: "monospace", fontSize: 9, borderBottom: "1px solid rgba(255,255,255,.02)", color: "#546e7a" }}>{f.cape}</td>
                          <td style={{ padding: "6px 5px", fontFamily: "monospace", fontSize: 9, borderBottom: "1px solid rgba(255,255,255,.02)", color: (f.shear || 0) > 30 ? "#ff1744" : "#546e7a" }}>{(f.shear || 0).toFixed(0)}</td>
                          <td style={{ padding: "6px 5px", fontFamily: "monospace", fontSize: 9, borderBottom: "1px solid rgba(255,255,255,.02)", color: f.wg > 60 ? "#ff1744" : "#546e7a" }}>{f.wg}</td>
                          <td style={{ padding: "6px 5px", fontFamily: "monospace", fontSize: 9, borderBottom: "1px solid rgba(255,255,255,.02)", color: "#546e7a" }}>{f.rh}%</td>
                          <td style={{ padding: "6px 5px", fontFamily: "monospace", fontSize: 9, borderBottom: "1px solid rgba(255,255,255,.02)", color: "#546e7a" }}>{f.pr}</td>
                          <td style={{ padding: "6px 5px", fontSize: 9, borderBottom: "1px solid rgba(255,255,255,.02)", color: "#546e7a" }}>
                            {s.risk.mot ? `${dirName(s.risk.mot.dir)} ${Math.round(s.risk.mot.spd)}` : "—"}
                          </td>
                        </tr>
                      );
                    })}</tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ── PANNEAU DÉTAIL ── */}
            <div style={{ flex: "0 1 330px", minWidth: 260 }}>
              <div style={{
                background: "linear-gradient(180deg,#0b1120,#0f1828)",
                borderRadius: 10, border: "1px solid rgba(255,255,255,.06)",
                overflow: "hidden", animation: "fi .3s"
              }}>
                <div style={{
                  padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,.03)",
                  fontSize: 11, fontWeight: 700, color: "#78909c"
                }}>
                  {selSt ? `📡 ${selSt.rg} — ${selSt.ct}` : "📡 Cliquez une zone"}
                </div>
                <div style={{ padding: 12 }}>
                  {selSt ? (() => {
                    const f = selSt.risk.f;
                    const m = selSt.risk.mot;
                    const idx = selSt.risk.idx;
                    const r = selSt.rl;
                    return (
                      <>
                        <div style={{
                          display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
                          padding: "8px 10px", borderRadius: 8,
                          background: r.bg, border: `1px solid ${r.c}20`
                        }}>
                          <div style={{
                            width: 40, height: 40, borderRadius: 8,
                            background: `${r.c}18`, display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 18, fontWeight: 900, color: r.c
                          }}>{idx}</div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: r.c }}>Risque {r.l}</div>
                            <div style={{ fontSize: 9, color: "#546e7a" }}>STP = {selSt.risk.stp.toFixed(3)} · {curTimeLabel}</div>
                          </div>
                        </div>

                        {timeline.length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: "#546e7a", marginBottom: 4 }}>ÉVOLUTION 48H — Cliquez une barre</div>
                            <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: 36 }}>
                              {timeline.map((t, i) => (
                                <div key={i} onClick={() => setHourIdx(i)} style={{
                                  flex: 1, height: Math.max(t.idx * .35, 1), cursor: "pointer",
                                  background: i === hourIdx ? "#ff6d00" : riskLevel(t.idx).c,
                                  opacity: i === hourIdx ? 1 : .35,
                                  borderRadius: "1px 1px 0 0", transition: "height .3s"
                                }} title={`${String(t.h).padStart(2, "0")}:00 — Indice ${t.idx}`} />
                              ))}
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 7, color: "#37474f", marginTop: 2 }}>
                              <span>00h</span><span>+12h</span><span>+24h</span><span>+36h</span><span>+48h</span>
                            </div>
                          </div>
                        )}

                        <div style={{ fontSize: 10, fontWeight: 700, color: "#78909c", marginBottom: 8 }}>
                          DONNÉES — {curTimeLabel}
                        </div>
                        <Gauge label="⚡ CAPE" value={f.cape} unit="J/kg" lo={0} hi={3000} warn={1000} tip="Énergie orageuse. CAPE=0 → risque=0." />
                        <Gauge label="🔀 Cisaillement" value={f.shear || 0} unit="km/h" lo={0} hi={80} warn={35} tip={`Source : ${f.shSrc}. >35 = supercellule possible.`} />
                        <Gauge label="🌊 Rafales" value={f.wg} unit="km/h" lo={0} hi={120} warn={60} />
                        <Gauge label="💧 Humidité" value={f.rh} unit="%" lo={0} hi={100} warn={70} tip=">70% = forte alimentation convective." />
                        <Gauge label="📊 Pression" value={f.pr} unit="hPa" lo={980} hi={1040} tip="Basse = forçage ascendant." />

                        {f.w5 != null && (
                          <div style={{
                            padding: "6px 8px", background: "rgba(41,182,246,.05)",
                            borderRadius: 4, border: "1px solid rgba(41,182,246,.1)",
                            fontSize: 9, color: "#4fc3f7", marginBottom: 6, lineHeight: 1.5
                          }}>
                            <strong>Altitude :</strong> 850hPa: {f.w8?.toFixed(0) ?? "—"}km/h {dirName(f.d8)} ·
                            500hPa: {f.w5?.toFixed(0) ?? "—"}km/h {dirName(f.d5)}
                          </div>
                        )}

                        {m && (
                          <div style={{
                            padding: "6px 8px", background: "rgba(255,109,0,.05)",
                            borderRadius: 4, border: "1px solid rgba(255,109,0,.1)",
                            fontSize: 9, color: "#ffab40", lineHeight: 1.5, marginTop: 4
                          }}>
                            <strong>🔀 Trajectoire :</strong> vers {dirName(m.dir)} ({Math.round(m.dir)}°) à {Math.round(m.spd)} km/h (Bunkers)
                          </div>
                        )}

                        <details style={{ marginTop: 8 }}>
                          <summary style={{ fontSize: 9, color: "#37474f", fontWeight: 600, cursor: "pointer" }}>🧮 Détail algorithme STP</summary>
                          <div style={{
                            marginTop: 4, padding: 8, background: "rgba(0,0,0,.3)",
                            borderRadius: 4, fontFamily: "monospace", fontSize: 8,
                            color: "#546e7a", lineHeight: 2
                          }}>
                            STP = f(CAPE)×f(Cisail.)×f(Hum.)×(1+f(Press.)×.4)<br />
                            = {f.fC?.toFixed(3)} × {f.fS?.toFixed(3)} × {f.fH?.toFixed(3)} × (1+{f.fP?.toFixed(3)}×.4)<br />
                            = <span style={{ color: "#eceff1", fontWeight: 700 }}>{selSt.risk.stp.toFixed(4)}</span><br />
                            Indice = (1-e^(-STP×.5))×100×clim({selSt.cl}) = <span style={{ color: "#00e676", fontWeight: 700 }}>{idx}</span>
                          </div>
                        </details>
                      </>
                    );
                  })() : (
                    <div style={{ textAlign: "center", padding: "24px 8px", color: "#37474f" }}>
                      <div style={{ fontSize: 36, marginBottom: 6 }}>👆</div>
                      <p style={{ fontSize: 11 }}>Cliquez une zone sur la carte ou le tableau.<br />Slider 48h pour voir l'évolution.</p>
                    </div>
                  )}
                </div>
              </div>
              <div style={{
                background: "rgba(255,255,255,.02)", borderRadius: 8,
                border: "1px solid rgba(255,255,255,.04)", padding: 10, marginTop: 10
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#546e7a", marginBottom: 4 }}>📡 Sources</div>
                <div style={{ fontSize: 8, color: "#37474f", lineHeight: 1.8 }}>
                  Contours : {mapSrc}<br />
                  Météo : Open-Meteo (GFS/ECMWF) · 48h horaire<br />
                  Altitude : 850/500 hPa (cisaillement vectoriel)<br />
                  Algo : STP multiplicatif + Bunkers right-mover<br />
                  Climatologie : pondération régionale Kéraunos<br />
                  Auto-refresh : toutes les 10 minutes
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── ALERTES ─── */}
        {tab === "alertes" && (
          <div style={{ maxWidth: 740 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 4px" }}>Alertes — Indice ≥ 25 à {curTimeLabel}</h2>
            <p style={{ fontSize: 10, color: "#546e7a", marginBottom: 14 }}>
              Utilisez le slider temporel sur l'onglet « Carte » pour vérifier les heures à venir.
            </p>
            {alerts.length === 0 ? (
              <div style={{
                background: "rgba(0,230,118,.05)", border: "1px solid rgba(0,230,118,.12)",
                borderRadius: 10, padding: "28px 18px", textAlign: "center"
              }}>
                <div style={{ fontSize: 44, marginBottom: 8 }}>✅</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#00e676" }}>Aucune alerte à cette heure</div>
                <div style={{ fontSize: 12, color: "#69f0ae", marginTop: 4, maxWidth: 440, margin: "4px auto 0" }}>
                  L'algorithme STP multiplicatif ne détecte aucune combinaison critique sur le territoire.
                  Vérifiez les heures suivantes (les orages se forment souvent l'après-midi, 14h-18h).
                </div>
              </div>
            ) : alerts.map(s => {
              const f = s.risk.f;
              const m = s.risk.mot;
              return (
                <div key={s.id} style={{
                  background: "rgba(255,255,255,.02)", borderRadius: 10,
                  border: `2px solid ${s.rl.c}`, marginBottom: 10, overflow: "hidden"
                }}>
                  <div style={{
                    background: s.rl.bg, padding: "10px 14px",
                    display: "flex", justifyContent: "space-between", alignItems: "center"
                  }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 900, color: s.rl.c }}>⚠ {s.rl.l} — {s.rg}</div>
                      <div style={{ fontSize: 9, color: "#78909c" }}>{s.ct} · STP = {s.risk.stp.toFixed(2)}</div>
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: s.rl.c, fontFamily: "monospace" }}>{s.risk.idx}</div>
                  </div>
                  <div style={{ padding: 12 }}>
                    <div style={{
                      display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(90px,1fr))",
                      gap: 5, marginBottom: 8
                    }}>
                      {[
                        { l: "CAPE",     v: `${f.cape} J/kg`,             d: f.cape > 1000 },
                        { l: "Cisail.",  v: `${(f.shear || 0).toFixed(0)} km/h`, d: (f.shear || 0) > 30 },
                        { l: "Rafales",  v: `${f.wg} km/h`,               d: f.wg > 60 },
                        { l: "Hum.",     v: `${f.rh}%`,                   d: f.rh > 70 },
                        { l: "Press.",   v: `${f.pr} hPa`,                d: f.pr < 1005 },
                        { l: "Traj.",    v: m ? `${dirName(m.dir)} ${Math.round(m.spd)}km/h` : "—" }
                      ].map(x => (
                        <div key={x.l} style={{
                          padding: "5px 6px",
                          background: x.d ? "rgba(255,23,68,.06)" : "rgba(255,255,255,.02)",
                          borderRadius: 4,
                          border: x.d ? "1px solid rgba(255,23,68,.1)" : "1px solid rgba(255,255,255,.03)"
                        }}>
                          <div style={{ fontSize: 7, fontWeight: 700, color: "#37474f" }}>{x.l}</div>
                          <div style={{
                            fontSize: 12, fontWeight: 700, fontFamily: "monospace",
                            color: x.d ? "#ff1744" : "#cfd8dc"
                          }}>{x.v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{
                      background: "rgba(255,109,0,.05)", border: "1px solid rgba(255,109,0,.1)",
                      borderRadius: 4, padding: 8, fontSize: 11, color: "#ffab40", lineHeight: 1.5
                    }}>
                      ⚠️ {s.risk.idx >= 70
                        ? "DANGER — Abritez-vous immédiatement. Pièce sans fenêtre, sous-sol. Coupez le gaz. 112 si besoin."
                        : s.risk.idx >= 45
                          ? "Conditions sévères. Préparez un abri. Suivez Météo-France."
                          : "Vigilance. Surveillez l'évolution. vigilance.meteofrance.com"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── INFO ─── */}
        {tab === "info" && (
          <div style={{ maxWidth: 720 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 12px" }}>Les tornades et le climat français</h2>
            {[
              ["🌪️ La tornade",
                "Vortex atmosphérique de 50 m à 2 km de diamètre, vents 100 à 450 km/h, descendant d'un cumulonimbus jusqu'au sol. Durée : minutes à 1h. Parcours : centaines de m à 50 km. Se forme quand CAPE + cisaillement + humidité + forçage sont TOUS réunis simultanément."],
              ["🇫🇷 40-50 tornades/an en France",
                "Record européen (source Kéraunos). Zones les plus touchées : Hauts-de-France (carrefour de masses d'air), Bretagne-Normandie (fronts atlantiques), vallée de la Loire, couloir rhodanien. Saison : mai-octobre (pic juin-juillet), second pic automnal en Méditerranée. 90% sont EF0-EF1."],
              ["🌍 Pourquoi la France ?",
                "Carrefour climatique unique : air océanique humide (Atlantique/Gulf Stream) + air continental chaud (été) + air méditerranéen instable + jet-stream qui crée le cisaillement vertical. Ces 4 influences convergent et produisent les ingrédients tornadiques bien plus souvent qu'ailleurs en Europe."],
              ["⚡ Algorithme STP multiplicatif",
                "STP = f(CAPE) × f(Cisaillement) × f(Humidité) × (1+f(Pression)×0.4). Multiplicatif = si UN SEUL facteur = 0, le résultat = 0. Cisaillement calculé par vecteur réel sol↔500hPa (Open-Meteo). Trajectoire par méthode Bunkers (vent moyen dévié 20° droite). Indice pondéré par climatologie régionale Kéraunos."],
              ["📊 Échelle EF (Enhanced Fujita)",
                "EF0 (105-137 km/h) : branches\nEF1 (138-178) : toitures\nEF2 (179-218) : toits arrachés\nEF3 (219-266) : murs, voitures projetées\nEF4+ (267+) : destruction totale\n\nFrance : EF3 historiques à Palluel (1967), Hautmont (2008), Roetgen (2019)."],
              ["⚠️ Limites de cet outil",
                "Prototype. Manquent pour un système opérationnel : radar Doppler ARAMIS (Météo-France), radiosondages complets, modèle AROME 1.3km, SRH mesurée, données foudre temps réel.\n\n→ Pour votre sécurité : vigilance.meteofrance.com est la SEULE référence officielle."],
            ].map(([t, c], i) => (
              <div key={i} style={{
                background: "rgba(255,255,255,.02)", borderRadius: 8,
                padding: "10px 14px", marginBottom: 8, border: "1px solid rgba(255,255,255,.04)"
              }}>
                <h3 style={{ fontSize: 13, fontWeight: 800, margin: "0 0 6px" }}>{t}</h3>
                <div style={{ fontSize: 11, color: "#90a4ae", lineHeight: 1.65, whiteSpace: "pre-line" }}>{c}</div>
              </div>
            ))}
          </div>
        )}

        {/* ─── SÉCURITÉ ─── */}
        {tab === "vie" && (
          <div style={{ maxWidth: 720 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 4px" }}>Sauver des vies</h2>
            <p style={{ fontSize: 10, color: "#546e7a", marginBottom: 12 }}>Mémorisez. Partagez. Affichez.</p>
            {[
              { i: "🏠", t: "Bâtiment", c: "#00e676", items: [
                "Sous-sol immédiatement si possible",
                "Pièce sans fenêtre au centre du bâtiment (couloir, salle de bain, placard)",
                "Loin des fenêtres et murs extérieurs",
                "Protégez la tête (coussin, matelas, casque)",
                "Accroupi face au sol, mains sur la nuque",
                "NE REGARDEZ PAS la tornade par la fenêtre"
              ]},
              { i: "🚗", t: "Voiture — DANGER MAXIMAL", c: "#ff1744", items: [
                "QUITTEZ le véhicule immédiatement",
                "Bâtiment en dur visible → courez-y",
                "Sinon → fossé, allongé à plat ventre",
                "Tête protégée avec les bras",
                "JAMAIS fuir en voiture (la tornade change de cap)",
                "JAMAIS sous un pont (effet Venturi)"
              ]},
              { i: "🌳", t: "Extérieur", c: "#ff6d00", items: [
                "Bâtiment en dur immédiatement",
                "Pas d'abri → fossé/dépression, à plat ventre",
                "Loin des arbres, poteaux, véhicules",
                "Tête et nuque protégées",
                "Débris volent à +200 km/h"
              ]},
              { i: "📱", t: "Urgences & ressources", c: "#29b6f6", items: [
                "112 (européen) · 18 (pompiers) · 15 (SAMU)",
                "vigilance.meteofrance.com",
                "France Info 105.5 FM",
                "Application Météo-France (alertes push)",
                "keraunos.org (observatoire des tornades)"
              ]},
            ].map((s, i) => (
              <div key={i} style={{
                background: `${s.c}08`, border: `1px solid ${s.c}18`,
                borderRadius: 8, padding: "10px 14px", marginBottom: 8
              }}>
                <h3 style={{ fontSize: 13, fontWeight: 800, color: s.c, margin: "0 0 8px" }}>{s.i} {s.t}</h3>
                {s.items.map((it, j) => (
                  <div key={j} style={{
                    display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 4,
                    fontSize: 11, color: "#cfd8dc", lineHeight: 1.4
                  }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                      background: `${s.c}15`, color: s.c, fontSize: 9, fontWeight: 800
                    }}>{j + 1}</span>
                    <span>{it}</span>
                  </div>
                ))}
              </div>
            ))}
            <div style={{
              background: "rgba(255,255,255,.03)", borderRadius: 8,
              padding: "10px 14px", border: "1px solid rgba(255,255,255,.05)"
            }}>
              <p style={{ fontSize: 10, color: "#78909c", margin: 0 }}>
                <strong style={{ color: "#ffd600" }}>⚠️</strong> Prototype. Ne remplace pas Météo-France.
                En cas de danger : suivez les autorités. Urgence : <strong style={{ color: "#ff1744" }}>112</strong>.
              </p>
            </div>
          </div>
        )}
      </main>

      <footer style={{
        borderTop: "1px solid rgba(255,255,255,.03)", padding: "6px 16px",
        display: "flex", justifyContent: "space-between", flexWrap: "wrap",
        gap: 4, fontSize: 7, color: "#263238"
      }}>
        <span>VIGITORNADE · {mapSrc} · Open-Meteo 48h · STP×Bunkers · Kéraunos</span>
        <span>Prototype · Urgence : 112</span>
      </footer>
    </div>
  );
}
