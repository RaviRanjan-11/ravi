# Memory Management

You ship a screen, pop it, and Instruments still shows the view controller sitting in memory. The user opens that screen ten more times and the graph just climbs. That is almost never “Swift being slow.” It is almost always ownership: two objects still holding each other, or a closure that outlived the screen and kept `self` alive.

ARC is the mechanism. You still design the graph.

---

## ARC — Automatic Reference Counting

Every **class instance** carries a strong reference count. The compiler inserts `retain` and `release` around those references. When the count hits zero, Swift runs `deinit` and frees the object. There is no tracing garbage collector, no pause-the-world sweep, and — this is the part that bites people — **no cycle collector**. If A points to B and B points to A with strong references, both counts stay at least 1 forever. The process will not notice. Jetsam might, months later, when the user has twenty abandoned screens in RAM.

Structs, enums, and tuples are not ARC-managed as objects. Their *contents* might include class references, and those references still count. You cannot `weak var x: Int`. Weak and unowned only make sense for class instances (and a handful of OS objects that the runtime treats that way).

This model arrived from Objective-C. Manual retain/release was error-prone; ARC automated the counting and kept the deterministic, cache-friendly behaviour that interops with the ObjC runtime. What it did **not** automate is architecture. You still decide who owns whom. You do not call `free`. You *do* decide whether a delegate, a closure, a timer, or a task is allowed to keep an object alive.

If you never think about it, two things happen in production. Retain cycles: memory grows until the watchdog kills you. Or you reach for `unowned` because you hate optionals, the screen pops, a delayed closure runs, and you crash.

---

## Strong, weak, unowned

Most references should be strong. That is the default because most relationships really are ownership: a view controller owns its views, a model owns its loaded data, a session owns its decoder.

```swift
class Owner {
    var pet: Pet   // strong
}
```

A **weak** reference does not increment the count. It must be optional, and it must be `var`, because the runtime will zero it to `nil` when the object deinits.

```swift
weak var delegate: LoginDelegate?
```

That is why UIKit delegates are weak. The table view should not keep the view controller alive. The owner of the view controller — the navigation stack, the window, the parent — is what should keep it alive. If the table view held a strong delegate and the view controller held a strong table view, you have a cycle even when everything *looks* hierarchical.

**Unowned** also does not increment the count, but it is not optional and it is not zeroed. Access it after the object died and you crash.

```swift
unowned let parent: Parent
```

Use it only when the referred object is guaranteed to outlive this one: a nested helper whose parent owns it strongly, a child that cannot exist without that parent. If lifetime is uncertain — networking, timers, notifications, anything that might run after a pop — use `weak`.

| | Strong | Weak | Unowned |
| --- | --- | --- | --- |
| Keeps alive | Yes | No | No |
| Zeroed | n/a | Yes | No |
| Optional | Either | Must | Usually not |
| Crash if dangling | n/a | No (nil) | Yes |
| Typical use | Ownership | Delegates, closures | Parent that must exist |

Zeroing weak references is runtime-supported, but a `weak` load and a later method call are **not** an atomic pair. The object can deinit between `guard let self` and a later `await`. After a suspension, either capture a new look at `self` or keep a strong `self` on purpose.

```swift
Task { [weak self] in
    guard let self else { return }
    await load()
    self.render()  // self was strongly captured by guard let in a class;
                   // across await, still the same strong self in this scope
}
```

`guard let self` in a class creates a strong reference for the rest of the scope. That is often what you want: you decided this work should finish. If you needed the object to be able to deallocate *during* `await`, do not promote it:

```swift
Task { [weak self] in
    await load()
    self?.render()
}
```

---

## Retain cycle example

Two objects, each holding the other. Set both local variables to `nil`. Nothing deinits.

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

Break one side:

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

When `a` is set to `nil`, A’s count can hit 0, A deinits, `b.a` zeros, and B can deinit if nothing else holds it. That is the whole trick: the graph needs a non-owning edge somewhere.

---

## Closures and cycles

