@echo off
chcp 65001 >nul
title Убежище: автозапуск
set "LNK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Убежище - сервер.lnk"
if exist "%LNK%" (
  del "%LNK%"
  echo Автозапуск выключен.
) else (
  echo Автозапуск и так выключен.
)
pause
