# PART III — SwiftUI

SwiftUI is a declarative UI framework: you describe **what** the UI should look like for a given state. The framework owns **when** to evaluate `body`, **how** to diff, and **how** to render.

It is not UIKit with a new syntax. If you write SwiftUI as if views were long-lived objects, you will lose state, over-render, and fail interviews. The rest of this part is that sentence, unpacked.

---

# SwiftUI Fundamentals

You put a `Text` on screen. You rotate the phone. You type in a field. SwiftUI throws your struct away and builds another one, over and over. That is not a bug. The durable pieces live somewhere else — identity, state storage, the render graph. Once you believe that, `@State` stops being a magic keyword and becomes a storage deal you made with the framework.

---

## `View`

```swift
struct Greeting: View {
    let name: String
    var body: some View {
        Text("Hello, \(name)")
    }
}
```

`Greeting` is a struct that conforms to `View`. `name` is input, not view-owned state. `body` is the required computed property, returning some opaque view. `Text` is a primitive. None of this is the pixels. The protocol has an associated `Body` type and a `body` property. Your struct is a **lightweight description**. SwiftUI can create it thousands of times per second. It is not the on-screen object.

Views are structs because descriptions should be cheap to recreate and should not accidentally share mutation. The framework stores durable state (`@State`, and the rest) **beside** the identity of the view, not in the struct fields the way beginners picture an object. `body` is the function the framework calls to produce the current child tree. Treat it as **pure**: same inputs and state, same description. Side effects in `body` — a network call, a log that fires twenty times, a random `UUID()` — are bugs. Duplicate requests and broken animations come from that habit.

`some View` is an opaque type. Callers know it is a `View`. The compiler knows the concrete type (`Text`, `ModifiedContent<Text, _PaddingLayout>`, …). That preserves identity and specialisation. `any View` boxes an existential. Worse performance, worse identity. Use it when you must type-erase (`AnyView`), and even then sparingly. If you do not conform to `View`, you cannot put the type in a SwiftUI hierarchy. That is the whole protocol.

`body` is `@ViewBuilder`. You can write `if`, `switch`, multiple children (wrapped as `TupleView`). Without the builder, `if` would not type-check as `some View`. The result builder chapter in Advanced Swift is this mechanism from the language side.

---

## The three different “lifetimes” (memorise)

```text
View struct creation     → SwiftUI instantiates your struct (often)
body evaluation          → SwiftUI calls body to get a new child tree
Rendering                → CoreAnimation/Metal commits pixels
State lifetime           → storage keyed by view identity, not by struct instance
```

If `body` runs again, is `@State` reset? No — not if identity is stable. State lives in the framework store. The struct is not a class, and that is not how the value persists. People who say “the struct is a class so state persists” fail this question immediately.

