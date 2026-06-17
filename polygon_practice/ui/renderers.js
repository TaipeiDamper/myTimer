import { CANVAS, MARGIN, USABLE, SHAPE_COLORS, COMPLEX_SOLID_COLOR } from '../core/constants.js';
import {
    buildGridPoints,
    buildShapePath,
    getPolygonPathD,
    getPolygonVertexSources,
    getPracticeAreaPath
} from '../core/geometry.js';
import {
    getCustomEdgeMeta,
    getCustomPreviewPolygons
} from '../modes/customSession.js';
import { updateControls } from './controls.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function usesSolidPracticeDisplay(mode) {
    return mode === 'complex' || mode === 'custom';
}

function getSolidPracticeStyle(displayMode) {
    if (displayMode === 'fill') {
        return { stroke: COMPLEX_SOLID_COLOR, fill: COMPLEX_SOLID_COLOR };
    }
    return { stroke: COMPLEX_SOLID_COLOR, fill: 'none' };
}

function getPolygonDisplayColor(idx, colors, mode) {
    if (mode === 'complex') return colors[0];
    return colors[idx % colors.length];
}

function getUsedVertexKeys(state) {
    const keys = new Set();
    state.polygons.forEach(poly => {
        getPolygonVertexSources(poly).forEach(part => {
            part.vertices.forEach(v => keys.add(`${v.col},${v.row}`));
        });
    });
    if (state.mode === 'custom' && state.customPoints.length > 0) {
        state.customPoints.forEach(pt => keys.add(`${pt.col},${pt.row}`));
    }
    if (state.mode === 'custom') {
        state.customDrafts.forEach(draft => {
            draft.vertices.forEach(v => keys.add(`${v.col},${v.row}`));
        });
    }
    return keys;
}

export function appendPolygonsToShapeGroup(polygons, settings, shapeGroup, options = {}) {
    const displayMode = options.displayMode ?? settings.displayMode;
    const useSolid = options.useSolid ?? usesSolidPracticeDisplay(options.mode);
    const mode = options.mode ?? 'single';
    const colors = SHAPE_COLORS;
    const pointerEvents = options.pointerEvents;

    if (displayMode === 'invert') {
        const combined = document.createElementNS(SVG_NS, 'path');
        let d = getPracticeAreaPath();
        polygons.forEach(poly => {
            d += ` ${getPolygonPathD(poly, settings.curveStrength)}`;
        });
        combined.setAttribute('d', d);
        combined.setAttribute('fill', useSolid ? COMPLEX_SOLID_COLOR : 'rgba(16, 185, 129, 0.35)');
        combined.setAttribute('fill-rule', 'evenodd');
        combined.setAttribute('stroke', 'none');
        if (pointerEvents) combined.setAttribute('pointer-events', pointerEvents);
        shapeGroup.appendChild(combined);

        polygons.forEach((poly, idx) => {
            const outline = document.createElementNS(SVG_NS, 'path');
            outline.setAttribute('d', getPolygonPathD(poly, settings.curveStrength));
            outline.setAttribute('fill', 'none');
            const strokeColor = useSolid
                ? COMPLEX_SOLID_COLOR
                : getPolygonDisplayColor(idx, colors, mode).stroke;
            outline.setAttribute('stroke', strokeColor);
            outline.setAttribute('stroke-width', '2');
            if (pointerEvents) outline.setAttribute('pointer-events', pointerEvents);
            shapeGroup.appendChild(outline);
        });
    } else {
        polygons.forEach((poly, idx) => {
            const path = document.createElementNS(SVG_NS, 'path');
            const style = useSolid
                ? getSolidPracticeStyle(displayMode)
                : {
                    stroke: getPolygonDisplayColor(idx, colors, mode).stroke,
                    fill: displayMode === 'fill' ? getPolygonDisplayColor(idx, colors, mode).fill : 'none'
                };
            path.setAttribute('d', getPolygonPathD(poly, settings.curveStrength));
            path.setAttribute('stroke', style.stroke);
            path.setAttribute('stroke-width', '2.5');
            path.setAttribute('fill', style.fill);
            if (pointerEvents) path.setAttribute('pointer-events', pointerEvents);
            shapeGroup.appendChild(path);
        });
    }
}

