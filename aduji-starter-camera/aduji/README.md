# Aduji — creator-first short video social app

A responsive React + TypeScript + Vite starter integrated with the Supabase project settings supplied by the owner.

## Included in this starter

- Supabase email/password sign-up and sign-in
- Google OAuth UI and callback flow (provider credentials must be configured in Supabase)
- Creator profiles, public video feed, likes, comments, follows, bookmarks
- Video upload to Supabase Storage
- Search, topic discovery, transparent MVP feed ranking
- Live-session record creation (not actual live video broadcasting)
- SQL schema and Row Level Security policies

## Setup

1. Install Node.js 20+.
2. Copy `.env.example` to `.env`. The supplied project URL and publishable key are already filled in there.
3. Run `npm install`, then `npm run dev`.
4. Open the local URL printed by Vite.
5. In Supabase Dashboard → SQL Editor, run `supabase/schema.sql`.
6. In Supabase Dashboard → Authentication → URL Configuration, set the Site URL and add local/deployed redirect URLs.
7. In Authentication → Providers → Google, enable Google and enter the OAuth client ID and secret from your Google Cloud project.

## Important limitations — read before launch

This is a runnable starter, not a claim that a complete TikTok-scale platform has been deployed or tested against your hosted database.

- The demo feed uses public sample video URLs. They may be unavailable or rate-limited. Sample creator names and engagement counts are illustrative, not real accounts.
- Real uploaded videos need the SQL schema and `videos` Storage bucket policies applied in Supabase.
- Live page/session records are included, but live camera/microphone broadcasting, viewer playback, chat, stream recording, and stream-token security require a streaming service such as a managed WebRTC/RTMP provider plus server-side Edge Functions. The app deliberately does not claim the session-record button starts a broadcast.
- The starter feed ranker is a simple client-side heuristic using recency and engagement. It is not a trained AI recommendation system. A production ranking system should measure watch duration/completion, skips, explicit feedback, follows, topic interests, creator diversity, freshness, and safety/moderation outcomes, with privacy controls and anti-spam protections.
- Counters are currently sample/local display values; production likes/views/comment counters should be maintained transactionally by database functions/triggers.
- No automated moderation, age assurance, copyright scanning, DM system, push notifications, creator payouts, or production admin console is included yet.
- Before launch, test RLS policies, set up reporting/moderation workflows, rate limits, video transcoding/CDN, backups, observability, terms/privacy documents, and incident response.

## Security

The publishable key is meant for browser use. Never add a Supabase secret/service-role key to `.env` variables prefixed with `VITE_`, source code, or browser bundles. Row Level Security is essential because a publishable key is public by design.

See the official Supabase documentation:
- https://supabase.com/docs/guides/getting-started/api-keys
- https://supabase.com/docs/guides/database/postgres/row-level-security