A view controller stores a closure. The closure mentions `self`. You have just drawn a cycle with one line.

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

The VC owns `printer`. `printer` owns the VC. `deinit` never runs. In Instruments this looks like an abandoned controller after you popped it.

```swift
printer = { [weak self] in
    guard let self else { return }
    print(self.name)
}
```

`[unowned self]` is fine only if `printer` cannot outlive `self`. Stored on `self` and never handed to a longer-lived system — maybe. Handed to `URLSession`, a singleton, NotificationCenter, or a repeating timer — `weak`. If you are not sure, you are not sure, so use `weak`.

---

## NotificationCenter, Timer, Combine, Tasks

### NotificationCenter

Block-based observers are objects. If you forget the token, you leak the observer, and the block may keep `self` alive.

```swift
NotificationCenter.default.addObserver(forName: .userDidLogin, object: nil, queue: .main) { [weak self] _ in
    self?.refresh()
}
```

Selector-based `addObserver(_:selector:name:object:)` is removed in `deinit` automatically on the iOS versions you actually ship. The history still matters in interviews: **not removing observers used to crash**. Today the usual bug is leaking the *block observer object*. Prefer `NotificationCenter.default.publisher(for:)` stored in a `Set<AnyCancellable>` that dies with the owner, or newer `NotificationCenter.Observations` on current OS, or skip notifications entirely and use a callback, Combine, or an async stream.

### Timer

```swift
Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
    self?.tick()
}
```

The older `scheduledTimer(timeInterval:target:selector:userInfo:repeats:)` **strongly retains its target**. If that target also retains the timer, you have a cycle. Use the block API with a weak capture, or `Timer.publish` in Combine, or a `Task` loop with `Task.sleep`. Invalidate when the screen leaves. A repeating timer that survives a pop is a classic “why is this VC still in the memory graph?” finding.

### Combine

```swift
cancellable = publisher.sink { [weak self] value in
    self?.handle(value)
}
```

`AnyCancellable` stored on `self` plus a strong `self` inside `sink` is a cycle. Weak-capture the sink, or store the cancellable on some other owner that does not appear in the closure.

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

A `Task` that strongly captures `self` and is stored on `self` can cycle. Cancel in `deinit`, or do not store the task at all if SwiftUI `.task` already owns it — that modifier is structured to the view’s appearance lifetime, which is what you usually want.

---

## SwiftUI and ARC

View structs are values. They come and go constantly; they are not the objects in the memory graph you should worry about. **State objects are classes.** A `@StateObject` (legacy) or an `@Observable` class is kept by SwiftUI’s storage for as long as that view identity lives.

Closures in a `Button` that capture an `@Observable` model usually do not cycle, because the view does not store that closure on the model. The dangerous pattern is a model that stores a closure that captures the model — same graph as the view-controller-plus-`printer` example, just wearing SwiftUI clothes.

---

## Instruments

Leaks, Allocations, Memory Graph Debugger. Look for abandoned `ViewController` graphs after a pop. At senior level, distinguish **leaks** (cycles, abandoned objects that should have died) from **high memory** (image caches, decoded bitmaps, no cycle but the working set is huge). Both look like “the app is using too much RAM.” Only one is an ownership bug.

---

## Common mistakes

People put `weak` on a value type and the compiler says no — only classes. People pick `unowned` because they are tired of `?` and then crash after a pop. People ignore that `Timer`’s target API retains, or they add a NotificationCenter block observer and never store the token. All of these show up as either a leak you find in Instruments or a crash you find from a delayed callback.

The durable habits: `weak` when the other object might die first; invalidate timers when the screen leaves; cancel tasks you stored; treat escaping closures that mention `self` as a cycle until proven otherwise.

## One-minute explanation

ARC counts strong references to class instances. When two objects own each other strongly, they never hit zero, so `deinit` never runs. I break that with `weak` when lifetime is uncertain — delegates, stored closures, timers, notifications — and I only use `unowned` when I can honestly say the other object outlives me. Closures capture strongly by default, so a stored escaping closure on `self` that mentions `self` is a cycle until I write `[weak self]`. Value types are not in this game; the objects inside them might be.

