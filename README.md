# GatoPago Negocios

The merchant console of GatoPago Flow at `business.gatopago.com`: charges, API keys, webhooks and
events. Networks are testnets: do not send real funds.

## Signing in

The console has no passwords and no users of its own: a merchant is a GatoPago member, and the
console's session is one that Wallet Core issues for Business only (Flow accepts it, the wallet's
own endpoints refuse it). There are two ways in:

- **QR approved from the app (main):** the console asks Wallet Core for a sign-in request
  (`POST /app/v1/business-login`) and shows its `approve_url` as a QR. The member scans it with
  GatoPago (or the phone's camera), sees this browser and its approximate place, and approves with
  their passkey: a SIWE message whose nonce is the request. The console polls with the request's
  secret, which never leaves this browser, and receives the session once. A request lasts two
  minutes; the QR renews itself a few times while the page is open.
- **The same passkey:** passkeys belong to `gatopago.com`, and this console is a subdomain of it, so
  the browser can use them here directly, or on a phone through its own QR (Bluetooth needed). The
  account signs a SIWE message for this origin.
- **Mera accounts:** their passkey's PRF output derives the key that owns the account, exactly as
  the app derives it; the console derives it the same way, signs in, and ends the signing session.

The passkey never leaves the device in either case.

## Development

Node 24 and pnpm 11. Put the settings below in `.env.development.local` (development) and
`.env.production.local` (builds); both are ignored by git.

```sh
pnpm install --frozen-lockfile
pnpm dev          # http://localhost:3001
```

Checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

## Configuration

Every variable is public. Set them in Vercel (_Settings → Environment Variables_) and redeploy; a
missing required one fails the build.

| Name                       | Required | What it is                                               | How to get it                                                              |
| -------------------------- | -------- | -------------------------------------------------------- | -------------------------------------------------------------------------- |
| `GATOPAGO_BUSINESS_ORIGIN` | yes      | This console's origin                                    | `https://business.gatopago.com`                                            |
| `GATOPAGO_WEB_ORIGIN`      | yes      | The GatoPago app: the passkeys' domain and the QR's link | `https://gatopago.com`                                                     |
| `GATOPAGO_API_ORIGIN`      | yes      | Wallet Core (sign-in) and Flow (data)                    | `https://api.gatopago.com`                                                 |
| `GATOPAGO_HOME_NETWORK`    | yes      | Where merchants receive; accounts are read there         | Flow's `HOME_NETWORK`                                                      |
| `GATOPAGO_WALLET_RPC_URLS` | no       | `{"<network>": "<url>"}`: RPC for the browser's reads    | The web's Alchemy app, with `business.gatopago.com` added to its allowlist |

Wallet Core and Flow accept this console's origin through their `BUSINESS_ORIGIN` variable. Pages
are served with a per-request CSP nonce that allows connections only to the API and the networks'
RPCs. `@gatopago/shared` and `@gatopago/brand` come from `vendor/`.
