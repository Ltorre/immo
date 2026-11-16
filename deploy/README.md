# Deployment (behind the existing nginx-proxy on the VPS)

The site is static. It is served by a tiny non-root nginx container (`immo`) on the Docker network
`nginx-proxy-network`; the shared `nginx-proxy` container terminates TLS (Let's Encrypt via `nginx-certbot`).
It is public: there is no IP allowlist.

1. **DNS**: an `A` record `immo` → the server IP (no `AAAA`). `ovh-add-record.py` can do it (run it yourself, it reads OVH credentials from your environment):
   `./ovh-add-record.py lucien.corsica immo <server-ip> --apply`
2. **Image** (built locally, nothing compiled on the server):
   `docker build -t immo:prod . && docker save immo:prod | gzip | ssh VPS 'gunzip | docker load'`
3. **Container**: copy `docker-compose.yml` to `/home/pool/immo/` on the server and run `docker compose up -d`.
4. **nginx, phase 1**: copy `nginx/immo.lucien.corsica.http.conf` to `conf.d/immo.lucien.corsica.conf`, then
   `docker exec nginx-proxy nginx -t && docker exec nginx-proxy nginx -s reload`.
5. **nginx, phase 2** (once the DNS resolves): `CONFD=/home/pool/nginx-proxy/conf.d ./enable-https.sh immo.lucien.corsica nginx/immo.lucien.corsica.conf`
   requests the certificate, then enables the HTTPS block. The script tests the configuration before each reload and restores the previous one on failure
   (a site must never reference a certificate that does not exist yet, or `nginx -t` fails for **every** site of the proxy).

Update: repeat step 2, then `docker compose up -d --force-recreate` on the server.