---

# Advanced Swift

These are the language features that show up once you are past “can you write a struct.” Interviews use them to see whether you understand how SwiftUI, Combine, and the standard library are *built*, not just how to call them.

---

## Key paths

```swift
let name = \User.name
users.map(\.name)
```

A key path is a typed handle to a property. SwiftUI uses them, Combine’s `assign(to:on:)` uses them, SwiftData queries use them. You are not passing a string that might be wrong at runtime; you are passing `\User.name` and the compiler knows it is `String`.

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

A result builder turns a little DSL of statements into one generic value — `_ConditionalContent`, `TupleView`, and friends. That is why `if` inside `body` is legal and still returns `some View`. Without the builder, those branches would be two different types and would not type-check as a single opaque result. You do not need to memorise every generated type. You do need to know that `body` is not “just a computed property that returns whatever.”

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

`@State` is this idea aimed at SwiftUI: intercept get and set, and redirect storage into the framework. `$` is `projectedValue`. For `@State`, that projection is a `Binding`.

```text
@State private var count = 0
count   → wrappedValue (Int)
$count  → projectedValue (Binding<Int>)
_count  → the wrapper itself (State<Int>)
```

Once you see that, “why do I write `$count` on a `TextField`?” stops being magic.

## `dynamicMemberLookup` / `@dynamicCallable`

Rare in app code. They show up in DSLs so `foo.bar` can resolve at runtime or `foo(1, 2)` can look like a function call on a type that is not quite a function. Know they exist. Do not reach for them in a production screen. Interviewers who care will ask whether you have seen them; they will not ask you to invent one.

## Copy-on-write implementation sketch

Arrays, strings, and dictionaries feel like values but do not copy the buffer on every assignment. They share storage until someone mutates, then they copy if the buffer is shared.

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

`isKnownUniquelyReferenced` is the test. If you are the only owner, mutate in place. If not, copy first. Senior interviews like this because it connects value semantics to actual heap traffic.

## Equatable, Hashable, Comparable

The compiler synthesises these for structs whose stored properties already conform. Custom `==` must agree with `hash(into:)`: equal values must hash the same, or dictionaries and sets will lose entries in ways that look like ghosts. SwiftUI sometimes uses `Equatable` views to skip `body` — so a wrong `==` is not just a collections bug, it is a “why didn’t my row update?” bug.

## Pattern: `Sendable` structs

If your models are immutable structs of Sendable fields, crossing actor and task boundaries is easy. If they are mutable classes, Swift 6 will argue with you, and it will be right. Prefer data as values; keep identity in the few objects that actually need it.

## `@frozen`, `@inlinable`, library evolution

This is framework-author territory. A frozen enum can be switched without `@unknown default` inside the same resilience domain. `@inlinable` publishes the body of a function across module boundaries so clients can specialise. You do not need these in an app target. You should be able to say why a public SDK cares.

## Unsafe pointers

`UnsafeRawPointer`, `withUnsafeBytes`, C interop. They exist so you can talk to C and, occasionally, do measured extra-performance work. Stay in safe Swift on a whiteboard unless they ask. One honest sentence is enough: you do not reach for unsafe pointers to look clever.

---

# Swift Concurrency

Correct this in every interview, including with yourself:

> `async` does **not** mean “run on a background thread.”

`async` means “this function may **suspend**.” Suspension is a cooperative pause so the thread can do other work. Where the function **resumes** depends on **actor isolation** and the **executor**, not on the word `async`. If you take nothing else from this chapter, take that.

---

## `async` / `await`

You have a network call. You do not want to block the thread for the round trip. You also do not want a pyramid of completion handlers.

```swift
func fetchUser() async throws -> User {
    let (data, _) = try await URLSession.shared.data(from: url)
    return try JSONDecoder().decode(User.self, from: data)
}

let user = try await fetchUser()
```

