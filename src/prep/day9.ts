import type { PrepDay } from './types'

export const day9: PrepDay = {
  id: 'day-9',
  title: 'Day 9 — Testing',
  kicker: 'Seams, clocks, and honest green',
  intro:
    'A senior test suite is not coverage theatre. It is a seam you can lie to: time, the network, the Keychain, the store. These twelve problems are interviews about making async, UI, and persistence deterministic — and about the tests that look thorough while checkout still double-charges.',
  problems: [
    {
      id: 'd9-p1',
      title: 'ViewModel with five APIs, untestable async state',
      difficulty: 'Senior',
      kind: 'Review',
      prompt: `A HomeVM calls five endpoints, merges them, and exposes one \`state\`. Tests use \`DispatchQueue.main.asyncAfter\` and hit staging. Rewrite the testability story: seams, fake clocks, and how you assert a race (Day 2) without sleeping.`,
      think: [
        'What is the minimum protocol surface you would inject?',
        'How do you inject time and concurrency so CI is not the scheduler?',
        'Which states must be explicit so you are not asserting five booleans?',
        'What does a cancellation test look like with stubs instead of staging?',
      ],
      solution: `Inject a \`HomeLoading\` facade, or five tiny protocols if you need to force per-endpoint races. Tests pass stubs that return immediately, or that complete when the test says so.

State machine: \`idle → loading → partial → ready → failed\`. Do not publish five booleans.

\`\`\`swift
func testMergeOrder() async {
    let loader = FakeHome(user: .ok, feed: .delayed, notifs: .ok)
    let vm = HomeVM(loader: loader)
    await vm.load()
    XCTAssertEqual(vm.state, .ready(...))
}
\`\`\`

For the race: feed is delayed. Resume user and notifs first. Assert \`.partial\`. Then resume feed. Assert \`.ready\`. No \`asyncAfter(0.2)\`.

Cancellation: start load, \`task.cancel()\`, resume a stub, assert no terminal state from the late stub.

Clock: \`protocol Clock { func sleep(for: Duration) async }\` for debounce tests (Day 2 search). The fake clock advances when the test advances.

Staging is an integration environment, not a unit test. One URLProtocol integration test if you must.`,
      explanation: `The test suite was sleeping. DispatchQueue.main.asyncAfter(0.2), hit staging, hope the five endpoints returned in the order the author saw on wifi. CI is a different continent and a different mood. Twenty percent of the time — you will see this again in problem 2 — the sleep was not enough, or staging 500ed, or the race you wanted did not happen. That is not a HomeVM test. That is a weather report.

Deterministic fakes encode the contract. The VM does not get to call URLSession. It gets a loader you own. Immediate stubs make success and 401 cheap. Controllable stubs make the Day-2 race an assertion: you decide that feed is late, you assert partial, you resume feed, you assert ready. Cancellation is the same: the late stub must not win. Sleeping is how you encode the CI machine’s load into the expected duration of a merge. Fake clocks are how debounce tests run in milliseconds of CPU, not 300 ms of wall.

This is Day 4 dependency inversion plus Day 2 cancellation, now as an incident about the suite itself. The architectural seam is the test. If you cannot force 401 without staging, you do not have a seam. Five booleans is not a state machine; it is a way to be green while the UI is on a combination you never drew. One state enum is what you assert.`,
      internals: `XCTest expectation.fulfill on the wrong queue flakes. Prefer async/await tests so the scheduler is structured. MainActor.assumeIsolated in tests when the VM is main-actor isolated. Swift Testing is the same idea with different syntax.

A facade protocol is fewer fakes and hides per-endpoint races. Five stubs are how you force feed-late/user-first. Choose based on the bugs you have. You can start with a facade and split when a race test needs a delayed member.

URLProtocol is a process-wide URLSession seam. Useful for one integration test. Poisonous if every VM test installs a protocol and forgets to tear it down — order-dependent failures, which is staging with extra steps.

Clock injection: Task.sleep is not fakeable without a wrapper. Debounce tests that call real sleep are why CI is slow and yellow.`,
      testing: `This problem is the testing answer. Fakes, no network, no sleep, cancellation, failure injection, a race you control. One integration test with URLProtocol or a local server if you must prove headers. Snapshot tests for loading spinners are not a substitute for VM tests. A spy that records fifty calls and asserts nothing useful is not a test.`,
      pitfalls: `Default init that still hits live. open class for OCMock. Protocol for every DTO. asyncAfter “just this once.” Hitting staging in CI because the fake is tedious. Asserting isLoading && !isError && user != nil && feed != nil — five booleans, no model. Sharing one FakeHome singleton across tests.`,
      alternatives: `Swift Testing with traits. Point-free style dependencies. TCA TestStore with a TestClock. Same seams: inject the world, control time, assert state. Generic HomeVM<L: HomeLoading> without an existential if you prefer.`,
      tradeoffs: `A facade is fewer types and hides races — sometimes you want five stubs. Per-endpoint protocols are more mocks and more precise. Sleeping tests are faster to write and lie. Deterministic tests are more setup and tell the truth on CI. One URLProtocol integration test is worth it; a suite of them is a slower staging.`,
      followups: [
        {
          q: 'How do you test SwiftUI?',
          a: 'VM tests first. UI tests for navigation and accessibility. Hosting controller tests if you must poke the view. Do not start with a UI test of five endpoints.',
        },
        {
          q: 'What about Combine still in the VM?',
          a: 'Inject the scheduler. ImmediateScheduler in tests. The clock story is the same. Day 8: do not publish from a background queue even in tests.',
        },
        {
          q: 'Can you test the Day 5 token refresher this way?',
          a: 'Yes. Fake HTTP, fifteen concurrent validAccessToken() calls, assert one refresh. That test is why the actor exists. Sleep will never prove single-flight.',
        },
        {
          q: 'Is snapshot testing banned?',
          a: 'No. It tests layout. It does not test merge order. Use both, for their jobs.',
        },
      ],
      teaches: [
        'DI for async',
        'No-sleep tests',
        'State machines',
        'Fake clocks',
        'Cancellation tests',
        'Controllable races',
      ],
    },
    {
      id: 'd9-p2',
      title: 'Flaky UI test, 20% on CI only',
      difficulty: 'Senior',
      kind: 'Debug',
      prompt: `A UI test taps Login, waits, asserts Home. Locally it is green. On CI it fails ~20%: either the button is not hittable, or Home never appears within 5 seconds. The test uses \`sleep(2)\` after tap. Someone’s fix is \`sleep(5)\`. Another wants to disable the test. Walk the investigation like a flake, not like a product bug, and say what you change in the app and in the test.`,
      think: [
        'Is CI slower, or is the test waiting on the wrong thing?',
        'What animations, keyboards, network, and notifications make hittable false?',
        'Does the app talk to staging from a UI test?',
        'Is 20% a race in the app you have been ignoring (Day 2 / Day 5)?',
      ],
      solution: `Stop sleeping. Sleep is a race with a longer fuse. Twenty percent on CI is the fuse running out on a loaded VM.

Investigation order:

1. Read the failure screenshot and the XCTest video. Not hittable versus timeout versus wrong screen are different bugs.
2. Run the test 50 times locally with the simulator under load (other tests in parallel if you can). If it will not flake locally, look at CI: simulator version, CPU, network, whether staging is 500ing.
3. If the app hits staging, that is the flake. Inject a launch argument, stub with a local URLProtocol or a debug launcher that installs fakes. Problem 1, now at UI level.
4. Replace \`sleep\` with \`waitForExistence\` / \`XCTNSPredicateExpectation\` on a stable accessibility identifier. Wait for Home’s root, not for 2 seconds.
5. Disable animations in the test hook (\`UIView.setAnimationsEnabled(false)\`, speed up CA). Animations plus CI load is “not hittable.”
6. If Home’s five APIs still race, you may be asserting a state the app only reaches sometimes — that is an app bug, and the flake is a gift. Fix the VM, do not lengthen the sleep.

Do not disable the test. Quarantine it with a ticket if you must, with an owner. A disabled test is a lie in the suite.`,
      explanation: `Twenty percent CI-only is the most expensive colour of green. Locally you have a warm simulator, a fast network, and you watch the test once. CI has a cold sim, a noisy VM, and staging. sleep(2) after tap Login means “I hope login finishes in two seconds.” On CI, 20% of the time it does not, or the login button was covered by a system alert, or an animation left the control not hittable. sleep(5) drops you to 5% and trains the team to wait. Disabling the test drops you to 0% and trains the team to ship Login broken.

I would watch the video first. “Button not hittable” is often a keyboard, a banner, reduced animations off, or a hit point in the wrong place because the nav bar jumped. “Home never appears” is often still in a spinner because staging lagged, or because the token refresher logged you out (Day 5), or because the test asserted a label that appears after the slowest of five APIs. If the app is talking to staging, you do not have a UI test. You have a contract with a server you do not own. Launch arguments that install the same fakes as problem 1 make Login a state machine you control: 200, 401, 500, all green in milliseconds.

Sometimes the flake is real: Home’s merge really is racy, and CI is the only scheduler that exposes it. Then the UI test is an expensive detector, and the fix belongs in the VM with a unit test that does not sleep. Seniors are happy when a flake turns into a unit test. They are sad when it turns into sleep(5).`,
      internals: `XCUIElement.waitForExistence(timeout:) polls. sleep blocks. Polling is how you wait for a predicate. Identifiers should be on the element you mean, stable, not the English title that marketing will change.

Hittable: hit-point intersects the element, not covered, in the window. Animations, keyboards, permission alerts, and overlapping views make it false. UIView.setAnimationsEnabled(false) in a launch hook under a test argument. Keyboard: dismiss or use typeText on a field that is already first responder.

CI simulators: parallel device clones, CPU contention, first launch of the sim installing the app. Cold launch of the app is Day 8 inside your test budget. A 5-second timeout on first draw of 4.1 s is a 20% flake by math.

xcodebuild test-without-building, result bundles, and the xcresult video are the artefact. If CI does not keep videos, you are debugging with a string.`,
      testing: `This is the test. After the fix: 50× on CI, 0 flakes, no sleep, no staging. A unit test of HomeVM covers the merge. The UI test covers “login button to Home identifier” with a fake 200. A second UI test for 401 asserts the login error identifier. Accessibility identifiers are part of the product surface.

A flake dashboard that ignores 20% is how this lived so long. Track it.`,
      pitfalls: `sleep(5). Disabling the test. Waiting on a time-varying label (“Inbox (3)”). Hitting staging. Not recording videos on CI. tap() without waiting for hittable. Parallel tests sharing a simulator Keychain (Day 5 logout flakes). Asserting first frame during a 4-second launch on an overloaded VM. retry(3) around the whole test as a policy — you papered over 20% into 0.8% and called it done.`,
      alternatives: `EarlGrey, Maestro, a black-box tool — they all flake if you sleep and hit staging. Swift Testing is not a UI test runner. Snapshot tests will not tell you Login works. A smaller UI test surface plus a thick VM suite is the usual senior mix.`,
      tradeoffs: `Fakes in UI tests: you will not catch a broken staging contract. That is what one nightly integration test is for, isolated, allowed to be yellow without blocking the PR. Real animations in UI tests: closer to the user, flake more. Disable in CI, keep a nightly with animations if you care. Longer timeouts: hide launch regressions. Prefer signpost budgets in a performance test over a 30-second waitForExistence.`,
      followups: [
        {
          q: 'Is retrying the test three times OK?',
          a: 'As a temporary quarantine with an owner and a ticket, maybe. As a policy, you have accepted a 50% product bug as green. Fix the wait or the app.',
        },
        {
          q: 'The button is not hittable because of a system permission alert. App bug?',
          a: 'Test bug plus a missing launch argument to pre-grant. XCUIApplication handles system alerts if you add an interruption monitor. Do not sleep until the user taps OK.',
        },
        {
          q: 'Should this be a unit test instead?',
          a: 'The merge should. Login-to-Home navigation is a UI test. Split them. The 20% was probably the merge plus sleep.',
        },
        {
          q: 'How do launch arguments interact with Day 5 tokens?',
          a: 'A UI-test launch argument should install a fake TokenStore, not a real Keychain from the last test. Shared simulator state is a flake factory across the suite.',
        },
      ],
      teaches: [
        'No sleep in UI tests',
        'waitForExistence and identifiers',
        'CI load vs local',
        'Fake backends for UI tests',
        'Hittable and animations',
        'Flakes can be app races',
      ],
    },
    {
      id: 'd9-p3',
      title: 'Debounce tests that sleep 300 ms',
      difficulty: 'Senior',
      kind: 'Review',
      prompt: `Search fires eight requests while the user types. The VM debounces 300 ms with \`Task.sleep\`. Tests do \`await Task.sleep(nanoseconds: 350_000_000)\` and still flake when CI is loaded. Rewrite the clock. Show how you assert: one request after a burst, zero after cancel, and no request if the user types again inside the window — without waiting on wall time.`,
      think: [
        'What protocol do you put between the VM and Task.sleep?',
        'How does a fake clock advance without actually waiting 300 ms?',
        'What is the cancellation test for an in-flight debounce?',
        'Is ImmediateClock the right default in production?',
      ],
      solution: `Inject time.

\`\`\`swift
protocol Clock: Sendable {
    func sleep(for duration: Duration) async throws
}

struct FakeClock: Clock {
    var scheduled: [Duration] = []
    func sleep(for duration: Duration) async throws {
        try await continuation(duration) // test resumes this
    }
}
\`\`\`

The VM’s search Task sleeps on \`clock\`, then hits the loader. Production uses \`Task.sleep\`. Tests use a fake whose sleep does not return until the test says so.

Burst: type “c”, “ca”, “cat” without resuming sleep. Assert zero loader calls. Resume one 300 ms. Assert one call, query \`cat\`. Type again inside the window: cancel the previous sleep (the Task is cancelled, sleep throws \`CancellationError\`), assert the first query never fired.

Do not use \`DispatchQueue.main.asyncAfter\` in the VM or the test. Do not use a real 300 ms. ImmediateClock in every test will skip debounce entirely — useful to assert the loader, useless to assert the window. You need a controllable clock for the debounce contract, and an immediate one for tests that do not care.`,
      explanation: `The suite was sleeping. Three hundred and fifty milliseconds, hope the debounce fired, hope CI was not busy. Twenty percent of the time the sleep in the test finished before the sleep in the VM, or after a second keystroke, and Search looked racy when it was only slow. Wall time is not a seam. It is weather, the same weather as problem 1’s asyncAfter and problem 2’s sleep(2).

A clock protocol is Day 2’s debounce made testable. The VM does not get to call Task.sleep any more than it gets to call URLSession. The test owns the instant the 300 ms elapses. Typing “c-ca-cat” without resuming sleep is the burst assertion: zero requests. Resuming once is the “one query, latest term” assertion. Cancelling the Task before resume is the “user popped search” assertion. None of that is 350 ms of CI CPU.

Seniors get this wrong by injecting ImmediateClock everywhere and then wondering why debounce bugs ship. Immediate is for tests that assert mapping and 401, not for the window. The window is a product contract: we will not hit search-as-you-type on every character because the search cluster is not free. The fake clock is how that contract is a unit test instead of a flake. If you cannot force the third character to win without waiting, you do not own time.`,
      internals: `\`Task.sleep\` is cancellation-aware. A cancelled sleep throws. The VM must swallow that and not call the loader. A fake clock should throw on cancel too, or you will green a VM that fires after pop.

Combine’s \`debounce(for:scheduler:)\` needs an injected scheduler. \`ImmediateScheduler\` is the Combine spelling of ImmediateClock. \`TestScheduler\` / a virtual clock is the spelling of FakeClock. Same design.

Swift Testing and XCTest both work; the seam is the clock, not the runner. \`withDependencies\` / a Clock in the initializer — pick one, do not read \`Date()\` inside the VM for this.`,
      testing: `This problem is the test. Burst, single fire, cancel, type-inside-window. Run 1_000× on CI with a fake clock: still milliseconds, still green. A spy loader records queries. No network. No sleep. One integration test that types into a hosted search field can exist; it is not this.`,
      pitfalls: `await Task.sleep in the test “just this once.” ImmediateClock as the only fake. A clock that cannot throw cancellation. Debouncing in the view with a Task in onChange and no seam. Using Date() deltas. Advancing a Combine TestScheduler but the VM still sleeps on Task.sleep — two clocks.`,
      alternatives: `swift-clocks (TimePoint / ImmediateClock / TestClock). TCA’s TestStore clock. A debounce actor that vends an AsyncSequence of queries — you test the actor with a fake sleep the same way. All valid. The invariant is: tests do not wait 300 ms.`,
      tradeoffs: `A clock protocol is a type every VM pays for and the reason debounce is honest on CI. Immediate everywhere is less code and will ship the eight-request bug. Real sleep in tests is faster to write and is problem 2 waiting to happen. Virtual time can surprise you if two sleeps interleave — make the fake explicit about which sleep you resume.`,
      followups: [
        {
          q: 'How do you test cancellation of the in-flight search, not just the sleep?',
          a: 'Resume the clock, start the loader with a controllable stub, cancel the Task, resume the stub, assert the late 200 does not become state. Problem 1’s late stub, now with a clock in front.',
        },
        {
          q: 'Does Swift Testing change the clock story?',
          a: 'No. Different syntax, same seam. Do not sleep in the test to wait for the product’s sleep.',
        },
        {
          q: 'Where does MainActor sit?',
          a: 'The VM can be @MainActor. The clock’s sleep is not UI. Fake sleep should not hop to main just to resume; the test resumes, then awaits the VM’s next state on MainActor.',
        },
        {
          q: 'Is 300 ms the thing you snapshot?',
          a: 'No. Snapshots do not test time. A constant you inject is a product choice you can assert with the fake: advance 299, zero calls; advance 300, one call.',
        },
      ],
      teaches: [
        'Injected clocks',
        'No wall-time debounce tests',
        'Burst versus single fire',
        'Cancellation throws out of sleep',
        'ImmediateClock is not the debounce test',
        'Latest query wins',
      ],
    },
    {
      id: 'd9-p4',
      title: 'URLProtocol for every test, order-dependent CI',
      difficulty: 'Senior',
      kind: 'Incident',
      prompt: `The suite “doesn’t need protocols.” Every VM test installs a \`URLProtocol\` stub on \`URLSessionConfiguration.ephemeral\`, except some tests forget to tear down and some use \`URLSession.shared\`. CI fails depending on test order: a 401 from Search appears in Home’s test. When do you use URLProtocol, when do you use a protocol seam, and how do you stop the process-wide stub from becoming staging?`,
      think: [
        'What does URLProtocol actually intercept, and what does it miss?',
        'Why is shared session poison in a suite that stubs via configuration?',
        'What is the one test URLProtocol is for?',
        'How do you make teardown reliable if a test fails mid-install?',
      ],
      solution: `Two seams, two jobs.

**Protocol / facade (problem 1).** Almost every VM test. \`HomeLoading\` returns values the test controls. No HTTP, no URLProtocol, no order. This is the default.

**URLProtocol.** One (maybe a handful) of integration tests that prove the real adapter: headers, 401 join refresh, decode of a fixture body, pinning’s happy path against a local server. Install on an ephemeral configuration you own, never on \`.shared\`. Register in \`setUp\`, unregister in \`tearDown\` — Swift Testing: a trait / \`defer\`. The session under test is constructed in the test, not a process singleton.

Never: a global \`URLProtocol.registerClass\` that outlives the test. Never: stubbing \`shared\` for the VM suite. Never: twelve tests that all install different stubs on the same configuration object.

If Search’s 401 appears in Home, you have process-wide state. Find the leftover register, delete it, replace those tests with fakes. Keep one URLProtocol test that asserts the adapter maps 401 to \`AuthError.refresh\` — that is the contract with HTTP, which problem 11 will also hit from the other side.`,
      explanation: `The team avoided “extra protocols” and built a worse one. URLProtocol is a process-wide gun. It is the right gun for proving that your real URLSession adapter sends the header you think it sends. It is the wrong gun for HomeVM’s merge order. Once two tests register class stubs, or one test uses URLSession.shared while another installs on ephemeral, order is a dependency. CI shuffled the suite, Search’s 401 handler was still registered, Home decoded an error body as a feed. Green locally, red after an unrelated PR. That is staging with extra steps, which you already refused in problem 1.

Seniors keep a tiny HTTP surface that is actually HTTP: the adapter. Everything above it takes a protocol you can fake in RAM. The adapter test may use URLProtocol or a local stub server. It must construct its own session, and it must tear down even when the assertion fails. URLSession.shared is never the test’s session; it is the production convenience that makes this incident possible.

The fix is not a smarter URLProtocol. It is fewer of them. When Home’s test needs a delayed feed, that is a FakeHome, not a canned HTTP response racing another test’s canned HTTP response. If you cannot explain why this test must see bytes on the wire, it should not.`,
      internals: `\`URLProtocol.registerClass\` is global. \`URLSessionConfiguration.protocolClasses\` is per session — better, still easy to leak if you cache the session on a singleton. \`URLSession.shared\` ignores your ephemeral configuration.

URLProtocol cannot see everything: some WebKit loads, some HTTP/3 edge cases, metrics. A local HTTP server (NIO, a fixture process) is the next step up for pinning and redirects.

Swift Testing parallelises. Global URLProtocol plus parallel tests is a flake factory. Serialise the few integration tests, or do not share process state. XCTest’s \`setUp\`/\`tearDown\` is not enough if the session is a static and tearDown did not run.`,
      testing: `After the fix: VM tests have zero URLProtocol. One adapter test installs, asserts, unregisters; run it next to Home 1_000×, no bleed. A lint or a DEBUG assert that \`URLSession.shared\` was not used under test. Problem 2’s UI tests get launch-argument fakes, not a protocol installed from the test runner into the app process unless you designed that path.`,
      pitfalls: `open class for OCMock instead of a seam. Stubbing shared. Forgetting unregister on failure. Parallel Swift Testing with a global register. Using URLProtocol to fake Keychain — that is problem 9. Asserting request order across two tests via leftover stubs. Calling this “contract testing” without a schema (problem 11).`,
      alternatives: `A local stub server for the adapter. OHHTTPStubs, Hyperion — still global if you let them be. Point-free’s URLRequest dependency. The best alternative to 40 URLProtocol tests is 40 fakes and 1 protocol test.`,
      tradeoffs: `A facade hides HTTP mistakes — that is why you keep one adapter test. URLProtocol everywhere: realistic bytes, order-dependent CI. Per-test sessions: more setup, isolation. Parallel tests: faster CI, illegal with process-wide stubs. Serialise the few, parallelise the rest.`,
      followups: [
        {
          q: 'Can UI tests use URLProtocol?',
          a: 'Only if the app process installs it under a launch argument. The XCTest process cannot intercept the app’s URLSession. That is problem 2’s fake backend, not this class.',
        },
        {
          q: 'Where does token refresh get tested?',
          a: 'Fake HTTP at the client protocol for the single-flight unit test (Day 5). One URLProtocol integration that returns 401 then 200 with a new token, asserting one refresh. Two seams, two tests.',
        },
        {
          q: 'Why not always a local server?',
          a: 'Heavier, still a port on CI, still not a VM test. Perfect for pinning and redirects. Excessive for feed-late/user-first.',
        },
        {
          q: 'Search’s 401 leaked into Home. App bug?',
          a: 'Test isolation bug until proven otherwise. Then look whether production uses shared state the same way. The flake is a gift if the app actually has a global session stub.',
        },
      ],
      teaches: [
        'Facade vs URLProtocol',
        'No shared session in tests',
        'Teardown is isolation',
        'One adapter integration test',
        'Parallel tests vs global stubs',
        'Process-wide state is staging',
      ],
    },
    {
      id: 'd9-p5',
      title: '400 snapshots, every font change is a red CI',
      difficulty: 'Senior',
      kind: 'Incident',
      prompt: `A PR that bumps Dynamic Type tests fails 400 PNG diffs. CI is 22 minutes of snapshot comparison. Last quarter someone recorded iPhone 16 Pro at 3× into the suite; iPhone SE tests were never added. A checkout bug shipped because the snapshot still showed a spinner, and no VM test asserted 402. Snapshot versus unit: what you keep, what you delete, and how snapshots go wrong.`,
      think: [
        'What question does a PNG answer that a state enum does not?',
        'What must be pinned or the diff is noise: device, scale, locale, OS, fonts?',
        'When is a snapshot a substitute for a VM test — and when is that how 402 ships?',
        'How many snapshots does a senior suite actually want?',
      ],
      solution: `Snapshots test layout: spacing, truncation, a11y text size, RTL, empty and error chrome. They do not test merge order, 402, debounce, or cancellation. Those are VM / store tests (problem 1). The checkout spinner that never became “paid” was a missing state assertion. Keep the snapshot of the failed-pay layout; add the store test that 402 is \`.failed(.declined)\`.

Pin the world: one device class per snapshot (or precise names: \`payFailed_se_light_en\`), scale, locale, OS you registered. Record on CI’s simulator, not on your Pro. Dynamic Type: a small matrix (large, AX3) on the screens that truncate, not 400 screens times every size.

Delete: snapshots of loading spinners that change every animation frame; per-cell snapshots that duplicate the design system; snapshots whose only assertion is “this PNG exists.” Recatalog: a handful per feature of the states a designer would argue about.

CI: run snapshots on a nightly or a dedicated job, not on every PR unless the PR touches UI chrome. PR runs unit tests and a smoke. A font bump is allowed to update snapshots in one owned PR, not to block checkout logic.

Point-and-record without a reviewer looking at the PNG is how you bless a bug. Review the image, or do not have the test.`,
      explanation: `Four hundred PNGs felt like quality. A font bump proved they were a coupling to UIKit’s text engine. Twenty-two minutes of CI proved they were also a tax. The checkout bug proved they were not tests of money: the snapshot was a spinner, which is what the screen looks like while you are still hoping, and nobody had asserted the 402 state machine. Snapshots answer “does this layout still look like the picture we blessed.” They do not answer “did we charge twice.” Mixing those questions is how a suite gets huge and a product stays wrong.

Seniors keep a few pictures of states that are visually load-bearing: empty, error, a long German string, AX text that must not clip the pay button. They pin device and scale so a Pro recording is not an SE failure. They record on the CI sim. They refuse to snapshot every cell of the design system — that is the design system’s own suite, or Figma, not Home. And they never let a PNG replace the store test for 402, debounce, or cancellation.

The font-change PR should be boring: update the handful of snapshots, a human glances at the diffs, merge. If that PR is 400 files, you did not have snapshots. You had a copy of the app in git, at one type size, on one phone. Delete until a designer would sit through the review.`,
      internals: `Snapshot libraries hash pixels. Any change in sim OS, render pipeline, or font fallback diffs. Precision thresholds hide real clipping if you crank them to silence CI.

Hosting: \`UIHostingController\` + a window, or UIKit snapshot of a laid-out view. You must layout (bounds, \`layoutIfNeeded\`) or you snapshot zeros. Dynamic Type requires setting the trait collection on the window, not hoping the sim matches your Mac.

CI simulators: one named device, one OS. Record in that environment. Checking in 3× Pro assets and running SE is a guaranteed red.

Animation: disable, or snapshot a settled state. Problem 2’s \`setAnimationsEnabled(false)\` applies here too.`,
      testing: `After the cull: PR CI does not run 400 PNGs. Checkout has a store test for 402 and a snapshot of the declined layout only. A weekly job records a small matrix. Reviewers must open the image diff; a bot that auto-accepts is the incident again.`,
      pitfalls: `Auto-accepting diffs. Snapshot of a live clock or relative date. Recording on device, running on sim. Threshold 0.1 to hide Dynamic Type. Snapshot as the only checkout test. Per-locale × per-device × per-state combinatorial explosion. iPhone 16 Pro-only goldens.`,
      alternatives: `Accessibility snapshot (text, identifiers) without pixels — stabler, misses clipping. Precisely pinned SwiftUI \`assertSnapshot\` of a tiny view. Designer visual QA for the rest. Unit-test frame widths of a truncating label if clipping is the bug.`,
      tradeoffs: `Pixels catch clipping that state enums miss, and they break on fonts. A small matrix is honest; 400 is theatre (problem 12). Nightly snapshots: slower feedback, faster PRs. PR snapshots: you see layout regressions before merge, and font bumps hold the train. Prefer a handful on PR, the rest nightly.`,
      followups: [
        {
          q: 'Snapshot versus unit — which tests 402?',
          a: 'Unit / store. The snapshot may show the declined screen. It must not be the only 402 test. Money is a state machine.',
        },
        {
          q: 'Do you snapshot SwiftUI and UIKit differently?',
          a: 'Same rule: settled layout, pinned traits. SwiftUI needs a hosting controller and a real window. UIKit needs layoutIfNeeded. Neither likes animation.',
        },
        {
          q: 'Should the design system have snapshots?',
          a: 'A few, in that module, for buttons and typography at AX sizes. Features should not re-snapshot the primary button 40 times.',
        },
        {
          q: 'CI is 22 minutes because of snapshots. Architecture?',
          a: 'Yes. Same as a 28-minute suite in Day 10: the DAG and the test pyramid are architecture. Move pixels off the PR critical path.',
        },
      ],
      teaches: [
        'Snapshots test layout, not money',
        'Pin device, scale, locale, OS',
        'Cull until a human can review',
        'Record on CI’s simulator',
        '402 is a store test',
        'Font bumps must not block checkout',
      ],
    },
    {
      id: 'd9-p6',
      title: 'async XCTest versus Swift Testing, and the MainActor VM',
      difficulty: 'Senior',
      kind: 'Review',
      prompt: `HomeVM is \`@MainActor\`. Half the suite is XCTest \`waitForExpectations\`, half is \`async\` XCTest, a new file is Swift Testing. A test calls \`vm.load()\` from a nonisolated test function, hits “Main actor-isolated property cannot be used,” then the author wraps everything in \`MainActor.run\` and the debounce clock (problem 3) deadlocks. How do you test a MainActor VM, and which runner do you pick for new tests?`,
      think: [
        'Where does the test function run, and where does the VM live?',
        'Why does MainActor.run around a sleep-on-main clock deadlock?',
        'What does Swift Testing’s isolation / traits give you that XCTest does not?',
        'Do you mix runners in one target forever?',
      ],
      solution: `The VM is MainActor. The test must hop there for reads and writes, and must not hold MainActor across a wait that needs main to drain.

XCTest:

\`\`\`swift
@MainActor
func testLoad() async {
    let vm = HomeVM(loader: FakeHome())
    await vm.load()
    XCTAssertEqual(vm.state, .ready(...))
}
\`\`\`

Mark the test \`@MainActor\` (or the XCTestCase subclass for UI-affine tests). Do not \`waitForExpectations\` plus a global main queue fulfill — that is the flake factory. Prefer async tests.

Do not \`await MainActor.run { await clock.sleep() }\` if the fake clock resumes on main and the run is waiting for the sleep. Resume the clock from the test after releasing the actor hop. Same deadlock shape as \`main.sync\`.

Swift Testing: \`@Test @MainActor func\`, \`#expect\`, traits for serial / tags. Structured concurrency is native. Parameterized tests beat copy-paste 401/500. New unit tests can be Swift Testing. XCTest stays for XCUI, performance metrics, and the existing suite until you migrate. Do not rewrite 800 tests to look modern in a week.

Isolation: fakes that talk to the VM should be Sendable or also MainActor. A fake that completes on a background executor is required at least once (Day 8 TSan) — then hop the assignment in production code, not by making the fake MainActor to silence the compiler.`,
      explanation: `The compiler was not being pedantic. HomeVM’s state lives on the UI actor. A nonisolated test that touches state is the same bug as publishing from a URLSession queue, except at compile time you got lucky. The author then wrapped the world in MainActor.run, including a fake clock that needed main to resume, and the test hung until CI timed out. That hang is problem 8’s main.sync wearing a test costume.

Async XCTest with the test function on MainActor is enough: await load, assert state, done. waitForExpectations is how the old suite encoded races. You can leave it until it flakes; you should not write another. Swift Testing is the same idea with #expect and traits. It is a good default for new VM tests. It is not a reason to freeze the train while you migrate. XCUI and XCTOSSignpostMetric still live in XCTest.

The MainActor VM is correct for UI state. Tests that only ever complete fakes on main will never see Day 8’s TSan race. Once, the fake should complete off main so the hop in production is forced. Always, the test should not hold MainActor while waiting for a callback that also needs MainActor. Structured concurrency makes that obvious: you await the VM, you do not nest run loops. Seniors pick a runner per kind of test and they do not deadlock the actor they came to verify.`,
      internals: `\`@MainActor\` on a class serialises it. XCTest’s default test execution is not MainActor unless you mark it. Swift Testing: isolation follows the function. \`confirmation\` / old expectations fulfill on whatever queue you call them from — fulfill on the wrong queue was a classic flake.

\`MainActor.assumeIsolated\` in a test that is already on main is fine. \`assumeIsolated\` in a background completion is a crash waiting. Prefer await MainActor.run for short assignments.

Deadlock: MainActor.run { await somethingThatNeedsMainToResume }. The run occupies the actor; the resume cannot hop on. Fake clocks and controllable stubs must resume from outside that scope.

Swift Testing parallel by default. Shared Keychain, URLProtocol, or a file — serialise those tests (problem 4, problem 9).`,
      testing: `A canary test: fake completes on a background executor, VM is MainActor, assert state on main, TSan clean. A second test that would have deadlocked (run around sleep) should not be written; code review is the check. Migrate one module to Swift Testing as a pattern, not 800 files.`,
      pitfalls: `waitForExpectations(timeout: 5) in new tests. MainActor.run around the whole test. Making the fake @MainActor to silence TSan and never completing off main. Rewriting the suite as the sprint. Mixing #expect and XCTAssert in one function without a rule. Assuming Swift Testing runs XCUI.`,
      alternatives: `Keep XCTest async for everything until the org standardises. Fine. Quick/Nimble is not a MainActor strategy. TCA TestStore if you already bought that clock. The runner is not the architecture; isolation is.`,
      tradeoffs: `Swift Testing: better parameterization and traits, two runners in one repo until XCUI catches up. XCTest-only: one mental model, older async edges. @MainActor tests: simple assertions, easy to deadlock if you nest waits. Nonisolated tests plus hop: more verbose, harder to hold the actor accidentally.`,
      followups: [
        {
          q: 'Can you unit-test a @MainActor VM without a run loop?',
          a: 'Yes. async tests await the VM. You do not spin the loop. UI tests and hosting tests (problem 8) are the ones that need a window.',
        },
        {
          q: 'Where does Swift Testing lose?',
          a: 'XCUI, some performance APIs, and the existing XCTest Case subclasses you will not migrate this quarter. Use it for new store/VM tests.',
        },
        {
          q: 'How do you assert a publish happened on main?',
          a: 'The VM is MainActor so the assignment is on main by construction. A spy on objectWillChange that records pthread_main_np is optional; TSan plus the hop is the real check.',
        },
        {
          q: 'Is confirmation { } better than XCTestExpectation?',
          a: 'For async Swift Testing, yes — structured. Do not mix an expectation fulfill on a random queue with an async test. Pick one style per test.',
        },
      ],
      teaches: [
        'Test isolation matches the VM',
        'async tests not expectations',
        'Do not hold MainActor across waits',
        'Swift Testing for new unit tests',
        'XCTest remains for XCUI',
        'Fakes must complete off main once',
      ],
    },
    {
      id: 'd9-p7',
      title: 'Testing an actor: reentrancy and single-flight refresh',
      difficulty: 'Expert',
      kind: 'Review',
      prompt: `Day 5’s \`TokenRefresher\` is an actor. The bug was fifteen 401s, fifteen refreshes. A junior wrote a test that calls \`validAccessToken()\` once and asserts a token. Another used \`DispatchQueue.concurrentPerform\` and slept. How do you test actor isolation, reentrancy (\`await\` inside the actor letting a second call in), and single-flight — without sleeping and without pretending the actor is a class?`,
      think: [
        'What does a second call do while the first is awaiting URLSession?',
        'How do you hold the first refresh open until the fifteenth has joined?',
        'Will TSan catch a logic race that still returns two POSTs?',
        'What do you mock — the actor, or the HTTP client it calls?',
      ],
      solution: `Do not mock the actor. Mock the \`TokenClient\` it awaits. The actor is the thing under test.

Controllable client: first \`refresh()\` does not return until the test resumes it. Spawn fifteen \`Task\`s calling \`validAccessToken()\`. Assert the client’s refresh count is 0 before resume (they are waiting), then 1 after resume, and all fifteen tasks receive the same new token. No sleep. The join is the contract.

Reentrancy: if someone writes \`await client.refresh()\` then a second hop into the actor that starts another refresh, the test above goes red (count == 2). That is the test you wanted. Actors do not lock across await. Single-flight is a flag / Task stored on the actor, not “it is an actor so we are fine.”

Cancellation: cancel the fifteen tasks while refresh is held, resume the client, assert you did not write a token after logout if logout cleared state — or assert the in-flight refresh still completes once and waiters that were cancelled do not apply it. Be explicit; this is product.

TSan is the memory race detector. Two POSTs is a logic race. The test is the detector. A class with a lock can pass TSan and still double-refresh; so can an actor.`,
      explanation: `“It’s an actor” is not a test. Actors serialise work until they await. The whole 401 storm happens across the await of /refresh. If the implementation starts a second POST because the flag is cleared too early, you have fifteen refreshes with perfect isolation and a logout bug. The junior’s single-call test was a constructor test. concurrentPerform plus sleep was problem 1’s weather report on a mutex.

The senior test holds the door open. A fake client that does not complete until the test says so is a clock for I/O. You pile fifteen waiters, you look at the spy count, you resume once. That is single-flight as an assertion, the same shape as feed-late/user-first in problem 1. Reentrancy is why the assertion can fail: someone awaited, the actor accepted a new call, a second POST went out. You want that failure in CI, not in production at expiry.

Do not replace the actor with a protocol in the test unless you are testing a caller. The refresher’s callers get a fake refresher. The refresher itself gets a fake HTTP. Layers. Sleeping until “probably all fifteen started” is how you green a broken join on a fast Mac and red it on CI, or the opposite. Controllable stubs start when you start them. Seniors do not mock the isolation; they mock the I/O the isolation was built to tame.`,
      internals: `Actor reentrancy: at await, another queued call may run. A \`inFlight: Task<String, Error>?\` that waiters join is the usual single-flight. If you nil inFlight before waiters finish applying, races. If you await client.refresh() without storing the Task first, a second caller starts a second POST.

\`Task\`s in tests: unstructured is fine if you await them all. \`withTaskGroup\` is cleaner. Do not \`Task.detached\` unless you mean to leave MainActor; the refresher actor is its own isolation.

Cancellation: \`Task.checkCancellation()\` after await. A cancelled waiter should not apply a token if logout won. Product choice, test both if both are allowed.

TSan on actor code is often quiet. Quiet is not two POSTs.`,
      testing: `The fifteen-waiter test is required in the platform module. Add: failed refresh logs everyone out once; second expiry after success is a new single POST; cancelled waiters. Run TSan nightly, but do not skip the logic test because TSan was green.`,
      pitfalls: `Mocking the actor. Sleeping until 15 started. Asserting isolation with Thread.current. Nilling inFlight too early to “let the next one in.” Using a class fake of the actor that is not isolated and proving nothing. One-call happy path as the only test.`,
      alternatives: `A lock plus a class — then you test the same join, and you have to worry about memory races TSan will actually see. Combine shareReplay hacks — harder to cancel. The actor plus a fake client is the clean test surface.`,
      tradeoffs: `Holding refresh open in tests: more fake machinery, the only proof of join. Real network soak: will never reliably prove single-flight. Detached tasks in tests: expose hops, more isolation noise. Prefer structured groups.`,
      followups: [
        {
          q: 'Does an actor make TokenRefresher thread-safe?',
          a: 'It serialises methods. It does not merge awaits. Single-flight is your flag/Task. The test is fifteen waiters, one POST.',
        },
        {
          q: 'How is this different from TSan on @Published?',
          a: 'Day 8 TSan is conflicting memory access. Two POSTs can be data-race-free. Different instruments. Both required.',
        },
        {
          q: 'Where does the fake clock go?',
          a: 'On backoff between retries, problem 3. Do not fake the actor’s isolation with a clock. Fake the sleep of retry, hold the HTTP stub for the join.',
        },
        {
          q: 'Can you test this with URLProtocol?',
          a: 'You could delay the HTTP response. You already know from problem 4 why that is the second test, not the first. Fake client, then maybe one adapter test.',
        },
      ],
      teaches: [
        'Do not mock the actor',
        'Reentrancy across await',
        'Single-flight as an assertion',
        'Hold I/O open in tests',
        'TSan ≠ logic races',
        'Fifteen waiters, one POST',
      ],
    },
    {
      id: 'd9-p8',
      title: 'Testing SwiftUI: hosting, identifiers, and what the VM already proved',
      difficulty: 'Senior',
      kind: 'Judgment',
      prompt: `A reviewer demands “SwiftUI unit tests” for Home: find the Login button via hosting, tap it, assert a Text. The VM already has the five-API tests from problem 1. Another reviewer wants only XCUI. What do you test in a \`UIHostingController\`, what do you leave to the VM, what do you leave to XCUI, and how do you avoid testing SwiftUI itself?`,
      think: [
        'What can hosting see that the VM cannot?',
        'What will break when SwiftUI changes its view graph?',
        'Where do accessibility identifiers belong?',
        'Is a tap on a hosted button a unit test or a slow UI test in denial?',
      ],
      solution: `Three layers, three jobs.

**VM / store (problem 1).** State machine, merge, 401, cancellation, debounce. Fast, no window.

**Hosting tests, rare.** When the bug is “this view never put the identifier on the error,” or a representable’s identity, or a button disabled bound to the wrong flag. Host \`HomeView(vm: fakeVM)\` in a window, \`layoutIfNeeded\`, \`XCUIElement\` is usually overkill here — inspect the hierarchy via identifiers, or query \`UIView\` for accessibility. Do not tap through 300 ms animations. Set the VM state, assert the hosted view’s accessible children.

**XCUI (problem 2).** Navigation you cannot see from a VM: Login → Home, system alerts, launch arguments. Fakes installed in the app process. No staging.

You do not test that \`ForEach\` iterates. You do not dump the SwiftUI inspector and assert fourteen \`ModifiedContent\` types. You do not host the whole app to assert feed merge order.

Identifiers are product surface. \`home.root\`, \`home.payError\`, \`login.submit\`. Stable. Not the English title. Hosting and XCUI both use them. If the identifier is missing, that is a useful hosting test. If the merge is wrong, that is a VM test and the hosting test would only see the symptom.`,
      explanation: `“Test SwiftUI” is how you get a suite that fails when Apple renames a modifier and still misses 402. The view is a projection of state. If the state machine is a lie, a hosted tap will lie with it, slower. If the state machine is true and the pay button has no accessibility identifier, a VoiceOver user and your XCUI test both suffer. That second thing is worth a hosting test. The first is problem 1.

I have seen teams spin a UIHostingController, search the graph for a Text(“Inbox”), and call it a unit test. It needed a window, a run loop, and it broke when marketing changed the copy. The VM already knew inboxCount == 3. The hosting test should have asserted the identifier \`home.inbox\` exists when state is ready, or it should not have existed.

XCUI still earns its keep for the journey: launch argument, fake 200, login button hittable, home.root exists. That is problem 2. Hosting is the thin middle: bindings and identifiers, not journeys, not JSON. Seniors push tests down until a window is required. Then they use a window. They do not start with a window because the view file is what the intern touched.`,
      internals: `\`UIHostingController\` needs to be in a \`UIWindow\` that is key and visible or SwiftUI may not run the body you think. Trait collections for Dynamic Type (problem 5). \`ViewInspector\`-style libraries parse the graph; they couple you to SwiftUI internals. Prefer accessibility trees.

\`.accessibilityIdentifier\` on the view you mean. Not on a wrapper that disappears in a stack. \`accessibilityIdentifier\` is available to XCUI and to UIKit queries.

Representables: test the UIView/UIViewController with UIKit tests, and test that SwiftUI identity is stable (a host that sets a sibling @State should not recreate the session — Day 8 / Day 10 camera). That is one of the few hosting tests that finds real bugs.

\`@MainActor\` views: problem 6. Host on main.`,
      testing: `A matrix: VM tests green without hosting. One hosting test per feature for the error identifier. One XCUI journey. If a bug can be reproduced by setting \`vm.state = .failed(.declined)\` and reading an identifier, it is not an XCUI test.`,
      pitfalls: `ViewInspector on every screen. Tapping in hosting with real delays. Asserting English copy. Hosting the app’s composition root so you hit staging. Testing ForEach. Skipping identifiers because “SwiftUI previews are enough.” Using hosting to sleep until a Task in onAppear finishes — inject the VM, do not wait.`,
      alternatives: `Preview snapshots (problem 5) for layout. XCUI only — slower, still needs identifiers. UIKit Home with straightforward view tests — valid, not a reason to rewrite. Accessibility audits as a separate pass.`,
      tradeoffs: `Hosting tests: faster than XCUI, more brittle than VM tests, unique for identifiers and representable identity. XCUI: real navigation, flakes if you sleep. VM only: you can ship a screen with no a11y identifiers. All three, thin, is the mix.`,
      followups: [
        {
          q: 'The reviewer wants 80% of tests to be SwiftUI hosting. Response?',
          a: 'No. Coverage of the view graph is not coverage of the product. Push down. Hosting for identifiers and representables. Quote problem 12 if they bring percentages.',
        },
        {
          q: 'How do you test a Button action without XCUI?',
          a: 'The action calls the VM. Unit-test the VM method. Hosting-tap is a slow duplicate unless you are proving the binding is wired — one test, not twenty.',
        },
        {
          q: 'SwiftUI onAppear starts a Task. Where is that tested?',
          a: 'The Task should call a VM method you already test. If onAppear is the composition, a hosting test can set a spy VM and assert load() was called once. Do not sleep for the five APIs.',
        },
        {
          q: 'Does this replace snapshots?',
          a: 'No. Snapshots are layout pixels (problem 5). Hosting identifier tests are a11y wiring. VM tests are behaviour. Three different questions.',
        },
      ],
      teaches: [
        'Push tests down until a window is required',
        'VM for state, hosting for identifiers',
        'XCUI for journeys',
        'Do not test SwiftUI internals',
        'Identifiers are product surface',
        'Representable identity is a hosting bug',
      ],
    },
    {
      id: 'd9-p9',
      title: 'Keychain tests that hit the real keychain on CI',
      difficulty: 'Expert',
      kind: 'Incident',
      prompt: `Logout tests flake 10% on CI: the next test still sees a token. Tests talk to the real Keychain. Parallel Swift Testing made it worse. Staging is not involved. Design a \`TokenStore\` seam, what you never put in UserDefaults even in tests, and how simulator Keychain plus app groups plus extensions turn into flakes (Day 5, Day 10 widget).`,
      think: [
        'What is the protocol surface — get/set/delete, or the whole SecItem API?',
        'Why is the real Keychain shared across tests and sometimes across apps on a sim?',
        'Can the fake store the refresh token in a dictionary without teaching production to use UserDefaults?',
        'How do UI tests isolate Keychain from the last run?',
      ],
      solution: `\`TokenStore\` protocol: \`load() throws\`, \`save(Session) throws\`, \`delete() throws\`. Production: Keychain, AfterFirstUnlock, access group if the NSE/widget needs it. Tests: \`FakeTokenStore\` with an in-memory dictionary, optional failure injection (\`throw status errSecInteractionNotAllowed\`).

Never: UserDefaults as the fake of a refresh token — someone will copy it to production. Never: the real Keychain in unit tests. Never: a singleton store without reset in \`tearDown\`.

CI flakes: parallel tests sharing one fake singleton; or real Keychain items leftover because delete failed; or UI tests without a launch argument that installs a fake / wipes the test keychain. Simulator Keychain is a process-adjacent database. It is not isolated per XCTest by default.

UI tests: launch argument \`-ui-testing\` constructs the composition root with \`FakeTokenStore\` preloaded for the scenario (logged in, logged out, expired). Do not log in through the real Keychain from a previous test. Problem 2’s shared simulator state.

App groups: unit tests should not mount the real group. Fakes for the snapshot file and the Keychain. One integration test on device if you must prove the access group, not on every PR.`,
      explanation: `Logout was green, the next test still had Maya’s token, CI 10%, worse when Swift Testing ran in parallel. The suite was using the real Keychain because “that’s what production uses.” Production uses a secure, process-shared, sometimes-extension-shared database. That is a terrible unit-test double. It is also how a shared iPad bug looks in CI: leftover items, access group surprises, errSecDuplicateItem on save, a delete that did not match the query and left the refresh token.

The seam is tiny. Load, save, delete. The fake is a dictionary. Failure injection is how you test the dual-read migrator and the “Keychain locked before first unlock” path without rebooting a sim. UserDefaults as the fake teaches the next author that tokens live in defaults. They do not, not even in tests — the fake is a type, not a different persistence policy.

UI tests are where this becomes problem 2. A launch argument must install a store the app process owns for that launch, preloaded, wiped on logout in-process. Parallel unit tests must not share a singleton fake. Seniors treat Keychain like the network: real thing at the edge, fake everywhere else. The one device test that proves the access group is a night job, not the PR.`,
      internals: `SecItem queries must match account, service, access group, accessibility. A delete that omits the group leaves items. Tests against the real API flake when a previous test used a different accessibility.

\`kSecAttrAccessibleWhenUnlocked\` plus a sim that locked: errSecInteractionNotAllowed. Worth injecting. NSE reading a WhenUnlocked item at 3 a.m. is a product bug; the fake should be able to throw that.

Swift Testing parallel: \`static var store = FakeTokenStore()\` is shared mutable state. Construct per test.

Launch arguments: parsed at the composition root, not read randomly in SecItem wrappers.`,
      testing: `Fake: save/load/delete, overwrite, delete is idempotent, injected error on save. Migrator: dual-read old service then new, with two fakes. UI: launch logged-in, logout, next UI test launch logged-out — no leftover. A DEBUG assert in production store that it is not used when the UI-testing flag is on.`,
      pitfalls: `UserDefaults token fake. Real Keychain in unit tests. Shared singleton. Delete query that does not match save. Parallel tests. UI tests that log in once in class setUp and hope. Putting the refresh token in the app-group container “for the widget test.”`,
      alternatives: `A Keychain wrapper library with its own mock — still wrap it in TokenStore so production cannot pass UserDefaults. Entitlement-restricted integration on device. Reset sim between UI tests — slow, nuclear, works if you cannot fake the root.`,
      tradeoffs: `In-memory fake: fast, will not catch a bad SecItem query. That is why one integration exists. Real Keychain everywhere: catches query bugs, flakes, and serialises CI. Launch-argument fakes: you will not catch a missing entitlement until device. Nightly device is the place.`,
      followups: [
        {
          q: 'How do you test the widget’s snapshot versus the token?',
          a: 'Two fakes: TokenStore and a container snapshot. Logout clears both in one function you unit-test. Do not boot WidgetKit in the unit test.',
        },
        {
          q: 'errSecDuplicateItem — unit or integration?',
          a: 'Fake can throw it. Production save should update-or-add; test that path with the fake. Real duplicate from leftover items is a CI hygiene bug.',
        },
        {
          q: 'Can XCTest reset the Keychain?',
          a: 'Not portably. Wipe via your TokenStore.delete in tearDown if you insisted on real items — you will still flake on query mismatch. Prefer a fake.',
        },
        {
          q: 'Does the fake implement accessibility AfterFirstUnlock?',
          a: 'It can record the accessibility you passed, so a test can assert production configuration. It should not simulate first unlock unless you are testing that error path.',
        },
      ],
      teaches: [
        'TokenStore seam',
        'No real Keychain in unit tests',
        'No UserDefaults tokens in fakes',
        'Per-test instances, not singletons',
        'UI tests launch with a fake store',
        'Access-group proof is a device job',
      ],
    },
    {
      id: 'd9-p10',
      title: 'Core Data tests against the on-disk store',
      difficulty: 'Senior',
      kind: 'Review',
      prompt: `Notes tests spin a real SQLite file in \`/tmp\`, share one \`NSPersistentContainer\` across cases, and hit the \`viewContext\` from background test threads. Migrations are “we’ll test in TestFlight.” CI deletes the file sometimes; sometimes it does not. Design in-memory Core Data (or SwiftData) tests, what still needs a file, how you test a migration, and how MainActor / viewContext shows up here.`,
      think: [
        'In-memory versus a temp SQLite file — which bugs does each miss?',
        'Why is a shared container across tests a flake?',
        'Where does a migration fixture come from?',
        'Can you fetch on viewContext from a nonisolated test?',
      ],
      solution: `Default: a per-test store.

* Unit tests of repositories: \`NSInMemoryStoreType\` (or SwiftData in-memory configuration), new stack every test, destroy at the end. No file, no leftover rows, parallel-safe if each test owns its stack.
* Fetches that production runs on a background context run on a background context in the test. Do not prove a background merge by touching \`viewContext\` off main — you will invent Day 8 problem 6/10 bugs in the suite.
* \`viewContext\` tests are \`@MainActor\` (problem 6).

Migrations: in-memory will not save you. Keep versioned SQLite fixtures (v1, v2) in the test bundle. Load as a file store, run migration, assert rows and a tombstone column you added. That is the TestFlight crash you are preventing. One file per version, not a shared /tmp.

A temp SQLite file is justified when you need WAL, file size, or a corruption test. Unique URL per test, delete in tearDown even on failure. Never a single \`/tmp/notes.sqlite\` for the target.

SwiftData: same rules. In-memory ModelContainer for logic. File containers for migration. Do not put UIImages in the model and then wonder about memory (Day 8 problem 1).`,
      explanation: `The suite was an integration environment that happened to run in XCTest. One container, one file, leftover notes, a fetch from a random thread, migrations blessed by TestFlight. CI deleted the file “sometimes” because tearDown was not tearDown on failure. That is the Keychain incident with a WAL.

In-memory is the unit-test store: fast, isolated, good enough for “insert pending, ack, one row.” It will not prove that lightweight migration adds a column on a user who last opened v3 in 2022. That proof is a file you checked in, a migrator you run in the test, and an assertion on the row. Seniors keep those fixtures next to the model, they fail the PR if migration throws, and they do not wait for a 0.4% crash in the wild — that crash is a hang or a fatal on launch, Day 8 problem 5/11, because you migrated on main.

viewContext is main. A test that fetches it off main is not “closer to production.” Production is wrong if it does that too. Align isolation: repository tests use a private context; UI-projection tests hop to MainActor with a slim snapshot. Shared containers across tests are global state, problem 4’s cousin. Per-test stacks, or you are debugging order again.`,
      internals: `\`NSInMemoryStoreType\` does not run all SQLite constraints the same way. Unique indexes and some predicates differ. If the bug is a constraint, use a temp file.

\`NSPersistentContainer.loadPersistentStores\` is async in effect; in tests, wait on the load error. A shared static container plus parallel Swift Testing is two threads one coordinator.

Migration tests: \`NSMappingModel\`, or lightweight inferred. Load the old file with the old mom, or load with the new mom and let inferred run — production’s path is the one to test. Destroy the stack before deleting the file.

SwiftData \`ModelContainer(inMemory: true)\` is the analogue. Schema migrations are still files.`,
      testing: `Insert/ack/dedupe in memory. Migration: v3 fixture → v4, assert column. A test that the heavy fetch is not issued on an actor labelled main — spy the context. TearDown deletes the unique URL. Parallel-safe: no static container.`,
      pitfalls: `One /tmp file. viewContext from a background test. In-memory only, no migration fixtures. Migrating on MainActor in production and in tests. Loading the container once in \`setUpWithError\` for the class and never resetting. Storing the test store in the app group. Ignoring load errors.`,
      alternatives: `GRDB / SQLite.swift with in-memory database strings. Easier isolation, you own SQL. Realm — still a file story. A fake NotesDB protocol for the engine (problem 1’s facade) plus fewer Core Data tests — valid; you still need migration tests at the adapter.`,
      tradeoffs: `In-memory: speed, weaker SQLite fidelity. Temp files: fidelity, slower, cleanup. Checked-in fixtures: maintenance, the only honest migration test. Shared container: fast to write, order-dependent. Per-test stacks cost setup milliseconds and buy isolation.`,
      followups: [
        {
          q: 'Do you test performAndWait inversion here?',
          a: 'You test that the API you call is perform, not performAndWait, from main. A timeout test for deadlock is possible and mean. Prefer a code shape that cannot invert, then a review.',
        },
        {
          q: 'SwiftData vs Core Data in tests?',
          a: 'Same pyramid. In-memory container, file for migration, MainActor for UI snapshots. Do not let SwiftData’s nicety hide a main-thread fetch of thousands of notes.',
        },
        {
          q: 'Where do conflict-sibling tests live?',
          a: 'Against the repository with an in-memory store and two fake device clocks / revisions. That is Day 10 notes, as a unit test, not a UI test of the resolve screen — the screen gets a snapshot (problem 5).',
        },
        {
          q: 'CI cannot load the fixture. What happened?',
          a: 'The sqlite was not in the test bundle resources, or the mom version name drifted. The test should fail loud on load, not skip.',
        },
      ],
      teaches: [
        'In-memory default',
        'File fixtures for migrations',
        'Per-test stacks',
        'viewContext is MainActor',
        'Do not share a container',
        'Adapter tests vs engine fakes',
      ],
    },
    {
      id: 'd9-p11',
      title: 'Contract tests: the DTO drifted and CI stayed green',
      difficulty: 'Expert',
      kind: 'Incident',
      prompt: `Backend renamed \`feed_items\` to \`items\` on a Thursday. iOS decoded empty arrays, Home showed last cache, nobody noticed until Monday. Unit tests used hand-written DTOs. Decoding was never run against a real payload. Design contract tests for a consumer app: where they live, stub server versus recorded fixtures, what they do not replace, and how they interact with the URLProtocol story in problem 4.`,
      think: [
        'What is the source of truth — OpenAPI, a checked-in JSON fixture, a stub server?',
        'Do you decode in the VM test or in an adapter test?',
        'How do you fail CI when the schema changes, without hitting staging?',
        'What happens on unknown fields and on missing required ones?',
      ],
      solution: `Contract tests live at the HTTP adapter, not in HomeVM.

1. **Recorded fixtures** in the test bundle: real bodies (anonymised) for feed, 401, 402, empty, paginated page 2. \`JSONDecoder.decode\` in a test. If \`feed_items\` disappears, this goes red. This would have caught Thursday.
2. **Consumer-driven contracts** if the org will honour them: iOS publishes “I need items: [Post]”. Backend CI runs the provider. Pact or an OpenAPI spec generated from the server, client generated or validated against the spec.
3. **Stub server** for the one integration that also checks headers (problem 4). Not for every VM.

VM tests keep using FakeHome with typed values. They never instantiate JSON. If the VM test builds a Feed by hand, it cannot see a rename.

Decoder policy is product: unknown keys ignored or not; missing required keys fail the page, not silently empty. A test for “empty array versus missing key” is a contract test. Stale-while-revalidate showing last cache on decode failure needs a metric — tests can assert you increment \`decode.failed\` and keep cache.

Do not hit staging in PR CI. Nightly can, and it can be yellow without blocking the train (problem 2’s trade).`,
      explanation: `Thursday’s rename was a contract change. The suite did not speak the contract. It spoke Swift structs the author typed, which still existed, still decoded in nobody’s test, and Home’s fake returned three posts forever. Empty arrays from JSONDecoder looking for a key that was gone looked like “user has no feed,” which stale-while-revalidate painted as yesterday’s posts. Green CI, quiet users until the cache aged out on Monday. That is not a VM bug. That is a missing adapter test against bytes.

Seniors treat JSON as a boundary with a fixture, the same way they treat Keychain as a boundary with a fake. The fixture is the API. When backend changes the name, either the fixture updates in the same PR as the DTO, or CI fails. OpenAPI/Pact is the grown-up version if two teams ship independently; a folder of anonymised bodies is the version you can ship this week. URLProtocol is how you feed those bytes through the real decoder path if you want headers too. It is not how you test merge order.

Hand-written DTOs in VM tests are fine. They are not a contract. If your only decode test is a round-trip of a struct you just constructed, you proved Codable is symmetric, not that Thursday’s server still talks to you. The empty-array failure mode is the cruel one: decode succeeds, product looks plausible, metric is how you see it in the wild. Contract tests plus a decode-failure counter are the pair.`,
      internals: `\`decodeIfPresent\` versus \`decode\`: missing key vs null vs []. Three fixtures. \`keyDecodingStrategy = .convertFromSnakeCase\` hides renames until it does not.

OpenAPI: generated types reduce drift and create a generated-code review problem. Validate at CI against the spec without generating if you want to keep hand types.

Anonymise fixtures: no tokens, no PII. EU app — Day 10 observability. Fixtures live in the repo; they are not production logs copied into tests.

Version the contract: \`/v2/feed\` rather than silently renaming. The test still exists when they rename anyway.`,
      testing: `A test per endpoint happy body, plus empty, plus missing required key, plus unknown field. One Pact/OpenAPI job if you have a provider. Metric assertion in the adapter: decode fail increments. VM tests remain fakes. After Thursday, the fixture PR is the backend contract PR.`,
      pitfalls: `Round-trip only. Hitting staging in the PR. Fixtures with live tokens. Decoding in the VM test of merge order. Ignoring unknown keys and missing a required rename that emptied the list. Recording fixtures from production logs with PII. Calling URLProtocol-everywhere “contracts.”`,
      alternatives: `Server-driven schema with a version field. Generated Codable from OpenAPI. A nightly curl against staging compared to fixtures — yellow, not a PR gate. GraphQL codegen — same idea, different bikeshed.`,
      tradeoffs: `Fixtures: simple, go stale if nobody updates them when they change the server — the test is the reminder. Pact: org process, real independent deploys. Generated types: less drift, worse diffs. Staging nightly: catches what you forgot to fixture, flakes, PII risk. PR stays on fixtures.`,
      followups: [
        {
          q: 'Would problem 1’s FakeHome have caught this?',
          a: 'No. Fakes do not decode. That is why both exist. Fake for merge. Fixture for keys.',
        },
        {
          q: 'Empty array versus decode failure — product?',
          a: 'Decode failure: keep cache, metric, maybe a quiet retry. Empty array: show empty. Mixing them is the Monday incident.',
        },
        {
          q: 'Where does pagination cursor live in the contract?',
          a: 'In the fixture for page 2 and in a VM test with a fake cursor. Two layers. The JSON field name is the contract test; the cancel/generation is the VM test.',
        },
        {
          q: 'EU privacy and fixtures?',
          a: 'Anonymise. No real emails. Do not copy Crashlytics breadcrumbs into the bundle. Synthetic bodies are enough if they match the schema.',
        },
      ],
      teaches: [
        'Bytes at the adapter',
        'Fixtures are the API',
        'Fakes are not contracts',
        'Empty decode is a silent incident',
        'OpenAPI/Pact when teams diverge',
        'No staging on the PR',
      ],
    },
    {
      id: 'd9-p12',
      title: 'Coverage 92%, checkout still double-charged',
      difficulty: 'Expert',
      kind: 'Judgment',
      prompt: `The dashboard is green: 92% line coverage, 400 snapshots, spies that record fifty calls, a property-based test that generates random emails for a validator nobody uses in pay(). A double-charge ships because \`pay()\` was not serialised and the test spied \`client.createIntent\` without asserting it was called once. Spy versus stub versus fake, what coverage will not tell you, when property-based is worth it, and which two tests you write this afternoon.`,
      think: [
        'What did the spy assert, and what did it only record?',
        'Which lines of pay() were covered by a test that never tapped Pay twice?',
        'Is a fake checkout client enough, or do you need a fake clock and an AttemptStore?',
        'When would you actually use property-based testing on iOS?',
      ],
      solution: `Coverage is a heatmap, not a test. 92% means 8% of lines never ran, not that 92% of behaviours are true. A spy that records fifty calls and asserts \`XCTAssertTrue(true)\` at the end is instrumentation. A stub returns canned values. A fake has behaviour (an in-memory store, a held HTTP, a clock). Checkout needed a fake PaymentActor client plus an AttemptStore fake: double \`pay()\` while the first intent is held open (problem 7’s door), assert one \`createIntent\`, same idempotency key.

This afternoon:

1. **Serial pay():** hold createIntent, call pay() twice, resume, assert one intent and one key. No sleep.
2. **Process death:** persist the attempt, new store hydrates, poll status, assert no second key. That is the 3DS kill. Coverage will go up; that is a side effect.

Delete or fix: spies that assert nothing; the email property-test if pay() does not use that validator; snapshots of the spinner as the only pay test (problem 5). Property-based belongs on things with a real algebraic contract — decoder round-trip of arbitrary unicode in notes, money rounding — optional, not a dashboard trophy.

Cancellation: cancel pay() during 3DS, assert no success apply. MainActor: CheckoutStore tests on MainActor, PaymentActor tests on the actor, do not hold MainActor across the held intent (problem 6).`,
      explanation: `Ninety-two percent is a comforting number. The double-charge did not live in the uncovered 8%. It lived in a covered line that ran once, in a test that never pressed Pay twice. Coverage counts execution, not permutation. Spies made it worse: fifty recorded calls look like thoroughness in a PR screenshot. Nobody asserted count == 1. Stubs returned 200. The spinner snapshot was green. The email fuzzer was a conference talk. Checkout still minted two intents because the actor did not join, and no test held the door open.

Spy, stub, fake is not vocabulary for its own sake. A spy without an assertion is a log. A stub cannot tell you about single-flight; it has no memory. A fake AttemptStore plus a held client is the design of Day 10 checkout, in the suite. Seniors write that fake because the incident is two taps and a kill, not because a coverage gate yelled.

Property-based testing is optional on iOS and useful when you can state an invariant: decoding any string the generator produces does not crash; rounding never creates money. It is a poor substitute for the two-tap test. Coverage theatre is the org failure mode of Day 9: more tests, worse tests, a dashboard that cannot see money. The afternoon is two tests with fakes. The number on the wall can wait.`,
      internals: `llvm-cov / Xcode coverage: lines, not branches, unless you read branch data. A ternary can be half-tested. \`@MainActor\` getters that run during setup count.

Spies: a closure or a class that appends to an array. Useful at the edge (did we call reloadTimelines on logout). Harmful as the only pay() test.

Fakes versus mocks: fakes are written by you and stay. Generated mocks (a protocol with 40 methods) rot. Prefer tiny protocols.

Property-based: SwiftCheck / a small generator. Bound the input or CI will run until a 10 MB string. Shrinking matters; without it you get an unreadable failure.

Cancellation tests: the late stub must not win (problem 1). Coverage will mark the assign line even if a cancelled test never tried the late stub.`,
      testing: `The two tests above, plus cancel-during-3DS. A coverage report attached to the PR is optional; the double-pay test is not. If you keep a spy, assert the count and the idempotency key. Kill the email fuzzer or point it at a real invariant.`,
      pitfalls: `Coverage gates at 90%. Generated mocks of CheckoutStore. Spies in every test. Property-based on UUID format. Asserting call order of fifty analytics events. Green snapshots of unpaid UI. Mocking the PaymentActor (problem 7). Sleeping between two taps.`,
      alternatives: `Mutation testing if you are a platform module with a taste for pain — it finds the unasserted spy faster than coverage. Manual QA of pay() — necessary, not sufficient. A metric on duplicate intents per checkout id in production is the backstop, not the test.`,
      tradeoffs: `A coverage gate raises the floor and invents empty tests. No gate: you can ship an untested pay(). Prefer required tests for money, auth, and migration over a percentage. Property-based: high cost of a good generator, high value on parsers. Skip it on view models. Fakes cost setup and tell the truth; spies are cheap and lie without assertions.`,
      followups: [
        {
          q: 'Spy vs stub vs fake, in one sentence each?',
          a: 'Spy records calls; without asserts it is a log. Stub returns canned data; it has no memory. Fake has behaviour you can hold open and query.',
        },
        {
          q: 'Would 100% coverage have caught this?',
          a: 'Not if both taps were not a test. Coverage cannot see the path you never took. Two pay()s is a path.',
        },
        {
          q: 'When is property-based worth it?',
          a: 'Parsers, codecs, money rounding, note merge that must not drop characters. Not email regex theatre, not SwiftUI views.',
        },
        {
          q: 'How do you test cancellation of pay()?',
          a: 'Hold 3DS, cancel, resume success from the adapter, assert the store is cancelled/failed and no paid. Same late-stub rule as HomeVM.',
        },
        {
          q: 'MainActor VM plus PaymentActor — who owns the test?',
          a: 'Actor test for serial pay and the key. Store test on MainActor for projection. Do not wrap the held intent in MainActor.run (problem 6 deadlock).',
        },
        {
          q: 'Is a coverage dashboard banned?',
          a: 'No. It is a flashlight for untested files. It is not an SLO. Money tests are an SLO.',
        },
      ],
      teaches: [
        'Coverage ≠ behaviour',
        'Spy vs stub vs fake',
        'Assert call counts for money',
        'Hold the door open',
        'Property-based is optional and specific',
        'Theatre looks like 92%',
      ],
    },
  ],
}
