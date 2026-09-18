# PART IX — iOS System Design

iOS system design is not web system design with extra steps. You still mention scale, but the interesting constraints are the device: memory, battery, flaky networks, process death, App Store review, privacy, the main thread, offline, and the OS background limits Apple actually gives you.

A candidate who draws Kafka on a whiteboard for a notes app has not heard the question. A candidate who starts with “where is the source of truth, and what happens if we are killed mid-send?” has.

## How to run a 45-minute iOS design interview

Clarify the product first. Who is the user, which platforms, is offline required, how does auth work, is there media, is there realtime. Five minutes of that saves twenty minutes of designing the wrong app.

Then sketch the UI surfaces so you are not designing a backend for a screen that does not exist. Domain model and source of truth next — disk, memory, server, or some mix. Data flow after that: network, cache, persistence. Concurrency and lifecycle: cancellation, background, what happens when the scene goes inactive. Failure modes: 401, 409, empty, timeout, process death. Scale, security, testing, metrics. Trade-offs last, because they only make sense after you have a design to attack.

Always state assumptions out loud. Always mention cancellation, deduplication, pagination, auth refresh, and what happens when the app is killed. Those five sentences are how interviewers tell a feature implementer from someone who has shipped.

---

## Design Instagram Feed

I would start by asking. Infinite photo and video feed, likes, comment counts. Is there a stories tray. Can you scroll already-loaded pages offline. Video autoplay muted. Ranking is on the server — we are not training a model on the phone.

Assume authenticated, image-heavy, paginated GraphQL or REST, about fifty items a page. If they want stories, say so and put a horizontal tray above the list; do not silently omit it.

```text
FeedView (SwiftUI List / UICollectionView compositional)
    → FeedViewModel (@Observable, @MainActor)
        → FeedRepository
            → FeedAPI (paginated)
            → FeedCache (disk + memory)
            → MediaLoader (image/video pipeline)
```

On appear, show cached page 0 if you have it — stale-while-revalidate. Fetch page 0, reconcile by `postID`. Prefetch page 1 when the user is near the end. Likes are optimistic: flip the heart, enqueue the mutation, roll back on 409 or 401.

Cursor pagination, not offset, because offset duplicates when new posts land at the top. Deduplicate IDs in the view model — an array for order, a set for membership. ETags if you are on REST.

Memory holds decoded images in `NSCache`. Disk holds the last one or two pages of JSON plus an on-disk image cache (`URLCache` or custom). You do not persist the Instagram corpus. The main cost on this client is media. Downsample. Progressive JPEG or WebP. Do not decode 12 megapixels for a 100-point thumbnail.

Concurrency: a `TaskGroup` with a limit for prefetch. Cancel the row `.task` when the cell scrolls away. Video: one autoplaying cell, pause the others. Offline: read the cache; queue likes; on refresh the server count is source of truth.

HTTPS, tokens in Keychain, no image URLs with open-redirect tokens in logs. Tests: repository fakes, a snapshot of a row, a UI smoke of login-plus-feed.

The trade-off I would say out loud: SwiftUI `List` versus a compositional `UICollectionView` for video cells. Many teams still use UIKit for the feed because player pooling and cell lifecycle are easier there. That is not a failure of SwiftUI. It is an honest constraint.

---

## Design WhatsApp Chat

One-to-one and groups, ordered messages, send and receive in realtime, media, receipts, encryption at a high level. I would not design Signal’s full protocol in forty-five minutes unless they ask. I would say where keys live and what I refuse to log.

```text
ChatList | ConversationView
    → ChatService (actor)
        → MessageStore (SwiftData/SQLite)
        → Realtime (WebSocket / APNs wakeup)
        → Uploader (background URLSession)
```

Local SQLite is the source of truth. The network syncs it. Each message has a `localID`, a `serverID`, and a status: pending, sent, delivered, read, failed. Send: insert pending, encrypt, upload, replace with the server ID. Receive: websocket or push, insert, decrypt, UI via a query.

Order by server timestamp plus a tie-breaker. Do not use the device clock as the only order — clock skew is real. An actor serialises database writes so you are not fighting SQLite from two tasks. UI is `@Query` or fetched results.

Offline: queue outgoing, retry with backoff, show pending ticks. If the process is killed mid-send, the pending row is still on disk; on launch you retry. That sentence is the interview.

E2E: keys in Keychain or Secure Enclave. Do not log plaintext. Screen overlay when backgrounded. Paginate messages backwards. Windowed load. Thumbnails, not full video in RAM.