`async` marks that the function may suspend. `throws` marks that it may fail. `await` is the suspension point: if the callee suspends, this task yields. `try` is the usual error handling, just sitting next to `await` because the call can do both.

```swift
Task {
    let result = await fetchData()
}
```

`Task { }` creates a new top-level task — unstructured work. It inherits the current actor context when it can. From MainActor code, that task is MainActor-isolated unless you use `Task.detached` or you are already in a nonisolated context. `await fetchData()` calls `fetchData`; if it suspends, this task pauses. The thread is **not** blocked the way a semaphore wait blocks. When `fetchData` is ready, the task is scheduled again. Which executor it resumes on depends on `fetchData`’s isolation, not on your hope that “async means background.”

Creating a `Task` is not `pthread_create`. The runtime owns a pool (GCD underneath, on Apple). The task is **scheduled**. It may run immediately or later.

Which thread actually runs it?

- If the task is `@MainActor`, or was created in a MainActor context: the main actor executor, which for UI is the main thread.
- If `fetchData` is `nonisolated` async and hops into `URLSession`, the resume after `await URLSession...` is typically on a cooperative thread-pool executor, not the main thread.
- Then if you update UI, you must get back to the main actor.

Does `Task` create a thread? No. It creates a **task**, a piece of work the cooperative scheduler can run. Thousands of tasks can map onto a handful of threads. That is the point.

`await` means: this task may suspend here. The current thread is free to run other tasks. I will continue later from this point with my local state preserved. It is not “jump to background.” It is not `DispatchQueue.global().sync`.

```text
Task running  → hits await  → task state stored  → thread picks another task
                     ▲
                     └── when the child work completes, task is enqueued on an executor
```

The stack is not a blocking call that holds a kernel thread for the whole network round trip. That is why you can have a huge number of in-flight requests without a huge number of threads.

You cannot forget `await`. An async function used without `await` (and without wrapping in `Task`) is a compile error. That is a gift. Take it.

Do not sprinkle `async` on a CPU-only tight loop with no I/O. Making it `async` does not make it concurrent. For CPU work you want a different isolation, `Task.detached` or a custom executor, or you keep it synchronous on a background queue you already understand. `withCheckedContinuation` is for bridging, not for hoping a loop gets faster.

---

## Structured vs unstructured concurrency

**Structured** means child tasks are bound to a parent scope. When the scope exits, children are cancelled and awaited. `async let` and `withTaskGroup` work this way. Errors and cancellation propagate. You get the lifetime for free.

**Unstructured** means `Task { }` and `Task.detached`. The work has its own lifetime. If the UI goes away, you cancel it yourself or it keeps running.

```text
Structured (preferred)
    withTaskGroup / async let
         │
         ├── child
         └── child   all finish or cancel with parent

Unstructured
    Task { }  lives until it finishes or you cancel the handle
```

SwiftUI `.task { }` is structured to the view’s appearance lifetime — cancelled when the view is removed. Prefer it over `onAppear { Task { } }`. That one-liner is how people leak requests after a pop.

---

## `Task`, `Task.detached`, priority

```swift
let handle = Task(priority: .userInitiated) {
    try await fetchUser()
}
handle.cancel()
let user = try await handle.value
```

`Task.detached` does not inherit actor, task-local values, or priority the same way. Use it rarely, for work that is truly independent of the current context. Prefer `Task {}` or a task group. Priority is a hint, not a real-time guarantee. Saying “I set `.high` so it will always run first” is not how the scheduler works.

---

## `async let`

```swift
async let user = fetchUser()
async let feed = fetchFeed()
let (u, f) = try await (user, feed)
```

Both start. Both are awaited. The work is structured: if you return early, pending `async let` work is cancelled. Use this when the number of children is fixed and small. Use a task group when N is dynamic.

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

`withThrowingTaskGroup` if children throw. If you spawn ten thousand tasks, you will have a bad time — limit concurrency yourself with a pool pattern, or be careful with `DiscardingTaskGroup`. The interview version of this question is “how do you fetch N endpoints concurrently?” Two or three: `async let`. N: a task group.

