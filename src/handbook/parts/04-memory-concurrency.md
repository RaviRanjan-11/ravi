# Memory Management

```text
Experience: 0–2 (ARC, strong/weak)
Experience: 2–4 (cycles, delegates, closures, Combine)
Experience: 4+ (unowned pitfalls, tasks, autorelease, SwiftUI lifetime)
Category: Swift
Difficulty: Intermediate
Importance: Critical
```

## ARC — Automatic Reference Counting

### What it is

Every **class instance** (reference type) has a **strong reference count**. When the count hits **zero**, Swift runs `deinit` and frees the object.

The compiler inserts `retain` / `release` calls. This is **not** a tracing garbage collector. There is no pause-the-world collector. There is also **no cycle collector**. If A points to B and B points to A with strong references, both counts stay ≥ 1 forever.

Structs, enums, and tuples are not ARC-managed as objects (their contents might include class references).

### Why ARC exists

Objective-C moved from manual retain/release to ARC. Swift inherited it. It is deterministic and cache-friendly compared to many GC systems, and it interoperates with the ObjC runtime.

### Why we use it

You do not call `free`. You still **design ownership**. ARC automates counting, not architecture.

### What happens if we don't think about it

Retain cycles → memory grows until jetsam. Or `weak`/`unowned` mistakes → crashes.

### When ARC does not apply

Value types. `unowned`/`weak` only make sense for class instances (and some OS objects). You cannot `weak var x: Int`.

---

## Strong, weak, unowned

### Strong (default)

```swift
class Owner {
    var pet: Pet   // strong
}
```

Keeps the object alive. Default for a reason: most references are owning.

### Weak

```swift
weak var delegate: LoginDelegate?
```

- Does **not** increment the count
- Must be **optional** (`var`, because it can become `nil`)
- When the object deinits, the pointer is **zeroed** to `nil`

### Unowned

```swift
unowned let parent: Parent
```

- Does not increment the count
- **Non-optional**
- If you access it after the object died → **crash**
- Use only when the referred object is **guaranteed** to outlive this one (child view controller’s parent, nested object whose parent owns it strongly)

### Comparison

| | Strong | Weak | Unowned |
| --- | --- | --- | --- |
| Keeps alive | Yes | No | No |
| Zeroed | n/a | Yes | No |
| Optional | Either | Must | Usually not |
| Crash if dangling | n/a | No (nil) | Yes |
| Typical use | Ownership | Delegates, closures | Parent that must exist |

### What happens if we don't use `weak` on a delegate

If the delegator strongly owns the delegate and the delegate strongly owns the delegator → cycle. Even if the parent VC owns both, a child that strongly delegates back can still cycle depending on graph.

UIKit convention: `weak var delegate` because the **owner of the view controller** should keep it alive, not the table view.

### What happens if we use `unowned` when we should use `weak`

The screen pops, the object dies, a delayed closure runs, **crash**. If lifetime is uncertain, `weak`.

### Thread-safety

Zeroing weak references is runtime-supported. Do not assume that a `weak` load and a subsequent method call are atomic as a pair — the object can deinited between `guard let self` and a later await. After `await`, capture a new `self` or use a local.

```swift
Task { [weak self] in
    guard let self else { return }
    await load()
    self.render()  // self was strongly captured by guard let in a class;
                   // across await, still the same strong self in this scope
}
```

In Swift, `guard let self` in a class creates a strong reference for the rest of the scope. That is often what you want. If you needed to be able to deallocate during `await`, check `self` again after:

```swift
Task { [weak self] in
    await load()
    self?.render()
}
```

---

## Retain cycle example

```swift
class A {
    var b: B?
}

class B {
    var a: A?
}

var a: A? = A()
var b: B? = B()
a?.b = b
b?.a = a
a = nil
b = nil
// A and B still leak: cycle
```

```text
A ════ strong ════► B
▲                   ║
╚════ strong ═══════╝
```

**Fix:**

```swift
class B {
    weak var a: A?
}
```

```text
A ════ strong ════► B
▲                   ║
╚════ weak ═════════╝
```

When `a` is set to `nil`, A’s count can hit 0, A deinits, `b.a` zeros, B can deinit if nothing else holds it.

---

## Closures and cycles

