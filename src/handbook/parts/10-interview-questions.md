# PART X — Interview Questions

Each question includes the expected answer, a short explanation, a common wrong answer, a follow-up, and what the interviewer is actually testing.

How to practice: cover the expected answer **out loud** in 60–90 seconds, then attempt the follow-up.

---

## Beginner questions (0–2 years)

At least fifty. These test vocabulary, crashes you should not ship, and SwiftUI basics.

### B1. What is the difference between `let` and `var`?
**Expected:** `let` is an immutable binding; `var` can be reassigned or used to mutate a value type.  
**Explanation:** For classes, `let` still allows mutating the object’s properties.  
**Wrong:** “`let` is faster” as the only answer.  
**Follow-up:** Can you mutate a class stored in a `let`?  
**Testing:** Binding vs object immutability.

### B2. Why does Swift have optionals?
**Expected:** To represent absence in the type system instead of sentinel values or crashing nil pointers.  
**Explanation:** `T?` is `Optional<T>`.  
**Wrong:** “Optionals are pointers.”  
**Follow-up:** Show `if let` vs `guard let`.  
**Testing:** Safety model.

### B3. `if let` vs `guard let`?
**Expected:** `if let` unwraps inside a block; `guard let` early-exits and unwraps for the rest of the scope.  
**Explanation:** `guard` must leave the scope.  
**Wrong:** They are identical.  
**Follow-up:** When is `??` better?  
**Testing:** Control flow taste.

### B4. What does `??` do?
**Expected:** Unwraps if non-nil, otherwise evaluates the default (autoclosure).  
**Wrong:** It force-unwraps.  
**Follow-up:** Is the default always evaluated?  
**Testing:** Nil coalescing.

### B5. What is force unwrapping and when is it dangerous?
**Expected:** `!` crashes if `nil`. Dangerous in production paths.  
**Wrong:** “Never ever use it” without nuance, or “it’s fine.”  
**Follow-up:** IUO vs `!`.  
**Testing:** Crash awareness.

### B6. Struct vs class?
**Expected:** Value vs reference semantics; copies vs shared identity.  
**Explanation:** SwiftUI views are structs.  
**Wrong:** “Structs live on the stack, classes on the heap” as a complete answer.  
**Follow-up:** What is copy-on-write?  
**Testing:** Core Swift.

### B7. Why are SwiftUI views structs?
**Expected:** Cheap descriptions; framework stores state separately.  
**Wrong:** “Because Apple likes structs.”  
**Follow-up:** If the struct is recreated, how does `@State` survive?  
**Testing:** SwiftUI model.

### B8. What is `@State`?
**Expected:** View-owned source of truth stored by SwiftUI, surviving recreations for a stable identity.  
**Wrong:** “It stores state” with no ownership story.  
**Follow-up:** Why `private`? What is `$count`?  
**Testing:** State ownership.

### B9. What is `@Binding`?
**Expected:** A two-way connection to someone else’s storage.  
**Wrong:** A copy of `@State`.  
**Follow-up:** How do you create one from `@State`?  
**Testing:** Data flow.

### B10. What does `some View` mean?
**Expected:** Opaque type: one concrete view type, hidden from the caller.  
**Wrong:** “It can be any view.” That is `any View`.  
**Follow-up:** Why not `any View` in `body`?  
**Testing:** Opaque vs existential.

### B11. Why does modifier order matter?
**Expected:** Each modifier wraps the previous view; padding-then-background fills the padded area.  
**Wrong:** “It doesn’t.”  
**Follow-up:** `offset` vs `padding`.  
**Testing:** Layout.

### B12. `VStack` vs `LazyVStack`?
**Expected:** Eager vs lazy child creation. Long scrolling content should not use plain `VStack`.  
**Wrong:** They are identical.  
**Follow-up:** List vs LazyVStack.  
**Testing:** Performance basics.

### B13. What is ARC?
**Expected:** Automatic reference counting for class instances; dealloc at count zero.  
**Wrong:** Garbage collection.  
**Follow-up:** Why can leaks still happen?  
**Testing:** Memory.

### B14. What is a retain cycle?
**Expected:** Two (or more) objects strongly owning each other so counts never hit zero.  
**Follow-up:** How do closures cause them?  
**Testing:** Ownership graph.

### B15. Why are delegates `weak`?
**Expected:** The delegating object should not keep the delegate alive; avoids cycles.  
**Wrong:** “Because Apple said so.”  
**Follow-up:** Why optional?  
**Testing:** Cocoa patterns.

