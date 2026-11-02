@echo off
chcp 65001 >nul
title Убежище: сервер
where node >nul 2>nul
if errorlevel 1 (
  echo Не найден Node.js.
  echo Установите его с сайта https://nodejs.org ^(кнопка LTS^) и запустите этот файл снова.
  pause
  exit /b 1
)
set PORT=8080
echo Запускаем сервер «Убежища» на порту %PORT%...
echo Не закрывайте это окно, пока идёт игра.
echo.
node "%~dp0app\server\server.js"
echo.
echo Сервер остановлен.
pause
