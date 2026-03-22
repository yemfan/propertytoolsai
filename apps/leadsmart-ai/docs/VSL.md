# Homepage VSL (demo video block)

`components/VslSection.tsx` is mounted at **`#vsl`**. The hero **“Watch 60s Demo”** button links to `#vsl` so users land on the **LeadSmart AI Demo** overlay (gradient + “Play 60-Second Demo”). After play, it embeds **one** source, resolved in `LeadSmartLanding` via env in this order:

1. **`NEXT_PUBLIC_VSL_MP4_URL`** — self-hosted MP4 (full URL). Renders as HTML5 `<video>` (`videoType: "html5"`).

2. **`NEXT_PUBLIC_VSL_VIMEO_ID`** — Vimeo numeric video id.

3. **`NEXT_PUBLIC_VSL_YOUTUBE_ID`** — YouTube video id (e.g. `dQw4w9WgXcQ`). Embeds via `youtube-nocookie.com`.

If none are set, the play button is disabled and a short **configure env** hint appears.

You can also pass `videoType` + `videoIdOrUrl` explicitly as props.

## Analytics

`trackLandingEvent` fires:

- **`vsl_play_clicked`** — play overlay (`video_type`, `section: "homepage_vsl"`).
- **`vsl_cta_clicked`** — primary or secondary button (`kind`, `href`, `section`).

Wire these in gtag/PostHog via your existing landing listeners.
