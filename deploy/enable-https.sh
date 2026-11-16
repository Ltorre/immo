#!/bin/bash
# Second phase of the nginx deployment: issue the Let's Encrypt certificate, then
# switch the site from "HTTP only" to the full HTTPS config. Idempotent and safe:
# the nginx configuration is tested before every reload and restored on failure.
#
# Usage:  enable-https.sh <domain> <path-to-full-site.conf>
# Needs:  the DNS A record of <domain> pointing at this server, the containers
#         "nginx-proxy" and "nginx-certbot" running, write access to conf.d.
set -euo pipefail

DOMAIN="${1:?domain}"
FULL_CONF="${2:?path to the complete site conf (HTTP + HTTPS blocks)}"
CONFD="${CONFD:?set CONFD to the nginx conf.d directory (host path)}"
TARGET="$CONFD/$DOMAIN.conf"

reload() {
  docker exec nginx-proxy nginx -t
  docker exec nginx-proxy nginx -s reload
}

rollback() {
  echo "!! failure: restoring previous nginx config" >&2
  if [ -f "$TARGET.prev" ]; then cp "$TARGET.prev" "$TARGET"; fi
  docker exec nginx-proxy nginx -t && docker exec nginx-proxy nginx -s reload || true
}

[ -f "$FULL_CONF" ] || { echo "missing $FULL_CONF" >&2; exit 1; }
cp -p "$TARGET" "$TARGET.prev"
trap rollback ERR

if docker exec nginx-certbot test -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem"; then
  echo "certificate for $DOMAIN already present"
else
  echo "requesting a certificate for $DOMAIN (HTTP-01 through the public /.well-known path)"
  docker exec nginx-certbot certbot certonly --webroot -w /var/www/certbot \
    -d "$DOMAIN" --non-interactive --agree-tos
fi

cp "$FULL_CONF" "$TARGET"
reload
trap - ERR
echo "HTTPS enabled for $DOMAIN"
