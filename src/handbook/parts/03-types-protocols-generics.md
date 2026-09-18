# Structs, Classes, Enums, and Properties

This chapter is the backbone of iOS interviews. If you only study one language chapter deeply, study this one. Value versus reference, exclusive states, and how SwiftUI views can be cheap structs because state lives elsewhere — that is the difference between “I write Swift” and “I can design a type.”

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

A struct is a named value. Assignment copies. `a` and `b` are independent after `b.name = "Asha"`. Stored properties that you intend to mutate need `var` on the property *and* a `var` instance; `let` freezes the whole value. If you do not write a custom `init`, Swift synthesises a memberwise one.

Structs exist so data can be independent copies. There is no shared mutable identity unless you introduce a class inside. That is the right default for models, view state, coordinates, parsed JSON — anything where “two variables, two values” is what you mean.

SwiftUI prefers structs for views because a view is a **description** of UI for a moment in time, not a long-lived object. The framework can recreate the struct cheaply and keep **state storage** elsewhere. See SwiftUI Rendering. `View.body` returns `some View` for the same reason: the concrete struct type stays known to the compiler, even if you cannot name it.

The copy is shallow at the Swift level. Nested structs copy. Nested classes copy the *reference*. Collections use copy-on-write, so a large `[User]` is cheap to assign until you mutate.

```text
var a = User(...)
var b = a          // two independent User values

If User contains a class:
  both structs hold a reference to the SAME class instance
  (that is a common interview trap)
```

That nested-class trap is how people “use structs” and still share mutable state. If `User` holds a `class AvatarCache`, two `User` values share the cache. The struct copy did not clone the object.

Use a struct for data, for SwiftUI `View`, for small types (`CGPoint`-like), and for anything you want copied when assigned. Skip it when identity matters (`===`), when you need inheritance (rare; prefer protocols), or when shared mutable state is the point — then a class or an actor. Do not assume “struct is always faster.” Very large mutation-heavy graphs without copy-on-write can copy more than a class would retain; measure.

If you use a class instead, you get shared mutation. Two screens holding the same `User` class will fight. That is sometimes what you want (`@Observable` model). It is often what you do not want (a decoded DTO). Pick the semantics first, the keyword second.

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

`let a` still allows `a.token = "y"` because `let` froze the reference, not the object. `b` is another name for the same instance. That is why classes exist: identity, shared mutable state, Objective-C interoperability, UIKit (`UIView` is a class), deinitialisers, inheritance.

Identity has its own operator:

```swift
a === b   // same instance
a == b    // Equatable value equality, if implemented
```

Structs do not have `===`. If you find yourself wanting it on a struct, you wanted a class — or you wanted an `id` property and `==`.

Swift classes are single-inheritance. Prefer protocols and composition. `final class` prevents subclassing: a slight performance win (devirtualisation) and a design statement that this type is not a hook for subclasses.

```swift
class Animal { }
class Dog: Animal { }
```

Only classes and actors have `deinit`:

```swift
deinit {
    cancellable.cancel()
}
```

Use it for cleanup that is not ARC of other objects: cancelling a timer, removing an observer. Do not do heavy work or take locks carelessly. Never assume `deinit` runs at a specific time on a specific thread beyond “when the last strong reference is gone” — and even then, autorelease pools and retain cycles delay it.

Reach for a class for UIKit / AppKit objects, `@Observable` models (the macro applies to classes), shared services that have identity (a `URLSession` wrapper), and objects with a `deinit` lifecycle. Do not default data models to class “because Java.” If two views should not share mutation, use a struct. If they should share mutation under concurrency, consider an actor rather than a casually thread-safe class.

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
| SwiftUI View | Required (`View` is used as a struct) | Views are structs |
| Default in Swift | Prefer struct | When identity/sharing is required |
| Memory | Inline with COW heap buffers | Heap object + ARC |