```swift
class ProfileViewController: UIViewController {
    var name = "Ravi"
    var printer: (() -> Void)?

    func setup() {
        printer = {
            print(self.name)  // strong self
        }
    }
}
```

VC owns `printer`, `printer` owns VC. **Leak.** The VC will never `deinit`.

**Fix:**

```swift
printer = { [weak self] in
    guard let self else { return }
    print(self.name)
}
```

### `[unowned self]`

Only if `printer` cannot outlive `self`. Stored on `self` and never handed to a longer-lived system → `unowned` can be OK. Handed to `URLSession` or a singleton → `weak`.

---

## NotificationCenter, Timer, Combine, Tasks

### NotificationCenter

```swift
NotificationCenter.default.addObserver(forName: .userDidLogin, object: nil, queue: .main) { [weak self] _ in
    self?.refresh()
}
```

Block-based observers **must** be removed or use the token. Selector-based observers are removed in `deinit` automatically for `addObserver(_:selector:name:object:)` on iOS versions you actually ship — still know the history: **not removing observers used to crash**. Today, leaking the *block observer object* is the usual bug.

Prefer `NotificationCenter.default.publisher(for:)` with `store` in a `Set<AnyCancellable>` that dies with the owner, or Swift `NotificationCenter.Observations` patterns on new OS, or avoid notifications entirely (use callbacks, Combine, async streams).

### Timer

```swift
Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
    self?.tick()
}
```

`Timer` strongly retains its target in older APIs (`scheduledTimer(timeInterval:target:selector:userInfo:repeats:)`). **That is a cycle if target also retains the timer.** Use block API + weak, or `Timer.publish` in Combine, or a `Task` loop with `Task.sleep`.

Invalidate timers when the screen leaves.

### Combine

```swift
cancellable = publisher.sink { [weak self] value in
    self?.handle(value)
}
```

`AnyCancellable` stored on `self` plus strong `self` in sink → cycle. Weak capture, or `sink` storing on a separate owner.

### Tasks

```swift
class Model {
    var task: Task<Void, Never>?
    func start() {
        task = Task { [weak self] in
            await self?.work()
        }
    }
    deinit { task?.cancel() }
}
```

A `Task` that strongly captures `self` and is stored on `self` can cycle. Cancel in `deinit` or use unstructured task without storing if SwiftUI `.task` owns it (structured to the view lifetime — preferred).

---

## SwiftUI and ARC

View structs are values. **State objects** are classes. A `@StateObject` (legacy) or `@Observable` class is kept by SwiftUI’s storage. Closures in `Button` that capture an `@Observable` model should not create cycles if the view does not store the closure on the model. The dangerous pattern is a model that stores a closure that captures the model.

---

## Instruments

Leaks instrument, Allocations, Memory Graph Debugger. Look for abandoned `ViewController` graphs. **Senior:** distinguish leaks (cycles / abandoned) vs high memory (caches, images, no leak but growth).

---

## Common mistakes

```text
❌ weak on a value type
✅ only classes

❌ unowned because you hate optionals
✅ weak if the other object can die first

❌ ignoring Timer/target retain
✅ block timer + weak, invalidate

❌ NotificationCenter block observer never removed
✅ token stored, removed in deinit, or structured concurrency
```

## One-minute explanation

“ARC counts strong references to class instances. When two objects own each other strongly, they never hit zero. I break cycles with `weak` for uncertain lifetimes and `unowned` only when the other object truly outlives me. Closures default to strong capture, so stored escaping closures almost always use `[weak self]`.”

---

# Advanced Swift

```text
Experience: 2–4 / 4+
Category: Swift
Difficulty: Advanced
Importance: High
```

## Key paths

```swift
let name = \User.name
users.map(\.name)
```

Used by SwiftUI, Combine `assign(to:on:)`, SwiftData. Key paths are typed.

## Result builders (`@ViewBuilder`)

```swift
@ViewBuilder var body: some View {
    if loggedIn {
        HomeView()
    } else {
        LoginView()
    }
}
```

The builder turns a DSL of statements into a single generic type (`_ConditionalContent`, `TupleView`, …). This is why `if` in `body` is legal and still returns `some View`.

## Property wrappers (language feature)

```swift
@propertyWrapper
struct Clamped {
    private var value: Int
    var wrappedValue: Int {
        get { value }
        set { value = min(max(newValue, 0), 100) }
    }
    init(wrappedValue: Int) { value = min(max(wrappedValue, 0), 100) }
}
```

