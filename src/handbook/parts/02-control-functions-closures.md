# Swift Control Flow

Control flow is how a program chooses paths. Interviews use it to test precision — `switch` exhaustiveness, `guard`, `where` — more than creativity. Braces, real Booleans, and complete switches are the language saying “be conservative.”

---

## `if`, `else`, `else if`

```swift
if score >= 90 {
    print("A")
} else if score >= 80 {
    print("B")
} else {
    print("C")
}
```

Parentheses around the condition are optional. Braces are not. `if score >= 90 print("A")` does not compile. That is deliberate: braces prevent the classic dangling-else and “forgot the body” bugs from C.

The condition must be a `Bool`. Integers are not truthy.

```swift
let count = 3
// if count { }     // Int is not Bool
if count != 0 { }   // this compiles
```

If you omit `else`, the false branch does nothing. That is fine when the false case is truly a no-op. If both branches must produce a value, prefer assigning into a `let` that the compiler can see is initialised on every path:

```swift
let grade: String
if score >= 90 {
    grade = "A"
} else {
    grade = "B"
}
```

Or a ternary for the tiny cases:

```swift
let grade = score >= 90 ? "A" : "B"
```

Nested ternaries are a smell. Interviewers read them as “this person would rather be clever than clear.” Once you need a third branch, you wanted `if`/`else` or a `switch`.

---

## `switch` and pattern matching

Swift `switch` is **exhaustive**. The compiler demands every possibility. That is the entire point of the feature, and it is why this topic is critical in interviews.

```swift
enum Transport {
    case walk, bike, car, train
}

func eta(_ t: Transport) -> Int {
    switch t {
    case .walk:  return 40
    case .bike:  return 15
    case .car:   return 8
    case .train: return 12
    }
}
```

C `switch` fell through by default and did not enforce completeness. Adding an enum case silently did nothing. Swift makes the new case a **compile error** until you handle it. You *can* write the equivalent with `if`, but you lose that exhaustiveness. A new enum case compiles, ships, and surprises you at runtime.

Pattern matching is where the 2–4 year questions live: `where`, tuples, value binding, interval patterns, wildcards.

```swift
switch (httpStatus, retryCount) {
case (200, _):
    print("ok")
case (401, let n) where n < 3:
    print("retry auth \(n)")
case (401, _):
    print("give up")
case (500...599, _):
    print("server")
default:
    print("other")
}
```

`let n` binds `retryCount` in that case. `where n < 3` is an extra boolean filter — the case only matches if the pattern matches *and* the condition is true. `500...599` is an interval pattern. `_` is “ignore this.” Order matters: `(401, let n) where n < 3` has to sit above `(401, _)` or the retry case is dead.

Swift does **not** fall through by default. If you want C-style fallthrough you have to ask:

```swift
switch value {
case 1:
    print("one")
    fallthrough
case 2:
    print("two or fell from one")
default:
    break
}
```

`fallthrough` is explicit and rare. Prefer combining cases:

```swift
case 1, 2:
```

`break` in a switch is usually unnecessary, because cases do not fall through. Use it in an empty case if you must do nothing:

```swift
case .deprecated:
    break
```

A boolean is an `if`. A `switch true` with many `where` clauses is usually worse than `if`/`else` or a policy object. Interval matching, though, is often cleaner than nested `if`:

```swift
switch age {
case ..<0:   print("invalid")
case 0..<18: print("minor")
case 18...:  print("adult")
}
```

`default` is for true open sets — `Int`, `String`, an HTTP status you do not want to enumerate. Using `default` on an enum so you do not have to list cases is how new cases silently become “other” in production.

Across module boundaries you will also meet non-frozen enums. A library can add a case in a future version. `@unknown default` is the 2–4 / 4+ answer:

```swift
switch extra {
case .walk: ...
@unknown default:
    print("future case from a different module")
}
```

That is different from ordinary `default`. `@unknown default` tells the compiler “I think I handled every case that exists today; warn me when the library adds one.” Frozen versus non-frozen is library evolution; you do not need it for an enum you own in the same module.

