export function clampInteger(value, min, max, fallback) {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
}

export function clampNumber(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
}

export function getSettings(els) {
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
        displayMode: document.querySelector('input[name="display-mode"]:checked')?.value || 'outline',
        timerSeconds: timerVal
    };
}

export function syncSettingsInputs(els) {
    const s = getSettings(els);
    els.genCols.value = s.genCols;
    els.genRows.value = s.genRows;
    els.obsCols.value = s.obsCols;
    els.obsRows.value = s.obsRows;
    els.curveStrengthLabel.textContent = s.curveStrength.toFixed(2);
    els.timerCustom.classList.toggle('hidden', els.timerDuration.value !== 'custom');
}
