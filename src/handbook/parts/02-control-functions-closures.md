# Swift Control Flow

```text
Experience: 0–2
Category: Swift
Difficulty: Beginner
Importance: High
```

Control flow is how a program chooses paths. Interviews use it to test precision (`switch` exhaustiveness, `guard`, `where`) more than creativity.

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

### Why parentheses are optional and braces are not

```swift
if score >= 90 { }   // ✅
// if score >= 90 print("A")  // ❌ braces required
```

Braces prevent the classic dangling-else and “forgot the body” bugs from C.

### Conditions must be `Bool`

```swift
let count = 3
// if count { }     // ❌ Int is not Bool
if count != 0 { }   // ✅
```

### What happens if we don't use `else`

The false branch does nothing. That is fine when the false case is truly a no-op. If both branches must produce a value, prefer:

```swift
let grade: String
if score >= 90 {
    grade = "A"
} else {
    grade = "B"
}
```

or a ternary for tiny cases:

```swift
let grade = score >= 90 ? "A" : "B"
```

**When to avoid ternary:** nested ternaries. Interviewers read them as a smell.

---

## `switch` and pattern matching

```text
Experience: 0–2
Advanced understanding: 2–4
Importance: Critical
```

Swift `switch` is **exhaustive**. The compiler demands every possibility.

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

### Why it exists

C `switch` fell through by default and did not enforce completeness. Adding an enum case silently did nothing. Swift makes the new case a **compile error** until you handle it — that is the entire point.

### What happens if we don't use `switch` (only `if`)

You can write equivalent `if`, but you lose exhaustiveness. A new enum case compiles until a runtime surprise.

### `where`, tuples, value binding

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

```text
let n           → binds retryCount in that case
where n < 3     → extra boolean filter
200...599       → interval pattern
_               → wildcard, ignore
```

### `fallthrough`

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

Swift does **not** fall through by default. `fallthrough` is explicit and rare. Prefer combining cases:

```swift
case 1, 2:
```

### `break` in switch

Usually unnecessary. Cases do not fall through. Use `break` in an empty case if you must do nothing:

```swift
case .deprecated:
    break
```

### When not to use `switch`

A boolean is an `if`. A `switch true` with many `where` clauses is usually worse than `if/else` or a policy object.

### Interval matching vs `if`

```swift
switch age {
case ..<0:   print("invalid")
case 0..<18: print("minor")
case 18...:  print("adult")
}
```

Cleaner than nested `if` for ranges.

### Interview questions

**Q: Why is Swift switch safer than C?**  
**Expected:** No implicit fallthrough; enum switches are exhaustive.  
**Follow-up:** “What does `fallthrough` do?”  
**Follow-up:** “How do you handle `@unknown default`?”

```swift
switch extra {
case .walk: ...
@unknown default:
    print("future case from a different module")
}
```

`@unknown default` is **2–4 / 4+**: frozen vs non-frozen enums across module boundaries (library evolution).

---

## Loops: `for-in`, `while`, `repeat-while`, `stride`

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

### `where` on `for`

```swift
for n in numbers where n.isMultiple(of: 2) {
    print(n)
}
```

### `while` vs `repeat-while`

```swift
while condition {
    // zero or more
}

repeat {
    // one or more
} while condition
```

`repeat-while` is a do-while. Use it when the body must run once (e.g. read at least one packet).

### `break` and `continue`

```swift
for n in numbers {
    if n < 0 { continue }  // skip this iteration
    if n == 0 { break }    // leave the loop
    print(n)
}
```

Labeled loops:

```swift
outer: for row in matrix {
    for cell in row {
        if cell == target {
            break outer
        }
    }
}
```

### What happens if we use `forEach` instead of `for`

```swift
numbers.forEach { n in
    // cannot break or continue
    // return only leaves the closure, not an outer function... actually
    // return inside forEach leaves that closure invocation (like continue)
}
```

You cannot `break` out of `forEach`. Prefer `for-in` when you need control-flow keywords.

### Performance

`for-in` on `Array` is fast. Avoid `0..<array.count` plus subscript unless you need the index; `enumerated()` is clearer. Do not use `stride` to iterate characters of a `String` by integer offsets — `String` indexes are not `Int`.

---

## Common control-flow mistakes

```text
❌ switch without exhaustive cases, using a sloppy default that swallows new enums
✅ Handle cases explicitly; default only for true open sets (Int, String)

❌ while true without a proven exit
✅ for-in over a sequence, or Task cancellation checks in async loops

❌ if let nested five levels
✅ guard let chain
```

