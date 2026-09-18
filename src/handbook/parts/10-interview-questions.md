# PART X — Interview Questions

Practice these out loud for about a minute, the way you would across a table. The questions are written the way interviewers actually talk. The answers are what you would say: a situation, the rule, a little code when it helps, and the thing they usually ask next.

---

## Beginner questions (0–2 years)

These are vocabulary, crashes you should not ship, and SwiftUI basics. Start from a real line of code, then name the rule.

### B1. I declared this with `let` — can it still change?

It depends what you mean by change. `let` freezes the *name*, not necessarily the *object*. I cannot point `maxRetries` at a different `Int` later. That part is simple, and it is why `let` is the default in Swift.

Where people get surprised is classes. `let user = User()` still lets me set `user.name`, because the *reference* is constant. I am not allowed to aim `user` at a different instance, but the instance is happy to mutate. With a struct it is the opposite: changing a property is mutating `self`, so the binding has to be `var`.

```swift
let maxRetries = 3
var attempt = 0
attempt += 1

let user = User()
user.name = "Ravi"   // fine if User is a class
// user = User()     // not fine
```

If they push on speed: `let` is not “faster.” If that is the whole answer they have already moved on. They want binding versus object immutability.

### B2. Why bother with optionals — couldn’t we just use nil like Objective-C?

Because “this might be missing” should be part of the type, not a surprise at runtime. In Objective-C you could send a message to nil and sometimes nothing happened, or you used sentinels like `-1` and `""` and hoped everyone remembered the convention. `String?` is `Optional<String>`: either `.some(value)` or `.none`. The compiler will not let you treat it as a `String` until you unwrap.

That is the whole safety model. A missing user id cannot silently become a crash three screens later — unless you force-unwrap, which is you opting out. Absence is explicit, and that is the point.

```swift
var token: String? = nil
if let token {
    headers["Authorization"] = "Bearer \(token)"
}
```

If they push: optionals are not pointers. They are an enum. And they will often ask you to show `if let` versus `guard let` next.

### B3. This might be nil — do I unwrap with `if let` or `guard let`?

I use `if let` when the unwrapped value only matters inside that branch. I use `guard let` when the rest of the function *needs* the value, and a nil should leave — `return`, `throw`, or `break`. `guard` at the top keeps the happy path at the left margin instead of nesting the whole method in an `if`.

They are not the same tool. `if let` scopes the name to the block. `guard let` unwraps for everything after the guard. If you have a sensible default and do not need to branch at all, `??` is often cleaner than either.

```swift
func load(id: String?) {
    guard let id else { return }
    // id is String from here on
}
```

If they push: walk through a function and say out loud where the happy path should live. That is what they are listening for.

### B4. What does `??` do on this line — is the default always sitting there waiting?

Nil coalescing. If the optional on the left has a value, use it; otherwise evaluate the right-hand side. The right-hand side is an `@autoclosure`, so it runs **only** when the left is nil. It is not “always compute a fallback and then maybe throw it away.”

That matters when the default is work: a disk read, a translation, another optional chain. You can stack them: first nickname, then full name, then a literal.

```swift
let name = user.nickname ?? user.fullName ?? "Guest"
```

If they push whether it force-unwraps: no. And the default is not always evaluated.

### B5. I keep seeing `value!` in this codebase — when does that actually crash?

Whenever `value` is nil. `!` is you telling the compiler “I am certain.” Fine in a test, a playground, or the line immediately after you have already proven the value exists. Dangerous on network JSON, user input, and any production path you do not fully control. Those are the crashes that show up as `Unexpectedly found nil while unwrapping an Optional`.

Implicitly unwrapped optionals (`String!`) are still optionals. They unwrap for you and can still crash. Prefer `?` plus `if let` or `guard let` unless you have a very local, very proven reason.

If they push “never use `!`”: that is also too absolute. A unit test asserting a parse succeeded can `try!` or `!` and it is honest. Production networking should not.

### B6. Walk me through when you would make this a struct versus a class.

Structs have value semantics: assignment copies, often with copy-on-write under the hood. Two names do not silently share mutation. Classes have reference semantics: several names can point at the same instance, and a mutation is visible through all of them.

I reach for a struct when the thing is data — a view model value, a `CGPoint`, a SwiftUI `View`. I reach for a class (or an actor) when I need shared identity: a network client, a database stack, something with a lifetime other people must observe. SwiftUI views are structs because they are cheap descriptions, not long-lived objects.

If they push “structs live on the stack, classes on the heap”: the compiler chooses storage. Semantics matter more than that slogan. They will often ask copy-on-write next — arrays, strings, and dictionaries share a buffer until one copy mutates.

### B7. Why are SwiftUI views structs? Could Apple have made them classes?

A view is a cheap value that *describes* UI. SwiftUI is allowed to recreate `body` often, and a struct makes that cheap and honest: there is no hidden identity unless you ask for it. Persistent data does not live in the struct’s stored properties the way people first think. `@State` is stored by the framework, keyed by the view’s identity.

If the struct is recreated but identity is stable, `@State` survives. If you change identity — `.id(UUID())` is the classic foot-gun — state resets. That is why “views are structs” and “state lives outside the struct” are the same story.

If they push “because Apple likes structs”: they want the identity and storage story, not a preference.

### B8. Who actually owns this `@State`? The struct looks like it would throw it away.

The view owns it as a *source of truth*, but SwiftUI allocates the storage outside the struct and wires it back for a given identity. That is why `body` can run again and the stepper does not jump to zero. Mark it `private` so other views do not write your storage; pass a `Binding` down instead. `$count` is that binding — the wrapper’s `projectedValue`.

```swift
@State private var count = 0
Stepper("Count", value: $count)
```

If they push and you only say “it stores state,” they have not heard an ownership story yet. Tell them who lives longer: the identity, not the struct value.

### B9. Child view needs to change this — is that another `@State`, or something else?

`@Binding`. It is a two-way connection to storage owned *elsewhere*. The child can read and write; it does not own the lifetime. You create one from `@State` with `$`, or from `@Bindable` / `Bindable` on an observable model.

It is not a copy of `@State`. If the child declares its own `@State`, you now have two sources of truth and they will drift. The parent keeps the storage; the child borrows a binding.

If they push how to create one without `$`: a `Binding` has a get/set closure, which is useful in previews and tests.

### B10. Why `some View` on `body`? Why not just `View`?

`some View` is an opaque type: the function returns one concrete view type, but callers cannot name it. The compiler still knows the exact type, so it can specialise and keep identity. `any View` is an existential — “some unknown view” — which boxes, is slower, and is weaker for SwiftUI `body`.

People say “it can be any view” and that is the wrong slogan. That is `any View`. `body` wants one concrete tree the compiler can see.

If they push why not `any View` in `body`: performance and identity. Lists of mixed existentials hitch.

### B11. I padded then set a background, then I swapped the order and the screen changed — is modifier order real?

Yes. Each modifier *wraps* the previous view in a new view. `.padding().background(.red)` draws red including the padding. `.background(.red).padding()` draws red only on the original size, then empty padding around it. You are not setting properties on one object; you are building a nested tree.

`offset` moves drawing without changing the size the parent sees. `padding` changes that size. Once you see modifiers as wrappers, the “wrong color around the button” bugs stop being mysterious.

If they push “order doesn’t matter”: it does, and a two-line example is the whole answer.

### B12. This feed has a few hundred rows — `VStack` or `LazyVStack`?

`VStack` creates all children immediately. `LazyVStack` inside a `ScrollView` creates children as they approach the visible region. A feed of hundreds of rows in a plain `VStack` will hitch and use memory, because every row exists even when it is off screen.

`List` is its own lazy container with platform styling — swipe actions, separators, the iOS list look. I prefer `List` for a standard iOS list, and `LazyVStack` when I need custom scroll layout that `List` fights.

If they push `List` versus `LazyVStack`: styling and behaviour, not “which is lazy.” Both can be lazy. `VStack` in a scroll view is the one that is not.

### B13. How does ARC actually decide this object can go away?

Automatic Reference Counting for *class* instances. Each strong reference adds one. At zero the object deinitialises. Swift does not pause the world with a tracing garbage collector. You still get leaks: counts that never reach zero (cycles), or objects you stuffed in a global cache and forgot.

Value types are not ARC-managed the same way; they copy. A struct can *contain* a class, and then that class is counted. ARC is an ownership scheme for references, not a magic memory vacuum.

If they push whether Swift has a GC: no. Deterministic `deinit` is the feature and the foot-gun.

### B14. We leaked a screen after we popped it — what does a retain cycle look like here?

A and B each hold a *strong* reference to the other, or a longer ring: A → B → C → A. Counts stay at least one forever, so `deinit` never runs. Closures capture `self` strongly by default, so `self.completion = { self.foo() }` is a classic cycle if `self` also owns `completion`.

The fix is `[weak self]` when the closure might outlive the screen, or `[unowned self]` only when you can prove the object will still be there. Delegates that should have been `weak` are the other everyday version.

If they push for a picture: view controller owns a service, service owns a completion that captures the view controller. Pop the screen, memory graph still shows it.

### B15. Why is this delegate `weak`? Could we make it strong and be done?

The child should not keep the parent alive. Table view, `URLSession` task, a custom control — they are owned by the view controller (or the view). If `delegate` were strong, you get VC → view → delegate → VC and the screen never dies.

Delegates are usually `weak var delegate: FooDelegate?` because `weak` requires optional: the reference is allowed to zero out. A strong delegate is how a “small helper object” accidentally pins a whole screen.

If they push a non-optional delegate: then it cannot be `weak`. That is a smell unless lifetime is ironclad.

### B16. `weak` or `unowned` in this closure — how do you choose?

`weak` is optional and becomes `nil` when the object dies. `unowned` is non-optional and *crashes* if you use it after the object is gone. For `URLSession` completions I prefer `[weak self]` — the screen may have popped, and crashing is worse than skipping the UI update.

`unowned` is for when you can prove the captured object outlives the closure: a nested function inside `init`, or a child whose parent definitely still exists. If you are not sure, `weak`.

If they push “unowned is faster so I always use it”: they have already told you they have not shipped a dangling-unowned crash.

### B17. What is a closure, in the sense that it can get you in trouble later?

A function you can pass around. It can capture constants and variables from the enclosing scope, which is the superpower and the leak. That capture is why closures cause retain cycles, and why `@escaping` is a lifetime question, not a style question.

A button handler, a network completion, a `map` transform — all closures. The trouble starts when the closure outlives the function that created it *and* it captured `self` strongly.

If they push what “capture” means: the closure holds onto those bindings. For a class, that is a strong reference unless you say otherwise.

### B18. This parameter is `@escaping` — does that mean it runs on a background thread?

No. It means the closure is stored or called *after* the function returns: a network callback, `DispatchQueue.async`, something you stash on `self`. Non-escaping closures — the default for many sync `map` callbacks — cannot outlive the call, so the compiler is stricter about captures and you do not need `[weak self]` for the usual `map`.

`@escaping` is about *lifetime*, not “runs on a background thread.” An escaping closure can still run on the main actor. A non-escaping one can still do heavy work if you foolishly put it there.

If they push why `map` is not escaping: the closure runs before `map` returns. There is nothing left to call later.

### B19. I keep seeing the closure written after the closing paren — is that required?

Trailing closure syntax. If the last argument is a closure, you may write it after the `)`. It is the same call. People like it for animation and SwiftUI because the call reads as “do this thing, here’s the work.”

```swift
UIView.animate(withDuration: 0.25) {
    view.alpha = 1
}
```

Multiple trailing closures (Swift 5.3+) label the later ones: `Button("Save") { } onLongPress: { }`. That is where it gets confusing if you forget the labels. It is sugar, not a different kind of closure.

If they push whether you must use it: no. `animate(withDuration: 0.25, animations: { ... })` is the same function.

### B20. I need to transform this array — `map`, `compactMap`, or `flatMap`?

`map` is one output per input. `compactMap` is transform to optional, drop the nils — parsing strings to ints is the textbook case. `flatMap` is transform to a sequence and flatten one level, so you do not get an array of arrays.

On `Optional`, `flatMap` chains optionals without nesting `??`. Sequence `flatMap` and optional `flatMap` share a name and confuse everyone in interviews. Say which one you mean.

```swift
let ids = strings.compactMap(Int.init)
let allItems = users.flatMap(\.orders)
```

If they push optional `map` versus `flatMap`: `map` wraps in another optional; `flatMap` flattens.

### B21. We got JSON back — what is `Codable` actually doing?

`typealias Codable = Encodable & Decodable`. Typically you pair it with `JSONEncoder` / `JSONDecoder`. The compiler synthesises the mapping if your property names match. They often do not: `user_id` to `userID` wants `CodingKeys` or a key decoding strategy. Dates and numbers need explicit strategies or they fail at runtime with a slightly hostile error.

It is not magic and it is not a networking library. It is “this type can go to and from an encoder.” You still own status codes, error types, and which thread you decode on.

If they push a snake_case API: `convertFromSnakeCase` or explicit `CodingKeys`. I prefer keys when a few fields are weird, strategy when the whole payload is snake_case.

### B22. How would you fetch this JSON in modern Swift, start to finish?

`URLSession` async, check the HTTP status, then decode. Completion-handler `dataTask` still exists in a lot of codebases, so I would mention I can read that too.

```swift
let (data, response) = try await URLSession.shared.data(for: request)
guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
    throw APIError.badStatus
}
return try JSONDecoder().decode(Model.self, from: data)
```

Decode off the main actor if the payload is large; hop to `@MainActor` to publish UI state. The happy-path three-liner is not the whole job — status, errors, and cancellation are.

If they push “just `try await` and decode”: they will ask what happens on a 404. `URLSession` may still hand you `Data`.

### B23. `URLSession` returned data and did not throw — so this was a success?

Not necessarily. `URLSession` can give you `Data` for a 404 or 500 *without throwing*. Throwing covers transport failures: offline, DNS, timeout. HTTP failures are just responses. Treat 2xx as success; map 401 to refresh, 429 to backoff, 5xx to retry-or-fail depending on the verb.

If you only check `data` and decode, a 500 HTML page becomes a decoding error and you debug the wrong layer.

If they push 3xx: know whether your session follows redirects. Most app GETs do. You still want the final status.

