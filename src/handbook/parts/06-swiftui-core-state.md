# PART III — SwiftUI

SwiftUI is a **declarative UI framework**: you describe **what** the UI should look like for a given state. The framework owns **when** to evaluate `body`, **how** to diff, and **how** to render.

It is not UIKit with a new syntax. If you write SwiftUI as if views were long-lived objects, you will lose state, over-render, and fail interviews.

---

# SwiftUI Fundamentals

```text
Experience: 0–2
Advanced: 2–4 / 4+
Category: SwiftUI
Difficulty: Beginner
Importance: Critical
```

## `View`

```swift
struct Greeting: View {
    let name: String
    var body: some View {
        Text("Hello, \(name)")
    }
}
```

### Syntax breakdown

```text
struct Greeting: View   → a view is a struct conforming to View
let name                → input data (not @State)
var body: some View     → required computed property; opaque result type
Text(...)               → a primitive view
```

### What `View` is

A protocol with an associated `Body` type and a `body` property. Your struct is a **lightweight description**. It can be created thousands of times per second. **It is not the on-screen pixel object.**

### Why views are structs

- Cheap to recreate
- Value semantics: no accidental shared mutation of the description
- The framework stores **durable state** (`@State`, `@StateObject`, etc.) **beside** the identity of the view, not inside the struct fields in the way beginners think

### Why `body` exists

It is the function the framework calls to produce the current child tree. Treat it as **pure**: given the same inputs and state, it should return the same description. Side effects in `body` are bugs (duplicate network calls, broken animations).

### Why `some View`

An **opaque type**. Callers know it is a `View`; the compiler knows the concrete type (`Text`, `ModifiedContent<Text, _PaddingLayout>`, …). That preserves identity and specialisation.

### What happens if we write `any View`

Existential boxing. Worse performance, worse identity. Use only when you must type-erase (`AnyView`), and even then sparingly.

### What happens if we don't conform to `View`

You cannot put it in a SwiftUI hierarchy.

### `ViewBuilder`

`body` is `@ViewBuilder`. You can write `if`, `switch`, multiple children (wrapped as `TupleView`). Without the builder, `if` would not type-check as `some View`.

---

## The three different “lifetimes” (memorise)

```text
View struct creation     → SwiftUI instantiates your struct (often)
body evaluation          → SwiftUI calls body to get a new child tree
Rendering                → CoreAnimation/Metal commits pixels
State lifetime           → storage keyed by view identity, not by struct instance
```

**Interview question:** “If `body` runs again, is my `@State` reset?”  
**Expected:** No, not if identity is stable. State lives in the framework store.  
**Wrong:** “The struct is a class so state persists.”