### Why is Swift switch safer than C?

No implicit fallthrough, and enum switches are exhaustive. Adding a case is a compile error until every `switch` is updated, which is the whole reason to use an enum instead of a pile of booleans. `fallthrough` exists if you want C behaviour, but you have to write it, and combining cases with a comma is almost always clearer.

The follow-up is `@unknown default`. That is for enums you do not own, coming from another module that may grow. It is not a lazy substitute for listing your own cases. If I own `Transport`, I list every case and I let the compiler break the build when I add `.ferry`.

---

## Loops: `for-in`, `while`, `repeat-while`, `stride`

Swift loops over sequences. Integer C-style `for` is gone on purpose.

```swift
for name in names {
    print(name)
}

for (index, name) in names.enumerated() {
    print(index, name)
}

for i in 0..<5 { }          // 0,1,2,3,4
for i in 0...5 { }          // includes 5

for i in stride(from: 0, to: 10, by: 2) { }      // 0,2,4,6,8
for i in stride(from: 0, through: 10, by: 2) { } // includes 10
```

`0..<5` is a half-open range: start inclusive, end exclusive. `0...5` includes both ends. `stride(from:to:by:)` excludes the `to` value; `through:` includes it. Use `stride` for non-one integer steps. Do not use `stride` to walk a `String` by integer offsets — `String` indexes are not `Int`.

`where` on `for` filters without a nested `if`:

```swift
for n in numbers where n.isMultiple(of: 2) {
    print(n)
}
```

`while` runs zero or more times. `repeat-while` is do-while: the body runs at least once.

```swift
while condition {
    // zero or more
}

repeat {
    // one or more
} while condition
```

Use `repeat-while` when the body must run once — read at least one packet, prompt at least once. Otherwise `while` or `for-in`.

`continue` skips this iteration. `break` leaves the loop. Labeled `break` leaves an outer loop, which is the honest alternative to a flag:

```swift
for n in numbers {
    if n < 0 { continue }  // skip this iteration
    if n == 0 { break }    // leave the loop
    print(n)
}
```

```swift
outer: for row in matrix {
    for cell in row {
        if cell == target {
            break outer
        }
    }
}
```

`forEach` is not a loop in the `break`/`continue` sense:

```swift
numbers.forEach { n in
    // cannot break or continue
    // return only leaves this closure invocation (like continue)
}
```

You cannot `break` out of `forEach`. Prefer `for-in` when you need control-flow keywords. Use `forEach` when you truly want “run this side effect for every element” and you will not stop early.

`for-in` on `Array` is fast. Avoid `0..<array.count` plus subscript unless you need the index; `enumerated()` is clearer. `while true` without a proven exit is a bug waiting for a review. In async loops, the exit is often `Task.checkCancellation()` or `Task.isCancelled`.

---

## Common control-flow mistakes

A sloppy `default` that swallows new enum cases is the most expensive mistake in this chapter. Handle cases explicitly; reserve `default` for true open sets. `while true` without a proven exit should be a `for-in` over a sequence, or a cancellation check in an async loop. Five levels of `if let` should have been a `guard let` chain at the top of the function.

---

## Quick Revision — Control Flow

`if` needs a real `Bool` and braces. `switch` is exhaustive and does not fall through unless you write `fallthrough`. `guard` early-exits so the happy path stays left. `stride` is for non-one integer steps. Prefer `for-in` over `forEach` when you might `break`.

---

## One-minute explanation

Swift control flow is conservative. Conditions are real Booleans, switches must be complete, and loops use sequences. I use `guard` for preconditions and `switch` for enums so new cases break the build instead of production.

---

# Functions

A Swift function is a named, typed transformation. Call sites read like English because of argument labels. Functions are first-class values: you can store them, pass them, and return them.

## Function declaration

```swift
func greet(person: String) -> String {
    "Hello, \(person)"
}

let message = greet(person: "Ravi")
```

`func` names the function. `(person: String)` is a parameter whose external name and internal name are both `person`. `-> String` is the return type. A single-expression body can omit `return`.

