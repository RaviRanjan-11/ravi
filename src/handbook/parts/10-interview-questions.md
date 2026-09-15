# PART X — Interview Questions

Practice out loud for 60–90 seconds, then take the follow-up. Each answer below is what you should actually say: the rule, why it exists, a concrete example, and the trap.

---

## Beginner questions (0–2 years)

These test vocabulary, crashes you should not ship, and SwiftUI basics.

### B1. What is the difference between `let` and `var`?

`let` binds a name that cannot be reassigned. `var` can be reassigned, and for value types it is also what allows mutation of properties.

The trap is thinking `let` means “the object never changes.” For a **class**, `let user = User()` still lets you change `user.name` because the *reference* is constant. You cannot point `user` at a different instance. For a **struct**, changing a property is mutating `self`, so the binding must be `var`.

```swift
let maxRetries = 3          // cannot assign again
var attempt = 0
attempt += 1

let user = User()
user.name = "Ravi"          // OK if User is a class
// user = User()            // not OK
```

**Don’t say:** “`let` is faster” as the whole answer.  
**Follow-up:** Can you mutate a class stored in a `let`? Yes. A struct? No.  
**They are testing:** Binding vs object immutability.

### B2. Why does Swift have optionals?

To make “this value might be missing” part of the type, instead of sentinel values (`-1`, `""`) or Objective-C style crashing nil messages. `String?` is `Optional<String>`: `.some(value)` or `.none`.

The compiler forces you to unwrap before use, so a missing user id cannot silently become a crash later — unless you force-unwrap. That is the point: absence is explicit.

```swift
var token: String? = nil
if let token {
    headers["Authorization"] = "Bearer \(token)"
}
```

**Don’t say:** “Optionals are pointers.” They are an enum.  
**Follow-up:** Show `if let` vs `guard let`.  
**They are testing:** The safety model.

### B3. `if let` vs `guard let`?

`if let` unwraps only inside the `if` block. `guard let` unwraps for the **rest of the function** and must exit the scope (`return`, `throw`, `break`) if the value is nil. Use `guard` at the top of a function so the happy path stays unindented.

```swift
func load(id: String?) {
    guard let id else { return }
    // id is String from here on
}
```

`??` is better when you have a sensible default and do not need to branch.  
**Don’t say:** They are identical.  
**They are testing:** Control-flow taste.

### B4. What does `??` do?

Nil coalescing: if the optional is non-nil, use it; otherwise evaluate the right-hand side. The right-hand side is an `@autoclosure`, so it runs **only** when the left is nil — not always.

```swift
let name = user.nickname ?? user.fullName ?? "Guest"
```

**Don’t say:** It force-unwraps.  
**Follow-up:** Is the default always evaluated? No.

### B5. What is force unwrapping and when is it dangerous?

`value!` crashes if `value` is nil. Fine in a test, a playground, or immediately after you have already proven the value exists. Dangerous on network JSON, user input, and any production path you do not 100% control.

Implicitly unwrapped optionals (`String!`) are still optionals; they unwrap automatically and can still crash. Prefer `?` + `if let` / `guard let`.

**Don’t say:** “Never use `!`” with no nuance, or “it’s always fine.”  
**They are testing:** Crash awareness.

### B6. Struct vs class?

Structs have **value semantics**: assignment copies (often copy-on-write under the hood). Classes have **reference semantics**: several names can point at the same instance, and mutation is shared.

SwiftUI views are structs: cheap descriptions of UI, not long-lived objects. Shared identity (a network client, a database stack) is usually a class or actor.

**Don’t say:** “Structs live on the stack, classes on the heap” as a complete answer. The compiler chooses storage; semantics matter more.  
**Follow-up:** What is copy-on-write? Arrays/strings/dictionaries share a buffer until one copy mutates.

### B7. Why are SwiftUI views structs?

A view is a cheap value that *describes* UI. SwiftUI can recreate `body` often. Persistent data does **not** live in the struct’s stored properties the way you think — `@State` is stored by the framework, keyed by the view’s identity.

If the struct is recreated but identity is stable, `@State` survives. If you change identity (`.id(UUID())`), state resets.

**Don’t say:** “Because Apple likes structs.”

### B8. What is `@State`?

A **view-owned** source of truth. SwiftUI allocates storage outside the struct and wires it back for a given identity. Mark it `private` so other views do not write your storage; pass a `Binding` down instead. `$count` is that binding (`projectedValue`).

```swift
@State private var count = 0
Stepper("Count", value: $count)
```

**Don’t say:** “It stores state” with no ownership story.

### B9. What is `@Binding`?

A two-way connection to storage owned **elsewhere**. The child can read and write; it does not own the lifetime. Create one from `@State` with `$`, or from `@Bindable` / `Bindable` on an observable model.

**Don’t say:** It is a copy of `@State`.

### B10. What does `some View` mean?

An **opaque type**: the function returns one concrete view type, but callers cannot name it. That lets the compiler specialise and keep identity. `any View` is an existential — “some unknown view” — which is slower and weaker for SwiftUI `body`.

**Don’t say:** “It can be any view.” That is `any View`.  
**Follow-up:** Why not `any View` in `body`? Performance and identity.

### B11. Why does modifier order matter?

Each modifier **wraps** the previous view in a new view. `.padding().background(.red)` draws red including the padding. `.background(.red).padding()` draws red only on the original size, then empty padding around it.

`offset` moves drawing without changing layout; `padding` changes the size the parent sees.

**Don’t say:** “Order doesn’t matter.”

### B12. `VStack` vs `LazyVStack`?

`VStack` creates all children immediately. `LazyVStack` (inside a `ScrollView`) creates children as they approach the visible region. A feed of hundreds of rows in a plain `VStack` will hitch and use memory.

`List` is its own lazy container with platform styling. Prefer `List` for standard iOS lists; `LazyVStack` when you need custom scroll layout.

### B13. What is ARC?

