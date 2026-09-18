import type { PrepDay } from './types'

export const day10: PrepDay = {
  id: 'day-10',
  title: 'Day 10 — System design',
  kicker: 'The ten days, combined',
  intro:
    'A staff-level design is not a box diagram. It is a product that still works when the socket dies, the cell is reused, and a second team ships next week. Bring Days 1–9 into the same answer: ownership, cancellation, identity, boundaries, tokens, measurement, and tests you can actually run.',
  problems: [
    {
      id: 'd10-p1',
      title: 'Design iOS architecture for chat',
      difficulty: 'Expert',
      kind: 'Design',
      prompt: `Design the iOS side of a 1:1 and group chat product:

* WebSocket for live messages
* REST for history pagination
* Offline compose and send
* Message ordering that survives retries
* Optimistic UI
* Push when the socket is dead
* Local persistence
* Media uploads
* Typing indicators
* Unread counts

The backend exists. You own the client. Sketch modules, data flow, concurrency, and what you would cut for v1.`,
      think: [
        'What is the source of truth on device versus the server?',
        'Who owns the socket lifetime — the app session, or the chat screen?',
        'How do local IDs map to server IDs after ack, and what stops a duplicate bubble?',
        'Which work is an actor, and which is MainActor UI state?',
        'If the user pops the thread while a video is uploading, what is cancelled and what must survive?',
      ],
      solution: `Cut v1 to 1:1 text, an offline send queue, history pagination, and a push that opens the thread. Drop nested threads, full E2E, and fancy reactions until the ledger is boring. Group chat can wait if the server already fans out; the client should not pretend to.

Modules: \`ChatUI\` observes; \`ChatStore\` on MainActor holds conversation snapshots; a \`MessageRepository\` actor owns persistence, the send queue, the realtime client, and REST history. \`Media\` is its own use case. The app composition root wires protocols. The view controller never sees \`URLSession\` or a WebSocket.

On device, SwiftData or a thin SQLite wrapper is the offline truth. The UI observes a query by \`conversationId\`, sorted by a \`sortKey\` the client controls. The network is a writer into that store, not a pipe into the view. Every outbound message gets a client UUID before it leaves the phone. Insert \`.pending\`, paint the bubble, then let REST or the socket publish. The ack replaces the row with the server id and \`.sent\`. Duplicates are keyed by that client UUID first, server id second.

Ordering is \`sortKey = (serverSeq ?? localMillis, clientUUID)\`. Socket arrival order is a rumour. The realtime client is one actor owned by the authenticated session, not by the chat screen. Connect when the user is signed in and foregrounded, or with a bounded background task. Reconnect with backoff. Incoming frames decode off the main actor, persist, then the store publishes a slim snapshot.

The send pipeline is serial per conversation inside a \`SendQueue\` actor: persist, publish, persist the result. Retry with backoff. The idempotency key is the client UUID, so a retry cannot mint a second message. Pagination is a cursor in the store; prefetch older rows on scroll using stable identity, not \`ForEach\` indices. Push carries \`conversationId\` and maybe a preview. Treat it as a gap hint, then fetch. Unread is server-authoritative; local increment is optimistic and gets corrected on sync.

Media uploads to blob storage, then the message carries the URL. Progress lives in the store so a cell can bind to it. Delete cancels the task. Typing is ephemeral, not persisted, and dropped if the socket lags. Token refresh from Day 5 wraps REST and the socket reconnect. One refresh, many waiters, logout once.`,
      explanation: `People do not open chat to admire a socket diagram. They type on the subway, the tunnel kills the connection, and they expect that bubble in the thread — not a spinner, not a duplicate, and not a message that vanished because the view controller owned the WebSocket and got popped. The product is a local ledger that happens to talk to a server.

That is why the store is the source of truth on device. The UI observes a query for one conversation. Every outbound message gets a client UUID before it leaves the phone. You insert pending, paint the bubble, and the network later stamps sent or failed. Two writers will show up: the socket and the REST catch-up after a gap. If both insert the same payload, you get twins. Dedupe on client UUID first, server id second, and never sort by whatever arrived last on this device.

Ownership is where Day 1 leaks into the design. A socket delegate that strongly captures the chat screen will keep that screen alive after pop, and \`unowned\` in the same callback will crash when the session outlives the cell. The realtime client belongs to the authenticated session, on an actor, with cancellation when the app backgrounds past a bounded task. Incoming frames decode off the main actor — Day 2 — then persist, then the store publishes a slim snapshot. SwiftUI identity is the message id, not the array index. Reuse without that identity is how failed-retry buttons jump rows, the same lesson as Day 3 cells.

Architecture is the refusal to grow a 4 000-line chat view controller. Media upload is a use case with progress in the store and cancellation when the user deletes the bubble. Push is a hint that a conversation has a gap, not a second database. Tokens wrap REST and the socket reconnect, single-flight, because a 401 storm during reconnect is Day 5 wearing a chat costume. If the thread hitches, you profile decode and image size, not “SwiftUI is slow.” That is Day 8, in the same answer as the boxes.`,
      internals: `\`\`\`text
  SwiftUI / cells          observe snapshots, stable message ids
        │
   ConversationStore       @MainActor, no URLSession, no socket
        │
   MessageRepository       actor
        ├─ Persistence     SQLite / SwiftData, indexed by conversation + sortKey
        ├─ SendQueue       serial per conversation, client UUID idempotency
        ├─ RealtimeClient  WS, session-owned, backoff reconnect
        └─ HistoryClient   REST cursors, gap fill
\`\`\`

The view never owns the socket. Rotation, pop, or a SwiftUI identity reset would drop the session or leak it. Decode and image downsample happen before the MainActor hop. Token refresh is a join, not a per-frame POST.`,
      testing: `Repository tests should insert a pending row, ack it, then replay the same frame and assert one row. The send queue fails twice then succeeds and still writes a single message. Use a fake clock for backoff so the test does not sleep. A UI test can send offline, come online, and assert the pending bubble becomes sent. Run Thread Sanitizer on the decoder path. After opening and closing twenty threads, take a Memory Graph and confirm chat screens and socket delegates are gone.`,
      pitfalls: `Sorting by device clock across users will reorder history whenever two phones disagree about noon. Using \`unowned\` in socket callbacks turns a leak into a crash the first time a cell dies first. Decoding five hundred history messages on the MainActor is the two-second hitch from Day 8. Storing access tokens next to messages in the same unencrypted database is a Day 5 incident waiting on a backup. Letting the chat screen own the socket means every pop is a reconnect storm or a leak. Trusting push as the only write will desync any device that disabled notifications.`,
      alternatives: `Stream or Sendbird is rational if chat is not the product. You still own offline compose, notification routing, and the optimistic UI, so the ledger shape does not disappear. Firestore or a sync engine changes the transport and leaves the same identity, cancellation, and cell-reuse problems. A pure socket with no local store looks simpler in a slide and loses every airplane-mode send.`,
      tradeoffs: `One SQLite file with indexes is enough for millions of messages on device. CloudKit is a product choice, not an architecture flex. Per-message actors are overkill; a per-conversation serial queue or actor is the usual win because ordering and retries are per thread. Optimistic UI is the right default for text and a liability for payments-like actions inside chat, which you should not have in v1.`,
      followups: [
        {
          q: 'How do you handle edited or deleted messages from another device?',
          a: 'Server sequence plus tombstones. The UI hides deleted rows. Last writer on the server wins unless you have a real CRDT requirement, which you do not in v1.',
        },
        {
          q: 'Does the client fan out a group message to every member locally?',
          a: 'No. The server fans out. The client writes one row per message in conversations this user belongs to.',
        },
        {
          q: 'How do you test a socket gap?',
          a: 'Fake a sequence hole. The client REST-fills. Assert no duplicate UUIDs and that sortKey stays monotonic in the thread.',
        },
        {
          q: 'What changes if you add E2E encryption later?',
          a: 'Keys in Keychain or Secure Enclave, plaintext never in logs, a separate story for media. You do not retrofit by sprinkling CryptoKit inside the view controller.',
        },
        {
          q: 'Who cancels an in-flight photo upload if the user deletes the bubble?',
          a: 'The store cancels the Task keyed by client UUID. The repository deletes or tombstones the row. The socket should not send a message that points at a blob that never finished.',
        },
        {
          q: 'Where does unread live when the socket is down?',
          a: 'Optimistic local increment for the open thread, server counters on the next sync or push. Badge is a derived value, not a second source of truth.',
        },
      ],
      teaches: [
        'Offline-first store',
        'Optimistic client UUIDs',
        'Socket versus REST writers',
        'Actor boundaries',
        'Push as a hint',
        'Session-owned realtime',
        'Days 1–9 combined',
      ],
    },
    {
      id: 'd10-p2',
      title: 'Design an Instagram-like feed client',
      difficulty: 'Expert',
      kind: 'Design',
      prompt: `Home feed: photos, videos, likes, comments preview, stories strip. Requirements: pagination, image caching, prefetch, memory budget, offline last feed, API failures, concurrent requests, like optimistic UI, analytics impressions, ads slots.

Design the iOS architecture. Call out what you would measure in Instruments after v1 ships.`,
      think: [
        'What is a row model versus a post DTO from the server?',
        'Who decodes and downsamples, and to what size?',
        'How do likes survive cell reuse and a parent view model invalidation?',
        'Where do ads enter without poisoning the core feed module?',
        'What Instruments traces would you look at after the first week in production?',
      ],
      solution: `A \`FeedClient\` pages by cursor and maps into a \`FeedItem\` enum of post, ad, or story rail. Persist page one for offline. A \`FeedStore\` on the MainActor holds the list snapshot. The list is UICollectionView compositional layout, or SwiftUI \`List\` with stable ids. Cells get a row value or a tiny row model, never the whole feed view model. That is Day 3 observation granularity wearing a product costume.

Images downsample to the cell size times screen scale before they enter memory cache. NSCache plus disk, cost-limited, purged on memory warning. Prefetch the next handful of URLs with \`UICollectionViewDataSourcePrefetching\`. Cancel the Task on reuse. Video uses a pool of two or three \`AVPlayer\` instances: attach when roughly half visible, detach on reuse, never let SwiftUI \`body\` allocate a player. Likes live in a \`LikeStore\` keyed by \`postId\` so reuse cannot show the previous cell’s heart. Reconcile with the server and roll back on conflict.

Failures are stale-while-revalidate: show the last page, retry, put a pagination error row at the bottom instead of blanking the screen. Analytics impressions fire when fifty percent is visible for a short dwell, batched on a background actor, never computed inside \`body\`. Ads arrive as \`FeedItem.ad\` from a separate client. The post cell does not import the ads SDK. An adapter in the app target maps placement into a row.

Concurrency is a TaskGroup for the page plus the stories strip, cancelled when the tab disappears. Token refresh is single-flight. After v1, measure Allocations while flinging, persistent bytes after pop, Time Profiler on decode, and the Hitches instrument on first Home appear. Memory Graph for leaked players and duplicated feed controllers. You are looking for decoded bitmap size and player count, not for a missing library name.`,
      explanation: `A feed interview dies when the candidate talks only about \`UICollectionView\`. Users are flinging a surface that must look instant, not allocate a 48 megabyte bitmap for a 120 point row, and not heart the wrong post because the cell was reused. The product is a pipeline with a memory budget. Identity threads through cache keys, like state, analytics, and ads. That is the same identity lesson as cell reuse, not a separate “architecture” slide.

Pagination is not “call page two.” It is a cursor, a cancellation point, and a decision about what you persist so airplane mode still shows something. Prefetch is not “download everything below the fold.” Too aggressive and you recreate the 150 to 900 megabyte incident from Day 8. Too timid and cells flash empty. The number is measured on a device, then encoded as a budget, not guessed from a blog post about Kingfisher.

Likes look trivial until they are stored on the cell. Optimistic state has to live in a store keyed by post id so a reused cell cannot flash the previous heart, and so a parent \`objectWillChange\` does not redraw a thousand rows. Ads are a legal and SDK-churn problem. If the core post module imports the ads SDK, every feed compile and every privacy review pays for it. An enum case plus an adapter keeps that fire in the app target.

Instruments after v1 is part of the design, not a mop. Allocations while flinging tells you whether downsample is real. Memory Graph after leaving Home tells you whether players and view controllers died. Time Profiler on first appear tells you whether JSON decode still sits on the MainActor. If you cannot name those traces, you designed a slideshow.`,
      internals: `\`\`\`text
  Home (SwiftUI or UICollectionView)
        │  stable postId / placementId
   FeedStore @MainActor
        │
   ┌────┴──────────┬─────────────┐
   FeedClient      LikeStore     AdsAdapter
   StoriesClient   ImpressionActor
        │
   ImagePipeline   PlayerPool (2–3)
   (decode off main, cancel on reuse)
\`\`\`

A 4000×3000 photo is roughly 48 MB uncompressed. Ten of those in an uncapped cache is the jetsam. Prefetch tasks must be cancelled when the cell leaves, or the pipeline keeps filling a cache you thought you limited.`,
      testing: `Unit-test \`LikeStore\`: like, reuse a cell with a different post id, assert the heart did not travel. Fake a slow image response and assert the Task is cancelled when the cell is rebound. Persist page one, go offline, assert Home still renders. Spy impressions rather than trusting a UI test to notice a 250 millisecond dwell. After a code change to downsample, save an Allocations trace and compare persistent bytes while flinging.`,
      pitfalls: `Storing \`UIImage\` in the SwiftData model writes decoded bitmaps to disk and blows memory on fetch. Reloading the whole collection on like is an identity bug dressed as simplicity. Hitting the like API from \`cellForItem\` or from \`body\` duplicates requests and races. Passing the feed view model into every row redraws the world on one heart. Creating an \`AVPlayer\` per cell will look fine on the simulator and die on device.`,
      alternatives: `IGListKit-style diffing is still a good UIKit answer for mixed ads and stories. SwiftUI List is enough when rows are thumbnails and text. Video usually keeps a UIKit cell or a representable with an explicit identity. A third-party image library is an implementation of the pipeline, not a substitute for naming cancel, downsample, and budget.`,
      tradeoffs: `Offline full-resolution media is a product cost and a disk cost. Last JSON plus avatars is enough for v1. Ads as a separate module keeps legal churn out of Feed and adds a mapping layer you will curse during a breaking SDK update. Aggressive prefetch makes the fling feel native and will jetsam if the budget is a wish.`,
      followups: [
        {
          q: 'How do you prefetch comments?',
          a: 'You do not, until the user opens the thread. Prefetch bytes that paint the current surface. Comment graphs are a different screen.',
        },
        {
          q: 'How does stories memory differ from feed memory?',
          a: 'A separate cache with a smaller budget and aggressive eviction. Stories are ephemeral and compete with the player pool.',
        },
        {
          q: 'What if a like gets a 409 because another device unlike’d?',
          a: 'Rollback the local heart from the server body. Do not hide the conflict with a retry loop. The store is keyed by post id, so the visible cell updates without a full reload.',
        },
        {
          q: 'Where does token refresh sit when page and stories fire together?',
          a: 'One authenticator actor. Both clients join the same in-flight refresh. Fifteen 401s must not become fifteen refresh calls.',
        },
        {
          q: 'Which Instruments template first if Home hitches on appear but scroll is fine?',
          a: 'Time Profiler and Hitches on appear, not Allocations. You are looking for main-thread decode or a fetch on \`viewContext\`, the Day 8 hitch, not for cache size.',
        },
        {
          q: 'How do ads fail without blanking the feed?',
          a: 'Ads are optional rows. If the ads client 500s, the feed still renders posts. Never make first paint wait on the ads SDK init.',
        },
      ],
      teaches: [
        'Pagination with a cursor',
        'Image pipeline budget',
        'Prefetch and cancel',
        'Optimistic likes by id',
        'Cell identity',
        'Ads as adapters',
        'Instruments as design',
      ],
    },
    {
      id: 'd10-p3',
      title: 'Design a large-scale iOS app for a 40-person org',
      difficulty: 'Expert',
      kind: 'Architecture',
      prompt: `You are Staff-track on a consumer app: 200 screens, 12 feature teams, weekly release, EU store, crash-free 99.7% goal. Discuss modularization, architecture, networking, persistence, testing, CI/CD, observability, and release strategy. Call out what you would refuse to standardise.`,
      think: [
        'What must be consistent for users versus for engineers?',
        'Where does a platform team stop, and where does a feature team own the mess?',
        'How do you ship if one feature is red on Thursday?',
        'Which shared things become crash-free-rate and CI-time SLIs?',
        'What would you refuse to standardise even under executive pressure?',
      ],
      solution: `Standardise the roads, not the furniture. Platform owns the design system, one HTTP stack with token refresh and pinning, auth, analytics, crash reporting, a persistence kit, and feature flags. Feature modules own screens, DTOs, and their own stores. The app target composes. You do not mandate TCA or VIPER in every module. You mandate boundaries and test seams: UI does not construct \`URLSession\`, tokens do not live in \`UserDefaults\`, and navigation out of a feature goes through a small router.

Networking is one stack. Features own endpoints. Persistence defaults to disposable caches. Privileged stores — chat, drafts, checkout sessions — get migration tests because you cannot delete the database after a bad release. Testing is unit tests in modules, required for platform code. UI tests are smoke: login, pay, a couple of journeys, not two hundred screens. Contract tests hit a stub server so decoding cannot drift in silence.

CI builds changed modules when the import DAG is clean. A twenty-eight minute suite is a modularization bug, not a badge of thoroughness. PRs run lint, unit tests, and one simulator smoke. Nightly runs a Thread Sanitizer sample and migration fixtures. Observability is a crash reporter plus MetricKit plus breadcrumbs, with performance budgets on Home and checkout. Feature flags are remote, for rollout, and they have owners and expiry dates.

Release is a weekly train. Flags beat long-lived git forks. Phased rollout, a hotfix lane, dSYMs always uploaded. EU work — privacy manifests, tracking transparency, encryption export — is a platform checklist, not a per-feature surprise. Refuse to standardise every team onto one reactive framework, one mega SwiftData schema, one hundred percent UI-test coverage, or a micro-module per screen.`,
      explanation: `A forty-person iOS org does not fail because someone picked MVVM instead of VIPER. It fails because twelve teams share a token store, a networking singleton, and a Swift file called \`Utilities\`, and then Thursday’s checkout cannot ship because Home’s snapshot tests are red. The staff job is constraints for many teams, not a perfect folder tree. Users need one login, one payment, one crash reporter. Engineers need seams so a feature can move without a company-wide rewrite.

That is the Day 4 strangler, scaled. You extract a platform the same way you extract checkout: at the boundary that is already on fire. Auth and HTTP go first because every feature pays the 401 storm. Design system goes early because visual drift is a user-facing bug. Persistence kits go out when the second team copies a Core Data stack. You do not start with a mandated architecture cookbook. Mandated furniture is how Hello World takes a week and how the camera team still forks UIKit because the cookbook forbids it.

Crash-free 99.7 percent is not a slogan. It is \`unowned\` in socket callbacks, force unwraps on server URLs, and untested migrations. Treat those as SLIs. CI time is a function of the import DAG. If every feature imports every other feature, you do not have modules, you have compile-time coupling with extra SPM syntax. Observability has to be boring and universal or the crash that only happens on iOS 17 with a German locale will arrive as a one-line \`EXC_BAD_ACCESS\` and no breadcrumbs.

What you refuse to standardise is how you keep the train moving. A reactive framework in every module makes hiring and onboarding a religious test. A single schema for the whole app means a notes migration can brick checkout. Full UI coverage of two hundred screens means nobody refactors. Micro-modules per screen make the DAG a hairball. Staff is knowing which year you are in: the first month, a strong platform slows you down; the second year, it is the only reason weekly release survives.`,
      internals: `\`\`\`text
App (composition, flags, logs)
  ├─ Platform: HTTP, Auth, Design, Analytics, PersistenceKit, Crash
  ├─ Feature: Home, Chat, Checkout, Camera, Account, …
  └─ Adapters: Ads SDK, Payments SDK, maps, camera representable
\`\`\`

Dependencies point inward. Features do not import each other. Cycles in the DAG show up as CI time and as “we cannot flag-off checkout.” dSYMs and privacy manifests are release artifacts, not wiki pages.`,
      testing: `Platform modules require unit tests on token refresh, migration, and the HTTP retry policy. Feature modules require store tests with fake clients. The weekly train requires a small UI smoke on one simulator in CI and a larger nightly. Add a chaos case: a 401 storm against the stub server, asserting one refresh and one logout. A breaking Keychain change gets a dual-read test and a metric on logout spikes after release.`,
      pitfalls: `A platform team that only writes RFCs. Feature flags that never die and become a second product. A temporary shared folder that outlives the reorg. Binary-size and startup work ignored until the EU privacy form asks what you collect. Nightly TSan that nobody looks at. Letting each team mint a URLSession with its own cookie jar.`,
      alternatives: `A monorepo wins until binary size or CI forces a split. Multi-repo needs a ruthless versioning story or you will pin forever. Bazel appears when SPM incremental is no longer enough; it is not a year-one move. A small team can live in one target longer than architects admit, as long as the HTTP and auth boundaries exist as types.`,
      tradeoffs: `A strong platform slows the first month and speeds the second year. Over-platforming makes a button a week-long design-system ticket. Weekly trains reject perfect local branches and accept flags. Crash-free rate fights feature velocity when you block on sanitizer nights; pick a sample, not a freeze.`,
      followups: [
        {
          q: 'How do you handle a breaking Keychain change?',
          a: 'A migrator with dual read, a flag on the new access group, and a metric on logout spikes after release. Never a silent wipe.',
        },
        {
          q: 'Who reviews architecture pull requests?',
          a: 'Platform owns HTTP and auth. Feature leads own their module. Staff arbitrates cycles in the DAG and shared persistence.',
        },
        {
          q: 'What is the SwiftUI adoption policy?',
          a: 'New features default to SwiftUI. Camera, maps, and video escape through representables with identity rules. No rewrite of two hundred screens.',
        },
        {
          q: 'How does a red feature miss the train without blocking everyone?',
          a: 'The flag stays off. The binary can still contain the code. A long-lived git fork is how you spend Friday merging instead of shipping.',
        },
        {
          q: 'Where do third-party SDKs live?',
          a: 'Adapters in the app or a thin module. Feature code talks to your protocol. Privacy manifests and init cost are platform-reviewed.',
        },
        {
          q: 'What do you do when CI is twenty-eight minutes?',
          a: 'Treat it as a DAG bug. Cache SPM, test changed modules, stop running two hundred snapshots on every PR. Time is an architecture signal.',
        },
      ],
      teaches: [
        'Platform versus feature',
        'Release trains and flags',
        'Observability as an SLI',
        'CI as architecture',
        'What not to standardise',
        'Strangler at org scale',
      ],
    },
    {
      id: 'd10-p4',
      title: 'Design a camera/capture SDK used by host apps',
      difficulty: 'Expert',
      kind: 'Design',
      prompt: `You are building a capture SDK that host apps embed: KYC photo, social video, marketplace listing, in-app scanner. Hosts are UIKit and SwiftUI. They will background mid-recording, rotate, and deny permissions. The SDK must not jetsam the host, must not leak the session after the host pops, and must not require each host to become an AVFoundation expert.

Design the SDK surface, session lifetime, buffer and file pipeline, background behaviour, entitlements and privacy, and how you keep host SwiftUI identity from tearing the camera down. Name what you would measure in Instruments in a host app.`,
      think: [
        'Who owns \`AVCaptureSession\` — a SwiftUI view, or a long-lived controller the host holds?',
        'What happens to CMSampleBuffers if a host retains them past the callback?',
        'Which entitlements and usage strings does the SDK document versus silently require?',
        'How do you cancel recording when the host backgrounds, and what do you flush to disk?',
        'Where do retain cycles hide: delegates, preview layer, notification observers?',
      ],
      solution: `The public surface is small. A \`CaptureController\` the host owns for the life of the flow, configured with a \`CaptureRequest\` (photo, short video, document scan). Outputs are files or downsampled \`Data\`, plus a stream of state: permissions, running, interrupted, finished, failed. The host UI binds to that state. The SDK owns \`AVCaptureSession\`, the preview connection, and the file writer. Hosts do not import session presets into their view controllers.

Session start is expensive and thermal. Create the session once per flow, not per \`body\`. SwiftUI gets a representable whose identity is stable for the screen, not \`id(UUID())\`. The coordinator holds the controller weakly from delegates. Preview is a layer the representable attaches; tearing the representable down stops the session in \`dismantle\`. Permission is a first-class async step that surfaces denied and restricted, instead of a black preview the host cannot explain.

Buffers never outlive the output callback unless you copy. Photo capture uses the photo output and writes a downsampled JPEG to a unique URL in a capture directory the host can delete. Video writes to a file as it goes so a kill does not lose the entire clip; interruption from audio session, phone call, or background should stop recording cleanly and emit a recoverable file or a failure. Use a bounded background task to finish the file write, not to keep recording in the background unless the product is explicitly a background capture app — most hosts are not, and the OS will not let you pretend.

Entitlements live in the host. The SDK’s README and a \`CaptureRequirements\` type list camera, microphone, and optional photo library usage strings, plus the privacy manifest keys you will hit. Do not reach into the photo library if the host only needed a camera frame. For KYC, keep frames in memory only as long as the model needs, then drop them. Run vision or downsample off the main actor. Cancel in-flight processing when the host calls \`stop()\`.

Instruments in a host: Allocations while the camera runs, persistent bytes after pop, Memory Graph for \`AVCaptureSession\` and the SDK objects, Time Profiler if the preview hitches (usually a host doing work on the session queue), and energy if a host left the session running on a hidden tab.`,
      explanation: `Host apps do not want a camera. They want a document photo that survives a phone call, a ten-second listing video that does not take the process to 900 megabytes, or a KYC still that legal can defend. If your SDK leaks the session, you have not shipped a feature. You have shipped a jetsam in someone else’s crash reporter, and they will delete you.

The hard part is lifetime, not filters. \`AVCaptureSession\` is a long-lived object with delegates, a preview layer, and device inputs that fight with SwiftUI identity. If a view’s identity flips, the session restarts, the user sees a black flash, and you burn thermal budget. If the host’s view controller is retained by your photo output delegate, Day 1 just happened in a binary the host cannot step through. Weak delegates, explicit \`stop()\`, and cancellation of processing tasks are the product.

Memory is buffers. A 4K frame retained “for a moment” in a Swift array is the Day 8 feed incident with a worse frame rate. The rule is the same as the image pipeline: downsample as early as you can, write to disk if the bytes must survive, and never put \`CMSampleBuffer\` in a SwiftUI \`@State\`. Backgrounding is not a nice-to-have. Recording into a file as you go means a kill leaves a partial that you can decide to keep. Waiting to concatenate in memory means you lose the clip and maybe the process.

Entitlements are a trust boundary with the App Store and with the user. The SDK cannot magically add \`NSCameraUsageDescription\` to the host. You document, you fail with a typed error if the plist is missing, and you do not grab the photo library “in case.” That is architecture for privacy, which is the same inversion as Day 4: the host composes, the SDK does not reach around it. When something hitches, you measure in the host process, because that is where your session actually lives.`,
      internals: `\`\`\`text
Host SwiftUI / UIKit
    │ owns
CaptureController          start/stop, request, state stream
    │
SessionActor               AVCaptureSession, device lock
    ├─ Preview             layer attached by representable
    ├─ PhotoOutput         downsample → file URL
    ├─ MovieFileOutput     incremental file, interruption
    └─ Processing          vision / crop off main, cancellable
\`\`\`

Session callbacks hop off the session queue onto your actor, then publish to MainActor for UI. Delegates are weak. \`CMSampleBuffer\` is not stored. Background: \`beginBackgroundTask\` only to flush the file, then end it.`,
      testing: `A host-app fixture that presents, backgrounds, rotates, and dismisses should leave zero \`CaptureController\` instances in a Memory Graph. Permission denied, restricted, and missing plist each produce a typed error, not a hang. Interrupting a recording with a simulated audio session change should yield either a playable file or a clean failure, never a zero-byte URL the host uploads. Soak on device with the camera running for minutes and watch Allocations plateau. Unit-test downsample output size so a “full res for KYC” flag is explicit.`,
      pitfalls: `Starting the session from \`body\` or from \`onAppear\` without an owner that survives parent refreshes. Strong delegate captures back to a SwiftUI coordinator that captures \`self\`. Holding sample buffers in an array for batch ML. Recording in the background without declaring the mode, then blaming “iOS is random.” Shipping an SDK that uses the photo library for a camera-only flow. \`unowned\` on the host’s view controller from an SDK callback.`,
      alternatives: `A fully custom camera is justified when you need a branded shutter and ML on the stream. \`UIImagePickerController\` or PhotosPicker is enough for many hosts and should be the SDK’s first recommendation when the product is “pick a photo.” ReplayKit is a different product. Scanning can be VisionKit in the host; wrap it rather than reimplementing a document camera on ego.`,
      tradeoffs: `A tiny API surface makes hosts happy and makes your edge cases your problem, which is correct. Incremental video files cost disk and complexity and save you from in-memory concatenation. Running vision on every frame is accurate and will melt phones; throttle. Supporting both UIKit and SwiftUI doubles the representable work and is still cheaper than letting each host invent identity bugs.`,
      followups: [
        {
          q: 'The host is SwiftUI and the camera view blinks on every keystroke in a sibling field. Why?',
          a: 'View identity is resetting and the representable is rebuilding the session. Own the controller higher, give the camera view a stable identity, and do not put changing inputs in the representable’s initializer unless you mean to reconfigure.',
        },
        {
          q: 'Can the SDK refresh tokens to upload the clip?',
          a: 'Prefer handing a file URL back and letting the host upload on its HTTP stack. If the SDK uploads, it must take a token provider protocol, join a single refresh, and never log the token.',
        },
        {
          q: 'What do you do on thermal state serious?',
          a: 'Drop resolution, stop nonessential ML, and surface a state the host can show. Do not keep 4K preview as a point of pride.',
        },
        {
          q: 'How do you avoid fighting the host’s audio session?',
          a: 'Document the category you set, restore on stop, and fail recording if the host needs playback-only. Do not silently stomp a podcast app the user was listening to unless capture requires it.',
        },
        {
          q: 'Where does cancellation live if the host pops mid-encode?',
          a: 'A Task tied to the controller. \`stop()\` and \`deinit\` cancel it. The file writer finishes or deletes the partial based on a flag the request set.',
        },
        {
          q: 'What Instruments view proves a leak after the host dismisses?',
          a: 'Memory Graph: \`AVCaptureSession\`, \`CaptureController\`, and the host VC. Persistent generations in Allocations after pop should be flat.',
        },
      ],
      teaches: [
        'Session lifetime versus SwiftUI identity',
        'Sample buffer memory',
        'Weak delegates in SDKs',
        'Background flush versus background record',
        'Entitlements as host composition',
        'Instruments in the host process',
      ],
    },
    {
      id: 'd10-p5',
      title: 'Design checkout and payments on the client',
      difficulty: 'Expert',
      kind: 'Design',
      prompt: `Design the iOS checkout and payments client for a consumer app. Requirements: cart, address, payment method, 3-D Secure, retries that must not double-charge, and a process that can be killed mid-challenge. Product wants this in six weeks. The rest of the app is 3 000-line view controllers. You will not rewrite the application.

Sketch modules, the pay() state machine, idempotency, what is persisted, what never touches disk or logs, and how 3DS returns into a live or cold process. Explain why the answer is not a 3 000-line \`CheckoutViewController\`.`,
      think: [
        'What is the idempotency key, where is it stored, and who generates it?',
        'What happens if the user double-taps Pay, or if \`pay()\` is called from two screens?',
        'Where does 3DS live, and what if the process dies during the challenge?',
        'What is PCI on a mobile client — what must never be in your logs or your database?',
        'How does this ship in six weeks without boiling the other 80 screens?',
      ],
      solution: `Ship checkout as a strangler feature. A \`Checkout\` module with a \`CheckoutClient\` protocol, a \`CheckoutStore\` on the MainActor, a \`PaymentActor\` that serialises \`pay()\`, and a \`CheckoutRouter\` the existing tab calls. Leave neighbouring view controllers alone. The composition root constructs the payment SDK. The new UI talks only to the store.

The pay state machine is explicit: idle, creating payment intent, awaiting 3DS, polling, succeeded, failed, cancelled. Double-tap cannot start a second intent because \`pay()\` runs on an actor and ignores calls while not idle or failed. The idempotency key is a client UUID persisted with the checkout session as soon as the user hits Pay, before the network. Retries and process relaunch reuse that key. The server treats it as one charge.

3DS is a challenge that can present SFSafariViewController, an SDK screen, or an app switch. Persist enough session state to resume: checkout id, intent id, idempotency key, not PAN. On return, the store asks the backend for the intent status. It does not assume the in-memory machine survived. Cold start from a URL or a scene reconnect should land in the router, restore the session, and continue polling. Never mark success from the SDK callback alone.

PCI on this client means you do not see raw cards if you can help it. Use a hosted sheet or a tokenising SDK. Your logs contain checkout ids and intent ids, never PAN, CVC, or full tokens. Disk holds the resume payload in the Keychain or a protected file, not in an analytics queue. Failures are typed: 402, 3DS abandoned, network, already paid. The UI binds to that, which is why the view controller does not grow to 3 000 lines — it has nothing to do except render a state the store already understands.

Tokens for your API still go through the Day 5 refresher. A 401 during pay joins one refresh and retries the status call, not the charge, unless the backend designed the charge as idempotent — which you already keyed.`,
      explanation: `Checkout is where optimism becomes theft. In chat, a duplicate bubble is embarrassing. Here a duplicate \`pay()\` is a double charge, a support queue, and a compliance conversation. The product problem is a user with a thumb, a flaky radio, and a bank page that can kill your process. If your design assumes the view controller will still be on screen when 3DS returns, you have not designed payments. You have designed a demo.

That is why this is Day 4 and Day 5 in the same breath. You do not rewrite eighty screens. You put a boundary around checkout, invert the payment SDK, and persist a session that can wake up cold. The idempotency key is not an HTTP trivia item. It is the identity of the attempt, the same role a client UUID played in chat, except the duplicate now costs money. Generating it at tap and storing it before the first POST is the whole trick. Generating it inside the request builder on every retry is how you charge twice.

3DS is a second app you do not control. The user will background you, the OS will reclaim you, and Safari will come back through a URL. The store’s job is to become a client of server truth after that: poll the intent, show success only when the backend says so, and keep the button disabled while the actor is busy. MainActor UI state is a projection. The actor is the lock.

A 3 000-line view controller appears when networking, analytics, validation, and the SDK live in \`IBAction\`. Extracting a store is not fashion. It is the only way a six-week feature gets tests for 402 and for “killed during challenge.” If someone wants to put URLSession in the view because “it is faster,” that is the gravity well. Instruments still matter: checkout hitch on appear is decode or a main-thread SDK init, and you will measure it, but correctness is the first budget.`,
      internals: `\`\`\`text
Tab / existing app                 untouched
    │
CheckoutRouter                     resume from URL / scene
    │
CheckoutStore  @MainActor          projection: prices, step, error
    │
PaymentActor                       serial pay(), persisted Attempt
    ├─ CheckoutClient              intents, status poll
    ├─ ThreeDSAdapter              SDK or ASWebAuthenticationSession
    └─ AttemptStore                Keychain: id, idempotencyKey, intentId
\`\`\`

Success is a server status, not an SDK callback. The actor holds one in-flight Task. Cancellation abandons 3DS and marks the attempt cancelled without minting a new key.`,
      testing: `Store tests with a fake client: empty cart, 402, 3DS interrupt then success, 3DS then process kill simulated by a fresh store hydrating from AttemptStore, double \`pay()\` asserting one intent. A test that retries with the same idempotency key and asserts one charge on the fake server. UI smoke for the happy path in the sandbox. Never log fixtures that contain PAN. After launch, watch a metric for duplicate intents per checkout id.`,
      pitfalls: `Creating a new UUID per retry. Marking paid from the 3DS callback. Storing card numbers “just for retry.” Calling the payment SDK from a view controller and hoping \`self\` exists on return. Retrying a non-idempotent POST on timeout. Putting the access token in the checkout SQLite file. A spinner that lasts the entire bank challenge with no resume path.`,
      alternatives: `Apple Pay / Payment Request can remove PAN from your process entirely and is the first design you should prefer when the market fits. A hosted payment page is uglier and simpler for PCI. Stripe-style SDKs are fine if they sit behind your adapter. A monolith view controller “until v2” becomes the product.`,
      tradeoffs: `Serialising \`pay()\` on an actor slightly delays a legitimate second purchase and prevents the catastrophic one. Polling after 3DS is extra load and the only honest model when callbacks lie. Persisting attempts in Keychain is more work than \`UserDefaults\` and is the difference between a resume and a leak of payment metadata into backups you did not think about.`,
      followups: [
        {
          q: 'The user taps Pay, the request times out, they tap again. What happens?',
          a: 'The actor still owns the first attempt. The second tap is ignored or joins. The same idempotency key is sent. The server returns the original intent. You poll.',
        },
        {
          q: 'Where is the composition root?',
          a: 'Wherever checkout is created — tab coordinator or factory. Not inside the view controller, and not inside the payment SDK’s singleton if you can wrap it.',
        },
        {
          q: 'How do you test 3DS without a bank?',
          a: 'The adapter is a protocol. A fake presents and returns succeeded, cancelled, or killed. One sandbox UI test if the vendor offers a test card.',
        },
        {
          q: 'What if token refresh happens during pay?',
          a: 'Status and intent calls join the refresher. You do not start a second charge because refresh retried the wrong method. Retry flags live on GETs and on the idempotent POST only.',
        },
        {
          q: 'Can checkout use optimistic UI like the feed like-button?',
          a: 'You can optimistically disable the button and show a progress step. You cannot optimistically show “paid.” Money waits on server truth.',
        },
        {
          q: 'How do you stop the next screen becoming 3 000 lines?',
          a: 'PR rule: no URLSession, no SDK init, no analytics SDK in UI. Reviewers enforce the boundary harder than the diagram.',
        },
      ],
      teaches: [
        'Strangler checkout',
        'Idempotency as identity',
        '3DS process death',
        'Serial pay() actor',
        'PCI logging and disk',
        'Server truth for money',
      ],
    },
    {
      id: 'd10-p6',
      title: 'Design offline-first notes with sync conflicts',
      difficulty: 'Expert',
      kind: 'Design',
      prompt: `Design an iOS notes app that works without a radio. Users create, edit, and delete on the plane. Two devices can edit the same note. Sync happens when they surface. Product will accept an occasional conflict UI. Product will not accept silent data loss.

Design local persistence, the mutation queue, conflict rules, tombstones, SwiftUI identity for the list, and what you refuse to merge on the MainActor. Cover a v1 that ships and what would change if notes became Google-Docs-style concurrent editing.`,
      think: [
        'What is the source of truth while offline, and what is the sync token?',
        'Is last-write-wins acceptable, and when do you keep both versions?',
        'How do deletes sync without resurrecting a note from the other device?',
        'Which work is an actor, and what does the list observe?',
        'If the user edits during a sync, who wins the row in memory?',
      ],
      solution: `Local SQLite or SwiftData is the truth on device. Each note has a stable \`noteId\`, a monotonically increasing local mutation clock, a server revision, an optional tombstone, and a body. The list observes a query of non-tombstoned notes by \`updatedAt\`. A \`SyncEngine\` actor drains a mutation queue: create, patch, delete. Each mutation is durable before the UI continues, so a kill cannot eat a typed character that already left the editor’s store.

v1 conflict rule: last-write-wins on the server timestamp for the body, but never drop the loser on the device without a safety net. If two patches share a parent revision, the server returns a conflict. The client keeps the local body, stores the server body as a conflict sibling, and the UI shows a resolve screen. That is occasional and honest. Auto-merging paragraphs with a naive string concat will mangle legal notes and look like you solved it.

Deletes are tombstones with a revision, not row removal, until a GC horizon the server defines. Otherwise an offline editor on device B resurrects what device A deleted. The mutation queue is serial per note so two local edits do not race the PATCH. Across notes, a small pool is fine. Sync uses a cursor. On 409, you fetch, branch, and wait for the user if the bodies differ. On 401, join token refresh. Do not start twenty syncs from \`onAppear\`.

The editor binds to \`noteId\`, not to an array index, and not to a view model that owns every note. That is Day 3. Apply remote patches off the main actor, then hop a slim snapshot to the store. If the open editor’s \`noteId\` received a remote change and the local buffer is dirty, you do not clobber the text field. You mark “updated elsewhere” and let the user keep typing or reload.

Refuse Google-Docs CRDTs in v1. If the product later needs concurrent cursors, you replace the body with a proper CRDT or OT in the same store boundary, not by sprinkling merge functions in the view.`,
      explanation: `Notes are a trust product. Someone wrote on the plane and they believe the phone. If sync later chooses the other device in silence, you did not have a conflict strategy. You had a coin flip. The design starts there, not with a CloudKit slide. Offline-first means the local store commits first and the network is a replica, the same inversion as chat, with a nastier merge because the payload is a document instead of an append-only message.

Append-only chat can dedupe on a client UUID. Notes overwrite. Two writers against one body need a parent revision, or you are last-write-wins without knowing you lost. LWW is acceptable when the note is a shopping list and both edits are minutes apart on purpose. It is not acceptable when both bodies diverged. Shipping a conflict sibling is uglier than a merge algorithm in a blog post and it preserves bytes humans typed. That is the senior call.

Tombstones exist because deletes are edits. If you remove the row locally, an older mutation from the other device is indistinguishable from a create. Day 5 persistence shows up as migrations you cannot undo: once you have a queue table and a tombstone column, you test fixtures from old versions. Day 2 shows up as the engine actor and as cancellation when logout happens mid-sync. Day 1 shows up if the engine’s delegate retains a SwiftUI screen.

Do not merge on the MainActor. Diffing two large notes, gzip, and JSON decode of a sync batch belong off main, or Home’s hitch becomes the notes list. SwiftUI identity is the note id so a remote reorder does not destroy the editor’s \`@State\` and wipe the cursor. If you wanted CRDT collaborative editing, you would be designing a different product: operation logs, presence, and a much harder test matrix. Say that out loud and keep v1 shippable.`,
      internals: `\`\`\`text
NotesList / Editor          identity = noteId
        │ observe
NotesStore @MainActor       snapshots, dirty flag per open id
        │
SyncEngine actor
        ├─ MutationQueue    durable, serial per note
        ├─ NotesDB          rows + tombstones + conflict siblings
        └─ NotesClient      cursor sync, 409 → branch
\`\`\`

A local edit writes DB then UI. Sync never writes the open buffer directly. Token refresh sits under \`NotesClient\`, not inside the engine’s merge function.`,
      testing: `Engine tests: two devices, forked bodies, assert a conflict sibling and no silent LWW. Delete on A, edit on B offline, assert tombstone wins or a conflict, never a silent resurrect without a rule. Queue survives process kill: insert mutation, crash before HTTP, relaunch, assert it sends once. Logout cancels the engine and does not leak. Time Profiler on a 2 MB note merge should not show MainActor. A UI test that types, goes offline, launches again, asserts the text is still there — that is the product test.`,
      pitfalls: `Last-write-wins on device clock. Deleting rows instead of tombstones. Binding the editor to the whole notes array so a sync redraws and resets the cursor. Running the first sync from \`body\`. Putting the mutation queue in memory only. Merging by concatenating strings. Using \`unowned\` in a CloudKit-style callback. Refreshing tokens per mutation until the auth server logs you out.`,
      alternatives: `CloudKit with custom conflict handlers if your users are Apple-only and you accept its identity model. A CRDT library if the product is realtime collaboration, which is not a notes v1. Server-authoritative with no offline edits is simpler and not the product you were asked for. Per-field LWW (title versus body) can reduce conflict UI without a CRDT.`,
      tradeoffs: `Conflict UI is rare and honest; silent LWW is common and cruel. Serial per-note queues reduce races and add latency when one note is huge. Tombstones cost disk until GC. A full CRDT removes the resolve screen and adds an engineering organisation you do not have in six weeks.`,
      followups: [
        {
          q: 'How do you handle a note edited while its sync PATCH is in flight?',
          a: 'The in-flight mutation carries a parent revision. A newer local mutation queues behind it with a new parent. If the PATCH succeeds, the next PATCH sends the latest body. If it 409s, you branch.',
        },
        {
          q: 'Where does the cursor live?',
          a: 'A server-issued sync token persisted with the store. Do not invent one from \`updatedAt\` on the client clock.',
        },
        {
          q: 'What is the SwiftUI trap in the list?',
          a: 'Using indices, or \`.id(UUID())\` on rows, which destroys editors and resubmits. Stable \`noteId\`. Do not pass the whole store into every row.',
        },
        {
          q: 'Do you encrypt notes at rest?',
          a: 'If the product promises it, Keychain for keys and encrypted blobs in the DB. Sync then needs a key story across devices. Do not log bodies.',
        },
        {
          q: 'How is this different from chat offline?',
          a: 'Chat is mostly append and dedupe. Notes overwrite a document. Conflicts are first-class, not a duplicate bubble.',
        },
        {
          q: 'When would you actually introduce a CRDT?',
          a: 'When two users type in the same note at once as a product requirement. Until then, conflict siblings and LWW on uncontended fields are enough.',
        },
      ],
      teaches: [
        'Local-first ledger',
        'Mutation queues',
        'Tombstones',
        'Conflict siblings versus CRDT',
        'Editor identity',
        'Merge off MainActor',
      ],
    },
    {
      id: 'd10-p7',
      title: 'Design push, notification extension, and post-login deep links',
      difficulty: 'Expert',
      kind: 'Design',
      prompt: `Design notifications for a product with chat and order updates. Requirements:

* APNs alerts when the app is killed
* A Notification Service Extension that can decrypt or attach an image
* Tapping a notification opens the right screen
* If the user is logged out, they log in first, then land on that screen
* Device token rotation, logout, badge counts
* No duplicate navigation if a cold start also has a URL

Design the client: registration, payload shape you wish the backend sent, extension memory budget, routing, the pending-deep-link queue, and how this interacts with the chat socket and with Keychain.`,
      think: [
        'When do you register for a device token relative to login?',
        'What can a Notification Service Extension actually do in thirty seconds and a small memory ceiling?',
        'Where do you stash a route if the tap happens on the login screen?',
        'How do cold start, warm tap, and universal links avoid double-pushing a thread?',
        'What must the extension not read from the Keychain?',
      ],
      solution: `Register for a remote token after a successful login, and send it to the backend bound to the user and the app version. On logout, tell the backend to drop that token and clear the badge. Handle \`didRegister\` firing later with a new token and upsert. Do not wait for notification permission to fetch the rest of the app, but do not upload a token before you know who the user is.

Wish for a small payload: \`type\`, \`entityId\`, \`conversationId\` or \`orderId\`, and a collapse id. Sensitive bodies are fetched or decrypted in a Notification Service Extension only if you must show them on the lock screen. The extension has a tight time and memory budget — think seconds and a low tens-of-megabytes ceiling, not a second app. It can decrypt a title, download a small image, and call the content handler. It must not run your full sync engine, must not refresh tokens in a loop, and must not decode a 40 megabyte image. If decryption keys live in the Keychain, they live in an access group the extension can read, with the least privilege that still works.

Routing is a single \`DeepLink\` value: \`chat(id)\`, \`order(id)\`, \`unknown\`. All entry points — notification tap, cold \`launchOptions\`, universal link, spotlight — parse into that value and offer it to a \`LinkHandler\` owned by the session. If there is no session, persist the pending link (a small plist or Keychain item, not a full payload) and show login. After login succeeds, consume it once. If login fails, drop or keep based on product, but do not retry navigation on every scene reconnect forever.

The chat socket is still the ledger. A notification is a gap hint plus a UX surface. Tapping chat should open the thread and let the store fetch; the extension must not insert messages into the main database unless you designed that path carefully with the same dedupe keys. Badge is server-authoritative or a derived unread from the store after sync, not \`+= 1\` in the extension on every push.

Deduping navigation: the handler is idempotent for a given link id for a short window, so a cold start that both has a notification and a URL does not push the thread twice.`,
      explanation: `The user is not thinking about APNs. They saw “Maya: running late,” they tapped it, and they expect Maya’s thread. If you dump them on Home because the socket was not up, or on Login without remembering the tap, the notification was a lie. If you deep-link into a thread while a second copy of the same route from a universal link is also firing, you built a navigation stack that feels haunted.

Logged-out tap is the senior case. Cold start with a notification is easy to demo while already authenticated. The real design is a pending route that survives login, 3DS-style process death, and the token refresher. That pending route is identity, the same as a client UUID: one value, consumed once, stored in a place logout can clear. Putting it in a singleton on the app delegate is how you navigate twice after a scene reconnect.

The service extension is a separate process with a short leash. Teams treat it like a miniature app and then jetsam on a large image, or they try to refresh tokens and deadlock on the Keychain. Day 8 memory budgets apply brutally here. Day 5 applies because the extension may see an expired access token and must not start a 401 storm. Often the honest v1 is: show a generic lock-screen body, decrypt only a title, and let the app fetch on tap.

Ownership still matters. Observers for \`didReceiveRemoteNotification\` that capture \`self\` strongly on a coordinator will leak the same way Day 1 taught you. Cancellation matters when the user logs out while you were about to push a thread. Measure with a real tap on a killed app, a logged-out tap, a logged-in warm tap, and a tap that arrives while checkout is mid-3DS — that last one is a product decision, not a default.`,
      internals: `\`\`\`text
APNs
  ├─ killed / background → system UI
  │       └─ NSE (optional): decrypt title, small image, contentHandler
  └─ tap → App
           DeepLink.parse
                │
           Session? ──no──► PendingLink store → Login → consume once
                │ yes
           LinkHandler (idempotent)
                └─ ChatStore / OrdersStore   (fetch gap, do not trust payload as DB)
\`\`\`

Device token upsert is authenticated HTTP through the same refresher. Badge updates after the store syncs, not in every extension invocation.`,
      testing: `A fake \`LinkHandler\` records routes. Tests: logged-in tap, logged-out tap then login, login cancel, duplicate URL plus notification, logout clearing pending and token. NSE tests cannot be full XCTest of APNs; test the decrypt function with a size fixture that would exceed a budget and assert you skip the image. Manual matrix on device: killed, background, foreground, permission denied. After logout, assert the backend fake received a token delete.`,
      pitfalls: `Uploading a device token before login, so the next user on a shared iPad gets the previous user’s chats. Doing full chat sync in the NSE. Storing the pending URL forever so an old order opens next week. Trusting the push body as a message insert without dedupe. Using \`unowned\` in the extension’s completion if you hop queues. Incrementing the badge locally until it lies. Registering for remote notifications on every \`applicationDidBecomeActive\`.`,
      alternatives: `No NSE if the lock-screen body can be generic; simpler and safer. A content extension for custom UI is rarely worth it. Push-to-sync silent notifications are a different entitlement and a battery conversation. Third-party push providers still terminate at APNs on iOS; you still own routing.`,
      tradeoffs: `Decrypting in the NSE makes lock screen useful and expands the key-sharing surface. Pending links after login are extra state and the only way the tap is honest. Idempotent handlers can drop a legitimate second tap on the same order in a short window; keep that window small. Server-side badge is extra API and beats a lying number.`,
      followups: [
        {
          q: 'Where do decryption keys live so the NSE can read them?',
          a: 'Keychain access group shared with the extension, least privilege, not the refresh token if you can avoid it. A separate wrapping key is better than dumping the whole session.',
        },
        {
          q: 'What if 3DS is on screen when a chat notification is tapped?',
          a: 'Product call. Default: queue the link and do not destroy the payment challenge. Consume after checkout reaches a terminal state.',
        },
        {
          q: 'How do you avoid the chat socket and the tap both inserting one message?',
          a: 'Same client UUID / server id dedupe as the chat design. Push is not a second writer with a different schema.',
        },
        {
          q: 'Provisional authorization versus a permission prompt?',
          a: 'Provisional can deliver quietly without a prompt. Marketing will hate it; chat may still want a real prompt at a moment of value, not on first launch.',
        },
        {
          q: 'What happens on token refresh failure inside the NSE?',
          a: 'You do not refresh there if you can help it. Show a generic body and let the app handle auth on tap. A failed refresh in the NSE must not log the user out of the app without a single, deliberate path.',
        },
        {
          q: 'Cold start has both a notification and a universal link. Who wins?',
          a: 'Parse both into DeepLink. If they are the same entity, navigate once. If they differ, pick a precedence (notification tap is user intent) and log the drop.',
        },
      ],
      teaches: [
        'Push as a hint',
        'NSE budgets',
        'Pending links after login',
        'Idempotent routing',
        'Token upsert versus logout',
        'Keychain access groups',
      ],
    },
    {
      id: 'd10-p8',
      title: 'Design a stories and video player with a tiny AVPlayer pool',
      difficulty: 'Expert',
      kind: 'Design',
      prompt: `Design the client for Instagram-style stories and in-feed video. You may keep at most a tiny pool of \`AVPlayer\` instances — think two or three — because a player per cell is how you jetsam. Users fling fast, sound is usually off, the next story should start instantly, and leaving the screen must actually tear work down.

Design pooling, attach/detach on visibility, prefetch, SwiftUI identity, audio session, progress persistence, and what you measure in Instruments. Combine this with the feed pipeline; do not assume infinite memory.`,
      think: [
        'When does a player attach to a cell, and what happens on reuse?',
        'How do you prefetch the next asset without creating a fourth player?',
        'What SwiftUI pattern will recreate players in \`body\`?',
        'Where does audio session ownership live so stories do not kill podcast playback forever?',
        'What Allocations pattern means the pool is a lie?',
      ],
      solution: `A \`PlayerPool\` actor or MainActor-adjacent service owns two or three \`AVPlayer\` instances and a slightly larger set of \`AVPlayerItem\`s. Cells never alloc a player. On visibility — say fifty percent for feed, or “is the current story” for a pager — the cell asks the pool to attach \`storyId\` / \`postId\`. Attach means: dequeue a player, replace the item if needed, seek to saved progress, set muted, play. On reuse or disappearing, detach: pause, remember time in a small \`ProgressStore\` keyed by id, clear the layer, return the player to the pool. Do not \`replaceCurrentItem(with: nil)\` in a way that surprises the next attach; be explicit.

Prefetch the next story’s \`AVURLAsset\` and maybe warm an item, but do not take a fourth player. You can prepare an item and only \`replaceCurrentItem\` when the pager lands. HLS versus file changes buffering; the pool API should take a \`PlaybackRequest\` so the policy can differ. Cancel asset loading when the user flings past. That is Day 2 cancellation on a media path.

SwiftUI: the player layer lives in a representable whose identity is the cell’s stable id, and the player itself is injected from the pool, not created in \`body\`. \`@State\` holding an \`AVPlayer()\` initializer is how you leak players on every refresh. UICollectionView cells are often the honest answer for video; SwiftUI is fine if the representable is disciplined.

Audio: stories start muted. Unmute is user intent and sets the session category. On leave, restore what you can so you do not strand a podcast. Progress persistence is in-memory plus a tiny disk cache for “resume this story,” not a video file cache of everything. Memory budget is shared with the image pipeline — stories cache is smaller and evicts first.

Instruments: Allocations while flinging, count of \`AVPlayer\` and \`AVPlayerItem\`, persistent bytes after leaving stories, Time Profiler if the pager hitches on attach (usually a main-thread \`replaceCurrentItem\` plus a decode), Memory Graph for items that outlived the pool. If player count grows with scroll distance, the pool is not a pool.`,
      explanation: `Video is where feed designs go to die. Still images downsample; video is a decoder, a buffer, and a layer that loves to outlive the cell. Users fling stories like they owe them money. If each cell creates an \`AVPlayer\`, you will watch Allocations climb the same 150 to 900 megabyte hill from Day 8, except now you also have audio session bugs and a black flash on reuse. The product constraint is the pool size. Architecture is how you attach identity to those few players without lying.

Identity is the story id. Progress, mute, prefetch, and analytics all key off it. Reuse without detach is how audio from story four plays under story nine’s picture. SwiftUI will help you get this wrong by recreating the player whenever the parent view invalidates. That is Day 3, not a “SwiftUI is bad at video” slogan. Either you own the player above the view, or you use a UIKit cell whose reuse is explicit.

Prefetch is a budget conversation again. Warming the next asset makes the pager feel native. Warming ten assets is how the pool stays at three players while items and buffers fill the dirty memory column. Cancel when the user skips. The feed’s image pipeline and the player pool share a process; they must share a memory warning handler. Evict images before you kill the current player, or the on-screen story hitchs.

Leaving the screen is a lifetime test. Day 1 cycles hide in notification observers for \`AVPlayerItemDidPlayToEndTime\` and in closures that capture the cell. Weak observers, remove on detach, cancel loading Tasks. If Memory Graph still shows players after pop, you did not finish. The senior answer names the pool size, the attach policy, and the Instruments graph that would prove it, in the same breath as the boxes.`,
      internals: `\`\`\`text
StoriesPager / Feed cell     identity = storyId / postId
        │ attach/detach
PlayerPool                   2–3 AVPlayer, few AVPlayerItem
        ├─ ProgressStore     time by id
        ├─ AssetPrefetch     next URL, cancellable
        └─ AudioSessionGate  mute default, restore on leave
\`\`\`

Replace item on the player you already own. Do not init a player in \`body\`. On memory warning, drop prefetched items first, then detached players’ items, never the on-screen one if you can help it.`,
      testing: `A fake pool that records attach and detach: scroll a list of twenty videos, assert player instances stay at three. Reuse a cell, assert the previous id’s audio is not playing. Kill the screen, Memory Graph empty of players. Prefetch cancel: start warming story 5, jump to 20, assert the warm for 5 is cancelled. UI tests are weak for this; a host fixture with Instruments generations is the evidence. Unit-test progress save/restore independently of AVFoundation.`,
      pitfalls: `\`AVPlayer()\` inside a SwiftUI view property. Not detaching on reuse. Adding a notification observer every attach without removing it. Keeping player items for every seen story. Unmuting globally and never restoring. Prefetching full progressive downloads into memory. Hitting play in \`cellForItem\` for off-screen rows. Using \`.id(UUID())\` on the pager.`,
      alternatives: `A single player for stories (pager is one screen) plus a separate single player for in-feed autoplay. That is an even smaller pool and more attach churn when jumping between surfaces. Third-party players still need a pool policy. Texture/AsyncDisplayKit is history; the policy remains.`,
      tradeoffs: `Three players: smoother pre-attach, more memory. One player: simple, more black frames on skip. Prefetch next only: usually enough. HLS reduces disk and adds stall behaviour you must surface. UIKit cells are uglier in a SwiftUI app and easier to reason about for reuse.`,
      followups: [
        {
          q: 'How do you play the next story with no gap?',
          a: 'Keep player A on the current item. Warm player B’s item for the next id. On advance, swap who is on-screen and start B. Do not create player C.',
        },
        {
          q: 'What if the feed and stories are both visible on iPad?',
          a: 'One process-wide pool with a priority: the focused surface wins. Do not give each feature its own three players.',
        },
        {
          q: 'Where does cancellation live when a cell is reused mid-load?',
          a: 'The attach token is a Task or an incrementing generation for that cell. Completion checks the generation before attaching the layer.',
        },
        {
          q: 'How do you prove a leak of AVPlayerItem?',
          a: 'Allocations persistent bytes after leaving stories, plus Memory Graph. Items should match the pool, not the number of stories viewed.',
        },
        {
          q: 'Should progress live in SwiftData?',
          a: 'A tiny Key-Value or file is enough. Do not put playback time in the same store as the feed DTO if it causes migrations.',
        },
        {
          q: 'Mute and VoiceOver?',
          a: 'Do not assume muted video is fine. Respect VoiceOver and captions as product, not as a player-pool afterthought.',
        },
      ],
      teaches: [
        'Player pool as a memory budget',
        'Attach/detach versus alloc',
        'SwiftUI identity and AVPlayer',
        'Prefetch cancel',
        'Audio session restore',
        'Instruments on player count',
      ],
    },
    {
      id: 'd10-p9',
      title: 'Design an auth session shared with a widget, app group, and Keychain',
      difficulty: 'Expert',
      kind: 'Design',
      prompt: `The app has a widget that shows “today’s tasks” for a logged-in user, and a Notification Service Extension. Login uses access plus refresh tokens. Product wants the widget to update without opening the app, and wants logout in the app to take effect on the widget immediately.

Design where tokens live, what the widget is allowed to read, how refresh works across processes, app groups, Keychain access groups, Keychain accessibility, and the failure modes: expired access, failed refresh, user switched accounts, and a widget running while the app is mid-refresh. Combine with the Day 5 single-flight refresher — now there are three processes.`,
      think: [
        'What belongs in the Keychain access group versus the app-group container?',
        'Who is allowed to call \`/refresh\`, and what happens if the widget and the app both try?',
        'What does logout delete, and how does the widget notice?',
        'Can the widget prompt for biometrics?',
        'What snapshot can the widget show without holding a refresh token?',
      ],
      solution: `Put secrets in the Keychain with an access group. Put non-secrets — display name, a snapshot of today’s tasks, a logged-in boolean, expiry wall time — in the app-group container as a small file the widget can read quickly. The widget’s job is to render a snapshot and ask for a timeline reload. It is not a second app with a full sync engine.

Refresh stays in the main app if you can possibly help it. The Day 5 \`TokenRefresher\` actor already joins in-process callers. Across processes you need a second lock: a file coordinator or an advisory lock in the app group, plus the Keychain as the source of the current access token. If the widget finds the access token expired, it should show a stale snapshot or a “Open the app” placeholder, not mint fifteen refreshes from an extension budget. If you must refresh from an extension, it goes through a tiny \`AuthShared\` module that takes the lock, reads the refresh token, posts once, writes both tokens, and unlocks. Failed refresh clears the session in Keychain and writes \`loggedIn = false\` to the container, then reloads timelines.

Logout is a transaction: delete Keychain items, wipe the container snapshot, \`WidgetCenter.reloadTimelines\`, tell the backend to drop the device token. Account switch is logout then login, never “overwrite access and hope the widget notices.” Accessibility: \`kSecAttrAccessibleAfterFirstUnlock\` is the usual compromise so the NSE can read a wrapping key after reboot; \`WhenUnlocked\` will surprise you at 3 a.m. Background refresh of the widget should not require biometric. If the product requires biometric to use the session, the widget shows a locked placeholder.

The app still owns the live HTTP stack. After a successful refresh it writes the new access token and a new snapshot, then reloads widgets. Mid-refresh, the widget may read an about-to-expire token; that is fine if it only paints cache. It must not start a parallel refresh without the lock, or you recreate the fifteen-refresh storm across processes.

Do not store the refresh token in \`UserDefaults\` in the app group. Do not put PAN-like data in the snapshot. Do not share a whole Core Data stack into the widget “for convenience.”`,
      explanation: `The widget is a glance. Users glance, they do not want to log in on a home-screen tile, and they will not forgive yesterday’s account after they logged out at midnight. The product problem is one session, three processes, and a refresh token that is a house key. If you copy the Day 5 refresher into the widget and the NSE, you have three house keys and no lock on the door.

App groups make people sloppy. The container is a shared disk. It is convenient and it is a backup and leakage story. Tokens do not belong there. Keychain access groups are the right primitive for secrets, with accessibility chosen for whether the NSE must work before first unlock. That choice is a threat-model conversation, not a default you paste from a gist. The snapshot in the container is a cache with an expiry, the same idea as stale-while-revalidate, except the “revalidate” often means “the app will write a better snapshot when it can.”

Single-flight across processes is the new hard part. In one process, an actor is enough. Across processes, two refreshes can both read the old refresh token and the second can revoke the first’s new token, which looks like a random logout. A lock in the group plus “refresh token rotation is detected and retried once” is the adult version. If that sounds expensive for a tasks widget, good — that is why the widget should not refresh. Let it be stale.

Logout is identity for the session. Clearing only \`UserDefaults\` and leaving the Keychain is how a widget keeps showing Maya’s tasks on a shared iPad. Reloading timelines is part of logout, not a courtesy. SwiftUI in the widget has its own identity issues, but they are secondary to “which user is this.” Measure with a real logout, a reboot, an expired access token, and a widget tap that opens the app into login instead of into someone else’s list.`,
      internals: `\`\`\`text
App  ── TokenRefresher actor ──► Keychain (access group)
  │ writes snapshot, reloadTimelines
  ▼
App Group container     name, tasks snapshot, loggedIn, expiry
  ▲
Widget / NSE  read snapshot; NSE may read wrapping key
              expired? → placeholder / open app
              if refresh allowed: file lock → one POST /refresh
\`\`\`

WidgetKit timelines are cheap to miss and expensive to get wrong. A failed refresh writes logged-out to the container so the next timeline render does not keep painting private tasks.`,
      testing: `A test host with a fake Keychain and a fake container: login writes both, widget reader sees snapshot, logout clears both. Two overlapping refreshes under a lock assert a single POST. Rotation: second refresh with old token gets 401, retry once with newly written token. Widget tests can instantiate the reader against the fake container. Manually: login, add widget, logout, confirm the tile blanks without waiting for the next calendar tick — force a reload in logout. Reboot and confirm accessibility behaviour.`,
      pitfalls: `Refresh token in the app-group \`UserDefaults\`. Widget calling \`/refresh\` on every timeline. Biometric-gated Keychain items the NSE cannot read, so lock-screen notifications go generic forever without explanation. Leaving the old user’s snapshot after account switch. Sharing the entire main app target with the widget so startup loads the world. Using \`unowned\` in a Keychain callback. Assuming \`WidgetCenter.reload\` is instantaneous on all OSes.`,
      alternatives: `No secrets in extensions: widget always shows a non-personal placeholder until the app writes a snapshot. Simplest security, weakest product. A background app refresh that only the app runs, widget is display-only. Sign in with Apple’s credential state as an extra check on foreground, not as the widget’s only auth.`,
      tradeoffs: `Letting the widget refresh makes tiles live and multiplies the 401-storm surface. Display-only widgets are safer and sometimes a day stale. \`AfterFirstUnlock\` makes NSE useful and widens the window a stolen device can read keys. A file lock is ugly and prevents rotated-refresh races that look like ghosts.`,
      followups: [
        {
          q: 'The app is mid-refresh and the widget starts a timeline. What does it render?',
          a: 'The last snapshot. It does not wait on the lock. If the snapshot is expired, it renders a placeholder rather than blocking WidgetKit.',
        },
        {
          q: 'Where do you put the access token for URLSession in the app?',
          a: 'Memory cache plus Keychain, as in Day 5. The widget should prefer the snapshot over making authenticated calls.',
        },
        {
          q: 'How do you debug a widget that still shows the old user?',
          a: 'Read the container file and the Keychain item on device. Confirm logout called reload. Check you did not have two app groups from a clone bundle id.',
        },
        {
          q: 'Can the NSE use the refresh token to fetch a rich notification body?',
          a: 'Prefer a payload that does not need it, or a short-lived fetch token. If it must refresh, it uses AuthShared and the lock, and it must be allowed to fail into a generic body.',
        },
        {
          q: 'What is in the privacy manifest story?',
          a: 'You declare the APIs you use. Sharing data with an extension is still your app’s data. Do not invent a second analytics SDK in the widget.',
        },
        {
          q: 'How does this interact with the pending deep link after login?',
          a: 'Pending links live with the session. Logout clears them. A widget tap can set a pending link in the container for the app to consume, the same consume-once rule as notifications.',
        },
      ],
      teaches: [
        'Keychain versus app group',
        'Cross-process refresh locking',
        'Widget as snapshot, not app',
        'Logout as a transaction',
        'Accessibility and NSE',
        'Day 5 refresher at process scale',
      ],
    },
    {
      id: 'd10-p10',
      title: 'Design an image loading pipeline as a system',
      difficulty: 'Expert',
      kind: 'Design',
      prompt: `Design the image loading system for a feed, avatars, and a lightbox. This is not a recap of Kingfisher or Nuke. Treat it as production infrastructure: request identity, download, disk, decode, downsample, memory budget, cancel on cell reuse, prefetch, and memory warnings. The same pipeline must not decode a 4000×3000 photo into a 40 point avatar, must not keep work alive after reuse, and must not hitch Home on the main thread.

Sketch stages, keys, concurrency, how SwiftUI and UIKit cells talk to it, what you persist, and what you would show in Instruments to prove the budget. Tie this to Days 1–9: ownership of callbacks, Task cancellation, view identity, module boundaries, HTTP tokens, measurement, and tests.`,
      think: [
        'What is the cache key — URL only, or URL plus target size and scale?',
        'Where does downsample happen, and on which executor?',
        'How does reuse cancel in-flight work without racing the next bind?',
        'What is the memory cost function, and what happens on a warning?',
        'Who owns the HTTP stack and the tokens — the pipeline, or the app’s client?',
      ],
      solution: `A request is \`ImageRequest(url, targetSize, scale, options)\`. The cache key includes size and scale, because a lightbox decode is not an avatar decode. Pipeline stages: memory cache hit → disk cache hit → download → downsample and decode → store both caches → deliver. Delivery to UI is a small object, not a conversation with URLSession from the cell.

Memory cache is NSCache or an equivalent with a cost in bytes of the decoded bitmap, not in image count. Disk cache stores the already-downsampled variant when you can, plus optionally the original for lightbox, under a separate budget. Decode uses ImageIO thumbnail APIs or a bitmap context at the target pixels. Never \`UIImage(data:)\` for feed. All of that work is off the MainActor. The MainActor only assigns the image to a view.

Cancellation is a generation or a Task per bind. UIKit: \`prepareForReuse\` cancels. SwiftUI: \`.task(id: request)\` or an explicit loader owned by the row’s stable id, cancelled when the id changes. A late completion must check the generation before mutating the view, or you get the search-race from Day 2 with faces. Prefetch uses the same pipeline with a lower priority and the same cancel rules. A global cap on in-flight downloads sits next to the Day 5 HTTP client. The pipeline does not mint its own URLSession with a second cookie jar. It takes a \`DataClient\` so tokens and pinning stay in one place.

Memory warning: drop the memory cache, keep disk. Do not drop the image currently on screen. Lightbox can keep a second cache with a hard cap of one or two full-res images. Avatars share the pipeline with a small target size so their keys never collide with feed keys.

Instruments: Allocations while flinging, dirty vs compressed, persistent after pop, Time Profiler to prove decode is not on main, Memory Graph for \`UIImage\` counts, Hitches on first paint. If total decoded bytes climb without bound, the cost limit is fake or downsample never ran.`,
      explanation: `Users do not ask for an image pipeline. They fling a feed and they expect faces to appear without the phone dying in a pocket. The 4000×3000 photo that becomes a 48 megabyte bitmap is the whole incident. A library name does not downsample for you unless you pass a size. Designing the system means naming the key, the stage that shrinks pixels, the cancel on reuse, and the budget that makes prefetch safe. If you skip any one of those, you have a downloader, not a pipeline.

Request identity is the same idea as message ids and story ids. URL-only keys make an avatar and a full-width cell share a decode, or worse, they make you decode full-res then scale in the view, which still paid the allocation. Size in the key duplicates disk entries and saves the process. That is a tradeoff you take on purpose. Cancellation is how reuse does not paint the wrong face, which is identity plus Day 2, not a UIKit trivia item. A completion that captures the cell strongly is also a Day 1 leak; weak view, strong request, check generation.

Architecture is a module with a protocol on the HTTP edge so checkout and auth do not inherit a cowboy session from “the image team.” Tokens belong to the authenticator. The pipeline joins refresh like everyone else. Persistence of disk cache is disposable; do not migrate it like notes. If the cache schema changes, delete it. That is allowed here and forbidden for chat history, and saying the difference is seniority.

Measurement is the close of the week. You can talk about NSCache in the interview and still ship a 900 megabyte feed. Allocations on device, a generation mark after pop, and a Time Profiler shot that shows ImageIO on a background thread are the design artifacts. Simulator RAM will lie. The senior move is to put a budget number in the PR and a trace that it held.`,
      internals: `\`\`\`text
Cell / SwiftUI ImageView     bind(request), cancel on reuse / id change
        │
ImagePipeline
        ├─ MemoryCache       cost = decoded bytes, purge on warning
        ├─ DiskCache         sized variants, disposable
        ├─ Download          DataClient (tokens, pinning, HTTP/2)
        └─ Decode            ImageIO thumbnail, off main
\`\`\`

A generation integer per view: bind increments, completion applies only on match. Prefetch is the same pipeline with priority and an in-flight cap. No second URLSession.`,
      testing: `Unit-test the downsampler: 4000×3000 in, 120×120 at 3× out, assert pixel dimensions and that memory cache cost is in the right order of magnitude. Cancel: start a slow download, rebind a different URL, assert the first completion does not deliver. Token: a 401 during image fetch joins one refresh. Memory warning: fill cache, post warning, assert the next fetch is a miss in memory and a hit on disk. Instruments fixture: scroll a hundred unique images, player count zero, \`UIImage\` count bounded. TSan on the cache if you roll your own instead of NSCache.`,
      pitfalls: `\`UIImage(data:)\` on main. Cache key is URL only. Storing images in SwiftData. Prefetch without cancel. A custom cache that never evicts. Completions that strongly capture the cell. Using the feed view model as \`@ObservedObject\` in every row so one decode completion redraws the list. Retrying downloads in a loop on 401 without a refresh join. Treating Kingfisher as proof that downsample happened.`,
      alternatives: `Nuke, Kingfisher, or SDWebImage as the implementation of this design, configured with size, cache cost, and cancel. Rolling your own is justified when you have a custom decode (document scanning, HDR) or a hard budget the libraries fight. \`AsyncImage\` is not a pipeline. Downsampling at the CDN is the best optimisation and still needs a client budget for when the CDN is wrong.`,
      tradeoffs: `Sized disk variants cost disk and save CPU and RAM. Keeping originals for lightbox costs RAM policy complexity. Aggressive prefetch feels native and will blow the budget if decode is full-res. NSCache is simple and can evict under pressure in ways that surprise tests; a manual LRU is predictable and easy to get wrong under concurrency. Sharing one pipeline across avatars and feed is less code and requires the size to be in the key.`,
      followups: [
        {
          q: 'Why not decode in the view body once and cache the UIImage in the model?',
          a: 'Models then hold bitmaps, lists invalidate, and you skip downsample. Decode belongs in the pipeline; the model holds a URL and size.',
        },
        {
          q: 'How do you cancel in SwiftUI without UIKit reuse?',
          a: '\`.task(id: request)\` cancels when the id changes. The request must include size. Do not put the loader on a parent that outlives the row.',
        },
        {
          q: 'What is the cost of a 120 point avatar at 3×?',
          a: 'About 120×3 squared times 4 bytes, on the order of half a megabyte if you got it wrong at full res it is tens of megabytes. The interview wants you to show that arithmetic.',
        },
        {
          q: 'Does the pipeline own token refresh?',
          a: 'No. It uses DataClient. Refresh is single-flight in the authenticator. Images can 401 like everything else.',
        },
        {
          q: 'How do you stop a lightbox from evicting the feed cache?',
          a: 'Separate memory partitions or a cap on full-res entries. Feed thumbnails should not be victims of one pinch-to-zoom.',
        },
        {
          q: 'What Instruments check belongs in the PR that “adds caching”?',
          a: 'Allocations while flinging before and after, plus a Memory Graph after pop. A library bump without a trace is not a fix.',
        },
        {
          q: 'How does this interact with the player pool?',
          a: 'Shared memory warnings. Evict prefetched images first, then detached player items. They are one process budget.',
        },
      ],
      teaches: [
        'Request identity includes size',
        'Decode off main',
        'Cancel on reuse',
        'Memory cost in bytes',
        'HTTP client as a seam',
        'Instruments as proof',
        'Week combined',
      ],
    },
    {
      id: 'd10-p11',
      title: 'Design a SwiftUI + UIKit hybrid migration for a 200-screen app',
      difficulty: 'Expert',
      kind: 'Architecture',
      prompt: `The app is 200 screens, mostly UIKit, 3 000-line view controllers, weekly train, 12 teams. Product wants SwiftUI “by end of year.” Camera, maps, checkout, and the feed’s video cells are UIKit and must stay correct. You will not rewrite 200 screens. You will not freeze feature work for a year.

Design the hybrid: where SwiftUI is the default, where UIKit stays, how you host each inside the other without destroying identity, navigation, the composition root, and how you stop a representable from restarting the camera on every keystroke. Call out measurement (Day 8) and tests (Day 9) so the migration is not a vibe.`,
      think: [
        'What is the strangler boundary — a screen, a cell, or a tab?',
        'Who owns navigation when a SwiftUI stack pushes a UIKit checkout?',
        'How do you keep AVCaptureSession / AVPlayer identity stable across SwiftUI refreshes?',
        'What do you refuse to standardise (problem 3) while still having a policy?',
        'Which Instruments traces prove a hosting wrapper did not leak the UIKit VC?',
      ],
      solution: `Policy, not a rewrite. New features default to SwiftUI. Camera, maps, rich text, the player pool, and anything with a session object stay UIKit behind a representable with a stable identity. Checkout can be SwiftUI chrome around a UIKit payments SDK. Existing UIKit screens are not touched until they are on fire or getting a real product rewrite. Year-end “all SwiftUI” is a slide; the train is the plan.

Hosting both ways:

* UIKit → SwiftUI: \`UIHostingController\` as a child, owned by the UIKit parent. The SwiftUI view takes a store, not a massive environment that reaches into UIKit singletons. Pop/deinit of the parent must deinit the hosting controller — Day 1, Memory Graph after pop (Day 8 problem 8).
* SwiftUI → UIKit: \`UIViewControllerRepresentable\` / \`UIViewRepresentable\` whose identity is a stable id (conversationId, captureFlowId), not \`id(UUID())\`. The coordinator holds the UIKit controller. \`makeUIViewController\` once per identity; \`update\` configures, it does not rebuild the session. \`dismantle\` stops the camera and cancels tasks.

Navigation: one router at the composition root. Deep links (problem 7) still parse to a \`DeepLink\` and land on UIKit or SwiftUI without caring. A SwiftUI \`NavigationStack\` that also needs to present UIKit checkout uses the router to present, not a random \`UIViewController.present\` from a representable. Mixed stacks are allowed; two sources of truth for the back stack are not.

Observation: SwiftUI screens talk to \`@MainActor\` stores. UIKit screens talk to the same stores where you already extracted them (checkout, feed). Do not wrap a 3 000-line VC in hosting and call it migrated. Strangle at the store boundary first (problem 5), then replace the view.

Identity bugs are the migration. Camera blinking on keystroke is a parent refresh recreating the representable — lift the controller, stabilize \`id\`. Feed video: UIKit cell or representable injected from the player pool (problem 8), never \`AVPlayer()\` in a SwiftUI property.

Measurement: after each hosted screen, Memory Graph (zero leftover VCs/sessions), Time Profiler on appear, FPS if it is the feed (Day 8 problem 12). A rewrite that drops to 40 FPS is a rollback. Tests: VM/store tests unchanged (Day 9); one hosting test that a sibling \`@State\` does not recreate the representable; XCUI journeys still login → pay. Do not snapshot 200 new SwiftUI screens in the PR (Day 9 problem 5).`,
      explanation: `Product does not want SwiftUI. Product wants features on a weekly train, and someone sold them a date. Two hundred screens rewritten is how you freeze the camera team and still ship the same 3 000-line checkout in a hosting controller. The hybrid is the product: SwiftUI where it is a projection of a store, UIKit where the system object has a lifetime that SwiftUI identity will fight — capture session, player, map, payment sheet.

The failure I have watched is \`id(UUID())\` on a representable, or putting changing text in the representable’s initializer, so every keystroke in a sibling field tears down the camera. That is Day 8’s session restart and Day 1’s leak if the delegate stayed strong. The fix is ownership: the flow owns the \`CaptureController\`, the view is a window onto it, identity is the flow id. The same sentence as the camera SDK design, now as a migration rule.

Navigation is where hybrids become haunted. Two back stacks, a SwiftUI pop that leaves a UIKit modal, a deep link that pushes the thread twice — problem 7’s idempotent handler is the adult. One router, one pending link, present checkout through that router whether the caller was SwiftUI or UIKit. Teams that “just present from the representable” will double-pay or drop 3DS on a parent refresh.

Staff is the refusal to standardise furniture while standardising roads (problem 3). The road is: stores at the boundary, hosting with stable identity, Memory Graph after pop, no UUID identities, UIKit for sessions. The furniture is TCA-or-not in a notes screen. Year-end 100% SwiftUI is how you get a political rewrite of Home while decode still sits on main. Measure the hosted feed on an iPhone 12 before you call it done. If the recording says 40 FPS, you hosted the wrong layer, or you hosted it before Day 8’s pipeline.`,
      internals: `\`\`\`text
Composition root / Router          DeepLink, flags, stores
  ├─ UIKit tabs (untouched)
  │     └─ UIHostingController     child, store-injected
  └─ SwiftUI tabs (new)
        └─ Representable           stable id → UIKit session (camera, map, player)
\`\`\`

\`makeUIViewController(context:)\` is init. \`updateUIViewController\` is configure. Rebuilding the session in update is the blink. Coordinator: weak to SwiftUI parent, strong to the VC it owns, stop in dismantle.

\`NavigationStack\` + UIKit present: the representable should not own presentation of checkout. The store posts a route; the root presents.

SwiftUI environment: pass the store, not \`URLSession.shared\`. Composition remains inverted (Day 4).`,
      testing: `Store tests do not care which toolkit paints. A hosting fixture: toggle a sibling TextField, assert \`makeUIViewController\` count stays 1. Memory Graph after pop of a hosted camera: zero \`AVCaptureSession\`. XCUI: login (UIKit) → new SwiftUI notes → UIKit pay, one journey. Day 9 problem 8: identifiers on both sides. Do not add 400 SwiftUI snapshots as the migration metric.`,
      pitfalls: `UUID identity on representables. Rebuilding AVCaptureSession in update. Wrapping a 3 000-line VC and calling it SwiftUI. Two navigation stacks as sources of truth. Presenting from the representable. EnvironmentObject of the entire app. \`unowned\` from a UIKit delegate to a SwiftUI coordinator. Measuring only on a 16 Pro. A year-end target that freezes the train.`,
      alternatives: `UIKit forever with SwiftUI only for settings — honest for a camera-heavy app. Full rewrite of one tab as a strangler — good. TCA everywhere as the migration — furniture, problem 3’s refusal. SwiftUI-only including camera: you will invent the SDK design inside the app and still need a representable.`,
      tradeoffs: `Hybrid: two toolkits forever, the only way the train survives. A hard cutover: one toolkit, a year of frozen product, identity bugs all at once. Hosting UIKit cells in a SwiftUI list: small step, big FPS win for video (Day 8 problem 12) without rewriting Home. Forcing SwiftUI on maps: prettier demos, worse lifetime.`,
      followups: [
        {
          q: 'The camera blinks when the user types in a caption field. Why?',
          a: 'The representable’s identity or inputs changed and remade the session. Own the controller higher, stable id, do not pass the caption into makeUIViewController.',
        },
        {
          q: 'Who pops when SwiftUI pushed UIKit checkout?',
          a: 'The router. Checkout finishing posts a route. SwiftUI should not guess the UIKit nav stack. Deep link consume-once still applies.',
        },
        {
          q: 'Do you migrate Home or Settings first?',
          a: 'Settings if you need a win; Home only with a pipeline and FPS budget. Migrating Home to SwiftUI without Day 8 is how the 40 FPS rewrite ticket (Day 8 problem 12) gets written.',
        },
        {
          q: 'How do you prove a hosted VC is not leaked?',
          a: 'Day 8 problem 8: pop, Memory Graph, zero instances. deinit of the UIKit VC and of the hosting controller. Allocations generations across ten push/pops.',
        },
        {
          q: 'Feature flags on a half-migrated tab?',
          a: 'Yes. Flag the new SwiftUI screen, keep the UIKit one in the binary, train still ships. Long-lived git fork is how Friday dies.',
        },
        {
          q: 'SwiftUI feed with UIKit video cells — is that cheating?',
          a: 'That is the hybrid. Player pool needs reuse. You did not fail the migration. You respected the session object.',
        },
      ],
      teaches: [
        'Strangler, not a year rewrite',
        'Stable representable identity',
        'One router for mixed stacks',
        'UIKit keeps session objects',
        'Memory Graph after hosting',
        'FPS before celebrating Home',
      ],
    },
    {
      id: 'd10-p12',
      title: 'Design observability for an EU consumer app',
      difficulty: 'Expert',
      kind: 'Design',
      prompt: `Design crash reporting, analytics, performance, and breadcrumbs for a consumer app in the EU store. Constraints: crash-free 99.7% goal, privacy manifests, tracking transparency, a legal team that will ask what you collect, MetricKit, sampling so you do not DDoS yourselves or the user’s radio, and the Day 8 incidents you still need to see (jetsam, watchdog, hang, 40 FPS, energy) on phones you cannot attach to.

You own the client. The backend can receive what you send. Sketch pipelines, what never goes in a log, how sampling works, how dSYMs and manifests ship on the train, and what you refuse to put in the first-second launch path.`,
      think: [
        'What is a crash versus a hang versus jetsam, and which vendor events actually show each?',
        'What is in the privacy manifest versus ATT versus your own analytics policy?',
        'Which signposts and breadcrumbs are product-useful, and which are PII?',
        'How do you sample 40 FPS and energy without becoming the battery bug?',
        'What must be deferred until after first frame (Day 8 problem 5)?',
      ],
      solution: `Three pipelines, one policy.

**Crashes / hangs.** A crash reporter with always-on fatals, dSYMs uploaded on every train build, MetricKit for watchdog, hangs, jetsam, disk, CPU. Breadcrumbs: screen, last non-PII action, memory warning, feature-flag set, not PAN, not message bodies, not email. Feature-flag the reporter’s verbose mode. 0.4% watchdog and 2% EXC_BAD_ACCESS still block the train (Day 8). Sampling does not apply to fatals.

**Performance.** os_signpost intervals: launch phases, Home appear, pay(), feed hitch budget. Coarse. MetricKit animation/hang/CPU/energy histograms. Custom durations exported sampled (say 1–5% of sessions, 100% of checkout) through the analytics pipe with a schema legal has seen. iPhone 12 cohort is a first-class slice, not an average with Pros.

**Analytics / product.** Event bus on a background actor, batched, capped (Day 8 problem 10 — not on main, not a fsync per like). Default: no IDFA until ATT says yes; many product events do not need it. Privacy manifest declares the APIs (disk, time, user defaults) and the reason. Tracking vs first-party measurement is a legal distinction you encode in two sinks, not a boolean the intern flips.

Never in logs: tokens, Keychain, message bodies, precise location unless that is the product and consented, PAN. Never a second analytics SDK in the widget (problem 9).

Launch: crash reporter can install early; it must not +load a database (Day 8 problem 5). Analytics SDKs defer until after first frame. Sampling config from a local default, remote after first pixel.

EU: purpose limitation in the schema. Deletion: a user request clears the analytics queue and the local breadcrumb file. Sampling reduces volume and is not a legal strategy by itself — if you should not collect it, do not collect it at 1%.`,
      explanation: `You cannot USB-debug Berlin. The EU app still jetsams, still watchdogs, still drops to 40 FPS on an iPhone 12, and still has a legal team that will read the privacy manifest aloud. Observability that ignores privacy will be ripped out; privacy that ignores observability will ship a 0.4% hang you cannot name. The design is a policy for what leaves the device, not a logo on a vendor slide.

Fatals are not sampled. A crash-free SLO is a count of deaths, including watchdog, including the jetsam MetricKit saw that Crashlytics called “quiet.” Breadcrumbs exist so the next EXC_BAD_ACCESS names a screen and a flag, which is Day 8 problem 4’s next build. They are also a PII pipe if you put the chat body in them. Screen plus action plus flag is enough. Message text is a subpoena.

Performance is sampled because signposting every frame is Day 8 problem 12’s hitch, and uploading every interval is Day 8 problem 9’s radio. Coarse intervals, a percent of sessions, 100% of pay() because money. MetricKit is the OS’s own histogram; it is how you learn energy and hangs without a vendor waking the radio. If you only look at Crashlytics, you will miss jetsam and think the feed is healthy.

Launch is where observability becomes the incident. Twelve SDKs in didFinishLaunching, a +load that opens a database, ATT prompt on first pixel — you made problem 5. Install the crash reporter, paint the shell, defer the rest. Manifests and dSYMs are train artifacts, same as the binary. A weekly release that forgets dSYMs is an unsymbolicated week. A weekly release that forgets the privacy manifest is an App Store conversation. Staff treats both as blockers, not wiki pages.

Refuse: a second SDK in the NSE, IDFA as a prerequisite for crash reports, analytics on main, sampling as a fig leaf for collecting message bodies, and “we will add observability after v1.” v1 is when you need the hang.`,
      internals: `\`\`\`text
App start
  ├─ Crash reporter install     (no +load I/O)
  ├─ First frame
  └─ Deferred: analytics SDK, remote sample rate, ATT if you truly track

MainActor UI  ──events──►  AnalyticsActor   batch, cap, disk off main
                 signposts (coarse) ──► MetricKit / sampled export
Fatal / hang / jetsam ──► Crash + MetricKit   100%
\`\`\`

Privacy manifest: \`NSPrivacyAccessedAPITypes\`, \`NSPrivacyCollectedDataTypes\`, tracking boolean. ATT only if you track across apps/web. Required reason APIs (UserDefaults, file timestamp, disk space) declared, not copied from a gist that lies.

dSYMs: CI upload, fail the train if upload fails. Bitcode is gone; still upload.

Sampling: session coin-flip at start, sticky for the session, override on for checkout and for a debug flag. Collapse energy/perf events. Respect Low Power Mode: drop sampled perf, keep fatals.`,
      testing: `Adapter tests: a fake sink records events; assert pay() success does not include PAN; assert logout does not leave a user id in the next session’s queue. Contract tests for the event schema (Day 9 problem 11). A unit test that the analytics actor does not save on main — spy the file writer. CI: dSYM upload dry-run, manifest plist present. Do not assert MetricKit in unit tests. After launch, dashboards for hang rate, jetsam, sampled hitch on iPhone 12, not a single global FPS average.`,
      pitfalls: `Analytics in +load. Breadcrumbs with message bodies. IDFA gated crash reports. Sampling fatals. A second SDK in the widget. UserDefaults as the event queue on main. Forgetting dSYMs. Copy-pasting required-reason APIs you do not use. ATT prompt on first launch before value. Uploading every os_signpost. Treating jetsam as “no crash, we are fine.”`,
      alternatives: `First-party only, no vendor — more EU control, you own symbolication and hang parsing. Vendor crash + first-party product analytics — common, two manifests. MetricKit-only perf — coarser, honest, less radio. Full session replay — usually a legal no in this product; if it happens it is consent and sampling and no keyboard.`,
      tradeoffs: `Always-on fatals: battery and disk versus a crash you can fix. Sampled perf: you will miss a rare hitch, you will not become the hitch. Deferring SDKs: faster first pixel, crashes in the first second may lack analytics context — crash reporter still early. Verbose breadcrumbs: better EXC_BAD_ACCESS, worse privacy review. Staff picks a schema legal can defend and an SLO engineering can see.`,
      followups: [
        {
          q: 'Do you sample watchdog kills?',
          a: 'No. Fatals and watchdog are 100%. Sample traces and signposts around the path, not the death certificate.',
        },
        {
          q: 'What goes in the privacy manifest for os_signpost?',
          a: 'Signposts themselves are not tracking. The APIs you call (disk, time) are. Declare those. Exporting durations to your backend is collected data with a purpose.',
        },
        {
          q: 'How do you see 40 FPS in Berlin?',
          a: 'MetricKit hitch/animation metrics sliced by device class, plus sampled coarse signposts on feed bind/decode. Not a USB session on a 16 Pro.',
        },
        {
          q: 'Can the NSE send analytics?',
          a: 'Prefer not. Budget and a second process. If it must, the same schema, no new SDK, no refresh-token fetch to “enrich” the event.',
        },
        {
          q: 'User deletion request?',
          a: 'Clear local queues and breadcrumb files, send a deletion to the backend, stop the session id. Do not keep a sampled copy “for perf.”',
        },
        {
          q: 'Where does this sit in the 40-person org?',
          a: 'Platform owns the pipes, the manifest, dSYMs, and the schema. Features emit typed events. Staff arbitrates PII in breadcrumbs. Same split as problem 3.',
        },
        {
          q: 'Launch: crash reporter versus ATT versus analytics?',
          a: 'Crash reporter early, first frame, then analytics, ATT only at a moment of value if you track. Never block first pixel on a prompt or a network init.',
        },
      ],
      teaches: [
        'Fatals unsampled, perf sampled',
        'MetricKit for hangs and jetsam',
        'Privacy manifests on the train',
        'Breadcrumbs without PII',
        'Defer SDKs past first frame',
        'iPhone 12 as a cohort',
        'Observability is a policy',
      ],
    },
  ],
}