### B24. Where do you put the refresh token — UserDefaults or Keychain?

Keychain. UserDefaults is small preferences, not secret: it can be backed up, and it is easy to read from a backup or a jailbroken device. Keychain is tokens and passwords, with accessibility flags that say when the item is available.

Refresh tokens go in Keychain, never UserDefaults. A “logged in” boolean in UserDefaults is fine. The secret is not.

If they push accessibility: `AfterFirstUnlock` if background refresh must read the token; `WhenUnlocked` if it should not. That trade-off comes back in senior rounds.

### B25. MVC versus MVVM — give me the one-minute version for this iOS app.

Classic MVC on iOS: the view controller becomes the dumping ground. People call it Massive View Controller because networking, formatting, and navigation all landed in the only object that lived long enough. MVVM moves presentation logic and UI state into a testable model the view observes.

In SwiftUI you do *not* need a view model for a static `AboutView`. You do when there is loading, validation, or shared rules. The pattern is a seam, not a tax on every screen.

If they push which one Apple wants: Apple ships both. They want to hear you will not invent a view model to hold a string constant.

### B26. The list is stale when I come back to the tab — `viewDidLoad` or `viewWillAppear`?

`viewDidLoad` runs when the view hierarchy is created, once per load. Good for one-time setup: adding subviews, wiring a table view. `viewWillAppear` runs every time the screen is about to show — tab switch, pop back. Refresh data here if it can go stale, not only in `viewDidLoad`.

Frames may still be zero in `viewDidLoad`; layout happens later, often `viewDidLayoutSubviews`. Putting a frame-based layout in `viewDidLoad` is a classic “it works on the second appearance” bug.

If they push SwiftUI: `.task` / `.onAppear` is the analogous conversation, with cancellation as the extra beat.

### B27. Why does this table view show the wrong photo as I scroll?

Cell reuse. `UITableView` / `UICollectionView` keep a small pool of cells. As you scroll, cells are recycled. If you set an image and do not reset it, the next row inherits the last photo, the last highlight, the last cancelled download’s completion.

In `prepareForReuse` — and again when you configure — reset images, cancel in-flight image tasks, and clear selected state. The wrong photo on the wrong row is almost never “the API sent bad data.” It is a cell that remembered someone else.

If they push SwiftUI `List`: identity (`Identifiable`) is the cousin of reuse. Unstable ids pin state to the wrong row.

### B28. `frame` and `bounds` look like the same rectangle — when are they not?

`frame` is the view’s rectangle in the *superview’s* coordinates: origin plus size. `bounds` is in the view’s *own* coordinates. Origin is often `.zero` unless you scrolled or you moved `bounds.origin` on purpose — that is how `UIScrollView` works.

Transforms can make `frame` and the visual size diverge. After a rotation transform, `frame` is the axis-aligned bounding box, which is bigger than `bounds.size`. If you mix them carelessly, alignment math goes weird.

If they push which one to use in `draw(_:)`: `bounds`. You are drawing in your own coordinate space.

### B29. What is Auto Layout actually doing that frames were not?

A constraint solver: you describe relationships — this leading equals that leading, this height is 44 — and UIKit computes frames. When mixing with frames, `translatesAutoresizingMaskIntoConstraints` must be `false` for views you constrain yourself, or you get conflicting constraints: the autoresizing mask is *also* a set of constraints.

It exists so layout survives rotation, Dynamic Type, and different phone widths without you rewriting frame math in `layoutSubviews` every time. You can still use frames; you just do not get to ignore the solver if both are on.

If they push a conflict log: usually an autoresizing mask left on, or two constraints that cannot both be true at required priority.

### B30. When do you reach for `guard` instead of nesting `if`s?

When a failed check should *leave* the scope, and the rest of the function is the happy path. `guard` is an early-exit. If the condition fails, you must `return`, `throw`, `break`, or `continue`. That is the contract that keeps the success path at the left margin.

It works with booleans and with unwraps (`guard let`, `guard case`). Nested `if`s that only exist to bail out are `guard`s that have not been written yet.

If they push `guard` versus `if` for a boolean: if both branches have real work, `if`/`else` is clearer. `guard` is for “otherwise we are done.”

### B31. Why is Swift so strict that this `switch` has to cover every case?

So that when you add a case, the compiler shows every switch you forgot. Exhaustiveness is a refactoring tool. Prefer handling new cases explicitly. `default` silences that, which is fine for a truly unknown rest, and lazy if you own the enum.

`@unknown default` is for frozen-versus-unknown future cases from Apple SDKs — a case that does not exist in the SDK you compiled against yet. Your own app enums usually should not hide behind `default`.

If they push adding a case to `LoadState`: every screen that switches on it should fail to compile until you decide the UI.

### B32. What do associated values on an enum buy you that three optionals would not?

Data that travels with a case: `enum LoadState { case idle; case loading; case loaded(User); case failed(Error) }`. You cannot be `loaded` and `failed` at the same time. Three optionals — `user`, `error`, `isLoading` — can be illegally combined, and they will be, on a Friday.

Exclusive states beat boolean soup. The switch becomes the UI: idle spinner, loaded content, error retry. That is why interviews love this example.

If they push Equatable: associated `Error` is annoying because `Error` is not Equatable. Wrap it or map to a value you can test.

### B33. Would you make this a protocol or a superclass?

A protocol is a contract — methods and properties — with no stored properties in the protocol itself. Types can conform to many protocols; structs and enums can participate. A superclass shares implementation and stored state, but you only get one.

I prefer a protocol when I need polymorphism without a class hierarchy: a `HTTPClient`, a `AnalyticsTracking`. I prefer a superclass when there is real shared storage and a genuine “is-a” — UIKit is full of those. Inheritance for a `BaseViewModel` that every screen subclasses is how you get a god object.

If they push “protocol-oriented programming”: it is a tool, not a religion. Shared stored state still wants a type that can store.

### B34. The compiler wants `mutating` on this method — why, if classes do not need it?

Because it assigns to `self` or to `self`’s properties on a *value type*. The caller must use `var`. The method is promising to replace the value, not sneak around the `let`. Classes do not need `mutating` because mutation goes through the reference; `let user` can still `user.bump()`.

If you try to mutate a struct through a `let`, that is the same rule as B1. `mutating` is how the type system makes that visible on methods.

If they push `mutating` on a class: you cannot mark it. It is a value-type keyword.

### B35. Does this need to be stored, or can it be computed?

Stored is actual memory: `var name: String`. Computed is `get`/`set` code with no extra storage unless the setter writes another property. `fullName` from `first` + `last` is computed. Caching it as stored means you have to keep it in sync.

`lazy var` is stored, initialised on first access, and not thread-safe by default. That last part is an intermediate question hiding inside a beginner one.

If they push a setter-only computed property: unusual. Usually you want `get` and maybe `set` that writes through.

### B36. `static` versus `class` on this type member — which one can a subclass override?

Both are type-level. `class func` / `class var` on a class can be *overridden* in subclasses. `static` cannot. On structs and enums you only have `static`, because there is no inheritance.

If the method must be overridable in a class hierarchy, `class`. If it must not, `static` — and that is a feature. `static` on a class is “this is not part of the override story.”

If they push `class var` stored properties: stored type properties on classes are `static`. `class` type properties are computed so subclasses can override the getter.

### B37. I returned `(statusCode, data)` — is a tuple fine here?

Locally, yes. An anonymous grouping is perfect for a three-line function. For a public API I prefer a struct with named fields so I can add properties without breaking every call site, and so the type has a name in errors and docs.

Tuples do not grow well. Named tuple elements help a little (`(code: Int, data: Data)`) and still are not a model. When you start passing it through three layers, it should have been a struct yesterday.

If they push Equatable/Hashable: tuples of those types can participate, but a struct is still clearer at the boundary.

### B38. This lookup is slow and I have duplicates — Array, Set, or Dictionary?

Array: ordered, duplicates allowed, O(1) random access by index. Set: unique `Hashable` values, unordered, fast membership. Dictionary: key-value, lookup returns optional. Pick the operation you do all day. “Is this id already shown?” is a Set. “Row 12” is an Array. “User for id” is a Dictionary.

Dictionary subscript type is `Value?`. That surprises people who came from languages that throw or return a dummy. It is the same honesty as optionals.

If they push order in a Set: if you need unique *and* order, `NSOrderedSet` or an array plus a set, depending on how much you hate that sentence.

### B39. Why is `dict[key]` optional? The key is obviously in there.

Because it might not be. Returning a dummy would hide bugs: you would display `0` or `""` and not know the map was wrong. Use `dict[key] ?? default` when a default is honest, or `if let` when missing is a real case.

Crash-on-missing is what `dict[key]!` does, and that is the same force-unwrap conversation. The type is telling you the truth.

If they push `dict[key, default:]`: useful when you are building a grouping dictionary and missing means empty array.

### B40. The compiler figured out this is an `Int` — so is Swift dynamically typed?

No. Type inference fills in a *static* type from context (`let x = 3` is `Int`). It is not dynamic typing; `x` cannot become a `String` later. The type is real at compile time. You just did not write it.

Write the type when it documents a public API, when inference gets stuck, or when `CGFloat` versus `Double` would otherwise surprise you. Do not write it on every `let name = "Ravi"`.

If they push `var x = nil`: that does not compile. Inference needs a type, so `var x: String? = nil`.

### B41. Why can’t I write `s[0]` on a String the way I do on an Array?

Because Swift strings are Unicode. A “character” is a grapheme cluster of variable width. `s[0]` as `Int` would be wrong for emoji, flags, and combining marks. `String.Index` walks that; you use `s.startIndex` and `index(_:offsetBy:)`.

If you need random access by “character count,” you are paying for a walk. Often you wanted `utf8` or `utf16` for a specific encoding, not `Character`. Interviewers ask this to see if you have been bitten by emoji, not to hear “strings are arrays of chars.”

If they push `count`: `String.count` is grapheme clusters, not UTF-8 bytes.

### B42. Is `"\(amount)"` fine for showing this price in the UI?

Interpolation inserts `x` into a string via `CustomStringConvertible` and the interpolation APIs. Fine for logs and debug. For money, dates, and anything on screen, prefer formatters and localisation. `"\(3.5)"` is not a currency, and it will not flip the symbol for a locale.

Raw interpolation in UI is how you ship `2026-09-18 14:03:00 +0000` to a user. Formatters exist for a reason.

If they push `String(describing:)`: that is even more of a debug tool. Do not put it in a label.

### B43. `for-in` or `forEach` here — does it actually matter?

`for-in` allows `break`, `continue`, and `return` from the outer function. `forEach` is a closure: `return` only leaves that closure, which looks like a bug if you thought you were returning from the function. Prefer `for-in` when you need control flow.

`forEach` is fine for a side-effecting one-liner you will not `break` from. It is not more functional in a way that matters on iOS. Readability and `return` semantics are the real difference.

If they push throwing: `for-in` works with `try`. `forEach`’s closure is not throwing unless you make a throwing overload you probably should not.

### B44. What is `defer` for — isn’t that just code at the bottom of the function?

A block that runs when the current scope *exits* — return, throw, or falling off the end. Multiple `defer`s run in reverse order, like a stack. Use it for closing files, ending a `os_signpost`, unlocking when you are not using an async lock.

Code at the bottom does not run if you `return` in the middle or `throw`. `defer` does. That is the whole trick.

If they push `defer` and `async`: do not hold a lock across `await` and `defer` unlock as if that composed. Different story, later in this list.

### B45. `try`, `try?`, or `try!` on this call?

`try` propagates with `throws` — you handle it or you pass it on. `try?` converts failure to `nil` and you *lose the error*. `try!` crashes on throw. Prefer `try` in app code. `try?` is for truly optional work where failure and missing are the same, like a cache miss.

`try!` in production networking is a crash with extra steps. In a test that must not continue on failure, it can be honest.

If they push `try?` in a chain: remember you cannot tell decode failure from a nil payload. That is the cost of throwing the error away.

### B46. This text is tappable — `Button` or `onTapGesture` on `Text`?

`Button` is a control: VoiceOver, disabled state, keyboard and focus, a reasonable hit target. A gesture on `Text` is easy to miss for accessibility and it does not get the pressed highlight people expect. Use `Button` for actions.

Gestures are for drag, magnification, simultaneous recognisers — not for “this label is secretly a button.” If it looks like a button, it should be a `Button`.

If they push styling: `buttonStyle(.plain)` exists so you can make a button look like text without throwing accessibility away.

### B47. How do you push a screen with `NavigationStack` these days?

The modern push container. You drive it with a path of `Hashable` values — `NavigationPath` or a typed `[Route]`. `NavigationLink(value:)` pushes. `navigationDestination(for:)` decides what view that value becomes.

Do not start new features on deprecated `NavigationView`. The old `NavigationLink(destination:)` inside a `List` still appears in tutorials and fights programmatic back stacks. Path-based navigation is the one that composes with deep links.

If they push UIKit: `UINavigationController` is still everywhere. Same idea: a stack of destinations, not a web of links that each know the next screen.

### B48. Modal this — `sheet` or `fullScreenCover`?

`sheet` is card-style, and by default the user can swipe to dismiss. `fullScreenCover` is edge-to-edge. Use full screen for onboarding, a camera, or a flow that should not look like a card sitting on the previous screen.

If dismissing would lose money or a half-filled form, think about interactive dismiss (`interactiveDismissDisabled`) either way. The choice is mostly visual and gesture, not “which one is a real screen.”

If they push iPad: sheets have detents and can look odd full-width. Check the idiom.

### B49. Why `Image(systemName:)` instead of dropping a PNG in Assets?

SF Symbols are vector symbols from Apple’s set. They scale with Dynamic Type and weight, they align with text, and they match the system. Prefer them over random PNGs for system chrome — settings rows, toolbar items, tab icons you do not need to brand.

Your logo is still an asset. A chevron or a heart should not be. Template rendering (`renderingMode(.template)`) lets them take `foregroundStyle`.

If they push missing symbols on older OS: symbols are tied to OS versions. Know that a name can be nil-looking on an old device if you do not provide a fallback.

### B50. Everyone marks `@State` `private` — is that required, or just style?

The view owns that storage. Other views should receive a `Binding` or a callback, not write your `@State` directly. `private` encodes that. It keeps identity and updates predictable: there is one writer besides the view itself.

