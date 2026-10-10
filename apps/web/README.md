# Baby Atlas web app

Next.js 15 app for Baby Atlas. See the repo root `CLAUDE.md` for the stack and commands.

## Premium and AI

- `PREMIUM_EMAILS`: comma-separated emails that count as Premium. Use it for testing until payments exist.
- `ANTHROPIC_API_KEY`: needed for `/api/ai/insights` and `/api/chat`. Without it, insights return 503.
- Premium is `User.isPremium` or an email in `PREMIUM_EMAILS`. Later, RevenueCat (iOS) or Stripe (web) should set `isPremium` through a webhook.
- Non-premium users get HTTP 402 `{ "error": "premium_required" }` from both AI routes.

## iOS (Capacitor)

The app needs server routes (tRPC, NextAuth, AI), so a static export is not possible. The iOS app is a native shell that loads the hosted web app in a WebView. The `capacitor-shell/` folder only holds an offline fallback page.

### Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `CAP_SERVER_URL` | `http://localhost:3000` | URL the shell loads. Use your HTTPS production URL for release builds. `cleartext` is on only when the URL starts with `http://`. |

`CAP_SERVER_URL` is read when you run `cap sync`, so set it before syncing.

### Run in Xcode

Needs macOS, Xcode and CocoaPods. The iOS project already exists in `ios/` (created with `cap add ios`).

```bash
cd apps/web
pnpm install

# Simulator against your local dev server
pnpm dev                                   # in another terminal
CAP_SERVER_URL=http://localhost:3000 pnpm cap:sync
pnpm cap:open                              # opens Xcode
```

Then pick a simulator in Xcode and press Run.

- A physical device cannot reach `localhost`. Use your Mac's LAN IP, for example `CAP_SERVER_URL=http://192.168.1.20:3000`, and start Next with `pnpm dev -H 0.0.0.0`.
- For a release build, set `CAP_SERVER_URL` to the deployed HTTPS URL, run `pnpm cap:sync`, then archive in Xcode.
- In this pnpm workspace, `npx cap` does not resolve. Use `pnpm exec cap <command>` or the `cap:*` scripts.
- Set a signing team and the bundle id `no.babyatlas.app` in Xcode before running on a device.

### Before App Store submission

Apple may reject apps that are only a web wrapper (App Store Review Guideline 4.2, minimum functionality). Add native features before you submit, for example push notifications (`@capacitor/push-notifications`) and haptics (`@capacitor/haptics`). Premium purchases in the iOS app must use in-app purchase (RevenueCat), not Stripe.