`@State` is a property wrapper: it intercepts `get`/`set` and redirects storage to SwiftUI. `$` is `projectedValue` (for `@State`, a `Binding`).

```text
@State private var count = 0
count   → wrappedValue (Int)
$count  → projectedValue (Binding<Int>)
_count  → the wrapper itself (State<Int>)
```

## `dynamicMemberLookup` / `@dynamicCallable`

Rare in app code. Appear in DSLs. Know they exist; do not overuse.

## Copy-on-write implementation sketch

```swift
final class Storage {
    var items: [Int]
    init(_ items: [Int]) { self.items = items }
}

struct List {
    private var storage: Storage
    mutating func append(_ x: Int) {
        if !isKnownUniquelyReferenced(&storage) {
            storage = Storage(storage.items)
        }
        storage.items.append(x)
    }
}
```

`isKnownUniquelyReferenced` is the COW test. **4+ interview.**

## Equatable, Hashable, Comparable

Synthesised for structs of Equatable fields. Custom `==` must agree with `hash(into:)`. SwiftUI identity sometimes uses `Equatable` views to skip `body`.

## Pattern: `Sendable` structs

Make models immutable structs. Concurrency becomes easy.

## `@frozen`, `@inlinable`, library evolution

4+ / framework authors. Frozen enums can be switched without `@unknown default` inside the same resilience domain.

## Unsafe pointers

`UnsafeRawPointer`, `withUnsafeBytes`. Know they exist for C interop. Do not use them in interview whiteboard unless asked. One sentence: “I stay in safe Swift unless I’m talking to C or doing measured extra-performance work.”

---

# Swift Concurrency

```text
Experience: 0–2 (async/await syntax, call a throwing async function)
Experience: 2–4 (Task, cancellation, MainActor, structured vs unstructured)
Experience: 4+ (actors, isolation, Sendable, executor, Swift 6, defaultIsolation)
Category: Concurrency
Difficulty: Advanced
Importance: Critical
```

**Correct this misconception in every interview:**

> `async` does **not** mean “run on a background thread.”

`async` means “this function may **suspend**.” Suspension is a cooperative pause so the thread can do other work. Where the function **resumes** depends on **actor isolation** and the **executor**, not on the word `async`.

---

## `async` / `await`

```swift
func fetchUser() async throws -> User {
    let (data, _) = try await URLSession.shared.data(from: url)
    return try JSONDecoder().decode(User.self, from: data)
}

let user = try await fetchUser()
```

### Syntax breakdown

```text
async    → may suspend
throws   → may throw
await    → suspension point; yields if the callee suspends
try      → handle throw
```

### Line by line: the classic Task

```swift
Task {
    let result = await fetchData()
}
```

```text
Task { }     → create a new top-level task (unstructured work)
               inherits the current actor context when possible
               (e.g. from MainActor code, the task is MainActor-isolated
               unless you use Task.detached or a nonisolated context)

let result = await fetchData()
               → call fetchData; if it suspends, this task pauses
               → the thread is NOT blocked like a semaphore wait
               → when fetchData is ready, the task is scheduled again
               → resume executor depends on fetchData's isolation
```

### What happens when the task starts

The task is **scheduled**. It may run immediately or later. Creating a `Task` is **not** `pthread_create`. Threads are a pool owned by the runtime (and GCD underneath on Apple).

### Which thread executes it?

- If the task is `@MainActor` / created in a MainActor context: **main actor executor** (the main thread for UI).
- If `fetchData` is `nonisolated` async and hops to `URLSession`: the resume after `await URLSession...` is typically on a **cooperative thread-pool** executor, not the main thread.
- Then if you update UI, you must get back to the main actor.

### Does `Task` create a thread?

**No.** It creates a **task**, a piece of work the cooperative scheduler can run. Thousands of tasks can map to a handful of threads.

### What `await` actually means

“This task may suspend here. The current thread is free to run other tasks. I will continue later from this point with my local state preserved.”

It is **not** “jump to background.” It is **not** `DispatchQueue.global().sync`.

### How suspension works (mental model)

```text
Task running  → hits await  → task state stored  → thread picks another task
                     ▲
                     └── when the child work completes, task is enqueued on an executor
```

