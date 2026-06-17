import { CANVAS } from '../core/constants.js';
import { getSettings, syncSettingsInputs } from '../core/settings.js';
import { buildGridPoints } from '../core/geometry.js';
import { generatePolygonsForMode } from '../core/polygonFactory.js';
import {
    saveCurrentCustomPolygon,
    collectCustomPolygonsForPractice,
    handleCustomGridClick,
    clearLastCustom,
    invalidateCustomEdgeMeta
} from '../modes/customSession.js';
import { updateControls } from './controls.js';
import {
    renderScene,
    renderCustomDraftOverlay
} from './renderers.js';

export function bindSettingsEvents(els, state, callbacks) {
    const { render } = callbacks;

    els.curveStrength.addEventListener('input', () => {
        els.curveStrengthLabel.textContent = (els.curveStrength.value / 100).toFixed(2);
        if (state.mode === 'custom' && (state.customPoints.length > 0 || state.customDrafts.length > 0)) {
            invalidateCustomEdgeMeta(state);
        }
        if (state.phase === 'revealed'
            || (state.mode === 'custom' && (state.customPoints.length > 0 || state.customDrafts.length > 0))) {
            render();
        }
    });

    els.edgeType.addEventListener('change', () => {
        if (state.mode === 'custom' && state.customPoints.length > 0) {
            invalidateCustomEdgeMeta(state);
            render();
        }
    });

    els.timerDuration.addEventListener('change', () => {
        els.timerCustom.classList.toggle('hidden', els.timerDuration.value !== 'custom');
    });

    document.querySelectorAll('input[name="display-mode"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const hasCustomPreview = state.mode === 'custom'
                && (state.customDrafts.length > 0 || state.customPoints.length > 0);
            if (state.polygons.length || hasCustomPreview) render();
        });
    });

    ['gen-cols', 'gen-rows', 'obs-cols', 'obs-rows'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
            syncSettingsInputs(els);
            render();
        });
    });

    els.toggleObsGrid.addEventListener('change', render);
    els.toggleGenGrid.addEventListener('change', render);
}

export function bindActionEvents(els, state, callbacks) {
    const {
        handleGenerate,
        togglePause,
        revealAnswer,
        handleRegenerate,
        closeCustomPolygon,
        handleStartCustom,
        handleClearLastCustom,
        resetToIdle,
        switchMode
    } = callbacks;

    els.modeTabs.forEach(tab => {
        tab.addEventListener('click', () => switchMode(tab.dataset.mode));
    });

    els.btnGenerate.addEventListener('click', handleGenerate);
    els.btnPause.addEventListener('click', togglePause);
    els.btnReveal.addEventListener('click', revealAnswer);
    els.btnRegenerate.addEventListener('click', handleRegenerate);
    els.btnFinishPoints.addEventListener('click', closeCustomPolygon);
    els.btnStartCustom.addEventListener('click', handleStartCustom);
    els.btnClearLastCustom.addEventListener('click', handleClearLastCustom);
    els.btnClearAllCustom.addEventListener('click', resetToIdle);
}

export function bindCanvasEvents(els, state, callbacks) {
    const { handleCustomGridClickFromCanvas, getSettings } = callbacks;

    els.svg.addEventListener('click', e => {
        if (state.mode !== 'custom') return;
        const coords = getDotGridCoords(e.target);
        if (coords) {
            const pt = state.gridPoints.find(p => p.col === coords.col && p.row === coords.row);
            if (pt) handleCustomGridClickFromCanvas(pt);
            return;
        }
        const pt = findGridPointAt(els, state, e.clientX, e.clientY);
        if (pt) handleCustomGridClickFromCanvas(pt);
    });

    els.svg.addEventListener('mousemove', e => {
        if (state.mode !== 'custom' || state.customPoints.length === 0) return;
        if (state.phase === 'timing' || state.phase === 'revealed') return;

        const rect = els.svg.getBoundingClientRect();
        const scaleX = CANVAS / rect.width;
        const scaleY = CANVAS / rect.height;
        state.ghostPoint = {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
        renderCustomDraftOverlay(els, state, getSettings());
    });

    els.svg.addEventListener('mouseleave', () => {
        state.ghostPoint = null;
        if (state.mode === 'custom') renderCustomDraftOverlay(els, state, getSettings());
    });
}

export function bindKeyboardEvents(state, callbacks) {
    const { togglePause } = callbacks;

    document.addEventListener('keydown', e => {
        if (e.code !== 'Space' || e.repeat) return;
        if (state.phase !== 'timing') return;
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
        e.preventDefault();
        togglePause();
    });
}

export function bindEvents(els, state, callbacks) {
    bindSettingsEvents(els, state, callbacks);
    bindActionEvents(els, state, callbacks);
    bindCanvasEvents(els, state, callbacks);
    bindKeyboardEvents(state, callbacks);
}

function getDotGridCoords(target) {
    if (!target || !target.getAttribute) return null;
    const col = target.getAttribute('data-col');
    const row = target.getAttribute('data-row');
    if (col === null || row === null) return null;
    return { col: Number(col), row: Number(row) };
}

function findGridPointAt(els, state, clientX, clientY) {
    const rect = els.svg.getBoundingClientRect();
    const scaleX = CANVAS / rect.width;
    const scaleY = CANVAS / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    const threshold = 28;

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
