# PART III — SwiftUI

SwiftUI is a declarative UI framework: you describe **what** the UI should look like for a given state. The framework owns **when** to evaluate `body`, **how** to diff, and **how** to render.

It is not UIKit with a new syntax. If you write SwiftUI as if views were long-lived objects, you will lose state, over-render, and fail interviews. The rest of this part is that sentence, unpacked.

## Which SwiftUI you are talking about

“SwiftUI” in an interview is not one version. Say which contract you mean, or the interviewer will assume 2019 `ObservableObject` and you will talk past each other.

| Era | What you actually write | What interviews still ask |
| --- | --- | --- |
| 2019–2022 | `ObservableObject`, `@Published`, `@StateObject`, `@ObservedObject`, `NavigationView`, `NavigationLink(destination:)` | The traps: `@ObservedObject var vm = VM()`, eager destinations, `NavigationView` |
| iOS 16 | `NavigationStack`, `NavigationPath`, `Layout` protocol, `Transferable` | Typed navigation, programmatic `path`, why `NavigationView` is done |
| iOS 17 | `@Observable`, `@Bindable`, `@State` holding a class, `@Environment(Type.self)`, `scrollPosition`, `onGeometryChange` | Fine-grained invalidation, “do I still need StateObject,” environment crash vs default |
| iOS 18+ / current | Further Observation, richer scroll and tabs, `ContentUnavailableView` in more places | Same ownership questions. New APIs are extra, not a replacement for identity |

This handbook’s default is **iOS 17+ Observation** for new screens, and **honest legacy** for the wrappers you will still debug. If the job’s deployment target is iOS 16, `@StateObject` is not “wrong.” It is the ownership wrapper that target has. If the target is 17+, starting a new model on `@Published` is a choice you should defend, not a default.

---

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

Identity is the other half of Observation. Same model, two views, two identities — two `@State` boxes. One view, noisy `.id` — the box is thrown away every frame.

| Kind of identity | How SwiftUI decides “same view” | What resets when it changes | When you use it on purpose |
| --- | --- | --- | --- |
| Structural | Type + place in the tree (`if`/`else` are two places) | `@State`, `.task`, focus | Login versus Home — you *want* a new view |
| Explicit `.id` | The value you pass | Everything tied to that identity | A new `document.id` should kill the old editor’s undo stack |
| `ForEach` | The `Identifiable` id, or the `id:` key path | Row `@State`, row `.task` | Stable model ids. Never `items.indices` on a mutating array |
| `AnyView` / type erasure | Weaker — you threw away the concrete type | Diffing gets pessimistic | Plugin boundaries, not list rows |

`.id(UUID())` inside `body` is not a refresh trick. It is a new view on every evaluation: tasks restart, scroll jumps, the cursor dies. If you “fixed” a stale screen that way, you hid a dependency bug by burning the identity table.

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

Underneath, this is still a platform list (`UITableView` / `UICollectionView` historically; the implementation can change). You get reuse, separators, edit mode, swipe actions. That is why a `List` of a thousand rows can feel fine and a `VStack` of a thousand rows cannot: the list is allowed to throw rows away and rebuild them. A stack is not.

The comparison people actually need is not “List is newer.” It is “who owns reuse, chrome, and identity.”

| Question | `List` | `ScrollView` + `LazyVStack` |
| --- | --- | --- |
| What is it, really? | A system list. SwiftUI asks UIKit (or the current list engine) to show rows. You get platform spacing, separators, and edit mode whether you asked or not. | A scroll container plus a lazy stack. Children are created as they approach the visible region. There is no table view contract. You own padding, separators, and selection chrome. |
| Reuse | Real cell reuse. A row that leaves the screen can be rebound to another item. `@State` in the row is tied to identity, not to the visual cell — if your `id` is an index, the wrong draft travels. | Lazy *creation*, not the same reuse pool. Off-screen views can be discarded. Still: unstable ids make state stick to the wrong row. Identity rules are the same even though the engine is different. |
| Styling | Inset grouped, plain, sidebar. Fighting the default insets is a sport. If the design is “a standard iOS settings list,” stop fighting. | You style everything. That is freedom and that is work. Custom cards, mixed-width rows, a header that does not look like `UITableView` — this is why people leave `List`. |
| Swipe, move, delete | `.swipeActions`, `.onDelete`, `.onMove` are first-class. | You build them. A drag gesture will fight the scroll view. Do not promise swipe-to-delete on a lazy stack in a six-week feature unless you have already done it once. |
| Sticky headers | Improving, still fiddly, version-dependent. | You can pin with safe-area tricks or overlay. More control, more code. |
| Nested scrolling | Painful. A `List` inside a `ScrollView` is two scroll views arguing. | Also painful. Nested scroll is a platform problem, not a SwiftUI-only one. |
| When I pick it | Feeds, inboxes, settings, anything that should *feel* like iOS. | Magazines, mixed media, a timeline with custom layout the list chrome would wreck. |

