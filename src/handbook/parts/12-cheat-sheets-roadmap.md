# FINAL — Interview Cheat Sheet

Use this the night before. If you cannot explain a row in one sentence, open the matching chapter.

## Swift keywords

| Concept | Meaning | When to use | Level |
| ------- | ------- | ----------- | ----- |
| `let` | Immutable binding | Default | 0–2 |
| `var` | Mutable binding | Need mutation/reassign | 0–2 |
| `if let` | Unwrap in a block | Optional branch | 0–2 |
| `guard let` | Unwrap or exit | Preconditions | 0–2 |
| `??` | Default if nil | Safe default, not to hide bugs | 0–2 |
| `?` chaining | Nil-safe access | Probe chains | 0–2 |
| `!` | Force unwrap | Proven non-nil or deliberate crash | 0–2 |
| `throws`/`try` | Error path | Recoverable failures | 0–2 |
| `defer` | Scope-exit work | Cleanup | 0–2 |
| `mutating` | Mutate value-type `self` | Struct methods | 0–2 |
| `lazy` | Init on first access | Expensive one-time, not concurrent | 2–4 |
| `weak` | Non-owning optional ref | Delegates, closures | 0–2 |
| `unowned` | Non-owning non-optional | Proven longer lifetime | 2–4 |
| `some` | Opaque type | `body`, hide concrete type | 2–4 |
| `any` | Existential | Mixed types | 2–4 |
| `async`/`await` | May suspend | I/O, composition | 0–2 / 2–4 |
| `actor` | Isolated mutable state | Shared mutable without locks | 4+ |
| `nonisolated` | Opt out of isolation | Safe immutable API | 4+ |
| `@MainActor` | Main executor isolation | UI | 2–4 |
| `Sendable` | Cross-isolation safe | Swift 6 | 4+ |
| `@escaping` | Closure outlives call | Stored/async callbacks | 2–4 |
| `inout` | Copy-in/copy-out mutation | Rare mutating helpers | 2–4 |
| `static`/`class` | Type-level members | `class` overridable | 0–2 |
| `final` | No subclass | Design + slight perf | 2–4 |
| `open`/`public` | Cross-module | Library authors | 2–4 |
| `indirect` | Recursive enum | Trees | 2–4 |

## Property wrappers

| Concept | Meaning | When to use | Level |
| ------- | ------- | ----------- | ----- |
| `@State` | View-owned durable storage | Local UI state; also own `@Observable` | 0–2 |
| `@Binding` | Borrowed two-way | Child writes parent | 0–2 |
| `@StateObject` | Own `ObservableObject` | Legacy OO ownership | 2–4 |
| `@ObservedObject` | Observe passed OO | Passed-in only | 2–4 |
| `@EnvironmentObject` | OO from tree | App-wide legacy | 2–4 |
| `@Environment` | Ambient value | Theme, dismiss, custom keys | 0–2 |
| `@Observable` | Fine-grained observation | Modern models | 2–4 |
| `@Bindable` | Bindings into observable | TextField to class fields | 2–4 |
| `@Query` | SwiftData fetch | SwiftData UI | 2–4 |
| `@AppStorage` | UserDefaults + UI | Settings flags | 0–2 |
| `@SceneStorage` | Per-scene UI restore | Nav/tab | 2–4 |
| `@FocusState` | Keyboard focus | Forms | 2–4 |
| `@Namespace` | Matched geometry | Hero animations | 2–4 |
| `@GestureState` | Ends with gesture | Drag | 2–4 |
| `@Published` | Combine property | Legacy OO | 2–4 |
| `@Preconcurrency` | Weak import checking | Migration | 4+ |

## SwiftUI containers

| Concept | Meaning | When to use | Level |
| ------- | ------- | ----------- | ----- |
| `VStack`/`HStack`/`ZStack` | Eager stacks | Small layouts | 0–2 |
| `LazyVStack` | Lazy vertical | Long scroll custom | 2–4 |
| `List` | Platform list | Feeds, settings rows | 0–2 |
| `Form` | Grouped inputs | Settings | 0–2 |
| `ScrollView` | Scroll container | Custom scroll | 0–2 |
| `NavigationStack` | Push stack | Hierarchies | 0–2 |
| `NavigationSplitView` | Sidebar | iPad | 2–4 |
| `TabView` | Tabs | Top-level | 0–2 |
| `Group` | Logical grouping | Modifiers / builder | 0–2 |
| `NavigationView` | Legacy | Maintain only | 2–4 |

