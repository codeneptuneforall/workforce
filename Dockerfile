FROM node:20-slim

# Install Chromium system dependencies
RUN apt-get update && apt-get install -y \
    libnss3 \
    libatk1.0.0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libgtk-3-0 \
    libgbm1 \
    libasound2 \
    libxss1 \
    libxtst6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose the port the app runs on
EXPOSE 10000

# Start the server
CMD ["node", "./node_modules/tsx/dist/cli.mjs", "server/index.ts"]