The return type is a contract. `-> Void` can be omitted:

```swift
func log(_ message: String) {  // implied Void
    print(message)
}
```

If you write `-> String`, every path must return a `String`. The compiler will not let you forget a branch. That is the same exhaustiveness instinct as `switch`.

People mix up *parameter* and *argument*. The parameter is the name and type in the declaration. The argument is the value at the call site. Interviewers sometimes use the words loosely. Using them correctly is a small plus.

---

## External names, internal names, and `_`

Swift inherited sentence-shaped APIs from Objective-C (`moveFrom:to:`). At the call site you want English. In the body you want a sensible local name. That is why a parameter can have two names.

```swift
func move(from start: Int, to end: Int) { }

move(from: 0, to: 10)
```

`from` and `to` are external — used at the call site. `start` and `end` are internal — used in the implementation.

`_` suppresses the external label when the function name already contains the meaning:

```swift
func abs(_ value: Int) -> Int {
    value >= 0 ? value : -value
}

abs(-3)  // no external label
```

`print`, `min`, `abs` read well without labels. When omitting the label would make the call ambiguous, keep it. A mixed style is often the most readable:

```swift
func subtract(_ a: Int, from b: Int) -> Int { b - a }
subtract(3, from: 10)  // reads well
```

---

## Default parameters

```swift
func connect(host: String, port: Int = 443, useTLS: Bool = true) { }

connect(host: "api.example.com")
connect(host: "api.example.com", port: 8443)
```

Common cases stay short; rare cases stay possible without an explosion of overloads. That is why defaults exist.

Do not hide a global in a default: current locale, current user, `Date()`. Those make the function hard to test. Pass the dependency instead (see Dependency Injection).

Defaults are inserted at the **call site** by the compiler. Changing a default in a library is an ABI- and source-sensitive change. For a public library, consider an overload rather than silently changing what existing callers get.

---

## Variadic parameters

```swift
func sum(_ numbers: Int...) -> Int {
    numbers.reduce(0, +)
}

sum(1, 2, 3, 4)
```

Inside the function, `numbers` is `[Int]`. Only one variadic parameter per function. Put it last unless you have defaults arranged carefully — callers need to be able to see where the list ends.

A variadic is for a call site that wants `sum(1, 2, 3)`. If you already have an array, take `[Int]`. Wrapping an array as a variadic, or the reverse, is extra noise.

---

## `inout`

Value types are copied. Sometimes you want a function to mutate the caller’s value without returning a new one — `swap`, an in-place bump. `inout` is that opt-in.

```swift
func bump(_ value: inout Int) {
    value += 1
}

var n = 0
bump(&n)
```

The call site must write `&`. That is the language making mutation visible. Swift’s model is **copy-in copy-out**, with optimisations. You must not pass the same value twice as overlapping `inout` in ways the compiler rejects. Do not think of `inout` as a C pointer unless you are in an `Unsafe` API.

Often the clearer design is to return a new value:

```swift
func bumped(_ value: Int) -> Int { value + 1 }
n = bumped(n)
```

Prefer returning values unless mutation is the natural API (`sort` in place versus `sorted`). Avoid `inout` across concurrency boundaries — it is not `Sendable` in a simple way. Avoid it when the function should be a pure transformation. If a stored property already has a `mutating` method, call that instead of writing a free `inout` helper.

Classes do not need `inout` to mutate properties of the object. `inout` is about mutating a *value* the caller owns. Passing a class instance already shares the object; `func bump(_ session: Session)` can already do `session.token = "y"` if `token` is `var`.

The interview trap is “`inout` is pass by reference like a class.” Semantically you are mutating the caller’s value. Implementation is copy-in/copy-out. Those are not the same sentence as “this is a class.”

---

## Function types and higher-order functions

Functions are values. You can name the type, store it, and pass it.

```swift
func add(_ a: Int, _ b: Int) -> Int { a + b }

let op: (Int, Int) -> Int = add
op(2, 3)  // 5
```

`(Int, Int) -> Int` means two `Int` parameters, returns `Int`. A higher-order function takes or returns functions:

```swift
func apply(_ n: Int, using f: (Int) -> Int) -> Int {
    f(n)
}

apply(3) { $0 * 2 }
```

The standard library is built on this: `map`, `filter`, `reduce`, `sorted(by:)`. That is why you can write `names.map { $0.uppercased() }` instead of a manual loop.

They hurt when nested `map`/`flatMap`/`filter` would be clearer as a `for`. In an interview, be able to write `map` by hand, then use the standard library. Clever pipelines that nobody can step through are not a flex.

---

## Overloading

```swift
func log(_ value: String) { }
func log(_ value: Int) { }
```

Resolved at compile time by types. Too many overloads, especially mixed with generics, make error messages unreadable. Prefer a clear name when types collide (`decodeJSON` versus `decodePlist`) rather than a seventh `decode` that the type checker might pick wrong.

---

## Nested functions

```swift
func process() {
    func helper() { }
    helper()
}
```

Useful for local reuse without polluting the type. Nested functions capture enclosing bindings the same way closures do, so the capture rules in the next chapter apply. If the helper needs to be tested, it is no longer a nested function — it is a method or a free function.

---

## Discardable results

```swift
@discardableResult
func save() -> Bool { true }
```

Without this, unused return values warn. Use it when ignoring the result is reasonable. `print` does not need it because it returns `Void`. A `save()` that returns `Bool` for success probably should *not* be discardable if callers keep forgetting to handle failure — the warning is doing work.

---

## Common function mistakes

Fifteen parameters with Boolean flags should have been an `Options` struct, or several functions. Default parameters that hide the current user or the current date make tests lie; inject `Date`, `Calendar`, `UserSession`. `inout` plus `async` is a smell: return a new value, or isolate mutation on an actor.

---

## Quick Revision — Functions

External versus internal names; `_` hides the label. Defaults and variadics keep call sites short. `inout` is explicit mutation of a value (copy-in copy-out). Functions are values: `(A) -> B`.

---

## One-minute explanation

A Swift function is a named typed transformation. Call sites read like English because of argument labels. I pass values, not hidden globals. If I need mutation of a struct, I either return a new value or use `inout` / `mutating` deliberately.

---

# Closures

Syntax is junior. Capture lists, escaping, and retain cycles are mid-level. How closures interact with actors, `@Sendable`, and SwiftUI `Task` is senior. Interviews ask this from the first mid-level round onward.

## What a closure is

A closure is an **anonymous function** that **captures** values from the surrounding context.

```swift
let add: (Int, Int) -> Int = { a, b in
    a + b
}

add(2, 3)  // 5
```

The type annotation `(Int, Int) -> Int` is a function type. `{ a, b in ... }` is the closure: parameters, then `in`, then the body. A single-expression body can omit `return`. Shorthand arguments exist for tiny closures:

```swift
let add: (Int, Int) -> Int = { $0 + $1 }
```

`$0` is the first argument, `$1` the second. Use `$0` when the closure is one line and obvious. Named parameters for anything you will read twice.

Closures exist to pass behaviour: completion handlers, `map`, animations, SwiftUI `Button` actions, `Task` bodies. A named function is a closure with a name and no capture unless it is nested. Closures can capture. Closures can be created inline. That capture is the whole reason they are harder than functions.

---

## Trailing closures

If the last argument is a closure, it can sit outside the parentheses.

```swift
names.map { $0.uppercased() }

UIView.animate(withDuration: 0.25) {
    view.alpha = 1
}
```

The call looks like a custom control structure, which is the point. Multiple trailing closures (Swift 5.3+) keep labels on the later ones:

```swift
Button("Save") {
    save()
} onLongPress: {
    showDetails()
}
```

That is how SwiftUI reads. Skip trailing syntax when several closures are of similar importance and labels inside the parens would be clearer. Nested trailing closures that nobody can parse should have been named functions.

---

## Escaping vs non-escaping

By default, a function-parameter closure is **non-escaping**: it must be used before the function returns.

```swift
func render(_ draw: () -> Void) {
    draw()
}
```

