"""Desktop sketch countdown timer.

Run with:

    python desktop_timer.py

This desktop companion can stay on top of other apps, which normal browser tabs
cannot reliably force.
"""

from __future__ import annotations

import time
import tkinter as tk
from tkinter import messagebox, ttk

try:
    import winsound
except ImportError:  # pragma: no cover - non-Windows fallback
    winsound = None


APP_TITLE = "Aura Sketch Desktop Timer"


class SketchTimerApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()

        self.title(APP_TITLE)
        self.geometry("520x430")
        self.minsize(360, 300)
        self.configure(bg="#0b0f19")

        self.work_seconds = tk.DoubleVar(value=90)
        self.break_seconds = tk.DoubleVar(value=10)
        self.total_rounds = tk.IntVar(value=10)
        self.always_on_top = tk.BooleanVar(value=True)
        self.compact_mode = tk.BooleanVar(value=False)
        self.sound_enabled = tk.BooleanVar(value=True)
        self.work_frequency = tk.IntVar(value=880)
        self.break_frequency = tk.IntVar(value=660)
        self.done_frequency = tk.IntVar(value=1040)
        self.beep_duration_ms = tk.IntVar(value=180)

        self.phase = "idle"
        self.current_round = 1
        self.work_duration = 90.0
        self.break_duration = 10.0
        self.total_rounds_value = 10
        self.work_frequency_value = 880
        self.break_frequency_value = 660
        self.done_frequency_value = 1040
        self.beep_duration_value = 180
        self.time_left = 90.0
        self.deadline = 0.0
        self.running = False
        self.after_id: str | None = None
        self.current_page = "timer"

        self._build_styles()
        self._build_ui()
        self._bind_keys()
        self._load_settings(show_error=False)
        self._apply_topmost()
        self._show_timer_page()
        self._sync_ui()

    def _build_styles(self) -> None:
        self.style = ttk.Style(self)
        self.style.theme_use("clam")
        self.style.configure(".", background="#0b0f19", foreground="#f8fafc", font=("Segoe UI", 10))
        self.style.configure("App.TFrame", background="#0b0f19")
        self.style.configure("Card.TFrame", background="#121826")
        self.style.configure("Title.TLabel", background="#0b0f19", foreground="#f8fafc", font=("Segoe UI", 16, "bold"))
        self.style.configure("Muted.TLabel", background="#0b0f19", foreground="#94a3b8")
        self.style.configure("Card.TLabel", background="#121826", foreground="#f8fafc")
        self.style.configure("SmallCard.TLabel", background="#121826", foreground="#94a3b8", font=("Segoe UI", 9))
        self.style.configure("Timer.TLabel", background="#121826", foreground="#f8fafc", font=("Segoe UI", 44, "bold"))
        self.style.configure("Status.TLabel", background="#121826", foreground="#b388ff", font=("Segoe UI", 12, "bold"))
        self.style.configure("Hint.TLabel", background="#121826", foreground="#94a3b8", font=("Segoe UI", 10))
        self.style.configure("TButton", padding=(12, 8), font=("Segoe UI", 10, "bold"), background="#1f2937", foreground="#f8fafc")
        self.style.map(
            "TButton",
            background=[("pressed", "#334155"), ("active", "#293548"), ("focus", "#293548")],
            foreground=[("pressed", "#ffffff"), ("active", "#ffffff"), ("focus", "#ffffff")],
        )
        self.style.configure("Primary.TButton", background="#f8fafc", foreground="#0b0f19")
        self.style.map(
            "Primary.TButton",
            background=[("pressed", "#cbd5e1"), ("active", "#dbeafe"), ("focus", "#dbeafe")],
            foreground=[("pressed", "#0b0f19"), ("active", "#0b0f19"), ("focus", "#0b0f19")],
        )
        self.style.configure("Danger.TButton", background="#ef4444", foreground="#ffffff")
        self.style.map(
            "Danger.TButton",
            background=[("pressed", "#b91c1c"), ("active", "#dc2626"), ("focus", "#dc2626")],
            foreground=[("pressed", "#ffffff"), ("active", "#ffffff"), ("focus", "#ffffff")],
        )
        self.style.configure("TCheckbutton", background="#0b0f19", foreground="#f8fafc")
        self.style.configure("TSpinbox", fieldbackground="#0b0f19", foreground="#f8fafc")

    def _build_ui(self) -> None:
        self.columnconfigure(0, weight=1)
        self.rowconfigure(1, weight=1)

        header = ttk.Frame(self, style="App.TFrame", padding=(18, 16, 18, 8))
        header.grid(row=0, column=0, sticky="ew")
        header.columnconfigure(0, weight=1)
        ttk.Label(header, text="速寫桌面倒數計時器", style="Title.TLabel").grid(row=0, column=0, sticky="w")
        ttk.Label(header, text="可置頂，不受瀏覽器限制", style="Muted.TLabel").grid(row=1, column=0, sticky="w", pady=(4, 0))
        self.header_settings_button = ttk.Button(header, text="設定", command=self._show_settings_page)
        self.header_settings_button.grid(row=0, column=1, rowspan=2, sticky="e")

        self.body = ttk.Frame(self, style="App.TFrame")
        self.body.grid(row=1, column=0, sticky="nsew")
        self.body.columnconfigure(0, weight=1)
        self.body.rowconfigure(0, weight=1)

        self.timer_page = ttk.Frame(self.body, style="App.TFrame")
        self.timer_page.grid(row=0, column=0, sticky="nsew")
        self.timer_page.columnconfigure(0, weight=1)
        self.timer_page.rowconfigure(0, weight=1)

        self.settings_page = ttk.Frame(self.body, style="App.TFrame", padding=(18, 8, 18, 18))
        self.settings_page.grid(row=0, column=0, sticky="nsew")
        self.settings_page.columnconfigure(0, weight=1)

        self._build_timer_page()
        self._build_settings_page()

    def _build_timer_page(self) -> None:
        self.timer_card = ttk.Frame(self.timer_page, style="Card.TFrame", padding=20)
        self.timer_card.grid(row=0, column=0, sticky="ew", padx=18, pady=(8, 14))
        self.timer_card.columnconfigure(0, weight=1)

        self.status_label = ttk.Label(self.timer_card, text="準備就緒", style="Status.TLabel", anchor="center")
        self.status_label.grid(row=0, column=0, sticky="ew")
        self.phase_hint_label = ttk.Label(self.timer_card, text="設定完成後按開始", style="Hint.TLabel", anchor="center")
        self.phase_hint_label.grid(row=1, column=0, sticky="ew", pady=(4, 0))
        self.time_label = ttk.Label(self.timer_card, text="01:30", style="Timer.TLabel", anchor="center")
        self.time_label.grid(row=2, column=0, sticky="ew", pady=(6, 4))
        self.round_label = ttk.Label(self.timer_card, text="第 1 / 10 張", style="Card.TLabel", anchor="center")
        self.round_label.grid(row=3, column=0, sticky="ew")
        self.progress = ttk.Progressbar(self.timer_card, maximum=100, value=100)
        self.progress.grid(row=4, column=0, sticky="ew", pady=(14, 0))

        controls = ttk.Frame(self.timer_page, style="App.TFrame", padding=(18, 0, 18, 18))
        controls.grid(row=1, column=0, sticky="ew")
        for col in range(5):
            controls.columnconfigure(col, weight=1)

        self.start_pause_button = ttk.Button(controls, text="開始", style="Primary.TButton", command=self.toggle_start_pause)
        self.start_pause_button.grid(row=0, column=0, sticky="ew", padx=(0, 6))
        ttk.Button(controls, text="下一張", command=self.skip_phase).grid(row=0, column=1, sticky="ew", padx=6)
        ttk.Button(controls, text="重設", command=self.reset_timer).grid(row=0, column=2, sticky="ew", padx=6)
        ttk.Button(controls, text="設定", command=self._show_settings_page).grid(row=0, column=3, sticky="ew", padx=6)
        ttk.Button(controls, text="退出", style="Danger.TButton", command=self.destroy).grid(row=0, column=4, sticky="ew", padx=(6, 0))

    def _build_settings_page(self) -> None:
        card = ttk.Frame(self.settings_page, style="Card.TFrame", padding=16)
        card.grid(row=0, column=0, sticky="ew")
        for col in range(2):
            card.columnconfigure(col, weight=1)

        ttk.Label(card, text="計時設定", style="Card.TLabel", font=("Segoe UI", 12, "bold")).grid(row=0, column=0, columnspan=2, sticky="w")
        self._add_spinbox(card, "作畫秒數", self.work_seconds, 1, 0, 0.5, 3600, 0.5)
        self._add_spinbox(card, "換圖秒數", self.break_seconds, 1, 1, 0, 600, 0.5)
        self._add_spinbox(card, "張數 (0 無限)", self.total_rounds, 2, 0, 0, 999, 1)

        options = ttk.Frame(card, style="Card.TFrame")
        options.grid(row=2, column=1, sticky="ew", padx=6, pady=(12, 0))
        ttk.Checkbutton(options, text="保持視窗置頂", variable=self.always_on_top, command=self._apply_topmost).grid(row=0, column=0, sticky="w")
        ttk.Checkbutton(options, text="小窗模式", variable=self.compact_mode, command=self._toggle_compact).grid(row=1, column=0, sticky="w", pady=(6, 0))

        sound_card = ttk.Frame(self.settings_page, style="Card.TFrame", padding=16)
        sound_card.grid(row=1, column=0, sticky="ew", pady=(12, 0))
        for col in range(2):
            sound_card.columnconfigure(col, weight=1)

        ttk.Label(sound_card, text="提示音設定", style="Card.TLabel", font=("Segoe UI", 12, "bold")).grid(row=0, column=0, columnspan=2, sticky="w")
        ttk.Checkbutton(sound_card, text="啟用提示音", variable=self.sound_enabled).grid(row=1, column=0, sticky="w", padx=6, pady=(12, 0))
        self._add_spinbox(sound_card, "作畫結束頻率 (Hz)", self.work_frequency, 2, 0, 37, 32767, 10)
        self._add_spinbox(sound_card, "換圖結束頻率 (Hz)", self.break_frequency, 2, 1, 37, 32767, 10)
        self._add_spinbox(sound_card, "全部完成頻率 (Hz)", self.done_frequency, 3, 0, 37, 32767, 10)
        self._add_spinbox(sound_card, "提示音長度 (ms)", self.beep_duration_ms, 3, 1, 20, 2000, 10)
        ttk.Label(sound_card, text="Windows 使用 winsound.Beep；其他系統會退回一般系統提示音。", style="SmallCard.TLabel").grid(row=4, column=0, columnspan=2, sticky="w", padx=6, pady=(10, 0))

        actions = ttk.Frame(self.settings_page, style="App.TFrame", padding=(0, 14, 0, 0))
        actions.grid(row=2, column=0, sticky="ew")
        actions.columnconfigure(0, weight=1)
        actions.columnconfigure(1, weight=1)
        ttk.Button(actions, text="儲存並返回", style="Primary.TButton", command=self._save_settings_and_return).grid(row=0, column=0, sticky="ew", padx=(0, 8))
        ttk.Button(actions, text="取消", command=self._show_timer_page).grid(row=0, column=1, sticky="ew", padx=(8, 0))

    def _add_spinbox(
        self,
        parent: ttk.Frame,
        label: str,
        variable: tk.Variable,
        row: int,
        column: int,
        from_: float,
        to: float,
        increment: float,
    ) -> None:
        frame = ttk.Frame(parent, style="Card.TFrame")
        frame.grid(row=row, column=column, sticky="ew", padx=6, pady=(12, 0))
        ttk.Label(frame, text=label, style="Card.TLabel").grid(row=0, column=0, sticky="w")
        spinbox = ttk.Spinbox(frame, from_=from_, to=to, increment=increment, textvariable=variable, width=12)
        spinbox.grid(row=1, column=0, sticky="ew", pady=(6, 0))

    def _bind_keys(self) -> None:
        self.bind("<space>", lambda _event: self.toggle_start_pause())
        self.bind("<Key-r>", lambda _event: self.reset_timer())
        self.bind("<Key-R>", lambda _event: self.reset_timer())
        self.bind("<Key-n>", lambda _event: self.skip_phase())
        self.bind("<Key-N>", lambda _event: self.skip_phase())
        self.bind("<Key-c>", lambda _event: self._toggle_compact_from_key())
        self.bind("<Key-C>", lambda _event: self._toggle_compact_from_key())
        self.bind("<Key-s>", lambda _event: self._show_settings_page())
        self.bind("<Key-S>", lambda _event: self._show_settings_page())
        self.bind("<Escape>", lambda _event: self._show_timer_page())
        self.protocol("WM_DELETE_WINDOW", self.destroy)

    def _show_timer_page(self) -> None:
        self.current_page = "timer"
        self.settings_page.grid_remove()
        self.timer_page.grid()
        self.header_settings_button.configure(text="設定", command=self._show_settings_page)
        self._toggle_compact()

    def _show_settings_page(self) -> None:
        if self.compact_mode.get():
            self.compact_mode.set(False)
            self._toggle_compact()
        self.current_page = "settings"
        self.timer_page.grid_remove()
        self.settings_page.grid()
        self.header_settings_button.configure(text="返回", command=self._show_timer_page)
        self.geometry("560x520")
        self.resizable(True, True)

    def _save_settings_and_return(self) -> None:
        if not self._load_settings():
            return

        if self.phase in {"idle", "done"}:
            self.phase = "idle"
            self.current_round = 1
            self.time_left = self.work_duration
            self.start_pause_button.configure(text="開始")
        self._sync_ui()
        self._show_timer_page()

    def _toggle_compact_from_key(self) -> None:
        if self.current_page == "settings":
            return
        self.compact_mode.set(not self.compact_mode.get())
        self._toggle_compact()

    def _apply_topmost(self) -> None:
        self.attributes("-topmost", self.always_on_top.get())

    def _toggle_compact(self) -> None:
        if self.current_page != "timer":
            return

        compact = self.compact_mode.get()
        if compact:
            self.geometry("340x220")
            self.resizable(False, False)
        else:
            self.geometry("520x430")
            self.resizable(True, True)
        self._apply_topmost()

    def toggle_start_pause(self) -> None:
        if self.current_page == "settings":
            return
        if self.running:
            self.pause_timer()
        else:
            self.start_timer()

    def start_timer(self) -> None:
        if self.phase in {"idle", "done"}:
            if not self._load_settings():
                return
            self.phase = "work"
            self.current_round = 1
            self.time_left = self.work_duration

        self.running = True
        self.deadline = time.monotonic() + self.time_left
        self.start_pause_button.configure(text="暫停")
        self._tick()

    def pause_timer(self) -> None:
        if not self.running:
            return

        self.running = False
        if self.after_id is not None:
            self.after_cancel(self.after_id)
            self.after_id = None
        self.time_left = max(0.0, self.deadline - time.monotonic())
        self.start_pause_button.configure(text="繼續")
        self._sync_ui()

    def reset_timer(self) -> None:
        self.running = False
        if self.after_id is not None:
            self.after_cancel(self.after_id)
            self.after_id = None

        self._load_settings(show_error=False)
        self.phase = "idle"
        self.current_round = 1
        self.time_left = self.work_duration
        self.start_pause_button.configure(text="開始")
        self._sync_ui()

    def skip_phase(self) -> None:
        if self.current_page == "settings":
            return
        if self.phase == "idle":
            self.start_timer()
            return
        if self.phase == "done":
            self.reset_timer()
            return
        self._complete_phase()

    def _tick(self) -> None:
        self.time_left = max(0.0, self.deadline - time.monotonic())
        self._sync_ui()

        if self.time_left <= 0:
            self._complete_phase()
            return

        self.after_id = self.after(100, self._tick)

    def _complete_phase(self) -> None:
        completed_phase = self.phase

        if self.phase == "work":
            if self.total_rounds_value != 0 and self.current_round >= self.total_rounds_value:
                self.phase = "done"
                self.running = False
                self.time_left = 0
                self._beep("done")
                self.start_pause_button.configure(text="重新開始")
                self._sync_ui()
                return

            self._beep(completed_phase)
            self.phase = "break"
            self.time_left = self.break_duration
        else:
            self._beep(completed_phase)
            self.current_round += 1
            self.phase = "work"
            self.time_left = self.work_duration

        if self.running:
            self.deadline = time.monotonic() + self.time_left
            self._tick()
        else:
            self._sync_ui()

    def _load_settings(self, show_error: bool = True) -> bool:
        try:
            self.work_duration = max(0.5, min(3600.0, float(self.work_seconds.get())))
            self.break_duration = max(0.0, min(600.0, float(self.break_seconds.get())))
            self.total_rounds_value = max(0, min(999, int(self.total_rounds.get())))
            self.work_frequency_value = max(37, min(32767, int(self.work_frequency.get())))
            self.break_frequency_value = max(37, min(32767, int(self.break_frequency.get())))
            self.done_frequency_value = max(37, min(32767, int(self.done_frequency.get())))
            self.beep_duration_value = max(20, min(2000, int(self.beep_duration_ms.get())))
        except (tk.TclError, ValueError):
            if show_error:
                messagebox.showerror("設定錯誤", "請輸入有效的秒數、張數與提示音參數。")
            return False

        self.work_seconds.set(self.work_duration)
        self.break_seconds.set(self.break_duration)
        self.total_rounds.set(self.total_rounds_value)
        self.work_frequency.set(self.work_frequency_value)
        self.break_frequency.set(self.break_frequency_value)
        self.done_frequency.set(self.done_frequency_value)
        self.beep_duration_ms.set(self.beep_duration_value)
        return True

    def _sync_ui(self) -> None:
        display_seconds = max(0.0, self.time_left)
        minutes = int(display_seconds // 60)
        seconds = int(display_seconds % 60)
        tenths = int((display_seconds - int(display_seconds)) * 10)

        if display_seconds < 10 and self.phase not in {"idle", "done"}:
            time_text = f"{seconds:02d}.{tenths}"
        else:
            time_text = f"{minutes:02d}:{seconds:02d}"

        self.time_label.configure(text=time_text)

        if self.phase == "idle":
            status = "準備就緒"
            hint = "設定完成後按開始"
        elif self.phase == "work":
            status = "作畫中"
            hint = "目前這張正在倒數"
        elif self.phase == "break":
            status = "下一張倒數"
            hint = "換圖等待時間正在倒數"
        else:
            status = "完成！"
            hint = "本輪速寫已完成"
        self.status_label.configure(text=status)
        self.phase_hint_label.configure(text=hint)

        total_text = "∞" if self.total_rounds_value == 0 else str(self.total_rounds_value)
        if self.phase == "break":
            next_round = self.current_round + 1
            self.round_label.configure(text=f"準備第 {next_round} / {total_text} 張")
        else:
            self.round_label.configure(text=f"第 {self.current_round} / {total_text} 張")

        duration = self.work_duration if self.phase in {"idle", "work", "done"} else self.break_duration
        progress_value = 100 if duration <= 0 else max(0.0, min(100.0, (display_seconds / duration) * 100))
        self.progress.configure(value=progress_value)

        self.title(f"{time_text} - {status} | {APP_TITLE}")

    def _beep(self, phase: str) -> None:
        if not self.sound_enabled.get():
            return

        frequency_by_phase = {
            "work": self.work_frequency_value,
            "break": self.break_frequency_value,
            "done": self.done_frequency_value,
        }

        if winsound is not None:
            winsound.Beep(frequency_by_phase.get(phase, self.work_frequency_value), self.beep_duration_value)
        else:
            self.bell()


def main() -> int:
    app = SketchTimerApp()
    app.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
