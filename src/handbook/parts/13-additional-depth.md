# Additional Depth — Combine, Testing, Accessibility, Gestures, Animations

This chapter is the worked examples the surveys pointed at and did not fully expand. Read it after the Combine, testing, and SwiftUI chapters — not instead of them. The code is the point. The sentences around it are what you would say in the room.

---

## Combine — worked examples

You still meet Combine in UIKit codebases and in `ObservableObject` screens. New one-shot networking should be `async throws`. These pipelines are for values over time.

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

`$query` is a publisher of every keystroke. `removeDuplicates` skips the ones that did not change the string. `debounce` waits until typing pauses — that is not `throttle`, which would emit on a cadence while the user is still typing. Each query becomes an inner publisher. `switchToLatest` cancels the previous search when a new one starts, which is the whole trick: a slow old response must not overwrite a newer one. `flatMap` would let them race. That race is the interview.

`replaceError(with: [])` keeps the UI alive after a single failure. In production you still log. `receive(on: main)` before you assign `results`. `sink` plus `[weak self]` because the bag lives on `self`. `eraseToAnyPublisher` hides the nested generic type at the boundary.

Skip debounce and you fire a request per keystroke — battery, rate limits, jank. Skip storing the cancellable and the subscription dies at the end of `init`.

### Example 2 — combineLatest for a valid form

```swift
Publishers.CombineLatest3($email, $password, $acceptedTerms)
    .map { email, password, terms in
        email.contains("@") && password.count >= 8 && terms
    }
    .assign(to: &$canSubmit)
```

`assign(to: &$canSubmit)` on `@Published` does not retain `self` the way the old `assign(to:on:)` did. Prefer this form. The form is valid only when all three have emitted something and the current combination passes. That is `combineLatest`, not `zip`.

### Example 3 — zip vs combineLatest

`zip` waits for all publishers to emit, then pairs first-with-first, second-with-second. `combineLatest` emits whenever any of them emits, after each has emitted at least once. `merge` interleaves values of the same type.

If you `zip` location updates with button taps, you wait for equal counts. That is almost never what a form wants. `combineLatest` is the form-validation tool. Say that with an example and the round moves on.

### Common Combine mistakes

`assign(to: \.x, on: self)` without thinking about retain. Use `assign(to: &$published)` or `sink` plus `weak`. `flatMap` for search instead of `switchToLatest`. Never storing the bag, so nothing runs. Those three cover most of the Combine questions I have sat in.

One minute in the room: Combine is a stream of values over time. I subscribe with `sink` or `assign`, keep `AnyCancellable`, and pick operators for time (`debounce`) and inner publishers (`switchToLatest`). For one-shot networking I prefer `async/await`. I keep Combine when I already have a pipeline of UI events.

---

## Testing — fuller examples

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

One test, three cases, no copy-paste. Parameterisation is why Swift Testing is worth learning even if the rest of the suite is still XCTest.

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

Prefer `async throws` in XCTest, or Swift Testing. Still recognise expectations — they are how a lot of interviewers learned, and how a lot of suites still wait.

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

Ephemeral so tests do not pollute a disk cache between runs. This is the seam when you want to exercise the real `URLSession` stack instead of a fake client. Either seam is fine. Hitting production in a unit test is not.

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

You must `await` isolated state. Do not add `nonisolated(unsafe)` to make tests easier. That is how you hide a race the test was supposed to catch.

Sleeping 0.5 seconds “to be safe” is the other classic. Await the task. Inject a fake clock. UI tests for every view-model branch will flake; unit-test the view model and UI-test login plus one happy path.

---

## Accessibility — interview depth

iOS is used with VoiceOver, Dynamic Type, Switch Control, Reduce Motion, and colour filters. Accessibility is not a polish pass. It is how many people use the product at all. Good teams also treat it as a testing surface — identifiers you can find in XCUITest.

Labels, traits, and values are the VoiceOver API. A filled heart that only exists as an image needs a name and a selected trait, or it is a mystery control.

```swift
Image(systemName: "heart.fill")
    .accessibilityLabel("Liked")
    .accessibilityAddTraits(.isSelected)
```

Decorative images get `.accessibilityHidden(true)` so VoiceOver skips them. Combining children turns a row of “Balance” and “$12.00” into one stop instead of two:

```swift
HStack {
    Text("Balance")
    Text("$12.00")
}
.accessibilityElement(children: .combine)
```

Dynamic Type: `.font(.body)` scales. `minimumScaleFactor(1)` as a strategy for body text is how you silently shrink instead of wrapping. Fixed `font(.system(size: 12))` fails interviews at accessibility-conscious companies, and it fails users on an iPhone with Large Accessibility Sizes.