It is not a compiler requirement in every case, but skipping it is how a child starts poking parent state without a binding, and then you cannot find who incremented the counter.

If they push passing `$state` to a child: that is the intended sharing. `private` does not block `$` from inside the same type.

### B51. This function is `async` — so it runs in the background, right?

It may *suspend* at `await`. That is not the same as “runs in the background.” An `async` function on `@MainActor` still runs on the main actor between awaits. Blocking work — `Thread.sleep`, heavy JSON on main — still blocks. `async` is a colouring of the function, not a thread pool.

You hop off main on purpose: `Task.detached`, a nonisolated function, an actor that is not MainActor. Do not assume `async` saved the frame rate.

If they push “await sleeps the thread”: no. The task suspends; the thread can do other work. That is I11 in more detail.

### B52. What does `Task { }` actually start? A new thread?

Unstructured concurrent work. It does not create a dedicated thread. It inherits the current actor by default, which is why `Task { }` from a SwiftUI action often still runs on the main actor. Store the task if you need `cancel()`. Prefer `.task { }` in SwiftUI so cancellation follows the view.

`Task.detached` is the one that does *not* inherit the actor. That is a later question. Beginners who spawn `Task { }` in `onAppear` and never cancel are the leak.

If they push structured concurrency: child tasks in a task group end when the scope ends. `Task { }` does not, unless you hold it.

### B53. What is `Sendable`, in a sentence you would actually use at this level?

A type that is safe to pass across concurrency domains — actors, tasks — without data races. At 0–2 years you only need: value types of Sendable fields are usually fine; UI classes are not something you casually send to a background actor.

You will see the compiler complain in Swift 6. The junior move is `@unchecked Sendable` to silence it. Do not. That is a senior ethics question later. For now: structs of ints and strings, send them; `UIViewController`, do not.

If they push actors: isolation is another way to be safe without the type itself being Sendable in the naive sense.

### B54. My SwiftUI preview is empty — I thought it would hit the network?

Xcode renders your view in isolation. There is no real session, no keychain, often no network the way the simulator app has. Inject sample data (`User.preview`) so you do not need the network. `#Preview` is compile-time UI, not a substitute for tests and not a substitute for running the app.

If the preview needs a model, give it a fake. If it needs environment objects, inject them in the preview provider or it crashes in the canvas.

If they push `#Preview` versus `PreviewProvider`: both exist; `#Preview` is the modern macro. Same idea.

### B55. Why does `ForEach` care that this model is `Identifiable`?

A stable `id` used by `ForEach` and `List` to know which row is which across updates. Using `indices` as ids breaks when the list mutates — row state sticks to the wrong item. Use a server id or a UUID per model, assigned once, not `UUID()` in `body`.

Identity is how SwiftUI decides this row is the same row after a sort. If two items share an id, animations and `@State` inside the row go wrong in a way that looks random.

If they push `id: \.self` on a `String`: fine if the strings are unique and stable. Terrible if you have two “Untitled” rows or the string *is* the text the user edits.

---

## Intermediate questions (2–4 years)

Ownership, lifetime, cancellation, and production judgment. Say the rule, then the failure you have actually seen.

### I1. This view has `@ObservedObject var vm = ViewModel()` — why does tapping around reset the screen?

`@StateObject` *owns* the `ObservableObject` — SwiftUI creates it once for this view identity. `@ObservedObject` *observes* an instance owned elsewhere. `@ObservedObject var vm = VM()` in the property initialiser is the classic bug: the view struct is a value, it gets recreated, and you allocate a new `VM()` every time. State looks like it “resets for no reason.”

Observation replacement: `@State` plus an `@Observable` class, or `@Bindable` when the parent already owns it. The wrapper names changed; the ownership rule did not.

If they push a parent that creates the VM: parent uses `@StateObject` (or `@State` with Observation) and passes the instance down as `@ObservedObject` / `@Bindable`. One owner.

### I2. We already talked about the reset — can you walk the lifetime of that `ViewModel()`?

The view struct is a value. Recreating it runs the default initialiser again, so you get a new `VM()`. `@ObservedObject` does not mean “keep this alive.” It means “subscribe to this object I was given.” Ownership must live in `@StateObject` or in a parent that passes the *same* instance.

This is the same story as `@State` versus a plain `var` on the struct. People learn `@State` for `Int` and then forget it for objects.

If they push `init()` on the view creating a VM: still a new VM per struct instance unless ownership is `@StateObject`.

### I3. `@Environment` versus `@EnvironmentObject` — which one crashes if I forget to inject it?

`@Environment` is typed values: color scheme, layout direction, your own `EnvironmentKey`. Missing keys use the default you defined. `@EnvironmentObject` is an `ObservableObject` injected with `.environmentObject`. If it is missing, the app *crashes at runtime* with a message about a missing environment object.

Prefer Observation and environment *values* in new code. Still know this crash, because half the codebases you join still use `@EnvironmentObject`. A default that is a dummy object is safer than a crash, which is why custom keys are nicer for non-observable bits.

If they push SwiftUI previews: forgotten `.environmentObject` is why the canvas explodes and the simulator does not — the app’s root injected it.

### I4. We moved to `@Observable` — what actually got better than `ObservableObject`?

`ObservableObject` broadcasts `objectWillChange` — typically the whole view that holds it refreshes. `@Observable` tracks *which properties* `body` read and invalidates on those writes. A view that never reads `name` does not refresh when `name` changes. That is the performance pitch, and it is real on wide models.

Bindings: `@Bindable var model` or `Bindable(model)`. You lose `objectWillChange` as the hammer; you gain finer invalidation. Mixing both in one screen is possible during migration and a little messy.

If they push Combine: `@Observable` is not a publisher. If you needed pipelines, you still have Combine or you observe with `Observations` on newer OS.

### I5. Who owns an `@Observable` model if I write `let model = Model()` inside the view?

Nobody useful. Store the instance in `@State` (`@State private var model = Model()`) so SwiftUI keeps the same object across `body`. A plain `let model = Model()` in `body` or as a stored property without `@State` is a new instance every time — the Observation equivalent of the `@ObservedObject var vm = VM()` bug.

If a parent owns it, pass it in. The child’s job is to observe, not to construct a second one.

If they push `@Bindable`: that is for bindings into an already-owned observable, not for ownership.

### I6. This `if`/`else` both construct `HomeView()` — why did `@State` inside it reset when the condition flipped?

Structural identity: position and type in the view tree. Those two `HomeView()`s are two identities. Explicit identity is `.id(value)`. Same type in different branches can still reset `@State` because `ViewBuilder` encodes `if`/`else` as different branches — `_ConditionalContent` — not “the same view, different arguments.”

If you need the state to survive the condition, lift the state up, or do not put the view in two branches. `.id` is how you *force* a new identity on purpose.

If they push `if cond { HomeView() } else { HomeView() }`: two identities. That is the follow-up they have in the bank.

### I7. Someone put `.id(UUID())` on this view to “force a refresh” — what did they actually do?

Every `body` evaluation is a *new* identity. SwiftUI destroys and recreates the view, resetting `@State`, cancelling `.task`, replaying animations. You did not refresh data. You threw away the view.

Never generate random ids in `body`. If you need to reload, change a stable id when the *model* changes (a server revision), or reset state explicitly. `.id(UUID())` is a gun on the table.

If they push when `.id` is correct: switching documents, resetting a form after submit, matching a selection. A value that changes when *you* want identity to change.

### I8. Why can `body` run so many times? Is that a bug?

Parent invalidation, environment changes, observed property writes, transactions, the device rotating. `body` must be cheap: no disk, no network, no heavy formatting in a loop. Put work in `.task`, a view model, or a cache. If you log in `body` and you are surprised, you have not watched a SwiftUI app yet.

Running often is the design. Running *expensive* work often is the bug. Instruments and a print of how many times `body` fires will humble anyone.

If they push side effects in `body`: do not. No `URLSession` in `body`. No `UserDefaults.set` in `body`. Description, not action.

### I9. `.task` versus `onAppear { Task { } }` — they look the same in a demo.

`.task` is tied to the view’s appearance in the hierarchy and *cancels* when the view goes away. `onAppear { Task { } }` starts unstructured work you must cancel yourself — easy to leak requests after pop, and easy to start a second task if `onAppear` fires again.

I prefer `.task` for “load this when the screen is shown.” I use `onAppear` for non-async UI tweaks. If I must use `Task` in `onAppear`, I store it and cancel in `onDisappear`, which is just a worse `.task`.

If they push `.task(id:)`: it cancels and restarts when the id changes. That is how you reload when `userID` changes without `.id(UUID())` on the whole view.

### I10. User pops the screen mid-request — how do you cancel the network?

Prefer `await URLSession` inside `.task`. Cancellation propagates to `URLSession`’s async APIs; they throw `CancellationError`. If you use unstructured `Task`, store it and `cancel()` in `onDisappear`. Old style: keep the `URLSessionTask` and `cancel()` it.

The failure mode is a completion that calls back into a deallocated view controller, or SwiftUI trying to publish after pop. Weak self plus cancellation is belt and braces.

If they push Combine: store the `AnyCancellable` and it cancels on `deinit` if you got ownership right — which is I28.

### I11. If I `await` on the main actor, am I blocking the main thread?

No. The *task* suspends; that thread can run other work. `Thread.sleep`, heavy CPU, or a synchronous file read *does* block. Cooperative await is not “stop the main thread until the network returns.” The run loop can breathe at the `await`.

The trap is work *between* awaits: decoding 10 MB of JSON on `@MainActor` after `await data(for:)` still freezes frames. Suspension points are not a blanket pass.

If they push `Task.sleep` versus `Thread.sleep`: `Task.sleep` is cancellable and does not block the thread. `Thread.sleep` is the bug.

### I12. Structured versus unstructured concurrency — why do people care in an iOS app?

Structured: child tasks (task group, `async let`) end when the scope ends; cancellation flows down. Unstructured: `Task { }` lives until it finishes or you cancel it. SwiftUI `.task` is structured to the view, which is why it is the right default on screen.

Unstructured is how work outlives a pop. Structured is how you know a function does not leak tasks when it returns. In an interview, say where the lifetime is rooted: a view, an actor, or “we forgot.”

If they push `async let`: children of the current function. You `await` them before the function returns (or they are cancelled on exit).

### I13. Three image URLs versus N from the server — `async let` or `TaskGroup`?

`async let` is a fixed number of siblings you know at compile time: profile, banner, badge, three awaits. `TaskGroup` is a dynamic count: N image downloads from a list. Do not start an unbounded group without a limit — 400 thumbnails is how you melt the network and the memory budget.

I cap groups (a small pool of child tasks) when the list is user-driven. `async let` for the known handshake of a screen.

If they push `async let` in a loop: that is a task group. The syntax does not spawn a dynamic set.

### I14. I cancelled the task — why is this `for` loop still chewing CPU?

Cancellation sets a flag. It is cooperative. `URLSession` async APIs throw `CancellationError`. Your `for` loops must `try Task.checkCancellation()` (or `Task.isCancelled`) or they keep running. There is no preemptive kill of CPU work.

That is why a tight image-processing loop on cancel still hits the watchdog until you check. Await points often check for you; raw CPU does not.

If they push `Thread` kill: we do not do that. Cooperative or you live with the work.

### I15. Why `@MainActor` on this view model? Couldn’t I hop only in the view?

UIKit/SwiftUI state must be used on the main actor. Marking the VM `@MainActor` makes the compiler hop you there on calls, instead of you remembering `DispatchQueue.main` on every assignment. `async` on `@MainActor` still runs on main *between* awaits — do not decode 10 MB JSON there.

Hopping only in the view works until a timer, a Combine sink, or a protocol extension writes `self.items` off main. Isolation on the type is the fence.

If they push “yes, async can still be on main”: that is the follow-up. Say it before they ask.

### I16. Shared mutable cache — actor or a lock?

An actor serialises access and composes with `await`. A lock is blocking and *must not* be held across `await` (deadlock, priority inversion). Prefer actors for shared mutable app state: in-flight requests, token refresh, an image memory cache if you are careful about reentrancy.

Locks still exist for tiny, proven critical sections that never await — or for interop. If the next line is `await`, it is an actor (or you copy the data out, drop the lock, then await).

If they push `OSAllocatedUnfairLock`: fine for non-async, local serialisation. Not a networking strategy.

### I17. Inside this actor I `await` a download, then I read `self.items` — is that still the list I saw before the await?

Maybe not. After `await` inside an actor method, another task may have run on the same actor and changed state. That is reentrancy. Re-read properties after the await; do not assume `self.count` is still 0. Do not hold a logical transaction in local variables across a suspend unless you designed it that way.

People hear “actors prevent races” and think “actors prevent interleaving.” They prevent data races on the isolated state. They do not freeze the world at `await`.

If they push a fix: cache what you need in locals, or use a reentrancy-resistant pattern (a flag, a generation token, “only the latest task writes”).

### I18. You said structs copy — so is `items.append` on a 100k array expensive every time?

`Array` / `String` / `Dictionary` share a buffer until mutation. Unique reference → mutate in place. Extra references, including an escaping closure that captured the array, force a copy. `isKnownUniquelyReferenced` is the check the stdlib uses.

Copy-on-write is why Swift can have value semantics without copying 100k elements on every pass. It is also why “I passed the array into a closure and now appends are slow” happens.

If they push `NSArray` bridging: bridging can add references and ruin uniqueness. Worth knowing in hot paths.

### I19. I implemented `draw()` in a protocol extension, and `let p: Shape = Circle()` called the wrong one — what happened?

Methods that are *not* protocol requirements, implemented only in an extension, dispatch *statically* (the compile-time type). Requirements dispatch dynamically through the witness table. Putting `draw()` only in an extension means `let p: Shape = Circle()` may not call `Circle`’s version.

If you want polymorphism, declare it on the protocol. If you want a default, declare it on the protocol *and* provide the default in an extension. The trap is “I overrode it in an extension” when there was nothing to override.

If they push `final` classes: class methods still use the class’s dynamic dispatch; this trap is specifically protocol extensions versus requirements.

### I20. `some P` versus `any P` — I still mix them up in APIs.

