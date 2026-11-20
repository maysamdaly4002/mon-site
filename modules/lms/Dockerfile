# API LMS autonome — image de production
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
# tsx (exécuteur TypeScript) est une devDependency : on installe tout, puis on exécute directement les sources.
RUN (npm ci --include=dev --no-audit --no-fund || npm install --include=dev --no-audit --no-fund) && npm cache clean --force
COPY tsconfig.json ./
COPY core ./core
COPY adapters ./adapters
COPY src ./src
COPY seed ./seed
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT:-3000}/health || exit 1
# Les migrations sont idempotentes : appliquées au démarrage, une seule fois chacune.
CMD ["sh", "-c", "npm run db:migrate && exec npm start"]
