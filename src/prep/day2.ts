import type { PrepDay } from './types'

export const day2: PrepDay = {
  id: 'day-2',
  title: 'Day 2 — Concurrency',
  kicker: 'Races you can ship',
  intro:
    'You typed "swift" and the list filled with results for "sw". Async/await did not save you from that, because it never promised to. Today is cancellation, actor reentrancy, isolation hops, and the work you started from a GCD queue that nobody owns. By the end you should be able to say who runs last, who gets cancelled, and which executor you are actually on.',
  problems: [
    {
      id: 'd2-p1',
      title: 'Old search results overwrite the latest query',
      difficulty: 'Senior',
      kind: 'Debug',
      prompt: `A search field fires a request on every keystroke:

\`\`\`swift
@MainActor
final class SearchVM {
    var query = ""
    var results: [Hit] = []

    func textDidChange(_ q: String) {
        query = q
        Task {
            let hits = try await api.search(q)
            results = hits
        }
    }
}
\`\`\`

Typing "swift" sometimes shows results for "sw". Fix it. Then explain what happens if the user types 20 characters in 800 ms.`,
      think: [
        'Can two of these Tasks be in flight at once, and which assignment to results happens last?',
        'After await api.search, are you still on MainActor, and does that prevent the race?',
        'What should happen to the in-flight search when the query string changes?',
      ],
      solution: `Store the task and cancel it. Ignore stale completions even if cancel races the return:

\`\`\`swift
@MainActor
final class SearchVM {
    private var searchTask: Task<Void, Never>?
    var query = ""
    var results: [Hit] = []

    func textDidChange(_ q: String) {
        query = q
        searchTask?.cancel()
        searchTask = Task { [api] in
            do {
                let hits = try await api.search(q)
                try Task.checkCancellation()
                results = hits
            } catch is CancellationError {
                return
            } catch {
                if !Task.isCancelled { results = [] }
            }
        }
    }
}
\`\`\`

In SwiftUI, prefer \`.task(id: query)\` — the framework cancels when \`query\` changes. Debounce 200–300 ms so twenty keystrokes in 800 ms become a handful of requests, not twenty, and still cancel-and-replace so a slow early request cannot win.`,
      explanation: `You typed "swift" and the list is results for "sw". The network is fine. The last write won, and the last write was the request that *finished* last, not the one that *started* last. Each \`Task {}\` is unstructured: you fire it and forget it. Nothing in that API says "this is the search for the current query" or "kill the previous one." "sw" hit a slow path. "swift" came back quickly, painted the right rows, and then "sw" wandered in and painted over them.

\`@MainActor\` on the view model does not serialise those two searches into a happy queue of start-order. It serialises the snippets of code that run on the actor. Both tasks hop off to the network at \`await api.search\`. Both come back, one after the other, and each assignment to \`results\` is allowed. Isolation prevented a data race on the array. It did not prevent a logic race on which query the array represents.

Cancellation is cooperative. You cancel the previous task when the text changes. \`URLSession\` async APIs throw \`CancellationError\`. Your code still has to not assign \`results\` after that. \`checkCancellation()\` after the await is the habit: the request may complete in the same breath you cancelled, the task is cancelled, and you must not apply those hits. Twenty characters in 800 ms without debounce is twenty tasks, nineteen cancels, and a tired API. Debounce reduces starts; cancel-and-replace still decides the winner when two starts overlap.`,
      internals: `\`Task {}\` scheduled from a \`@MainActor\` method inherits the actor in current runtimes (the unstructured task runs with MainActor isolation unless you \`detach\`). That is why \`results = hits\` compiles. Inheritance is not a queue of searches. It is "when this task runs its synchronous bits, it hops to main."

\`\`\`text
Task A  search("sw")    ──────────►  finishes late  ──► results = sw   (wrong)
Task B  search("swift") ──► finishes early ──► results = swift
\`\`\`

Cancel sets a flag. The next \`await\` that checks it throws. Work that does not check — a completion-handler wrapper you forgot to cancel, a decode after a successful return you forgot to \`checkCancellation\` — still runs. Structured \`.task(id: query)\` ties the task to a value in the view graph: change the value, cancel the child, start another. That is the same cancel-and-replace policy, with the framework holding the handle.

Debounce is a timer, not a substitute. If you only debounce, two in-flight searches can still overlap when the user pauses twice. If you only cancel, you hammer the API. Together they match how search actually feels.`,
      testing: `Fake the API with controllable delay. Query "a" takes 300 ms, then "ab" takes 10 ms. Assert the final \`results\` belong to "ab". That is the whole bug in a unit test. Use an actor fake so the delays are deterministic, and \`await fulfillment\` for the second response.

Cancellation: start "a", immediately start "ab", complete "a" first in the fake. Assert "a" did not assign. Assert a \`CancellationError\` (or a no-op) on the first task. Heavy typing: inject a clock, fire 20 queries, assert at most one in-flight after debounce, and assert the last query is the one that landed.

Do not rely on a UI test that types fast on CI. The race will pass until it does not.`,
      pitfalls: `Debounce without cancel still races: two paused keystrokes, two requests, slower one wins. \`Task.detached\` drops actor inheritance; then you assign \`results\` off main and you have a real data race or a compiler error, depending on the type.

Checking \`query == q\` after await instead of cancelling works until two equal strings overlap (retry, duplicate events) or until a later "swift" and an earlier "swift " trimmed to the same value confuse you. Cancel the task. The identity of the work is the task, not a string compare you bolted on.

Swallowing all errors as \`results = []\` will clear the list when you cancelled, which flickers the UI. Catch \`CancellationError\` separately and leave the old results until the new ones arrive, or show a spinner tied to the current task.`,
      alternatives: `Combine \`debounce\` + \`switchToLatest\` is the same policy in publisher language: new inner search cancels the previous subscription. An \`AsyncSequence\` of queries with a loop that cancels the previous \`Task\` is the async equivalent. An actor that serialises searches one-at-a-time without cancel will show stale results in order, which is still wrong for search — you want latest-wins, not FIFO.

SwiftUI \`.task(id: query)\` is the default I want in a view. A UIKit view model has to store the \`Task\` itself because there is no view graph to hold it.`,
      tradeoffs: `Cancel-and-replace wastes in-flight work. That is cheaper than painting the wrong query, and cheaper than the support ticket. Debounce trades a few hundred milliseconds of latency for load; pick the number with a real keyboard, not a blog post.

Keeping old results on screen while the new search is in flight feels faster and can be wrong for a moment. Clearing on each keystroke feels honest and flickers. Most products keep the old list and show a small spinner. That choice is independent of the race: you still must not let "sw" overwrite "swift".`,
      followups: [
        {
          q: 'Does await block the main thread?',
          a: 'No. The task suspends. The main thread can run other work. A synchronous JSON decode after the await, still on MainActor, does block.',
        },
        {
          q: 'Why checkCancellation after search returns?',
          a: 'The request may complete in the same instant you cancel. Without the check you apply stale hits that arrived "successfully."',
        },
        {
          q: 'How do you test under heavy typing?',
          a: 'Inject a clock, fire twenty queries, assert debounce collapsed them and the final query is the last one.',
        },
        {
          q: 'Does comparing query == q after await replace cancel?',
          a: 'It is a belt. It does not stop wasted work, and it fails in edge cases where the string matches but the search was superseded. Still cancel the task.',
        },
      ],
      teaches: [
        'Unstructured Task races',
        'Last-finish vs last-start',
        'Cooperative cancellation',
        '.task(id:)',
        'Debounce vs cancel',
      ],
    },
    {
      id: 'd2-p2',
      title: 'Actor wallet is wrong after await',
      difficulty: 'Expert',
      kind: 'Predict',
      prompt: `\`\`\`swift
actor Wallet {
    private var balance = 100

    func withdraw(_ amount: Int) async -> Bool {
        guard balance >= amount else { return false }
        await bank.settle(amount) // hops off this actor
        balance -= amount
        return true
    }
}
\`\`\`

Two tasks call \`withdraw(100)\` at once. What can happen? How do you fix it without a deadlock?`,
      think: [
        'Are actor methods serialised, and does that still hold across an await?',
        'Is the guard still true when settle returns?',
        'If you lock around the await, who can you deadlock with?',
      ],
      solution: `Both calls can pass \`guard balance >= 100\`. After \`await\`, the actor is free to run the other \`withdraw\`. Both subtract. Balance goes negative, or you settle twice for money you had once.

Do not hold a logical lock across \`await\`. Decrement (or reserve) **before** the hop, and roll back on failure:

\`\`\`swift
func withdraw(_ amount: Int) async throws {
    guard balance >= amount else { throw WalletError.funds }
    balance -= amount
    do {
        try await bank.settle(amount)
    } catch {
        balance += amount
        throw error
    }
}
\`\`\`

Or settle first with server-side idempotency, then set local balance from the server truth. Optimistic reserve still needs idempotency keys if settle can succeed after a timeout you treated as failure.`,
      explanation: `You let two withdrawals into the actor and you still double-spent. That sentence is supposed to be impossible if you learned "actors are mutexes." They are not. An actor runs one job at a time on its executor. \`await bank.settle\` is the moment this job *gives the executor back*. The rest of \`withdraw\` is scheduled as a later job. The other \`withdraw\` can run in the gap. Both saw 100. Both think they won. Both ask the bank to settle 100. Both subtract.

That is reentrancy. It is not a data race. \`balance\` is never touched from two threads unsynchronised. Thread Sanitizer stays green. Sendable stays green. The invariant "balance never drops below zero" is just false.

The fix that feels like a mutex — "hold the actor until settle returns" — is not a thing you can do with \`await\`. If you take a real lock and then await, and settle needs the same actor or the same lock, you deadlock. The design rule is older than actors: do not hold a lock across a suspension point. On an actor, the suspension point *is* the lock release.

So you change the state machine. Reserve the money locally, hop, and put it back if the bank says no. Or do not keep a local balance at all and trust the server. Money wants the second story more often than the first, because rollback is how you show success and then unsucceed.`,
      internals: `The actor executor dequeues one job, runs it until it suspends or finishes, then dequeues the next. \`await\` on \`bank.settle\` suspends. Isolation is released. \`bank\` may be another actor, a process, a URLSession. When settle completes, a resume job is enqueued on the wallet. In between, other wallet jobs run.

\`\`\`text
Job A: guard ok (100) → await settle …
Job B: guard ok (100) → await settle …
Job A resume: balance -= 100  → 0
Job B resume: balance -= 100  → -100
\`\`\`

There is no OS lock held across the hop. \`nonisolated\` pieces of the actor, if you have them, can also run concurrently with the isolated jobs in ways that surprise you if they touch unsafely shared state. Here the bug is simpler: the isolated method itself is reentrant at \`await\`.

Idempotency keys on \`settle\` exist because the network can succeed after you timed out. Rollback then double-applies. That is not the actor's fault; it is why money code treats the server as truth.`,
      testing: `Two concurrent \`Task\`s, a bank fake that \`await Task.yield()\` (or a long sleep) before completing. Assert only one withdraw succeeds, or that balance never goes negative, depending on the policy you chose. Repeat under a loop; this is a race you can make deterministic with a yield, not a sleep(0.1).

Thread Sanitizer will not catch this. A test that only calls \`withdraw\` sequentially will not catch this. The test is the interleaving.

Also test failure: reserve, settle throws, balance restored. And timeout-plus-late-success if you can simulate it, which is the idempotency test, not the actor test.`,
      pitfalls: `Taking NSLock around the await deadlocks if the continuation needs the same thread or the same actor. \`nonisolated\` \`settle\` that calls back into \`Wallet\` from a completion handler can deadlock or re-enter depending on how you hop.

Reserve-first without handling failure leaves the money gone when the bank never heard of you. Settle-first without a local reservation lets two settles through. You must pick a side and write the failure path.

\`balance -= amount\` after await "because I want to subtract the real settled amount" is the original bug if you already checked the guard before the hop. Read the new balance from the server instead.`,
      alternatives: `A state machine on the actor: \`.idle\`, \`.pending(amount)\`, \`.settled\`. Only one pending allowed; further withdraws throw \`.busy\`. That serialises withdrawals without overlapping awaits on the same funds, at the cost of UX (the second tap waits or fails).

A child actor per account that processes a queue of operations, one \`await\` at a time by construction of the queue loop, not by hoping methods are atomic.

For real money, skip the local integer. Display server balance. Treat settle as the source of truth. The actor then holds in-flight request IDs, not cash.`,
      tradeoffs: `Reserve-first is snappy: the UI can show 0 immediately. Rollback is ugly if you already toasted "paid." Server-authoritative is slower to paint and is the one finance will sign off on. A pending state with a spinner is the middle: you did not lie about the balance, you did not overlap two settles.

Actors give you data-race freedom for free. They do not give you atomic business transactions across awaits. That part is still your state machine. The interview is whether you know the difference when the code looks serial.`,
      followups: [
        {
          q: 'Is this a data race?',
          a: 'No. It is a logic race / invariant failure. Sendable and TSan stay green.',
        },
        {
          q: 'Would a class plus a lock be safer?',
          a: 'Not if you lock across await or across a continuation that needs the same lock. Same design rule.',
        },
        {
          q: 'Does nonisolated(unsafe) on balance fix anything?',
          a: 'It makes it worse: now you can have a real data race. It does not prevent reentrancy of the method.',
        },
        {
          q: 'How do you teach this without saying "actors are mutexes"?',
          a: 'An actor is a serial executor with suspension points. Across await, other work on the same actor can run. Invariants must be re-checked or reserved before the hop.',
        },
      ],
      teaches: [
        'Actor reentrancy',
        'No logical lock across await',
        'Reserve vs server truth',
        'Idempotency on settle',
      ],
    },
    {
      id: 'd2-p3',
      title: 'JSON decode on MainActor',
      difficulty: 'Senior',
      kind: 'Performance',
      prompt: `A \`@MainActor\` view model:

\`\`\`swift
@MainActor
final class FeedVM {
    var items: [Item] = []

    func load() async {
        let (data, _) = try await URLSession.shared.data(from: url)
        items = try JSONDecoder().decode([Item].self, from: data) // 8 MB payload
    }
}
\`\`\`

Scrolling janks when refresh finishes. Instruments: a long hitch on main. What is wrong? How do you hop without creating a data race on \`items\`?`,
      think: [
        'Which isolation does load() resume on after URLSession returns?',
        'Is JSONDecoder work CPU-bound, and is that allowed on the main executor?',
        'How do you get the parsed array back onto MainActor for the assignment?',
      ],
      solution: `Await suspends; resume of this method is still on MainActor. Decode is CPU-heavy on the main executor. Hop off to parse, hop back to publish:

\`\`\`swift
func load() async {
    let (data, _) = try await URLSession.shared.data(from: url)
    let parsed = try await Self.decodeOffMain(data)
    items = parsed
}

nonisolated private static func decodeOffMain(_ data: Data) async throws -> [Item] {
    try JSONDecoder().decode([Item].self, from: data)
}
\`\`\`

A dedicated parser actor, or a task on the cooperative pool that returns a \`Sendable\` \`[Item]\`, is the same idea. Do not mark the whole view model \`nonisolated\`. Do not \`Task.detached\` and write \`items\` from the detached task.`,
      explanation: `Refresh finishes and the scroll hitch arrives in the same frame. You profiled it and the spike is \`JSONDecoder\` sitting under \`main\`. That feels unfair: \`load\` is \`async\`, the bytes came from \`URLSession\`, surely this already ran in the background. It did, for the network. \`async\` is not a background thread. \`@MainActor\` \`async\` means: the parts of this function that are not currently suspended in someone else's executor run on main. \`URLSession.data\` suspends you. When it resumes you, you are back on MainActor for the rest of \`load()\`, including the decode of eight megabytes of JSON, including the allocation of every \`Item\`, including whatever \`DateFormatter\` the decoder invented. The run loop cannot scroll while that happens.

The fix is an isolation hop you can see in the type system. A \`nonisolated\` function may run on the cooperative thread pool. You \`await\` it from main, decode off main, get a value back, and assign \`items\` on main. The compiler inserts the hops. \`Item\` needs to be \`Sendable\` (or you accept a warning / a copy) because it crosses the boundary. That is the data-race conversation: you do not mutate \`items\` off main. You produce an immutable (for the hop) array elsewhere and publish it on the actor that owns the UI state.

The hitch was never "networking on main." Networking was fine. The hitch was the work you did with the bytes after you already had them.`,
      internals: `MainActor is a global actor. The compiler hop to it is a scheduling point, not a thread lock you hold during await. While \`URLSession\` runs, main is free. When the continuation of \`load\` is enqueued on MainActor, it runs to the next await or to the end. \`JSONDecoder.decode\` is synchronous. There is no await inside it. So the whole decode is one MainActor job, and it is long.

A \`nonisolated async\` function is eligible for the concurrent thread pool. \`async\` on it matters because it gives you a suspension point to hop; a \`nonisolated\` *sync* decode called from MainActor would still run on main. That is why the helper is \`async\` even though decode does not await: you are buying a hop.

\`Task.detached\` also hops off, and also drops priority and actor context. If the detached closure captures \`self\` and writes \`items\`, you have escaped the actor. The compiler will fight you if \`FeedVM\` is MainActor-isolated. Do not win that fight with \`nonisolated(unsafe)\`.

Sendable \`Item\` means the parsed values can cross executors without sharing mutable state. Classes in the model graph make this painful; structs make it easy.`,
      testing: `Time Profiler: after the fix, decode should not sit under the main thread. A unit test can still decode on any thread; it will not catch the hitch. A metric: hitch time on refresh in a release-like build with the 8 MB fixture.

If you have a Swift Testing / XCTest case for \`load\`, inject a decoder or a parser protocol so you can assert \`decode\` was called off the main actor (a custom executor in tests, or \`MainActor.assertIsolated\` inside a fake that should *not* fire). That is fancy; the profiler is the honest test for this incident.

Also test failure: bad JSON throws, \`items\` unchanged, no crash when hopping back.`,
      pitfalls: `A detached task that captures \`self\` and writes \`items\` off main is the data race you were trying to avoid. \`Sendable\` on \`Item\` with a mutable class inside is a lie.

Making \`JSONDecoder\` a shared instance across threads: the decoder's date strategies and userInfo are not a reason to share one globally without thinking. Creating one per parse is fine at 8 MB; the allocations of the output dominate.

Hopping for a 2 KB payload is noise. Hopping for 8 MB is required. Measure once so you do not grow a religion about every \`decode\`.

\`await MainActor.run { decode }\` is the opposite hop. Do not "fix" this by wrapping decode in MainActor.run.`,
      alternatives: `A \`ParserActor\` that owns the decoder and returns Sendable DTOs. Background \`ModelActor\` if you are on SwiftData. Incremental / streaming decode if the payload is huge and you can show the first page. Smaller payloads if the real bug is the API.

Decoding into a throwaway DTO off main, then mapping to UI models on main in a tight loop, can still hitch if the map is large. Keep the map cheap or do it off main too, then assign once.`,
      tradeoffs: `Each hop costs a few microseconds and a bit of readability. Eight megabytes of JSON on main costs tens of milliseconds and a dropped frame. Hop. The type-system cost is Sendable models: you may copy, you may drop a class cache from the DTO. That is the right trade for UI isolation.

Keeping the whole view model off main and hopping *to* main only to publish is the architecture I prefer for heavy feeds. Then you cannot accidentally decode on main because \`load\` was never on main. The cost is every UI read hops, which is why \`@MainActor\` view models exist — convenience at the edge, danger in \`load\`.`,
      followups: [
        {
          q: 'Should the networking stack be @MainActor?',
          a: 'No. Keep the client off main; hop only to publish UI state.',
        },
        {
          q: 'Why is the helper async if decode is synchronous?',
          a: 'So the caller can await it and the compiler can hop off MainActor. A sync nonisolated call from main would still run on main.',
        },
        {
          q: 'What if Item is a class?',
          a: 'Crossing executors is then a Sendable problem. Prefer structs for parsed models, or isolate the class on one actor.',
        },
        {
          q: 'Does URLSession.data already decode off main?',
          a: 'It delivers Data. Parsing is your work, on whatever isolation you resume with.',
        },
      ],
      teaches: [
        'async is not background',
        'MainActor resume after await',
        'Isolation hops for CPU work',
        'Sendable models when publishing',
      ],
    },
    {
      id: 'd2-p4',
      title: '.task vs onAppear { Task }',
      difficulty: 'Senior',
      kind: 'Review',
      prompt: `Code review this SwiftUI screen:

\`\`\`swift
struct Profile: View {
    @StateObject var vm = ProfileVM()

    var body: some View {
        content
            .onAppear {
                Task { await vm.load() }
            }
            .onDisappear {
                // empty
            }
    }
}
\`\`\`

The user pops during load. A completion updates \`@Published\` on a dead screen and sometimes crashes in UIKit-hosted SwiftUI. What should they have written, and why is unstructured Task the wrong default?`,
      think: [
        'Who owns the Task created in onAppear, and is it cancelled on pop?',
        'What does SwiftUI .task bind the work lifetime to?',
        'If load uses a completion handler under the hood, does cancelling the Task cancel the network?',
      ],
      solution: `Use \`.task { await vm.load() }\`, or store a \`Task\` on the view model and \`cancel()\` it from \`onDisappear\` / \`deinit\`. \`.task\` is cancelled when the view is removed from the hierarchy. Unstructured \`Task\` from \`onAppear\` is not.

\`\`\`swift
.content
.task {
    await vm.load()
}
\`\`\`

If \`load\` uses async \`URLSession\`, cancellation propagates. If it uses a completion handler, you must cancel the \`URLSessionTask\` yourself; the unstructured \`Task\` ending is not enough if nobody forwarded cancel.

If the view model is the owner of the work (\`@StateObject\` that outlives a subview identity blip), put the \`Task\` on the VM and cancel when the *screen* is gone, not on every appear flicker.`,
      explanation: `You left the profile while it was still loading. The work did not leave with you. \`onAppear\` fired an unstructured \`Task\`, which is a child of the process, not of the view. Popping the view does not cancel it. \`load\` finishes, sets \`@Published\`, and SwiftUI (or a UIKit host) updates a graph that is gone or half-gone. Sometimes that is a warning. Sometimes it is a crash. Always it is a download you did not need, and a view model mutation nobody is watching.

This is Day 1's leak in a concurrency costume. The lifetime of the work must match the lifetime of the screen. \`.task\` is SwiftUI saying that out loud: when this view's task identity appears, start; when it disappears, cancel. \`onAppear\` is an event. Events do not have scopes. \`Task {}\` inside an event is how we used to \`DispatchQueue.global().async\` from \`viewDidAppear\` and forget \`viewDidDisappear\`.

\`@StateObject\` keeps the view model for the view's identity, which is good for form state and easy to confuse with "the load is owned." The object can outlive a disappear if identity is stable (tab switch). That is why the review is not only "use .task." It is: who owns the work, the view or the view model, and who cancels it when that owner dies.`,
      internals: `SwiftUI creates a task associated with the view's appearing identity for \`.task\`. Cancellation is sent when that identity goes away, when the \`id:\` value changes, or when the view is torn down. The task inherits the view's actor context, which is typically MainActor. That does not move decode off main; it only means the closure starts on main.

\`onAppear\` is a callback. \`Task {}\` there uses the same unstructured initializer as anywhere else. There is no parent task. There is no automatic cancel. \`onDisappear\` will not run in every teardown path you imagine (process kill, some hosting transitions), so even a manual cancel there is a courtesy, not a proof.

If \`load\` wraps a completion-based API without a cancel token, cancelling the Swift \`Task\` only prevents your code from applying the result (if you check). The URLSession task may still run. Structured cancellation is not magic; it is a flag plus APIs that honour it.`,
      testing: `Open the screen, pop immediately, assert the fake API saw cancel (or that no UI update fired after teardown). If the VM is owned by the view, assert \`deinit\` after pop when using \`.task\` and a cancellable load.

The crash in UIKit-hosted SwiftUI is flaky; do not make a UI test the only proof. Unit-test \`ProfileVM.load\` for cancellation: start, cancel, complete the fake, assert no \`@Published\` change. Then the view layer's job is only to cancel on disappear.

Also test identity: \`.task(id: userID)\` re-runs when the user changes, and the previous load is cancelled. That is a feature. \`.id(UUID())\` on the view re-runs forever; that is a bug.`,
      pitfalls: `\`.task\` re-runs when the view's identity changes. Do not put \`.id(UUID())\` on the view. Do not put \`.task\` on a row that is created and destroyed as you scroll unless you actually want a fetch per appearance — usually you want the model to cache.

Starting work in \`onAppear\` *and* in \`.task\` double-fetches. Pick one.

\`@StateObject\` plus \`.task\` that calls \`load\` every time a parent refreshes identity will reset. If load must happen once per VM lifetime, start it in the VM with a stored \`Task\` created once, cancelled in \`deinit\`.

Assuming \`onDisappear\` always pairs with \`onAppear\` in NavigationStack is optimistic. \`.task\` is the pairing the framework maintains.`,
      alternatives: `VM owns \`Task\` created in \`init\` / first \`load()\` if the VM lifetime *is* the screen lifetime (\`@StateObject\`). Then SwiftUI does not need \`.task\`, but you must cancel in \`deinit\`, which only runs if nothing else retains the VM (Day 1).

UIKit: start in \`viewDidAppear\` or a dedicated \`start()\`, cancel in \`viewDidDisappear\` / \`deinit\`. There is no \`.task\`. The unstructured \`Task\` handle lives on the VC.

Combine \`.sink\` in \`onAppear\` without storing the cancellable is the same class of bug.`,
      tradeoffs: `\`.task\` is the right default in SwiftUI because cancellation is the default. The cost is re-run on identity change, which you must understand. Unstructured \`Task\` in \`onAppear\` is the right tool only when you *want* work to outlive the view (a fire-and-forget analytics ping). Load of a screen is not that.

Putting work on the VM makes it testable without a view, and makes cancel your problem. Putting work in \`.task\` makes cancel the framework's problem, and makes "when does this run" a SwiftUI identity question. For profile load, I want \`.task\` or VM-owned task with deinit cancel, never a fire-and-forget \`onAppear\`.`,
      followups: [
        {
          q: 'Does .task run on MainActor?',
          a: 'The closure inherits the view\'s actor context, typically main. Still do not decode megabytes inside it.',
        },
        {
          q: 'Why did a UIKit host crash when a pure SwiftUI app only warned?',
          a: 'UIKit-hosted SwiftUI is less forgiving about updating a representable or VC after teardown. The lifetime bug is the same; the symptom is louder.',
        },
        {
          q: 'Should load() check Task.isCancelled?',
          a: 'Yes, after every await, if applying the result would update UI. Cancellation is cooperative.',
        },
        {
          q: 'Is .task(id:) better than .task for this screen?',
          a: 'Use id when the work is keyed on a value (userID, query). A parameterless .task is enough for "load this screen once per appearance."',
        },
      ],
      teaches: [
        'Structured vs unstructured tasks',
        '.task cancellation and view lifetime',
        'onAppear is an event, not a scope',
        'Forwarding cancel into URLSession',
      ],
    },
    {
      id: 'd2-p5',
      title: 'TaskGroup: one child throws, the home screen is empty',
      difficulty: 'Expert',
      kind: 'Incident',
      prompt: `Home loads feed, profile, and ads in parallel. Ads failed. The user sees a blank screen even though feed and profile had already returned.

\`\`\`swift
func loadHome() async throws -> Home {
    try await withThrowingTaskGroup(of: Partial.self) { group in
        group.addTask { .feed(try await api.feed()) }
        group.addTask { .profile(try await api.profile()) }
        group.addTask { .ads(try await api.ads()) }

        var home = Home.empty
        for try await part in group {
            home.merge(part)
        }
        return home
    }
}
\`\`\`

What happens to the siblings when ads throws? How do you surface partial UI without leaking tasks or ignoring a real error?`,
      think: [
        'What does for try await on a throwing group do when one child throws?',
        'Are feed and profile cancelled, and is their data discarded?',
        'When is all-or-nothing the right product behaviour?',
      ],
      solution: `When one child throws, \`for try await\` throws. The group then cancels remaining children and waits for them to finish. Results you already \`merge\`d stay in the local \`home\` — unless you throw before returning, in which case you discard that local value and the caller sees an error. Feed and profile work that had completed is thrown away at the function boundary. Work still in flight is cancelled.

If home can render without ads:

\`\`\`swift
func loadHome() async -> Home {
    await withTaskGroup(of: Partial.self) { group in
        group.addTask { await .feed(api.feedResult()) }
        group.addTask { await .profile(api.profileResult()) }
        group.addTask { await .ads(api.adsResult()) }

        var home = Home.empty
        for await part in group {
            home.merge(part) // merge knows how to swallow .adsFailure
        }
        return home
    }
}
\`\`\`

Or keep the throwing group, collect in a way that does not exit the loop on the first error: \`nextResult()\` and switch on success/failure per child. Ads become a \`Home.ads = .unavailable\`. Feed failure might still be fatal. That is a product decision you encode per child, not a default of \`for try await\`.`,
      explanation: `Ads threw, and the home screen went blank, even though you watched the feed request succeed in Charles. The group did what a throwing group does: one child failed, iteration threw, siblings were cancelled, \`loadHome\` threw, the view showed the error state. The feed you already merged lived in a local variable that went out of scope on the throw. Structured concurrency kept you safe — no orphan tasks — and still produced a worse product than three sequential calls that painted feed first.

\`withThrowingTaskGroup\` is all-or-nothing at the iteration layer if you use \`for try await\`. That is the right default for "I need every file to write, or I need to abort the install." It is the wrong default for a home screen where ads are optional and profile is optional and feed is the reason the user opened the app. Structured concurrency will not make that product call for you. It will only make the cancellation story honest.

The partial-UI version is a non-throwing group (or a throwing group you drain with \`nextResult()\`) where each child returns a value that can be a failure. You merge what you have, you cancel nothing unless the user left the screen, and you let the view show feed plus an ads slot that is empty. If feed itself throws, you might still fail the whole screen. That is two different policies in one group, which is why the merge function has to know which parts are required.`,
      internals: `A task group owns its children. When you leave the \`withTaskGroup\` closure, the group waits for children — it does not leak them. If you throw out of the closure, remaining children get cancelled, then the wait. \`for try await part in group\` is: resume with the next successful result, or throw the next child error. The throw exits the loop. You never see later successes that were already sitting in the group's buffer unless you collected them first.

Cancellation of siblings is cooperative, same as Day 2's first problem. A child stuck in a non-cancellable completion handler will delay group teardown. The feed task that already completed is fine; its value is either in your \`home\` or gone when you throw.

\`withTaskGroup(of: Partial.self)\` without throwing means children should not throw; they return a \`Partial\` that might wrap a \`Result\`. That keeps the group in the success world and puts policy in \`merge\`.

Priority and child tasks: children inherit the group's priority. A cancelled group does not run new children. Order of \`for await\` is completion order, not add order — another reason "ads failed first" can dominate the story.`,
      testing: `Fake: feed completes immediately with data, ads throws after a yield, profile is slow. With the original code, assert \`loadHome\` throws and the view model does not get a partial home. With the fix, assert feed is present, ads is unavailable, profile eventually merges if you waited for the group.

Cancel the parent (user popped): assert children saw cancel and you did not apply a late home. That is \`.task\` plus a throwing group — do not "fix" partial UI by ignoring parent cancel.

A test where all three succeed still returns a full \`Home\`. A test where feed throws still fails the screen if that is policy. Table-drive the combinations; there are eight, and product will argue about three of them.`,
      pitfalls: `\`try await group.waitForAll()\` after you already threw is not how you keep partial results. You already left the loop.

Swallowing all errors into \`Home.empty\` paints a blank screen that looks like success. Distinguish "ads failed" from "nothing loaded."

Adding \`group.cancelAll()\` yourself after the first error, on top of throwing iteration, is redundant and can hide a child that was about to succeed with the one piece you needed.

Using \`Task {}\` inside the group instead of \`addTask\` breaks the structure: that inner unstructured task will not cancel with the group.`,
      alternatives: `Three \`async let\`s plus \`try await (feed, profile, ads)\` is the same all-or-nothing story, slightly cleaner when the set is fixed and small. To get partial results you \`await\` them individually in \`Result { try await ads }\` wrappers.

A stream of home updates: emit feed as soon as it arrives, then profile, then ads. The group merges into an \`AsyncStream<Home>\`. The UI is incrementally better and the error policy is per-emission. More moving parts.

Sequential load of required feed, then parallel optional decorations. Simple, slightly slower, easy to explain to product.`,
      tradeoffs: `All-or-nothing is easier to test and easier to reason about. It is a bad home screen. Partial UI is a better product and a larger state space: placeholders, retry per section, cancellation of only the failed child. Structured groups are still the right tool; you just cannot use \`for try await\` as if every child were equally required.

Cancelling siblings when ads fail saves battery and is wrong if profile was about to return. Per-child policy is the senior design. The group is the implementation.`,
      followups: [
        {
          q: 'Does a throwing child cancel siblings immediately?',
          a: 'When the error is observed by the group (your throw from the loop, or group teardown), remaining children are cancelled. Results already merged locally are only kept if you still return them.',
        },
        {
          q: 'async let vs TaskGroup here?',
          a: 'async let is enough for a fixed handful of children. TaskGroup is for a dynamic count or when you want to drain results as they complete. Partial UI is about how you handle errors, not which syntax you picked.',
        },
        {
          q: 'How do you make ads optional and feed required in one group?',
          a: 'Children return Result or Partial. merge throws or fails the home only for required parts. Do not use for try await if optional children can throw.',
        },
        {
          q: 'What if the user pops mid-group?',
          a: 'The parent task cancels, the group cancels children, you must not publish a late Home. checkCancellation before assigning UI state.',
        },
      ],
      teaches: [
        'Throwing task groups cancel siblings',
        'Partial results vs all-or-nothing',
        'Per-child error policy',
        'Structured teardown on throw',
      ],
    },
    {
      id: 'd2-p6',
      title: 'async let versus a sequential waterfall',
      difficulty: 'Senior',
      kind: 'Design',
      prompt: `A profile screen loads like this. It feels slow. A teammate wants to slap \`async let\` on every line.

\`\`\`swift
func loadProfile(userID: String) async throws -> ProfilePage {
    let user = try await api.user(userID)
    let feed = try await api.feed(user.id)
    let badges = try await api.badges(user.id)
    let suggestions = try await api.suggestions(user.region)
    return ProfilePage(user: user, feed: feed, badges: badges, suggestions: suggestions)
}
\`\`\`

Which awaits are a true data dependency, which can run in parallel, and how do you write that without a task-group essay? What do you do when \`suggestions\` is allowed to fail?`,
      think: [
        'Which calls need a value from a previous call, and which only need userID?',
        'What happens if you async let something that needs user.id before user has arrived?',
        'If suggestions fails, should the whole page fail?',
      ],
      solution: `You need \`user\` before \`feed\`, \`badges\`, and \`suggestions\` if those APIs need \`user.id\` / \`user.region\`. You do not need feed before badges. After user arrives, the rest is parallel:

\`\`\`swift
func loadProfile(userID: String) async throws -> ProfilePage {
    let user = try await api.user(userID)
    async let feed = api.feed(user.id)
    async let badges = api.badges(user.id)
    async let suggestions = Result { try await api.suggestions(user.region) }

    return ProfilePage(
        user: user,
        feed: try await feed,
        badges: try await badges,
        suggestions: try await suggestions.successValue // optional
    )
}
\`\`\`

If \`feed\` and \`badges\` only need \`userID\` (not the user payload), they can start at the top with the user fetch:

\`\`\`swift
async let user = api.user(userID)
async let feed = api.feed(userID)
async let badges = api.badges(userID)
let u = try await user
async let suggestions = api.suggestions(u.region)
\`\`\`

Do not \`async let\` a call that needs a value you have not awaited yet. The compiler will not let you use \`user.id\` before \`user\` exists; if you pass a placeholder, you have invented a bug.`,
      explanation: `The waterfall is four round trips stacked, and the user watches a spinner for the sum. \`async let\` is not a sprinkle you put on every line. It is a way to start a child task now and await it later. If line two needs line one's result, there is nothing to parallelise yet. If line three only needs the same \`user.id\` line two needed, they can share the wait for user and then run together.

That is the whole design conversation: draw the dependency graph, not the source order. \`user\` is the root. \`feed\` and \`badges\` hang off \`user.id\` (or off \`userID\` if the API is that way). \`suggestions\` hangs off \`region\`, which came from \`user\`. Once \`user\` is in hand, three children can run. The sequential version was written top-to-bottom because that is how we write functions, not because the backend required it.

Optional \`suggestions\` is the task-group lesson in miniature. \`try await\` on all three children makes suggestions fatal. Wrap the optional one in \`Result\` or a local \`do/catch\` so the page still returns. You just designed partial UI without a group, because the set of children is fixed and small. \`async let\` is the right syntax here; a group would be ceremony.`,
      internals: `\`async let x = work()\` starts a child task immediately, bound to the current scope. When you \`await x\`, you wait for that child. If you leave the scope without awaiting, the compiler forces \`await\` or the child is cancelled at the next suspension / scope exit depending on the language version — in practice, await everything you start, explicitly.

Children inherit priority and cancellation from the parent. If the user pops, \`loadProfile\`'s task cancels, the \`async let\` children cancel. That is why this is better than four unstructured \`Task\`s.

You cannot write \`async let feed = api.feed(user.id)\` before \`user\` exists; \`user\` is not in scope. People then \`async let user = ...\` and pass \`userID\` into feed, which is the correct parallel start if the API allows it. Passing a dummy id to "get the compiler to parallelise" is how you fetch the wrong feed.

Awaiting \`(try await feed, try await badges)\` in a tuple waits for both and throws if either throws. Order of completion is not order of the tuple; the tuple waits for all.`,
      testing: `A fake API that records start timestamps: after the change, \`feed\` and \`badges\` should start before the other finishes, and both after \`user\` if they need \`user.id\`. With a clock, the total time should be \`user + max(feed, badges, suggestions)\`, not the sum.

Suggestions fail: page still builds, suggestions empty. Feed fails: page throws. Cancel the parent: all in-flight child calls record cancel.

A regression test: nobody started \`feed\` with a nil or placeholder id. If you parallelise at the top, the recorded id is \`userID\`.`,
      pitfalls: `\`async let\` plus ignoring the result: you still started the work. Await it or do not start it.

Starting feed in parallel with user when feed needs fields only the user payload has (a server-side A/B flag on the user object) is a subtle dependency. If you only needed \`userID\`, the API should take \`userID\`. If you needed the flag, you wait.

\`try await\` on a tuple makes the first throw win and cancels the other awaits in the tuple depending on how you wrote it — in a tuple \`async let\` await, a throw still cancels siblings as the scope tears down. For optional children, do not put them in the same throwing tuple.

Waterfall that is actually required: upload a file, then commit the document id, then notify. Parallelising that is a bug, not an optimisation.`,
      alternatives: `TaskGroup when the number of children is dynamic (N widgets on the home screen). \`async let\` when it is three named things.

A backend "profile bootstrap" endpoint that returns the page in one round trip. Fastest product, worst flexibility. Mention it; do not pretend client parallelism is the only lever.

Structured \`withTaskGroup\` plus a dependency graph library is too much for this screen. Draw the graph in comments if it is subtle; keep the code \`async let\`.`,
      tradeoffs: `Parallelism cuts latency to the slowest child after the dependency. It costs more server load and more CPU when all responses arrive together (decode on main — see the previous problem). For profile, parallel is correct. For a write API with ordering, sequential is correct. The senior move is naming the dependency, not reaching for the most concurrent-looking syntax.

Optional children add branches. Putting them in the same throwing \`try await\` is simpler and worse. One \`Result\` for suggestions is the smallest partial-UI story that still fits in one function.`,
      followups: [
        {
          q: 'Can feed start at the same time as user?',
          a: 'Yes if the feed API takes userID. No if it needs a field from the user payload you do not have yet.',
        },
        {
          q: 'What cancels the async lets if the view disappears?',
          a: 'The parent task, if it is structured (.task). Unstructured Task from onAppear will not, unless you cancel it yourself.',
        },
        {
          q: 'Why not TaskGroup for four calls?',
          a: 'You can. async let is clearer for a fixed set of named results. Group shines when the count is dynamic or you merge as they complete.',
        },
        {
          q: 'Does async let run on MainActor if the parent is MainActor?',
          a: 'The child inherits isolation in many cases; do not decode huge payloads inside those children without hopping. Inheritance is not a reason to skip the decode hop.',
        },
      ],
      teaches: [
        'Data dependencies vs source order',
        'async let child tasks',
        'Partial failure of optional children',
        'Cancellation inherited from parent',
      ],
    },
    {
      id: 'd2-p7',
      title: 'Continuation resumed twice, or never',
      difficulty: 'Expert',
      kind: 'Debug',
      prompt: `A UIKit image loader was wrapped for async/await. Crash: \`SWIFT TASK CONTINUATION MISUSE: leaked continuation\`. Sometimes, instead: a trap about a continuation resumed twice. The wrapper:

\`\`\`swift
func loadAvatar(url: URL) async -> UIImage? {
    await withCheckedContinuation { cont in
        loader.start(url: url) { image in
            cont.resume(returning: image)
        }
        loader.onFailure = {
            cont.resume(returning: nil)
        }
        if loader.isCached(url) {
            cont.resume(returning: loader.cached(url))
        }
    }
}
\`\`\`

\`start\` may call the completion synchronously on cache hit, and may also set \`onFailure\` for a later path. Fix the wrapper, and explain checked versus unsafe continuations.`,
      think: [
        'How many times is resume allowed, and what if the cache path and the completion both fire?',
        'What if start never calls back because the URL is invalid and onFailure was overwritten later?',
        'Does a checked continuation crash in debug when you get this wrong?',
      ],
      solution: `A continuation must be resumed **exactly once**. This code can resume on cache hit *and* in the completion, or on failure *and* in the completion, or never if both callbacks are skipped.

\`\`\`swift
func loadAvatar(url: URL) async -> UIImage? {
    await withCheckedContinuation { cont in
        var resumed = false
        func resumeOnce(_ image: UIImage?) {
            guard !resumed else { return }
            resumed = true
            cont.resume(returning: image)
        }

        if let cached = loader.cached(url) {
            resumeOnce(cached)
            return
        }

        loader.start(url: url) { image in
            resumeOnce(image)
        } failure: {
            resumeOnce(nil)
        }
    }
}
\`\`\`

Better: wrap an API that has a single callback, or use \`withTaskCancellationHandler\` to cancel the loader if the task cancels, and still resume once (with nil or \`CancellationError\` via \`withCheckedThrowingContinuation\`).

Never use \`withUnsafeContinuation\` until a test proves the resume count; checked is how you find this in debug.`,
      explanation: `You bridged a completion-handler loader into \`async\` and the runtime started shouting about continuations. That shout is the whole contract: whoever created the continuation is responsible for resuming it exactly once, on some path, before the continuation object goes away. Zero resumes is a leak: the \`await\` waits forever, the task is stuck, checked mode reports a leaked continuation when the continuation deinits. Two resumes is a trap: the second resume is a programming error, and in checked mode you crash instead of corrupting the task.

The loader was written in a world where three different callbacks were polite. Cache hit calls completion synchronously inside \`start\`. \`onFailure\` is a stored property you just overwrote, maybe clobbering someone else, and may fire too. Then you also resume if \`isCached\` — which might already have been true when \`start\` ran, so the completion already resumed. You did not write a state machine. You wrote three polite resumes.

Checked continuations exist because this bug is the standard one when wrapping UIKit. They cost a little diagnostic state. Unsafe continuations skip the checks and turn the same bug into a heisen-hang or a corrupt executor in production. You do not start there. You start with checked, you write \`resumeOnce\`, you add cancellation, and you only go unsafe if a profiler told you the checked wrapper is hot and your tests are vicious.`,
      internals: `\`await withCheckedContinuation\` suspends the caller and gives you a \`CheckedContinuation\` that you must resume. Resume enqueues the rest of the caller on the appropriate executor. The continuation is a one-shot. The checked wrapper tracks a flag; deinit without resume logs and traps in debug; double resume traps immediately.

Synchronous resume inside \`start\` (cache hit) is legal: you resume before \`withCheckedContinuation\`'s closure returns, and the async function continues without ever really parking. Mixing that with an additional resume on the same cache path is the double. Mixing it with a stored \`onFailure\` is two owners of the same one-shot.

Cancellation does not resume for you. If the user pops, the task cancels, and nobody calls \`resume\`, you leak the continuation unless you hook cancel and resume once with nil or throw. \`withTaskCancellationHandler(operation:onCancel:)\` is the usual pairing: onCancel cancel the loader; the loader's completion still has to resume once (and \`resumeOnce\` makes the late callback a no-op).`,
      testing: `Table of paths, each asserting the async function returns exactly once:

1. Cache hit, synchronous completion inside start.
2. Network success.
3. Network failure.
4. Cache hit *and* completion (the bug): wrapper must not trap.
5. Cancel before start returns: still resumes (nil or throw).
6. Cancel after start, completion later: one resume, no crash.

Use checked continuations in tests so a missed path fails loudly. An XCTest that times out on (5) is how you find the leak that Crashlytics called "frozen screen."

Do not test this only on a happy URL. The invalid URL that never callbacks is the leak.`,
      pitfalls: `Resuming from two threads without \`resumeOnce\` is a race to double-resume. The flag must be atomic or you funnel both callbacks onto one queue. The loader's completion and \`onFailure\` may already be concurrent.

Capturing \`cont\` in a long-lived \`onFailure\` stored on the singleton loader: the next call overwrites it, the previous continuation never resumes, leak. Continuations cannot be stored on a shared slot like that. Each load owns its own callback until resume.

\`withUnsafeContinuation\` to "fix" the checked trap without fixing the double resume: you silenced the alarm.

Returning from the continuation closure without resuming because you stored \`cont\` on self to resume later — that is valid only if you actually resume later. If \`self\` dies, leak. Pair with deinit and cancel.`,
      alternatives: `Prefer APIs that are already async (\`URLSession.data\`). If you must wrap, wrap the smallest API that has a single completion. Do not wrap a loader with four callbacks; adapt it to one \`(Result<UIImage, Error>) -> Void\` first, then wrap that.

AsyncStream for multiple values; continuation for one shot. If you need progress, that is a stream, not a second resume of the same continuation.

Libraries like Combine's \`Future\` have the same exactly-once rule. The bug is older than Swift concurrency.`,
      tradeoffs: `Checked continuations are slightly heavier and infinitely better for wrappers you do not fully control. Unsafe is for a tight loop you measured, with tests that hit every path. The \`resumeOnce\` flag is a tiny state machine you will wish you had when UIKit calls you back twice for the same request.

Bridging is always a smell at the boundary. The longer-term move is to push async into the loader. Until then, the wrapper is allowed to be boring, serial, and obsessed with resume count. Clever wrappers are how leaked continuations ship.`,
      followups: [
        {
          q: 'What does a leaked continuation look like in the wild?',
          a: 'The await never returns, the screen spins, and in debug you get SWIFT TASK CONTINUATION MISUSE when the continuation object deinits.',
        },
        {
          q: 'Can you resume on a background thread?',
          a: 'Yes. The caller resumes on the executor the async function expects. Still exactly once. Hopping does not add a resume.',
        },
        {
          q: 'How do you cancel the underlying loader?',
          a: 'withTaskCancellationHandler: onCancel tell the loader to stop; the completion must still resumeOnce so the await ends.',
        },
        {
          q: 'Why did cache hit double-resume?',
          a: 'start already called the completion synchronously, and the wrapper also resumed when isCached was true.',
        },
      ],
      teaches: [
        'Continuations resume exactly once',
        'Checked vs unsafe',
        'Synchronous cache-hit callbacks',
        'Cancellation must still resume',
      ],
    },
    {
      id: 'd2-p8',
      title: 'Sendable: a class mutated from URLSession and MainActor',
      difficulty: 'Senior',
      kind: 'Review',
      prompt: `A session cache is passed around to satisfy Sendable. The compiler is quiet. TSan is not, in a later Xcode.

\`\`\`swift
final class SessionBox: @unchecked Sendable {
    var token: String
    var user: User?
    init(token: String) { self.token = token }

    func refresh() {
        URLSession.shared.dataTask(with: refreshURL) { data, _, _ in
            if let t = Self.parse(data) {
                self.token = t
            }
        }.resume()
    }
}

@MainActor
final class HeaderVM {
    let session: SessionBox
    func appear() {
        title = session.user?.name ?? session.token
        session.refresh()
    }
}
\`\`\`

What did \`@unchecked Sendable\` promise, what actually happens, and how should this state be isolated?`,
      think: [
        'Which threads write token, and which read it?',
        'What does @unchecked Sendable opt out of?',
        'Would making SessionBox an actor change the call sites in a way the compiler can check?',
      ],
      solution: `\`@unchecked Sendable\` is a promise that *you* synchronise access. This class does not. \`URLSession\`'s completion writes \`token\` on a session queue. \`HeaderVM.appear\` reads \`token\` and \`user\` on MainActor. That is a data race. The compiler is quiet because you told it to be.

Make the session an actor, or isolate it on MainActor, or protect the fields with a lock and never lie if you skip the lock:

\`\`\`swift
actor Session {
    private var token: String
    private var user: User?
    init(token: String) { self.token = token }

    func snapshot() -> (token: String, user: User?) { (token, user) }

    func refresh() async {
        let (data, _) = try await URLSession.shared.data(from: refreshURL)
        if let t = Self.parse(data) {
            token = t
        }
    }
}

@MainActor
final class HeaderVM {
    let session: Session
    func appear() async {
        let snap = await session.snapshot()
        title = snap.user?.name ?? snap.token
        await session.refresh()
        let snap2 = await session.snapshot()
        title = snap2.user?.name ?? snap2.token
    }
}
\`\`\`

If you keep a class, use a private lock for every read and write, and keep \`@unchecked Sendable\` only with that lock documented next to the annotation. Do not sprinkle the annotation to silence a warning.`,
      explanation: `You needed to store the session in a place that wanted \`Sendable\`, the compiler complained that a class with mutable properties is not Sendable, and \`@unchecked\` made the warning go away. Nothing else changed. URLSession still writes \`token\` from its delegate queue. The header still reads \`token\` from main. Two executors, one \`String\`, no lock. That is the definition of a data race on a Swift class. \`@unchecked Sendable\` means "treat this as Sendable even though you cannot see why." It is not a synchronisation primitive.

The quiet compiler is the danger. Real Sendable checking would have stopped \`SessionBox\` at the \`HeaderVM\` boundary, or stopped the closure in \`refresh\` from capturing \`self\` unsafely. You opted out of that, so the bug moved to TSan and to production: torn reads, stale UI, occasional missing token after refresh.

An actor is the version of this class that matches the language. Every read and write of \`token\` hops to the session actor. The URLSession completion cannot poke a field; you await \`data\` and assign on the actor. The view model awaits a snapshot to paint. You will write more \`await\`. You will not write TSan bugs. If the session truly is UI state, \`@MainActor\` on the class is even simpler — then refresh must hop to main to write, which you do explicitly after the network, not from a GCD callback into a naked property.`,
      internals: `Sendable is a contract: values can cross concurrency domains without introducing data races. Structs with Sendable fields are Sendable. Classes are Sendable only if they are immutable, or actor-isolated, or you fake it with \`@unchecked\` and your own rules.

URLSession completions are not on MainActor and not on your actor. They are on a GCD queue. Writing \`self.token = t\` there is a store. Reading \`session.token\` on MainActor is a load. Without atomicity / a lock / isolation, that is undefined behaviour for Swift's memory model, even for a \`String\` that feels like a single pointer swap.

Actors serialise those loads and stores on one executor. \`@MainActor\` is a global actor, same idea, tied to the UI. A lock (NSLock, a serial queue) around every access can make a class honestly \`@unchecked Sendable\`. The annotation without the lock is a lie.

\`User\` if it is a mutable class makes the snapshot lie too: you escaped a reference that another thread might mutate. Snapshot should copy values or be a Sendable struct.`,
      testing: `TSan on a test that calls \`appear\` and \`refresh\` in a loop. With the class, TSan should complain (run it, do not assume). With the actor, it should not.

A unit test cannot reliably catch a torn read. You test the actor by asserting that after \`await refresh()\`, \`snapshot().token\` is the new value, and that two refreshes do not interleave in a way that leaves a partial parse — that last part is the wallet lesson again: isolate, then still write a state machine for overlapping refresh.

If you keep a lock, a test that reads from main while a fake session writes from a background queue should still see consistent snapshots (whole token, not half).`,
      pitfalls: `\`@unchecked Sendable\` on a UIKit view or a view model "so I can capture it in a Task" is how these boxes proliferate. Isolate the type instead.

Parsing on the URLSession queue and then assigning an unsynchronised \`user\` class instance is two bugs: the race on the property, and shared mutable \`User\`.

Making every property \`atomic\` via objc is not a Swift concurrency strategy. You still have no invariant across two properties (\`token\` and \`user\` updating apart). Snapshot on an actor gives you a consistent pair.

\`nonisolated(unsafe)\` on a method that returns \`token\` is the same opt-out with a smaller blast radius, still a race if you read the field without synchronisation.`,
      alternatives: `A value-type \`struct SessionState: Sendable\` stored in an actor, with methods that return new state. Easy to snapshot, easy to test.

Keychain / a single source of truth on a dedicated \`SessionActor\` used by both UI and the networking client. The client does not get a box; it asks the actor for a token before each request.

If refresh must be fire-and-forget from UIKit, \`Task { await session.refresh() }\` from the view model, not a GCD dataTask that writes into a class.`,
      tradeoffs: `Actors add \`await\` at every read. For a token you read on every request, that can be a hop. Batch with \`snapshot()\`. MainActor session is fewer hops from UI and more hops from a networking client that should not be on main. A locked class can be faster and is easy to get wrong; I would not pick it unless a profiler named that actor hop, which it almost never will for a token string.

\`@unchecked Sendable\` is a valid annotation on a type that uses a lock correctly. It is a code smell in review until the lock is visible in the next five lines. Silence is not a design.`,
      followups: [
        {
          q: 'Why was the compiler quiet?',
          a: 'You marked the class @unchecked Sendable, which disables the check that mutable classes are not Sendable.',
        },
        {
          q: 'Is String assignment atomic enough?',
          a: 'Do not rely on it. Swift does not give you a data-race-free pass because the property is a String. Isolate or lock.',
        },
        {
          q: 'Can HeaderVM keep a copy of the token instead?',
          a: 'Yes, a snapshot on appear. Then you must refresh that copy after session.refresh completes, or you will show a stale header.',
        },
        {
          q: 'Does actor Session make User Sendable?',
          a: 'No. The actor protects its stored properties. If you return a mutable User class, you have escaped shared state. Return a struct or a copy.',
        },
      ],
      teaches: [
        '@unchecked Sendable is a promise',
        'URLSession queues vs MainActor',
        'Actors or locks for shared mutable classes',
        'Sendable snapshots, not escaped references',
      ],
    },
    {
      id: 'd2-p9',
      title: 'AsyncStream of keystrokes without backpressure',
      difficulty: 'Expert',
      kind: 'Architecture',
      prompt: `Search is now a stream. After a fast typer and a slow API, memory grows and results still flicker.

\`\`\`swift
final class SearchPipeline {
    private var continuation: AsyncStream<String>.Continuation?
    let queries: AsyncStream<String>

    init() {
        let (stream, continuation) = AsyncStream.makeStream(of: String.self)
        self.queries = stream
        self.continuation = continuation
    }

    func typed(_ q: String) {
        continuation?.yield(q)
    }

    func run() async {
        for await q in queries {
            let hits = await api.search(q)
            await MainActor.run { self.results = hits }
        }
    }
}
\`\`\`

What buffering policy does this stream use, what happens when \`typed\` is faster than \`search\`, and how do you design backpressure so only the latest query matters?`,
      think: [
        'Does yield wait for the consumer, or does it enqueue?',
        'How many searches can be in flight or buffered?',
        'What policy keeps only the newest keystroke?',
      ],
      solution: `Default \`AsyncStream\` buffering is unbounded (or a large buffer depending on initializer). \`yield\` does not wait for \`search\` to finish. Fast typing enqueues every prefix: "s", "sw", "swi", … The loop runs them in order. You get the search-race in FIFO clothing, plus a growing buffer of strings and a pile of late \`MainActor.run\` updates.

For search, you want newest-wins and at most one in flight:

\`\`\`swift
let (stream, continuation) = AsyncStream.makeStream(
    of: String.self,
    bufferingPolicy: .bufferingNewest(1)
)

func run() async {
    for await q in stream {
        async let hits = api.search(q)
        let result = await hits
        if Task.isCancelled { break }
        await MainActor.run { self.results = result }
        // still outdated if another q is already buffered — bufferingNewest(1)
        // drops intermediates, but the q you just searched may not be the latest.
    }
}
\`\`\`

Better: do not use a raw stream as a queue of work. On each yield, cancel the in-flight search and start the latest (the Day 2 problem 1 handle), and use the stream only as an input of keystrokes with \`.bufferingNewest(1)\`. Or consume with a pattern that \`await\`s the next query while a search is running and discards stale results:

\`\`\`swift
for await q in stream {
    let task = Task { try await api.search(q) }
    let hits = try? await task.value
    try Task.checkCancellation()
    await applyIfLatest(q, hits)
}
\`\`\`

Debounce in the producer (do not \`yield\` every keystroke) plus \`bufferingNewest(1)\` plus cancel-in-flight is the full product policy.`,
      explanation: `You replaced unstructured tasks with an \`AsyncStream\` and still painted "sw" over "swift", and this time Allocations grew while the user typed. The stream did not give you backpressure. It gave you a queue. Every \`typed\` \`yield\`s. The consumer is stuck in \`await api.search\`. Yield does not wait; it buffers. Unbounded buffering means every prefix sits in memory until the loop gets to it. Then you search them in order, oldest to newest, which is the opposite of what search wants, and each one hops to main to write \`results\`. Flicker is FIFO. Memory is the buffer you never bounded.

Backpressure would mean the producer feels the consumer's slowness: yield waits, or yield drops, or yield coalesces. Keyboard input cannot wait — you do not block the main thread on a search. So you drop. \`.bufferingNewest(1)\` keeps the latest keystroke and discards the rest while the consumer is busy. That is backpressure by dropping, which is the right kind for this UI.

It is still not enough if you finish a search for "sw" when the buffered latest is already "swift". You must not apply stale hits: keep the query id, cancel the in-flight search when a newer value appears, or peek that the stream has a newer element before publishing. The stream is the input. The search task is the work. Do not let the \`for await\` mean "I will honour every value that ever entered the buffer."`,
      internals: `\`AsyncStream\` is a continuation plus a buffer plus an iterator. \`yield\` enqueues according to \`bufferingPolicy\`: unbounded, bufferingOldest(n) (drop new when full), bufferingNewest(n) (drop old when full). The consumer's \`for await\` dequeues. There is no coupling between "API is slow" and "main thread is typing" unless the policy drops or you use a different primitive that waits (an \`AsyncChannel\` with a capacity of 1, where yield waits). Waiting on yield from the main thread is how you hitch the keyboard. Do not.

\`continuation.yield\` from MainActor and \`for await\` on a task that hops to the network is a classic two-speed system. The buffer is the gearbox. Unbounded gearbox + slow output = memory. Search wants a gearbox that only keeps the current gear.

Applying results with \`MainActor.run\` from the consumer task is an isolation hop. If \`self\` is a class not on MainActor, you raced \`results\` as well (problem 8). Put the pipeline on a known actor and hop once.`,
      testing: `Inject an API that takes 200 ms. Fire "a", "ab", "abc" 10 ms apart. With unbounded buffering, you should see three searches (bad). With bufferingNewest(1) and cancel, you should see a search for "a" (maybe) and a search for "abc", never a published result for "ab" after "abc" was typed.

Memory: yield 100_000 times while the consumer is paused; unbounded grows, bufferingNewest(1) does not.

Cancel \`run()\`'s task and assert the continuation is finished (\`continuation.finish()\`) so the stream ends and \`for await\` exits. Leaking the continuation is a stuck \`run\` and a leaked pipeline.`,
      pitfalls: `\`bufferingNewest(1)\` without cancelling the in-flight search still finishes the old search and may publish it if you do not check "am I still the latest." Dropping from the buffer does not cancel work you already started.

Yielding from \`textDidChange\` on every character without debounce still starts a lot of searches if the consumer is fast (local search). Debounce belongs at the producer.

Forgetting \`continuation.finish()\` in \`deinit\` leaves \`run()\` waiting forever.

Using \`AsyncStream\` for a single shot (one network call) is a continuation in a trench coat. Use \`withCheckedContinuation\`.

\`AsyncThrowingStream\` plus a throw ends the stream. A failed search should not kill the pipeline unless you want that; emit an empty result and keep iterating.`,
      alternatives: `The cancel-and-replace \`Task\` handle from problem 1, no stream. Still the most obvious UIKit view-model code.

Combine \`debounce\` + \`switchToLatest\` remains a clean expression of this policy.

An \`AsyncChannel\` (swift-async-algorithms) with buffering newest, plus \`debounce\`. Nice if you already depend on the package. Not required for one search field.

SwiftUI \`.task(id: query)\` plus debounce in the view model property: the framework cancels on id change, which *is* backpressure — the previous task dies, the new one starts. That is often the whole architecture.`,
      tradeoffs: `Streams are the right shape when you have many consumers or a long-lived pipeline (keystrokes, location, websocket). They are extra machinery for one search field if \`.task(id:)\` already cancels. Unbounded streams are the wrong default anywhere the producer is faster than the consumer and old values are worthless.

Dropping values (newest-1) is lossy and correct for search. It is wrong for accounting events, where you need a bounded buffer that *waits* or a durable queue. Name the product: latest-wins versus at-least-once. The buffering policy is that name in code.`,
      followups: [
        {
          q: 'Does yield wait until search finishes?',
          a: 'Not on a default AsyncStream. It enqueues. Waiting would require a different channel with capacity, and you must not do that on the main thread for keystrokes.',
        },
        {
          q: 'Why can results still flicker with bufferingNewest(1)?',
          a: 'You may still complete an in-flight search for an older query. Dropping from the buffer does not cancel work already started. Check latest or cancel.',
        },
        {
          q: 'Where should debounce live?',
          a: 'At the producer, before yield, or as an operator on the stream before the search loop. Not after you have already started twenty searches.',
        },
        {
          q: 'How does this relate to .task(id: query)?',
          a: 'Changing query cancels the previous task. That is newest-wins without a manual buffer. The stream is for when production of queries is decoupled from the view.',
        },
      ],
      teaches: [
        'AsyncStream buffering policies',
        'Backpressure by dropping newest',
        'In-flight cancel vs buffer drop',
        'finish() and pipeline lifetime',
      ],
    },
    {
      id: 'd2-p10',
      title: 'GCD global queue hops into an actor',
      difficulty: 'Expert',
      kind: 'Judgment',
      prompt: `A legacy image pipeline still decodes on \`DispatchQueue.global()\`. A new actor cache sits next to it. Under scroll, images pop in late, priorities feel random, and occasionally the actor is "busy" while the main thread hitches on a random callback.

\`\`\`swift
actor ImageCache {
    var map: [URL: UIImage] = [:]
    func put(_ url: URL, _ image: UIImage) { map[url] = image }
    func get(_ url: URL) -> UIImage? { map[url] }
}

func load(_ url: URL, cache: ImageCache, into view: UIImageView) {
    DispatchQueue.global(qos: .background).async {
        let data = try? Data(contentsOf: url) // blocking
        let image = data.flatMap(UIImage.init(data:))
        Task {
            if let image {
                await cache.put(url, image)
            }
            let display = await cache.get(url)
            await MainActor.run {
                view.image = display
            }
        }
    }
}
\`\`\`

What isolation and priority story is this, what can go wrong, and what would you migrate to without stopping the train?`,
      think: [
        'What priority does the unstructured Task inherit from a GCD background block?',
        'Is Data(contentsOf:) a good citizen on the cooperative thread pool or on a global queue?',
        'Who owns the UIImageView by the time MainActor.run fires?',
      ],
      solution: `You mixed three schedulers: a GCD global queue at \`.background\`, an unstructured \`Task {}\` that does **not** inherit that QoS the way you think (it starts at a default / inherited Swift priority, not magically "background"), and MainActor for the image view. \`Data(contentsOf:)\` blocks a GCD thread. \`Task\` then hops to the actor (serial) and then to main. Under scroll you spawn many of these; global queues oversubscribe; the actor serialises \`put/get\`; main applies images to cells that may already be reused.

Migrate without a rewrite:

1. Stop blocking with \`Data(contentsOf:)\`. Use \`URLSession.data\` (cancellable, async).
2. Decode off main, on the cooperative pool or a dedicated decoder actor, not a random global QoS.
3. Structured task from the cell / \`.task\` / stored \`Task\` cancelled on reuse (Day 3 will hit reuse; the cancel is the same).
4. \`ImageCache\` as actor is fine; pass a \`Sendable\` image in, do not hop twice for put then get in the same breath — \`put\` can return the image.
5. Apply to the view only if the request id still matches.

\`\`\`swift
func load(_ url: URL, cache: ImageCache) async -> UIImage? {
    if let hit = await cache.get(url) { return hit }
    let (data, _) = try await URLSession.shared.data(from: url)
    let image = await decodeOffMain(data)
    await cache.put(url, image)
    return image
}
\`\`\`

Call that from a cancelled-on-reuse task. Do not start unstructured \`Task\` from GCD.`,
      explanation: `A cell asked for an image and you dropped onto \`DispatchQueue.global(qos: .background)\` because that is what the old pipeline did. Background QoS is what the system uses for work it is allowed to starve. Scrolling is the opposite of that. Then you started a \`Task {}\` from inside the block, which is unstructured, does not keep the GCD QoS as a coherent story, and hops into \`ImageCache\` one job at a time. Then you hopped to MainActor to poke a \`UIImageView\` that may already be showing someone else. Late images, random priority, actor busy, main hitch: those are not four bugs. They are one architecture that never picked an executor.

GCD global queues are a pool of threads that you can block. Swift's cooperative thread pool assumes you do not block. Actors assume you hop in with async work that suspends instead of parking a thread. \`Data(contentsOf:)\` on a global queue blocks a thread in the GCD pool; do that a hundred times during a fling and you have thread explosion *and* still a serial actor on the other side that cannot put images faster than one isolated job at a time. The \`Task\` in the middle is a scheduler crack: no parent, no cancel when the cell reuses, no priority inheritance from the scroll (user-initiated) that started the load.

The migration is a strangler, not a lecture. New loads go through an async function that uses URLSession and an actor cache. Old call sites keep compiling behind a wrapper that \`Task { await load(...) }\` *from the cell's structured context*, not from GCD. You stop starting unstructured work from \`.background\`. You cancel on reuse. Priority becomes "the task that the UI started," which is what you wanted when the user flung the list.`,
      internals: `GCD \`.background\` QoS is a hint to the scheduler. Swift \`Task\` priority is a different enum. An unstructured \`Task {}\` created from a GCD worker does not give you a clean mapping; you often get medium priority work spawned from a low-QoS thread, or the reverse if you \`Task(priority: .userInitiated)\` without thinking. Priority inversion shows up when main waits (directly or indirectly) for the actor, and the actor's jobs are stuck behind a pile of background puts.

Actors process one isolated function at a time. \`put\` then \`get\` in two hops is two jobs, with everyone else's puts in between. Combine them. \`UIImage\` is a class; crossing into the actor is a Sendable question (\`@unchecked\` images are common and uncomfortable). The actor should own the image or you pass it through and do not mutate it.

\`MainActor.run { view.image = display }\` captures the view. The cell was reused. That is identity (Day 3) meeting unstructured tasks (this day). Cancellation is the bridge.

Blocking \`Data(contentsOf:)\` on a cooperative pool would be worse than GCD: you can stall Swift concurrency's threads. That is why the legacy GCD queue existed. Replace the blocking I/O, do not move it onto \`Task.detached\`.`,
      testing: `Scroll a list of 200 unique URLs in a test harness with a fake session. Assert: no more than N in-flight requests, cancel on reuse (configure A, configure B, A's image must not land on the cell), cache hit does not hit the network, and Instruments shows decode off main.

Priority: you will not assert QoS easily in XCTest. Time Profiler + the Swift concurrency instrument show tasks stuck at low priority. A before/after hitch metric on scroll is the product test.

A test that the actor does not hop to main internally keeps the cache usable from background decode. The view layer hops once to apply.`,
      pitfalls: `\`Task.detached(priority: .background)\` for decode looks like the old GCD line and drops cancellation and actor context. Prefer a named decoder actor or \`async\` decode the caller awaits.

Capturing \`UIImageView\` in a long-lived task: reuse bug. Capture a generation token or the image view weakly and check the URL.

Putting \`UIImage\` in an actor dictionary retains decoded bitmaps forever. The actor needs an eviction policy (count, memory warning). That is not concurrency, but the leak will show up in the same Allocations session.

Calling \`load\` from \`cellForItem\` without cancel in \`prepareForReuse\` recreates this problem with nicer syntax.`,
      alternatives: `Keep GCD for a bounded decode queue (\`DispatchQueue\` with max 2 concurrent) if you must, and resume a continuation when decode finishes — then hop to the actor. That is a valid strangler: GCD only for the blocking decode you have not replaced yet, Swift concurrency everywhere else. Do not nest \`Task\` inside the GCD block as the way to get back; resume a continuation.

Nuke / Kingfisher already solved cancel-on-reuse and memory. If the interview is architecture, say when you would buy that instead of writing \`ImageCache\`.

SwiftUI \`AsyncImage\` with downsample; still need a cache and still need to not decode on main.`,
      tradeoffs: `A pure Swift concurrency pipeline cancels, inherits priority from the UI task, and hops through the actor on purpose. The cost is migrating \`Data(contentsOf:)\` and teaching the team not to block the pool. A GCD decode queue is a known quantity for blocking work and a foot-gun for everything after. Mixed mode is allowed during the strangler and is the worst place to *stay*: two priority systems, two cancellation stories, unstructured tasks as glue.

User-initiated scroll should not spawn \`.background\` work. Background QoS is for prefetch you are willing to drop on thermal pressure. If prefetch matters, say \`.utility\` and cancel when the user is flinging hard. That judgment is the job; the APIs only give you the knobs.`,
      followups: [
        {
          q: 'Why not Task.detached from the GCD block?',
          a: 'Detached drops actor context and structured cancel. You already had a scheduler problem; detached adds another root task nobody owns.',
        },
        {
          q: 'Does await cache.put hop off the GCD thread?',
          a: 'The GCD block started a Task; that Task awaits the actor. The GCD block itself already returned. You have no ordering with other GCD work except what you invented.',
        },
        {
          q: 'Where should decode run?',
          a: 'Off main, without blocking the cooperative pool. URLSession + a decode helper that is async nonisolated, or a small dedicated actor/queue for CPU decode.',
        },
        {
          q: 'How do you keep ImageCache from growing forever?',
          a: 'Eviction: count cap, cost cap, memory warning. Concurrency isolation does not replace a cache policy.',
        },
        {
          q: 'What is the one rule for mixing GCD and actors?',
          a: 'GCD may call into Swift concurrency at a structured boundary you cancel, not spawn fire-and-forget Tasks from random QoS queues that then touch UI.',
        },
      ],
      teaches: [
        'GCD QoS vs Task priority',
        'Do not block the cooperative pool',
        'Unstructured Task from GCD',
        'Actor hops and image cache eviction',
        'Cancel on reuse / structured load',
      ],
    },
    {
      id: 'd2-p11',
      title: 'Task.detached hops off MainActor and starves Send',
      difficulty: 'Expert',
      kind: 'Incident',
      prompt: `Send hitching on main was the ticket. A teammate switched the button handler to \`Task.detached\`. Decode moved off main. UIKit then logged that a \`UILabel\` was updated from a background thread, the button felt dead on a warm phone, and dismissing the composer still applied a receipt to the next screen.

\`\`\`swift
@MainActor
final class ComposerVC: UIViewController {
    var draft = ""
    let banner = UILabel()

    @IBAction func sendTapped() {
        let text = draft
        Task.detached(priority: .background) { [banner] in
            let data = try await API.send(text)
            let parsed = try JSONDecoder().decode(Receipt.self, from: data)
            banner.text = parsed.id
        }
    }
}
\`\`\`

What did \`Task {}\` inherit that \`detached\` dropped? How do you hop off main for decode without hopping the UI, the priority, and the lifetime?`,
      think: [
        'What actor isolation and priority does Task {} inherit from a MainActor IBAction, and what does Task.detached keep?',
        'Is .background the right QoS for a button the user just tapped?',
        'If the composer is popped, who cancels this work, and who owns banner?',
      ],
      solution: `\`Task {}\` from a \`@MainActor\` method inherits MainActor isolation and a user-related priority. \`Task.detached\` inherits neither. \`priority: .background\` is what the system is allowed to starve. The closure is an unstructured root: popping the composer does not cancel it, and \`banner.text\` is a UIKit write off main.

Hop for the CPU work. Stay structured. Assign on main.

\`\`\`swift
@MainActor
final class ComposerVC: UIViewController {
    var draft = ""
    let banner = UILabel()
    private var sendTask: Task<Void, Never>?

    @IBAction func sendTapped() {
        sendTask?.cancel()
        let text = draft
        sendTask = Task {
            do {
                let data = try await API.send(text)
                let parsed = try await Self.decodeReceipt(data)
                try Task.checkCancellation()
                banner.text = parsed.id
            } catch is CancellationError {
                return
            } catch {
                banner.text = "Send failed"
            }
        }
    }

    nonisolated private static func decodeReceipt(_ data: Data) async throws -> Receipt {
        try JSONDecoder().decode(Receipt.self, from: data)
    }

    deinit { sendTask?.cancel() }
}
\`\`\`

The \`Task {}\` body is MainActor-isolated, so \`banner.text\` is legal. \`await decodeReceipt\` is the hop off main. Do not \`detach\` a button handler. Do not capture \`UILabel\` into a background root.`,
      explanation: `The send button used \`Task.detached(priority: .background)\` because \`Task {}\` from a \`@MainActor\` method kept JSON decode on main, and a hitch on send was the ticket. Decode moved off main. So did the \`UILabel\` update. UIKit logged that you touched a label from a background thread. On a warm device the send sat in a background QoS queue behind cleanup work and felt broken. Dismissing the composer did not cancel the send; a late detached task wrote a receipt into a banner that now belonged to the next layout.

\`Task.detached\` is not "Task but in the background." It is a new unstructured root. It does not inherit MainActor. It does not inherit the user's task priority. It does not cancel when the IBAction returns or when the view disappears. Those three inheritances are the entire reason \`Task {}\` from a button handler is usually what you want for isolation and priority, and why it is the wrong place to decode eight kilobytes of JSON on main. The hop you wanted is surgical: a \`nonisolated async\` helper you await, then assign on MainActor. Detached hops the whole rest of the world off the actor, including the part that must stay.

Priority is a separate foot-gun. A tap is user-initiated. \`.background\` is what the system starves under thermal and battery pressure. You asked for starvation on the path the user is staring at. A child \`Task {}\` from the main-actor method keeps the work in the human's QoS class. Use \`.background\` for prefetch you will drop, not for Send.

Cancellation is the search problem again. Detached work is a process-level task. Store it and cancel, or do not detach. \`MainActor.run\` around the label write would make the UIKit line legal and would still leave you with a starved, uncancellable root. Legality is not structure.`,
      internals: `Unstructured \`Task {}\` created on MainActor is enqueued on MainActor for its synchronous sections and inherits the current task priority (a UI event is in the user-interactive / user-initiated neighbourhood). \`await API.send\` suspends; resume of that same task is still MainActor unless you called a \`nonisolated\` function. That is why naive \`Task { decode; banner.text = }\` hitches and does not trip the UIKit thread checker.

\`Task.detached\` starts a new task hierarchy. Isolation is \`nonisolated\` unless you mark the closure \`@MainActor\`. Priority is what you passed, or a default, not the tap. There is no parent to cancel. Capturing \`banner\` (a class) in that closure is a Sendable / UI-thread problem: you escaped a main-actor-ish view to a cooperative-pool task and mutated it.

\`nonisolated static func decodeReceipt(...) async\` is eligible for the concurrent pool *because it is async*; a sync nonisolated helper called from MainActor still runs on main. Same trick as the feed decode problem. The difference here is the temptation to detach the entire handler instead of hopping one function.

\`[banner]\` in the capture list copies the reference, not the layer tree. The VC can deinit; the label may still be in a window or may not. A background write is undefined either way. Weak the VC or cancel the task; do not weak a label and poke it from \`.background\`.`,
      testing: `UIKit thread checker / Main Thread Checker on a test that taps send with a slow decode: the original code should flag \`banner.text\`. After the fix, the write happens with \`MainActor.assertIsolated()\` in a test double for the banner.

Priority: you will not assert QoS cleanly in XCTest. Time Profiler plus the Swift concurrency instrument should show send at a user-initiated class, not under a pile of \`.background\` work. A product metric is time-to-receipt after tap on a thermally warm device.

Cancel: start send, pop the VC (or call \`deinit\`/a test \`cancel()\`), complete the fake API, assert the banner was not written. That fails on detached-without-handle.

Decode hop: Instruments should show \`JSONDecoder\` off main, and the label assignment on main. Both, not one.`,
      pitfalls: `\`Task.detached { @MainActor in ... }\` puts you back on main for the whole body, including decode, which was the hitch you were fleeing. Detached plus \`@MainActor\` is a root that still blocks main. You wanted a hop inside a MainActor task, not a MainActor detached task.

\`await MainActor.run { banner.text = ... }\` from detached fixes the thread checker and keeps every other bug: background priority, no cancel, unstructured lifetime.

Reading \`self.draft\` inside detached, instead of copying \`text\` first, is an extra hop (or a compiler error in Swift 6). Copy values, hop for CPU, publish on the actor.

Using detached because "I heard Task inherits MainActor and that is bad" is half a lesson. Inheritance is bad for decode. It is good for UIKit. Split the work.

\`priority: .userInitiated\` on a detached task is still detached: better QoS, still no cancel, still off actor. Priority is not structure.`,
      alternatives: `SwiftUI \`.task\` plus a send button that sets a \`pendingText\` the task observes is structured by the view. UIKit has to store the \`Task\` handle.

A decoder actor you \`await\` from MainActor, same isolation story, nicer if many screens decode.

\`Task { await decodeOffMain(); ... }\` without storing the handle still races a pop. Store it if the write touches a view. Fire-and-forget is for analytics, not for \`UILabel\`.

GCD \`DispatchQueue.global().async\` plus \`DispatchQueue.main.async\` is the old version of this incident: same hop, worse cancellation, same background QoS temptation.`,
      tradeoffs: `Surgical hops cost a suspension and a \`Sendable\` receipt. Detached costs you the actor, the priority, and the lifetime in one keyword, which feels efficient in review and expensive in Crashlytics. For a send button I want one unstructured task *owned by the VC*, MainActor-isolated, with an explicit off-main decode. That is more lines than \`Task.detached\` and is the design that matches a tap.

Background QoS is a real tool for work you will drop on thermal pressure (prefetch, indexing). Using it on Send because "network should be background" confuses "this is I/O" with "the user is not waiting." The user is waiting. Promote the work; hop the decode; cancel on disappear.`,
      followups: [
        {
          q: 'Does Task {} from an IBAction run the network on main?',
          a: 'The Task is MainActor-isolated. URLSession still does I/O off main. You resume on MainActor, so decode and UIKit sit on main unless you hop.',
        },
        {
          q: 'Why is .background wrong for a tap?',
          a: 'The system may starve background QoS. A tap is user-initiated work. Background is for prefetch you can drop.',
        },
        {
          q: 'Is MainActor.run enough to make detached safe?',
          a: 'It makes the UIKit write legal. The task is still a root at the wrong priority that nobody cancels.',
        },
        {
          q: 'How is this different from the JSON-on-MainActor feed problem?',
          a: 'Same hop. The new failure mode is using detached as the hop, which also drops isolation, priority, and structured cancel.',
        },
        {
          q: 'Should send be Task.detached so it survives pop?',
          a: 'Only if product wants send to finish after dismiss, and then you must not touch the banner — publish to a session actor. That is a different design, still not .background UI writes.',
        },
      ],
      teaches: [
        'Task.detached drops actor and priority',
        'Surgical hops vs detaching the handler',
        '.background starves user-initiated work',
        'Unstructured send must still be owned and cancelled',
        'UIKit writes stay on MainActor',
      ],
    },
    {
      id: 'd2-p12',
      title: 'for-await notifications never end, InboxVM never dies',
      difficulty: 'Expert',
      kind: 'Incident',
      prompt: `You left the inbox tab. The badge kept incrementing. Allocations still has \`InboxVM\`. The stream looks structured; the Task is not.

\`\`\`swift
extension Notification.Name {
    static let newMail = Notification.Name("newMail")
}

@MainActor
final class InboxVM {
    var unread = 0

    init() {
        Task {
            for await _ in NotificationCenter.default.notifications(named: .newMail) {
                unread += 1
            }
        }
    }
}
\`\`\`

A patch adds \`[weak self]\` inside the loop. The VM can deinit; the badge no longer increments; something is still alive. What is the AsyncSequence holding, why does the loop not finish, and where should this iteration live?`,
      think: [
        'Does NotificationCenter.notifications ever complete on its own?',
        'Who retains the unstructured Task, and what does that Task capture?',
        'If self is weak, does cancelling still matter for the observer?',
      ],
      solution: `\`notifications(named:)\` is an infinite \`AsyncSequence\`. The iterator registers an observer and waits until the **task** is cancelled. \`Task {}\` in \`init\` is unstructured: it is a root, it strongly captures \`self\` (to mutate \`unread\`), and nothing cancels it. The VM never deinits. That is a leak without needing a second edge back from the VM to the Task.

\`[weak self]\` lets \`deinit\` run. The loop is still parked. The observer stays registered for the life of the process. You leaked a Task and a NotificationCenter observer instead of a view model.

Own the task, cancel it, and still capture weakly so the task is not a second strong owner:

\`\`\`swift
@MainActor
final class InboxVM {
    var unread = 0
    private var listenTask: Task<Void, Never>?

    func start() {
        listenTask?.cancel()
        listenTask = Task { [weak self] in
            let stream = NotificationCenter.default.notifications(named: .newMail)
            for await _ in stream {
                guard let self else { break }
                self.unread += 1
            }
        }
    }

    func stop() {
        listenTask?.cancel()
        listenTask = nil
    }

    deinit {
        listenTask?.cancel()
    }
}
\`\`\`

Better in SwiftUI: iterate in \`.task\` on the inbox view so the framework cancels when the tab goes away. Do not start infinite \`for await\` in \`init\`.`,
      explanation: `Inbox still incremented unread after you left the tab. Then Allocations showed \`InboxVM\` living forever. \`init\` started an unstructured \`Task\` that \`for await\`'d \`NotificationCenter.default.notifications(named: .newMail)\`. That sequence does not finish. The iterator registers an observer and waits. The Task captured \`self\` to increment \`unread\`. The task is a root the runtime retains. The VM does not even need to store the handle. The Task retains the VM. There is no Combine bag to forget. There is a root that never ends.

\`[weak self]\` is the patch that lets \`deinit\` run. It does not unregister the observer. The loop is still parked on the next notification. Each mail event wakes a task whose \`self\` is nil, which is a quiet leak of a Task and a \`NotificationCenter\` observer for the life of the process. Combine at least made you hold an \`AnyCancellable\`. \`for await\` looks like a loop with a natural end. Notification streams, location streams, websocket streams do not have one. The end is cancellation.

The fix is ownership of the Task. Store it, cancel in \`deinit\` / \`stop()\`, and still capture weakly so the Task is not a second strong owner that prevents \`deinit\`. Better: do not start this in \`init\` at all. Iterate the sequence in SwiftUI \`.task\`, which cancels when the view goes away, or in a \`start()\`/\`stop()\` pair the view controller calls from appear/disappear. The \`AsyncSequence\` is fine. Unstructured iteration of an infinite sequence is a subscription without a cancellable.`,
      internals: `\`NotificationCenter.notifications(named:object:)\` returns an \`AsyncSequence\` whose iterator installs an observer on first \`next()\` and removes it when the iterator is torn down. Tear-down happens when the \`for await\` exits, which happens when the sequence finishes (it will not) or when the consuming task is cancelled (the \`next()\` throw/return path). Cancellation is cooperative at the iterator; if you never cancel, the observer is a process-lifetime registration.

Unstructured \`Task {}\` is retained by the concurrency runtime as a root job. The closure captures \`InboxVM\` strongly if it mentions \`unread\` without \`weak\`. That is enough to keep the VM alive forever. Storing the \`Task\` on the VM *in addition* makes a classic cycle: VM → Task → VM, same outcome. Weak capture breaks the cycle but leaves the root Task running.

\`@MainActor\` on the VM means the task created in \`init\` inherits MainActor, so \`unread += 1\` compiles. Inheritance does not create a parent-child relationship with the view. \`init\` is not a scope that ends when the screen pops.

\`for await\` \`break\` when \`self\` is nil is a way to finish the loop *if a notification still arrives*. If mail is quiet, you sit forever. Cancel is the only finish that does not wait for the next event.`,
      testing: `Post \`.newMail\` in a loop, assert \`unread\` matches. That does not catch the leak.

Deinit test: create the VM, release it, assert a flag in \`deinit\`. The original code never deinits. After \`[weak self]\` without cancel, deinit runs; then post another notification and assert your observer-count spy (a test NotificationCenter, or a wrapper) is still registered — that is the remaining leak. After cancel-in-deinit, assert the observer is gone and further posts do not increment a weak unread.

Cancel-before-event: start, cancel immediately, post mail, assert unread stayed 0.

SwiftUI: appear the inbox, disappear it, post mail, assert the view model (if owned by the view) is gone or unread did not move. Prefer the unit test on \`stop()\`.`,
      pitfalls: `Starting the loop in \`init\` and again in \`start()\` double-counts. One owner.

\`for await\` on \`NotificationCenter.default.notifications\` without a name filter is every notification in the process. Always pass \`named:\`.

Assuming \`deinit\` on a \`@MainActor\` class will run your cancel when the Task still holds \`self\` — it will not. Weak first, then cancel.

Breaking when \`self\` is nil still leaks until the *next* notification. Quiet inboxes leak longer. Cancel.

Wrapping the center in an \`AsyncStream\` you never \`finish()\` is the same bug with extra API. The unstructured consumer is the problem.

UIKit \`addObserver\` without \`removeObserver\` is this incident in older clothes. \`for await\` did not invent it; it hid the token.`,
      alternatives: `Combine \`NotificationCenter.default.publisher(for:)\` stored in \`Set<AnyCancellable>\` on the VM. \`deinit\` of the VM cancels the bag if the bag is the only owner — still watch for a sink that captures \`self\` strongly. Same Day 1 graph.

A selector-based observer with \`[weak self]\` and \`removeObserver\` in \`deinit\`. Verbose, obvious lifetime.

SwiftUI \`.onReceive(NotificationCenter.default.publisher(for: .newMail))\` or \`.task { for await ... }\` tied to the view. Preferred when the inbox *is* a view.

An inbox actor that owns the sequence for app lifetime, if unread is process-global. Then leaking the VM is the wrong diagnosis — you wanted a singleton. Do not pretend a screen VM is that singleton.`,
      tradeoffs: `Infinite AsyncSequences are a good API for "this keeps happening." They shift lifetime onto the consumer. Unstructured \`Task\` in \`init\` is the cheapest consumer and the one that never stops. Structured \`.task\` or an explicit \`start\`/\`stop\` is more code at the call site and is the only version I will approve for notifications, location, and sockets.

\`[weak self]\` without cancel is a deinit win and a process-wide observer leak. Teams stop at the deinit test and ship the observer. Test unregistration, not only deinit. The extra assertion is the difference between "the VM is gone" and "the VM is gone and so is the subscription."`,
      followups: [
        {
          q: 'Is this a retain cycle?',
          a: 'It can be (VM stores Task, Task captures VM), but it does not have to be. A root Task that captures VM is enough to leak without a cycle.',
        },
        {
          q: 'Does [weak self] fix the leak?',
          a: 'It lets the VM deinit. The unstructured Task and the NotificationCenter observer remain until cancel, or until the next event if you break on nil self.',
        },
        {
          q: 'When does the notifications AsyncSequence finish?',
          a: 'When iteration stops: cancel the task, or break out and release the iterator. The center will not complete the stream for you.',
        },
        {
          q: 'Why not start this in init?',
          a: 'init has no paired teardown the UI is guaranteed to call. Appear/disappear, start/stop, or .task have a matching end.',
        },
        {
          q: 'Can deinit cancel a MainActor-isolated Task?',
          a: 'Yes. cancel() is thread-safe. deinit will not run at all if that Task still strongly captures self.',
        },
      ],
      teaches: [
        'Infinite AsyncSequence needs cancellation',
        'Unstructured Task in init is a root',
        'weak self ≠ unregister observer',
        'NotificationCenter.notifications lifetime',
        '.task or start/stop, not init',
      ],
    },
  ],
}