---

## Cancellation

Cancellation is **cooperative**. The runtime sets a flag. Your code, or the API you called, has to look at it.

```swift
try Task.checkCancellation()
if Task.isCancelled { return }
```

`URLSession` async APIs honour cancellation. Your own loops must check. `Task.sleep` throws `CancellationError`, which is how a cancelled `.task` actually stops waiting.

```swift
.task {
    let data = try await loader.load()
    items = decode(data)
}
```

Leaving the screen cancels that task. `load` should stop. If you wrote `onAppear { Task { ... } }` and did not store or cancel the handle, the request **continues** after the user is gone. That is the classic bug: wasted battery, a late callback that updates a view that is not on screen, or a race that writes into a new instance of the same screen.

---

## Actors

You have a bank account, a cache, or a token refresher — mutable state that several tasks might touch. Locks work until someone holds one across an `await` and deadlocks. Actors exist so the compiler serialises that access for you.

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

Calls from outside hop to the actor’s executor. Only one task runs actor-isolated mutable state at a time — with a reentrancy caveat below. You do not inherit from actors. You `await` to talk to them from the outside.

| | Actor | Class |
| --- | --- | --- |
| Isolation | Compiler-enforced | You must lock |
| Cross-await | `await` required | Direct |
| Inheritance | No | Yes |
| Reentrancy | Yes on `await` | N/A |

If an actor method `await`s, another task can enter the actor and mutate state. After `await`, **re-read**. Do not assume local invariants held across the suspension.

```swift
func transfer(to other: BankAccount, amount: Int) async {
    guard balance >= amount else { return }
    balance -= amount
    await other.deposit(amount)  // reentrancy window on `other` and possibly self patterns
}
```

Design methods so they are still correct after a hop. That is the 4+ interview, and it is also how production token refreshers go wrong: you check “am I refreshing?”, await the network, and come back to a different world.

`nonisolated` marks members that do not need the actor’s isolation — they must actually be safe without it.

```swift
actor ImageCache {
    nonisolated var id: UUID { UUID() }  // example: immutable-safe
}
```

`nonisolated(unsafe)` is a sharp tool. Interviewers may ask you to avoid it, and you should. `isolated` parameters are the advanced form: pass an isolated actor instance into a function so that function runs on that actor.

---

## MainActor

UIKit and SwiftUI UI is main-thread. `@MainActor` is how the compiler enforces that, instead of a comment that says “call this on main.”

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

SwiftUI `View.body` is MainActor-isolated in modern SDKs. MainActor is a **global actor**. Isolated work is scheduled on the main executor (main thread / main run loop). `await` from a background task to a MainActor function **hops** to the main actor.

```swift
Task.detached {
    let data = await load()          // background pool
    await MainActor.run {
        self.text = data             // UI
    }
}
```

Prefer annotating the type `@MainActor` over scattering `MainActor.run` through every callback. One annotation on the view model is a design. Twenty `MainActor.run` calls are a smell.

Modules can default to `@MainActor` (Swift 6.2 `defaultIsolation`). CPU work then opts out with `@concurrent` / `nonisolated` depending on the toolchain. The idea to remember: UI modules run on main by default; you explicitly mark concurrent work, instead of hoping every intern remembers `DispatchQueue.main`.

---

## Sendable

`Sendable` means safe to pass across concurrency domains — no unsynchronised shared mutation.

- Structs of Sendable fields: synthesised.
- Actors: Sendable.
- Classes: must be `final`, immutable, or otherwise proven. You will meet `@unchecked Sendable` on legacy wrappers. Treat it as a confession, not a design.

Swift 6 **Sendable checking** is a compiler mode. Crossing isolation with a non-Sendable class is an error. `@preconcurrency` imports a module with weaker checking — a migration aid, not a place you want to live.

This is why “make the DTO a struct” is not style. It is how you stay friends with the compiler when two actors need the same user record.

---

## AsyncSequence, AsyncStream