### B16. `weak` vs `unowned`?
**Expected:** Weak is optional and zeroed; unowned is non-optional and crashes if dangling.  
**Follow-up:** Pick one for `URLSession` completion.  
**Testing:** Capture lists.

### B17. What is a closure?
**Expected:** An anonymous function that captures surrounding values.  
**Follow-up:** What is `@escaping`?  
**Testing:** Functions as values.

### B18. What is `@escaping`?
**Expected:** The closure can outlive the function call (stored/async).  
**Wrong:** It runs on a background thread.  
**Testing:** Lifetime.

### B19. Trailing closure syntax?
**Expected:** Last closure argument written outside parentheses.  
**Follow-up:** Multiple trailing closures.  
**Testing:** Syntax literacy.

### B20. `map` vs `compactMap` vs `flatMap` (on sequences)?
**Expected:** `map` transforms; `compactMap` drops nil; `flatMap` flattens nested sequences.  
**Follow-up:** Optional `flatMap`.  
**Testing:** Standard library.

### B21. What is `Codable`?
**Expected:** `Encodable & Decodable` for JSON (and others).  
**Follow-up:** How do you map `user_id` to `userID`?  
**Testing:** Networking basics.

### B22. How do you fetch JSON in modern Swift?
**Expected:** `URLSession` async `data(for:)`, check HTTP status, `JSONDecoder`.  
**Wrong:** Only show completion handlers as if async did not exist (know both).  
**Follow-up:** Where do you decode — main thread?  
**Testing:** Networking.

### B23. Why check `HTTPURLResponse.statusCode`?
**Expected:** `Data` can arrive with 404/500.  
**Wrong:** “If it didn’t throw, it succeeded.”  
**Testing:** Production hygiene.

### B24. UserDefaults vs Keychain?
**Expected:** Preferences vs secrets.  
**Follow-up:** Where do you put a refresh token?  
**Testing:** Security literacy.

### B25. MVC vs MVVM in one minute?
**Expected:** MVC controller becomes massive; MVVM moves UI state/logic to a testable object the view observes.  
**Follow-up:** Does SwiftUI need a VM for every view?  
**Testing:** Architecture taste.

### B26. UIViewController `viewDidLoad` vs `viewWillAppear`?
**Expected:** Load once when the view is created; appear every time it shows.  
**Wrong:** Put all refresh in `viewDidLoad`.  
**Follow-up:** Is `viewDidLoad` guaranteed to have final frames?  
**Testing:** UIKit lifecycle.

### B27. What is cell reuse?
**Expected:** Table/collection views recycle cells for performance; reset in `prepareForReuse`.  
**Testing:** UIKit lists.

### B28. `frame` vs `bounds`?
**Expected:** Frame in superview coords; bounds local.  
**Testing:** UIKit geometry.

### B29. What is Auto Layout?
**Expected:** Constraints solved into frames.  
**Follow-up:** `translatesAutoresizingMaskIntoConstraints`.  
**Testing:** Layout.

### B30. What is `guard`?
**Expected:** Early exit with a boolean or unwrap; keeps the happy path flat.  
**Testing:** Style.

### B31. Exhaustive `switch` — why?
**Expected:** Compiler forces new enum cases to be handled.  
**Follow-up:** `default` vs `@unknown default`.  
**Testing:** Enums.

### B32. What is an enum associated value?
**Expected:** Data attached to a case, modelling exclusive states.  
**Follow-up:** Why not three optionals for loading/data/error?  
**Testing:** Modelling.

### B33. Protocol vs superclass?
**Expected:** Contract without shared storage; multiple conformance; structs can participate.  
**Testing:** POP.

### B34. What is `mutating`?
**Expected:** Method that changes `self` on a value type; requires `var`.  
**Testing:** Value types.

### B35. Stored vs computed property?
**Expected:** Stored has memory; computed is get/set code.  
**Testing:** Properties.

### B36. `static` vs `class` members?
**Expected:** `class` can be overridden; `static` cannot.  
**Testing:** Inheritance.

### B37. What is a tuple?
**Expected:** Lightweight anonymous grouping. Prefer structs in public APIs.  
**Testing:** Types.

### B38. Array vs Set vs Dictionary?
**Expected:** Ordered list; unique unordered; key-value.  
**Follow-up:** Dictionary subscript type?  
**Testing:** Collections.