## Modifiers (high-signal)

| Concept | Meaning | When to use | Level |
| ------- | ------- | ----------- | ----- |
| `.padding` / `.background` | Layout vs paint wrap | Order matters | 0–2 |
| `.frame` | Size/alignment | Constraints | 0–2 |
| `.offset` | Visual shift | Not layout replacement | 2–4 |
| `.id` | Explicit identity | Reset / stable identity | 2–4 |
| `.task` | Cancellable async | Loads | 2–4 |
| `.onChange` | React to value | Side effects | 2–4 |
| `.animation` | Implicit | `value:` form | 0–2 |
| `.transition` | Insert/remove | Identity changes | 2–4 |
| `.redacted` | Placeholder | Loading | 0–2 |
| `.disabled` | Control state | Forms | 0–2 |

## UIKit lifecycle

| Concept | Meaning | When to use | Level |
| ------- | ------- | ----------- | ----- |
| `loadView` | Create view | Custom root | 2–4 |
| `viewDidLoad` | One-time setup | Bind, hierarchy | 0–2 |
| `viewWillAppear` | Each show | Refresh | 0–2 |
| `viewDidAppear` | Visible | Analytics, anim | 0–2 |
| `viewWillDisappear` | Leaving | Pause | 0–2 |
| `viewDidLayoutSubviews` | Geometry ready | Frames-dependent | 2–4 |

## Concurrency keywords

| Concept | Meaning | When to use | Level |
| ------- | ------- | ----------- | ----- |
| `Task` | Unstructured work | When no scope exists | 2–4 |
| `Task.detached` | No inherited actor | Rare CPU | 4+ |
| `async let` | Structured pair/triple | Fixed parallel | 2–4 |
| `TaskGroup` | Dynamic parallel | N downloads | 2–4 |
| `Task.checkCancellation` | Cooperative cancel | Loops | 2–4 |
| `MainActor.run` | Hop to UI | Legacy hops | 2–4 |
| `AsyncStream` | Push values | Callbacks → async | 4+ |
| `Observations` | Observable → AsyncSequence | iOS 26 non-UI | 4+ |

## Memory

| Concept | Meaning | When to use | Level |
| ------- | ------- | ----------- | ----- |
| Strong | Default own | Ownership | 0–2 |
| Weak | Optional non-owning | Cycles | 0–2 |
| Unowned | Non-optional non-owning | Proven | 2–4 |
| Capture list | How closure captures | `[weak self]` | 2–4 |
| `deinit` | Last release | Cancel timers | 0–2 |

## Networking

| Concept | Meaning | When to use | Level |
| ------- | ------- | ----------- | ----- |
| `URLSession` | HTTP client | Always (or wrapper) | 0–2 |
| `URLRequest` | Method/headers/body | Non-GET, auth | 0–2 |
| `JSONDecoder` | Data → model | APIs | 0–2 |
| `URLProtocol` | Test seam | Unit tests | 2–4 |
| `NWPathMonitor` | Path UI | Offline banner | 2–4 |
| `URLCache` | HTTP cache | GET cacheable | 2–4 |

## Persistence

| Concept | Meaning | When to use | Level |
| ------- | ------- | ----------- | ----- |
| UserDefaults | Small prefs | Flags | 0–2 |
| Keychain | Secrets | Tokens | 2–4 |
| FileManager | Files | Caches/docs | 0–2 |
| Core Data | Object graph DB | Mature graphs | 2–4 |
| SwiftData | Swift-native models | New SwiftUI data | 2–4 |
| `NSCache` | Memory cache | Images | 2–4 |

## Architecture

