# Observation

You have a player model. The title field and the volume slider live in different views. A keystroke in the title should not redraw the slider. That is the promise Observation makes, and it is why Apple moved off “the whole `ObservableObject` fired `objectWillChange` again.”

When `body` runs, SwiftUI records **which observable properties were read**. That set is the dependency list. A write to an unread property does not invalidate this view.

```text
body evaluation
    reads player.title     → subscribe to title
    does not read .volume  → volume changes will not refresh this view
```

If you read `player` broadly — or log the whole object in `body` — you just subscribed to everything. Fine-grained tracking only helps if `body` is actually fine-grained.

---

## How tracking works

The instrumentation is on stored properties of an `@Observable` type. Reads during a tracking scope register. Writes notify those subscribers. SwiftUI’s `body` is such a scope. You do not register by hand for a normal screen.

### `withObservationTracking`

Low-level: run a closure, get a callback on the next change. Easy to get wrong, because you must re-register after each fire. Prefer SwiftUI, or `Observations`, unless you are writing infrastructure.

### `Observations` (Swift 6.2 / iOS 26)

```swift
let values = Observations {
    sceneModel.jsonData
}
for await value in values {
    sceneData = value
}
```

Transactional: several synchronous mutations coalesce until the next suspension. That closes the Combine gap for `@Observable` — a stream of values, not one-shot reads.

SwiftUI already observes for views. `Observations` is for **non-SwiftUI** consumers: persist scene state, drive UIKit, run a background task when a model field changes. Weak-capture carefully. A stream that strongly captures the model that also owns the task is the retain-cycle chapter wearing new syntax.

### MainActor and `@Observable`

UI models should be `@MainActor` (or whatever default isolation your module uses). Background mutation of a UI model is a data race. Swift 6 will complain if you hop incorrectly. The fix is not `@unchecked Sendable` on the model. The fix is: mutate UI state on the main actor, do CPU and I/O elsewhere, hop back with values.

---

# SwiftUI View Lifecycle and Rendering

This is a major interview topic. People who can list property wrappers still stumble here, because the question is not “what is `@State`.” It is “why did this view keep its text after I pushed and popped, and why did this other one reset?”

## Why views are structs

Described in fundamentals: recreate cheaply, keep state in the graph. A view is a description for a moment. The pixels and the `@State` boxes are not inside the struct you typed.

## Why views are recreated

Any time the parent `body` runs, it constructs new child structs. That is normal. **Creation is not `onAppear`.** If you put a side effect in `init` or in a stored property initializer, it will run more often than a UIKit `viewDidLoad`. You will think SwiftUI is broken. It is doing what structs do.

## View identity

SwiftUI has to answer: is this the **same** view as last time, or a **different** one?

### Structural identity

Position in the view tree plus type.

```swift
if isLoggedIn {
    HomeView()
} else {
    LoginView()
}
```

These are **different** structural identities. Switching destroys `HomeView` state. That is usually what you want — the login screen should not keep the home screen’s draft.

```swift
if isLoggedIn {
    HomeView()
} else {
    HomeView()  // still two different branches — state does NOT carry across the if
}
```

Even the same type in different `if` branches is different identity. People copy this pattern to “preserve” a view and then wonder why `@State` reset. The `if` is two slots. Pick one slot, and put the flag inside the view, if you need the same identity.

### Explicit identity `.id()`

```swift
EditorView(document: doc)
    .id(doc.id)
```

When `doc.id` changes, SwiftUI **treats it as a new view**: state reset, `.task` cancelled and restarted, transitions may run. Use that when you need a reset — a new document should not keep the old document’s undo stack.

Do not put `.id(UUID())` in `body`. That resets every evaluation. Catastrophic: focus lost, tasks restarted, scroll position gone, animations twitching. If you ever “fixed” a stale view with a random id, you traded a bug for a worse one.

### `ForEach` identity

```swift
ForEach(items) { item in   // Item: Identifiable
    Row(item: item)
}
```

IDs must be **stable**. `ForEach(0..<n)` is fine for a static range. `ForEach(items.indices)` is a bug if the array mutates: indices shift, the wrong rows keep `@State`, the row that was “draft for item A” is now sitting on item B. Use the model’s identity, not its current subscript.

## Diffing

SwiftUI compares the new tree to the old. Same identity → **update** the existing rendered view (text, frame). Different identity → **insert / remove**. You do not control a virtual DOM. Think of an **identity-keyed graph**. If identity is noisy, the graph thrashes. If identity is stable and you only change a string, a text node updates.

## Equatable views

```swift
struct Row: View, Equatable {
    let text: String
    static func == (lhs: Self, rhs: Self) -> Bool { lhs.text == rhs.text }
    var body: some View { Text(text) }
}
```

