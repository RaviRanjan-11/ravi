# PART I — Swift

Swift is the language of iOS interviews. UI frameworks change; the language questions do not. A candidate who can explain optionals, value semantics, ARC, and concurrency will survive a weak SwiftUI round. A candidate who only memorised property wrappers will not.

This part starts at first principles. If you already write Swift every day, still read it. The syntax will feel familiar. The parts that separate mid-level from senior are the internal models: what a binding actually freezes, why an array assignment is cheap until you mutate, and what goes wrong when absence is modelled as `-1` instead of `Optional`.

---

# Swift Fundamentals

## `let` — Immutable Bindings

Interviews ask this from day one, and they are not testing whether you know the keyword. They want to know whether you understand that `let` freezes a *name*, not necessarily an *object*.

`let` creates a constant binding. You point a name at a value once. You cannot later point that same name at a different value.

```swift
let name = "Ravi"
```

That looks trivial, and it is, until you meet a class. Programs are easier to reason about when names do not change meaning halfway down a function. The compiler can also prove more: if a binding cannot be reassigned, some mutations are impossible, some data races are harder to create, and some copies can be elided. None of that is why you write `let` in an interview, though. You write it because it documents intent — “this name will not be retargeted” — and because defaulting to `var` everywhere looks inexperienced.

Use `let` unless you have a concrete reason to reassign the name or to mutate a value type through it. The reason to switch to `var` is specific: `currentUser = nextUser`, or `user.age += 1` when `User` is a struct. “I might need to change it later” is not a reason.

The trap is treating `let` as “freeze this object in RAM.” It is a binding rule.

```swift
class User {
    var age = 0
}

let user = User()
user.age = 31      // allowed: the object is mutable
user = User()      // not allowed: the binding cannot be retargeted
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

For a struct, stored-property mutation *is* mutation of the value. That requires a `var` binding:

```swift
struct User {
    var age: Int
}

let user = User(age: 30)
user.age = 31   // cannot mutate a let value-type
```

Collections follow the same rule, with copy-on-write underneath. Arrays are structs. A `let` array cannot be mutated through that binding. Another `var` copy can mutate independently after a unique buffer is made.

```swift
let numbers = [1, 2, 3]
// numbers.append(4)  // not allowed
```

In SwiftUI, `let` is how a view receives data it does not own:

```swift
struct ProfileView: View {
    let name: String          // input, not view state
    @State private var draft: String = ""
}
```

Use `let` for data the view will not mutate. Use `@State` (or another state wrapper) for data the view owns. A plain `var` on a `View` without a wrapper is not persistent state — the struct is recreated constantly, so that `var` resets. Trying to mutate a `let` will not compile. The full picture lives in State Management; the language rule here is simply: inputs are `let`, owned mutable state is a wrapper.

`let` versus `var` is not a meaningful allocation difference by itself. The win is intent and, for value types, avoiding accidental copies caused by mutation. Copy-on-write collections stay shared until mutated; a `let` binding cannot be the source of that mutation.

On threads: a `let` of an immutable value type that contains only immutable stored properties is safe to share (and is typically `Sendable`). A `let` of a class instance is **not** automatically thread-safe. The reference is fixed; the object may still have races.

The usual mistakes are using `var` for every property “just in case,” believing `let` makes a class instance immutable, and telling an interviewer that `let` is a performance optimisation. Start with `let`. Switch when mutation is required. Know that a frozen reference is not a frozen object.

### Why prefer `let` over `var`?

Default to immutability so the compiler catches accidental reassignment and the next reader can trust that the name is stable. I would never lead with “`let` is faster.” Allocation is not the point. The point is a smaller set of possible program states, and a compile error instead of a silent change.

The follow-up is almost always whether `let` makes a class immutable. It does not. `let user = User()` freezes the reference; `user.age = 31` is still legal if `age` is a `var` on the class. For a struct, the same mutation is illegal, because changing a stored property replaces the value, and a `let` value cannot be replaced.

### Can you mutate properties of a class stored in a `let` constant?

Yes, if those properties are `var`. You cannot assign a new instance to the constant. Think of `let` as locking the arrow, not the box the arrow points at. Two names can still alias the same object, and mutations through either name are visible to the other.

A struct is the opposite story. There is no independent object sitting on the heap with its own identity. Mutating `user.age` *is* mutating `user`, so the binding has to be `var`. If the interviewer then asks about an array of structs held in a `let`, the array cannot be mutated through that name either — `Array` is itself a struct.

---

## `var` — Mutable Bindings

`var` is the other half of the same idea: a name you are allowed to retarget, and — if it holds a value type — a value you are allowed to mutate in place.

```swift
var count = 0
count += 1
```

State changes. Counters, flags, accumulators, and draft text are mutable. That is why `var` exists. It is not the default style. Every extra mutable binding increases the set of possible program states, which is exactly why Swift pushes you toward `let` and makes the compiler complain when you try to assign through a constant.

If you need mutation and you wrote `let`, you get a compile-time error: `Cannot assign to value: 'count' is a 'let' constant`. That error is a feature. Write `var` when reassignment or in-place mutation of a value type is part of the design. Leave the name as `let` when it should be stable.

Mutating methods make the rule visible:

```swift
struct Counter {
    var value = 0
    mutating func bump() {
        value += 1
    }
}