A junior answer is “struct is copy, class is shared.” A mid-level answer adds copy-on-write, the nested-class trap, and SwiftUI state lifetime — the view struct dies and is recreated; `@State` / Observation storage does not. A senior answer talks about ARC retain/release versus copies in hot paths, `Sendable`, and actors instead of thread-safe classes.

Lots of large non-COW structs passed through many layers can copy; profile before rewriting. Classes pay ARC retain/release, which shows up in tight loops. Arrays of structs can be cache-friendly; arrays of classes are pointers to scattered objects.

Class instances live on the heap and die when ARC hits zero. Structs live wherever their owner lives — a stack frame, inside another object, inside an array buffer. Copy-on-write collections put the buffer on the heap even when the `Array` value sits in a local `let`.

Immutable structs composed of `Sendable` fields are trivial to share across isolation domains. Classes need isolation: an actor, `@MainActor`, or a lock. “I made it a class so I can mutate it from a background queue” is how races are born.

---

## `enum`

```swift
enum LoadState {
    case idle
    case loading
    case loaded(Data)
    case failed(Error)
}
```

An enum is a closed set of possibilities. Associated values attach data to a case. That is how you avoid invalid combinations: `isLoading == true && data != nil && error != nil` is four booleans pretending to be a state machine. `LoadState` makes “loading and also failed” unrepresentable.

If you use booleans instead, impossible states become representable, and the UI will eventually show them. That is the whole argument for enums in application code, not just “Swift has enums.”

Raw values plus `Codable` are the simple wire format:

```swift
enum Role: String, Codable {
    case admin, user
}
```

Recursive enums need `indirect`, because otherwise the compiler cannot size the type — it would contain itself forever:

```swift
enum Tree {
    case leaf(Int)
    indirect case node(Tree, Tree)
}
```

Skip an enum when the set is open and grows per server (`stringly` typed feature flags). Then a struct plus known cases plus `unknown(String)` may be better. Still prefer an enum with `@unknown default` for frozen-ish sets you do not own. If you own the set, list the cases and let exhaustiveness work for you.

---

## Properties

Stored properties are storage. Computed properties are methods wearing property syntax — they are not stored. If you put heavy work in a getter, every access pays.

```swift
struct Rect {
    var width: Double
    var height: Double
    var area: Double { width * height }   // computed, no storage
}
```

`lazy` defers creation until first access. It must be `var`. It is **not thread-safe** for the initialisation race. Concurrent first access can run the initialiser twice or worse. Prefer `let` with eager init, or an actor, or a lock around creation.

```swift
lazy var formatter: DateFormatter = {
    let f = DateFormatter()
    f.dateStyle = .medium
    return f
}()
```

`static` versus `class` is about override:

```swift
struct Math {
    static let pi = 3.14159
}

class Vehicle {
    class var description: String { "vehicle" }  // overridable
    static var cannotOverride: String { "x" }
}
```

`static` on a class is not overridable. The `class` keyword on properties and methods allows a subclass to override. Structs and enums only have `static`.

`mutating` is required to mutate `self` in a struct or enum method. Changing a stored property *is* replacing `self`. Classes do not mark methods `mutating`.

Property observers look like this:

```swift
var name: String = "" {
    willSet { print("going to \(newValue)") }
    didSet { print("was \(oldValue)") }
}
```

They are not called during `init` in the way people hope (do not rely on observers in `init`). Prefer an explicit method if observation is business logic. In SwiftUI, do not use `didSet` on `@State` expecting to drive logic; use `.onChange` or Observation.

Access control, from tightest to most open:

```text
private          → enclosing declaration (the type, or the file for file-level decls)
fileprivate      → this file
internal         → this module (default)
package          → this package (Swift 5.9+)
public           → other modules, limited subclassing
open             → other modules, subclassable / overridable
```

`@State private var` is `private` because only this view should touch the storage. The wrapper still lets SwiftUI mutate it. That pairing — private name, framework-owned storage — is the access-control question hiding inside a SwiftUI round.

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