## Quick Revision — Control Flow

- `if` needs `Bool` and braces
- `switch` is exhaustive; no implicit fallthrough
- `guard` early-exits
- `stride` for non-one integer steps
- Prefer `for-in` over `forEach` when breaking

## One-minute explanation

“Swift control flow is conservative. Conditions are real Booleans, switches must be complete, and loops use sequences. I use `guard` for preconditions and `switch` for enums so new cases break the build instead of production.”

---

# Functions

```text
Experience: 0–2
Advanced understanding: 2–4
Category: Swift
Difficulty: Beginner
Importance: Critical
```

## Function declaration

```swift
func greet(person: String) -> String {
    "Hello, \(person)"
}

let message = greet(person: "Ravi")
```

### Syntax breakdown

```text
func          → function keyword
greet         → function name
(person:      → external name (used at call site)
String)       → parameter type; internal name is also person
-> String     → return type
{ ... }       → body; last expression can be implicit return for one-liners
```

### Why functions exist

Named, reusable, testable units of behaviour. They are first-class values in Swift.

### Why we write return types

The type is a contract. `-> Void` can be omitted.

```swift
func log(_ message: String) {  // implied Void
    print(message)
}
```

### What happens if we don't write a return when we promised one

Compiler error. If you write `-> String` you must return a `String` on every path.

### Parameters vs arguments

- **Parameter:** the name and type in the declaration
- **Argument:** the value at the call site

Interviewers sometimes use the words loosely. Using them correctly is a small plus.

---

## External names, internal names, and `_`

```swift
func move(from start: Int, to end: Int) { }

move(from: 0, to: 10)
```

```text
from   → external name (API readability)
start  → internal name (implementation)
```

```swift
func abs(_ value: Int) -> Int {
    value >= 0 ? value : -value
}

abs(-3)  // no external label
```

```text
_  → suppress external label
```

### Why Swift has two names

Objective-C methods read like sentences: `moveFrom:to:`. Swift preserves that at the call site while letting the body use a sensible local name.

### When to use `_`

When the function name already contains the meaning: `abs`, `print`, `min`. When omitting the label would make the call ambiguous, keep the label.

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

### Why they exist

Common cases stay short; rare cases stay possible without an explosion of overloads.

### When not to use them

When the default is a hidden global (current locale, current user) that makes the function hard to test. Pass dependencies instead (see Dependency Injection).

Defaults are inserted at the **call site** by the compiler. Changing a default in a library is an ABI/source-sensitive change; for public libraries, consider overloads.

---

## Variadic parameters

```swift
func sum(_ numbers: Int...) -> Int {
    numbers.reduce(0, +)
}

sum(1, 2, 3, 4)
```

Inside the function, `numbers` is `[Int]`. Only one variadic parameter per function. Put it last unless you have defaults arranged carefully.

---

## `inout`

```text
Experience: 0–2
Advanced understanding: 2–4
Importance: High
```

```swift
func bump(_ value: inout Int) {
    value += 1
}

var n = 0
bump(&n)
```

### Syntax breakdown

```text
inout   → pass by reference semantics (copy-in copy-out)
&n      → call site must opt in
```

### Why it exists

Value types are copied. Sometimes you want a function to mutate the caller’s value without returning a new one (`swap`, mutating helpers).

### Internal model

Swift uses **copy-in copy-out** (with optimisations). You must not pass the same value twice as overlapping `inout` in ways the compiler rejects. Do not think of `inout` as a C pointer unless you are in an `Unsafe` API.

### What happens if we don't use `inout`

Return a new value instead — often clearer:

```swift
func bumped(_ value: Int) -> Int { value + 1 }
n = bumped(n)
```

Prefer returning values unless mutation is the natural API (`sort` in place vs `sorted`).

### When to avoid `inout`

- Across concurrency boundaries (not `Sendable` in a simple way)
- When the function should be a pure transformation
- On stored properties that already have `mutating` methods — use those

### Interview trap

“`inout` is pass by reference like a class.” Semantically you are mutating the caller’s value. Implementation is copy-in/copy-out. Classes do not need `inout` to mutate properties of the object.

---

## Function types and higher-order functions

```text
Experience: 0–2
Advanced understanding: 2–4
Importance: High
```

Functions are values.

```swift
func add(_ a: Int, _ b: Int) -> Int { a + b }

let op: (Int, Int) -> Int = add
op(2, 3)  // 5
```

### Syntax breakdown

```text
(Int, Int) -> Int   → two Int parameters, returns Int
```

Higher-order: a function that takes or returns functions.