If the closure is stored and called later, it **escapes**. You mark that with `@escaping`, and the compiler will not let you stash a non-escaping closure.

```swift
var handlers: [() -> Void] = []

func onNext(_ handler: @escaping () -> Void) {
    handlers.append(handler)
}
```

The compiler needs to know whether captured `self` must be retained beyond the call. Non-escaping closures can be optimised and do not require explicit `self.` in many cases. Escaping closures do: writing `self.` is the language forcing you to see that `self` is captured.

```swift
class Loader {
    var url: URL
    func load(completion: @escaping (Data?) -> Void) {
        URLSession.shared.dataTask(with: url) { data, _, _ in
            completion(data)
        }.resume()
    }
}
```

`dataTask` stores the closure and calls it later, on a queue you do not control. That is escaping. If `completion` captures `self` strongly, `Loader` stays alive until the request finishes — sometimes what you want, sometimes a leak if `Loader` also owns the task in a cycle.

`@autoclosure` wraps an expression into a `() -> T` automatically:

```swift
func logIf(_ condition: @autoclosure () -> Bool, _ message: String) {
    if condition() {
        print(message)
    }
}

logIf(x > 10, "big")   // x > 10 wrapped into a closure automatically
```

`assert` and `??` use autoclosures so expensive right-hand sides are delayed. Do not use `@autoclosure` to hide heavy work in an API that looks like it takes a `Bool`. It surprises callers: they think they passed a value, and you deferred it.

---

## Capture semantics

Closures **capture** the bindings they use, because they may run later and they need the world they closed over. For value types they capture the *value* (a copy) unless they are capturing a reference to a mutable local. For classes they capture the *reference*, strong by default.

Strong capture of `self` is the retain-cycle factory:

```swift
class Session {
    var token = "abc"
    lazy var printer: () -> Void = {
        print(self.token)   // strong capture of self
    }
}
```

`Session` owns `printer`. `printer` owns `Session`. Neither deallocates. `lazy var` closures that capture `self` are a classic cycle.

Capture lists break or clarify that ownership:

```swift
network.load { [weak self] data in
    guard let self else { return }
    self.render(data)
}
```

`[weak self]` captures as an optional weak reference — it does not increment the ARC count, and it becomes `nil` if the object dies. `[unowned self]` is a non-optional unowned reference: no increment, and a crash if you use it after the object is gone. `[self]` is an explicit strong capture (Swift 5.3+) for clarity when you *mean* to keep `self` alive. `[token]` captures the current value of `token` — a snapshot of that binding.

Snapshotting a value:

```swift
var count = 0
let show = { [count] in print(count) }
count = 5
show()  // 0
```

Without `[count]`, a local `var` captured by a closure is a **reference to that variable** (a heap-allocated box), not a copy. This is a favourite interview trap.

```swift
var count = 0
let increment = { count += 1 }
increment()
increment()
print(count)  // 2
```

Both closures share the same boxed `count`. The capture list `[count]` is how you opt out of that sharing and take a copy of the value at closure-creation time.

| | `weak` | `unowned` |
| --- | --- | --- |
| Type | Optional | Non-optional |
| When object dies | Becomes `nil` | Dangling — crash if used |
| Use when | Lifetime unknown | Lifetime guaranteed longer than closure |

If lifetime is uncertain — a view controller, a screen that can pop, a request that can outlive its owner — `weak`. `unowned` is for “this closure cannot possibly outlive the object,” which is a strong claim. Full treatment is in Memory Management.

The cycle picture:

```text
Object A strongly owns a closure
Closure strongly captures A
Neither deallocates
```

Fix with `[weak self]`, or do not store the closure on `self`. Completions that are only called once and then dropped often do not cycle; stored handlers, `lazy var` closures, and delegates-as-closures do.

Concurrent closures add `@Sendable`. They must not capture mutable unsynchronised state. Swift 6 diagnostics will stop you.

```swift
Task { @Sendable in
    // must only capture Sendable values
}
```

See Concurrency for the isolation rules. The language point here is: escaping plus concurrent plus mutable capture is how data races used to sneak in, and Swift 6 is no longer polite about it.

