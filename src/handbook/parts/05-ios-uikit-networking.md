# PART II — iOS

# iOS Architecture and App Lifecycle

An iOS app is a process. Since iOS 13, that process can host more than one UI: iPad Split View, Stage Manager, multiple windows. The thing users see is a **scene**. The thing the OS can kill is the **process**. Mixing those two up is how AppDelegate becomes a junk drawer.

```text
UIApplication
    └── one or more UIScene / UIWindowScene
            └── UIWindow
                    └── root view controller (UIKit)
                    └── or SwiftUI App / WindowGroup
```

Before iOS 13 there was only AppDelegate. Then scenes arrived, and window lifetime moved to SceneDelegate. SwiftUI’s `@main App` plus `WindowGroup` is the current default, but AppDelegate did not disappear. Process-level events still live there: push registration, background `URLSession` events, shortcuts. Scene and session events belong on the scene. If you stuff window setup into AppDelegate in a multi-scene app, the second window will surprise you.

---

## Process, app, scenes

Think of it as two clocks. The process clock starts at `didFinishLaunching` and ends when the OS reclaims you. The scene clock starts when a window connects and moves through active, inactive, and background. A scene can go away while the process stays. The process can be killed while you still had a scene on screen a second ago. Save against both.

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

`@main` is the process entry point. `App` is the SwiftUI protocol for that entry. `WindowGroup` is a scene that can spawn windows. `scenePhase` is the coarse UI state: active, inactive, background.

When a third-party SDK or APNs still wants an AppDelegate, you do not throw away SwiftUI. You adapt:

```swift
@UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
```

Use that for push registration, background fetches, and SDKs that have not learned scenes yet. Keep the adaptor thin. The rest of the app should not rummage through AppDelegate to find a window.

---

## UIKit AppDelegate / SceneDelegate

```swift
func application(_ application: UIApplication,
                 didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    // process start: configure logging, DI graph, analytics
    return true
}
```

This is one-time process setup. Logging, dependency graph, analytics. It is not where you build the entire UI if you have scenes — windows belong to scenes.

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

That `willConnect` is “a window is about to exist.” Hybrid apps live here: UIKit window, SwiftUI root, still a scene.

---

## Scene phases vs UIKit states

| SwiftUI `scenePhase` | UIKit-ish meaning |
| --- | --- |
| `active` | Foreground, receiving events |
| `inactive` | Transitional (Control Center, incoming call) |
| `background` | Suspended soon; save state |

Background time is **limited**. Save quickly. Long work needs a real background task, not a hopeful `DispatchQueue` in `scenePhase == .background`.

If you do not save on background, the user can be killed and unsaved drafts vanish. Persist drafts to disk or SwiftData on background *and* on every meaningful edit (debounce), not only in `applicationWillTerminate`. Terminate often does **not** run. Relying on it is a story you tell yourself after the first lost note.

---

## Launch options and cold vs warm start

**Cold start:** the process was not running. **Warm:** it was in memory. iOS may also prewarm or launch while locked, which means your first line of `didFinishLaunching` might run before the user can see UI, and before keychain or biometrics are actually available. Do not assume Face ID is ready at process start.

Measure time to interactive. Defer non-critical SDK init. A senior answer here is not “we initialise everything in AppDelegate so it is ready.” It is “we initialise what the first frame needs, and we pay for analytics on the other side of first paint.”

---

# UIKit

SwiftUI interviews still ask UIKit because production apps are hybrid. You will wrap a map view. You will inherit a table view. You will debug a view controller that will not `deinit`. If you only know SwiftUI modifiers, that round will feel unfair. It is not.

## `UIView`

A rectangle on screen with a layer (`CALayer`), a draw cycle, a hierarchy (`addSubview`), and layout (constraints or frames). That is the UIKit rendering and event model. SwiftUI talks to it through `UIViewRepresentable`.

`frame` is origin plus size in **superview** coordinates. `bounds` is the same size in **local** coordinates — origin often `.zero` unless you have scrolled or transformed. Interviewers ask this because people mix them up when they implement a custom control or debug a scroll view.

