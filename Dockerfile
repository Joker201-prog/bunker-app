# Игровой сервер «Убежища». Собирает только папку server и общую логику игры.
FROM node:22-alpine AS build
WORKDIR /app
RUN npm install -g typescript@6.0.3 && npm install --no-save @types/node@22
COPY server ./server
COPY src/game ./src/game
COPY src/data ./src/data
RUN cd server && tsc -p tsconfig.json --typeRoots /app/node_modules/@types

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/server/dist ./dist
ENV PORT=80
EXPOSE 80
CMD ["node", "dist/server/server.js"]
