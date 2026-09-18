import type { PrepDay } from './types'

export const day6: PrepDay = {
  id: 'day-6',
  title: 'Day 6 — Networking',
  kicker: 'Tokens, TLS, and herds',
  intro:
    'The first 401 is a token problem. Fifteen of them at once is a herd. Today is refresh, retries that can DDoS you, pagination races, pinning that pages you on a Sunday, sockets that reconnect forever, and the POST that must not charge twice.',
  problems: [
    {
      id: 'd6-p1',
      title: 'Fifteen 401s, fifteen refresh calls',
      difficulty: 'Expert',
      kind: 'Design',
      prompt: `Access tokens last 15 minutes. Refresh tokens last 30 days, stored in Keychain. At expiry, the user has 15 in-flight API calls. All 15 receive 401. Today each interceptor calls \`/refresh\`. The auth server rate-limits; users get logged out.

Design a client where **one** refresh runs, the 15 wait, retry with the new access token, and a failed refresh logs out **once**. Cover concurrent callers, a second 401 after refresh, and where the tokens live.`,
      think: [
        'Who serialises the refresh so two 401s cannot both decide to start one?',
        'What happens to requests that arrived while the refresh Task is already in flight?',
        'How do you retry once without turning a sticky 401 into an infinite loop?',
        'Is the token store actor-isolated, and who is allowed to read the refresh token?',
      ],
      solution: `Put a single \`Authenticator\` (or \`TokenRefresher\`) actor in the HTTP layer. View models never see tokens.

\`\`\`swift
actor TokenRefresher {
    private var inFlight: Task<String, Error>?
    private let store: TokenStore
    private let refreshAPI: RefreshAPI

    func validAccessToken() async throws -> String {
        if let t = await store.access(), !t.isExpired { return t.value }
        return try await refresh()
    }

    func refresh() async throws -> String {
        if let inFlight { return try await inFlight.value }
        let task = Task { try await actuallyRefresh() }
        inFlight = task
        defer { inFlight = nil }
        return try await task.value
    }
}
\`\`\`

Pipeline:

1. Request adapter attaches the current access token from the memory cache (backed by Keychain).
2. On 401, every interceptor calls \`refresher.refresh()\`. They share one Task. Fifteen waiters, one POST \`/refresh\`.
3. Retry the original request **once**, with a retry flag on the request. If that retry is still 401, logout. Do not refresh forever.
4. On refresh 401/403: clear Keychain, emit a single \`sessionExpired\`. Fifteen callers observe the same error; the UI shows one alert.
5. Persist access + refresh in Keychain, not UserDefaults. Memory-cache the access token with its expiry so you are not doing Keychain I/O on every call. Write through on rotate.

A lock around a stored \`Task\` is the same idea if you are not on actors yet. An unstructured \`Task\` per 401 is how you got here.`,
      explanation: `Support called it random logouts. Crashlytics showed nothing useful. The auth graphs showed a spike of POST /refresh at every traffic peak. Fifteen minutes after login, a user with the feed, stories, unread counts, and a couple of prefetch tasks in flight would get fifteen 401s in the same second. Each interceptor treated that 401 as its own problem and called refresh. The auth cluster rate-limited the refresh token, returned 429 or 401 on the extras, and the client treated any refresh failure as session death. One user, one moment of expiry, fifteen logouts fighting over the Keychain.

The shape of this bug is a thundering herd, the inverse of the search race from Day 2. There you wanted later work to cancel earlier work. Here you want fifteen waiters to join one piece of work. An unstructured Task per 401 is fifteen refreshes. A “is a refresh running?” check without isolation lets two 401s both see nil and both start. An actor, or a lock around a stored Task, makes that check-and-set atomic. Every caller awaits the same Task.value and gets the new access token, or the same error.

I would put this in the HTTP layer, not in fifteen view models. View models should not know that tokens exist. The pipeline is: adapter attaches the access token; on 401, join the refresher; retry the original request once with a retry flag; if that retry is still 401, logout once and stop. A second 401 after a successful refresh is clock skew or a sticky farm, not a reason to loop. Refresh 401 or 403 clears Keychain and emits a single sessionExpired. Access token is a capability. Refresh token is a secret only the refresher reads. Memory-cache the access token with its expiry so you are not hitting Keychain on every call, and write through on rotate.

Do not hold a URLSession delegate callback lock while you await refresh. That is the same reentrancy trap as a wallet callback. And do not refresh on login’s 401, or on a 403 that means missing scopes. Those are not expiry.`,
      internals: `\`\`\`text
15 requests ──401──► join TokenRefresher.refresh
                         │
                         ▼
                    one POST /refresh
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
         retry A      retry B      retry C   (new access)
\`\`\`

The actor serialises the “is there already a refresh?” check. The unstructured Task it stores is the join handle. \`defer { inFlight = nil }\` must run after waiters have been able to attach; clearing it too early starts a second refresh for the next 401 that arrives a millisecond later.

Default Keychain access group is \`TEAMID.bundleId\`. The refresher is the only type that reads the refresh-token item. URLSession itself knows nothing about OAuth. If you use a delegate-based session, never call out to refresh while sitting inside \`urlSession(_:didReceive:completionHandler:)\` without hopping off that queue — the session will not process the retry until you return.

Memory cache of the access token is a performance detail that becomes a correctness detail at logout: wipe both cache and Keychain, or the next request ships a token you thought you deleted.`,
      testing: `Fake HTTP in three waves. First: fifteen overlapping GETs return 401, refresh returns 200, retries return 200. Assert refresh count == 1 and every caller got the new token. Second: refresh returns 401. Assert logout fired once, Keychain cleared once, no retry storm, UI observed a single sessionExpired. Third: two waves overlapping — a second 401 arrives while inFlight is non-nil — still one refresh.

Use an actor fake clock for expiry so you do not sleep. A fourth test: a successful refresh followed by a still-401 retry logs out rather than refreshing again. A fifth: login’s 401 does not enter the refresher at all.`,
      pitfalls: `Refreshing on every 401, including the login endpoint. Retrying a non-idempotent POST without an idempotency key after the token rotates. Logging tokens in the interceptor. Storing tokens in UserDefaults because it was faster to type. Treating 403 (missing scope) as expiry. Holding the URLSession delegate queue while awaiting refresh. Clearing \`inFlight\` before waiters attach, so the 16th 401 starts a second refresh. Fifteen view models each with their own refresher.`,
      alternatives: `Alamofire’s Authenticator is this pattern packaged. A URLProtocol interceptor can do the same join if you already live there. A serial \`DispatchQueue\` plus semaphore works until someone \`sync\`s onto that queue from the session callback and deadlocks. Prefer Task joining. Per-VM refresh is simpler until the second screen ships.`,
      tradeoffs: `A central interceptor is the right complexity for any app that actually uses refresh tokens. Per-VM refresh is less code until the second screen, and then it is a logout bug. Keeping the access token in memory plus a Keychain write on rotate is faster and means you must wipe on logout and on a paranoid memory-warning path. Actor isolation is cleaner than a lock; a lock is fine if the rest of the stack is still callback-based. Single-flight is mandatory. The rest is taste.`,
      followups: [
        {
          q: 'Where do you store the refresh token, and who is allowed to read it?',
          a: 'Keychain, this-device, not iCloud unless the product requires a roaming session. After biometric if the threat model says so. Only the refresher reads it. API callers see access tokens, never the refresh token.',
        },
        {
          q: 'What if refresh succeeds but some retries still 401?',
          a: 'Clock skew or a sticky farm that has not seen the new token yet. One extra refresh max, then logout. Do not loop. The retry flag is what makes “max once” enforceable.',
        },
        {
          q: 'How does this interact with background refresh and widgets?',
          a: 'A BGTask may need a token too. Same actor, same Keychain, same App Group if an extension is involved. Do not start a second URLSession stack with a second refresher. Two refreshers is how you mint two refresh calls again.',
        },
        {
          q: 'Is certificate pinning part of this design?',
          a: 'Independent control. Pinning failures are not 401s. Do not treat them as session expiry or you will log the user out because a CDN rotated a cert.',
        },
        {
          q: 'What about a 429 on /refresh itself?',
          a: 'Honour Retry-After, still single-flight, still one logout if it ultimately fails. Do not turn a rate limit into fifteen staggered refreshes. That is the original incident with jitter.',
        },
      ],
      teaches: [
        'Single-flight refresh',
        'Actor joining',
        '401 vs logout',
        'Keychain vs UserDefaults',
        'Retry flags',
        'Auth interceptor placement',
      ],
    },
    {
      id: 'd6-p2',
      title: 'Retry that DDoSes your own API',
      difficulty: 'Senior',
      kind: 'Incident',
      prompt: `A feed client retries every failed request immediately, up to 10 times. During a 10-minute API brownout, mobile traffic triples and the API never recovers. Product wants "offline mode." Design retry + backoff + caching so a fling-to-refresh does not become a weapon.`,
      think: [
        'Which failures are actually retryable, and which are the server asking you to stop?',
        'What is the backoff policy, and why is jitter not optional?',
        'Where does the cache sit relative to retry so the user is not staring at a spinner while you hammer?',
        'How do you stop a thousand clients from waking up on the same clock?',
      ],
      solution: `Retry only transient failures: timeouts, 429, 502, 503, 504. Never loop on 400, 401, 403, 404. 401 goes to the problem-1 refresher, not to this retry loop.

Exponential backoff with jitter: \`min(cap, base * 2^n) + random\`. Honour \`Retry-After\` when present — it beats your formula. Cap attempts (three is a lot) at the HTTP client, not in every view model.

Cache sits in front of retry for GET feed: stale-while-revalidate. Show the last successful payload immediately from disk or memory; refresh in the background. Offline is that same payload plus an explicit banner, not a spinner that retries into a brownout. Store pagination cursors with the cache entry so a retry does not reset you to page 1.

Circuit breaker: after N consecutive failures, fail fast for T seconds so the client stops being a load generator. Half-open with one probe, not with the whole feed.

Idempotency keys on POST. A feed like is a POST you must not fire ten times because the first one timed out after the server committed.`,
      explanation: `The brownout started as a slow database on the feed cluster. Mobile should have been the thing that absorbed it. Instead every failed GET retried immediately, ten times, and a million clients turned a 10-minute blip into a self-inflicted DDoS. Traffic tripled. The API never got a chance to recover because the retry storm was larger than the original load. Product filed a ticket for offline mode. The incident was not missing a cache. It was a positive feedback loop.

Immediate retry is that loop. You fail, you retry, you add load, the server stays failed, you retry again. Exponential backoff spreads the retries out. Jitter is what stops every client from waking up on the same 1s / 2s / 4s cadence after a simultaneous failure — without jitter, backoff just schedules a second thundering herd. Retry-After is the server telling you the schedule; ignoring it is how you look like you did not read the response.

The cache is not a nice-to-have for this product. It is how the user still sees a feed while you are backing off. Stale-while-revalidate means: paint disk, then try network, then replace if it works. Airplane mode is the same path with a banner. If you retry first and cache second, the user stares at a spinner for ten attempts and you still hammer the API.

URLSession will already retry some transport failures at a low level. Stacking your ten retries on top of that is how you get thirty times the traffic. Know waitsForConnectivity before you invent another layer. And do not retry a POST that already committed — that is the next incident, usually a double like or a double charge.`,
      internals: `Classify the status code before you classify the error type. Transport timeout and 503 are retryable. 404 is not “try again, maybe the post exists now.” 429 is retryable only with Retry-After. 401 is authentication, not transience.

URLSessionConfiguration.waitsForConnectivity will hold a request until the radio is up. That is not a retry policy; it is a delay. Combining it with ten immediate retries is how a flaky tunnel becomes ten stacked requests when the radio returns.

A circuit breaker is a small state machine on the client: closed (normal), open (fail fast), half-open (one probe). The probe must be one request, not the fifteen prefetchers waking up together. Store the breaker next to the HTTP client so every view model inherits it.

\`URLCache\` will honour HTTP cache headers on truly cacheable GETs. Authenticated paginated feeds usually are not. Application cache (files, a tiny SwiftData store, even a JSON blob in Caches) wins because you control the cursor and the stale banner.`,
      testing: `Fake that fails twice then succeeds — assert three attempts with increasing delay, using an injected clock, never sleep. Fake 404 — assert one attempt. Fake 429 with Retry-After: 5 — assert the delay is 5, not your formula. Fake a brownout of 50 failures — assert the circuit opens and subsequent calls fail fast without hitting the fake.

Cache test: airplane mode returns the last feed and a stale flag. Pagination test: a retry of page 3 does not rewrite the cursor to page 1. POST test: a timed-out like with an idempotency key is retried as the same key, not as a second like.`,
      pitfalls: `Retrying uploads that already committed. Caching authenticated responses in a shared URLCache on a shared device. Ignoring 429. Retrying 401 in this loop instead of the refresher. Putting retry in every view model with different caps. Prefetchers that do not share the circuit breaker. Showing a spinner instead of stale content. Using the simulator’s perfect network as proof that backoff works.`,
      alternatives: `HTTP cache via URLCache for truly cacheable GET. NSCache plus disk for thumbnails. A dedicated FeedCache type that owns cursor + payload + fetchedAt. Combine’s retry operator is how juniors get ten immediate retries in one line — do not use it without delay. Server-driven Retry-After plus a client breaker is the production pair.`,
      tradeoffs: `Aggressive cache: fast, stale, great for feeds, wrong for balances. No cache: correct, fragile, every brownout is a blank screen. Seniors pick stale-while-revalidate for feeds and no cache for money. Three retries with jitter versus ten immediate: the product-feels-slower option is the one that lets the API recover. Circuit breakers hide outages from the retry loop and surface them as a banner — that is a product conversation, not a hidden fail-soft.`,
      followups: [
        {
          q: 'Where does pagination live relative to retry?',
          a: 'The client holds the cursor. The view model asks loadMore(). A retry of the current page must not refetch page 1. Store the cursor with the cache entry so offline and retry share the same position.',
        },
        {
          q: 'Why jitter instead of a clean 1s, 2s, 4s?',
          a: 'A million clients that fail together and sleep a clean exponential wake together. Random jitter turns one spike into a smear. The server’s recovery depends on that smear.',
        },
        {
          q: 'Do you retry POST /like?',
          a: 'Only with an idempotency key the server honours. A timeout after commit is indistinguishable from a timeout before commit. Without a key, retry is a double like.',
        },
        {
          q: 'What does waitsForConnectivity change?',
          a: 'It delays the first attempt until the path is up. It does not replace backoff, and it can surprise you by firing a pile of held requests at once when the radio returns. Pair it with the breaker.',
        },
      ],
      teaches: [
        'Retry classes',
        'Backoff plus jitter',
        'Retry-After',
        'Stale-while-revalidate',
        'Circuit breaking',
        'Pagination with cache',
      ],
    },
    {
      id: 'd6-p3',
      title: 'Pull-to-refresh resets the cursor while page 3 is in flight',
      difficulty: 'Senior',
      kind: 'Debug',
      prompt: `A paginated feed keeps a \`cursor: String?\` on the view model. Page 1 loads, the user scrolls, page 2 appends, page 3 starts. They pull to refresh. The refresh task sets \`cursor = nil\`, fires GET page 1, and the in-flight page 3 returns with the old cursor’s items. Those items get appended onto the new page 1. The user sees duplicates, then a jump, then a 409 from a like on a post that is no longer in the first page.

Fix the concurrency. Say who owns the cursor, what happens to in-flight pages on refresh, and how the cache entry stays coherent.`,
      think: [
        'Is the cursor a single mutable string two tasks are allowed to write?',
        'Does pull-to-refresh cancel page 3, or only start page 1 beside it?',
        'How do you ignore a response that belongs to a generation you have already left?',
        'Where is the disk cache’s cursor relative to the in-memory one?',
      ],
      solution: `Give the feed a generation, not a lonely cursor.

\`\`\`swift
@MainActor
final class FeedVM {
    private var loadTask: Task<Void, Never>?
    private var generation = UUID()
    private var cursor: String?

    func refresh() {
        loadTask?.cancel()
        generation = UUID()
        cursor = nil
        items = cachedPage1() // paint stale immediately
        loadTask = Task { await loadPage(reset: true, generation: generation) }
    }

    func loadMore() {
        guard loadTask == nil else { return }
        let g = generation
        loadTask = Task { await loadPage(reset: false, generation: g) }
    }
}
\`\`\`

On every response: if \`Task.isCancelled\` or \`g != generation\`, drop the payload. Do not append. Do not write \`cursor\`.

Refresh cancels the in-flight page. Load-more is ignored while a load is running, or it shares the same Task with a queue of one. The cache entry is keyed by generation-or-query, stores items + cursor + fetchedAt together, and is only replaced when a reset request succeeds. A stale page 3 must not write that entry.

The HTTP client may still finish the request; cancellation is cooperative. The view model is the one that must not apply it.`,
      explanation: `The user did a perfectly normal thing. They scrolled to page 3 and they pulled to refresh because the feed felt stale. Two requests were then alive: page 3 with cursor C2, and page 1 with cursor nil. The view model had already set cursor = nil for the refresh. Page 3 came home second, the append path trusted whatever arrived, and the new page 1 grew a tail of page-3 posts. Duplicates are the cute symptom. The 409 on like is the real one: the UI still showed a post that the refreshed first page — and the server’s idea of “first page” — no longer contained in the same way, or that had been deleted. You taught the UI a list that never existed as one query.

This is Day 2’s search race wearing pagination clothes. Last write wins is last finish, not last start. Pull-to-refresh is a new query. In-flight work from the old query is poison if you apply it. Cancel the task. Bump a generation. Drop responses that do not match. The cursor is not an independent variable you reset while another task still holds the old value in its closure. It lives next to the items, next to the generation, and next to the cache record.

I would paint cached page 1 immediately on refresh, same as stale-while-revalidate in problem 2. The user sees a coherent first page, not an empty spinner, not a spliced list. Load-more during refresh is a no. The next page after a refresh uses the cursor that arrived with that refresh, not the one page 3 was holding.

If you persist the feed, persist items and cursor atomically. A cache that keeps the new items and the old cursor is this bug on disk, and it will greet you on the next cold launch.`,
      internals: `A cursor is an opaque server token for a snapshot. Mixing cursors from two snapshots is undefined. Some backends use offsets; those are worse, because offset 40 after a refresh is a different 40.

Unstructured Tasks capture the cursor at await points. Even if you set cursor = nil on main, the in-flight Task still has the URL it built. Cancellation does not stop the URLSession byte stream instantly; it stops you from applying the result. checkCancellation after await is mandatory.

Generation can be a UUID or a monotonic Int. Compare it on MainActor before mutating items. If the VM is MainActor-isolated, the race is still real because two tasks interleave at await.

Cache key: query identity (home feed, not “whatever we last had”). Value: struct { items, cursor, fetchedAt }. Write only from the reset success path or from a load-more that passed the generation check.`,
      testing: `Fake HTTP: start loadMore with 300 ms delay, then refresh with 10 ms delay. Assert final items are exactly page 1 of the refresh, cursor is the refresh cursor, and append count from page 3 is zero. Second test: cancel mid-refresh, start another refresh, no duplicate items. Third: airplane mode refresh paints cache and does not clear it when the network fails.

Do not sleep. Inject the fake’s continuations. Assert load-more is a no-op while refresh is running.`,
      pitfalls: `Setting cursor = nil without cancelling. Appending by id without dropping old generations — you still reorder and you still 409. Disabling pull-to-refresh while loading as the only fix; users will still hit load-more. Writing the cache from every response. Using ForEach indices after the splice. Treating 409 on like as a networking retry instead of “this item is gone from the snapshot.”`,
      alternatives: `An actor FeedStore that serialises refresh and loadMore so they cannot overlap. SwiftUI .task(id: generation) so the framework cancels. A single AsyncSequence of commands (refresh / more) processed one at a time. All of these are “one writer.” The generation check is belt-and-suspenders if a request can still complete after you think you serialised.`,
      tradeoffs: `Cancelling page 3 wastes bytes. Applying it wastes the user’s mental model. Waste the bytes. Serialising all loads is simpler and slightly slower to start load-more after a refresh; overlapping load-more with a previous load-more is a product choice, overlapping with refresh is not. Keeping a disk cache makes the race visible across launches if you do not write atomically — more work, worth it for offline.`,
      followups: [
        {
          q: 'Should like/unlike use the item id or the cursor snapshot?',
          a: 'The item id. The 409 means the server refused that action on that item, not that your cursor is stale. Drop or refresh that row. Do not retry the like as if it were a timeout.',
        },
        {
          q: 'What if the server has no cursor and uses page numbers?',
          a: 'Page numbers plus refresh is the same race with worse math. Still generation-gate. Prefer cursors from the backend if you can ask.',
        },
        {
          q: 'Does the HTTP layer cancel the URLSession task?',
          a: 'Yes if you used the async API inside a Task you cancel. Still drop the result in the VM. Double-stop is how you sleep at night.',
        },
        {
          q: 'How does this interact with the retry storm in problem 2?',
          a: 'A retry of page 3 after a refresh started is the same poison payload. Retries must carry the generation or be cancelled with the parent Task.',
        },
      ],
      teaches: [
        'Pagination races',
        'Generation tokens',
        'Cancel in-flight pages on refresh',
        'Atomic cache of items plus cursor',
        'Cooperative cancellation',
        '409 as snapshot conflict',
      ],
    },
    {
      id: 'd6-p4',
      title: 'URLSession delegate versus async/await, challenge on a background thread',
      difficulty: 'Expert',
      kind: 'Review',
      prompt: `You need certificate pinning and a client certificate for a banked checkout host. A senior writes an async HTTP client with \`URLSession.shared.data(for:)\`. Another senior writes a \`URLSessionDelegate\` that implements \`urlSession(_:didReceive:completionHandler:)\` and hops to \`MainActor\` with \`DispatchQueue.main.sync\` to read a passphrase from a UIAlert, then calls the completion handler.

Main Thread Checker is quiet. The app deadlocks on the first challenge on some devices. Pinning never runs on the async client. Explain the session model, which thread the challenge arrives on, and how you compose pinning with async/await without deadlocking or hopping the UI onto the delegate queue.`,
      think: [
        'Does URLSession.shared ever call your delegate?',
        'Which queue are URLSessionDelegate methods on, and what happens if you sync to main from there?',
        'Can you mix data(for:) with a custom delegate session?',
        'Who is allowed to present a passphrase UI, and when must the completion handler run?',
      ],
      solution: `\`URLSession.shared\` has no delegate you control. Pinning and client certs require a session you own:

\`\`\`swift
let config = URLSessionConfiguration.ephemeral
let session = URLSession(
    configuration: config,
    delegate: PinningDelegate(),
    delegateQueue: nil // session creates a serial queue
)
let (data, response) = try await session.data(for: request)
\`\`\`

\`data(for:)\` on **that** session still runs the delegate callbacks. You do not have to pick “async or delegate.” You pick a session with a delegate, then use the async API on it.

Challenge handler: it arrives on the delegate queue, which is not main. Do not \`DispatchQueue.main.sync\`. If main is waiting on \`session.data\` (or on any work that needs the delegate queue to proceed), you deadlock. That is the bug.

For a client cert passphrase: hop to main **async**, present UI, then call the completion handler from that continuation. Call it exactly once. Do not block the delegate queue.

Pinning: in \`didReceive challenge\`, inspect the trust, set the credential or cancel, complete. Keep it CPU-bound and off main. Never touch UIKit there.

Do not use \`main.sync\` from any URLSession callback. Do not implement a delegate on shared. Do not create a new session per request.`,
      explanation: `Two seniors split the problem down the middle and both were wrong in a way that compiles. The async client used URLSession.shared, which will never call your pinning delegate, so the banked host was talking to whoever presented a cert. The delegate client did implement the challenge, then DispatchQueue.main.sync to show a passphrase alert. On devices where the first challenge happened while main was already blocked in an await that needed the session to finish, the delegate queue sat holding the challenge, main sat waiting for the session, and the phone froze until the watchdog. Main Thread Checker was quiet because nobody touched UIView.bounds off main — they just inverted two queues.

The session is the object. Shared is a convenience session with Apple’s delegate. Pinning is policy on your session. The async API is a wrapper around the same task machinery. session.data(for:) on a delegate-configured session will pause at a challenge, your delegate runs on the delegate queue, you must complete the handler, then the async function resumes. That composition is the whole answer.

The thread story is the rest. Delegate callbacks are not MainActor. Challenge handlers especially. Reading a passphrase is UI, so it belongs on main, asynchronously. Completing the handler belongs back with the session, once. sync is how you turn “I needed main” into a deadlock. The same pattern shows up if you await a MainActor view model from the delegate actor without giving the delegate queue a chance to run.

I would keep one long-lived session per configuration (ephemeral for tokens, a second if you must isolate pinning hosts), one delegate instance that is not a view controller, and a tiny callback for the rare UI challenge. Pinning itself should not need UI. If it does, you are prompting your way around a cert problem and that is an incident of its own.`,
      internals: `URLSessionDelegate methods run on delegateQueue. nil means a serial queue owned by the session. That queue is the same queue that drives task completion for delegate-style APIs. Blocking it blocks the session.

Authentication challenges: URLAuthenticationChallenge, protection spaces, NSURLAuthenticationMethodServerTrust for pinning, client cert for mTLS. You must call the completion handler. Not calling it leaks the task. Calling it twice is undefined.

Swift concurrency: URLSession.data(for:) is not MainActor. A @MainActor HTTP client that awaits it will hop back after resume. The delegate still ran on the session queue in between. Do not mark the delegate methods @MainActor; you will get executor hops and you can still deadlock if you isolate the wrong object.

Certificate pinning: evaluate the trust (or pin SPKI hashes). Do not disable ATS to make it work. ATS is a floor; pinning is extra.

URLSessionTaskDelegate can be per-task in newer APIs; the queue story does not change.`,
      testing: `A local test server with a custom cert. Assert the pinning delegate accepts the pin and rejects a wrong pin — the async data(for:) throws. Assert the challenge completion is called once (spy).

Deadlock test: from MainActor, start data(for:) that will challenge, and in the delegate hop to main async (not sync) to collect a stubbed credential. Assert the request finishes under a timeout. A second test that uses main.sync should hang — you write that test only as a demonstration in DEBUG, not in CI.

Never unit-test pinning only against https://example.com. Use a fixture.`,
      pitfalls: `URLSession.shared plus a delegate you never assigned. main.sync from the delegate queue. Presenting UI on the delegate queue (Main Thread Checker will catch that one). Creating a session per call and not invalidating it — session leaks. Forgetting to call the completion handler. Pinning in debug against Charles and then shipping a pin that breaks the next CDN rotation without a backup pin. Completing the challenge on a random concurrent queue.`,
      alternatives: `A third-party pinning library still sits in this delegate. TrustKit et al. do not change the queue. URLSession.init(configuration:delegate:delegateQueue: .main) puts callbacks on main — easier UI, worse for throughput, still deadlocks if you then sync to a background queue that waits on main. Prefer a private serial queue plus async hop for UI.`,
      tradeoffs: `A custom session is more code than shared and is the only way to pin. Ephemeral configuration avoids disk caches for authenticated checkout; it also means no HTTP cache, which is what you want for POST. Delegate on main is simpler for the passphrase alert and couples networking to UIKit’s run loop — fine for a bank app with one mTLS host, poor for a feed. async/await on a delegate session is not a compromise; it is the intended composition. main.sync is never the tradeoff, it is a bug.`,
      followups: [
        {
          q: 'Why was Main Thread Checker quiet during the deadlock?',
          a: 'It flags UIKit off main, not queue inversion. A freeze with no red banner is still a threading bug. Hang traces and “pause in debugger” show the two queues waiting on each other.',
        },
        {
          q: 'Can the PinningDelegate be an actor?',
          a: 'Careful. Delegate methods are invoked by URLSession on its queue. Bridging into an actor is possible; blocking that actor on MainActor is the deadlock again. Keep the delegate a plain class, hop explicitly.',
        },
        {
          q: 'Where do you store the client cert?',
          a: 'Keychain, not the bundle, not UserDefaults. The passphrase UI is because the item is access-controlled, which is Day 7 showing up inside the challenge.',
        },
        {
          q: 'Does waitsForConnectivity change challenge threading?',
          a: 'No. It delays the connect. The challenge still arrives on the delegate queue when the TLS handshake happens.',
        },
      ],
      teaches: [
        'Custom URLSession vs shared',
        'Delegate queue vs MainActor',
        'Auth challenge completion',
        'Pinning and mTLS',
        'async/await on a delegate session',
        'main.sync deadlock',
      ],
    },
    {
      id: 'd6-p5',
      title: 'Checkout POST: backoff, Retry-After, circuit breaker, idempotency',
      difficulty: 'Expert',
      kind: 'Design',
      prompt: `Checkout is \`POST /checkout\` that charges a card. Product wants it to “just retry” when the API is sad. Payments shows duplicate charges from mobile during a brownout. Legal wants a circuit breaker. The API now sends \`Retry-After\` and requires \`Idempotency-Key\`.

Design the client for this one POST: when you retry, when you stop, what you store across process death, how the breaker interacts with the feed’s breaker, and what the UI does while you wait. This is not the feed retry from problem 2.`,
      think: [
        'Why is retrying a charge different from retrying GET /feed?',
        'What is the idempotency key’s lifetime, and where does it persist?',
        'Who opens the circuit — this host, this route, or the whole HTTP client?',
        'What do you do with Retry-After: 120 on a checkout screen?',
      ],
      solution: `One checkout attempt is one idempotency key, created before the first POST, persisted in the drafts store (Day 7), not in memory. If the process dies after the server charged and before you heard 200, the next launch retries **the same key**. The server returns the original result. That is how you stop duplicate charges.

Retry only when the outcome is unknown: timeout, connection drop, 502/503/504. Honour Retry-After exactly, cap at a product limit (e.g. 60s wait on this screen, then fail with “we don’t know, check orders”). Do not retry 400 (bad card), 402 (payment required / declined), 401 (refresher), 404, 409 (conflict — show it). 409 on checkout is not “already liked”; it may mean coupon used or order already placed — reconcile with GET /orders/:id.

Circuit breaker: **per route or per payments host**, not shared with GET /feed. A feed brownout must not fail-fast checkout. A payments brownout must not blank the home feed. After N unknown failures, open, fail fast, UI says try again in T. Half-open is one probe, which is this POST with the same key — not a second charge.

UI: not a spinner that hides a two-minute Retry-After. Show the wait, a cancel that **does not** invent a new key, and a path to “did this charge?” via orders. Cancel local wait ≠ cancel the charge on the server.

Never fire POST /checkout from a pull-to-refresh or from a view-model appear.`,
      explanation: `Payments landed in Slack with two charges for one tap. The feed retry policy had been copied onto checkout because it was “the HTTP client.” Ten immediate retries of POST /checkout during a 10-minute brownout is not a DDoS of your own API, though it is that too. It is a DDoS of the user’s card. The API team added Idempotency-Key and Retry-After after the incident. Legal asked for a circuit breaker. Product still said just retry. Those three requests are compatible if you remember that this POST is not GET /feed.

An idempotency key is a client-generated identity for a mutation. You mint it when the user confirms, you persist it next to the draft order, you send it on every retry, you stop sending it when the user starts a new checkout. Timeout is the whole reason it exists: you do not know whether the charge happened. Retrying with a new key is a new charge. Not retrying at all after a timeout leaves the user stuck and sometimes still charged. Same key is the only honest move.

Retry-After on a checkout screen is a UX problem as much as a networking one. Sleeping 120 seconds on the main actor is a freeze. Honouring it in the client with a visible countdown is correct. Ignoring it and retrying immediately is how you look like you did not read problem 2. The circuit breaker is the other half: if payments is down, fail fast instead of collecting ten timeouts per user. Scoped to the payments host, because coupling it to the feed breaker recreates a different outage.

This belongs in a CheckoutClient with its own retry policy, not in a generic interceptor that treats every POST the same. The generic interceptor is what shipped the duplicate charges.`,
      internals: `Idempotency-Key: UUID, stored with the order draft in the user-data store, TTL on the server (often 24h). Reuse within TTL must return the first result. After TTL, the same key may be rejected — then you need GET /orders to reconcile, not a new POST.

Unknown outcome: no response, or a response you cannot parse, or 5xx. Known failure: 4xx you can show. Known success: 2xx. Only unknown is retried.

Circuit breaker state belongs next to the payments host configuration. Counters are per process; persist “open until” if you want a kill switch across launches, but do not persist so hard that a single user is bricked after one flight. Half-open probe uses the existing key.

URLSession will retry some transport failures. Disable stacked retries for this route. waitsForConnectivity can delay the first POST until the radio is up — reasonable; it must not multiply the POST.

Token refresh (problem 1) may 401 a checkout. Join the refresher, retry the same POST with the same idempotency key once. A refresh loop is not a charge loop if the key holds.`,
      testing: `Fake timeout then 200 with the same key — assert one charge on the server fake, two HTTP calls, one key. Fake timeout then 200 with a client that minted a new key — this is the regression test you wish you had; it must fail. Fake 402 — one attempt, UI declined, no retry. Fake 503 with Retry-After: 5 — second attempt at t=5 on the fake clock. Fake five timeouts — breaker opens, sixth call does not hit the network. Fake feed 503 — checkout still attempts.

Process-death test: persist the key, kill before response, relaunch, retry, one charge.

Do not hit Stripe in unit tests.`,
      pitfalls: `Generic retry interceptor on all POST. Minting a new UUID on every tap of Retry. Storing the key in memory only. Sharing the feed circuit breaker. Honouring Retry-After by blocking main. Retrying 402. Firing checkout in viewDidAppear. Logging the card. Putting the key in UserDefaults (Day 7). Cancelling the UI and starting a new checkout while the first key is still in flight.`,
      alternatives: `Server-side debit with a client-order-id you already had in the draft, no extra header — same idea. A payments SDK that owns retry; you still persist the SDK’s attempt id. No retries at all plus a “check order status” button — honest, slower, legally simpler. That can be v1 if the API has no idempotency yet; do not invent retries before the key.`,
      tradeoffs: `Retries with keys: better completion, requires durable storage and a status path. No retries: no duplicate charges from the client, more abandoned checkouts, more support. A payments-scoped breaker: extra state, stops a charge storm, must not be tied to feed health or you will fail checkout because images 503. Visible Retry-After: uglier UI, fewer duplicate taps. The generic HTTP retry from problem 2 is the right default for GET and the wrong default for money.`,
      followups: [
        {
          q: 'The user double-taps Pay. One key or two?',
          a: 'One. Debounce the button, disable it, reuse the in-flight key. A double tap that mints two keys is two charges. That is a UI bug with a payments body count.',
        },
        {
          q: 'What if Retry-After is 10 minutes?',
          a: 'Do not sit on the checkout screen for 10 minutes. Fail the attempt locally, keep the key, let them leave, reconcile via orders or a later retry when the breaker half-opens. Show “payment is processing.”',
        },
        {
          q: 'Does the widget need the checkout key?',
          a: 'No. Do not put charge identity in an App Group defaults suite. Drafts store, app process only, unless you have a checkout extension — you should not.',
        },
        {
          q: 'How does this interact with certificate pinning in problems 4 and 6?',
          a: 'Checkout host is exactly who you pin. A pinning failure is not retryable as a 503. Do not charge-retry a failed TLS handshake with a new key. Same key after the pin is fixed, or GET /orders.',
        },
        {
          q: 'Open breaker and a persisted unknown charge?',
          a: 'The breaker stops new HTTP. The unknown charge still needs GET /orders on the next launch. Status polling is not POST retry and can use a gentler policy.',
        },
      ],
      teaches: [
        'Idempotency keys for charges',
        'Unknown vs known outcomes',
        'Per-route circuit breakers',
        'Retry-After as UX',
        'Durable attempt identity',
        'Do not reuse GET retry for POST money',
      ],
    },
    {
      id: 'd6-p6',
      title: 'Certificate pinning pages you after a CDN rotation',
      difficulty: 'Expert',
      kind: 'Incident',
      prompt: `At 02:14 UTC the checkout host’s CDN rotated a leaf cert. By 02:16 Crashlytics is quiet and support is not: every iOS user on 4.3+ cannot pay. Your pin is an SPKI hash of the leaf, baked into the app. Android is fine (they pin the intermediate). The backup pin in the plist is the old leaf. Product asks how long until a binary ships.

Explain why this is not a 401, not a retry, and not “ATS is broken.” Design pinning so a CDN rotation is a staged event, not an outage, and say what you do this morning before App Review.`,
      think: [
        'What exactly did you pin, and what did the CDN actually change?',
        'Does a pinning failure look like a timeout, a 401, or a cancelled challenge?',
        'What can you do without a binary — remote config, a kill switch, nothing?',
        'Leaf versus intermediate versus CA: which pin survives a rotation you do not control?',
      ],
      solution: `Pin **SPKI of the intermediates you own or have a contract on**, plus a backup pin, plus a report-only mode before enforce. Do not pin the leaf of a host you do not issue.

This morning, without a binary:

* You cannot change a baked leaf pin. If the only pin is the dead leaf, the app is down until App Review. Say that in the war room in the first five minutes.
* If you shipped a backup pin that still matches (old intermediate, or a second leaf you pre-provisioned), the challenge succeeds. If you did not, there is no remote-config escape — a flag that disables pinning still requires a binary that *reads* the flag before the pin runs. A pin that runs first cannot be killed from the dashboard.
* Server-side: keep the old cert serving on a second hostname or IP if the CDN allows, and ship a remote-config **host override** only if the client already had that override *and* pinned both hosts. Most apps do not.

This quarter’s design:

1. Pin the SPKI of your issuing intermediate (or two), not the leaf.
2. Ship a backup pin one rotation ahead. Rotate pins like DNS: add, wait for adoption, remove.
3. Report-only first: fail open, log, crash-free. Enforce when the numbers say every live version has the new pin.
4. Pinning failures are **not** 401 and **not** retryable as 503 (problem 2, problem 5). Do not log the user out (problem 1). Surface a specific “secure connection failed, update the app” if you must.

The session in problem 4 is where the check runs. This incident is the policy you put in that delegate.`,
      explanation: `Support’s queue looked like an API outage. The API was fine. Android was fine. iOS 4.2 was fine if it was old enough not to pin. 4.3+ died in the TLS handshake, before a single HTTP status, which is why Crashlytics was quiet and why the retry interceptor never ran. The leaf you pinned was a CDN artefact. Fastly or CloudFront rotated it on a schedule your PKI people knew about and your iOS pin file did not. The backup pin was the previous leaf, also dead. You had built a lock whose only key was thrown away by a vendor ticket.

Pinning is extra policy on top of ATS. ATS already wants a valid, unexpired chain to a trusted CA. Pinning says “and it must be *this* key.” That is useful against a compromised CA or a corporate TLS-intercept box. It is a self-inflicted outage if the thing you pin is the part of the chain you do not control. Leaves rotate. Intermediates rotate less. Roots rotate almost never, and pinning a public root is close to not pinning.

The other half of the incident is classification. A cancelled server-trust challenge is not expiry. If your error mapping (problem 12) turns every URLError into “session expired,” you will log everyone out because Akamai issued a new leaf. The user then re-logs, still cannot pay, and you have a second incident on the auth cluster.

I would tell Product the binary timeline honestly. If the pin is baked and both hashes are dead, there is no dashboard. The morning’s work is a hotfix that pins the new intermediate, a backup of the next one, report-only on a second host if you have one, and a postmortem that adds pin rotation to the CDN runbook. The architecture answer is the same as any other secret: the set of trusted keys is a schema. You migrate it. You do not hard-code yesterday’s leaf and hope.`,
      internals: `SPKI pin: SHA-256 of the Subject Public Key Info, not of the whole cert. The cert can be reissued with the same key and the pin still matches; a new key breaks it. CDN “rotation” often means a new key.

\`URLAuthenticationChallenge\` / \`NSURLAuthenticationMethodServerTrust\`: evaluate \`SecTrust\`, then compare SPKI hashes of the presented chain against your set. Call the completion with \`.useCredential\` or \`.cancelAuthenticationChallenge\`. Cancelled tasks surface as \`URLError.cancelled\` or a TLS error, not as HTTP 403.

ATS exceptions do not replace pinning. Disabling ATS to “make Charles work” and then shipping a pin is how debug and prod diverge. Use a debug-only trust delegate, compiled out.

Backup pins: two hashes in the shipped set. Both must be live or soon-live. A backup that is the previous leaf is a backup of a corpse after rotation.

App Transport / Identity pinning libraries still run on the delegate queue from problem 4. Same deadlock rules. Same “do not pin \`URLSession.shared\`.”`,
      testing: `A local test server with a fixture cert whose SPKI you know. Assert accept on the pin, reject on a different key, and that the async \`data(for:)\` throws a *pinning* error, not a decode error.

A “rotation” test: client has pins [old, new]; server presents new; success. Client has pins [old] only; server presents new; fail. This is the incident as a unit.

Do not call this tested because Charles worked on your laptop with pinning off. A CI fixture with a canned chain is the test. Monitor production: count of pinning failures tagged by host, paged separately from 401s.`,
      pitfalls: `Pinning the leaf of a CDN you do not control. Treating pin failure as 401 / logout. Retrying pin failure with backoff (you DDoS nothing; you also never recover). A backup pin that is the previous leaf. Disabling pinning from remote config *after* the handshake. Pinning in debug against Charles and shipping that pin. Completing the challenge with \`.performDefaultHandling\` and thinking you pinned.`,
      alternatives: `No pinning, ATS only — honest if your threat model is not nation-state CA compromise, and it survives CDN rotations. Certificate transparency / built-in iOS constraints as a middle path. mTLS with a client cert (problem 4) is a different control; it does not replace server pins and it has its own rotation.

A pinning SDK (TrustKit) with report-uri. Still needs the right hashes. The library will not save a leaf pin.`,
      tradeoffs: `Leaf pins are tighter and fragile. Intermediate pins survive leaf rotation and fail when the CA actually changes — which is the attack you wanted to catch, and also a planned PKI event you must still stage. Report-only is safer and means a real MITM is only logged. Enforce when adoption of the new pin is ~100% of live versions, which means you cannot enforce a pin the same week you ship it.

Hotfix versus “wait for the next train”: if checkout is down, you wait for Review. That cost is why pins are a schema, not a constant in a Slack message.`,
      followups: [
        {
          q: 'Can remote config disable pinning this morning?',
          a: 'Only if the already-shipped binary reads the flag *before* evaluating trust, and defaults to the current pin when the flag service is itself unreachable. Most “kill switch” designs evaluate trust first. Then the flag never loads.',
        },
        {
          q: 'Should you pin the API and the CDN for images?',
          a: 'API, especially checkout (problem 5). Image CDN leaves rotate constantly; pinning them is this incident on the home feed. ATS is enough for public images (problem 10).',
        },
        {
          q: 'What do you tell Support during the outage?',
          a: 'Not “log out and back in.” Not “reinstall.” “We are shipping a trust update; Android is unaffected; payments on the web still work.” Give them a web checkout path if you have one.',
        },
        {
          q: 'Is this the same as ATS exception domains?',
          a: 'No. ATS is Apple’s floor. Pinning is your allowlist of keys. An ATS exception makes the floor lower. It does not fix a wrong pin.',
        },
      ],
      teaches: [
        'Pin intermediates you control, not CDN leaves',
        'Backup pins are a rotation scheme',
        'Pin failure is not 401 and not retryable',
        'Report-only before enforce',
        'No dashboard kill switch after handshake',
        'Pins are a versioned schema',
      ],
    },
    {
      id: 'd6-p7',
      title: 'GraphQL client versus REST, one screen, three queries',
      difficulty: 'Senior',
      kind: 'Judgment',
      prompt: `The backend is migrating to GraphQL. A teammate generates an iOS client from the schema and calls three operations from \`ProfileVM.load()\`: \`Me\`, \`Cart\`, \`Recommendations\`. Each is a separate HTTP POST to \`/graphql\`. The REST app used one \`GET /me\` that already included the cart summary. The new screen waterfalls, 401-refresh runs three times if you get the interceptor wrong, and a field rename on \`User.tier\` breaks the generated SDK before it breaks the UI.

Pick a client shape for this app (the 80-screen one). When do you want generated GraphQL, when a handwritten REST client, and how do you stop the VM from owning query strings? What do you batch, and what do you refuse to put in one operation?`,
      think: [
        'Is GraphQL a transport, a schema, or a reason to skip the feature-client grain from Day 5?',
        'Who owns the operation: the VM, a ProfileClient, or a generated API enum?',
        'What happens to the 401 single-flight and the timeout policy when every call is POST /graphql?',
        'Does a generated type for every field replace mapping, or just move it?',
      ],
      solution: `GraphQL does not replace \`ProfileClient\`. It replaces **how \`LiveProfileClient\` talks**.

The VM still depends on \`func dashboard() async throws -> ProfileDashboard\` (or \`me()\` + explicit extras). Live adapter runs **one** operation that asks for the fields this screen needs, or a persisted query the server already knows. Three round-trips from \`load()\` is a waterfall you invented; REST’s \`GET /me\` was already the batch.

Generated SDK: allowed **inside** the live adapter. Forbidden in the VM. The VM sees \`User\`, \`Money\`, domain errors — the same types as REST. When \`User.tier\` renames, the adapter fails to compile, you map, the VM does not sprout \`user.tier?.rawValue\`.

HTTP pipeline is still one \`HTTPClient\` (Day 5 problem 8, this day’s problem 1). GraphQL over HTTP is POST. 401 join, tracing, and retries apply to the **operation**, with care: GET-style queries can retry; mutations need idempotency keys like problem 5. Do not let the generated client bring its own URLSession. That is a second refresher.

Batch: fields for one screen, one operation. Do not fetch the whole schema “in case.” Do not glue \`checkout\` and \`feed\` into one query because they share a spinner — different failure domains, different caches.

Persisted queries / GET with a hash if you want CDN caching. Untamed POST bodies will not hit the image-CDN logic in problem 10, and they will not be cacheable.`,
      explanation: `The migration deck said “one endpoint, typed operations, no more overfetching.” The PR shipped three operations and a generated module the VM imported, which is how you get three POST /graphql, three 401s, and a compile break that looks like a UI break. GraphQL is a schema and a query language. It is not permission to skip the port. Day 5 spent a morning putting URLs behind \`ProfileClient\` so tests could return a \`User\`. If the VM now runs \`apollo.fetch(query: MeQuery())\`, you moved the URL into a generated struct and called it progress.

One screen, one round-trip is the default, same as the old \`GET /me\`. GraphQL’s actual gift is that you can *shape* that round-trip without begging the backend for a new REST aggregate. Use that gift. Three queries because the schema has three roots is the same mistake as three view models each calling URLSession.

Generated code is an adapter detail. It will rename when the schema renames. That is useful *in the adapter*, where you want a compile error. It is hostile in the VM, where you want a domain \`User\` that you control. I have seen teams skip the mapping because the generated type had a comment that said User. Six months later the schema is a kitchen sink and SwiftUI is rendering \`GraphQLNullable\`. Map once.

The 401 story is the same herd as problem 1. A generated client with its own session is how you get fifteen refreshes *and* a second copy of the bug. Wrap generation in the pipeline you already paid for.`,
      internals: `GraphQL HTTP: usually POST, body \`{ query, variables, operationName }\`. Persisted queries may be GET. All of them are still URLSession tasks. Timeouts, waitsForConnectivity, pinning (problems 4 and 6) attach to that session.

Multipart uploads (images, video) often stay REST or use a separate upload host. Do not force a 200 MB mutation through \`/graphql\` because the schema has an \`Upload\` scalar unless you have measured it. That is problem 8’s client.

Codegen (Apollo, GraphQL Swift): operation-scoped types. Keep them \`internal\` to the live adapter module. Public surface is your domain.

N+1 on the **server** is not your iOS bug, but three client operations is an N=3 you do own. Watch waterfalls in Instruments’ network trace the same way you watch image waterfalls in problem 10.

Error JSON: GraphQL can return 200 with \`errors[]\`. That is not success. Map it in the adapter (problem 12). A VM that checks \`data != nil\` and ignores \`errors\` will paint a half profile and call it a win.`,
      testing: `VM tests still stub \`ProfileClient.dashboard()\` → a domain struct. They do not construct \`MeQuery\`.

Live adapter tests: a fixture JSON document with data, with errors, with 401. Assert mapping. Assert one HTTP call for the dashboard operation, not three.

A regression test: the generated client is not imported by any file under \`ViewModels/\` or \`Features/*/UI\`. Boundary grep, same as Day 5’s no-URLSession-in-UI rule.`,
      pitfalls: `Three operations in \`load()\` because codegen emitted three files. Apollo’s default URLSession. Retrying a mutation as if it were a query. Treating HTTP 200 + errors as success. Putting GraphQL types in SwiftUI previews. Fetching \`user { ... everything }\` for a settings toggle. A second interceptor in the generated stack that refreshes tokens.`,
      alternatives: `Stay REST for this screen if the BFF already returns the aggregate and GraphQL is a backend-only migration. Hybrid: REST for checkout POST (problem 5), GraphQL for the messy profile read. Honest.

A handwritten GraphQL document in the live adapter without codegen, decoded into domain types. Less magic, more mapping tests, fine at 4 people.

gRPC (problem 12) is a different generated client with the same inversion rule.`,
      tradeoffs: `Generated GraphQL: fast to add a field, easy to leak types, easy to waterfall. Handwritten REST: fewer moving parts, over/underfetch, backend ticket for every shape. The staff choice is a domain port plus whichever live adapter the server actually speaks this quarter. Switching transports should not rewrite VMs. That is the whole point of Day 5 problem 8, still true when the path is always \`/graphql\`.`,
      followups: [
        {
          q: 'Can you cache GraphQL like GET /feed?',
          a: 'Not if every call is an uncacheable POST with a unique body. Persisted queries as GET, or an application cache keyed by operation+variables, same cursor rules as problem 3.',
        },
        {
          q: 'Where do fragments live?',
          a: 'In the adapter / graphql documents, composed per screen operation. Not as Swift mixins on the VM.',
        },
        {
          q: '401 on one of three in-flight operations?',
          a: 'If you already fired three, problem 1’s single-flight still saves you. Prefer not firing three.',
        },
        {
          q: 'Watch app wants two fields of Me. New operation?',
          a: 'A smaller operation in the live adapter, or the same dashboard trimmed. Still not the VM owning a query string. Same ProfileClient method or a tiny IdentityClient (Day 5).',
        },
      ],
      teaches: [
        'GraphQL is a live adapter, not a VM dependency',
        'One screen, one round-trip by default',
        'Generated types stay behind the port',
        'POST /graphql still uses the one HTTP pipeline',
        '200-with-errors is a failure',
        'Do not waterfall three operations from load()',
      ],
    },
    {
      id: 'd6-p8',
      title: 'Upload progress, pop, and a second file on the same session',
      difficulty: 'Senior',
      kind: 'Debug',
      prompt: `Composer uploads video with \`URLSession.uploadTask\`. A \`Progress\` bar binds to \`task.progress.fractionCompleted\`. The user pops the composer; the bar dies; the upload continues (good). They open composer again, pick a second video. Progress jumps to 90%, then to 10%, then the first video’s 200 lands in the second screen’s completion and the second file never starts.

There is one \`URLSession\` for uploads, a delegate, and an async wrapper that uses \`withCheckedContinuation\`. Map the bugs. Who owns the task after pop? How do you report progress to a screen that does not exist? How do you cancel only the upload the user asked to cancel?`,
      think: [
        'Is progress a property of the view or of the upload job?',
        'Can one continuation / one delegate serve two tasks?',
        'What does cancel mean: cancel the URLSession task, or just detach the UI?',
        'Where does the file live so a pop does not delete the source the task is still reading?',
      ],
      solution: `An upload is a **job** with an id, not a view-model field.

\`\`\`swift
actor UploadStore {
    struct Job: Sendable {
        let id: UUID
        let fileURL: URL // in Application Support, not tmp that the VC deletes
        var fraction: Double
        var state: State // pending, uploading, succeeded, failed, cancelled
    }
    func start(_ url: URL) async throws -> UUID
    func progress(for id: UUID) -> AsyncStream<Double>
    func cancel(_ id: UUID)
}
\`\`\`

The composer VM holds a \`jobID\`. On pop, the VM dies; the job does not. The next composer asks the store for in-flight jobs and binds to \`progress(for:)\` by id. Progress is keyed. There is no global \`fractionCompleted\` on the session.

Delegate: \`urlSession(_:task:didSendBodyData:)\` must look up the task’s job id (you set \`taskDescription\` or a dictionary of \`taskIdentifier → UUID\`) and publish to **that** stream. Mixing two tasks on one continuation is the 90% / 10% jump.

Cancellation: \`job.cancel()\` cancels the \`URLSessionTask\` and finishes the stream. Pop does **not** cancel unless product says drafts are disposable. A “cancel send” button does. \`withCheckedContinuation\` must resume **once**; a second task cannot share it. Prefer \`AsyncStream\` per job or the async upload API with a per-task delegate.

Do not use \`URLSession.shared\` for this. A background \`URLSessionConfiguration.background\` if the upload must survive kill; then the session owns the file and you reconnect to events on next launch. That is a different product requirement — say it.`,
      explanation: `The user did two normal things: they left, and they came back with another file. You had one progress fraction and one continuation for the whole session, so the second screen subscribed to the first task’s leftover KVO, then the first completion resumed a continuation the second screen had replaced. The 200 for video A closed video B’s wait. Video B never started. That is not a URLSession bug. That is identity.

Progress is not UI. The bar is a projection of a job. Chat composers and support-ticket attachments have the same shape as Day 7’s draft: the work must survive the screen. If you bind \`task.progress\` in the view, pop tears down the observation and you are tempted to cancel the task to match, or to leave a delegate firing into a deallocated VM. Both are wrong. The store owns the task. The view observes an id.

Background sessions make this non-negotiable: the system will complete the upload after death, and you will be asked to correlate an identifier you should have persisted. Even an in-process upload deserves that correlation. \`taskDescription = jobID.uuidString\` is inelegant and it works. A dictionary on the actor is clearer.

Continuations are one-shot. The async URLSession APIs are fine **per task**. They are not a reason to have one session-wide await. Two uploads are two tasks, two streams, two completions. The session is a factory and a delegate multiplexer, not a single future.`,
      internals: `\`URLSessionTask.progress\` is a \`Progress\` tree. KVO / Observation from a VM is convenient and dies with the VM. Prefer the delegate bytes-sent callback onto an actor, then an \`AsyncStream\` the UI can subscribe to.

\`upload(for:fromFile:)\` async still needs a delegate for progress (task delegate). You can set a per-task delegate in modern URLSession. The queue is still the session’s (problem 4). Do not \`main.sync\`.

File lifetime: \`tmp\` deleted in \`deinit\` of the VC is a classic: the task reads a hole. Copy into Application Support / a drafts directory (Day 7) before \`resume()\`. Background sessions require a file URL the process can reopen.

Cancellation is cooperative at the HTTP layer: \`task.cancel()\` stops sending. The server may have already accepted a partial. Design for that (resume offsets, or treat cancel as “abandon and a new job id”). Do not reuse the same job id for a retry of a different file.`,
      testing: `Start upload A, subscribe, pop (drop the subscriber), start B, assert A’s completions never emit on B’s stream, assert B starts at 0, assert A still reaches finished in the store. Cancel A: B untouched. Kill the VM without cancel: job still uploading.

Progress monotonic per job: inject byte callbacks. A test that one continuation resumed twice must fail.

File test: delete the composer’s tmp copy after start; the store’s copy must still exist.`,
      pitfalls: `One \`Progress\` on the session. Sharing a continuation. Cancelling on pop by default. Reading from \`tmp\`. Using \`shared\` and losing delegate callbacks (problem 4). Retrying an upload with problem 2’s GET policy. Logging the file path that still contains a user video in Crashlytics.`,
      alternatives: `Photos picker + background transfer service. A third-party uploader that already keys jobs — still wrap it so the VM sees \`jobID\`. Chunked REST with resume (tus) if videos are huge; the job id is the tus url. GraphQL \`Upload\` scalar is usually the wrong pipe for video (problem 7).`,
      tradeoffs: `A store is more types and is the product. View-owned tasks are simpler and lose work on pop. Background sessions survive kill and cost you a relaunch correlation story and a second session (they do not mix well with your pinned ephemeral API session). Per-task delegates are extra objects; a multiplexer actor is one object with a dictionary. Either is fine. A single continuation is not.`,
      followups: [
        {
          q: 'The user taps Cancel on a 90% upload. What happens to the server?',
          a: 'You cancel the task. You do not know if the object exists. Either the API is replace-by-id (send a new job id) or you DELETE the incomplete object. Do not POST the same file as a “retry” with a new id without product rules.',
        },
        {
          q: 'Can the feed’s HTTPClient own uploads?',
          a: 'A different configuration: longer timeouts, no GET cache, maybe background. Same token refresher (problem 1). Different breaker than GET /feed (problem 5).',
        },
        {
          q: 'Progress in a widget or a notification?',
          a: 'Only if the store persists fraction to a place the widget reads (App Group). Usually a “uploading…” flag is enough. Do not put the video in UserDefaults.',
        },
        {
          q: 'SwiftUI .task on the composer?',
          a: 'Fine to *start* if you immediately hand off to the store. .task cancelling on disappear must not cancel the job. That cancellation is the pop bug.',
        },
      ],
      teaches: [
        'Uploads are jobs with ids, not view state',
        'One continuation per task, never per session',
        'Pop ≠ cancel',
        'Progress is keyed by job',
        'File lifetime outlives the composer',
        'Background sessions need persisted correlation',
      ],
    },
    {
      id: 'd6-p9',
      title: 'WebSocket reconnects forever and duplicates the stream',
      difficulty: 'Expert',
      kind: 'Incident',
      prompt: `Chat uses a WebSocket. On \`URLSessionWebSocketTask\` error, the client reconnects immediately. After a 10-minute brownout (problem 2), users have 8–12 sockets open per device, the server fans out each message to all of them, and the UI shows duplicate bubbles. Foreground / background also starts a second task because \`scenePhase\` and the network path monitor both call \`connect()\`.

Design connect, reconnect, backoff, and identity so one session means one socket, a gap is catch-up over REST, and a 401 on the socket is problem 1, not a reconnect storm.`,
      think: [
        'Who is allowed to call connect(), and what makes that call a no-op if a socket already exists?',
        'Is reconnect the same as retry of GET /feed, or does a new socket need a resume token?',
        'How do duplicates happen: two sockets, or one socket and two UI subscribers applying the same frame?',
        'What happens in background: disconnect, a long-lived socket, or push as the gap hint?',
      ],
      solution: `One **RealtimeClient** actor owned by the authenticated session, not by the chat screen (the screen dying must not kill the only socket, and appearing must not open a second).

\`connect()\` is idempotent: if \`task != nil\` and state is connected or connecting, return. Two callers join the same Task, same as problem 1’s refresh.

Reconnect with **exponential backoff and jitter**, cap, honour server close codes. 1000/going-away may reconnect. 4001/auth is problem 1: refresh once, then reconnect with the new token, or logout. Do not treat a policy close as a blip.

After reconnect, the socket is a **live tail**, not a source of truth. Send \`lastSeenSeq\` or a resume id if the protocol has one. If not, REST catch-up for the gap (Day 7’s store is the ledger). Applying frames twice is a dedupe on message id, not “the socket won’t do that.”

Foreground: connect. Background: disconnect or leave a short-lived task; do not fight iOS. Push is the gap hint. Path monitor (\`NWPathMonitor\`) **signals** the actor; it does not own a second socket. \`waitsForConnectivity\` is a URLSession property, not a WebSocket strategy — see problem 11.

Never \`connect()\` from both \`scenePhase\` and the monitor without the actor’s idempotent gate. That is the 8–12 sockets.`,
      explanation: `The brownout ended. The clients did not. Immediate reconnect while the load balancer was still sad created a thundering herd of sockets, the same shape as problem 2’s GET retry, worse because a socket is a long-held fd on both sides. Each successful handshake was left alive because \`connect()\` did not look at what it already had. scenePhase went active and opened one. The path monitor saw wifi and opened another. A retry loop opened the rest. The server treated each connection as a subscriber, fanned out each message, and the client appended each frame because the UI pipeline trusted the socket as a stream of *new* facts. Duplicate bubbles are identity again: the ledger should have keyed on message id. The fd leak is the actor you did not write.

I want one connection per process per environment, owned above the screen. Chat popping must not disconnect if a widget or a muted conversation still needs the tail; in v1 it is fine to disconnect when the user signs out or backgrounds. The product call is explicit. The architecture call is: two callers cannot both believe they are the owner.

Reconnect is not \`for _ in 0..<10 { try await connect() }\`. It is backoff, jitter, a cap, and a resume. Without a resume token you will miss messages or you will replay them. REST catch-up plus a seq on the store is the boring design that survives a socket that never quite does what the vendor deck promised.

401 on a socket is a close, not a GET 401. You still single-flight the refresh. You do not open twelve sockets with the old token while the refresher is running. Join, then connect once.`,
      internals: `\`\`\`text
scenePhase ──┐
path monitor─┼──► RealtimeClient.connect() ── one URLSessionWebSocketTask
chat appear ─┘         │
                       ├── on fail: backoff Task (single)
                       └── on frame: decode → persist by id → UI observes store
\`\`\`

\`URLSessionWebSocketTask\` is a task on a session. Use the same session family as your API if you need the pinning delegate (problems 4 and 6); many teams use a dedicated session. Do not use \`shared\`.

Ping/pong: application or protocol. A silent NAT can hold a dead socket; a watchdog that pings and reconnects on timeout belongs in the actor, not in three VMs.

Seq: server monotonic id per conversation or global. Client lastSeen persists in the Day 7 store. Catch-up is GET /messages?after=.

Close codes are data. Map them. Do not \`reconnect()\` blindly in \`didCloseWith\`.`,
      testing: `Fake socket: two overlapping \`connect()\` calls, assert one handshake. Fail, assert one reconnect after jittered delay (injected clock), not ten. Emit the same message id twice, assert one row in the store. scenePhase background then foreground: still one task. 4001 close: refresh joins problem 1, then one connect with the new token, not a loop of 4001s.

A test that path-up and scene-active fire together still yields handshake count == 1.`,
      pitfalls: `Reconnect in the VM \`deinit\` *and* in the monitor. Immediate reconnect with no jitter. Treating every close as transient. Appending frames without an id. Using the socket as the store. Refreshing the token per frame. WebSockets through a generated GraphQL client that also has its own reconnect (problem 7) — two herds.`,
      alternatives: `Server-sent events on HTTP/2 if you only need server→client. Push-only for v1 (no socket) if the product can stand extra latency. MQTT / a vendor realtime SDK — wrap it in the same actor so you can still single-flight connect. gRPC bidirectional streams (problem 12) have the same single-connection rule.`,
      tradeoffs: `A long-lived socket is efficient for chat and expensive on radio and server. Disconnect in background saves both and makes catch-up mandatory. Keeping the socket in background fights iOS and drains battery. Duplicate-tolerant persistence is extra work and is how you sleep when the server double-sends after a resume the protocol got wrong.`,
      followups: [
        {
          q: 'Does the token refresher close the socket?',
          a: 'On logout, yes. On a successful refresh, either send an auth frame if the protocol allows, or reconnect once with the new token. Do not leave a socket that will 4001 in a loop.',
        },
        {
          q: 'Typing indicators on this socket?',
          a: 'Ephemeral, not persisted, dropped if the socket lags. They must not create a second connection “just for typing.”',
        },
        {
          q: 'How does this interact with problem 3’s cursor race?',
          a: 'History pagination is REST into the store. The socket inserts by id. The cursor is for pages of history, not for live frames. Do not apply a live frame as “page 3.”',
        },
        {
          q: 'NWPathMonitor as the source of truth for “online”?',
          a: 'A hint. Problem 11. Path up does not mean the chat host answers. The actor probes; the banner uses actual failures.',
        },
      ],
      teaches: [
        'One socket per session, idempotent connect',
        'Backoff on reconnect, not immediate loops',
        'Dedupe on message id in the store',
        'Catch-up over REST after a gap',
        'Socket 401 is refresh, not a herd',
        'Path monitor does not own the task',
      ],
    },
    {
      id: 'd6-p10',
      title: 'Image CDN, 304s, and a cache that still decodes 40 MB',
      difficulty: 'Senior',
      kind: 'Performance',
      prompt: `The feed’s images go through a CDN. You set \`URLCache\` to 200 MB. Instruments still shows huge decode cost and the radio is busy on every scroll. Charles shows 200s with full JPEG bodies, almost no 304s. Some URLs are signed with a rotating query token. Product asks why Kingfisher “isn’t caching.” The HTTP client for JSON uses an ephemeral session.

Explain cache keys, validators, and who is allowed to decode. When is a 304 the win, when is a disk hit, and when are you lying because the query string changed? How does this sit next to problem 2’s feed JSON cache?`,
      think: [
        'Is the cache key the URL including the signed query, or the stable image id?',
        'Which session owns URLCache — shared, the JSON ephemeral session, or an images session?',
        'Do you still decode a 4000×3000 JPEG on a 120 pt row after a cache hit?',
        'What request headers make a CDN able to say 304?',
      ],
      solution: `Split **image HTTP** from **JSON HTTP**. Ephemeral for authenticated JSON (no disk cache of tokens). A second session for images, with a real \`URLCache\` (memory + disk), not the JSON session, not necessarily \`shared\`.

Cache key: the **stable image id**, not a signed URL that changes every 10 minutes. If the CDN requires a token, strip it for the cache key (custom \`URLCache\` subclass, or download to a file named by id). Otherwise every token rotation is a compulsory 200. That is why you see no 304s.

Validators: send \`If-None-Match\` / \`If-Modified-Since\` from the cached response. The CDN can 304. \`Cache-Control: no-store\` on signed URLs means URLCache will not help — then application cache (files in Caches, keyed by id) is the honest path.

Decode: cache **encoded** bytes plus a downsampled bitmap sized for the view (do not keep 40 MB CGImages in URLCache — it does not). Kingfisher still decodes what you ask for. Set the target size.

Problem 2’s JSON feed cache is a different store: items + cursor. Do not stuff JPEGs in SwiftData. Do not stuff the feed JSON in URLCache if it is authenticated and personalized.`,
      explanation: `Kingfisher was not broken. The URLs were. A signed query string is a new resource every time the token mints. URLCache keys on the URL. The CDN might even be willing to 304 the same bytes, but you never asked for the same bytes. You asked for \`photo.jpg?token=b\`. That is a miss, a 200, a full body, a decode. Multiply by a fling. The 200 MB URLCache filled with unique keys and evicted the ones you were about to scroll back to.

Ephemeral sessions are correct for checkout and for Authorization-bearing JSON. They are how you accidentally disabled caching for images when one session served both. Two sessions is not a purity rule. It is two policies. Image GET should be cacheable, retryable like problem 2’s GETs, and not pinned as if it were a bank host (problem 6). JSON GET for the feed may be uncacheable at HTTP layer and cached as an application blob.

304 is a cheap confirmation that the bytes you have are still the bytes. A disk hit without a round-trip is cheaper. A decode of a 4000×3000 into a 120-point row is the 40 MB you still pay after a perfect 304. Caching is not rendering. Downsample on the way in.

I would measure: cache hit rate by image id, bytes on the radio, decode time. If the VP of engineering says “we have a 200 MB cache” and hit rate is 4%, you have a keying bug, not a capacity bug.`,
      internals: `URLCache: memoryCapacity, diskCapacity, diskPath. Keys are typically method + URL. Changing query changes identity. \`Vary: Authorization\` makes authenticated images uncacheable across users — usually what you want; do not cache user-specific images in a shared URLCache on a shared iPad without thinking.

ETag / Last-Modified come back on 200. Store them. Send them. 304 has no body; you reuse bytes.

ImageIO thumbnail creation (\`kCGImageSourceCreateThumbnailFromImageAlways\`) is the decode policy. NSCache of UIImage with cost = bytes, purge on warning.

CDN: cache-control, signed cookies vs query tokens. Query tokens are poison for HTTP caches unless the token is stable for the cache lifetime. Prefer a stable path plus an Authorization the image session does not put in the cache key, or a cookie.

ATS / pinning: image CDN leaves rotate (problem 6). Do not pin them.`,
      testing: `Fake CDN: first GET 200 + ETag, second GET with If-None-Match → 304, decoder runs once. Signed URL with two tokens, same image id: application cache hits once. Ephemeral JSON session: assert a feed GET is not in URLCache. Downsample test: pixel count ≤ view×scale.

A scroll test on device with the radio in Network Link Conditioner: second fling should not redo the first screenful of JPEGs.`,
      pitfalls: `One ephemeral session for everything. Caching authenticated personalized images on disk without eviction. Pinning the image CDN. \`UIImage(data:)\` full size. Kingfisher default original. Putting tokens in the path and wondering why 304 never happens. Sharing URLCache with the JSON client that stores Authorization.`,
      alternatives: `Nuke / Kingfisher / SDWebImage with a \`cacheKey\` from image id — they already learned this. Still set target size. On-disk file cache you own for avatars, URLCache for public CDN, nothing for checkout screenshots. HTTP/3 / QUIC is a transport win the CDN may offer; it does not fix a bad cache key.`,
      tradeoffs: `Application cache keyed by id: you write more code, you survive signed URLs, you are responsible for eviction. Pure URLCache: correct when URLs are stable and headers are sane, free, and lies when marketing adds a tracker query. Aggressive disk: fast scrolls, stale avatars after a face change — TTL or ETag that actually runs.`,
      followups: [
        {
          q: 'Does waitsForConnectivity help image fling?',
          a: 'It delays tasks until a path exists. It can release a pile of image requests together (problem 11). Pair with a small in-flight cap, not 80 cells firing at once.',
        },
        {
          q: 'WebP / HEIC from the CDN?',
          a: 'Decode cost changes, cache-key rules do not. Still key by id, still downsample to the view.',
        },
        {
          q: 'How does this interact with the feed JSON retry cache?',
          a: 'JSON blob + cursor in application cache (problem 2, problem 3). Images in an image cache. Different TTLs. A feed refresh must not wipe avatars if the URLs (ids) did not change.',
        },
        {
          q: 'Signed URLs that expire in 60 seconds?',
          a: 'HTTP cache will miss. Prefetch bytes into an id-keyed file before expiry, or get a longer-lived cookie from the API. Do not recurl every cell on every appear.',
        },
      ],
      teaches: [
        'Cache keys must be stable image ids',
        'Signed query strings defeat URLCache',
        'Separate image session from ephemeral JSON',
        '304 is validators; decode is still a cost',
        'Do not pin public image CDNs',
        'Feed JSON cache ≠ image cache',
      ],
    },
    {
      id: 'd6-p11',
      title: 'Reachability banner versus waitsForConnectivity',
      difficulty: 'Senior',
      kind: 'Review',
      prompt: `A PR adds \`NWPathMonitor\` and shows “You are offline” whenever \`path.status != .satisfied\`. The HTTP client also sets \`waitsForConnectivity = true\` on the session. QA reports: the banner flashes on every wifi→cell handoff; requests hang for minutes with no UI; a fling-to-refresh after airplane-mode-off fires a stampede; the monitor says online while checkout still times out on a captive portal.

Review the PR. What is path status actually telling you? What does \`waitsForConnectivity\` do to a task? Which one owns the banner, and which one owns the request lifetime?`,
      think: [
        'Is NWPathMonitor an HTTP result, or a radio hint?',
        'If the session waits for connectivity, who is responsible for showing progress versus a failure?',
        'What happens to N waiting tasks when the path returns?',
        'Can path.satisfied be true on a network that cannot reach your host?',
      ],
      solution: `Path status is a **hint**, not the banner’s source of truth. \`waitsForConnectivity\` is a **delay**, not a retry policy, not a banner policy.

Split:

* **Request lifetime:** For interactive calls (checkout, pull-to-refresh), \`waitsForConnectivity = false\` (or a short timeout). Fail, show the error, let the user retry. For background / prefetch, waiting can be OK, with a cap, and never for POST checkout (problem 5).
* **Banner:** Show stale / offline from **actual failures** (timeouts, not-connected errors, circuit open from problem 2) plus a sticky “last success was 10 min ago” from the feed cache. Do not bind the banner 1:1 to \`NWPathMonitor\`. Handoffs will lie to you.
* **Monitor:** May *wake* the RealtimeClient (problem 9) or cancel a wait. Must not be the only gate that disables Pay.

Captive portal: path is satisfied, HTTP gets an HTML 200 from a hotel, JSON decode fails. Probe a known URL or trust the API failure. Do not trust \`.satisfied\`.

Stampede: when the path returns, every waiting \`waitsForConnectivity\` task starts at once. That is problem 2’s herd with a coalesced start time. Cap in-flight, jitter, breaker.

The PR should drop the 1:1 banner, document waits per session (images vs API vs checkout), and add a timeout wrapping waits so a request cannot sit invisible until the watchdog.`,
      explanation: `Reachability has been the wrong abstraction since the Reachability sample code. The monitor tells you the device has *a* path. It does not tell you your host answers, that DNS works, that the captive portal has let you through, or that IPv6 is broken on this coffee-shop AP. Binding a banner to \`!= .satisfied\` is how you flash “offline” during a handoff that did not drop a single packet, and how you hide a real outage when the path looks fine.

\`waitsForConnectivity\` was added so a request made in airplane mode does not immediately fail. Kind for a background upload. Hostile for a button the user is staring at. The task sits in a queue, the UI has no error, the spinner is optional, and three minutes later the radio returns and you fire everything. QA’s stampede is that queue draining. Problem 2 already told you not to retry immediately; waiting is a delayed first try that synchronizes everyone on the same rising edge.

The senior review is: two tools, two jobs. The session may wait for *prefetch*. The banner listens to *failures and cache age*. The monitor is an input to an actor, not a boolean on the view. Captive portals are why “isOnline” is a lie you stop shipping.`,
      internals: `NWPathMonitor callbacks are not MainActor. Hop. Path unsatisfied includes airplane and some VPN gaps. \`.satisfied\` includes “connected to a network that cannot route.” \`isExpensive\` / \`isConstrained\` are useful for prefetch policy (pause image quality, problem 10), not for blocking checkout.

\`URLSessionConfiguration.waitsForConnectivity\`: the task is queued until the connection is viable or the session invalidates. Combine with \`timeoutIntervalForResource\` so it cannot wait forever. Distinct from \`timeoutIntervalForRequest\`.

Do not mix: monitor says unsatisfied → you cancel waiting tasks *and* the session would have waited. Pick one owner.

SCNetworkReachability is the old API. Same lie, older types. Do not add both.`,
      testing: `Fake path unsatisfied then satisfied: banner must not flash if no request failed and cache is fresh. Fake airplane during checkout: with waits false, error in < timeout, not a hang. Fake 50 waiting image tasks: on path-up, in-flight cap holds, not 50 at t=0.

Captive: first byte is HTML; adapter maps to a domain error, banner shows, not a decode-crash.

Inject the monitor; do not toggle airplane in unit tests.`,
      pitfalls: `Banner bound to path.status. waitsForConnectivity on the checkout session. No resource timeout. Cancelling user-visible work because the monitor blipped. Using the monitor as a substitute for problem 2’s retry classification. Showing “offline” while a WebSocket is connected (problem 9) or vice versa.`,
      alternatives: `No monitor at all: only HTTP errors and cache age. Simpler, slightly slower to show airplane-mode chrome. A probe GET /health when the monitor rises, before releasing the stampede. Server-Timing / connectivity API if you have one — still a probe, not a path flag.`,
      tradeoffs: `Waiting: fewer immediate errors, more hangs, synchronized herds. Failing fast: noisier, honest, needs a retry button. Monitor-driven UI: snappy and wrong on handoff. Failure-driven UI: laggy by one timeout, correct. Prefetch on expensive paths off: better radio, emptier caches on cell.`,
      followups: [
        {
          q: 'Should pull-to-refresh wait for connectivity?',
          a: 'No. The user pulled. Fail or show cache (problem 2, problem 3). Waiting with no feedback is a broken control.',
        },
        {
          q: 'Background URLSession and waitsForConnectivity?',
          a: 'Background sessions already defer. Do not also invent a monitor loop that starts a second session.',
        },
        {
          q: 'isExpensive and image CDN?',
          a: 'Lower prefetch depth, maybe smaller variants (problem 10). Do not block the images already on screen.',
        },
        {
          q: 'Combine this with the circuit breaker?',
          a: 'Breaker opens on failures to *your host*. Path unsatisfied should not open the payments breaker. Different signals.',
        },
      ],
      teaches: [
        'Path status is a hint, not truth',
        'waitsForConnectivity is a delay, not a retry',
        'Banner from failures and cache age',
        'Path-up is a thundering herd edge',
        'Captive portals look online',
        'Interactive vs background sessions differ',
      ],
    },
    {
      id: 'd6-p12',
      title: 'gRPC on iOS, HTTP/2, and an error-mapping layer',
      difficulty: 'Expert',
      kind: 'Judgment',
      prompt: `Platform wants gRPC for the next API. Generated Swift stubs leak \`GRPCStatus\` (\`UNAVAILABLE\`, \`UNAUTHENTICATED\`, \`ALREADY_EXISTS\`) into view models. The feed already has a REST client with problem 2’s retry policy. Checkout is REST POST with idempotency (problem 5). A teammate says HTTP/2 multiplexing means you can drop the image session (problem 10) and the JSON session and put everything on one channel. Another wants to “just map UNAVAILABLE to 503” in each VM.

Do you adopt gRPC for this app? If yes, where? What stays REST? Where does error mapping live so VMs never switch on wire codes? What does HTTP/2 actually buy you on URLSession today?`,
      think: [
        'Is the pain missing RPCs, or missing a domain error type on the REST client you already have?',
        'Who must depend on the generated module — App, LiveFeedClient, or ProfileVM?',
        'Which gRPC codes are retryable, which are 409-shaped, which are 401-shaped?',
        'Does URLSession already speak HTTP/2 to your REST host, and would gRPC share that connection?',
      ],
      solution: `**Default: no gRPC in the VMs, and no gRPC for this app until a named pain exists** (bidirectional streaming the WebSocket is already doing badly, a second client already generated from proto, an org standard with a real interop budget).

If you adopt it, it is a **live adapter** behind the same feature ports as REST and GraphQL (problem 7, Day 5). \`FeedClient.page(cursor:)\` returns \`[Post]\` or a domain error. Generated stubs are \`internal\` to the adapter.

**Error mapping is one layer**, not a switch in each VM:

\`\`\`swift
enum APIError: Error {
    case unauthenticated
    case notFound
    case conflict(Conflict)
    case unavailable(retryAfter: TimeInterval?)
    case cancelled
    case unknown
}
\`\`\`

REST maps status codes here. gRPC maps \`GRPCStatus.Code\` here. GraphQL maps \`errors[].extensions.code\` here. Problem 2’s retry asks \`error.isRetryable\`. Problem 1 asks \`== .unauthenticated\`. Day 7’s like-queue asks \`== .conflict\`. VMs switch on \`APIError\`, never on 503 or \`UNAVAILABLE\`.

HTTP/2: URLSession already multiplexes HTTP/2 to REST hosts that support it. You do **not** drop the image session because of gRPC. Images still want cache keys, 304s, and a different pinning policy (problems 6 and 10). Checkout still wants idempotency and a per-route breaker (problem 5). One channel for everything is problem 2’s shared breaker with extra steps.

Stay REST for checkout until the proto has a well-named idempotency story. Streaming: gRPC bidi is an alternative to problem 9’s WebSocket, still one connection, still catch-up.`,
      explanation: `The platform pitch is types and HTTP/2. You already have types if you map JSON into domain objects, and you already have HTTP/2 if the REST host negotiated it. What you do not have, if \`GRPCStatus\` is in the VM, is a boundary. \`UNAUTHENTICATED\` in a view model is a 401 in a view model. It will grow a refresh call, then a second refresher, then problem 1 all over again inside a generated client that brought its own NIO event loop.

Error mapping is the unsung architecture of a networking stack. Status codes, gRPC codes, GraphQL error arrays, and URLError all lie in different shapes. The feed retry policy cannot be correct if every caller classifies them differently. One function, one enum, tests that 429 with Retry-After becomes \`.unavailable(retryAfter:)\` and that \`ALREADY_EXISTS\` on a like becomes \`.conflict(.alreadyLiked)\`. That layer is worth more than the transport debate, and you can ship it this week on REST.

gRPC on iOS is real (grpc-swift, NIO). It is also a second HTTP stack next to URLSession unless you are very careful: different pinning, different certificates, different waitsForConnectivity story, different background rules. I would not put checkout on it for a first adoption. I would not put image GET on it at all. I might put a streaming market-data feed on it if the WebSocket protocol is a mess and the backend is already proto-native. That is a strangler, Day 5 problem 1, not a conversion of 80 screens.

“Map UNAVAILABLE to 503 in each VM” is how you get 80 slightly different maps. The teammate is naming the right translation and putting it in the wrong type.`,
      internals: `gRPC over HTTP/2: one TCP connection, many streams, protobuf payloads. iOS URLSession HTTP/2: many REST requests multiplexed to the same host, still JSON, still URLCache. They do not share a connection. Two stacks.

UNAUTHENTICATED → problem 1. UNAVAILABLE / DEADLINE_EXCEEDED → retryable with backoff. NOT_FOUND → do not retry. ALREADY_EXISTS / FAILED_PRECONDITION / ABORTED → conflict (Day 7 likes). RESOURCE_EXHAUSTED may be 429-like; read metadata for retry delay. CANCELLED is cancellation, not a toast.

Generated clients love to retry internally. Disable that or you stack problem 2’s ten retries on theirs. Single-flight refresh must wrap their call, not live inside 40 stubs.

Protobuf \`oneof\` and optional fields are a schema. Breaking proto is a migration, same instinct as Day 7 expand/contract. Do not treat generated structs as domain if they will change weekly.`,
      testing: `A table: wire sample → \`APIError\` for REST fixtures, gRPC status fixtures, GraphQL error fixtures. VM tests never see \`GRPCStatus\`. Retry tests ask \`isRetryable\` on the domain error.

If a generated stub is imported under \`ViewModels/\`, CI fails. Adapter test: one RPC, 401-equivalent, refresh count == 1.

Do not hit a real gRPC server in the VM suite.`,
      pitfalls: `VMs switching on \`GRPCStatus.Code\`. Generated retries plus your retries. One shared channel for images, JSON, and checkout. Assuming HTTP/2 means you can delete URLCache. Pinning only the URLSession stack while gRPC uses NIO and ignores it (problem 6 on half the traffic). Mapping UNAUTHENTICATED to a generic toast. Adopting gRPC for a single PUT because platform asked.`,
      alternatives: `REST + error mapping now; gRPC later for one streaming feature. Connect / grpc-web over URLSession if you want proto without NIO. GraphQL (problem 7) if the actual need is ad-hoc reads, not RPCs. OpenAPI-generated REST — same inversion: generated in the adapter, domain at the port.`,
      tradeoffs: `gRPC: smaller payloads, streaming, codegen, a second stack and a pinning story you must not forget. REST on URLSession: one session model, HTTP cache, background tasks, everyone on the team can Charles it. Error mapping: a type you own, a translation you test, slightly more code than throwing the wire error. Throwing the wire error is how VMs become protocol documents.`,
      followups: [
        {
          q: 'Does HTTP/3 change the answer?',
          a: 'URLSession may already speak it to REST/CDN. gRPC-over-QUIC is a different maturity curve on iOS. Still not a reason to put GRPCStatus in the VM.',
        },
        {
          q: 'Where does Retry-After live in gRPC?',
          a: 'Trailing metadata. Map it in the same layer that REST maps the header. Problem 2 and problem 5 consume the domain field, not the header name.',
        },
        {
          q: 'Can the WebSocket and a gRPC stream both exist?',
          a: 'Please no, not for the same messages. Strangle one. Two live tails are problem 9’s duplicate bubbles with extra hops.',
        },
        {
          q: 'Is this “never gRPC on iOS”?',
          a: 'No. It is “gRPC is a live adapter you adopt for a named pain, behind a port, with one error map, without replacing the image CDN.” Same sentence as Day 5 problem 10 pointed at a transport.',
        },
      ],
      teaches: [
        'Generated stubs stay in the live adapter',
        'One domain error enum for REST, gRPC, GraphQL',
        'Retry and refresh classify domain errors',
        'HTTP/2 on URLSession ≠ drop every other session',
        'gRPC is a second stack, including pinning',
        'Adopt on named pain, not a platform slide',
      ],
    },
  ],
}