Auto Layout describes relationships; the engine solves them; frames are the output. Setting `frame` every layout pass while also using constraints fights the engine. Pick one, or you will spend an afternoon on “why does this jump after rotation?”

---

## `UIViewController`

A view controller owns a view. It participates in presentation, layout, and appearance. The methods look like a timeline. They are a timeline of *different jobs*.

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

`viewDidLoad` can run when the view is loaded **off-screen** — container view controllers do that. Appearance methods pair with visibility. Navigation pop does not always `deinit` immediately if something retains the VC. A closure cycle is the usual reason you never see `deinit` in the debugger and you think “UIKit is leaking.” UIKit is not leaking. You are.

---

## `UIWindow`

The root of a scene’s view tree. `makeKeyAndVisible()`. Keyboard, tint, `rootViewController`. In a scene world there is one window per scene, not one window for the process. If you keep a global `AppDelegate.window` and a scene also owns a window, you will attach UI to the wrong one.

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

`translatesAutoresizingMaskIntoConstraints = false` is required for programmatically created views. Forget it and you get conflicting constraints with the autoresizing mask — the unsatisfiable-constraints log that everyone pastes into Slack.

`UIStackView` generates constraints for arranged subviews. Prefer stacks for linear UI. They are not free: nested stacks on a giant form can be expensive. Labels want to be their text size. Hugging versus compression resistance is the 2–4 year question that sounds like “why is my label truncated?” The short answer: something else in the line has higher compression resistance, or the label’s hugging lost to a spacer-like view. The long answer is the constraint inequality, which you should be able to walk through on a whiteboard.

---

## `UITableView` / `UICollectionView`

Cells are reused. That is the whole performance story.

```swift
func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
    let cell = tableView.dequeueReusableCell(withIdentifier: "Cell", for: indexPath)
    cell.textLabel?.text = items[indexPath.row]
    return cell
}
```

Reset state in `prepareForReuse`. Do not assume `cellForRow` is the only configuration point; `willDisplay` exists. If you skip reuse and allocate a view per row, scrolling allocates thousands of views. Jank and memory follow.

The data source answers **what** to show (count, cell). The delegate answers **events** (did select). The table view holds both `weak`. They should be the view controller, which is already kept alive by the hierarchy. Making the table view own a strong data source object that owns the table view is a cycle with extra types.

Legacy code calls `reloadData()` or `performBatchUpdates` and then crashes when the counts disagree. Modern code uses `UITableViewDiffableDataSource` / `NSDiffableDataSourceSnapshot`. You apply a **snapshot** of identifiers. Animations come from the diff. Identity-based updates crash less because you are no longer mentally simulating inserts.

`UICollectionViewCompositionalLayout` is sections, groups, items, orthogonal scrolling. It replaced a generation of flow-layout hacks for complex grids. You do not need to write a compositional layout from memory. You need to know it exists and when flow layout has run out of road.

---

## Target-action vs delegate vs closure vs Combine

| Pattern | Example | Notes |
| --- | --- | --- |
| Target-action | `button.addTarget(self, action: #selector(tap), for: .touchUpInside)` | UIKit controls |
| Delegate | `tableView.delegate = self` | Many optional methods, weak |
| Closure | `onTap: () -> Void` | Simple, watch retain |
| Combine | `publisher.sink` | Streams |

Pick by shape. A button has one action: target-action or a closure. A table view has a dozen optional hooks: a delegate. A stream of values: Combine or async sequences. Closures are easy and they capture strongly by default, so the memory chapter still applies.

---

## Gesture recognizers

`UITapGestureRecognizer`, failure requirements (`require(toFail:)`). They participate in the responder chain. SwiftUI gestures are a different system (`simultaneousGesture`). When you wrap UIKit in SwiftUI, you can end up with both systems fighting for the same touch. Test on a device. The simulator will lie to you about how a swipe feels.

---

## Navigation: `UINavigationController`, tabs, modals

```swift
navigationController?.pushViewController(detail, animated: true)
present(alert, animated: true)
```