Reach for `List` when you want a standard iOS list. Reach for `ScrollView` + `LazyVStack` when you need custom scroll layout the list chrome would fight. If the interviewer asks “why is my list slow,” I do not start with this table. I start with image size, work in `body`, and identity. The container is the second question, not the first.

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

Layout versus rendering versus environment, because “modifier order” is three different machines:

| Kind of modifier | What it actually does | Example | What goes wrong |
| --- | --- | --- | --- |
| Layout | Changes the size or position the parent will use | `padding`, `frame`, `fixedSize`, `layoutPriority` | `offset` looks like layout and is not — hit targets stay behind |
| Rendering | Paints without changing the layout report | `opacity`, `foregroundStyle`, many overlays | A full-screen dim that still receives taps because you faded pixels, not hit testing |
| Environment | Writes a value children inherit | `font`, `colorScheme` on a container, `environment(\.myKey)` | You set `.font` on a `Text` and wonder why a sibling did not change — inheritance walks *down*, not sideways |

When a screen “looks wrong after I added a background,” I draw the wrap list on paper: who is the child of whom. The background sizes to *its* child. Padding outside the background is empty. Padding inside the background is filled. That drawing is the whole modifier interview.

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

A compact comparison for the layout questions that keep coming back:

| API | What you are saying | When it bites |
| --- | --- | --- |
| `frame(maxWidth: .infinity)` | I will take the width you proposed | Inside a `ScrollView`, the proposal can be unbounded in the scroll axis — infinity is not a size |
| `fixedSize()` | Ignore the proposal, use intrinsic size | Overflow, clipped text, a chip that refuses to wrap |
| `layoutPriority` | If there is not enough space, shrink me last (or first) | Two children both at priority 1 and you still do not know who yields |
| `Spacer` | Give me leftover space on the stack axis | No leftover inside an intrinsically sized stack in a `ScrollView` — the spacer does nothing |
| `GeometryReader` | I want the proposed size as a number | I *become* a greedy child. Wrap it in a frame if you did not want full height |
| `containerRelativeFrame` | Size me relative to a container (iOS 17+) | Still not a reason to measure every row on every frame |
| `ignoresSafeArea()` | Paint into the home indicator / notch | Text under the home indicator. Fine for a photo. Not for a form |

Safe area is not padding you guessed. The system tells you where the home indicator and the notch are. Full-bleed media ignores it. Body text does not. That is a HIG answer and a layout answer.

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

These are the SwiftUI questions that actually separate people in a room. A one-word cell is not an answer. The useful version is: who owns the data, what invalidates, what crashes, and what you would type on a new screen.

### `@State` vs `@Binding`

Both talk to the same storage. The difference is **who is allowed to create it**.

`@State` is a box SwiftUI keeps for this view’s identity. You create the value. You mark it `private`. When the struct is thrown away and rebuilt, the box is still there. `$count` is how you punch a hole in that box for a child.

`@Binding` is only the hole. There is no box. Get and set go somewhere else. If the parent dies, the binding is a window onto nothing useful. The child must not keep a second `@State` “copy” of the same Bool — that is two UIs that drift.

| | `@State` | `@Binding` |
| --- | --- | --- |
| What it actually is | Durable storage, keyed by this view’s identity | A get/set pair pointing at someone else’s storage |
| Who owns the data | This view (conceptually). SwiftUI (physically). | The ancestor (or model) that created the `Binding` |
| Typical place | Parent, or a leaf that truly owns a draft | Child control: toggle, text field, stepper |
| How you pass it down | `$value` (projected value) | The child *receives* `Binding<T>` |
| Survives `body` re-running | Yes, if identity is stable | Yes, because the owner’s storage survived |
| Survives the view leaving the tree | No. Fresh state on the next insert. | Irrelevant — the child never owned it |
| Classic bug | Using a plain `var` and wondering why the counter resets | Passing `isOn` instead of `$isOn` so the child cannot write back |
| When I pick it | Local UI: sheet flag, selected tab, text draft | A row that must flip the parent’s value |

