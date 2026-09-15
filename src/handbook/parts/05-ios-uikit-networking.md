# PART II — iOS

# iOS Architecture and App Lifecycle

```text
Experience: 0–2
Advanced: 2–4 / 4+
Category: iOS
Difficulty: Beginner
Importance: Critical
```

## Process, app, scenes

An iOS **app** is a process. Since iOS 13, **scenes** allow multiple UI instances (iPad multitasking, multiple windows).

```text
UIApplication
    └── one or more UIScene / UIWindowScene
            └── UIWindow
                    └── root view controller (UIKit)
                    └── or SwiftUI App / WindowGroup
```

### Legacy → modern

```text
AppDelegate-only (pre-iOS 13)
        ↓
AppDelegate + SceneDelegate (iOS 13+)
        ↓
SwiftUI @main App + WindowGroup (modern)
        ↓
Why: multiple windows, clearer separation of process vs UI lifecycle
        ↓
Candidate must know: AppDelegate still exists for process-level events
(push registration, background URLSession, shortcuts). Scene/session
events belong on the scene, not stuffed into AppDelegate.
```

---

## SwiftUI `App` lifecycle

```swift
@main
struct LearnApp: App {
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
        }
        .onChange(of: scenePhase) { _, phase in
            switch phase {
            case .active: break
            case .inactive: break
            case .background: save()
            @unknown default: break
            }
        }
    }
}
```

### Syntax breakdown

```text
@main              → process entry point
App                → SwiftUI app protocol
WindowGroup        → a scene that can spawn windows
scenePhase         → active / inactive / background
```

### `UIApplicationDelegateAdaptor`

```swift
@UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
```

Use when you must implement APNs, background fetches, or third-party SDKs that still require an AppDelegate.

---

## UIKit AppDelegate / SceneDelegate

```swift
func application(_ application: UIApplication,
                 didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    // process start: configure logging, DI graph, analytics
    return true
}
```

**Do:** one-time process setup.  
**Do not:** build the entire UI if you have scenes — windows belong to scenes.

```swift
func scene(_ scene: UIScene,
           willConnectTo session: UISceneSession,
           options connectionOptions: UIScene.ConnectionOptions) {
    guard let windowScene = scene as? UIWindowScene else { return }
    let window = UIWindow(windowScene: windowScene)
    window.rootViewController = UIHostingController(rootView: RootView())
    window.makeKeyAndVisible()
    self.window = window
}
```

---

## Scene phases vs UIKit states

| SwiftUI `scenePhase` | UIKit-ish meaning |
| --- | --- |
| `active` | Foreground, receiving events |
| `inactive` | Transitional (Control Center, incoming call) |
| `background` | Suspended soon; save state |

Background time is **limited**. Save quickly. Long work needs background tasks (see later).

### What happens if we don't save on background

User may be killed. Unsaved drafts vanish. Interview answer: persist drafts to disk/SwiftData on background and on every meaningful edit (debounce), not only `applicationWillTerminate` (which **often does not run**).

---

## Launch options and cold vs warm start

- **Cold start:** process was not running
- **Warm:** process in memory
- **Prewarming / locked launches:** iOS may execute code before the user sees UI — do not assume keychain/biometric is available at first line of `didFinishLaunching`

4+ topic: measure TTI (time to interactive). Defer non-critical SDK init.

---

# UIKit

```text
Experience: 0–2 (views, VC lifecycle, table view basics)
Experience: 2–4 (Auto Layout, diffable, cells, containment)
Experience: 4+ (rendering, responder, performance, hybrid SwiftUI)
Category: UIKit
Difficulty: Intermediate
Importance: High
```

SwiftUI interviews still ask UIKit because production apps are hybrid.

## `UIView`

A rectangle on screen with a layer (`CALayer`), a draw cycle, a hierarchy (`addSubview`), and layout (`constraints` or frames).

**Why it exists:** the UIKit rendering and event model.  
**SwiftUI relationship:** `UIViewRepresentable` wraps a `UIView`.

### Frame vs bounds

- `frame`: in **superview** coordinates (origin + size)
- `bounds`: in **local** coordinates (origin often `.zero` unless scrolled/transformed)

