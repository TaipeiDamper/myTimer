import { CANVAS, MARGIN, USABLE, UNION_RASTER_SIZE } from './constants.js';
import { clampInteger } from './settings.js';

export function gridPointToXY(col, row, cols, rows) {
    const x = MARGIN + (col / cols) * USABLE;
    const y = MARGIN + (row / rows) * USABLE;
    return { x, y, col, row };
}

export function buildGridPoints(cols, rows) {
    const points = [];
    for (let r = 0; r <= rows; r += 1) {
        for (let c = 0; c <= cols; c += 1) {
            points.push(gridPointToXY(c, r, cols, rows));
        }
    }
    return points;
}

export function cross(o, a, b) {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

export function convexHull(points) {
    if (points.length < 3) return null;

    const sorted = [...points].sort((a, b) => a.y - b.y || a.x - b.x);
    const lower = [];
    for (const p of sorted) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
            lower.pop();
        }
        lower.push(p);
    }

    const upper = [];
    for (let i = sorted.length - 1; i >= 0; i -= 1) {
        const p = sorted[i];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
            upper.pop();
        }
        upper.push(p);
    }

    upper.pop();
    lower.pop();
    const hull = lower.concat(upper);
    return hull.length >= 3 ? hull : null;
}

export function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export function sampleHullFromPoints(pool, vertexCount, maxAttempts = 40) {
    if (pool.length < 3) return null;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const k = Math.min(vertexCount, pool.length);
        const sampled = shuffleArray(pool).slice(0, k);
        const hull = convexHull(sampled);
        if (hull && hull.length >= 3) {
            return hull;
        }
    }
    return null;
}

export function buildEdgeMeta(vertexCount, edgeType) {
    const meta = [];
    for (let i = 0; i < vertexCount; i += 1) {
        let isCurve = false;
        if (edgeType === 'curve') isCurve = true;
        else if (edgeType === 'mixed') isCurve = Math.random() > 0.5;
        meta.push({ isCurve, sign: Math.random() > 0.5 ? 1 : -1 });
    }
    return meta;
}