See [View Lifecycle and Rendering](#swiftui-view-lifecycle-and-rendering) for identity, diffing, and why `onAppear` is not `viewDidAppear`.

---

# Views

These are the primitives you actually type. For each one, the useful question is not “what is a Text.” It is “what goes wrong when I use this in a list of a thousand rows,” or “why did this button fight a NavigationLink.”

## `Text`

Displays a string, or an `AttributedString`.

```swift
Text("Hello")
    .font(.title)
    .foregroundStyle(.primary)
    .multilineTextAlignment(.leading)
```

It is the most common primitive. Localisation: `Text("key")` takes a `LocalizedStringKey`. `Text(verbatim: string)` is for raw user content you must not look up in Localizable.strings. Thousands of `Text`s in a `VStack` are eager and expensive; use lazy stacks or a `List`. `Text(Date(), style: .timer)` in a huge list will tick, and every tick is work. Think before you put a live timer in every row.

## `Image` / `Image(systemName:)`

```swift
Image("logo")                       // asset catalog
Image(systemName: "star.fill")      // SF Symbols
    .symbolRenderingMode(.hierarchical)
```

SF Symbols scale with Dynamic Type and match Apple’s HIG. Decode large photos off the main thread; use `AsyncImage` or a loader with a cache. `resizable()` is required before `scaledToFit()` in the usual pattern.

```swift
Image("hero")
    .resizable()
    .scaledToFit()
```

Order matters: `resizable` is what enables stretching. Without it, `scaledToFit` has nothing useful to do.

## `Button`

```swift
Button("Save") {
    save()
}

Button(action: save) {
    Label("Save", systemImage: "square.and.arrow.down")
}
```

A button is a control: accessibility, hit testing, styling (`.borderedProminent`). Putting a `Button` inside a `List` row that also has a `NavigationLink` makes two gestures fight. Use `role: .destructive` for deletes so VoiceOver and the system chrome know this is not a normal action.

Do not start an unstructured `Task` in the action with no cancellation policy. `Button` can `Task { }`, but prefer the async button APIs where they exist, and disable the button while the work is in flight so a double tap does not fire twice.

## `Label`

Icon plus title, adaptive. Prefer this over an ad-hoc `HStack { Image; Text }` for navigation chrome. `labelStyle` can collapse to icon-only in a compact toolbar, which is the whole point of using the semantic type.

## Stacks: `VStack`, `HStack`, `ZStack`

```swift
VStack(alignment: .leading, spacing: 8) {
    Text("Title")
    Text("Subtitle")
}
```

```text
VStack  → vertical
HStack  → horizontal
ZStack  → overlay (alignment)
```

Containers propose sizes, children report, containers place. That is the layout protocol. Stacks are **eager**: all children are created even off-screen. A long feed does not belong in a `VStack`. Use a `List`, or a `LazyVStack` in a `ScrollView`.

`Spacer` expands; in a stack it eats remaining space. `Divider` is a 1pt rule. Both are catalogued more fully in the view catalog chapter.

## `Group`

`Group` does not layout by itself. It is for attaching a modifier to several children, or for calming `ViewBuilder` type complexity. A `Group` of ten texts inside a stack is still ten texts. It is not a lazy container and it is not a card.

## `GroupBox`

A card-like labelled container. Semantic grouping for settings clusters. Not for hundreds of rows.

## `ScrollView`

```swift
ScrollView {
    VStack { ... }           // eager — caution
}

ScrollView {
    LazyVStack { ... }       // lazy — better for long content
}
```

You reach for `ScrollView` when content is larger than the screen. `ScrollView` plus `VStack` instantiates everything. Interviewers ask this weekly because it is the first thing people write, and it is the first thing that hitchs on a real dataset.

## `LazyVStack` / `LazyHStack`

Creates children **as they approach the visible region**. Not a `List`. No default separators, no built-in selection, no swipe actions. Give rows a stable `.id` if the collection mutates, or row state will stick to the wrong item.

## `List`

```swift
List(items) { item in
    Text(item.title)
}
```

Underneath, this is still a platform list (`UITableView` / `UICollectionView` historically; the implementation can change). You get reuse, separators, edit mode, swipe actions.

| | List | ScrollView + LazyVStack |
| --- | --- | --- |
| Reuse | Yes (platform list) | Lazy creation, not the same reuse |
| Platform styling | Inset grouped etc. | You style it |
| Swipe actions | Easy | DIY |
| Complex stickies | Improving | More control |
| Nested scroll | Painful | Painful |

Reach for `List` when you want a standard iOS list. Reach for `ScrollView` + `LazyVStack` when you need custom scroll layout the list chrome would fight.

## `Form` / `Section`

Settings-style grouping. Use for inputs, not for infinite feeds. A `Form` of a thousand rows is a `List` you dressed wrong.

## Navigation containers (overview)

- `NavigationStack` — current
- `NavigationSplitView` — sidebar + detail (iPad / Mac)
- `TabView` — tabs
- `NavigationView` — **legacy**, do not use in new code

The navigation chapter is where path, deep links, and split views live. Here you only need to know which container you are allowed to type on a new screen.

## Presentation

- `sheet`
- `fullScreenCover`
- `alert`
- `confirmationDialog`
- `popover` (iPad; on iPhone often a sheet)
- `toolbar` / `ToolbarItem`
- `Menu` / `contextMenu`

```swift
.sheet(isPresented: $show) {
    SettingsView()
}
.alert("Delete?", isPresented: $showAlert) {
    Button("Delete", role: .destructive) { delete() }
    Button("Cancel", role: .cancel) { }
}
```

Presentation must be driven by a **source of truth** (`isPresented` or `item:`). If you present from a nested view that is about to disappear, use the item-based APIs so the sheet is not holding a stale nil, or a value that already left the tree.

---

# SwiftUI Modifiers

You write `.font`, then `.padding`, then `.background`, and the screen looks wrong. Order is not taste. Each modifier **returns a new view** wrapping the previous one (`ModifiedContent`). Nothing mutates in place.

```swift
Text("Hello")
    .font(.title)
    .foregroundStyle(.blue)
    .padding()
```

```text
Text("Hello")
    └── font
         └── foregroundStyle
              └── padding
```

Each layer can change **layout** (size and position), **rendering** (color, opacity), or **environment** (font inherited by children).

```swift
.padding()
.background(.red)
```

```text
[  padded text  ]
████████████████  ← background fills the padded size
```

```swift
.background(.red)
.padding()
```

```text
    [text on red]
    extra empty padding around, not red
```

`padding` increases the view’s layout size first; `background` is sized to the child it wraps. That is why the two screenshots disagree.

`.font(.title)` on a `VStack` often **sets the environment**, so children inherit. `.background` wraps. If you apply nothing, you get defaults: body font, primary color, zero padding.

Do not stack modifiers forever. Extract a `View` type or a `ViewModifier`. Deep chains are hard to diff mentally, and they are hard to reuse.

```swift
struct Card: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding()
            .background(.background, in: RoundedRectangle(cornerRadius: 12))
    }
}

extension View {
    func card() -> some View { modifier(Card()) }
}
```

Layout modifiers worth knowing by feel: `frame`, `padding`, `offset`, `position`, `layoutPriority`, `fixedSize`, `aspectRatio`, `clipped`, `mask`, `overlay`, `background`.

`offset` versus `padding` is the interview trap. Offset is a visual shift; the parent may still think the view occupies the old slot. Padding changes the size the parent sees. If a tap target is in the wrong place after an offset, that is why.

---

# Layout

SwiftUI layout is a three-step conversation:

```text
1. Parent proposes a size to the child
2. Child chooses a size (at most the proposal, usually)
3. Parent places the child in its coordinate space
```

`frame(maxWidth: .infinity)` says “I am willing to be as wide as you propose.” `fixedSize()` says “ignore the proposal, use intrinsic size,” and can overflow. Stacks have alignment; `frame(alignment:)` aligns the child in the extra space.

`.ignoresSafeArea()` is for full-bleed media. Do not ignore safe area on text. Home Indicator versus readable content is not a style debate.

`GeometryReader` gives you a size, but it takes **all proposed space** and can explode layouts. Prefer `containerRelativeFrame`, `visualEffect`, `onGeometryChange` (iOS 17+) over wrapping everything in a `GeometryReader`. If a screen suddenly became a full-height empty reader with a tiny child in the corner, you just met this view.

---

# SwiftUI State Management

This is the core of SwiftUI interviews. Read it twice. The question is always some form of: who owns this data, who can write it, and what happens when the struct is thrown away?

## Mental model

```text
View struct (value, ephemeral)
    │
    ├── reads inputs (let properties)
    ├── reads framework storage (@State, @Environment, …)
    └── body() produces children

When a dependency changes, SwiftUI invalidates the view,
recreates the struct, re-evaluates body, diffs, updates UI.
```

You tap. A value changes. Dependent views invalidate. New structs, new `body`, a diff, pixels. If you stored the value in the wrong wrapper, either nothing updates or the wrong screens update.

---

## `@State`

You want a counter on a screen. The number belongs to this view. Nobody else should own it. After a rotation, it should still be 3.

```swift
struct Counter: View {
    @State private var count = 0

    var body: some View {
        Button("Count: \(count)") {
            count += 1
        }
    }
}
```

`@State` is a property wrapper. SwiftUI owns the storage. `private` is how you say only this view’s code should read and write the wrapped value. It must be `var` because the wrapper intercepts mutation. `= 0` is the initial value, used when storage is first created — not on every struct recreate.

`$count` is a `Binding<Int>`. `_count` is the `State<Int>` wrapper itself.

A view struct is recreated constantly. A plain `var count = 0` resets every time, or the compiler warns, and the button appears to do nothing. `@State` persists across those recreations for a **stable identity**. Conceptually the view owns the data. Physically it lives in SwiftUI’s state store. This view observes it, and so do children you handed a `Binding`.

Assignment to the wrapped value — or a mutating method on a mutable struct stored in `@State` — invalidates the view. `body` runs again. The diff applies. When the view leaves the hierarchy, that storage is **destroyed**. Coming back creates **fresh** state, unless you lifted it up.

Mark it `private` and pass `$count` down. Do not make `@State` internal so a child can poke it. The wrapper’s setter is how you mutate from a `Button` inside `body` without marking `body` `mutating`. That is by design.

Use it for view-local UI: toggles, selected tab, text-field draft, `isPresented`. Do not use it for shared app data, or for anything that must survive the view disappearing unless you also persist. Objects that many screens share belong in Observation plus the environment, or a model you pass in.

For **objects**, prefer `@Observable` plus `@State` (iOS 17+) rather than `@StateObject`:

```swift
@State private var model = Player()   // Player is @Observable class
```

Each row in this `ForEach` has its own state:

```swift
ForEach(0..<5) { i in
    Counter()   // each row has its own state
}
```

This resets when `selectedID` changes, because identity changed:

```swift
Counter()
    .id(selectedID)  // changing id resets state
```

A draft field and a saving flag are the everyday version:

```swift
@State private var draft = ""
@State private var isSaving = false
```

### If someone asks what `@State` is

I would say: it is how a view owns durable data. The struct is disposable. The storage is not, as long as SwiftUI still thinks this is the same view. I keep it private, I pass a binding down, and I do not put the user’s account object in `@State` on a leaf row unless that row truly owns it.

---

## `@Binding`

The parent owns a toggle. The row should flip it. The row must not keep a second copy.

```swift
struct ToggleRow: View {
    @Binding var isOn: Bool
    var body: some View {
        Toggle("Enabled", isOn: $isOn)
    }
}

struct Parent: View {
    @State private var isOn = false
    var body: some View {
        ToggleRow(isOn: $isOn)
    }
}
```

A binding is a two-way reference to someone else’s storage. Get and set go to the source of truth. The child borrows. If the child uses `@State` instead, the toggle will not update the parent — two sources of truth, two UIs that drift. If you forget `$` and pass a `Bool`, you pass a snapshot. The child cannot write back.

Deep six-level binding chains mean the state should have been lifted, or it should be a model object. A `Binding` with a computed getter and setter is powerful and easy to get wrong — infinite update loops live there.

### If someone asks what `@Binding` is

I would say: it is a writeable window onto storage I do not own. The parent created it with `$`. I can read and write. I do not control the lifetime. If I need the value after I disappear, I was never the owner.

---

## `@StateObject` (legacy but interview-critical)

```text
Legacy: ObservableObject + @StateObject
        ↓
Modern: @Observable + @State (or let + environment)
        ↓
Why: Observation tracks fields, not whole objectWillChange fires
```

```swift
final class Model: ObservableObject {
    @Published var name = ""
}

struct Screen: View {
    @StateObject private var model = Model()
}
```

This view creates and owns the `ObservableObject`. SwiftUI keeps the **same instance** across view recreations. That is the entire reason `@StateObject` exists.

This is the most famous SwiftUI interview trap:

```swift
@ObservedObject var model = Model()  // ❌
```

A new `Model()` every time the struct is recreated. Lost state, extra work, fetches that restart, forms that clear themselves. Use `@ObservedObject` only when the object is **passed in**.

---

## `@ObservedObject`

```swift
struct Detail: View {
    @ObservedObject var model: Model
}
```

Observes an `ObservableObject` owned **elsewhere**. If the parent releases it, this view’s object is gone. It is the “I did not create this” wrapper. Creating with it is the bug above.

---

## `@EnvironmentObject`

```swift
.environmentObject(session)

@EnvironmentObject var session: Session
```

Implicit dependency injection down the tree. Convenient. Easy to lose — crash if missing. Prefer `@Environment(Session.self)` with `@Observable` on iOS 17+.

Environment *values* are typically small: `colorScheme`, a custom `EnvironmentKey`. Environment *objects* are reference types shared down the tree. Values versus objects is the distinction people blur when they put everything in the environment because they are tired of initialisers.

---

## `@Environment`

```swift
@Environment(\.dismiss) var dismiss
@Environment(\.colorScheme) var colorScheme
```

Read values from the environment. Custom keys via `EnvironmentKey`. This is how a deeply nested button dismisses without a binding threaded through six files, and how a view reacts to dark mode without UIKit trait collections.

---

## `@Observable` / `@Bindable` (modern)

You have a player. Two controls on two different views should read different fields. You do not want a keystroke in the title to redraw the volume slider’s entire subtree.

```swift
@Observable
final class Player {
    var title = "Untitled"
    var isPlaying = false
}

struct PlayerView: View {
    @State private var player = Player()

    var body: some View {
        PlayerControls(player: player)
    }
}

struct PlayerControls: View {
    @Bindable var player: Player
    var body: some View {
        TextField("Title", text: $player.title)
        Toggle("Playing", isOn: $player.isPlaying)
    }
}
```

`@Observable` is a macro that instruments stored properties so SwiftUI (and Observation) can subscribe to **individual fields**. A `body` that only reads `title` does not invalidate when `isPlaying` changes. Apple introduced it because `ObservableObject` plus `@Published` invalidates too coarsely — `objectWillChange` fires for the whole object — and because it dragged Combine in as a required dependency for simple screens.

If the view creates the object, store it in `@State` so the **instance** is stable. A bare `let player = Player()` inside `body` is a new instance every evaluation, which is a disaster. A `let player: Player` **passed in** is fine: you are not creating, you are holding a reference the parent already owns.

`@Bindable` produces bindings to observable properties (`$player.title`). You need it on a parameter that is a class, because `$` on a plain `var player: Player` is not a binding to fields.

### `@Query` (SwiftData)

```swift
@Query(sort: \Note.createdAt) var notes: [Note]
```

A framework-owned fetch that invalidates the view when the store changes. You do not manually refetch in `onAppear` unless you are doing something the query cannot express.

### `@AppStorage` / `@SceneStorage`

UserDefaults versus per-scene ephemeral UI restoration (nav path, selected tab). SceneStorage is not a database. Do not put the user’s documents in it and call it persistence.

### `@FocusState`

Keyboard focus. Bind to `focused(_:)`. This is how you make “after save, focus the next field” a state change instead of a UIKit first-responder hunt.

### `@Namespace` / `matchedGeometryEffect`

A shared animation namespace. The identity of matched views is what makes a thumbnail fly into a detail. Two views with the same id in the same namespace are the pair.

### `@GestureState`

Resets when the gesture ends. For drag offsets that should not persist after the finger lifts. If you stored that offset in `@State`, the view would stay where you dragged it.

---

## Comparison tables

### `@State` vs `@Binding`

| | `@State` | `@Binding` |
| --- | --- | --- |
| Owns storage | Yes | No |
| Typical | Parent | Child |
| Pass down | `$value` | receives it |

### `@StateObject` vs `@ObservedObject`

| | `@StateObject` | `@ObservedObject` |
| --- | --- | --- |
| Creates/owns | Yes | No |
| Init in view | Correct | Wrong |
| Passed in | Unusual | Correct |

### `@ObservedObject` vs `@EnvironmentObject`

| | Observed | EnvironmentObject |
| --- | --- | --- |
| Injection | Explicit parameter | Implicit tree |
| Missing | Compile if required param | Runtime crash |
| Testability | Easier | Need wrapper |

### `@StateObject` vs `@Observable`

| | StateObject + OO | State + @Observable |
| --- | --- | --- |
| Invalidation | Whole object typically | Per property |
| Combine | Yes | Not required |
| iOS | Older | 17+ |

### `@Environment` vs `@EnvironmentObject`

Values vs objects; typed keys vs `ObservableObject` subclass.

### `@State` vs `@StateObject`

Value vs `ObservableObject` instance. With Observation, `@State` can hold the class instance.

### `@Observable` vs `ObservableObject`

Fine-grained vs Combine publisher. Modern vs legacy.

### `some View` vs `any View`

Opaque vs existential.

### `VStack` vs `LazyVStack`

Eager vs lazy.

### `List` vs `ScrollView` + `LazyVStack`

Platform list vs custom scroll.

### `NavigationStack` vs `NavigationView`

Current vs deprecated.

### `Task` vs `onAppear`

`.task` cancels; `onAppear + Task` often leaks work.

### `async let` vs `TaskGroup`

Fixed vs dynamic children.

### Actor vs class

Isolation vs you-handle-it.

### struct vs class

Value vs reference.

### weak vs unowned

Nil vs crash.

### Delegate vs closure

Weak many-methods vs one-shot; both can cycle.

### Combine vs async/await

Streams vs sequential / async functions.

---

## Common state mistakes

Creating an `ObservableObject` with `@ObservedObject var vm = VM()` is the classic. Use `@StateObject`, or `@Observable` plus `@State`. Copying `@State` into a child instead of passing a `Binding` gives you two sources of truth. Side effects in `body` belong in `.task`, `.onChange`, or a button action. `@EnvironmentObject` for everything makes a graph you cannot see and a crash when a preview forgets to inject. Pass parameters until the tree is deep or the object is truly app-wide, like a session.

## One-minute explanation

SwiftUI views are throwaway structs. `@State` is how a view owns durable data. `@Binding` is how a child writes to that data. Shared objects use Observation (`@Observable`) stored in `@State` or the environment. I never create an `ObservableObject` with `@ObservedObject`. If the view creates it, `@StateObject` (legacy) or `@State` plus `@Observable` (modern). If it is passed in, `@ObservedObject` or a plain `@Bindable` parameter.

---

## Interview questions

### If `body` runs again, does my `@State` reset?

Not if SwiftUI still thinks this is the same view. Storage is keyed by identity, not by the struct instance. `body` running is normal — a parent invalidated, the environment changed, you assigned to state. The counter stays 3.

It resets when identity changes: you swapped branches in an `if`, you set `.id` to something new, the view left the hierarchy and came back. `.id(UUID())` inside `body` is the catastrophic version, because every evaluation is a new view.

I would not say “the struct is a class so it persists.” That is the opposite of the model.

### Why is `@ObservedObject var model = Model()` wrong?

Because `@ObservedObject` does not own the instance. Every time SwiftUI recreates the view struct — which is constantly — you construct a new `Model()`. State vanishes, in-flight work is abandoned, you might fire a network call per keystroke of an unrelated parent. `@StateObject` (legacy) or `@State` with an `@Observable` type is how the view creates and keeps one instance. `@ObservedObject` is for an object someone else already owns and passes in.

### `@State` versus `@Binding` versus a passed `@Observable`?

`@State` is “I own this.” `@Binding` is “I write through to whoever owns it.” A passed `@Observable` is “we share this object; I read fields, and with `@Bindable` I can bind to them.” I pick based on ownership, not based on which wrapper I learned last. A leaf toggle that only the parent cares about is a binding. A player used by three controls is an observable object. A sheet’s `isPresented` flag is `@State` on the presenter.
