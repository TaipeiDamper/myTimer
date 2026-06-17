/**
 * Polygon Shape Practice Tool — application orchestrator.
 * Single / Complex / Custom modes with grid-based polygon generation.
 */

import { DEFAULT_TITLE } from './core/constants.js';
import { getSettings, syncSettingsInputs } from './core/settings.js';
import { buildGridPoints } from './core/geometry.js';
import { generatePolygonsForMode } from './core/polygonFactory.js';
import {
    saveCurrentCustomPolygon,
    collectCustomPolygonsForPractice,
    handleCustomGridClick,
    clearLastCustom
} from './modes/customSession.js';
import { updateControls } from './ui/controls.js';
import { renderScene } from './ui/renderers.js';
import { bindEvents } from './ui/events.js';

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
    shapeCountHint: document.getElementById('shape-count-hint'),
    timerDuration: document.getElementById('timer-duration'),
    timerCustom: document.getElementById('timer-custom'),
    btnGenerate: document.getElementById('btn-generate'),
    btnPause: document.getElementById('btn-pause'),
    timerGroup: document.getElementById('timer-group'),
    btnFinishPoints: document.getElementById('btn-finish-points'),
    btnStartCustom: document.getElementById('btn-start-custom'),
    btnClearLastCustom: document.getElementById('btn-clear-last-custom'),
    btnClearAllCustom: document.getElementById('btn-clear-all-custom'),
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
    customDrafts: [],
    customEdgeMeta: null,
    showGenDots: false,
    timeLeft: 60,
    paused: false,
    timerId: null,
    endTime: null,
    ghostPoint: null,
    gridPoints: []
};

function setStatus(text) {
    els.statusLabel.textContent = text;
}

function formatTime(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

function clearTimer() {
    if (state.timerId) {
        clearInterval(state.timerId);
        state.timerId = null;
    }
}

function updateTimerTitle() {
    const prefix = state.paused ? '(暫停) ' : '';
    document.title = `(${prefix}${formatTime(state.timeLeft)}) 作畫中 | ${DEFAULT_TITLE}`;
}

function render() {
    renderScene(els, state, getSettings(els));
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
    updateControls(els, state);
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
    updateControls(els, state);
}

function togglePause() {
    if (state.paused) {
        resumePractice();
    } else {
        pausePractice();
    }
}

function startPractice(polygons) {
    const settings = getSettings(els);
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
    state.customDrafts = [];
    state.customEdgeMeta = null;
    state.showGenDots = state.mode === 'custom';
    state.ghostPoint = null;
    setStatus(state.mode === 'custom' ? '自訂模式 — 點選格子交叉點' : '準備就緒');
    document.title = DEFAULT_TITLE;
    render();
}

function handleGenerate() {
    syncSettingsInputs(els);
    const settings = getSettings(els);
    state.gridPoints = buildGridPoints(settings.genCols, settings.genRows);

    const polygons = generatePolygonsForMode(state.mode, settings);

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

function closeCustomPolygon() {
    if (!saveCurrentCustomPolygon(state, getSettings(els))) return;
    setStatus(`第 ${state.customDrafts.length} 個多邊形已完成 — 繼續選點或按「開始練習」`);
    render();
}

function handleCustomGridClickFromCanvas(pt) {
    if (state.mode !== 'custom' || state.phase === 'timing' || state.phase === 'revealed') return;

    const result = handleCustomGridClick(state, pt);

    if (result.type === 'close') {
        closeCustomPolygon();
        return;
    }
    if (result.type === 'noop') return;

    if (result.type === 'add') {
        state.phase = 'custom-edit';
    }
    if (result.status) {
        setStatus(result.status);
    }
    render();
}

function handleClearLastCustom() {
    const status = clearLastCustom(state);
    if (status) setStatus(status);
    render();
}

function handleStartCustom() {
    const polygons = collectCustomPolygonsForPractice(state);
    if (!polygons.length) return;
    els.layerCustom.innerHTML = '';
    startPractice(polygons);
}

function switchMode(mode) {
    if (mode === state.mode) return;

    const hasActiveSession = state.phase === 'timing'
        || state.phase === 'revealed'
        || state.customPoints.length > 0
        || state.customDrafts.length > 0
        || state.polygons.length > 0;

    if (hasActiveSession && !window.confirm('切換模式將會重設目前練習，確定嗎？')) {
        return;
    }

    if (state.phase === 'timing') {
        clearTimer();
    }
    state.mode = mode;
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

function init() {
    syncSettingsInputs(els);

    const callbacks = {
        render,
        getSettings: () => getSettings(els),
        handleGenerate,
        togglePause,
        revealAnswer,
        handleRegenerate,
        closeCustomPolygon,
        handleStartCustom,
        handleClearLastCustom,
        resetToIdle,
        switchMode,
        handleCustomGridClickFromCanvas
    };

    bindEvents(els, state, callbacks);
    switchMode('single');
}

init();
