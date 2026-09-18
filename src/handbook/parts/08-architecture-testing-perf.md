# PART IV — Architecture

Architecture is how you place responsibilities so change is cheap, tests are possible, and features do not tangle. It is not a religion. Interviewers want trade-offs, not a brand name.

A junior who can say “we use MVVM” has named a folder. A mid-level who can say why the view model does not import SwiftUI has a seam. A senior who can say when MVVM is too much, when VIPER is ceremony, and how you would migrate a 3 000-line view controller without stopping the train has judgment. This part is about that judgment.

---

## MVC (Model–View–Controller)

UIKit was built around MVC. The model is data. The view is pixels. The controller glues them: it loads, formats, navigates, and reacts. On a small screen that is honest and cheap. There is almost no ceremony.

The trap is well-known because it is almost inevitable. The controller is the only object that lives as long as the screen, so networking, mapping, analytics, and business rules land there. You get a Massive View Controller — two or four thousand lines that nobody wants to test. That is not “MVC is evil.” That is missing boundaries.

```text
Model  ←  Controller  →  View (UIView)
              │
              └── also networking, formatting, navigation  (the trap)
```

Use it for tiny UIKit features and system adapters. Do not sell it as the architecture of a large SwiftUI app — SwiftUI does not even have a view controller in the middle. In the room, the expected sentence is: “MVC on iOS became Massive View Controller because the controller absorbs networking and business rules.” Then say what you would extract first (a client, a store), not “we should rewrite in VIPER.”

---

## MVVM (Model–View–ViewModel)

This is the default for most production SwiftUI I have shipped, and the one you should be able to defend at 2–4 years.

```text
View (SwiftUI / VC)
   ↕ bindings / observation
ViewModel (state + intents)
   ↕
Model / Services / Repository
```

The view renders and forwards user intents. The view model holds UI state, maps domain objects into something the screen can show, and calls use cases. The model is domain, persistence, network — the stuff that would still exist if you deleted the pixels.

The win is that you can test a view model without booting a window, and the screen has a named “state of this feature.” Observation makes the binding natural. The loss is that view models become god objects: a login screen grows session, analytics, deep links, and a feature flag SDK until it is the Massive View Controller with a different filename. A view with one button and no logic does not need a type named `ButtonViewModel`. A function is enough.

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

Two interview sentences that earn trust: keep SwiftUI out of the view model if you can, so tests stay fast; put UI state on `@MainActor` so you are not racing the screen. Inject `AuthService` — construction belongs at the composition root, not inside the type.

---

## MVP

MVP is a UIKit-era cousin. You give the view a protocol. The presenter talks to that protocol and *pushes* “show this error,” “hide the spinner.” A view model in MVVM is usually *pulled*: the view reads state and the framework refreshes. Same idea, different direction.

You will almost never start a new SwiftUI app this way. Know the name so you do not freeze if someone who last interviewed in 2017 uses it.

---

## VIPER

View, Interactor, Presenter, Entity, Router. Strict isolation: the interactor is testable, routing is explicit, nobody is supposed to reach across layers. The cost is file explosion, ceremony, and a long onboarding for anyone who has not lived in that codebase.

It still shows up in large UIKit organisations that standardised on it years ago. It is a poor default for a three-person SwiftUI startup. If an interviewer asks VIPER for a SwiftUI role, answer it — then map the Router onto `NavigationPath` so they know you can translate, not just recite.

---

## Clean Architecture / hexagonal

Uncle Bob’s picture, and the hexagonal one, say the same thing: dependencies point inward. The domain does not import UIKit. Entities sit at the centre. Use cases sit on top of them. Adapters (view models, presenters) sit outside. Frameworks — SwiftUI, URLSession, SwiftData — sit at the edge and can be replaced.

```text
Entities (domain)
    ↑
Use cases
    ↑
Interface adapters (VM, presenters)
    ↑
Frameworks (SwiftUI, URLSession, SwiftData)
```

That is gold when the domain is real: banking, commerce, anything with rules that outlive a screen. You can test a use case without a window. You can swap SwiftData later. It is cargo-cult when the product is a marketing landing page and every field needs a mapper, an entity, and an interface adapter before a label can appear.

The senior tell is not “we use Clean Architecture.” It is “the domain does not import the UI, and here is the one use case that justified the extra types.”

---

## TCA (The Composable Architecture)

Unidirectional: State, Action, Reducer, Store, Effects. Reducers are testable. Features compose. You get something close to time-travel debugging and a community that has thought hard about dependencies.

You also get a learning curve, boilerplate, and occasional fights with SwiftUI. The whole team has to buy in. Complex state machines — a checkout with 3DS, a multi-step onboarding — are the honest use. Every CRUD form is not.

Do not claim TCA expertise unless you can explain effects and how dependencies are injected into the reducer. “We use TCA” without that sentence is a slogan.

---

## Coordinator pattern

A type that owns navigation. Views emit events; the coordinator mutates a `NavigationPath` or a UIKit stack. SwiftUI views should not know the whole app graph. Deep links, many screens, hybrid UIKit-and-SwiftUI — that is when you want one.

