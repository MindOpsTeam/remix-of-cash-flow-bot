FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist/ ./dist/
ENV PORT=3000
EXPOSE 3000
CMD ["node", "dist/server.js"]
