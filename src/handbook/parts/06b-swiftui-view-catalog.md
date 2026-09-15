# SwiftUI View Catalog (remaining primitives)

These appear constantly in interviews and production. Each follows the same template, condensed.

---

## `Spacer`

```text
Experience: 0–2
Category: SwiftUI
Difficulty: Beginner
Importance: High
```

**What:** A flexible view that expands along the stack’s axis.  
**Why:** Push content apart without magic numbers.  
**Syntax:** `Spacer(minLength: 8)`  
**If you don’t use it:** Content hugs; you may overuse `.frame(maxWidth: .infinity)` instead (also valid).  
**Layout:** In `VStack`, grows vertically; in `HStack`, horizontally. Multiple spacers share extra space.  
**Mistake:** `Spacer` inside `ScrollView` + `VStack` often **does nothing useful** because the stack is as tall as its content — there is no leftover space.  
**Interview:** “Why isn’t my Spacer working in a ScrollView?” — because the child is allowed to be as tall as it wants.

---

## `Divider`

**What:** A 1pt separator line.  
**Why:** Visual grouping without drawing rectangles.  
**Use:** Forms, stacks.  
**Not:** As a layout structure.  
**Modifier:** `.overlay` or color via `.background` / foreground styles depending on OS.

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

**Why:** Accessibility and `labelStyle` (icon-only in toolbars on compact). Prefer over ad-hoc HStack for navigation chrome.

---

## `GroupBox`

```swift
GroupBox("Account") {
    Text("Plan: Pro")
}
```

Card with a title. Use for settings clusters. Not for lists of hundreds of rows.

---

## `Toolbar` / `ToolbarItem`

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

**Why:** Platform-correct placement (iPhone vs iPad vs macOS).  
**If you don’t:** Custom HStacks in the nav bar fight safe area and collapse behaviour.  
**Interview:** `.cancellationAction` / `.confirmationAction` in sheets for HIG-compliant Done/Cancel.

---

## `Menu`

```swift
Menu("Sort") {
    Button("Name", action: sortName)
    Button("Date", action: sortDate)
    Menu("More") {
        Button("Reset", action: reset)
    }
}
```

**Why:** Progressive disclosure; better than 5 toolbar buttons.  
**Not:** Primary navigation.  
**Primary action:** `Menu` with a primary `Button` on iOS 15+ where supported.

---

## `contextMenu`

```swift
.contextMenu {
    Button("Copy", action: copy)
    Button("Delete", role: .destructive, action: delete)
}
```

Long-press/right-click. Also `contextMenu(forSelectionOf:)` on lists. Don’t hide the only path to delete — also provide swipe/toolbar.

---

## `popover`

```swift
.popover(isPresented: $show) {
    FilterPanel()
        .presentationCompactAdaptation(.sheet) // iPhone often sheets
}
```

**Why:** iPad/mac pointing UI.  
**If you expect iPhone popover:** It may adapt to a sheet. Test both.

---

## `confirmationDialog`

```swift
.confirmationDialog("Delete photo?", isPresented: $show, titleVisibility: .visible) {
    Button("Delete", role: .destructive, action: delete)
    Button("Cancel", role: .cancel) {}
}
```

Action sheet analogue. Prefer over `alert` when there are multiple actions.

---

## `TabView` styles

```swift
TabView(selection: $tab) { ... }

TabView {
    Page().tabItem { Label("One", systemImage: "1.circle") }
}
.tabViewStyle(.page)
```

Page style for onboarding. Selection must be `Hashable`. Each tab: own `NavigationStack`.

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

**Why:** Built-in fetch.  
**When not:** Need cache control, auth headers, downsample — write a loader.  
**Performance:** Still decode cost; clip and set frame.

---

## `EmptyView`

A view that takes no space. Useful in `ViewBuilder` branches. Not a visible “empty state” UI — build a real empty state with `ContentUnavailableView` (iOS 17+).

```swift
ContentUnavailableView(
    "No results",
    systemImage: "magnifyingglass",
    description: Text("Try another search.")
)
```

---

## `ViewThatFits`

Picks the first child that fits the proposal. Adaptive buttons vs menus. Test large Dynamic Type.

---

## Quick Revision — Views

- Stacks layout; Lists reuse; Spacers need leftover space
- Toolbar placements beat fake nav bars
- Menus and context menus are secondary actions
- Popovers adapt on iPhone
- AsyncImage is a start, not a CDN strategy

---