Push is hierarchical. Present is modal (`pageSheet`, `fullScreen`, and friends). `isModalInPresentation` blocks swipe-to-dismiss when losing the screen would lose work.

Child view controllers are the interview trap people fail after they have shipped UIKit for a year:

```swift
addChild(child)
view.addSubview(child.view)
child.didMove(toParent: self)
```

If you only `addSubview` and skip containment, appearance methods and `parent` are wrong. The child will not get `viewWillAppear` the way you think. Layout will be almost right until it is not.

---

## Custom views

Subclass `UIView`, override `init(frame:)` and `init?(coder:)`, layout in `layoutSubviews` or with constraints. When mixing with SwiftUI, wrap in `UIViewRepresentable` rather than pretending the UIView is a SwiftUI view. Two layout systems in one class is how you get a map that is the wrong size after rotation.

---

## UIKit in SwiftUI

```swift
struct MapWrap: UIViewRepresentable {
    func makeUIView(context: Context) -> MKMapView { MKMapView() }
    func updateUIView(_ uiView: MKMapView, context: Context) { }
}
```

`makeCoordinator` holds the delegate. `updateUIView` must be idempotent — it runs often, whenever SwiftUI thinks something changed. Recreating the `MKMapView` every update is how you get a map that flickers and loses region.

On current OS versions, UIKit can track `@Observable` in update methods similarly to SwiftUI. Hybrid observation is first-class now. You still own the UIView’s lifetime. SwiftUI will not guess that for you.

---

## Common UIKit mistakes

Configuring a cell and never resetting it in `prepareForReuse` is how images bleed into the next row. Forgetting `translatesAutoresizingMaskIntoConstraints = false` is how Auto Layout logs appear. Starting a `URLSession` in `viewDidLoad` and never cancelling is how work outlives the screen. `addSubview` without `addChild` is how a contained controller lies about visibility.

The one-minute version: UIKit is a class-based, stateful toolkit. View controllers have a load / appear / layout / disappear lifecycle. Configure once in `viewDidLoad`, refresh in appear, stop work in disappear. Table views reuse cells by identity. You still need this because SwiftUI wraps UIKit, and interviews expect you to know which method is which when the leak is a view controller.

## One-minute explanation

UIKit is objects with identity. A view controller loads a view once, appears many times, and may stay in a navigation stack long after it disappeared. I put one-time setup in `viewDidLoad`, visibility-tied work in appear/disappear, and geometry work in layout. Cells are reused, so I reset them. When I wrap UIKit in SwiftUI, I create the view once and update it idempotently.

---

# Networking

You tap a row. A user profile should appear. Between that tap and the screen, there is HTTP, decoding, errors, auth, cancellation, and a surprising number of ways to show the wrong thing with a 200 that never happened.

---

## HTTP in one page

| Verb | Idempotent? | Typical use |
| --- | --- | --- |
| GET | Yes | Read |
| POST | No | Create / RPC |
| PUT | Yes (replace) | Replace resource |
| PATCH | Usually | Partial update |
| DELETE | Yes | Delete |

Idempotent means repeating the request has the same effect. Interviewers ask this because of retries. Retry GET and PUT carefully. Retry POST only with idempotency keys, or you will create two orders.

Status codes: 2xx success, 3xx redirect (URLSession follows many), 4xx client, 5xx server. `401` is unauthenticated — we do not know who you are. `403` is forbidden — we know who you are and you may not. Treating them as the same error is how refresh-token logic logs people out for a permissions problem.

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

`URL` is the address. `URLRequest` is method, headers, body, cache policy, timeout. `URLSession` is the client, configured as default, ephemeral, or background. `data(for:)` gives you bytes plus a `URLResponse`. `JSONDecoder` turns `Data` into `Decodable`. Bytes arriving is not success. Check the status code.

`URLSession.shared` is fine for simple apps. A custom `URLSessionConfiguration` is how you set timeouts, `waitsForConnectivity`, a `urlCache`, default headers (be careful putting auth there — prefer per-request), and a background session for uploads and downloads that should outlive the app.

Never string-concatenate query values. Encoding will betray you.