Automatic Reference Counting for **class** instances. Each strong reference adds one; at zero the object deinitialises. Swift does not use a tracing garbage collector. Leaks still happen when counts never reach zero (cycles) or when you hold objects in global caches forever.

Value types are not ARC-managed the same way; they copy.

### B14. What is a retain cycle?

A and B each hold a **strong** reference to the other (or a longer ring). Counts stay ≥ 1 forever. Closures capture `self` strongly by default, so `self.completion = { self.foo() }` is a classic cycle if `self` also owns `completion`. Fix with `[weak self]` or `[unowned self]` when you can prove lifetime.

### B15. Why are delegates `weak`?

The child (table view, URLSession task) should not keep the parent (view controller) alive. If the delegate were strong, VC → view → delegate → VC. Delegates are usually `weak var delegate: FooDelegate?` because `weak` requires optional (the reference can zero out).

### B16. `weak` vs `unowned`?

`weak` is optional, becomes `nil` when the object dies. `unowned` is non-optional and **crashes** if you use it after the object is gone. For `URLSession` completions, prefer `[weak self]` — the screen may have popped.

### B17. What is a closure?

A function you can pass around. It can capture constants and variables from the enclosing scope. That capture is why closures cause retain cycles and why `@escaping` matters.

### B18. What is `@escaping`?

The closure is stored or called **after** the function returns (network callback, `DispatchQueue.async`). Non-escaping closures (default for many sync `map` callbacks) cannot outlive the call, so the compiler is stricter about captures. `@escaping` is about **lifetime**, not “runs on a background thread.”

### B19. Trailing closure syntax?

If the last argument is a closure, you may write it after the `)`:

```swift
UIView.animate(withDuration: 0.25) {
    view.alpha = 1
}
```

Multiple trailing closures (Swift 5.3+) label later closures: `Button("Save") { } onLongPress: { }`.

### B20. `map` vs `compactMap` vs `flatMap` (on sequences)?

- `map` — one output per input.  
- `compactMap` — transform to optional, drop nils.  
- `flatMap` — transform to a sequence and flatten one level.

On `Optional`, `flatMap` chains optionals without nesting. Don’t confuse sequence `flatMap` with optional `flatMap`.

### B21. What is `Codable`?

`typealias Codable = Encodable & Decodable`. Typically used with `JSONEncoder` / `JSONDecoder`. Map `user_id` → `userID` with `CodingKeys` or a key decoding strategy. Dates and numbers need explicit strategies or they fail at runtime.

### B22. How do you fetch JSON in modern Swift?

```swift
let (data, response) = try await URLSession.shared.data(for: request)
guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
    throw APIError.badStatus
}
return try JSONDecoder().decode(Model.self, from: data)
```

Know completion-handler `dataTask` too — many codebases still use it. Decode off the main actor if payloads are large; hop to `@MainActor` to publish UI state.

### B23. Why check `HTTPURLResponse.statusCode`?

`URLSession` can give you `Data` for a 404 or 500 **without throwing**. Throwing only covers transport failures. Treat 2xx as success; map 401 to refresh, 429 to backoff.

### B24. UserDefaults vs Keychain?

UserDefaults: small preferences, not secret, can be backed up, easy to read on a jailbroken device / backups. Keychain: tokens, passwords, with accessibility flags. **Refresh tokens go in Keychain**, never UserDefaults.

### B25. MVC vs MVVM in one minute?

Classic MVC on iOS: the view controller becomes the dumping ground (Massive View Controller). MVVM moves presentation logic and UI state into a testable model the view observes. In SwiftUI you do **not** need a VM for a static `AboutView`; you do when there is loading, validation, or shared rules.

### B26. UIViewController `viewDidLoad` vs `viewWillAppear`?

`viewDidLoad` — view hierarchy created, runs once (per load). Good for one-time setup. `viewWillAppear` — every time the screen is about to show (tab switch, pop back). Refresh data here, not only in `viewDidLoad`. Frames may still be zero in `viewDidLoad`; layout happens later (`viewDidLayoutSubviews`).

### B27. What is cell reuse?

`UITableView` / `UICollectionView` keep a small pool of cells. As you scroll, cells are recycled. In `prepareForReuse` (and when configuring) reset images, cancelled tasks, and highlighted state or you will see the wrong photo on the wrong row.

### B28. `frame` vs `bounds`?

`frame` is the view’s rectangle in the **superview’s** coordinates (origin + size). `bounds` is in the view’s **own** coordinates; origin is often `.zero` unless you scrolled or applied a bounds origin. Transforms can make frame and visual size diverge.

### B29. What is Auto Layout?

A constraint solver: you describe relationships, UIKit computes frames. When mixing with frames, `translatesAutoresizingMaskIntoConstraints` must be `false` for views you constrain yourself, or you get conflicting constraints.

### B30. What is `guard`?

An early-exit check. If the condition fails, you must leave the scope. Keeps the success path at the left margin. Works with booleans and unwraps (`guard let`, `guard case`).

### B31. Exhaustive `switch` — why?

Swift requires every enum case (unless you add `default`). When you add a case, the compiler shows every switch you forgot. Prefer handling new cases explicitly. `@unknown default` is for frozen-vs-unknown future cases from Apple SDKs.

### B32. What is an enum associated value?

Data that travels with a case: `enum LoadState { case idle; case loading; case loaded(User); case failed(Error) }`. Exclusive states beat three optionals (`user`, `error`, `isLoading`) that can be illegally combined.

### B33. Protocol vs superclass?

A protocol is a **contract** (methods/properties) with no stored properties in the protocol itself. Types can conform to many protocols; structs and enums can participate. A superclass shares implementation and stored state but you only get one. Prefer protocols when you need polymorphism without a class hierarchy.

### B34. What is `mutating`?

A method that assigns to `self` or to `self`’s properties on a **value type**. The caller must use `var`. Classes do not need `mutating` because mutation goes through the reference.

### B35. Stored vs computed property?