`.equatable()` can skip `body` if `==`. Use when `body` is heavy and the inputs are obvious. Wrong `==` skips updates you needed — a row that never reflects the new unread badge because you forgot that field. Equal views are an optimisation, not a default.

## State lifetime vs view lifetime vs appear lifetime

```text
onAppear / onDisappear     → visibility in the current hierarchy
.state storage             → tied to identity in the graph
Task from .task            → tied to identity appearance
UIViewController appear    → not 1:1 with SwiftUI onAppear (lists prefetch)
```

`List` reuse means `onAppear` may fire off-screen. Prefer `.task(id:)` with a model id. Do not start exclusive resources (camera, location, a microphone) in `onAppear` of a list row. You will have three rows “appearing” and one camera.

## Why `body` can run many times

State changes. Environment changes (size class, color scheme). Parent invalidation. Animations and transactions. Accessibility and Dynamic Type. Therefore `body` must be cheap. No networking, no logging spam, no allocating huge images. If `body` is expensive, every one of those events is a hitch.

## Rendering vs body

`body` returning a description is not the same as pixels. SwiftUI may skip rendering if nothing visual changed. Instruments has a SwiftUI template and a body-count tool. Use them before you rewrite a screen because it “feels like it draws too much.” Measure which views invalidated, then fix identity or Observation reads, not “I heard `AnyView` is bad” as a superstition — though `AnyView` is often bad.

## Common performance problems

A `VStack` of 10,000 rows. `AnyView` erasing identity. `.id(UUID())`. Heavy work in `body`. `onAppear` fetch without debounce and without identity. Images decoded at full camera resolution. Observing a whole `ObservableObject` that publishes every keystroke to the entire screen tree — the thing Observation was built to stop, if you actually read individual fields.

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

### If someone asks why a view lost its state

I walk identity, not property wrappers. Did the view leave the tree? Did an `if` branch swap? Did `.id` change? Did a `ForEach` use indices? `@State` is working. The view SwiftUI is talking to is a new one.

### If someone asks why `body` runs so often

I ask what it reads. An environment value, a parent that invalidates, an observable field that changes on a timer — any of those is enough. Then I ask whether `body` is doing work it should have moved to `.task` or a model. Running often is allowed. Being expensive is not.

---

# SwiftUI Navigation

You tap a product. You expect a detail. You also expect Back to work, a deep link from a push notification to land on that product, and the stack to restore after a process kill if the product asked for it. That is a data structure, not a pile of `NavigationLink(destination:)` views.

## Legacy → modern

```text
NavigationView { NavigationLink(destination:) }
        ↓
NavigationStack { NavigationLink(value:) + navigationDestination }
        ↓
Why: stack is a data structure you can inspect, mutate, restore, deep-link
```

Do not start new projects with `NavigationView`. It is the old container. Interviewers treat it as a signal that the candidate’s last tutorial was 2021.

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

`NavigationStack` owns a stack of pushed values. The list is rows. `NavigationLink(value:)` pushes that `Hashable` value when tapped. `ProductRow` is only the label. `.navigationDestination(for:)` is how you build a view for `Product`. `Product` must be `Hashable` (and typically `Identifiable`). The destination is data-driven. You can push the same value from a deep link without instantiating a link.

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

Codable route enums can be saved in `SceneStorage` or files. `NavigationPath` itself is flexible and awkward to persist. If the interviewer asks “how do you restore the stack,” the enum is the answer you want.

## Programmatic navigation

Mutate `path`. Do not keep a parallel `UINavigationController` unless you are wrapping UIKit and that controller is the actual stack. Two sources of truth for “what is on screen” will desync after the first deep link.

## Deep linking

Handle `onOpenURL` / universal links. Parse into `Route`, assign `path`. Coordinate with tabs: select the tab, then set that tab’s stack. A link that only appends onto whichever tab happens to be selected is how you open a product on the Settings tab.

## `NavigationSplitView`

Sidebar + content + detail. Selection state is the source of truth, not a phone-style stack. Adapt to compact size class — on iPhone this often collapses into a stack, and your selection still has to mean something. If you only tested iPad, compact will feel like a different app.

## Tabs

```swift
TabView(selection: $tab) {
    HomeView().tabItem { Label("Home", systemImage: "house") }.tag(Tab.home)
}
```

Each tab should have **its own** `NavigationStack` so stacks do not fight. One stack for the whole `TabView` is how Home’s detail survives on Search.

## Sheets vs push

Push: hierarchical, back button, the user is going deeper into the same task. Sheet: a modal task — compose, filter, login. Do not push a login flow if a sheet or `fullScreenCover` is the product design. Do not sheet eight levels deep either; that is a stack you were afraid to admit.

### If someone asks how you navigate programmatically