Interview classic.

### Auto Layout vs frames

Constraints describe relationships. The engine solves them. Frames are the output.

**When not to mix** blindly: setting `frame` every layout pass while also using constraints fights the engine.

---

## `UIViewController`

Owns a view, participates in presentation, layout, and appearance.

### Lifecycle

```text
init
loadView            → create the view hierarchy if not from storyboard
viewDidLoad         → view exists; one-time setup
viewWillAppear      → about to show (every appearance)
viewDidAppear       → visible
viewWillLayoutSubviews
viewDidLayoutSubviews
viewWillDisappear
viewDidDisappear
deinit
```

| Method | Use | Do not |
| --- | --- | --- |
| `loadView` | Custom view root if no nib | Call `super` incorrectly when replacing; do not access `view` before super patterns |
| `viewDidLoad` | One-time: add subviews, bind VM, style | Assume `frame` is final; do not start work that must stop on disappear without pairing |
| `viewWillAppear` | Refresh data, start cheap subscriptions | Heavy layout that belongs in layout methods |
| `viewDidAppear` | Analytics “screen viewed”, start animations, start location if needed | Blocking alerts immediately without care |
| `viewWillDisappear` | Pause, resign first responder | Assume you will `deinit` (still in nav stack) |
| `viewDidDisappear` | Stop timers, cameras | Destroy state the user expects on back-and-forth unless you intend to |
| `viewDidLayoutSubviews` | Geometry-dependent work (gradient frames) | Triggering layout loops (`setNeedsLayout` carelessly) |

**Trap:** `viewDidLoad` can run when the view is loaded **off-screen** (container VCs). Appearance methods pair with visibility.

**Trap:** Navigation pop does not always `deinit` immediately if something retains the VC (closure cycle).

---

## `UIWindow`

The root of a scene’s view tree. `makeKeyAndVisible()`. Keyboard, tint, `rootViewController`.

---

## Auto Layout

```swift
view.translatesAutoresizingMaskIntoConstraints = false
NSLayoutConstraint.activate([
    box.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
    box.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
    box.centerYAnchor.constraint(equalTo: view.centerYAnchor),
])
```

`translatesAutoresizingMaskIntoConstraints = false` is required for programmatically created views. **If you forget it,** you get conflicting constraints with the autoresizing mask.

### Stack views

`UIStackView` generates constraints for arranged subviews. Prefer stacks for linear UI; they are not free (nested stacks can be expensive).

### Intrinsic content size and hugging/compression

Labels want to be their text size. Hugging vs compression resistance is a 2–4 interview topic (“why is my label truncated?”).

---

## `UITableView` / `UICollectionView`

### Reuse

```swift
func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
    let cell = tableView.dequeueReusableCell(withIdentifier: "Cell", for: indexPath)
    cell.textLabel?.text = items[indexPath.row]
    return cell
}
```

Cells are **reused**. Reset state in `prepareForReuse`. Do not assume `cellForRow` is the only configuration point; `willDisplay` exists.

**What happens if we don't reuse:** scrolling allocates thousands of views → jank and memory.

### Delegates and data sources

- Data source: **what** to show (count, cell)
- Delegate: **events** (did select)

Table view holds them `weak` (data source/delegate should be the VC, which is kept by the hierarchy).

### Diffable data source

```text
Legacy: reloadData() / performBatchUpdates
        ↓
Modern: UITableViewDiffableDataSource / NSDiffableDataSourceSnapshot
        ↓
Why: identity-based updates, fewer crashes from inconsistent counts
```

You apply a **snapshot** of identifiers. Animations come from the diff.

### Compositional layout

`UICollectionViewCompositionalLayout` — sections, groups, items, orthogonal scrolling. Know it exists and that it replaced flow-layout hacks for complex grids.

---

## Target-action vs delegate vs closure vs Combine

| Pattern | Example | Notes |
| --- | --- | --- |
| Target-action | `button.addTarget(self, action: #selector(tap), for: .touchUpInside)` | UIKit controls |
| Delegate | `tableView.delegate = self` | Many optional methods, weak |
| Closure | `onTap: () -> Void` | Simple, watch retain |
| Combine | `publisher.sink` | Streams |

