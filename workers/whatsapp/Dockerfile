FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends chromium ca-certificates fonts-liberation && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm ci --no-audit --no-fund
COPY src ./src
COPY tsconfig.json ./
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
CMD ["npm","start"]
