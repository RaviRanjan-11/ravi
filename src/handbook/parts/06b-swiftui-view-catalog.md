# SwiftUI View Catalog (remaining primitives)

These show up constantly in interviews and in production chrome: toolbars, menus, empty states, adaptive controls. None of them is hard in isolation. The mistakes are using them in a layout that cannot give them space, or treating a convenience API as a full strategy.

---

## `Spacer`

You have a title on the left and an Edit button on the right. You do not want to hard-code a width. You put a `Spacer()` between them in an `HStack`. The spacer eats the leftover space along the stack’s axis and the two pieces go to the ends. That is the job.

```swift
HStack {
    Text("Inbox")
    Spacer(minLength: 8)
    Button("Edit", action: edit)
}
```

In a `VStack` it grows vertically. In an `HStack`, horizontally. Several spacers share extra space. You can get a similar push with `.frame(maxWidth: .infinity)` on one child; a spacer is the explicit version of “give me the leftover.”

The classic interview: “Why isn’t my Spacer working inside a ScrollView?” Because the `VStack` in a `ScrollView` is as tall as its content. There is no leftover. A spacer that has nothing to eat does nothing useful. People then think Spacer is broken. The stack was never constrained to the screen.

---

## `Divider`

A 1pt separator. You want visual grouping in a form or a stack without drawing your own rectangle. It is not a layout structure. It will not create columns. Color it with the foreground / background styles your OS version actually supports; fighting it with an overlay is usually a sign you wanted a custom rule.

---

## `Label`

```swift
Label("Downloads", systemImage: "arrow.down.circle")
Label {
    Text("Custom")
} icon: {
    Image("badge")
}
```

You want an icon and a title that the system can collapse. Toolbars on compact widths go icon-only. VoiceOver still has a name. An ad-hoc `HStack { Image; Text }` will not get `labelStyle` for free. Prefer `Label` for navigation chrome, tab items, and anything that might need to drop the title under space pressure.

---

## `GroupBox`

```swift
GroupBox("Account") {
    Text("Plan: Pro")
}
```

A card with a title. Settings clusters, a small bundle of related readouts. Not a list of hundreds of rows — that is a `List` or a lazy stack. If you nest GroupBoxes because you wanted padding and a background, a `ViewModifier` is probably cleaner.

---

## `Toolbar` / `ToolbarItem`

You can fake a navigation bar with an `HStack` and ignore safe area. Then collapse behaviour, iPad, and Mac all fight you.

```swift
.toolbar {
    ToolbarItem(placement: .topBarTrailing) {
        Button("Edit", action: edit)
    }
    ToolbarItem(placement: .principal) {
        Text("Inbox").font(.headline)
    }
}
```

Toolbar placements are how you get platform-correct chrome. Trailing on iPhone is not the same slot as trailing on Mac. In a sheet, `.cancellationAction` and `.confirmationAction` are the HIG-compliant Cancel and Done. Interviewers like those because they show you have shipped a modal, not just a push.

---

## `Menu`

Five toolbar buttons is a crowded bar. A `Menu` is progressive disclosure.

```swift
Menu("Sort") {
    Button("Name", action: sortName)
    Button("Date", action: sortDate)
    Menu("More") {
        Button("Reset", action: reset)
    }
}
```

Good for sort, filter, overflow. Not primary navigation — do not hide the only path to Inbox behind a menu. On iOS 15+ a `Menu` can have a primary action where supported, so a tap does the common thing and a long-press opens the rest.

---

## `contextMenu`

```swift
.contextMenu {
    Button("Copy", action: copy)
    Button("Delete", role: .destructive, action: delete)
}
```

Long-press on iPhone, right-click on Mac. Lists also have `contextMenu(forSelectionOf:)`. Do not hide the only path to delete in a context menu. Provide swipe actions or a toolbar item too. Hidden destructive actions fail accessibility review and they fail users who never long-press.

---

## `popover`

