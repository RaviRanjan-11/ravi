# Structs, Classes, Enums, and Properties

```text
Experience: 0–2
Advanced understanding: 2–4 / 4+
Category: Swift
Difficulty: Intermediate
Importance: Critical
```

This chapter is the backbone of iOS interviews. If you only study one language chapter deeply, study this one.

---

## `struct` — Value types

```swift
struct User {
    var id: String
    var name: String
}

var a = User(id: "1", name: "Ravi")
var b = a
b.name = "Asha"
// a.name is still "Ravi"
```

### Syntax breakdown

```text
struct User   → named value type
var id        → stored property; mutation requires var instance
```

Memberwise initializer is synthesised if you do not write a custom `init`.

### Why structs exist

Independent copies. No shared mutable identity unless you introduce a class inside. Fits data: models, view state, coordinates, parsed JSON.

### Why SwiftUI prefers structs for views

A view is a **description** of UI for a moment in time, not a long-lived object. The framework can recreate the struct cheaply and keep **state storage** elsewhere. See SwiftUI Rendering.

### Internal model

Assignment copies. The copy is shallow at the Swift level; nested structs copy, nested classes copy the *reference*. Collections use COW.

```text
var a = User(...)
var b = a          // two independent User values

If User contains a class:
  both structs hold a reference to the SAME class instance
  (that is a common interview trap)
```

### When to use struct

- Models that are data
- SwiftUI `View`
- Small types (`CGPoint`-like)
- Anything you want copied when assigned

### When not to use struct

- Identity matters (`===`)
- You need inheritance (rare; prefer protocols)
- Shared mutable state is the point (then class or actor)
- Very large mutation-heavy graphs without COW — measure first; do not assume “struct is always faster”

### What happens if we use class instead

Shared mutation. Two screens holding the same `User` class will fight. That is sometimes what you want (`@Observable` model), often what you do not (decoded DTO).

---

## `class` — Reference types

```swift
class Session {
    var token: String
    init(token: String) { self.token = token }
}

let a = Session(token: "x")
let b = a
b.token = "y"
// a.token is "y"
```

```text
a ──┐
    ├──► Session (token = "y")
b ──┘
```

### Why classes exist

Identity, shared mutable state, Objective-C interoperability, UIKit (`UIView` is a class), deinitializers, inheritance.

### `===` vs `==`

```swift
a === b   // same instance
a == b    // Equatable value equality, if implemented
```

Structs do not have `===`.

### Inheritance

```swift
class Animal { }
class Dog: Animal { }
```

Swift classes are single-inheritance. Prefer protocols + composition.

`final class` prevents subclassing — slight performance win (devirtualisation) and a design statement.

### `deinit`

```swift
deinit {
    cancellable.cancel()
}
```

Only classes (and actors). Use for cleanup that is not ARC of other objects: cancelling a timer, removing an observer. Do not do heavy work or take locks carelessly. **Never assume `deinit` runs at a specific time on a specific thread** beyond “when last strong reference is gone” (and even then, autorelease pools and cycles delay it).

### When to use class

- UIKit / AppKit objects
- `@Observable` models (macro applies to classes)
- Shared services that have identity (a `URLSession` wrapper)
- Objects with `deinit` lifecycle

### When not to use class

Default data models in SwiftUI. If two views should not share mutation, use a struct.

---

## struct vs class (the interview table)

| | struct | class |
| --- | --- | --- |
| Semantics | Value | Reference |
| Copy | Independent (COW for collections) | Shared instance |
| Identity | No `===` | `===` |
| Inheritance | No | Yes |
| `deinit` | No | Yes |
| Thread-safety | Safer if immutable | Shared mutation races |
| SwiftUI View | Required (`View` is a struct protocol use) | Views are structs |
| Default in Swift | Prefer struct | When identity/sharing is required |
| Memory | Stack-ish / inline with COW heap buffers | Heap object + ARC |

**Junior:** “struct is copy, class is shared.”  
**Mid:** COW, nested class trap, SwiftUI state lifetime.  
**Senior:** ARC vs copies in hot paths; Sendable; actors instead of thread-safe classes.

### Performance implications

- Lots of large non-COW structs passed through many layers can copy. Profile.
- Classes pay ARC retain/release. In tight loops that can show up.
- Arrays of structs can be cache-friendly; arrays of classes are pointers.

