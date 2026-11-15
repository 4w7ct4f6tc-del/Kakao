FROM node:22-slim
# ffmpeg with libass (subtitles) + fonts that cover Arabic, Latin, Hindi, CJK.
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg fonts-noto-core fonts-noto-cjk fonts-noto-color-emoji ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY . .
ENV PORT=10000
EXPOSE 10000
CMD ["node", "server.js"]