---

## Multiple examples

### Mapping a list

```swift
let squares = [1, 2, 3].map { $0 * $0 }
```

Trailing, non-escaping, no capture. This is the junior form. Be able to write the equivalent `for` loop, then prefer `map`.

### A completion handler you will still meet

```swift
func fetchUser(id: String, completion: @escaping (Result<User, Error>) -> Void) {
    session.dataTask(with: url(for: id)) { data, response, error in
        // parse on this queue, then:
        completion(.success(user))
    }.resume()
}
```

The modern replacement is `async throws -> User` (see Concurrency). Know both. The escaping completion is how `URLSession` still works under the hood, and how a lot of UIKit callbacks are spelled.

### The capture interview

```swift
func makeCounters() -> [() -> Int] {
    var result: [() -> Int] = []
    var i = 0
    while i < 3 {
        result.append { i }
        i += 1
    }
    return result
}

// What do the closures return when called?
```

They all see the **same** `i`, which is `3` after the loop. A capture list `{ [i] in i }` would snapshot each iteration’s value.

A `for i in 0..<3` is different: each iteration gets a new `i` binding, so the closures do not all share one boxed variable. That distinction — `while` plus a single `var` versus `for-in` plus a per-iteration binding — is the actual test. If you only memorise “closures capture by reference,” you will get the `for` case wrong.

---

## Closures in SwiftUI

```swift
Button("Tap") {
    count += 1   // mutates @State; compiler synthesises the right access
}
```

SwiftUI action closures look non-escaping at the call, but the framework stores them. Do not capture a view struct expecting identity to persist — the struct is a value that will be recreated. Capture the data you need, or take `let action` from outside. Mutating `@State` inside the button action is the supported path; the compiler is in on that. Capturing `self` in a `View` is a different story than capturing `self` in a class: the view has no ARC identity of its own. The bug is usually stale values, not a retain cycle.

---

## Common closure mistakes

A stored escaping closure that strongly captures `self` is a leak; use `[weak self]`, or structure the code so `self` does not own the closure. Nested trailing closures nobody can parse should be named functions. `{ i }` does not copy `i` — `[i]` in the capture list does. `@autoclosure` on a public API that looks like a `Bool` will surprise every caller; take an explicit `() -> Bool` if delayed evaluation is part of the contract.

---

## Must Know

Trailing closure syntax, `@escaping`, capture lists, retain cycles, and `$0` versus named parameters. If you can walk through the `makeCounters` example out loud, including why `[i]` changes the answer and why `for-in` differs from `while`, you are past the mid-level bar. Add `weak` versus `unowned` and `@Sendable` for senior.

---

## Interview questions

### What is an escaping closure?

A closure that can be called after the function returns. You mark the parameter `@escaping` because the compiler will not let you store a non-escaping closure. The usual reason it matters is lifetime: the closure can keep objects alive after the call, which is how retain cycles happen when the object also owns the closure.

Inside an escaping closure I write `self.` on purpose — Swift wants me to see the capture. If the object might die first, I capture `[weak self]` and `guard let self else { return }`. If I can prove the object outlives the closure, `unowned` is legal and I treat that as a strong claim, not a default. Completions on `URLSession` are the everyday example; `async` is the modern spelling of the same idea.

### Does a closure copy a struct it uses?

It captures the *binding*. For a local `var`, mutation is shared — the variable is boxed on the heap — unless you snapshot it in the capture list. For a `let` struct, the value is fixed, so the closure sees that value. For a class, it captures the reference, strong unless you write `weak` or `unowned`.

That is why `{ [count] in print(count) }` prints the old number after `count = 5`, and why `{ count += 1 }` increments the original `var`. “Closures always copy structs” is too crude. “Closures always capture by reference” is also too crude. The capture list is how you choose.

---

## One-minute explanation

A closure is a function plus the values it closed over. If it runs later, it is escaping and can keep objects alive. I capture `[weak self]` when the object might die first, and I use capture lists to snapshot values when I do not want to share a variable.