Structs get a memberwise `init` if you do not write your own. Classes do not: you write designated initialisers, and optionally convenience ones.

```swift
class Person {
    var name: String
    init(name: String) { self.name = name }
    convenience init() { self.init(name: "Anonymous") }
}
```

Designated inits call `super` (if there is a superclass) and initialise every stored property. Convenience inits call a designated init on `self`. Two-phase initialisation: all stored properties are set before you use `self`. That is why you cannot call an instance method or read `self` in a designated init before the last property is assigned.

Failable `init?` returns `nil` on illegal input instead of trapping:

```swift
init?(code: String) {
    guard code.count == 3 else { return nil }
}
```

`required init` means subclasses must implement it. You will meet it with `NSCoder` and with protocol initialiser requirements.

---

## Extensions

```swift
extension String {
    var isBlank: Bool { trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
}
```

Extensions add methods, computed properties, and protocol conformances. They cannot add stored properties (associated objects on classes are a trick; avoid them). Use extensions to group API, keep the original type declaration small, and do retroactive modelling — `extension Date: Identifiable` when you need it, not when you own `Date`.

A huge extension that hides the type’s real surface is just a poorly split file. Organising by feature is fine; hiding stored properties in an extension three files away is not.

---

## Composition vs inheritance

Prefer `has-a` over `is-a`.

```swift
struct Car {
    var engine: Engine
    var wheels: [Wheel]
}
```

Inheritance couples lifecycles and storage. A subclass is stuck with the superclass’s stored properties, `init` rules, and thread-safety story. Protocols plus structs scale better in Swift: you describe the behaviour you need, provide defaults in extensions, and conform types that have no shared ancestor.

UIKit still uses class inheritance because it is an object framework from the 2000s. You will subclass `UIViewController`. You should not invent a new `BaseViewModel` hierarchy for SwiftUI on that precedent.

---

## Common mistakes

`class` for every model “because Java” fights SwiftUI and concurrency; use a struct for data, a class or actor for identity and shared mutable state. A huge struct mutated on every keystroke and copied through twelve layers should have isolated mutation — a class model or `@Observable`. `lazy var` on a type used from multiple threads is a race; use `let` plus `init`, or an actor. `didSet` as architecture should have been an explicit method, Observation, or Combine.

---

## Quick Revision

Struct is a value, class is a reference. Enum is exclusive states with optional associated data. `mutating` is how a struct method changes `self`. `lazy` is deferred, not thread-safe. `static` is not overridable; `class` members can be. Prefer composition, and reach for an actor when the shared mutable state is concurrent.

---

## One-minute explanation

I model data as structs so copies do not surprise me. I use classes when I need shared identity, UIKit objects, or observable models. I use enums so illegal states cannot be built. If I need shared mutable state with concurrency, I reach for an actor, not a casually thread-safe class.

---

# Protocol-Oriented Programming

The syntax is junior. Designing with protocols is mid-level. Existentials, generics, and the performance of `some` versus `any` is senior. Interviews treat this as “do you understand Swift, or did you just learn classes in another language?”

## Protocol declaration

```swift
protocol Fetching {
    func fetch(id: String) async throws -> Data
}
```

A protocol is a **contract**: types that conform must provide the requirements, or inherit a default from an extension. That is polymorphism without a shared superclass. Test doubles conform. Unrelated types share behaviour — `Decodable`, `Hashable`, `Equatable` — without being cousins in a class tree.

Requirements can be methods, properties (`{ get }` or `{ get set }`), associated types, and sometimes initialisers. A `{ get }` property can be stored or computed on the conforming type. `{ get set }` requires a writable stored property or a computed property with a setter.

Default implementations live in protocol extensions:

```swift
extension Fetching {
    func fetchOrEmpty(id: String) async -> Data {
        (try? await fetch(id: id)) ?? Data()
    }
}
```

The default is used if the type does not provide its own. Dispatch of protocol-extension methods that are **not** protocol requirements is **static**. That is a famous trap.

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

