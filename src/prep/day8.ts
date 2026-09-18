import type { PrepDay } from './types'

export const day8: PrepDay = {
  id: 'day-8',
  title: 'Day 8 — Performance and debugging',
  kicker: 'Incidents, not tools trivia',
  intro:
    'A senior does not recite Instruments panels. They pick a hypothesis, pick the tool that can falsify it, and stop when the graph agrees. These twelve problems are incidents: memory, CPU, hitches, production crashes, launch, thread affinity, data races, leaks, energy, disk, watchdog hangs, and scrolling FPS. How you would test a fix still belongs in the answer. Testing as the topic is Day 9.',
  problems: [
    {
      id: 'd8-p1',
      title: 'Feed memory 150 MB → 900 MB in five minutes',
      difficulty: 'Senior',
      kind: 'Incident',
      prompt: `Production: scrolling a video/image feed, memory climbs 150 → 900 MB. No crash reports until jetsam. Locally, Allocations grows and never plateaus. The team "already uses Kingfisher." Walk the investigation, name likely causes, and say what a fix looks like — without guessing a single root cause on slide one.`,
      think: [
        'Is it live objects, dirty memory, or a cache that refills after purge?',
        'Are decoded images larger than the view they sit in?',
        'Are AVPlayer / AVPlayerItem instances retained off-screen?',
        'Would Memory Graph after a pop show a leak, or only after a fling show a policy problem?',
      ],
      solution: `Hypothesis loop, not a tool dump.

1. **Memory Graph** on a device after two minutes of scrolling. Look for duplicated view controllers (Day 1), \`UIImage\` count, \`AVPlayer\`, URLSession tasks, an NSCache that never evicts under pressure.
2. **Allocations** plus persistent bytes. Mark generations: scroll, pop, scroll. Persistent growth after pop is a leak. Growth only while scrolling that drops on a memory warning is cache policy.
3. **Leaks** is optional. Many Swift cycles show up better on the graph than in the Leaks instrument.

Likely production causes, prove then fix:

* Full-resolution decode (\`UIImage(data:)\`) for a 120 pt row.
* Image cache with no cost limit and no eviction on warning.
* Cells keeping \`AVPlayer\` when reused.
* SwiftUI view identity recreating players in body.
* An analytics SDK buffering bitmaps.

Fix pattern: downsample to screen scale × view size, cap cache cost, tear down players in prepareForReuse, weak delegates, then a second generation mark that stays flat. Kingfisher still decodes what you ask for. Changing the library name is not a fix.`,
      explanation: `Jetsam killed the app in the feed. Crashlytics was quiet until then because jetsam is the OS reclaiming a process, not an exception you catch. Locally, memory climbed 150 to 900 MB in five minutes of scrolling and never came back. Someone said we already use Kingfisher, which is how you know the investigation has not started. Kingfisher is a cache. A cache that holds decoded 4000×3000 photographs for a 120-point row will happily take 900 MB. That is not a leak. That is a policy. If you open Instruments Leaks and see nothing, you have not falsified the policy hypothesis.

The order of tools is the senior part. Memory Graph answers who is alive. After a long fling you expect images and maybe a few players. After you pop the feed you expect those to be gone. If the view controller is still there, you are in Day 1. If the view controller is gone and 200 UIImages are not, you are in decode and cache. Allocations with generation marks answers whether it is still growing. Time Profiler is the wrong first tool; CPU is problem 2. You do not guess a single root cause on slide one because 900 MB is almost never one object. It is usually decoded bitmaps plus players plus a cache that does not respect memory warnings.

A 4000×3000 photo is about 48 MB uncompressed at four bytes per pixel. Ten of those in a cache without downsampling is the incident. The simulator will not jetsam you; it has 64 GB and no shame. Measure on a device. Confirm the fix with a second generation mark, not with “it feels better.” If the graph still climbs, you fixed a cause, not the cause. Keep going.`,
      internals: `Decoded bitmaps are dirty memory. JPEG on disk is small; \`UIImage(data:)\` is the uncompressed buffer. Downsampling with ImageIO (\`kCGImageSourceCreateThumbnailFromImageAlways\` and a max pixel size) keeps the buffer near the view. Kingfisher and friends will do this if you set the target size. Default is often original.

NSCache evicts on pressure if you set countLimit and totalCostLimit and you actually set cost on insert. A dictionary of UIImages does not. URLCache stores encoded data, not CGImages, and will not save you from decode-in-cell.

AVPlayer and AVPlayerItem hold decoded frames and network buffers. A cell that does not pause and nil the player in prepareForReuse accumulates them. SwiftUI that creates a player in body without identity ties the player’s lifetime to a view value that is recreated, or worse, to a view that is not destroyed when off-screen.

Jetsam: memorystatus. You see jetsam logs in Console, not a Swift stack. MetricKit captures some of this in production. Simulator never will.`,
      testing: `UI scroll tests will not catch this on CI. Debug: save an Allocations run in the PR for the leak or cache fix. Unit-test a downsampler’s output pixel count. Memory Graph screenshot after 10 push/pop of the feed, zero leftover feed VCs. Custom deinit logs in DEBUG for feed VCs and for player owners. A lab device with a scroll monkey and a memory ceiling is the closest thing to CI.`,
      pitfalls: `Optimising copy-on-write structs while images are the cost. Simulator-only measurement. Bumping the cache to 1 GB. Replacing Kingfisher with SDWebImage without changing decode size. Calling that a leak when Leaks is empty. Forgetting video. Marking a generation without popping the screen, so you cannot tell leak from cache.`,
      alternatives: `UICollectionView with a pool of three AVPlayer instances versus SwiftUI creating players in body. Nuke or Kingfisher with a processor that downsamples. A dedicated image pipeline actor that decodes off main and vends sized buffers. Prefetch the next two rows, not the next forty.`,
      tradeoffs: `Aggressive downsample: blur if the user zooms. Keep a second zoom cache if zoom is a product. Prefetch versus memory is a budget, not a virtue. A tiny player pool stutters if you fling fast; an unbounded pool is this incident. NSCache cost limits will drop images the user just scrolled past — that is correct. Persistent growth after pop is never a tradeoff; that is a leak and you fix it.`,
      followups: [
        {
          q: 'How do you catch this in production?',
          a: 'You mostly do not in unit tests. MetricKit memory diagnostics, os_signpost around the feed, a lab device with a scroll monkey and a ceiling. Crashlytics will show jetsam poorly; look at memory warnings and MetricKit.',
        },
        {
          q: 'Would Instruments Leaks have shown a Kingfisher cache?',
          a: 'No. Caches are not leaks. They are policy. Allocations plus cache cost is the conversation. Leaks is for unreferenced malloc, which is not this.',
        },
        {
          q: 'First tool if the VC count is 40 after 40 push/pops?',
          a: 'Stop talking about images. That is Day 1 ownership. Memory Graph, incoming references, then come back to decode.',
        },
        {
          q: 'Does SwiftUI Image(uiImage:) copy the buffer?',
          a: 'It retains it. A full-res UIImage in body is the same 48 MB. Identity and downsample still apply.',
        },
      ],
      teaches: [
        'Hypothesis-driven debugging',
        'Allocations generation marks',
        'Memory Graph vs Leaks',
        'Decoded image cost',
        'Jetsam vs leak vs cache policy',
        'Player lifetime in reuse',
      ],
    },
    {
      id: 'd8-p2',
      title: 'CPU 100% when a screen appears',
      difficulty: 'Senior',
      kind: 'Performance',
      prompt: `A settings screen hits 100% CPU on appear and stays hot. The UI is a Form with ~40 rows. Nothing animates. Users report battery drain. How do you find the hot function, and what are the usual culprits in SwiftUI and UIKit?`,
      think: [
        'Is the work in body, in layout, or in a timer you forgot?',
        'Is there an observation loop — a state write that retriggers body forever?',
        'Is the hot thread main, or a runaway background pool that only looks like the screen?',
      ],
      solution: `Time Profiler on a device. Record appear plus five seconds of idle. Sort by self time, not by what you hoped was hot. The heaviest stacks tell you: \`body\`, Auto Layout, JSON, regex, \`DateFormatter\` allocation in a loop, a Combine pipeline that never settles.

Usual culprits, each a different fix:

* SwiftUI: writing \`@State\` in \`body\` or in \`onAppear\` that immediately invalidates — a render loop. \`Timer.publish\` attached to a view that should have been a model.
* Creating \`DateFormatter\` or \`NSRegularExpression\` per row per body.
* UIKit: installing constraints every \`layoutSubviews\` without a “already set up” flag.
* Logging that stringifies a huge object on every appear, or on every Combine event.

Fix the hottest stack. Re-profile. Do not “use structs” as the answer. Do not start with the SwiftUI instrument until Time Profiler names a function you recognise.`,
      explanation: `The screen did not animate. It just sat there and cooked the battery. That is how you know this is not scrolling hitch and not a 2-second freeze. CPU 100% at rest is almost always a feedback loop or O(n) work in layout or body that runs forever. Time Profiler is the tool because it names the function. Everything else is a guess you will waste an afternoon on.

I have seen this be a DateFormatter allocated in every row of a 40-row Form, rebuilt every time body ran, with body running because a Timer.publish ticked a now Date into @State to “keep relative times fresh.” That is a loop you wrote on purpose without noticing. I have seen it be a UIKit screen that removed and re-added constraints in layoutSubviews, which dirty layout, which calls layoutSubviews. I have seen it be a Combine pipeline that wrote to @Published on every value, including the same value, on a view that observed it. The profiler stack is what distinguishes those. “SwiftUI is slow” is not in the stack.

Main Thread Checker is the wrong tool here; that is hangs and UIKit-off-main, problem 6. Thread Sanitizer is the wrong tool unless you suspect a race that is causing retries. You re-profile after the fix because the second hottest stack is sometimes the real remaining 80%. Seniors stop when idle CPU is idle, not when they have a story about formatters.`,
      internals: `SwiftUI’s body must be a pure projection of state. A write in body schedules another render. That shows up as 100% in AttributeGraph and your body. \`objectWillChange\` on every assignment, even if the value is equal, will do the same for ObservableObject unless you guard.

DateFormatter is expensive to create: calendar, locale, parser. Cache one per format, or use FormatStyle. NSRegularExpression compile is similar.

Auto Layout: layoutSubviews should not mutate constraints unboundedly. A flag, or setup in init/updateConstraints.

Timer.publish(every: 1) on a view is a render every second of the entire Form. Relative timestamps can live in the model at a coarser cadence, or be a TimelineView with an actual interval you chose.

os_signpost intervals around appear will show you “appear never ends” in Instruments without the full profiler if you already suspect a loop.`,
      testing: `Time Profiler before and after, on a device, same recording length. A unit test can assert a formatter is reused (call count on a factory). XCTest cannot easily catch a SwiftUI render loop — Instruments can. A DEBUG counter incremented in body, logged once per second, will show “40 rows, 400 bodies/s” and is a legitimate temporary instrument.`,
      pitfalls: `Optimising scroll performance that is not the symptom. Debug prints left on, themselves the hot stack. Killing the Timer and leaving the @State write in onAppear that still loops. Using the simulator’s thermal state as a pass. Thread Sanitizer “to be safe” as the first move. Rewriting the Form in UIKit before you have a stack.`,
      alternatives: `os_signpost around appear. MetricKit CPU diagnostics in production for the users you will not profiler-attach. Instruments SwiftUI for body counts once Time Profiler has pointed at SwiftUI. A plain UITableView if the profiler says AttributeGraph and you have already made body cheap — last resort, after numbers.`,
      tradeoffs: `Caching formatters is cheap and correct. Memoising the whole screen can hide stale UI. A one-second TimelineView is more CPU than static text and less than a Combine timer that invalidates 40 rows. UIKit rewrite is a month; a cached formatter is an afternoon. Take the afternoon unless the profiler says otherwise.`,
      followups: [
        {
          q: 'Thread Sanitizer here?',
          a: 'Only if you suspect a data race causing retries or repeated publishes. TSan is not a profiler. It will not tell you why body runs.',
        },
        {
          q: 'How is this different from the 2-second home freeze?',
          a: 'A freeze is a hitch: main was busy, then it was not. 100% at rest is still busy. Profiler for both; the shape of the recording is different — a spike versus a plateau.',
        },
        {
          q: 'Could a URLSession retry loop look like this?',
          a: 'Yes, on a background thread. Time Profiler would show URLSession and your decoder, not body. That is problem 2 from Day 5, showing up as battery. Check the thread, not only the screen.',
        },
        {
          q: 'Is Instruments Energy useful first?',
          a: 'Second. Energy says the radio or CPU is up. Time Profiler says which function. Do not start at Energy and guess.',
        },
      ],
      teaches: [
        'Time Profiler first',
        'SwiftUI render loops',
        'Layout thrash',
        'Formatter reuse',
        'Re-profile after the fix',
        'Idle CPU should be idle',
      ],
    },
    {
      id: 'd8-p3',
      title: 'Home screen freezes 2 seconds on open',
      difficulty: 'Senior',
      kind: 'Incident',
      prompt: `Opening Home hitchs for ~2 s, then pops in. Happens on a cold tab switch, not only cold launch. The team blames SwiftUI. How do you prove where the hitch is, and what would you move off the main thread?`,
      think: [
        'Is the hitch before the first frame or after — spinner, then content, or a frozen nav?',
        'JSON decode, Core Data fetch, image decode, font, lock — which can you falsify?',
        'Which isolation is the view model on, and what did it await on MainActor?',
      ],
      solution: `Hitch is not launch. Cold launch is problem 5. This happens on a tab switch, so the process is warm. Prove the interval: Time Profiler plus the Hitches instrument, or \`os_signpost\` around \`viewDidLoad\` / first \`body\`. Main Thread Checker if you are in the opposite bug (UIKit off main).

Typical 2-second main-thread work:

* Decoding a large payload in a \`@MainActor\` load (Day 2 JSON).
* \`viewContext.fetch\` of thousands of rows to build the UI.
* Synchronous disk read of images.
* Regex or markdown on main.
* Waiting on a lock held by a background writer (\`performAndWait\` inversion).

Fix: first frame is a skeleton from the last cache (Day 5 stale-while-revalidate). Fetch and decode off main. Hop back with a slim view model. Prefetch Home after login. Do not block appear on twelve sequential APIs — \`async let\` / TaskGroup with a timeout and partial UI.

SwiftUI is innocent until the profiler says \`body\` or \`Image.init\`. The team’s blame is a hypothesis. Falsify it.`,
      explanation: `Users feel main-thread latency as a freeze. The nav bar is up, Home is a still frame for two seconds, then it pops in. That is a hitch, not a crash, not 100% CPU forever. The team blamed SwiftUI because Home is SwiftUI. The profiler on a device showed JSONDecoder.decode on MainActor inside HomeVM.load, which was marked @MainActor because the published state was. A megabyte of feed JSON, decoded on main, plus a Core Data fetch of every cached row to merge, plus a couple of full-res images set on image views. SwiftUI was drawing a skeleton that never got a chance to appear because body did not run until load finished. The hitch was the data path, sitting on the actor that owns the UI.

Seniors split first pixel from complete data. The first frame should be cheap: last snapshot, placeholder, whatever is on disk that you already trust. The expensive work happens off main and lands as a state update. Twelve sequential awaits on MainActor are twelve serial hitches. async let is how you overlap them. A timeout is how you show partial UI when notifications are slow and the feed is ready.

Watchdog kills at much longer hangs. Two seconds will not jetison the process. It will get you one-star reviews and a Time Profiler recording that is very easy to read if you bother to make one before rewriting the view layer.`,
      internals: `The main run loop cannot drain touch events while it is inside decode. CADisplayLink and input sit behind that work. Hitches instrument flags intervals where a frame missed its deadline. os_signpost with begin/end around load lets you see the same in a custom instrument.

@MainActor on the VM is correct for publishing. It is not correct for JSONDecoder.decode of a large buffer. Decode in a nonisolated or dedicated actor, hop back with values. Core Data: viewContext is main. A big fetch belongs on a private context, then a slim object for the UI. performAndWait on main waiting for a background writer is inversion — you freeze until the writer finishes.

URLSession.data(for:) suspends; the decode after it, if you stay on MainActor, does not. That is the footgun of async/await on a UI actor.`,
      testing: `Measure with XCUI and XCTOSSignpostMetric if you have a lab. Unit-test that decode is not called on an actor labelled main — inject a decoder on a background executor and assert. Instruments remains the source of truth for the two seconds. A signpost in DEBUG around Home.load that fires a test failure if it exceeds a budget on a reference device is possible and brittle; keep it in a performance test, not in unit tests on CI VMs.`,
      pitfalls: `Showing a spinner for two seconds instead of moving the work — you made the hitch a spinner. DispatchQueue.main.sync from background, deadlock. Blaming SwiftUI without a recording. Fetching thousands of Core Data rows to display twenty. Waiting for all twelve APIs before first paint. Testing only cold launch and calling this fixed.`,
      alternatives: `UIKit Home if SwiftUI diff is the proven cost — only after numbers. A pre-warmed snapshot image of last Home for the first frame. Prefetch at login or on a background task so tab switch is a cache hit. That last one trades memory and battery for instant appear.`,
      tradeoffs: `Partial UI can flash. Better than a frozen nav. Cache last Home on disk for instant first frame: stale, fast, you already made this choice in Day 5. Overlapping APIs with TaskGroup: more load on the server at tab switch, less serial hitch. Cap concurrency. Skeleton versus spinner: skeleton implies you will show something real soon; a two-second spinner is an admission you blocked appear.`,
      followups: [
        {
          q: 'How is this different from a 4-second cold launch?',
          a: 'Launch includes process creation, static inits, first frame of the root. Tab hitch is often just Home’s data path. Measure both. Do not mix the budgets. Problem 5 is the launch one.',
        },
        {
          q: 'Would Main Thread Checker catch decode on main?',
          a: 'No. Decode is not UIKit. It is merely expensive. Checker catches UIView on a session queue. Profiler catches decode on main.',
        },
        {
          q: 'Can you decode on MainActor if the payload is tiny?',
          a: 'Yes. The rule is a budget, not a religion. A 2 KB user object is fine. A feed is not. Measure.',
        },
        {
          q: 'What if the hitch is Auto Layout of a huge xib?',
          a: 'The profiler will say so. Then you split the view, lazy-load sections, or move work out of viewDidLoad. Same loop: prove, then fix.',
        },
      ],
      teaches: [
        'Hitches vs launch vs CPU plateau',
        'Main-thread budget',
        'Skeleton vs spinner',
        'Decode off MainActor',
        'Core Data fetches off the view context',
        'Structured concurrency for fan-out',
      ],
    },
    {
      id: 'd8-p4',
      title: 'Crash only in production, EXC_BAD_ACCESS',
      difficulty: 'Expert',
      kind: 'Incident',
      prompt: `Crashlytics: \`EXC_BAD_ACCESS\` in a Swift closure, 2% of sessions, iOS 17+, cannot reproduce on your phone. There is no useful Swift line in some stacks. How do you investigate, what do you ship in the next build, and which local tools would you have used if you could reproduce?`,
      think: [
        'Is this a dangling unowned, a C pointer, or a race that frees under you?',
        'What extra evidence would make the next crash useful?',
        'Could dSYMs be missing, so the stack is a lie by omission?',
        'Would you block the release at 2%?',
      ],
      solution: `1. **Confirm symbols.** Upload dSYMs. A nameless frame is a process problem, not an iOS mystery. Re-process the crashes.
2. **Read the registers and the other threads.** Many “closure” crashes are \`unowned self\` after pop (Day 1) or a completion after dealloc. The other threads often show URLSession or a notification firing.
3. **If it smells concurrent:** Thread Sanitizer on a debug build, soak the feed. Look for unsynchronised mutation of an array or dict from a URLSession callback — problem 7 will light up red.
4. **If it smells lifetime:** replace \`unowned\` with \`weak\`, cancel tasks in disappear, audit \`withCheckedContinuation\` that can resume twice (undefined, can crash later).
5. **Ship breadcrumbs:** screen, last action, memory warnings, a flag for “this path.” MetricKit fatal diagnostics. Feature-flag the new path if it started in 4.3.
6. **If you get a repro:** Address Sanitizer rarely in Swift, Zombie Objects if ObjC is in the stack, Memory Graph, LLDB \`bt all\`.

Do not ship \`try?\` as the fix. Do not ignore Crashlytics because it is Firebase.`,
      explanation: `Two percent of sessions, EXC_BAD_ACCESS, only in production, iOS 17 and up, cannot reproduce on your phone. That sentence is a timing bug, a device class you do not own, or a lifetime bug that needs a pop plus a slow callback. Production-only means you are missing evidence, not that the compiler is haunted. First I would check dSYMs, because a stack that says “Swift closure” with no line is often an unsymbolicated frame, and you cannot debug a mystery you have not named. Once it has a name, I look for unowned and for continuations. unowned converts a Day-1 leak into a crash: the callback fires, the VC is gone, you die. A continuation resumed twice corrupts the runtime and can crash far from the resume, which is why the stack looks stupid.

I cannot reproduce on my phone because my phone is one core occupancy, one network speed, one way of popping a screen. Soak on a TestFlight build with TSan if you can stand the performance, or a debug soak with a monkey. Ship breadcrumbs in the next build so the following crash tells you the screen and the last action. Feature-flag the 4.3 path so you can turn it off without a full rollback. That is investigation as a sequence of bets, each one designed to make the next crash cheaper.

Two percent EXC_BAD_ACCESS blocks the release. A 0.01% WebKit crash in a web view you do not own might not. Rate times severity. Seniors say that out loud so product does not hear “we are looking at it” as “ship.”`,
      internals: `ARC inserts retain and release. A callback fired on a freed object is use-after-free. Swift will not always give a pretty line, especially across a closure context object. unowned is an unsafe unowned reference; it does not zero. weak zeros.

withCheckedContinuation: resume exactly once. Twice is undefined. Never resume from two queues without a flag. A resume after the task is gone is also bad. Checked continuations at least trap in debug.

EXC_BAD_ACCESS is a bad memory access: NULL plus offset, or a dangling pointer. In Swift it is often the second. Registers: x0 as self is a classic. Other threads: the smoker.

dSYMs: bitcode is gone, but still upload. Hidden symbols from a static lib will look like your crash is in your closure when it is in the lib.

TSan and ASan do not ship to the App Store. They are local and TestFlight-internal. MetricKit is what you get in production besides Crashlytics.`,
      testing: `Soak tests on CI (10 minute scroll) will catch some races and not this one if it is unowned. You can unit-test that a continuation resumes once — a flag, a second resume should be impossible. You cannot unit-test a Heisen-crash easily. A DEBUG assert that self is still alive in the callback is weak versus weak capture. Feature-flag plus metric: crash rate on versus off.`,
      pitfalls: `fatalError in a decoding default. Force unwrap of a URL from the server. Ignoring Crashlytics. Adding try? everywhere. Replacing unowned with force-unwrap self. Shipping a “fix” that is a sleep. Blocking on TSan CI for a crash you have not reproduced — TSan is slow and is not a substitute for symbols.`,
      alternatives: `MetricKit plus your own logger if Crashlytics is delayed. A/B rollback. Replacing the suspect callback with async/await Task stored on the VC and cancelled in deinit — often the real fix, not only a tool. Zombies if the stack crosses ObjC.`,
      tradeoffs: `weak plus nil checks versus crash. Always prefer weak for UI callbacks. unowned is for nested types that share a lifetime you can prove, not for URLSession. Breadcrumbs cost privacy review and are how you debug 2%. Feature flags cost infrastructure and are cheaper than a full store rollback. Blocking the release at 2% is painful and correct.`,
      followups: [
        {
          q: 'Continue after a crash in a continuation?',
          a: 'Never resume twice. Use a checked continuation and a resumed flag, or withCheckedThrowingContinuation carefully. The crash may be later; the bug is the second resume.',
        },
        {
          q: 'Would you block the release?',
          a: '2% EXC_BAD_ACCESS yes. A 0.01% rare WebKit crash maybe not. Rate times severity, said in the same sentence as the stack.',
        },
        {
          q: 'Why iOS 17+ only?',
          a: 'New runtime, new OS scheduling, a path that only compiles against 17 APIs, or a dSYM gap on 16. Do not assume it is “an iOS 17 bug.” Slice the crashes by your 4.3 feature flag.',
        },
        {
          q: 'Could this be the Main Thread Checker issue in problem 6?',
          a: 'UIKit-off-main is usually a log, sometimes a crash, more often a later corruption. Possible. The next build’s breadcrumbs plus a TestFlight with Main Thread Checker enabled internally would tell you.',
        },
      ],
      teaches: [
        'dSYMs first',
        'unowned use-after-free',
        'Continuations resume once',
        'Production breadcrumbs',
        'Feature flags as incident tools',
        'Rate times severity',
      ],
    },
    {
      id: 'd8-p5',
      title: 'Cold launch 4 seconds — before main, first frame, Home data',
      difficulty: 'Expert',
      kind: 'Performance',
      prompt: `MetricKit says time-to-first-draw is 4.1 s on a cold launch for a slice of iPhone 12 users. The team points at Home’s five APIs. You have one day with Instruments. How do you split the 4 seconds into before \`main\`, first frame, and Home data, what usually lives in each bucket, and what would you cut this week versus next quarter?`,
      think: [
        'What runs before main that you still own — static inits, +load, linked dylibs?',
        'What blocks didFinishLaunching before the first pixel?',
        'Is Home’s network even on the first-frame budget?',
        'Which tool recording answers which bucket?',
      ],
      solution: `Three buckets, three recordings. Do not mix them.

**Before main.** App Launch instrument / dyld. Static initializers, \`+load\`, the number of linked frameworks, first file I/O from a library that runs at load. Firebase, analytics, a logging SDK that opens a database in \`+load\`. You do not write Swift here, but you chose the dependencies.

**First frame.** From \`UIApplicationMain\` through the first CA commit. \`didFinishLaunching\`, scene setup, root VC \`loadView\`, Keychain (Day 5) if you block on it, fonts, storyboards, a synchronous \`ModelContainer\` load (Day 5 problem 3). The first pixel should not wait on network.

**Home data.** After first frame. The 2-second hitch from problem 3 lives here if you painted a shell. If you did not paint a shell, Home data has been incorrectly stuffed into first frame, and MetricKit’s time-to-first-draw includes your JSON decode.

This week: defer SDKs until after first frame, stop blocking launch on Keychain+network “are we logged in via /me”, show the last Home snapshot, move decode off main. Next quarter: cut frameworks, dynamic-to-static where it helps dyld, split the mega-app target. Prove with App Launch instrument before/after, same device, cold, not attached to Xcode’s extra cost if you can help it — a release TestFlight measure is the one MetricKit sees.`,
      explanation: `Four seconds to first draw is a launch problem until you prove it is not. The team pointed at Home’s five APIs because those are the code they know. If those APIs run after the first frame, they are a hitch, not a launch, and MetricKit’s time-to-first-draw would not include them. If didFinishLaunching awaits /me and a feed before making a window, then yes, Home data is your launch, and you designed it that way by accident.

I would spend the first hour on the App Launch instrument on a release-like build, on an iPhone 12, cold, not from Xcode if I can avoid the debugger tax. Before-main time is dyld and static work. If that is two seconds, no amount of async let on Home will save you. You start looking at how many dylibs you load and which SDK is doing I/O in +load. If before-main is 200 ms and first frame is 3.5 s, you are in didFinishLaunching: Keychain, Core Data load on main, a blocking /me, configuring twelve SDKs. If first frame is 400 ms and users still say the app is slow, they mean Home, which is problem 3, and MetricKit’s first-draw number is not the number they feel.

Seniors cut this week what is on the critical path of the first pixel: defer analytics, do not wait on network, do not migrate a 200 MB store on main, paint a shell. Next quarter is dyld and module count. Mixing those conversations is how you spend a quarter rewriting Home while +load still owns two seconds.`,
      internals: `dyld3/dyld4 loads images, runs initializers. Each dynamic framework has a cost. +load on ObjC classes runs before main. Swift static let’s at file scope run at first use, or earlier if something touches them from an initializer. A \`let api = APIClient()\` at file scope that opens a URLSession and reads Keychain can land in before-main or first-use depending on who references it.

didFinishLaunching: if you call a blocking API, you delay the first frame. scene(_:willConnectTo:) is the modern equivalent. The first CATransaction commit is first draw.

MetricKit histogram: time to first draw, time to first scroll, hang rate. They are different series. os_signpost with the App Launch template is how you align your intervals with Apple’s.

Xcode attached: extra cost. Prefer a release configuration on device, Instruments without debugger, or MetricKit from TestFlight as ground truth.`,
      testing: `App Launch instrument, same device, cold, ten runs, median not best. Signposts: pre-main (you cannot easily), didFinishLaunching start/end, first frame, Home ready. A UI test that launches and waits for a tab bar is a first-frame proxy and will not tell you the buckets. Do not assert 4.1 s on CI simulators — they are not iPhone 12s.

A dependency audit: a script that lists linked frameworks. A launch test that fails if a URLSession fires before first frame (a debug flag on the HTTP client).`,
      pitfalls: `Optimising Home decode when before-main is the 4 seconds. Measuring with the debugger attached and calling it production. Warm launch mixed into cold stats. Blocking on /me to pick the root VC when a cached session would do. Initialising Firebase, Crashlytics, analytics, ads, and a feature-flag SDK inline in didFinishLaunching. Testing only on an iPhone 16 Pro.`,
      alternatives: `A dedicated Launch storyboard that is truly static — first pixel from the system, then you swap. Prewarming APIs on iOS that you do not control. App Launch optimization (dead code stripping, merging binaries) as a quarter project. Server-driven root is still a network on the first-frame path — do not.`,
      tradeoffs: `Deferring SDKs: later crash reports for crashes that happen in the first second, faster first pixel. Cached session versus /me: you may show Home then bounce to login if the token is dead — Day 5 refresher handles that better than blocking launch. One binary versus many dylibs: compile time versus dyld. Measuring on iPhone 12: slower, honest for the MetricKit slice. Measuring only on the newest phone: flattering, useless.`,
      followups: [
        {
          q: 'Where does Keychain fit?',
          a: 'First frame if you block on it to choose the root. Make it AfterFirstUnlock and async. A cached “wasLoggedIn” flag in a tiny defaults bool is OK; the token itself is not in defaults (Day 5).',
        },
        {
          q: 'Can SwiftUI App.init be before-main expensive?',
          a: 'App.init and the first body towards the first frame. A ModelContainer load in App.init is problem 3 on the first-frame budget. Defer it.',
        },
        {
          q: 'Home’s five APIs after a shell — still launch?',
          a: 'Not first draw. It is time-to-interactive. Track it separately or you will “fix launch” by showing an empty shell and calling MetricKit green.',
        },
        {
          q: 'Would Time Profiler alone be enough?',
          a: 'It names functions. App Launch names phases. You want both if first frame is fat. Time Profiler without phases is how Home gets blamed for dyld.',
        },
      ],
      teaches: [
        'Launch phases',
        'Before main vs first frame vs data',
        'App Launch instrument',
        'Defer SDKs',
        'Do not block first pixel on network',
        'MetricKit vs what users feel',
      ],
    },
    {
      id: 'd8-p6',
      title: 'Main Thread Checker: UIView.bounds in a URLSession callback',
      difficulty: 'Senior',
      kind: 'Debug',
      prompt: `Xcode pauses: Main Thread Checker, \`- [UIView bounds]\`, stack through \`URLSession:dataTask:didReceiveData:\` and your \`ImageLoader\` completion. It happens when a cell image returns. Production has a 0.2% crash cluster that looks like UIKit mutation. The loader is:

\`\`\`swift
URLSession.shared.dataTask(with: url) { data, _, _ in
    let image = UIImage(data: data ?? Data())
    self.imageView.image = image
    self.imageView.layer.cornerRadius = self.imageView.bounds.width / 2
}.resume()
\`\`\`

Fix the thread story. Say what stays off main, what hops, and how this relates to the Day 5 challenge-handler deadlock if someone “fixes” it with \`DispatchQueue.main.sync\`.`,
      think: [
        'Which queue is URLSession’s completion on for a shared session without a delegate queue you set?',
        'What is illegal on that queue — UIImage(data:), or UIView.bounds?',
        'Where should decode live relative to the hop?',
        'Why is main.sync the wrong hop from a session callback?',
      ],
      solution: `URLSession completions for \`shared\` run on a session-owned background queue, not main. \`UIView.bounds\` and \`imageView.image =\` are UIKit. That is the checker. \`UIImage(data:)\` may stay off main — that is the expensive part from problem 1.

\`\`\`swift
URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
    let image = data.flatMap(UIImage.init(data:))
    DispatchQueue.main.async {
        guard let self else { return }
        self.imageView.image = image
        self.imageView.layer.cornerRadius = self.imageView.bounds.width / 2
    }
}.resume()
\`\`\`

Better: downsample off main, hop the small buffer, weak self, cancel the task in reuse.

async/await:

\`\`\`swift
let (data, _) = try await URLSession.shared.data(from: url)
let image = UIImage(data: data)
await MainActor.run { self?.imageView.image = image }
\`\`\`

If the caller is already \`@MainActor\`, decode **before** you hop back, or you put decode on main and recreate problem 3.

Do not \`main.sync\` from the session queue. If main is waiting on that session (Day 5 challenge, or any \`sync\` the other way), you deadlock. async hop only.`,
      explanation: `The red pause was a gift. Production’s 0.2% UIKit cluster was the same bug without the checker. URLSession.shared’s completion is not on main. UIView.bounds is. The loader decoded on the background queue — that part was accidentally right — then set the image and read bounds to round the corners, on that same queue. UIKit is main-thread affine. Sometimes it works. Sometimes you corrupt the layer tree. Sometimes you crash later in a stack that looks like EXC_BAD_ACCESS in a closure, which is how this ticket might have been filed as problem 4.

The fix is a hop, but the hop has a shape. Decode stays off main because that is memory and CPU. The assignment and bounds read go to main asynchronously. weak self because the cell was reused or the VC popped (Day 1). If you DispatchQueue.main.sync, you have invented the Day 5 deadlock: the session queue waits for main, main waits for the session. The checker will be quiet, the phone will freeze, and you will have “fixed” a threading bug by creating a worse one.

async/await does not save you by existing. await URLSession.shared.data returns on the caller’s actor. A @MainActor cell that awaits data and then decodes has moved decode onto main. A nonisolated loader that decodes then MainActor.run is the same shape as the DispatchQueue.async fix. Think about where the bytes become a bitmap, then where the bitmap touches a view. Those are two places.`,
      internals: `Main Thread Checker swizzles UIKit entry points and checks pthread_main_np. It is not a data race detector. It will not catch your dictionary mutation (problem 7). It will catch bounds.

URLSessionConfiguration: you can set delegateQueue to main. Then completions are on main, decode is on main, hitch. Do not do that to silence the checker.

UIImage(data:) is not UIKit-mutating in the same way; it can run off main. UIImageView.image = must not. layer.cornerRadius on a view’s layer from background is the same family.

Cell reuse: the completion must check that the URL is still the URL for this cell, or you paint the wrong image after a hop. Generation again, Day 5 problem 6 in miniature.`,
      testing: `Enable Main Thread Checker in the scheme. A unit test will not see UIView. A UI test on a feed that loads images, with checker enabled on a TestFlight-internal build, is how you soak. After the fix, the pause must not happen. Assert in the loader tests that the completion of the fake session does not call a spy marked @MainActor without an await — small, useful.

Never call the production crash “fixed” because the checker is off in Release. Checker is a debug tool. The hop is the fix.`,
      pitfalls: `main.sync. Moving decode onto main with the assignment. delegateQueue = .main to silence the checker. Strong self in the hop, cell leak. Not checking cell identity after the hop. Using Task.detached and then touching the view inside it. Assuming async/await means main.`,
      alternatives: `Kingfisher/Nuke, which already hop and downsample, if you configure them. A small ImagePipeline actor that vends UIImages to MainActor. UIImageView’s own loading APIs if you can live with them. All still need reuse identity.`,
      tradeoffs: `async hop: a frame of latency, correct. Decode on main: simpler code, hitch. delegateQueue main: checker quiet, feed hitch, still deadlock-prone if you sync the other way. Third-party image libs: less code, still a cache policy problem (problem 1). The hop is not optional. The library is.`,
      followups: [
        {
          q: 'Why did this pass review?',
          a: 'It looks like every tutorial from 2015. The checker is not on in every scheme. Production crashes were 0.2% and unsymbolicated. Turn the checker on. Treat it as a failed test.',
        },
        {
          q: 'Is UIImage(data:) safe off main?',
          a: 'Yes, generally. UIImageView assignment is not. Keep them on different queues. Downsample while you are off main.',
        },
        {
          q: 'SwiftUI Image in this story?',
          a: 'Decode off main, set a @Published UIImage on MainActor, or use a loader that already does. Do not UIImage(data:) in body (Day 3).',
        },
        {
          q: 'Could this deadlock with the pinning delegate?',
          a: 'If the image session is the pinning session and you main.sync from a callback while main is in data(for:), yes. Separate concerns, async hops only.',
        },
      ],
      teaches: [
        'URLSession completion queue',
        'UIKit main-thread affinity',
        'Decode off main, assign on main',
        'main.async vs main.sync',
        'Main Thread Checker vs TSan',
        'Cell identity after hop',
      ],
    },
    {
      id: 'd8-p7',
      title: 'TSan red: Combine @Published from a background queue',
      difficulty: 'Expert',
      kind: 'Debug',
      prompt: `Thread Sanitizer flags a data race: write to \`HomeVM._feed\` / \`Publisher.objectWillChange\` from a URLSession queue, read from main in SwiftUI. The VM is an \`ObservableObject\` with \`@Published var feed\`. The load is:

\`\`\`swift
func load() {
    URLSession.shared.dataTask(with: url) { data, _, _ in
        let feed = try? JSONDecoder().decode(Feed.self, from: data ?? Data())
        self.feed = feed
    }.resume()
}
\`\`\`

Explain the race, fix it in Combine and in async/await, and say what TSan will not catch that you still have to think about.`,
      think: [
        'Is @Published thread-safe, and which thread does SwiftUI read it on?',
        'Does objectWillChange need to fire on main?',
        'If you hop the assignment, where does decode stay?',
        'What races does TSan miss that still break this VM?',
      ],
      solution: `\`@Published\` is not a lock. Combine’s \`objectWillChange\` and the backing storage are not safe to write from a URLSession queue while SwiftUI reads on main. TSan is correctly screaming.

Combine fix: decode off main, assign on main.

\`\`\`swift
URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
    let feed = data.flatMap { try? JSONDecoder().decode(Feed.self, from: $0) }
    DispatchQueue.main.async {
        self?.feed = feed
    }
}.resume()
\`\`\`

Or \`.receive(on: DispatchQueue.main)\` on a dataTaskPublisher before \`assign(to: &$feed)\`. Decode with \`subscribe(on:)\` a background queue, receive on main.

async/await fix: isolate the VM to \`@MainActor\`, decode in a nonisolated context, assign on the way back.

\`\`\`swift
@MainActor
final class HomeVM: ObservableObject {
    @Published var feed: Feed?
    func load() async {
        let data = try await api.data()
        let feed = try JSONDecoder().decode(Feed.self, from: data)
        self.feed = feed
    }
}
\`\`\`

If \`load\` is on MainActor, move decode off it (problem 3). The assignment stays on MainActor. That is the hop TSan wanted.

TSan will not catch Main Thread Checker bugs, logic races on your cursor (Day 5 problem 6), or “last write wins” across two Tasks. It catches conflicting memory access. Use it for that.`,
      explanation: `TSan went red on a line that looked like a simple assignment. self.feed = feed in a URLSession completion. SwiftUI was reading feed on main to draw Home. Combine’s @Published backing store is just a property plus a send on objectWillChange. Two threads, one storage, no synchronisation. That is a data race in the C++ sense, and it is also a UIKit/SwiftUI contract break: ObservableObject is assumed to publish on main. You can get torn reads, missed updates, or a crash that looks like problem 4. The red stack is the lucky version.

The fix is the same hop as problem 6, with a different API surface. Decode belongs off main. The published assignment belongs on main. receive(on: DispatchQueue.main) is the Combine spelling. @MainActor on the VM is the Swift concurrency spelling. Both can still hitch if you decode after you have hopped. Seniors split those two lines on purpose.

What TSan will not save you from: two Tasks assigning feed in finish order (Day 2 search). A cursor reset while page 3 is in flight. A 409 like against a cache. Those are races in time, not races in memory. You still write generation tokens and cancellation. TSan is one instrument. It is not the definition of concurrency correctness. Turn it on in a soak scheme, do not expect it to replace the VM tests from Day 9.`,
      internals: `TSan instruments loads and stores. @Published’s setter writes the property and sends on a PassthroughSubject. SwiftUI subscribes on main. URLSession’s queue writes. Data race.

@MainActor serialises the VM. URLSession.data(for:) is not MainActor; when you await from a MainActor function you hop off for the wait and back for the resume. Code after await in a MainActor function runs on main. That is why decode after await is a hitch and a TSan-clean hitch.

assign(to: &Published.Publisher) must happen on the thread you want the write on. receive(on:) before assign.

Do not mark the URLSession delegate @MainActor to silence TSan. You will deadlock or hitch, Day 5 problem 7.

Sendable: Feed should be Sendable if you hop it across isolation. If it is a class, you have another conversation.`,
      testing: `TSan scheme, soak Home load. The red report must disappear after the hop. A unit test that calls the fake session completion on a background queue and asserts the published value on MainActor — in Swift Testing, await MainActor.run. Problem 5’s fake should complete on a background executor at least once, or every test completes on main and TSan never sees the race.

TSan CI is slow. A nightly soak is more realistic than every PR.`,
      pitfalls: `receive(on: main) then a heavy map that decodes on main. @MainActor on the delegate. Wrapping the assignment in NSLock and still notifying SwiftUI off main — you fixed TSan maybe, not the UI contract. Using Task.detached to decode and assigning without hopping back. Turning TSan off because it is red in a third-party SDK — isolate that, still fix your @Published.`,
      alternatives: `Observation (@Observable) with @MainActor model: same hop, different runtime. CurrentValueSubject you send on from main. A FeedStore actor that vends values to the VM via an AsyncStream; the VM assigns on MainActor. All valid. The invariant is: UI reads on main, publishes on main.`,
      tradeoffs: `Always hopping to main: simple, can hitch if the hopped block is fat. Fine-grained: decode off, assign on, more code, the right split. TSan on every PR: correctness, 5× test time. Nightly TSan: practical. @MainActor VM: easy reasoning, easy to accidentally decode on main. A store actor: cleaner isolation, more types.`,
      followups: [
        {
          q: 'Will TSan catch the pagination generation bug?',
          a: 'No. That is applying a stale payload on the same thread. Memory is fine. State is wrong. Day 9 VM tests catch it. TSan will not.',
        },
        {
          q: 'Is Combine banned?',
          a: 'No. receive(on: main) is mandatory for UI. New code can be async/await. Both can race if you skip the hop.',
        },
        {
          q: 'Why not make Feed a class and mutate in place?',
          a: 'Worse. Now you have unsynchronised mutation of a class. @Published replacement of a value at least has a single publish point. Mutate on main or do not mutate.',
        },
        {
          q: 'Does @Published on a struct copy save you?',
          a: 'No. The race is on the VM’s storage and the publisher, not on Feed’s copy-on-write.',
        },
      ],
      teaches: [
        'TSan vs logic races',
        '@Published is not thread-safe',
        'Publish UI state on main',
        'receive(on:) / MainActor hop',
        'Decode off, assign on',
        'Sendable across isolation',
      ],
    },
    {
      id: 'd8-p8',
      title: 'Memory Graph: the view controller is still alive after pop',
      difficulty: 'Expert',
      kind: 'Debug',
      prompt: `A navigation stack pops \`ProfileViewController\`. \`deinit\` does not print. You are in a debugger on a device with the Memory Graph paused after pop. Walk the investigation as a senior sitting next to a junior: what you click first, how you read incoming references, which retain is the bug versus a false lead, how LLDB confirms it, and how you prove the fix. Do not list tools. Tell the session.`,
      think: [
        'If the VC is in the graph, something still retains it — what is the first node you inspect?',
        'How do you tell a window’s still-on-screen retain from a cycle?',
        'Which incoming edge is usually the closure, the delegate, the timer, the task, the coordinator?',
        'What do you run after the code change before you call it done?',
      ],
      solution: `Sit down. Reproduce once with a \`deinit\` print so you believe the pop. Pause the Memory Graph. Search \`ProfileViewController\`. There is one. Select it. Incoming references.

You are looking for a cycle or a long-lived owner. The navigation controller should not be in the incoming list after a pop. If it is, you did not pop, or you are looking at a different instance — check the address against \`po\` from before the pop.

Typical edges, read as a story:

* A closure in \`URLSession\` or \`ImageLoader\` — Day 1. The session task is still in flight, strong self. Wait, or cancel on disappear; the node should vanish when the task ends if it was only lifetime, not a cycle. If it stays after the task finishes, the loader stored the completion.
* \`UIAction\` / button target — the control owns the closure, the VC owns the control.
* Coordinator \`children\` plus \`onClose\` capturing the coordinator strongly.
* \`Timer\` / \`NotificationCenter\` with \`self\` as target, not using block+token.
* Combine \`AnyCancellable\` stored on self, sink capturing self strongly — the cancellable sits on self, the sink sits on the cancellable: cycle.
* Swift concurrency: an unstructured \`Task\` on a global executor capturing self, not cancelled.

False leads: CFRunLoop, SwiftUI hosting, autorelease. If the only extra edge is a task that ends in 200 ms, wait and capture again. Do not “fix” a still-alive VC that is about to die.

LLDB, still in that session: \`po\` the VC, \`expr -l Swift -- self\` from a leftover breakpoint if you have one, \`bt all\` only if you are in a crash. For ownership, the graph is the tool. \`leaks\` command is optional.

Fix the edge you can name in a sentence: “the sink captures self strongly and is stored on self.” Make it \`[weak self]\`, cancel the task in \`deinit\` / disappear, nil the delegate. Then: pop 10 times, Memory Graph, **zero** \`ProfileViewController\`. Allocations generation mark, persistent bytes flat. The deinit print fires. That is the proof. A story without the second graph is a guess.`,
      explanation: `The junior wanted a list: Memory Graph, Leaks, Allocations, LLDB, Instruments. The session is simpler. The view controller is alive after pop. That is a reference count, not a missing tool. We reproduce, we pause the graph, we look at who points at ProfileViewController. The first useful click is that node’s incoming references, not a tour of the library navigator. One of those edges is the owner that should have died with the pop. You name it in English: the image loader still has our completion, or the coordinator still has us in children, or Combine is holding a sink that holds us. Then you decide whether that owner is allowed to outlive the screen. A URLSession task may, briefly. A coordinator’s children array may not.

False leads are how this session goes long. The run loop is always in the graph. A hosting controller may hold a SwiftUI child you forgot. Autorelease pools can keep something until the next spin — wait, capture again. If you “fix” a timer that was about to invalidate, you will ship a weak dance that was not the cycle and the deinit still will not print.

LLDB is how you confirm an address, not how you discover ownership. po the instance, compare to the graph. If you are in problem 4’s crash, bt all is the other session. This session ends with a second graph after the pop, empty of that class, and an Allocations mark that does not grow across ten push/pops. I would not accept a PR that says “we added weak self” without that picture. Weak self on the wrong closure is how the real cycle survives and the next person sits in this chair.`,
      internals: `The Memory Graph is a snapshot of malloc regions and incoming pointers the runtime can see. Swift closure contexts are heap objects that retain captured self. They show up as something like ProfileViewController.(init) in the graph, ugly but readable. Unowned does not show as a retain — and crashes in problem 4. Weak shows as a weak edge, dashed in the UI.

UINavigationController retains its stack. After pop, that retain is gone. If you still see the nav as an incoming strong edge, you are on the wrong instance or you presented instead of pushed.

Task: unstructured Task retains its captures until it completes or is cancelled and finishes unwinding. Storing the Task on the VC and cancelling in deinit is a cycle if the Task captures self strongly — cancel in viewDidDisappear, weak capture, or both.

LLDB: \`language swift\` expressions, \`image lookup\` for a symbol, malloc history on a pointer if Malloc Stack is on. Malloc Stack is the “who allocated this closure” answer when the graph’s edge is opaque.`,
      testing: `deinit print or a test double’s dealloc expectation after pop. Memory Graph in the PR: before, one VC; after pop, zero. Allocations: 10 push/pop, persistent ProfileViewController count 0. UI test will not catch this unless you have a lab memory ceiling. A DEBUG assert in viewDidDisappear that the loader’s task is cancelled is a decent belt.`,
      pitfalls: `unowned as the fix — you convert the leak into problem 4. Weak on the button action but not the loader. Killing a timer that was not the cycle. Reading the graph on simulator only for an issue that is a player on device (problem 1). Calling it done when deinit prints sometimes. Ignoring the coordinator because the graph also showed URLSession — both can be true; you may have two bugs.`,
      alternatives: `Instruments Leaks will not always show a Swift cycle as a leak if something still references the cycle from a root (session, singleton, nav). The graph is the right picture. Allocations persistent growth is the trend. There is no alternative to looking at incoming references. A third-party leak tool is still this session.`,
      tradeoffs: `deinit prints in DEBUG: noise, invaluable. Malloc Stack: memory and launch cost, turn on for the session, off after. Cancelling all work on disappear: saves leaks and battery, may cancel a write you wanted to finish — those writes should not live on a VC. Moving the loader to a store that outlives the screen: the VC can die, the work continues, you must not call UI on the dead VC (weak). That is the senior version of “the task may outlive the screen.”`,
      followups: [
        {
          q: 'The graph shows two ProfileViewControllers. Is that the bug?',
          a: 'Maybe. You pushed twice, or the first one leaked and you are looking at both. Pop once, see if one remains. The remaining one is the investigation.',
        },
        {
          q: 'When do you reach for LLDB malloc history?',
          a: 'When the incoming edge is a closure context with no useful name. Malloc Stack tells you the allocation site of that context. The graph told you it exists; history tells you which line captured self.',
        },
        {
          q: 'SwiftUI equivalent of this session?',
          a: 'A @StateObject that should have died with the identity. The graph shows the model, not a VC. Same incoming-reference walk: a Task in onAppear, a NotificationCenter, a singleton cache of models.',
        },
        {
          q: 'How does this connect to 900 MB in the feed?',
          a: 'If the graph shows 40 feed VCs, you are here, not in image decode. If it shows 1 VC and 200 UIImages, you are in problem 1. The first click on the graph is how you know which problem you are in.',
        },
        {
          q: 'Would you use unowned on the coordinator’s onClose?',
          a: 'No. Weak. The coordinator can outlive a child if you got the children array wrong the other way. Unowned is a crash the first time that is true.',
        },
      ],
      teaches: [
        'Incoming references, not a tool list',
        'Cycle vs short lifetime',
        'Closure contexts in the graph',
        'Second graph as proof',
        'weak vs unowned after a leak',
        'Cancel work that holds UI',
      ],
    },
    {
      id: 'd8-p9',
      title: 'Battery 15% overnight, app not on screen',
      difficulty: 'Senior',
      kind: 'Incident',
      prompt: `Reviews: “your app killed my battery overnight.” MetricKit energy is elevated for a cohort on iPhone 12–13. The app was backgrounded. Nobody was scrolling the feed. The team blames iOS 18 and a WKWebView promo on Home. Walk the investigation — Energy, Console, which subsystem is actually awake — and say what a fix looks like that is not “delete the WebView.”`,
      think: [
        'Is the cost CPU, radio, location, audio, or a process you left running?',
        'Did a timer, socket, or location manager survive scenePhase .background?',
        'Are silent pushes waking you into a full sync?',
        'Would Energy first, or Time Profiler first, and why?',
      ],
      solution: `Energy on a device, screen locked, app backgrounded, ten minutes. You want the breakdown: CPU, network, location, display, GPU, audio. Display should be zero. Then Console filtered to your bundle, locationd, mediaserverd, wirelessproxd.

Map the bar to a hypothesis:

* CPU plateau → a Timer, Combine pipeline, or SwiftUI body loop that ignored \`scenePhase\` (problem 2, now off-screen).
* Radio / networking → WebSocket the chat screen did not own, a polling loop, background URLSession that never calls the completion, or a retry-forever refresh.
* Location → \`Always\` or significant-change used as a cheap substitute for a product you did not want to prompt for.
* Audio → \`AVAudioSession\` left active after a story, or a WKWebView that kept playing.
* Wakeups → silent pushes that start a full Home load, or BGAppRefresh that decodes the feed.

Fix the owner, not the library. Stop the session-owned socket when backgrounded past a bounded task. Invalidate timers in \`scenePhase\`. Background URLSession only for the user-started upload, and complete it. Location \`WhenInUse\` unless you are a tracker. Pause or tear down off-screen WKWebView media. Batch silent pushes; do not run problem 3’s decode in the background.

Re-record with the screen locked. Simulator energy is a toy. Overnight on device is the product.`,
      explanation: `Reviews said the app ate fifteen percent overnight. Nobody had it open. The team blamed iOS 18 and a WKWebView promo on Home, which is how you know they have not opened the Energy instrument. Background drain is not “a WebView exists in the tree.” It is a timer, a socket, a location manager, a URLSession that never finished, or an audio session you forgot to deactivate — still running after the scene went away.

Energy is the right first tool here, which is the opposite of problem 2. Problem 2’s screen was on and cooking; Time Profiler named the function. Overnight, you do not know which subsystem is awake. Energy tells you CPU versus radio versus location versus audio. Console tells you who. If CPU is a plateau, you inherited problem 2’s render loop and it survived scenePhase. If radio is up, chat’s WebSocket was owned by a screen that popped, or never owned by the session, and it reconnects in the pocket. If location is up, someone requested Always because significant-change felt free. It is not free. If the bar is wakeups, silent pushes are starting a full feed decode — problem 3, now on a budget of millijoules.

The WebView is guilty only if it kept a process or media running off-screen. Pause it, or do not keep it alive for a banner the user is not looking at. Seniors name the subsystem the graph showed, they turn that owner off when the scene is inactive, and they re-record with the screen locked. “We removed the banner” without a second Energy run is a story, not a fix.`,
      internals: `\`scenePhase\` / \`UIApplication.didEnterBackgroundNotification\` is the cancel point. A \`Timer.publish\` retained by a view that is not in the hierarchy can still fire if the subscription lives on a singleton. WKWebView has a content process; \`isInspectable\` is unrelated — you want media paused and, if the banner is gone, the view gone.

URLSession background events wake the app. A task you never complete keeps waking you. WebSockets are not a background mode you get for free; the OS will kill them, and your reconnect loop is the battery bug.

Location: \`allowsBackgroundLocationUpdates\` plus Always is a product and a review. Significant-change still costs radio. Silent pushes: \`content-available\` with a collapse id, a short job, no image pipeline.

MetricKit energy diagnostics in production are histograms, not a stack. os_signpost around background work lets you align “we woke” with “we did this job” in a custom instrument when you can reproduce.`,
      testing: `Energy before/after on the same device, screen off, same ten minutes, same OS. A DEBUG flag that logs every timer, socket connect, and location start with a reason string — leftover starts after background are a failed test. Unit-test that the realtime client’s \`stop()\` is called from the scene observer. You cannot CI overnight battery. A lab device on charge-logging is the closest thing.`,
      pitfalls: `Blaming the WebView without Energy. Time Profiler first while the app is foregrounded, then calling overnight fixed. Simulator. Leaving the socket on “so chat feels live.” Always location for a store-locator. Silent push that runs HomeVM.load. Deactivating audio in the wrong category and breaking the user’s podcast on resume. Shipping a fix without a second locked-screen recording.`,
      alternatives: `MetricKit in the wild plus a cohort device you can Instruments. os_signpost intervals on background tasks so Console is not your only breadcrumb. Push-to-sync with a budget instead of a socket in the background. A real background URLSession for the one upload, not for chat.`,
      tradeoffs: `Keeping the socket alive in background: unread feels instant, battery dies, iOS will kill you anyway. Significant location: cheap product idea, expensive radio. Silent pushes: fresher widgets, more wakeups — collapse and budget. Tearing down WKWebView: slower banner next appear, zero background cost. Measure the overnight bar, not the slogan.`,
      followups: [
        {
          q: 'Energy first or Time Profiler first?',
          a: 'Energy first when you do not know the subsystem. Time Profiler when CPU is the bar and you need a function. Overnight with the screen off starts at Energy.',
        },
        {
          q: 'Could this be the 100% CPU screen from problem 2?',
          a: 'Only if that loop survived backgrounding. If Energy shows CPU in background, yes — same loop, now a battery bug. If Energy shows location or radio, no.',
        },
        {
          q: 'Is a Notification Service Extension this incident?',
          a: 'NSE is a different process with a short leash. A flood of pushes that each wake the app is this incident. Collapse ids and do not start Home load from a push.',
        },
        {
          q: 'Where does os_signpost help in production?',
          a: 'You cannot attach Instruments to the reviewer’s phone. MetricKit plus signposted background jobs tell you “we woke and ran sync” versus “we woke and decoded the feed.”',
        },
      ],
      teaches: [
        'Energy names the subsystem',
        'Background ownership',
        'scenePhase as cancel',
        'Silent push budgets',
        'Location and audio leftovers',
        'Re-record screen-off',
      ],
    },
    {
      id: 'd8-p10',
      title: 'Home hitch is fsync, not JSON',
      difficulty: 'Senior',
      kind: 'Performance',
      prompt: `Opening Home still hitchs ~400 ms after you moved JSON decode off the MainActor (problem 3). Time Profiler no longer shows JSONDecoder. It shows \`sqlite3_step\`, \`Data.write\`, \`NSFileCoordinator\`, and an analytics SDK flush. Likes hitch too — every heart waits on a save. How do you prove disk is the hitch, what usually sits on main, and what you move or batch?`,
      think: [
        'Is this File Activity / System Trace, or still Time Profiler?',
        'Which writes are on the viewContext versus a background context?',
        'Is analytics flushing a bitmap or a JSON line on every event, on main?',
        'Would a memory-mapped read of a 200 MB store on appear explain 400 ms?',
      ],
      solution: `Time Profiler already named the functions. Believe it. File Activity or System Trace on device confirms the syscalls: \`fsync\`, \`write\`, coordinated file access. os_signpost around appear and around like so the interval matches the 400 ms.

Usual main-thread disk:

* \`viewContext.save()\` on every like or keystroke.
* Reading a large SQLite / Core Data store on appear to build the UI (problem 3’s fetch, now proven I/O).
* Analytics SDK writing a file per event, or flushing on main because “it is just one line.”
* Logging that interpolates and writes on every scroll callback.
* Image disk cache that decodes *and* writes the sized file on the hop back to main.

Fix: saves on a private queue context, batched (end of the run loop, or N events, or background task). Home’s first frame from a slim snapshot already in memory or a tiny file, not a WAL checkpoint. Analytics off main, batch, cap. Logging async. Image pipeline writes disk off main — Day 10’s pipeline, same hop as problem 6.

Re-profile. The 400 ms should leave the main stack. If Time Profiler now shows layout, you are in problem 12, not here.`,
      explanation: `They did the right thing for problem 3 and the hitch remained. That is the senior failure mode: you moved decode and assumed the two seconds were only JSON. Four hundred milliseconds on every like is how users describe “the app feels cheap.” Time Profiler was not subtle. sqlite3_step, Data.write, NSFileCoordinator. Disk on main. The team had never opened File Activity because they already had a story about SwiftUI.

Core Data on the viewContext is convenient and affine to the UI. It is also a writer that can fsync while the run loop is trying to commit a heart animation. Analytics SDKs love a file. One JSON line feels free until it is a coordinated write under a lock the main thread holds. Logging in scrollViewDidScroll is the same incident at 60 Hz. An image cache that downs samples off main and then writes the JPEG on main has split the job wrong: the hop was for UIKit, not for the filesystem.

The shape of the fix is the same hop as problems 3 and 6, aimed at I/O. Private context, batch the likes, first pixel from a snapshot that does not walk a 200 MB store. Analytics on a serial background queue with a size cap so you do not recreate problem 1 with log files. os_signpost around like and appear so the next PR cannot claim victory with “we feel it is better.” If the signpost still says 400 ms after the save moved, you fixed a writer, not the writer. Keep going.`,
      internals: `Core Data: \`viewContext\` is main. \`performAndWait\` on main waiting for a background writer is inversion — problem 3. WAL checkpoints on appear of a large store are hitch-shaped. A background context saves, then mergeChanges onto the view context with slim objects.

\`Data.write(to:options: .atomic)\` is a write plus a rename plus often an fsync. Fine off main. Fatal on main in a like handler.

NSFileCoordinator serialises access across processes (app group, extensions). Doing it on main means the widget’s reader can hitch Home. Day 10’s widget design belongs off this path.

os_signpost \`.begin/.end\` with \`OSSignposter\` around \`save\` and around appear. Points of Interest in Instruments. MetricKit extended launch / hang can show the same interval in production without a USB cable.`,
      testing: `Signpost a like: fail a performance test on a reference device if the main-thread interval exceeds a budget. Unit-test that the like store does not call save on an actor labelled main — inject a saver spy. File Activity screenshot in the PR: writes not on main. XCTest cannot see fsync on CI VMs reliably; do not assert 400 ms there.`,
      pitfalls: `Moving decode again. \`try context.save()\` in a Combine sink on main “just for now.” Disabling WAL. Writing analytics synchronously so crashes flush — that is a crash reporter’s job, not yours on the like path. Measuring on an iPhone 16 Pro NVMe and calling iPhone 12 fixed. Logging the hitch with a disk write.`,
      alternatives: `os_signpost + Time Profiler without File Activity if the stack already says sqlite3. SwiftData on a background ModelContext, hop snapshots. A dedicated EventsActor that batches. MetricKit hang rate after the change as the production proof.`,
      tradeoffs: `Saving every like: durable, hitchy. Batching: a kill can drop the last heart — reconcile on next sync, like the feed’s optimistic store. Snapshot file for first frame: stale, fast, you already made this choice in Day 5. Analytics immediately on disk: better crash trails, worse scroll. Batch and cap.`,
      followups: [
        {
          q: 'Would Main Thread Checker catch this?',
          a: 'No. Disk is legal on main. It is merely expensive. Checker is problem 6. Profiler and File Activity are this.',
        },
        {
          q: 'Is this the 2-second freeze?',
          a: 'Same family: main was busy. Problem 3 was decode and fetch. This is the leftover I/O after you moved decode. Same hitch instruments, different hottest stack.',
        },
        {
          q: 'Where do image cache writes belong?',
          a: 'Off main, in the pipeline. The MainActor hop is UIImage assignment, not JPEG write. Size belongs in the cache key so you do not write 4000×3000 for a 120 pt row.',
        },
        {
          q: 'Can os_signpost ship to production?',
          a: 'Yes, Points of Interest / MetricKit-friendly signposts. Sample them. They are how you see this hitch on the phones you do not own. Problem 12 is that story at FPS scale.',
        },
      ],
      teaches: [
        'Disk on main is a hitch',
        'File Activity follows Time Profiler',
        'Batch Core Data saves',
        'Analytics off the UI actor',
        'os_signpost around I/O',
        'First frame from a slim snapshot',
      ],
    },
    {
      id: 'd8-p11',
      title: 'Watchdog killed us: 0x8BADF00D',
      difficulty: 'Expert',
      kind: 'Incident',
      prompt: `Crashlytics: \`0x8BADF00D\`, watchdog, ~0.4% of sessions, mostly iPhone 12, mostly after 4.4. Main is stuck; the stack is often in your code or in a lock, sometimes in dyld or a system wait. MetricKit hang rate moved with the release. This is not the 2-second Home freeze (problem 3) and not EXC_BAD_ACCESS (problem 4). What is a watchdog hang, how do you investigate without a local repro, and what do you ship in the next build?`,
      think: [
        'How long was main stuck — hang versus hitch versus launch?',
        'Is this didFinishLaunching, a synchronous Keychain+network, or a deadlock?',
        'Would breadcrumbs and signposts make the next crash useful?',
        'Do you block the release at 0.4% hangs?',
      ],
      solution: `Watchdog kills when main does not service the run loop for long enough — seconds, not 400 ms. \`0x8BADF00D\` is that kill. Hitches get one-star reviews; this gets a crash. Problem 3’s two seconds will not usually watchdog. Eight seconds in \`didFinishLaunching\`, a \`DispatchQueue.main.sync\` deadlock (problem 6’s wrong hop, Day 5’s challenge handler), or \`performAndWait\` inversion will.

Investigation without a USB cable:

1. Symbols. dSYMs, then read the crashed thread and the others. A lock wait on main plus a worker waiting on main is a deadlock, not “slow JSON.”
2. MetricKit hang diagnostics / fatal hang reports: duration, exception codes, sometimes a stack sampled while hung.
3. Slice by 4.4 flag, OS, device class. Launch hangs versus mid-session hangs are different buckets — problem 5 versus a screen.
4. Ship breadcrumbs and \`os_signpost\` intervals around launch, appear, pay(), sync. Sample in production. The next hang should name the interval that did not end.
5. If it smells like launch: App Launch + Time Profiler on iPhone 12, release-like, not debugger-attached. If it smells like deadlock: Main Thread Checker will not catch sync-on-sync; read the other threads, then TSan if a race caused a retry loop that held a lock.

Ship: move the work off main, never \`main.sync\` from a session queue, do not block first pixel on network (problem 5), feature-flag 4.4 if the hang cluster started there. 0.4% watchdog is a release blocker in the same sentence as 2% EXC_BAD_ACCESS. Rate times severity. A hang is a crash.`,
      explanation: `Users do not say watchdog. They say the app disappeared. Crashlytics says 0x8BADF00D, which is Apple’s joke and a precise diagnosis: main did not pump the run loop long enough that the OS murdered you. That is not problem 3. Two seconds on Home is a hitch. Watchdog is seconds, often at launch or behind a lock, and it counts against crash-free rate. The team will try to file it next to EXC_BAD_ACCESS because both are red. Different bugs. Problem 4 is a bad pointer. This is a stuck run loop.

I cannot reproduce on my 16 Pro because 4.4’s new sync path is fast there and deadlocks only when the Keychain is slow after reboot, or when a URLSession callback tries main.sync while main is in data(for:). The other threads are the investigation. If one of them is the session queue and main is in a semaphore, you already wrote this bug in problem 6 and Day 5. If main is in sqlite3 or JSONDecoder for eight seconds, you ignored problems 3 and 10 on a bigger payload. If main is in dyld and +load, you are in problem 5’s before-main bucket and no amount of async let on Home will save you.

The next build is evidence. os_signpost around launch phases and around the 4.4 path, MetricKit hang reports, a flag to turn the path off. Then you attach Instruments on an iPhone 12, cold, release, and you wait until the signpost that never ended has a name. Seniors block the release. A 0.4% hang is not “we are looking at it.” It is a crash with a polite exception code.`,
      internals: `SpringBoard’s watchdog uses a time budget for launch and for event handling. Exceed it, you die, exception code 0x8BADF00D. Hang detection in MetricKit samples stacks during long main stalls even when you do not die — hang rate can move before kills do.

\`DispatchQueue.main.sync\` from a background queue while main waits on that queue is deadlock: infinite hang, watchdog if the OS still counts. \`NSManagedObjectContext.performAndWait\` on main waiting for a parent writer is the same shape.

os_signpost: \`OSSignposter\` with a subsystem you own. In production, keep intervals coarse (launch, screen appear, pay) to limit cost. Instruments Points of Interest will show unmatched begins as the smoking gun.

+load / static initializers: before main, you do not have Swift, you still have watchdog. App Launch instrument, not a breakpoint in didFinishLaunching.`,
      testing: `You cannot unit-test a watchdog. You can unit-test that a session callback hops async, not sync. You can performance-test launch signposts on a reference device. Soak with Main Thread Checker will not catch this; a deadlock hang test that times out is a clue if you can reproduce. After the fix: MetricKit hang rate down on the 4.4 cohort, not a story about iPhone 12 being old.`,
      pitfalls: `Calling it a Memory Graph problem. Adding try? around the hung call. Raising the watchdog — you cannot. Measuring launch with Xcode attached and declaring production fine. main.sync as the “fix” for problem 6. Ignoring unmatched signposts. Treating 0.4% as noise because EXC_BAD_ACCESS is 0.`,
      alternatives: `MetricKit only, if Crashlytics stacks are useless. A hotfix that flags off 4.4. Watchdog is not a tool you run; it is the crash. Time Profiler plus App Launch remain how you reproduce. Thread Sanitizer if the hang is a retry storm holding a lock.`,
      tradeoffs: `Coarse production signposts: cost and privacy review versus a hang you can name. Feature-flagging 4.4: slower product, live users. Blocking the release: painful, correct. Deferring SDKs to save launch: later crash reports in the first second, fewer watchdog kills — same trade as problem 5.`,
      followups: [
        {
          q: 'How is this different from the 2-second Home freeze?',
          a: 'Duration and outcome. Two seconds is a hitch and a review. Watchdog is a kill. Same family of main-thread work. Different budget and a different Crashlytics bucket.',
        },
        {
          q: 'Would you block the release?',
          a: '0.4% watchdog yes, same instinct as 2% EXC_BAD_ACCESS. A rare hang in a vendor SDK you cannot touch is a conversation. Yours in 4.4 is a flag or a hold.',
        },
        {
          q: 'First tool if the stack is in +load / dyld?',
          a: 'App Launch, before-main bucket, problem 5. Do not Time Profiler Home. Cut static work and SDK +load.',
        },
        {
          q: 'Can os_signpost itself hitch?',
          a: 'If you signpost per cell per frame, yes. Coarse intervals. Production sampling. Points of Interest is not a license to log the feed.',
        },
      ],
      teaches: [
        'Watchdog vs hitch vs EXC_BAD_ACCESS',
        '0x8BADF00D is a stuck main run loop',
        'Deadlock from main.sync',
        'MetricKit hang diagnostics',
        'Production signposts as evidence',
        'Rate times severity',
      ],
    },
    {
      id: 'd8-p12',
      title: 'Feed is 40 FPS and the UIKit rewrite has 40 thumbs-up',
      difficulty: 'Expert',
      kind: 'Performance',
      prompt: `Feed scrolls at ~40 FPS on iPhone 12, ~60 on your 16 Pro. A rewrite-to-UICollectionView ticket is the most-upvoted in the tracker. Product wants a date. How do you measure (Core Animation FPS, Hitches, SwiftUI instrument, Time Profiler, os_signpost in production), when a UIKit cell is the right answer, and when the recording says you would rewrite the wrong layer?`,
      think: [
        'Is the miss in layout, decode, offscreen passes, or body / AttributeGraph?',
        'Are you measuring on the MetricKit device class or on your Pro?',
        'What would production signposts prove that a USB session cannot?',
        'What has to be true before you agree to a rewrite?',
      ],
      solution: `Measure on an iPhone 12, release-like, not attached if you can help it. Core Animation FPS / Hitches while flinging. Time Profiler during the fling, not during appear (appear is problem 3). If SwiftUI is in the stack, the SwiftUI instrument for body counts and ViewBody. os_signpost around cell bind, decode, and frame commit so you can see the same intervals in production via MetricKit / Points of Interest — your 16 Pro is not the cohort.

Decision tree from the recording, not from the ticket:

* Hottest stack is ImageIO / JPEG / \`UIImage(data:)\` on main → problem 1 and 6, downsample off main. A UIKit rewrite will still hitch.
* Hottest is sqlite / File I/O → problem 10. Rewrite will still hitch.
* Hottest is AVPlayer init in body → pool, identity, Day 10. UIKit cell may help because reuse is explicit, but the pool is the design.
* Hottest is AttributeGraph / your \`body\` of a row that observes the whole feed VM → Day 3 granularity. Fix observation. Then re-measure.
* Hottest is Auto Layout of a monster cell, or offscreen rendering (shadows, masks, blur) → you can fix that in either toolkit. UIKit is not magic.
* After those are gone, FPS still 40, SwiftUI instrument shows expensive diffs on every pixel of fling, cells are video + ads + complex chrome → UICollectionView compositional layout with stable ids is justified. Date the rewrite from that recording, not from the thumbs.

Production: signpost hitch intervals and a custom MetricKit metric for “frames over budget in the feed.” Shipping a rewrite because HQ has a Pro is how you spend a quarter on the wrong layer.`,
      explanation: `Forty FPS on the phone the MetricKit slice actually uses, sixty on the phone in your pocket, and a rewrite ticket with forty thumbs. That is a political document, not a measurement. Users feel dropped frames as cheap. They do not feel UIKit. If you rewrite Home into UICollectionView while decode still sits on main, you will ship a UIKit feed at 40 FPS and the thumbs will move to a SwiftUI-was-not-the-problem ticket.

The senior move is a fling recording on an iPhone 12. Hitches and Core Animation tell you whether you missed the deadline. Time Profiler tells you whether the miss was JPEG, sqlite, AttributeGraph, or a shadow that forced offscreen. The SwiftUI instrument is useful once Time Profiler has pointed at SwiftUI; starting there is how everything looks like views. os_signpost is how you stop lying with USB. You will not attach Instruments to the reviewer in Berlin. Coarse signposts around bind and decode, sampled, plus MetricKit hang/hitch, are the production graph. If those intervals say decode, you fix the pipeline. If they say body of a row that subscribed to the entire feed, you fix identity and observation — Day 3, not a framework conversion.

UIKit wins when you need explicit reuse, a player pool, and mixed ads that IGListKit-style diffing already understands, and when the recording still shows SwiftUI diff cost after the pipeline is clean. That sentence needs the recording. A date without it is a quarter you will not get back. Measure, cut the proven cost, re-measure, then maybe rewrite the cells. Seniors are willing to say UIKit. They are unwilling to say it because a ticket was popular.`,
      internals: `60 Hz: ~16.7 ms per frame. 120 Hz phones lie to you if you only test there. Core Animation instrument: FPS, offscreen pass, color blended layers. Hitches: long commit / render.

SwiftUI: body must stay a cheap projection. Observing a parent \`ObservableObject\` from every row invalidates the list on one like. \`EquatableView\` / observation at the row model, stable \`id\`. \`drawingGroup\` and blur are offscreen passes you can see.

os_signpost in production: \`OSSignposter\` intervals, avoid per-frame. MetricKit \`MXAnimationMetric\` / hitch histograms. Custom \`os_signpost\` can surface in Instruments when a user reproduces with a profile, and in your own aggregations if you emit durations through your analytics with privacy care (Day 10).

UICollectionView cells: \`prepareForReuse\` is the cancel point problem 6 already needed. Representables in SwiftUI still need identity or you recreate the session every keystroke.`,
      testing: `A performance XCTest with \`XCTOSSignpostMetric\` on a lab iPhone 12, fling fixture, budget on hitch time — brittle, better than nothing. Save Core Animation traces in the PR that claims 60 FPS. Production: MetricKit hitch rate on the 12 cohort before/after. Unit tests do not see FPS. A DEBUG overlay of FPS is for local soaks, not CI simulators.`,
      pitfalls: `Rewriting first. Measuring on a 16 Pro. Using the SwiftUI instrument before Time Profiler names a function. \`drawingGroup\` as a salve. Putting \`AVPlayer()\` in a SwiftUI property and blaming the framework. Per-frame signposts that become the hitch. Declaring victory from simulator Core Animation.`,
      alternatives: `Texture is history; the policy remains. UIKit cells hosted in SwiftUI via representable with a stable id — a hybrid, not a rewrite. CDN-sized images so decode is tiny. Dropping blur and shadows on iPhone 12 as a quality tier. That last one can beat a quarter-long rewrite.`,
      tradeoffs: `UICollectionView: reuse you can name, more code, ads and video get easier. SwiftUI: speed of product, observation bugs are FPS bugs. Production signposts: privacy and cost versus seeing Berlin. Quality tier on old phones: product will hate the conversation, users will prefer 60 FPS without blur to 40 with blur. Measure, then argue.`,
      followups: [
        {
          q: 'When do you agree to the rewrite?',
          a: 'When a fling recording on the MetricKit device class still shows SwiftUI diff / layout as the miss after decode, disk, and observation are fixed. Then UICollectionView is a date, not a vibe.',
        },
        {
          q: 'SwiftUI instrument or Time Profiler first?',
          a: 'Time Profiler. If the hottest frames are ImageIO, the SwiftUI instrument will waste an afternoon. If they are your body, then SwiftUI.',
        },
        {
          q: 'How do production signposts differ from a USB Instruments session?',
          a: 'USB is deep and lies if you used a Pro or a debugger. Production signposts are coarse and true for the cohort. You need both: USB to see the stack, production to know the stack is the incident.',
        },
        {
          q: 'Could this be problem 1’s memory pressure?',
          a: 'Yes. Jetsam is the extreme. Before that, memory warnings and compressed bitmaps hitch the fling. Allocations during the same recording. If dirty memory is the story, downsample, do not rewrite.',
        },
        {
          q: 'Does a hybrid SwiftUI list with UIKit video cells count as a rewrite?',
          a: 'It counts as putting the player where reuse is explicit. Often that is the actual win. You do not have to burn Home to the ground.',
        },
      ],
      teaches: [
        'Measure on the cohort device',
        'Hitches vs framework blame',
        'Time Profiler before SwiftUI instrument',
        'Observation granularity is FPS',
        'os_signpost in production',
        'Rewrite after the recording',
      ],
    },
  ],
}