var c = Counter()
c.bump()          // allowed

let frozen = Counter()
frozen.bump()     // mutating method requires var
```

`mutating` exists because mutating a struct is semantically replacing the whole value. That is only legal if the binding is `var`. A class method that changes a property does not need `mutating`; the object is already shared mutable state.

The two mistakes that show up in reviews: marking everything `var` and then never mutating it, and putting `var` on a protocol property that should be get-only. Use `{ get }` unless mutation is in the contract.

A related interview line is “if I use `var`, Swift copies more.” Not automatically. Copies of value types happen on assignment, and on mutation of copy-on-write containers when the buffer is shared. `var` only *allows* mutation. It does not, by itself, copy anything.

---

## Constants vs Variables (the interview version)

This is the same distinction, compressed into the table interviewers are mentally scoring you against.

| | `let` | `var` |
| --- | --- | --- |
| Reassign name | No | Yes |
| Mutate struct stored properties | No | Yes |
| Mutate class stored properties | Yes, if those properties are `var` | Yes |
| Signal to reader | Stable | May change |
| SwiftUI inputs | Prefer `let` | Only if the view mutates without a wrapper (rare/wrong) |

A junior must prefer `let`. A mid-level candidate must also know that `let` plus a class is not immutable state, and that SwiftUI `let` properties are inputs, not `@State`. A senior treats immutability as a concurrency and `Sendable` strategy, not a style fetish: an immutable value with immutable contents is something you can hand across isolation domains without a lock.

---

## Type Inference and Type Annotations

Swift is statically typed. Every binding has a type at compile time. Inference is a convenience so you do not repeat the obvious. It is **not** dynamic typing. The type is still fixed; the compiler just filled it in from context.

```swift
let name = "Ravi"           // inferred: String
let name: String = "Ravi"   // annotated
```

The colon binds a type to the name: `let name: String = "Ravi"`. You still write annotations where inference cannot see enough, or where the reader cannot. Function signatures — parameters and return types — require them. Empty collections are ambiguous (`[]` could be anything). Existentials need a name (`let error: any Error`). Public API is clearer with an explicit type. And sometimes inference picks `Double` versus `CGFloat` versus `Int` in a way that will not compile against the API you actually called.

When inference succeeds, omitting the annotation costs nothing. When it fails, you get a compile error rather than a runtime surprise:

```swift
let items = []
// error: empty collection literal requires an explicit type
```

```swift
let items: [String] = []
```

Literal inference is a favourite gotcha. `1` is `Int`, not `Double`. `1.0` is `Double`. `1 + 1.0` becomes `Double` via overload. Mixing `CGFloat` and `Double` used to be painful; on modern Apple platforms they are often interchangeable, but they are not the same type in every Swift context, and you should not claim they are.

`some` and `any` are not inference. They are type-level features:

```swift
let view: some View = Text("Hi")   // opaque type
let erased: any View = Text("Hi")  // existential
```

The compiler still knows an exact type for `some View` (you just cannot name it at the call site). `any View` is a box that can hold different concrete types. See [some vs any](#some-vs-any).

### Is Swift strongly typed if it infers types?

Yes. Inference fills in static types. A value’s type is decided at compile time and does not change at runtime. Saying “Swift is like Python because it infers” confuses a convenience of the type checker with dynamic typing. Python names can point at an `int` and later a `str`. A Swift `let name = "Ravi"` is a `String` forever; the compiler already committed to that.

The places you still annotate are the places the compiler cannot see, or the places a human should not have to guess: empty collections, public function signatures, and existentials.

---

## Basic Data Types

Swift’s core scalars are value types — structs, with `Optional` as the important enum. Treat them as values: assignment copies, mutation needs `var`, and there is no hidden identity.

### Integers

`Int` is a whole number whose size is the platform word — 64-bit on modern iPhones. You use it for indexing, counts, and integer IDs. You do not use it for money (`Decimal`), for the bytes of a file protocol (`UInt8` / `Data`), or as an escape hatch for numbers that do not fit (`Double` is the wrong next step; use a dedicated type).

```swift
let score: Int = 10
```

Overflow traps in typical builds. That is a runtime error, not wraparound, unless you opt into overflowing operators:

```swift
let a = Int.max
// let b = a + 1  // crash in typical builds
let b = a &+ 1    // wraps
```

On 64-bit, `Int` and `Int64` are the same width, but `Int` is the idiomatic index type. Use a fixed-width type when the width is part of a file format or network protocol, not because it “feels more precise.”

### Floating point

```swift
let pi = 3.14159          // Double by default
let f: Float = 3.14159
```

`Double` is 64-bit IEEE-754. `Float` is 32-bit. Prefer `Double` unless an API demands `Float` (some older graphics APIs still do). Never use binary floating point for currency.

```swift
let total = 0.1 + 0.2
// not exactly 0.3
```

Use `Decimal` for money. Construct it from a string or from an integer number of cents — not from a `Double` you already rounded wrong.

### Booleans

```swift
let isLoggedIn = false
```

Only `true` and `false`. There are no truthy integers. `if count` does not compile; you write `if count != 0`. The same rule bites people with `Bool?`: `if optionalBool` does not compile, because an optional is not a Boolean. Absence is not `false`.

### Strings and characters

```swift
let name = "Ravi"
let first: Character = "R"
```

`String` is a collection of `Character` values, and a `Character` is an extended grapheme cluster, not a UTF-16 code unit. Counting and indexing are **not** O(1) the way C `char*` indexing is.

```swift
let flag = "🇮🇳"
flag.count              // 1 Character (one grapheme cluster)
Array(flag.utf8).count  // more than 1
```

A junior needs interpolation, `Character` versus `String`, and the fact that `String` is a value type with copy-on-write. A mid-level candidate needs `String.Index`, should not do index arithmetic in a hot loop, and should know that Unicode equality is not “same bytes.”

Interpolation is the usual way to build text:

```swift
let greeting = "Hello, \(name)"
```

Prefer it over `+` for readability. `+` creates new strings; in a loop, prefer `map`/`joined` or building the string in one shot. `String` is still copy-on-write, so the real bug is accidental quadratic concatenation in a naive loop, not “strings are slow.”

Mutation requires `var`:

```swift
var s = "Hello"
s.append("!")
```

If the value is an identifier, consider a dedicated `struct UserID: Hashable` instead of `String`. Strings as IDs compile, and then someone passes an email to an API that wanted a user id.

| Type | Kind | Default literal | Interview note |
| ---- | ---- | --------------- | -------------- |
| `Int` | struct | `42` | Word-sized signed integer |
| `Double` | struct | `3.14` | Default floating literal |
| `Float` | struct | needs annotation | Prefer `Double` |
| `Bool` | struct | `true`/`false` | Not optional |
| `String` | struct | `"text"` | Unicode, copy-on-write |
| `Character` | struct | `"A"` as Character | Grapheme cluster |
| `Decimal` | struct | via `Decimal(string:)` | Money |

---

## Collections: Array

An `Array` is an ordered collection of values of the same type. It is a **struct** with **copy-on-write**. That combination is the whole interview: semantically a value, physically a shared buffer until someone mutates.

```swift
var names = ["Ravi", "Asha"]
names.append("Dev")
```

The binding has to be `var` to append. The literal `["Ravi", "Asha"]` infers `[String]`. Empty arrays need a type because `[]` is ambiguous:

```swift
let empty: [String] = []
let also = [String]()
```

You reach for `Array` when order matters: rows on a screen, decoded JSON arrays, a queue of work. Random access by `Int` index is O(1). Iteration preserves order. `Codable` support is excellent.

You do not use it as a uniqueness filter on large data — that is `Set`, average O(1) `contains`. You do not use it as a key/value map — that is `Dictionary`. And you do not call `Array.contains` in a hot loop on a large unordered unique collection; that is linear.

Copy-on-write is why passing arrays into functions is cheap:

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

If every assignment deep-copied, “value semantics” would be too expensive to use. Copy-on-write keeps the semantics and delays the cost until mutation. A `let` array can share its buffer forever, because nothing can mutate through that name.

The everyday operations are the ones you should be able to write without looking them up:

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

Out-of-range subscripts trap:

```swift
let x = names[10]  // trap / crash if out of range
```

Swift has no built-in safe subscript. Do not invent `names[safe:]` in an interview unless you say you would write it. Use `indices.contains`, or `first` / `last`.

| Operation | Typical cost |
| --------- | ------------ |
| subscript get | O(1) |
| append (amortised) | O(1) |
| insert at 0 | O(n) |
| `contains` (no Hashable set) | O(n) |
| `map` | O(n) |

`Array` is not thread-safe. Concurrent mutation of a shared array is undefined. Share **immutable** arrays (`let`) freely if the elements are `Sendable`. Mutate on one actor or on a serial queue.

### Are arrays passed by value?

Semantically yes — `Array` is a struct, so assignment and argument passing copy the value. Physically, copy-on-write shares the buffer until mutation, so the copy is cheap until someone writes. Arrays are not classes, and they are not “always a full copy.” Both of those answers fail the question.

If someone then asks why `insert(at: 0)` is slow: every element after the insertion point has to shift. If you always insert at the front, the model is wrong for `Array`. `Deque` from swift-collections, or reversing the representation, is the usual way out.

---

## Collections: Set

A `Set` is an unordered collection of **unique** `Hashable` values. Inserting a value that is already present is a no-op for membership.

```swift
var tags: Set<String> = ["swift", "ios"]
tags.insert("swift")  // still one "swift"
```

You want a set for membership, uniqueness, and set algebra — `union`, `intersection`, `subtracting`. Deduplicating IDs, “is this permission granted?”, and a fast `contains` are the everyday uses. You do not want a set when order matters (unless you also keep an array). You cannot put a value in a set if it is not `Hashable`.

The alternative is `Array`, and it is the wrong default for uniqueness. `array.contains` is O(n). Duplicates sneak in. Interviewers love: “the API returns duplicate posts — how do you unique them?” `Set` is the first correct answer. If you also need stable order, keep an `Array` and a `Set` of things already seen.

The `Hashable` contract is the mid-level follow-up. If you implement `Hashable` so the hash depends on a mutable field, and then you change that field while the value is in a set, the set breaks — lookups miss, uniqueness fails. Prefer synthesised `Hashable` on structs of `Hashable` properties, and do not mutate a value’s identity-relevant fields after insertion.

---

## Collections: Dictionary

A `Dictionary` is a hash map from `Hashable` keys to values. The subscript returns an optional because a missing key is normal, not exceptional.

```swift
var ages = ["Ravi": 31, "Asha": 28]
ages["Dev"] = 40
let ravi = ages["Ravi"]   // Int?
```

Force-unwrapping dictionary lookups is a classic crash. Missing keys happen. Handle them:

```swift
let age = ages["Ravi"] ?? 0
if let age = ages["Ravi"] { ... }
```

Dictionaries exist for indexed lookup by identity (user ID → user), grouping, caches, and JSON objects. They are the wrong tool for a tiny closed mapping that is really an enum. They are also the wrong tool if order is a business rule. Current Swift iterates dictionaries in insertion order, but that is not something to build product behaviour on unless you have documented it. If order matters, store an array of keys (or an array of pairs) and say so.

The `default:` subscript is the counting idiom:

```swift
ages["Sam", default: 0] += 1
```

It creates the key if missing, then lets you mutate the value in place. Excellent for histograms; easy to overuse as a way to hide missing-data bugs.

Decoded JSON objects become `[String: Any]` only if you skip `Codable`. Prefer `Codable` models. `[String: Any]` is an interview smell unless you are writing a generic JSON explorer.

Thread-safety is the same as `Array`: not thread-safe. A cache dictionary needs a lock, an actor, or a concurrent queue with barrier writes. Sharing a `let` dictionary of `Sendable` values is the cheap safe path.

---

## Tuples

A tuple is a lightweight grouping: a few values that travel together for a moment, often as multiple return values.

```swift
let pair = (name: "Ravi", age: 31)
pair.name
let (name, age) = pair
```

Labels at the call site help. That still does not make a tuple a type you want in a public API. Tuples cannot conform to protocols in the way a `struct` can (the compiler has limited magic; you should not rely on it), they are awkward to reuse, and they make `Codable` painful.

Returning `(String, String)` for first and last name is the usual trap. Argument labels help:

```swift
func splitName(_ full: String) -> (first: String, last: String)
```

Fine for an internal helper. If the grouping has meaning over time, write a `struct Name`. The moment you pass that pair through three layers, you wanted a type.

---

# Optionals

Optionals are the most common junior crash source and the most common “explain this” language question. Interviews ask them from day one.

## What an optional is

An optional is a type that can hold **a value or no value**. It is not a pointer. It is an enum:

```swift
enum Optional<Wrapped> {
    case none
    case some(Wrapped)
}
```

`Int?` is sugar for `Optional<Int>`. `nil` is `.none`. Assigning a wrapped value is `.some(...)` via implicit wrapping.

```swift
var username: String? = nil
username = "ravi"
```

Objective-C had pointers that could be `nil`, and implicit conversions that hid crashes. Swift makes absence **explicit in the type system** so you handle it at compile time. Dictionary lookup, failable initialisers (`Int("abc")`), a delegate that might not be set, a JSON field that may be missing, a search that may not find a row — those are optionals because absence is real.

The alternative is sentinel values: `""`, `-1`, `0`. Those collide with real data. “Why not use `-1` for missing age?” Because `-1` is a valid integer and will leak into UI and analytics. Optionality is part of the domain model, which is also why you should not make everything optional “because it might fail.” If a `User` always has an `id` after login, that field is `String`, not `String?`. Illegal absence should be unrepresentable.

---

## `nil`

`nil` is the absence of a value **for an optional**. You cannot assign `nil` to a non-optional `String`.

```swift
var name: String = "Ravi"
// name = nil  // not allowed
```

`nil` is not a pointer and not a null object. It is `.none`. Comparing a non-optional to `nil` does not compile. Asking “is this pointer null?” is the Objective-C sentence; the Swift sentence is “does this optional hold a value?”

---

## Optional binding: `if let`

```swift
if let username {
    print(username)  // String, not String?
}
```

That is shorthand for `if let username = username` when the names match. Inside the block you have a `String`, guaranteed. The whole point is to convert `Wrapped?` into `Wrapped` in a scope where the compiler will not let it become `nil` again.

If you skip binding, you keep carrying `String?` and either force-unwrap (crash) or sprinkle `?` until the compiler stops you from calling APIs that need `String`.

Avoid `if let` when the rest of the function cannot proceed without the value. That is `guard let`: early exit, happy path unindented.

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

`guard let name` unwraps or leaves. The comma is boolean AND in `guard`/`if`, so `!name.isEmpty` is an extra condition on the already-unwrapped value. The `else` must exit the scope — `return`, `throw`, `break`, `continue`, or `fatalError`. That is not pedantry; it is how the compiler knows the unwrapped `name` is safe for the rest of the function.

That last part is the difference from `if let`. The unwrapped value lives **after** the `guard`, on the golden path, without extra indentation.

| | `if let` | `guard let` |
| --- | --- | --- |
| Unwrapped scope | Inside the `if` block | Rest of the function |
| Typical use | Optional branch | Preconditions |
| Indentation | Increases | Happy path stays left |

The sentence interviewers want: “`guard` enforces preconditions and keeps the golden path flat.”

---

## Nil coalescing `??`

```swift
let display = username ?? "Guest"
```

If the left side is `.some`, you get the wrapped value. If it is `.none`, the right side is evaluated. The right side is an **autoclosure**. It only runs if needed.

```swift
let display = username ?? expensiveDefault()
```

`expensiveDefault()` does not run if `username` is non-nil. That is the same trick `assert` uses, and it is why `??` is not “just a ternary.”

Do not use `??` to hide a bug. `user.id ?? ""` can send empty IDs to analytics. If absence is illegal, fail explicitly — `guard let`, or throw, or `fatalError` with a message. Defaults are for genuine defaults, not for papering over a broken invariant.

---

## Optional chaining `?`

```swift
let city = user?.address?.city
```

If any step is `nil`, the whole expression is `nil`. The type becomes optional even if `city` was a non-optional `String`. The same happens with properties that are not optional on the wrapped type:

```swift
let count = names?.count   // Int?
```

Chaining is how you probe a chain of optional relationships without nested `if let`. The cost is silence. This is a real bug:

```swift
user?.logout()
```

If `user` is `nil`, **nothing happens**. Sometimes that is what you wanted. Often you wanted `guard let user else { return }` so a missing user is a real control-flow event — a log, a throw, an early return — not a no-op that looks like success.

---

## Force unwrap `!`

```swift
let name = username!
```

Force unwrap exists for the cases where you, the programmer, have a proof the compiler does not: immediately after a check the compiler cannot see, in tests, or with an implicitly unwrapped outlet that is about to be set by UIKit. If the value is `nil`, the process traps. In production that is a crash.

Almost always, app code should use `guard let`, `if let`, or `??` instead. Acceptable uses are narrow: a local invariant you just established and cannot express in types; `Bundle.main.url(forResource:withExtension:)` for a file you ship in the app bundle (still can fail if the file is missing from the target); test code, where a crash is a test failure.

A force unwrap is a **deliberate crash**. That can be better than continuing with corrupt state — fail loud. It is still usually the wrong tool versus `fatalError("missing bundled file X")`, which documents why you are willing to die here. “It should never be nil” is not a proof. If it should never be nil, the type should not be optional.

---

## Implicitly unwrapped optionals `Type!`

```swift
var label: UILabel!
```

This is still `Optional<UILabel>`. It unwraps automatically when you use it, and it still crashes if it is `nil`. The sugar hides the `?`, not the absence.

IUOs exist because of UIKit storyboards: outlets are `nil` until the view is loaded, then they are set. The type system cannot express “nil only before `viewDidLoad`” without an IUO or a regular optional you unwrap everywhere.

In SwiftUI you almost never need them. Prefer a regular optional or a non-optional that is set in an initialiser. Using `Type!` as a shortcut for “I’ll set it later” reinvents crashes. Use `let` with an initialiser, or `lazy var`, or a proper optional.

---

## Multiple examples

### Parsing text that might not be a number

```swift
func int(from text: String) -> Int? {
    Int(text)
}