If `f` is a protocol requirement, `p.f()` prints `"S"`. The witness table only has entries for requirements. An extension method that is not on the protocol is just a static function the compiler picks from the static type, which here is `any P`.

This is how interviewers distinguish people who used protocols from people who understood them. If a method must be overridable through an existential, declare it on the protocol.

---

## Protocol composition

```swift
typealias AuthSession = Fetching & TokenRefreshing

func start(_ session: any Fetching & TokenRefreshing) { }
```

Composition is “this value must satisfy both contracts.” It is not multiple inheritance of storage. The type still has one concrete representation; it just has to provide two sets of requirements. Prefer composition of small protocols over a god protocol that describes an entire application.

---

## Associated types

```swift
protocol Repository {
    associatedtype Item
    func all() async throws -> [Item]
}
```

An associated type is a placeholder the conforming type fills in — `Item` might be `User` for one repository and `Post` for another. Protocols with associated types (PATs) could not be used as `any Repository` in older Swift without type erasure. In modern Swift, `any Repository` is allowed, but **uses of `Item` are restricted**. You often cannot treat `Item` as a single concrete type when the existential could be hiding many different `Item`s.

```swift
func printAll(_ repo: any Repository) async throws {
    let items = try await repo.all()
    // items is a collection of the associated type, limited through the existential
}
```

Prefer generics when you still need the associated type as a real type:

```swift
func printAll<R: Repository>(_ repo: R) async throws {
    let items = try await repo.all()
}
```

The generic version specialises: inside the function, `R.Item` is one type. The existential version is a box, and the associated type is mostly opaque from the outside.

---

## `some` vs `any`

### Opaque `some`

```swift
func makeButton() -> some View {
    Text("OK")
}
```

The compiler knows the **concrete type** but callers cannot name it. All return paths must be the **same** concrete type, unless you use `if` plus `@ViewBuilder`, which still produces one opaque wrapper type rather than two different return types.

That is abstraction without existential boxing. Fast. The identity of the type is stable. This is why `View.body` is `some View`. The compiler can still specialise, still see that this view is a `Text` or a `TupleView`, still diff it properly.

### Existential `any`

```swift
let views: [any View] = [Text("A"), Image(systemName: "star")]
```

The box can hold different concrete types. Access goes through the protocol witness table. Extra indirection. In SwiftUI, `any View` **destroys specialised view identity** and often **hurts performance and animation**. Prefer `some View` and `@ViewBuilder` / `Group`. Reach for `AnyView` (the SwiftUI type eraser) only when you must type-erase, and do it as low in the tree as you can.

```swift
func opaque() -> some Hashable { 1 }          // hidden Int
func box() -> any Hashable { 1 }              // existential
```

You cannot put mixed `some Hashable` values in an array — each `some` is one concrete type, hidden. You can put `any Hashable` in an array, because the box is one type.

Writing `any View` everywhere is heavier at runtime, worse at diffing, and a source of mysterious identity bugs. Write `some View`. Use `any` for heterogeneous collections, plugin systems, and stored properties of mixed conformers (`var destination: any Hashable` in a router — still think hard; a generic `Hashable` route type is often better).

---

## Generic constraints vs existentials

```swift
func log<T: CustomStringConvertible>(_ value: T) { print(value.description) }
func logBox(_ value: any CustomStringConvertible) { print(value.description) }
```

The generic version specialises per type — faster, more optimiser-friendly, associated types remain usable. The existential is one function with dynamic dispatch. Use `any` when you truly need mixed types at runtime, or when the generic `where` clauses become a novel for a one-off. Senior engineers simplify: if there is only one type ever, do not genericise, and do not existentialise either — take the concrete type.

---

## POP vs OOP

Protocol-oriented programming starts with the behaviour you need, provides defaults in extensions, and conforms structs. Object-oriented programming starts with a class hierarchy.

Swift is mixed. UIKit is OOP. The Swift standard library is POP. You will write both. The mistake is building a `BaseViewController`-shaped hierarchy for data types that should have been structs conforming to small protocols.