A two-screen app does not. A coordinator tree of forty nodes to land a web-checkout replacement is architecture as displacement activity.

---

## Repository and service layer

```text
ViewModel → UseCase → Repository
                         ├─ API
                         └─ Cache
```

A repository hides whether the data came from the network or from disk. Callers ask for a `Note`; they do not care about URLSession versus SwiftData. A service is often thinner: one system, one job — `TokenStore`, `Analytics`. Do not invent a repository for a single UserDefaults bool. Do invent one when you need a fake in tests and a cache in production.

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

This is the shape I would draw on a whiteboard for a notes feature. Session is app-wide. The API client and the store are shared infrastructure. The feature owns its views, its view model, and its repository. Each feature can become a Swift package later without rearranging the universe on day one. Composition happens at `@main`, not inside `NotesListView`.

---

# Dependency Injection

Tests, previews, live-versus-mock, explicit lifetimes — that is the whole point. If you cannot replace a dependency, you do not have a seam.

Constructor injection is the default I want to see:

```swift
init(api: APIClient, clock: () -> Date = { .now })
```

The clock is injected because tests should not sleep until midnight. Property injection — set the collaborator after `init` — leaves a half-initialised object. Storyboards forced that pattern. Avoid it in SwiftUI.

Environment injection is the SwiftUI-shaped version:

```swift
.environment(api)
@Environment(APIClient.self) var api
```

Good for values that a whole tree needs. Easy to hide: a leaf view reaches into the environment for a network client nobody expected. Prefer constructor injection for feature view models; use environment for theme, dismiss, session, things that are truly ambient.

Factories exist so the composition root stays in one place:

```swift
protocol ViewModelFactory {
    func makeLogin() -> LoginViewModel
}
```

At app start you build the graph. Tests build a smaller graph with fakes. Protocol-based DI means depending on `APIClient`, not `LiveAPIClient`. Do not protocol every type. Protocol the seams you test or swap.

Containers like Swinject are a 4+ conversation. Service locators hide dependencies — you cannot see from `init` what a type needs. Prefer a composition root of `init` calls unless the graph is genuinely huge and the team already speaks that container.

Making networking testable is the example everyone should be able to write:

```swift
struct MockAPI: APIClient {
    var handler: (Request) async throws -> Data
    func send<T: Decodable>(_ request: Request) async throws -> T {
        let data = try await handler(request)
        return try decoder.decode(T.self, from: data)
    }
}
```

`URLProtocol` stubs are the other seam, useful when you want to test the real `URLSession` stack. Never hit the network in a unit test.

---

# Coordinators, Repositories, Modularisation

## Modularisation

Split by feature (Notes, Auth) or by layer (UI, Domain, Data). Feature modules scale better than one UI module of 400 screens. A Notes engineer should not import Auth internals; they talk through routes and public interfaces.

Build times are the honest reason many teams modularise — many small modules versus one app target — and cyclic imports are the honest way it goes wrong. Do not split a four-screen app into eight packages because a blog post said “modular.” Split when compile times, team ownership, or a real boundary demand it.

---

# PART V — Combine

Combine is Apple’s reactive streams framework. A publisher produces values over time, then a completion. Operators transform the stream. A subscriber receives. You still meet it in UIKit codebases, in `ObservableObject` + `@Published`, and in interviews that have not fully moved to async/await. New networking layers should be `async throws`. Combine stays where you already have a pipeline of UI events.

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

`map`, `flatMap`, `compactMap`. `debounce` and `throttle` for a search box — debounce waits for a pause, throttle emits on a cadence. `combineLatest`, `zip`, `merge` for joining streams. `switchToLatest` so only the latest search request survives. `receive(on: DispatchQueue.main)` before you touch UI. `removeDuplicates` so identical keystrokes do not retrigger work.

```swift
cancellable = $query
    .debounce(for: .milliseconds(300), scheduler: RunLoop.main)
    .removeDuplicates()
    .sink { [weak self] q in
        self?.search(q)
    }
```

That is the search box. Debounce so you are not firing on every character. Weak self because the sink is stored on self. Additional depth in a later chapter walks `switchToLatest` versus `flatMap` — out-of-order responses are the classic trap.

## Cancellation

When `AnyCancellable` deinits, the subscription cancels. Store it on the owner — a `Set<AnyCancellable>` on the view model. If you do not store it, the subscription dies at the end of the statement and nothing happens, which looks like a Combine bug and is just lifetime. `[weak self]` in `sink` unless you like cycles.

## Combine vs async/await

| | Combine | async/await |
| --- | --- | --- |
| Many values | Natural | `AsyncSequence` / `Observations` |
| One shot | Verbose | Natural |
| Cancellation | Cancellable | Task |
| Learning curve | High | Lower |
| New code | Use if you already have Combine, or UIKit bindings | Prefer async for APIs |

You can bridge with `.values` on a publisher and `for await` the result. That is a useful interview sentence. It is not a reason to start a new API client in Combine.

---

# PART VI — Data