### B39. Why is dictionary lookup optional?
**Expected:** Keys may be missing.  
**Testing:** Optionals in APIs.

### B40. What is type inference?
**Expected:** Compiler fills a static type; not dynamic typing.  
**Testing:** Type system.

### B41. `String` indexing — why not `Int`?
**Expected:** Unicode grapheme clusters; indexes are `String.Index`.  
**Testing:** Unicode.

### B42. What is interpolation `"\(x)"`?
**Expected:** Insert values into a string.  
**Testing:** Basics.

### B43. `for-in` vs `forEach`?
**Expected:** `for-in` supports `break`/`continue`; `forEach` does not.  
**Testing:** Control flow.

### B44. What is `defer`?
**Expected:** Runs when the scope exits, even on throw/return.  
**Follow-up:** Multiple defers — reverse order.  
**Testing:** Cleanup.

### B45. `try` vs `try?` vs `try!`?
**Expected:** Propagate / nil / crash.  
**Testing:** Errors.

### B46. SwiftUI `Button` vs `onTapGesture` on `Text`?
**Expected:** Button is a control with accessibility and disabled states.  
**Testing:** Accessibility + UI.

### B47. What is `NavigationStack`?
**Expected:** Modern push-navigation container driven by a stack of values.  
**Wrong:** Recommend `NavigationView` for new code.  
**Testing:** Current SwiftUI.

### B48. `sheet` vs `fullScreenCover`?
**Expected:** Card modal vs edge-to-edge.  
**Testing:** Presentation.

### B49. What is SF Symbol `Image(systemName:)`?
**Expected:** Vector symbols that scale with Dynamic Type.  
**Testing:** UI literacy.

### B50. Why `private` on `@State`?
**Expected:** Encapsulate the source of truth; pass bindings down.  
**Testing:** Ownership.

### B51. What does `async` mean?
**Expected:** The function may suspend; it does not mean background thread.  
**Testing:** Concurrency seed (even juniors should not lie).

### B52. What is `Task { }`?
**Expected:** Starts unstructured asynchronous work; does not create a dedicated thread.  
**Follow-up:** How do you cancel it?  
**Testing:** Concurrency seed.

### B53. What is `Sendable` in one sentence?
**Expected:** Safe to share across concurrency domains.  
**Testing:** Awareness (depth not required at 0–2).

### B54. How does SwiftUI preview work conceptually?
**Expected:** Renders the view in isolation; inject sample data.  
**Testing:** Workflow.

### B55. What is `Identifiable`?
**Expected:** Stable `id` for `ForEach`/List identity.  
**Wrong:** Using array indices as IDs when the list mutates.  
**Testing:** Identity.

---

## Intermediate questions (2–4 years)

Seventy-five. These test ownership, lifetime, cancellation, and production judgment.

### I1. `@StateObject` vs `@ObservedObject`?
**Expected:** Own vs observe. Never `ObservedObject` with an inline `= Model()`.  
**Wrong:** They are interchangeable.  
**Follow-up:** What is the Observation replacement?  
**Testing:** The classic trap.

### I2. Why did `@ObservedObject var vm = VM()` reset state?
**Expected:** The struct recreation allocates a new VM.  
**Testing:** Lifetime.

### I3. `@Environment` vs `@EnvironmentObject`?
**Expected:** Values vs objects; missing object crashes at runtime.  
**Testing:** DI in SwiftUI.

### I4. How does `@Observable` differ from `ObservableObject`?
**Expected:** Fine-grained property tracking vs `objectWillChange`.  
**Follow-up:** How do you take bindings? (`@Bindable`)  
**Testing:** Modern SwiftUI.

### I5. Who owns an `@Observable` model created in a view?
**Expected:** Hold it in `@State` so the instance is stable.  
**Testing:** Observation + State.

### I6. Structural vs explicit identity?
**Expected:** Position/type in the tree vs `.id`.  
**Follow-up:** `if/else` two `HomeView()`s.  
**Testing:** Rendering.

### I7. What does `.id(UUID())` in `body` do?
**Expected:** Destroys and recreates the view every evaluation.  
**Testing:** Foot-gun awareness.

### I8. Why can `body` run many times?
**Expected:** Any dependency change, parent invalidation, environment. Keep it cheap.  
**Testing:** Performance.

### I9. `.task` vs `onAppear { Task { } }`?
**Expected:** `.task` is cancelled when the view disappears; ad-hoc Task often is not.  
**Testing:** Cancellation.