`some P` is one concrete type, hidden from the caller. `any P` is an existential box; mixed arrays live here. SwiftUI `body` wants `some View`. Use `any` at the rim when you must store heterogeneous values: `[any ChartMark]`, a plugin, a type-erased cell.

`some` is cheaper and preserves identity. `any` is the “I have many concrete types and one array” tax. If you can be generic (`func f<T: P>(_ x: T)`), that often beats both at the function boundary.

If they push returning `some View` with branches: `if`/`else` still has to type-check as one opaque type; `@ViewBuilder` helps. Returning `any View` is the escape hatch that costs.

### I21. Why do people say generics beat `any Collection`?

`any Collection` hides `Element`. You cannot easily return `Element` without more boxing. Generics (`func f<C: Collection>(_: C)`) keep `C.Element` in the type system. Protocols with associated types (PATs) are painful as existentials — historically you could not even write `any Collection` until existentials got better, and associated types still fight you.

When you need the element type downstream, stay generic. When you need a heterogeneous array of collections of *unknown* element, you are in for a bad time and maybe type erasure.

If they push `some Collection`: opaque return of one collection type. Great for “hide the concrete array vs lazy slice.” Not great for mixed arrays.

### I22. When do you actually reach for type erasure — `AnyView`, `AnyPublisher`?

When you must name a type or store mixed implementations: `AnyView`, `AnyPublisher`, `AnyIterator`. Cost is a box and lost specialisation. Use at API boundaries, not in a hot `body`. A `switch` that returns `AnyView` in every cell of a `List` is a hitch you will profile later.

I erase when the alternative is an unutterable generic that leaks into every caller. I do not erase to silence the compiler in a tight loop.

If they push `AnyView` in `body`: a few branches at the root of a screen can be fine. Per-row in a list is where it hurts.

### I23. How do you unit-test this view model without booting SwiftUI?

Inject a fake API. Call `await vm.submit()`. Assert `vm.state` and that the fake saw the right request. Do not load SwiftUI in unit tests if you can avoid it. The VM should not need a `View` to exist.

Constructor injection makes this boring, which is the goal. A VM that reaches for `URLSession.shared` is untested, not “pragmatic.”

If they push snapshot tests: that is the view, a different layer. Logic tests should not wait on pixels.

### I24. Mock versus fake — which one do you want for this API client?

Mock: verifies calls (`expect fetch once`). Fake: a working in-memory stand-in (in-memory repo, a client with a dictionary of canned responses). Fakes are usually easier to maintain for iOS view models. Mocks get brittle when you add a log line and the expect-count breaks.

I use fakes for state machines. I use mocks (or a fake that records calls) when the *interaction* is the spec: “we must not charge twice.” Even then a fake with a counter is often enough.

If they push mocks from a Java textbook: iOS interviews still like this distinction. Say it calmly.

### I25. How do you stub `URLSession` so the unit test does not hit staging?

Custom `URLProtocol` registered on a `URLSessionConfiguration`, or wrap the session in a protocol (`HTTPClient`) and inject a fake. I prefer the protocol for app code: the tests never mention URL loading at all. `URLProtocol` is useful when you do not own a seam yet.

Do not hit the network in unit tests. Do not use a “unit” test target that needs VPN. CI will fail on a Tuesday for a DNS reason.

If they push Combine `dataTaskPublisher`: same seam. Fake the client, not the publisher graph, unless you are testing operators.

### I26. Search box — `debounce` or `throttle`?

Debounce: emit after the user *stops* typing for N ms. Throttle: emit at most once per interval (first or latest depending on the API). Search boxes want debounce. Scroll position or a game loop might want throttle.

Wrong operator is why you fire a request per keystroke or why the last letter never searches. `debounce` plus `switchToLatest` (I67) is the classic search pipeline.

If they push values: 200–300 ms is a starting point, then you watch Analytics for slow typists. Not a magic constant.

### I27. `PassthroughSubject` versus `CurrentValueSubject` for this UI state?

Passthrough: no initial value; new subscribers get future events only. CurrentValue: always has a current value; new subscribers get it immediately. UI state usually wants current value — a label that subscribes late should still show the latest name.

Events (“the user tapped save”) are more Passthrough. State (“are we logged in”) is CurrentValue or, today, `@Observable`. Do not use Passthrough for something a new subscriber must not miss.

If they push `@Published`: it behaves like a current-value source on `ObservableObject`. Same instinct.

### I28. Why `[weak self]` in this `sink`? The VM already owns the cancellable.

You store `AnyCancellable` on `self`. The subscription holds the closure. A strong `self` in the closure is a cycle: self → cancellable → subscription → closure → self. Use `[weak self]` and `guard let self`.

This is the Combine version of the closure cycle. Forgetting it is a memory graph that still shows a screen after pop.

If they push `sink` on `self.objectWillChange`: still a cycle if you capture strongly and store the cancellable on self.

### I29. Can we restore this `NavigationPath` after a kill?

Make routes `Codable`. Persist the stack (`SceneStorage`, a file, sometimes `NSUserActivity`). On launch, decode into `NavigationStack(path:)`. Typed `[Route]` is easier than untyped `NavigationPath` for restoration, because you know the payload.

Untyped `NavigationPath` can encode if the values are `Codable`, and debugging it is less fun. A typed enum `Route` is the restoration-friendly design.

If they push log-in gates: restore into a stack, then apply the gate — do not deep-link into a secret screen before session is ready.

### I30. A universal link opens — how do you route it without scattering `openURL` in views?

Parse URL → app `Route` → select the right tab → set the navigation stack. One router, not `openURL` scattered in views. Ignore malformed URLs safely; do not crash on a bad campaign link.

Views can call `router.open(url)` or, better, the scene / app delegate does, and the router owns tabs and stacks. Leaf views that each try to push from a URL will disagree about which tab you are on.

If they push cold start versus warm: same router, different entry (unprocessed URL on launch versus `onOpenURL` while running).

### I31. Pagination keeps showing the same row twice after a refresh.

Cursor or page token from the server, not “page 2” if the first page shifted. Merge with a `Set` of ids. List identity is the item id, not the row index. Duplicates happen on pull-to-refresh overlapping an in-flight next page, or on a server that is not stable.

Deduping at merge is defensive. Fixing the cursor is the real fix. Never use indices as `ForEach` ids here.

If they push prepend versus append: refresh replaces or prefixes with the same merge rule. Two code paths that skip the `Set` is how dupes return.

### I32. Ten requests 401 at once — why did we fire ten token refreshes and log the user out?

Ten 401s should trigger *one* refresh. An actor (or a serial queue) runs refresh once; other callers await the same `Task`. Then retry the originals. Without this you stampede the auth server, revoke your own refresh token, and dump the user at login.

This is the most production-shaped concurrency question at this level. Draw the actor: `refreshTask: Task<Token, Error>?`. First waiter creates it; the rest await it; clear it when done.

If they push a 401 during refresh: fail the queue, logout once, do not recurse.

### I33. What is your retry policy on this client? Not “retry until it works.”

Retry idempotent GETs with exponential backoff and a cap. Honour `Retry-After`. Do not blindly retry POST payments. Distinguish 429 versus 500 versus offline. A timeout on charge is not “try again immediately.”

Idempotency keys (I58, A33) pair with POST retries. Without them, retry is a double charge. Say that out loud.

If they push jitter: add jitter so a herd of apps does not retry in lockstep after an outage.

### I34. `URLCache` versus rolling our own disk cache for images?

`URLCache` follows HTTP cache headers. Your disk cache is for images, offline documents, or when the API sends `no-store` but product still wants a thumbnail. Do not double-cache blindly — you will serve stale and not know which layer lied.

If the CDN headers are correct, `URLCache` plus `URLSession` is a lot of image caching. If the API is `Cache-Control: no-store` on media, you need your own policy and eviction.

If they push `NSCache`: memory layer (I78). Disk is for process death.

### I35. Can I pass this `NSManagedObject` to a background queue?

No. `NSManagedObject` is confined to its context. Pass `objectID`, then `context.object(with:)` on the destination queue. Touching an object off-queue is a crash, often intermittent, often “only in production.”

`perform` / `performAndWait` is the fence. This is still the number one Core Data crash. SwiftData has the same instinct with `ModelContext`.

If they push `refresh(_:mergeChanges:)`: that is still on the right queue. Not a passport to hop.

### I36. New feature — SwiftData or stay on Core Data?

Stay on Core Data for complex migrations, existing stacks, mature tooling, and heavy concurrency patterns you already trust. SwiftData is fine for new, simpler models, especially if the team is SwiftUI-first and the schema is calm.

A rewrite of a working Core Data stack to SwiftData is not a feature. Hybrid happens: new lightweight store in SwiftData, the messy store left alone.

If they push “Apple wants SwiftData”: Apple wants you to ship. Interviews want judgment, not a press release.

### I37. Is `lazy var` safe if two threads first-access it?

No. First access is not atomic. Two threads initialising the same `lazy var` is undefined behaviour. Use `let` plus init, an actor, or something like `OSAllocatedUnfairLock` for lazy shared state.

`lazy` is fine on main-actor UI objects that never hop. It is not a singleton strategy. The “shared service” lazy static is a race waiting for Swift 6 to yell.

If they push `static let`: type properties of that form are lazily initialised in a thread-safe way for the type itself. Instance `lazy var` is the trap.

### I38. We added a `NotificationCenter` block observer and leaked the screen.

Block-based observers must be removed or you leak. Store the token and remove in `deinit`, or use Combine / `NotificationCenter.default.publisher` with a lifecycle (`.task`, cancellable on the VM). Selector observers on `self` also needed unregistration historically.

The block captures `self`, the center retains the block — you know the song. `.task` plus publisher is the SwiftUI-shaped fix.

If they push `addObserver(forName:object:queue:using:)`: that is the API whose return value you must keep and remove.

### I39. This `Timer` kept firing after the screen popped.

`Timer.scheduledTimer(timeInterval:target:selector:)` *retains the target*. Invalidate in `deinit` / `onDisappear`. Block-based timers can capture `self` strongly — use weak, and still invalidate. Run loops plus repeats are a little ownership maze.

SwiftUI: `.task` with `Task.sleep` in a loop, or a timeline view, often beats a `Timer` you will forget to kill. If you use `Timer.publish`, store the cancellable.

If they push `repeats: false`: still retain until it fires. Repeating is how you notice.

### I40. The SwiftUI list stutters — first three checks?

Full-resolution images decoded on the main thread. Unstable identity (`id: \.self` on a changing value, or indices). Heavy work in `body`, or a non-lazy `VStack` of thousands of rows.

Then: `AnyView` per row, layout thrash from `GeometryReader`, and a view model that publishes on every byte of a download. But those three catch a shocking amount of intern-week performance bugs.

If they push Instruments: Time Profiler plus SwiftUI instrument, not guessing. Start with images and identity because they are cheap to verify.

### I41. I dropped in a `GeometryReader` and the layout exploded. Why?

`GeometryReader` expands to take *all space offered*, which can blow up stacks and cause recursive layout. Prefer `containerRelativeFrame`, `visualEffect`, or `onGeometryChange` on modern OS versions. If you must use it, constrain it — a frame, a background, not as the flexible child of an `HStack` that wanted hugging.

The explosion looks like “the view took the whole screen” or “layout loop, CPU 100%.” Both happen.

If they push reading size for a font: `onGeometryChange` or a `Layout` is calmer than a reader that resizes what it just measured.

### I42. Preference keys — why did I get extra layout passes and then a loop?

Preferences send values *up* the tree and can trigger extra layout passes. If a preference writes `@State` that changes layout that writes the preference again, you loop. Keep the data small and stable. Do not round-trip a size into state that changes the size.

They are the right tool for “child tells parent its size / its anchor.” They are the wrong tool for animation state.

If they push `onPreferenceChange`: that is the write into `@State`. Guard it — only set if the value actually changed.

### I43. `UIViewRepresentable` — what belongs in `makeUIView` versus `updateUIView`?

`makeUIView` creates once. `updateUIView` must be *idempotent* — set properties from SwiftUI state, do not recreate the `UIView`, do not add the target every call (or you stack actions). Use a `Coordinator` for delegates and targets. Do not capture SwiftUI views strongly in the coordinator.

The bug is `updateUIView` calling `addSubview` every time, or constructing a new `AVPlayer` every state tick. SwiftUI will call `updateUIView` often. Treat it like `body`: cheap and declarative.

If they push `dismantleUIView`: cleanup, invalidate, pause player. Lifetime, not setup.

### I44. Adding a child view controller — what is the actual sequence? People skip a line.

`addChild`, `view.addSubview`, `didMove(toParent:)`. Removal: `willMove(toParent: nil)`, remove the view, `removeFromParent()`. Skipping this breaks appearance callbacks, safe area, and rotation. The child never hears `viewWillAppear` correctly, and then someone “fixes” it with a manual call.

This is still asked because it is still broken in codebases. Containment is a protocol with UIKit, not `addSubview` of `child.view`.

If they push Auto Layout on the child view: pin after it is in the tree, `translatesAutoresizingMaskIntoConstraints = false`.

### I45. Why diffable data sources instead of `reloadData`?

You apply a *snapshot* of identified items. UIKit diffs and animates. Fewer “inconsistent state” crashes than `reloadData` plus manual inserts — the ones where `numberOfRows` disagrees with what you told `insertRows`. Identity must be stable; if two items share an id, the diff lies.

`reloadData` is still fine for a full reset. Diffable is the default for lists that animate and paginate.

If they push `performBatchUpdates` from memory: that is the API people got wrong. Diffable exists because of that.

### I46. Coordinator versus `NavigationLink` in every leaf — when does the graph become untestable?

Leaf views that each push create an untestable graph: deep links, login gates, and “where am I” have no owner. A coordinator — or a single `NavigationStack` path owned high up — owns those. `NavigationLink` is fine for simple trees: settings pages that never deep-link.

The senior instinct is: who can you ask “show checkout from a notification”? If the answer is “the button inside `CartRow`,” you need a path or a coordinator.

If they push SwiftUI-only teams: a path enum at the root *is* the coordinator. You do not need a class named Coordinator.

### I47. Constructor injection versus a service locator — we have `ServiceLocator.shared.api` everywhere.

`init(api: API)` makes dependencies obvious and testable. A global `ServiceLocator.shared.api` hides them and makes tests order-dependent: one test sets the locator, another test sees it. Locators are a last resort for legacy, not a default.