I hold a path in `@State` (or in an observable router the scene owns). I append a `Hashable` value. `navigationDestination(for:)` builds the screen. Deep links assign the path. I do not reach into a `NavigationLink` and tap it from code.

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

Stable IDs. `task(id: item.id)` for per-row loads. Cancelled on reuse if identity changes, which is what you want — the old row’s image fetch should not complete into the new row.

Slow list checklist: images too large, eager stacks inside the row, identity churn, work in `body`, decoding on main, observing too much state. If a list hitchs, I look at those before I look at “SwiftUI is slow.”

## Forms

`TextField`, `Toggle`, `Picker`, `DatePicker`, `SecureField`. Bind to `@State` or an observable. Validate on submit, not on every keystroke, unless the field is live search. A form that yells “invalid email” on the first character is technically correct and socially wrong.

## Gestures

```swift
.gesture(DragGesture().onChanged { ... }.onEnded { ... })
.simultaneousGesture(...)
.highPriorityGesture(...)
```

`@GestureState` for transient offsets that should die with the gesture. Gestures conflict with `ScrollView` and `Button`. Test on a device. `simultaneousGesture` versus `highPriorityGesture` is the difference between “both fire” and “this one wins.” If a row cannot scroll after you added a drag, you know which one you picked.

## Animations

```swift
withAnimation(.easeInOut) {
    isExpanded.toggle()
}

.animation(.default, value: isExpanded)
.transition(.move(edge: .bottom).combined(with: .opacity))
.matchedGeometryEffect(id: heroID, in: namespace)
```

Animate **state changes**, not random `body` churn. `transaction` can disable animation when you are applying a programmatic update that should snap. Implicit `.animation` on a large subtree is expensive: every change in that subtree tries to animate. `matchedGeometryEffect` needs stable ids in a shared `@Namespace` or the hero animation has nothing to match.

---

# Sheets and Presentation

```swift
.sheet(item: $selected) { item in
    Detail(item: item)
}
```

Prefer `item:` over `isPresented` when the sheet needs the model. `isPresented: true` plus a nullable `selected` that already flipped to `nil` is how you present with stale data, or crash on unwrap. The item is the source of truth: nil means dismissed, non-nil means this value is on screen.

`presentationDetents([.medium, .large])` for half-sheets. `interactiveDismissDisabled` when swipe-to-dismiss would lose work — match that with a confirmation, not with a sheet that traps people.

---

# Accessibility

Dynamic Type: avoid fixed `font(.system(size: 11))` for body text. A designer’s 11pt caption becomes unreadable, and you will not see it on your default settings.

`accessibilityLabel`, `accessibilityValue`, `accessibilityHint`. `accessibilityElement(children: .combine)` when a row is one thing to VoiceOver, not four. Contrast. Reduce motion via `@Environment(\.accessibilityReduceMotion)`. VoiceOver order — the order of the tree is the order a user hears.

Interviewers at good companies ask this. Treat it as quality, not extra credit. A button that only exists as an icon with no label is a shipping bug, not a backlog item.

### If someone asks how you would make a custom control accessible

I would say: it needs a role (button, adjustible, header), a label that does not include the visible word “button,” a value if it is a slider or a stepper, and it should respect Dynamic Type and reduce motion. I would not dump every modifier on it. I would run VoiceOver once, because the first time you hear your screen you find the order bugs no preview shows.

---

# Advanced SwiftUI

## `UIViewRepresentable` / `UIViewControllerRepresentable`

Bridge UIKit. The coordinator holds the delegate. `updateUIView` must be idempotent. Do not recreate the `UIView` every update — you will lose camera preview, map region, first responder. `makeUIView` is once. `updateUIView` is “SwiftUI thinks inputs changed; apply them again safely.”

## Preference keys

Children pass data up (equal-height tabs, a child’s measured width). Easy to overuse. Can cause extra layout passes. If you are ping-ponging a preference into `@State` that changes the preference, you have a loop.

## Anchor preferences / overlay alignment

Measure, then place. Same loop risk if you set state in a way that changes the measurement. Use when you must align to a child’s actual rect. Do not use it to fake a stack.

## Custom layout (`Layout` protocol)

iOS 16+: `sizeThatFits`, `placeSubviews`. Powerful. Test RTL, or your custom layout will be a one-locale toy. This is how you build a flow layout SwiftUI does not ship.

## `Canvas` / TimelineView

Draw and tick. Games, clocks, visualisers. Not for forms. A `TimelineView` that invalidates a huge hierarchy every frame will heat the phone. Keep the ticking leaf small.

## Instruments for SwiftUI

Cause of invalidation, body counts, Core Animation commits. When a screen is janky, this is the difference between guessing “maybe lazy stacks” and seeing that one observable field is invalidating the tab root. Senior interviews like that you have opened the SwiftUI instrument at least once and can say what you looked for.