If they push “can a child have `@State`?” Yes, for *its* draft. Not for the parent’s source of truth.

### `@StateObject` vs `@ObservedObject`

Same `ObservableObject`. Opposite ownership. This is the most famous SwiftUI trap still in circulation because tutorials copy-pasted the wrong wrapper for years.

`@StateObject` means **this view creates the object and SwiftUI must keep that instance** across struct recreations. First `init` wins for that identity. Later inits of `Model()` are thrown away.

`@ObservedObject` means **someone else already has the instance**. You subscribe. You must not allocate in the same line. `@ObservedObject var model = Model()` constructs a new model every time the parent `body` runs. The form clears. The network restarts. People file it as a SwiftUI bug.

| | `@StateObject` | `@ObservedObject` |
| --- | --- | --- |
| What it actually is | Ownership of an `ObservableObject` | A subscription to an `ObservableObject` you did not create |
| Who `init`s the class | This view, once per identity | The parent, a factory, or the environment |
| `var model = Model()` in the view | Correct with `@StateObject` | **Wrong** with `@ObservedObject` — new object every recreate |
| Passed in from a parent | Unusual (you would be double-owning) | Correct |
| Invalidation | Typically the whole object via `objectWillChange` | Same publisher, same coarseness |
| When the view identity changes | New object, old one deinits | You still hold whatever was passed — or you crash if it is gone |
| Modern replacement | `@State` + `@Observable` class | `@Bindable` parameter, or a plain `let` if you only read |
| When I pick it | Legacy screens that still use Combine models and *this* screen owns them | Detail views, rows, anything that receives a model |

If they push “why did my `TextField` reset on every keystroke of an unrelated parent?” I look for `@ObservedObject var vm = VM()` before I look at keyboard avoidance.

### `@ObservedObject` vs `@EnvironmentObject`

Both subscribe to an `ObservableObject`. The difference is **how the object arrives**.

A parameter is a contract. The compiler knows `Detail` needs a `Model`. A preview that forgets it does not compile. An environment object is implicit. Convenient for a session used by forty screens. Easy to forget in a preview, in a sheet presented outside the tree, in a UIKit-hosted SwiftUI view. Missing `@EnvironmentObject` is a **runtime crash**, not a compiler error.

| | `@ObservedObject` | `@EnvironmentObject` |
| --- | --- | --- |
| How it is injected | Explicit: `Detail(model: model)` | Implicit: `.environmentObject(model)` somewhere above |
| Missing dependency | Usually a compile error if the initializer requires it | Crash: “No ObservableObject of type … found” |
| What you are saying | This screen takes a model | This subtree can magically see a model |
| Testability | Pass a fake in the initializer | Wrap in a tree that injects, or the test crashes |
| Refactor cost | Rename a parameter | Hunt every `environmentObject` and every reader |
| When I pick it | Feature screens, anything I will unit-test | Truly app-wide session, theme controller, a store every tab needs |
| Modern replacement | `@Bindable var model: Model` | `@Environment(Model.self)` with `@Observable` |

If they push “is environment bad?” No. Implicit *everything* is bad. A session in the environment is normal. A `CheckoutDraft` in the environment because you were tired of passing it is how two checkouts share one card number.

### `@StateObject` + `ObservableObject` vs `@State` + `@Observable`

This is the legacy-to-modern table. Same idea — a view owns a class — different invalidation story.

`ObservableObject` plus `@Published` sends `objectWillChange` for the object. Any view that holds that object as `@ObservedObject` / `@StateObject` tends to refresh when *any* published field changes. A keystroke in `title` redraws a slider that only reads `volume`.

`@Observable` records **which properties `body` read**. A write to an unread property does not invalidate that view. That is the entire reason Apple shipped Observation. Combine is no longer required for a simple screen.

| | `@StateObject` + `ObservableObject` | `@State` + `@Observable` |
| --- | --- | --- |
| What you type | `ObservableObject` class, `@Published` fields, `@StateObject private var model = Model()` | `@Observable` class, `@State private var model = Model()` |
| What invalidates a view | Usually the whole object | Properties that view actually read during `body` |
| Combine | In the loop: `@Published` is a publisher | Not required |
| Bindings into fields | `$model.name` works if `model` is `ObservedObject`/`StateObject` | Need `@Bindable var model` (or `@Bindable` on a bindable wrapper) to get `$model.name` |
| Minimum OS | Years of production | iOS 17+ for the SwiftUI storage pattern you want |
| What still bites you | Creating with `@ObservedObject` | `let model = Model()` inside `body` — still a new instance every time |
| When I pick it | Code that already speaks Combine, or a deployment target below 17 | New screens. I would not start a 2026 feature on `@Published` unless the module already does. |