### I10. How do you cancel network on pop?
**Expected:** `.task` + await URLSession; or stored `Task`/`URLSessionTask` cancel.  
**Testing:** Lifecycle + networking.

### I11. Does `await` block the thread?
**Expected:** Suspends the task; thread can run other work. Blocking APIs still block.  
**Testing:** Concurrency.

### I12. Structured vs unstructured concurrency?
**Expected:** Children tied to a scope vs `Task {}` with independent lifetime.  
**Testing:** Task model.

### I13. `async let` vs `TaskGroup`?
**Expected:** Fixed vs dynamic number of children.  
**Testing:** Parallelism.

### I14. How does cooperative cancellation work?
**Expected:** Checks/`URLSession` honours cancel; your loops must check.  
**Testing:** Real async.

### I15. `@MainActor` why?
**Expected:** UI isolation; compiler hops you to the main executor.  
**Follow-up:** Can `async` still run on main? Yes.  
**Testing:** Threads vs actors.

### I16. Actor vs lock?
**Expected:** Compiler-checked serialisation that composes with async; don’t hold locks across `await`.  
**Testing:** Shared mutable state.

### I17. Actor reentrancy?
**Expected:** After `await`, another task may have entered; re-read state.  
**Testing:** 4-year-leaning mid.

### I18. Copy-on-write?
**Expected:** Value types share buffers until mutation (`isKnownUniquelyReferenced`).  
**Testing:** Performance model.

### I19. Protocol extension dispatch trap?
**Expected:** Non-requirement methods in extensions dispatch statically.  
**Testing:** POP depth.

### I20. `some` vs `any`?
**Expected:** Opaque vs existential; mixed arrays need `any`; SwiftUI body wants `some`.  
**Testing:** Type system.

### I21. Associated types — why generics often beat `any P`?
**Expected:** Existentials hide `Item`; generics keep it.  
**Testing:** PAT.

### I22. Type erasure — when?
**Expected:** Hide a generic type (`AnyView`, `AnyPublisher`) when you must store mixed or name a type.  
**Testing:** API design.

### I23. How do you test a ViewModel?
**Expected:** Inject fakes; assert state after `await submit()`.  
**Testing:** Testability.

### I24. Mock vs fake?
**Expected:** Mock verifies interactions; fake is a simplified working impl.  
**Testing:** Testing vocabulary.

### I25. How do you stub `URLSession`?
**Expected:** `URLProtocol` or wrap in a protocol.  
**Testing:** Networking tests.

### I26. Combine `debounce` vs `throttle`?
**Expected:** Debounce waits for pause; throttle emits at intervals.  
**Testing:** Rx literacy.

### I27. `PassthroughSubject` vs `CurrentValueSubject`?
**Expected:** No initial vs has current.  
**Testing:** Combine.

### I28. Why `[weak self]` in `sink`?
**Expected:** Subscription stored on self + strong self = cycle.  
**Testing:** Memory + Combine.

### I29. NavigationPath restoration?
**Expected:** Codable route enum + SceneStorage/file; typed stack.  
**Testing:** Navigation.

### I30. Deep linking strategy?
**Expected:** Parse URL → app route → select tab → set stack.  
**Testing:** Product engineering.

### I31. Pagination + duplicates?
**Expected:** Cursor + `Set` of IDs; stable identity in list.  
**Testing:** Real APIs.

### I32. Token refresh storms?
**Expected:** Actor serialises refresh; waiter queue.  
**Testing:** Auth.

### I33. Retry policy?
**Expected:** Idempotent methods, backoff, cap, Retry-After.  
**Testing:** Resilience.

### I34. `URLCache` vs your own disk cache?
**Expected:** HTTP semantics vs domain-specific (images, offline notes).  
**Testing:** Caching.

### I35. Core Data object across queues?
**Expected:** Pass `objectID`, not the object.  
**Testing:** Persistence concurrency.

### I36. SwiftData vs Core Data — when stay?
**Expected:** Complex migrations, mature tooling, existing stack.  
**Testing:** Judgment.

### I37. `lazy var` thread safety?
**Expected:** Not safe for concurrent first access.  
**Testing:** Concurrency + init.

### I38. `NotificationCenter` block observer leak?
**Expected:** Must remove/store token; prefer structured observation.  
**Testing:** Memory.

### I39. Timer retain cycle?
**Expected:** Target-selector timer retains target; invalidate + weak block.  
**Testing:** Memory.

