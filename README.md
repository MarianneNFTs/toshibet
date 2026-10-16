# Toshi.bet Social Club

The members' site for the Toshi.bet Social Club: velvet-curtain opening, the creed, the House, the four-step initiation (petition, Toshi.bet sign-in via `toshi.bet/r/mariannehere`, temperament reading, card), the metal card atelier, and seven easter eggs.

- `index.html` — the site (no build step)
- `registry.html` — the committee's private ledger at `/registry`
- `api/` — Vercel functions: `petition` (file or update), `status` (an applicant's decision), `registry` (password-protected list and decisions)
- `brand/` — official Toshi.bet logos, favicon and share image

## Setup on Vercel

1. Import this repo on Vercel. Framework preset **Other**; leave the build command empty.
2. In the project, open **Storage → Create Database → Upstash for Redis** (free) and connect it to the project. This sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
3. In **Settings → Environment Variables**, add `REGISTRY_PASSWORD` with a long password of your choosing.
4. Redeploy. Petitions now land in the registry at `https://<your-domain>/registry`.

Approving a petitioner switches their card from PROOF to MEMBER the next time they open the site. Wrong registry passwords are limited to 10 per 15 minutes per connection.
