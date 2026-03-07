"use client";

import { useEffect, useState, useRef, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Person {
  id: string;
  data: {
    "first name"?: string;
    "last name"?: string;
    birthday?: string;
    gender?: string;
    avatar?: string;
    generation?: number;
  };
  rels: {
    parents?: string[];
    spouses?: string[];
    children?: string[];
  };
}

interface OverviewTreeProps {
  onSelectPerson: (id: string) => void;
  onClose: () => void;
}

// ─── Layout constants ─────────────────────────────────────────────────────────

const CW     = 90;   // card width
const CH     = 112;  // card height
const HGAP   = 14;   // gap between cards in a row
const CGAP   = 48;   // gap between sibling clusters
const ROWH   = 230;  // vertical distance between generations
const SPGAP  = 8;    // gap between spouses
const PADX   = 100;
const PADY   = 60;
const BOXPAD = 12;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getName(p: Person) {
  return [p.data["first name"], p.data["last name"]].filter(Boolean).join(" ");
}
function getYear(p: Person) {
  const b = p.data.birthday ?? "";
  return b.length > 4 ? b.slice(-4) : b;
}
function coupleW(n: number) {
  return n === 2 ? CW * 2 + SPGAP : CW;
}

// ─── Layout types ─────────────────────────────────────────────────────────────

interface CoupleUnit {
  ids: string[];
  parentIds: string[];
  ownParentIds: string[];
  isNucleus: boolean;
}

interface Card {
  id: string;
  person: Person;
  x: number; y: number; cx: number;
}

interface Box {
  x: number; y: number; w: number; h: number;
  memberIds: string[];
  parentIds: string[];
}

interface Connector {
  fromX: number; fromY: number;
  toX: number;   toY: number;
  parentIds: string[];
  memberIds: string[];
}

interface SpouseLine {
  x1: number; y1: number;
  x2: number; y2: number;
  ids: [string, string];
}

interface Layout {
  cards: Card[];
  boxes: Box[];
  connectors: Connector[];
  spouseLines: SpouseLine[];
  width: number; height: number;
}

// ─── Build couple units for one generation ────────────────────────────────────

function buildCouples(
  genPeople: Person[],
  byId: Map<string, Person>,
  allIds: Set<string>
): CoupleUnit[] {
  const used  = new Set<string>();
  const units: CoupleUnit[] = [];

  for (const p of genPeople) {
    if (used.has(p.id)) continue;
    used.add(p.id);

    const gen      = p.data.generation ?? 0;
    const spouseId = (p.rels.spouses ?? []).find(
      sid => allIds.has(sid) && !used.has(sid) &&
             (byId.get(sid)?.data.generation ?? 0) === gen
    );
    if (spouseId) used.add(spouseId);

    const pParents = (p.rels.parents ?? []).filter(id => allIds.has(id));
    const sParents = spouseId
      ? (byId.get(spouseId)?.rels.parents ?? []).filter(id => allIds.has(id))
      : [];

    units.push({
      ids:          spouseId ? [p.id, spouseId] : [p.id],
      parentIds:    pParents.length > 0 ? pParents : sParents,
      ownParentIds: pParents,
      isNucleus:    pParents.length > 0 && sParents.length > 0,
    });
  }
  return units;
}

// ─── Build the full layout ────────────────────────────────────────────────────

function buildLayout(people: Person[]): Layout {
  const byId   = new Map(people.map(p => [p.id, p]));
  const allIds = new Set(people.map(p => p.id));
  const gens   = [...new Set(people.map(p => p.data.generation ?? 0))].sort((a, b) => a - b);
  const cx     = new Map<string, number>(); // relative center-x per person

  // ── Find nucleus couple ────────────────────────────────────────────────────
  let nucleusUnit: CoupleUnit | null = null;
  let nucleusGen  = gens[0] ?? 0;

  for (const g of gens) {
    const units = buildCouples(people.filter(p => (p.data.generation ?? 0) === g), byId, allIds);
    const found = units.find(u => u.isNucleus);
    if (found) { nucleusUnit = found; nucleusGen = g; break; }
  }

  const nId  = nucleusUnit?.ids[0] ?? people[0]?.id ?? "";
  const nsId = nucleusUnit?.ids[1] ?? null;

  // ── Place nucleus generation ───────────────────────────────────────────────
  cx.set(nId, -(SPGAP / 2 + CW / 2));
  if (nsId) cx.set(nsId, SPGAP / 2 + CW / 2);

  const nsOwnParents = nsId
    ? (byId.get(nsId)?.rels.parents ?? []).filter(id => allIds.has(id))
    : [];

  {
    const units     = buildCouples(people.filter(p => (p.data.generation ?? 0) === nucleusGen), byId, allIds);
    const nonNucleus = units.filter(u => !u.isNucleus);
    const nKey       = nucleusUnit ? [...nucleusUnit.ownParentIds].sort().join("+") : "";
    const nsKey      = [...nsOwnParents].sort().join("+");

    const leftUnits  = nonNucleus.filter(u => [...u.parentIds].sort().join("+") === nKey);
    const rightUnits = nonNucleus.filter(u => [...u.parentIds].sort().join("+") === nsKey);
    const lKeys      = new Set(leftUnits.flatMap(u => u.ids));
    const rKeys      = new Set(rightUnits.flatMap(u => u.ids));
    const otherUnits = nonNucleus.filter(u => !u.ids.some(id => lKeys.has(id) || rKeys.has(id)));

    // Left units: place right-to-left from nucleus
    let lx = cx.get(nId)! - CW / 2 - HGAP;
    for (let i = leftUnits.length - 1; i >= 0; i--) {
      const { ids } = leftUnits[i];
      lx -= coupleW(ids.length);
      ids.length === 2
        ? (cx.set(ids[0], lx + CW / 2), cx.set(ids[1], lx + CW + SPGAP + CW / 2))
        : cx.set(ids[0], lx + CW / 2);
      lx -= HGAP;
    }

    // Right units + others: left-to-right from nucleus spouse
    let rx = (nsId ? cx.get(nsId)! : 0) + CW / 2 + HGAP;
    for (const u of [...rightUnits, ...(otherUnits.length ? [null as null, ...otherUnits] : [])]) {
      if (!u) { rx += CGAP - HGAP; continue; }
      const { ids } = u;
      ids.length === 2
        ? (cx.set(ids[0], rx + CW / 2), cx.set(ids[1], rx + CW + SPGAP + CW / 2))
        : cx.set(ids[0], rx + CW / 2);
      rx += coupleW(ids.length) + HGAP;
    }
  }

  // ── Place all other generations ────────────────────────────────────────────
  for (const g of gens) {
    if (g === nucleusGen) continue;

    const units  = buildCouples(people.filter(p => (p.data.generation ?? 0) === g), byId, allIds);
    const groups = new Map<string, { parentIds: string[]; units: CoupleUnit[] }>();

    for (const u of units) {
      const key = u.parentIds.length > 0
        ? [...u.parentIds].sort().join("+")
        : `root-${u.ids[0]}`;
      if (!groups.has(key)) groups.set(key, { parentIds: u.parentIds, units: [] });
      groups.get(key)!.units.push(u);
    }

    const sorted = [...groups.values()].map(g => {
      const pxs    = g.parentIds.map(id => cx.get(id)).filter((x): x is number => x !== undefined);
      const idealCX = pxs.length > 0 ? pxs.reduce((a, b) => a + b) / pxs.length : 0;
      const totalW  = g.units.reduce((s, u, i) => s + coupleW(u.ids.length) + (i > 0 ? HGAP : 0), 0);
      return { ...g, idealCX, totalW };
    }).sort((a, b) => a.idealCX - b.idealCX);

    // Push groups apart to avoid overlap
    for (let i = 1; i < sorted.length; i++) {
      const min = sorted[i-1].idealCX + sorted[i-1].totalW / 2 + CGAP + sorted[i].totalW / 2;
      if (sorted[i].idealCX < min) sorted[i].idealCX = min;
    }
    for (let i = sorted.length - 2; i >= 0; i--) {
      const max = sorted[i+1].idealCX - sorted[i+1].totalW / 2 - CGAP - sorted[i].totalW / 2;
      if (sorted[i].idealCX > max) sorted[i].idealCX = max;
    }

    for (const { units: us, idealCX, totalW } of sorted) {
      let x = idealCX - totalW / 2;
      for (const u of us) {
        const { ids } = u;
        ids.length === 2
          ? (cx.set(ids[0], x + CW / 2), cx.set(ids[1], x + CW + SPGAP + CW / 2))
          : cx.set(ids[0], x + CW / 2);
        x += coupleW(ids.length) + HGAP;
      }
    }
  }

  // ── Re-center ancestor generations above their children ───────────────────
  for (const g of gens) {
    if (g >= nucleusGen) continue;
    for (const u of buildCouples(people.filter(p => (p.data.generation ?? 0) === g), byId, allIds)) {
      const kids = [...new Set([
        ...(byId.get(u.ids[0])?.rels.children ?? []),
        ...(u.ids[1] ? byId.get(u.ids[1])?.rels.children ?? [] : []),
      ])].filter(id => allIds.has(id));
      const pxs = kids.map(id => cx.get(id)).filter((x): x is number => x !== undefined);
      if (!pxs.length) continue;
      const mid = pxs.reduce((a, b) => a + b) / pxs.length;
      u.ids.length === 2
        ? (cx.set(u.ids[0], mid - SPGAP / 2 - CW / 2), cx.set(u.ids[1], mid + SPGAP / 2 + CW / 2))
        : cx.set(u.ids[0], mid);
    }
  }

  // ── Absolute positions ─────────────────────────────────────────────────────
  const allCX  = [...cx.values()];
  const minX   = Math.min(...allCX.map(x => x - CW / 2));
  const maxX   = Math.max(...allCX.map(x => x + CW / 2));
  const offset = -minX + PADX;

  const cardMap = new Map<string, Card>();
  const cards: Card[] = [];
  for (const p of people) {
    const absCX  = (cx.get(p.id) ?? 0) + offset;
    const genIdx = gens.indexOf(p.data.generation ?? 0);
    const y      = PADY + genIdx * ROWH;
    const card: Card = { id: p.id, person: p, x: absCX - CW / 2, y, cx: absCX };
    cards.push(card);
    cardMap.set(p.id, card);
  }

  // ── Boxes + connectors ─────────────────────────────────────────────────────
  const boxes: Box[]            = [];
  const connectors: Connector[] = [];

  function makeBox(memberIds: string[], parentIds: string[]) {
    const mc = memberIds.map(id => cardMap.get(id)).filter(Boolean) as Card[];
    if (!mc.length) return;

    const minBX = Math.min(...mc.map(c => c.x))       - BOXPAD;
    const maxBX = Math.max(...mc.map(c => c.x + CW))  + BOXPAD;
    const topY  = mc[0].y                              - BOXPAD;
    boxes.push({ x: minBX, y: topY, w: maxBX - minBX, h: CH + BOXPAD * 2, memberIds, parentIds });

    if (!parentIds.length) return;
    const pc = parentIds.map(id => cardMap.get(id)).filter(Boolean) as Card[];
    if (!pc.length) return;

    connectors.push({
      fromX: pc.reduce((s, c) => s + c.cx, 0) / pc.length,
      fromY: pc.reduce((s, c) => s + c.y + CH, 0) / pc.length,
      toX:   (minBX + maxBX) / 2,
      toY:   topY,
      parentIds,
      memberIds,
    });
  }

  // Nucleus gen: box A (left siblings + nucleus), box B (spouse + right siblings)
  {
    const units      = buildCouples(people.filter(p => (p.data.generation ?? 0) === nucleusGen), byId, allIds);
    const nKey       = nucleusUnit ? [...nucleusUnit.ownParentIds].sort().join("+") : "";
    const nsKey      = [...nsOwnParents].sort().join("+");
    const leftUnits  = units.filter(u => !u.isNucleus && [...u.parentIds].sort().join("+") === nKey);
    const rightUnits = units.filter(u => !u.isNucleus && [...u.parentIds].sort().join("+") === nsKey);
    const lKeys      = new Set(leftUnits.flatMap(u => u.ids));
    const rKeys      = new Set(rightUnits.flatMap(u => u.ids));

    makeBox([...leftUnits.flatMap(u => u.ids), nId], nucleusUnit?.ownParentIds ?? []);
    if (nsId) makeBox([nsId, ...rightUnits.flatMap(u => u.ids)], nsOwnParents);

    const others = units.filter(u =>
      !u.isNucleus && !u.ids.some(id => lKeys.has(id) || rKeys.has(id)) &&
      !u.ids.includes(nId) && !u.ids.includes(nsId ?? "")
    );
    for (const u of others) makeBox(u.ids, u.parentIds);
  }

  // All other generations
  for (const g of gens) {
    if (g === nucleusGen) continue;
    const units  = buildCouples(people.filter(p => (p.data.generation ?? 0) === g), byId, allIds);
    const groups = new Map<string, { parentIds: string[]; ids: string[] }>();
    for (const u of units) {
      const key = u.parentIds.length > 0 ? [...u.parentIds].sort().join("+") : `root-${u.ids[0]}`;
      if (!groups.has(key)) groups.set(key, { parentIds: u.parentIds, ids: [] });
      groups.get(key)!.ids.push(...u.ids);
    }
    for (const { parentIds, ids } of groups.values()) makeBox(ids, parentIds);
  }

  // ── Spouse lines ───────────────────────────────────────────────────────────
  const spouseLines: SpouseLine[] = [];
  const seen = new Set<string>();
  for (const card of cards) {
    for (const sid of card.person.rels.spouses ?? []) {
      if (!allIds.has(sid)) continue;
      const key = [card.id, sid].sort().join(":");
      if (seen.has(key)) continue;
      seen.add(key);
      const sc = cardMap.get(sid);
      if (!sc) continue;
      spouseLines.push({
        x1: card.cx, y1: card.y + CH / 2,
        x2: sc.cx,   y2: sc.y  + CH / 2,
        ids: [card.id, sid],
      });
    }
  }

  return {
    cards, boxes, connectors, spouseLines,
    width:  maxX - minX + PADX * 2,
    height: gens.length * ROWH + CH + PADY * 2,
  };
}

// ─── Hover spotlight ──────────────────────────────────────────────────────────

function getConnectedIds(hoveredId: string, people: Person[]): Set<string> {
  const byId = new Map(people.map(p => [p.id, p]));
  const p    = byId.get(hoveredId);
  if (!p) return new Set();

  const ids = new Set<string>([hoveredId]);
  for (const id of p.rels.spouses ?? []) ids.add(id);
  for (const pid of p.rels.parents ?? []) {
    ids.add(pid);
    for (const ps of byId.get(pid)?.rels.spouses ?? []) ids.add(ps);
    for (const sib of byId.get(pid)?.rels.children ?? []) ids.add(sib);
  }
  for (const id of p.rels.children ?? []) ids.add(id);
  return ids;
}

// ─── Card component ───────────────────────────────────────────────────────────

function SvgCard({ card, dimmed, highlighted, onClick, onHover, onHoverEnd }: {
  card: Card;
  dimmed: boolean;
  highlighted: boolean;
  onClick: () => void;
  onHover: () => void;
  onHoverEnd: () => void;
}) {
  const p      = card.person;
  const name   = getName(p);
  const year   = getYear(p);
  const gender = (p.data.gender ?? "").toUpperCase();
  const isMale = gender === "M";
  const isFem  = gender === "F";

  const stroke = isMale ? "var(--theme-chart-male,#81d4fa)"
    : isFem ? "var(--theme-chart-female,#f48fb1)"
    : "rgba(128,128,128,.3)";

  const fill = highlighted
    ? (isMale ? "rgba(130,180,255,0.18)" : isFem ? "rgba(255,150,180,0.18)" : "rgba(255,255,255,0.1)")
    : "rgba(255,255,255,0.04)";

  const lines: string[] = [];
  let cur = "";
  for (const w of name.split(" ")) {
    const test = cur ? `${cur} ${w}` : w;
    if (test.length > 13 && cur) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  const display = lines.slice(0, 2);

  return (
    <g
      transform={`translate(${card.x},${card.y})`}
      onClick={e => { e.stopPropagation(); onClick(); }}
      onMouseEnter={onHover}
      onMouseLeave={onHoverEnd}
      style={{ cursor: "pointer", opacity: dimmed ? 0.1 : 1, transition: "opacity 0.2s",
               filter: highlighted ? "drop-shadow(0 0 6px currentColor)" : "none" }}
    >
      <rect width={CW} height={CH} rx={10} fill={fill}
        stroke={stroke} strokeWidth={highlighted ? 2.5 : 1.5} />
      <circle cx={CW/2} cy={30} r={16} fill="rgba(128,128,128,.1)" />
      <g transform={`translate(${CW/2-8},17)`} fill="rgba(128,128,128,.35)">
        <circle cx={8} cy={5.5} r={4.5} />
        <path d="M0 20 Q0 13 8 13 Q16 13 16 20 Z" />
      </g>
      {p.data.avatar && (
        <>
          <defs><clipPath id={`av-${card.id}`}><circle cx={CW/2} cy={30} r={16}/></clipPath></defs>
          <image href={p.data.avatar} x={CW/2-16} y={14} width={32} height={32}
            clipPath={`url(#av-${card.id})`} preserveAspectRatio="xMidYMid slice"/>
        </>
      )}
      {display.map((line, i) => (
        <text key={i} x={CW/2} y={56+i*13} textAnchor="middle"
          fontSize={9} fontWeight={highlighted ? 700 : 600}
          fill="var(--theme-chart-text,#e2e8f0)" fontFamily="system-ui,sans-serif"
        >{line}</text>
      ))}
      {year && (
        <text x={CW/2} y={56+display.length*13+5} textAnchor="middle"
          fontSize={8} opacity={0.4}
          fill="var(--theme-chart-text,#e2e8f0)" fontFamily="system-ui,sans-serif"
        >{year}</text>
      )}
      <rect width={CW} height={CH} rx={10} fill="transparent" />
    </g>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function OverviewTree({ onSelectPerson, onClose }: OverviewTreeProps) {
  const [people, setPeople]       = useState<Person[]>([]);
  const [loading, setLoading]     = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tf, setTf]               = useState({ x: 0, y: 0, scale: 1 });
  const isPanning                 = useRef(false);
  const panStart                  = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  useEffect(() => {
    fetch("/api/family")
      .then(r => r.json())
      .then(d => { setPeople(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setTf(t => ({ ...t, scale: Math.min(Math.max(t.scale * (e.deltaY > 0 ? 0.9 : 1.1), 0.15), 4) }));
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isPanning.current = true;
    panStart.current  = { x: e.clientX, y: e.clientY, tx: tf.x, ty: tf.y };
  }, [tf]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    setTf(t => ({ ...t,
      x: panStart.current.tx + (e.clientX - panStart.current.x),
      y: panStart.current.ty + (e.clientY - panStart.current.y),
    }));
  }, []);

  const stopPan = useCallback(() => { isPanning.current = false; }, []);

  const layout = people.length > 0 ? buildLayout(people) : null;
  const gens   = [...new Set(people.map(p => p.data.generation ?? 0))].sort((a, b) => a - b);
  const lit    = hoveredId ? getConnectedIds(hoveredId, people) : null;

  const cDim = (parentIds: string[], memberIds: string[]) =>
    !!lit && !parentIds.some(id => lit.has(id)) && !memberIds.some(id => lit.has(id));
  const cLit = (parentIds: string[], memberIds: string[]) =>
    !!lit && (parentIds.some(id => lit.has(id)) || memberIds.some(id => lit.has(id)));
  const sDim = (ids: [string, string]) => !!lit && !ids.some(id => lit.has(id));
  const sLit = (ids: [string, string]) => !!lit && ids.every(id => lit.has(id));

  return (
    <>
      <style>{`
        .ov{position:fixed;inset:0;z-index:50;background:var(--theme-chart-bg,#111);display:flex;flex-direction:column;animation:ovIn .2s ease}
        @keyframes ovIn{from{opacity:0;transform:scale(.98)}to{opacity:1;transform:scale(1)}}
        .ov-bar{display:flex;align-items:center;justify-content:space-between;padding:10px 20px;border-bottom:1px solid rgba(128,128,128,.12);flex-shrink:0;gap:16px}
        .ov-title{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--theme-chart-text,#e2e8f0);opacity:.4}
        .ov-hint{font-size:11px;color:var(--theme-chart-text,#e2e8f0);opacity:.25;white-space:nowrap}
        .ov-btns{display:flex;align-items:center;gap:6px}
        .ov-btn{background:rgba(128,128,128,.1);border:1px solid rgba(128,128,128,.18);color:var(--theme-chart-text,#e2e8f0);border-radius:6px;height:28px;min-width:28px;padding:0 8px;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s;gap:5px}
        .ov-btn:hover{background:rgba(128,128,128,.22)}
        .ov-pct{font-size:10px;color:var(--theme-chart-text,#e2e8f0);opacity:.35;min-width:34px;text-align:center;font-variant-numeric:tabular-nums}
        .ov-canvas{flex:1;overflow:hidden;position:relative;cursor:grab}
        .ov-canvas:active{cursor:grabbing}
        .ov-inner{position:absolute;inset:0;display:flex;align-items:flex-start;justify-content:center}
        .ov-loading{display:flex;align-items:center;justify-content:center;flex:1;color:var(--theme-chart-text,#e2e8f0);opacity:.4;font-size:14px}
      `}</style>

      <div className="ov" onClick={onClose}>
        <div className="ov-bar" onClick={e => e.stopPropagation()}>
          <span className="ov-title">Family Overview</span>
          <span className="ov-hint">Hover to spotlight · Click to focus · Scroll to zoom · Drag to pan</span>
          <div className="ov-btns">
            <button className="ov-btn" onClick={() => setTf(t => ({ ...t, scale: Math.max(t.scale * 0.8, 0.15) }))}>−</button>
            <span className="ov-pct">{Math.round(tf.scale * 100)}%</span>
            <button className="ov-btn" onClick={() => setTf(t => ({ ...t, scale: Math.min(t.scale * 1.25, 4) }))}>+</button>
            <button className="ov-btn" style={{ fontSize: 10 }} onClick={() => setTf({ x: 0, y: 0, scale: 1 })}>Reset</button>
            <button className="ov-btn" onClick={onClose}>
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              Close
            </button>
          </div>
        </div>

        {loading ? (
          <div className="ov-loading">Loading…</div>
        ) : layout ? (
          <div className="ov-canvas"
            onWheel={onWheel} onMouseDown={onMouseDown}
            onMouseMove={onMouseMove} onMouseUp={stopPan} onMouseLeave={stopPan}
            onClick={e => e.stopPropagation()}
          >
            <div className="ov-inner" style={{
              transform: `translate(${tf.x}px,${tf.y}px) scale(${tf.scale})`,
              transformOrigin: "center top",
              transition: isPanning.current ? "none" : "transform 0.04s ease",
            }}>
              <svg width={layout.width} height={layout.height}
                viewBox={`0 0 ${layout.width} ${layout.height}`}
                style={{ overflow: "visible", display: "block", userSelect: "none" }}
              >
                {/* Generation labels */}
                {gens.map((g, i) => (
                  <text key={g} x={8} y={PADY + i * ROWH + CH / 2}
                    fontSize={9} fontWeight={700} letterSpacing={2}
                    fill="var(--theme-chart-text,#e2e8f0)" opacity={lit ? 0.06 : 0.18}
                    fontFamily="system-ui,sans-serif" style={{ transition: "opacity 0.2s" }}
                  >GEN {g}</text>
                ))}

                {/* Sibling group boxes */}
                {layout.boxes.map((b, i) => (
                  <rect key={`b${i}`} x={b.x} y={b.y} width={b.w} height={b.h} rx={10}
                    fill="none" stroke="rgba(128,128,128,.18)" strokeWidth={1.5} strokeDasharray="5 3"
                    opacity={lit && !b.memberIds.some(id => lit.has(id)) && !b.parentIds.some(id => lit.has(id)) ? 0.06 : 1}
                    style={{ transition: "opacity 0.2s" }}
                  />
                ))}

                {/* Parent–child connectors */}
                {layout.connectors.map((c, i) => (
                  <line key={`c${i}`} x1={c.fromX} y1={c.fromY} x2={c.toX} y2={c.toY}
                    stroke={cLit(c.parentIds, c.memberIds) ? "rgba(220,220,240,.85)" : "rgba(180,180,200,.28)"}
                    strokeWidth={cLit(c.parentIds, c.memberIds) ? 2 : 1.5} strokeLinecap="round"
                    opacity={cDim(c.parentIds, c.memberIds) ? 0.04 : 1}
                    style={{ transition: "opacity 0.2s, stroke 0.2s" }}
                  />
                ))}

                {/* Spouse lines */}
                {layout.spouseLines.map((sl, i) => (
                  <line key={`s${i}`} x1={sl.x1} y1={sl.y1} x2={sl.x2} y2={sl.y2}
                    stroke={sLit(sl.ids) ? "rgba(220,220,240,.85)" : "rgba(180,180,200,.35)"}
                    strokeWidth={sLit(sl.ids) ? 2 : 1.5}
                    strokeDasharray={sLit(sl.ids) ? "none" : "4 3"}
                    opacity={sDim(sl.ids) ? 0.04 : 1}
                    style={{ transition: "opacity 0.2s, stroke 0.2s" }}
                  />
                ))}

                {/* Couple midpoint dots */}
                {layout.spouseLines.map((sl, i) => (
                  <circle key={`d${i}`}
                    cx={(sl.x1+sl.x2)/2} cy={(sl.y1+sl.y2)/2}
                    r={sLit(sl.ids) ? 5 : 3.5}
                    fill={sLit(sl.ids) ? "rgba(220,220,240,.9)" : "rgba(180,180,200,.5)"}
                    opacity={sDim(sl.ids) ? 0.04 : 1}
                    style={{ transition: "opacity 0.2s" }}
                  />
                ))}

                {/* Person cards */}
                {layout.cards.map(card => (
                  <SvgCard key={card.id} card={card}
                    dimmed={!!lit && !lit.has(card.id)}
                    highlighted={!!lit && lit.has(card.id)}
                    onClick={() => { onSelectPerson(card.id); onClose(); }}
                    onHover={() => setHoveredId(card.id)}
                    onHoverEnd={() => setHoveredId(null)}
                  />
                ))}
              </svg>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
