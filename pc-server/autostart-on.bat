@echo off
chcp 65001 >nul
title Убежище: автозапуск
set "LNK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Убежище - сервер.lnk"
powershell -NoProfile -Command "$s = (New-Object -ComObject WScript.Shell).CreateShortcut($env:LNK); $s.TargetPath = '%~dp0start.bat'; $s.WorkingDirectory = '%~dp0'; $s.WindowStyle = 7; $s.Save()"
if errorlevel 1 (
  echo Не удалось включить автозапуск.
) else (
  echo Готово: сервер будет запускаться сам при входе в Windows ^(окно свёрнуто^).
  echo Если перенесёте эту папку в другое место — запустите этот файл ещё раз.
)
pause
