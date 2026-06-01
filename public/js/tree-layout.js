const NODE_WIDTH = 170;
const NODE_HEIGHT = 90;
const H_GAP = 12;
const V_GAP = 50;

// Reingold-Tilford layout for a rooted tree.
// Returns [{id, x, y, width, height}] — pure function, no DOM access.
function computeLayout(persons, relationships) {
  if (!persons || persons.length === 0) return [];

  const childrenOf = buildAdjacency(persons, relationships);
  const roots = findRoots(persons, relationships);

  // If no root found (e.g. disconnected or cyclic), treat first person as root
  const root = roots.length > 0 ? roots[0] : persons[0].id;

  const positions = {};
  const modifiers = {};

  assignPreliminary(root, childrenOf, positions, modifiers);
  const finalPositions = [];
  collectFinal(root, 0, childrenOf, positions, modifiers, finalPositions, 0);

  // Shift all x so leftmost node is at x=0
  const minX = Math.min(...finalPositions.map(n => n.x));
  return finalPositions.map(n => ({
    id: n.id,
    x: n.x - minX,
    y: n.y,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
  }));
}

function buildAdjacency(persons, relationships) {
  const childrenOf = {};
  for (const p of persons) childrenOf[p.id] = [];
  for (const r of relationships) {
    if (childrenOf[r.parent_id] !== undefined) {
      childrenOf[r.parent_id].push(r.child_id);
    }
  }
  return childrenOf;
}

function findRoots(persons, relationships) {
  const hasParent = new Set(relationships.map(r => r.child_id));
  return persons.filter(p => !hasParent.has(p.id)).map(p => p.id);
}

// Assigns preliminary x positions (Reingold-Tilford first pass).
function assignPreliminary(nodeId, childrenOf, positions, modifiers) {
  const children = childrenOf[nodeId] || [];

  if (children.length === 0) {
    positions[nodeId] = { prelim: 0 };
    modifiers[nodeId] = 0;
    return;
  }

  for (const child of children) {
    assignPreliminary(child, childrenOf, positions, modifiers);
  }

  // Place children without overlap
  let cursor = 0;
  for (let i = 0; i < children.length; i++) {
    if (i === 0) {
      positions[children[i]].prelim = 0;
    } else {
      const prevRight = rightContour(children[i - 1], childrenOf, positions, modifiers);
      const currLeft = leftContour(children[i], childrenOf, positions, modifiers);
      const shift = prevRight - currLeft + NODE_WIDTH + H_GAP;
      if (shift > 0) {
        positions[children[i]].prelim += shift;
        modifiers[children[i]] = (modifiers[children[i]] || 0) + shift;
        cursor += shift;
      }
    }
  }

  // Centre parent over children
  const firstChild = positions[children[0]].prelim;
  const lastChild = positions[children[children.length - 1]].prelim;
  positions[nodeId] = { prelim: (firstChild + lastChild) / 2 };
  modifiers[nodeId] = modifiers[nodeId] || 0;
}

// Returns the rightmost x of the rightmost node at each depth.
function rightContour(nodeId, childrenOf, positions, modifiers, mod = 0, depth = 0, contour = {}) {
  const x = positions[nodeId].prelim + mod;
  contour[depth] = contour[depth] !== undefined ? Math.max(contour[depth], x) : x;
  const children = childrenOf[nodeId] || [];
  for (const child of children) {
    rightContour(child, childrenOf, positions, modifiers, mod + (modifiers[child] || 0), depth + 1, contour);
  }
  return Math.max(...Object.values(contour));
}

// Returns the leftmost x of the leftmost node at each depth.
function leftContour(nodeId, childrenOf, positions, modifiers, mod = 0, depth = 0, contour = {}) {
  const x = positions[nodeId].prelim + mod;
  contour[depth] = contour[depth] !== undefined ? Math.min(contour[depth], x) : x;
  const children = childrenOf[nodeId] || [];
  for (const child of children) {
    leftContour(child, childrenOf, positions, modifiers, mod + (modifiers[child] || 0), depth + 1, contour);
  }
  return Math.min(...Object.values(contour));
}

// Second pass: walk tree accumulating modifier, compute final (x, y).
function collectFinal(nodeId, modAccum, childrenOf, positions, modifiers, result, depth) {
  const x = positions[nodeId].prelim + modAccum;
  const y = depth * (NODE_HEIGHT + V_GAP);
  result.push({ id: nodeId, x, y });
  const children = childrenOf[nodeId] || [];
  for (const child of children) {
    collectFinal(child, modAccum + (modifiers[child] || 0), childrenOf, positions, modifiers, result, depth + 1);
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

if (typeof module !== 'undefined') module.exports = { computeLayout, splitTree };