Stored: actual memory (`var name: String`). Computed: `get`/`set` code, no extra storage (unless the setter writes another property). `lazy var` is stored, initialised on first access (not thread-safe by default).

### B36. `static` vs `class` members?

Both are type-level. `class func` / `class var` on a class can be **overridden** in subclasses. `static` cannot. On structs and enums you only have `static`.

### B37. What is a tuple?

An anonymous grouping `(statusCode, data)`. Fine locally. For public API prefer a struct with named fields so you can add properties without breaking every call site.

### B38. Array vs Set vs Dictionary?

Array: ordered, duplicates allowed, `O(1)` random access. Set: unique `Hashable` values, unordered, fast membership. Dictionary: key-value, lookup returns optional. Dictionary subscript type is `Value?`.

### B39. Why is dictionary lookup optional?

The key might not exist. Returning a dummy value would hide bugs. Use `dict[key] ?? default` or `if let`.

### B40. What is type inference?

The compiler fills in a **static** type from context (`let x = 3` is `Int`). It is not dynamic typing; `x` cannot become a `String` later.

### B41. `String` indexing — why not `Int`?

Swift strings are Unicode. A “character” is a grapheme cluster of variable width. `String.Index` walks that; `s[0]` as Int would be wrong for emoji and flags. Use `s.startIndex` / `index(_:offsetBy:)`.

### B42. What is interpolation `"\(x)"`?

Inserts `x` into a string via `CustomStringConvertible` / interpolation APIs. Prefer formatters for money, dates, and localisation rather than raw interpolation in UI.

### B43. `for-in` vs `forEach`?

`for-in` allows `break`, `continue`, and `return` from the outer function. `forEach` is a closure: `return` only leaves that closure. Prefer `for-in` when you need control flow.

### B44. What is `defer`?

A block that runs when the current scope **exits** — return, throw, or falling off the end. Multiple `defer`s run in reverse order. Use for closing files, ending activities, unlocking (when not using `defer` with async locks).

### B45. `try` vs `try?` vs `try!`?

`try` — propagate with `throws`. `try?` — convert failure to `nil` (you lose the error). `try!` — crash on throw. Prefer `try` in app code; `try?` for truly optional work.

### B46. SwiftUI `Button` vs `onTapGesture` on `Text`?

`Button` is a control: VoiceOver, disabled state, keyboard/focus, hit targets. A gesture on `Text` is easy to miss for accessibility and highlight. Use `Button` for actions.

### B47. What is `NavigationStack`?

The modern push container. You drive it with a path of `Hashable` values (`NavigationPath` or `[Route]`). `NavigationLink(value:)` pushes. Do not start new features on deprecated `NavigationView`.

### B48. `sheet` vs `fullScreenCover`?

`sheet` — card-style modal, user can swipe to dismiss (by default). `fullScreenCover` — edge-to-edge, use for onboarding or flows that should not look like a card.

### B49. What is SF Symbol `Image(systemName:)`?

Vector symbols from Apple’s set. They scale with Dynamic Type and weight. Prefer them over random PNGs for system chrome.

### B50. Why `private` on `@State`?

The view owns that storage. Other views should receive a `Binding` or a callback, not write your `@State` directly. That keeps identity and updates predictable.

### B51. What does `async` mean?

The function may **suspend** at `await`. That is not the same as “runs in the background.” An `async` function on `@MainActor` still runs on the main actor between awaits. Blocking work (`sleep`, heavy JSON on main) still blocks.

### B52. What is `Task { }`?

Starts **unstructured** concurrent work. It does not create a dedicated thread. Store the task if you need `cancel()`. Prefer `.task { }` in SwiftUI so cancellation follows the view.

### B53. What is `Sendable` in one sentence?

A type that is safe to pass across concurrency domains (actors, tasks) without data races. At 0–2 years you only need: value types of Sendable fields are usually fine; UI classes are not something you casually send to a background actor.

### B54. How does SwiftUI preview work conceptually?

Xcode renders your view in isolation. Inject sample data (`User.preview`) so you do not need the network. `#Preview` is compile-time UI, not a substitute for tests.

### B55. What is `Identifiable`?

A stable `id` used by `ForEach` and `List` to know which row is which across updates. Using `indices` as ids breaks when the list mutates — row state sticks to the wrong item. Use a server id or UUID per model.

---

## Intermediate questions (2–4 years)

Ownership, lifetime, cancellation, and production judgment. Say the rule, then the failure mode you have seen.

### I1. `@StateObject` vs `@ObservedObject`?

`@StateObject` **owns** the `ObservableObject` — SwiftUI creates it once for this view identity. `@ObservedObject` **observes** an instance owned elsewhere. `@ObservedObject var vm = VM()` in `body`/property init is the classic bug: every struct recreation allocates a new VM and state resets. Observation replacement: `@State` + `@Observable` class, or `@Bindable`.

### I2. Why did `@ObservedObject var vm = VM()` reset state?

The view struct is a value. Recreating it runs the default initialiser again, so you get a new `VM()`. Ownership must live in `@StateObject` or in a parent that passes the same instance.

### I3. `@Environment` vs `@EnvironmentObject`?

`@Environment` — typed values (color scheme, your own `EnvironmentKey`). Missing keys use the default. `@EnvironmentObject` — an `ObservableObject` injected with `.environmentObject`. If it is missing, the app **crashes at runtime**. Prefer Observation + environment values in new code; still know this crash.

### I4. How does `@Observable` differ from `ObservableObject`?

`ObservableObject` broadcasts `objectWillChange` — typically the whole view that holds it refreshes. `@Observable` tracks **which properties** `body` read and invalidates on those writes. Bindings: `@Bindable var model` or `Bindable(model)`.

### I5. Who owns an `@Observable` model created in a view?

Store the instance in `@State` (`@State private var model = Model()`) so SwiftUI keeps the same object. A plain `let model = Model()` in `body` is a new instance every time.

### I6. Structural vs explicit identity?