See [View Lifecycle and Rendering](#swiftui-view-lifecycle-and-rendering).

---

# Views

For each primitive: what, why, syntax, modifiers, rendering, mistakes, interviews.

## `Text`

Displays string (or `AttributedString`).

```swift
Text("Hello")
    .font(.title)
    .foregroundStyle(.primary)
    .multilineTextAlignment(.leading)
```

**Why:** the most common primitive. Localisation: `Text("key")` with `LocalizedStringKey` vs `Text(verbatim: string)` for raw user content.

**Performance:** thousands of `Text` in a `VStack` (eager) is expensive; use lazy stacks/lists.

**Mistake:** `Text(Date(), style: .timer)` in a huge list without thinking about updates.

## `Image` / `Image(systemName:)`

```swift
Image("logo")                       // asset catalog
Image(systemName: "star.fill")      // SF Symbols
    .symbolRenderingMode(.hierarchical)
```

**Why SF Symbols:** scale with Dynamic Type, match Apple HIG.

**Performance:** decode off main for large photos; use `AsyncImage` or a loader with cache. `resizable()` is required before `scaledToFit()` in the usual pattern.

```swift
Image("hero")
    .resizable()
    .scaledToFit()
```

Order matters: `resizable` enables stretching.

## `Button`

```swift
Button("Save") {
    save()
}

Button(action: save) {
    Label("Save", systemImage: "square.and.arrow.down")
}
```

**Why:** accessibility (it is a control), hit testing, styling (`.borderedProminent`).

**Mistake:** putting a `Button` inside a `List` row that also has `NavigationLink` — gesture fights. Use `role: .destructive` for deletes.

**Do not** start unstructured `Task` in the action without cancellation policy; `Button` action can `Task { }` but prefer `async` button APIs where available (`Button(action:)` + `.disabled`).

## `Label`

Icon + title, adaptive. Prefer over ad-hoc `HStack { Image; Text }` for accessibility.

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

**Why they exist:** the layout protocol — containers propose sizes, children report, containers place.

**Rendering:** **eager**. All children are created even off-screen.

**When NOT to use `VStack` for long content:** use `List` or `LazyVStack` in a `ScrollView`.

**`Spacer`:** expands; in a stack it eats remaining space.  
**`Divider`:** a 1pt rule.

## `Group`

Does not layout by itself; used to attach a modifier to multiple children or to type-erase builder complexity. `Group` of 10 texts still is 10 texts in a stack parent.

## `GroupBox`

Card-like labelled container. Semantic grouping.

## `ScrollView`

```swift
ScrollView {
    VStack { ... }           // eager — caution
}

ScrollView {
    LazyVStack { ... }       // lazy — better for long content
}
```

**Why:** content larger than the screen.  
**Performance:** `ScrollView` + `VStack` instantiates everything. Interviewers ask this weekly.

## `LazyVStack` / `LazyHStack`

Creates children **as they approach the visible region**. Not a `List`. No default separators, no built-in selection, no swipe actions.

**Identity:** give rows stable `.id` if the collection mutates.

## `List`

```swift
List(items) { item in
    Text(item.title)
}
```

UIKit `UITableView`/`UICollectionView` underneath (implementation can change). Built-in reuse, separators, edit mode, swipe actions.

**List vs ScrollView + LazyVStack**

| | List | ScrollView + LazyVStack |
| --- | --- | --- |
| Reuse | Yes (platform list) | Lazy creation, not the same reuse |
| Platform styling | Inset grouped etc. | You style it |
| Swipe actions | Easy | DIY |
| Complex stickies | Improving | More control |
| Nested scroll | Painful | Painful |

## `Form` / `Section`

Settings-style grouping. Use for inputs, not for infinite feeds.

## Navigation containers (overview)

- `NavigationStack` — current
- `NavigationSplitView` — sidebar + detail (iPad/mac)
- `TabView` — tabs
- `NavigationView` — **legacy**, do not use in new code

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

**State:** presentation must be driven by **source of truth** (`isPresented` or `item:`). If you present from a nested disappearing view, use item-based APIs.

---

# SwiftUI Modifiers

```text
Experience: 0–2 (use them)
Experience: 2–4 (order, layout vs paint)
Experience: 4+ (ModifiedContent tree, environment, transactions)
Category: SwiftUI
Difficulty: Intermediate
Importance: Critical
```

```swift
Text("Hello")
    .font(.title)
    .foregroundStyle(.blue)
    .padding()
```

### What a modifier actually does

A modifier **returns a new view** wrapping the previous one (`ModifiedContent`). It does not mutate the old view in place.

```text
Text("Hello")
    └── font
         └── foregroundStyle
              └── padding
```

Each layer can change **layout** (size/position) or **rendering** (color, opacity) or **environment** (font inherited by children).

### Why order matters

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

**Why:** `padding` increases the view’s layout size first; `background` is sized to the child it wraps.

### Environment vs wrapping

`.font(.title)` on a `VStack` often **sets the environment** so children inherit. `.background` wraps.

### What happens if we don't apply a modifier

Default environment: body font, primary color, default padding zero, etc.

### When not to modifier-stack forever

Extract `View` types or `ViewModifier` structs. Deep modifier chains are hard to diff mentally.

### Custom `ViewModifier`

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

### Layout modifiers worth knowing

`frame`, `padding`, `offset` (does not change layout in the same way as padding — **offset paints elsewhere but layout size may stay**; interview trap), `position`, `layoutPriority`, `fixedSize`, `aspectRatio`, `clipped`, `mask`, `overlay`, `background`.

`offset` vs `padding`: offset is a visual shift; the parent may still think the view occupies the old slot.

---

# Layout

```text
Experience: 2–4
Category: SwiftUI
Difficulty: Intermediate
Importance: High
```

SwiftUI layout is a **three-step conversation**:

```text
1. Parent proposes a size to the child
2. Child chooses a size (at most the proposal, usually)
3. Parent places the child in its coordinate space
```

`frame(maxWidth: .infinity)` says “I am willing to be as wide as you propose.”  
`fixedSize()` says “ignore the proposal, use intrinsic size” (can overflow).

**Alignment:** stacks have alignment; `frame(alignment:)` aligns the child in the extra space.

**Safe area:** `.ignoresSafeArea()` for full-bleed media. Do not ignore safe area on text.

**GeometryReader:** gives size, but it takes **all proposed space** and can explode layouts. Prefer `containerRelativeFrame`, `visualEffect`, `onGeometryChange` (iOS 17+) over wrapping everything in `GeometryReader`.

---

# SwiftUI State Management

```text
Experience: 0–2 (@State, @Binding)
Experience: 2–4 (@StateObject, @ObservedObject, @EnvironmentObject, @Environment)
Experience: 4+ (Observation, identity, invalidation, transactions)
Category: SwiftUI
Difficulty: Intermediate
Importance: Critical
```

Read this section twice. This is the core of SwiftUI interviews.

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

---

## `@State`

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

### Syntax breakdown

```text
@State     → property wrapper; storage owned by SwiftUI
private    → only this view’s code should read/write the wrapped value
var        → must be var; wrapper intercepts mutation
count      → name
= 0        → initial value, used when storage is first created
```

`$count` is a `Binding<Int>`.

`_count` is the `State<Int>` wrapper.

### What is it?

A wrapper that tells SwiftUI: **this view owns a piece of mutable data**. The data is stored **outside** the struct, keyed by the view’s **identity**.

### Why do we need it?

View structs are recreated. A plain `var count = 0` resets every time. `@State` persists across recreations for a stable identity.

### Who owns the data?

The **view** (conceptually). Physically, SwiftUI’s state store.

### Who observes the data?

This view (and children that received a `Binding`).

### What happens when the value changes?

SwiftUI invalidates the view. `body` runs again. Diff applies.

### What causes the view to update?

Assignment to the wrapped value (or a mutating method on a mutable struct stored in `@State`).

### What happens if we remove `@State`?

```swift
var count = 0
```

The button may appear to do nothing (mutation is lost on the throwaway struct) or the compiler warns. **UI will not reliably update.**

### Why `private`?

The owner should not let outsiders write the storage. Pass `$count` down as `Binding` instead of making `@State` internal.

### Why can we mutate from `body`’s `Button`?

The wrapper’s setter is non-mutating from the struct’s perspective in the sense SwiftUI provides a `static subscript` / `_enclosingInstance` magic — you do not mark `body` as `mutating`. That is by design.

### What happens when the view is recreated?

State **kept** if identity stable.

### What happens when the view leaves the hierarchy?

State is **destroyed**. Coming back creates **fresh** state (unless you lifted state up).

### When to write it

View-local UI: toggles, selected tab, text field draft, `isPresented`.

### When to avoid it

Shared app data, anything that must survive the view disappearing (unless you persist). Objects that many screens share — use Observation + environment or a passed model.

### Evolution

Still current. For **objects**, prefer `@Observable` + `@State` (iOS 17+) rather than `@StateObject`.

```swift
@State private var model = Player()   // Player is @Observable class
```

### Example 1 — Basic

Counter above.

### Example 2 — Real-world

```swift
@State private var draft = ""
@State private var isSaving = false
```

### Example 3 — Interview

```swift
ForEach(0..<5) { i in
    Counter()   // each row has its own state
}
```

vs

```swift
Counter()
    .id(selectedID)  // changing id resets state
```

---

## `@Binding`

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

### What is it?

A **two-way reference** to someone else’s storage. Get/set go to the source of truth.

### Who owns the data?

The parent (or whoever created the `Binding`). The child **borrows**.

### What happens if we use `@State` in the child instead?

The toggle would not update the parent. Two sources of truth.

### What happens if we don't write `$`

You pass a snapshot `Bool`. The child cannot write back.

### When to avoid Binding

Deep 6-level binding chains — lift state or use a model object. `Binding` to a computed getter/setter is powerful and easy to get wrong (infinite loops).

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

**Who owns:** this view creates and owns the `ObservableObject`. SwiftUI keeps the **same instance** across view recreations.

**What happens if we use `@ObservedObject` to create it:**

```swift
@ObservedObject var model = Model()  // ❌
```

A new `Model()` every time the struct is recreated → **lost state, extra work, bugs**. This is the most famous SwiftUI interview trap.

Use `@ObservedObject` only when the object is **passed in**.

---

## `@ObservedObject`

```swift
struct Detail: View {
    @ObservedObject var model: Model
}
```

Observes an `ObservableObject` owned **elsewhere**. If the parent releases it, this view’s object is gone.

---

## `@EnvironmentObject`

```swift
.environmentObject(session)

@EnvironmentObject var session: Session
```

Implicit dependency injection via the tree. Convenient; easy to lose (crash if missing). Prefer `@Environment(Session.self)` with `@Observable` on iOS 17+.

**vs `@Environment`:** environment values are typically small (`colorScheme`, custom `EnvironmentKey`). Environment **objects** are reference types shared down the tree.

---

## `@Environment`

```swift
@Environment(\.dismiss) var dismiss
@Environment(\.colorScheme) var colorScheme
```

Read values from the environment. Custom keys via `EnvironmentKey`.

---

## `@Observable` / `@Bindable` (modern)

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

### What is `@Observable`?

A macro that instruments stored properties so SwiftUI (and Observation) can subscribe to **individual fields**. `body` that only reads `title` does not invalidate when `isPlaying` changes.

### Why Apple introduced it

`ObservableObject` + `@Published` invalidates too coarsely (`objectWillChange`). Combine dependency. Boilerplate.

### Who owns?

If the view creates it, store in `@State` so the **instance** is stable. A bare `let player = Player()` inside `body` is a new instance every evaluation — **disaster**. A `let player: Player` **passed in** is fine.

### `@Bindable`

Produces bindings to observable properties (`$player.title`). Needed on a parameter that is a class, because `$` on a plain `var player: Player` is not a Binding to fields.

### `@Query` (SwiftData)

```swift
@Query(sort: \Note.createdAt) var notes: [Note]
```

Framework-owned fetch that invalidates the view on store changes.

### `@AppStorage` / `@SceneStorage`

UserDefaults vs per-scene ephemeral UI restoration (nav path, selected tab). SceneStorage is not a database.

### `@FocusState`

Keyboard focus. Bind to `focused(_:)`.

### `@Namespace` / `matchedGeometryEffect`

Shared animation namespace. Identity of matched views.

### `@GestureState`

Resets when the gesture ends. For drag offsets that should not persist.

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

Streams vs sequential/async functions.

---

## Common state mistakes

```text
❌ @ObservedObject var vm = VM()
✅ @StateObject or @Observable + @State

❌ @State in a parent and another @State copy in child
✅ Binding or shared observable

❌ Putting side effects in body
✅ .task, .onChange, button actions

❌ EnvironmentObject for everything
✅ Explicit parameters until the tree is deep / app-wide session
```

## One-minute explanation

“SwiftUI views are throwaway structs. `@State` is how a view owns durable data. `@Binding` is how a child writes to that data. Shared objects use Observation (`@Observable`) stored in `@State` or the environment. I never create an `ObservableObject` with `@ObservedObject`.”

---