### I40. SwiftUI list slow — first three checks?
**Expected:** Images, identity, work in body / not lazy.  
**Testing:** Perf debugging.

### I41. GeometryReader layout explosion?
**Expected:** It takes all offered space; prefer newer geometry APIs.  
**Testing:** Layout.

### I42. Preference keys extra passes?
**Expected:** Child-to-parent communication can loop if state fights layout.  
**Testing:** Advanced SwiftUI.

### I43. `UIViewRepresentable` `updateUIView` rules?
**Expected:** Idempotent; don’t recreate the UIView. Coordinator for delegates.  
**Testing:** Hybrid.

### I44. Child view controller containment steps?
**Expected:** `addChild`, `addSubview`, `didMove`.  
**Testing:** UIKit.

### I45. Diffable data source why?
**Expected:** Identity snapshots, fewer inconsistency crashes.  
**Testing:** UIKit lists.

### I46. Coordinator vs NavigationLink everywhere?
**Expected:** Coordinators keep graphs and deep links out of leaf views.  
**Testing:** Architecture.

### I47. Constructor injection vs service locator?
**Expected:** Init makes dependencies explicit; locators hide them.  
**Testing:** DI.

### I48. When is TCA overkill?
**Expected:** Simple forms; team not fluent; time-to-delivery.  
**Testing:** Judgment.

### I49. Clean architecture mapping on iOS?
**Expected:** Domain inwards; SwiftUI/URLSession at edges.  
**Testing:** Layers.

### I50. How to investigate a leak?
**Expected:** Memory graph, Instruments leaks, look for VC cycles / closures.  
**Testing:** Tools.

### I51. Main Thread Checker finding — what next?
**Expected:** Hop to MainActor; find the off-main UIKit call.  
**Testing:** Threads.

### I52. `Sendable` on a class ViewModel?
**Expected:** Prefer `@MainActor` isolation rather than `@unchecked Sendable`.  
**Testing:** Swift 6.

### I53. `Task.detached` when?
**Expected:** Rare; don’t inherit actor. CPU work without UI context.  
**Testing:** Unstructured.

### I54. `withCheckedContinuation` rules?
**Expected:** Resume exactly once; bridging callbacks.  
**Testing:** Interop.

### I55. EquatableView skip body — danger?
**Expected:** Wrong `==` skips needed UI updates.  
**Testing:** Rendering.

### I56. `ForEach(items.indices)` bug?
**Expected:** Indices reuse; row state attaches to the wrong item.  
**Testing:** Identity.

### I57. Optimistic like + failure?
**Expected:** Update UI, rollback on error, keep ID stable.  
**Testing:** UX + sync.

### I58. Offline queue for POST?
**Expected:** Idempotency key; don’t double-charge.  
**Testing:** Systems.

### I59. ATS exceptions?
**Expected:** Per domain, not global disable.  
**Testing:** Security.

### I60. JWT in UserDefaults?
**Expected:** No — Keychain.  
**Testing:** Security.

### I61. Biometrics actually protecting what?
**Expected:** Unlock a Keychain item, not a boolean `if faceOK`.  
**Testing:** Security.

### I62. `scenePhase` background — persist?
**Expected:** Save drafts; `willTerminate` may not run.  
**Testing:** Lifecycle.

### I63. Background `URLSession` when?
**Expected:** Uploads/downloads that must continue after suspension.  
**Testing:** Background.

### I64. `BGTaskScheduler` vs hoping?
**Expected:** System budgets; not guaranteed timing.  
**Testing:** Background.

### I65. Snapshot tests flake why?
**Expected:** OS version, Dynamic Type, animations, async content.  
**Testing:** UI testing.

### I66. UI tests vs unit tests allocation?
**Expected:** Few UI, many unit.  
**Testing:** Strategy.

### I67. `switchToLatest` use case?
**Expected:** Latest search wins; cancel previous publisher.  
**Testing:** Combine.

### I68. `eraseToAnyPublisher` cost?
**Expected:** Type hide + extra box; use at API boundary.  
**Testing:** Combine.

### I69. SwiftUI animation of identity change vs value change?
**Expected:** Identity insert/remove uses transitions; value uses implicit animations.  
**Testing:** Animation.

### I70. `matchedGeometryEffect` requirements?
**Expected:** Shared namespace, matching ids, both in hierarchy during transition.  
**Testing:** Animation.

### I71. Environment custom key steps?
**Expected:** `EnvironmentKey` default + `EnvironmentValues` extension.  
**Testing:** SwiftUI DI.