If they push “does `@Observable` make lists free?” No. If every row reads `vm.posts` and `vm.tick`, you still redraw the world. Granularity only helps if `body` is granular.

### `@Environment` vs `@EnvironmentObject`

People mash these together because both say “environment.” They are different types of hole in the tree.

`@Environment` reads a **value** (or a small struct) from the environment: `colorScheme`, `dismiss`, `locale`, a custom `EnvironmentKey`. Missing a custom key falls back to the key’s default. You do not crash.

`@EnvironmentObject` reads a **class** that must have been injected. No default. Crash if absent.

| | `@Environment` | `@EnvironmentObject` |
| --- | --- | --- |
| What lives in the tree | A value, often `Equatable`, copied down | A reference type |
| How you add it | `.environment(\.myKey, value)` | `.environmentObject(object)` |
| How you read it | `@Environment(\.myKey) var myKey` | `@EnvironmentObject var object: Type` |
| If nobody set it | Default from `EnvironmentKey.defaultValue` | Runtime crash |
| Typical uses | Dark mode, dismiss, layout direction, a custom `isCompact` flag | Session, app-wide store (legacy Combine objects) |
| Modern object version | `@Environment(Session.self) var session` for `@Observable` | Still exists; I prefer the typed `@Environment(Type.self)` on 17+ |
| When I pick it | Almost all ambient configuration | Only while the object is still `ObservableObject` |

If they push “how does a nested button dismiss a sheet?” `@Environment(\.dismiss)`. Not a binding threaded through six files, and not an environment object for a single Bool.

### `@State` vs `@StateObject`

One is for values (and, now, for `@Observable` instances). One is for `ObservableObject` instances.

A `Bool`, an `Int`, a small struct draft: `@State`. An `ObservableObject` this view creates: `@StateObject`. An `@Observable` class this view creates: `@State` again — that is the modern line, and it confuses people who memorised “classes need StateObject.”

| | `@State` | `@StateObject` |
| --- | --- | --- |
| Historical job | Value-type UI state | Own an `ObservableObject` |
| Can it hold a class? | Yes, if the class is `@Observable` (iOS 17+) | Yes, that is what it was built for |
| Storage | SwiftUI state table, by identity | Same table, holding a reference |
| First init wins | Initial value used once per identity | `wrappedValue` initializer used once per identity |
| When I pick it | Toggles, drafts, and modern observable models I own | Legacy Combine models I own |

### `@Observable` vs `ObservableObject`

Not “new versus old” as a fashion. **How invalidation is billed.**

`ObservableObject` is a Combine publisher with a convention: you `send()` on `objectWillChange`, usually via `@Published`. SwiftUI subscribes to the object, not to `name` versus `age`.

`@Observable` is a macro on stored properties. Reads during a tracking scope (SwiftUI `body`, `withObservationTracking`, `Observations`) register. Writes notify that set of readers. A view that never read `age` does not care that `age` changed.

| | `@Observable` | `ObservableObject` |
| --- | --- | --- |
| Mechanism | Property-level tracking | Object-level publisher |
| Dependency | Observation (the runtime) | Combine |
| Easy to over-subscribe | Reading `self` / logging the whole model in `body` | Holding the object at all |
| Bindings | `@Bindable` | `$model.field` on StateObject/ObservedObject |
| UIKit / non-view listeners | `Observations { }` or tracking | `sink` on `@Published` |
| When I pick it | New models | Existing Combine stack, or a publisher graph that is not a view |

### `some View` vs `any View`

`body` wants **one concrete type**, hidden. That is `some View`. The compiler still knows it is `ModifiedContent<Text, _PaddingLayout>` and can specialise. Identity stays crisp.

`any View` is an existential: “some unknown view.” Boxing, less specialisation, weaker identity. `AnyView` is the type-eraser people reach for when two `if` branches have different types. `ViewBuilder` already handles `if`/`else` as `_ConditionalContent`. You almost never need the box.

| | `some View` | `any View` / `AnyView` |
| --- | --- | --- |
| What it means | Opaque: one type, name hidden | Existential: the type is unknown at the use site |
| `body` | This is what `body` returns | Legal, slower, worse for identity |
| `if` / `else` in a builder | Different types are OK — the builder makes a sum type | People erase both branches and pay twice |
| Lists of mixed views | Prefer an enum + `switch` in `ViewBuilder` | `[any View]` is a last resort |
| When I pick it | Always, until a plugin boundary forces erasure | Module plugins, or a truly dynamic child you cannot name |