---

## Gesture recognizers

`UITapGestureRecognizer`, failure requirements (`require(toFail:)`). They participate in the responder chain. SwiftUI gestures are a different system (`simultaneousGesture`).

---

## Navigation: `UINavigationController`, tabs, modals

```swift
navigationController?.pushViewController(detail, animated: true)
present(alert, animated: true)
```

Modal presentation styles (`pageSheet`, `fullScreen`). `isModalInPresentation` to block swipe-to-dismiss.

### Child view controllers

```swift
addChild(child)
view.addSubview(child.view)
child.didMove(toParent: self)
```

If you only `addSubview` and skip containment, appearance methods and `parent` are wrong. **Interview trap.**

---

## Custom views

Subclass `UIView`, override `init(frame:)`, `init?(coder:)`, layout in `layoutSubviews` or constraints. Prefer wrapping in SwiftUI via `UIViewRepresentable` when mixing.

---

## UIKit in SwiftUI

```swift
struct MapWrap: UIViewRepresentable {
    func makeUIView(context: Context) -> MKMapView { MKMapView() }
    func updateUIView(_ uiView: MKMapView, context: Context) { }
}
```

`makeCoordinator` for delegates. `updateUIView` must be idempotent — it runs often.

iOS 26: UIKit can track `@Observable` in update methods similarly to SwiftUI. Know that hybrid observation is now first-class on new OS versions.

---

## Common UIKit mistakes

```text
❌ Configuring cells without prepareForReuse
✅ Reset images, highlighted state, tasks

❌ Not setting translatesAutoresizingMaskIntoConstraints = false
✅ Always for programmatic Auto Layout views

❌ Starting URLSession in viewDidLoad and never cancelling
✅ Cancel in disappear / deinit / Task

❌ addSubview without addChild for a VC
✅ Proper containment
```

## One-minute explanation

“UIKit is a class-based, stateful UI toolkit. View controllers have a load/appear/layout/disappear lifecycle. I configure once in `viewDidLoad`, refresh in appear, and stop work in disappear. Table views reuse cells by identity. I still need this because SwiftUI wraps UIKit and interviews expect the lifecycle.”

---

# Networking

```text
Experience: 0–2 (URLSession, Codable, GET JSON)
Experience: 2–4 (errors, auth, cancellation, pagination)
Experience: 4+ (architecture, caching, HTTP semantics, certificate pinning)
Category: Networking
Difficulty: Intermediate
Importance: Critical
```

## HTTP in one page

| Verb | Idempotent? | Typical use |
| --- | --- | --- |
| GET | Yes | Read |
| POST | No | Create / RPC |
| PUT | Yes (replace) | Replace resource |
| PATCH | Usually | Partial update |
| DELETE | Yes | Delete |

Idempotent means repeating the request has the same effect. Interviewers ask this for retry design. **Retry GET and PUT carefully; retry POST only with idempotency keys.**

Status codes: 2xx success, 3xx redirect (URLSession follows many), 4xx client, 5xx server. `401` vs `403`: unauthenticated vs forbidden.

---

## `URL`, `URLRequest`, `URLSession`

```swift
let url = URL(string: "https://api.example.com/v1/users")!
var request = URLRequest(url: url)
request.httpMethod = "GET"
request.setValue("application/json", forHTTPHeaderField: "Accept")
request.timeoutInterval = 30

let (data, response) = try await URLSession.shared.data(for: request)
guard let http = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
guard (200...299).contains(http.statusCode) else { throw NetworkError.badStatus(http.statusCode) }
let users = try JSONDecoder().decode([User].self, from: data)
```

### Syntax / pieces

```text
URL                → address
URLRequest         → method, headers, body, cache policy, timeout
URLSession         → session configuration (ephemeral, default, background)
data(for:)         → async bytes + URLResponse
JSONDecoder        → Data → Decodable
```

### Why not always `URLSession.shared`

Shared is fine for simple apps. Custom `URLSessionConfiguration`:

- `timeouts`
- `waitsForConnectivity`
- `httpAdditionalHeaders` (careful with auth — prefer per-request)
- `urlCache`
- `waitsForConnectivity`
- background session for uploads/downloads that outlive the app

