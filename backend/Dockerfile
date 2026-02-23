FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
COPY scripts ./scripts

EXPOSE 5000

CMD ["sh", "-c", "npm run db:migrate:deploy && npm start"]