Structural: position and type in the view tree (`if/else` two `HomeView()`s are two identities). Explicit: `.id(value)`. Same type in different branches can reset `@State`. Follow-up: `if cond { HomeView() } else { HomeView() }` — two identities.

### I7. What does `.id(UUID())` in `body` do?

Every `body` evaluation is a **new** identity. SwiftUI destroys and recreates the view, resetting `@State`, cancelling `.task`, replaying animations. Never generate random ids in `body`.

### I8. Why can `body` run many times?

Parent invalidation, environment changes, observed property writes, transactions. `body` must be cheap: no disk, no network, no heavy formatting in a loop. Put work in `.task`, view models, or caches.

### I9. `.task` vs `onAppear { Task { } }`?

`.task` is tied to the view’s appearance in the hierarchy and **cancels** when the view goes away. `onAppear { Task { } }` starts unstructured work you must cancel yourself — easy to leak requests after pop.

### I10. How do you cancel network on pop?

Prefer `await URLSession` inside `.task`. Cancellation propagates to `URLSession`. If you use unstructured `Task`, store it and `cancel()` in `onDisappear`. Old style: `URLSessionTask.cancel()`.

### I11. Does `await` block the thread?

No. The **task** suspends; that thread can run other work. `Thread.sleep`, heavy CPU, or a synchronous file read **does** block. Don’t confuse cooperative await with stopping the main thread.

### I12. Structured vs unstructured concurrency?

Structured: child tasks (task group, `async let`) end when the scope ends; cancellation flows down. Unstructured: `Task { }` lives until it finishes or you cancel it. SwiftUI `.task` is structured to the view.

### I13. `async let` vs `TaskGroup`?

`async let` — fixed number of siblings you know at compile time. `TaskGroup` — dynamic count (N image downloads). Don’t start an unbounded group without a limit.

### I14. How does cooperative cancellation work?

Cancellation sets a flag. `URLSession` async APIs throw `CancellationError`. Your `for` loops must `try Task.checkCancellation()` or they keep running. There is no preemptive kill of CPU work.

### I15. `@MainActor` why?

UIKit/SwiftUI state must be used on the main actor. The compiler hops you there. `async` on `@MainActor` still runs on main between awaits — don’t decode 10 MB JSON there. Follow-up: yes, async can still be on main.

### I16. Actor vs lock?

An actor serialises access and composes with `await`. A lock is blocking and **must not** be held across `await` (deadlock / priority inversion). Prefer actors for shared mutable app state.

### I17. Actor reentrancy?

After `await` inside an actor method, another task may have run on the same actor and changed state. Re-read properties after the await; don’t assume `self.count` is still 0.

### I18. Copy-on-write?

`Array`/`String`/`Dictionary` share a buffer until mutation. Unique reference → mutate in place. Extra references (including escaping closures) force a copy. `isKnownUniquelyReferenced` is the check.

### I19. Protocol extension dispatch trap?

Methods that are **not** protocol requirements, implemented only in an extension, dispatch **statically** (the compile-time type). Requirements dispatch dynamically. Putting `draw()` only in an extension means `let p: Shape = Circle()` may not call `Circle`’s version.

### I20. `some` vs `any`?

`some P` — one concrete type, hidden. `any P` — existential box, mixed arrays. SwiftUI `body` wants `some View`. Use `any` at the rim when you must store heterogeneous values.

### I21. Associated types — why generics often beat `any P`?

`any Collection` hides `Element`. You cannot easily return `Element` without more boxing. Generics (`func f<C: Collection>(_: C)`) keep `C.Element` in the type system. PATs (protocols with associated types) are painful as existentials.

### I22. Type erasure — when?

When you must name a type or store mixed implementations: `AnyView`, `AnyPublisher`, `AnyIterator`. Cost is a box and lost specialisation. Use at API boundaries, not in a hot `body`.

### I23. How do you test a ViewModel?

Inject a fake API. Call `await vm.submit()`. Assert `vm.state` and that the fake saw the right request. Don’t load SwiftUI in unit tests if you can avoid it.

### I24. Mock vs fake?

Mock: verifies calls (`expect fetch once`). Fake: working in-memory stand-in (in-memory repo). Fakes are usually easier to maintain for iOS VMs.

### I25. How do you stub `URLSession`?

Custom `URLProtocol` registered on a `URLSessionConfiguration`, or wrap session in a protocol (`HTTPClient`) and inject a fake. Don’t hit the network in unit tests.

### I26. Combine `debounce` vs `throttle`?

Debounce: emit after the user **stops** typing for N ms. Throttle: emit at most once per interval (first or latest depending on API). Search boxes want debounce.

### I27. `PassthroughSubject` vs `CurrentValueSubject`?

Passthrough: no initial value; new subscribers get future events only. CurrentValue: always has a current value; new subscribers get it immediately. UI state usually wants current value.

### I28. Why `[weak self]` in `sink`?

You store `AnyCancellable` on `self`. The subscription holds the closure. A strong `self` in the closure is a cycle. Use `[weak self]` and `guard let self`.

### I29. NavigationPath restoration?

Make routes `Codable`. Persist the stack (`SceneStorage`, file). On launch, decode into `NavigationStack(path:)`. Typed `[Route]` is easier than untyped `NavigationPath` for restoration.

### I30. Deep linking strategy?

Parse URL → app `Route` → select the right tab → set the navigation stack. One router, not `openURL` scattered in views. Ignore malformed URLs safely.

### I31. Pagination + duplicates?

Cursor/page token from the server. Merge with a `Set` of ids. List identity is the item id, not the row index. Duplicates happen on refresh + overlapping pages.

### I32. Token refresh storms?

Ten 401s should trigger **one** refresh. An actor (or serial queue) runs refresh once; other callers await the same `Task`. Then retry originals. Without this you log the user out or stampede the auth server.

### I33. Retry policy?

Retry idempotent GETs with exponential backoff and a cap. Honour `Retry-After`. Do not blindly retry POST payments. Distinguish 429 vs 500 vs offline.

