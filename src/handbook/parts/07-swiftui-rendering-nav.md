# Observation

```text
Experience: 2–4 (use @Observable)
Experience: 4+ (tracking, Observations AsyncSequence, UIKit bridging)
Category: SwiftUI
Difficulty: Advanced
Importance: Critical
```

## How tracking works

When `body` runs, SwiftUI records **which observable properties were read**. That set is the dependency list. A write to an unread property does not invalidate this view.

```text
body evaluation
    reads player.title     → subscribe to title
    does not read .volume  → volume changes will not refresh this view
```

This is why Observation is faster than `objectWillChange` blasting every view.

### `withObservationTracking`

Low-level: run a closure, get a callback on the next change. Easy to get wrong (must re-register). Prefer SwiftUI or `Observations`.

### `Observations` (Swift 6.2 / iOS 26)

```swift
let values = Observations {
    sceneModel.jsonData
}
for await value in values {
    sceneData = value
}
```

Transactional: multiple synchronous mutations coalesce until the next suspension. Closes the Combine gap for `@Observable`.

**Candidate should know:** SwiftUI already observes; `Observations` is for **non-SwiftUI** consumers (persist scene state, UIKit, background tasks). Weak-capture carefully to avoid cycles.

### MainActor and `@Observable`

UI models should be `@MainActor` (or default isolation). Background mutation of UI models is a data race. Swift 6 will complain if you hop incorrectly.

---

# SwiftUI View Lifecycle and Rendering

```text
Experience: 2–4
Experience: 4+ (identity, diffing, EquatableView)
Category: SwiftUI
Difficulty: Advanced
Importance: Critical
```

This is a **major interview topic**.

## Why views are structs

Described above. Recreate cheaply; keep state in the graph.

## Why views are recreated

Any time the parent `body` runs, it constructs new child structs. That is normal. **Creation ≠ `onAppear`.**

## View identity

SwiftUI must answer: “is this the **same** view as last time, or a **different** one?”

### Structural identity

Position in the view tree + type.

```swift
if isLoggedIn {
    HomeView()
} else {
    LoginView()
}
```

These are **different** structural identities. Switching destroys `HomeView` state.

```swift
if isLoggedIn {
    HomeView()
} else {
    HomeView()  // still two different branches — state does NOT carry across the if
}
```

Even the same type in different `if` branches is different identity.

### Explicit identity `.id()`

```swift
EditorView(document: doc)
    .id(doc.id)
```

When `doc.id` changes, SwiftUI **treats it as a new view**: state reset, `.task` cancelled and restarted, transitions may run.

**When to use:** you need a reset.  
**When not:** putting `.id(UUID())` in `body` — **resets every evaluation**. Catastrophic.

### `ForEach` identity

```swift
ForEach(items) { item in   // Item: Identifiable
    Row(item: item)
}
```

IDs must be **stable**. `ForEach(0..<n)` is OK for static ranges; `ForEach(items.indices)` is a bug if the array mutates (wrong rows keep state).

## Diffing

SwiftUI compares the new tree to the old. Same identity → **update** the existing rendered view (text, frame). Different identity → **insert/remove**.

You do not control a virtual DOM; think **identity-keyed graph**.

## Equatable views

```swift
struct Row: View, Equatable {
    let text: String
    static func == (lhs: Self, rhs: Self) -> Bool { lhs.text == rhs.text }
    var body: some View { Text(text) }
}
```

`.equatable()` can skip `body` if `==`. Use when `body` is heavy and inputs are obvious. Wrong `==` skips needed updates.

## State lifetime vs view lifetime vs appear lifetime

```text
onAppear / onDisappear     → visiblity in the current hierarchy
.state storage             → tied to identity in the graph
Task from .task            → tied to identity appearance
UIViewController appear    → not 1:1 with SwiftUI onAppear (lists prefetch)
```

**List reuse:** `onAppear` may fire off-screen. Prefer `.task(id:)` with a model id. Do not start exclusive resources (camera) in `onAppear` of a list row.

## Why `body` can run many times

- State changes
- Environment changes (size class, color scheme)
- Parent invalidation
- Animations / transactions
- Accessibility / Dynamic Type

**Therefore `body` must be cheap.** No networking, no logging spam, no allocating huge images.

## Rendering vs body

`body` returning a description is not the same as pixels. SwiftUI may skip rendering if nothing visual changed. Instruments: SwiftUI template, “body count”.

## Common performance problems

- `VStack` of 10,000 rows
- `AnyView` erasing identity
- `.id(UUID())`
- Heavy work in `body`
- `onAppear` fetch without debounce / without identity
- Images decoded at full camera resolution
- Observing a whole `ObservableObject` that publishes every keystroke to the entire screen tree

## ASCII: update cycle

```text
Event (tap, network, timer)
   │
   ▼
State / Observable mutation
   │
   ▼
Invalidate dependent views
   │
   ▼
Recreate view structs, evaluate body
   │
   ▼
Diff by identity
   │
   ▼
Update render nodes / layout
   │
   ▼
Commit to screen
```

---

# SwiftUI Navigation

```text
Experience: 0–2 (NavigationLink)
Experience: 2–4 (path, typed destinations)
Experience: 4+ (deep links, restoration, split views)
Category: SwiftUI
Difficulty: Intermediate
Importance: High
```