The stack is not like a blocking call that holds a kernel thread for the whole network round trip.

### What happens if we don't `await`

```swift
let task = fetchData()  // async function: you get a call that must be awaited
```

You cannot ignore it. You must `await` or wrap in `Task`. Forgetting `await` is a compile error.

### When not to use async

CPU-only tight loops with no I/O do not need `async`. Making them `async` does not make them concurrent. Use `Task.detached` or a custom executor / `nonisolated` + `dispatch` for CPU work, or `withCheckedContinuation` only when bridging.

---

## Structured vs unstructured concurrency

**Structured:** child tasks are bound to a parent scope. When the scope exits, children are cancelled and awaited (e.g. `async let`, `withTaskGroup`). Errors and cancellation propagate.

**Unstructured:** `Task { }` and `Task.detached`. The work has its own lifetime. You must cancel it yourself if the UI goes away.

```text
Structured (preferred)
    withTaskGroup / async let
         │
         ├── child
         └── child   all finish or cancel with parent

Unstructured
    Task { }  lives until it finishes or you cancel the handle
```

SwiftUI `.task { }` is **structured to the view’s appearance lifetime** (cancelled when the view is removed). Prefer it over `onAppear { Task { } }`.

---

## `Task`, `Task.detached`, priority

```swift
let handle = Task(priority: .userInitiated) {
    try await fetchUser()
}
handle.cancel()
let user = try await handle.value
```

`Task.detached` does **not** inherit actor, task-local values, or priority the same way. Use it rarely (e.g. truly independent background). Prefer `Task {}` or task groups.

**Priority** is a hint, not a real-time guarantee.

---

## `async let`

```swift
async let user = fetchUser()
async let feed = fetchFeed()
let (u, f) = try await (user, feed)
```

Starts both; awaits both. Structured. If you return early, pending `async let` work is cancelled.

vs TaskGroup: `async let` is a fixed number of children. TaskGroup is dynamic.

---

## TaskGroup

```swift
await withTaskGroup(of: Data.self) { group in
    for url in urls {
        group.addTask { try await download(url) }
    }
    for await data in group {
        store(data)
    }
}
```

`withThrowingTaskGroup` if children throw. Limit concurrency yourself if you spawn 10,000 tasks (use a pool pattern or `DiscardingTaskGroup` carefully).

**Interview:** “How do you fetch N endpoints concurrently?” `async let` for 2–3, `TaskGroup` for N.

---

## Cancellation

Cancellation is **cooperative**.

```swift
try Task.checkCancellation()
if Task.isCancelled { return }
```

`URLSession` async APIs honour cancellation. Your loops must check. `Task.sleep` throws `CancellationError`.

```swift
.task {
    let data = try await loader.load()
    items = decode(data)
}
```

Leaving the screen cancels the task. `load` should stop. If you used `onAppear { Task { ... } }` without storing/cancelling, the request **continues** — a classic bug.

---

## Actors

```swift
actor BankAccount {
    private var balance: Int = 0
    func deposit(_ amount: Int) {
        balance += amount
    }
    func getBalance() -> Int { balance }
}
```

```swift
let account = BankAccount()
await account.deposit(10)
let b = await account.getBalance()
```

### Why actors exist

To serialise access to mutable state without locks you get wrong. Calls to actor methods from outside hop to the actor’s executor. Only one task runs actor-isolated mutable state at a time (reentrancy caveat below).

### Actor vs class

| | Actor | Class |
| --- | --- | --- |
| Isolation | Compiler-enforced | You must lock |
| Cross-await | `await` required | Direct |
| Inheritance | No | Yes |
| Reentrancy | Yes on `await` | N/A |

### Reentrancy (4+)

If an actor method `await`s, another task can enter the actor and mutate state. After `await`, **re-read** state. Do not assume local invariants held across suspension.

```swift
func transfer(to other: BankAccount, amount: Int) async {
    guard balance >= amount else { return }
    balance -= amount
    await other.deposit(amount)  // reentrancy window on `other` and possibly self patterns
}
```

Design actor methods to be safe after hops.

### `nonisolated`

```swift
actor ImageCache {
    nonisolated var id: UUID { UUID() }  // example: immutable-safe
}
```