Core Data versus SQLite (GRDB) versus SwiftData: chat is write-heavy. You need control of indexes `(chatID, timestamp)`. SwiftData may be enough; I would not pick it without knowing I can see those indexes. Say that as a trade-off, not as a holy war.

---

## Design Uber-like Tracking

Map, driver location about once a second, passenger session, battery, background, accuracy. The product question is: are we designing the driver app, the rider app, or both. Accuracy and background entitlements differ.

```text
TripView
  → TripSession (actor)
      → LocationManager (CLLocation, filtered)
      → MapAdapter (MKMapView representable)
      → TripAPI / WebSocket
```

Driver: sample location, snap and filter, send if we moved more than N metres or T seconds. Passenger: consume the stream, interpolate on the map — do not jump the car. Background location only during an active trip, with the entitlement, and stop everything when the trip ends. Leaving `kCLLocationAccuracyBest` running in the background after drop-off is how you fail a battery review.

Do not redraw the whole SwiftUI view per GPS tick. Isolate the map. Coalesce updates. Share location with the trip token, not a public user id. HTTPS. Authorisation on the server, not “the app hides the endpoint.”

Offline: buffer the last N points, flush when back. Map tiles are cached by MapKit already — do not rebuild that. Sockets for live, REST as fallback when the socket dies. Say both.

---

## Design YouTube-like Video Feed

Instagram plus `AVPlayer` pooling. Players are expensive. Reuse them. Preload the next. Picture-in-Picture is an entitlement and a lifecycle, not a checkbox. Bandwidth is HLS adaptive, not “download the 4K file.” Do not attach twenty `AVPlayer` instances.

UICollectionView often wins here. `UIViewRepresentable` for the player layer if the rest of the app is SwiftUI. Analytics: quartile pings, cancel on scroll so you are not claiming a complete on a cell that was on screen for 200 milliseconds.

---

## Design Offline-first Notes App

CRUD notes, markdown, sync across devices, conflicts. This is the 4+ design I would practise until it is boring, because it contains every senior topic except video.

```text
NotesList / Editor
  → NotesRepository
      → SwiftData (@Model Note)
      → SyncEngine (actor)
          → NotesAPI
```

Every note has `updatedAt`, a `version` or vector clock, and a `dirty` flag. Push dirty; pull since a cursor. If both sides edited, keep both as conflict copies or do a three-way merge. Ask which product they want before you pick. “Last write wins” is fine for a grocery list and criminal for a legal pad.

If they say “private notes,” encrypt the body with a key in Keychain and let the server store blobs. Tests: a fake clock, an in-memory store, fixtures that conflict. Process death mid-sync: dirty stays dirty, cursor does not advance, next launch continues. That is the source-of-truth story.

---

## Design News App

A feed of articles, sections, bookmarks, text-only offline, images optional. CDN for images. Atom, RSS, or JSON — pick one and say why (JSON if you control the server, RSS if you are aggregating). Reader mode: persist an HTML subset, not a web view of the live page.

Background refresh (`BGAppRefreshTask`) is best-effort. Apple will not promise you a slot. Personalisation versus privacy: on-device ranking versus a server profile. Pagination plus `seenIDs`. Breaking news: a silent push as a hint to refresh, not a payload of the whole article in the notification.

---

## Design Banking App

Highest bar. Password plus step-up biometric plus device bind. Balances, transfers, statements, fraud. No caching of PAN. Screenshot policy. Jailbreak policy — be honest about the limits; detection is a signal, not a fortress. Certificate pinning. Short session TTL.

```text
Session actor (token, expiry)
  → APIClient (pinning, no shared URLCache for authenticated GETs)
  → Stores: ephemeral balance in memory; statements encrypted on disk if needed
```

Keychain plus `LocalAuthentication` to unlock the token. SSL pinning with backup pins so you can rotate. No tokens in logs or analytics. `isSecureTextEntry`, hide the snapshot on background. The backend is the real security. The client is how you avoid being the easy hole.

Offline: a read-only last balance with a timestamp disclaimer. Never queue transfers blindly. Idempotency keys and a user confirmation, or you will double-pay when the retry fires. Threat-model the design. Penetration assumptions belong in the doc, not as “we pin, so we are done.”

---

## System design cheat questions

Where is the source of truth. What if the process is killed mid-send. What if two devices edit. What if pagination returns duplicates. What if the user rotates or splits the screen. How do you observe this in production — `os_log`, metrics, crash signatures.

If you can answer those six about any of the designs above, the forty-five minutes will fill itself. If you cannot, no amount of boxes on a whiteboard will save the round.