If they push “why is my list hitching after I wrapped rows in `AnyView`?” Because you threw away the concrete type the diff wanted. Unwrap it.

### `VStack` vs `LazyVStack`

Eager versus lazy is not a style choice. It is whether off-screen children exist.

A `VStack` builds **every** child when the parent `body` runs. Ten thousand rows means ten thousand view structs, layout, and often images. A `LazyVStack` inside a `ScrollView` builds children as they approach the visible region. It is still not a `List`: no reuse pool in the UIKit sense, no swipe actions, no edit mode.

| | `VStack` | `LazyVStack` |
| --- | --- | --- |
| When children are created | All at once | As they near the viewport |
| Needs a `ScrollView`? | Only if content is taller than the screen — and then you should think twice | Yes. Lazy without scroll is a foot-gun |
| Separators, swipe, selection | You build them | You build them |
| Stable `.id` | Still matters for `@State` in children | Matters more — lazy creation plus bad ids is silent wrong-row state |
| When I pick it | Short, known content: a card, a header, a form section | Long scrolling custom content that must not be a `List` |

A `LazyVStack` of rows that each take the whole `FeedVM` as `@ObservedObject` is still not lazy in the way you hoped. Every row subscribed to the world. See Observation.

### `NavigationStack` vs `NavigationView`

`NavigationView` is the 2019 container. `NavigationLink(destination: SomeView())` built the destination **eagerly** in a lot of real code, and the stack was not a value you could print, restore, or deep-link.

`NavigationStack` is a **data structure**. You push `Hashable` values. `.navigationDestination(for:)` builds the screen. You can assign the path from a notification. You can persist a typed `[Route]` enum.

| | `NavigationStack` | `NavigationView` |
| --- | --- | --- |
| Status | Current | Deprecated for new work |
| What the stack is | Values you own (`path`) | A view tree you do not really own |
| Destination | `navigationDestination(for:)` | `NavigationLink(destination:)` |
| Deep link | Assign `path` | Hack a link or a hidden `NavigationLink` |
| State restoration | Codable route enum | Painful |
| When I pick it | Every new screen | Only while deleting it from a module I inherited |

If they still write `NavigationView` in 2026, I treat it as a signal their last tutorial predates typed navigation. The navigation chapter is the worked example.

### `.task` vs `onAppear { Task { } }`

`onAppear` is an event. It does not own work. `Task { await load() }` from that event is unstructured: pop the screen and the task keeps going, writes to a view that is gone, or holds a view model forever.

`.task` is a **scope**. SwiftUI starts it when the view appears for this identity and **cancels** it when the view goes away or the identity changes. `.task(id: query)` restarts when `query` changes and cancels the previous run. That is the search-box pattern.

| | `.task` / `.task(id:)` | `onAppear { Task { } }` |
| --- | --- | --- |
| Who owns the task | The view’s appearance identity | Nobody unless you store it |
| Cancel on disappear | Yes | No, unless you cancel by hand in `onDisappear` |
| Restart when an input changes | `.task(id: value)` | You build that yourself and get it wrong |
| When I pick it | Almost all loads, including per-row | Almost never for async work |

If they push “does `.task` run on MainActor?” The closure inherits the view’s actor context, usually main. Still do not decode an 8 MB JSON payload inside it. Hop off, hop back.

### Sheets: `isPresented` vs `item:`

`isPresented: true` plus a separate `selected: Item?` is two sources of truth. You present, then `selected` is already `nil`, and the sheet crashes on unwrap — or shows yesterday’s item.

`.sheet(item: $selected)` is one source: `nil` means dismissed, non-nil means this value is on screen. Identity of the item resets sheet `@State` when you present a different item. That is what you want for “open this message.”

| | `isPresented` | `item:` |
| --- | --- | --- |
| Source of truth | A Bool, plus whatever else you hope stays in sync | The optional model |
| Stale content | Easy | Harder — the item *is* the content |
| New item, fresh state | You must `.id` yourself | Changing the item is a new presentation |
| When I pick it | Alerts, empty confirmation, no model | Any sheet that needs the thing it is showing |

The rest of the tables people paste into cheat sheets — `async let` versus `TaskGroup`, actor versus class, weak versus unowned — are language tables. They belong in Swift and concurrency. Do not answer a SwiftUI state question with “actors.” Answer with ownership.

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
