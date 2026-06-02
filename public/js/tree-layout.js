const NODE_WIDTH = 170;   // fallback width when no per-node measurement is provided
const NODE_HEIGHT = 90;   // fallback height (Node/test env without NodeMetrics)
const H_GAP = 14;
const V_GAP = 30;   // tightened (T12 density) — fits more per page, less scrolling

// Uniform row height across the tree (clean generations). Uses measured value
// in the browser; falls back to the constant in Node tests.
function unitHeight() {
  return (typeof NodeMetrics !== 'undefined' && NodeMetrics.uniformHeight)
    ? NodeMetrics.uniformHeight()
    : NODE_HEIGHT;
}

// Returns id -> width, defaulting to NODE_WIDTH when not measured.
function widthGetter(widthOf) {
  return (id) => (widthOf && widthOf[id] != null) ? widthOf[id] : NODE_WIDTH;
}

// Reingold-Tilford layout for a rooted tree.
// Returns [{id, x, y, width, height}] — pure function, no DOM access.
function computeLayout(persons, relationships, widthOf) {
  if (!persons || persons.length === 0) return [];

  const childrenOf = buildAdjacency(persons, relationships);
  const roots = findRoots(persons, relationships);
  const getW = widthGetter(widthOf);

  // If no root found (e.g. disconnected or cyclic), treat first person as root
  const root = roots.length > 0 ? roots[0] : persons[0].id;

  const positions = {};
  const modifiers = {};

  assignPreliminary(root, childrenOf, positions, modifiers, getW);
  const finalPositions = [];
  collectFinal(root, 0, childrenOf, positions, modifiers, finalPositions, 0);

  // Shift all x so leftmost node is at x=0
  const minX = Math.min(...finalPositions.map(n => n.x));
  return finalPositions.map(n => ({
    id: n.id,
    x: n.x - minX,
    y: n.y,
    width: getW(n.id),
    height: unitHeight(),
  }));
}

// Sibling order: manual `sequence` first (1,2,3…), then birth_year — both
// ascending. Missing values sort as +Infinity, so numbered siblings come before
// unnumbered ones and dated before undated. Equal keys return 0, so Array.sort
// (stable in modern engines) preserves the original DB order.
function compareSiblings(a, b) {
  const aSeq = (a && a.sequence != null) ? a.sequence : Infinity;
  const bSeq = (b && b.sequence != null) ? b.sequence : Infinity;
  if (aSeq !== bSeq) return aSeq - bSeq;
  const aBirth = (a && a.birth_year != null) ? a.birth_year : Infinity;
  const bBirth = (b && b.birth_year != null) ? b.birth_year : Infinity;
  if (aBirth !== bBirth) return aBirth - bBirth;
  return 0;
}

function buildAdjacency(persons, relationships) {
  const childrenOf = {};
  const personById = {};
  for (const p of persons) { childrenOf[p.id] = []; personById[p.id] = p; }
  for (const r of relationships) {
    if (childrenOf[r.parent_id] !== undefined) {
      childrenOf[r.parent_id].push(r.child_id);
    }
  }
  for (const pid in childrenOf) {
    childrenOf[pid].sort((a, b) => compareSiblings(personById[a], personById[b]));
  }
  return childrenOf;
}

function findRoots(persons, relationships) {
  const hasParent = new Set(relationships.map(r => r.child_id));
  return persons.filter(p => !hasParent.has(p.id)).map(p => p.id);
}

