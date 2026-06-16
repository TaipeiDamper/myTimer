# 桌面速寫倒數計時器

這是獨立於 `myTimer_html` 網頁版的桌面倒數計時器，使用 Python 標準庫 `tkinter` 實作，不需要額外安裝套件。

## 啟動

```powershell
python .\desktop_timer\desktop_timer.py
```

Windows 也可以直接雙擊：

```text
run_desktop_timer.bat
```

## 功能

- 作畫倒數與換圖倒數。
- 張數設定，`0` 代表無限循環。
- 獨立設定頁，可調整作畫秒數、換圖秒數、張數、置頂與小窗模式。
- 提示音設定，可調整作畫結束、換圖結束、全部完成的音頻率與提示音長度。
- 開始、暫停、繼續、下一張、重設。
- 視窗置頂，適合放在繪圖軟體上方。
- 小窗模式，只保留倒數與控制按鈕。
- 快捷鍵：`Space` 開始/暫停、`N` 下一張、`R` 重設、`C` 切換小窗、`S` 開啟設定、`Esc` 返回計時器。

## 打包成 exe

之後如果要打包，可先安裝 PyInstaller：

```powershell
python -m pip install pyinstaller
```

再執行：

```powershell
cd desktop_timer
pyinstaller --onefile --windowed --name AuraSketchTimer desktop_timer.py
```

輸出會在 `dist/AuraSketchTimer.exe`。