Composition root: the app / scene / feature factory. Not `ViewModel()` inside `body` reaching into a locator. If they say “but then every init is long,” that is a feature object with too many friends, not an argument for globals.

If they push environment injection in SwiftUI: fine for ambient things. A required `CheckoutClient` should still fail at compile time in `init` if possible.

### I48. Product wants TCA for this settings form with two toggles. Overkill?

Yes. A settings form with two toggles. A team that has never used reducers. A deadline next week. TCA shines for complex state machines and replay; it is not free. You pay vocabulary, boilerplate, and hiring.

I would use a small `@Observable` model. I would not die on the hill if the rest of the app is already TCA and this form must live in that tree. Matching the codebase beats purity.

If they push “Netflix uses it”: not an argument (A70). Problem shape and fluency are.

### I49. How does “clean architecture” actually map onto this iOS app?

Entities and use cases in the middle, as pure Swift. SwiftUI and `URLSession` at the edges. Dependencies point inward. Do not invent six folders for a three-screen app. The test that a boundary exists is a fake in a unit test, not a directory named `Domain`.

I extract when a feature is changing or when tests cannot run without UIKit. I do not start a new app with Enterprise Onion Week.

If they push VIPER: same inward rule, more types per screen. Often a poor fit for SwiftUI (A42).

### I50. How do you actually investigate a leak — not “I would use Instruments”?

Xcode memory graph: look for cycles (VC → closure → VC). Instruments Leaks plus Allocations, mark generations, see what grows. Common: delegates not weak, timers, Combine sinks, SwiftUI sheet identity that keeps a model, notification observers.

Say what you click. “Retain cycle” is the vocabulary; the graph is the proof. If the count is a cache, it might be jetsam (A23), not a cycle.

If they push SwiftUI: `.id`, sheets, and `@State` holding a class are the usual suspects, not `malloc`.

### I51. Main Thread Checker flagged us — what do you do next, besides turning it off?

A UIKit/AppKit call ran off main. Find the `await` that resumed on a background executor, then `await MainActor.run` or mark the UI method `@MainActor`. Do not globally silence the checker. The stack trace is the assignment; follow it to the hop you missed.

Classic: decode on a default executor, then `imageView.image =` without hopping. Swift 6 makes this louder. The checker was the old alarm.

If they push “it only happens once”: still a crash on some devices. Fix it.

### I52. Can I mark this class view model `Sendable`?

Do not slap `@unchecked Sendable` on a mutable class. Isolate it with `@MainActor` (UI VM) or turn shared mutable state into an actor. Unchecked is a promise you must prove — a lock, immutability, something real.

A UI view model that is `@MainActor` does not need to be Sendable in the casual sense; isolation is the safety. Crossing it off-main is the bug `@MainActor` prevents.

If they push a model shared with a background actor: that data should be a Sendable value snapshot, not the VM class.

### I53. When is `Task.detached` the right call? I see it in blog posts a lot.

When you must *not* inherit the current actor — heavy work that would otherwise stay on main. Rare. Prefer `Task { }` or a dedicated actor. Detached tasks skip task-local values too, so your trace ids vanish.

Most “I used detached” code should have been a nonisolated method or an actor. Detached is a sharp hop, not a performance default.

If they push priority: you can set it, and you can still accidentally fight the main actor when you hop back wrong.

### I54. Bridging this callback API with `withCheckedContinuation` — what are the rules?

Resume *exactly once*. Never resume twice (crash) or never (hang). Use checked in debug; unchecked only if you have proven it. Bridge callback APIs, then prefer native async when you control both sides.

The bug is a callback that can fire twice, or an error path that forgets `resume`. Wrap the resume in a state flag if the vendor is sloppy.

If they push cancellation: `withTaskCancellationHandler` to cancel the underlying task, and still resume once.

### I55. We wrapped the view in `EquatableView` to skip `body` — what is the danger?

If `==` is wrong — ignores a field that affects UI — SwiftUI skips `body` and the screen is stale. Only use equality optimisation when you understand every input, including environment and bindings that might not be in your `==`.

Faster lists are real. Invisible toggles are also real. Measure first; `EquatableView` is not a default wrapper for every cell.

If they push `let _: Void` tricks to force inequality: you are fighting the optimisation you just added. Stop.

### I56. `ForEach(items.indices)` — the toggle on row 0 stuck to the wrong person after a delete.

Indices are 0, 1, 2. When you delete item 0, the row that had id `1` becomes `0` and *keeps the wrong `@State`*. Use `ForEach(items)` with `Identifiable`. Identity follows the model, not the slot.

This is B55’s production form. It shows up in interviews because everyone has shipped it.

If they push `ForEach(0..<n)`: same bug, plus you do not even have the model in the row without another subscript.

### I57. Optimistic like: we flipped the heart, the request failed — now what?

Flip liked in UI immediately, send the request, *roll back* on error. Keep the same item `id`. Do not insert a duplicate row. Do not leave the heart filled with a toast that nobody reads.

Conflict: if the server says it was already liked, merge to that truth. The id is how you find the row. A UUID generated at tap time is how you get two hearts.

If they push offline: queue with an idempotency key (I58), still one id.

### I58. Offline queue for POST — what do you persist besides the payload?

Persist the request with an *idempotency key*. Replay when online. The server must de-dupe or you double-charge. GET is easier to retry than POST. Show queued state in the UI so the user does not tap again.

A disk queue of identical “create order” bodies without keys is a support ticket. The key is a UUID generated once, stored until success, sent on every retry.

If they push ordering: some queues must be serial (bank), some can be parallel (analytics). Product, not a library default.

### I59. ATS is blocking this legacy printer — can we turn ATS off?

Never disable ATS globally. Add exceptions *per domain* with a documented reason (legacy printer, etc.). Prefer fixing TLS. A blanket `NSAllowsArbitraryLoads` is a security review finding and an interview fail.

If the printer is `http` on a LAN, exception that host, consider it a debt item, do not open the whole app to cleartext.

If they push Info.plist: they may want the key names. Domain exceptions live under `NSExceptionDomains`.

### I60. Can we stash the JWT in UserDefaults? It is just a string.

No. Backups, screenshots of defaults, and other apps on a jailbroken device can read it. Keychain with an appropriate accessibility class. B24 again, now with a credential in the sentence.

If they push Keychain availability: same `WhenUnlocked` versus `AfterFirstUnlock` story as tokens.

### I61. We put Face ID in front of the balance screen — what is actually protected?

Face ID should unlock a *Keychain item* (the token). A boolean `if faceOK { showBalance }` is bypassable — skip the view, attach a debugger, the secret is already in memory or UserDefaults. The secret never sits in UserDefaults after success.

Biometrics are a UX gate over a secure enclave–backed item, not a permission bit you store as `UserDefaults.facePassed`.

If they push LocalAuthentication only: LA proves the user is present. It does not encrypt your database by itself.

### I62. `scenePhase` went to background — is that when we persist the draft? What about `applicationWillTerminate`?

Save drafts on `.background`. `applicationWillTerminate` may *not* run (jetsam). Treat background as the last reliable chance. Also save at meaningful pauses — scene resign, user switches tabs — if the draft is precious.

If you only save on terminate, you will lose text, and you will not be able to reproduce it in the debugger because you stopped the app politely.

If they push `scenePhase` `.inactive`: a good extra flush for the phone switcher screenshot, and for the overlay in A61.

### I63. When do you actually need a background `URLSession`?

Uploads and downloads that must continue after the app suspends. Use a background configuration and a session delegate in the app delegate / scene. Regular `data(for:)` stops when you are suspended. A 400 MB video from the camera roll is the poster child.

Do not background-session a 2 KB JSON GET. The complexity (delegate, recreate session with the same identifier, events on relaunch) is not free.

If they push completion handler versus delegate: background sessions want the delegate dance.

### I64. We’ll just run this sync in the background later — `BGTaskScheduler` or hope?

You schedule work; iOS runs it under *budget*. Not an alarm clock. Handle deferred execution and test with debug launches (`e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateLaunchForTaskWithIdentifier:...]` is the old war story; know that simulation exists). If the work must happen at 9:00 sharp, that is a notification plus a server, not `BGAppRefresh`.

Hoping the OS will call you every morning is how morning-news apps miss the morning.

If they push energy: budget is why the OS will skip you. Design for “maybe later.”

### I65. Snapshot tests flake in CI — why, if they passed locally?

OS version, simulator locale, Dynamic Type, animations not disabled, async images not waited. Pin OS, freeze time, wait for existence, disable animations. A snapshot of a spinner is a coin flip.

Also: dark mode, 3× versus 2×, and a font Apple changed in a point release. Pin the simulator runtime in CI like you pin the compiler.

If they push perceptual vs exact: exact is brittle; perceptual can hide real padding bugs. Choose on purpose.

### I66. How many UI tests versus unit tests would you write for this app?

Many fast unit tests for logic. A *few* UI tests for critical paths (login, purchase). UI tests are slow and flaky; do not replace unit tests with them. A 20-minute UI suite that fails because a banner loaded is how the team ignores CI.

I would rather 200 VM tests and 8 UI tests than 80 UI tests and a prayer.

If they push snapshot versus UI: snapshots for layout regressions, UI tests for flows. A39 at this level.

### I67. Each keystroke starts a search publisher — how do you not show the stale slower response?

`map { search($0) }.switchToLatest()` cancels the previous inner publisher so only the latest query’s result wins. Without it, “al” returns after “algorithm” and the list jumps back. `flatMap` would let all of them finish.

This is debounce’s partner. Debounce waits; `switchToLatest` races.

If they push async/await: a task per keystroke plus cancel the previous `Task` is the same idea.

### I68. We `eraseToAnyPublisher()` everywhere for “cleaner types.” What’s the cost?

It hides the concrete publisher type — good at module boundaries — by boxing. Do not erase in a tight inner pipeline if you can keep the generic type. Operators compose into ugly nested types; erasure is the trade at the *edge* of a function you want to name.

A view model property of `AnyPublisher<State, Never>` is reasonable. Erasing after every `map` in a local pipeline is noise and a small tax.

If they push SwiftUI: `AnyView` is the same instinct. Boundary, not interior.

### I69. The wrong view animated — identity change versus value change?

Changing a property on the same identity uses implicit or explicit *value* animations. Insert/remove of a different identity uses *transitions*. Mixing them is why “the wrong view animated.” A list that uses indices as ids animates the wrong rows; a `.id` change plays a transition you did not ask for.

When debugging, ask: did identity change, or did a property change? Then pick `animation` versus `transition`.

If they push `withAnimation`: it animates state writes in that transaction for matching identities.

### I70. `matchedGeometryEffect` did nothing. What does it actually require?

Same `Namespace`, matching ids, both views in the hierarchy during the transition — often an overlay so the source does not disappear first. If one disappears first, the effect fails silently, which is infuriating.

Matched geometry is not a hero animation SDK. It is “these two frames are the same thing for one transition.” Z-order and `isSource` still bite.

If they push NavigationStack: hero from list to detail is still fiddly. Say so. Interviewers have been burned too.

### I71. Walk me through adding a custom environment value — not `@EnvironmentObject`.

Define `struct MyKey: EnvironmentKey { static let defaultValue = ... }`, extend `EnvironmentValues`, then `.environment(\.myKey, value)` and `@Environment(\.myKey)`. The default is why missing injection does not crash.

Use this for theme tokens, a router handle, a calendar. Use observable models when the value is an object that mutates. Do not put a new `@EnvironmentObject` on the tree for a `Bool`.

If they push the key path: the extension property is what you actually type. The `EnvironmentKey` is the storage.

### I72. Should this view model import SwiftUI?

Prefer not. Faster tests, no accidental `Color` in the domain, clearer boundary. Not dogma: a tiny `@Observable` UI helper can import SwiftUI. Do not put `URLSession` in a `View`, and do not put `View` types in a networking client.

`Color` in a VM is the tell. Map to a domain `severity` and let the view pick `Color`. Tests stay fast and headless.

If they push Observation: `@Observable` lives in Observation, not SwiftUI, which is the point of the split.

### I73. First cut at modularising this app — by layer or by feature?

Modules by *feature* (`Home`, `Checkout`) with a small public API, not “all views” versus “all models.” Shared kits at the bottom. Features should not import each other. A `UI` module that everything imports becomes a rebuild of the universe on every padding change.

First cut is often folders, then SPM when compile time or teams demand it. Cycles (A20) destroy incremental builds.

If they push 40 packages on week one: overkill. Two features and a `Networking` kit is a cut.

### I74. Can we log the email and token to find this bug?

No access tokens, no passwords, no full emails if policy forbids, no health identifiers. Use `os.Logger` categories and redaction. Logs leave the device via crash tools. A debug `print(token)` that ships is an incident.

Log a stable user id your privacy policy allows, a request id, a status code. Not the payload of `/me`.

If they push `String(describing: user)`: that is how PII sneaks in. Explicit fields.

### I75. `Result` versus `throws` on this API client — how do you choose?

`async throws` at the call site is idiomatic. Store `Result` when you need to hold success/failure in state without throwing through UI — `enum LoadState` often eats the error instead. Do not mix both in every layer: a client that throws, a VM that maps to state.

`Result` in a callback API is fine. A new async client that returns `Result` *and* throws is a maze. Pick one per layer.

If they push typed errors: `throws(APIError)` is nicer in modern Swift when you actually switch on it.

### I76. `nonisolated` on this actor method — when is that honest?

When the method does not touch actor-isolated state — a pure function on inputs. It can then be called without a hop. Wrong use: reading `self.cache` from `nonisolated`. The compiler should catch that; `@unchecked` and unsafe pointers are how you sneak around it.

I mark `nonisolated` on helpers that format or hash, sitting on an actor type for namespacing. I do not mark it to “make it faster.”

If they push `nonisolated(unsafe)`: that is a promise, like `@unchecked Sendable`. Document or do not use.

### I77. Thumbnails are huge in memory — why downsample, and where?

Decoding a 12 MP photo into a 44 pt thumbnail wastes hundreds of MB. Decode and downsample to the display size (`ImageIO` thumbnail APIs, `CGImageSourceCreateThumbnailAtIndex`). Do it off the main actor. Then cache the small bitmap, not the camera original.