// Reingold-Tilford first pass with TRUE per-depth contours and variable node
// widths. prelim = node's LEFT edge. Each child is placed only as far right as
// its left contour requires against the combined right contour of all previously
// placed siblings — so subtrees nestle (tight packing), and couples (wider
// nodes) are spaced by their real widths.
function assignPreliminary(nodeId, childrenOf, positions, modifiers, getW) {
  const children = childrenOf[nodeId] || [];

  if (children.length === 0) {
    positions[nodeId] = { prelim: 0 };
    modifiers[nodeId] = 0;
    return;
  }

  for (const child of children) {
    assignPreliminary(child, childrenOf, positions, modifiers, getW);
  }

  let acc = null; // combined right contour {depth: rightEdge} of placed siblings
  for (let i = 0; i < children.length; i++) {
    const c = children[i];
    if (i > 0) {
      const cl = contourOf(c, childrenOf, positions, modifiers, getW, 'left');
      let shift = 0;
      for (const d in cl) {
        if (acc[d] !== undefined) {
          const need = acc[d] - cl[d] + H_GAP;
          if (need > shift) shift = need;
        }
      }
      if (shift > 0) {
        positions[c].prelim += shift;
        modifiers[c] = (modifiers[c] || 0) + shift;
      }
    }
    const cr = contourOf(c, childrenOf, positions, modifiers, getW, 'right');
    if (!acc) acc = {};
    for (const d in cr) {
      if (acc[d] === undefined || cr[d] > acc[d]) acc[d] = cr[d];
    }
  }

  // Centre parent (by its own width) over the children's centre span.
  const first = children[0];
  const last = children[children.length - 1];
  const firstCenter = positions[first].prelim + getW(first) / 2;
  const lastCenter = positions[last].prelim + getW(last) / 2;
  positions[nodeId] = { prelim: (firstCenter + lastCenter) / 2 - getW(nodeId) / 2 };
  modifiers[nodeId] = modifiers[nodeId] || 0;
}

// Per-depth contour of a subtree. side 'left' → min left edge per depth;
// 'right' → max right edge (left edge + node width) per depth.
function contourOf(nodeId, childrenOf, positions, modifiers, getW, side, mod = 0, depth = 0, out = {}) {
  const leftEdge = positions[nodeId].prelim + mod;
  const edge = side === 'left' ? leftEdge : leftEdge + getW(nodeId);
  if (out[depth] === undefined) out[depth] = edge;
  else out[depth] = side === 'left' ? Math.min(out[depth], edge) : Math.max(out[depth], edge);
  // Standard RT: descend adding THIS node's modifier (shifts its whole subtree).
  for (const child of (childrenOf[nodeId] || [])) {
    contourOf(child, childrenOf, positions, modifiers, getW, side, mod + (modifiers[nodeId] || 0), depth + 1, out);
  }
  return out;
}

// Second pass: walk tree accumulating modifier, compute final (x, y).
function collectFinal(nodeId, modAccum, childrenOf, positions, modifiers, result, depth) {
  const x = positions[nodeId].prelim + modAccum;
  const y = depth * (unitHeight() + V_GAP);
  result.push({ id: nodeId, x, y });
  const children = childrenOf[nodeId] || [];
  // Standard RT: descend adding THIS node's modifier (shifts its whole subtree).
  for (const child of children) {
    collectFinal(child, modAccum + (modifiers[nodeId] || 0), childrenOf, positions, modifiers, result, depth + 1);
  }
}

function splitTree(persons, relationships, focalNameEn) {
  if (!persons || persons.length === 0) {
    return { ancestorChain: [], focalId: null, descendantPersons: persons || [], descendantRelationships: relationships || [] };
  }

  const childrenOf = buildAdjacency(persons, relationships);
  const roots = findRoots(persons, relationships);
  const root = roots.length > 0 ? roots[0] : persons[0].id;
  const personById = Object.fromEntries(persons.map(p => [p.id, p]));

  const ancestorChain = [];
  let current = root;
  let focalId = null;

  while (current) {
    const person = personById[current];
    if (!person) break;

    const nameLower = (person.name_en || '').toLowerCase();
    const targetLower = (focalNameEn || '').toLowerCase();
    const nameMatch = targetLower && nameLower.includes(targetLower);

    if (nameMatch) {
      focalId = current;
      break;
    }

    const children = childrenOf[current] || [];
    if (children.length !== 1) {
      focalId = current;
      break;
    }

    ancestorChain.push(current);
    current = children[0];
  }

  if (!focalId) focalId = current || root;

  const descendantIds = new Set();
  function collect(id) {
    descendantIds.add(id);
    for (const child of (childrenOf[id] || [])) collect(child);
  }
  collect(focalId);

  return {
    ancestorChain,
    focalId,
    descendantPersons: persons.filter(p => descendantIds.has(p.id)),
    descendantRelationships: relationships.filter(
      r => descendantIds.has(r.parent_id) && descendantIds.has(r.child_id)
    ),
  };
}

// ── Grouped / compact layout ────────────────────────────────────────────────
// Used instead of Reingold-Tilford when a focal person is identified.
// Each top-level branch (direct child of focal) becomes a self-contained group.
// Within each group, children pack into a 2-row grid (see colsFor) and centre.

