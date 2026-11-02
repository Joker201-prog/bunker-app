@echo off
chcp 65001 >nul
title Убежище: туннель tuna
where tuna >nul 2>nul
if errorlevel 1 (
  echo Не найдена программа tuna.
  echo Установите её по инструкции в файле README.txt и запустите этот файл снова.
  pause
  exit /b 1
)
set SUB=
if exist "%~dp0subdomain.txt" set /p SUB=<"%~dp0subdomain.txt"
if defined SUB (
  echo Открываем постоянный адрес %SUB%.ru.tuna.am
  echo Не закрывайте это окно, пока идёт игра.
  echo.
  tuna http 8080 --subdomain=%SUB%
) else (
  echo Постоянный поддомен не указан: адрес будет меняться при каждом запуске.
  echo Адрес появится ниже — впишите его в приложении.
  echo.
  tuna http 8080
)
pause
