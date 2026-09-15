# Additional Depth — Combine, Testing, Accessibility, Gestures, Animations

This chapter adds production-style examples the earlier surveys pointed to but did not fully expand. Read it after Parts V–VIII.

---

## Combine — worked examples

```text
Experience: 2–4
Category: Combine
Difficulty: Intermediate
Importance: High
```

### Example 1 — Basic search pipeline

```swift
final class SearchViewModel: ObservableObject {
    @Published var query = ""
    @Published var results: [String] = []

    private var bag = Set<AnyCancellable>()
    private let api: SearchAPI

    init(api: SearchAPI) {
        self.api = api
        $query
            .removeDuplicates()
            .debounce(for: .milliseconds(300), scheduler: RunLoop.main)
            .map { query -> AnyPublisher<[String], Never> in
                guard query.count >= 2 else {
                    return Just([]).eraseToAnyPublisher()
                }
                return api.search(query)
                    .replaceError(with: [])
                    .eraseToAnyPublisher()
            }
            .switchToLatest()
            .receive(on: DispatchQueue.main)
            .sink { [weak self] in self?.results = $0 }
            .store(in: &bag)
    }
}
```

**Line by line**

```text
$query                 → Publisher<String> from @Published
removeDuplicates       → skip identical keystrokes
debounce 300ms         → wait until typing pauses (not throttle)
map → Publisher        → each query becomes a search publisher
switchToLatest         → cancel the previous search when a new one starts
replaceError           → UI never dies on a single failure (log separately in real apps)
receive(on: main)      → UI assignment
sink + weak self       → no cycle with bag stored on self
eraseToAnyPublisher    → hide ugly nested generic types at the boundary
```

**What happens if we use `flatMap` instead of `switchToLatest`?**  
Out-of-order responses: a slow old query can overwrite a newer one. That is a classic interview trap.

**What happens if we don't `debounce`?**  
A request per keystroke. Battery, rate limits, jank.

### Example 2 — combineLatest for a valid form

```swift
Publishers.CombineLatest3($email, $password, $acceptedTerms)
    .map { email, password, terms in
        email.contains("@") && password.count >= 8 && terms
    }
    .assign(to: &$canSubmit)
```

`assign(to: &$canSubmit)` on `@Published` does not retain `self` the old `assign(to:on:)` way. Prefer this form.

### Example 3 — Interview: zip vs combineLatest

```text
zip            → waits for ALL to emit index-aligned pairs (1st with 1st)
combineLatest  → emits whenever ANY emits, after each has emitted once
merge          → interleaves values of the same type
```

If you `zip` two location updates with two button taps, you wait for equal counts. Usually wrong for UI. `combineLatest` is the form-validation tool.

### Common Combine mistakes

```text
❌ assign(to: \.x, on: self) without [unowned/weak] awareness
✅ assign(to: &$published) or sink + weak

❌ flatMap for search
✅ switchToLatest or debounce + map

❌ Never cancelling (bag not stored)
✅ Set<AnyCancellable> on the owner
```

### One-minute explanation

“Combine is a stream of values over time. I subscribe with `sink` or `assign`, keep `AnyCancellable`, and pick operators for time (`debounce`) and inner publishers (`switchToLatest`). For one-shot networking I prefer `async/await`; I keep Combine when I already have a pipeline of UI events.”

---

## Testing — fuller examples

```text
Experience: 2–4
Category: Testing
Difficulty: Intermediate
Importance: High
```

### Example 1 — Swift Testing parameterized

```swift
import Testing

struct EmailTests {
    @Test(arguments: [
        ("a@b.com", true),
        ("nope", false),
        ("", false),
    ])
    func validation(_ email: String, _ expected: Bool) {
        #expect(EmailValidator.isValid(email) == expected)
    }
}
```

### Example 2 — XCTest expectation (legacy interviews)

```swift
func testLoadSuccess() {
    let exp = expectation(description: "load")
    api.load { result in
        guard case .success = result else {
            XCTFail()
            return
        }
        exp.fulfill()
    }
    wait(for: [exp], timeout: 1)
}
```

Prefer async XCTest (`async throws`) or Swift Testing. Still recognise expectations.

### Example 3 — URLProtocol stub

```swift
final class StubURLProtocol: URLProtocol {
    static var requestHandler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = Self.requestHandler else { return }
        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}

func makeSession() -> URLSession {
    let config = URLSessionConfiguration.ephemeral
    config.protocolClasses = [StubURLProtocol.self]
    return URLSession(configuration: config)
}
```

**Why ephemeral:** no disk cache pollution between tests.

### Actor testing

```swift
actor Counter {
    private(set) var value = 0
    func inc() { value += 1 }
}

@Test func increments() async {
    let c = Counter()
    await c.inc()
    #expect(await c.value == 1)
}
```

You must `await` isolated state. Do not add `nonisolated(unsafe)` to make tests “easier.”

### Common testing mistakes

```text
❌ Hitting production APIs in unit tests
✅ Stub URLProtocol or inject a fake client

❌ Sleeping 0.5s “to be safe”
✅ await the task; inject a fake clock

❌ UI tests for every ViewModel branch
✅ Unit-test VM; UI-test login + one happy path
```

---

## Accessibility — interview depth

```text
Experience: 2–4
Category: SwiftUI
Difficulty: Intermediate
Importance: High
```

### Why it exists

iOS is used with VoiceOver, Dynamic Type, Switch Control, Reduce Motion, and colour filters. Accessibility is **not** a polish pass; it is how many people use the product at all. Good teams also treat it as a testing surface (identifiers).

### Labels vs traits vs values

```swift
Image(systemName: "heart.fill")
    .accessibilityLabel("Liked")
    .accessibilityAddTraits(.isSelected)
```

