# PART IV — Architecture

```text
Experience: 0–2 (MVC vs MVVM names)
Experience: 2–4 (apply MVVM/Clean, DI, coordinators)
Experience: 4+ (modularisation, TCA trade-offs, evolution)
Category: Architecture
Difficulty: Intermediate
Importance: Critical
```

Architecture is how you **place responsibilities** so change is cheap, tests are possible, and features do not tangle. It is not a religion. Interviewers want **trade-offs**, not a brand name.

For every pattern: structure, responsibilities, advantages, disadvantages, when to use, when not, interview questions.

---

## MVC (Model–View–Controller)

**Structure (UIKit):**

```text
Model  ←  Controller  →  View (UIView)
              │
              └── also networking, formatting, navigation  (the trap)
```

**Responsibilities (ideal):** Model = data; View = pixels; Controller = glue.

**Advantages:** Matches UIKit. Little ceremony. Fine for small screens.

**Disadvantages:** Massive view controllers. Hard to test. SwiftUI does not have UIViewControllers as the centre.

**When to use:** tiny UIKit features, system adapters.

**When not:** large SwiftUI apps as the only story.

**Interview:** “MVC on iOS became Massive View Controller because the controller absorbs networking and business rules.” Expected answer.

---

## MVVM (Model–View–ViewModel)

**Structure:**

```text
View (SwiftUI / VC)
   ↕ bindings / observation
ViewModel (state + intents)
   ↕
Model / Services / Repository
```

**Responsibilities:**  
View: render and forward user intents.  
ViewModel: UI state, mapping domain → display, calling use cases.  
Model: domain + persistence + network.

**Advantages:** Test view models without UI. Natural with SwiftUI Observation. Clear “screen state.”

**Disadvantages:** ViewModels become god objects. Duplicate of views. Over-abstraction for a `Text`.

**When to use:** most production SwiftUI apps at 2–4 years.

**When not:** a view with one button and no logic — a function is enough.

**Example:**

```swift
@Observable @MainActor
final class LoginViewModel {
    var email = ""
    var password = ""
    var isLoading = false
    var error: String?

    private let auth: AuthService

    init(auth: AuthService) { self.auth = auth }

    func submit() async {
        isLoading = true
        defer { isLoading = false }
        do {
            try await auth.login(email: email, password: password)
        } catch {
            self.error = "Could not log in"
        }
    }
}
```

**Interview:** ViewModel should not import SwiftUI if you can help it (keeps tests fast). `@MainActor` for UI state.

---

## MVP

View protocol, Presenter talks to View through protocol. More UIKit-era. Rare in new SwiftUI. Know the name: Presenter is like VM but **pushes** to a View protocol instead of the view **pulling** state.

---

## VIPER

View, Interactor, Presenter, Entity, Router.

**Advantages:** strict isolation, testable interactors, explicit routing.  
**Disadvantages:** file explosion, ceremony, onboarding cost.  
**When:** large UIKit teams that already standardised on it.  
**When not:** a 3-person SwiftUI startup.

Interviewers asking VIPER for a SwiftUI role may be outdated — answer it, then say how you would map Router → `NavigationPath`.

---

## Clean Architecture / hexagonal

```text
Entities (domain)
    ↑
Use cases
    ↑
Interface adapters (VM, presenters)
    ↑
Frameworks (SwiftUI, URLSession, SwiftData)
```

Dependencies point **inward**. Domain does not import UIKit.

**Advantages:** replace SwiftData, test use cases, stable business rules.  
**Disadvantages:** mappers everywhere, slow to first screen if cargo-culted.

**When:** non-trivial domain (banking, commerce).  
**When not:** a marketing landing-page app.

---

## TCA (The Composable Architecture)

Unidirectional: State, Action, Reducer, Store, Effects.

**Advantages:** testable reducers, composition, time-travel-ish debugging, community.  
**Disadvantages:** learning curve, boilerplate, fighting SwiftUI sometimes, team buy-in required.

**When:** complex state machines, team already fluent.  
**When not:** every CRUD form.

Do not claim TCA expertise unless you can explain **effects and dependencies**.

---

## Coordinator pattern

A type that **owns navigation**. Views emit events; coordinator mutates `NavigationPath` or UIKit stack.

