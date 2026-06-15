/**
 * Aura Timer - 多功能計時器邏輯
 * 包含：番茄鐘、速寫計時器、碼表及 Web Audio 音效合成器
 * 註解全部使用繁體中文，符合 RULE[user_global] 規範
 */

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================================================
    // 1. 全域變數與 DOM 元素
    // ==========================================================================
    
    // 頁面切換相關
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

    // 音效與音量控制
    const soundToggleBtn = document.getElementById('sound-toggle-btn');
    const soundOnIcon = soundToggleBtn.querySelector('.sound-on-icon');
    const soundOffIcon = soundToggleBtn.querySelector('.sound-off-icon');
    const volumeSlider = document.getElementById('volume-slider');
    
    let isSoundMuted = false;
    let globalVolume = 0.5;
    let preMutedVolume = 0.5; // 用於保存靜音前音量

    // 讀取 localStorage 內儲存的音量
    const savedVolume = localStorage.getItem('aura-volume');
    if (savedVolume !== null) {
        globalVolume = parseFloat(savedVolume);
        volumeSlider.value = globalVolume;
        if (globalVolume === 0) {
            isSoundMuted = true;
            soundOnIcon.classList.add('hidden');
            soundOffIcon.classList.remove('hidden');
        }
    }

    // 確認對話框 (Modal)
    const confirmModal = document.getElementById('confirm-modal');
    const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
    const confirmOkBtn = document.getElementById('confirm-ok-btn');
    let pendingNavTarget = null; // 記錄待跳轉的目標頁面

    // ==========================================================================
    // 2. 音效播放器 (Web Audio API 合成器)
    // ==========================================================================
    
    let audioCtx = null;

    function initAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    /**
     * 播放特定頻率與長度的合成嗶聲
     * @param {number} freq 頻率 (Hz)
     * @param {number} duration 長度 (秒)
     * @param {string} type 波形種類 ('sine', 'square', 'sawtooth', 'triangle')
     */
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

            // 漸弱效果防止爆音，音量連動全域音量 (提高基數至 0.4 確保足夠響亮)
            const volumeVal = 0.4 * globalVolume;
            gainNode.gain.setValueAtTime(volumeVal, audioCtx.currentTime);
            // 改用穩定的線性漸弱，防止短時間內指數漸弱被瀏覽器截斷而無聲
            gainNode.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + duration);

            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            osc.start();
            osc.stop(audioCtx.currentTime + duration);
        } catch (e) {
            console.error('音效播放失敗:', e);
        }
    }

    // 常用音效
    const sounds = {
        click: () => playTone(600, 0.1), // 加長至 0.1 秒
        tick: () => playTone(900, 0.06), // 加長至 0.06 秒以防被截斷，高頻 900Hz 更清脆
        workDone: () => {
            playTone(523.25, 0.15); // C5
            setTimeout(() => playTone(659.25, 0.15), 150); // E5
            setTimeout(() => playTone(783.99, 0.3), 300); // G5
        },
        breakDone: () => {
            playTone(783.99, 0.15); // G5
            setTimeout(() => playTone(659.25, 0.15), 150); // E5
            setTimeout(() => playTone(523.25, 0.3), 300); // C5
        },
        complete: () => {
            playTone(523.25, 0.15); // C5
            setTimeout(() => playTone(659.25, 0.15), 150);
            setTimeout(() => playTone(783.99, 0.15), 300);
            setTimeout(() => playTone(1046.50, 0.5), 450); // C6
        },
        sketchSwitch: () => {
            // 滑音效果 (Sweep)
            if (isSoundMuted || globalVolume === 0) return;
            try {
                initAudio();
                const osc = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();
                osc.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                
                osc.frequency.setValueAtTime(300, audioCtx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(900, audioCtx.currentTime + 0.3);
                
                const volumeVal = 0.4 * globalVolume;
                gainNode.gain.setValueAtTime(volumeVal, audioCtx.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
                
                osc.start();
                osc.stop(audioCtx.currentTime + 0.3);
            } catch (e) {
                console.error(e);
            }
        }
    };

    // 音量滑桿事件
    volumeSlider.addEventListener('input', () => {
        globalVolume = parseFloat(volumeSlider.value);
        localStorage.setItem('aura-volume', globalVolume);

        if (globalVolume === 0) {
            isSoundMuted = true;
            soundOnIcon.classList.add('hidden');
            soundOffIcon.classList.remove('hidden');
        } else {
            isSoundMuted = false;
            soundOnIcon.classList.remove('hidden');
            soundOffIcon.classList.add('hidden');
            preMutedVolume = globalVolume; // 記錄非靜音時的最新音量
        }
    });

    // 音效一鍵靜音/恢復事件
    soundToggleBtn.addEventListener('click', () => {
        if (!isSoundMuted) {
            // 進行靜音
            preMutedVolume = globalVolume > 0 ? globalVolume : 0.5;
            globalVolume = 0;
            isSoundMuted = true;
            volumeSlider.value = 0;
            soundOnIcon.classList.add('hidden');
            soundOffIcon.classList.remove('hidden');
        } else {
            // 恢復聲音
            globalVolume = preMutedVolume;
            isSoundMuted = false;
            volumeSlider.value = globalVolume;
            soundOnIcon.classList.remove('hidden');
            soundOffIcon.classList.add('hidden');
            // 測試播放
            initAudio();
            sounds.click();
        }
        localStorage.setItem('aura-volume', globalVolume);
    });

    // ==========================================================================
    // 3. 導覽管理與確認 Modal 邏輯
    // ==========================================================================

    /**
     * 檢查當前是否有計時器正在執行中
     */
    function isAnyTimerRunning() {
        return pomoState.isRunning || sketchState.isRunning || swState.isRunning;
    }

    /**
     * 切換至指定頁面
     */
    function navigateTo(targetSectionId) {
        // 更新背景光暈色調
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

        Object.keys(sections).forEach(key => {
            const section = sections[key];
            if (section.id === targetSectionId) {
                section.style.display = 'block';
                // 使用微小延遲觸發漸變動畫
                setTimeout(() => section.classList.add('active'), 20);
            } else {
                section.classList.remove('active');
                section.style.display = 'none';
            }
        });

        // 重設網頁標題
        document.title = '極致多功能計時器 | 專注、速寫與精準';
    }

    /**
     * 嘗試導覽，若有計時器運行則跳出確認 Modal
     */
    function tryNavigate(targetSectionId) {
        sounds.click();
        if (isAnyTimerRunning()) {
            pendingNavTarget = targetSectionId;
            confirmModal.classList.remove('hidden');
        } else {
            // 若沒有計時器執行，則直接重設並跳轉
            resetAllTimers();
            navigateTo(targetSectionId);
        }
    }

    /**
     * 強制停止所有計時器並重設
     */
    function resetAllTimers() {
        pomoReset();
        sketchReset();
        swReset();
    }

    // 主選單按鈕綁定
    goPomodoroBtn.addEventListener('click', () => {
        initAudio();
        if (audioCtx) audioCtx.resume();
        tryNavigate('pomodoro-section');
    });
    goSketchingBtn.addEventListener('click', () => {
        initAudio();
        if (audioCtx) audioCtx.resume();
        tryNavigate('sketching-section');
    });
    goStopwatchBtn.addEventListener('click', () => {
        initAudio();
        if (audioCtx) audioCtx.resume();
        tryNavigate('stopwatch-section');
    });

    // 返回按鈕綁定
    Object.keys(backBtns).forEach(key => {
        backBtns[key].addEventListener('click', () => tryNavigate('dashboard-section'));
    });

    // Modal 按鈕事件
    confirmCancelBtn.addEventListener('click', () => {
        sounds.click();
        confirmModal.classList.add('hidden');
        pendingNavTarget = null;
    });

    confirmOkBtn.addEventListener('click', () => {
        sounds.click();
        confirmModal.classList.add('hidden');
        resetAllTimers();
        if (pendingNavTarget) {
            navigateTo(pendingNavTarget);
            pendingNavTarget = null;
        }
    });

    // 點擊鍵盤 Enter/Space 也可以觸發卡片
    [goPomodoroBtn, goSketchingBtn, goStopwatchBtn].forEach(btn => {
        btn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                btn.click();
            }
        });
    });


    // ==========================================================================
    // 4. 番茄工作法計時器 (Pomodoro Timer) 邏輯
    // ==========================================================================
    
    // DOM 元素
    const pomoWorkInput = document.getElementById('pomo-work-input');
    const pomoBreakInput = document.getElementById('pomo-break-input');
    const pomoCyclesInput = document.getElementById('pomo-cycles-input');
    const pomoSaveBtn = document.getElementById('pomo-save-btn');
    
    const pomoStatusLabel = document.getElementById('pomo-status-label');
    const pomoCycleLabel = document.getElementById('pomo-cycle-label');
    const pomoProgressBar = document.getElementById('pomo-progress-bar');
    const pomoTimeDisplay = document.getElementById('pomo-time-display');
    
    const pomoStartBtn = document.getElementById('pomo-start-btn');
    const pomoPauseBtn = document.getElementById('pomo-pause-btn');
    const pomoResetBtn = document.getElementById('pomo-reset-btn');

    // SVG 圓環周長設定 (半徑 120, 周長 = 2 * PI * 120 ≈ 753.98)
    const POMO_CIRCUMFERENCE = 2 * Math.PI * 120;
    pomoProgressBar.style.strokeDasharray = `${POMO_CIRCUMFERENCE} ${POMO_CIRCUMFERENCE}`;
    pomoProgressBar.style.strokeDashoffset = 0;

    // 狀態變數
    let pomoState = {
        workDuration: 25 * 60, // 秒
        breakDuration: 5 * 60,  // 秒
        totalCycles: 4,        // 0 代表無限
        currentCycle: 1,
        
        mode: 'work',          // 'work' 或 'break'
        timeLeft: 25 * 60,     // 剩餘秒數
        isRunning: false,
        timerId: null
    };

    /**
     * 更新番茄鐘的顯示介面
     */
    function pomoUpdateUI() {
        // 格式化時間
        const minutes = Math.floor(pomoState.timeLeft / 60);
        const seconds = pomoState.timeLeft % 60;
        const displayStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        pomoTimeDisplay.textContent = displayStr;

        // 更新瀏覽器 Title
        if (pomoState.isRunning) {
            const modeText = pomoState.mode === 'work' ? '專注中' : '休息中';
            document.title = `(${displayStr}) ${modeText} | Aura Timer`;
        }

        // 更新狀態標籤
        if (!pomoState.isRunning && pomoState.timeLeft === pomoState.workDuration && pomoState.currentCycle === 1 && pomoState.mode === 'work') {
            pomoStatusLabel.textContent = '準備就緒';
            pomoStatusLabel.className = 'status-label text-pomodoro';
        } else if (pomoState.mode === 'work') {
            pomoStatusLabel.textContent = '專注時間';
            pomoStatusLabel.className = 'status-label text-pomodoro';
        } else {
            pomoStatusLabel.textContent = '休息時間';
            pomoStatusLabel.className = 'status-label text-sketching'; // 休息時使用紫色
        }

        // 更新組數標籤
        const totalText = pomoState.totalCycles === 0 ? '∞' : pomoState.totalCycles;
        pomoCycleLabel.textContent = `第 ${pomoState.currentCycle} / ${totalText} 組`;

        // 更新 SVG 進度圓環
        const totalDuration = pomoState.mode === 'work' ? pomoState.workDuration : pomoState.breakDuration;
        const ratio = pomoState.timeLeft / totalDuration;
        const offset = POMO_CIRCUMFERENCE * (1 - ratio);
        pomoProgressBar.style.strokeDashoffset = offset;

        // 切換開始/暫停按鈕
        if (pomoState.isRunning) {
            pomoStartBtn.classList.add('hidden');
            pomoPauseBtn.classList.remove('hidden');
        } else {
            pomoStartBtn.classList.remove('hidden');
            pomoPauseBtn.classList.add('hidden');
        }
    }

    /**
     * 讀取輸入設定並套用
     */
    function pomoApplySettings() {
        const wVal = parseInt(pomoWorkInput.value) || 25;
        const bVal = parseInt(pomoBreakInput.value) || 5;
        const cVal = parseInt(pomoCyclesInput.value);
        
        pomoState.workDuration = wVal * 60;
        pomoState.breakDuration = bVal * 60;
        pomoState.totalCycles = isNaN(cVal) ? 4 : cVal;
        
        pomoReset();
    }

    /**
     * 開始計時
     */
    function pomoStart() {
        initAudio();
        if (pomoState.isRunning) return;
        
        pomoState.isRunning = true;
        pomoUpdateUI();

        pomoState.timerId = setInterval(() => {
            if (pomoState.timeLeft > 0) {
                pomoState.timeLeft--;
                pomoUpdateUI();
            } else {
                // 時間到，進行狀態切換
                pomoHandlePhaseEnd();
            }
        }, 1000);
    }

    /**
     * 暫停計時
     */
    function pomoPause() {
        if (!pomoState.isRunning) return;
        pomoState.isRunning = false;
        clearInterval(pomoState.timerId);
        pomoUpdateUI();
    }

    /**
     * 重設計時器
     */
    function pomoReset() {
        pomoState.isRunning = false;
        clearInterval(pomoState.timerId);
        pomoState.currentCycle = 1;
        pomoState.mode = 'work';
        pomoState.timeLeft = pomoState.workDuration;
        pomoUpdateUI();
        document.title = '極致多功能計時器 | 專注、速寫與精準';
    }

    /**
     * 處理工作/休息時段結束
     */
    function pomoHandlePhaseEnd() {
        clearInterval(pomoState.timerId);
        pomoState.isRunning = false;

        if (pomoState.mode === 'work') {
            // 工作結束
            sounds.workDone();
            
            // 判斷是否需要進入休息
            if (pomoState.totalCycles === 0 || pomoState.currentCycle < pomoState.totalCycles) {
                pomoState.mode = 'break';
                pomoState.timeLeft = pomoState.breakDuration;
                pomoStart(); // 自動開始下一階段
            } else {
                // 全部組數完成
                sounds.complete();
                pomoStatusLabel.textContent = '全部完成！ 🎉';
                pomoStatusLabel.className = 'status-label text-pomodoro';
                pomoUpdateUI();
            }
        } else {
            // 休息結束，進入下一組工作
            sounds.breakDone();
            pomoState.currentCycle++;
            pomoState.mode = 'work';
            pomoState.timeLeft = pomoState.workDuration;
            pomoStart(); // 自動開始下一階段
        }
    }

    // 番茄鐘事件綁定
    pomoSaveBtn.addEventListener('click', () => {
        sounds.click();
        pomoApplySettings();
    });
    pomoStartBtn.addEventListener('click', () => {
        sounds.click();
        pomoStart();
    });
    pomoPauseBtn.addEventListener('click', () => {
        sounds.click();
        pomoPause();
    });
    pomoResetBtn.addEventListener('click', () => {
        sounds.click();
        pomoReset();
    });


    // ==========================================================================
    // 5. 速寫練習計時器 (Sketching Timer) 邏輯
    // ==========================================================================
    
    // DOM 元素
    const sketchWorkInput = document.getElementById('sketch-work-input');
    const sketchWorkCustomInput = document.getElementById('sketch-work-custom-input');
    const sketchBreakInput = document.getElementById('sketch-break-input');
    const sketchBreakCustomInput = document.getElementById('sketch-break-custom-input');
    const sketchCyclesInput = document.getElementById('sketch-cycles-input');
    const sketchKeywordInput = document.getElementById('sketch-keyword-input');
    const sketchKeywordGroup = document.getElementById('sketch-keyword-group');
    const sketchImageToggle = document.getElementById('sketch-image-toggle');
    const sketchSaveBtn = document.getElementById('sketch-save-btn');
    
    const sketchStatusLabel = document.getElementById('sketch-status-label');
    const sketchCycleLabel = document.getElementById('sketch-cycle-label');
    const sketchTimeDisplay = document.getElementById('sketch-time-display');
    const sketchProgressBar = document.getElementById('sketch-progress-bar');
    
    const sketchStartBtn = document.getElementById('sketch-start-btn');
    const sketchPauseBtn = document.getElementById('sketch-pause-btn');
    const sketchSkipBtn = document.getElementById('sketch-skip-btn');
    const sketchResetBtn = document.getElementById('sketch-reset-btn');
    
    const sketchImage = document.getElementById('sketch-image');
    const canvasPlaceholder = document.getElementById('canvas-placeholder');
    const imageLoader = document.getElementById('image-loader');
    const breakMask = document.getElementById('break-mask');
    const breakCountdownText = document.getElementById('break-countdown-text');

    // 狀態變數
    let sketchState = {
        workDuration: 60,      // 秒
        breakDuration: 10,     // 秒
        totalCycles: 10,       // 0 代表無限
        currentCycle: 1,
        keywords: 'figure, gesture',
        enableImages: true,    // 是否啟用隨機圖片素材
        
        mode: 'idle',          // 'idle', 'work' (速寫中), 'break' (換圖準備中), 'finished' (已結束)
        timeLeft: 60,
        isRunning: false,
        timerId: null,
        nextImageUrl: '',      // 預載的下一張圖片
        history: []            // 本次練習畫過的圖片 URL 清單
    };

    // 下拉選單「自訂」顯示隱藏邏輯
    sketchWorkInput.addEventListener('change', () => {
        if (sketchWorkInput.value === 'custom') {
            sketchWorkCustomInput.classList.remove('hidden');
        } else {
            sketchWorkCustomInput.classList.add('hidden');
        }
    });

    sketchBreakInput.addEventListener('change', () => {
        if (sketchBreakInput.value === 'custom') {
            sketchBreakCustomInput.classList.remove('hidden');
        } else {
            sketchBreakCustomInput.classList.add('hidden');
        }
    });

    // 圖片啟用開關事件
    sketchImageToggle.addEventListener('change', () => {
        sketchState.enableImages = sketchImageToggle.checked;
        if (sketchState.enableImages) {
            sketchKeywordGroup.classList.remove('hidden');
        } else {
            sketchKeywordGroup.classList.add('hidden');
        }
        
        // 即時重設與更新右側佔位符內容
        if (sketchState.mode === 'idle') {
            updatePlaceholderContent();
        } else if (sketchState.mode === 'work') {
            loadCurrentImage('');
        }
    });

    /**
     * 依據目前狀態更新右側佔位符中的文字說明 (在無圖片模式下特別有用)
     */
    function updatePlaceholderContent() {
        const placeholderContent = canvasPlaceholder.querySelector('.placeholder-content');
        if (!sketchState.enableImages) {
            if (sketchState.mode === 'idle') {
                placeholderContent.innerHTML = `
                    🎨
                    <h3>速寫練習中 (無圖片模式)</h3>
                    <p>已停用線上搜圖。點擊左側「開始」後，此處將進行時間倒數，您可以對照自己的實體畫冊或其它視窗的素材進行作畫。</p>
                `;
            } else if (sketchState.mode === 'work') {
                placeholderContent.innerHTML = `
                    🎨
                    <h3 class="text-sketching" style="font-size: 2.2rem; margin-top: 1rem;">專注作畫中</h3>
                    <p style="font-size: 1.1rem; margin-top: 0.5rem; color: var(--text-secondary);">請看著您手邊的練習素材進行繪製</p>
                `;
            }
        } else {
            placeholderContent.innerHTML = `
                🎨
                <h3>速寫練習畫板</h3>
                <p>點擊左側「開始」按鈕，此處將自動隨機載入主題素材圖片，並啟動作畫倒數。</p>
            `;
        }
    }

    /**
     * 動態加入縮圖到已練習圖片歷史紀錄中
     */
    function renderNewHistoryItem(url) {
        const grid = document.getElementById('sketch-history-grid');
        // 移除「尚未開始練習」的字樣
        const noHistory = grid.querySelector('.no-history-text');
        if (noHistory) {
            grid.innerHTML = '';
        }

        const itemIndex = sketchState.history.length;
        const itemDiv = document.createElement('div');
        itemDiv.className = 'history-item';
        
        // 使用 Unsplash API 提供的下載端點或原圖連結
        itemDiv.innerHTML = `
            <img class="history-thumb" src="${url}" alt="歷史圖片 #${itemIndex}">
            <div class="history-overlay">
                <a href="${url}" class="history-btn history-btn-view" target="_blank" rel="noopener">查看原圖</a>
                <a href="${url}&dl=1" class="history-btn history-btn-save" target="_blank" rel="noopener" download="sketch-${itemIndex}.jpg">下載保存</a>
            </div>
        `;
        grid.appendChild(itemDiv);
    }

    /**
     * 重設歷史圖片網格
     */
    function resetHistoryGrid() {
        sketchState.history = [];
        const grid = document.getElementById('sketch-history-grid');
        grid.innerHTML = `
            <div class="no-history-text">尚未開始練習。當您開始速寫且加載圖片後，已練習過的圖片將會呈現在此。</div>
        `;
    }

    /**
     * 取得設定參數值
     */
    function getSketchSettings() {
        let workVal = 60;
        if (sketchWorkInput.value === 'custom') {
            workVal = parseInt(sketchWorkCustomInput.value) || 60;
        } else {
            workVal = parseInt(sketchWorkInput.value);
        }

        let breakVal = 10;
        if (sketchBreakInput.value === 'custom') {
            breakVal = parseInt(sketchBreakCustomInput.value) || 10;
        } else {
            breakVal = parseInt(sketchBreakInput.value);
        }

        const cyclesVal = parseInt(sketchCyclesInput.value);
        const keywordVal = sketchKeywordInput.value.trim() || 'figure, gesture';

        return {
            work: workVal,
            break: breakVal,
            cycles: isNaN(cyclesVal) ? 10 : cyclesVal,
            keywords: keywordVal
        };
    }

    /**
     * 產生隨機 Unsplash / Picsum 圖片網址
     */
    function getRandomImageUrl() {
        const randSeed = Math.floor(Math.random() * 10000);
        const kw = encodeURIComponent(sketchState.keywords);
        // 使用 loremflickr 代替已棄用的 unsplash source 服務，確保不出現 404
        return `https://loremflickr.com/800/600/${kw}?random=${randSeed}`;
    }

    /**
     * 預載下一張圖片到記憶體中
     */
    function preloadNextImage() {
        if (!sketchState.enableImages) return;
        const url = getRandomImageUrl();
        sketchState.nextImageUrl = url;
        const img = new Image();
        img.src = url;
    }

    /**
     * 載入當前速寫圖片並渲染到畫面上 (若關閉圖片模式則改為渲染狀態文字)
     */
    function loadCurrentImage(url) {
        sketchImage.classList.remove('loaded');
        
        if (!sketchState.enableImages || !url) {
            // 無圖片模式：隱藏 loader 與圖片，更新並顯示 placeholder 大字
            imageLoader.classList.add('hidden');
            sketchImage.src = '';
            updatePlaceholderContent();
            canvasPlaceholder.classList.remove('hidden');
            return;
        }

        imageLoader.classList.remove('hidden');
        canvasPlaceholder.classList.add('hidden');

        sketchImage.src = url;
        
        sketchImage.onload = () => {
            imageLoader.classList.add('hidden');
            sketchImage.classList.add('loaded');
            
            // 圖片成功加載完成後，將網址加入歷史紀錄列表中（避免重複加入）
            if (sketchState.enableImages && !sketchState.history.includes(url)) {
                sketchState.history.push(url);
                renderNewHistoryItem(url);
            }
        };

        sketchImage.onerror = () => {
            console.error('圖片載入失敗，重試中...');
            const fallbackUrl = `https://picsum.photos/800/600?random=${new Date().getTime()}`;
            sketchImage.src = fallbackUrl;
        };
    }

    /**
     * 更新速寫練習 UI
     */
    function sketchUpdateUI() {
        // 格式化時間
        const minutes = Math.floor(sketchState.timeLeft / 60);
        const seconds = sketchState.timeLeft % 60;
        const displayStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        sketchTimeDisplay.textContent = displayStr;

        // 更新分頁標題
        if (sketchState.isRunning) {
            const modeText = sketchState.mode === 'work' ? '速寫中' : '準備換圖';
            document.title = `(${displayStr}) ${modeText} | Aura Timer`;
        }

        // 更新狀態標籤與遮罩
        if (sketchState.mode === 'idle') {
            sketchStatusLabel.textContent = '準備就緒';
            sketchStatusLabel.className = 'status-label text-sketching';
            breakMask.classList.add('hidden');
            canvasPlaceholder.classList.remove('hidden');
            sketchImage.classList.remove('loaded');
        } else if (sketchState.mode === 'finished') {
            sketchStatusLabel.textContent = '練習結束！ 🎉';
            sketchStatusLabel.className = 'status-label text-sketching';
            breakMask.classList.add('hidden');
            imageLoader.classList.add('hidden');
            // 保持最後一張圖片依然顯示，不要切換回 Placeholder
        } else if (sketchState.mode === 'work') {
            sketchStatusLabel.textContent = '速寫中...';
            sketchStatusLabel.className = 'status-label text-sketching';
            breakMask.classList.add('hidden');
        } else if (sketchState.mode === 'break') {
            sketchStatusLabel.textContent = '準備下一張';
            sketchStatusLabel.className = 'status-label text-pomodoro';
            breakMask.classList.remove('hidden');
            breakCountdownText.textContent = `請準備好畫筆，下張圖將在 ${sketchState.timeLeft} 秒後呈現...`;
        }

        // 更新組數 (張數) 標籤
        const totalText = sketchState.totalCycles === 0 ? '∞' : sketchState.totalCycles;
        sketchCycleLabel.textContent = `第 ${sketchState.currentCycle} / ${totalText} 張`;

        // 進度條
        const totalDuration = sketchState.mode === 'work' ? sketchState.workDuration : sketchState.breakDuration;
        const pct = (sketchState.timeLeft / totalDuration) * 100;
        sketchProgressBar.style.width = `${pct}%`;

        // 按鈕控制
        if (sketchState.isRunning) {
            sketchStartBtn.classList.add('hidden');
            sketchPauseBtn.classList.remove('hidden');
        } else {
            sketchStartBtn.classList.remove('hidden');
            sketchPauseBtn.classList.add('hidden');
        }
    }

    /**
     * 套用速寫設定
     */
    function sketchApplySettings() {
        const settings = getSketchSettings();
        sketchState.workDuration = settings.work;
        sketchState.breakDuration = settings.break;
        sketchState.totalCycles = settings.cycles;
        sketchState.keywords = settings.keywords;
        sketchState.enableImages = sketchImageToggle.checked;
        
        sketchReset();
    }

    /**
     * 開始計時
     */
    function sketchStart() {
        initAudio();
        if (audioCtx) audioCtx.resume();
        if (sketchState.isRunning) return;

        sketchState.isRunning = true;

        // 如果是剛從 idle 開始，則進行第一張初始化
        if (sketchState.mode === 'idle') {
            sketchState.mode = 'work';
            sketchState.timeLeft = sketchState.workDuration;
            if (sketchState.enableImages) {
                loadCurrentImage(getRandomImageUrl());
                preloadNextImage();
            } else {
                loadCurrentImage('');
            }
        }

        sketchUpdateUI();

        sketchState.timerId = setInterval(() => {
            if (sketchState.timeLeft > 0) {
                sketchState.timeLeft--;
                // 換圖準備時間時，每秒播放滴答倒數音效
                if (sketchState.mode === 'break') {
                    sounds.tick();
                }
                sketchUpdateUI();
            } else {
                sketchHandlePhaseEnd();
            }
        }, 1000);
    }

    /**
     * 暫停
     */
    function sketchPause() {
        if (!sketchState.isRunning) return;
        sketchState.isRunning = false;
        clearInterval(sketchState.timerId);
        sketchUpdateUI();
    }

    /**
     * 重設
     */
    function sketchReset() {
        sketchState.isRunning = false;
        clearInterval(sketchState.timerId);
        sketchState.currentCycle = 1;
        sketchState.mode = 'idle';
        sketchState.timeLeft = sketchState.workDuration;
        sketchState.enableImages = sketchImageToggle.checked;
        
        resetHistoryGrid();
        updatePlaceholderContent();
        sketchUpdateUI();
        document.title = '極致多功能計時器 | 專注、速寫與精準';
    }

    /**
     * 跳過功能 (Skip)
     */
    function sketchSkip() {
        sounds.click();
        if (sketchState.mode === 'idle' || sketchState.mode === 'finished') return;
        
        // 立即結束當前時段
        sketchHandlePhaseEnd();
    }

    /**
     * 處理速寫計時階段結束
     */
    function sketchHandlePhaseEnd() {
        clearInterval(sketchState.timerId);
        sketchState.isRunning = false;

        if (sketchState.mode === 'work') {
            // 工作(速寫)結束
            sounds.sketchSwitch();
            
            // 判斷是否還有下一張
            if (sketchState.totalCycles === 0 || sketchState.currentCycle < sketchState.totalCycles) {
                sketchState.mode = 'break';
                sketchState.timeLeft = sketchState.breakDuration;
                sketchUpdateUI();
                sketchStart(); // 自動開始休息倒數
            } else {
                // 全部張數完成，進入 finished 狀態，保持圖片顯示且不返回主頁
                sounds.complete();
                sketchState.mode = 'finished';
                sketchState.isRunning = false;
                sketchStatusLabel.textContent = '練習結束！ 🎉';
                sketchStatusLabel.className = 'status-label text-sketching';
                sketchUpdateUI();
            }
        } else if (sketchState.mode === 'break') {
            // 休息換圖結束，進入下一組速寫
            sounds.click();
            sketchState.currentCycle++;
            sketchState.mode = 'work';
            sketchState.timeLeft = sketchState.workDuration;
            
            if (sketchState.enableImages) {
                loadCurrentImage(sketchState.nextImageUrl || getRandomImageUrl());
                preloadNextImage();
            } else {
                loadCurrentImage('');
            }

            sketchUpdateUI();
            sketchStart(); // 自動開始下一組倒數
        }
    }

    // 速寫事件綁定
    sketchSaveBtn.addEventListener('click', () => {
        initAudio();
        if (audioCtx) audioCtx.resume();
        sounds.click();
        sketchApplySettings();
    });
    sketchStartBtn.addEventListener('click', () => {
        initAudio();
        if (audioCtx) audioCtx.resume();
        sounds.click();
        sketchStart();
    });
    sketchPauseBtn.addEventListener('click', () => {
        sounds.click();
        sketchPause();
    });
    sketchSkipBtn.addEventListener('click', sketchSkip);
    sketchResetBtn.addEventListener('click', () => {
        sounds.click();
        sketchReset();
    });


    // ==========================================================================
    // 6. 傳統碼表 (Stopwatch) 邏輯
    // ==========================================================================
    
    // DOM 元素
    const swTimeDisplay = document.getElementById('sw-time-display');
    const swStartBtn = document.getElementById('sw-start-btn');
    const swPauseBtn = document.getElementById('sw-pause-btn');
    const swLapBtn = document.getElementById('sw-lap-btn');
    const swResetBtn = document.getElementById('sw-reset-btn');
    const swLapList = document.getElementById('sw-lap-list');
    const swLapCount = document.getElementById('sw-lap-count');

    // 狀態變數
    let swState = {
        isRunning: false,
        startTime: 0,
        accumulatedTime: 0, // 以前累計的時間 (毫秒)
        currentTime: 0,     // 當前總時間 (毫秒)
        rafId: null,        // requestAnimationFrame 的 ID
        laps: []            // 計圈記錄: { lapIndex, lapTime, totalTime }
    };

    /**
     * 格式化毫秒為 hh:mm:ss.cc (cc 為百分之一秒)
     */
    function formatTime(ms) {
        let totalSec = Math.floor(ms / 1000);
        const hours = Math.floor(totalSec / 3600);
        const minutes = Math.floor((totalSec % 3600) / 60);
        const seconds = totalSec % 60;
        const centiseconds = Math.floor((ms % 1000) / 10);

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
    }

    /**
     * 碼表的主渲染迴圈 (使用 requestAnimationFrame 以達到 60fps 的超流暢渲染)
     */
    function swTick() {
        if (!swState.isRunning) return;

        const now = performance.now();
        swState.currentTime = now - swState.startTime + swState.accumulatedTime;
        
        swTimeDisplay.textContent = formatTime(swState.currentTime);
        
        swState.rafId = requestAnimationFrame(swTick);
    }

    /**
     * 開始碼表
     */
    function swStart() {
        initAudio();
        if (swState.isRunning) return;

        swState.isRunning = true;
        swState.startTime = performance.now();
        
        swStartBtn.classList.add('hidden');
        swPauseBtn.classList.remove('hidden');

        // 動態調整標題
        document.title = '碼表計時中... | Aura Timer';

        swTick();
    }

    /**
     * 暫停碼表
     */
    function swPause() {
        if (!swState.isRunning) return;

        swState.isRunning = false;
        cancelAnimationFrame(swState.rafId);
        
        // 累計當前已跑時間
        swState.accumulatedTime = swState.currentTime;

        swStartBtn.classList.remove('hidden');
        swPauseBtn.classList.add('hidden');
        
        document.title = '極致多功能計時器 | 專注、速寫與精準';
    }

    /**
     * 碼表重設
     */
    function swReset() {
        swState.isRunning = false;
        cancelAnimationFrame(swState.rafId);
        
        swState.startTime = 0;
        swState.accumulatedTime = 0;
        swState.currentTime = 0;
        swState.laps = [];

        swTimeDisplay.textContent = '00:00:00.00';
        swStartBtn.classList.remove('hidden');
        swPauseBtn.classList.add('hidden');
        
        swLapCount.textContent = '0';
        swRenderLaps();
        
        document.title = '極致多功能計時器 | 專注、速寫與精準';
    }

    /**
     * 記錄單圈時間
     */
    function swLap() {
        if (!swState.isRunning && swState.currentTime === 0) return;

        sounds.tick();

        const currentTotal = swState.currentTime;
        let prevTotal = 0;
        if (swState.laps.length > 0) {
            prevTotal = swState.laps[0].totalTime; // laps 陣列最新的一筆放在索引 0
        }
        
        const lapDuration = currentTotal - prevTotal;

        const newLap = {
            lapIndex: swState.laps.length + 1,
            lapTime: lapDuration,
            totalTime: currentTotal
        };

        // 新記錄加到最前面
        swState.laps.unshift(newLap);
        swLapCount.textContent = swState.laps.length.toString();
        
        swRenderLaps();
    }

    /**
     * 渲染計圈列表，並標示最快/慢圈
     */
    function swRenderLaps() {
        if (swState.laps.length === 0) {
            swLapList.innerHTML = `
                <tr class="no-laps-row">
                    <td colspan="3">尚無計圈記錄。點擊「計圈」記錄分段時間。</td>
                </tr>
            `;
            return;
        }

        // 找出最快與最慢的圈速 (只有在計圈大於等於 2 筆時才有意義)
        let fastestIdx = -1;
        let slowestIdx = -1;
        
        if (swState.laps.length >= 2) {
            let minVal = Infinity;
            let maxVal = -Infinity;
            
            swState.laps.forEach((lap, idx) => {
                if (lap.lapTime < minVal) {
                    minVal = lap.lapTime;
                    fastestIdx = idx;
                }
                if (lap.lapTime > maxVal) {
                    maxVal = lap.lapTime;
                    slowestIdx = idx;
                }
            });
        }

        swLapList.innerHTML = swState.laps.map((lap, idx) => {
            let className = '';
            let label = '';
            if (idx === fastestIdx) {
                className = 'lap-fastest';
                label = ' (最快)';
            } else if (idx === slowestIdx) {
                className = 'lap-slowest';
                label = ' (最慢)';
            }

            return `
                <tr class="lap-row">
                    <td>#${lap.lapIndex}</td>
                    <td class="${className}">${formatTime(lap.lapTime)}${label}</td>
                    <td>${formatTime(lap.totalTime)}</td>
                </tr>
            `;
        }).join('');
    }

    // 碼表事件綁定
    swStartBtn.addEventListener('click', () => {
        sounds.click();
        swStart();
    });
    swPauseBtn.addEventListener('click', () => {
        sounds.click();
        swPause();
    });
    swLapBtn.addEventListener('click', swLap);
    swResetBtn.addEventListener('click', () => {
        sounds.click();
        swReset();
    });

    // ==========================================================================
    // 7. 初始化與事件預載
    // ==========================================================================
    
    // 初始化首頁
    navigateTo('dashboard-section');
});