### Query parameters

```swift
var comps = URLComponents(url: url, resolvingAgainstBaseURL: false)!
comps.queryItems = [URLQueryItem(name: "page", value: "2")]
```

Never string-concatenate query values (encoding bugs).

### POST body

```swift
request.httpMethod = "POST"
request.httpBody = try JSONEncoder().encode(payload)
request.setValue("application/json", forHTTPHeaderField: "Content-Type")
```

---

## Codable

```swift
struct User: Codable, Equatable, Identifiable, Sendable {
    let id: String
    let name: String
}
```

`Encodable` / `Decodable` split when you only need one direction.

`JSONDecoder.keyDecodingStrategy = .convertFromSnakeCase` vs explicit `CodingKeys`. Prefer explicit keys for public APIs — snake_case strategy fails on mixed keys.

Dates: set `dateDecodingStrategy`. Never assume milliseconds vs seconds.

### What happens if a field is missing

Non-optional decode **throws**. Optional becomes `nil`. If the API can omit `id`, your model is wrong.

---

## Production-grade networking sketch

```text
View / ViewModel
      │
      ▼
   UseCase / Service protocol
      │
      ▼
   APIClient (URLSession wrapping)
      │  - inject session, decoder, clock, token provider
      │  - map HTTP to domain errors
      ▼
   Authenticator (bearer, refresh, actor-serialised refresh)
```

```swift
protocol APIClient: Sendable {
    func send<T: Decodable>(_ request: Request) async throws -> T
}

struct Request {
    var path: String
    var method: String
    var query: [String: String]
    var body: Data?
}
```

**Testability:** inject a `URLProtocol` mock or a protocol wrapping `data(for:)`.

### Auth

```text
Authorization: Bearer <access_token>
```

Refresh tokens: **one refresh at a time** (actor). Queue other 401s until refresh completes. Failed refresh → logout.

### Retry

Exponential backoff + jitter. Only on idempotent methods and transient errors (timeout, 503). Honour `Retry-After`. Cap attempts.

### Pagination

Cursor (`next`) is preferable to page numbers when lists mutate. Store cursor; append unique IDs (`Set`) because APIs duplicate.

### Caching

`URLCache` for GET with cache headers. Separate **memory image cache** (NSCache) from **disk**. Do not cache authenticated personalised GET blindly.

### Reachability

`NWPathMonitor` is **not** a substitute for trying the request. The path can be wrong. Use it for UI (“you’re offline”) and queued writes.

### Cancellation

Pass the `Task` cancellation into `URLSession`. SwiftUI `.task` does this if you `await` session APIs.

---

## Basic vs production — interview contrast

**Junior:** writes `URLSession.shared.data(from:)` in the view.  
**Mid:** service type, errors, main-actor UI updates, cancel.  
**Senior:** session config, auth actor, observability (request IDs), certificate pinning policy, staging vs prod, retry/idempotency, pagination + dedupe, offline queue.

---

## Common networking mistakes

```text
❌ Ignoring HTTP status if Data arrived
✅ Check HTTPURLResponse

❌ try! JSONDecoder
✅ throw to UI as user-facing / retryable

❌ Token in query string
✅ Authorization header; don’t log it

❌ Decoding on MainActor for 5 MB JSON
✅ decode off main, hop back
```

## One-minute explanation

“I treat networking as HTTP + decoding + errors + cancellation. `URLSession` is the system client. I never assume 200. I inject the session for tests, keep tokens out of logs, serialise refresh, and cancel when the user leaves.”

---

# Persistence

```text
Experience: 0–2 (UserDefaults, files)
Experience: 2–4 (Keychain, Core Data or SwiftData, cache)
Experience: 4+ (migrations, concurrency, encryption, offline)
Category: Persistence
Difficulty: Intermediate
Importance: High
```

## UserDefaults / AppStorage

Small, non-sensitive preferences. Plist. Not a database. Not for tokens.

```swift
UserDefaults.standard.set(true, forKey: "hasOnboarded")

@AppStorage("hasOnboarded") var hasOnboarded = false
```

`AppStorage` is UserDefaults + SwiftUI invalidation.

