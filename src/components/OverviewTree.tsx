"use client";

import { useEffect, useState } from "react";

interface PersonData {
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

const CARD_W      = 90;
const CARD_H      = 112;
const H_GAP       = 10;
const CLUSTER_GAP = 32;
const ROW_H       = 195;
const COUPLE_GAP  = 8;
const PAD_X       = 80;
const PAD_Y       = 48;
const BOX_PAD     = 10;
const BOX_R       = 10;

function getName(p: PersonData) {
  return [p.data["first name"], p.data["last name"]].filter(Boolean).join(" ");
}
function getYear(p: PersonData) {
  const b = p.data.birthday ?? "";
  return b.length > 4 ? b.slice(-4) : b;
}
function unitW(ids: string[]) {
  return ids.length === 2 ? CARD_W * 2 + COUPLE_GAP : CARD_W;
}

// ─── Core data model ──────────────────────────────────────────────────────────
// A "couple unit" = one or two people treated as a single entity for layout.
// parentIds = the parents of this unit (inherited from whichever spouse has parents).
interface CoupleUnit {
  ids: string[];          // [personId] or [personId, spouseId]
  parentIds: string[];    // parents in dataset (used for grouping)
  ownParentIds: string[]; // each person's own parents (may differ for nucleus)
  children: string[];     // all shared children
  isNucleus: boolean;     // both spouses have their own separate parents
}

// A "sibling group" = all couple units sharing the same parents → one box on screen
interface SiblingGroup {
  parentIds: string[];
  units: CoupleUnit[];
}

function buildCoupleUnits(
  genPeople: PersonData[],
  byId: Map<string, PersonData>,
  allIds: Set<string>
): CoupleUnit[] {
  const used = new Set<string>();
  const units: CoupleUnit[] = [];

  for (const p of genPeople) {
    if (used.has(p.id)) continue;
    used.add(p.id);

    const gen = p.data.generation ?? 0;
    const spouseId = (p.rels.spouses ?? []).find(
      sid => allIds.has(sid) && !used.has(sid) && (byId.get(sid)?.data.generation ?? 0) === gen
    );
    const spouse = spouseId ? byId.get(spouseId)! : null;
    if (spouseId) used.add(spouseId);

    const pParents = (p.rels.parents ?? []).filter(pid => allIds.has(pid));
    const sParents = spouse ? (spouse.rels.parents ?? []).filter(pid => allIds.has(pid)) : [];

    // Both spouses have their own parents → nucleus couple
    const isNucleus = pParents.length > 0 && sParents.length > 0;

    // For grouping: use whoever has parents; if neither, unit is a root
    const groupParents = pParents.length > 0 ? pParents : sParents;

    const children = [
      ...new Set([
        ...(p.rels.children ?? []),
        ...(spouse?.rels.children ?? []),
      ]),
    ].filter(cid => allIds.has(cid));

    units.push({
      ids: spouseId ? [p.id, spouseId] : [p.id],
      parentIds: groupParents,
      ownParentIds: pParents, // primary person's own parents
      children,
      isNucleus,
    });
  }
  return units;
}

function buildSiblingGroups(units: CoupleUnit[]): SiblingGroup[] {
  const map = new Map<string, SiblingGroup>();

  for (const unit of units) {
    if (unit.isNucleus) {
      // Nucleus: split into two anchors — primary belongs to their own parents,
      // spouse belongs to their own parents. They'll be adjacent at the border.
      // We represent this by adding the unit to BOTH groups with a flag.
      // Layout will handle placing nucleus at right-end of groupA, spouse at left-end of groupB.
      // Here we just put the whole unit under the primary's parents for grouping purposes —
      // the layout engine handles the special split placement.
      const key = [...unit.parentIds].sort().join("+") || `root-${unit.ids[0]}`;
      if (!map.has(key)) map.set(key, { parentIds: unit.parentIds, units: [] });
      map.get(key)!.units.push(unit);
    } else {
      const key = unit.parentIds.length > 0
        ? [...unit.parentIds].sort().join("+")
        : `root-${unit.ids[0]}`;
      if (!map.has(key)) map.set(key, { parentIds: unit.parentIds, units: [] });
      map.get(key)!.units.push(unit);
    }
  }

  return [...map.values()];
}

// ─── Layout ───────────────────────────────────────────────────────────────────

interface PositionedCard {
  id: string; person: PersonData;
  x: number; y: number; cx: number;
}
interface SiblingBox { x: number; y: number; w: number; h: number; }
interface Connector  { fromX: number; fromY: number; toX: number; toY: number; }
interface CoupleDot  { cx: number; cy: number; }
interface Layout {
  cards: PositionedCard[];
  boxes: SiblingBox[];
  connectors: Connector[];
  dots: CoupleDot[];
  width: number; height: number;
}

function buildLayout(people: PersonData[]): Layout {
  const byId   = new Map(people.map(p => [p.id, p]));
  const allIds = new Set(people.map(p => p.id));
  const genNumbers = [...new Set(people.map(p => p.data.generation ?? 0))].sort((a, b) => a - b);

  // personCX: relative center-x for each person (nucleus midpoint = 0)
  const personCX = new Map<string, number>();

  // ── Find nucleus couple ──────────────────────────────────────────────────
  // Nucleus = couple unit where both spouses have their own parents in dataset
  let nucleusUnit: CoupleUnit | null = null;
  let nucleusGen = 1;

  for (const g of genNumbers) {
    const genPeople = people.filter(p => (p.data.generation ?? 0) === g);
    const units = buildCoupleUnits(genPeople, byId, allIds);
    const candidate = units.find(u => u.isNucleus);
    if (candidate) {
      nucleusUnit = candidate;
      nucleusGen = g;
      break;
    }
  }

  // Fallback: couple with most children
  if (!nucleusUnit) {
    let best: CoupleUnit | null = null;
    let maxC = -1;
    for (const g of genNumbers) {
      const genPeople = people.filter(p => (p.data.generation ?? 0) === g);
      const units = buildCoupleUnits(genPeople, byId, allIds);
      for (const u of units) {
        if (u.children.length > maxC) { maxC = u.children.length; best = u; nucleusGen = g; }
      }
    }
    nucleusUnit = best;
  }

  const nucleusPersonId  = nucleusUnit?.ids[0] ?? people[0]?.id ?? "";
  const nucleusSpouseId  = nucleusUnit?.ids[1] ?? null;

  // ── Place nucleus gen ────────────────────────────────────────────────────
  {
    const genPeople = people.filter(p => (p.data.generation ?? 0) === nucleusGen);
    const allUnits  = buildCoupleUnits(genPeople, byId, allIds);

    // Nucleus sits at center: person at left-of-center, spouse at right-of-center
    personCX.set(nucleusPersonId, -(COUPLE_GAP / 2 + CARD_W / 2));
    if (nucleusSpouseId) personCX.set(nucleusSpouseId, COUPLE_GAP / 2 + CARD_W / 2);

    // Non-nucleus units: group by parentIds
    const nonNucleusUnits = allUnits.filter(u => !u.isNucleus);

    // Nucleus person's parents → these units go to the LEFT of nucleus
    const nucleusParentKey = nucleusUnit
      ? [...nucleusUnit.ownParentIds].sort().join("+")
      : "";
    // Nucleus spouse's own parents
    const nucleusSpouseOwnParents = nucleusSpouseId
      ? (byId.get(nucleusSpouseId)?.rels.parents ?? []).filter(pid => allIds.has(pid))
      : [];
    const spouseParentKey = [...nucleusSpouseOwnParents].sort().join("+");

    // Units that share nucleus person's parents → left side
    const leftUnits = nonNucleusUnits.filter(u =>
      [...u.parentIds].sort().join("+") === nucleusParentKey
    );
    // Units that share spouse's parents → right side
    const rightUnits = nonNucleusUnits.filter(u =>
      [...u.parentIds].sort().join("+") === spouseParentKey
    );
    // Anything else → far right
    const leftKeys  = new Set(leftUnits.map(u => u.ids[0]));
    const rightKeys = new Set(rightUnits.map(u => u.ids[0]));
    const otherUnits = nonNucleusUnits.filter(
      u => !leftKeys.has(u.ids[0]) && !rightKeys.has(u.ids[0])
    );

    // Place left units RIGHT-TO-LEFT from nucleus
    let lx = personCX.get(nucleusPersonId)! - CARD_W / 2 - H_GAP;
    for (let i = leftUnits.length - 1; i >= 0; i--) {
      const ids = leftUnits[i].ids;
      const w   = unitW(ids);
      lx -= w;
      if (ids.length === 2) {
        personCX.set(ids[0], lx + CARD_W / 2);
        personCX.set(ids[1], lx + CARD_W + COUPLE_GAP + CARD_W / 2);
      } else {
        personCX.set(ids[0], lx + CARD_W / 2);
      }
      lx -= H_GAP;
    }

    // Place right units LEFT-TO-RIGHT from nucleus spouse
    let rx = (nucleusSpouseId ? personCX.get(nucleusSpouseId)! : 0) + CARD_W / 2 + H_GAP;
    for (const u of rightUnits) {
      const ids = u.ids;
      const w   = unitW(ids);
      if (ids.length === 2) {
        personCX.set(ids[0], rx + CARD_W / 2);
        personCX.set(ids[1], rx + CARD_W + COUPLE_GAP + CARD_W / 2);
      } else {
        personCX.set(ids[0], rx + CARD_W / 2);
      }
      rx += w + H_GAP;
    }

    // Other units far right
    if (otherUnits.length > 0) {
      rx += CLUSTER_GAP - H_GAP;
      for (const u of otherUnits) {
        const ids = u.ids;
        const w   = unitW(ids);
        if (ids.length === 2) {
          personCX.set(ids[0], rx + CARD_W / 2);
          personCX.set(ids[1], rx + CARD_W + COUPLE_GAP + CARD_W / 2);
        } else {
          personCX.set(ids[0], rx + CARD_W / 2);
        }
        rx += w + H_GAP;
      }
    }
  }

  // ── Place other generations ──────────────────────────────────────────────
  for (const g of genNumbers) {
    if (g === nucleusGen) continue;
    const genPeople = people.filter(p => (p.data.generation ?? 0) === g);
    const allUnits  = buildCoupleUnits(genPeople, byId, allIds);
    const groups    = buildSiblingGroups(allUnits);

    // Sort groups by their ideal center x (average of parent positions)
    type GI = { group: SiblingGroup; idealCX: number; totalW: number };
    const gis: GI[] = groups.map(group => {
      const pxs = group.parentIds
        .map(pid => personCX.get(pid))
        .filter((x): x is number => x !== undefined);
      const idealCX = pxs.length > 0 ? pxs.reduce((a, b) => a + b) / pxs.length : 0;
      const totalW  = group.units.reduce(
        (s, u, i) => s + unitW(u.ids) + (i > 0 ? H_GAP : 0), 0
      );
      return { group, idealCX, totalW };
    });
    gis.sort((a, b) => a.idealCX - b.idealCX);

    // Spread to avoid overlap
    for (let i = 1; i < gis.length; i++) {
      const prev = gis[i - 1], cur = gis[i];
      const min = prev.idealCX + prev.totalW / 2 + CLUSTER_GAP + cur.totalW / 2;
      if (cur.idealCX < min) cur.idealCX = min;
    }
    for (let i = gis.length - 2; i >= 0; i--) {
      const cur = gis[i], next = gis[i + 1];
      const max = next.idealCX - next.totalW / 2 - CLUSTER_GAP - cur.totalW / 2;
      if (cur.idealCX > max) cur.idealCX = max;
    }

    for (const { group, idealCX, totalW } of gis) {
      let x = idealCX - totalW / 2;
      for (const u of group.units) {
        const ids = u.ids;
        if (ids.length === 2) {
          personCX.set(ids[0], x + CARD_W / 2);
          personCX.set(ids[1], x + CARD_W + COUPLE_GAP + CARD_W / 2);
          x += CARD_W * 2 + COUPLE_GAP + H_GAP;
        } else {
          personCX.set(ids[0], x + CARD_W / 2);
          x += CARD_W + H_GAP;
        }
      }
    }
  }

  // ── Gen 0: center each couple above their children ───────────────────────
  for (const g of genNumbers) {
    if (g >= nucleusGen) continue;
    const genPeople = people.filter(p => (p.data.generation ?? 0) === g);
    const units     = buildCoupleUnits(genPeople, byId, allIds);
    for (const u of units) {
      const cxs = u.children
        .map(cid => personCX.get(cid))
        .filter((x): x is number => x !== undefined);
      const coupleCX = cxs.length > 0 ? cxs.reduce((a, b) => a + b) / cxs.length : 0;
      if (u.ids.length === 2) {
        personCX.set(u.ids[0], coupleCX - COUPLE_GAP / 2 - CARD_W / 2);
        personCX.set(u.ids[1], coupleCX + COUPLE_GAP / 2 + CARD_W / 2);
      } else {
        personCX.set(u.ids[0], coupleCX);
      }
    }
  }

  // ── Absolute positions ───────────────────────────────────────────────────
  const allCXs  = [...personCX.values()];
  const minRelX = Math.min(...allCXs.map(cx => cx - CARD_W / 2));
  const maxRelX = Math.max(...allCXs.map(cx => cx + CARD_W / 2));
  const offsetX = -minRelX + PAD_X;
  const totalW  = maxRelX - minRelX + PAD_X * 2;
  const totalH  = genNumbers.length * ROW_H + CARD_H + PAD_Y * 2;

  const cardMap = new Map<string, PositionedCard>();
  const cards: PositionedCard[] = [];
  for (const p of people) {
    const cx     = (personCX.get(p.id) ?? 0) + offsetX;
    const genIdx = genNumbers.indexOf(p.data.generation ?? 0);
    const y      = PAD_Y + genIdx * ROW_H;
    const card: PositionedCard = { id: p.id, person: p, x: cx - CARD_W / 2, y, cx };
    cards.push(card);
    cardMap.set(p.id, card);
  }

  // ── Sibling boxes + connectors ───────────────────────────────────────────
  // Box rule: for each sibling group, draw a dashed box around all cards,
  // then draw ONE elbow line from the parent couple midpoint to the box top center.
  //
  // Special nucleus case: we draw TWO boxes for the nucleus gen:
  //   Box A = nucleus person's parent group (left side + nucleus at right edge)
  //   Box B = nucleus spouse's parent group (spouse at left edge + right side)
  const boxes: SiblingBox[]     = [];
  const connectors: Connector[] = [];

  function makeBox(memberIds: string[], parentIds: string[]) {
    const mCards = memberIds
      .map(id => cardMap.get(id))
      .filter((c): c is PositionedCard => !!c);
    if (mCards.length === 0) return;

    const minX = Math.min(...mCards.map(c => c.x))           - BOX_PAD;
    const maxX = Math.max(...mCards.map(c => c.x + CARD_W))  + BOX_PAD;
    const topY = mCards[0].y                                  - BOX_PAD;
    boxes.push({ x: minX, y: topY, w: maxX - minX, h: CARD_H + BOX_PAD * 2 });

    if (parentIds.length === 0) return;
    const pCards = parentIds
      .map(id => cardMap.get(id))
      .filter((c): c is PositionedCard => !!c);
    if (pCards.length === 0) return;

    const fromX = pCards.reduce((s, c) => s + c.cx, 0) / pCards.length;
    const fromY = pCards[0].y + CARD_H;
    const toX   = (minX + maxX) / 2;
    const toY   = topY;
    connectors.push({ fromX, fromY, toX, toY });
  }

  // Nucleus gen boxes
  {
    const genPeople = people.filter(p => (p.data.generation ?? 0) === nucleusGen);
    const allUnits  = buildCoupleUnits(genPeople, byId, allIds);

    const nucleusParentKey = nucleusUnit
      ? [...nucleusUnit.ownParentIds].sort().join("+")
      : "";
    const nucleusSpouseOwnParents = nucleusSpouseId
      ? (byId.get(nucleusSpouseId)?.rels.parents ?? []).filter(pid => allIds.has(pid))
      : [];
    const spouseParentKey = [...nucleusSpouseOwnParents].sort().join("+");

    // Box A: left units + nucleus person
    const leftUnits = allUnits.filter(u =>
      !u.isNucleus && [...u.parentIds].sort().join("+") === nucleusParentKey
    );
    const boxAIds = [
      ...leftUnits.flatMap(u => u.ids),
      nucleusPersonId,
    ];
    makeBox(boxAIds, nucleusUnit?.ownParentIds ?? []);

    // Box B: nucleus spouse + right units
    if (nucleusSpouseId) {
      const rightUnits = allUnits.filter(u =>
        !u.isNucleus && [...u.parentIds].sort().join("+") === spouseParentKey
      );
      const boxBIds = [
        nucleusSpouseId,
        ...rightUnits.flatMap(u => u.ids),
      ];
      makeBox(boxBIds, nucleusSpouseOwnParents);
    }

    // Any other units in nucleus gen (rare edge case)
    const leftKeys  = new Set(leftUnits.flatMap(u => u.ids));
    const rightUnitsAll = allUnits.filter(u =>
      !u.isNucleus && [...u.parentIds].sort().join("+") === spouseParentKey
    );
    const rightKeys = new Set(rightUnitsAll.flatMap(u => u.ids));
    const otherUnits = allUnits.filter(u =>
      !u.isNucleus &&
      !u.ids.some(id => leftKeys.has(id) || rightKeys.has(id)) &&
      u.ids[0] !== nucleusPersonId &&
      u.ids[0] !== nucleusSpouseId
    );
    for (const u of otherUnits) makeBox(u.ids, u.parentIds);
  }

  // Other gen boxes
  for (const g of genNumbers) {
    if (g === nucleusGen) continue;
    const genPeople = people.filter(p => (p.data.generation ?? 0) === g);
    const allUnits  = buildCoupleUnits(genPeople, byId, allIds);
    const groups    = buildSiblingGroups(allUnits);
    for (const group of groups) {
      const memberIds = group.units.flatMap(u => u.ids);
      makeBox(memberIds, group.parentIds);
    }
  }

  // Gen 0 boxes (no connectors — they're roots)
  for (const g of genNumbers) {
    if (g >= nucleusGen) continue;
    const genPeople = people.filter(p => (p.data.generation ?? 0) === g);
    const units = buildCoupleUnits(genPeople, byId, allIds);
    for (const u of units) makeBox(u.ids, []);
  }

  // ── Couple dots ──────────────────────────────────────────────────────────
  const dots: CoupleDot[] = [];
  for (const card of cards) {
    const sid = (card.person.rels.spouses ?? [])[0];
    if (!sid || sid < card.id || !allIds.has(sid)) continue;
    const sc = cardMap.get(sid);
    if (!sc) continue;
    dots.push({ cx: (card.cx + sc.cx) / 2, cy: card.y + CARD_H / 2 });
  }

  return { cards, boxes, connectors, dots, width: totalW, height: totalH };
}

// ─── SVG Card ─────────────────────────────────────────────────────────────────
function SvgCard({ card, onClick }: { card: PositionedCard; onClick: () => void }) {
  const p = card.person;
  const name = getName(p);
  const year = getYear(p);
  const gender = (p.data.gender ?? "").toUpperCase();
  const isMale   = gender === "M";
  const isFemale = gender === "F";
  const borderColor = isMale
    ? "var(--theme-chart-male,#81d4fa)"
    : isFemale
    ? "var(--theme-chart-female,#f48fb1)"
    : "rgba(128,128,128,.3)";
  const fillColor = isMale
    ? "rgba(129,212,250,.08)"
    : isFemale
    ? "rgba(244,143,177,.08)"
    : "rgba(128,128,128,.05)";

  const words = name.split(" ");
  const nameLines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (test.length > 13 && cur) { nameLines.push(cur); cur = w; }
    else cur = test;
  }
  if (cur) nameLines.push(cur);
  const displayLines = nameLines.slice(0, 2);