```swift
func apply(_ n: Int, using f: (Int) -> Int) -> Int {
    f(n)
}

apply(3) { $0 * 2 }
```

Standard library: `map`, `filter`, `reduce`, `sorted(by:)`.

### When higher-order functions hurt

Deep nested `map/flatMap/filter` that a simple `for` would explain better. Interviews: be able to write `map` by hand, then use the standard library.

---

## Overloading

```swift
func log(_ value: String) { }
func log(_ value: Int) { }
```

Resolved at compile time by types. Too many overloads with generics can make error messages unreadable. Prefer clear names when types collide (`decodeJSON` vs `decodePlist`).

---

## Nested functions

```swift
func process() {
    func helper() { }
    helper()
}
```

Useful for local reuse without polluting the type. They capture enclosing bindings like closures.

---

## Discardable results

```swift
@discardableResult
func save() -> Bool { true }
```

Without this, unused return values warn. Use when ignoring the result is reasonable (`print` does not need it because it returns `Void`).

---

## Common function mistakes

```text
❌ 15-parameter functions with Boolean flags
✅ Split; use an Options struct

❌ Default parameters that hide the current user / current date
✅ Inject Date, Calendar, UserSession for tests

❌ inout plus async
✅ Return a new value or isolate mutation on an actor
```

## Quick Revision — Functions

- External vs internal names; `_` hides the label
- Default and variadic parameters
- `inout` is explicit mutation of a value
- Functions are values: `(A) -> B`

## One-minute explanation

“A Swift function is a named typed transformation. Call sites read like English because of argument labels. I pass values, not hidden globals. If I need mutation of a struct, I either return a new value or use `inout`/`mutating` deliberately.”

---

# Closures

```text
Experience: 0–2
Advanced understanding: 2–4 / 4+
Category: Swift
Difficulty: Intermediate
Importance: Critical
```

**Why the level spans:** Syntax is junior. Capture lists, escaping, and retain cycles are mid-level. How closures interact with actors, `@Sendable`, and SwiftUI `Task` is senior.

## What a closure is

A closure is an **anonymous function** that **captures** values from the surrounding context.

```swift
let add: (Int, Int) -> Int = { a, b in
    a + b
}

add(2, 3)  // 5
```

### Syntax breakdown

```text
let add              → binding
: (Int, Int) -> Int  → function type annotation
= { a, b in          → closure; parameters a and b; `in` separates params from body
    a + b            → body, implicit return
}
```

Shorthand:

```swift
let add: (Int, Int) -> Int = { $0 + $1 }
```

```text
$0  → first argument
$1  → second argument
```

Use `$0` for tiny closures. Named parameters for anything you will read twice.

### Why closures exist

To pass behaviour: completion handlers, `map`, animations, SwiftUI `Button` actions, `Task` bodies.

### Functions vs closures

Named functions are closures with a name and no capture unless nested. Closures can capture. Closures can be created inline.

---

## Trailing closures

```swift
names.map { $0.uppercased() }

UIView.animate(withDuration: 0.25) {
    view.alpha = 1
}
```

If the last argument is a closure, it can sit outside the parentheses. Multiple trailing closures (Swift 5.3+):

```swift
Button("Save") {
    save()
} onLongPress: {
    showDetails()
}
```

### Why we write them

Readability. The call looks like a custom control structure.

### When not to

When there are several closures of similar importance and labels would be clearer inside the parens.

---

## Escaping vs non-escaping

```text
Experience: 2–4
Importance: Critical
```

By default, a function-parameter closure is **non-escaping**: it must be used before the function returns.

```swift
func render(_ draw: () -> Void) {
    draw()
}
```

If the closure is stored and called later, it **escapes**:

```swift
var handlers: [() -> Void] = []

func onNext(_ handler: @escaping () -> Void) {
    handlers.append(handler)
}
```

### Syntax breakdown

```text
@escaping  → this closure may outlive the function call
```

### Why `@escaping` exists

The compiler must know whether captured `self` needs to be retained beyond the call. Non-escaping closures can be optimised and do not require explicit `self.` in many cases.

### What happens if we don't write `@escaping` when we store the closure

Compiler error. You cannot stash a non-escaping closure.

### Why we write `self.` inside escaping closures

It forces you to see that `self` is captured.

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

### Autoclosures

```swift
func logIf(_ condition: @autoclosure () -> Bool, _ message: String) {
    if condition() {
        print(message)
    }
}

logIf(x > 10, "big")   // x > 10 wrapped into a closure automatically
```

`assert` and `??` use autoclosures so expensive right-hand sides are delayed.