## Legacy → modern

```text
NavigationView { NavigationLink(destination:) }
        ↓
NavigationStack { NavigationLink(value:) + navigationDestination }
        ↓
Why: stack is a data structure you can inspect, mutate, restore, deep-link
```

**Do not** start new projects with `NavigationView`.

## Typed navigation example

```swift
NavigationStack {
    List(products) { product in
        NavigationLink(value: product) {
            ProductRow(product: product)
        }
    }
    .navigationDestination(for: Product.self) { product in
        ProductDetailView(product: product)
    }
}
```

### Line by line

```text
NavigationStack                 → owns a stack of pushed values
List(products)                  → rows
NavigationLink(value: product)  → push this Hashable value when tapped
ProductRow                      → label
.navigationDestination(for:)    → how to build a view for Product
ProductDetailView               → destination
```

`Product` must be `Hashable` (and typically `Identifiable`).

## `NavigationPath`

```swift
@State private var path = NavigationPath()

NavigationStack(path: $path) {
    RootView()
        .navigationDestination(for: Product.self) { ProductDetailView(product: $0) }
        .navigationDestination(for: UserID.self) { ProfileView(id: $0) }
}

path.append(product)
path.removeLast()
```

Heterogeneous stack. For restoration, prefer a **typed** `[Route]` enum:

```swift
enum Route: Hashable {
    case product(Product)
    case settings
}

NavigationStack(path: $path) { ... }
```

Codable route enums can be saved in `SceneStorage` or files.

## Programmatic navigation

Mutate `path`. Do not keep a parallel `UINavigationController` unless wrapping UIKit.

## Deep linking

Handle `onOpenURL` / `universalLink`. Parse into `Route`, assign `path`. Coordinate with tabs: select tab, then set that tab’s stack.

## `NavigationSplitView`

Sidebar + content + detail. Selection state is the source of truth, not a phone-style stack. Adapt to compact size class.

## Tabs

```swift
TabView(selection: $tab) {
    HomeView().tabItem { Label("Home", systemImage: "house") }.tag(Tab.home)
}
```

Each tab should have **its own** `NavigationStack` so stacks do not fight.

## Sheets vs push

Push: hierarchical, back button. Sheet: modal task. Do not push a login flow if a sheet/fullScreenCover is the product design — but also do not sheet 8 levels deep.

---

# Lists, Forms, Gestures, Animations

## Lists (deep)

```swift
List {
    ForEach(items) { item in
        row(item)
            .swipeActions { Button("Delete", role: .destructive) { delete(item) } }
            .onDrag { NSItemProvider(...) }
    }
    .onMove(perform: move)
    .onDelete(perform: delete)
}
```

Stable IDs. `task(id: item.id)` for per-row loads. Cancelled on reuse if identity changes.

**Slow list checklist:** images, eager stacks, identity churn, work in `body`, decoding on main, observing too much state.

## Forms

`TextField`, `Toggle`, `Picker`, `DatePicker`, `SecureField`. Bind to `@State` or observable. Validate on submit, not only on every keystroke (unless live search).

## Gestures

```swift
.gesture(DragGesture().onChanged { ... }.onEnded { ... })
.simultaneousGesture(...)
.highPriorityGesture(...)
```

`@GestureState` for transient. Gesture conflicts with `ScrollView`/`Button` — test on device.

## Animations

```swift
withAnimation(.easeInOut) {
    isExpanded.toggle()
}

.animation(.default, value: isExpanded)
.transition(.move(edge: .bottom).combined(with: .opacity))
.matchedGeometryEffect(id: heroID, in: namespace)
```

Animate **state changes**, not random `body` churn. `transaction` can disable animation. Implicit `.animation` on large subtrees can be expensive.

---

# Sheets and Presentation

```swift
.sheet(item: $selected) { item in
    Detail(item: item)
}
```

Prefer `item:` over `isPresented` when the sheet needs the model — avoids presenting with stale nil.

`presentationDetents([.medium, .large])`. Interactive dismiss vs `interactiveDismissDisabled`.

---

# Accessibility

```text
Experience: 2–4
Importance: High
```

- Dynamic Type: avoid fixed `font(.system(size: 11))` for body text
- `accessibilityLabel`, `accessibilityValue`, `accessibilityHint`
- `accessibilityElement(children: .combine)`
- Contrast, reduce motion (`@Environment(\.accessibilityReduceMotion)`)
- VoiceOver order

Interviewers at good companies ask this. Treat it as quality, not extra credit.

---

# Advanced SwiftUI

## `UIViewRepresentable` / `UIViewControllerRepresentable`

Bridge UIKit. Coordinator holds delegate. `updateUIView` must be idempotent. Do not recreate the UIView every update.

## Preference keys

Children pass data up (e.g. equal-height tabs). Easy to overuse; can cause extra layout passes.

## Anchor preferences / overlay alignment

Measure then place. Can loop if you set state in a way that changes the measurement.

## Custom layout (`Layout` protocol)

iOS 16+: `sizeThatFits`, `placeSubviews`. Powerful; test RTL.

## `Canvas` / TimelineView

Draw and tick. Games/clocks. Not for forms.

## Instruments for SwiftUI

Cause of invalidation, body counts, Core Animation commits.

---
