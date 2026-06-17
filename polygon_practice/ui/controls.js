import { isGridLocked } from '../modes/customSession.js';

export function computeUiFlags(state) {
    const isCustom = state.mode === 'custom';
    const isTiming = state.phase === 'timing';
    const isRevealed = state.phase === 'revealed';
    const isCustomEdit = isCustom && (state.phase === 'idle' || state.phase === 'custom-edit');
    const canStartCustom = isCustomEdit && state.customDrafts.length > 0;
    const canClearCustom = isCustomEdit && (state.customPoints.length > 0 || state.customDrafts.length > 0);
    const gridLocked = isGridLocked(state);

    let regenerateText = '重新生成';
    let regenerateDisabled = true;

    if (state.phase === 'timing') {
        regenerateText = isCustom ? '重新選點' : '重新生成';
        regenerateDisabled = false;
    } else if (isRevealed) {
        regenerateText = isCustom ? '重新選點' : '重新生成';
        regenerateDisabled = false;
    } else if (isCustomEdit) {
        regenerateText = '重新選點';
        regenerateDisabled = state.customPoints.length === 0 && state.customDrafts.length === 0;
    }

    return {
        btnGenerateDisabled: isTiming,
        btnRevealDisabled: state.phase !== 'timing',
        btnRegenerateDisabled: state.phase === 'idle' && !isCustomEdit ? true : regenerateDisabled,
        regenerateText,
        showTimer: isTiming,
        btnPauseDisabled: !isTiming,
        resetPauseUi: !isTiming,
        btnFinishPointsDisabled: !isCustomEdit || state.customPoints.length < 3,
        btnStartCustomDisabled: !canStartCustom,
        btnClearLastCustomDisabled: !canClearCustom,
        btnClearAllCustomDisabled: !canClearCustom,
        showCustomHint: isCustom,
        gridLocked
    };
}

export function applyUiFlags(els, flags) {
    els.btnGenerate.disabled = flags.btnGenerateDisabled;
    els.btnReveal.disabled = flags.btnRevealDisabled;
    els.btnRegenerate.disabled = flags.btnRegenerateDisabled;
    els.btnRegenerate.textContent = flags.regenerateText;

    els.timerGroup.classList.toggle('hidden', !flags.showTimer);
    els.btnPause.disabled = flags.btnPauseDisabled;

    if (flags.resetPauseUi) {
        els.btnPause.textContent = '暫停';
        els.btnPause.setAttribute('aria-label', '暫停計時');
        els.timerDisplay.classList.remove('paused');
    }

    els.btnFinishPoints.disabled = flags.btnFinishPointsDisabled;
    els.btnStartCustom.disabled = flags.btnStartCustomDisabled;
    els.btnClearLastCustom.disabled = flags.btnClearLastCustomDisabled;
    els.btnClearAllCustom.disabled = flags.btnClearAllCustomDisabled;
    els.customHint.classList.toggle('hidden', !flags.showCustomHint);

    els.genCols.disabled = flags.gridLocked;
    els.genRows.disabled = flags.gridLocked;
    els.obsCols.disabled = flags.gridLocked;
    els.obsRows.disabled = flags.gridLocked;
}

export function updateControls(els, state) {
    applyUiFlags(els, computeUiFlags(state));
}
