# PART I — Swift

Swift is the language of iOS interviews. UI frameworks change; the language questions do not. A candidate who can explain optionals, value semantics, ARC, and concurrency will survive a weak SwiftUI round. A candidate who only memorised property wrappers will not.

This part starts at first principles. If you already know Swift, do not skip it. Read the **internal model**, **what happens if you don't**, and **interview traps**. That is where mid-level and senior candidates are separated.

---

# Swift Fundamentals

## `let` — Immutable Bindings

```text
Experience: 0–2
Advanced understanding: 2–4
Category: Swift
Difficulty: Beginner
Importance: Critical
```

**Why this level:** Every junior must use `let` by default. A 2–4 year candidate must additionally explain that `let` freezes the *binding*, not necessarily the *object*, and how that interacts with classes, collections, and SwiftUI.

### What it is

`let` declares a **constant binding**. You name a value once. You cannot point that name at a different value later.

```swift
let name = "Ravi"
```

### Syntax breakdown

```text
let     → keyword: create an immutable binding
name    → the name of the binding
=       → assignment at declaration
"Ravi"  → String literal, type inferred as String
```

### Why it exists

Programs are easier to reason about when names do not change meaning. The compiler can also prove more facts: if a binding cannot be reassigned, some mutations are impossible, some data races are harder to create, and some copies can be elided.

### Why we write it

- It documents intent: “this name will not be retargeted.”
- It is the Swift default style. Interviewers notice `var` used everywhere.
- For value types, immutability of the binding plus immutability of stored properties gives you a truly fixed value.

### What happens if we don't write it (`var` instead)

```swift
var name = "Ravi"
name = "Asha"   // allowed
```

The program still compiles. You lose:

- A compiler error when you accidentally reassign
- A signal to the next reader that the value is stable
- In some cases, an extra hint to the optimiser

Nothing “breaks” immediately. The cost is accidental mutation and weaker intent. In interviews, defaulting to `var` looks inexperienced.

### When to write it

Always, unless you have a concrete reason to reassign or mutate through that name.

### When to avoid it

When the binding must be retargeted (`currentUser = nextUser`) or when you must mutate a value-type property through that name (`user.age += 1` requires `var user` if `User` is a struct).

### Internal model

`let` is a **binding rule**, not a “freeze this object in RAM” rule.

```swift
class User {
    var age = 0
}

let user = User()
user.age = 31      // ✅ allowed: the object is mutable
user = User()      // ❌ not allowed: the binding cannot be retargeted
```

```text
let user ─────────────────────────────────────────┐
                                                  │
                    ┌──────────────┐              │
                    │  User object │◄─────────────┘
                    │  age = 31    │   (same identity)
                    └──────────────┘

Reassignment of `user` is forbidden.
Mutation of the object `user` points to is allowed if the class permits it.
```

For a struct, stored-property mutation is a mutation of the *value*, which requires a `var` binding:

```swift
struct User {
    var age: Int
}

let user = User(age: 30)
user.age = 31   // ❌ cannot mutate a let value-type
```

### Copying and `let`

```swift
let numbers = [1, 2, 3]
// numbers.append(4)  // ❌
```

Arrays are structs with copy-on-write. A `let` array cannot be mutated through that binding. Another `var` copy can mutate independently after a unique copy is made.

### SwiftUI relevance

```swift
struct ProfileView: View {
    let name: String          // input, not view state
    @State private var draft: String = ""
}
```

Use `let` for data the view **does not own and will not mutate**. Use `@State` (or another state wrapper) for data the view owns. Putting view-owned mutable data in `let` either will not compile (if you try to mutate) or will not persist (if you use a plain `var` without a wrapper — see State Management).

### Performance and memory

`let` vs `var` is not a meaningful allocation difference by itself. The win is intent and, for value types, avoiding accidental copies caused by mutation. Copy-on-write collections stay shared until mutated; a `let` binding cannot be the source of that mutation.

### Thread-safety

`let` of an immutable value type that contains only immutable stored properties is safe to share across threads (and is typically `Sendable`). `let` of a class instance is **not** automatically thread-safe. The reference is fixed; the object may still have races.

### Common mistakes

```text
❌ Using var for every property “just in case”
✅ Start with let; switch to var when mutation is required

❌ Believing let makes a class instance immutable
✅ let freezes the reference; class properties can still change

❌ let vs var as a performance optimisation story
✅ It is primarily a correctness and intent tool
```

### Interview questions