**Limit:** a few kilobytes of settings. Large blobs slow launches (UserDefaults is loaded as a whole).

## Keychain

Encrypted store for secrets (tokens, passwords). Survives reinstall in some conditions (access group / iCloud keychain). Use `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` as a starting policy; tighten for banking.

**UserDefaults vs Keychain:** preferences vs secrets. Interviewers fail candidates who store JWT in UserDefaults.

## FileManager

Documents, Caches, tmp. Caches can be purged. Documents backup to iCloud unless you set skip-backup. Put large regenerable files in Caches.

## SQLite

Relational engine under Core Data / GRDB / SQLCipher. Know transactions, indexes, WAL. Rarely write raw SQL in interviews unless asked; know why indexes exist.

## Core Data

Object graph + SQLite (usually). `NSManagedObjectContext`. Main context for UI, background contexts for import. `NSPersistentContainer`. Merging, faults, `perform`/`performAndWait`.

**Concurrency:** never pass `NSManagedObject` across queues. Pass `NSManagedObjectID`.

## SwiftData

```swift
@Model
final class Note {
    var title: String
    var createdAt: Date
    init(title: String) {
        self.title = title
        self.createdAt = .now
    }
}

@Query var notes: [Note]
```

```text
Legacy: Core Data + NSFetchedResultsController / @FetchRequest
        ↓
Modern: SwiftData @Model + @Query
        ↓
Why: Swift-native models, SwiftUI integration, less boilerplate
        ↓
Candidate: SwiftData is not a full Core Data replacement for every
enterprise graph; know migrations, CloudKit, and when to stay on Core Data.
```

## Memory cache vs disk cache

| | Memory (`NSCache`) | Disk |
| --- | --- | --- |
| Speed | Fast | Slower |
| Size | RAM, evicted under pressure | Large |
| Persistence | Process lifetime | Across launches |
| Use | Decoded images, computed layouts | Originals, API responses |

`NSCache` evicts under memory pressure; `Dictionary` does not.

## Persistence architecture

```text
UI
 └─ Repository protocol
      ├─ Remote (API)
      └─ Local (SwiftData / files)
```

Repository decides network-first vs cache-first vs offline queue.

---

# Security

```text
Experience: 2–4
Advanced: 4+
Category: Security
Difficulty: Intermediate
Importance: High
```

- **HTTPS / TLS:** default. ATS (`NSAppTransportSecurity`) blocks cleartext. Do not disable ATS globally “to make QA work.”
- **Certificate pinning:** extra trust on the leaf or SPKI. Breaks when certs rotate — have a pin set and a kill switch. Banking often requires it; a notes app often does not.
- **Auth vs AuthZ:** authentication is who you are; authorization is what you may do. JWT is a token format, not a complete security architecture.
- **OAuth:** user authenticates with a provider; app gets tokens. Use ASWebAuthenticationSession. Do not embed passwords in the app for Google/Apple login.
- **Biometrics:** `LocalAuthentication` — it unlocks a **keychain item** (best practice), not “if Face ID then show the balance from RAM.”
- **Logging:** never log tokens, PAN, passwords. Redact.
- **Jailbreak:** detection is best-effort, bypassable. Defence in depth for high-threat apps; do not pretend it is perfect.
- **Secrets in the binary:** API keys in the app are extractable. Use tokens from your backend. Any “hidden” key is a delay, not a secret.
- **ATS exceptions:** per-domain, documented.
- **Screen hiding:** `isSecureTextEntry`, hide sensitive snapshots in `scenePhase` background (`privacySensitive` / snapshot overlay).

---

# Notifications and Background Work

## Local vs remote

- Local: `UNUserNotificationCenter` — calendar, interval, location
- Remote: APNs — server pushes a payload

Authorization is required. Handle tap → deep link.

## Background modes

Audio, location, VoIP (PushKit), background fetch (deprecated-ish in favor of BGAppRefreshTask), processing tasks (`BGProcessingTask`), background URLSession.

**What happens if we do work in `background` scene phase without a task:** you get seconds, then freeze. Use `BGTaskScheduler`.

## Silent pushes

`content-available: 1` — not guaranteed. Do not rely on them for correctness; use them as a hint to sync.

---
