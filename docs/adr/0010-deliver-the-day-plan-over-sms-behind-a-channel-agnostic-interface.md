# Deliver the Day Plan over SMS, behind a channel-agnostic interface

Comms Digest will deliver the evening **Day Plan** as a text message to the **Household Owner**'s verified **Delivery Contact**, using Twilio as the provider. The message is a short, single-segment, emoji-free nudge plus a deep link to the full "For tomorrow…" page, so the Day Plan itself always lives on the web and the text stays cheap and glanceable. Delivery is built behind a channel-agnostic interface so further channels can be added without changing composition.

Email is deliberately not a delivery channel: the product exists to relieve the school-email glut, so delivering the daily plan into the same inbox would undermine its core promise. WhatsApp was considered and declined despite lower per-message cost and free inbound replies, because it requires depending on Meta's WhatsApp Business platform, with business verification and template approval as a gatekeeper between the product and its users; SMS keeps delivery on open carrier infrastructure with no platform owner in the middle. The realistic non-Meta richer channels to add later are web push (zero marginal cost) and, as support matures, RCS.

## Considered options

- **Email.** Rejected: it re-creates the exact problem the product solves.
- **WhatsApp-first (via Meta's Business platform).** Rejected: lower per-message cost and free replies do not justify a hard dependency on Meta and its onboarding ceremony; SMS reaches every mobile with no platform gatekeeper.
- **Full plan inline in the message.** Rejected: a useful plan is several SMS segments, a 3–5× cost multiplier; the nudge-plus-link shape caps cost at roughly one segment and reinforces the web Day Plan as the canonical view.

## Consequences

Per-message SMS is segment-taxed and inbound is paid, so the nudge-plus-link shape is load-bearing for unit economics, and the later two-way "just reply" feature carries real inbound-SMS and model cost rather than being free. Twilio's STOP/START handling enforces opt-out at the edge, but the **Delivery Contact**'s consent state remains the source of truth in Comms Digest so composition and the UI respect it. UK SMS does not use the US A2P 10DLC framework, so standing up the channel is a matter of days, not weeks.
