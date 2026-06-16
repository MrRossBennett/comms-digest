# Keep the product web-first and defer a native app

Comms Digest will remain a web application and reach **Household Owners** through messaging channels and, optionally later, web push — rather than being rebuilt as a native mobile app at this stage. A native app was considered specifically to obtain near-zero-cost push notifications, but the delivery-cost gap over messaging channels is small while the distribution cost is large: native push requires an app-store install and a notification-permission grant before anything reaches a parent, whereas a text needs neither. At zero users the scarce resource is getting the daily ritual into a busy parent's life with the least friction, not shaving pennies off per-message cost.

## Considered options

- **Rebuild the frontend in Expo / React Native now, while it is small.** Rejected for now: this is a frontend rewrite, not a channel swap — the existing React, TanStack Start, and shadcn/ui surfaces do not port — and it optimises a delivery cost that messaging channels already make negligible. Staying web-first forecloses nothing: a future native app would reuse the same backend, the same **Day Plan** composition, and the same channel-agnostic delivery interface.

## Consequences

The native-app decision is deferred, not foreclosed, and should be revisited on product grounds — retention, offline use, home-screen presence, richer UX — once there is real signal, not on message cost. Until then, the full **Day Plan** lives on the web "For tomorrow…" page, which delivery links to.