### I72. Why ViewModel should avoid importing SwiftUI?
**Expected:** Faster tests, clearer boundary; not dogma if `@Observable` UI-only.  
**Testing:** Boundaries.

### I73. Feature modularisation first cut?
**Expected:** By feature with public interface, not random files.  
**Testing:** Scale.

### I74. Logging PII?
**Expected:** Never tokens, emails if policy forbids, health data.  
**Testing:** Privacy.

### I75. How do you design `Result` vs `throws` in API client?
**Expected:** `async throws` at the edge; `Result` if storing outcomes.  
**Testing:** Errors.

### I76. `nonisolated` on an actor method — when?
**Expected:** Pure/immutable data that doesn’t touch isolated state.  
**Testing:** Actors.

### I77. Image downsample why?
**Expected:** Memory: decode to display size.  
**Testing:** Images.

### I78. `NSCache` vs `Dictionary`?
**Expected:** `NSCache` evicts under pressure.  
**Testing:** Memory.

---

## Advanced questions (4+ years)

Seventy-five. These test internals, isolation, systems, and judgment.

### A1. Explain SwiftUI invalidation from Observation tracking.
**Expected:** Reads during `body` subscribe; writes to those fields invalidate.  
**Wrong:** Any property change on the object refreshes every view.  
**Follow-up:** How do you observe outside SwiftUI on iOS 26? (`Observations`)  
**Testing:** Observation internals.

### A2. Why is `any View` harmful in a hot `body`?
**Expected:** Existential erases type, hurts specialisation and identity.  
**Testing:** Performance.

### A3. View creation vs body vs render vs state lifetime.
**Expected:** Four different clocks; state keyed by identity.  
**Testing:** Conceptual mastery.

### A4. How does `ViewBuilder` encode `if/else`?
**Expected:** `_ConditionalContent` (or equivalent) — different branches, different identity.  
**Testing:** Result builders.

### A5. Property wrapper projected value (`$`) mechanism?
**Expected:** `projectedValue`; `@State` projects `Binding`. `_prop` is the wrapper.  
**Testing:** Language.

### A6. Swift 6 default MainActor isolation — implications?
**Expected:** UI modules main by default; mark concurrent work explicitly.  
**Testing:** Current Swift.

### A7. Sendable checking vs `@preconcurrency`.
**Expected:** Strict crossing of isolation; preconcurrency is a migration crutch.  
**Testing:** Concurrency migration.

### A8. Global actors besides MainActor?
**Expected:** Custom `@globalActor` for a serial domain (rare; justify).  
**Testing:** Isolation design.

### A9. Executor / custom actor executors?
**Expected:** Actors run on executors; custom for affinity (advanced).  
**Testing:** Runtime.

### A10. Why never lock across `await`?
**Expected:** Deadlock and priority inversion; actor hop instead.  
**Testing:** Concurrency safety.

### A11. Task-local values use case?
**Expected:** Trace IDs, request context without threading parameters everywhere.  
**Testing:** Structured concurrency.

### A12. `AsyncStream` backpressure?
**Expected:** Buffering policy; `onTermination`; don’t unbounded-yield from callbacks.  
**Testing:** Streams.

### A13. Bridging Combine to async — pitfalls?
**Expected:** Demand, cancellation, thread hops, `values` bridging.  
**Testing:** Interop.

### A14. COW and `mutating` through protocols?
**Expected:** Existentials and mutation can force copies; generics preserve.  
**Testing:** Performance + types.

### A15. `isKnownUniquelyReferenced` false sharing?
**Expected:** Extra refs (escaping closures) defeat COW uniqueness.  
**Testing:** Internals.

### A16. `@unchecked Sendable` ethics?
**Expected:** You take on the proof; document the lock; prefer actors.  
**Testing:** Honesty.

### A17. SwiftUI transaction and animation coalescing?
**Expected:** Mutations in one transaction animate together; `withTransaction`.  
**Testing:** Animation system.

### A18. Equatable + identity both failing — debug approach?
**Expected:** Instruments SwiftUI, print identity, simplify tree, check `.id`.  
**Testing:** Debug skill.

### A19. Why UICollectionView for video feeds still?
**Expected:** Cell reuse of `AVPlayerLayer`, control of prefetch, mature.  
**Testing:** Hybrid judgment.

### A20. Modularisation vs build graph cycles?
**Expected:** Dependency rule: features don’t import features; core kits at bottom.  
**Testing:** Large apps.

