@echo off
chcp 65001 >nul
title Убежище: сервер
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Не найден Node.js.
  echo Установите его с сайта https://nodejs.org ^(версия LTS, Windows Installer .msi^)
  echo и запустите этот файл снова.
  pause
  exit /b 1
)
echo Запускаем «Убежище»: сервер и туннель tuna...
echo.
node "%~dp0app\server\launcher.js"
echo.
echo Сервер остановлен.
pause