**Why:** SwiftUI views should not know the whole app graph.  
**When:** many screens, deep links, UIKit+SwiftUI hybrid.  
**When not:** a two-screen app.

---

## Repository and service layer

```text
ViewModel → UseCase → Repository
                         ├─ API
                         └─ Cache
```

Repository **hides** whether data came from network or disk. Service is often a thinner wrapper around one system (`TokenStore`, `Analytics`).

---

## Complete example (feature slice)

```text
App
 ├─ AppState / Session (@Observable, environment)
 ├─ Networking: APIClient
 ├─ Persistence: NotesStore
 └─ Features
      └─ Notes
           ├─ NotesListView
           ├─ NotesListViewModel
           ├─ NoteDetailView
           └─ NotesRepository
```

Each feature can become a Swift package later.

---

# Dependency Injection

```text
Experience: 2–4
Category: Architecture
Difficulty: Intermediate
Importance: High
```

**Why:** tests, previews, swapping live/mock, explicit lifetimes.

### Constructor injection (preferred)

```swift
init(api: APIClient, clock: () -> Date = { .now })
```

### Property injection

Set after init. Worse: half-initialised objects. Used by storyboards (IB). Avoid in SwiftUI.

### Environment injection

```swift
.environment(api)
@Environment(APIClient.self) var api
```

Good for SwiftUI trees. Hidden dependencies can surprise.

### Factory

```swift
protocol ViewModelFactory {
    func makeLogin() -> LoginViewModel
}
```

Composition root at app start creates the graph.

### Protocol-based DI

Depend on `APIClient` protocol, not `LiveAPIClient`. Do not protocol every type — only seams you test or swap.

### Containers

Swinject etc. **4+ discussion:** service locators hide dependencies. Prefer a composition root of `init` calls unless the graph is huge.

### Making networking testable

```swift
struct MockAPI: APIClient {
    var handler: (Request) async throws -> Data
    func send<T: Decodable>(_ request: Request) async throws -> T {
        let data = try await handler(request)
        return try decoder.decode(T.self, from: data)
    }
}
```

Or `URLProtocol` stubs.

---

# Coordinators, Repositories, Modularisation

## Modularisation

```text
Experience: 4+
```

Split by **feature** (Notes, Auth) or by **layer** (UI, Domain, Data). Feature modules scale better than “one UI module of 400 screens.”

**Boundaries:** no import of another feature’s internals; talk via routes and public interfaces.

**Build times:** many small modules vs one app target. Watch cyclic imports.

**When not:** premature split of a 4-screen app.

---

# PART V — Combine

```text
Experience: 2–4
Category: Concurrency
Difficulty: Intermediate
Importance: High (legacy + still in codebases)
```

Combine is Apple’s reactive streams framework.

```text
Publisher  →  operators  →  Subscriber
```

## Core types

| Type | Role |
| --- | --- |
| `Publisher` | Produces values over time, then completion |
| `Subscriber` | Receives |
| `PassthroughSubject` | Manual send, no replay |
| `CurrentValueSubject` | Has latest value |
| `@Published` | Publisher on a property (ObservableObject) |
| `sink` | Subscribe with closures |
| `assign(to:on:)` | Assign to a property (watch retain) |
| `AnyCancellable` | Subscription lifetime; cancel in `deinit` / store in Set |
| `eraseToAnyPublisher()` | Hide operator chain type |

## Operators you must know

- `map`, `flatMap`, `compactMap`
- `debounce`, `throttle` (search box)
- `combineLatest`, `zip`, `merge`
- `switchToLatest` (only latest search request)
- `receive(on: DispatchQueue.main)`
- `removeDuplicates`

```swift
cancellable = $query
    .debounce(for: .milliseconds(300), scheduler: RunLoop.main)
    .removeDuplicates()
    .sink { [weak self] q in
        self?.search(q)
    }
```

## Cancellation

When `AnyCancellable` deinits, subscription cancels. Store on the owner. `[weak self]` in `sink`.

## Combine vs async/await

| | Combine | async/await |
| --- | --- | --- |
| Many values | Natural | `AsyncSequence` / `Observations` |
| One shot | Verbose | Natural |
| Cancellation | Cancellable | Task |
| Learning curve | High | Lower |
| New code | Use if you already have Combine, or UIKit bindings | Prefer async for APIs |