`UIImage(data:)` on a full photo in a list is I40 check one. Downsampling is the fix, not a smaller `frame` in SwiftUI — the bitmap is already huge.

If they push `UIImage` size versus pixel size: `size` is points. Scale 3 images are 9× the pixels. Downsample in pixels.

### I78. Image memory cache — `NSCache` or a `Dictionary`?

`NSCache` evicts under memory pressure and is thread-safer for this use. `Dictionary` grows until you die. Use `NSCache` for image memory caches. It is not durable; process death clears it. Pair with disk if you need that.

Keys should be cheap (`NSURL`, a struct wrapped as `NSObject`). Do not expect LRU guarantees as strict as a textbook; treat it as “best effort under pressure.”

If they push counting cost: `NSCache` has `totalCostLimit`. Set it. A cache with no limit is a `Dictionary` with extra steps.

---

## Advanced questions (4+ years)

Internals, isolation, systems, and judgment. Lead with the mechanism, then what you would actually do on a team.

### A1. When a property on an `@Observable` model changes, which views actually refresh?

During `body`, reads of `@Observable` properties register a dependency. A later write to *those* fields invalidates that view — not every property on the object. Views that never read `name` will not refresh when `name` changes. That is the whole pitch versus `objectWillChange` blasting the tree.

If you only say “any property change refreshes every view,” you are describing `ObservableObject`, and they have already sorted you into the wrong decade. Outside SwiftUI on iOS 26, `Observations` lets you await coalesced changes, which is the UIKit-facing version of the same tracking.

If they push a view that reads in a helper: if `body` called the helper, those reads still count. If a timer reads off to the side, it may not.

### A2. Why is `any View` in a hot `body` something you would flag in review?

Existential `any View` boxes the concrete type, blocks specialisation, and weakens identity. Lists of mixed `any View` are a known hitch source. Keep `some View` in `body`; erase only at a boundary (`AnyView`) if you must — a plugin slot, a server-driven widget you cannot genericise.

I would not fail a PR for one `AnyView` at the root of a settings screen. I would fail a `ForEach` that type-erases every row. Measure if someone wants to argue; this one usually shows up in Time Profiler as retain/release noise.

If they push `Group` as a fix: `Group` does not erase. It is still `some View` if the children type-check.

### A3. View value versus `body` versus render versus `@State` lifetime — people mash these clocks.

Creating a `View` value is cheap and frequent; it is just a struct. `body` is the dependency-tracked description. Render and layout happen later, on the system’s schedule. `@State` lives as long as *identity*, not as long as a particular struct instance. Mixing these clocks is how people “lose state” or think `init` is `onAppear`.

I talk about it as three clocks: value creation, invalidation of `body`, and persistence of storage. You debug the wrong one if you `print` in `init` and conclude the view “leaked.”

If they push `onAppear` versus `init`: `init` can run all the time. Side effects go in `.task` / `onAppear`, storage in `@State`.

### A4. How does `ViewBuilder` encode `if`/`else`, and why does that reset `@State`?

As `_ConditionalContent` (or the equivalent the compiler uses today): two different types, therefore two identities. `@State` does not carry across branches even if both look like `HomeView()`. It is not a bug in your `HomeView`; it is the tree shape.

`switch` is the same family of problem. Lift state, or keep one identity and pass the condition in. This is I6 with the compiler’s type in the sentence.

If they push `if` without `else`: optional-shaped content, still a different structure when it appears and disappears — insert/remove, not a property flip.

### A5. What is actually happening when I write `$count` on `@State`?

The wrapper is `_count`. `count` is `wrappedValue`. `$count` is `projectedValue`. For `@State`, projected value is `Binding`. That is why child views write parent storage without owning it. Property wrappers are compiler-synthesised storage plus those two surfaces.

Once you can say that, `@Binding`, `@Bindable`, and `$vm.query` stop being magic. You can also explain why `$` is not available on a plain `var`.

If they push custom wrappers: you choose `projectedValue`’s type. It does not have to be `Binding`.

### A6. Swift 6 default MainActor isolation — what actually changes in an app module?

UI modules often default to main-actor isolation. Code that was “just a class” now needs explicit `nonisolated` / async hops for CPU work. You must mark concurrent work instead of assuming background. The migration is a lot of “this networking helper was accidentally on main.”

Implication: you cannot treat Swift 6 as a compiler switch without a hop audit. Decode, image downsample, and crypto that used to “just run” may now be on main because the type is in a UI target. A77 is this at the stack level.

If they push language mode versus SDK: A51. You can compile in Swift 6 against a Swift 5 ABI.

### A7. Sendable checking versus `@preconcurrency import` — which one is the real story?

Sendable checking is the real data-race story. `@preconcurrency import` silences crossing into an old module — a migration crutch. Do not spray it; wrap the vendor type in your own Sendable facade, one adapter module, and track the vendor until you can delete the attribute (A73).

A codebase that compiles because every file is `@preconcurrency import Foo` has not adopted Swift 6. It has muted it. I would rather isolate the SDK than lie globally.

If they push a vendor that passes `UIImage` around: your facade sends a `Sendable` snapshot (`Data`, a file URL), not the `UIImage`.

### A8. Would you add a `@globalActor` for our database, besides MainActor?

`@globalActor` gives a serial domain. Rare. Justify with a single resource that everything must hop to. Do not create a global actor per feature — that is a spaghetti of hops and no clearer than actors you `await`. MainActor exists because the UI framework is actually global.

A database actor *instance* is usually enough. A global actor is when the isolation domain must be a type-level fact (every function hops there by annotation). Most apps never need a second one.

If they push logging: a global actor for logs is a cute blog post. `os.Logger` is already thread-safe enough.

### A9. Custom actor executors — when would you actually write one?

Actors run on executors (threads, pools). Custom executors pin work: audio I/O, a specific serial queue you must match for a C library. Default is enough for app code. This is a “I have measured contention” topic, not a architecture diagram topic.

If you have not used `SerialExecutor`, saying “I would not yet” is a senior answer. Inventing one for a JSON client is theatre.

If they push `MainActor.assumeIsolated`: that is a hop assertion, not a custom executor. Different sharp tool.

### A10. Why never hold a lock across `await`? Be more precise than “deadlock.”

While you `await`, the task suspends but if the lock is still held, another task that needs the same lock cannot run — including, in bad designs, the task that would unlock, or a lower-priority task that holds something you need. Locks also do not compose with priority inheritance the way you hope across Swift concurrency. Use an actor and accept reentrancy, or copy the data out, drop the lock, then await.

The precise picture is: locks are for non-suspending critical sections. `await` is a suspending point. Those two models do not nest.

If they push `os_unfair_lock` in an actor: you are stacking two serialisers. Usually a smell.

### A11. When do you reach for `TaskLocal` instead of another parameter?

Trace ids, request ids, test clocks — context that should flow with the task without threading eight parameters through every helper. Do not use them as hidden global mutable state. A task-local “current user” that writes from random tasks is a race with extra sugar.

I inject clocks in tests through a task-local *or* a protocol on the client. Task locals shine when the call stack is not yours (middleware). They are invisible, so document them.

If they push `Task.detached`: detached does not inherit task-locals. That is a foot-gun for tracing.

### A12. `AsyncStream` — how do you not OOM the consumer?

Choose buffering (unbounded versus buffering newest). Handle `onTermination` to cancel the producer. Yielding from a callback without a limit will OOM — a location callback at 1 Hz is fine; a sensor at kHz into an unbounded buffer is not.

Backpressure in async streams is coarser than Combine’s demand. You pick a buffer policy and you cancel. If you need real demand, you may still want Combine or a custom sequence.

If they push `AsyncBytes`: same family. Do not copy every chunk into an unbounded array “to be safe.”

### A13. Bridging Combine to async — what actually bites in production?

Demand (push versus pull), cancellation not forwarded, thread hops (`receive(on:)`), and `publisher.values` bridging that can deadlock if you mix run loops. Prefer one world per pipeline. A `sink` that `Task { await }` without tying cancellation is how you double-fetch.

I pick a boundary: UI is async/await or Observation; this one vendor SDK is Combine; I convert once. I do not sprinkle `.values` inside `map`.

If they push `AsyncPublisher`: know it exists, know cancellation and buffering, do not treat it as free.

### A14. Copy-on-write when you `mutating` through `any P` — why did the array copy?

Mutating an existential `any P` often copies because uniqueness is lost — the value is in a box, extra references, the buffer does not look unique. Generics keep the concrete buffer. This shows up as mysterious array copies in hot loops: you abstracted the collection behind `any`, then appended.

If the protocol has a `mutating` requirement, prefer `inout T` generic over `inout any P` in a tight path. This is I18 plus existentials.

If they push `some P` as a parameter: still one type, better than `any` for this, not always available for mixed values.

### A15. `isKnownUniquelyReferenced` returned false and we copied — who was the extra ref?

An extra strong ref — including a closure that captured the array, a second local, a slice that shares storage depending on the type, a debug `print` that held on in an unfortunate way. “We used COW so copies are free” is false if you share.

False sharing is the performance version of “I thought structs were cheap.” In a loop, capturing `self.items` in an escaping closure pins the buffer. Copy happens on mutate, not on pass.

If they push `Array` versus `ContiguousArray`: same COW idea; uniqueness is still the check.

### A16. A teammate added `@unchecked Sendable` to make Swift 6 pass. What do you do in review?

You are asserting thread safety to the compiler. Document the lock. Prefer actors. Unchecked on a random class is how Swift 6 “passes” and production races. I would bounce the PR unless the type is a proven thread-safe wrapper (a class that only holds a lock-protected immutable snapshot, with a comment).

Ethics is not a joke word here. `@unchecked` is a signed waiver. Staff-level is reducing the number of waivers in the repo over time.

If they push a vendor class: facade (A7), do not unchecked the vendor type in every file.

### A17. Two state writes, two animations fighting — what is a transaction doing?

State writes in one transaction animate together. `withTransaction` / `withAnimation` control that. Splitting related writes across tasks — `await` in the middle, two `withAnimation` blocks — makes animations fight. Coalescing is why a toggle and a list update can be one motion if they are one transaction.

The debugging move is: log transactions, merge the writes, or explicitly disable animation on the write that should be instant (`var t = Transaction(); t.disablesAnimations = true`).

If they push implicit animations: a state change from a gesture may already be in a transaction. Nesting `withAnimation` is not always a new one in the way people think.

### A18. Equatable optimisation and identity both look wrong — how do you debug “random state”?

Instruments SwiftUI, log `id`, strip modifiers until it behaves, check accidental `.id(UUID())`. Do not guess — identity bugs look like random state, Equatable bugs look like stale state, and they coexist. Binary search the view tree like you would a layout bug.

I also check `ForEach` ids and `if`/`else` branches before I believe a compiler bug. It is almost never a compiler bug.

If they push a reproduction: a tiny preview with two ids and a stepper. If you cannot reproduce in a slice, you do not understand it yet.

### A19. Why do video feeds still land on `UICollectionView` when the rest of the app is SwiftUI?

Cell reuse of `AVPlayerLayer`, precise prefetch, mature scrolling physics, and a decade of edge cases (audio session, Picture in Picture, cell eviction pausing the player). SwiftUI `List` is catching up; video feeds are still a hybrid island for many teams. That is allowed (A78).

The senior answer is not “SwiftUI cannot scroll.” It is “player lifetime versus cell lifetime is a solved UIKit problem, and we would be paying to re-solve it.” Wrap the island in `UIViewRepresentable` if the chrome is SwiftUI.

If they push `LazyVStack` plus `VideoPlayer`: demo quality. Production feeds usually need the island.

### A20. We modularised and CI got slower — cycles in the build graph?

Features depend on core kits, not on each other. Cycles destroy incremental builds and force god modules. Draw the graph; break cycles with interfaces. A `Shared` module that imports `Home` which imports `Shared` is how you compile the world twice.

I would rather one extra protocol in `CheckoutAPI` than `Checkout` importing `Profile` for a user avatar. Duplicate a tiny DTO before you cycle.

If they push SPM vs Xcode targets: the graph theory is the same. SPM makes cycles louder.

### A21. Will splitting this Swift package shrink the binary? Dynamic linking?

Swift generics specialise and can duplicate code. Dynamic frameworks are not automatically smaller — they can be larger because of the Mach-O overhead and less dead-strip across the boundary. Measure; do not “modularise for size” without numbers.

Size wins usually come from assets, bitcode-era myths, and moving unused localisations, not from a sixth dynamic framework. `@inlinable` (A53) can even *grow* client binaries.

If they push app thinning: slices and on-demand resources matter more than one extra `.framework` for `String` helpers.

### A22. What belongs in `didFinishLaunching` before the first frame?

Almost nothing. Defer analytics SDKs, font registration you do not need for frame one, and “nice to have” I/O. Measure time to interactive. First frame is a product metric, not a dump for `didFinishLaunching`. A cold start that configures ten SDKs is a hang the reviewer will feel.

I would allow: process-level wiring that must exist for the first view to construct (session flag, crash reporter *if* it is cheap), then everything else after first frame or on first use.

If they push `+load` / static initialisers: worse. You do not even see them in the method.

### A23. Memory went up and the app died — leak or jetsam? How can you tell?

Jetsam: high water mark, system kills you — images, caches, a decode spike. Leak: unbounded growth over time from cycles. Different Instruments, different fixes. Jetsam looks like a jetsam report and a spike; a leak looks like Allocations persistent growth across generations.

Treating jetsam as a retain cycle sends you into the memory graph while the thumbnail decoder is the murderer. Treating a cycle as “iOS killed us, whatever” lets the VC live forever.

If they push dirty memory versus persistent: persistent is the leak story. Dirty high-water is the image story.

### A24. Tight loop parsing ObjC objects — why would you wrap `autoreleasepool`?

Tight loops creating ObjC objects (`NSString`, `UIImage`) can pile autoreleases until the next drain. Wrap the loop in `autoreleasepool { }` when bridging. Swift objects do not make this go away if you touch UIKit/Foundation in the loop.

This is how a background import looks fine in a unit test of 10 rows and jetsams at 50k. The pool is a drain valve, not a new allocator.

If they push ARC making autorelease dead: ARC still uses autorelease at boundaries. The pool still matters.

