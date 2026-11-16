#!/usr/bin/env python3
"""Add (or check) one DNS A record in an OVH zone, using the OVH API.

Credentials are read from the environment only (never printed, never stored):
    OVH_ENDPOINT            ovh-eu (default) | ovh-ca | ovh-us
    OVH_APPLICATION_KEY
    OVH_APPLICATION_SECRET
    OVH_CONSUMER_KEY        must allow GET/POST on /domain/zone/<zone>/*

Safe by default: without --apply it only reads and says what it would do.
It touches a single record and refuses to overwrite a different existing one.

    ./ovh-add-record.py example.com app 203.0.113.50            # dry run
    ./ovh-add-record.py example.com app 203.0.113.50 --apply    # do it
"""
import argparse
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.request

ENDPOINTS = {
    "ovh-eu": "https://eu.api.ovh.com/1.0",
    "ovh-ca": "https://ca.api.ovh.com/1.0",
    "ovh-us": "https://api.us.ovhcloud.com/1.0",
}


def die(msg):
    print(f"erreur : {msg}", file=sys.stderr)
    sys.exit(1)


class Ovh:
    def __init__(self):
        self.base = ENDPOINTS.get(os.environ.get("OVH_ENDPOINT", "ovh-eu"))
        if not self.base:
            die("OVH_ENDPOINT inconnu (ovh-eu, ovh-ca, ovh-us)")
        try:
            self.ak = os.environ["OVH_APPLICATION_KEY"]
            self.sk = os.environ["OVH_APPLICATION_SECRET"]
            self.ck = os.environ["OVH_CONSUMER_KEY"]
        except KeyError as e:
            die(f"variable d'environnement manquante : {e.args[0]}")
        # OVH rejects requests whose timestamp drifts from its own clock.
        self.delta = int(self._raw("GET", "/auth/time", None, auth=False)) - int(time.time())

    def _raw(self, method, path, body, auth=True):
        url = self.base + path
        data = json.dumps(body).encode() if body is not None else b""
        headers = {"Content-Type": "application/json"}
        if auth:
            ts = str(int(time.time()) + self.delta)
            sig = "$1$" + hashlib.sha1("+".join([self.sk, self.ck, method, url, data.decode(), ts]).encode()).hexdigest()
            headers.update({"X-Ovh-Application": self.ak, "X-Ovh-Consumer": self.ck, "X-Ovh-Timestamp": ts, "X-Ovh-Signature": sig})
        req = urllib.request.Request(url, data=data or None, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                return r.read().decode()
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")[:300]
            die(f"{method} {path} -> HTTP {e.code} {detail}")

    def call(self, method, path, body=None):
        raw = self._raw(method, path, body)
        return json.loads(raw) if raw else None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("zone")
    ap.add_argument("subdomain")
    ap.add_argument("ip")
    ap.add_argument("--ttl", type=int, default=300)
    ap.add_argument("--apply", action="store_true", help="really create the record (default: dry run)")
    a = ap.parse_args()

    ovh = Ovh()
    zone = f"/domain/zone/{a.zone}"
    ids = ovh.call("GET", f"{zone}/record?fieldType=A&subDomain={a.subdomain}")
    existing = [ovh.call("GET", f"{zone}/record/{i}") for i in ids]

    for rec in existing:
        if rec["target"] == a.ip:
            print(f"Déjà présent : {a.subdomain}.{a.zone} A {a.ip} (ttl {rec['ttl']}). Rien à faire.")
            return
    if existing:
        found = ", ".join(r["target"] for r in existing)
        die(f"{a.subdomain}.{a.zone} existe déjà avec une autre cible ({found}) : je ne l'écrase pas.")

    print(f"À créer : {a.subdomain}.{a.zone}  A  {a.ip}  ttl {a.ttl}")
    if not a.apply:
        print("(simulation : relancer avec --apply pour l'appliquer)")
        return
    created = ovh.call("POST", f"{zone}/record", {"fieldType": "A", "subDomain": a.subdomain, "target": a.ip, "ttl": a.ttl})
    ovh.call("POST", f"{zone}/refresh")
    print(f"Créé (id {created['id']}) et zone rafraîchie. La propagation prend quelques minutes.")


if __name__ == "__main__":
    main()