| Concept | Meaning | When to use | Level |
| ------- | ------- | ----------- | ----- |
| MVC | UIKit default | Tiny UIKit | 0–2 |
| MVVM | VM holds UI state | Most SwiftUI | 2–4 |
| VIPER | Many types | Large UIKit orgs | 4+ |
| Clean | Domain inward | Rich domain | 4+ |
| TCA | Unidirectional store | Complex machines | 4+ |
| Coordinator | Owns navigation | Deep graphs | 2–4 |
| Repository | Abstract data | Test + cache | 2–4 |
| DI | Inject deps | Test/previews | 2–4 |

## Testing / performance tools

| Concept | Meaning | When to use | Level |
| ------- | ------- | ----------- | ----- |
| XCTest | Classic tests | Existing suites | 0–2 |
| Swift Testing | `@Test` `#expect` | New tests | 0–2 |
| XCUITest | UI automation | Smoke | 2–4 |
| Time Profiler | CPU | Hangs/jank | 2–4 |
| Allocations | Memory growth | High water | 2–4 |
| Leaks / graph | Cycles | Abandoned objects | 2–4 |
| Main Thread Checker | UIKit off-main | Debug | 2–4 |
| SwiftUI Instruments | Body invalidation | Extra renders | 4+ |

---

## SwiftUI one-page data-flow diagram

```text
Source of truth
      │
      ├── @State (view local)
      ├── @Observable model in @State / environment
      └── Persistent store (@Query / repository)

View.body reads dependencies
      │
      ▼
SwiftUI records reads (Observation) / subscriptions (OO)
      │
      ▼
User / network writes
      │
      ▼
Invalidate → new structs → body → diff by identity → pixels
```

## Concurrency one-pager

```text
async  ≠  background
await  =  possible suspend
Task   ≠  new thread
.task  =  cancelled with view
Actor  =  serialise mutable state
MainActor = UI
Sendable = may cross isolation
```

## Architecture one-pager

```text
View (dumb-ish)
  → ViewModel / presenter of UI state
    → Use cases
      → Repository
        → API + Disk
Composition root builds the graph.
Features don’t import features.
```

---

# Final Interview Roadmap

## Phase 1 — 0–2 years (weeks 1–3 of a junior search)

1. Swift: `let`/`var`, optionals, structs/classes, ARC, closures
2. SwiftUI: View, stacks, List, `@State`, `@Binding`, NavigationStack
3. Networking: URLSession + Codable + errors
4. Persistence: UserDefaults, files; know Keychain exists
5. 20 Easy coding problems in Swift
6. UIKit lifecycle overview

**Exit test:** Build a two-screen app that fetches a list, shows detail, handles loading/error, no retain cycle in a closure.

## Phase 2 — 2–4 years

1. Observation vs ObservableObject
2. `.task`, cancellation, MainActor
3. MVVM + DI + tests
4. NavigationPath, sheets
5. Memory: Instruments graph
6. Combine reading (maintenance)
7. Medium coding: two pointers, BFS, hash maps

**Exit test:** Explain why a list dropped state, fix it, add unit tests for a ViewModel, cancel on leave.

## Phase 3 — 4+ years

1. Actors, Sendable, Swift 6
2. SwiftUI identity/rendering
3. Offline sync + security
4. System design drills (feed, chat, banking)
5. Modularisation and migrations
6. Performance budgets

**Exit test:** 45-minute design of offline notes + conflict policy + test strategy.

## Phase 4 — Coding

Daily: 1 Easy or 1 Medium in Swift. Talk out loud. Always complexity.

## Phase 5 — Architecture

Sketch MVVM + repository for your last production feature. Then sketch how you would modularise it. Then attack it: what fails offline?

## Phase 6 — Mock interviews

- Junior: 45 min Swift + SwiftUI live coding a screen
- Mid: 45 min feature + 30 min “why is this list slow”
- Senior: 45 min system design + 30 min behavioural debugging story

Record yourself. If you cannot explain `@State` without saying “it stores state,” you are not done.

---

# 30-Day Preparation Plan

Assume 90 focused minutes per weekday, 3 hours per weekend day.

### Days 1–4 — Swift core

