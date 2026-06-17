/**
 * Polygon Shape Practice Tool
 * Single / Composition / Custom modes with grid-based polygon generation.
 */

(function () {
    const CANVAS = 600;
    const MARGIN = 50;
    const USABLE = CANVAS - MARGIN * 2;
    const UNION_RASTER_SIZE = 512;
    const DEFAULT_TITLE = '多邊形型準練習 | Aura Timer';

    const SHAPE_COLORS = [
        { stroke: '#10b981', fill: 'rgba(16, 185, 129, 0.22)' },
        { stroke: '#34d399', fill: 'rgba(52, 211, 153, 0.2)' },
        { stroke: '#6ee7b7', fill: 'rgba(110, 231, 183, 0.18)' },
        { stroke: '#059669', fill: 'rgba(5, 150, 105, 0.22)' }
    ];

    const COMPOSITION_COLORS = [
        { stroke: '#10b981', fill: 'rgba(16, 185, 129, 0.22)' },
        { stroke: '#38bdf8', fill: 'rgba(56, 189, 248, 0.22)' },
        { stroke: '#fbbf24', fill: 'rgba(251, 191, 36, 0.22)' },
        { stroke: '#fb7185', fill: 'rgba(251, 113, 133, 0.22)' }
    ];

    const els = {
        modeTabs: document.querySelectorAll('.mode-tab'),
        modeFields: document.querySelectorAll('.mode-field'),
        genCols: document.getElementById('gen-cols'),
        genRows: document.getElementById('gen-rows'),
        obsCols: document.getElementById('obs-cols'),
        obsRows: document.getElementById('obs-rows'),
        toggleGenGrid: document.getElementById('toggle-gen-grid'),
        toggleObsGrid: document.getElementById('toggle-obs-grid'),
        vertexCount: document.getElementById('vertex-count'),
        edgeType: document.getElementById('edge-type'),
        curveStrength: document.getElementById('curve-strength'),
        curveStrengthLabel: document.getElementById('curve-strength-label'),
        shapeCount: document.getElementById('shape-count'),
        shapeCountLabel: document.querySelector('label[for="shape-count"]'),
        shapeCountHint: document.getElementById('shape-count-hint'),
        allowOverlap: document.getElementById('allow-overlap'),
        timerDuration: document.getElementById('timer-duration'),
        timerCustom: document.getElementById('timer-custom'),
        btnGenerate: document.getElementById('btn-generate'),
        btnPause: document.getElementById('btn-pause'),
        timerGroup: document.getElementById('timer-group'),
        btnFinishPoints: document.getElementById('btn-finish-points'),
        btnStartCustom: document.getElementById('btn-start-custom'),
        btnClearCustom: document.getElementById('btn-clear-custom'),
        btnReveal: document.getElementById('btn-reveal'),
        btnRegenerate: document.getElementById('btn-regenerate'),
        statusLabel: document.getElementById('status-label'),
        timerDisplay: document.getElementById('timer-display'),
        customHint: document.getElementById('custom-hint'),
        svg: document.getElementById('practice-svg'),
        layerBorder: document.getElementById('layer-border'),
        layerObsGrid: document.getElementById('layer-obs-grid'),
        layerGenGrid: document.getElementById('layer-gen-grid'),
        layerShapes: document.getElementById('layer-shapes'),
        layerGenDots: document.getElementById('layer-gen-dots'),
        layerCustom: document.getElementById('layer-custom')
    };

    const state = {
        mode: 'single',
        phase: 'idle',
        polygons: [],
        customPoints: [],
        customClosed: false,
        customEdgeMeta: null,
        showGenDots: false,
        timeLeft: 60,
        paused: false,
        timerId: null,
        endTime: null,
        ghostPoint: null,
        gridPoints: []
    };

    function clampInteger(value, min, max, fallback) {
        const n = Math.round(Number(value));
        if (!Number.isFinite(n)) return fallback;
        return Math.min(max, Math.max(min, n));
    }

    function clampNumber(value, min, max, fallback) {
        const n = Number(value);
        if (!Number.isFinite(n)) return fallback;
        return Math.min(max, Math.max(min, n));
    }

    function getSettings() {
        const timerVal = els.timerDuration.value === 'custom'
            ? clampInteger(els.timerCustom.value, 5, 600, 60)
            : clampInteger(els.timerDuration.value, 5, 600, 60);

        if (els.timerDuration.value === 'custom') {
            els.timerCustom.value = timerVal;
        }

        return {
            genCols: clampInteger(els.genCols.value, 3, 12, 6),
            genRows: clampInteger(els.genRows.value, 3, 12, 5),
            obsCols: clampInteger(els.obsCols.value, 2, 8, 3),
            obsRows: clampInteger(els.obsRows.value, 2, 8, 3),
            vertexCount: els.vertexCount.value,
            edgeType: els.edgeType.value,
            curveStrength: clampNumber(els.curveStrength.value, 5, 70, 30) / 100,
            shapeCount: clampInteger(els.shapeCount.value, 2, 4, 3),
            allowOverlap: Boolean(els.allowOverlap?.checked),
            displayMode: document.querySelector('input[name="display-mode"]:checked')?.value || 'outline',
            timerSeconds: timerVal
        };
    }

    function getShapeColors() {
        if (state.mode === 'composition') return COMPOSITION_COLORS;
        return SHAPE_COLORS;
    }

    function updateShapeCountHint() {
        if (state.mode === 'complex') {
            if (els.shapeCountLabel) els.shapeCountLabel.textContent = '由幾個形狀組合？';
            if (els.shapeCountHint) {
                els.shapeCountHint.textContent = '困難模式：多形合併填滿後取外框（輪廓或填滿）';
            }
        } else if (state.mode === 'composition') {
            if (els.shapeCountLabel) els.shapeCountLabel.textContent = '要畫幾個形狀？';
            if (els.shapeCountHint) {
                const overlap = els.allowOverlap?.checked;
                els.shapeCountHint.textContent = overlap
                    ? '構圖模式：形狀可分布於各角落並互相重疊'
                    : '構圖模式：形狀分區擺放，彼此不重疊';
            }
        } else {
            if (els.shapeCountLabel) els.shapeCountLabel.textContent = '要畫幾個形狀？';
            if (els.shapeCountHint) {
                els.shapeCountHint.textContent = '構圖模式：形狀分區擺放，彼此不重疊';
            }
        }
    }

    function syncSettingsInputs() {
        const s = getSettings();
        els.genCols.value = s.genCols;
        els.genRows.value = s.genRows;
        els.obsCols.value = s.obsCols;
        els.obsRows.value = s.obsRows;
        els.curveStrengthLabel.textContent = s.curveStrength.toFixed(2);
        els.timerCustom.classList.toggle('hidden', els.timerDuration.value !== 'custom');
    }

    function gridPointToXY(col, row, cols, rows) {
        const x = MARGIN + (col / cols) * USABLE;
        const y = MARGIN + (row / rows) * USABLE;
        return { x, y, col, row };
    }

    function buildGridPoints(cols, rows) {
        const points = [];
        for (let r = 0; r <= rows; r += 1) {
            for (let c = 0; c <= cols; c += 1) {
                points.push(gridPointToXY(c, r, cols, rows));
            }
        }
        return points;
    }

    function cross(o, a, b) {
        return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    }

    function convexHull(points) {
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

    function randomVertexCount(setting) {
        if (setting === 'random') {
            return 4 + Math.floor(Math.random() * 3);
        }
        return clampInteger(setting, 3, 8, 5);
    }

    function shuffleArray(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function sampleHullFromPoints(pool, vertexCount, maxAttempts = 40) {
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

    function buildEdgeMeta(vertexCount, edgeType) {
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

    function buildPolygonSegments(vertices, edgeMeta, closed) {
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

    function buildShapePath(vertices, edgeMeta, curveStrength, closed = true) {
        if (!vertices.length) return '';
        let d = `M ${vertices[0].x.toFixed(2)} ${vertices[0].y.toFixed(2)}`;
        const segments = buildPolygonSegments(vertices, edgeMeta, closed);
        segments.forEach(seg => {
            d += ` ${segmentToPathPart(seg.p1, seg.p2, seg.meta, curveStrength)}`;
        });
        if (closed) d += ' Z';
        return d;
    }

    function createPolygon(vertices, settings, edgeMeta = null) {
        return {
            vertices,
            edgeMeta: edgeMeta || buildEdgeMeta(vertices.length, settings.edgeType)
        };
    }

    function getPolygonDisplayColor(idx, colors) {
        if (state.mode === 'complex') return colors[0];
        return colors[idx % colors.length];
    }

    function filterPointsInZone(points, zone, cols, rows) {
        const colMin = Math.max(0, Math.floor(zone.colMin));
        const colMax = Math.min(cols, Math.ceil(zone.colMax));
        const rowMin = Math.max(0, Math.floor(zone.rowMin));
        const rowMax = Math.min(rows, Math.ceil(zone.rowMax));
        return points.filter(p => p.col >= colMin && p.col <= colMax && p.row >= rowMin && p.row <= rowMax);
    }

    function getCompositionZones(count, cols, rows, allowOverlap) {
        const c = cols;
        const r = rows;

        if (!allowOverlap) {
            if (count === 2) {
                const midC = Math.max(1, Math.floor(c / 2));
                return [
                    { colMin: 0, colMax: midC, rowMin: 0, rowMax: r },
                    { colMin: midC, colMax: c, rowMin: 0, rowMax: r }
                ];
            }
            if (count === 4) {
                const midC = Math.max(1, Math.floor(c / 2));
                const midR = Math.max(1, Math.floor(r / 2));
                return [
                    { colMin: 0, colMax: midC, rowMin: 0, rowMax: midR },
                    { colMin: midC, colMax: c, rowMin: 0, rowMax: midR },
                    { colMin: 0, colMax: midC, rowMin: midR, rowMax: r },
                    { colMin: midC, colMax: c, rowMin: midR, rowMax: r }
                ];
            }
            const zones = [];
            for (let i = 0; i < count; i += 1) {
                const colStart = Math.floor((i * (c + 1)) / count);
                const colEnd = Math.floor(((i + 1) * (c + 1)) / count) - 1;
                zones.push({ colMin: colStart, colMax: colEnd, rowMin: 0, rowMax: r });
            }
            return zones;
        }

        const pad = Math.max(1, Math.floor(Math.min(c, r) * 0.32));
        const overlapZones = {
            2: [
                { colMin: 0, colMax: c - pad, rowMin: 0, rowMax: r - pad },
                { colMin: pad, colMax: c, rowMin: pad, rowMax: r }
            ],
            3: [
                { colMin: 0, colMax: c - pad, rowMin: 0, rowMax: r - pad },
                { colMin: pad, colMax: c, rowMin: 0, rowMax: r - pad },
                { colMin: 0, colMax: c, rowMin: pad, rowMax: r }
            ],
            4: [
                { colMin: 0, colMax: c - pad, rowMin: 0, rowMax: r - pad },
                { colMin: pad, colMax: c, rowMin: 0, rowMax: r - pad },
                { colMin: 0, colMax: c - pad, rowMin: pad, rowMax: r },
                { colMin: pad, colMax: c, rowMin: pad, rowMax: r }
            ]
        };
        return shuffleArray(overlapZones[count] || overlapZones[3]);
    }

    function dedupeNearbyVertices(vertices, minDist) {
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

    function contourToVertices(contour, settings, rasterSize) {
        const scale = CANVAS / rasterSize;
        const raw = contour.map(p => ({
            x: p.x * scale,
            y: p.y * scale
        }));
        const simplified = dedupeNearbyVertices(raw, 4);
        return simplified.length >= 3 ? simplified : raw;
    }

    function buildUnionSilhouette(parts, settings) {
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
        const vertices = contourToVertices(simplified, settings, size);
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

    function getPolygonPathD(poly, curveStrength) {
        return buildShapePath(poly.vertices, poly.edgeMeta, curveStrength, true);
    }

    function getPolygonVertexSources(poly) {
        if (poly.sourceParts && poly.sourceParts.length) return poly.sourceParts;
        return [poly];
    }

    function invalidateCustomEdgeMeta() {
        state.customEdgeMeta = null;
    }

    function getCustomEdgeMeta(settings) {
        const count = Math.max(state.customPoints.length, 1);
        if (!state.customEdgeMeta || state.customEdgeMeta.length !== count) {
            state.customEdgeMeta = buildEdgeMeta(count, settings.edgeType);
        }
        return state.customEdgeMeta;
    }

    function isGridLocked() {
        return state.phase === 'timing'
            || state.phase === 'revealed'
            || (state.mode === 'custom' && state.customPoints.length > 0);
    }

    function updateTimerTitle() {
        const prefix = state.paused ? '(暫停) ' : '';
        document.title = `(${prefix}${formatTime(state.timeLeft)}) 作畫中 | ${DEFAULT_TITLE}`;
    }

    function tickTimer() {
        if (state.paused) return;

        state.timeLeft = Math.max(0, (state.endTime - Date.now()) / 1000);
        els.timerDisplay.textContent = formatTime(state.timeLeft);
        updateTimerTitle();

        if (state.timeLeft <= 0) {
            revealAnswer();
        }
    }

    function pausePractice() {
        if (state.phase !== 'timing' || state.paused) return;

        state.paused = true;
        state.timeLeft = Math.max(0, (state.endTime - Date.now()) / 1000);
        clearTimer();
        setStatus('已暫停 — 按「繼續」恢復計時');
        els.btnPause.textContent = '繼續';
        els.btnPause.setAttribute('aria-label', '繼續計時');
        els.timerDisplay.classList.add('paused');
        updateTimerTitle();
        updateControls();
    }

    function resumePractice() {
        if (state.phase !== 'timing' || !state.paused) return;

        state.paused = false;
        state.endTime = Date.now() + state.timeLeft * 1000;
        setStatus('作畫中 — 複製形狀');
        els.btnPause.textContent = '暫停';
        els.btnPause.setAttribute('aria-label', '暫停計時');
        els.timerDisplay.classList.remove('paused');
        updateTimerTitle();

        state.timerId = setInterval(tickTimer, 100);
        updateControls();
    }

    function togglePause() {
        if (state.paused) {
            resumePractice();
        } else {
            pausePractice();
        }
    }

    function generateSinglePolygon(settings) {
        const pool = buildGridPoints(settings.genCols, settings.genRows);
        const k = randomVertexCount(settings.vertexCount);
        const hull = sampleHullFromPoints(pool, k);
        if (!hull) return [];
        return [createPolygon(hull, settings)];
    }

    function generateCompositionPolygons(settings, forceOverlap = null) {
        const allPoints = buildGridPoints(settings.genCols, settings.genRows);
        const polygons = [];
        const count = settings.shapeCount;
        const k = randomVertexCount(settings.vertexCount);
        const allowOverlap = forceOverlap !== null ? forceOverlap : settings.allowOverlap;
        const zones = getCompositionZones(count, settings.genCols, settings.genRows, allowOverlap);

        for (let i = 0; i < count; i += 1) {
            const zone = zones[i % zones.length];
            const pool = filterPointsInZone(allPoints, zone, settings.genCols, settings.genRows);
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

    function generateComplexPolygons(settings) {
        const parts = generateCompositionPolygons(settings, true);
        const silhouette = buildUnionSilhouette(parts, settings);

        if (silhouette) {
            return [silhouette];
        }

        return parts.length ? parts : generateSinglePolygon(settings);
    }

    function clearTimer() {
        if (state.timerId) {
            clearInterval(state.timerId);
            state.timerId = null;
        }
    }

    function formatTime(seconds) {
        const s = Math.max(0, Math.ceil(seconds));
        const m = Math.floor(s / 60);
        const r = s % 60;
        return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
    }

    function setStatus(text) {
        els.statusLabel.textContent = text;
    }

    function updateControls() {
        const isCustom = state.mode === 'custom';
        const isTiming = state.phase === 'timing';
        const isRevealed = state.phase === 'revealed';
        const isCustomEdit = state.mode === 'custom' && (state.phase === 'idle' || state.phase === 'custom-edit');

        els.btnGenerate.disabled = isTiming;
        els.btnReveal.disabled = state.phase !== 'timing';
        els.btnRegenerate.disabled = state.phase === 'idle' && !isCustomEdit;

        const showTimer = state.phase === 'timing';
        els.timerGroup.classList.toggle('hidden', !showTimer);
        els.btnPause.disabled = !showTimer;
        if (!showTimer) {
            els.btnPause.textContent = '暫停';
            els.btnPause.setAttribute('aria-label', '暫停計時');
            els.timerDisplay.classList.remove('paused');
        }

        els.btnFinishPoints.disabled = !isCustomEdit || state.customPoints.length < 3 || state.customClosed;
        els.btnStartCustom.disabled = !isCustomEdit || state.customPoints.length < 3 || !state.customClosed;
        els.btnClearCustom.disabled = !isCustomEdit || state.customPoints.length === 0;

        els.customHint.classList.toggle('hidden', !isCustom);

        const gridLocked = isGridLocked();
        els.genCols.disabled = gridLocked;
        els.genRows.disabled = gridLocked;
        els.obsCols.disabled = gridLocked;
        els.obsRows.disabled = gridLocked;

        if (state.phase === 'timing') {
            els.btnRegenerate.textContent = isCustom ? '重新選點' : '重新生成';
            els.btnRegenerate.disabled = false;
        } else if (isRevealed) {
            els.btnRegenerate.textContent = isCustom ? '重新選點' : '重新生成';
            els.btnRegenerate.disabled = false;
        } else if (isCustomEdit) {
            els.btnRegenerate.textContent = '重新選點';
            els.btnRegenerate.disabled = state.customPoints.length === 0;
        } else {
            els.btnRegenerate.textContent = '重新生成';
            els.btnRegenerate.disabled = true;
        }
    }

    function renderCanvasBorder() {
        els.layerBorder.innerHTML = '';
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.classList.add('canvas-border');

        const outer = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        outer.setAttribute('x', MARGIN);
        outer.setAttribute('y', MARGIN);
        outer.setAttribute('width', USABLE);
        outer.setAttribute('height', USABLE);
        outer.classList.add('canvas-border-outer');
        g.appendChild(outer);

        const inner = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
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
            const mark = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            mark.setAttribute('x', cx - cornerSize / 2);
            mark.setAttribute('y', cy - cornerSize / 2);
            mark.setAttribute('width', cornerSize);
            mark.setAttribute('height', cornerSize);
            mark.classList.add('canvas-corner');
            g.appendChild(mark);
        });

        els.layerBorder.appendChild(g);
    }

    function renderObsGrid(settings) {
        els.layerObsGrid.innerHTML = '';
        if (!els.toggleObsGrid.checked) return;
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('stroke', 'rgba(255,255,255,0.08)');
        g.setAttribute('stroke-width', '1');
        g.setAttribute('fill', 'none');

        for (let i = 0; i <= settings.obsCols; i += 1) {
            const x = MARGIN + (i / settings.obsCols) * USABLE;
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x);
            line.setAttribute('y1', MARGIN);
            line.setAttribute('x2', x);
            line.setAttribute('y2', CANVAS - MARGIN);
            g.appendChild(line);
        }

        for (let j = 0; j <= settings.obsRows; j += 1) {
            const y = MARGIN + (j / settings.obsRows) * USABLE;
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', MARGIN);
            line.setAttribute('y1', y);
            line.setAttribute('x2', CANVAS - MARGIN);
            line.setAttribute('y2', y);
            g.appendChild(line);
        }

        els.layerObsGrid.appendChild(g);
    }

    function renderGenGrid(settings) {
        els.layerGenGrid.innerHTML = '';
        if (!els.toggleGenGrid.checked) return;

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('stroke', 'rgba(179,136,255,0.2)');
        g.setAttribute('stroke-width', '1');
        g.setAttribute('stroke-dasharray', '4 4');
        g.setAttribute('fill', 'none');

        for (let i = 0; i <= settings.genCols; i += 1) {
            const x = MARGIN + (i / settings.genCols) * USABLE;
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x);
            line.setAttribute('y1', MARGIN);
            line.setAttribute('x2', x);
            line.setAttribute('y2', CANVAS - MARGIN);
            g.appendChild(line);
        }

        for (let j = 0; j <= settings.genRows; j += 1) {
            const y = MARGIN + (j / settings.genRows) * USABLE;
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', MARGIN);
            line.setAttribute('y1', y);
            line.setAttribute('x2', CANVAS - MARGIN);
            line.setAttribute('y2', y);
            g.appendChild(line);
        }

        els.layerGenGrid.appendChild(g);
    }

    function getUsedVertexKeys() {
        const keys = new Set();
        state.polygons.forEach(poly => {
            getPolygonVertexSources(poly).forEach(part => {
                part.vertices.forEach(v => keys.add(`${v.col},${v.row}`));
            });
        });
        if (state.mode === 'custom' && state.customPoints.length > 0) {
            state.customPoints.forEach(pt => keys.add(`${pt.col},${pt.row}`));
        }
        return keys;
    }

    function renderGenDots(settings) {
        els.layerGenDots.innerHTML = '';
        if (!state.showGenDots && state.mode !== 'custom') return;
        if (state.mode === 'custom' && state.phase === 'timing') return;

        const showAll = state.showGenDots || (state.mode === 'custom' && state.phase !== 'timing');
        if (!showAll) return;

        const usedKeys = getUsedVertexKeys();
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

        state.gridPoints.forEach(pt => {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', pt.x);
            circle.setAttribute('cy', pt.y);
            circle.setAttribute('r', state.mode === 'custom' ? 7 : 5);
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

    function renderShapes(settings) {
        els.layerShapes.innerHTML = '';
        if (!state.polygons.length) return;
        if (state.mode === 'custom' && state.phase !== 'timing' && state.phase !== 'revealed') return;

        const displayMode = settings.displayMode;
        const colors = getShapeColors();
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

        if (displayMode === 'invert') {
            const combined = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            let d = `M 0 0 H ${CANVAS} V ${CANVAS} H 0 Z`;
            state.polygons.forEach(poly => {
                d += ` ${getPolygonPathD(poly, settings.curveStrength)}`;
            });
            combined.setAttribute('d', d);
            combined.setAttribute('fill', 'rgba(16, 185, 129, 0.35)');
            combined.setAttribute('fill-rule', 'evenodd');
            combined.setAttribute('stroke', 'none');
            g.appendChild(combined);

            state.polygons.forEach((poly, idx) => {
                const outline = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                outline.setAttribute('d', getPolygonPathD(poly, settings.curveStrength));
                outline.setAttribute('fill', 'none');
                outline.setAttribute('stroke', getPolygonDisplayColor(idx, colors).stroke);
                outline.setAttribute('stroke-width', '2');
                g.appendChild(outline);
            });
        } else {
            state.polygons.forEach((poly, idx) => {
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                const shapeColors = getPolygonDisplayColor(idx, colors);
                path.setAttribute('d', getPolygonPathD(poly, settings.curveStrength));
                path.setAttribute('stroke', shapeColors.stroke);
                path.setAttribute('stroke-width', '2.5');
                path.setAttribute('fill', displayMode === 'fill' ? shapeColors.fill : 'none');
                g.appendChild(path);
            });
        }

        els.layerShapes.appendChild(g);
    }

    function renderCustomLayer(settings) {
        els.layerCustom.innerHTML = '';
        if (state.mode !== 'custom' || state.customPoints.length === 0) return;
        if (state.phase === 'timing' || state.phase === 'revealed') return;

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const edgeMeta = getCustomEdgeMeta(settings);
        const closed = state.customClosed;
        const pathD = buildShapePath(state.customPoints, edgeMeta, settings.curveStrength, closed);

        if (pathD) {
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', pathD);
            path.setAttribute('stroke', '#10b981');
            path.setAttribute('stroke-width', '2');
            path.setAttribute('fill', closed ? 'rgba(16, 185, 129, 0.12)' : 'none');
            g.appendChild(path);
        }

        if (!closed && state.customPoints.length > 0 && state.ghostPoint) {
            const last = state.customPoints[state.customPoints.length - 1];
            const ghost = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            ghost.setAttribute('x1', last.x);
            ghost.setAttribute('y1', last.y);
            ghost.setAttribute('x2', state.ghostPoint.x);
            ghost.setAttribute('y2', state.ghostPoint.y);
            ghost.classList.add('ghost-line');
            g.appendChild(ghost);
        }

        state.customPoints.forEach((pt, idx) => {
            const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            dot.setAttribute('cx', pt.x);
            dot.setAttribute('cy', pt.y);
            dot.setAttribute('r', 8);
            dot.setAttribute('fill', '#10b981');
            dot.setAttribute('stroke', 'white');
            dot.setAttribute('stroke-width', '2');
            g.appendChild(dot);

            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', pt.x);
            label.setAttribute('y', pt.y);
            label.classList.add('custom-vertex-label');
            label.textContent = String(idx + 1);
            g.appendChild(label);
        });

        els.layerCustom.appendChild(g);
    }

    function render() {
        const settings = getSettings();
        state.gridPoints = buildGridPoints(settings.genCols, settings.genRows);
        renderCanvasBorder();
        renderObsGrid(settings);
        renderGenGrid(settings);
        renderShapes(settings);
        renderGenDots(settings);
        renderCustomLayer(settings);
        updateControls();
    }

    function startPractice(polygons) {
        const settings = getSettings();
        clearTimer();
        state.polygons = polygons;
        state.showGenDots = false;
        state.phase = 'timing';
        state.paused = false;
        state.timeLeft = settings.timerSeconds;
        state.endTime = Date.now() + state.timeLeft * 1000;

        setStatus('作畫中 — 複製形狀');
        els.timerDisplay.textContent = formatTime(state.timeLeft);
        els.timerDisplay.classList.remove('paused');
        els.btnPause.textContent = '暫停';
        updateTimerTitle();

        state.timerId = setInterval(tickTimer, 100);

        render();
    }

    function revealAnswer() {
        clearTimer();
        state.phase = 'revealed';
        state.paused = false;
        state.showGenDots = true;
        setStatus('對答案 — 基準點已顯示（可用開關顯示格子線）');
        document.title = `對答案 | ${DEFAULT_TITLE}`;
        render();
    }

    function resetToIdle() {
        clearTimer();
        state.phase = state.mode === 'custom' ? 'custom-edit' : 'idle';
        state.paused = false;
        state.polygons = [];
        state.customPoints = [];
        state.customClosed = false;
        state.customEdgeMeta = null;
        state.showGenDots = state.mode === 'custom';
        state.ghostPoint = null;
        setStatus(state.mode === 'custom' ? '自訂模式 — 點選格子交叉點' : '準備就緒');
        document.title = DEFAULT_TITLE;
        render();
    }

    function generatePolygonsForMode(settings) {
        if (state.mode === 'composition') return generateCompositionPolygons(settings);
        if (state.mode === 'complex') return generateComplexPolygons(settings);
        return generateSinglePolygon(settings);
    }

    function handleGenerate() {
        syncSettingsInputs();
        const settings = getSettings();
        state.gridPoints = buildGridPoints(settings.genCols, settings.genRows);

        const polygons = generatePolygonsForMode(settings);

        if (!polygons.length) {
            alert('無法生成有效多邊形，請調整格子或頂點設定後重試。');
            return;
        }

        startPractice(polygons);
    }

    function handleRegenerate() {
        if (state.mode === 'custom') {
            resetToIdle();
            return;
        }
        handleGenerate();
    }

    function pointKey(pt) {
        return `${pt.col},${pt.row}`;
    }

    function findGridPointAt(clientX, clientY) {
        const rect = els.svg.getBoundingClientRect();
        const scaleX = CANVAS / rect.width;
        const scaleY = CANVAS / rect.height;
        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;
        const threshold = 20;

        let best = null;
        let bestDist = threshold;

        state.gridPoints.forEach(pt => {
            const d = Math.hypot(pt.x - x, pt.y - y);
            if (d < bestDist) {
                bestDist = d;
                best = pt;
            }
        });

        return best;
    }

    function closeCustomPolygon() {
        if (state.customPoints.length < 3) return;
        state.customClosed = true;
        state.ghostPoint = null;
        setStatus('多邊形已閉合 — 可按「開始練習」');
        render();
    }

    function handleCustomGridClick(pt) {
        if (state.mode !== 'custom' || state.phase === 'timing' || state.phase === 'revealed') return;
        if (state.customClosed) return;

        const key = pointKey(pt);
        const selectedKeys = state.customPoints.map(pointKey);

        if (selectedKeys.length >= 3 && pointKey(state.customPoints[0]) === key) {
            closeCustomPolygon();
            return;
        }

        if (selectedKeys.length > 0 && pointKey(state.customPoints[state.customPoints.length - 1]) === key) {
            state.customPoints.pop();
            invalidateCustomEdgeMeta();
            setStatus(state.customPoints.length ? `已撤銷 — 目前 ${state.customPoints.length} 個頂點` : '自訂模式 — 點選格子交叉點');
            render();
            return;
        }

        if (selectedKeys.includes(key)) return;

        state.customPoints.push({ ...pt });
        invalidateCustomEdgeMeta();
        state.phase = 'custom-edit';
        setStatus(`已選 ${state.customPoints.length} 個頂點`);
        render();
    }

    function handleStartCustom() {
        if (!state.customClosed || state.customPoints.length < 3) return;
        const settings = getSettings();
        state.polygons = [createPolygon([...state.customPoints], settings, getCustomEdgeMeta(settings))];
        els.layerCustom.innerHTML = '';
        startPractice(state.polygons);
    }

    function switchMode(mode) {
        if (mode === state.mode) return;

        const hasActiveSession = state.phase === 'timing'
            || state.phase === 'revealed'
            || state.customPoints.length > 0
            || state.polygons.length > 0;

        if (hasActiveSession && !window.confirm('切換模式將會重設目前練習，確定嗎？')) {
            return;
        }

        if (state.phase === 'timing') {
            clearTimer();
        }
        state.mode = mode;
        updateShapeCountHint();
        els.modeTabs.forEach(tab => {
            const active = tab.dataset.mode === mode;
            tab.classList.toggle('active', active);
            tab.setAttribute('aria-selected', String(active));
        });

        els.modeFields.forEach(field => {
            const modes = (field.dataset.modes || '').split(',');
            field.classList.toggle('hidden', !modes.includes(mode));
        });

        resetToIdle();
    }

    function getDotGridCoords(target) {
        if (!target || !target.getAttribute) return null;
        const col = target.getAttribute('data-col');
        const row = target.getAttribute('data-row');
        if (col === null || row === null) return null;
        return { col: Number(col), row: Number(row) };
    }

    function bindEvents() {
        els.modeTabs.forEach(tab => {
            tab.addEventListener('click', () => switchMode(tab.dataset.mode));
        });

        els.curveStrength.addEventListener('input', () => {
            els.curveStrengthLabel.textContent = (els.curveStrength.value / 100).toFixed(2);
            if (state.mode === 'custom' && state.customPoints.length > 0) {
                invalidateCustomEdgeMeta();
            }
            if (state.phase === 'revealed' || (state.mode === 'custom' && state.customPoints.length > 0)) {
                render();
            }
        });

        els.edgeType.addEventListener('change', () => {
            if (state.mode === 'custom' && state.customPoints.length > 0) {
                invalidateCustomEdgeMeta();
                render();
            }
        });

        els.timerDuration.addEventListener('change', () => {
            els.timerCustom.classList.toggle('hidden', els.timerDuration.value !== 'custom');
        });

        if (els.allowOverlap) {
            els.allowOverlap.addEventListener('change', updateShapeCountHint);
        }

        document.querySelectorAll('input[name="display-mode"]').forEach(radio => {
            radio.addEventListener('change', () => {
                if (state.polygons.length) render();
            });
        });

        ['gen-cols', 'gen-rows', 'obs-cols', 'obs-rows'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => {
                syncSettingsInputs();
                render();
            });
        });

        els.toggleObsGrid.addEventListener('change', render);
        els.toggleGenGrid.addEventListener('change', render);

        els.btnGenerate.addEventListener('click', handleGenerate);
        els.btnPause.addEventListener('click', togglePause);
        els.btnReveal.addEventListener('click', revealAnswer);
        els.btnRegenerate.addEventListener('click', handleRegenerate);
        els.btnFinishPoints.addEventListener('click', closeCustomPolygon);
        els.btnStartCustom.addEventListener('click', handleStartCustom);
        els.btnClearCustom.addEventListener('click', resetToIdle);

        els.svg.addEventListener('click', e => {
            if (state.mode !== 'custom') return;
            const coords = getDotGridCoords(e.target);
            if (coords) {
                const pt = state.gridPoints.find(p => p.col === coords.col && p.row === coords.row);
                if (pt) handleCustomGridClick(pt);
                return;
            }
            const pt = findGridPointAt(e.clientX, e.clientY);
            if (pt) handleCustomGridClick(pt);
        });

        els.svg.addEventListener('mousemove', e => {
            if (state.mode !== 'custom' || state.customClosed || state.customPoints.length === 0) return;
            if (state.phase === 'timing' || state.phase === 'revealed') return;

            const rect = els.svg.getBoundingClientRect();
            const scaleX = CANVAS / rect.width;
            const scaleY = CANVAS / rect.height;
            state.ghostPoint = {
                x: (e.clientX - rect.left) * scaleX,
                y: (e.clientY - rect.top) * scaleY
            };
            renderCustomLayer(getSettings());
        });

        els.svg.addEventListener('mouseleave', () => {
            state.ghostPoint = null;
            if (state.mode === 'custom') renderCustomLayer(getSettings());
        });

        document.addEventListener('keydown', e => {
            if (e.code !== 'Space' || e.repeat) return;
            if (state.phase !== 'timing') return;
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
            e.preventDefault();
            togglePause();
        });
    }

    function init() {
        syncSettingsInputs();
        bindEvents();
        updateShapeCountHint();
        switchMode('single');
    }

    init();
})();