Reduce Motion is an environment value. Honour it:

```swift
@Environment(\.accessibilityReduceMotion) var reduceMotion

withAnimation(reduceMotion ? nil : .spring()) {
    expanded.toggle()
}
```

Hit targets: 44 points minimum. Two tiny icon buttons eight points apart will be failed in review and in the room.

App Store review rarely rejects for this. Enterprise and government RFPs do. You also cannot UI-test what you cannot identify.

If they ask how you make a custom slider accessible: `accessibilityValue`, `accessibilityAdjustableAction`, the `.adjustable` trait, a label. “It is visual, so VoiceOver users will not use it” is how you end the round.

---

## Gestures — interview depth

```swift
.gesture(
    DragGesture()
        .onChanged { value in offset = value.translation }
        .onEnded { _ in offset = .zero }
)
```

Composition is the interview, not the drag itself. `.gesture` is the default and may lose to buttons and scrolls. `.highPriorityGesture` wins over children. `.simultaneousGesture` lets both fire. A drag on a `ScrollView` usually loses to the scroll. `simultaneousGesture` is the careful fix; a custom list or a UIKit pan is the honest one when they fight.

`@GestureState` exists because gestures cancel:

```swift
@GestureState private var drag: CGSize = .zero

.gesture(
    DragGesture().updating($drag) { value, state, _ in
        state = value.translation
    }
)
.offset(drag)
```

When the gesture ends or cancels, `drag` resets. `@State` would need a manual reset and can desync on cancel — which is exactly when the user gets a phone call mid-drag. Attach a tap to a `Button` and you will fight the button. Prefer the `Button` action. Use `onTapGesture` on things that are not controls.

---

## Animations — interview depth

```swift
withAnimation(.easeInOut(duration: 0.25)) {
    showDetails.toggle()
}
```

That animates every animatable change inside the closure. Implicit animation with a value is the form you want in new code:

```swift
.animation(.default, value: isExpanded)
```

The deprecated `.animation(.default)` attached to every change in the subtree, including a fetch completing, which is how a spinner animates for reasons nobody intended. Legacy to modern: implicit without `value`, then with `value:`, because accidental animation of data loads was a real bug.

Transitions are identity. Animation is value.

```swift
if show {
    Panel().transition(.move(edge: .bottom))
}
```

`transition` runs when the view is inserted or removed. Changing `Panel`’s text is a value change — use `animation`, not `transition`. Mixing those two words is the most common animation miss in interviews.

`matchedGeometryEffect` needs a shared `Namespace` and the same `id` on both ends. During the transition both identities participate. Different id types — `String` versus `UUID` — is the pitfall that looks like “it just did not animate.”

Transactions are how seniors turn animation off for a programmatic tab switch and leave it on for a user tap:

```swift
var t = Transaction(animation: .easeInOut)
t.disablesAnimations = reduceMotion
withTransaction(t) { tab = .settings }
```

Animating `shadow` and `blur` is more expensive than `opacity` and `offset`. Animate cheap properties. Do not animate a 200-row list’s identity.

---

## Notifications — extra

```swift
extension Notification.Name {
    static let sessionExpired = Notification.Name("sessionExpired")
}

NotificationCenter.default.post(name: .sessionExpired, object: nil)
```

Process-wide events with multiple distant listeners — logout, memory warning, a session that many screens must hear. Parent–child communication should be a callback, Observation, or the environment. Notifications are stringly typed and unordered. Combine still has `NotificationCenter.default.publisher(for:)`. Modern concurrency wraps the same thing as `NotificationCenter.default.notifications(named:)` and you `for await` it.

---

## App lifecycle extras interviewers love

State restoration: `SceneStorage`, `NSUserActivity`, SwiftUI `onContinueUserActivity`. Cold start versus a URL open: `onOpenURL` may fire after the first frame. Do not assume the root is ready; queue the route. Memory warning: `UIApplication.didReceiveMemoryWarningNotification` — drop `NSCache`, cancel prefetches. SwiftUI views do not get that automatically. If you only purge in a view’s `onDisappear`, you will jetsam with the view still on screen.

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

Login talks to `AuthClient`. On success, `session.establish(tokens:)`. Logout cancels tasks, wipes Keychain, and resets navigation paths per tab — not just `user = nil` while a tab still holds a pushed stack with the old account.

A junior will get the `if/else` login split. A mid-level will add a session object, map errors for the UI, and unlock Keychain with biometrics. A senior will talk about the race of a double tap on login, a token-refresh actor, the privacy snapshot on background, a jailbreak policy if the product requires one, and resetting analytics identity so the next user is not the last user. That last sentence is the difference between a screen and a session.