### Memory implications

Class instances live on the heap and die when ARC hits zero. Structs live wherever their owner lives (stack frame, inside another object, inside an array buffer).

### Thread-safety implications

Immutable structs composed of Sendable fields are trivial to share. Classes need isolation (actor, MainActor, locks).

---

## `enum`

```text
Experience: 0–2
Advanced: 2–4
Importance: Critical
```

```swift
enum LoadState {
    case idle
    case loading
    case loaded(Data)
    case failed(Error)
}
```

### Why enums exist

Closed sets of possibilities. Associated values attach data to a case. This is how you avoid invalid combinations (`isLoading == true && data != nil && error != nil`).

### What happens if we use booleans instead

Impossible states become representable. UI bugs.

### Raw values and `Codable`

```swift
enum Role: String, Codable {
    case admin, user
}
```

### Indirect enums (trees)

```swift
enum Tree {
    case leaf(Int)
    indirect case node(Tree, Tree)
}
```

Needed because the enum would otherwise have infinite size.

### When not to use enum

Open sets that grow per server (`stringly` typed features) — then a struct + known cases + `unknown(String)` may be better. Still prefer enum with `@unknown default` for frozen-ish sets.

---

## Properties

### Stored vs computed

```swift
struct Rect {
    var width: Double
    var height: Double
    var area: Double { width * height }   // computed, no storage
}
```

Computed properties are methods wearing property syntax. They are not stored. If you put heavy work in a getter, every access pays.

### `lazy`

```swift
lazy var formatter: DateFormatter = {
    let f = DateFormatter()
    f.dateStyle = .medium
    return f
}()
```

Created on first access. Must be `var`. **Not thread-safe** for the initialisation race. Do not use `lazy` for concurrent first access. Prefer `let` with eager init, or an actor, or `OSAllocatedUnfairLock` around creation.

### `static` vs `class`

```swift
struct Math {
    static let pi = 3.14159
}

class Vehicle {
    class var description: String { "vehicle" }  // overridable
    static var cannotOverride: String { "x" }
}
```

`static` on a class is not overridable. `class` keyword on properties/methods allows subclass override.

### `mutating`

Required to mutate `self` in a struct/enum method.

### Property observers

```swift
var name: String = "" {
    willSet { print("going to \(newValue)") }
    didSet { print("was \(oldValue)") }
}
```

Not called during `init` (with some exceptions around `defer` and after all properties are set — **do not rely on observers in `init`**). Prefer explicit methods if observation is business logic.

**SwiftUI:** do not use `didSet` on `@State` expecting to drive logic; use `.onChange` or Observation.

### Access control

```text
private          → file? No: enclosing declaration (type or file for file-level)
fileprivate      → this file
internal         → this module (default)
package          → this package (Swift 5.9+)
public           → other modules, limited subclassing
open             → other modules, subclassable / overridable
```

**Interview:** `@State private var` — `private` because only this view should touch storage. The wrapper still lets SwiftUI mutate it.

---

## Initializers

```swift
struct User {
    var name: String
    init(name: String) {
        self.name = name
    }
}
```

### Class designated vs convenience

```swift
class Person {
    var name: String
    init(name: String) { self.name = name }
    convenience init() { self.init(name: "Anonymous") }
}
```

Rules: designated inits call super; convenience call designated on `self`. Know two-phase initialization: all stored properties set before using `self`.

### Failable `init?`

```swift
init?(code: String) {
    guard code.count == 3 else { return nil }
}
```

### Required init

Subclasses must implement. Common with `NSCoder`.

---

## Extensions

```swift
extension String {
    var isBlank: Bool { trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
}
```

Add methods, computed properties, protocol conformances. Cannot add stored properties (except via tricks like associated objects on classes — avoid).

Why: group API, keep types small, retroactive modelling.

When not: huge extensions that hide the type’s real surface. File organisation by feature is fine.

---

## Composition vs inheritance

```text
Experience: 2–4
Importance: High
```

Prefer `has-a` over `is-a`.

```swift
struct Car {
    var engine: Engine
    var wheels: [Wheel]
}
```

Inheritance couples lifecycles and storage. Protocols + structs scale better in Swift. UIKit still uses class inheritance because it is an object framework from the 2000s.

