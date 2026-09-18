import type { PrepDay } from './types'

export const day5: PrepDay = {
  id: 'day-5',
  title: 'Day 5 — Architecture',
  kicker: 'Change without a rewrite',
  intro:
    'Somebody already shipped eighty screens, and the view controllers are three thousand lines long. Today is not “name MVVM.” It is how you cut a seam, move checkout in six weeks, and stop before Clean Architecture — or twenty SPM packages, or a feature-flag SDK in every view model — becomes the product.',
  problems: [
    {
      id: 'd5-p1',
      title: '80 screens, 3 000-line view controllers',
      difficulty: 'Expert',
      kind: 'Architecture',
      prompt: `You inherit an iOS app with about 80 screens. Most \`UIViewController\`s are 2 000–4 000 lines. Networking, mapping, navigation, analytics, and UI state live in the VC. Product wants a new checkout in six weeks. Leadership will not freeze feature work for a rewrite. The last architect left a slide titled "Clean Architecture Q3."

How do you refactor without rewriting the application? What do you extract first, and what do you leave alone? When is a new architecture overengineering? What does week one actually look like in git?`,
      think: [
        'What is actually blocking the checkout feature — the other 70 screens, or the lack of a boundary around payment, session, and price?',
        'Can you change one vertical without boiling the ocean?',
        'Where does navigation currently live, and who owns the back stack when checkout is presented from a tab and from a deep link?',
        'What would make the next screen cheaper to test on Friday of week two, not after the rewrite?',
      ],
      solution: `Do not announce Clean Architecture Week. Ship checkout as a **strangler feature**.

1. **Draw the current flow for checkout only.** Screens, API calls, session, payment SDK, coupons, analytics events. Ignore the other 70 screens. If you cannot draw it, you are not ready to extract it.
2. **Put a boundary at the feature edge**, not a company-wide framework. A \`Checkout\` folder (a module later, if compile times or teams demand it) with:
   - API types and a \`CheckoutClient\` protocol
   - A store / use cases for price, address, pay
   - UI that talks only to that store
3. **Leave UIKit VCs as adapters at first.** A 3 000-line VC becomes a view that binds to a new type. You delete lines when they stop being called, not on day one. Strangler means old and new run side by side.
4. **Invert networking for this feature.** The VC must not \`URLSession.shared\` itself. Inject the client so tests do not hit staging. Composition root: wherever checkout is created (tab coordinator, scene delegate, a \`CheckoutFactory\`) — not inside the VC.
5. **Navigation:** a small \`CheckoutRouter\` owned by the feature, called from the existing tab. Do not rewrite the app delegate. Do not introduce a 40-node coordinator tree to land a web-checkout replacement.
6. **Team rule:** new code in checkout follows the boundary. Old screens stay messy until they are touched. PRs that reach into \`AppManager.shared\` from checkout are rejected.

Week one in git: the protocol, a fake, one store test for "empty cart," and the first screen talking to the store. Not a DesignSystem rewrite. Not TCA. Not 80 SPM packages.

Overengineering: Rx / TCA / micro-modules for all 80 screens before checkout ships. A "BaseViewController" that grows. A shared architecture repo the feature team must wait on.`,
      explanation: `Six weeks is not a philosophy. It is a calendar. The 3 000-line view controller is a gravity well: networking and navigation landed there because it was the only type that lived as long as the screen. MVC is not the villain. Missing boundaries are. You could rename every file to \`CheckoutViewModel\` tomorrow and still be stuck, because construction still happens inside the well — \`URLSession.shared\`, \`UserDefaults\`, the payment SDK, a push onto \`self.navigationController\`.

Strangler is how you change a system that must keep earning money. You build the new checkout beside the old one, you route a slice of traffic (a feature flag, a new entry point, a new tab child) into the new boundary, and you let the old VC starve. The first extraction is not "the presentation layer." It is the thing checkout cannot fake in a test today: the client, the session token, the price calculation. Once those sit behind protocols owned by the feature, the VC can stay ugly for a while. Ugly and testable at the edge beats a beautiful rewrite that misses the App Store freeze.

MVVM, Clean, VIPER are names for the same move: UI depends inward on abstractions; infrastructure implements them. You apply that move to the feature that is changing. SOLID shows up without the poster: the VC should not construct the payment SDK; a factory at the composition root should. The open/closed instinct shows up in problem 7 when Apple Pay arrives. You do not need all five letters to start.

The overengineering tell in the interview is a candidate who needs two sprints of "foundation" before a screen can display a price. Foundation is the fake client and the store. The slide titled Q3 is how the last architect missed Christmas. Incremental migration is the senior answer because rewrites copy the old bugs into a new folder and still miss the release. You leave 70 screens alone on purpose. That is discipline, not fear.`,
      internals: `\`\`\`text
AppDelegate / TabBar          (untouched)
        │
   CheckoutRouter  ── pushes UIKit or SwiftUI
        │
   CheckoutStore   ── @MainActor state
        │
   CheckoutClient  «protocol»
        │
   LiveURLSession / Fake
\`\`\`

Dependencies point **in**. The store does not import UIKit. The live client does not import SwiftUI. The router may import UIKit because it is an adapter; the store still must not.

The existing 3 000-line VC is, for a while, another adapter: it constructs less and less, and forwards actions to the store. When a method's only remaining job is \`store.didTapPay()\`, you delete the method. Git history will look boring. That is the point.

Feature flags live at the composition root ("this tab child is \`LegacyCheckoutVC\` or \`CheckoutFactory.make()\`"), not as \`if flag\` sprinkled through payment signing. Flags in the bowels of a VC become a second well.`,
      testing: `\`CheckoutStore\` tests with a fake client: empty cart, 402, 3DS interrupt, success, cancellation mid-pay. These tests do not boot a window. They are the proof the boundary exists.

One UI test for the happy path if the payment SDK has a sandbox, run nightly, not on every PR if it is slow. Do not wait for 80-screen snapshot tests. Do not block checkout on a new snapshot farm.

A characterisation test around the legacy VC is optional and often a trap — you spend the week recording undocumented behaviour. Prefer tests on the new store, and a manual matrix for the flag flip.`,
      pitfalls: `A \`BaseViewController\` that accumulates "shared" payment and analytics helpers. Checkout still talking to \`AppManager.shared\` — you inverted nothing. Extracting 40 protocols on week one (problem 8). Rewriting navigation for the whole app because checkout needs one extra push. Introducing a design-system package as a prerequisite for a price label.

Calling the folder \`CleanArchitecture\` and putting entities, use cases, and interface adapters in nested directories before you have a second caller. The directory tree is not the boundary. The fake in the test is.`,
      alternatives: `VIPER if the team already speaks it and checkout can look like a VIPER stack without a training course. TCA if two people are fluent and the rest will not mutiny — still only for checkout, not for the settings web view. Modular SPM packages when two teams collide on checkout or CI is 28 minutes (problem 3). All of these can wait until the client protocol exists.

A hosted web checkout in a web view in six weeks is a valid product answer if the native SDK work is the actual risk. Architecture should admit that.`,
      tradeoffs: `Strangler is slower than a greenfield demo and faster than a rewrite. Testability appears first on the new feature; the rest of the app stays untested. That is honest. A big-bang Clean Architecture diagram looks senior on a slide and junior in git blame.

Leaving 70 screens messy has a cost: engineers will copy the well, not the checkout boundary, unless review enforces the rule. The PR template is part of the architecture. So is saying no to "while we're here" refactors of Profile.`,
      followups: [
        {
          q: 'Where is the composition root?',
          a: 'Wherever the feature is created — scene delegate, tab coordinator, or a CheckoutFactory. Not inside the VC. Tests use the same factory with fakes.',
        },
        {
          q: 'How do you stop the next VC from becoming 3 000 lines?',
          a: 'PR rule: no URLSession, no UserDefaults, no analytics SDK in UI. Reviewers enforce the boundary more than the UML. Checkout is the example, not the exception.',
        },
        {
          q: 'Would you introduce coordinators app-wide?',
          a: 'Only if navigation is the actual pain. Many apps need a client protocol more than a coordinator hierarchy. Checkout can have a router without renaming the app.',
        },
        {
          q: 'How do modules enter this story?',
          a: 'When two teams ship on different cadences or compile times hurt. A folder is a module until linking proves otherwise. See problem 3.',
        },
        {
          q: 'What if leadership asks for the Clean Architecture slide?',
          a: 'Show the CheckoutClient protocol, the fake, and the store tests. That is the architecture. Offer to draw it as concentric circles if they need the picture. Do not start the Q3 rewrite to satisfy the picture.',
        },
        {
          q: 'When would you actually rewrite?',
          a: 'When the runtime cannot take another SDK, the language version is stuck, or the binary is failing size/crash budgets that incremental work cannot touch. Six weeks for checkout is not that moment.',
        },
      ],
      teaches: [
        'Strangler migration over rewrites',
        'Feature-edge boundaries',
        'Composition root versus the VC as factory',
        'UI depends inward; infrastructure implements',
        'Leave untouched screens messy on purpose',
        'When architecture is overkill for the calendar',
      ],
    },
    {
      id: 'd5-p2',
      title: 'ViewModels that new up URLSession',
      difficulty: 'Senior',
      kind: 'Review',
      prompt: `Code review. Testing is "hard." The author says this is MVVM because the view is a SwiftUI \`View\` and the logic is in a class named \`ProfileVM\`.

\`\`\`swift
@MainActor
final class ProfileVM: ObservableObject {
    @Published var user: User?

    func load() async {
        let url = URL(string: "https://api.example.com/me")!
        var req = URLRequest(url: url)
        req.setValue(
            "Bearer \\(UserDefaults.standard.string(forKey: "token")!)",
            forHTTPHeaderField: "Authorization"
        )
        let (data, _) = try await URLSession.shared.data(for: req)
        user = try JSONDecoder().decode(User.self, from: data)
    }
}
\`\`\`

Identify the architectural problems. Refactor so a unit test can force 401, 200, and a decode error without hitting the network. Call out the security issue sitting next to the testability issue. Where does mapping live, and what does the VM still own?`,
      think: [
        'Who owns URL construction, auth, decoding, and failure mapping?',
        'What is the hidden singleton graph (session, defaults, decoder)?',
        'What would a fake need to replace so the VM never mentions HTTP?',
        'Is a nil token a crash, a logout, or a silent empty screen?',
      ],
      solution: `The VM is a composition root, a keychain, a parser, and a crash on missing token. Split construction from behaviour.

\`\`\`swift
protocol TokenStore: Sendable {
    func accessToken() async throws -> String
}

protocol ProfileLoading: Sendable {
    func me() async throws -> User
}

@MainActor
final class ProfileVM: ObservableObject {
    enum State { case idle, loading, ready(User), failed(Error) }
    @Published var state: State = .idle
    private let loader: ProfileLoading

    init(loader: ProfileLoading) { self.loader = loader }

    func load() async {
        state = .loading
        do { state = .ready(try await loader.me()) }
        catch is CancellationError { state = .idle }
        catch { state = .failed(error) }
    }
}
\`\`\`

The live loader uses the app's \`HTTPClient\` (a protocol around data(for:), not URLSession as a type the VM sees). Token comes from Keychain, not UserDefaults. Missing token is an error the loader throws, which the VM maps to \`failed\` or to a logout event — not \`!\`.

Tests inject \`StubProfileLoader(result: .success(user) / .status401 / .invalidJSON)\`. The VM test never sets a URL.

Mapping JSON → \`User\` lives in the live loader or a decoder helper. The VM stores a \`User\`, not \`Data\`. URL construction lives with the client. Auth headers live in an interceptor (Day 6), not copy-pasted in every VM.`,
      explanation: `The author did move the code out of the view. That is not nothing, and it is not architecture. The view model still *constructs the world*: a concrete session, a process-wide defaults database, a URL string, a decoder, a force-unwrap. A unit test that wants a 401 has to intercept the network stack or hit staging. That is why testing is "hard." It is not hard. There is no seam.

Dependency inversion is about **who new-s up the concrete type**, not about the keyword \`protocol\`. You can write \`protocol ProfileLoading\` and still \`init() { self.loader = LiveProfileLoader() }\` inside the VM, and you have a protocol-shaped lie. The test has to use the live loader. Construction belongs at the composition root — the place that already knew it was building Profile (problem 1's factory). The VM receives an existential or a generic and does not know HTTP existed.

UserDefaults for a bearer token is a security defect sitting next to the testability defect. Seniors mention both in the same breath, because they come from the same instinct: grab the convenient singleton. Defaults is a plist, often backed up, not encrypted like Keychain. The force-unwrap on a missing token is a crash on logout races. The ignored \`URLResponse\` is a 401 treated as a decode error, which is how you ship a "data was corrupt" banner instead of a login screen.

The enum \`State\` is the other half of the review (problem 9 will labour this). \`user: User?\` plus implicit loading is how you flash an empty profile and then a user, or keep showing the last user after a failure. Architecture is also the shape of the state you publish, not only the types you inject.`,
      internals: `\`URLSession.shared\` and \`UserDefaults.standard\` are process-wide. Tests that mutate defaults become order-dependent. Parallel tests flake. A protocol with a single method is enough; you do not need a mock-codegen empire or a protocol per DTO.

The live loader is an adapter: it knows URLs, status codes, and \`JSONDecoder\`. It maps 401 to a domain error the rest of the app understands. The VM maps domain errors to \`State\`. If you skip the loader and put status-code switches in the VM, every VM reimplements HTTP.

\`@MainActor\` on the VM is correct for published UI state. The loader should be \`Sendable\` and not hop to main until the VM assigns \`state\`. Decoding on the cooperative thread the task is on is fine; huge payloads can be decoded off main in the loader, then the \`User\` value crosses back.

Force-unwrap of URL(string:) with a literal is a style crime; force-unwrap of the token is a production crash.`,
      testing: `Three VM tests, fake loader, no network:

* success → \`state\` is \`.ready\` with the user
* 401 → \`.failed\` with that error (or a logout callback fired once)
* invalid JSON → \`.failed\` decode
* cancellation: start \`load()\`, cancel the task, assert you did not assign \`.ready\` from a late result (Day 2)

The stub records \`me()\` call count so a double \`onAppear\` is visible.

A separate test suite for the live loader uses \`URLProtocol\` or a fake \`HTTPClient\` to assert headers and mapping. That is not a VM test. Do not conflate them or you will be back to "testing is hard."`,
      pitfalls: `A protocol for every DTO (\`UserFetching\`, \`UserDecoding\`, \`UserMapping\`). \`open class ProfileVM\` for OCMock. A default \`init()\` that still uses live session "for convenience" — SwiftUI previews call it, tests call it, production call sites forget to inject. Hitting staging in CI because that default exists.

Swizzling \`URLSession\` in the VM test. You proved you can swizzle, not that the VM has a boundary.

Storing the token in memory on the VM after reading UserDefaults once, then never rotating it — Day 6 will eat you.`,
      alternatives: `Generic \`ProfileVM<L: ProfileLoading>\` without an existential, if you dislike \`any\`. TCA reducer with a \`DependencyValues\` client — same injection, different vocabulary. An actor \`ProfileStore\` instead of a VM if the screen is SwiftUI and the actor publishes through Observation.

URLProtocol-level fakes are right for the HTTP client tests and wrong as the only seam; the VM should not know HTTP existed.`,
      tradeoffs: `One extra type per feature. Worth it the first time you assert 401. Not worth a 12-protocol "repository stack" for a settings toggle that reads a bool.

Keychain is more code than UserDefaults (accessibility, migration, access groups — Day 7). For a bearer token you pay it. For "last selected tab" you do not.

An enum \`State\` makes the UI slightly more switchy and removes the impossible "loading and ready and failed" combination. That is the correct direction on a profile load.`,
      followups: [
        {
          q: 'Why not mock URLSession with URLProtocol in the VM test?',
          a: 'Good for HTTP client tests. The VM should not know HTTP existed. A 401 fixture at the loader is one line; a URLProtocol is a harness.',
        },
        {
          q: 'Where does mapping JSON → User live?',
          a: 'In the live loader or a decoder helper. The VM stores a User, not Data, not [String: Any].',
        },
        {
          q: 'Is ProfileLoading a repository?',
          a: 'It is a port. If it stays one method, it is a client. If it grows UI strings and analytics, it has become a second VM (problem 6).',
        },
        {
          q: 'How do previews work without UserDefaults?',
          a: 'Preview uses StubProfileLoader.success(User.preview). The preview is a composition root. If the preview calls ProfileVM() with a live default init, you will hit the network in Xcode.',
        },
        {
          q: 'Bearer in UserDefaults — what do you say in the review besides "use Keychain"?',
          a: 'Backup, Jailbreak-adjacent exposure, shared device, log leakage of defaults dumps. Also: the force unwrap. Also: no expiry. Mention the interceptor that should attach the header so VMs stop formatting Bearer strings.',
        },
      ],
      teaches: [
        'Construction is the inversion, not the protocol keyword',
        'No singletons in VMs',
        'Keychain versus UserDefaults for tokens',
        'Loader maps HTTP; VM maps domain to State',
        'Fakes, not URLProtocol, at the VM boundary',
        'Optional user is a weaker model than an enum',
      ],
    },
    {
      id: 'd5-p3',
      title: 'Feature teams cannot compile in isolation',
      difficulty: 'Senior',
      kind: 'Architecture',
      prompt: `A 40-person iOS org. Every feature target imports \`AppKitInternal\`, which imports everything. Changing a string in Payments recompiles Profile. CI is 28 minutes. Debug launches on a cold machine feel like a clean build. Two feature teams cannot merge without a weekly integration train.

Design a modularization that teams can own. Say what you would not split. How do features navigate to each other without a cycle? Where do \`User\`, networking, and the design system live? What is the difference between a compile boundary and a folder with good intentions?`,
      think: [
        'What is the compile boundary versus the runtime boundary?',
        'Who owns networking and the design system, and who is forbidden from owning User.managedObject?',
        'How do Payments and Profile navigate without importing each other?',
        'What split looks good on a graph and recreates AppKitInternal under a new name?',
      ],
      solution: `Encode the org chart in an **acyclic** target graph. The app target is allowed to know everyone. Feature targets are not allowed to know siblings.

Layers:

* **Foundation:** logging, telemetry wrappers, pure extensions. No UI. No networking.
* **DesignSystem:** UI primitives, tokens, fonts. No features, no "ProfileHeader" that imports Profile.
* **Networking:** client, auth plugin, error type. No SwiftUI.
* **FeatureAPI modules (thin):** \`ProfileRouting\`, \`PaymentsRouting\`, maybe \`Identity\` with a 5-field \`UserID\` + display name. No implementations.
* **Features:** Payments, Profile, Search — each depends on the layers above, **not on sibling features**. They depend on *API* modules of siblings if they must emit an intent.
* **App:** composition, DI graph, navigation map, actual coordinators that import everyone.

Feature-to-feature: Payments does not \`import Profile\`. It calls \`profileRouter.showProfile(id)\` where \`profileRouter\` is injected. The implementation lives in App.

Do **not** split:

* One screen into six SPM packages
* Core Data / SwiftData models into a package every feature imports (that *is* the new god module)
* A \`Shared\` dump that accepts every "maybe later" type
* Dynamic frameworks for 80 modules (launch time)

Until linking proves you need a package, a folder plus an import rule in SwiftLint / TUIST / a boundary test is a module. Promote to SPM when CI incremental compile or team ownership requires it.`,
      explanation: `Twenty-eight minutes is an architecture review, not a hardware problem. The compiler is telling you that Payments and Profile are the same target in a trench coat. \`AppKitInternal\` (or \`Common\`, or \`Core\`, or \`Shared\`) is how cycles hide: everything imports the umbrella, the umbrella imports everything, and changing a string dirties the world. Modularization is an org chart encoded in the linker. If two teams cannot ship on different cadences without a weekly train, you do not have features. You have files.

The senior move is **acyclic feature modules** plus an app target that is allowed to know everyone. That is dependency inversion at module scale. Profile does not import Payments. App wires a closure. The thin \`ProfileRouting\` module exists so Payments can name an intent without linking Profile's SwiftUI. If you skip the thin API and let Payments import Profile "just for the route enum," you will import Profile's networking next week, and the DAG is dead.

What you refuse to split matters more than what you split. A Core Data \`User\` with 80 properties in a shared models package is \`AppKitInternal\` with a nicer name: every feature recompiles when a relationship changes, and every feature can set \`user.tier\` from a cell. Duplicate a view-specific DTO, or publish a tiny \`Identity\` type, rather than sharing the graph. One screen in six packages is theatre: you will spend the compile savings on Xcode tab tax and you still cannot build Payments without the six.

A folder is a wish. A target is a boundary. Boundary tests that fail \`import Profile\` inside Payments are the enforcement; a wiki page is not. Start with folders and lint if the org is not yet in pain. You are already at 28 minutes — you are in pain. Cut Payments out first, the way checkout was the strangler in problem 1. Do not modularize 80 screens in a quarter and call it a platform investment while CI stays red.`,
      internals: `SwiftPM / Xcode target DAG. A single \`import Payments\` in Profile is a cycle if Payments imports Profile, even through a third module. The cycle often lands in \`Internal\` umbrellas that use \`@_exported import\` so nobody sees the edge.

Runtime navigation is a graph of objects; compile-time navigation is a graph of targets. They need not match. A coordinator in App can hold ProfileVC and PaymentsVC. Features emit intents: \`.didTapProfile(id)\`. Deep links are parsed in App or a Routing module that depends on API enums, not on feature UI.

Dynamic frameworks versus static libraries: many dynamic modules slow launch (dyld). Prefer static libraries / mergeable libraries as the default; measure. Tuist and Bazel enter when the graph is real and Xcode's scheme dance is the bottleneck. They will not fix a \`Shared\` dump.

Access control (\`internal\` by default, \`public\` only on the API module's surface) is the other compiler. A feature module that marks every struct \`public\` is a folder.`,
      testing: `Each feature package has unit tests that do not boot the app and do not import sibling features. CI should be able to run \`PaymentsTests\` when only Payments changed.

A boundary test or \`swift-package\` import check: Payments' sources must not contain \`import Profile\`. This is a cheaper test than hope.

Measure incremental compile: touch a string in Payments, time the rebuild. That number is the KPI, not package count. One app-level UI test suite remains; do not clone UI tests per module until a team is blocked.

Debug: \`xcodebuild\` with a focused scheme. If you cannot build Payments without compiling Profile, the graph is a lie.`,
      pitfalls: `\`Shared\` that becomes the new dump. \`Utils\`. \`Helpers\`. Dynamic frameworks for 80 modules. Exposing SwiftUI views across modules without a design system, so every button change recompiles the world anyway. Putting networking *inside* DesignSystem because a toast needed to retry.

A "mediator" module that imports all features to "decouple" them — that is App, and if features import the mediator you have a cycle with extra steps.

Making every internal type public "for tests" instead of \`@testable import\`.`,
      alternatives: `Tuist / Bazel when the graph is real and generated projects beat merge hell. Until then, SPM local packages and a ban on umbrella imports.

A single app target with SwiftLint import rules is a valid stepping stone. It does not reduce compile as much as real targets, and it does train the org. Use it for a month while you cut the first feature out.

Duplicate a 5-field \`User\` DTO across features rather than a shared models package. Heresy to DRY, hygiene to the DAG.`,
      tradeoffs: `More \`Package.swift\`, slower clean builds, faster incremental, clearer ownership. Wrong splits cost more than no splits — you will pay the package tax and still recompile the world through a models module.

Thin API modules add hop types (the routing protocol). That is ceremony, and it is cheaper than a cycle. If two features chat 40 times a second, they might be one feature.

Launch time versus compile time: do not fix 28-minute CI by shipping 80 dylibs that make cold start miss the watchdog.`,
      followups: [
        {
          q: 'How do you share User?',
          a: 'A tiny Identity module, or duplicate a view-specific DTO. Do not share the 80-property Core Data entity. Features that need more fetch through their own client.',
        },
        {
          q: 'Who owns the navigation stack?',
          a: 'App / coordinator layer. Features emit intents: .didTapProfile(id). App decides push versus present versus deep link.',
        },
        {
          q: 'What if Payments UI must embed a Profile summary view?',
          a: 'DesignSystem primitive, or App composes ProfileSummaryView into a Payments screen via a protocol returning UIViewController / AnyView. Payments does not import Profile to reuse a 400-line view.',
        },
        {
          q: 'How do you move the first module without a year of planning?',
          a: 'Strangle Payments (or checkout) into a target. Leave the umbrella for everything else. Repeat. The graph gets healthier one leaf at a time.',
        },
        {
          q: 'Internal versus public in a feature module?',
          a: 'Almost everything internal. Public only on the types App needs to construct the feature. If App needs 60 public types, your factory is in the wrong module.',
        },
      ],
      teaches: [
        'Acyclic feature DAG',
        'App is the only target that knows everyone',
        'Thin routing API modules',
        'Shared models packages recreate the god module',
        'A folder is a wish; a target is a boundary',
        'Compile time is an architecture signal',
      ],
    },
    {
      id: 'd5-p4',
      title: 'MVVM that still presents UIAlertController',
      difficulty: 'Senior',
      kind: 'Judgment',
      prompt: `The team "moved to MVVM." ViewModels own \`@Published\` properties and also present \`UIAlertController\`, push view controllers, and read \`UIDevice.current\`. A candidate says this is fine because the view is thin. The relevant sketch:

\`\`\`swift
@MainActor
final class CheckoutVM: ObservableObject {
    @Published var total: Decimal = 0
    weak var host: UIViewController?

    func payTapped() {
        if total == 0 {
            host?.present(UIAlertController(title: "Oops", message: "Cart empty", preferredStyle: .alert), animated: true)
            return
        }
        if UIDevice.current.userInterfaceIdiom == .pad {
            host?.navigationController?.pushViewController(PadPayVC(vm: self), animated: true)
        } else {
            host?.navigationController?.pushViewController(PhonePayVC(vm: self), animated: true)
        }
    }
}
\`\`\`

Do you agree? What would you change, and what would you leave in the VM? Is navigation a UI detail or app policy? What breaks in a unit test host with no window?`,
      think: [
        'What is a ViewModel responsible for if the view is already thin?',
        'Is "empty cart" an alert, a disabled button, or a published destination — and who decides the copy?',
        'What ownership graph did weak host plus push of a VC that holds the VM just create?',
        'Can this VM run in an XCTest bundle without a scene?',
      ],
      solution: `Disagree. You moved the god object one file over. The view is thin because the VM ate it.

VM **may**: transform input → view state, call injected use cases, hold the task lifecycle for the screen, decide *policy* ("pay is disabled if total is 0").

VM **must not**: import UIKit for presentation (the \`UIImage\` debate is separate and boring), present, push, pop, read \`UIScreen\` / \`UIDevice\` as a stand-in for trait collections.

\`\`\`swift
@MainActor
final class CheckoutVM: ObservableObject {
    enum Alert: Equatable { case emptyCart }
    enum Route: Equatable { case pay }

    @Published private(set) var total: Decimal = 0
    @Published private(set) var alert: Alert?
    @Published private(set) var route: Route?
    @Published private(set) var payEnabled: Bool = false

    func payTapped() {
        guard payEnabled else { alert = .emptyCart; return }
        route = .pay
    }
}

// View / coordinator
.alert(item: $vm.alert) { ... }
.onChange(of: vm.route) { router.handle($1) }
\`\`\`

Device idiom: a \`DeviceInfo\` protocol, or let the *view* choose \`PadPayView\` versus \`PhonePayView\` from \`horizontalSizeClass\`. Policy ("we support pay on iPad") can live in the VM as a flag from injected \`DeviceInfo\`. Instantiating \`PadPayVC\` must not.

Navigation: router protocol or closures owned by the coordinator / the SwiftUI view. Alerts: data. The view presents.

Leave in the VM: "disable pay if total is 0", retry policy, mapping of payment errors to \`Alert\`. Take out: UIKit objects, animation flags that exist only to call \`UIView.animate\`.`,
      explanation: `MVVM is a testability story, not a file-naming convention. If the VM cannot run in an XCTest bundle without a scene, you kept MVC and added a typing tax. The candidate is proud that the SwiftUI view is ten lines. Those ten lines are not where the bug will live. The bug will live in \`payTapped\`, which needs a window, a navigation controller, and a device idiom to do anything you can assert.

Presenting an alert from the VM also lies about ownership. \`UIAlertController\` is retained by the presenter. The VM holds \`host\` weakly to avoid a cycle, then pushes a \`PadPayVC(vm: self)\` that likely holds the VM strongly, while the VM may still be owned by the original host. You now have a navigation problem and a lifetime problem (problem 5 will make the coordinator version of this explicit). UIKit presentation is not a function of state. SwiftUI's pitch is that the view is a function of state. Side-effecting in the VM recreates the old world: order of calls matters, tests need a window, and a second caller of \`payTapped\` presents a second alert.

"Empty cart" as an alert is also product judgment leaking through UIKit. A disabled button with copy is often the right UI; an alert is what you write when the VM has no \`payEnabled\`. The VM should know the cart is empty. The view should decide whether that is opacity, an alert, or a toast. When the copy lives in the VM as \`UIAlertController(title:)\`, you cannot reuse the policy on SwiftUI and UIKit without duplicating strings, and you cannot snapshot-test the alert without presenting.

Navigation is app policy at the *intent* level ("go to pay") and a UI detail at the *mechanism* level (push, sheet, separate window on macOS). The VM emits the intent. A router picks the mechanism. That split is what lets you unit-test "pay success → route \`.receipt(id)\`" with a spy, and it is what coordinators were invented for — not a religion of classes named Coordinator.`,
      internals: `UIKit presentation retains view controllers. A VM that presents creates hidden ownership and hidden ordering (\`present\` while already presenting fails). \`weak var host\` is an admission that the VM should not have been in this graph.

Reading \`UIDevice.current\` couples tests to the simulator's idiom. CI on iPhone-only will never see \`PadPayVC\`. Size classes belong to the view environment (Day 3's trait collection), not to a singleton device.

Combine / Observation in the VM is irrelevant to whether this is MVVM. You can have a perfect \`@Published\` pipeline that still presents. The seam is what \`payTapped\` *returns or publishes*, not whether it uses Combine.

SwiftUI: if the view owns a small \`navigationDestination(item: $vm.route)\`, that is an acceptable router for a small feature. The moment \`payTapped\` needs to push from a UIKit parent and a SwiftUI child, extract the protocol.`,
      testing: `VM tests: \`total = 0\`, \`payTapped()\`, assert \`payEnabled == false\` and \`alert == .emptyCart\`, \`route == nil\`. \`total = 10\`, \`payTapped()\`, assert \`route == .pay\`. No \`waitForExistence\` of an alert. No window.

A router spy: \`route(.pay)\` was called once. DeviceInfo fake: force pad, assert the *router* chose the pad destination if that decision lives in the router, not the VM.

If you keep \`host?.present\` "temporarily," you cannot write that test. Temporary is the architecture.`,
      pitfalls: `\`protocol ViewModelDelegate: AnyObject\` that is the view controller — you renamed \`host\`. Environment objects that are the app delegate. \`UIApplication.shared.windows.first?.rootViewController?.present\` from the VM, which is the same bug without the weak property.

Putting every string in the VM "for testing" and then presenting anyway. \`@Published var shouldShowAlert = true\` *and* presenting in \`didSet\` — two channels, one of them still needs a window.

Leaving \`PadPayVC(vm: self)\` so the pay screen shares the checkout VM. Now you have a god VM across two screens, and navigation is still inside it.`,
      alternatives: `The SwiftUI view can own navigation if the feature is SwiftUI-only and small: \`navigationDestination\` bound to VM state. Extract a router when a test needs "pay success → receipt" without a window, or when UIKit and SwiftUI both present the same flow.

UIKit: a coordinator that the VC calls, not the VM. The VM tells the VC (via published route) and the VC tells the coordinator — extra hop, clear graph. Or the VM talks to a \`Routing\` protocol that the coordinator implements.`,
      tradeoffs: `Router types feel ceremonial on a two-screen app. On 80 screens they pay rent. Match the size of the pain. A published \`enum Route\` is usually enough ceremony; a protocol with 25 methods is VIPER arriving through the window.

Keeping UIDevice in the VM is faster to write and guarantees iPad is wrong in tests. Size class in the view is the correct laziness.

Alerts as data make localisation and snapshot tests easier, and they make you design the enum. That enum is a feature of the architecture, not boilerplate.`,
      followups: [
        {
          q: 'Is Combine in the VM required for MVVM?',
          a: 'No. Observation, async sequences, even callbacks can be MVVM. The seam matters. Combine is not a boundary.',
        },
        {
          q: 'May the VM import UIKit for UIImage?',
          a: 'Debatable. Prefer Image / Data at the boundary. If you import UIKit for UIImage, you still must not import it for UIViewController. Split the files if the import tempts people to present.',
        },
        {
          q: 'Who owns the back stack after route = .pay?',
          a: 'The router / navigation controller. The VM should not pop. It may publish route = nil when pay completes if the view needs to dismiss, still without calling pop itself.',
        },
        {
          q: 'Empty cart: alert versus disabled button — whose decision?',
          a: 'Product. VM publishes that pay is impossible. View (or a copy catalog) chooses the chrome. Do not bake UIAlertController into the decision.',
        },
      ],
      teaches: [
        'MVVM is a seam, not a thin view',
        'VMs publish state and intents, they do not present',
        'Navigation mechanism versus navigation intent',
        'UIDevice in a VM is untestable policy',
        'Alerts are data',
        'weak host is a smell, not a fix',
      ],
    },
    {
      id: 'd5-p5',
      title: 'Coordinator retain cycle with child VCs',
      difficulty: 'Senior',
      kind: 'Incident',
      prompt: `You introduced coordinators after problem 4. Allocations after opening and closing checkout 40 times shows 40 \`CheckoutCoordinator\` instances, 40 \`CheckoutViewController\`s, and 40 \`PaymentCoordinator\`s. The engineer says coordinators cannot leak because the navigation controller popped the VCs.

\`\`\`swift
final class AppCoordinator {
    let nav: UINavigationController
    var children: [any Coordinator] = []

    func startCheckout() {
        let child = CheckoutCoordinator(nav: nav)
        children.append(child)
        child.start()
    }
}

final class CheckoutCoordinator: Coordinator {
    let nav: UINavigationController
    var payment: PaymentCoordinator?
    var onFinish: (() -> Void)?

    func start() {
        let vc = CheckoutViewController()
        vc.router = self
        nav.pushViewController(vc, animated: true)
    }

    func pay() {
        let child = PaymentCoordinator(nav: nav)
        child.parent = self
        child.onPaid = { self.showReceipt() }
        payment = child
        child.start()
    }
}

final class CheckoutViewController: UIViewController {
    var router: CheckoutCoordinator!
}
\`\`\`

\`PaymentCoordinator.parent\` is \`CheckoutCoordinator?\`. \`CheckoutViewController.router\` is strong. \`onPaid\` captures \`self\` strongly. \`AppCoordinator.children\` never removes.

Map the graph. Fix ownership so pop deallocates. How do you prove it? When is a coordinator worth it versus the published \`Route\` enum from problem 4?`,
      think: [
        'Who owns the child coordinator after the VC is popped — the array, the parent property, the VC\'s router, the closures?',
        'Does UINavigationController still holding the VC matter if the coordinator holds the VC via the router back-edge?',
        'Where should onFinish remove the child from AppCoordinator.children?',
        'Is [weak self] on onPaid enough if children is still an array that only grows?',
      ],
      solution: `Parent coordinators own children. Children do not own parents. VCs do not own coordinators. Closures that call back to a parent capture weakly. Removing a child is part of \`start\`, not a nice-to-have.

\`\`\`swift
protocol Coordinator: AnyObject {
    var children: [any Coordinator] { get set }
    func start()
    func childDidFinish(_ child: any Coordinator)
}

extension Coordinator {
    func childDidFinish(_ child: any Coordinator) {
        children.removeAll { $0 === child }
    }
}

final class CheckoutCoordinator: Coordinator {
    private weak var nav: UINavigationController?
    var children: [any Coordinator] = []
    var onFinish: (() -> Void)?

    func start() {
        let vc = CheckoutViewController()
        vc.onPay = { [weak self] in self?.pay() }
        vc.onClose = { [weak self] in
            self?.onFinish?()
        }
        nav?.pushViewController(vc, animated: true)
    }

    func pay() {
        let child = PaymentCoordinator(nav: nav)
        child.onPaid = { [weak self] in
            self?.showReceipt()
            if let child = self?.children.last { self?.childDidFinish(child) }
        }
        children.append(child)
        child.start()
    }
}
\`\`\`

Rules:

1. **VC → coordinator is weak or is a closure with \`[weak self]\`.** A \`var router: CheckoutCoordinator!\` is a cycle if the coordinator also owns the VC (it does, through the nav stack *or* a \`rootVC\` property people add later).
2. **Child coordinator → parent is weak.** \`parent: CheckoutCoordinator?\` as a strong property is a cycle with \`children\`.
3. **AppCoordinator.children must shrink.** \`onFinish\` from checkout **must** call \`childDidFinish\`. Pop does not notify you unless you observe the nav stack or give the VC an \`onClose\`.
4. **Do not store the VC on the coordinator unless weak.** The nav stack already owns it.
5. **Prove deinit** with a test or a DEBUG print. Forty instances is the same incident as Day 1's detail screen.

A published \`Route\` on the VM plus a small router object owned by the parent VC is enough when the flow is three screens. A coordinator tree is worth it when flows are entered from many places and you keep leaking otherwise — not because a blog post said so.`,
      explanation: `The engineer looked at the navigation controller. ARC did not. Popping a view controller releases the view controller *if nothing else holds it*. The coordinator still sits in \`AppCoordinator.children\`. The view controller still holds the coordinator through \`router\`. The coordinator's \`onPaid\` closure, if it captured the checkout coordinator strongly and is stored on a child that is stored on the parent, is another edge. You built a retain cycle in the shape of an architecture diagram, which is a cruel joke if you have already done Day 1.

Coordinators exist to take navigation out of VMs and VCs. They become a second gravity well because they are long-lived objects that *want* to hold children, VCs, closures, and the nav controller. The ownership rule is the same as a view hierarchy: **downward strong, upward weak**. App owns checkout coordinator. Checkout owns payment coordinator. Payment does not own checkout. The VC does not own anyone above it; it sends messages up through weak delegates or weak closures. The nav controller owns the VCs. The coordinator does not also own the VCs unless you like cycles.

The leak that survives every weak-self audit is the **children array that only appends**. You can get every capture list right and still keep 40 coordinators because nobody called \`childDidFinish\`. Pop is not a destructor for your architecture objects. You have to observe finish: a close button, a nav delegate \`didShow\`, a Combine sink on the stack count. That is real work. If you are not willing to do it, do not introduce coordinators — use a \`Route\` enum and let SwiftUI / the existing nav VC own the stack, which already pops and deallocates (when you have not created Day 1 cycles).

This incident is how you defend coordinators in an interview without sounding religious. You describe the graph, you put deinit on the table, and you say when you would not use them: a three-screen flow with a published route. Architecture that leaks is not architecture.`,
      internals: `\`\`\`text
AppCoordinator ──strong──► children[CheckoutCoordinator]
CheckoutCoordinator ──strong──► CheckoutVC.router ──strong──► CheckoutCoordinator
CheckoutCoordinator ──strong──► payment ──strong──► parent ──strong──► CheckoutCoordinator
CheckoutCoordinator ──strong──► onPaid closure ──strong──► CheckoutCoordinator
NavC ──strong──► CheckoutVC
\`\`\`

Even after pop, if \`router\` and \`children\` remain, the VC may still be alive (router edge) and the coordinator is definitely alive (children edge). Memory Graph will show the cluster. \`unowned\` on \`onPaid\` will crash when payment outlives checkout — possible if you dismiss out of order. Weak is correct.

UINavigationController retains its stack. A coordinator retaining \`nav\` strongly is usually fine (the window owns the nav). A coordinator retaining \`nav.viewControllers\` copies or the current VC is the bug.

\`childDidFinish\` must compare identity (\`===\`) for class coordinators. Equatable coordinators are a foot-gun.`,
      testing: `Push checkout, pop, assert \`deinit\` of \`CheckoutCoordinator\` and \`CheckoutViewController\` (a test double with a flag, or \`addTeardownBlock\`). Repeat 10 times, Memory Graph empty.

Payment flow: start pay, finish pay, assert \`PaymentCoordinator\` gone and \`children\` count back to 0. Cancel pay: same.

A unit test that \`startCheckout\` twice without finish grows \`children\` to 2 — that is the bug as a test, then you decide whether two checkouts are allowed.

Do not trust "it disappeared from the screen." Allocations persistent growth after a repeat loop is the proof.`,
      pitfalls: `\`unowned self\` in \`onPaid\` because it is shorter. Storing \`[Coordinator]\` as values if they are classes anyway. A base \`Coordinator\` class that retains \`rootViewController\` strongly *and* sets itself as the VC's router. Nav delegate on the coordinator that points back without \`weak\`.

Finishing the child only on success, so cancel leaks. Starting a new \`PaymentCoordinator\` without finishing the old one, so pay-twice leaks even if the array "works."

Using coordinators in SwiftUI by wrapping every \`NavigationStack\` in a class that also holds \`path\` and the views. You can, and you can leak the same way. SwiftUI path as source of truth is usually enough.`,
      alternatives: `Published \`Route\` / \`NavigationPath\` owned by a parent VM, no coordinator types (problem 4's solution). The composition root still exists; it is a factory.

A router protocol implemented by the parent VC, weak. Smaller than a coordinator tree. Good for one feature.

The Flow Controller pattern (a VC that *is* the container) if the team thinks in UIKit containment. Appearance forwarding becomes Day 3 problem 5; ownership is the VC hierarchy, which UIKit already pops.`,
      tradeoffs: `Coordinators centralise navigation and cost you an ownership protocol you will get wrong once per year. Worth it when the same flow starts from tabs, deep links, and push notifications, and VCs were presenting each other until the stack was soup. Not worth it to replace three \`pushViewController\` calls.

Weak everywhere is noisy. A single documented rule (down strong, up weak, finish removes child) is better than decorating every line. Tests for deinit are part of the cost; without them you will ship the 40-instance version.`,
      followups: [
        {
          q: 'Should the coordinator be the MKMapView delegate too?',
          a: 'No. That is a different object (Day 3 representable coordinator). Navigation coordinators that become god objects are VCs with a new name.',
        },
        {
          q: 'Who owns URLSession in this graph?',
          a: 'Still not the coordinator. Inject the client into the VM. Coordinators that fire network calls are problem 6 in a hat.',
        },
        {
          q: 'How do deep links start a child without leaking if the user is already in checkout?',
          a: 'Finish or reuse the existing child. Two CheckoutCoordinators on the same nav is how you get two VCs and a leak. AppCoordinator should know if checkout is already a child.',
        },
        {
          q: 'SwiftUI NavigationStack path versus coordinator?',
          a: 'Path is a value; it deallocates with the view identity. Prefer it for SwiftUI-first flows. Use a coordinator at the UIKit boundary when you must push UIKit VCs from App.',
        },
        {
          q: 'Can childDidFinish be based on pop detection only?',
          a: 'Nav delegate didShow can detect pop and finish. It is fragile with interactive pop cancelled. Prefer explicit onClose from the VC plus a safety net on didShow.',
        },
      ],
      teaches: [
        'Downward strong, upward weak',
        'children arrays must shrink',
        'VCs do not own coordinators',
        'Pop is not deinit for architecture objects',
        'Prove coordinator lifetime with Memory Graph',
        'Coordinators are optional for small Route enums',
      ],
    },
    {
      id: 'd5-p6',
      title: 'Repository that is actually a second view model',
      difficulty: 'Senior',
      kind: 'Review',
      prompt: `A PR titled "extract CheckoutRepository for testability" adds a 1 200-line class. Excerpt:

\`\`\`swift
final class CheckoutRepository {
    var onShowError: ((String) -> Void)?
    func loadCart() async {
        Analytics.log("cart_opened")
        do {
            let dto = try await URLSession.shared.data(from: url)
            let cart = try JSONDecoder().decode(CartDTO.self, from: dto.0)
            self.displayTitle = cart.items.isEmpty ? "Your bag is empty" : "Ready to checkout"
            self.payButtonTitle = Locale.current.region == "IN" ? "Pay with UPI" : "Pay"
            self.lines = cart.items.map { "\\($0.name) × \\($0.qty)" }
        } catch {
            onShowError?("Something went wrong. Try again.")
            Analytics.log("cart_failed")
        }
    }
}
\`\`\`

The VM now calls \`repository.loadCart()\` and binds labels. The author says this is Clean Architecture.

What is a repository for? What should this type be split into? Which lines are UI, which are analytics, which are HTTP, which are domain? How would you review the PR in four comments without rewriting it for them?`,
      think: [
        'If you deleted the VM, would this class still make sense in a command-line test?',
        'Who owns the strings — localisation, the view, or the domain?',
        'Is Analytics a side effect of load, of a successful load, or of the screen appearing?',
        'What would a fake repository need to provide for a VM test, and what extra would it be forced to stub because of this design?',
      ],
      solution: `A repository (or client) loads and stores **domain data**. It does not decide button titles. It does not speak English. It does not log screen analytics. This class is a second view model with a more respectable name.

Split:

* **CheckoutClient / CartRepository:** \`func cart() async throws -> Cart\`. Returns a \`Cart\` (items, money, currency). Throws domain errors. No UIKit, no strings, no analytics. This is the type you fake in tests.
* **CheckoutStore / VM:** maps \`Cart\` to \`displayTitle\`, \`payButtonTitle\`, line view models. Holds \`State\`. Decides what "empty" looks like.
* **Analytics:** called from the store/VM on transitions (\`state\` became \`.ready\` / \`.failed\`), or from the view on appear — pick one, not inside the client. The client should not know the screen opened.
* **HTTP:** inside the live client, or an \`HTTPClient\` it uses. Not \`URLSession.shared\` copied from problem 2.

Four PR comments:

1. "This type cannot be reused from a widget or a price-calculation test without dragging UI copy. Please return \`Cart\` and let the VM format."
2. "\`onShowError: (String) -> Void\` is presentation. Throw, or return \`Result\`. The VM maps to \`Alert\`."
3. "Analytics in the repository will double-count when a retry calls \`loadCart\` again, and will miss when the VM loads from cache. Move events to state transitions."
4. "Locale-based pay button is product policy. It belongs next to other presentation policy, and it will be wrong the moment you add Apple Pay on the same device (problem 7)."

Do not demand 1 200 lines become 12 files in the same PR if the author is learning. Demand the client return \`Cart\` and the strings move. That is the seam.`,
      explanation: `Clean Architecture posters put a circle labelled Repository and people stuff the leftovers into it. The leftovers here are the view model. You can hear it in the property names: \`displayTitle\`, \`payButtonTitle\`, \`lines\` as preformatted strings. A repository that knows the bag is empty in English is a view. A repository that knows UPI is a localisation function. A repository that logs \`cart_opened\` is a screen.

The point of extracting a repository is so the VM can be tested with a fake cart, and so the live adapter can be tested with a fake HTTP client. If the fake repository has to supply button titles and fire \`onShowError\` with localised strings, you did not invert a dependency. You split a class in half and left both halves coupled to the same ideas. The VM is now a pass-through, which is how people conclude "MVVM is pointless." They are looking at a pass-through and a god object wearing two hats.

Analytics inside \`loadCart\` is a subtle product bug, not only a layering nit. Load is not appear. Load retries. Load hits cache. You will report \`cart_opened\` three times or zero, and Growth will start another incident like Day 3's double \`viewDidAppear\`. Side effects that describe *user-visible moments* belong next to state transitions the VM already owns. Side effects that describe *transport* (HTTP 500 rate) belong in the client. Mixing them is how dashboards lie.

Review tone matters in this problem. A 1 200-line extract was probably painful work. You do not humiliate it. You name the four kinds of lines (HTTP, domain, presentation, analytics) and you ask for one type that only does the first two. That is a senior review. Rewriting the PR in a drive-by with TCA is a different failure mode — problem 10.`,
      internals: `In the poster version: Enterprise business rules (Cart, Money) do not import UI. Application rules (CheckoutStore) depend on a protocol the repository implements. Interface adapters (live client, VM) face outward. Frameworks (URLSession, SwiftUI) sit at the edge.

In this PR: the "repository" imports Foundation, implicitly the locale, analytics, and presentation. The dependency arrow points at UIKit's brain even if it does not \`import UIKit\`. Strings are UI.

\`onShowError\` is a callback-shaped view. It will grow \`onShowSpinner\`, \`onUpdateButton\`. That is MVC's view controller, extracted. Prefer published state or throwing functions.

1 200 lines is also a clue about cohesion. A type that needs that much space is several types. Split by reason to change: HTTP mapping changes when the API changes; button copy changes when Product changes; analytics names change when Growth changes. Those reasons should not share a file.`,
      testing: `After a real split: fake client returns an empty \`Cart\`; VM test asserts \`displayTitle\` and \`payEnabled\`. Fake client throws; VM test asserts \`alert\` and that analytics mock got \`cart_failed\` once if you put analytics on that transition.

The live client test uses a stub HTTP 200 fixture; it asserts a \`Cart\` value, not a string. Locale tests live in the VM or a formatter, with an injected locale, not \`Locale.current\` sprinkled in a repository.

A characterisation test of the 1 200-line class is possible and will freeze the strings into the repository. Prefer not to; it blesses the mistake.`,
      pitfalls: `Renaming to \`CheckoutUseCase\` without moving the strings. "Domain" titles in the repository (\`Your bag is empty\` as a business rule — it is not). A repository protocol with 40 methods (problem 8) because every screen function moved with the class.

Putting analytics in the live client *and* the VM "to be safe." Swallowing errors after showing a string, so the VM cannot tell 401 from offline.

Using \`CartDTO\` as the domain type everywhere, so the repository "returns data" but the DTO has \`displayName\` already formatted by the server in one language.`,
      alternatives: `No repository at all: a \`CheckoutClient\` protocol with \`cart() async throws -> Cart\`, implemented once. The word repository earns its keep when there is a cache or a second source (disk + network) to compose. A single HTTP call does not need the name.

A reducer that holds state and runs an \`Effect\` for the client call. Same split: the effect returns \`Cart\`, the reducer writes titles. TCA does not license mixing them; people still do.`,
      tradeoffs: `A thin client plus a VM is two types where the PR had one. That is the cost, and you can read both in one sitting. A 1 200-line repository is one type you cannot test without a string compare.

Formatting in the VM can get messy (dates, money, pluralisation). A \`CartPresenting\` formatter type is allowed — it is still not a repository. It takes \`Cart\` + \`Locale\` and returns strings. Test it with a fixed locale.`,
      followups: [
        {
          q: 'Can the repository cache the Cart?',
          a: 'Yes. Caching is a repository reason to exist. Cached Cart, not cached payButtonTitle. Stale titles after locale change are the smell.',
        },
        {
          q: 'Where do money formatting and currency belong?',
          a: 'A formatter or the VM, with injected Locale and a Money type in domain. Not inside URLSession completion.',
        },
        {
          q: 'Is onShowError okay if it passes Error instead of String?',
          a: 'Better. Still a callback the VM must hop to UI. Throwing or returning Result and letting the VM publish Alert is cleaner.',
        },
        {
          q: 'How small should the first extract be?',
          a: 'cart() async throws -> Cart. That is the whole PR if it replaces URLSession in the VM. The 1 200-line move is how extracts fail.',
        },
        {
          q: 'Widget / App Intent wants the cart total. What does it import?',
          a: 'The client and Cart, not the repository with strings. That is the punchline of the split.',
        },
      ],
      teaches: [
        'Repositories return domain data',
        'Strings and analytics are not domain',
        'Pass-through VMs mean the extract landed in the wrong type',
        'Review the seam, do not rewrite the PR as theatre',
        'Reasons to change should not share a 1 200-line file',
        'Cache Cart, not button titles',
      ],
    },
    {
      id: 'd5-p7',
      title: 'Adding Apple Pay and UPI to a payment class',
      difficulty: 'Expert',
      kind: 'Design',
      prompt: `Checkout must add Apple Pay and UPI next quarter. Today's type:

\`\`\`swift
final class CardPaymentProcessor {
    let stripe: StripeSDK
    func pay(amount: Decimal, card: CardFields) async throws -> Receipt {
        try await stripe.charge(amount: amount, card: card)
    }
    func refund(_ receipt: Receipt) async throws {
        try await stripe.refund(receipt.stripeID)
    }
}

// call sites
try await processor.pay(amount: total, card: fields)
\`\`\`

Product: on iPhone, offer Apple Pay if available; in INR regions offer UPI; card remains. Refunds must work for all three. Finance wants a single \`Receipt\` in the app.

The class is imported by the VM, the coordinator, and an App Intent. A teammate proposes \`if method == .applePay\` inside \`pay\`. Another proposes a protocol per SDK method (40 methods).

Design the types so adding a method does not edit a switch in five files (open/closed), and so the VM does not construct Stripe (dependency inversion). What do you leave as a switch, and where? How do refunds work if Apple Pay's identifier is not a Stripe id?`,
      think: [
        'What varies when you add a payment method — construction, the pay call, the refund call, the UI chip?',
        'Who decides which methods are available: VM, a factory, or the processor?',
        'If pay() takes CardFields, how does Apple Pay even compile without lying?',
        'Where is a switch allowed without violating the spirit of OCP?',
      ],
      solution: `Invert the SDK. Close the processor against edits for each new method by making **methods** types, not branches.

\`\`\`swift
protocol PaymentMethod: Sendable {
    var id: PaymentMethodID { get }
    func pay(amount: Money) async throws -> Receipt
}

protocol Refunding: Sendable {
    func refund(_ receipt: Receipt) async throws
}

struct Receipt: Sendable, Hashable {
    let id: ReceiptID
    let processor: ProcessorKind // .stripe, .applePay, .upi
    let amount: Money
}

final class StripeCardMethod: PaymentMethod, Refunding { ... }
final class ApplePayMethod: PaymentMethod, Refunding { ... }
final class UPIMethod: PaymentMethod, Refunding { ... }

protocol PaymentMethodFactory: Sendable {
    func availableMethods(for context: PayContext) -> [any PaymentMethod]
}
\`\`\`

The VM depends on \`PaymentMethodFactory\` and \`[any PaymentMethod]\`, not on \`StripeSDK\`. Composition root constructs Stripe, Apple Pay, UPI, and the factory. Adding a method is a new type + factory registration, not a new branch in \`CardPaymentProcessor\`.

**Where a switch is honest:**

* Mapping a \`Receipt.processor\` to a refund adapter when the receipt comes back from disk and you must pick the SDK. One switch in the factory, not in the VM.
* UI chips: \`ForEach(methods)\` using a small \`PaymentMethodDescriptor\` (title, icon). If you \`switch\` on enum in the view, that is OK for three cases; a descriptor on the protocol is nicer.

**Do not** make \`pay(amount:card:)\` the protocol. Apple Pay has no \`CardFields\`. The method type already knows its input; the UI collects it. A common \`PayRequest\` enum is fine if you want one function: \`pay(_ request: PayRequest)\` — that enum *will* grow, which is a closed-set choice. Prefer the protocol if the set is expected to grow (UPI, wallet, BNPL).

Refunds: \`Receipt\` carries a **processor kind + opaque id**, not \`stripeID\` on every receipt. Each refund adapter knows how to interpret its ids. A Stripe refund of an Apple Pay receipt is a bug you make unrepresentable by asking the matching adapter.`,
      explanation: `The teammate's \`if method == .applePay\` inside \`pay\` will compile by Friday and will hurt for a year. Every new method touches the same class: new SDK import, new parameters that card does not have, new error mapping, new refund branch. That is the open/closed violation in the flesh — closed would mean you can add Apple Pay without editing \`CardPaymentProcessor\`. You cannot, because it *is* Stripe. The dependency inversion violation is sitting next to it: the VM (and the App Intent) already know the concrete processor. Tests construct Stripe or they do not test pay.

SOLID here is not a recitation. Open/closed says: add a type, do not edit a zoo of switches. Dependency inversion says: the VM depends on an abstraction the composition root implements. Interface segregation (problem 8) says: do not make Apple Pay implement \`tokenizeCard\`. Liskov says: a \`PaymentMethod\` that throws \`notImplemented\` for pay is not a payment method. Single responsibility says: this class should not also format UPI button titles (problem 6).

You still get a switch somewhere. People who claim they eliminated all switches have them in the DI container, in a plist, or in a reflection hack. Put the switch at the edge: factory, or decoding a receipt from disk. Do not put it in the VM's \`payTapped\`, in the coordinator, and in the App Intent. Three switches is how Apple Pay works in the simulator and UPI dies in production because one file was missed.

Receipt identity is the domain trick. If \`Receipt\` has \`stripeID: String\`, Apple Pay is a guest in Stripe's house. An opaque id plus a processor kind, or a small enum of strongly typed ids, keeps refunds honest. Finance's "single Receipt" is a single *app* type, not a single SDK type. Mapping at the adapter is the job.`,
      internals: `\`CardPaymentProcessor\` is a concrete service. Call sites that mention it cannot be tested with a fake without subclasses or the SDK. A protocol existential \`any PaymentMethod\` is a witness table; pay is dynamically dispatched. That is the point.

Factory input \`PayContext\` (region, device capabilities, logged-in wallets, feature flags) is data. The factory's implementation is allowed to \`import Stripe\` and \`PassKit\`. The VM's file is not.

Apple Pay's actual flow is a presentation (a sheet / controller). That presentation is UI. The *method* object may vended a request you throw to a thin UI adapter ("start PassKit"), and resume an \`CheckedContinuation\` when authorised. Do not put \`PKPaymentAuthorizationController\` in the VM; do not put it in the domain \`Cart\` either. A small \`ApplePayAuthorising\` port, implemented at the UI edge, keeps inversion intact. This is the same "VM must not present" rule as problem 4, applied to PassKit.

UPI often means a partner SDK or a deep link. Same port, different adapter. The protocol is the stability; the SDK is not.`,
      testing: `Factory tests: context iPhone + US → contains Apple Pay and card, not UPI. Context INR + capability → UPI. Context iPad as you spec.

VM tests: fake method that succeeds / fails; assert \`State\`. The fake does not import Stripe. Refund test: a receipt with \`.applePay\` is handed to a fake Apple Pay refunder, not to the Stripe fake — a misrouted refund should fail a factory test.

Do not unit-test PassKit UI in the VM suite. UI-test Apple Pay in a sandbox if you have one; otherwise a manual matrix.

Adding a new method in a test: a \`SpyMethod\` registered in a fake factory. If you had to edit the VM to add the spy, OCP failed.`,
      pitfalls: `A protocol with \`payCard\`, \`payApple\`, \`payUPI\` defaulted to \`fatalError\`. That is a switch in disguise and an LSP violation.

Passing \`CardFields\` as optional on the protocol "for Apple Pay." Optional parameters that one implementer needs are a smell; split the type.

Constructing \`StripeSDK\` in the factory *and* in the App Intent. One composition root.

Storing the Stripe customer id in \`Receipt.id\` for all processors because the first adapter won.`,
      alternatives: `An enum \`PaymentMethodKind\` with associated values and a single \`Processor\` that switches — honest if the set is forever three, cheaper to read, and every new method edits the enum and the switch. For a bank that adds methods yearly, prefer the protocol.

A third-party payments facade your company already owns. Still wrap it so the VM does not import it. Their facade is an SDK to you.

Server-driven methods: the backend returns available method ids, the factory maps ids to types. The switch lives in that map. Good for regional rollout; requires unknown-id handling.`,
      tradeoffs: `A protocol per method type: more files, easy fakes, adding UPI does not diff the card class. An enum: one file, exhaustive switches that the compiler forces you to update — which is a feature for refunds you must not forget, and a chore if 12 teams add methods.

Existential \`any PaymentMethod\` versus generic: existentials are simpler in an array of mixed methods. Generics leak into the VM. Pick existentials here.

PassKit UI at the edge adds a hop (continuation). Putting PassKit in the method type is fewer types and couples tests to UIKit. For Apple Pay, I would pay the hop.`,
      followups: [
        {
          q: 'How do you feature-flag UPI without a switch in the VM?',
          a: 'The factory reads the flag and does not return the UPI instance. The VM shows whatever it was given.',
        },
        {
          q: 'What if refund is not supported for a method?',
          a: 'Do not put refund() on PaymentMethod with fatalError. Refunding is a separate protocol. The factory vends it only when available. UI asks if let refunder = method as? Refunding.',
        },
        {
          q: 'Does this violate YAGNI for a company that only has Stripe?',
          a: 'If you only have Stripe, a protocol with one live adapter is enough inversion for tests. Do not invent UPI types. Add the protocol now so the VM does not import Stripe; add ApplePayMethod when the quarter starts.',
        },
        {
          q: 'Where do 3DS / authentication sheets live?',
          a: 'UI adapter, like Apple Pay. The method returns an AuthenticationRequired error with a token, or uses a callback port. The VM publishes Route.authenticate, it does not present SFSafariViewController (problem 4).',
        },
        {
          q: 'Money type versus Decimal?',
          a: 'Money with currency. Decimal plus a separate currency string is how you charge the right number in the wrong currency. Domain, not the SDK.',
        },
      ],
      teaches: [
        'OCP: add a method type, do not grow a switch zoo',
        'DIP: VM depends on factory/protocol, not Stripe',
        'ISP: do not force Apple Pay to take CardFields',
        'Switches belong at the factory edge',
        'Receipt ids are per processor',
        'PassKit presentation is UI, not domain',
      ],
    },
    {
      id: 'd5-p8',
      title: 'One networking protocol versus forty',
      difficulty: 'Senior',
      kind: 'Judgment',
      prompt: `Two PRs are open.

**PR A** — "one client to rule them all":

\`\`\`swift
protocol HTTPClient {
    func send(_ request: HTTPRequest) async throws -> HTTPResponse
}
\`\`\`

Every feature builds URLs and decodes JSON in the VM or in ad-hoc helpers. Retry, 401 refresh, and analytics live in the one live client. People like it until Profile needs a different timeout and someone adds \`send(_:timeout:cache:auth:)\`.

**PR B** — "interface segregation":

\`\`\`swift
protocol UserFetching { func me() async throws -> User }
protocol UserUpdating { func update(_ user: User) async throws -> User }
protocol AvatarUploading { func upload(data: Data) async throws -> URL }
protocol CartFetching { func cart() async throws -> Cart }
protocol CartMutating { func add(item: SKU) async throws -> Cart }
// ... 35 more
\`\`\`

Each protocol has one live class that wraps \`URLSession\`. Mock generation is a CI step. Adding a field to \`User\` touches six protocols. A screen that needs cart and user takes two existentials, then four, then a \`Dependencies\` bag.

You are the staff engineer on the review. Pick a default for this app (the 80-screen, 40-person one from problems 1–3). When would you choose the other? How does this interact with modules and with the repository that became a VM?`,
      think: [
        'What actually varies between Profile and Checkout — the HTTP pipeline, or the shape of the calls?',
        'Who should know the /me path: the VM, a ProfileClient, or a generic send()?',
        'When does ISP help, and when is it a protocol per function that a class already had?',
        'What do tests want to fake — bytes on the wire, or me() → User?',
      ],
      solution: `**Default for this app: two layers, not forty protocols and not a naked \`send\` in every VM.**

1. **One \`HTTPClient\`** (PR A's type) in Networking. It owns timeouts *as configuration*, retries, 401 join (Day 6), tracing. Features do not reimplement that. Extra parameters become a \`HTTPRequest\` value (\`timeout\`, \`cachePolicy\`), not a growing function signature.
2. **One small client protocol per feature (or per bounded context),** not per method. \`ProfileClient { func me(); func update(_); func uploadAvatar(_) }\`. \`CheckoutClient { func cart(); func add(item:); func pay(_) }\`. That is ISP at the *feature* grain, the same grain as modules in problem 3.

VMs depend on \`ProfileClient\`, not on \`HTTPClient\`, so they do not build URLs (problem 2). Live \`LiveProfileClient\` depends on \`HTTPClient\`. Tests fake \`ProfileClient\` with a stub \`User\`. HTTP client tests fake bytes with \`URLProtocol\`.

Reject PR B's 40 protocols unless a team genuinely has two implementations of \`AvatarUploading\` that are not the other 39. Reject VMs calling \`HTTPClient.send\` unless the screen is a debug console.

A \`Dependencies\` bag of 12 protocols is a cry for a feature client. A single 80-method \`AppClient\` is a cry for splits along feature lines, not along verbs.`,
      explanation: `Interface segregation is a response to a real pain: being forced to depend on methods you cannot implement. Apple Pay should not implement \`tokenizeCard\` (problem 7). A widget that only needs \`cart()\` should not link a 80-method god client if that is what keeps it from compiling in isolation. Segregation at *verb* granularity is a parody of that idea. You would not write \`protocol ArrayAppending\` and \`protocol ArrayRemoving\` in the standard library. You write \`Array\`. \`UserFetching\` plus \`UserUpdating\` plus \`AvatarUploading\` is one profile. The people who will change together should live together.

PR A's opposite failure is also in production a lot. A powerful \`HTTPClient\` is the right *transport*. It is the wrong API for a VM. The VM then owns paths, decoders, and error mapping, and you are back to problem 2 with a nicer session. Profile's different timeout is not a reason to explode the function signature; it is a field on the request value, or a second configured client instance ("uploadsClient") constructed at the composition root. Configuration is not ISP.

The 40-person org makes this a module question. \`ProfileClient\` lives next to Profile, depends on Networking's \`HTTPClient\`, and is faked in Profile tests without compiling Checkout. Forty tiny protocols tend to live in a SharedNetworkingAPI module that every feature imports — \`AppKitInternal\` again, slower to compile, and a mock-codegen step that makes PRs feel senior while the VMs still format strings (problem 6).

Staff judgment is picking the grain: **transport is one, feature ports are few, methods are not types.** You can always split \`ProfileClient\` later if avatar upload becomes a platform service with two backends. You cannot cheaply merge 40 protocols once mock generation and every test import have calcified.`,
      internals: `Existential \`any UserFetching\` is a small witness table. Forty of them in a view model initializer is unreadable and slow to type-check. A struct \`ProfileClient\` with closures (\`var me: () async throws -> User\`) is a popular alternative that fakes well without protocols — same grain.

\`HTTPRequest\` as a value (method, path, headers, body, idempotency key, timeout) keeps \`send\` stable. The live client applies plugins: auth, tracing, refresh. That pipeline is why you wanted one HTTPClient.

Mock codegen (Sourcery, etc.) on 40 protocols is a build-time tax and a cultural tell: the team tests by generating, not by designing small fakes. Handwritten stubs for \`ProfileClient\` fit in a test file.

Modules: Networking exports \`HTTPClient\` + errors. Features export their client protocol. App wires live types. PR B often exports all 40 from Networking, which inverts the dependency the wrong way (features' verbs live in the platform layer).`,
      testing: `ProfileVM tests take \`ProfileClient.stub(me: .ada)\`. CheckoutVM tests do not compile Profile. HTTPClient tests: 401 then refresh then retry (Day 6), timeout, decode at the live profile adapter with a fixture.

If a test file imports 12 protocols to construct a VM, the review is "this VM needs a feature client," not "generate nicer mocks."

Contract tests: live ProfileClient against a recorded cassette, optional, in a nightly suite. Not the default unit test.`,
      pitfalls: `\`send<T: Decodable>(_ :)\` on HTTPClient used from VMs — generic sugar that still spreads URLs around. \`protocol Repository\` with associated types so aggressive nobody can existentially fake it. Putting retry on every feature client instead of the pipeline, so you get 15 policies.

PR B's protocols living in the VM file, implemented by the VM, which then still uses URLSession — theatre.

A second HTTPClient protocol in each feature "for isolation" that is a copy of send(_:). You will fix a refresh bug in one of them.`,
      alternatives: `TCA \`DependencyValues\` with a \`ProfileClient\` struct of closures — good ergonomics, still one client per feature. GraphQL clients with typed operations — the operation is the protocol; do not also wrap each operation in a one-method protocol.

For a 4-person app (problem 10), one \`HTTPClient\` plus decoding in a few live functions is enough. Do not introduce 40 protocols there either.`,
      tradeoffs: `Feature clients: a bit of duplication in live adapters (each constructs requests), much clearer tests, module-friendly. Forty protocols: generated mocks, noisy inits, Shared module pressure. Naked HTTPClient in VMs: fastest to write, worst VM tests, URL spaghetti.

Two configured HTTPClient instances (API vs uploads) versus flags on each request: two instances are easier to reason about for timeouts and headers; flags are easier to mix up per call. Prefer instances at the composition root for wildly different policies; prefer request fields for small variations.`,
      followups: [
        {
          q: 'Is a protocol with one method always a smell?',
          a: 'No. TokenStore.accessToken() is a good one-method port. AvatarUploading as a platform service used by Profile and Chat might be. UserFetching next to UserUpdating in the same feature is a split that buys nothing.',
        },
        {
          q: 'Where does JSON decoding live?',
          a: 'Live feature client, using the shared HTTPClient bytes. Not in the VM, not in HTTPClient if that forces HTTPClient to know User.',
        },
        {
          q: 'How do you share the 401 refresh among feature clients?',
          a: 'Inside the one HTTPClient pipeline. Feature clients must not each refresh (Day 6 thundering herd).',
        },
        {
          q: 'What if Checkout needs me() for the email field?',
          a: 'Inject ProfileClient into checkout composition, or a tiny IdentityClient in the Identity module. Do not have CheckoutClient.me() copy the endpoint. Do not import all of Profile UI (problem 3).',
        },
        {
          q: 'Generic HTTPClient.send<T: Decodable> — staff yes or no?',
          a: 'Fine inside live adapters. A smell as the VM’s only dependency. The generic leaks DTOs and URLs into UI code.',
        },
      ],
      teaches: [
        'ISP grain is the feature, not the verb',
        'One HTTP pipeline, many feature clients',
        'VMs fake ProfileClient, not bytes',
        'Forty protocols recreate a Shared dump',
        'Request values beat exploding send() signatures',
        'Staff judgment is picking the grain',
      ],
    },
    {
      id: 'd5-p9',
      title: 'Five @Published booleans versus an enum',
      difficulty: 'Senior',
      kind: 'Predict',
      prompt: `What states are possible, and which ones can the UI actually draw without lying?

\`\`\`swift
@MainActor
final class CheckoutVM: ObservableObject {
    @Published var isLoading = false
    @Published var hasError = false
    @Published var isEmpty = false
    @Published var showAlert = false
    @Published var isLoggedIn = true
    @Published var cart: Cart?
    @Published var errorMessage: String?
}
\`\`\`

A bug report: after a 401, the user sees a spinner on top of an empty bag, then an alert, then the last cart, then login. Another: \`payTapped\` runs while \`isLoading\` is true because \`payEnabled\` is derived as \`!isEmpty && isLoggedIn\`.

Draw the illegal combinations. Redesign as an explicit enum (and nested state as needed). What still deserves a separate \`@Published\`? How does this change tests and SwiftUI \`body\`? Tie it to Day 3: if the view reads all five booleans, what invalidates?`,
      think: [
        'Can isLoading and hasError both be true? Can cart be non-nil and isEmpty true?',
        'Who is allowed to set showAlert independently of hasError?',
        'What does payTapped need to know as a single value?',
        'If you use @Observable, does an enum still matter?',
      ],
      solution: `Five booleans are 32 combinations. Most are nonsense: loading+error+empty, logged-out with a cart you can pay, \`showAlert\` without a message, \`isEmpty\` with a non-nil cart.

\`\`\`swift
@MainActor
final class CheckoutVM: ObservableObject {
    enum Phase: Equatable {
        case loggedOut
        case loading
        case empty
        case ready(Cart)
        case paying(Cart)
        case failed(message: String, recovery: Recovery)
    }
    enum Recovery: Equatable { case retry, login, dismiss }

    @Published private(set) var phase: Phase = .loading

    var payEnabled: Bool {
        if case .ready(let cart) = phase { return cart.total > 0 }
        return false
    }

    func load() async { /* set .loading, then .empty / .ready / .failed / .loggedOut */ }
    func payTapped() async {
        guard case .ready(let cart) = phase, payEnabled else { return }
        phase = .paying(cart)
        // success → route; failure → .failed(..., cart still known via associated value or .ready)
    }
}
\`\`\`

**Still separate** (if they are truly orthogonal): a \`Route?\` for navigation, maybe a transient \`Toast\` that is not the load phase. Do not invent \`isLoggedIn\` next to a phase that already has \`.loggedOut\`.

Invalid combinations become unrepresentable. \`payTapped\` cannot fire in \`.loading\` without a programmer going out of their way to ignore the guard.

Day 3: one \`phase\` property is one subscription. Five booleans is five writes per transition if you forget to flip one (the spinner-on-empty-bag bug). With \`@Observable\`, one enum write invalidates readers of \`phase\`; five bools still invite a missed assignment. The enum is for *honesty*, Observation is for *granularity*. You want both.`,
      explanation: `The bug report is not a race in URLSession. It is a state machine you refused to draw, so the UI drew all of it. Booleans feel like independent knobs. Loading is not independent of error. Empty is not independent of "we have a cart." Logged-in is not independent of "show the pay button." When a 401 arrives, one author sets \`hasError = true\` and forgets \`isLoading = false\`. Another sets \`cart = nil\` which makes \`isEmpty\` true in the view via a second derivation. A third presents the alert via \`showAlert\`. The user sees a stack of truths. The VM told four lies and one leftover spinner.

An enum is not fancy. It is the list of screens this object is allowed to mean. \`loading\`, \`empty\`, \`ready(Cart)\`, \`paying(Cart)\`, \`failed\`, \`loggedOut\`. You can still get those wrong — maybe paying should be a nested flag on ready because the cart should remain visible — and that is a design conversation you can have because the states have names. You cannot have it with \`isLoading && !isEmpty && showAlert\`.

This is the same instinct as Day 3's identity and Day 2's "which search result wins." Make the illegal state inexpressible, then the UI switch is exhaustive, then the test asserts \`phase == .failed\` instead of a cloud of bools. \`payEnabled\` becomes a function of the enum, not a sixth boolean that drifts.

People worry that one enum invalidates the whole view. Good. The phase changed; the view should update. The feed-row problem was a *timer* waking *image* rows. A checkout screen waking because it went from loading to ready is the job. If chrome (a ticking clock) shares the VM, do not put the clock in this enum — that is Day 3 problem 10, not an argument for five booleans.`,
      internals: `\`@Published var isLoading\` is a distinct publisher. Assigning five bools in a block still sends five times unless you coalesce (objectWillChange manually, or a single assignment to a struct). SwiftUI will coalesce some objectWillChange noise, and you will still miss a flip.

An enum with associated values is a single assignment. \`Equatable\` on \`Phase\` lets you avoid redundant publishes if you check \`!=\`. \`Cart\` inside \`.ready\` and \`.paying\` means the value is in the phase; you do not also keep \`var cart: Cart?\` that can disagree. Duplicate stores (\`phase\` *and* \`cart\`) are how enums rot back into booleans.

\`@Observable\` tracks \`phase\`. Views that only read \`payEnabled\` still read \`phase\` if that is how it is computed. Fine. Views that should not redraw on phase — a totally independent banner — should not live on this VM.

Exhaustive switches in the view are a compiler-enforced review: adding \`.paying\` forces the UI to decide on a spinner overlay versus a disabled button.`,
      testing: `Table-driven tests: given a 401, \`phase == .failed(..., .login)\` and \`payEnabled == false\`. Given empty cart, \`.empty\`. Given load success, \`.ready\` with total. Pay from \`.loading\` is a no-op.

You cannot forget to assert \`isLoading == false\` because that flag does not exist. That is the point.

A UI test that 401 shows the login recovery, not a spinner forever. The old bug is a snapshot of stacked views; the new bug would be a missing switch case, which should not compile.`,
      pitfalls: `\`enum State { case idle, loading, success, error }\` plus \`var cart: Cart?\` plus \`var isLoggedIn\` — you kept the booleans. Associated values or nested phases, or you failed.

A parallel \`showAlert: Bool\` that you set in \`didSet\` of phase. One channel.

Making the enum \`String\`-backed for analytics and then refusing associated values because they do not raw-represent. Map to analytics in one function; do not impoverish the state machine for log strings.

\`@Published var phase\` and mutating \`cart\` inside the associated value without reassigning \`phase\` — structs need \`phase = .ready(updated)\`. Classes as associated values mutate silently; be careful, Observation / Published may not fire.`,
      alternatives: `A struct \`CheckoutViewState: Equatable\` with a nested enum plus the few orthogonal fields, published as one value. Nice for SwiftUI equality skips.

TCA: the reducer's \`State\` *is* this enum-or-struct. Do not run TCA just to get an enum; you can type \`enum Phase\` today.

Two VMs (session vs cart) if logged-out is a different screen entirely. Then checkout VM is never created logged out — also valid, also a state machine, just at the coordinator.`,
      tradeoffs: `Enums force you to name transitions and make the VM slightly more switchy. Booleans are faster to add "one more flag" for a banner, which is how you get 32 states. For checkout, the enum is cheaper than the bug report.

Associated values copy \`Cart\` into \`.paying\`. If \`Cart\` is huge, use an id and a store; do not go back to five bools to avoid a copy. COW helps until you embed a JPEG (Day 3).`,
      followups: [
        {
          q: 'Where does the alert live if recovery is .login?',
          a: 'The view switches on phase.failed and presents. Or Route.login is published separately if login is a different flow. Do not keep showAlert.',
        },
        {
          q: 'Can phase be loading and the last cart still be on screen?',
          a: 'Name it: .refreshing(Cart). That is a legal state you drew. isLoading + cart leftover is the illegal version of the same idea.',
        },
        {
          q: 'payTapped during .paying?',
          a: 'Guard. Double-tap is Day 2. The enum makes the guard obvious; a boolean isLoading that you also use for initial load may already be false during pay if you reused it wrong.',
        },
        {
          q: 'Does @Observable replace the enum?',
          a: 'No. It replaces objectWillChange granularity. Illegal states are a domain design. You can have @Observable with five bools and the same bug.',
        },
        {
          q: 'How does this show up in UIKit?',
          a: 'A render() that switches on phase instead of five ifs that hide/show views. Same illegal combinations, same spinner-on-empty-bag, without SwiftUI.',
        },
      ],
      teaches: [
        'Booleans multiply into illegal states',
        'Name phases so the UI cannot stack truths',
        'payEnabled is derived from the phase',
        'Orthogonal state is rare; do not assume it',
        'Observation is not a state machine',
        'Exhaustive switches are the compiler as reviewer',
      ],
    },
    {
      id: 'd5-p10',
      title: 'When Clean Architecture and TCA are overengineering',
      difficulty: 'Expert',
      kind: 'Judgment',
      prompt: `A 4-person team. App is 35 screens, mostly settings, a feed, and checkout. CI is 4 minutes. They ship every week. A new hire from a 100-person org opens a PR: TCA for settings, a Domain/Data/Presentation triple for the "change email" screen (one PUT), 9 protocols, 3 use-case types, a reducer, a dependency client, and a 140-line test store.

Product wants the email change this Friday. The new hire says this is how you avoid the 3 000-line VC problem.

You are the tech lead in the room with the new hire and a junior who now thinks their \`ObservableObject\` is amateur. What do you keep from this PR? What do you reject? How do you teach the junior without mocking the new hire? When *would* you adopt TCA or a full Clean layout in this company? How does this relate to problems 1–9 without becoming "never use architecture"?`,
      think: [
        'What pain exists today — compile times, untestable payment, navigation soup, or a missing PUT seam?',
        'What is the smallest boundary that would let a test force 401 on change-email?',
        'Who has to be fluent in TCA for this to be kind, not a bus factor of one?',
        'What happens to the 3 000-line VC argument if settings is 200 lines and already a VM?',
      ],
      solution: `Keep the **seam**. Reject the **cathedral**.

Keep:

* A \`ProfileClient.updateEmail(_)\` (or even \`HTTPClient\` + a 20-line live function) so the VM can be tested with a 401. That is problem 2. That is the whole architecture Friday needs.
* An enum \`Phase\` for the screen (problem 9).
* No \`URLSession\` in the view. No alert presentation in the client (problems 4 and 6).

Reject for this PR:

* TCA Store / Reducer / Effect for a single PUT unless the team is already fluent and the screen has real concurrency (problem 2's search race, overlapping submits). A \`Task\` in the VM is enough.
* \`ChangeEmailUseCase\`, \`ChangeEmailRepository\`, \`ChangeEmailEntity\`, \`ChangeEmailViewState\` as four files for one DTO. That is a triple that will not get a second caller.
* Nine protocols. You want one (problem 8).
* A test store that is longer than the feature if it only asserts the reducer bounced an action. A VM test with a stub client is the same proof.

Say this out loud to the junior: **your \`ObservableObject\` with an injected client is the architecture.** The 3 000-line VC problem is missing boundaries, not missing libraries. We will use a strangler when checkout hurts (problem 1), modules when CI hurts (problem 3), coordinators when navigation leaks (problem 5), method types when Apple Pay arrives (problem 7). We will not install all of them on change-email.

Adopt TCA (or a full Clean folder layout) when:

* Several people are fluent, and hiring assumes it, **and**
* You have overlapping effects, deep navigation, or a playbook that is already paying rent on two features, **and**
* The onboarding cost is acknowledged in the calendar.

Adopt Clean circles when a second platform (watch, widget, backend-driven) needs the same use cases, not when a PUT needs a folder named UseCases.

If the new hire is right about *checkout* being a mess, point them at problem 1's six-week strangler, not at settings.`,
      explanation: `The new hire is trying to save you from a fire they have seen. That instinct is good. The PR is a hydrant aimed at a birthday candle. Change-email is a form, a PUT, a 401, a success toast. The failure mode of a 3 000-line VC is real and it is not this screen. If you merge the cathedral, the junior learns that professionalism is file count. If you reject it with a sneer, the new hire learns this company hates craft. Both are how cultures rot.

Architecture is a response to pain you can name. Each earlier problem on this day has a tool that is proportional to that pain. TCA is excellent for overlapping effects and a time-traveling test, when people can still read a reducer at 4 p.m. on a Friday. It is a second language. A 4-person team that ships weekly already has one: Swift, SwiftUI, a VM, a client protocol. Adding another language for settings is a product decision disguised as hygiene. You will ship slower for a quarter. On change-email, you will not ship cleaner.

Overengineering is not "they used a protocol." Overengineering is **ceremony that does not change the test you can write this week** and that the next hire cannot modify without the author in the room. Nine protocols for one PUT fail that test. A \`ProfileClient\` passes it. Clean Architecture as a directory template for every screen fails it. Clean as "the VM does not import URLSession" passes it.

The teaching moment for the junior is specific: we will inject a client, we will publish an enum, we will not present UIKit from the VM. That is the bar. When checkout grows Apple Pay, we will look at problem 7 together. When CI is 28 minutes, problem 3. We do not install the future's org chart into today's settings screen. That is also architecture: the choice to wait.`,
      internals: `TCA's cost is conceptual (reducers, effects, stores, dependencies, scoped children) and compile-time (macros, generics). Its value is structured concurrency of effects, composition of features, and tests that play actions. If the screen has one \`Task\` and no child features, you are paying the conceptual cost for a replayable test you could have written as \`await vm.submit(); XCTAssertEqual(vm.phase, .ready)\`.

Clean Architecture's cost is types and folders: entities, use cases, interface adapters, frameworks. Its value is a use case that two UIs can call. One SwiftUI form and no second UI means the use case is a function the VM could have called. \`func updateEmail(_:) async throws\` on a client *is* the use case. Naming it \`ChangeEmailUseCase\` does not add a caller.

Bus factor: a TCA-only settings module the other three people are afraid to touch is an operational risk. Architecture that only one person can extend is an unbus-factorable singleton in human form.`,
      testing: `The Friday test: stub client throws 401, VM phase is failed/login. Stub succeeds, phase is ready. That test should land with the feature. If the PR's 140-line store test does not assert that, it is not protecting the user.

A social test: the junior implements "resend confirmation" next week without the new hire. If they cannot, you merged a cathedral.

Do not measure success by file count or by resemblance to a point-free example.`,
      pitfalls: `Mocking the new hire in standup. Accepting the PR to "not block them" and living with nine protocols in settings forever. The opposite: banning TCA in the style guide after one PR, so when checkout actually needs structured effects you fight a holy war.

Letting \`ObservableObject\` grow URLSession because you rejected TCA — that was not the lesson. Copying this judgment onto a 40-person, 28-minute-CI app and refusing modules (problem 3) — that was not the lesson either. Proportionality cuts both ways.

A hybrid: TCA for settings, MVVM for the feed, VIPER for checkout, because each PR was a different new hire. Pick a default for the app, allow exceptions with a reason.`,
      alternatives: `The change-email VM as it should land: \`@Observable\` class, \`Phase\` enum, \`ProfileClient\`, \`Task\` cancelled on disappear. Preview with a stub. That is the alternative, and it is complete.

If the new hire wants to teach TCA, do it on a spike branch on the search screen (overlapping queries, Day 2), with a pairing session, not on the Friday PUT.

If a second client (watch app) is actually coming this quarter, extract a tiny Swift package with \`ProfileClient\` and the DTO *only*. That is incremental Clean, without the circles.`,
      tradeoffs: `Ceremony buys onboarding consistency in a large org and costs speed in a small one. A 100-person company standardising on TCA can be rational: the next 20 hires already read it. A 4-person company standardising on TCA because one hire arrived is imitating that rationality without the hiring pipeline.

Under-engineering the checkout payment SDK because "we are four people" is how you get problem 2 in the one place it will page you at night. Over-engineering settings is how you get no Friday release. The staff skill is **different tools on different screens**, with a default that is boring.`,
      followups: [
        {
          q: 'The new hire says tests are impossible without TCA.',
          a: 'Show a VM test with a stub ProfileClient. If they mean time-travel and effect exhaustion, they are right about a different screen. Change-email does not need exhaustion.',
        },
        {
          q: 'When do you introduce a UseCase type that is not the client?',
          a: 'When two UIs or two entry points (screen + App Intent + watch) share policy beyond a single call — e.g. "update email then refresh session then log analytics" that must not diverge. Until then the VM function is the use case.',
        },
        {
          q: 'Would you allow TCA just for checkout?',
          a: 'Yes if two people can review it and the boundary is the feature module. No if settings must also convert "for consistency" in the same quarter.',
        },
        {
          q: 'How do you write this in the engineering handbook?',
          a: 'Default: VM + feature client + phase enum. Add coordinators / modules / method protocols / TCA when a named pain in this handbook is present. PRs that add layers must name the pain.',
        },
        {
          q: 'What if Product slips Friday and the cathedral PR is "already done"?',
          a: 'It is not done if the junior cannot extend it. Ask for a slice: client + VM tests this week, TCA spike next if checkout effects hurt. Sunk-cost cathedrals are how Q3 slides happen (problem 1).',
        },
        {
          q: 'Is this "never Clean Architecture"?',
          a: 'No. It is "Clean is a move you apply to a boundary that is changing, at a grain you can test this week." That sentence is the whole day.',
        },
      ],
      teaches: [
        'Architecture is proportional to named pain',
        'A feature client is the usual seam',
        'TCA/Clean cost a second language',
        'Do not install a 100-person org chart in a 4-person app',
        'Teach the junior the bar, not the sneer',
        'Different screens may deserve different tools',
        'Waiting is an architectural choice',
      ],
    },
    {
      id: 'd5-p11',
      title: 'Feature-flag SDK imported in every view model',
      difficulty: 'Senior',
      kind: 'Architecture',
      prompt: `LaunchDarkly (or Statsig, Optimizely, a home-grown \`FlagManager.shared\`) is imported in forty view models:

\`\`\`swift
func payTapped() {
    if LDClient.shared.boolVariation("new_checkout", false) {
        host?.present(NewCheckoutVC(), animated: true)
    } else {
        host?.present(LegacyCheckoutVC(), animated: true)
    }
}
\`\`\`

Tests need a mobile SDK key or they crash in \`boolVariation\`. A flag rename is a 40-file PR. SwiftUI previews hit production. Checkout constructs Stripe only inside the \`true\` branch. Product wants the flag off for 5% of users by lunch.

Design where the SDK is allowed to live, what the VM actually receives, and how you turn a flag off without a string hunt. Tie it to the composition root in problem 1 and the factory in problem 7.`,
      think: [
        'Who is allowed to import the vendor SDK — every VM, one adapter, or the composition root?',
        'Is a flag a boolean the VM reads, or data the factory already applied?',
        'What happens in tests and previews when the SDK is a process-wide singleton?',
        'Where do default values live so a typo in the flag key is a compile error, not a silent false?',
      ],
      solution: `The SDK is infrastructure. View models receive **values**, not a vendor client.

\`\`\`swift
protocol FlagProviding: Sendable {
    func enabled(_ key: FlagKey) -> Bool
}

enum FlagKey: String, Sendable {
    case newCheckout = "new_checkout"
    case upiEnabled = "upi_enabled"
}

struct StaticFlags: FlagProviding {
    var values: [FlagKey: Bool]
    func enabled(_ key: FlagKey) -> Bool { values[key] ?? key.defaultValue }
}
\`\`\`

Composition root (scene / \`AppFactory\`) starts the SDK **once**, wraps it in \`LiveFlags\`, and injects \`any FlagProviding\`. Tests and previews inject \`StaticFlags\`. The VM never \`import LaunchDarkly\`.

**Flags that choose a type** (new checkout vs legacy, Apple Pay vs not) belong in the **factory**, not in \`payTapped\`. Problem 1 already said this: the tab child is \`LegacyCheckoutVC\` or \`CheckoutFactory.make()\`. Problem 7's \`PaymentMethodFactory\` reads \`PayContext\` including flags and does not return UPI. The VM shows whatever it was given. A boolean in the VM that presents one of two VCs is problem 4 wearing a feature-flag hat.

**Flags that are runtime policy on an already-built screen** (copy, a banner, a limit) may be read by the VM through \`FlagProviding\`. Still no vendor import. Cache the value at start-of-screen if the SDK is allowed to change mid-session; document that.

One catalog of \`FlagKey\` with defaults. A string \`"new_checkout"\` in forty files is how you ship the old checkout to everyone after a rename and spend Friday grepping.`,
      explanation: `The SDK felt like a convenience until it was the composition root. Forty view models calling \`LDClient.shared\` means forty hidden dependencies, a test suite that needs a mobile key, and a preview canvas that talks to a flag service on a designer’s laptop. The string key is a second, untyped API sitting next to your Swift types. Rename the flag in the dashboard, forget one call site, and 5% of users are not who you thought.

Seniors treat vendor SDKs the way they treat Stripe in problem 7: one adapter at the edge, a protocol facing inward, construction at the composition root. The VM’s job is still state and intents. “Which checkout am I?” is not an intent the VM should decide by reaching into a singleton. It is a construction decision. If the flag is off, the factory never builds \`NewCheckoutStore\`. You do not compile a branch that presents \`NewCheckoutVC\` from a VM that was not supposed to know that type existed — that import is a module cycle waiting for problem 3.

There is a softer case. A banner on an existing screen, a numeric limit, a copy variant: those are data the screen needs at runtime. Injecting \`FlagProviding\` is the right grain. Injecting \`LDClient\` is how every test file grows a \`setUp\` that calls \`LDClient.start\`. I have watched that setUp start the real SDK against production because someone copied a snippet. Static flags in tests are not a compromise. They are the proof the boundary exists.

Default values belong next to the key, in source control, not in the forty-ninth argument of \`boolVariation\`. Silent \`false\` on a typo is a launch bug that looks like “the flag is off.” An enum cannot typo. That is the whole type.`,
      internals: `LaunchDarkly and friends are process-wide. They open sockets, persist evaluation caches, and want to start in \`didFinishLaunching\`. That start belongs next to the HTTP client and the analytics SDK, in App, not in \`ProfileVM.load()\`. Starting in a VM is how you get two starts, or a start after the first evaluation, or a start in a test.

Evaluation is usually synchronous after start (\`boolVariation\`) and async if you wait for a blocking fetch. Do not block launch on flags unless the first frame cannot paint without them. Paint a default, then apply. The catalog’s \`defaultValue\` is what you show before the socket returns.

\`FlagKey\` as an enum is the closed set. Server-driven keys (the dashboard adds a flag the app has never seen) stay strings at the adapter and never leak into VMs. Unknown keys evaluate to default, log once, do not crash.

Feature flags that select modules must live in App. A feature module that imports the SDK so it can hide itself is a cycle: App imports Feature to build it, Feature imports App’s SDK wrapper, or Feature imports the vendor and you have forty importers again.

Do not put \`if flag\` inside payment signing, receipt mapping, or the Stripe charge. Those paths should not exist in the process if the flag is off.`,
      testing: `VM tests get \`StaticFlags(values: [.newCheckout: true])\`. Assert the VM never needed a second type. Factory tests: flags off → factory returns legacy; flags on → new store; no \`LDClient\` in the test target.

A grep / boundary test: \`import LaunchDarkly\` is allowed in \`LiveFlags.swift\` and the app start, nowhere else. CI fails a VM file that mentions \`boolVariation\`.

Preview: \`StaticFlags\` matching a named configuration (\`PreviewFlags.checkoutOn\`). If a preview hits the network for flags, you failed the same way problem 2’s default \`init()\` failed.

Do not hit the vendor in unit tests. A nightly smoke that the mobile key starts is an integration test, optional, not the VM suite.`,
      pitfalls: `A \`protocol FlagProviding\` that still has a default implementation calling \`LDClient.shared\` — problem 2’s default live \`init()\` again. String keys in VMs “until we have time for an enum.” Evaluating flags inside a SwiftUI \`body\`. Starting the SDK twice. Treating a missing key as \`false\` without logging. Putting the flag check in the coordinator *and* the VM *and* the factory, so off still presents new checkout from one of them.

Using flags as a module system: \`if flag { import NewCheckout }\` is not a thing, and runtime equivalents that \`dlopen\` are not how iOS apps work. You ship both, you construct one.`,
      alternatives: `Remote config as a decoded struct (\`CheckoutConfig\`) fetched once, injected as a value. Better when you have ten related knobs; still a protocol if the source can fail. Compile-time \`#if DEBUG\` is not a feature flag. A local \`UserDefaults\` override for QA, read only by \`LiveFlags\`, never by VMs.

Server-driven UI that returns “use new checkout” as part of \`/me\` — then the flag is on the profile client, still not in the VM as an SDK. Same inversion, different pipe.`,
      tradeoffs: `A protocol plus an enum is two types and a factory change when you add a flag. Forty string call sites are faster to type and how flags rot. Evaluating in the factory means a flag change at runtime does not rebuild an already-shown VM — usually what you want for checkout, less so for a banner. Document it.

The SDK’s real-time streaming is a reason people call it from \`body\`. Resist. Stream into \`LiveFlags\`, publish a snapshot, let the VM subscribe to \`FlagProviding\` if the banner must flip live. Most checkout flags should not flip under a paying user.`,
      followups: [
        {
          q: 'Who owns default values when the dashboard and the app disagree?',
          a: 'The app catalog. The dashboard cannot save you on first launch or in airplane mode. If the dashboard default is different, that is a product bug to reconcile, not a reason to omit defaults in code.',
        },
        {
          q: 'Can the VM take a single Bool instead of FlagProviding?',
          a: 'Yes for one flag the factory already interpreted: init(isNewCheckout: Bool) is even better. FlagProviding earns its keep when the screen reads several keys or you want to change keys without changing the VM init.',
        },
        {
          q: 'How does this interact with problem 3’s modules?',
          a: 'LiveFlags lives in App or a tiny Flags adapter module. Feature modules depend on FlagProviding (a tiny API module) or, better, receive already-chosen types from App and do not know flags exist.',
        },
        {
          q: 'Kill-switch for a broken payment method?',
          a: 'Factory reads the flag and omits the method (problem 7). Already-in-flight checkouts should not read a new value mid-charge. Snapshot flags at confirmation.',
        },
        {
          q: 'Is an experiment (A/B) different from a flag?',
          a: 'Same adapter, extra payload (variant, experiment id) for analytics. Still not LDClient in the VM. Attribution events fire from the composition of the variant, once, not from every body evaluation.',
        },
      ],
      teaches: [
        'Vendor SDKs live at the composition root',
        'VMs receive flag values, not LDClient',
        'Construction flags belong in factories',
        'Flag keys are a typed catalog',
        'Tests inject StaticFlags',
        'A singleton SDK is a hidden architecture',
      ],
    },
    {
      id: 'd5-p12',
      title: 'Twenty SPM packages for a four-person team',
      difficulty: 'Expert',
      kind: 'Judgment',
      prompt: `Same 4-person team as problem 10. App is 35 screens. CI is 4 minutes. They ship every week. A new hire from the 40-person org in problem 3 opens a PR: twenty local SPM packages (\`DesignSystem\`, \`Networking\`, \`Identity\`, \`ProfileAPI\`, \`Profile\`, \`FeedAPI\`, \`Feed\`, \`CheckoutAPI\`, \`Checkout\`, \`Analytics\`, \`Flags\`, six “shared” leftovers). Changing a color token requires a package version bump dance. Debug launch on a cold simulator feels like a clean build. The hire says this is how you avoid \`AppKitInternal\`.

Product still wants the email change this Friday. The junior who just learned \`ObservableObject\` now cannot find the settings screen across eight targets.

Do you merge the graph? What would you keep as a package, what stays a folder, and how is this different from problem 3’s 28-minute CI? When does a folder become a target?`,
      think: [
        'What pain exists today — 28-minute CI, two teams colliding, or a new hire’s muscle memory?',
        'What is the compile-time cost of twenty packages on a four-minute pipeline?',
        'Who has to understand the DAG to change a settings toggle?',
        'Is AppKitInternal the actual disease, or is it a 40-person symptom you do not have?',
      ],
      solution: `Do not merge twenty packages. Keep **one app target** (plus tests). Maybe **one** package if a named pain already exists.

Keep as a package only when you can name the pain in one sentence:

* A share extension / widget that must not link the 200 MB feed — then a tiny \`Identity\` or \`Drafts\` package, because the linker is the point.
* Two people already colliding on checkout and CI incremental compile is the bottleneck — then strangle checkout into a target, like problem 1, not twenty at once.
* A design system used by a second app in the company — then \`DesignSystem\`, because there is a second customer.

Leave as **folders plus import lint** (or nothing): Profile, Feed, settings, the color token. A folder named \`Checkout/\` with a factory is the boundary from problem 1. SwiftLint / a comment / review is enough until the compiler is the one complaining.

Reject in this PR:

* \`ProfileAPI\` + \`Profile\` as two packages for one PUT (problem 8’s grain, problem 10’s cathedral).
* A \`Shared\` package that accepts the leftovers — that *is* \`AppKitInternal\`, now with a \`Package.swift\`.
* Dynamic frameworks for twenty modules (launch time).
* Version-bump theatre between local packages that always ship in the same app binary.

Say to the junior: **a folder is a module until linking proves otherwise.** That sentence is in problem 3. Problem 3’s org was 40 people and 28 minutes. Yours is 4 people and 4 minutes. Copying their DAG is how you buy their ceremony without their problem.

Adopt the problem-3 graph when CI incremental is the KPI that moved, or when two feature teams cannot merge without a train. Not this Friday.`,
      explanation: `The new hire is trying to save you from a fire they have seen. Same instinct as the TCA PR in problem 10, different hydrant. Twenty packages is how a 40-person iOS org encodes the org chart in the linker so Payments does not recompile Profile. You do not have Payments-the-team and Profile-the-team. You have four people and a Slack channel. The disease in problem 3 was a god target and a weekly integration train. You do not have that disease. You have a color token in a package because the slide said DesignSystem.

Modularization is not free. Each package is a scheme, a test target someone will forget to run, an access-control debate (\`public\` everything so App can construct the feature), a slower clean build, a worse indexing experience in Xcode, and a junior who used to cmd-click from the settings view to the client and now lands in a different target with an internal type they cannot see. Four-minute CI will not stay four minutes if every PR dirties twenty Package.swift graphs. Incremental compile *can* get better with real boundaries. Twenty fake boundaries make incremental *worse*: Xcode rebuilds the world through a Shared dump that every package imports.

The senior move is the same proportionality as problem 10. Architecture is a response to pain you can name. A folder named Checkout with a protocol and a fake is the strangler. Promoting it to SPM is a later commit, when the widget cannot link Checkout or when CI tells you touching checkout recompiles the feed. Problem 3 said this out loud: until linking proves you need a package, a folder plus an import rule is a module. People skip that sentence because packages look like seniority on a résumé.

\`Shared\` as package number twenty is the tell. You split the app to kill the umbrella, then you rebuilt the umbrella so the packages could compile. That is not modularization. That is a rename.`,
      internals: `SwiftPM local packages in the same repo still have a DAG. A cycle fails the build. \`@_exported import\` in a Shared umbrella recreates problem 3 inside the packages. Access control: feature types become \`public\` so App can wire them; you lose \`internal\` as the compiler-enforced API. In a single target, \`internal\` was doing that work for free.

Clean builds versus incremental: many small packages can *help* incremental if the edges are real. They *hurt* clean and they hurt if everything imports Shared. Measure: touch a string in settings, time the rebuild, before and after. Package count is not the KPI. Problem 3’s KPI was “touch Payments, Profile does not recompile.” If you cannot write that sentence for a 4-person app, you are not in problem 3.

Launch: twenty dynamic frameworks are a dyld bill. Prefer static / mergeable if you ever do split. For four people, prefer not to split.

Tuist and Bazel are generated-project answers to merge hell and graph size. They are not a reason to create twenty packages so that Tuist has something to generate.`,
      testing: `The Friday test is the same as problem 10: can the junior change email without the new hire. If they must open eight targets to find \`updateEmail\`, you failed.

If you keep one package (say DesignSystem because a widget exists), CI runs that package’s tests when its files change, and the app tests otherwise. Do not clone twenty test targets that each boot nothing and take a minute to start.

A boundary test is cheap in a single target: SwiftLint \`isolated_imports\` or a grep that settings must not \`import\` a type from Feed. That is the stepping stone problem 3 offered. Use it. Do not skip to Bazel.`,
      pitfalls: `Merging the PR to “not block the new hire” and living with twenty schemes forever. The opposite: banning packages in the style guide so when the widget actually cannot link the feed you fight a holy war. Making every type \`public\` “for the package.” A Shared dump. Dynamic frameworks for the graph. Versioning local packages as if they were UIKit.

Copying this judgment onto the 40-person, 28-minute app and refusing to cut Payments out — that was not the lesson. Proportionality cuts both ways, same as problem 10.

A hybrid: twenty packages for checkout, one target for the feed, because each PR was a different new hire. Pick a default for the app.`,
      alternatives: `Folders named by feature, a README that says “this is the checkout boundary,” review that rejects \`URLSession\` in UI. That is the alternative, and it is complete for this team.

One \`Networking\` package if the share extension needs the client and must not need SwiftUI. That is a linker reason. One \`DesignSystem\` package if a second target (widget, watch) needs the colors. Not twenty.

If the new hire wants to teach modularization, strangle checkout into a target on a spike, measure incremental compile, pair. Same teaching move as the TCA spike on search in problem 10.`,
      tradeoffs: `Packages buy a real compiler boundary and cost schemes, \`public\`, and onboarding. In a 40-person org the trade can be rational: two teams, 28-minute CI, a train. In a 4-person org the same graph is imitating that rationality without the org chart. Under-modularizing a widget that pulls in the feed is how you miss the memory budget. Over-modularizing settings is how you get no Friday release.

The staff skill is the same sentence as problem 10, pointed at the linker: **different tools when a named pain is present.** Waiting is an architectural choice. A folder is not a failure to be senior.`,
      followups: [
        {
          q: 'When does a folder become a target in this company?',
          a: 'When a second binary cannot link it, when incremental compile of that folder dirties unrelated work as a measured KPI, or when two people own it on different cadences. Not when the new hire arrives.',
        },
        {
          q: 'Is DesignSystem an exception?',
          a: 'If a widget or a second app needs tokens, yes — one package, primitives only, no ProfileHeader that imports Profile (problem 3). If only this app exists, a folder is enough until the second customer appears.',
        },
        {
          q: 'How do you share User without an Identity package?',
          a: 'A tiny Identity.swift in the app target, or a view-specific DTO. The Identity *package* is for a second target that must not import Profile. Same type, later promotion.',
        },
        {
          q: 'Would you allow one Checkout package and nothing else?',
          a: 'Yes if checkout is the strangler that two people collide on, or a widget needs a tiny checkout status. No if settings must also split “for consistency” in the same PR.',
        },
        {
          q: 'How does this sit next to problem 10’s TCA rejection?',
          a: 'Same proportionality, different cathedral. TCA is a second language. Twenty packages are a second build graph. Keep the seam (a folder, a client protocol). Reject the graph you cannot justify with a number.',
        },
        {
          q: 'What do you tell the new hire who has seen AppKitInternal burn a year?',
          a: 'They are right about umbrellas. They are early about twenty packages. Ban Shared. Keep folders. Cut the first real target when the KPI moves. Invite them to measure, not to recreate their last org this Friday.',
        },
      ],
      teaches: [
        'A folder is a module until linking proves otherwise',
        'Package count is not a KPI',
        'Do not copy a 40-person DAG into a 4-person app',
        'Shared-as-package is the umbrella again',
        'Promote on measured pain, not résumé shape',
        'Proportionality applies to the linker too',
      ],
    },
  ],
}