### A21. Binary size / dynamic linking of Swift packages?
**Expected:** Awareness of duplication of stdlib-inlined generics; not always a win.  
**Testing:** Staff-ish.

### A22. App launch: what belongs before first frame?
**Expected:** Minimal; defer analytics SDKs; measure TTI.  
**Testing:** Performance.

### A23. Jetsam vs leak?
**Expected:** High water mark vs unbounded growth from cycles.  
**Testing:** Memory diagnosis.

### A24. Autorelease pools in a parse loop?
**Expected:** Drain temporary ObjC objects.  
**Testing:** ObjC interop.

### A25. `NSManagedObjectContext` confinement?
**Expected:** `perform`; never touch off-queue.  
**Testing:** Core Data.

### A26. SwiftData ModelContext and background imports?
**Expected:** Background context/container patterns; don’t block UI.  
**Testing:** Persistence.

### A27. SQLite WAL and crash safety?
**Expected:** WAL helps concurrent read; still need transactions.  
**Testing:** Storage.

### A28. Certificate pinning rotation story?
**Expected:** Multiple pins, overlap window, remote kill, monitoring failures.  
**Testing:** Security ops.

### A29. Attestation / App Attest high level?
**Expected:** Device integrity signal to backend; not a secret in the IPA.  
**Testing:** Security.

### A30. Keychain accessibility + background fetch?
**Expected:** `AfterFirstUnlock` vs `WhenUnlocked`; background may lack UI unlock.  
**Testing:** Security + lifecycle.

### A31. Privacy manifests / tracking?
**Expected:** Declare APIs; ATT if tracking.  
**Testing:** Policy.

### A32. Designing an API client for 50 endpoints?
**Expected:** Typed requests, middleware (auth, logging, IDs), generated or endpoint enums.  
**Testing:** Architecture.

### A33. Idempotency keys for payments?
**Expected:** Client-generated UUID stored until success; server de-dupes.  
**Testing:** Systems.

### A34. Conflict resolution catalog?
**Expected:** LWW, server-wins, CRDT, manual. Pick with product.  
**Testing:** Sync.

### A35. Observability on iOS?
**Expected:** os.Logger, signposts, crash tools, sampling, no PII.  
**Testing:** Production.

### A36. Feature flags + kill switches?
**Expected:** Remote config with cache; default safe.  
**Testing:** Operations.

### A37. Gradual rollout / store review constraints?
**Expected:** Phased release; server-side flags beat binary flags.  
**Testing:** Product ops.

### A38. Testing actors deterministically?
**Expected:** Inject clock; don’t sleep; await APIs; serialise.  
**Testing:** Tests.

### A39. Snapshot vs pixel UI tests vs accessibility audit?
**Expected:** Different signals; snapshots for layout regressions.  
**Testing:** Quality strategy.

### A40. How to structure DI in a modular app?
**Expected:** Composition root per app target; modules export factories.  
**Testing:** DI at scale.

### A41. TCA vs Observation MVVM — choose for a team of 8?
**Expected:** Depends on fluency; default MVVM+Observation unless state machines dominate.  
**Testing:** Leadership.

### A42. When VIPER hurts SwiftUI?
**Expected:** Too many types per screen; navigation already data-driven.  
**Testing:** Fit.

### A43. Router as enum vs string URLs internally?
**Expected:** Typed routes; URLs at the boundary.  
**Testing:** Navigation design.

### A44. Multiple windows / scenes state?
**Expected:** Per-scene state vs process-global session.  
**Testing:** iPad.

### A45. Document-based apps vs sandbox files?
**Expected:** `DocumentGroup`, security-scoped resources.  
**Testing:** Platform.

### A46. Metal/CoreAnimation commit cost?
**Expected:** Offscreen passes, shadows, blurs, overdraw.  
**Testing:** Rendering.

### A47. Reduce motion / Dynamic Type as first-class layout?
**Expected:** Don’t clip; test XXL; alternative animations.  
**Testing:** A11y as senior quality.

### A48. Localisation plurals / string catalogs?
**Expected:** Stringsdict / String Catalog; don’t concatenate sentences.  
**Testing:** i18n.

### A49. Right-to-left layout bugs in custom `Layout`?
**Expected:** Use leading/trailing, layout direction environment.  
**Testing:** International.

### A50. How would you migrate ObservableObject → Observable in a large app?
**Expected:** Strangle: new screens first; bridge; don’t big-bang.  
**Testing:** Migration.