### A25. `NSManagedObjectContext` confinement — say it like you have been paged for it.

Always `perform` / `performAndWait`. Never pass objects across queues. Pass `NSManagedObjectID`. This is still the number one Core Data crash: `__NSCFSet` / “object’s context is nil” / random EXC_BAD_ACCESS in a fault. The stack will look unrelated.

A “I only read properties, it should be fine” is how the crash is intermittent. Confined means confined.

If they push Swift concurrency: a context is not Sendable. An actor that owns the context and only talks ids/values outward is the modern shape.

### A26. SwiftData — how do you import 50k rows without freezing the UI?

Heavy imports on a background context / container, then merge. Blocking the main `ModelContext` freezes UI. Mirror Core Data’s two-context pattern. Batch, autosave carefully, and do not fetch the whole store into `@Query` while importing.

SwiftData’s happy path is main-thread and small. The senior question is the unhappy path. If the API is still awkward, staying on Core Data for this store is I36.

If they push `@Query` during import: the UI will thrash. Import behind a flag, then invalidate.

### A27. SQLite WAL — does that mean we cannot corrupt on crash?

WAL lets readers proceed during writes. You still need transactions for crash consistency. “WAL means we cannot corrupt” is false. A torn write without a transaction, a process kill mid-migration, a full disk — still your problem.

WAL is concurrency and checkpointing, not a product guarantee. Know `PRAGMA`, checkpoint pauses, and that iOS may still kill you during a checkpoint.

If they push Core Data + WAL: Core Data uses SQLite; you inherit this, plus Core Data’s own transaction story.

### A28. Certificate pinning — how do you rotate without bricking the app?

Ship two pins, overlap during rotation, monitor failure rates, have a remote kill / unpin plan. Pinning without rotation is a self-DoS when the cert expires. I would not pin unless the threat model needs it; ATS plus pinning of a backup pin is the adult version.

A pin in the binary with no server flag is a holiday incident. Store review will not save you.

If they push SPKI vs leaf: pin the public key (SPKI) of a stable intermediate if you can, not a leaf that rotates every 90 days, unless you are staffed for 90-day app releases.

### A29. App Attest / device attestation — what is it, honestly?

A device integrity *signal* to your backend, not a secret baked into the IPA. Attackers still exist; treat it as one input to risk, not a DRM fantasy. The server decides whether a request looks like a real app on a real device; the client cannot be trusted to tell the truth.

I would use it to raise friction on sensitive actions, not to hide a movie file. Jailbreaks and cloned apps are a rate, not a zero.

If they push “so we can put the API key in the app”: no. Attestation does not make a baked-in key safe.

### A30. Keychain item is `WhenUnlocked`, background fetch cannot read the token — what now?

`WhenUnlocked` is unavailable until the user unlocks. Background fetch may run before that — use `AfterFirstUnlock` if you must read tokens in background, and know the trade-off: after first unlock the item is available even if the device is locked, which is weaker than `WhenUnlocked`.

Match accessibility to *when* the work runs. A mismatch looks like “Keychain failed in production mornings” and works at your desk because the phone is unlocked.

If they push `ThisDeviceOnly`: that is migration-versus-backup, a different axis. Do not confuse it with lock state.

### A31. Privacy manifests and tracking — why is this in an engineering interview?

Declare required-reason APIs. If you track across apps/websites, ATT. Manifest mistakes fail App Store review. This is product plus legal, not only code. An SDK you imported can require reasons you did not know you needed.

Staff-level is owning the inventory: which SDKs, which APIs, which nutrition labels. A junior added a “helpful” analytics SDK; a senior files the manifest; staff asks whether we should have the SDK.

If they push “we do not track”: the manifest still exists for disk and user defaults APIs. Tracking is one slice.

### A32. Fifty endpoints — how do you design the client so we do not paste `URLSession` fifty times?

Typed request/response, shared middleware (auth, idempotency, logging), endpoint enum or generated client. Do not copy-paste fifty `URLSession` calls. One place for 401 refresh (I32), one place for JSON decoding strategy, one place for request ids.

Codegen from OpenAPI is fine if the spec is real. A handwritten enum of fifty cases is fine if the spec is a wiki. The architecture is the middleware, not the swagger romance.

If they push a generic `func fetch<T: Decodable>(url:)`: that is the start, and it is not enough for file upload, SSE, or per-endpoint timeouts.

### A33. Payments retry — walk the idempotency key like money depends on it.

Client generates a UUID, stores it until success, sends it on every retry. Server de-dupes. Without this, a timeout plus retry double-charges. Persist the key with the offline queue (I58). Do not generate a new UUID on each attempt; that is the bug dressed as uniqueness.

Timeout is not failure. Unknown is the state. The key makes unknown safe to retry. If the server does not support keys, you cannot safely retry POST, and you should say that to product.

If they push GET: GET should be idempotent without a key. Do not invent keys for reads.

### A34. Two devices edited the same note — conflict resolution. Pick, do not invent a universal merge.

Last-write-wins, server-wins, CRDT, or ask the user. Pick with the product: notes versus bank balance. There is no universal merge. LWW on a ledger is how you lose money. Asking the user on every keystroke is how you lose users.

Say what you would ship for *this* domain. A notes app can LWW with a “conflict copy” like Dropbox. A wallet cannot.

If they push CRDTs: know they exist, know they are not free, know most iOS apps do not need one on day one.

### A35. Observability on iOS — you cannot SSH in. So what do you actually ship?

`os.Logger`, signposts, crash reporters, sampled performance, *no PII*. You cannot SSH into a phone; logs and metrics are how you debug production. MetricKit for hangs, a request id on the API, breadcrumbs that survive a crash.

If the only observability is “users will write a review,” you are flying blind. Sampling matters because full network logs will DDoS your own backend and your privacy policy.

If they push third-party versus `os.Logger`: both. Logger for unified logging; a reporter for the crash you will not reproduce.

### A36. Feature flags and kill switches — what makes a kill switch real?

Remote config with a cached last-known-good. Default *off* for risky features. A kill switch that requires a new binary is not a kill switch. The cache is so you do not brick launch when the flag service is down — fail toward last known, or toward off, on purpose.

Flags in the bowels of payment signing are how you get undefined money. Flags at the composition root (“this tab is new checkout”) are how you sleep.

If they push percentage rollout: server-side, sticky per user id, not `arc4random` on every launch.

### A37. Gradual rollout versus App Store review — what can a flag not hide?

Phased App Store release is slow. Server flags beat “ship a bool in the binary.” Review still sees the code paths — do not hide policy violations behind flags. If the binary can do it, review can ask about it.

Staff-level is: flags for risk, review for policy, phased release for store-level soak. They are not interchangeable sliders.

If they push TestFlight: that is another channel, not a flag. Still a binary.

### A38. How do you test actors deterministically? `sleep(1)` showed up in a PR.

Inject a clock. Do not `sleep`. `await` the API under test. Avoid extra unstructured tasks. Timeouts in tests are a smell: you are waiting for a race instead of awaiting a condition. `ImmediateClock` / a fake `Clock` makes expiry tests instant.

An actor test that starts three `Task`s and sleeps is a flake farm. Expose a function you can `await`, or a stream you can consume.

If they push `MainActor.assumeIsolated` in tests: sometimes. Prefer running the test on the actor.

### A39. Snapshots versus pixel UI tests versus an accessibility audit — they are not the same test.

Snapshots catch layout regressions. UI tests catch flows. Accessibility audits catch VoiceOver. They answer different questions; use a mix. Replacing unit tests with screenshots is how CI becomes a screenshot farm that nobody trusts (I66).

I would staff: unit for logic, a few snapshots for tricky layout, a few UI tests for money paths, and a VoiceOver pass on those paths — automated where we can, human where we cannot.

If they push one tool to rule them all: there isn’t one. That *is* the answer.

### A40. DI in a modular app — where is `shared` allowed?

Each app target has a composition root. Modules export factories and protocols, not singletons. Tests swap factories. Avoid `shared` in feature modules. The app target is allowed to be “impure”; the feature module should be constructible in a test with fakes.

A `Checkout.shared` that lives in the module is how every sample view in the module hits production. A `CheckoutFactory` in the app target is how you stay honest.

If they push SwiftUI `Environment`: ambient at the rim, required clients in `init` when missing them should not compile (A63).

### A41. TCA versus Observation MVVM for a team of eight. You are choosing, not listing blogs.

Default MVVM plus Observation unless you live in state machines and the team already knows TCA. Leadership is matching the tool to fluency and problem shape. Eight people, two who have read a Point-Free video, is not a TCA team yet. Eight people with three years of TCA and a replay debugger is.

I would not introduce TCA to ship a settings toggle (I48). I would not rip TCA out of a working store checkout the week before Black Friday.

If they push “which is more senior?”: the one that the team can change in six months. That is A70.

### A42. When does VIPER hurt SwiftUI specifically?

VIPER’s per-screen type explosion fights SwiftUI’s data-driven navigation. You pay ceremony without getting the UIKit-era test seams you actually use. Five types per screen, a router that pushes, a presenter that formats dates — and then `NavigationStack` wants a `Hashable` path anyway.

If the team is UIKit VIPER and adding one SwiftUI screen, wrap it; do not VIPER-ify `body`. If the app is SwiftUI-first, path-plus-VM is enough.

If they push Clean + SwiftUI: inward dependencies, yes; VIPER file templates, no.

### A43. Router as enum versus string URLs internally?

`enum Route: Hashable, Codable` internally. Parse URLs at the boundary into `Route`. Strings internally are typo magnets: `"chekout"` in one tab, `"checkout"` in another, a crash on a push. Deep links become a parser with tests; the app talks in routes.

Associated values on the enum (B32) are how you pass an `orderID` without a second stringly dictionary.

If they push `NavigationPath` untyped: restoration and typos. Typed `[Route]` wins for apps that care (I29).

### A44. Two windows on iPad — what state is per-scene versus process-global?

Per-scene UI state: two documents, two stacks, two selected tabs. Process-global: session, account, the URLSession, the token. Mixing them makes iPad windows share a navigation stack by accident, or worse, share an unsaved draft.

`SceneStorage` versus `UserDefaults` / a session actor. If you put the path in a singleton, you have one stack for two windows. That is the bug.

If they push macOS: same scene model, more windows, more obvious when you get it wrong.

### A45. Document-based versus files in the sandbox — why did iCloud open fail?

`DocumentGroup` plus security-scoped bookmarks for user files. App sandbox `Documents/` is not the same as a user-picked iCloud file. If you only have a path string, you lose access after relaunch; you needed the bookmark. `startAccessingSecurityScopedResource()` is the dance people skip.

“It works in the simulator Documents folder” is not a document app. User-picked files are a permission and a bookmark.

If they push UIDocument: still the right primitive for a lot of this. SwiftUI `DocumentGroup` sits on that world.

### A46. The screen is pretty and the GPU is on fire — what is Commit cost doing?

Offscreen passes, shadows, blurs, overlapping transparency. Profile GPU. “Just add blur” is a battery bug. Core Animation commits a render tree; offscreen renders multiply. Metal is waiting on you more than you think.

I would Instruments Core Animation, look at offscreen, and start removing blur and shadow from scrolling cells. Pretty static chrome can afford it; a 60 fps feed cannot.

If they push SwiftUI `shadow`: same cost family. Material and blur in a `List` row is a classic.

### A47. Reduce Motion and Dynamic Type — first-class layout or a QA afterthought?

Do not clip XXL type. Offer non-motion alternatives when `accessibilityReduceMotion` is on. Test the largest content size or you will ship broken screens. This is not polish; it is a slice of users who cannot use the app, and it is a review topic.

I would put largest text and reduce motion on the PR template for UI. Custom `Layout` that assumes a 44 pt row will fail here (A49, A65).

If they push `minimumScaleFactor`: it hides the bug until the string is unreadable. Prefer wrapping and reflow.

### A48. Localisation — why is `"\(n) days"` a bug even in English?

Use String Catalog / stringsdict for plurals. Never concatenate `"\(n) days"`. Word order changes by language; plural rules are not “1 versus else” in Polish, Arabic, Russian. A catalog with a plural variation is the unit of work.

Interpolated sentences also break names and RTL. Format with localized templates, not Swift string plus math.

If they push String Catalog versus `Localizable.strings`: catalogs are the modern tool; stringsdict is the plural engine underneath.

### A49. Custom `Layout` looks fine in English and breaks in Arabic. Why?

Honour `layoutDirection`. Use leading/trailing, not left/right. Custom `Layout` that hardcodes `minX` will break Arabic. RTL is not “flip the screenshot.” It is a direction proposal in the layout protocol.

I would test with a right-to-left pseudolanguage as a habit. If the layout uses `x: 0` as “start,” it is LTR-only.

If they push images: flips for chevrons, not for photos of people. `flipsForRightToLeftLayoutDirection`.

### A50. Migrate `ObservableObject` to `@Observable` in a large app — weekend rewrite?

New screens first. Bridge (`ObservableObject` wrapping Observable or vice versa). No big-bang weekend rewrite. Shared objects at the root migrate last, because everything observes them. A weekend rewrite is how you ship a silent invalidation bug on Monday.

I would set a rule: new code is Observation; touched screens migrate; `ObservableObject` is allowed until the file is ours. Dual-running is how you still ship features.

If they push Combine pipelines on the old objects: keep them until that screen migrates; do not half-convert a pipeline.

### A51. ABI stability versus Swift 6 language mode — we “moved to Swift 6,” what did we move?

Swift 6 is a *language mode* (concurrency checking). The library ABI can still be Swift 5. You can mix. Do not confuse “we compile in Swift 6” with “the OS Swift runtime changed.” Users did not download a new Swift because you flipped the build setting.

This matters when a package is Swift 5 and your app is Swift 6: `@preconcurrency`, availability, and “why does this type not Sendable.” It is not an ABI break by itself.

If they push Swift 5.0 ABI stability: that was the OS promise. Language mode is local to your compile.

### A52. Public enum in a module — `@frozen` or not, and why `@unknown default`?

Frozen enums can be switched without `@unknown default` for library evolution. Unfrozen public enums need `@unknown default` so new cases do not explode clients. If *you* own both sides and ship the app as one binary, freeze less often; if you ship a framework to other teams, think like Apple.