const GROUP_GAP  = 30;  // horizontal gap between top-level groups

// Each generation stays on ONE row (single line). Box width is strict and names
// wrap, so we no longer pack children into multiple rows.
function colsFor(n) {
  return n;
}

// Recursively lays out a subtree rooted at nodeId.
// getW: id -> unit width (couple or single). Returns { positions:[{id,x,y}], width, height }.
function layoutCompact(nodeId, childrenOf, depth, getW) {
  const children = childrenOf[nodeId] || [];
  const selfW = getW(nodeId);
  const H = unitHeight();

  if (children.length === 0) {
    return { positions: [{ id: nodeId, x: 0, y: 0 }], width: selfW, height: H };
  }

  const childLayouts = children.map(c => layoutCompact(c, childrenOf, depth + 1, getW));

  // Chunk into a grid (2 rows for larger families — T6)
  const cols = colsFor(childLayouts.length);
  const rows = [];
  for (let i = 0; i < childLayouts.length; i += cols) {
    rows.push(childLayouts.slice(i, i + cols));
  }

  const rowWidths = rows.map(row =>
    row.reduce((s, l) => s + l.width, 0) + H_GAP * (row.length - 1));

  // Brick offset: row 1 is left-aligned; row 2 is shifted right by half a column
  // so its children sit in row 1's gaps. Their drop-lines then pass between
  // row-1 boxes instead of piercing them (e.g. a family of 3 puts its lone
  // second-row child dead-centre in the gap).
  const twoRow = rows.length === 2;
  const halfPitch = twoRow ? (rows[0][0].width + H_GAP) / 2 : 0;

  let blockWidth = Math.max(selfW, rowWidths[0] || 0);
  if (twoRow) blockWidth = Math.max(blockWidth, halfPitch + (rowWidths[1] || 0));

  const childPositions = [];
  let currentY = H + V_GAP;
  rows.forEach((row, ri) => {
    const rowW = rowWidths[ri];
    let x = twoRow ? (ri === 1 ? halfPitch : 0) : Math.max(0, (blockWidth - rowW) / 2);
    let rowH = 0;
    for (const cl of row) {
      for (const pos of cl.positions) {
        childPositions.push({ id: pos.id, x: x + pos.x, y: currentY + pos.y });
      }
      x += cl.width + H_GAP;
      if (cl.height > rowH) rowH = cl.height;
    }
    currentY += rowH + V_GAP;
  });

  const nodeX = Math.max(0, (blockWidth - selfW) / 2);
  return {
    positions: [{ id: nodeId, x: nodeX, y: 0 }, ...childPositions],
    width: blockWidth,
    height: currentY - V_GAP,
  };
}

// Top-level grouped layout: each direct child of focal is a group.
// Groups are placed side-by-side; focal person is centered above them all.
function computeGroupedLayout(persons, relationships, focalId, widthOf) {
  if (!persons || persons.length === 0) return [];

  const childrenOf = buildAdjacency(persons, relationships);
  const groups = childrenOf[focalId] || [];
  const getW = widthGetter(widthOf);
  const H = unitHeight();

  if (groups.length === 0) {
    return [{ id: focalId, x: 0, y: 0, width: getW(focalId), height: H }];
  }

  // Layout each group subtree
  const groupLayouts = groups.map(gId => layoutCompact(gId, childrenOf, 0, getW));

  // Arrange groups side by side, offset downward by one level
  let offsetX = 0;
  const allPositions = [];

  for (const gl of groupLayouts) {
    for (const pos of gl.positions) {
      allPositions.push({
        id: pos.id,
        x: pos.x + offsetX,
        y: pos.y + H + V_GAP,
      });
    }
    offsetX += gl.width + GROUP_GAP;
  }

  // Focal person centered above all groups
  const totalW = offsetX - GROUP_GAP;
  const focalX = Math.max(0, (totalW - getW(focalId)) / 2);
  allPositions.push({ id: focalId, x: focalX, y: 0 });

  // Normalise so min-x = 0
  const minX = Math.min(...allPositions.map(n => n.x));
  return allPositions.map(n => ({
    id: n.id,
    x: n.x - minX,
    y: n.y,
    width: getW(n.id),
    height: H,
  }));
}

if (typeof module !== 'undefined') module.exports = { computeLayout, splitTree, computeGroupedLayout, compareSiblings };