---

## Common mistakes

```text
❌ class for every model “because Java”
✅ struct for data; class/actor for identity and shared mutable state

❌ Huge struct mutated on every keystroke copied through 12 layers
✅ Isolate mutation; consider a class model or @Observable

❌ lazy var on a type used from multiple threads
✅ Let + init, or actor

❌ didSet as architecture
✅ Explicit methods, Observation, Combine
```

## Quick Revision

- struct = value, class = reference
- enum = exclusive states
- `mutating`, `lazy`, `static`/`class`, observers
- Prefer composition

## One-minute explanation

“I model data as structs so copies do not surprise me. I use classes when I need shared identity, UIKit objects, or observable models. I use enums so illegal states cannot be built. If I need shared mutable state with concurrency, I reach for an actor, not a casually thread-safe class.”

---

# Protocol-Oriented Programming

```text
Experience: 0–2 (syntax)
Experience: 2–4 (POP design)
Experience: 4+ (existentials, generics, performance)
Category: Swift
Difficulty: Intermediate
Importance: Critical
```

## Protocol declaration

```swift
protocol Fetching {
    func fetch(id: String) async throws -> Data
}
```

A protocol is a **contract**: types that conform must provide the requirements (or get them from an extension).

### Why protocols exist

Polymorphism without a shared superclass. Test doubles. Multiple unrelated types (`URL`, `String`) can both be `View`? No — `View` is a protocol with associated type constraints. Bad example. Better: `Decodable`, `Hashable`, `Equatable`.

### Protocol requirements

Methods, properties (`{ get }` or `{ get set }`), associated types, sometimes initializers.

### Protocol extensions

```swift
extension Fetching {
    func fetchOrEmpty(id: String) async -> Data {
        (try? await fetch(id: id)) ?? Data()
    }
}
```

Default implementations live here. **Witness tables:** the default is used if the type does not provide its own. Dispatch of protocol-extension methods that are **not** protocol requirements is **static** — a famous trap.

```swift
protocol P { }
extension P {
    func f() { print("default") }
}
struct S: P {
    func f() { print("S") }
}
let p: any P = S()
p.f()  // prints "default" because f is not a requirement
```

If `f` is a protocol requirement, `p.f()` prints `"S"`.

**Interview gold.** This is how they distinguish people who used protocols from people who understood them.

---

## Protocol composition

```swift
typealias AuthSession = Fetching & TokenRefreshing

func start(_ session: any Fetching & TokenRefreshing) { }
```

---

## Associated types

```swift
protocol Repository {
    associatedtype Item
    func all() async throws -> [Item]
}
```

Protocols with associated types (PAT) cannot be used as `any Repository` in older Swift without type erasure. In modern Swift, `any Repository` is allowed but **uses of `Item` are restricted** — you often cannot return `Item` from a heterogeneous existential easily.

```swift
func printAll(_ repo: any Repository) async throws {
    let items = try await repo.all()
    // items is [any Repository.Item] in spirit — limited
}
```

Prefer generics:

```swift
func printAll<R: Repository>(_ repo: R) async throws {
    let items = try await repo.all()
}
```

---

## `some` vs `any`

```text
Experience: 2–4
Advanced: 4+
Importance: Critical
```

### `some Protocol` — opaque type

```swift
func makeButton() -> some View {
    Text("OK")
}
```

The compiler knows the **concrete type** but callers cannot name it. All return paths must be the **same** concrete type (unless you use `if` + `@ViewBuilder` which still produces one opaque wrapper type).

**Why:** abstraction without existential boxing. Fast. Identity of the type is stable. This is why `View.body` is `some View`.

### `any Protocol` — existential

```swift
let views: [any View] = [Text("A"), Image(systemName: "star")]
```

The box can hold different concrete types. Access through the protocol witness table. Extra indirection. In SwiftUI, `any View` **destroys specialised view identity** and often **hurts performance** and animation. Prefer `some View` and `@ViewBuilder`/`Group`/`AnyView` only when you must type-erase.

`AnyView` is a SwiftUI type eraser. Use sparingly.

### Example comparison

```swift
func opaque() -> some Hashable { 1 }          // hidden Int
func box() -> any Hashable { 1 }              // existential
```