`@unknown default` is for cases that did not exist at compile time. `default` is for “the rest of the cases I know.” People mix them.

If they push adding a case to a public unfrozen enum: it is a source break without `@unknown`. That is the point.

### A53. `@inlinable` across modules — speed versus evolution.

`@inlinable` lets clients specialise your generics (speed) but freezes implementation in their binary (evolution pain). Use on tiny hot functions only. Changing an inlinable function is not a drop-in for clients until they recompile, and the old implementation may still be inlined in the wild depending on how you shipped.

This is a library-author question. App-only code almost never needs it. If someone inlined a 200-line JSON mapper, bounce the PR.

If they push `@usableFromInline`: the helper you need from inlinable code, still not public. Pair them, still keep the surface small.

### A54. Existential `any P` opening in Swift 5.7+ — what got better, what still hurts?

You can use `any` more widely, but associated types still fight existentials. Opening existentials (`func f(p: any P) { g(p) }` with generic `g`) is the workaround: the compiler opens `p` as a concrete `T: P` for the generic call. You still cannot put mixed PAT existentials in an array and magically recover `Element`.

Senior is: `any` is spellable; generics still preserve associated types; opening is the bridge. Do not promise `any Collection` will give you `Element` cleanly.

If they push `some P` in parameter position: implicit generic. Nice at function edges; not a mixed array.

### A55. `consuming` / `borrowing` / noncopyable types — what do you actually need to say?

Ownership for unique resources — file handles, buffers — that must not be copied. You should know they exist in modern Swift even if you do not use `~Copyable` daily. They are how you model “this buffer has one owner” without a class and ARC.

I would not introduce noncopyable types into a view model to look current. I would use them in a low-level buffer or a file wrapper if the team is on a Swift that makes them ergonomic.

If they push `consume` versus copy: moving a unique value, after which the old name is dead. That is the point of noncopyable.

### A56. Ten views request the same GET — how do you prevent duplicate in-flight work?

Actor keyed by URL: if a `Task` exists, await it; else start one and store it. All callers share one network hop. Clear the task on completion so the next GET can be fresh, or cache the result with a TTL if that is the product.

This is I32’s cousin without the 401. Image loaders and config files need it. Unbounded in-flight maps are a leak; eviction matters.

If they push Combine `share()`: same idea in publisher form. Cancellation of the last subscriber should cancel the network.

### A57. Chat versus badges versus a dashboard — HTTP/2, polling, websocket, APNs. Pick with cost.

Latency, battery, server cost, NAT timeouts, reliability. Chat might be websocket (or a push-driven fetch); badges are APNs; dashboards can poll. There is no single “realtime” API. HTTP/2 multiplexing helps many GETs; it is not a push channel.

I would start a dashboard on fetch-when-visible plus a generous poll, add APNs for “go look,” and only websocket if we have a presence problem and a server team. Battery is the mobile tax people from backend forget.

If they push Server-Sent Events: fine for one-way. Still a connection to keep alive.

### A58. Is push the source of truth for this inbox?

No. Push is a *hint* to refresh. Local DB / server GET is truth. Missed notifications are normal — user denied permission, APNs delayed, device off. If the badge is the database, the badge will lie.

Design: push arrives, enqueue a fetch, merge by id. Silent pushes are a privilege, not a guarantee. The inbox screen’s `.task` still loads from the store.

If they push “can we skip the GET to save battery?”: not if correctness matters. You can debounce the GET.

### A59. Why inject a `Clock`? `Date.now` is one character.

`Date.now` is a hidden dependency. Tests freeze time; expiry and animations become deterministic. Inject `any Clock` or a protocol. A token that expires “in an hour” is untestable if an hour has to pass, and flaky if you `sleep`.

This is A38’s close friend. Production code that calls `Date()` in twelve places cannot stub twelve places. One clock at the boundary.

If they push `ContinuousClock` versus `SuspendingClock`: sleeps that should pause when the device sleeps versus not. Expiry of a token usually wants wall-ish time; animation might want continuous. Say you would pick on purpose.

### A60. File protection classes — background read failed, file is there.

`CompleteUntilFirstUserAuthentication` versus `CompleteUnlessOpen` and friends. Background access fails if the class requires an unlocked device. Match class to when you read the file. This is Keychain accessibility (A30) for files.

A download you need in background fetch cannot be `Complete` until unlock. A medical PDF might need to be. Product plus threat model, then a class, then a test with the device locked if you can.

If they push Data Protection entitlement: the default for the container and the per-file override. Know both exist.

### A61. Sensitive screen — screenshot in the app switcher, screen recording. What can we actually do?

On resign active, cover with an overlay. `isSecureTextEntry` can hide some capture. DRM is limited on iOS — banking UX, not Hollywood DRM. You will not reliably block every recording; you will hide the switcher snapshot and blur when backgrounding.

If they want true DRM, that is a different platform conversation and a lot of FairPlay. For a banking balance, overlay plus secure fields plus no JWT in UserDefaults is the honest bundle.

If they push `UITextField.isSecureTextEntry` on a SwiftUI `Text`: you may need a representable. Know the limitation.

### A62. Crash only in production — how do you investigate when you cannot reproduce in Debug?

dSYMs, MetricKit, threading, specific data, compiler optimisation, sanitizers off. Reproduce with a Release config. Bitcode is historical; symbols still matter. Optimiser-only crashes (especially concurrency and lifetime) show up here. A particular JSON shape, a particular locale, a 3× image.

I would symbolicate first — without symbols you are reading addresses (A66). Then match build number. Then try Release locally with the same OS. Then look at threads in the crash report, not the last line of your log.

If they push “it is Firebase”: maybe. Still symbolicate. Third-party crash lines are often the messenger.

### A63. Environment versus initializer injection — which one for a required client?

Required dependencies: `init`. Ambient (theme, locale): environment. Missing environment objects crash at runtime; missing init args fail at compile time. I will not hide `CheckoutClient` in the environment so a preview can forget it and Xcode can crash.

Ambient can still be a router or a logger with a default no-op. Money and auth do not get no-ops by accident.

If they push `@Environment(CheckoutClient.self)` with Observation: nicer than `@EnvironmentObject`, still a runtime miss if you forget. `init` is honest.

### A64. `ViewThatFits` versus size classes — Split View made our compact layout look wrong.

`ViewThatFits` picks the first child that fits. Still test compact/regular. Size classes describe device idiom; fitting describes actual space (Split View, stage manager, a wide iPhone in landscape). We laid out for `horizontalSizeClass == .compact` and still had 600 pt, or the reverse.

Use size classes for idiom-shaped chrome (tab versus sidebar). Use fitting for “this chart is too tight, show a summary.” They compose; they are not aliases.

If they push `GeometryReader` for the same job: A41. Prefer `ViewThatFits` or `containerRelativeFrame` when they solve it.

### A65. Custom `Layout` with 200 children is hitching. What do you look at?

Cache sizes. Avoid O(n²) in `placeSubviews`. Do not allocate in the tight loop. Profile with many children. A layout that calls `sizeThatFits` on every child for every child is the classic quadratic. SwiftUI will ask you often; you must be cheaper than a `VStack` or you have not earned the custom type.

I would log call counts in debug, then cache. Correctness first — RTL, Dynamic Type — then the cache, because a wrong cache is a layout bug that looks like a SwiftUI bug.

If they push `LayoutThatFits`: same cost model. Fancy math does not get a pass on n².

### A66. Time Profiler is addresses, or the inversion looks like noise. Now what?

Need dSYMs, matching build, understand sample versus time profiler. Missing symbols means you are staring at addresses. Always archive with symbols. Inversion is a way of attributing time to callers; if the heavy frame is `swift_retain`, look at *who* retains in a loop (`any View`, COW copies), not at the runtime for moral failing.

I would match the exact build first. Profiling a Debug build and shipping Release is how you optimise the wrong thing.

If they push System Trace versus Time Profiler: System Trace for scheduling and hiccups; Time Profiler for CPU. Different questions.

### A67. Energy — GPS versus networking versus CPU. People guess wrong.

GPS is expensive. Networking in a loop is expensive. CPU spikes are often cheaper than high-accuracy location. Attribute with Energy instruments, do not guess. A “we optimised `body`” while `kCLLocationAccuracyBestForNavigation` runs in the background is comedy.

I would ask what the product actually needs: significant location, visits, a one-shot, or a feed. Then networking coalescing. Then CPU. In that order unless the profiler disagrees.

If they push background location: a review and a battery review. Product must want it in writing.

### A68. Error budgets on mobile — we do not have SRE. What would you even set?

Crash-free sessions, hang rate, login success, checkout success, network fail percent. Staff work is picking SLOs and reacting when you burn the budget. A mobile error budget is how you decide “no more features this week, we fix hangs” without a feeling.

I would start with crash-free and checkout, because they map to money and reviews. I would not start with 40 dashboards. When the budget burns, flags (A36) and rollback beat heroics.

If they push “99.9% crash-free”: know what a session is, know the denominator, know a watchdog hang may not be a crash.

### A69. Mentoring: how do you actually teach `@State` so it sticks?

Identity plus storage outside the struct. Live demo: add `.id(UUID())` and watch the stepper reset. Juniors remember the demo. A slide that says “source of truth” does not stick. Pair on I2 and I7 the same afternoon.

I would also have them log `body` and `init` once, so the clocks in A3 become felt, not recited. Then `private` and `Binding` (B8–B10, B50).

If they push a book chapter: this handbook’s SwiftUI part. The demo still wins.

### A70. Saying no to a pattern the last company loved.

Cost, team skill, problem fit, migration path, and what we give up. “Netflix uses it” is not an argument. I would say no to TCA for two toggles, no to VIPER for a SwiftUI form, no to a rewrite (A78) when the UIKit surface is the product. Saying no is staff work; listing patterns is senior trivia.

Offer the alternative and the exit: “MVVM now, extract a state machine if this checkout grows a 3DS graph.” A no without a path is just blockage.

If they push the room going quiet: that is the job. You are paid for the next six months, not the whiteboard.

### A71. UIKit Observation on iOS 26 — why mention it in a SwiftUI shop?

UIKit update methods can track `@Observable` similarly to SwiftUI. Know it exists if you still have UIKit screens. Hybrid apps can share an `@Observable` model between a `UIViewController` and a SwiftUI child without `ObservableObject` glue. That is the migration gift.

If you do not know it, you invent `Combine` bridges you do not need on a new OS. If you do know it, you still verify the OS version you support.

If they push back-deploy: this is why “iOS 26 baseline” is a product decision, not a tweet.

### A72. `Observations` transactional coalescing — I wrote twice, I got one callback?

Multiple synchronous writes can coalesce into one observed value until the next suspend. Do not assume one write equals one callback. That is a feature for UI (less churn) and a trap for “I increment a log counter per write.”

If you needed per-write effects, you wanted those effects at the write site, not an observer that you treated as a message bus. Observation is invalidation, not EventKit.

If they push `objectWillChange`: the old world fired more often. Do not recreate that on purpose.

### A73. Preconcurrency imports of a vendor SDK — what is the plan, not the attribute?

Isolate behind your facade. One `@preconcurrency import` in an adapter module, not in every file. Track vendor updates to remove it. The plan is a ticket with a version pin, not a hope. A7 is the principle; this is the operational version.

If the vendor will never Sendable, the facade stays forever, and that is fine if it is *one* module. Forever-in-every-file is how you cannot delete it.

If they push forking the SDK: last resort. Wrapper first.

### A74. Plugin architecture in Swift — how do you not let plugins import the app’s guts?

Protocols at the rim, stable route IDs, no shared mutable globals, existentials only at the boundary. Plugins must not import app internals. The app loads plugins; plugins see `PluginHost` and `Route`. If a plugin can `import CheckoutInternal`, you do not have plugins, you have a folder.

Binary plugins have ABI and `@frozen` (A52) in the story. Source plugins in the same repo can be modules with a tiny public surface. Same instinct.

If they push `any Plugin` arrays: that is the rare justified `any` (A2, I20). Specialise inside the plugin, erase at the host.

### A75. What separates senior from staff on iOS, in this interview?

Senior ships hard features well. Staff changes the *system*: build, quality bar, architecture, other people’s throughput — not just another screen. The staff answer to a feature is often a flag, a template, a test policy, or a no (A70), not a clever `Layout`.

If you only talk about your screens, you are senior. If you talk about how eight people will still be fast in a year — modules (A20), error budgets (A68), mentoring (A69) — you are in staff territory. Both are valuable; they are not the same job.

If they push IC versus manager: staff is still IC. You write code. You also write the conditions of everyone else’s code.

### A76. How would you deprecate an internal module without theatre?

New API, dual-run, metrics on remaining callers, then remove. Deprecation without a migration path is theatre: `@available(*, deprecated)` and a Slack message, six months later the module is still the import graph. I would add the new factory, count the old symbol, make CI fail on new uses, then delete.

Internal means you can be louder than a public SDK. Break in a controlled sprint if the callers are three and you have the people. Do not pretend it is open source.

If they push a hard cutoff: yes, with a date and an owner. A cutoff without an owner is a comment.

### A77. What is the risk of `@MainActor` on the whole networking stack?

JSON decode, image decode, and crypto on main. Isolate UI; keep the client on a dedicated actor or `nonisolated` async. MainActor is not a networking strategy. A6 plus I15 plus I77 is this failure mode: Swift 6 “helpfully” isolated the client because it lived in the app target.

I would split a `Net` module without UI isolation defaults, or mark the client nonisolated and hop to MainActor only when publishing. Measure decode. A 2 KB JSON is noise; a feed payload is a hitch.

If they push “but then I have to `await` the client from the VM”: yes. That is the correct `await`.

### A78. When is “rewrite it in SwiftUI” the wrong answer?

A stable, performance-critical UIKit surface — camera, collection video, a custom text editor you bled on for years. Rewrite risk, lost battle-tested bugs, and no user-facing win. Hybrid is allowed. A rewrite that misses the release is a product failure with a modern `body`.

I would wrap, interop, and move the chrome. I would rewrite when the UIKit is the bug (a layout we cannot staff) or when the screen is simple and the team is SwiftUI-native. A19 is the video-feed instance of this no.

If they push “Apple wants SwiftUI”: Apple also ships UIKit. Users want a camera that works.

---
