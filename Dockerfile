FROM node:22-bookworm-slim

WORKDIR /app

COPY . .
RUN npm run install:ci

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 5173

ENTRYPOINT ["entrypoint.sh"]
