import { clampInteger } from './settings.js';
import {
    buildGridPoints,
    buildEdgeMeta,
    buildUnionSilhouette,
    sampleHullFromPoints,
    shuffleArray
} from './geometry.js';

export function createPolygon(vertices, settings, edgeMeta = null) {
    return {
        vertices,
        edgeMeta: edgeMeta || buildEdgeMeta(vertices.length, settings.edgeType)
    };
}

function randomVertexCount(setting) {
    if (setting === 'random') {
        return 4 + Math.floor(Math.random() * 3);
    }
    return clampInteger(setting, 3, 8, 5);
}

function getCompositionAnchors(count, cols, rows) {
    const c = cols;
    const r = rows;
    const anchors = {
        2: [
            { col: Math.max(1, Math.round(c * 0.2)), row: Math.max(1, Math.round(r * 0.25)) },
            { col: Math.min(c - 1, Math.round(c * 0.8)), row: Math.min(r - 1, Math.round(r * 0.75)) }
        ],
        3: [
            { col: Math.max(1, Math.round(c * 0.15)), row: Math.max(1, Math.round(r * 0.2)) },
            { col: Math.min(c - 1, Math.round(c * 0.85)), row: Math.max(1, Math.round(r * 0.25)) },
            { col: Math.round(c * 0.5), row: Math.min(r - 1, Math.round(r * 0.85)) }
        ],
        4: [
            { col: Math.max(1, Math.round(c * 0.15)), row: Math.max(1, Math.round(r * 0.15)) },
            { col: Math.min(c - 1, Math.round(c * 0.85)), row: Math.max(1, Math.round(r * 0.15)) },
            { col: Math.max(1, Math.round(c * 0.15)), row: Math.min(r - 1, Math.round(r * 0.85)) },
            { col: Math.min(c - 1, Math.round(c * 0.85)), row: Math.min(r - 1, Math.round(r * 0.85)) }
        ]
    };
    return shuffleArray(anchors[count] || anchors[3]);
}

function poolAroundAnchor(allPoints, anchor, cols, rows, spreadRatio) {
    const spread = Math.max(2, Math.ceil(Math.min(cols, rows) * spreadRatio));
    const pool = allPoints.filter(p => (
        Math.abs(p.col - anchor.col) <= spread
        && Math.abs(p.row - anchor.row) <= spread
    ));
    return pool.length >= 3 ? pool : allPoints;
}

function getComplexPartZones(count, cols, rows) {
    return getCompositionAnchors(count, cols, rows).map(anchor => ({ anchor }));
}

export function generateSinglePolygon(settings) {
    const pool = buildGridPoints(settings.genCols, settings.genRows);
    const k = randomVertexCount(settings.vertexCount);
    const hull = sampleHullFromPoints(pool, k);
    if (!hull) return [];
    return [createPolygon(hull, settings)];
}

export function generateComplexParts(settings) {
    const allPoints = buildGridPoints(settings.genCols, settings.genRows);
    const polygons = [];
    const count = settings.shapeCount;
    const k = randomVertexCount(settings.vertexCount);
    const zones = getComplexPartZones(count, settings.genCols, settings.genRows);
    const spreadRatio = 0.72;

    for (let i = 0; i < count; i += 1) {
        const zone = zones[i % zones.length];
        const pool = poolAroundAnchor(allPoints, zone.anchor, settings.genCols, settings.genRows, spreadRatio);
        const hull = sampleHullFromPoints(pool, Math.max(3, k - 1 + Math.floor(Math.random() * 2)));
        if (hull) {
            polygons.push(createPolygon(hull, settings));
        }
    }

    if (polygons.length === 0) {
        return generateSinglePolygon(settings);
    }
    return polygons;
}

export function generateComplexPolygons(settings) {
    const parts = generateComplexParts(settings);
    const silhouette = buildUnionSilhouette(parts, settings);

    if (silhouette) {
        return [silhouette];
    }

    return parts.length ? parts : generateSinglePolygon(settings);
}

export function generatePolygonsForMode(mode, settings) {
    if (mode === 'complex') return generateComplexPolygons(settings);
    return generateSinglePolygon(settings);
}