  return (
    <g
      transform={`translate(${card.x},${card.y})`}
      onClick={e => { e.stopPropagation(); onClick(); }}
      style={{ cursor: "pointer" }}
    >
      <rect width={CARD_W} height={CARD_H} rx={10} fill={fillColor} stroke={borderColor} strokeWidth={2} />
      <circle cx={CARD_W / 2} cy={30} r={16} fill="rgba(128,128,128,.1)" />
      <g transform={`translate(${CARD_W / 2 - 8},17)`} fill="rgba(128,128,128,.35)">
        <circle cx={8} cy={5.5} r={4.5} />
        <path d="M0 20 Q0 13 8 13 Q16 13 16 20 Z" />
      </g>
      {p.data.avatar && (
        <>
          <defs>
            <clipPath id={`clip-${card.id}`}>
              <circle cx={CARD_W / 2} cy={30} r={16} />
            </clipPath>
          </defs>
          <image href={p.data.avatar} x={CARD_W / 2 - 16} y={14} width={32} height={32}
            clipPath={`url(#clip-${card.id})`} preserveAspectRatio="xMidYMid slice" />
        </>
      )}
      {displayLines.map((line, i) => (
        <text key={i} x={CARD_W / 2} y={56 + i * 13}
          textAnchor="middle" fontSize={9} fontWeight={600}
          fill="var(--theme-chart-text,#e2e8f0)" fontFamily="system-ui,sans-serif"
        >{line}</text>
      ))}
      {year && (
        <text x={CARD_W / 2} y={56 + displayLines.length * 13 + 5}
          textAnchor="middle" fontSize={8} opacity={0.4}
          fill="var(--theme-chart-text,#e2e8f0)" fontFamily="system-ui,sans-serif"
        >{year}</text>
      )}
      <rect width={CARD_W} height={CARD_H} rx={10} fill="transparent" />
    </g>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const DATA_URL = "/api/family";

export default function OverviewTree({ onSelectPerson, onClose }: OverviewTreeProps) {
  const [people, setPeople]   = useState<PersonData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(DATA_URL)
      .then(r => r.json())
      .then(d => { setPeople(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const layout     = people.length > 0 ? buildLayout(people) : null;
  const genNumbers = [...new Set(people.map(p => p.data.generation ?? 0))].sort((a, b) => a - b);

  return (
    <>
      <style>{`
        .ov-wrap { position:fixed;inset:0;z-index:50;background:var(--theme-chart-bg,#1a1a2e);display:flex;flex-direction:column;animation:ovIn .22s ease; }
        @keyframes ovIn { from{opacity:0;transform:scale(.98)}to{opacity:1;transform:scale(1)} }
        .ov-header { position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;padding:14px 24px;background:var(--theme-chart-bg,#1a1a2e);border-bottom:1px solid rgba(128,128,128,.15);flex-shrink:0; }
        .ov-title  { font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--theme-chart-text,#e2e8f0);opacity:.5; }
        .ov-hint   { font-size:12px;color:var(--theme-chart-text,#e2e8f0);opacity:.3; }
        .ov-close  { background:rgba(128,128,128,.12);border:1px solid rgba(128,128,128,.2);color:var(--theme-chart-text,#e2e8f0);border-radius:8px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;transition:background .15s; }
        .ov-close:hover { background:rgba(128,128,128,.22); }
        .ov-scroll  { flex:1;overflow:auto;padding:24px;display:flex;align-items:flex-start;justify-content:center; }
        .ov-loading { display:flex;align-items:center;justify-content:center;flex:1;color:var(--theme-chart-text,#e2e8f0);opacity:.4;font-size:14px; }
        .ov-card-g:hover { opacity:.8; }
      `}</style>

      <div className="ov-wrap" onClick={onClose}>
        <div className="ov-header" onClick={e => e.stopPropagation()}>
          <span className="ov-title">Family Overview</span>
          <span className="ov-hint">Click a person to focus · Esc or click background to exit</span>
          <button className="ov-close" onClick={onClose}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            Close
          </button>
        </div>

        {loading ? (
          <div className="ov-loading">Loading…</div>
        ) : layout ? (
          <div className="ov-scroll" onClick={e => e.stopPropagation()}>
            <svg
              width={layout.width} height={layout.height}
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              style={{ overflow: "visible", display: "block" }}
            >
              {genNumbers.map((g, i) => (
                <text key={g} x={8} y={PAD_Y + i * ROW_H + CARD_H / 2}
                  fontSize={9} fontWeight={700} letterSpacing={2}
                  fill="var(--theme-chart-text,#e2e8f0)" opacity={0.2}
                  fontFamily="system-ui,sans-serif"
                >GEN {g}</text>
              ))}

              {layout.boxes.map((b, i) => (
                <rect key={`box-${i}`}
                  x={b.x} y={b.y} width={b.w} height={b.h} rx={BOX_R}
                  fill="none" stroke="rgba(128,128,128,.2)"
                  strokeWidth={1.5} strokeDasharray="5 3"
                />
              ))}

              {layout.connectors.map((c, i) => {
                const midY = c.fromY + (c.toY - c.fromY) / 2;
                return (
                  <path key={`conn-${i}`}
                    d={`M${c.fromX},${c.fromY} L${c.fromX},${midY} L${c.toX},${midY} L${c.toX},${c.toY}`}
                    fill="none"
                    stroke="var(--theme-chart-link,rgba(180,180,200,.3))"
                    strokeWidth={1.5} strokeLinecap="round"
                  />
                );
              })}

              {layout.dots.map((d, i) => (
                <circle key={`dot-${i}`} cx={d.cx} cy={d.cy} r={4}
                  fill="var(--theme-chart-link,rgba(180,180,200,.5))" />
              ))}

              {layout.cards.map(card => (
                <g key={card.id} className="ov-card-g">
                  <SvgCard card={card} onClick={() => { onSelectPerson(card.id); onClose(); }} />
                </g>
              ))}
            </svg>
          </div>
        ) : null}
      </div>
    </>
  );
}