if let n = int(from: "42") {
    print(n + 1)
}
```

`Int.init` is failable. The return type is `Int?` because `"abc"` has no integer value. Binding is how you get an `Int` you can add to.

### A field that is genuinely optional in an API

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

`id` is not optional: after decoding a user, you always have one. `middleName` is optional because the domain allows absence. Empty string and `nil` are both treated as “no middle name” here; that is a product decision, not a language one. Do not make `id` a `String?` “for safety.” That is the opposite of safety.

### Zero is not `nil`

```swift
var a: Int? = 0
var b: Int? = nil

if a != nil { print("a has a value") }  // prints, even though value is 0
if b != nil { print("b has a value") }  // does not print
```

`0` is a value. Candidates who treat optionals like Booleans fail this. `if a` does not compile, which is Swift doing you a favour.

The IUO version of the same crash:

```swift
let x: Int! = nil
print(x + 1)  // crash
```

The `!` in the type did not mean “this is never nil.” It meant “please crash on use if it is.”

---

## Optional map and flatMap

This is the 2–4 year version of unwrapping: transform the wrapped value without an extra `if let` when the pipeline should stay optional.

```swift
let text: String? = "42"
let doubled = text.flatMap(Int.init).map { $0 * 2 }  // Int?
```

`flatMap` on `Optional` takes `(Wrapped) -> U?` and flattens. `Int.init` returns `Int?`, so `map(Int.init)` would give `Int??`. `flatMap` collapses that. Then `map` doubles the `Int` if it is there. If `text` is `nil` or not a number, `doubled` is `nil`. Nothing crashed, and you did not nest bindings.

Use this when the pipeline is still optional. Use `guard let` when you need a non-optional for the rest of a function.

---

## Common optional mistakes

Force-unwrapping because “it should never be nil” is the crash factory. If it should never be nil, use a non-optional type. `if optional` does not compile for `Bool?`; `if optional == true` is valid but easy to misread — unwrap, or compare to `true` on purpose. Optional chaining that swallows errors (`user?.logout()`, `try?`) should be a `guard` plus throw, or a `Result`, when failure matters. And `String?` for “no text” is the wrong model if the domain already has empty string; use `""`, or an enum `{ empty, text(String) }` if empty and missing are different.

---

## Quick Revision — Optionals

`T?` is `Optional<T>`: `.none` or `.some(T)`. Unwrap with `if let` and `guard let`, provide defaults with `??`, probe with `?`, and only force unwrap when a crash is the honest failure. `nil` is not a pointer. Absence should be modelled; illegal absence should not be optional.

---

## Must Know

The five unwrapping tools, and when each is honest: `if let` for a local branch, `guard let` for preconditions, `??` for a real default, `?` for a chain that may be absent, `!` for a deliberate crash. If you can explain those five in a minute, including the `0 != nil` trap and `guard` versus `if`, you will pass the optional round.

---

## One-minute explanation

An optional is an enum that is either a value or nothing. Swift forces me to handle both. I unwrap with `guard` or `if let`, provide defaults with `??`, probe with `?`, and only force unwrap when a crash is the honest failure. I do not use sentinels, I do not make required fields optional, and I do not treat `nil` as a pointer.