**Interview:** you can `.values` on a publisher to bridge to async.

**When not Combine:** new networking layers. Use `async throws`.

---

# PART VI — Data

Covered in Persistence; extra architecture notes:

## Offline-first

```text
Write local → enqueue mutation → sync when online → reconcile conflicts
```

Conflict policy: last-write-wins, CRDT, or server wins. Product decision.

## Caching layers

```text
Request
  → memory
  → disk
  → network
  → populate caches
```

HTTP cache headers vs custom. Stale-while-revalidate is a strong UX.

---

# PART VII — Testing

```text
Experience: 0–2 (write a unit test)
Experience: 2–4 (mocks, async, UI tests)
Experience: 4+ (test strategy, flakes, snapshot policy)
Category: Testing
Difficulty: Intermediate
Importance: High
```

## Pyramid

Unit (fast, many) → integration (API client + decoder) → UI (few, critical paths).

## XCTest vs Swift Testing

```text
Legacy: XCTest XCTAssert
        ↓
Modern: Swift Testing @Test #expect
        ↓
Why: macros, parameterization, clearer async
```

```swift
import Testing

@Test func sum() {
    #expect(1 + 2 == 3)
}

@Test func fetch() async throws {
    let user = try await api.user(id: "1")
    #expect(user.name == "Ravi")
}
```

XCTest still everywhere. Know both.

## Doubles

| Kind | Behaviour |
| --- | --- |
| Stub | Returns canned data |
| Mock | Expects calls (verify) |
| Fake | Working lightweight impl (in-memory repo) |
| Spy | Records calls |

Prefer fakes over heavy mock frameworks when possible.

## Async testing

`await` in Swift Testing. XCTest `expectation` still appears in interviews.

Actors: test through their async API; do not poke private state from another isolation without `await`.

## Networking tests

`URLProtocol` mock or inject client. Never hit the real network in unit tests.

## UI tests

`XCUIApplication`. Slow, flaky. Use accessibility identifiers. Do not UI-test every pixel.

## Snapshot testing

Point-Free SnapshotTesting / swift-snapshot-testing. Review diffs in PRs. iOS version and Dynamic Type affect snapshots — pin a strategy.

## Example: ViewModel test

```swift
@Test @MainActor
func loginFailureShowsError() async {
    let auth = FakeAuth(result: .failure(.invalid))
    let vm = LoginViewModel(auth: auth)
    vm.email = "a@b.com"
    vm.password = "x"
    await vm.submit()
    #expect(vm.error != nil)
    #expect(vm.isLoading == false)
}
```

---

# PART VIII — Performance

```text
Experience: 2–4 / 4+
Category: Performance
Difficulty: Advanced
Importance: High
```

## “The app is slow” — method

1. **Reproduce** with a time budget (launch, scroll, tap).
2. **Classify:** launch, hang (main thread), jank (frame drops), battery, memory, network.
3. **Measure**, do not guess. Instruments.
4. **Fix the top offender.** Re-measure.
5. **Guard** with a test or metric if it can regress.

### Instruments

| Tool | Question |
| --- | --- |
| Time Profiler | Where is CPU? |
| os_signpost / Points of Interest | Custom spans |
| Allocations | What grows? |
| Leaks | Cycles? |
| Memory Graph | Who retains whom? |
| Main Thread Checker | UIKit off-main? |
| Network | Chatty APIs, large payloads |
| SwiftUI | Body invalidations |
| Energy Log | GPS, CPU, radio |

### Main thread

UIKit/SwiftUI UI, layout, decoding huge JSON, image decode — the last two should often be **off main**, then hop back.

### SwiftUI performance

Lazy containers, stable identity, fine-grained Observation, cheap `body`, downsample images, avoid `AnyView`.

### List performance

Reuse, async images with placeholders, avoid embedding `ScrollView` in `List` cell, prefetch carefully.

### Networking

HTTP/2 multiplexing, compression, pagination, coalescing duplicate in-flight GETs (`actor Inflight`).

### Memory

`NSCache` for images, purge on warning, do not keep full-resolution originals in RAM, watch autoreleasing loops.

### Battery

GPS accuracy, background timers, radios (batch network), unnecessary `Timer` 60 Hz.

### Image loading

Decode at target size. `downsampling`. Disk cache. Cancel on cell reuse / view identity change.

---