Optionals, value vs reference, ARC + `[weak self]`, functions/closures. End each day with 5 beginner questions aloud.

### Days 5–8 — SwiftUI core

View, modifiers (order!), `@State`/`@Binding`, List vs VStack, NavigationStack. Build the two-screen app.

### Days 9–11 — Networking & persistence

URLSession async, status codes, decoder, Keychain vs defaults. Add fetch to the app with errors.

### Days 12–14 — Concurrency

`async` myth, Task, `.task`, MainActor, cancellation. Add cancellation to the app.

### Days 15–17 — Observation & identity

`@Observable`, `@Bindable`, `.id`, ForEach IDs, body purity. Break the app on purpose (UUID id) and fix it.

### Days 18–20 — Architecture & tests

MVVM, inject a protocol, Swift Testing. 10 ViewModel tests.

### Days 21–22 — UIKit & memory

Lifecycle table, cell reuse, Instruments leak on a deliberate cycle.

### Days 23–24 — Coding sprint

10 Easy + 8 Medium from this handbook.

### Days 25–26 — System design

Instagram feed + offline notes. Timebox 45 minutes each. Write trade-offs.

### Days 27–28 — Senior topics / security / performance

“App is slow” method, ATS, tokens, list jank.

### Day 29 — Full mock

Random 15 questions from each bucket + one coding + one design.

### Day 30 — Cheat sheets only

Rest the brain. Recite one-minute explanations:

1. struct vs class  
2. `@State` vs `@Binding` vs `@Observable`  
3. `async`/`await`/`Task`  
4. ARC weak/unowned  
5. NavigationStack  
6. How I debug a slow list  

---

## Must-know one-minute scripts

**struct vs class:** “Structs have value semantics: assignment copies. Classes have identity and shared mutation. I use structs for data and SwiftUI views, classes for UIKit objects and shared observable models. Collections of structs use copy-on-write so copies are cheap until mutation.”

**@State:** “Views are disposable structs. `@State` tells SwiftUI to keep storage next to the view’s identity. Mutating it invalidates `body`. I mark it `private` and pass `$value` as a Binding to children. If identity changes, state resets.”

**Concurrency:** “`async` means the function may suspend, not that it leaves the main thread. `await` is a suspension point. Tasks are scheduled on executors; they are not threads. UI stays on MainActor. I cancel with structured `.task`.”

**MVVM:** “The view renders state and sends intents. The view model holds UI state, calls services, and is testable without UIKit/SwiftUI if I inject dependencies. I avoid god view models by splitting screens and use cases.”

---

## Common traps (last look)

```text
❌ async = background
❌ @ObservedObject var vm = VM()
❌ VStack of thousands of rows
❌ .id(UUID()) in body
❌ Token in UserDefaults
❌ Ignore HTTP status
❌ ForEach(items.indices) on a mutating list
❌ Task in onAppear without cancel
❌ Protocol extension as dynamic dispatch
❌ Claiming NavigationView is modern
```

---

## Version map (say this if asked “what’s modern?”)

| Area | Prefer now | Still maintain | Don’t start |
| --- | --- | --- | --- |
| UI | SwiftUI + Observation | UIKit hybrid | Storyboard-only new features |
| Navigation | NavigationStack | UIKit nav | NavigationView |
| Async | async/await | Combine in UIKit/legacy | New completion-only layers |
| Models | `@Observable` | ObservableObject | |
| Data | SwiftData when it fits | Core Data | Raw SQLite unless you need it |
| Tests | Swift Testing | XCTest | |
| Concurrency | Swift 6 isolation | GCD for specific APIs | Callback pyramids |

---

# Closing

Interviews reward **precise mental models**:

- Bindings vs objects
- Identity vs state
- Tasks vs threads
- Ownership vs observation
- Happy path vs cancellation, errors, and process death

If you can teach those five, you can pass most iOS loops. The rest of this handbook is the supporting evidence: syntax, internals, mistakes, and the questions people actually ask.

Good luck. Build something small every day you study. Explanation without recent code atrophies; code without explanation fails the interview.

---

*End of the iOS & SwiftUI Interview Handbook.*