function midpoint(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function buildPolygonSegments(vertices, edgeMeta, closed) {
    const count = vertices.length;
    const segments = [];
    const edgeCount = closed ? count : count - 1;

    for (let i = 0; i < edgeCount; i += 1) {
        const p1 = vertices[i];
        const p2 = vertices[(i + 1) % count];
        const meta = edgeMeta[i % edgeMeta.length];
        segments.push({ p1, p2, meta });
    }
    return segments;
}

function segmentToPathPart(p1, p2, meta, curveStrength) {
    if (!meta.isCurve) {
        return `L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const mid = midpoint(p1, p2);
    const offset = curveStrength * len * meta.sign;
    const cx = mid.x + nx * offset;
    const cy = mid.y + ny * offset;
    return `Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
}

export function buildShapePath(vertices, edgeMeta, curveStrength, closed = true) {
    if (!vertices.length) return '';
    let d = `M ${vertices[0].x.toFixed(2)} ${vertices[0].y.toFixed(2)}`;
    const segments = buildPolygonSegments(vertices, edgeMeta, closed);
    segments.forEach(seg => {
        d += ` ${segmentToPathPart(seg.p1, seg.p2, seg.meta, curveStrength)}`;
    });
    if (closed) d += ' Z';
    return d;
}

export function getPolygonPathD(poly, curveStrength) {
    return buildShapePath(poly.vertices, poly.edgeMeta, curveStrength, true);
}

export function getPolygonVertexSources(poly) {
    if (poly.sourceParts && poly.sourceParts.length) return poly.sourceParts;
    return [poly];
}

export function getPracticeAreaPath() {
    return `M ${MARGIN} ${MARGIN} H ${CANVAS - MARGIN} V ${CANVAS - MARGIN} H ${MARGIN} Z`;
}

export function dedupeNearbyVertices(vertices, minDist) {
    if (!vertices.length) return [];
    const result = [vertices[0]];
    for (let i = 1; i < vertices.length; i += 1) {
        const prev = result[result.length - 1];
        const cur = vertices[i];
        if (Math.hypot(cur.x - prev.x, cur.y - prev.y) >= minDist) {
            result.push(cur);
        }
    }
    if (result.length > 2) {
        const first = result[0];
        const last = result[result.length - 1];
        if (Math.hypot(first.x - last.x, first.y - last.y) < minDist) {
            result.pop();
        }
    }
    return result.length >= 3 ? result : vertices;
}

function perpendicularDistance(point, lineStart, lineEnd) {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
    const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lenSq;
    const projX = lineStart.x + t * dx;
    const projY = lineStart.y + t * dy;
    return Math.hypot(point.x - projX, point.y - projY);
}

function simplifyContour(points, epsilon) {
    if (points.length <= 2) return points;

    let maxDist = 0;
    let maxIdx = 0;
    const end = points.length - 1;
    for (let i = 1; i < end; i += 1) {
        const dist = perpendicularDistance(points[i], points[0], points[end]);
        if (dist > maxDist) {
            maxDist = dist;
            maxIdx = i;
        }
    }

    if (maxDist > epsilon) {
        const left = simplifyContour(points.slice(0, maxIdx + 1), epsilon);
        const right = simplifyContour(points.slice(maxIdx), epsilon);
        return left.slice(0, -1).concat(right);
    }
    return [points[0], points[end]];
}

function traceLargestContour(mask, w, h) {
    let sx = -1;
    let sy = -1;

    for (let y = 1; y < h - 1 && sx < 0; y += 1) {
        for (let x = 1; x < w - 1; x += 1) {
            if (mask[y * w + x] && !mask[(y - 1) * w + x]) {
                sx = x;
                sy = y;
                break;
            }
        }
    }
    if (sx < 0) return [];

    const neighbors = [
        { dx: 1, dy: 0 }, { dx: 1, dy: 1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 1 },
        { dx: -1, dy: 0 }, { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 }
    ];

    const contour = [{ x: sx, y: sy }];
    let px = sx;
    let py = sy;
    let backtrack = 4;
    let steps = 0;

    do {
        let moved = false;
        for (let i = 0; i < 8; i += 1) {
            const ni = (backtrack + i) % 8;
            const nx = px + neighbors[ni].dx;
            const ny = py + neighbors[ni].dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            if (!mask[ny * w + nx]) continue;
            px = nx;
            py = ny;
            contour.push({ x: px, y: py });
            backtrack = (ni + 4) % 8;
            moved = true;
            break;
        }
        if (!moved) break;
        steps += 1;
    } while ((px !== sx || py !== sy) && steps < w * h * 2);

    return contour;
}

function contourToVertices(contour, rasterSize) {
    const scale = CANVAS / rasterSize;
    const raw = contour.map(p => ({
        x: p.x * scale,
        y: p.y * scale
    }));
    const simplified = dedupeNearbyVertices(raw, 4);
    return simplified.length >= 3 ? simplified : raw;
}

export function buildUnionSilhouette(parts, settings) {
    if (!parts.length) return null;

    const size = UNION_RASTER_SIZE;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    const scale = size / CANVAS;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = '#fff';

    parts.forEach(poly => {
        const d = buildShapePath(poly.vertices, poly.edgeMeta, settings.curveStrength, true);
        if (!d) return;
        try {
            ctx.fill(new Path2D(d));
        } catch {
            // Path2D unsupported — skip
        }
    });

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const imageData = ctx.getImageData(0, 0, size, size);
    const mask = new Uint8Array(size * size);
    for (let i = 0; i < size * size; i += 1) {
        mask[i] = imageData.data[i * 4 + 3] > 48 ? 1 : 0;
    }

    const contour = traceLargestContour(mask, size, size);
    if (contour.length < 8) return null;

    const simplified = simplifyContour(contour, 3.5);
    const vertices = contourToVertices(simplified, size);
    if (vertices.length < 3) return null;

    const verticesWithGrid = vertices.map(v => {
        const col = clampInteger(((v.x - MARGIN) / USABLE) * settings.genCols, 0, settings.genCols, 0);
        const row = clampInteger(((v.y - MARGIN) / USABLE) * settings.genRows, 0, settings.genRows, 0);
        return { ...v, col, row };
    });

    return {
        vertices: verticesWithGrid,
        edgeMeta: buildEdgeMeta(verticesWithGrid.length, 'straight'),
        isUnionSilhouette: true,
        sourceParts: parts
    };
}