**Q: Why prefer `let` over `var`?**  
**Expected:** Default to immutability so the compiler catches accidental reassignment and the code documents stability.  
**Common wrong answer:** “`let` is faster.”  
**Follow-up:** “Does `let` make a class immutable?”  
**What they are testing:** Whether you distinguish binding immutability from object immutability.

**Q: Can you mutate properties of a class stored in a `let` constant?**  
**Expected:** Yes, if those properties are `var`. You cannot assign a new instance to the constant.  
**Follow-up:** “What about a struct?”

### One-minute explanation

“`let` creates an immutable binding. I cannot point that name at a new value. For structs that also means I cannot mutate stored properties through that name. For classes, the object can still change; only the reference is fixed. I use `let` unless I have a reason to mutate or reassign.”

---

## `var` — Mutable Bindings

```text
Experience: 0–2
Category: Swift
Difficulty: Beginner
Importance: Critical
```

### What it is

`var` declares a **mutable binding**. You may reassign it, and if it holds a value type you may mutate that value in place.

```swift
var count = 0
count += 1
```

### Syntax breakdown

```text
var      → mutable binding
count    → name
= 0      → initial value, inferred as Int
```

### Why it exists

State changes. Counters, flags, accumulators, and draft text are mutable.

### What happens if we don't write it

If you need mutation and used `let`, you get a compile-time error: `Cannot assign to value: 'count' is a 'let' constant`. That error is a feature.

### When to write it

When reassignment or in-place mutation of a value type is part of the design.

### When to avoid it

When the name should be stable. Mutable bindings increase the set of possible program states.

### Mutating methods and `var`

```swift
struct Counter {
    var value = 0
    mutating func bump() {
        value += 1
    }
}

var c = Counter()
c.bump()          // ✅

let frozen = Counter()
frozen.bump()     // ❌ mutating method requires var
```

`mutating` exists because mutating a struct is semantically replacing the whole value. That is only legal if the binding is `var`.

### Common mistakes

```text
❌ var everything, then never mutate
✅ let by default

❌ var on a protocol property that should be get-only
✅ Use { get } unless mutation is in the contract
```

### Interview trap

“If I use `var`, Swift copies more.” Not automatically. Copies of value types happen on assignment and on mutation of COW containers when the buffer is shared. `var` only *allows* mutation.

---

## Constants vs Variables (the interview version)

```text
Experience: 0–2
Advanced understanding: 2–4
Importance: Critical
```

| | `let` | `var` |
| --- | --- | --- |
| Reassign name | No | Yes |
| Mutate struct stored properties | No | Yes |
| Mutate class stored properties | Yes, if those properties are `var` | Yes |
| Signal to reader | Stable | May change |
| SwiftUI inputs | Prefer `let` | Only if the view mutates without a wrapper (rare/wrong) |

**Junior must know:** prefer `let`.  
**Mid must know:** `let` + class is not immutable state; SwiftUI `let` properties are inputs, not `@State`.  
**Senior must know:** immutability is a concurrency and `Sendable` strategy, not a style fetish.

---

## Type Inference and Type Annotations

```text
Experience: 0–2
Category: Swift
Difficulty: Beginner
Importance: High
```

### What they are

The compiler can **infer** a type from context. You can also **annotate** the type explicitly.

```swift
let name = "Ravi"           // inferred: String
let name: String = "Ravi"   // annotated
```

### Syntax breakdown

```text
let name: String = "Ravi"
          ↑
          type annotation — the colon binds a type to the name
```

### Why inference exists

Swift is statically typed. Every binding has a type at compile time. Inference is a convenience so you do not repeat the obvious. It is **not** dynamic typing. The type is still fixed.

### Why we still write annotations

- Function signatures (parameters and return types) — required
- Empty collections (`[]` is ambiguous)
- Protocols / existentials (`let error: Error`)
- When inference picks `Double` vs `CGFloat` vs `Int` incorrectly
- Public API clarity

### What happens if we don't annotate

Usually nothing — inference succeeds. When it fails:

```swift
let items = []
// error: empty collection literal requires an explicit type
```

```swift
let items: [String] = []
```

### When inference is dangerous in interviews

```swift
let x = 1        // Int, not Double
let y = 1.0      // Double
let z = 1 + 1.0  // Double (via overload)
```

Mixing `CGFloat` and `Double` used to be painful. In modern Swift they are often interchangeable on Apple platforms, but **do not claim they are the same type in every Swift context**.

### `any` and `some` are not “inference”