Persistence is covered in its own chapter. Two architectural notes belong here because they show up in design interviews as often as in code review.

## Offline-first

Write locally, enqueue the mutation, sync when you are online, then reconcile conflicts. Last-write-wins, CRDTs, or server-wins are product decisions, not framework ones. Pretending there is no conflict policy is how two devices quietly delete each other’s notes. Ask the interviewer which product they want before you pick one.

## Caching layers

```text
Request
  → memory
  → disk
  → network
  → populate caches
```

HTTP cache headers versus a custom cache is a real choice. `URLCache` is free and often enough for GET. Stale-while-revalidate — show the disk page, refresh in the background — is the UX people remember from Instagram. Do not persist the entire corpus of a social network on the phone.

---

# PART VII — Testing

A junior should be able to write a unit test. A mid-level should mock, test async, and know when a UI test is worth the flake. A senior should have a strategy: what the pyramid looks like on this app, which snapshots you keep, which you delete.

## Pyramid

Many fast unit tests. Some integration tests that run the API client and the decoder against a stubbed HTTP stack. A few UI tests on critical paths — login, pay, the thing that must not break on a Friday. Invert that pyramid and CI becomes a weather report.

## XCTest vs Swift Testing

XCTest is still everywhere: `XCTAssert`, expectations, the test navigator you already know. Swift Testing is the modern language: `@Test`, `#expect`, macros, parameterisation, clearer async. Know both. Write new tests in Swift Testing when the project allows it. Do not pretend a 2018 suite has migrated because you imported `Testing` in one file.

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

## Doubles

| Kind | Behaviour |
| --- | --- |
| Stub | Returns canned data |
| Mock | Expects calls (verify) |
| Fake | Working lightweight impl (in-memory repo) |
| Spy | Records calls |

Prefer fakes over heavy mock frameworks when you can. An in-memory notes store that actually inserts and fetches will catch more than a mock that asserts `save` was called once.

## Async testing

`await` in Swift Testing is the happy path. XCTest `expectation` still appears in interviews and in old suites. Actors: test through their async API. Do not poke private isolated state from another isolation without `await`, and do not slap `nonisolated(unsafe)` on a property to make the test “easier.”

## Networking tests

`URLProtocol` or an injected client. Never hit the real network in a unit test. Flaky CI is not a personality trait; it is a missing seam.

## UI tests

`XCUIApplication`. Slow, flaky, expensive. Use accessibility identifiers so you are not matching on localised copy. Do not UI-test every pixel. Login plus one happy path is a strategy. Every ViewModel branch is not.

## Snapshot testing

Point-Free SnapshotTesting / swift-snapshot-testing. Review diffs in PRs the way you review code. iOS version, simulator, and Dynamic Type change pixels — pin a strategy or you will spend Fridays “fixing” snapshots that are really font metrics.

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

This is the proof the boundary exists. Fake auth, no window, assert the UI state the screen would bind to. If you cannot write this test, the view model is still constructing the world inside itself.

---

# PART VIII — Performance

“The app is slow” is not a diagnosis. It is a ticket. The method is always the same, and interviewers listen for it.

## “The app is slow” — method

Reproduce with a time budget: launch, scroll, tap. Classify: launch, hang (main thread), jank (frame drops), battery, memory, network. Measure. Do not guess. Instruments exists so you can be wrong in private. Fix the top offender. Re-measure. Guard with a test or a metric if it can regress. A senior who names Time Profiler before they have classified the problem is guessing with a fancier tool.

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

UIKit and SwiftUI UI work belongs on the main thread. Layout belongs there. Decoding a huge JSON blob and decoding a 12 megapixel image often do not. Do that work off main, then hop back. The hang you feel as “the app froze” is usually main-thread CPU, not “Swift is slow.”

### SwiftUI performance

Lazy containers. Stable identity. Fine-grained Observation so a volume slider does not redraw the whole player. Cheap `body` — no networking, no UUID identity in the body. Downsample images. Avoid `AnyView` in hot paths. The SwiftUI Instruments template is how you prove extra invalidations, not `print` in `body`.

### List performance

Reuse (UIKit) or identity (SwiftUI). Async images with placeholders. Do not embed a `ScrollView` in a `List` cell. Prefetch carefully and cancel when the row is gone. A slow list is usually images, identity, or work in `body` — in that order.

### Networking

HTTP/2 multiplexing, compression, pagination, coalescing duplicate in-flight GETs (`actor Inflight`). Chatty APIs kill battery and feel like jank even when frames are fine.

### Memory

`NSCache` for images, purge on warning, do not keep full-resolution originals in RAM, watch autoreleasing loops. Caches without limits are how a feed climbs 150 MB to 900 MB in five minutes.

### Battery

GPS accuracy you actually need, not `kCLLocationAccuracyBest` for a city-level map. Background timers. Radios: batch network. A `Timer` at 60 Hz you forgot to invalidate.

### Image loading

Decode at target size. Downsample. Disk cache. Cancel on cell reuse or when SwiftUI identity changes. The thumbnail that decodes a 12 megapixel asset on the main thread is the most common “our list is slow” bug in the building.