### A51. ABI stability vs language mode Swift 6?
**Expected:** Swift 6 is a language mode/checking; libraries may still be 5.  
**Testing:** Tooling.

### A52. `@frozen` enums across modules?
**Expected:** Library evolution; `@unknown default`.  
**Testing:** SDK design.

### A53. Inlinable and specialization across modules?
**Expected:** Performance vs library evolution trade-off.  
**Testing:** Framework author.

### A54. Existential `any P` opening in Swift 5.7+?
**Expected:** You can use `any` more, still limited with associated types.  
**Testing:** Evolution knowledge.

### A55. `consuming` / `borrowing` / noncopyable types (high level)?
**Expected:** Ownership for unique resources; know they exist in modern Swift.  
**Testing:** Language currency.

### A56. How to prevent duplicate in-flight GETs?
**Expected:** Actor map of Task handles, share the same Task.  
**Testing:** Networking.

### A57. HTTP/2 vs polling vs websocket vs APNs?
**Expected:** Choose by latency, battery, server cost, reliability.  
**Testing:** Realtime design.

### A58. Push as source of truth?
**Expected:** No — hint to refresh; local DB truth.  
**Testing:** Messaging systems.

### A59. Clock injection why?
**Expected:** Tests, expiry, animations; `Date.now` is a hidden dependency.  
**Testing:** Design.

### A60. File protection classes?
**Expected:** CompleteUnlessOpen vs CompleteUntilFirstUserAuthentication.  
**Testing:** Security.

### A61. Screenshot / screen recording of sensitive screens?
**Expected:** Overlay on resign active; `UITextField.isSecureTextEntry` tricks; DRM limited.  
**Testing:** Banking.

### A62. How to investigate “crash only in production”?
**Expected:** dSYMs, bitcode history, sanitizers off, compiler flags, specific data, threading, metric kit.  
**Testing:** Production debug.

### A63. Order of SwiftUI environment vs initializer injection?
**Expected:** Init for required; environment for ambient. Crash vs compile.  
**Testing:** API design.

### A64. `ViewThatFits` vs manual size classes?
**Expected:** Adaptive layout by fitting; still test size classes.  
**Testing:** Layout.

### A65. Custom `Layout` performance?
**Expected:** Cache; avoid O(n²) place; don’t allocate in tight loops.  
**Testing:** Layout internals.

### A66. Instruments Time Profiler inversion / missing symbols?
**Expected:** dSYM, release vs debug, sample vs time profiler.  
**Testing:** Tools mastery.

### A67. Energy: location vs networking vs CPU?
**Expected:** Attribute with Energy instruments; GPS is expensive.  
**Testing:** Battery.

### A68. How do you set error budgets for mobile?
**Expected:** Crash-free, hang rate, network fail %, login success.  
**Testing:** Staff.

### A69. Mentoring: how do you teach `@State`?
**Expected:** Identity + storage outside struct; live demo of reset with `.id`.  
**Testing:** Communication.

### A70. Saying no to a pattern?
**Expected:** Cost, team skill, problem fit, migration path.  
**Testing:** Judgment.

### A71. UIKit Observation on iOS 26?
**Expected:** Update methods track `@Observable` like SwiftUI.  
**Testing:** Current platform.

### A72. `Observations` transactional coalescing?
**Expected:** Multiple sync writes, one async value until suspend.  
**Testing:** Swift 6.2.

### A73. Preconcurrency imports of a vendor SDK — plan?
**Expected:** Isolate behind a Sendable facade; don’t spread `@preconcurrency`.  
**Testing:** Integration.

### A74. Designing a plugin architecture in Swift?
**Expected:** Protocols, existentials at the rim, stable route IDs, no shared mutable globals.  
**Testing:** Extensibility.

### A75. What separates senior from staff on iOS?
**Expected:** Staff changes the system (build, quality, architecture, people), not just a feature.  
**Testing:** Self-awareness.

### A76. How would you deprecate an internal module?
**Expected:** New API, dual-run, metrics, remove.  
**Testing:** Evolution.

### A77. Risk of `@MainActor` on a whole networking stack?
**Expected:** JSON decode and crypto on main; isolate UI, keep client nonisolated/actor.  
**Testing:** Isolation design.

### A78. When is “rewrite in SwiftUI” the wrong answer?
**Expected:** Stable UIKit performance-critical surfaces; rewrite risk.  
**Testing:** Pragmatism.

---
