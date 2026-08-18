# OBS Setup

The overlay is three independent browser sources, so each piece can be placed
and sized separately in your scene.

| Source | URL | Suggested size |
| --- | --- | --- |
| Wheel | `/overlay/:creatorId/spin/wheel` | 720x820 |
| Progress bar | `/overlay/:creatorId/spin/bar` | 620x140 |
| Queue | `/overlay/:creatorId/spin/queue` | 380x320 |

1. In the Spin dashboard, copy the URL from the overlay card you want to add.
2. Add an OBS Browser source and paste the URL.
3. Leave the source background transparent.
4. Enable browser-source refresh when the scene becomes active.
5. Repeat for the other pieces you want on screen. None of them are required.

`/overlay/:creatorId/spin` with no part still resolves, and shows the wheel.

Each source updates from Firestore in real time and renders only its own piece,
so the queue source does not read queue data unless you actually add it. No
Twitch tokens or payment details are exposed to the browser source.