### I34. `URLCache` vs your own disk cache?

`URLCache` follows HTTP cache headers. Your disk cache is for images, offline documents, or when the API sends `no-store`. Don’t double-cache blindly.

### I35. Core Data object across queues?

`NSManagedObject` is confined to its context. Pass `objectID`, then `context.object(with:)` on the destination queue. Touching an object off-queue is a crash.

### I36. SwiftData vs Core Data — when stay?

Stay on Core Data for complex migrations, existing stacks, mature tooling, and heavy concurrency patterns you already trust. SwiftData is fine for new, simpler models.

### I37. `lazy var` thread safety?

First access is not atomic. Two threads initialising the same `lazy var` is undefined. Use `let` + init, an actor, or `OSAllocatedUnfairLock` for lazy shared state.

### I38. `NotificationCenter` block observer leak?

Block-based observers must be removed or you leak. Store the token and remove in `deinit`, or use Combine/`NotificationCenter.default.publisher` with a lifecycle. Selector observers on `self` also need unregistration historically.

### I39. Timer retain cycle?

`Timer.scheduledTimer(timeInterval:target:selector:)` **retains the target**. Invalidate in `deinit`/`onDisappear`. Block-based timers can capture `self` strongly — use weak.

### I40. SwiftUI list slow — first three checks?

(1) Full-resolution images decoded on the main thread. (2) Unstable identity (`id: \.self` on a changing value). (3) Heavy work in `body` or a non-lazy `VStack` of thousands of rows.

### I41. GeometryReader layout explosion?

`GeometryReader` expands to take **all space offered**, which can blow up stacks and cause recursive layout. Prefer `containerRelativeFrame`, `visualEffect`, or `onGeometryChange` on modern OS versions. If you must use it, constrain it.

### I42. Preference keys extra passes?

Preferences send values **up** the tree and can trigger extra layout passes. If a preference writes `@State` that changes layout that writes the preference again, you loop. Keep the data small and stable.

### I43. `UIViewRepresentable` `updateUIView` rules?

`makeUIView` creates once. `updateUIView` must be **idempotent** — set properties from SwiftUI state, do not recreate the UIView. Use a `Coordinator` for delegates/targets. Don’t capture SwiftUI views strongly in the coordinator.

### I44. Child view controller containment steps?

`addChild`, `view.addSubview`, `didMove(toParent:)`. Removal: `willMove(toParent: nil)`, remove view, `removeFromParent()`. Skipping this breaks appearance callbacks and safe area.

### I45. Diffable data source why?

You apply a **snapshot** of identified items. UIKit diffs and animates. Fewer “inconsistent state” crashes than `reloadData` + manual inserts. Identity must be stable.

### I46. Coordinator vs NavigationLink everywhere?

Leaf views that each push create an untestable graph. A coordinator (or a single `NavigationStack` path owned high up) owns deep links, login gates, and “where am I.” NavigationLink is fine for simple trees.

### I47. Constructor injection vs service locator?

`init(api: API)` makes dependencies obvious and testable. A global `ServiceLocator.shared.api` hides them and makes tests order-dependent. Locators are a last resort.

### I48. When is TCA overkill?

A settings form with two toggles. A team that has never used reducers. A deadline next week. TCA shines for complex state machines and replay; it is not free.

### I49. Clean architecture mapping on iOS?

Entities/use cases in the middle (pure Swift). SwiftUI and URLSession at the edges. Dependencies point inward. Don’t invent six folders for a three-screen app.

### I50. How to investigate a leak?

Xcode memory graph: look for cycles (VC → closure → VC). Instruments Leaks + Allocations. Common: delegates not weak, timers, Combine sinks, SwiftUI sheet identity.

### I51. Main Thread Checker finding — what next?

A UIKit/AppKit call ran off main. Find the `await` that resumed on a background executor, then `await MainActor.run` or mark the UI method `@MainActor`. Don’t globally silence the checker.

### I52. `Sendable` on a class ViewModel?

Don’t slap `@unchecked Sendable` on a mutable class. Isolate it with `@MainActor` (UI VM) or turn shared mutable state into an actor. Unchecked is a promise you must prove.

### I53. `Task.detached` when?

When you must **not** inherit the current actor (heavy work that would otherwise stay on main). Rare. Prefer `Task { }` or a dedicated actor. Detached tasks skip task-local values too.

### I54. `withCheckedContinuation` rules?

Resume **exactly once**. Never resume twice (crash) or never (hang). Use checked in debug; unchecked only if you have proven it. Bridge callback APIs, then prefer native async.

### I55. EquatableView skip body — danger?

If `==` is wrong (ignores a field that affects UI), SwiftUI skips `body` and the screen is stale. Only use equality optimisation when you understand every input.

### I56. `ForEach(items.indices)` bug?

Indices are 0,1,2… When you delete item 0, the row that had id `1` becomes `0` and **keeps the wrong `@State`**. Use `ForEach(items)` with `Identifiable`.

### I57. Optimistic like + failure?

Flip liked in UI immediately, send the request, **roll back** on error. Keep the same item `id`. Don’t insert a duplicate row.

### I58. Offline queue for POST?

Persist the request with an **idempotency key**. Replay when online. The server must de-dupe or you double-charge. GET is easier to retry than POST.

### I59. ATS exceptions?

Never disable ATS globally. Add exceptions **per domain** with a documented reason (legacy printer, etc.). Prefer fixing TLS.

### I60. JWT in UserDefaults?

No. Backups, screenshots of defaults, and other apps on a jailbroken device can read it. Keychain with an appropriate accessibility class.

### I61. Biometrics actually protecting what?

Face ID should unlock a **Keychain item** (the token). A boolean `if faceOK { showBalance }` is bypassable. The secret never sits in UserDefaults after success.

### I62. `scenePhase` background — persist?

Save drafts on `.background`. `applicationWillTerminate` may **not** run (jetsam). Treat background as the last reliable chance.