**Do not** use `@autoclosure` to hide heavy work in APIs that look like they take a `Bool`. It surprises callers.

---

## Capture semantics

```text
Experience: 2–4
Importance: Critical
```

Closures **capture** bindings they use. For value types, they capture the *value* (a copy) unless capturing a reference wrapper. For classes, they capture the *reference* (strong by default).

### Why closures capture

They may run later. They need the world they closed over.

### Strong capture (default)

```swift
class Session {
    var token = "abc"
    lazy var printer: () -> Void = {
        print(self.token)   // strong capture of self
    }
}
```

`lazy var` closures that capture `self` are a classic retain cycle: `Session` → `printer` → `Session`.

### Capture lists: `weak` and `unowned`

```swift
network.load { [weak self] data in
    guard let self else { return }
    self.render(data)
}
```

```text
[weak self]     → capture as Optional weak; does not increment ARC count
[unowned self]  → capture as non-optional unowned; does not increment ARC
[self]          → explicit strong capture (Swift 5.3+) for clarity
[token]         → capture the current value of token (copy of that binding)
```

Capturing a value snapshot:

```swift
var count = 0
let show = { [count] in print(count) }
count = 5
show()  // 0
```

Without `[count]`, the closure would see `5` if `count` is a `var` captured by reference... **Careful:** local `var` captured by a closure is a **reference to that variable** (heap-allocated box), not a copy, unless you put it in the capture list.

This is a favourite interview trap.

```swift
var count = 0
let increment = { count += 1 }
increment()
increment()
print(count)  // 2
```

### `weak` vs `unowned` (preview; full treatment in Memory Management)

| | `weak` | `unowned` |
| --- | --- | --- |
| Type | Optional | Non-optional |
| When object dies | Becomes `nil` | Dangling — crash if used |
| Use when | Lifetime unknown | Lifetime guaranteed longer than closure |

### Retain cycles with escaping closures

```text
Object A strongly owns a closure
Closure strongly captures A
Neither deallocates
```

Fix: `[weak self]` or break the ownership (do not store the closure on `self`).

### `@Sendable` closures

```text
Experience: 4+
```

```swift
Task { @Sendable in
    // must only capture Sendable values
}
```

Concurrent closures must not capture mutable unsynchronised state. Swift 6 diagnostics will stop you. See Concurrency.

---

## Multiple examples

### Example 1 — Basic

```swift
let squares = [1, 2, 3].map { $0 * $0 }
```

### Example 2 — Real-world

```swift
func fetchUser(id: String, completion: @escaping (Result<User, Error>) -> Void) {
    session.dataTask(with: url(for: id)) { data, response, error in
        // parse on this queue, then:
        completion(.success(user))
    }.resume()
}
```

Modern replacement: `async throws -> User` (see Concurrency). Know both.

### Example 3 — Interview (capture)

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

They all see the **same** `i`, which is `3` after the loop. Capture list `{ [i] in i }` would snapshot.

(In a `for i in 0..<3` with a new `i` each time, behaviour differs. Know the difference.)

---

## Closures in SwiftUI

```swift
Button("Tap") {
    count += 1   // mutates @State; compiler synthesises the right access
}
```

SwiftUI action closures are typically non-escaping at the call, but the framework stores them. Do not capture a view struct expecting identity to persist; capture the data you need, or use `let action` from outside.

---

## Common closure mistakes

```text
❌ Strong self in stored escaping closures
✅ [weak self] or structure so the closure is not owned by self

❌ Nested trailing closures nobody can parse
✅ Named functions

❌ Assuming { i } copies i
✅ Capture list [i] to snapshot

❌ @autoclosure on a public API that looks like a Bool
✅ Take an explicit () -> Bool if delayed evaluation matters
```

## Must Know

- Trailing closure syntax
- `@escaping`
- Capture lists
- Retain cycles
- `$0` vs named params

## Interview questions

**Q: What is an escaping closure?**  
**Expected:** A closure that can be called after the function returns; marked `@escaping`; can create retain cycles.  
**Follow-up:** “Why is `self.` required there?”  
**Follow-up:** “`weak` or `unowned` here?”

**Q: Does a closure copy a struct it uses?**  
**Expected:** It captures the binding. For a local `var`, mutation is shared unless you snapshot in the capture list. For a `let` struct, the value is fixed.

## One-minute explanation

“A closure is a function plus the values it closed over. If it runs later, it is escaping and can keep objects alive. I capture `[weak self]` when the object might die first, and I use capture lists to snapshot values when I do not want to share a variable.”

---