```swift
var comps = URLComponents(url: url, resolvingAgainstBaseURL: false)!
comps.queryItems = [URLQueryItem(name: "page", value: "2")]
```

POST means a method, a body, and a content type that matches what you encoded:

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

`Encodable` and `Decodable` split when you only need one direction. `JSONDecoder.keyDecodingStrategy = .convertFromSnakeCase` is convenient until one key is mixed. Prefer explicit `CodingKeys` on a public API. Dates: set `dateDecodingStrategy`. Never assume milliseconds versus seconds. That bug looks like “all my dates are 1970” or “all my dates are in the year 57 million.”

If a field is missing, a non-optional decode **throws**. An optional becomes `nil`. If the API can omit `id`, your model is lying. Make it optional or give it a default you actually believe.

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

Inject a `URLProtocol` mock or a protocol wrapping `data(for:)`. If the view owns `URLSession.shared` directly, you cannot test it without hitting the network, and you cannot swap sessions for a background configuration later.

Auth is a header, not a query string:

```text
Authorization: Bearer <access_token>
```

Refresh tokens: **one refresh at a time**. Put that on an actor. Queue other 401s until refresh completes. Failed refresh → logout. Two parallel refreshes is how you invalidate the new token with the old one and lock the user out of their own app.

Retry with exponential backoff and jitter. Only on idempotent methods and transient errors (timeout, 503). Honour `Retry-After`. Cap attempts. Infinite retry is a battery bug.

Pagination: a cursor (`next`) is preferable to page numbers when lists mutate. Store the cursor. Append unique IDs with a `Set`, because APIs duplicate. Page 2 containing an item from page 1 is not theoretical.

`URLCache` is for GET with cache headers. Keep a **memory image cache** (`NSCache`) separate from **disk**. Do not cache authenticated personalised GET blindly — you will show Alice Bob’s inbox after a shared URL cache on a test device.

`NWPathMonitor` is not a substitute for trying the request. The path can be wrong. Use it for UI (“you’re offline”) and for queued writes, then still make the call.

Pass `Task` cancellation into `URLSession`. SwiftUI `.task` does this if you `await` session APIs. That is the whole “cancel when leaving the screen” story from the concurrency chapter, applied here.

---

## Basic vs production — interview contrast

A junior writes `URLSession.shared.data(from:)` in the view. A mid-level has a service type, typed errors, main-actor UI updates, and cancellation. A senior has session configuration, an auth actor, request IDs in logs, a pinning policy they can defend, staging versus prod, retry and idempotency, pagination plus dedupe, and an offline queue. The APIs are the same. The boundaries are not.

---

## Common networking mistakes

Data arriving is not HTTP success. Check `HTTPURLResponse`. `try! JSONDecoder` turns a backend typo into a crash; throw, and let the UI show retryable versus fatal. Tokens go in the Authorization header, not the query string, and they do not go in logs. Decoding 5 MB of JSON on the main actor is a freeze; decode off main, hop back.

## One-minute explanation

Networking is HTTP plus decoding plus errors plus cancellation. `URLSession` is the system client. I never assume 200 just because bytes arrived. I inject the session for tests, keep tokens out of logs and URLs, serialise refresh on an actor, and cancel when the user leaves.

---

# Persistence

The user typed a paragraph, backgrounded the app, and iOS killed you. Whether that paragraph still exists is a persistence problem, not a SwiftUI problem.

---

## UserDefaults / AppStorage

Small, non-sensitive preferences. A plist. Not a database. Not for tokens.

```swift
UserDefaults.standard.set(true, forKey: "hasOnboarded")

@AppStorage("hasOnboarded") var hasOnboarded = false
```

`AppStorage` is UserDefaults plus SwiftUI invalidation. A few kilobytes of settings is the job. Large blobs slow launches because UserDefaults is loaded as a whole. If you stuffed a JSON dump in there, that is why `didFinishLaunching` feels heavy.

## Keychain

Encrypted store for secrets: tokens, passwords. It can survive reinstall in some conditions (access group / iCloud keychain), which is a feature and a support ticket. Start from `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` and tighten for banking.