### I63. Background `URLSession` when?

Uploads/downloads that must continue after the app suspends. Use a background configuration and a session delegate in the app delegate / scene. Regular `data(for:)` stops when you are suspended.

### I64. `BGTaskScheduler` vs hoping?

You schedule work; iOS runs it under **budget**. Not an alarm clock. Handle deferred execution and test with debug launches.

### I65. Snapshot tests flake why?

OS version, simulator locale, Dynamic Type, animations not disabled, async images not waited. Pin OS, freeze time, wait for existence, disable animations.

### I66. UI tests vs unit tests allocation?

Many fast unit tests for logic. A **few** UI tests for critical paths (login, purchase). UI tests are slow and flaky; don’t replace unit tests with them.

### I67. `switchToLatest` use case?

Each keystroke starts a search publisher. `map { search($0) }.switchToLatest()` cancels the previous inner publisher so only the latest query’s result wins.

### I68. `eraseToAnyPublisher` cost?

Hides the concrete publisher type (good at module boundaries) by boxing. Don’t erase in a tight inner pipeline if you can keep the generic type.

### I69. SwiftUI animation of identity change vs value change?

Changing a property on the same identity uses implicit/explicit **value** animations. Insert/remove of a different identity uses **transitions**. Mixing them is why “the wrong view animated.”

### I70. `matchedGeometryEffect` requirements?

Same `Namespace`, matching ids, both views in the hierarchy during the transition (often overlay). If one disappears first, the effect fails silently.

### I71. Environment custom key steps?

Define `struct MyKey: EnvironmentKey { static let defaultValue = ... }`, extend `EnvironmentValues`, then `.environment(\.myKey, value)` and `@Environment(\.myKey)`.

### I72. Why ViewModel should avoid importing SwiftUI?

Faster tests, no accidental `Color` in the domain, clearer boundary. Not dogma: a tiny `@Observable` UI helper can import SwiftUI. Don’t put `URLSession` in a `View`.

### I73. Feature modularisation first cut?

Modules by **feature** (`Home`, `Checkout`) with a small public API, not “all views” vs “all models.” Shared kits at the bottom. Features should not import each other.

### I74. Logging PII?

No access tokens, passwords, full emails if policy forbids, health identifiers. Use os.Logger categories and redaction. Logs leave the device via crash tools.

### I75. How do you design `Result` vs `throws` in API client?

`async throws` at the call site is idiomatic. Store `Result` when you need to hold success/failure in state without throwing through UI. Don’t mix both in every layer.

### I76. `nonisolated` on an actor method — when?

The method does not touch actor-isolated state (pure function on inputs). It can then be called without hop. Wrong use: reading `self.cache` from nonisolated.

### I77. Image downsample why?

Decoding a 12 MP photo into a 44 pt thumbnail wastes hundreds of MB. Decode/downsample to the display size (`ImageIO` thumbnail APIs).

### I78. `NSCache` vs `Dictionary`?

`NSCache` evicts under memory pressure and is thread-safer for this use. `Dictionary` grows until you die. Use NSCache for image memory caches.

---

## Advanced questions (4+ years)

Internals, isolation, systems, and judgment. Lead with the mechanism, then the production consequence.

### A1. Explain SwiftUI invalidation from Observation tracking.

During `body`, reads of `@Observable` properties register a dependency. A later write to **those** fields invalidates that view — not every property on the object. Views that never read `name` will not refresh when `name` changes. Outside SwiftUI on iOS 26, `Observations` lets you await coalesced changes.

**Don’t say:** Any property change refreshes every view.

### A2. Why is `any View` harmful in a hot `body`?

Existential `any View` boxes the concrete type, blocks specialisation, and weakens identity. Lists of mixed `any View` are a known hitch source. Keep `some View` in `body`; erase only at a boundary (`AnyView`) if you must.

### A3. View creation vs body vs render vs state lifetime.

Creating a `View` value is cheap and frequent. `body` is the dependency-tracked description. Render/layout is later. `@State` lives as long as **identity**, not as long as a particular struct instance. Mixing these clocks is how people “lose state.”

### A4. How does `ViewBuilder` encode `if/else`?

As `_ConditionalContent` (or equivalent): two different types, therefore two identities. `@State` does not carry across branches even if both look like `HomeView()`.

### A5. Property wrapper projected value (`$`) mechanism?

The wrapper is `_count`. `count` is `wrappedValue`. `$count` is `projectedValue`. For `@State`, projected value is `Binding`. That is why child views write parent storage without owning it.

### A6. Swift 6 default MainActor isolation — implications?

UI modules often default to main-actor isolation. Code that was “just a class” now needs explicit nonisolated/async hops for CPU work. You must mark concurrent work instead of assuming background.

### A7. Sendable checking vs `@preconcurrency`.

Sendable checking is the real data-race story. `@preconcurrency import` silences crossing into an old module — a migration crutch. Don’t spray it; wrap the vendor type in your own Sendable facade.

### A8. Global actors besides MainActor?

`@globalActor` gives a serial domain (e.g. database). Rare. Justify with a single resource that everything must hop to. Don’t create a global actor per feature.

### A9. Executor / custom actor executors?

Actors run on executors (threads/pools). Custom executors pin work (audio I/O). Default is enough for app code; this is a “I have measured contention” topic.

### A10. Why never lock across `await`?

While you `await`, another task may need the same lock → deadlock. Locks also don’t compose with priority. Use an actor and accept reentrancy, or copy data then await.

### A11. Task-local values use case?

`TaskLocal` for trace ids, request ids, test clocks — context that should flow with the task without threading 8 parameters. Don’t use them as hidden global mutable state.

### A12. `AsyncStream` backpressure?

Choose buffering (unbounded vs newest). Handle `onTermination` to cancel the producer. Yielding from a callback without a limit will OOM.

### A13. Bridging Combine to async — pitfalls?