Marks members that do not need actor isolation (must be safe). `nonisolated(unsafe)` is a sharp tool — interviewers may ask you to avoid it.

### `isolated` parameters

Advanced: pass an isolated actor instance to a function so the function runs on that actor.

---

## MainActor

```swift
@MainActor
func updateUI() {
    label.text = "done"
}

@MainActor
final class HomeViewModel {
    var title = ""
}
```

UIKit/SwiftUI UI is main-thread. `@MainActor` makes the compiler enforce it.

SwiftUI `View.body` is MainActor-isolated in modern SDKs.

### How MainActor works

It is a **global actor**. Isolated work is scheduled on the main executor (main thread / main run loop). `await` from a background task to a MainActor function **hops** to the main actor.

```swift
Task.detached {
    let data = await load()          // background pool
    await MainActor.run {
        self.text = data             // UI
    }
}
```

Prefer annotating the type `@MainActor` over scattering `MainActor.run`.

### Swift 6.2 `defaultIsolation`

Modules can default to `@MainActor`. CPU work opts out with `@concurrent` / `nonisolated` depending on toolchain. **Know the idea:** UI modules run on main by default; you explicitly mark concurrent work.

---

## Sendable

```text
Experience: 4+
Importance: Critical
```

`Sendable` means safe to pass across concurrency domains (no unsynchronised shared mutation).

- Structs of Sendable fields: synthesised
- Actors: Sendable
- Classes: must be `final`, immutable, or otherwise proven; often `@unchecked Sendable` in legacy wrappers (dangerous)

Swift 6 **Sendable checking** is a compiler mode. Crossing isolation with a non-Sendable class is an error.

`@preconcurrency` imports a module with weaker checking — migration aid, not a design goal.

---

## AsyncSequence, AsyncStream

```swift
for await byte in url.bytes { }

let stream = AsyncStream<Int> { continuation in
    continuation.yield(1)
    continuation.finish()
}
```

`AsyncThrowingStream` for errors. Use for websockets, location updates, Observation’s `Observations { }` (iOS 26 / Swift 6.2).

Cancellation: `onTermination` on the continuation. If the `for await` breaks, finish the stream.

---

## Bridging GCD and completion handlers

```swift
func legacy(completion: @escaping (Data) -> Void) { }

func modern() async -> Data {
    await withCheckedContinuation { cont in
        legacy { data in
            cont.resume(returning: data)
        }
    }
}
```

Resume **exactly once**. `withCheckedThrowingContinuation` for errors. Wrong resume count crashes in debug.

---

## Combine vs async/await

See Combine chapter. Short version: async/await for request/response and structured workflows; Combine or `AsyncSequence`/`Observations` for many-values-over-time. You can mix.

---

## Common concurrency mistakes

```text
❌ “async means background”
✅ async means may suspend; isolation decides the executor

❌ Task { } in onAppear without cancellation
✅ .task { } or store and cancel

❌ Updating @Published / UI off the main actor
✅ @MainActor view models

❌ 1000 unstructured Tasks in a loop
✅ TaskGroup with limited concurrency

❌ Assuming actor state unchanged after await
✅ re-read; actors are reentrant

❌ Task.detached for everything
✅ inherit context; detach rarely
```

## Interview questions

**Q: Does `await` block the thread?**  
**Expected:** It suspends the task, not like a blocking syscall that holds the thread for I/O. The worker can run other tasks.  
**Wrong:** “It blocks the background thread until the network returns.”  
**Follow-up:** “Then why can the main thread still freeze?” (You ran CPU work on MainActor, or used a blocking API.)

**Q: How do you cancel a request when leaving a SwiftUI screen?**  
**Expected:** `.task { }` cancellation, or `URLSession` task cancel, Task handle cancel.  
**Follow-up:** “What if the async function ignores cancellation?”

**Q: Actor vs lock?**  
**Expected:** Actors compose with async, compiler-checked. Locks are for synchronous critical sections, deadlock-prone with async (never hold a lock across await).

## One-minute explanation

“Swift concurrency is cooperative tasks on a pool, not one-thread-per-job. `await` suspends the task. `async` does not pick a thread. I isolate UI on `MainActor`, isolate mutable shared state on `actor`, pass `Sendable` values across those boundaries, and I prefer structured tasks so cancellation is automatic.”

---
