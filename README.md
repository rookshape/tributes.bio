# Tributes

Tributes is a Linktree-style profile platform for creators, with one key difference: the top of every public profile makes it fast for visitors to send a one-time tip without creating an account.

## Planned Stack

- React
- TypeScript
- Tailwind CSS
- Firebase Auth, Firestore, Storage, and Functions
- Stripe Connect

## Product Shape

- Public creator pages at `tributes.bio/:username`
- One-time tips through Stripe Connect
- A 25% payer-side upcharge as the platform revenue model
- Creator onboarding with username reservation
- Link management, profile customization, preview, and publishing
- Creator analytics for earnings, profile views, link clicks, and payment conversion
- Personal accounts for optional spend tracking and a basic profile
- Admin tooling, moderation, SEO, legal pages, and basic email flows

## MVP

1. Landing page
2. Auth with Google, Apple, and email
3. Creator onboarding
4. Username claim flow
5. Stripe Connect onboarding
6. Basic page builder
7. Public profile page with one-time tip field and creator links
8. Simple creator analytics
9. Basic settings and admin surfaces

See [docs/product-scope.md](docs/product-scope.md) for the working product notes.

## Local Development

Use the project Node version:

```bash
nvm use
npm install
npm run dev
```

The local development Firebase app uses `tributes-bio-dev`. The real dev values live in `.env.development`, which is intentionally ignored by Git.

## Firebase Environments

This repo is set up for two Firebase environments:

- `dev`: `tributes-bio-dev`
- `prod`: pending production project/app config

Build and deploy dev hosting:

```bash
npm run deploy:dev
```

After the production Firebase project exists, add the production alias and create `.env.production` from `.env.production.example`.