Demand (push vs pull), cancellation not forwarded, thread hops (`receive(on:)`), and `publisher.values` bridging that can deadlock if you mix run loops. Prefer one world per pipeline.

### A14. COW and `mutating` through protocols?

Mutating an existential `any P` often copies because uniqueness is lost. Generics keep the concrete buffer. This shows up as mysterious array copies in hot loops.

### A15. `isKnownUniquelyReferenced` false sharing?

An extra strong ref — including a closure that captured the array — makes the buffer non-unique, so mutation copies. “We used COW so copies are free” is false if you share.

### A16. `@unchecked Sendable` ethics?

You are asserting thread safety to the compiler. Document the lock. Prefer actors. Unchecked on a random class is how Swift 6 “passes” and production races.

### A17. SwiftUI transaction and animation coalescing?

State writes in one transaction animate together. `withTransaction` / `withAnimation` control that. Splitting related writes across tasks makes animations fight.

### A18. Equatable + identity both failing — debug approach?

Instruments SwiftUI, log `id`, strip modifiers until it behaves, check accidental `.id(UUID())`. Don’t guess — identity bugs look like “random state.”

### A19. Why UICollectionView for video feeds still?

Cell reuse of `AVPlayerLayer`, precise prefetch, mature scrolling physics. SwiftUI `List` is catching up; video feeds are still a hybrid island for many teams.

### A20. Modularisation vs build graph cycles?

Features depend on core kits, not on each other. Cycles destroy incremental builds and force god modules. Draw the graph; break cycles with interfaces.

### A21. Binary size / dynamic linking of Swift packages?

Swift generics specialise and can duplicate code. Dynamic frameworks are not automatically smaller. Measure; don’t “modularise for size” without numbers.

### A22. App launch: what belongs before first frame?

Almost nothing. Defer analytics SDKs, fonts, and “nice to have” I/O. Measure time to interactive. First frame is a product metric, not a dump for `didFinishLaunching`.

### A23. Jetsam vs leak?

Jetsam: high water mark, system kills you (images, caches). Leak: unbounded growth over time from cycles. Different Instruments, different fixes.

### A24. Autorelease pools in a parse loop?

Tight loops creating ObjC objects (`NSString`, `UIImage`) can pile autoreleases until the next drain. Wrap the loop in `autoreleasepool { }` when bridging.

### A25. `NSManagedObjectContext` confinement?

Always `perform` / `performAndWait`. Never pass objects across queues. Pass `NSManagedObjectID`. This is still the #1 Core Data crash.

### A26. SwiftData ModelContext and background imports?

Do heavy imports on a background context/container, then merge. Blocking the main `ModelContext` freezes UI. Mirror Core Data’s two-context pattern.

### A27. SQLite WAL and crash safety?

WAL lets readers proceed during writes. You still need transactions for crash consistency. “WAL means we can’t corrupt” is false.

### A28. Certificate pinning rotation story?

Ship two pins, overlap during rotation, monitor failure rates, have a remote kill/unpin plan. Pinning without rotation is a self-DoS when the cert expires.

### A29. Attestation / App Attest high level?

A device integrity **signal** to your backend, not a secret baked into the IPA. Attackers still exist; treat it as one input to risk, not a DRM fantasy.

### A30. Keychain accessibility + background fetch?

`WhenUnlocked` is unavailable until the user unlocks. Background fetch may run before that — use `AfterFirstUnlock` if you must read tokens in background, and know the trade-off.

### A31. Privacy manifests / tracking?

Declare required reason APIs. If you track across apps/websites, ATT. Manifest mistakes fail App Store review. This is product + legal, not only code.

### A32. Designing an API client for 50 endpoints?

Typed request/response, shared middleware (auth, idempotency, logging), endpoint enum or generated client. Don’t copy-paste 50 `URLSession` calls.

### A33. Idempotency keys for payments?

Client generates a UUID, stores it until success, sends it on every retry. Server de-dupes. Without this, a timeout + retry double-charges.

### A34. Conflict resolution catalog?

Last-write-wins, server-wins, CRDT, or ask the user. Pick with the product (notes vs bank balance). There is no universal merge.

### A35. Observability on iOS?

`os.Logger`, signposts, crash reporters, sampled performance, **no PII**. You cannot SSH into a phone; logs and metrics are how you debug production.

### A36. Feature flags + kill switches?

Remote config with a cached last-known-good. Default **off** for risky features. A kill switch that requires a new binary is not a kill switch.

### A37. Gradual rollout / store review constraints?

Phased App Store release is slow. Server flags beat “ship a bool in the binary.” Review still sees the code paths — don’t hide policy violations behind flags.

### A38. Testing actors deterministically?

Inject a clock. Don’t `sleep`. `await` the API under test. Avoid extra unstructured tasks. Timeouts in tests are a smell.

### A39. Snapshot vs pixel UI tests vs accessibility audit?

Snapshots catch layout regressions. UI tests catch flows. Accessibility audits catch VoiceOver. They answer different questions; use a mix.

### A40. How to structure DI in a modular app?

Each app target has a composition root. Modules export factories/protocols, not singletons. Tests swap factories. Avoid `shared` in feature modules.

### A41. TCA vs Observation MVVM — choose for a team of 8?

Default MVVM + Observation unless you live in state machines and the team already knows TCA. Leadership is matching the tool to fluency and problem shape.

### A42. When VIPER hurts SwiftUI?

VIPER’s per-screen type explosion fights SwiftUI’s data-driven navigation. You pay ceremony without getting UIKit-era test seams you actually use.

### A43. Router as enum vs string URLs internally?

`enum Route: Hashable, Codable` internally. Parse URLs at the boundary into `Route`. Strings internally are typo magnets.

### A44. Multiple windows / scenes state?

Per-scene UI state (two documents, two stacks). Process-global: session, account. Mixing them makes iPad windows share a navigation stack by accident.

### A45. Document-based apps vs sandbox files?

`DocumentGroup` + security-scoped bookmarks for user files. App sandbox `Documents/` is not the same as a user-picked iCloud file.