UserDefaults is preferences. Keychain is secrets. Interviewers fail candidates who store a JWT in UserDefaults. That is not a style preference. That is the difference between a setting and a credential.

## FileManager

Documents, Caches, tmp. Caches can be purged. Documents backup to iCloud unless you set skip-backup. Put large regenerable files in Caches. Putting downloaded images in Documents is how you blow the user’s iCloud quota with data they can fetch again.

## SQLite

The relational engine under Core Data, GRDB, SQLCipher. Know transactions, indexes, WAL. You rarely write raw SQL in interviews unless they ask. You should be able to say why an index exists: you filter or sort on that column a lot, and a full scan got slow.

## Core Data

An object graph, usually on SQLite. `NSManagedObjectContext`. Main context for UI, background contexts for import. `NSPersistentContainer`. Merging, faults, `perform` / `performAndWait`. Never pass an `NSManagedObject` across queues. Pass `NSManagedObjectID`. That sentence is the Core Data concurrency interview.

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

Core Data plus `NSFetchedResultsController` / `@FetchRequest` is the legacy path. SwiftData `@Model` plus `@Query` is the Swift-native one: less boilerplate, SwiftUI integration. It is not a full Core Data replacement for every enterprise graph. Know migrations, CloudKit, and when the existing Core Data stack is the thing you keep.

## Memory cache vs disk cache

| | Memory (`NSCache`) | Disk |
| --- | --- | --- |
| Speed | Fast | Slower |
| Size | RAM, evicted under pressure | Large |
| Persistence | Process lifetime | Across launches |
| Use | Decoded images, computed layouts | Originals, API responses |

`NSCache` evicts under memory pressure. `Dictionary` does not. If your image cache is a `[URL: UIImage]`, you will jetsam. If it is `NSCache`, you might not.

## Persistence architecture

```text
UI
 └─ Repository protocol
      ├─ Remote (API)
      └─ Local (SwiftData / files)
```

The repository decides network-first versus cache-first versus offline queue. The view should not. Once two screens need the same policy, the policy belongs in one place.

---

# Security

HTTPS and TLS are the default. App Transport Security blocks cleartext. Do not disable ATS globally “to make QA work.” If a staging host needs an exception, make it per-domain and document it.

Certificate pinning is extra trust on the leaf or SPKI. It breaks when certs rotate, so you need a pin set and a kill switch. Banking often requires it. A notes app often does not. Saying “we pin everything” without a rotation story is how you brick the app from the App Store.

Authentication is who you are. Authorization is what you may do. JWT is a token format, not a complete security architecture. OAuth: the user authenticates with a provider; the app gets tokens. Use `ASWebAuthenticationSession`. Do not embed passwords in the app for Google or Apple login.

Biometrics via `LocalAuthentication` should unlock a **keychain item**. “If Face ID succeeds, show the balance from RAM” is not protection. The secret should be in Keychain. Face ID is the gate to that item.

Never log tokens, PAN, passwords. Redact. Jailbreak detection is best-effort and bypassable. Defence in depth for high-threat apps; do not pretend it is perfect. API keys in the binary are extractable. Use tokens from your backend. A “hidden” key is a delay, not a secret.

Hide sensitive snapshots when `scenePhase` goes background (`privacySensitive`, a snapshot overlay). `isSecureTextEntry` for secrets on screen. The app switcher screenshot is a real attacker surface, not a polish item.

---

# Notifications and Background Work

Local notifications are `UNUserNotificationCenter` — calendar, interval, location. Remote notifications are APNs — a server pushes a payload. Authorization is required. A tap should deep-link, not just open the app on the home tab and shrug.

Background modes: audio, location, VoIP (PushKit), background fetch (fading in favour of `BGAppRefreshTask`), processing tasks (`BGProcessingTask`), background `URLSession`. If you do work in the `background` scene phase without a registered task, you get seconds, then freeze. Use `BGTaskScheduler`. Hope is not a background mode.

Silent pushes (`content-available: 1`) are not guaranteed. Do not rely on them for correctness. Use them as a hint to sync. If the data must be there, the user opening the app — or a real background task — has to fetch it.
