# PART IX — iOS System Design

```text
Experience: 4+
Category: System Design
Difficulty: Expert
Importance: Critical (senior loops)
```

iOS system design is **not** web system design with extra steps. You still mention scale, but the interesting constraints are **device**: memory, battery, flaky networks, process death, App Store review, privacy, main thread, offline, and OS background limits.

## How to run a 45-minute iOS design interview

1. **Clarify product** (5 min): users, platforms, offline, auth, media, realtime
2. **Sketch UI surfaces** (5)
3. **Domain model + source of truth** (5)
4. **Data flow** (network, cache, persistence) (10)
5. **Concurrency & lifecycle** (5)
6. **Failure modes** (5)
7. **Scale, security, testing, metrics** (5)
8. **Trade-offs** (5)

Always state assumptions. Always mention **cancellation**, **deduplication**, **pagination**, **auth refresh**, and **what happens when the app is killed**.

---

## Design Instagram Feed

### Requirements (ask)

- Infinite photo/video feed, likes, comments count
- Stories tray?
- Offline scroll of already loaded pages?
- Video autoplay muted
- Personalised ranking (server)

Assume: authenticated, image-heavy, paginated GraphQL or REST, ~50 items per page.

### Architecture

```text
FeedView (SwiftUI List / UICollectionView compositional)
    → FeedViewModel (@Observable, @MainActor)
        → FeedRepository
            → FeedAPI (paginated)
            → FeedCache (disk + memory)
            → MediaLoader (image/video pipeline)
```

### Data flow

1. On appear: show **cached** page 0 if any (stale-while-revalidate)
2. Fetch page 0; reconcile by `postID`
3. Prefetch page 1 near the end
4. Likes: optimistic UI, enqueue mutation, rollback on 409/401

### Networking

Cursor pagination. Deduplicate IDs in the view model (`[Post]` + `Set<ID>`). ETags if REST.

### Caching / persistence

- Memory: decoded images (`NSCache`)
- Disk: last 1–2 pages of JSON + on-disk image cache (URLCache or custom)
- Do not persist the entire Instagram corpus

### Concurrency

`TaskGroup` with a limit for prefetch. Cancel row `.task` when scrolled away. Video: one autoplaying cell; pause others.

### Offline

Read cache. Writes (like) queued. Conflict: server count is source of truth on refresh.

### Security

HTTPS, tokens in Keychain, no image URLs with open-redirect tokens in logs.

### Scalability (client)

Main cost is **media**. Downsample. Progressive JPEG/WebP. Don’t decode 12 MP for a 100pt thumbnail.

### Testing

Repository fakes, snapshot a row, UI test login+feed smoke.

### Trade-offs

SwiftUI `List` vs compositional `UICollectionView` for video cells — many teams still use UIKit for the feed. Say so.

---

## Design WhatsApp Chat

### Requirements

1:1 and groups, ordered messages, send/receive realtime, media, receipts, encryption (high level).

### Architecture

```text
ChatList | ConversationView
    → ChatService (actor)
        → MessageStore (SwiftData/SQLite)
        → Realtime (WebSocket / APNs wakeup)
        → Uploader (background URLSession)
```

### Data flow

Local SQLite is **source of truth**. Network syncs. Each message: `localID`, `serverID`, `status: pending|sent|delivered|read|failed`.

Send: insert pending → encrypt → upload → replace with server ID.

Receive: websocket or push → insert → decrypt → UI via query.

### Ordering

Server timestamp + tie-breaker. Clock skew: don’t use device clock as the only order.

### Concurrency

Actor serialises DB writes. UI `@Query` or fetched results.

### Offline

Queue outgoing. Retry with backoff. Show pending ticks.

### Security

E2E: keys in Keychain/Secure Enclave. Don’t log plaintext. Screen overlay on background.

### Scalability

Paginate messages **backwards**. Windowed load. Thumbnails not full video in RAM.

### Trade-offs

Core Data vs SQLite (GRDB) vs SwiftData — chat is write-heavy; you need control of indexes `(chatID, timestamp)`.

---

## Design Uber-like Tracking

### Requirements

Map, driver location ~1s, passenger session, battery, background, accuracy.

### Architecture

```text
TripView
  → TripSession (actor)
      → LocationManager (CLLocation, filtered)
      → MapAdapter (MKMapView representable)
      → TripAPI / WebSocket
```

### Data flow

Driver: sample location → snap/filter → send if moved > N meters or T seconds.  
Passenger: consume stream, interpolate on map (don’t jump).

### Concurrency / background

Background location **only** during an active trip. Entitlements. Stop everything on trip end.

### Performance / battery

`kCLLocationAccuracyBest` vs hundreds of meters. Coalesce updates. Don’t redraw the whole SwiftUI view per GPS tick — isolate map.

### Security

Share location with the trip token, not a public ID. HTTPS. Authz on server.

### Offline

Buffer last N points; flush when back. Map tiles cached by MapKit.

### Trade-offs

Socket vs frequent REST: sockets for live; REST fallback.

---

## Design YouTube-like Video Feed

Similar to Instagram plus **AVPlayer** pooling.

- Reuse players (expensive)
- Preload next
- Picture-in-Picture
- Bandwidth: HLS adaptive
- Do not attach 20 `AVPlayer` instances

UICollectionView often wins. `UIViewRepresentable` for the player layer.

Analytics: quartile pings, cancel on scroll.

---

## Design Offline-first Notes App

### Requirements

CRUD notes, markdown, sync across devices, conflicts.

### Architecture

```text
NotesList / Editor
  → NotesRepository
      → SwiftData (@Model Note)
      → SyncEngine (actor)
          → NotesAPI
```

### Sync

Every note: `updatedAt`, `version` or `vectorClock`, `dirty` flag. Push dirty; pull since `cursor`.

**Conflicts:** if both edited, keep both as conflict copies or 3-way merge. Ask the interviewer which product wants.

### Encryption (optional)

If “private notes”: encrypt body with a key in Keychain; server stores blobs.

### Testing

Fake clock, in-memory store, conflict fixtures.

---

## Design News App

Feed of articles, sections, bookmarks, text-only offline, images optional.

- CDN images
- Atom/RSS or JSON
- Reader mode: persist HTML subset
- Background refresh (`BGAppRefreshTask`) — best effort
- Personalisation vs privacy (on-device vs server)

Pagination + `seenIDs`. Breaking news: silent push as hint.

---

## Design Banking App

Highest bar.

### Requirements

Auth (password + step-up biometric + device bind), balances, transfers, statements, fraud, **no** caching of PAN, screenshot policy, jailbreak policy (honest about limits), certificate pinning, short session TTL.

### Architecture

```text
Session actor (token, expiry)
  → APIClient (pinning, no shared URLCache for authenticated GETs)
  → Stores: ephemeral balance in memory; statements encrypted on disk if needed
```

### Security (must discuss)

- Keychain + `LocalAuthentication` to unlock token
- SSL pinning with backup pins
- No tokens in logs / analytics
- `isSecureTextEntry`, hide snapshot
- Jailbreak detection as signal not fortress
- Backend is the real security

### Offline

Read-only last balance with timestamp disclaimer. **Never** queue transfers blindly without idempotency keys and user confirmation.

### Testing

Threat model in the design doc. Penetration assumptions.

---

## System design cheat questions

- Where is the source of truth?
- What if the process is killed mid-send?
- What if two devices edit?
- What if pagination returns duplicates?
- What if the user rotates / splits screen?
- How do you observe this in production (os_log, metrics, crash signatures)?

---
