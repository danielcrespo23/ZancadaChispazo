FROM node:22-bookworm-slim

# workerd usa los certificados del sistema para las peticiones HTTPS (p. ej. Strava);
# la imagen slim no los trae y fallaría con "TLS peer's certificate is not trusted".
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .
RUN npm run install:ci

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 5173

ENTRYPOINT ["entrypoint.sh"]