```swift
let view: some View = Text("Hi")   // opaque type
let erased: any View = Text("Hi")  // existential
```

These are type-level features. See [some vs any](#some-view-vs-any-view).

### Interview question

**Q: Is Swift strongly typed if it infers types?**  
**Expected:** Yes. Inference fills in static types. Runtime values are not free to change type.  
**Wrong:** “Swift is like Python because it infers.”

---

## Basic Data Types

```text
Experience: 0–2
Category: Swift
Difficulty: Beginner
Importance: High
```

Swift’s core value types are structs (or enums, for `Optional` and `Bool` historically as a struct-like value). Treat them as **values**.

### `Int`

Whole numbers. Size is platform-dependent (`Int` is the word size: 64-bit on modern iPhones).

```swift
let score: Int = 10
```

Why it exists: indexing, counts, IDs that are integers.  
When not to use: money (use `Decimal`), bits of a file protocol (use `UInt8` / `Data`), very large integers (`Double` is the wrong escape hatch; consider a dedicated type).

**Trap:** `Int` overflow traps in debug (and by default in Swift, overflow is a runtime error unless you use overflowing operators `&+`).

```swift
let a = Int.max
// let b = a + 1  // crash in typical builds
let b = a &+ 1    // wraps
```

**Interview:** “What’s the difference between `Int` and `Int64`?” On 64-bit, they are the same width, but `Int` is the idiomatic index type. Use fixed-width types when the width is part of a file format or network protocol.

### `Double` and `Float`

```swift
let pi = 3.14159          // Double by default
let f: Float = 3.14159
```

`Double` is 64-bit IEEE-754. `Float` is 32-bit. Prefer `Double` unless an API demands `Float` (some older graphics APIs).

**Never use binary floating point for currency.**

```swift
let total = 0.1 + 0.2
// not exactly 0.3
```

Use `Decimal` for money.

### `Bool`

```swift
let isLoggedIn = false
```

Only `true` and `false`. No truthy integers.

**Trap:** `if optionalBool` does not compile. Optionals are not Booleans.

### `String` and `Character`

```swift
let name = "Ravi"
let first: Character = "R"
```

`String` is a collection of `Character` (extended grapheme clusters), not UTF-16 code units. Counting and indexing are **not O(1)** in the way C `char*` indexing is.

```swift
let flag = "🇮🇳"
flag.count              // 1 Character (one grapheme cluster, conceptually a flag)
Array(flag.utf8).count  // more than 1
```

```text
Why this level spans 0–2 and 2–4:
Junior: String is text; use interpolation; know Character vs String.
Mid: indexing is String.Index; avoid String.Index arithmetic in hot loops;
     know unicode equality vs canonical equivalence at a high level.
```

**Syntax: interpolation**

```swift
let greeting = "Hello, \(name)"
```

```text
\(name) → interpolates a value into a String
```

**Why not `+` for everything?** Interpolation is clearer. `+` on strings creates new strings; in a loop, prefer `map`/`joined` or building via interpolation in one shot. For huge builders, `String` is still copy-on-write; the real issue is accidental quadratic concatenation in a naive loop.

**Mutating strings**

```swift
var s = "Hello"
s.append("!")
```

Requires `var`. `String` is a struct with COW.

**When not to use `String` for identity:** if the value is an ID, consider a dedicated `struct UserID: Hashable`. Strings as IDs compile but invite mixing `"user"` and `"email"`.

### Type summary table

| Type | Kind | Default literal | Interview note |
| ---- | ---- | --------------- | -------------- |
| `Int` | struct | `42` | Word-sized signed integer |
| `Double` | struct | `3.14` | Default floating literal |
| `Float` | struct | needs annotation | Prefer `Double` |
| `Bool` | struct | `true`/`false` | Not optional |
| `String` | struct | `"text"` | Unicode, COW |
| `Character` | struct | `"A"` as Character | Grapheme cluster |
| `Decimal` | struct | via `Decimal(string:)` | Money |

---

## Collections: Array

```text
Experience: 0–2
Advanced understanding: 2–4
Category: Swift
Difficulty: Beginner
Importance: Critical
```

### What it is

An ordered collection of values of the same type. `Array` is a **struct** with **copy-on-write**.

```swift
var names = ["Ravi", "Asha"]
names.append("Dev")
```

### Syntax breakdown

```text
var names = ["Ravi", "Asha"]
var          → mutable binding (needed to append)
names        → binding
=            → assignment
["Ravi", …]  → array literal, inferred [String]
```

Empty array:

```swift
let empty: [String] = []
let also = [String]()
```

### Why it exists

Ordered lists: screens of rows, decoded JSON arrays, queued work.

### Why we use it

O(1) random access by `Int` index. Iteration preserves order. Codable support is excellent.

### When not to use it

- Unique membership tests on large data → `Set` (O(1) average)
- Key/value lookup → `Dictionary`
- Huge ordered unique sets with log operations → maybe a sorted structure, not a linear `Array.contains` in a hot loop

### Internal model (copy-on-write)

```text
var a = [1, 2, 3]
var b = a          // no deep copy yet; buffer shared
b.append(4)        // unique buffer now; a unchanged
```

```text
Before mutation:
  a ──┐
      ├──► buffer [1, 2, 3]
  b ──┘

After b.append(4):
  a ──► [1, 2, 3]
  b ──► [1, 2, 3, 4]
```

**What happens if we don't use COW (mental model)?** If every assignment deep-copied, passing arrays into functions would be expensive. COW makes “value semantics” cheap until mutation.

### Common operations

```swift
names[0]
names.count
names.isEmpty
names.append("Zed")
names.insert("Ann", at: 0)
names.remove(at: 1)
names.map { $0.uppercased() }
names.filter { $0.hasPrefix("A") }
names.reduce(0) { $0 + $1.count }
```

### Bounds

```swift
let x = names[10]  // trap / crash if out of range
```

Prefer `names[safe:]` only if you wrote it; Swift has no built-in safe subscript. Use `indices.contains` or `first`/`last`.

### Performance

| Operation | Typical cost |
| --------- | ------------ |
| subscript get | O(1) |
| append (amortised) | O(1) |
| insert at 0 | O(n) |
| `contains` (no Hashable set) | O(n) |
| `map` | O(n) |

### Thread-safety

`Array` is not thread-safe. Concurrent mutation of a shared array is undefined. Share **immutable** arrays (`let`) freely if elements are `Sendable`. Mutate on one actor or serial queue.

### Interview questions

**Q: Are arrays passed by value?**  
**Expected:** Semantically yes (value type). Physically, COW shares storage until mutation.  
**Wrong:** “Arrays are classes” or “always a full copy.”

**Q: Why is `insert(at: 0)` slow?**  
**Expected:** Elements must shift. Use `Deque` (swift-collections) or reverse the model if you always insert at front.

---

## Collections: Set

```text
Experience: 0–2
Advanced understanding: 2–4
Category: Swift
Difficulty: Beginner
Importance: High
```

### What it is

An unordered collection of **unique** `Hashable` values.

```swift
var tags: Set<String> = ["swift", "ios"]
tags.insert("swift")  // no-op uniqueness
```

### Why it exists

Membership, uniqueness, set algebra (`union`, `intersection`, `subtracting`).

### When to use

Deduplicating IDs, “is this permission granted?”, fast `contains`.

### When not to use

When order matters (unless you also keep an array). When values are not `Hashable`.

### What happens if we use Array instead

`array.contains` is O(n). Duplicates sneak in. Interviewers love: “the API returns duplicate posts — how do you unique them?” `Set` is the first correct answer; stable order needs `Array` + `Set` seen-tracker.

### Hashable contract

If you implement `Hashable` incorrectly (hash depends on a mutable field you then change while the value is in a set), the set breaks. Prefer synthesised `Hashable` on structs of `Hashable` properties.

---

## Collections: Dictionary

```text
Experience: 0–2
Advanced understanding: 2–4
Category: Swift
Difficulty: Beginner
Importance: Critical
```

### What it is

A hash map from `Hashable` keys to values.

```swift
var ages = ["Ravi": 31, "Asha": 28]
ages["Dev"] = 40
let ravi = ages["Ravi"]   // Int?  ← optional
```

### Syntax breakdown

```text
ages["Ravi"]  → subscript returns Optional because the key may be missing
```

### Why the subscript is optional

Missing keys are normal. Force-unwrapping dictionary lookups is a classic crash.

```swift
let age = ages["Ravi"] ?? 0
if let age = ages["Ravi"] { ... }
```

### Why it exists

Indexed lookup by identity (user ID → user), grouping, caches, JSON objects.

### When not to use

Tiny fixed mappings that are really an enum. Ordered mappings (Dictionary order is the order of insertion in current Swift, but **do not depend on it for business rules** unless you have a documented need; if order is a requirement, make it explicit with an array of keys).

### `default:` subscript

```swift
ages["Sam", default: 0] += 1
```

Creates the key if missing. Excellent for counting.

### Nested dictionaries and JSON

Decoded JSON objects become `[String: Any]` only if you skip Codable. Prefer `Codable` models. `[String: Any]` is an interview smell unless you are writing a generic JSON explorer.

### Thread-safety

Same as Array: not thread-safe. A cache dictionary needs a lock, actor, or concurrent queue with barrier writes.

---

## Tuples

```text
Experience: 0–2
Category: Swift
Difficulty: Beginner
Importance: Medium
```

```swift
let pair = (name: "Ravi", age: 31)
pair.name
let (name, age) = pair
```

### Why they exist

Lightweight grouping: multiple return values, temporary pairs.

### When not to use

When the grouping has meaning over time. Then you want a `struct`. Tuples cannot conform to protocols (except in limited compiler-magic ways), cannot be easily reused in APIs, and make Codable painful.

### Interview trap

Returning `(String, String)` for `(first, last)` — argument labels help, but a `struct Name` is clearer.

```swift
func splitName(_ full: String) -> (first: String, last: String)
```

Fine for internal helpers. Public API: prefer a type.

---

# Optionals

```text
Experience: 0–2
Advanced understanding: 2–4
Category: Swift
Difficulty: Beginner
Importance: Critical
```

**Why this is Critical:** Optionals are the most common junior crash source and the most common “explain this” language question.

## What an optional is

An optional is a type that can hold **a value or no value**. It is not a pointer. It is an enum:

```swift
enum Optional<Wrapped> {
    case none
    case some(Wrapped)
}
```

`Int?` is sugar for `Optional<Int>`.

```swift
var username: String? = nil
username = "ravi"
```

### Syntax breakdown

```text
String?     → Optional<String>
nil         → Optional.none
"ravi"      → assigned as .some("ravi") via implicit wrapping
```

### Why it exists

Objective-C had pointers that could be `nil` and also implicit conversions that hid crashes. Swift makes absence **explicit in the type system** so you handle it at compile time.

### Why we use it

- Dictionary lookup
- Failable init (`Int("abc")`)
- Delegate that might not be set
- JSON fields that may be missing
- Search that may not find a row

### What happens if we don't use it

You would need sentinel values (`""`, `-1`, `0`). Those collide with real data. Interviewers will ask: “Why not use `-1` for missing age?” Because `-1` is a valid integer and will leak into UI and analytics.

### When not to use it

Do not make everything optional “because it might fail.” If a `User` always has an `id` after login, use `String`, not `String?`. Optionality is part of the domain model.

---

## `nil`

`nil` is the absence of a value **for an optional**. You cannot assign `nil` to a non-optional `String`.

```swift
var name: String = "Ravi"
// name = nil  // ❌
```

`nil` is not a pointer. It is `.none`.

---

## Optional binding: `if let`

```swift
if let username {
    print(username)  // String, not String?
}
```

Shorthand for `if let username = username` when names match.

### Why we write it

To convert `Wrapped?` into `Wrapped` in a scope where it is guaranteed.

### What happens if we don't

You keep carrying `String?` and either force unwrap (crash) or sprinkle `?` until the compiler stops you from calling APIs that need `String`.

### When to avoid `if let`

When the rest of the function cannot proceed without the value — use `guard let` instead, to keep the happy path unindented.

---

## `guard let`

```swift
func greet(_ name: String?) {
    guard let name, !name.isEmpty else {
        return
    }
    print("Hello, \(name)")
}
```

### Syntax breakdown

```text
guard let name    → unwrap or leave
, !name.isEmpty   → extra condition (comma is boolean AND in guard/if)
else { return }   → must exit the scope (return, throw, break, continue, or fatalError)
```

### Why it exists

Early exit. The unwrapped value is in scope **after** the `guard`, for the rest of the function.

### `if let` vs `guard let`

| | `if let` | `guard let` |
| --- | --- | --- |
| Unwrapped scope | Inside the `if` block | Rest of the function |
| Typical use | Optional branch | Preconditions |
| Indentation | Increases | Happy path stays left |

**Interview expected sentence:** “`guard` enforces preconditions and keeps the golden path flat.”

---

## Nil coalescing `??`

```swift
let display = username ?? "Guest"
```

```text
??  → if left is .some, unwrap; else evaluate right
```

Right side is an **autoclosure**. It is only evaluated if needed.

```swift
let display = username ?? expensiveDefault()
```

`expensiveDefault()` does not run if `username` is non-nil.

### When not to use `??`

When the default hides a bug. `user.id ?? ""` can send empty IDs to analytics. Prefer failing explicitly if absence is illegal.

---

## Optional chaining `?`

```swift
let city = user?.address?.city
```

If any step is `nil`, the whole expression is `nil`. The type becomes optional even if `city` was `String`.

```swift
let count = names?.count   // Int?
```

### Why we write it

To probe a chain of optional relationships without nested `if let`.

### What happens if we don't

Nested unwraps, or force unwraps, or a crash.

### Trap

```swift
user?.logout()
```

If `user` is `nil`, **nothing happens**. That can be a silent bug. Sometimes you wanted `guard let user else { return }` so a missing user is a real control-flow event.

---

## Force unwrap `!`

```swift
let name = username!
```

### Why it exists

When you, the programmer, have a proof the compiler does not: immediately after a check the compiler cannot see, or in tests, or in `@IBOutlet` (implicitly unwrapped — see below).

### What happens when you use it wrongly

If the value is `nil`, the process traps. In production that is a crash.

### When to avoid it

Almost always in app code. Prefer `guard let` / `if let` / `??`.

### When it is acceptable

- After a local invariant you just established and cannot express in types
- `Bundle.main.url(forResource:withExtension:)` for a file you ship in the app bundle (still can fail if the file is missing from the target)
- Test code where a crash is a test failure

**Senior note:** A force unwrap is a **deliberate crash**. That can be better than continuing with corrupt state (fail loud). It is still usually the wrong tool versus `fatalError("message")` which documents why.

---

## Implicitly unwrapped optionals `Type!`

```swift
var label: UILabel!
```

This is `Optional<UILabel>` that unwraps automatically. It still can be `nil` and then crash on use.

### Why it exists

UIKit storyboards: outlets are `nil` until the view is loaded, then they are set. The type system cannot express “nil only before `viewDidLoad`” without IUO or wrapping.

### Modern SwiftUI

You almost never need IUOs. Prefer regular optionals or non-optionals.

### What happens if we use IUO as a shortcut for “I’ll set it later”

You reinvent crashes. Use `let` with an initializer, or `lazy var`, or a proper optional.

---

## Multiple examples

### Example 1 — Basic

```swift
func int(from text: String) -> Int? {
    Int(text)
}

if let n = int(from: "42") {
    print(n + 1)
}
```

### Example 2 — Real-world

```swift
struct APIUser: Decodable {
    let id: String
    let middleName: String?   // genuinely optional in the API
}

func displayName(for user: APIUser, first: String, last: String) -> String {
    if let middle = user.middleName, !middle.isEmpty {
        return "\(first) \(middle) \(last)"
    }
    return "\(first) \(last)"
}
```

### Example 3 — Interview trap

```swift
var a: Int? = 0
var b: Int? = nil

if a != nil { print("a has a value") }  // prints, even though value is 0
if b != nil { print("b has a value") }  // does not print
```

`0` is not `nil`. Candidates who treat optionals like Booleans fail this.

Another trap:

```swift
let x: Int! = nil
print(x + 1)  // crash
```

---

## Optional map and flatMap

```text
Experience: 2–4
Importance: High
```

```swift
let text: String? = "42"
let doubled = text.flatMap(Int.init).map { $0 * 2 }  // Int?
```

Use these to transform without extra `if let` when the pipeline is still optional.

---

## Common optional mistakes

```text
❌ Force unwrap because “it should never be nil”
✅ If it should never be nil, use a non-optional type

❌ if optional == true   for Bool?
✅ if optional == true is actually valid for Bool?, but prefer
   `== true` consciously or unwrap; `if optional` does not compile

❌ Optional chaining that swallows errors
✅ guard + throw or return a Result

❌ String? for "no text" when empty string is the domain
✅ Use "" or an enum { empty, text(String) }
```

## Quick Revision — Optionals

- `T?` is `Optional<T>`: `.none` or `.some(T)`
- Unwrap with `if let`, `guard let`, `??`, `?`, rarely `!`
- `nil` is not a pointer
- Absence should be modelled; illegal absence should not be optional

## Must Know

`if let` vs `guard let` vs `??` vs `?` vs `!`

## One-minute explanation

“An optional is an enum that is either a value or nothing. Swift forces me to handle both. I unwrap with `guard`/`if let`, provide defaults with `??`, probe with `?`, and only force unwrap when a crash is the honest failure.”

---
