#!/usr/bin/env bash
# Собирает пакет «сервер на компьютере»: готовый JS, запуск двойным щелчком, инструкция.
# Запуск: bash tools/make_pc_server.sh  → dist-pc/ubezhishe-pc-server.zip
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=dist-pc/ubezhishe-pc-server
rm -rf dist-pc && mkdir -p "$OUT"
(cd server && tsc -p tsconfig.json ${TYPEROOTS:+--typeRoots "$TYPEROOTS"})
cp -r server/dist "$OUT/app"
cp pc-server/* "$OUT/"
# Windows-файлы: перевод строк CRLF
for f in "$OUT"/*.bat "$OUT"/*.txt; do sed -i 's/\r\{0,1\}$/\r/' "$f"; done
(cd dist-pc && zip -qr ubezhishe-pc-server.zip ubezhishe-pc-server)
echo "Готово: dist-pc/ubezhishe-pc-server.zip"
