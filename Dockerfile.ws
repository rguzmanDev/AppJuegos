# syntax = docker/dockerfile:1

ARG NODE_VERSION=22.21.1
FROM node:${NODE_VERSION}-slim

WORKDIR /app

ENV NODE_ENV="production"

COPY package-lock.json package.json ./
RUN npm ci --include=dev

COPY server ./server
COPY src/lib ./src/lib
COPY tsconfig.json ./

ENV PORT=3001
ENV HOSTNAME=0.0.0.0

EXPOSE 3001

CMD [ "npm", "run", "server" ]
