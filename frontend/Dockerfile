# Contexto de build: raíz del repositorio (necesita /demo-data). Ver docker-compose.yml.
FROM node:22-alpine AS build
WORKDIR /src
COPY demo-data demo-data
COPY frontend/package.json frontend/package-lock.json frontend/
RUN cd frontend && npm ci --no-audit --no-fund
COPY frontend frontend
ARG VITE_DATA_MODE=api
ARG VITE_API_BASE_URL=http://localhost:8080
ENV VITE_DATA_MODE=$VITE_DATA_MODE VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN cd frontend && npm run build

FROM nginx:1.27-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/frontend/dist /usr/share/nginx/html
EXPOSE 80