export function renderCanvasBorder(els) {
    els.layerBorder.innerHTML = '';
    const g = document.createElementNS(SVG_NS, 'g');
    g.classList.add('canvas-border');

    const outer = document.createElementNS(SVG_NS, 'rect');
    outer.setAttribute('x', MARGIN);
    outer.setAttribute('y', MARGIN);
    outer.setAttribute('width', USABLE);
    outer.setAttribute('height', USABLE);
    outer.classList.add('canvas-border-outer');
    g.appendChild(outer);

    const inner = document.createElementNS(SVG_NS, 'rect');
    inner.setAttribute('x', MARGIN + 3);
    inner.setAttribute('y', MARGIN + 3);
    inner.setAttribute('width', USABLE - 6);
    inner.setAttribute('height', USABLE - 6);
    inner.classList.add('canvas-border-inner');
    g.appendChild(inner);

    const cornerSize = 14;
    const corners = [
        [MARGIN, MARGIN],
        [CANVAS - MARGIN, MARGIN],
        [MARGIN, CANVAS - MARGIN],
        [CANVAS - MARGIN, CANVAS - MARGIN]
    ];
    corners.forEach(([cx, cy]) => {
        const mark = document.createElementNS(SVG_NS, 'rect');
        mark.setAttribute('x', cx - cornerSize / 2);
        mark.setAttribute('y', cy - cornerSize / 2);
        mark.setAttribute('width', cornerSize);
        mark.setAttribute('height', cornerSize);
        mark.classList.add('canvas-corner');
        g.appendChild(mark);
    });

    els.layerBorder.appendChild(g);
}

export function renderObsGrid(els, settings) {
    els.layerObsGrid.innerHTML = '';
    if (!els.toggleObsGrid.checked) return;
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('stroke', 'rgba(255,255,255,0.08)');
    g.setAttribute('stroke-width', '1');
    g.setAttribute('fill', 'none');

    for (let i = 0; i <= settings.obsCols; i += 1) {
        const x = MARGIN + (i / settings.obsCols) * USABLE;
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', x);
        line.setAttribute('y1', MARGIN);
        line.setAttribute('x2', x);
        line.setAttribute('y2', CANVAS - MARGIN);
        g.appendChild(line);
    }

    for (let j = 0; j <= settings.obsRows; j += 1) {
        const y = MARGIN + (j / settings.obsRows) * USABLE;
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', MARGIN);
        line.setAttribute('y1', y);
        line.setAttribute('x2', CANVAS - MARGIN);
        line.setAttribute('y2', y);
        g.appendChild(line);
    }

    els.layerObsGrid.appendChild(g);
}

export function renderGenGrid(els, settings) {
    els.layerGenGrid.innerHTML = '';
    if (!els.toggleGenGrid.checked) return;

    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('stroke', 'rgba(179,136,255,0.2)');
    g.setAttribute('stroke-width', '1');
    g.setAttribute('stroke-dasharray', '4 4');
    g.setAttribute('fill', 'none');

    for (let i = 0; i <= settings.genCols; i += 1) {
        const x = MARGIN + (i / settings.genCols) * USABLE;
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', x);
        line.setAttribute('y1', MARGIN);
        line.setAttribute('x2', x);
        line.setAttribute('y2', CANVAS - MARGIN);
        g.appendChild(line);
    }

    for (let j = 0; j <= settings.genRows; j += 1) {
        const y = MARGIN + (j / settings.genRows) * USABLE;
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', MARGIN);
        line.setAttribute('y1', y);
        line.setAttribute('x2', CANVAS - MARGIN);
        line.setAttribute('y2', y);
        g.appendChild(line);
    }

    els.layerGenGrid.appendChild(g);
}

export function renderGridLayers(els, settings) {
    renderCanvasBorder(els);
    renderObsGrid(els, settings);
    renderGenGrid(els, settings);
}

export function renderGenDots(els, state, settings) {
    els.layerGenDots.innerHTML = '';
    if (!state.showGenDots && state.mode !== 'custom') return;
    if (state.mode === 'custom' && state.phase === 'timing') return;

    const showAll = state.showGenDots || (state.mode === 'custom' && state.phase !== 'timing');
    if (!showAll) return;

    const usedKeys = getUsedVertexKeys(state);
    const g = document.createElementNS(SVG_NS, 'g');

    state.gridPoints.forEach(pt => {
        if (state.mode === 'custom' && state.phase !== 'timing' && state.phase !== 'revealed') {
            const hit = document.createElementNS(SVG_NS, 'circle');
            hit.setAttribute('cx', pt.x);
            hit.setAttribute('cy', pt.y);
            hit.setAttribute('r', 18);
            hit.classList.add('gen-dot-hit');
            hit.setAttribute('data-col', String(pt.col));
            hit.setAttribute('data-row', String(pt.row));
            g.appendChild(hit);
        }

        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('cx', pt.x);
        circle.setAttribute('cy', pt.y);
        circle.setAttribute('r', state.mode === 'custom' ? 9 : 5);
        circle.classList.add('gen-dot');

        const key = `${pt.col},${pt.row}`;
        if (usedKeys.has(key)) {
            circle.classList.add('vertex-used');
        }
        if (state.mode === 'custom' && state.phase !== 'timing' && state.phase !== 'revealed') {
            circle.classList.add('clickable');
            circle.setAttribute('data-col', String(pt.col));
            circle.setAttribute('data-row', String(pt.row));
        }

        g.appendChild(circle);
    });

    els.layerGenDots.appendChild(g);
}