```swift
.popover(isPresented: $show) {
    FilterPanel()
        .presentationCompactAdaptation(.sheet) // iPhone often sheets
}
```

iPad and Mac have pointing UI. A popover from a filter button is the right shape there. On iPhone it often adapts to a sheet. If you designed a tiny floating panel and never tested compact, you will be surprised. `.presentationCompactAdaptation(.sheet)` makes that adaptation explicit instead of accidental.

---

## `confirmationDialog`

```swift
.confirmationDialog("Delete photo?", isPresented: $show, titleVisibility: .visible) {
    Button("Delete", role: .destructive, action: delete)
    Button("Cancel", role: .cancel) {}
}
```

This is the action-sheet analogue. Prefer it over `alert` when there are several actions (Delete / Cancel / Save a copy). An alert with four buttons is a confirmation dialog you dressed wrong. Keep Cancel with `role: .cancel` so the system can put it where the platform expects.

---

## `TabView` styles

```swift
TabView(selection: $tab) { ... }

TabView {
    Page().tabItem { Label("One", systemImage: "1.circle") }
}
.tabViewStyle(.page)
```

Selection must be `Hashable`. Each tab should own its own `NavigationStack` so stacks do not fight — you push on Home, switch to Search, come back, and Home’s stack is still there. Page style is for onboarding and galleries, not for the app’s primary information architecture. Mixing page style with tab-bar items is how you get two navigation models on one screen.

---

## `AsyncImage`

```swift
AsyncImage(url: url) { phase in
    switch phase {
    case .empty: ProgressView()
    case .success(let image): image.resizable().scaledToFill()
    case .failure: Image(systemName: "photo")
    @unknown default: EmptyView()
    }
}
```

Built-in fetch, built-in phases. Fine for a prototype, a settings icon, an unauthenticated avatar. When you need cache control, auth headers, or downsampling, write a loader. `AsyncImage` is not a CDN strategy and it will not honour your `Authorization` header.

There is still a decode cost. Clip and set a frame so you do not decode a 12 megapixel photo into a 44pt row. The catalog chapter on `Image` is the same warning; it is louder here because the URL makes people forget.

| | `Image` / `UIImage` you already have | `AsyncImage` |
| --- | --- | --- |
| Who fetches | You | The view |
| Auth headers, cookies, custom cache | Your loader | Not really |
| Phases | You invent placeholders | `.empty` / `.success` / `.failure` |
| Downsample | Your job, and it must be your job in a feed | Easy to skip — then you decode full-res into a row |
| When I pick it | Production feeds, avatars behind login, anything with a memory budget | Prototype, public URL, a settings icon |

If the interviewer asks “how do you load images in SwiftUI,” `AsyncImage` is the junior half. The senior half is: cancel on identity change, downsample off main, cap the cache, and do not put `UIImage(data:)` in `body`.

---

## `EmptyView`

A view that takes no space. Useful in `ViewBuilder` branches when one path should be nothing. It is not a visible empty state. Users who searched and got zero results need copy and an icon, not an invisible view.

```swift
ContentUnavailableView(
    "No results",
    systemImage: "magnifyingglass",
    description: Text("Try another search.")
)
```

`ContentUnavailableView` (iOS 17+) is the system empty state. Use that, or a real layout of your own. `EmptyView()` in a list row is a builder trick, not UX.

---

## `ViewThatFits`

You have a button that should be a full labelled control when there is room, and a compact menu when Dynamic Type is huge or the width is tight. `ViewThatFits` picks the first child that fits the proposal. Test large Dynamic Type or you will only ever see the first child on your phone.

This is the honest version of “adaptive UI” for a single control. It is not a replacement for size classes on a whole screen.

---

## Quick Revision — Views

Stacks layout; lists reuse; spacers need leftover space. Toolbar placements beat a fake nav bar. Menus and context menus are secondary actions — keep a visible path for anything destructive. Popovers adapt on iPhone; test compact. `AsyncImage` is a start, not an image pipeline. `EmptyView` is for the builder, `ContentUnavailableView` is for humans.