### A46. Metal/CoreAnimation commit cost?

Offscreen passes, shadows, blurs, overlapping transparency. Profile GPU. “Just add blur” is a battery bug.

### A47. Reduce motion / Dynamic Type as first-class layout?

Don’t clip XXL type. Offer non-motion alternatives when `accessibilityReduceMotion` is on. Test the largest content size or you will ship broken screens.

### A48. Localisation plurals / string catalogs?

Use String Catalog / stringsdict for plurals. Never concatenate `"\(n) days"`. Word order changes by language.

### A49. Right-to-left layout bugs in custom `Layout`?

Honour `layoutDirection`. Use leading/trailing, not left/right. Custom `Layout` that hardcodes minX will break Arabic.

### A50. How would you migrate ObservableObject → Observable in a large app?

New screens first. Bridge (ObservableObject wrapping Observable or vice versa). No big-bang weekend rewrite.

### A51. ABI stability vs language mode Swift 6?

Swift 6 is a **language mode** (concurrency checking). The library ABI can still be Swift 5. You can mix. Don’t confuse “we compile in Swift 6” with “the OS Swift runtime changed.”

### A52. `@frozen` enums across modules?

Frozen enums can be switched without `@unknown default` for library evolution. Unfrozen public enums need `@unknown default` so new cases don’t explode clients.

### A53. Inlinable and specialization across modules?

`@inlinable` lets clients specialise your generics (speed) but freezes implementation in their binary (evolution pain). Use on tiny hot functions only.

### A54. Existential `any P` opening in Swift 5.7+?

You can use `any` more widely, but associated types still fight existentials. Opening existentials (`func f(p: any P) { g(p) }` with generic `g`) is the workaround.

### A55. `consuming` / `borrowing` / noncopyable types (high level)?

Ownership for unique resources (file handles, buffers) that must not be copied. You should know they exist in modern Swift even if you don’t use `~Copyable` daily.

### A56. How to prevent duplicate in-flight GETs?

Actor keyed by URL: if a `Task` exists, await it; else start one and store it. All callers share one network hop.

### A57. HTTP/2 vs polling vs websocket vs APNs?

Latency, battery, server cost, NAT timeouts, reliability. Chat might be websocket; badges are APNs; dashboards can poll. There is no single “realtime” API.

### A58. Push as source of truth?

No. Push is a **hint** to refresh. Local DB / server GET is truth. Missed notifications are normal.

### A59. Clock injection why?

`Date.now` is a hidden dependency. Tests freeze time; expiry and animations become deterministic. Inject `any Clock` / a protocol.

### A60. File protection classes?

`CompleteUntilFirstUserAuthentication` vs `CompleteUnlessOpen` etc. Background access fails if the class requires an unlocked device. Match class to when you read the file.

### A61. Screenshot / screen recording of sensitive screens?

On resign active, cover with an overlay. `isSecureTextEntry` can hide some capture. DRM is limited on iOS — banking UX, not Hollywood DRM.

### A62. How to investigate “crash only in production”?

dSYMs, MetricKit, threading, specific data, compiler optimisation, sanitizers off. Reproduce with release config. Bitcode is historical; symbols still matter.

### A63. Order of SwiftUI environment vs initializer injection?

Required dependencies: `init`. Ambient (theme, locale): environment. Missing environment objects crash at runtime; missing init args fail at compile time.

### A64. `ViewThatFits` vs manual size classes?

`ViewThatFits` picks the first child that fits. Still test compact/regular. Size classes describe device idiom; fitting describes actual space (Split View).

### A65. Custom `Layout` performance?

Cache sizes. Avoid O(n²) in `placeSubviews`. Don’t allocate in the tight loop. Profile with many children.

### A66. Instruments Time Profiler inversion / missing symbols?

Need dSYMs, matching build, understand sample vs time profiler. Missing symbols = you are staring at addresses. Always archive with symbols.

### A67. Energy: location vs networking vs CPU?

GPS is expensive. Networking in a loop is expensive. CPU spikes are often cheaper than high-accuracy location. Attribute with Energy instruments, don’t guess.

### A68. How do you set error budgets for mobile?

Crash-free sessions, hang rate, login success, checkout success, network fail %. Staff work is picking SLOs and reacting when you burn the budget.

### A69. Mentoring: how do you teach `@State`?

Identity + storage outside the struct. Live demo: add `.id(UUID())` and watch the stepper reset. Juniors remember the demo.

### A70. Saying no to a pattern?

Cost, team skill, problem fit, migration path, and what we give up. “Netflix uses it” is not an argument.

### A71. UIKit Observation on iOS 26?

UIKit update methods can track `@Observable` similarly to SwiftUI. Know it exists if you still have UIKit screens.

### A72. `Observations` transactional coalescing?

Multiple synchronous writes can coalesce into one observed value until the next suspend. Don’t assume one write = one callback.

### A73. Preconcurrency imports of a vendor SDK — plan?

Isolate behind your facade. One `@preconcurrency import` in an adapter module, not in every file. Track vendor updates to remove it.

### A74. Designing a plugin architecture in Swift?

Protocols at the rim, stable route IDs, no shared mutable globals, existentials only at the boundary. Plugins must not import app internals.

### A75. What separates senior from staff on iOS?

Senior ships hard features well. Staff changes the **system**: build, quality bar, architecture, other people’s throughput — not just another screen.

### A76. How would you deprecate an internal module?

New API, dual-run, metrics on remaining callers, then remove. Deprecation without a migration path is theatre.

### A77. Risk of `@MainActor` on a whole networking stack?

JSON decode, image decode, and crypto on main. Isolate UI; keep the client on a dedicated actor or nonisolated async. MainActor is not a networking strategy.

### A78. When is “rewrite in SwiftUI” the wrong answer?

A stable, performance-critical UIKit surface (camera, collection video). Rewrite risk, lost battle-tested bugs, and no user-facing win. Hybrid is allowed.

---