You cannot put `some Hashable` in an array of mixed types. You can put `any Hashable` in an array.

### What happens if we write `any View` everywhere

Heavier runtime, worse diffing, mysterious identity bugs. Write `some View`.

### When `any` is correct

Heterogeneous collections, plugin systems, stored properties of mixed conformers (`var destination: any Hashable` in a router — still think hard).

---

## Generic constraints vs existentials

```swift
func log<T: CustomStringConvertible>(_ value: T) { print(value.description) }
func logBox(_ value: any CustomStringConvertible) { print(value.description) }
```

The generic version specialises per type (faster, more optimiser-friendly). The existential is one function, dynamic dispatch.

**When generics make code worse:** unreadable `where` clauses five levels deep for a one-off. Then use `any` or a concrete type.

---

## POP vs OOP

Protocol-oriented programming: start with the behaviour you need, provide defaults in extensions, conform structs.

OOP: start with a class hierarchy.

Swift is mixed. UIKit is OOP. Swift standard library is POP.

---

## Common mistakes

```text
❌ Protocol extension methods that are not requirements, expecting dynamic dispatch
✅ Declare them on the protocol if they must be overridable

❌ any View in SwiftUI body
✅ some View

❌ Giant protocols (God protocols)
✅ Split: Interface Segregation
```

## One-minute explanation

“A protocol is a contract. I prefer generics and `some` for static, fast polymorphism. I use `any` when I truly need mixed types at runtime. I never assume protocol-extension methods dispatch dynamically unless they are protocol requirements.”

---

# Generics

```text
Experience: 2–4
Category: Swift
Difficulty: Intermediate
Importance: High
```

## Generic functions and types

```swift
func first<T>(_ array: [T]) -> T? {
    array.first
}

struct Box<Value> {
    var value: Value
}
```

### Why they exist

Write algorithms once, keep type safety. `Array<Element>` is the proof.

### Constraints

```swift
func maxVal<T: Comparable>(_ a: T, _ b: T) -> T {
    a > b ? a : b
}

func decode<T: Decodable>(_ data: Data) throws -> T {
    try JSONDecoder().decode(T.self, from: data)
}
```

### `where` clauses

```swift
func flatten<T>(_ boxes: [Box<T>]) -> [T] {
    boxes.map(\.value)
}

extension Array where Element: Equatable {
    func removingDuplicates() -> [Element] { ... }
}
```

### Type erasure (classic)

Before `any`, we wrote `AnyPublisher`, `AnyView`, `AnyIterator`. A type eraser is a wrapper that hides a generic concrete type behind a single named type, usually by storing closures or a private class hierarchy.

```swift
struct AnyFetcher: Fetching {
    private let _fetch: (String) async throws -> Data
    init<F: Fetching>(_ f: F) { _fetch = f.fetch }
    func fetch(id: String) async throws -> Data { try await _fetch(id) }
}
```

Modern Swift: `any Fetching` may suffice. Type erasure still useful to hide associated types or to be `Hashable`/`Codable` in ways existentials are not.

### When generics overcomplicate

If there is only one type ever, do not genericise. If the compiler errors become novels, you overdid constraints. Senior engineers simplify.

---

# Error Handling

```text
Experience: 0–2
Advanced: 2–4
Category: Swift
Difficulty: Beginner
Importance: High
```

```swift
enum NetworkError: Error {
    case timeout
    case badStatus(Int)
}

func load() throws -> Data {
    throw NetworkError.timeout
}

do {
    let data = try load()
} catch NetworkError.timeout {
    retry()
} catch {
    print(error)
}
```

### `try`, `try?`, `try!`

| | Behaviour |
| --- | --- |
| `try` | Must be in `do` or throwing function |
| `try?` | Converts errors to `nil`, swallows the error value |
| `try!` | Crash on throw |

`try?` is dangerous if you needed the error for logging.

### `throws` vs `Result`

```swift
func load() async -> Result<Data, Error>
```

`async throws` is the modern happy path. `Result` is useful when storing an outcome, or Combine.

### Never fail silently in networking

Map HTTP status to errors. Empty `catch` is an interview fail.

### Typed throws (Swift 6)

```swift
func load() throws(NetworkError) -> Data
```

Know that it exists for 4+ interviews; many codebases still use untyped `Error`.

---