Sometimes the problem is not one request. It is values over time: bytes of a download, location updates, a websocket.

```swift
for await byte in url.bytes { }

let stream = AsyncStream<Int> { continuation in
    continuation.yield(1)
    continuation.finish()
}
```

`AsyncThrowingStream` if the stream can fail. Observation’s `Observations { }` (iOS 26 / Swift 6.2) sits in this family. Set `onTermination` on the continuation so cancellation actually tears down the producer. If the `for await` breaks, finish the stream. A stream that never finishes is a leak with extra steps.

---

## Bridging GCD and completion handlers

The codebase still has a completion-handler API. You want async/await at the call site.

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

Resume **exactly once**. `withCheckedThrowingContinuation` if it can fail. Wrong resume count crashes in debug, which is the runtime doing you a favour. Do not resume on a path you also forget, and do not resume from two callbacks.

---

## Combine vs async/await

Async/await is the right default for request/response and structured workflows. Combine or `AsyncSequence` / `Observations` is the right default for many values over time. You can mix them. See the Combine chapter for the long version. In an interview, say which shape the problem is — one shot or a stream — and pick the tool that matches, not the tool you learned last.

---

## Common concurrency mistakes

The sentence that fails interviews is “async means background.” Isolation decides the executor; `async` only means the function may suspend.

`Task { }` inside `onAppear` without cancellation is how requests outlive screens. `.task { }` or a stored handle you cancel is the fix.

Updating `@Published` or UI off the main actor is a data race that used to be a “sometimes the label is wrong” bug and is now a Swift 6 error. Put the view model on `@MainActor`.

A thousand unstructured `Task`s in a loop will thrash. A task group with limited concurrency will not.

Actor state after `await` is not the state you left. Re-read. Actors are reentrant.

`Task.detached` for everything throws away useful context. Inherit by default; detach rarely.

## Interview questions

### Does `await` block the thread?

No. `await` suspends the *task*. The worker thread is free to run other tasks while the network, the disk, or another actor is busy. That is nothing like a blocking syscall that sits on a kernel thread until I/O returns.

People say “it blocks the background thread until the network returns” because that is how they used semaphores and `DispatchQueue.global().sync`. Cooperative tasks do not work that way. Local variables are preserved; the thread is not.

If the main thread still freezes, you did not “await wrong.” You ran CPU work on the main actor, or you called a blocking API (`Data(contentsOf:)`, a lock, a long JSON decode) from MainActor-isolated code. `await` would have let the main thread breathe. A tight loop will not.

### How do you cancel a request when the user leaves a SwiftUI screen?

Tie the work to the view. `.task { try await loader.load() }` is cancelled when the view leaves the hierarchy (or when its identity changes, if you used `.task(id:)`). `URLSession`’s async APIs pick that cancellation up. You can also keep a `Task` handle and call `cancel()`, or cancel the `URLSessionTask` if you are still in the old callback world.

If the async function ignores cancellation — a loop that never calls `Task.checkCancellation()`, a continuation you never fail, a third-party SDK that will not stop — the request continues anyway. Cancellation is cooperative. “I used `.task`” is necessary and not always sufficient. The function you await has to participate.

### Actor versus a lock?

An actor serialises access to its mutable state and composes with `async`. The compiler checks that you do not touch that state from the outside without `await`. A lock is for a synchronous critical section. It is the right tool when the work is short, in-process, and never suspends.

Never hold a lock across `await`. You will deadlock or you will be one refactor away from deadlock. If the critical section needs to wait on the network, it is not a lock problem anymore. It is an actor problem, or a queue of work on an actor, and you re-check invariants after the hop.

## One-minute explanation

Swift concurrency is cooperative tasks on a pool, not one thread per job. `await` suspends the task. `async` does not pick a thread. I isolate UI on `MainActor`, isolate mutable shared state on `actor`, and pass `Sendable` values across those boundaries. I prefer structured tasks — `async let`, task groups, SwiftUI `.task` — so cancellation comes with the scope instead of a handle I forget to store.