export function renderPracticeShapes(els, state, settings) {
    els.layerShapes.innerHTML = '';
    if (!state.polygons.length) return;
    if (state.mode === 'custom' && state.phase !== 'timing' && state.phase !== 'revealed') return;

    const shapeGroup = document.createElementNS(SVG_NS, 'g');
    appendPolygonsToShapeGroup(state.polygons, settings, shapeGroup, { mode: state.mode });
    els.layerShapes.appendChild(shapeGroup);
}

export function renderCustomDraftOverlay(els, state, settings) {
    els.layerCustom.innerHTML = '';
    if (state.mode !== 'custom') return;
    if (state.phase === 'timing' || state.phase === 'revealed') return;

    const hasDrafts = state.customDrafts.length > 0;
    const hasCurrent = state.customPoints.length > 0;
    if (!hasDrafts && !hasCurrent) return;

    const g = document.createElementNS(SVG_NS, 'g');
    const previewPolys = getCustomPreviewPolygons(state);
    if (previewPolys.length) {
        appendPolygonsToShapeGroup(previewPolys, settings, g, {
            useSolid: true,
            mode: 'custom',
            pointerEvents: 'none'
        });
    }

    if (hasCurrent) {
        const edgeMeta = getCustomEdgeMeta(state, settings);
        const pathD = buildShapePath(state.customPoints, edgeMeta, settings.curveStrength, false);
        if (pathD) {
            const path = document.createElementNS(SVG_NS, 'path');
            path.setAttribute('d', pathD);
            path.setAttribute('stroke', '#10b981');
            path.setAttribute('stroke-width', '2');
            path.setAttribute('stroke-dasharray', '6 4');
            path.setAttribute('fill', 'none');
            path.setAttribute('pointer-events', 'none');
            g.appendChild(path);
        }

        if (state.ghostPoint) {
            const last = state.customPoints[state.customPoints.length - 1];
            const ghost = document.createElementNS(SVG_NS, 'line');
            ghost.setAttribute('x1', last.x);
            ghost.setAttribute('y1', last.y);
            ghost.setAttribute('x2', state.ghostPoint.x);
            ghost.setAttribute('y2', state.ghostPoint.y);
            ghost.classList.add('ghost-line');
            ghost.setAttribute('pointer-events', 'none');
            g.appendChild(ghost);
        }

        state.customPoints.forEach((pt, idx) => {
            const isFirst = idx === 0;
            const canClose = state.customPoints.length >= 3 && isFirst;

            const dot = document.createElementNS(SVG_NS, 'circle');
            dot.setAttribute('cx', pt.x);
            dot.setAttribute('cy', pt.y);
            dot.setAttribute('r', canClose ? 11 : 8);
            dot.setAttribute('fill', canClose ? '#fbbf24' : '#10b981');
            dot.setAttribute('stroke', 'white');
            dot.setAttribute('stroke-width', '2');
            dot.setAttribute('pointer-events', 'none');
            g.appendChild(dot);

            const label = document.createElementNS(SVG_NS, 'text');
            label.setAttribute('x', pt.x);
            label.setAttribute('y', pt.y);
            label.classList.add('custom-vertex-label');
            label.setAttribute('pointer-events', 'none');
            label.textContent = canClose ? '①' : String(idx + 1);
            g.appendChild(label);
        });
    }

    els.layerCustom.appendChild(g);
}

export function renderScene(els, state, settings) {
    state.gridPoints = buildGridPoints(settings.genCols, settings.genRows);
    renderGridLayers(els, settings);
    renderPracticeShapes(els, state, settings);
    renderGenDots(els, state, settings);
    renderCustomDraftOverlay(els, state, settings);
    updateControls(els, state);
}
