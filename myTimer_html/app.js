/**
 * Aura Timer - 多功能計時器邏輯
 * 包含番茄鐘、速寫練習、碼表、音效與導覽保護。
 */

document.addEventListener('DOMContentLoaded', () => {
    const DEFAULT_TITLE = '極致多功能計時器 | 專注、速寫與精準';
    const DEFAULT_SKETCH_TAG_PRESETS = ['figure', 'gesture', 'city', 'photography', 'composition', 'portrait', 'pose', 'anatomy'];
    const SKETCH_TAG_PRESETS_STORAGE_KEY = 'auraTimerSketchTagPresets';

    const sections = {
        dashboard: document.getElementById('dashboard-section'),
        pomodoro: document.getElementById('pomodoro-section'),
        sketching: document.getElementById('sketching-section'),
        stopwatch: document.getElementById('stopwatch-section')
    };

    const goPomodoroBtn = document.getElementById('go-pomodoro-btn');
    const goSketchingBtn = document.getElementById('go-sketching-btn');
    const goStopwatchBtn = document.getElementById('go-stopwatch-btn');
    const backBtns = {
        pomodoro: document.getElementById('pomodoro-back'),
        sketching: document.getElementById('sketching-back'),
        stopwatch: document.getElementById('stopwatch-back')
    };

    const soundToggleBtn = document.getElementById('sound-toggle-btn');
    const soundOnIcon = soundToggleBtn.querySelector('.sound-on-icon');
    const soundOffIcon = soundToggleBtn.querySelector('.sound-off-icon');
    const volumeSlider = document.getElementById('volume-slider');

    const confirmModal = document.getElementById('confirm-modal');
    const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
    const confirmOkBtn = document.getElementById('confirm-ok-btn');

    let audioCtx = null;
    let globalVolume = 0.5;
    let preMutedVolume = 0.5;
    let isSoundMuted = false;
    let pendingNavTarget = null;
    let lastFocusedElement = null;

    function clampNumber(value, min, max, fallback) {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) return fallback;
        return Math.min(max, Math.max(min, numericValue));
    }

    function clampInteger(value, min, max, fallback) {
        return Math.round(clampNumber(value, min, max, fallback));
    }

    function initAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    function playTone(freq, duration, type = 'sine') {
        if (isSoundMuted || globalVolume === 0) return;

        try {
            initAudio();
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }

            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.4 * globalVolume, audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + duration);
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + duration);
        } catch (err) {
            console.error('音效播放失敗:', err);
        }
    }

    const sounds = {
        click: () => playTone(600, 0.1),
        tick: () => playTone(900, 0.06),
        workDone: () => {
            playTone(523.25, 0.15);
            setTimeout(() => playTone(659.25, 0.15), 150);
            setTimeout(() => playTone(783.99, 0.3), 300);
        },
        breakDone: () => {
            playTone(783.99, 0.15);
            setTimeout(() => playTone(659.25, 0.15), 150);
            setTimeout(() => playTone(523.25, 0.3), 300);
        },
        complete: () => {
            playTone(523.25, 0.15);
            setTimeout(() => playTone(659.25, 0.15), 150);
            setTimeout(() => playTone(783.99, 0.15), 300);
            setTimeout(() => playTone(1046.5, 0.5), 450);
        },
        sketchSwitch: () => {
            playTone(300, 0.08, 'triangle');
            setTimeout(() => playTone(900, 0.2, 'triangle'), 80);
        }
    };

    function syncSoundIcons() {
        soundOnIcon.classList.toggle('hidden', isSoundMuted || globalVolume === 0);
        soundOffIcon.classList.toggle('hidden', !isSoundMuted && globalVolume > 0);
        volumeSlider.value = globalVolume;
    }

    const savedVolume = Number(localStorage.getItem('aura-volume'));
    if (Number.isFinite(savedVolume)) {
        globalVolume = clampNumber(savedVolume, 0, 1, 0.5);
        preMutedVolume = globalVolume > 0 ? globalVolume : 0.5;
        isSoundMuted = globalVolume === 0;
    }
    syncSoundIcons();

    volumeSlider.addEventListener('input', () => {
        globalVolume = clampNumber(volumeSlider.value, 0, 1, 0.5);
        isSoundMuted = globalVolume === 0;
        if (globalVolume > 0) {
            preMutedVolume = globalVolume;
        }
        localStorage.setItem('aura-volume', String(globalVolume));
        syncSoundIcons();
    });

    soundToggleBtn.addEventListener('click', () => {
        if (isSoundMuted || globalVolume === 0) {
            globalVolume = preMutedVolume || 0.5;
            isSoundMuted = false;
            initAudio();
            sounds.click();
        } else {
            preMutedVolume = globalVolume;
            globalVolume = 0;
            isSoundMuted = true;
        }

        localStorage.setItem('aura-volume', String(globalVolume));
        syncSoundIcons();
    });

    const pomo = createPomodoro();
    const sketch = createSketching();
    const stopwatch = createStopwatch();

    function hasAnyTimerProgress() {
        return pomo.hasProgress() || sketch.hasProgress() || stopwatch.hasProgress();
    }

    function resetAllTimers() {
        pomo.reset();
        sketch.reset();
        stopwatch.reset();
    }

    function navigateTo(targetSectionId) {
        const bodyGlow = document.querySelector('.bg-glow');
        if (targetSectionId === 'pomodoro-section') {
            bodyGlow.style.background = 'radial-gradient(circle, rgba(255, 65, 108, 0.1) 0%, rgba(0,0,0,0) 70%)';
        } else if (targetSectionId === 'sketching-section') {
            bodyGlow.style.background = 'radial-gradient(circle, rgba(138, 43, 226, 0.1) 0%, rgba(0,0,0,0) 70%)';
        } else if (targetSectionId === 'stopwatch-section') {
            bodyGlow.style.background = 'radial-gradient(circle, rgba(0, 242, 254, 0.1) 0%, rgba(0,0,0,0) 70%)';
        } else {
            bodyGlow.style.background = 'radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, rgba(0,0,0,0) 70%)';
        }

        Object.values(sections).forEach(section => {
            const isTarget = section.id === targetSectionId;
            section.classList.toggle('active', isTarget);
            section.style.display = isTarget ? 'block' : 'none';
        });

        document.title = DEFAULT_TITLE;
    }

    function openConfirmModal(targetSectionId) {
        pendingNavTarget = targetSectionId;
        lastFocusedElement = document.activeElement;
        confirmModal.classList.remove('hidden');
        confirmModal.setAttribute('aria-hidden', 'false');
        confirmCancelBtn.focus();
    }

    function closeConfirmModal({ restoreFocus = true } = {}) {
        confirmModal.classList.add('hidden');
        confirmModal.setAttribute('aria-hidden', 'true');
        pendingNavTarget = null;

        if (restoreFocus && lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
            lastFocusedElement.focus();
        }
        lastFocusedElement = null;
    }

    function getFocusableModalElements() {
        return Array.from(confirmModal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
            .filter(el => !el.disabled && el.offsetParent !== null);
    }

    function tryNavigate(targetSectionId) {
        sounds.click();
        if (hasAnyTimerProgress()) {
            openConfirmModal(targetSectionId);
            return;
        }

        resetAllTimers();
        navigateTo(targetSectionId);
    }

    [goPomodoroBtn, goSketchingBtn, goStopwatchBtn].forEach(btn => {
        btn.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                btn.click();
            }
        });
    });

    goPomodoroBtn.addEventListener('click', () => {
        initAudio();
        tryNavigate('pomodoro-section');
    });
    goSketchingBtn.addEventListener('click', () => {
        initAudio();
        tryNavigate('sketching-section');
    });
    goStopwatchBtn.addEventListener('click', () => {
        initAudio();
        tryNavigate('stopwatch-section');
    });
    Object.values(backBtns).forEach(btn => {
        btn.addEventListener('click', () => tryNavigate('dashboard-section'));
    });

    confirmCancelBtn.addEventListener('click', () => {
        sounds.click();
        closeConfirmModal();
    });

    confirmOkBtn.addEventListener('click', () => {
        sounds.click();
        const target = pendingNavTarget;
        closeConfirmModal({ restoreFocus: false });
        resetAllTimers();
        if (target) navigateTo(target);
    });

    confirmModal.addEventListener('click', e => {
        if (e.target === confirmModal) {
            sounds.click();
            closeConfirmModal();
        }
    });

    document.addEventListener('keydown', e => {
        if (confirmModal.classList.contains('hidden')) return;

        if (e.key === 'Escape') {
            e.preventDefault();
            closeConfirmModal();
            return;
        }

        if (e.key !== 'Tab') return;

        const focusableElements = getFocusableModalElements();
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
        }
    });

    function createPomodoro() {
        const workInput = document.getElementById('pomo-work-input');
        const breakInput = document.getElementById('pomo-break-input');
        const cyclesInput = document.getElementById('pomo-cycles-input');
        const saveBtn = document.getElementById('pomo-save-btn');
        const statusLabel = document.getElementById('pomo-status-label');
        const cycleLabel = document.getElementById('pomo-cycle-label');
        const progressBar = document.getElementById('pomo-progress-bar');
        const timeDisplay = document.getElementById('pomo-time-display');
        const startBtn = document.getElementById('pomo-start-btn');
        const pauseBtn = document.getElementById('pomo-pause-btn');
        const resetBtn = document.getElementById('pomo-reset-btn');

        const circumference = 2 * Math.PI * 120;
        progressBar.style.strokeDasharray = `${circumference} ${circumference}`;

        const state = {
            workDuration: 25 * 60,
            breakDuration: 5 * 60,
            totalCycles: 4,
            currentCycle: 1,
            mode: 'work',
            timeLeft: 25 * 60,
            isRunning: false,
            isCompleted: false,
            timerId: null,
            endTime: null
        };

        function formatTime(totalSeconds) {
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = Math.floor(totalSeconds % 60);
            return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }

        function updateUI() {
            const displayStr = formatTime(state.timeLeft);
            timeDisplay.textContent = displayStr;

            if (state.isRunning) {
                document.title = `(${displayStr}) ${state.mode === 'work' ? '專注中' : '休息中'} | Aura Timer`;
            }

            if (state.isCompleted) {
                statusLabel.textContent = '全部完成！🎉';
                statusLabel.className = 'status-label text-pomodoro';
            } else if (!state.isRunning && state.currentCycle === 1 && state.mode === 'work' && state.timeLeft === state.workDuration) {
                statusLabel.textContent = '準備就緒';
                statusLabel.className = 'status-label text-pomodoro';
            } else if (state.mode === 'work') {
                statusLabel.textContent = '專注時間';
                statusLabel.className = 'status-label text-pomodoro';
            } else {
                statusLabel.textContent = '休息時間';
                statusLabel.className = 'status-label text-sketching';
            }

            const totalText = state.totalCycles === 0 ? '∞' : state.totalCycles;
            cycleLabel.textContent = `第 ${state.currentCycle} / ${totalText} 組`;

            const duration = state.mode === 'work' ? state.workDuration : state.breakDuration;
            const ratio = duration > 0 ? state.timeLeft / duration : 0;
            progressBar.style.strokeDashoffset = circumference * (1 - ratio);

            startBtn.classList.toggle('hidden', state.isRunning);
            pauseBtn.classList.toggle('hidden', !state.isRunning);
        }

        function applySettings() {
            const workMinutes = clampInteger(workInput.value, 1, 180, 25);
            const breakMinutes = clampInteger(breakInput.value, 1, 60, 5);
            const cycles = clampInteger(cyclesInput.value, 0, 99, 4);
            workInput.value = workMinutes;
            breakInput.value = breakMinutes;
            cyclesInput.value = cycles;
            state.workDuration = workMinutes * 60;
            state.breakDuration = breakMinutes * 60;
            state.totalCycles = cycles;
            reset();
        }

        function start() {
            initAudio();
            if (state.isRunning) return;
            if (state.isCompleted) reset();

            state.isRunning = true;
            state.isCompleted = false;
            state.endTime = Date.now() + state.timeLeft * 1000;
            updateUI();
            state.timerId = setInterval(() => {
                state.timeLeft = Math.max(0, Math.round((state.endTime - Date.now()) / 1000));
                updateUI();
                if (state.timeLeft <= 0) {
                    handlePhaseEnd();
                }
            }, 1000);
        }

        function pause() {
            if (!state.isRunning) return;
            state.isRunning = false;
            clearInterval(state.timerId);
            updateUI();
        }

        function reset() {
            state.isRunning = false;
            state.isCompleted = false;
            clearInterval(state.timerId);
            state.currentCycle = 1;
            state.mode = 'work';
            state.timeLeft = state.workDuration;
            document.title = DEFAULT_TITLE;
            updateUI();
        }

        function handlePhaseEnd() {
            clearInterval(state.timerId);
            state.isRunning = false;

            if (state.mode === 'work') {
                if (state.totalCycles === 0 || state.currentCycle < state.totalCycles) {
                    sounds.workDone();
                    state.mode = 'break';
                    state.timeLeft = state.breakDuration;
                    start();
                } else {
                    sounds.complete();
                    state.isCompleted = true;
                    state.timeLeft = 0;
                    updateUI();
                }
            } else {
                sounds.breakDone();
                state.currentCycle += 1;
                state.mode = 'work';
                state.timeLeft = state.workDuration;
                start();
            }
        }

        function hasProgress() {
            return state.isRunning ||
                state.isCompleted ||
                state.currentCycle !== 1 ||
                state.mode !== 'work' ||
                state.timeLeft !== state.workDuration;
        }

        saveBtn.addEventListener('click', () => {
            sounds.click();
            applySettings();
        });
        startBtn.addEventListener('click', () => {
            sounds.click();
            start();
        });
        pauseBtn.addEventListener('click', () => {
            sounds.click();
            pause();
        });
        resetBtn.addEventListener('click', () => {
            sounds.click();
            reset();
        });

        updateUI();
        return { reset, hasProgress };
    }

    function createSketching() {
        const workInput = document.getElementById('sketch-work-input');
        const workCustomInput = document.getElementById('sketch-work-custom-input');
        const breakInput = document.getElementById('sketch-break-input');
        const breakCustomInput = document.getElementById('sketch-break-custom-input');
        const cyclesInput = document.getElementById('sketch-cycles-input');
        const keywordInput = document.getElementById('sketch-keyword-input');
        const keywordGroup = document.getElementById('sketch-keyword-group');
        const tagPresetList = document.getElementById('sketch-tag-preset-list');
        const tagPresetInput = document.getElementById('sketch-tag-preset-input');
        const tagPresetAddBtn = document.getElementById('sketch-tag-preset-add-btn');
        const saveBtn = document.getElementById('sketch-save-btn');
        const sourceSelect = document.getElementById('sketch-source-select');
        const folderGroup = document.getElementById('sketch-folder-group');
        const tempGroup = document.getElementById('sketch-temp-group');
        const selectFolderBtn = document.getElementById('select-folder-btn');
        const folderInput = document.getElementById('sketch-folder-input');
        const folderCountBadge = document.getElementById('folder-count-badge');
        const pasteArea = document.getElementById('sketch-paste-area');
        const fileInput = document.getElementById('sketch-file-input');
        const tempCountBadge = document.getElementById('temp-count-badge');
        const clearTempBtn = document.getElementById('clear-temp-btn');
        const exportTempBtn = document.getElementById('export-temp-btn');
        const shuffleToggle = document.getElementById('sketch-shuffle-toggle');
        const prevBtn = document.getElementById('sketch-prev-btn');
        const miniToggleBtn = document.getElementById('sketch-mini-toggle-btn');
        const miniPanel = document.getElementById('sketch-mini-panel');
        const miniTime = document.getElementById('sketch-mini-time');
        const miniPlayBtn = document.getElementById('sketch-mini-play-btn');
        const miniPauseBtn = document.getElementById('sketch-mini-pause-btn');
        const miniRestoreBtn = document.getElementById('sketch-mini-restore-btn');
        const pacingSelect = document.getElementById('sketch-pacing-select');
        const flipHBtn = document.getElementById('sketch-flip-h-btn');
        const flipVBtn = document.getElementById('sketch-flip-v-btn');
        const grayscaleBtn = document.getElementById('sketch-grayscale-btn');
        const filterResetBtn = document.getElementById('sketch-filter-reset-btn');
        const statusLabel = document.getElementById('sketch-status-label');
        const cycleLabel = document.getElementById('sketch-cycle-label');
        const timeDisplay = document.getElementById('sketch-time-display');
        const progressBar = document.getElementById('sketch-progress-bar');
        const startBtn = document.getElementById('sketch-start-btn');
        const pauseBtn = document.getElementById('sketch-pause-btn');
        const skipBtn = document.getElementById('sketch-skip-btn');
        const resetBtn = document.getElementById('sketch-reset-btn');
        const sketchImage = document.getElementById('sketch-image');
        const canvasPlaceholder = document.getElementById('canvas-placeholder');
        const imageLoader = document.getElementById('image-loader');
        const breakMask = document.getElementById('break-mask');
        const breakCountdownText = document.getElementById('break-countdown-text');
        const historyGrid = document.getElementById('sketch-history-grid');

        let folderImages = [];
        let tempImages = [];
        let tagPresets = loadTagPresets();
        const state = {
            workDuration: 60,
            breakDuration: 10,
            totalCycles: 10,
            currentCycle: 1,
            keywords: 'figure, gesture',
            source: 'online',
            shuffle: true,
            mode: 'idle',
            timeLeft: 60,
            isRunning: false,
            timerId: null,
            endTime: null,
            playlist: [],
            playlistIndex: 0,
            history: [],
            nextImageUrl: '',
            flipH: false,
            flipV: false,
            grayscale: false,
            pacingInterval: 'none',
            lastTickSecond: -1,
            lastElapsedPacingSecond: -1
        };

        function getSettings() {
            const workValue = workInput.value === 'custom' ? workCustomInput.value : workInput.value;
            const breakValue = breakInput.value === 'custom' ? breakCustomInput.value : breakInput.value;
            const work = clampNumber(workValue, 0.1, 3600, 60);
            const breakDuration = clampNumber(breakValue, 0.1, 600, 10);
            const cycles = clampInteger(cyclesInput.value, 0, 99, 10);

            if (workInput.value === 'custom') workCustomInput.value = work;
            if (breakInput.value === 'custom') breakCustomInput.value = breakDuration;
            cyclesInput.value = cycles;

            return {
                work,
                breakDuration,
                cycles,
                keywords: keywordInput.value.trim() || 'figure, gesture',
                pacingInterval: pacingSelect.value === 'none' ? 'none' : Number(pacingSelect.value)
            };
        }

        function syncCustomInputs() {
            workCustomInput.classList.toggle('hidden', workInput.value !== 'custom');
            breakCustomInput.classList.toggle('hidden', breakInput.value !== 'custom');
        }

        function syncSourceUI() {
            const source = sourceSelect.value;
            keywordGroup.classList.toggle('hidden', source !== 'online');
            folderGroup.classList.toggle('hidden', source !== 'folder');
            tempGroup.classList.toggle('hidden', source !== 'temp');
            state.source = source;
            if (state.mode === 'idle') {
                updatePlaceholder();
            }
        }

        function updateTempImagesUI() {
            tempCountBadge.textContent = `${tempImages.length} 張`;
            clearTempBtn.classList.toggle('hidden', tempImages.length === 0);
            exportTempBtn.classList.toggle('hidden', tempImages.length === 0);
        }

        function addTempImages(files) {
            const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
            imageFiles.forEach(file => {
                tempImages.push({ name: file.name || '貼上圖片', url: URL.createObjectURL(file) });
            });
            updateTempImagesUI();
        }

        function shuffleArray(array) {
            const shuffled = [...array];
            for (let i = shuffled.length - 1; i > 0; i -= 1) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            return shuffled;
        }

        function updatePlaceholder(message) {
            const placeholderContent = canvasPlaceholder.querySelector('.placeholder-content');
            placeholderContent.innerHTML = message || `
                🎨
                <h3>速寫練習畫板</h3>
                <p>請於左側選擇圖片來源，設定作畫時間後點擊「開始」，此處將自動載入素材並啟動倒數。</p>
            `;
        }

        function normalizeTag(value) {
            return value
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9-]+/g, '-')
                .replace(/^-+|-+$/g, '');
        }

        function uniqueTags(tags) {
            return [...new Set(tags.map(normalizeTag).filter(Boolean))];
        }

        function parseKeywordTags(value) {
            return uniqueTags(value.split(','));
        }

        function formatKeywordTags(tags) {
            return uniqueTags(tags).join(', ');
        }

        function loadTagPresets() {
            try {
                const stored = localStorage.getItem(SKETCH_TAG_PRESETS_STORAGE_KEY);
                if (!stored) return DEFAULT_SKETCH_TAG_PRESETS;

                const parsed = JSON.parse(stored);
                if (!Array.isArray(parsed)) return DEFAULT_SKETCH_TAG_PRESETS;
                return uniqueTags(parsed);
            } catch (err) {
                console.warn('讀取常用標籤失敗，改用預設標籤。', err);
                return DEFAULT_SKETCH_TAG_PRESETS;
            }
        }

        function saveTagPresets() {
            localStorage.setItem(SKETCH_TAG_PRESETS_STORAGE_KEY, JSON.stringify(tagPresets));
        }

        function setKeywordTags(tags) {
            keywordInput.value = formatKeywordTags(tags);
            renderTagPresets();
        }

        function toggleKeywordTag(tag) {
            const currentTags = parseKeywordTags(keywordInput.value);
            const nextTags = currentTags.includes(tag)
                ? currentTags.filter(currentTag => currentTag !== tag)
                : [...currentTags, tag];

            setKeywordTags(nextTags);
        }

        function removeTagPreset(tag) {
            tagPresets = tagPresets.filter(currentTag => currentTag !== tag);
            saveTagPresets();
            setKeywordTags(parseKeywordTags(keywordInput.value).filter(currentTag => currentTag !== tag));
        }

        function addTagPreset() {
            const tag = normalizeTag(tagPresetInput.value);
            if (!tag) return;

            if (!tagPresets.includes(tag)) {
                tagPresets = [...tagPresets, tag];
                saveTagPresets();
            }

            tagPresetInput.value = '';
            setKeywordTags([...parseKeywordTags(keywordInput.value), tag]);
            tagPresetInput.focus();
        }

        function renderTagPresets() {
            const activeTags = new Set(parseKeywordTags(keywordInput.value));
            tagPresetList.innerHTML = '';

            if (tagPresets.length === 0) {
                const emptyText = document.createElement('span');
                emptyText.className = 'tag-preset-empty';
                emptyText.textContent = '尚未建立常用標籤。';
                tagPresetList.appendChild(emptyText);
                return;
            }

            tagPresets.forEach(tag => {
                const chip = document.createElement('span');
                chip.className = 'tag-preset-chip';
                if (activeTags.has(tag)) chip.classList.add('is-active');

                const toggleButton = document.createElement('button');
                toggleButton.type = 'button';
                toggleButton.className = 'tag-preset-btn';
                toggleButton.textContent = tag;
                toggleButton.setAttribute('aria-pressed', String(activeTags.has(tag)));
                toggleButton.addEventListener('click', () => toggleKeywordTag(tag));

                const removeButton = document.createElement('button');
                removeButton.type = 'button';
                removeButton.className = 'tag-preset-remove-btn';
                removeButton.textContent = '×';
                removeButton.setAttribute('aria-label', `移除常用標籤 ${tag}`);
                removeButton.addEventListener('click', () => removeTagPreset(tag));

                chip.append(toggleButton, removeButton);
                tagPresetList.appendChild(chip);
            });
        }

        function getSearchTags() {
            const tags = parseKeywordTags(state.keywords).slice(0, 4);

            return tags.length > 0 ? tags.join(',') : 'people,portrait,pose,figure';
        }

        function getRandomImageUrl() {
            const seed = Date.now() + Math.floor(Math.random() * 100000);
            // 結尾的 /all 讓 loremflickr 以「任一標籤」(OR) 比對，避免多關鍵字交集為空而回傳無關的預設圖。
            return `https://loremflickr.com/800/600/${getSearchTags()}/all?random=${seed}`;
        }

        function getFallbackImageUrl() {
            const seed = Date.now() + Math.floor(Math.random() * 100000);
            return `https://picsum.photos/800/600?random=${seed}`;
        }

        function preloadNextImage() {
            if (state.source !== 'online') return;
            state.nextImageUrl = getRandomImageUrl();
            const img = new Image();
            img.onerror = () => {
                state.nextImageUrl = '';
            };
            img.src = state.nextImageUrl;
        }

        function getHistoryDownloadUrl(url) {
            if (url.startsWith('blob:') || url.startsWith('data:')) return url;
            try {
                const downloadUrl = new URL(url, window.location.href);
                downloadUrl.searchParams.set('dl', '1');
                return downloadUrl.toString();
            } catch (err) {
                return url;
            }
        }

        function renderHistoryItem(url) {
            const noHistory = historyGrid.querySelector('.no-history-text');
            if (noHistory) {
                historyGrid.innerHTML = '';
            }

            const itemIndex = state.history.length;
            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `
                <img class="history-thumb" src="${url}" alt="歷史圖片 #${itemIndex}" style="cursor: pointer;">
                <div class="history-overlay">
                    <a href="${url}" class="history-btn history-btn-view" target="_blank" rel="noopener">查看原圖</a>
                    <a href="${getHistoryDownloadUrl(url)}" class="history-btn history-btn-save" target="_blank" rel="noopener" download="sketch-${itemIndex}.jpg">下載保存</a>
                </div>
            `;

            item.querySelector('.history-thumb').addEventListener('click', () => {
                const foundIndex = state.playlist.indexOf(url);
                if (foundIndex === -1) return;
                pause();
                state.playlistIndex = foundIndex;
                state.currentCycle = foundIndex + 1;
                state.mode = 'work';
                state.timeLeft = state.workDuration;
                loadCurrentImage(url);
                updateUI();
            });
            historyGrid.appendChild(item);
        }

        function resetHistory() {
            state.history = [];
            historyGrid.innerHTML = '<div class="no-history-text">尚未開始練習。當您開始速寫且加載圖片後，已練習過的圖片將會呈現在此。</div>';
        }

        function showImageLoadError() {
            imageLoader.classList.add('hidden');
            sketchImage.classList.remove('loaded');
            canvasPlaceholder.classList.remove('hidden');
            updatePlaceholder(`
                ⚠️
                <h3>圖片載入失敗</h3>
                <p>無法載入目前圖片，請切換下一張、改用暫存圖片，或稍後再試。</p>
            `);
        }

        function loadCurrentImage(url) {
            sketchImage.classList.remove('loaded');
            if (!url) {
                sketchImage.src = '';
                imageLoader.classList.add('hidden');
                canvasPlaceholder.classList.remove('hidden');
                updatePlaceholder();
                return;
            }

            imageLoader.classList.remove('hidden');
            canvasPlaceholder.classList.add('hidden');

            const originalUrl = url;
            let displayedUrl = url;
            let hasRetriedWithFallback = false;
            let settled = false;
            let loadTimeoutId = null;

            const clearLoadTimeout = () => {
                if (loadTimeoutId !== null) {
                    clearTimeout(loadTimeoutId);
                    loadTimeoutId = null;
                }
            };

            const retryWithFallback = () => {
                if (hasRetriedWithFallback) {
                    clearLoadTimeout();
                    console.error('圖片與備用圖片皆載入失敗。');
                    showImageLoadError();
                    return;
                }
                hasRetriedWithFallback = true;
                displayedUrl = getFallbackImageUrl();
                startLoadTimeout();
                sketchImage.src = displayedUrl;
            };

            const startLoadTimeout = () => {
                clearLoadTimeout();
                loadTimeoutId = setTimeout(() => {
                    if (settled) return;
                    console.warn('圖片載入逾時，改用備用隨機圖...');
                    retryWithFallback();
                }, 8000);
            };

            sketchImage.onload = () => {
                if (settled) return;
                settled = true;
                clearLoadTimeout();
                imageLoader.classList.add('hidden');
                sketchImage.classList.add('loaded');
                if (displayedUrl !== originalUrl) {
                    state.playlist = state.playlist.map(item => item === originalUrl ? displayedUrl : item);
                }
                if (!state.history.includes(displayedUrl)) {
                    state.history.push(displayedUrl);
                    renderHistoryItem(displayedUrl);
                }
            };

            sketchImage.onerror = () => {
                if (settled) return;
                console.error('圖片載入失敗，使用備用隨機圖...');
                retryWithFallback();
            };

            startLoadTimeout();
            sketchImage.src = displayedUrl;
        }

        function formatSketchTime(timeLeft) {
            if (timeLeft >= 60) {
                const minutes = Math.floor(timeLeft / 60);
                const seconds = Math.floor(timeLeft % 60);
                return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            }
            if (timeLeft >= 10) return String(Math.floor(timeLeft));
            return timeLeft.toFixed(1);
        }

        function updateUI() {
            const displayStr = formatSketchTime(state.timeLeft);
            timeDisplay.textContent = displayStr;
            if (miniTime) miniTime.textContent = displayStr;

            startBtn.classList.toggle('hidden', state.isRunning);
            pauseBtn.classList.toggle('hidden', !state.isRunning);
            miniPlayBtn.classList.toggle('hidden', state.isRunning);
            miniPauseBtn.classList.toggle('hidden', !state.isRunning);

            if (state.isRunning) {
                document.title = `(${displayStr}) ${state.mode === 'work' ? '速寫中' : '準備換圖'} | Aura Timer`;
            }

            if (state.mode === 'idle') {
                statusLabel.textContent = '準備就緒';
                statusLabel.className = 'status-label text-sketching';
                breakMask.classList.add('hidden');
                canvasPlaceholder.classList.remove('hidden');
                sketchImage.classList.remove('loaded');
            } else if (state.mode === 'finished') {
                statusLabel.textContent = '練習結束！🎉';
                statusLabel.className = 'status-label text-sketching';
                breakMask.classList.add('hidden');
                imageLoader.classList.add('hidden');
            } else if (state.mode === 'work') {
                statusLabel.textContent = '速寫中...';
                statusLabel.className = 'status-label text-sketching';
                breakMask.classList.add('hidden');
            } else {
                statusLabel.textContent = '準備下一張';
                statusLabel.className = 'status-label text-pomodoro';
                breakMask.classList.remove('hidden');
                breakCountdownText.textContent = `請準備好畫筆，下張圖將在 ${Math.ceil(state.timeLeft)} 秒後呈現...`;
            }

            let totalText = state.totalCycles;
            if (totalText === 0) {
                totalText = state.source === 'online' ? '∞' : state.playlist.length;
            }
            cycleLabel.textContent = `第 ${state.currentCycle} / ${totalText} 張`;

            const duration = state.mode === 'work' ? state.workDuration : state.breakDuration;
            const pct = duration > 0 ? (state.timeLeft / duration) * 100 : 0;
            progressBar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
            prevBtn.disabled = state.mode === 'idle' || state.playlistIndex === 0;
        }

        function applyFilters() {
            const transformParts = [];
            if (state.flipH) transformParts.push('scaleX(-1)');
            if (state.flipV) transformParts.push('scaleY(-1)');
            sketchImage.style.transform = transformParts.length > 0 ? transformParts.join(' ') : 'scale(1)';
            sketchImage.style.filter = state.grayscale ? 'grayscale(1)' : 'none';
            flipHBtn.classList.toggle('active', state.flipH);
            flipVBtn.classList.toggle('active', state.flipV);
            grayscaleBtn.classList.toggle('active', state.grayscale);
        }

        function applySettings() {
            const settings = getSettings();
            state.workDuration = settings.work;
            state.breakDuration = settings.breakDuration;
            state.totalCycles = settings.cycles;
            state.keywords = settings.keywords;
            state.source = sourceSelect.value;
            state.shuffle = shuffleToggle.checked;
            state.pacingInterval = settings.pacingInterval;
            reset();
        }

        function buildPlaylist() {
            state.playlist = [];
            state.playlistIndex = 0;
            if (state.source === 'online') {
                const firstUrl = getRandomImageUrl();
                state.playlist.push(firstUrl);
                preloadNextImage();
                return firstUrl;
            }

            if (state.source === 'folder') {
                if (folderImages.length === 0) {
                    alert('請先匯入含有圖片的資料夾！');
                    return '';
                }
                state.playlist = state.shuffle ? shuffleArray(folderImages.map(img => img.url)) : folderImages.map(img => img.url);
                return state.playlist[0];
            }

            if (tempImages.length === 0) {
                alert('暫存區中無圖片！請先點擊上傳或按 Ctrl+V 貼上圖片。');
                return '';
            }
            state.playlist = state.shuffle ? shuffleArray(tempImages.map(img => img.url)) : tempImages.map(img => img.url);
            return state.playlist[0];
        }

        function start() {
            initAudio();
            if (state.isRunning) return;

            if (state.mode === 'idle') {
                const firstUrl = buildPlaylist();
                if (!firstUrl) {
                    state.isRunning = false;
                    updateUI();
                    return;
                }
                state.mode = 'work';
                state.currentCycle = 1;
                state.timeLeft = state.workDuration;
                loadCurrentImage(firstUrl);
            }

            state.isRunning = true;
            state.endTime = Date.now() + state.timeLeft * 1000;
            state.lastTickSecond = Math.ceil(state.timeLeft);
            updateUI();

            state.timerId = setInterval(() => {
                state.timeLeft = Math.max(0, (state.endTime - Date.now()) / 1000);
                const currentSecond = Math.ceil(state.timeLeft);
                if (state.mode === 'break' && currentSecond !== state.lastTickSecond && state.timeLeft > 0) {
                    state.lastTickSecond = currentSecond;
                    sounds.tick();
                }

                if (state.mode === 'work' && state.pacingInterval !== 'none') {
                    const elapsed = Math.floor(state.workDuration - state.timeLeft);
                    if (elapsed > 0 && elapsed % state.pacingInterval === 0 && elapsed !== state.lastElapsedPacingSecond) {
                        state.lastElapsedPacingSecond = elapsed;
                        playTone(450, 0.04);
                    }
                }

                updateUI();
                if (state.timeLeft <= 0) handlePhaseEnd();
            }, 50);
        }

        function pause() {
            if (!state.isRunning) return;
            state.isRunning = false;
            clearInterval(state.timerId);
            updateUI();
        }

        function reset() {
            state.isRunning = false;
            clearInterval(state.timerId);
            state.currentCycle = 1;
            state.mode = 'idle';
            state.timeLeft = state.workDuration;
            state.playlist = [];
            state.playlistIndex = 0;
            state.lastElapsedPacingSecond = -1;
            state.flipH = false;
            state.flipV = false;
            state.grayscale = false;
            applyFilters();
            document.body.classList.remove('mini-mode-active');
            miniToggleBtn.setAttribute('aria-expanded', 'false');
            miniPanel.classList.add('hidden');
            resetHistory();
            updatePlaceholder();
            document.title = DEFAULT_TITLE;
            updateUI();
        }

        function finish() {
            clearInterval(state.timerId);
            sounds.complete();
            state.mode = 'finished';
            state.isRunning = false;
            updateUI();
        }

        function advanceImage() {
            if (state.source === 'online') {
                if (state.playlistIndex === state.playlist.length - 1) {
                    state.playlist.push(state.nextImageUrl || getRandomImageUrl());
                    preloadNextImage();
                }
                state.playlistIndex += 1;
                return state.playlist[state.playlistIndex];
            }

            state.playlistIndex += 1;
            return state.playlist[state.playlistIndex % state.playlist.length];
        }

        function handlePhaseEnd() {
            clearInterval(state.timerId);
            state.isRunning = false;

            if (state.mode === 'work') {
                const hasNextCycle = state.totalCycles === 0 || state.currentCycle < state.totalCycles;
                if (!hasNextCycle) {
                    finish();
                    return;
                }
                sounds.sketchSwitch();
                state.mode = 'break';
                state.timeLeft = state.breakDuration;
                updateUI();
                start();
                return;
            }

            state.currentCycle += 1;
            state.mode = 'work';
            state.timeLeft = state.workDuration;
            const nextUrl = advanceImage();
            loadCurrentImage(nextUrl);
            updateUI();
            start();
        }

        function skip() {
            sounds.click();
            if (state.mode === 'idle' || state.mode === 'finished') return;
            const hasNextCycle = state.totalCycles === 0 || state.currentCycle < state.totalCycles;
            if (!hasNextCycle) {
                finish();
                return;
            }
            clearInterval(state.timerId);
            const wasRunning = state.isRunning;
            state.isRunning = false;
            state.currentCycle += 1;
            state.mode = 'work';
            state.timeLeft = state.workDuration;
            loadCurrentImage(advanceImage());
            if (wasRunning) start();
            updateUI();
        }

        async function exportTempImages() {
            if (tempImages.length === 0) {
                alert('暫存區無任何圖片！');
                return;
            }

            if (window.showDirectoryPicker) {
                try {
                    const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
                    for (let i = 0; i < tempImages.length; i += 1) {
                        const imgData = tempImages[i];
                        const response = await fetch(imgData.url);
                        const blob = await response.blob();
                        const fileName = imgData.name && !imgData.name.startsWith('貼上圖片')
                            ? `${i + 1}_${imgData.name}`
                            : `sketch-temp-${i + 1}.png`;
                        const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
                        const writable = await fileHandle.createWritable();
                        await writable.write(blob);
                        await writable.close();
                    }
                    alert(`已成功匯出 ${tempImages.length} 張暫存圖片。`);
                } catch (err) {
                    if (err.name !== 'AbortError') {
                        console.error('資料夾寫入失敗，改用瀏覽器下載:', err);
                        fallbackBatchDownload();
                    }
                }
                return;
            }

            fallbackBatchDownload();
        }

        function fallbackBatchDownload() {
            alert('您的瀏覽器不支援直接寫入資料夾，即將批次觸發下載。');
            tempImages.forEach((imgData, index) => {
                const a = document.createElement('a');
                a.href = imgData.url;
                a.download = imgData.name && !imgData.name.startsWith('貼上圖片')
                    ? imgData.name
                    : `sketch-temp-${index + 1}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            });
        }

        function hasProgress() {
            return state.isRunning || state.mode !== 'idle' || state.history.length > 0 || state.playlist.length > 0;
        }

        workInput.addEventListener('change', syncCustomInputs);
        breakInput.addEventListener('change', syncCustomInputs);
        sourceSelect.addEventListener('change', syncSourceUI);
        keywordInput.addEventListener('input', renderTagPresets);
        tagPresetAddBtn.addEventListener('click', addTagPreset);
        tagPresetInput.addEventListener('keydown', e => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            addTagPreset();
        });
        selectFolderBtn.addEventListener('click', () => folderInput.click());
        folderInput.addEventListener('change', e => {
            folderImages.forEach(img => URL.revokeObjectURL(img.url));
            folderImages = Array.from(e.target.files)
                .filter(file => file.type.startsWith('image/'))
                .map(file => ({ name: file.name, url: URL.createObjectURL(file) }));
            folderCountBadge.textContent = `已匯入 ${folderImages.length} 張`;
            if (folderImages.length === 0) alert('所選資料夾中無有效圖片檔案！');
        });
        pasteArea.addEventListener('click', e => {
            if (e.target !== fileInput) fileInput.click();
        });
        fileInput.addEventListener('change', e => {
            addTempImages(e.target.files);
            fileInput.value = '';
        });
        pasteArea.addEventListener('paste', e => {
            const files = Array.from(e.clipboardData.items)
                .filter(item => item.type.includes('image'))
                .map(item => item.getAsFile())
                .filter(Boolean);
            if (files.length > 0) {
                e.preventDefault();
                addTempImages(files);
            }
        });
        pasteArea.addEventListener('dragover', e => {
            e.preventDefault();
            pasteArea.classList.add('dragover');
        });
        pasteArea.addEventListener('dragleave', () => pasteArea.classList.remove('dragover'));
        pasteArea.addEventListener('drop', e => {
            e.preventDefault();
            pasteArea.classList.remove('dragover');
            addTempImages(e.dataTransfer.files);
        });
        clearTempBtn.addEventListener('click', e => {
            e.stopPropagation();
            tempImages.forEach(img => URL.revokeObjectURL(img.url));
            tempImages = [];
            updateTempImagesUI();
        });
        exportTempBtn.addEventListener('click', e => {
            e.stopPropagation();
            exportTempImages();
        });
        saveBtn.addEventListener('click', () => {
            sounds.click();
            applySettings();
        });
        startBtn.addEventListener('click', () => {
            sounds.click();
            start();
        });
        pauseBtn.addEventListener('click', () => {
            sounds.click();
            pause();
        });
        skipBtn.addEventListener('click', skip);
        resetBtn.addEventListener('click', () => {
            sounds.click();
            reset();
        });
        prevBtn.addEventListener('click', () => {
            sounds.click();
            if (state.playlistIndex <= 0) return;
            pause();
            state.playlistIndex -= 1;
            state.currentCycle = Math.max(1, state.currentCycle - 1);
            state.mode = 'work';
            state.timeLeft = state.workDuration;
            loadCurrentImage(state.playlist[state.playlistIndex]);
            updateUI();
        });
        miniToggleBtn.addEventListener('click', () => {
            sounds.click();
            document.body.classList.add('mini-mode-active');
            miniToggleBtn.setAttribute('aria-expanded', 'true');
            miniPanel.classList.remove('hidden');
        });
        miniRestoreBtn.addEventListener('click', () => {
            sounds.click();
            document.body.classList.remove('mini-mode-active');
            miniToggleBtn.setAttribute('aria-expanded', 'false');
            miniPanel.classList.add('hidden');
        });
        miniPlayBtn.addEventListener('click', () => {
            sounds.click();
            start();
        });
        miniPauseBtn.addEventListener('click', () => {
            sounds.click();
            pause();
        });
        flipHBtn.addEventListener('click', () => {
            sounds.click();
            state.flipH = !state.flipH;
            applyFilters();
        });
        flipVBtn.addEventListener('click', () => {
            sounds.click();
            state.flipV = !state.flipV;
            applyFilters();
        });
        grayscaleBtn.addEventListener('click', () => {
            sounds.click();
            state.grayscale = !state.grayscale;
            applyFilters();
        });
        filterResetBtn.addEventListener('click', () => {
            sounds.click();
            state.flipH = false;
            state.flipV = false;
            state.grayscale = false;
            applyFilters();
        });
        document.addEventListener('keydown', e => {
            if (sections.sketching.style.display === 'none' || !confirmModal.classList.contains('hidden')) return;
            const activeEl = document.activeElement;
            if (activeEl && ['INPUT', 'SELECT', 'TEXTAREA'].includes(activeEl.tagName)) return;

            if (e.code === 'Space') {
                e.preventDefault();
                sounds.click();
                state.isRunning ? pause() : start();
            } else if (e.code === 'ArrowLeft') {
                e.preventDefault();
                prevBtn.click();
            } else if (e.code === 'ArrowRight') {
                e.preventDefault();
                skipBtn.click();
            } else if (e.code === 'KeyF') {
                e.preventDefault();
                state.flipH = !state.flipH;
                applyFilters();
            } else if (e.code === 'KeyG') {
                e.preventDefault();
                state.grayscale = !state.grayscale;
                applyFilters();
            }
        });

        syncCustomInputs();
        syncSourceUI();
        renderTagPresets();
        updateTempImagesUI();
        resetHistory();
        updateUI();
        return { reset, hasProgress };
    }

    function createStopwatch() {
        const timeDisplay = document.getElementById('sw-time-display');
        const startBtn = document.getElementById('sw-start-btn');
        const pauseBtn = document.getElementById('sw-pause-btn');
        const lapBtn = document.getElementById('sw-lap-btn');
        const resetBtn = document.getElementById('sw-reset-btn');
        const lapList = document.getElementById('sw-lap-list');
        const lapCount = document.getElementById('sw-lap-count');

        const state = {
            isRunning: false,
            startTime: 0,
            accumulatedTime: 0,
            currentTime: 0,
            rafId: null,
            laps: []
        };

        function formatTime(ms) {
            const totalSec = Math.floor(ms / 1000);
            const hours = Math.floor(totalSec / 3600);
            const minutes = Math.floor((totalSec % 3600) / 60);
            const seconds = totalSec % 60;
            const centiseconds = Math.floor((ms % 1000) / 10);
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
        }

        function tick() {
            if (!state.isRunning) return;
            state.currentTime = performance.now() - state.startTime + state.accumulatedTime;
            timeDisplay.textContent = formatTime(state.currentTime);
            state.rafId = requestAnimationFrame(tick);
        }

        function renderLaps() {
            lapCount.textContent = String(state.laps.length);
            if (state.laps.length === 0) {
                lapList.innerHTML = '<tr class="no-laps-row"><td colspan="3">尚無計圈記錄。點擊「計圈」記錄分段時間。</td></tr>';
                return;
            }

            let fastestIdx = -1;
            let slowestIdx = -1;
            if (state.laps.length >= 2) {
                const lapTimes = state.laps.map(lap => lap.lapTime);
                const fastest = Math.min(...lapTimes);
                const slowest = Math.max(...lapTimes);
                if (fastest !== slowest) {
                    fastestIdx = state.laps.findIndex(lap => lap.lapTime === fastest);
                    slowestIdx = state.laps.findIndex(lap => lap.lapTime === slowest);
                }
            }

            lapList.innerHTML = state.laps.map((lap, idx) => {
                const className = idx === fastestIdx ? 'lap-fastest' : idx === slowestIdx ? 'lap-slowest' : '';
                const label = idx === fastestIdx ? ' (最快)' : idx === slowestIdx ? ' (最慢)' : '';
                return `<tr class="lap-row"><td>#${lap.lapIndex}</td><td class="${className}">${formatTime(lap.lapTime)}${label}</td><td>${formatTime(lap.totalTime)}</td></tr>`;
            }).join('');
        }

        function start() {
            initAudio();
            if (state.isRunning) return;
            state.isRunning = true;
            state.startTime = performance.now();
            startBtn.classList.add('hidden');
            pauseBtn.classList.remove('hidden');
            document.title = '碼表計時中... | Aura Timer';
            tick();
        }

        function pause() {
            if (!state.isRunning) return;
            state.isRunning = false;
            cancelAnimationFrame(state.rafId);
            state.accumulatedTime = state.currentTime;
            startBtn.classList.remove('hidden');
            pauseBtn.classList.add('hidden');
            document.title = DEFAULT_TITLE;
        }

        function reset() {
            state.isRunning = false;
            cancelAnimationFrame(state.rafId);
            state.startTime = 0;
            state.accumulatedTime = 0;
            state.currentTime = 0;
            state.laps = [];
            timeDisplay.textContent = '00:00:00.00';
            startBtn.classList.remove('hidden');
            pauseBtn.classList.add('hidden');
            document.title = DEFAULT_TITLE;
            renderLaps();
        }

        function lap() {
            if (!state.isRunning && state.currentTime === 0) return;
            sounds.tick();
            const previousTotal = state.laps.length > 0 ? state.laps[0].totalTime : 0;
            state.laps.unshift({
                lapIndex: state.laps.length + 1,
                lapTime: state.currentTime - previousTotal,
                totalTime: state.currentTime
            });
            renderLaps();
        }

        function hasProgress() {
            return state.isRunning || state.currentTime > 0 || state.laps.length > 0;
        }

        startBtn.addEventListener('click', () => {
            sounds.click();
            start();
        });
        pauseBtn.addEventListener('click', () => {
            sounds.click();
            pause();
        });
        lapBtn.addEventListener('click', lap);
        resetBtn.addEventListener('click', () => {
            sounds.click();
            reset();
        });

        renderLaps();
        return { reset, hasProgress };
    }

    navigateTo('dashboard-section');
});