Decorative images: `.accessibilityHidden(true)` so VoiceOver skips them.

### Combine children

```swift
HStack {
    Text("Balance")
    Text("$12.00")
}
.accessibilityElement(children: .combine)
```

Otherwise VoiceOver may stop twice on one row.

### Dynamic Type

```swift
Text("Hello")
    .font(.body)          // scales
    .minimumScaleFactor(1) // don't silently shrink body text as a strategy
```

Fixed `font(.system(size: 12))` **fails** interviews at accessibility-conscious companies.

### Reduce motion

```swift
@Environment(\.accessibilityReduceMotion) var reduceMotion

withAnimation(reduceMotion ? nil : .spring()) {
    expanded.toggle()
}
```

### Hit targets

44pt minimum. Don’t put two tiny icon buttons 8pt apart.

### What happens if we don't

App Store review rarely rejects, but enterprise and government RFPs do. Also: you cannot UI-test what you cannot identify.

### Interview question

**Q: How do you make a custom slider accessible?**  
**Expected:** `accessibilityValue`, `accessibilityAdjustableAction`, traits `.adjustable`, label.  
**Wrong:** “It’s a visual control so VoiceOver users won’t use it.”

---

## Gestures — interview depth

```text
Experience: 2–4
Category: SwiftUI
Difficulty: Intermediate
Importance: Medium
```

```swift
.gesture(
    DragGesture()
        .onChanged { value in offset = value.translation }
        .onEnded { _ in offset = .zero }
)
```

### Gesture composition

| Modifier | Meaning |
| --- | --- |
| `.gesture` | Default; may lose to buttons/scrolls |
| `.highPriorityGesture` | Wins over children |
| `.simultaneousGesture` | Both can fire |

**Interview:** Drag vs ScrollView — the scroll view usually wins. Use `simultaneousGesture` carefully or a custom `List`/`UIKit` pan.

### `@GestureState`

```swift
@GestureState private var drag: CGSize = .zero

.gesture(
    DragGesture().updating($drag) { value, state, _ in
        state = value.translation
    }
)
.offset(drag)
```

When the gesture **ends or cancels**, `drag` resets. That is why it exists. `@State` would need manual reset and can desync on cancel.

### What happens if we attach a tap to a `Button`

Conflicts. Prefer `Button` action. Use `onTapGesture` on non-controls.

---

## Animations — interview depth

```text
Experience: 2–4
Category: SwiftUI
Difficulty: Intermediate
Importance: High
```

### Example 1 — Basic

```swift
withAnimation(.easeInOut(duration: 0.25)) {
    showDetails.toggle()
}
```

Animates **all** animatable changes inside the closure.

### Example 2 — Real-world: value-based implicit

```swift
.animation(.default, value: isExpanded)
```

Safer than deprecated `.animation(.default)` which attached to **all** changes in the subtree (including things you did not want animated).

**Legacy → modern:** implicit animation without `value` → with `value:` → why: accidental animation of fetches completing.

### Example 3 — Interview: identity vs value

```swift
if show {
    Panel().transition(.move(edge: .bottom))
}
```

`transition` applies when the view is **inserted/removed** (identity). Changing `Panel`’s text is a **value** change — use `animation`, not `transition`.

### `matchedGeometryEffect`

```swift
@Namespace private var ns

// in grid
Image("cover").matchedGeometryEffect(id: item.id, in: ns)

// in detail
Image("cover").matchedGeometryEffect(id: item.id, in: ns)
```

Both must share `Namespace`. During the transition both identities participate. Pitfall: different `id` types (`String` vs `UUID`).

### Transactions

```swift
var t = Transaction(animation: .easeInOut)
t.disablesAnimations = reduceMotion
withTransaction(t) { tab = .settings }
```

Seniors use transactions to **not** animate a programmatic tab switch while animating a user tap.

### Performance

Animating `shadow` and `blur` is more expensive than `opacity` and `offset`. Animate cheap properties. Don’t animate a 200-row list’s identity.

---

## Notifications — extra

```swift
extension Notification.Name {
    static let sessionExpired = Notification.Name("sessionExpired")
}

NotificationCenter.default.post(name: .sessionExpired, object: nil)
```

**When to use:** process-wide events (logout) with multiple distant listeners.  
**When not:** parent–child communication (use callbacks, Observation, environment). Notifications are stringly and unordered.

**Combine:** `NotificationCenter.default.publisher(for: .sessionExpired)`.

**Swift concurrency:** wrap in `NotificationCenter.default.notifications(named:)` `AsyncSequence` on modern OS.

---

## App lifecycle extras interviewers love

**State restoration:** `SceneStorage`, `NSUserActivity`, SwiftUI `onContinueUserActivity`.  
**Cold start vs URL open:** `onOpenURL` may fire after first frame — don’t assume the root is ready; queue the route.  
**Memory warning:** `UIApplication.didReceiveMemoryWarningNotification` — drop `NSCache`, cancel prefetches. SwiftUI views don’t get this automatically.

---

## One more architecture example — production login

```text
App
 └─ Session (@Observable, @MainActor)
      token in Keychain
      user: User?

WindowGroup {
  if session.user == nil {
    NavigationStack { LoginView() }
  } else {
    MainTabView()
  }
}
.environment(session)
```

Login calls `AuthClient`; on success `session.establish(tokens:)`. Logout: cancel tasks, wipe Keychain, reset navigation paths **per tab**.

**Junior:** if/else login.  
**Mid:** session object, error mapping, biometric unlock of Keychain.  
**Senior:** race of double-login, token refresh actor, privacy snapshot, jailbreak policy if required, analytics identity reset.

---