---

## Common mistakes

Protocol-extension methods that are not requirements do not dispatch dynamically; declare them on the protocol if they must be overridable through `any P`. `any View` in a SwiftUI `body` should have been `some View`. A giant protocol that describes an entire feature should have been split — interface segregation, several small contracts, composition with `&`.

---

## One-minute explanation

A protocol is a contract. I prefer generics and `some` for static, fast polymorphism. I use `any` when I truly need mixed types at runtime. I never assume protocol-extension methods dispatch dynamically unless they are protocol requirements.

---

# Generics

Generics are how you write an algorithm once and keep type safety. `Array<Element>` is the proof. Interviews at 2–4 years expect constraints, `where` clauses, and a sane story about `any` versus `<T:>`.

## Generic functions and types

```swift
func first<T>(_ array: [T]) -> T? {
    array.first
}

struct Box<Value> {
    var value: Value
}
```

`T` and `Value` are placeholders. At each call site or each `Box<Int>`, they become a real type. Constraints narrow what that type can be:

```swift
func maxVal<T: Comparable>(_ a: T, _ b: T) -> T {
    a > b ? a : b
}

func decode<T: Decodable>(_ data: Data) throws -> T {
    try JSONDecoder().decode(T.self, from: data)
}
```

Without `Comparable`, `>` would not compile. Without `Decodable`, `JSONDecoder.decode` would not compile. The constraint is the contract, same idea as a protocol, but resolved statically per specialisation.

`where` clauses attach extra constraints, including on associated types or on `Element` of a collection:

```swift
func flatten<T>(_ boxes: [Box<T>]) -> [T] {
    boxes.map(\.value)
}

extension Array where Element: Equatable {
    func removingDuplicates() -> [Element] { ... }
}
```

Type erasure is the classic pre-`any` move. We wrote `AnyPublisher`, `AnyView`, `AnyIterator`: a wrapper that hides a generic concrete type behind a single named type, usually by storing closures or a private class hierarchy.

```swift
struct AnyFetcher: Fetching {
    private let _fetch: (String) async throws -> Data
    init<F: Fetching>(_ f: F) { _fetch = f.fetch }
    func fetch(id: String) async throws -> Data { try await _fetch(id) }
}
```

Modern Swift: `any Fetching` may suffice. Type erasure is still useful to hide associated types, or to be `Hashable` / `Codable` in ways existentials are not. `AnyView` is still the SwiftUI hammer; use it sparingly because it erases identity.

If there is only one type ever, do not genericise. If the compiler errors become novels, you overdid constraints. The senior move is to simplify.

---

# Error Handling

Errors are values that conform to `Error`. Throwing is control flow the compiler tracks. Empty `catch` on a network call is an interview fail.

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

`try` must sit in a `do` or in a throwing function. `try?` converts errors to `nil` and **swallows the error value** — dangerous if you needed it for logging. `try!` crashes on throw, the error equivalent of force unwrap, and the same rule applies: only when a crash is the honest failure.

| | Behaviour |
| --- | --- |
| `try` | Must be in `do` or throwing function |
| `try?` | Converts errors to `nil`, swallows the error value |
| `try!` | Crash on throw |

`async throws` is the modern happy path for work that can fail. `Result` is useful when you need to *store* an outcome, pass it through a non-throwing API, or talk to Combine.

```swift
func load() async -> Result<Data, Error>
```

Never fail silently in networking. Map HTTP status to errors. Catch specific cases you can recover from, and let the rest surface. `catch { }` with an empty body is how bugs ship.

Typed throws exist in Swift 6:

```swift
func load() throws(NetworkError) -> Data
```

The function may only throw `NetworkError`, and callers can switch exhaustively without a catch-all. Many codebases still use untyped `Error`. Know typed throws for 4+ interviews; do not pretend every production API is typed already. For a new module you control, typed throws are a reasonable default when the error set is closed.
