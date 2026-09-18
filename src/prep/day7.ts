import type { PrepDay } from './types'

export const day7: PrepDay = {
  id: 'day-7',
  title: 'Day 7 — Persistence',
  kicker: 'Disks, secrets, and 409s',
  intro:
    'The store that only crashes for users you do not have on your phone, the Keychain item that “vanished” because you looked in the next room, and the like that stayed hearted after a 409. Today is migrations, secrets, replicas, and the failure domains you should have split before Support said delete and reinstall.',
  problems: [
    {
      id: 'd7-p1',
      title: 'Core Data migration that never finishes',
      difficulty: 'Senior',
      kind: 'Incident',
      prompt: `You add a non-optional \`User.tier: String\` with no default. Lightweight migration fails for a slice of users. Those users crash on launch in \`persistentContainer.loadPersistentStores\`. Support says "delete and reinstall." Design a launch path that migrates, fails safe, and does not block the first frame for 8 seconds.`,
      think: [
        'Is this a lightweight migration, or did you just invent a required column on an existing table?',
        'What happens if loadPersistentStores throws — crash, blank screen, or recovery UI?',
        'Should migration run on the main thread at launch, and what does the user see instead?',
        'Which stores are disposable caches, and which would make Support’s “delete the app” advice destroy user data?',
      ],
      solution: `Prefer additive, optional fields, or a default in the model editor, so lightweight migration actually works. A new non-optional \`tier\` with no default is not lightweight. SQLite cannot invent values for existing rows.

If you must be non-optional, provide a mapping model or a staged migration (v3 → v4) that backfills \`"free"\`. Expand, backfill, then contract in a later release if you really need non-optional.

Load stores off the main thread. Show a splash or the last cached shell. Do not deadlock the scene in AppDelegate waiting on an 8-second migrate of a 200 MB store.

On failure: log, report, show a recovery UI. “Move data” / last-resort destroy is a product decision, not a silent \`try?\`. Destroying a feed cache is fine. Destroying drafts and offline messages is not.

Test migrations: ship fixtures of vN stores in the test bundle; migrate to vN+1 in CI. Never only test empty simulators.

SwiftData is the same story with different nouns: versioned schemas and a migration plan, not “it will just work.”`,
      explanation: `The crash was on launch, which is how you know it is a data-plane bug and not a view-model bug. The object graph in memory was fine. The file on disk did not match the model. You added User.tier as a non-optional String, lightweight migration looked at existing rows, had nothing to put in the column, and failed. loadPersistentStores threw. The call sat in the scene delegate on the main thread. For most users with a tiny store it was a brief hitch. For a slice with years of history it never returned, or it returned as a crash. Support’s script was delete and reinstall, which is another way of saying we have no recovery path and we are willing to destroy whatever was in that file.

Seniors treat the store like a production database. You expand, you backfill, you contract. You do not rewrite a column in one step if you can add an optional, default it in code, and only later tighten. Lightweight migration can add optional attributes, rename via renaming ID, add indexes. It cannot magically fill a new required property. That limit is the whole incident.

Launch is the worst place to discover this. The first frame should not wait on a migration of unknown duration. Kick the load to a private queue, paint a shell, then either enter the app or enter a recovery screen. Silent destroy is how you lose a journalist’s drafts and get a 1-star review that is factually correct. TestFlight on an empty simulator will never find this. CI needs a fixture of the previous version’s store, including a large one.

SwiftData will not save you. VersionedSchema exists because the same class of mistake is still a crash.`,
      internals: `Core Data lightweight migration rewrites the SQLite schema in place when the change is in the supported set. WAL means there are -wal and -shm files next to the sqlite file; a migrator that copies only the sqlite file is a corruption generator. The persistent store coordinator owns the file. Two coordinators on the same file without a shared coordinator is how you get “database is locked” at launch, which looks like a migration hang.

File protection class AfterFirstUnlockThisDeviceOnly will refuse the store before first unlock. A crash in loadPersistentStores at boot then looks like a migration failure and is actually Data Protection. Check NSFileProtectionKey before you destroy the file.

Model versioning is an identifier on the momd, not “we changed the Swift types.” If you edit the current version in place, users who were already on that version identifier have no mapping path. Always add a new model version.

SwiftData: VersionedSchema + SchemaMigrationPlan. CustomMigrationStage for backfills. Lightweight equivalent still cannot fill a required property from nothing.`,
      testing: `Unit-test: copy old.sqlite (and -wal/-shm if you ship them) from the test bundle into a temp directory, load with the new model, fetch a sample User, assert tier == "free". Repeat for vN-1 and vN-2 if you support staged jumps.

Launch test on a device with a large store. Measure wall time of loadPersistentStores off main. Assert the first frame is not blocked by that number.

Failure test: a deliberately broken mapping shows the recovery UI and does not crash. A disposable-cache test may destroy and recreate. A drafts test must not.

Never only test empty simulators. The empty path is lightweight by definition.`,
      pitfalls: `Changing the model and the code in one app version without adding a model version. Multiple coordinators on the same file. File protection locking the store at launch before unlock, then treating it as a corrupt store and deleting it. Silent try? that wipes drafts. Running performAndWait on the main context during launch. Testing only on a fresh install. Assuming SwiftData migrates itself because the types compile.`,
      alternatives: `Rebuild from the server if the store is a disposable cache — often true for feeds, false for drafts and offline messages. Two stores: a throwaway cache store and a user-data store, so a feed model change cannot take drafts down with it. That split is the real architecture, not Core Data versus SwiftData.`,
      tradeoffs: `Keeping the store disposable simplifies migrations and hurts any product that is useful on a plane. Chat cannot delete on failure. Feeds can. One store for everything is simpler until the first failed lightweight migration, at which point you discover you have coupled a cache to irreplaceable data. Off-main launch with a shell is more UI work and is the difference between an 8-second frozen splash and a crash. Mapping models are tedious and cheaper than Support telling people to reinstall.`,
      followups: [
        {
          q: 'Main-thread Core Data at launch?',
          a: 'View context on main, writes on a private context. perform, not performAndWait, on main at launch. loadPersistentStores on a background queue; hop back to attach the view context.',
        },
        {
          q: 'Could UserDefaults have held the same User.tier?',
          a: 'No. Size, types, and iCloud-backup surprises. UserDefaults is flags and tiny prefs. A user record belongs in the store, which is why the migration has to be real.',
        },
        {
          q: 'What do you tell Support instead of delete and reinstall?',
          a: 'A recovery screen that exports what it can, reports the failure, and only then offers a destructive reset. And a hotfix that makes tier optional so the next launch migrates.',
        },
        {
          q: 'Does SwiftData change the launch rule?',
          a: 'No. ModelContainer load can still block. Version the schema, migrate off the first frame, fail into UI, not into fatalError.',
        },
      ],
      teaches: [
        'Lightweight migration limits',
        'Expand / backfill / contract',
        'Launch I/O off main',
        'Store recovery vs destroy',
        'Disposable cache vs user data',
        'SwiftData versioning',
      ],
    },
    {
      id: 'd7-p2',
      title: 'Keychain item vanishes after an App Store update',
      difficulty: 'Expert',
      kind: 'Debug',
      prompt: `After updating from 4.2 to 4.3, 8% of users are logged out. Tokens were in Keychain. Access group and accessibility did not "change" in the PR. The team also turned on a new App Group for widgets. What do you inspect, how do you migrate, and how do you stop this next time?`,
      think: [
        'Did the Keychain access group or team ID actually change, even if the PR did not say so?',
        'What does a new App Group do to SecItemCopyMatching search lists?',
        'Could kSecAttrAccessible block reads before unlock and look like a missing item?',
        'Are you querying the group the old build wrote to, or the group the new entitlements imply?',
      ],
      solution: `Inspect, in this order: access group (explicit versus the default \`TEAMID.bundleId\`), the new App Group entitlement (\`TEAMID.group...\`), \`kSecAttrAccessible\` (AfterFirstUnlock versus WhenUnlocked versus ThisDeviceOnly), iCloud Keychain sync flag, and **which** group \`SecItemCopyMatching\` queries.

A new App Group does not move items. Code that started querying the group while old builds wrote to the default bundle group will “lose” tokens. The item is still on the device. You are looking in the next room.

Fix: a one-time migrator. Read old group, write new group, delete old. Query both during the transition so a crash mid-migrate does not lose the session. Do this on a background path at launch, not only when a 401 happens.

Also check data protection: \`kSecAttrAccessibleWhenUnlocked\` fails in a BGTask before first unlock and looks exactly like a vanishing token. Widgets starting at dawn hit this.

Tests on a device, not only the simulator. Simulator Keychain is a different animal.`,
      explanation: `Eight percent logged out after 4.3. Not one hundred, which is how you know this is not “we deleted the Keychain call.” Tokens were still in Keychain for the people who had been on 4.3’s entitlements from the start — fresh installs were fine. The eight percent were upgraders. The PR did not touch access group or accessibility strings, so the review bounced off those lines. What the PR did do was turn on an App Group so a widget could read the session. Someone then pointed SecItemCopyMatching at the group. Old items lived in the default access group, TEAMID.bundleId. The query asked for TEAMID.group.com.company.app. CopyMatching returned nil. The app treated nil as logged out, which is how an entitlement change becomes a support incident.

Keychain is namespaced. Item identity is account, service, access group, and accessibility. Seniors treat that tuple as a schema. An update that changes the schema without a migrator is the same class of bug as Core Data without a mapping model. The bytes are on disk. Your query is wrong.

The fix is boring and must be written once: read old, write new, delete old, query both until the numbers in analytics say the old group is empty. Do not “just write to the new group on next login” — that is the logout you are trying to prevent. And run a TestFlight upgrade, not a clean install, because clean install never had the old group.

WhenUnlocked versus AfterFirstUnlock is the other eight percent, on a different week. A widget or a BGTask that reads Keychain before first unlock gets errSecInteractionNotAllowed. If you log that as “no token,” you will think the update ate it.`,
      internals: `Default access group is \`TEAMID.bundleId\`. App Groups for Keychain sharing are \`TEAMID.group.bundle\`. Search without an explicit group may return the first match, which can be the wrong one after entitlements change. Two items with the same account and service in two groups is a real state during migration.

\`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly\` is the usual session choice: available to background refresh after unlock, not synced to iCloud, gone after restore onto a new phone. \`WhenUnlocked\` is how background launch looks like a missing item. \`AfterFirstUnlock\` without ThisDeviceOnly can sync via iCloud Keychain if you also set the sync flag — usually wrong for refresh tokens.

\`kSecUseDataProtectionKeychain\` exists because there is a legacy file-based Keychain on Mac and some Catalyst paths. Mismatch that flag between write and read and the item “vanishes” on one OS and not another.

SecItemCopyMatching is a query, not a filesystem path. Status codes matter: errSecItemNotFound versus errSecInteractionNotAllowed versus errSecAuthFailed. Logging “nil” collapses those into the original bug report.`,
      testing: `Install 4.2, log in, upgrade to 4.3 via TestFlight. Assert the session survives, the widget can read the token, and the old group is empty after the migrator runs. Repeat with the device locked and a BGTask scheduled — AfterFirstUnlock should succeed, WhenUnlocked should be a logged error, not a logout.

Unit-test the migrator against a fake store seeded with old keys. Crash it after write-new and before delete-old; restart; assert you still have a session and the migrator is idempotent.

Never only test a clean simulator install of 4.3.`,
      pitfalls: `kSecUseDataProtectionKeychain mismatches. Sharing tokens with an extension without a group, then adding a group later without a migrator. Logging Keychain errors as generic nil. Treating errSecInteractionNotAllowed as logged out. iCloud Keychain for refresh tokens. Querying without a group and taking the first match. Testing only on simulator. Migrating only on 401, so a user who does not hit the network stays in a half-migrated state.`,
      alternatives: `Keep writing to the original default group forever if the widget can be given that group. Sometimes the smallest change is the entitlement, not the query. If the widget only needs a “logged in?” flag, store that flag in the App Group container and leave the refresh token where it is. Simpler than migrating a secret.`,
      tradeoffs: `App Groups are required for real widget session sharing. Once you change the query, migration is mandatory. Device-only accessibility is the right default for refresh tokens and means a device restore is a logout — say that in the release notes. Querying both groups during transition is slightly more I/O and is what makes the migrator crash-safe. Clean-install testing is fast and will not catch this class of bug; upgrade testing is slower and is the actual test.`,
      followups: [
        {
          q: 'Should access tokens sync with iCloud Keychain?',
          a: 'Usually no. Device-bound session. Refresh tokens especially. A stolen iCloud account should not inherit the app session.',
        },
        {
          q: 'Why 8%, not 100%?',
          a: 'Fresh 4.3 installs wrote to the new group and were fine. Upgraders had items in the old group. The percentage is your upgrade population, plus anyone whose first launch after update was a locked BGTask if accessibility was wrong.',
        },
        {
          q: 'How do you stop this next time?',
          a: 'Treat access group and accessibility as a versioned schema. A changelog test that installs N-1 and upgrades. Analytics on Keychain status codes, not on “isLoggedIn == false”.',
        },
        {
          q: 'Can the widget use the same refresher actor?',
          a: 'Not the same process. Same Keychain item, same access group, a tiny refresher in the extension or a shared module. Two processes can still thundering-herd /refresh — single-flight is per process; the server must tolerate two.',
        },
      ],
      teaches: [
        'Keychain access groups',
        'App Group entitlements',
        'Accessibility classes',
        'Item identity as schema',
        'Upgrade-path testing',
        'errSecInteractionNotAllowed vs missing',
      ],
    },
    {
      id: 'd7-p3',
      title: 'JWT in UserDefaults, screenshot in a support ticket',
      difficulty: 'Expert',
      kind: 'Incident',
      prompt: `Support forwards a screenshot of Settings → your app. The user had attached a sysdiagnose. In the photo, a debug screen dumped \`UserDefaults.standard.dictionaryRepresentation()\`. Sitting there in plaintext: a JWT access token, a refresh token, and an email. The ticket is public to a contractor. Product asks how bad this is and what you ship this week.

The code writes tokens in \`application(_:didFinishLaunching)\` because “Keychain was flaky in development.” A widget reads the same suite. Crash logs include \`UserDefaults\` dumps from a helper. What do you rotate, where should tokens live, and how do you stop the next leak?`,
      think: [
        'Is a JWT in UserDefaults a secret at rest, a backup problem, an extension problem, or all three?',
        'Who else can read the app’s defaults — backup, MDM, screenshots, log pipelines?',
        'Do you rotate the refresh token on the server this week, or just move the key?',
        'What is the migration for users who already have tokens in defaults?',
      ],
      solution: `Treat this as a credential leak, not a code-style nit.

This week: server-side revoke and rotate refresh tokens for the affected population (everyone, if you cannot prove the screenshot set). Invalidate the JWTs. Ask the contractor to delete the ticket attachment. Assume copies exist.

On device: tokens live in Keychain, this-device, AfterFirstUnlockThisDeviceOnly unless a widget genuinely needs them — then an App Group Keychain, not an App Group UserDefaults suite. UserDefaults is for flags, not secrets. The debug screen that dumped dictionaryRepresentation() is removed from production builds, not gated by a boolean you will forget.

Migrator: if defaults still has the keys, write Keychain, delete the defaults keys, then rotate anyway because those values may already have been backed up to iCloud or a laptop.

Logs: never print Authorization headers, never dump defaults, never attach tokens to Crashlytics keys. Review the widget, the share extension, and any App Group plist.

The “Keychain was flaky” comment is almost always a missing accessibility class or a simulator quirk. Fix that. Do not route around it with defaults.`,
      explanation: `The screenshot was the incident, but it was not the start of the leak. UserDefaults is a plist. It is included in unencrypted laptop backups, in many MDM reads, in sysdiagnoses, in that debug screen, and in every \`po UserDefaults.standard.dictionaryRepresentation()\` a developer has ever dropped into a ticket. A JWT in there is a secret sitting in a file that was designed to be convenient. Support did what we trained them to do — attach the screen — and now a contractor has a refresh token. Product asked how bad this is. It is “assume the refresh token is stolen, rotate everyone we cannot bound, and stop writing secrets to a plist.”

People put tokens in defaults because Keychain error handling is ugly and the simulator is weird. That is an engineering smell, not a justification. Keychain with a real status-code log would have shown errSecInteractionNotAllowed or a group mismatch. Defaults showed nothing, until it showed everything.

The widget reading the same suite is the second copy. App Group UserDefaults is still a plist, now in a shared container that extensions and sometimes other processes can see. If the widget needs a session, it needs the Keychain access group from problem 2, not a shared defaults key named token.

Rotation is the part juniors skip. Moving the key on the next launch does not un-copy the screenshot. The server must treat those refresh tokens as compromised. Then you migrate, then you delete the old keys, then you add a test that greps the defaults suite for token-shaped values in debug builds so this cannot quietly return.`,
      internals: `UserDefaults is NSUserDefaults over a plist in the app’s Library. iCloud backup includes it unless you exclude the file, which you generally cannot surgically do per-key. The suiteName App Group container is another plist. Neither has access-control lists comparable to Keychain’s ACL and data protection class.

A JWT access token is a bearer capability. Anyone who holds it is the user until it expires. A refresh token is worse: it mints more access tokens. Putting either in defaults means every backup, every support screenshot of a debug screen, every log pipeline that dumps dictionaryRepresentation, is an exfiltration path.

Keychain items can be ThisDeviceOnly, which excludes them from backup. That is the point. Accessibility AfterFirstUnlockThisDeviceOnly is the usual session choice. Biometric ACL if the threat model says the phone unlocking is not enough.

Crash reporters will ship whatever you put in custom keys. A helper that copies defaults into Crashlytics is a second leak on every crash.`,
      testing: `A unit test that, after login, asserts UserDefaults (standard and any suiteName) does not contain token-shaped keys. A migrator test: seed defaults with a token, run launch, assert Keychain has it and defaults does not. A backup test on a device: encrypt backup, inspect that the token is not in the plist.

Do not log the token to prove it moved. Assert SecItemCopyMatching status and a boolean hasRefreshToken.

A debug-screen test: Release compile must not include dictionaryRepresentation dumps. #if DEBUG is the floor, a whole debug menu compiled out is better.`,
      pitfalls: `Moving to Keychain but leaving the defaults key “for one release.” Logging the JWT “one last time” in the migrator. Using App Group UserDefaults for the widget because Keychain sharing felt hard. Storing only the access token in Keychain and leaving the refresh token in defaults. Rotating on device without revoking on the server. Assuming a screenshot of Settings is safe because the token is off-screen — the sysdiagnose still has the plist.`,
      alternatives: `If the product cannot use Keychain for some enterprise-MDM reason, that is an explicit threat-model document, not a silent defaults write. A memory-only access token plus Keychain refresh token is a reasonable split. Encrypting a blob in defaults with a Keychain key is extra moving parts for no gain — just use Keychain.`,
      tradeoffs: `Keychain is more code and more status codes than \`set(_:forKey:)\`. That cost is the cost of not emailing refresh tokens to contractors. ThisDeviceOnly means a device restore is a logout; say so. Compiling the debug menu out of Release loses a support tool and closes the screenshot path — give Support a safer, redacted diagnostics screen if they still need one. Rotating everyone is painful for users who must log in again and is the honest response to an unbounded leak.`,
      followups: [
        {
          q: 'Is an expired access token in defaults still a problem?',
          a: 'Less than a live refresh token, still a problem. It is a capability until it expires, it teaches the next engineer that defaults is fine, and it may sit next to the refresh token in the same plist.',
        },
        {
          q: 'What do you tell the user who filed the ticket?',
          a: 'We treated it as a leaked credential, rotated the session, and the next update stores nothing in that screen. Do not ask them to “just log out.”',
        },
        {
          q: 'Can Analytics SDKs pick this up?',
          a: 'Yes, if they snapshot defaults or if you ever put the token in an event property. Audit the SDK. This is how leaks leave the device without a screenshot.',
        },
        {
          q: 'Where does the email belong?',
          a: 'Not next to the token. Profile payload from the API, in the user store, not in defaults. PII in defaults is a smaller version of the same incident.',
        },
      ],
      teaches: [
        'Secrets vs UserDefaults',
        'Keychain as the token store',
        'Credential rotation after leak',
        'App Group plists are still plists',
        'Debug surfaces as exfiltration',
        'Backup and ThisDeviceOnly',
      ],
    },
    {
      id: 'd7-p4',
      title: 'Offline like: cached feed says yes, server returns 409',
      difficulty: 'Senior',
      kind: 'Incident',
      prompt: `Offline mode shows a cached feed. The user likes a post. The like is queued, the heart fills (optimistic). When they reconnect, POST /like returns 409 Conflict — the post was deleted, or they had already liked it from another device, or the snapshot is stale. The queue retries, the heart stays filled, the cache still has the post, and a later GET /feed omits it. Design conflict handling so the cache, the queue, and the heart agree, without a retry storm.`,
      think: [
        'What is the source of truth for “is this liked” after a 409?',
        'Is a 409 retryable the way a 503 is?',
        'Does the local feed row survive if GET later omits the post?',
        'Where does optimistic UI roll back, and what does the user see?',
      ],
      solution: `409 is a conflict, not a timeout. Do not retry it. Do not send it through the Day 6 backoff loop.

Model the like as a mutation with a client id and a state: pending, confirmed, failed. Optimistic fill sets pending. The send queue posts once with an idempotency key. On 200, confirmed. On 409, failed — and then you reconcile:

* If the error body says already liked: confirmed, keep the heart, drop the queue item. You were right about the like, wrong about being first.
* If the error body says deleted / gone: remove the row from the cache, rollback the heart (it is gone), drop the queue item, optional toast.
* If the body is opaque: fetch that item (or a tiny GET /posts/:id). Apply the server row. If 404, delete locally. If 200 with liked=true, confirm. If 200 with liked=false, rollback.

The cache is a replica, not the truth. A later GET /feed is a snapshot merge: by id, server wins on fields you did not mutate; pending local mutations win until they fail. Do not append a liked row that the server omitted and also keep retrying the like.

Show the user something on rollback. A heart that silently empties is better than a heart that lies, but a one-line “this post is no longer available” is what stops the one-star review.`,
      explanation: `The user was on the train. The feed was yesterday’s cache, which is exactly what we promised in the brownout incident. They liked a post. We filled the heart because optimistic UI is how offline feels fast. The queue sat until the tunnel came back, then POST /like hit 409. The retry policy from the HTTP client treated 409 like a maybe, or did not classify it at all and retried with backoff. The heart stayed full because pending was still pending. The cache still had the row because nothing told it to delete. The next GET /feed did not include the post — deleted on the server — so now the UI had a liked ghost that could not be unliked, sitting above a feed that had moved on. That ghost is the incident.

Optimistic UI is a bet. 409 is the bet resolving against you. The classification of HTTP statuses on Day 6 was not complete if it only knew “retry” and “do not retry.” Conflict means stop, reconcile, mutate the replica. The send queue is not a firehose; it is a state machine per mutation. Idempotency keys stop a double like when the 409 was actually “already liked” after a timeout that had committed. They do not make a deleted post likeable.

I would merge by identity. Server snapshots replace rows that have no pending mutation. Pending mutations sit on top until they confirm or fail. A fail that means gone removes the row. A fail that means already liked confirms. Everything else is a fetch of that one item, not a full refresh that resets the cursor while page 3 is in flight — you already paid for that bug on Day 6.

The user-facing part is not optional. Offline mode without conflict UI is a cache that gaslights. A toast and a rollback is senior. A retry loop is how you DDoS your own like endpoint with ghosts.`,
      internals: `POST /like should be idempotent on (user, post) or on an Idempotency-Key header. 409 bodies should be coded: already_liked, deleted, gone, precondition_failed. An empty 409 is hostile; the client then must GET.

Queue: durable (SwiftData / Core Data), one worker, per-item state. Not UserDefaults. Not in-memory only, or airplane mode loses the like, which is the opposite product bug.

Merge: items keyed by post id. Tombstones for deleted ids so a stale cache page cannot resurrect a row the user just watched disappear. Tombstones expire.

Optimistic UI writes the replica first, then the queue. Rollback is a replica write too. The heart is a projection of the replica, not a separate bool on the view.

Do not share the feed GET retry circuit with the mutation queue. A 409 must not open the GET breaker, and a GET brownout must not stop you from marking a like failed.`,
      testing: `Seed a cache with post A. Queue a like. Fake POST 409 deleted. Assert: queue empty, A gone from cache, heart not filled, one toast. Second: 409 already_liked — A remains, heart filled, no retry. Third: 409 opaque then GET 404 — same as deleted. Fourth: timeout then 200 on retry with the same idempotency key — one like on the fake server. Fifth: GET /feed omits A while a like is pending — A stays until the like resolves, then the 409 path runs; do not hide pending rows just because the snapshot omitted them, or you will lose the mutation.`,
      pitfalls: `Retrying 409 with exponential backoff. Keeping optimistic state in the view only, so a later GET overwrites the heart and then the queue fires again. No tombstones, so a stale page 2 reintroduces a deleted post. Using Day 6’s refresh generation to drop a like response. Storing the queue in UserDefaults. Showing nothing on rollback. Treating 409 as logout.`,
      alternatives: `CRDTs for likes are overkill; a like is a boolean with a server. Full refetch of the feed on every reconnect is simple and resets cursors (Day 6) and feels like a flash. Per-item GET on conflict is the middle path. If the backend can return 410 Gone with a body, prefer that over a generic 409.`,
      tradeoffs: `Optimistic UI plus a durable queue is more state and is the product. Pessimistic likes (spinner until 200) are easier and make offline mode feel broken. Tombstones cost storage and save resurrection bugs. Merging snapshots with pending mutations is the hard part; blowing away the cache on reconnect is easy and throws away the like the user thought they sent. Server error codes are a contract; opaque 409s push complexity onto every client.`,
      followups: [
        {
          q: 'What if POST times out and the like actually committed?',
          a: 'Idempotency key. Retry once. 200 or 409 already_liked both confirm. Without a key you poll GET /posts/:id rather than POST again.',
        },
        {
          q: 'Does this apply to comments and drafts?',
          a: 'Drafts are user data (problem 5) and 409 on publish is a merge conflict in text, not a boolean. Do not reuse the like state machine blindly. Same queue infrastructure, different reconcile.',
        },
        {
          q: 'Where does the Day 6 stale-while-revalidate banner fit?',
          a: 'Stale-while-revalidate banner is “you are looking at cache.” Conflict toast is “this action failed.” Do not combine them into one yellow strip that means nothing.',
        },
        {
          q: 'Should the widget show the optimistic heart?',
          a: 'Only if it reads the same replica. If it reads a GET snapshot, it will disagree until reconnect. Shared store or no widget heart.',
        },
      ],
      teaches: [
        '409 is not retryable',
        'Optimistic UI plus rollback',
        'Durable mutation queue',
        'Replica vs server snapshot',
        'Tombstones',
        'Idempotency on like',
      ],
    },
    {
      id: 'd7-p5',
      title: 'SwiftData versus Core Data: drafts versus a disposable feed cache',
      difficulty: 'Expert',
      kind: 'Judgment',
      prompt: `New app. Two persistence needs: (1) composer drafts and offline outgoing messages that must survive upgrades and failed migrations, (2) a feed cache you are willing to throw away. A teammate wants SwiftData for everything because it is “the future.” Another wants Core Data for everything because SwiftData migrations are “immature.” A third wants one store so fetches can join posts to drafts.

Pick. Include versioned schemas, what happens when a migration fails, and whether the feed cache is allowed to share a container with drafts.`,
      think: [
        'What is destroyed if load fails, and is that a product incident or a cache miss?',
        'Do you need a join between drafts and feed rows, or is that a convenience that couples their lifetimes?',
        'What does a versioned schema look like in each stack, and who on the team can write a mapping model?',
        'Is “SwiftData is the future” a migration strategy?',
      ],
      solution: `Two stores. Not because of the framework, because of lifetime.

**Drafts / outgoing:** user data. Core Data or SwiftData, your team’s fluency wins, but it gets a versioned schema, mapping tests, a recovery UI, and never a silent destroy. If the team already has Core Data scars and mapping-model muscle, use Core Data here. If you are greenfield and the schema is simple, SwiftData with \`VersionedSchema\` + \`SchemaMigrationPlan\` is fine. Additive changes only in the first year unless you have CI fixtures.

**Feed cache:** disposable. A file of JSON, a tiny SwiftData container with a destroy-on-failure load, or even URLCache plus a cursor blob. When the model changes, delete the cache store and refetch. Do not run a mapping model for a feed you can get again.

**Never one container** that joins posts to drafts. A failed lightweight migration on \`Post.tier\` (problem 1) must not take drafts with it. Joins are a convenience; process boundaries and failure domains are the architecture.

Versioning: add a new schema version every ship that changes the model. Do not edit the current version in place. Test N-1 → N on a fixture that includes a real draft.

Failure: drafts path shows recovery. Cache path logs, deletes, continues. Support never hears about the cache.`,
      explanation: `The argument in the room was about nouns. SwiftData versus Core Data. The incident you are trying to avoid is problem 1 happening to a journalist’s unsent thread because someone added a non-optional field to a feed entity in the same container. That is not a framework question. That is a failure-domain question. The feed cache is a performance optimisation you are allowed to set on fire. Drafts are the product. If those share a SQLite file, they share a migration, a lock, and a loadPersistentStores / ModelContainer failure. You already know how that crash looks at launch.

I would let the team pick the framework for drafts based on who has to write the next mapping. SwiftData’s versioned schemas are the right idea and they still cannot fill a required property from nothing. Core Data’s lightweight limits are the same limits. Immature versus future is a blog post. The senior move is: version the schema, test the upgrade, fail into UI. You can do that in either stack. You cannot do it if nobody owns the migration.

The feed cache should be boring. JSON in Caches, blown away on model change, stale-while-revalidate from Day 6, cursor stored next to the blob from Day 6. If you want objects, give it its own container with destroy-on-failure. That destroy is a feature. Putting destroy-on-failure on a combined store is how Support says delete and reinstall.

Joining drafts to posts in one fetch is a nice demo. It couples two lifetimes so you can skip an id lookup. Skip the join. Keep the post id on the draft. You will thank yourself the week the feed schema changes and drafts do not.`,
      internals: `SwiftData: \`VersionedSchema\`, \`SchemaMigrationPlan\`, \`LightweightMigrationStage\`, \`CustomMigrationStage\`. ModelContainer configuration points at a file URL. Two containers, two URLs. @Model types from two containers do not magically join.

Core Data: momd versions, mapping models, NSMigratePersistentStoresAutomaticallyOption, inferred mapping. Two NSPersistentContainer instances, two files. A shared app group if a composer extension must write drafts — that is a reason for a dedicated drafts store, not a reason to merge the feed.

WAL: each store has its own -wal. Backup exclusion: cache store goes in Caches and is excluded. Drafts go in Application Support and are backed up, unless you have a privacy reason not to.

Destroy-on-failure for cache: delete the file (and wal/shm), recreate, refetch. For drafts: never that path without an export.

UserDefaults is still not a draft store. Problem 3.`,
      testing: `Drafts: fixture of v1 store with an unsent message, migrate to v2, assert body intact. A deliberate failed mapping shows recovery UI and does not delete the file in the test.

Cache: change the cache model, launch, assert the old file is gone and the feed refetches. Crash the cache load, assert drafts still load.

Cross-store: compose a draft with a post id that is not in the cache; assert you do not need the feed store to save the draft.

Upgrade test on a device, not only a simulator, for the drafts file.`,
      pitfalls: `One container for convenience. Editing the current SwiftData schema in place. Silent destroy of the combined store. Using SwiftData for the feed and then adding a non-optional relationship to Draft so they have to live together. Putting the cache in Application Support so iCloud backup grows forever. Assuming SwiftData will migrate because the code compiled. Rebuilding drafts from the server — there is no server copy, that is what draft means.`,
      alternatives: `GRDB or raw SQLite if the team is fluent and you want explicit migrations as SQL. Files on disk for drafts (one JSON per draft) plus a cache blob — no ORM, very obvious failure domains, you write your own indexer. Realm if it is already in the app; do not add it for this. The third teammate’s join can be a small in-memory zip by id after two fetches.`,
      tradeoffs: `Two stores is more plumbing (two loads, two failure paths) and is the correct isolation. One framework for both is less cognitive load if the cache is also SwiftData/Core Data, still two files. SwiftData is faster to write and younger in the migration stories you will actually hit; Core Data has twenty years of Stack Overflow for mapping models. Fluency can outweigh novelty for drafts. Novelty is fine for a disposable cache because you can throw it away. “The future” is not a failure mode.`,
      followups: [
        {
          q: 'When would you put them in one store?',
          a: 'If the feed is not disposable — e.g. a medical record the server may not re-send. Then it is user data, versioned, recovered, and you still might split by failure domain. Not because a join is nice.',
        },
        {
          q: 'Does the composer extension change the answer?',
          a: 'It forces an App Group on the drafts store. Still not a reason to put the feed cache in that group. Extensions should not load a 200 MB feed to share a container.',
        },
        {
          q: 'SwiftData for drafts, JSON for cache — is that inconsistent?',
          a: 'It is consistent with lifetime. Inconsistency of frameworks is cheaper than consistency of failure.',
        },
        {
          q: 'How does this interact with the launch crash in problem 1?',
          a: 'That crash is what you are designing away for drafts, and accepting as a cache miss for the feed. Split stores make “fail safe” two different functions.',
        },
      ],
      teaches: [
        'Failure domains over framework brand',
        'Disposable cache vs user data',
        'Versioned schemas',
        'Two containers, two files',
        'Destroy-on-failure is a cache feature',
        'Migration tests on fixtures',
      ],
    },
    {
      id: 'd7-p6',
      title: 'UserDefaults, Keychain, or a file: where does this actually live?',
      difficulty: 'Senior',
      kind: 'Judgment',
      prompt: `A new engineer asks, for each of these, where it belongs, and why:

1. Refresh token
2. “Has seen onboarding” flag
3. Feed JSON cache (2–20 MB)
4. Composer draft with images
5. Analytics install id
6. Feature-flag defaults for airplane mode
7. Session cookie from a web checkout

They currently put (1)(5)(7) in \`UserDefaults\`, (3)(4) in Documents (backed up to iCloud), and (2) in a file in tmp. Product also wants the session to roam to a new phone via iCloud Keychain. Support wants backups that do not include the feed.

Pick a home for each. Include backup, ThisDeviceOnly, App Groups, and what you exclude from iCloud backup.`,
      think: [
        'Is this a secret, a preference, user data, or a cache?',
        'Does a device restore / new phone / laptop backup get a copy?',
        'Can an extension read it, and is that a plist or a Keychain group?',
        'What happens if the file is evicted (Caches) versus if iCloud backups it (Documents)?',
      ],
      solution: `Sort by **lifetime and sensitivity**, not by which API you typed first.

| Thing | Home | Backup |
| --- | --- | --- |
| refresh token | Keychain, AfterFirstUnlockThisDeviceOnly, not iCloud Keychain unless product truly wants a roaming session — and then still not UserDefaults | excluded (ThisDeviceOnly) |
| onboarding flag | UserDefaults | yes, fine |
| feed JSON | file in Caches, or a disposable store (problem 5) | exclude; Caches is already not backed up |
| drafts + images | Application Support, user-data store, backed up; images as files next to it, not in the SQL | yes |
| analytics install id | Keychain or a file you control; **not** UserDefaults if it is used as a quasi-auth identifier | usually device-bound |
| flag defaults | in-process catalog (Day 5), optional UserDefaults *overrides* for QA | n/a |
| web session cookie | HTTPCookieStore / WK website data / Keychain, never defaults | device policy |

**UserDefaults:** tiny prefs, flags, last tab. Plist, backed up, dumped in sysdiagnoses (problem 3). Not secrets, not megabytes.

**Keychain:** secrets and stable device ids you cannot afford to leak. Access group if a widget needs them (problem 2). iCloud Keychain (the sync flag) is a **product** decision for refresh tokens: a stolen iCloud account inherits the app session. Default is no.

**Files:** Caches for disposable; Application Support for user data; tmp for true scratch (onboarding-in-tmp was a bug — tmp dies). Exclude Caches from backup explicitly if you ever put them in Documents by mistake (\`URLResourceValues.isExcludedFromBackup\`).

Do not invent “encrypted blob in defaults with a Keychain key.” That is Keychain with extra steps.`,
      explanation: `The question looks like trivia. It is the architecture of loss. A refresh token in defaults is problem 3. A feed in Documents is a 2 GB iCloud backup and a restore that pretends a cache is user data. Drafts in tmp vanish when the OS is hungry, which is how you lose a journalist’s thread without a migration crash. iCloud Keychain for the session is a roaming login that Support will call a feature and Security will call a stolen-Apple-ID incident. None of these are compiler errors. They are homes.

Seniors keep a boring map. Secrets: Keychain, device-bound unless product writes the opposite in a threat model, not in a Slack shrug. Preferences: defaults, small, public, backup-friendly. User data: a store you version (problems 1 and 5), in Application Support, recovered on failure. Caches: Caches directory or a destroyable store, excluded from backup, fine to delete on model change. Extensions: App Group for the *minimum* — a flag in the group container, the refresh token in the group Keychain if the widget must call the API, not a second copy of the feed.

The install id in defaults is how analytics SDKs accidentally become auth. If a support tool or a “login with this id” path ever grows, you have a secret in a plist again. Put it in Keychain or treat it as public and rotatable.

I would write this map in the handbook and in a unit test that greps defaults for token-shaped keys (problem 3). Architecture that lives only in a senior’s head is how the new engineer copies \`set(_:forKey: "token")\` from a 2019 gist.`,
      internals: `UserDefaults: plist in Library/Preferences, included in unencrypted computer backups unless the whole app is excluded. SuiteName in an App Group is another plist in the shared container. No ACL.

Keychain: item identity is account + service + access group + accessibility. \`kSecAttrSynchronizable\` is iCloud Keychain. \`ThisDeviceOnly\` excludes backup and sync. Widgets need the group; they do not need sync.

Files: NSFileProtection, iCloud backup flags, WAL siblings next to sqlite (problem 8). Documents is user-visible on iTunes File Sharing; Application Support is not. Caches may be evicted under space pressure — do not put drafts there.

WKWebsiteDataStore holds cookies for web checkout. Copying them into defaults to “share with native” is problem 3 in a browser costume.`,
      testing: `A matrix test, even as a doc test: after login, defaults has no token-shaped keys; Caches has the feed file; Application Support has a draft; Keychain has the refresh item with the expected accessibility. A backup simulator (or a checklist on device): restore onto a new phone, session is gone if ThisDeviceOnly, drafts are present, feed refetches.

Exclude-from-backup: set the flag on any large file you accidentally put in Documents, assert the resource value.

Do not log the token to prove the map.`,
      pitfalls: `iCloud Keychain “on” because the checkbox was next to accessibility. Feed in Documents. Drafts in Caches or tmp. Cookies in defaults. Analytics id as a login. App Group defaults for the refresh token because Keychain sharing felt hard. Encrypting defaults instead of using Keychain. Assuming Caches is never evicted.`,
      alternatives: `A single SwiftData container with “isCache” on entities — still one file, still problem 5. Two files. App Group container for drafts if a share extension composes; still not for the feed. Keychain wrapper library — fine, still set accessibility and group explicitly.`,
      tradeoffs: `ThisDeviceOnly: restore is a logout, say so in release notes, correct for refresh tokens. iCloud Keychain: magic roaming, stolen Apple ID is a session. Caches eviction: free disk, surprise refetch, never for drafts. Defaults for flags: one line, sysdiagnose leakage if you get sloppy. The map is the tradeoff table. Skipping it is how all seven items land in defaults.`,
      followups: [
        {
          q: 'Should access tokens sync with iCloud Keychain?',
          a: 'Usually no. Device-bound session. Refresh tokens especially. Problem 2’s follow-up still holds. If product wants roaming login, document the Apple-ID threat and still keep them out of defaults.',
        },
        {
          q: 'Where does the checkout idempotency key live?',
          a: 'Next to the draft order in the user-data store (Day 6 problem 5), not in defaults, not in memory only. It must survive process death.',
        },
        {
          q: 'Widget only needs “logged in?”',
          a: 'A boolean in the App Group container or a Keychain item that is not the refresh token. Do not share the secret to paint a checkmark.',
        },
        {
          q: 'Can the feed cache be UserDefaults if it is “just page 1”?',
          a: 'No. Size, types, iCloud backup, sysdiagnose. A file in Caches. Page 1 is still a cache.',
        },
      ],
      teaches: [
        'Homes by sensitivity and lifetime',
        'UserDefaults is prefs, not secrets or megabytes',
        'Keychain ThisDeviceOnly vs iCloud sync',
        'Caches versus Application Support',
        'Exclude backup on disposable files',
        'App Groups share the minimum',
      ],
    },
    {
      id: 'd7-p7',
      title: 'CloudKit for drafts, or your own backend?',
      difficulty: 'Expert',
      kind: 'Judgment',
      prompt: `Product wants composer drafts and a simple notes list to “just sync” across the user’s iPhone, iPad, and a future Mac. A teammate reaches for CloudKit (\`NSPersistentCloudKitContainer\` / SwiftData + CloudKit). Another wants to POST drafts to the API you already run for the feed. A third says iCloud Drive files.

The team is four iOS engineers, no extra backend headcount this quarter. The feed and auth already exist on your servers. Legal asks about data residency. What do you pick, what do you refuse to put in CloudKit, and how do conflict merges relate to problem 4’s 409?`,
      think: [
        'Whose identity is the source of truth — iCloud account or your app account?',
        'What happens when the user is logged into the app but not into iCloud, or the reverse?',
        'Is a draft something your support team must retrieve, or is it device-private until publish?',
        'Can NSPersistentCloudKitContainer share a store with the disposable feed cache (problem 5)?',
      ],
      solution: `**Drafts that are only drafts** (not yet your product’s content, not federated with Android, not needed by Support): CloudKit or a CloudKit-backed Core Data / SwiftData store is the 4-person answer. You do not have backend headcount to build sync. Apple’s identity is the sync identity.

**Anything that is already a row on your API** (published posts, likes, checkout orders): your backend. CloudKit will not make a 409 from POST /like go away. Dual-writing a published post to CloudKit and to your API is how you get two truths.

**Refuse in CloudKit:** refresh tokens, payment receipts, the feed cache, anything that must exist for an Android client or a web user who never touched iCloud. Data-residency-sensitive user content if Legal says EU cannot sit in Apple’s container without a review.

Identity split: if the app account ≠ iCloud account, CloudKit syncs to the Apple ID, not to your user. A family iPad with one iCloud and four app logins is a leak. Either require the same Apple ID, or do not use CloudKit for that data.

Conflicts: CloudKit’s merge is last-writer or a custom merge policy on the store. It is not HTTP 409. Do not reuse problem 4’s like state machine blindly. For text drafts, a conflict UI (two versions) is honest; silent last-writer is how a paragraph dies.

Never put CloudKit on the feed cache container. Problem 5 still holds. Two stores: drafts (maybe CloudKit) and cache (local, destroyable).`,
      explanation: `“Just sync” is how CloudKit ends up in the feed stack. The feed already has a server, an auth token, pagination, and 409s. Putting that in CloudKit means you now have two backends, two identities, and a merge policy you did not staff. The teammate who wants to POST drafts to the API is right *the moment a draft is your product on Android, on the web, or in Support’s tooling*. Until then, a CloudKit-backed drafts store is how four iOS engineers ship iPad+iPhone without a sync team.

The identity mismatch is the incident I have actually seen. User logs into the app as work, iCloud is personal, notes sync to a spouse’s iPad that is signed into the same Apple ID. Or the reverse: they buy a new phone, restore iCloud, and expect drafts, but they used ThisDeviceOnly Keychain for session and a CloudKit store they never opened because they declined iCloud. You must say in UI whether drafts follow Apple ID or app account.

iCloud Drive files are a third home: user-visible, merge-hostile, fine for “export a zip,” wrong as the live composer database.

I would not CloudKit the likes queue. That queue is a replica of *your* API. It already has 409. Adding CKRecord would not reconcile already_liked.`,
      internals: `NSPersistentCloudKitContainer: Core Data store + CloudKit mirroring. Needs iCloud capability, a container id, and a model that avoids unsupported types. History tracking on. Same WAL/file-protection launch issues as problem 8, plus “CloudKit not available.”

SwiftData + CloudKit: similar mirroring, younger edges. Still a second store from the feed.

CKRecord merge: change tags, \`serverRecordChanged\`. Custom \`NSMergePolicy\`. This is not your HTTP error map from Day 6.

Auth: CloudKit uses the Apple ID. Your API uses the Day 6 refresher. Do not put the refresh token in a CKRecord.

Backup: CloudKit is the sync; local store still exists. Destroy-on-failure of a CloudKit-backed drafts store is how you delete the user’s other devices’ copies after a bad migration. Recovery UI, not silent destroy.`,
      testing: `Two simulators, one iCloud test account: create a draft on A, appear on B. Conflict: edit both offline, online, assert you either merged or showed two versions — never silently dropped. App login as user 2 on the same iCloud: assert drafts do not leak, or assert you block the feature.

Failure: CloudKit quota / airplane: drafts still save locally (problem 5). Publish path still hits *your* API, not CloudKit.

Do not test CloudKit only on one device.`,
      pitfalls: `One container for feed + CloudKit drafts. Silent destroy of a mirrored store. Syncing the refresh token. Assuming Android will “just” read CloudKit. Using iCloud Keychain + CloudKit and thinking they are the same switch. Merge policy that last-writes a 2 000-word draft. Requiring iCloud for a feature that is actually your API’s object.`,
      alternatives: `Your API with a drafts endpoint if Android/web/Support need it — worth backend time then. Local only until publish, no sync — honest v1 for a phone-only composer. iCloud Drive export as a button, not as the database. CRDTs for text if you are a notes company; you are not, this quarter.`,
      tradeoffs: `CloudKit: fast for Apple-only, identity mismatch, Legal/residency, no Android. Own API: one identity, staff cost, you already know 409. Dual-write: worst of both. Local-only: no iPad story, no merge bugs. Pick from product scope, not from the WWDC session.`,
      followups: [
        {
          q: 'Can checkout orders live in CloudKit “until the API is ready”?',
          a: 'No. Money has an idempotency key on your server (Day 6). A CKRecord is not a charge.',
        },
        {
          q: 'Share extension composes a draft. CloudKit or App Group?',
          a: 'App Group local store first so the extension can save without a network. CloudKit mirrors when the app runs. The extension should not be the CloudKit client if you can avoid it.',
        },
        {
          q: 'How does this interact with problem 1’s migration?',
          a: 'A CloudKit-backed model change is a local migration *and* a schema the mirror must accept. Test N-1 → N with CloudKit history, not only a local sqlite fixture.',
        },
        {
          q: 'User signs out of the app. Do drafts vanish?',
          a: 'App-account drafts: yes or export first. CloudKit drafts: they follow Apple ID, so sign-out of *your* app may leave them for the next app login on that iCloud — which is the leak. Decide, then wipe or keep explicitly.',
        },
      ],
      teaches: [
        'CloudKit for Apple-only drafts, not for your API’s rows',
        'App account vs Apple ID is a leak surface',
        'Do not CloudKit the feed cache',
        'Text conflicts are not like-409',
        'Silent destroy of a mirrored store is catastrophic',
        'No dual-write of published content',
      ],
    },
    {
      id: 'd7-p8',
      title: 'WAL, file protection, and a launch that looks like a bad migration',
      difficulty: 'Expert',
      kind: 'Incident',
      prompt: `A slice of users crash in \`loadPersistentStores\` on first launch after reboot, before first unlock. Another slice “lose” the last hour of drafts after a kill. Support files both as problem 1 (migration). The store URL points at a file in Application Support. You did not change the model this week. Crash logs show \`NSCocoaErrorDomain 257\` or a SQLite busy/corrupt, and some devices recover after a second launch.

Inspect protection class, WAL sidecars, and who copied the store. How do you fail safe at launch without deleting drafts, and how do you stop treating every load error as “wipe and migrate”?`,
      think: [
        'Is the file readable before first unlock with the protection class you actually set?',
        'If someone copied only the .sqlite and not -wal/-shm, what does SQLite open as?',
        'Is loadPersistentStores on main at launch, and does a lock look like a hang?',
        'When is destroy-on-failure allowed (problem 5), and when is it this incident’s body count?',
      ],
      solution: `Two different incidents, one Support bucket.

**Before first unlock:** \`NSFileProtectionComplete\` or Keychain \`WhenUnlocked\` on a store you load in \`didFinishLaunching\` will fail. Use \`CompleteUntilFirstUserAuthentication\` (AfterFirstUnlock) for a store the app must open at boot / in a BGTask. Do not destroy the file on 257. Show a waiting path or delay load until \`protectedDataAvailable\`. Observe \`UIApplication.protectedDataDidBecomeAvailableNotification\`.

**WAL:** SQLite with WAL has \`foo.sqlite\`, \`foo.sqlite-wal\`, \`foo.sqlite-shm\`. A migrator, a backup, or an “export store” that copies only the first file is a corruption generator. Checkpoint or copy all three. Never delete -wal to “unstick” a user with drafts in it.

**Launch:** load off main (problem 1). If load fails, classify: protection (retry after unlock), locked/busy (retry, do not wipe), true corrupt (recovery UI, export, then maybe destroy). Logging “migration failed” for all three is how this ticket was misnamed.

Do not run two coordinators on the same file at launch (extension + app). That busy looks like a hang. Shared App Group store: one coordinator per process, file coordination, expect busy, retry; do not wipe.`,
      explanation: `The model version did not change. The bytes were unreadable, or they were the wrong set of files. File protection is Data Protection: Complete means the keys are not there until the user unlocks. A crash in loadPersistentStores at first boot is often that, not a lightweight mapping failure. The second launch works because they unlocked. Support’s “delete and reinstall” then destroys drafts that were never corrupt. That is the same moral failure as problem 1’s silent try?, aimed at the wrong diagnosis.

WAL is the other slice. The last hour of writes lived in the -wal file. A “fix” that replaced the sqlite file from an old backup, or a share-sheet export that grabbed one file, or a naïve migrate-by-copy, dropped the WAL. SQLite opens, looks fine, is missing the tail. Or it looks corrupt. Either way, deleting sidecars to clear a lock is how you finish the job.

I would treat store-open errors as a taxonomy, not a boolean. Protection: wait. Busy: wait and log the other process. Corrupt: recover. Schema: problem 1’s mapping. The first frame still does not wait eight seconds on main. The recovery UI still does not say “reinstall” as step one.`,
      internals: `NSFileProtectionCompleteUntilFirstUserAuthentication ≈ AfterFirstUnlock. Complete = until unlock every time. CompleteUnlessOpen is a trap for long-lived handles.

Core Data / sqlite in WAL mode: checkpoint (\`PRAGMA wal_checkpoint\`) before copying. NSPersistentStoreCoordinator migration must see all files. Time Machine / iTunes backup usually includes wal if it includes the sqlite; a custom exporter often does not.

Error 257: NSFileReadNoPermissionError-ish; also see NSFileWriteFileExists. SQLite busy: SQLITE_BUSY. Corrupt: SQLITE_CORRUPT. Log the code, not “load failed.”

BGTask at dawn: same protection story as problem 2’s Keychain WhenUnlocked. The store and the token must agree on AfterFirstUnlock if background work needs both.`,
      testing: `Device, not simulator: reboot, do not unlock, fire a BGTask or a silent push that loads the store — AfterFirstUnlock succeeds, Complete fails, and the fail path does not delete the file. Unlock, assert drafts from before reboot are present.

Copy test: duplicate only .sqlite, open, assert you detect incompleteness rather than silently dropping WAL data (or that your exporter always takes three files).

Busy test: two processes, App Group, one holds a write; the other retries, does not wipe.

Never only test after unlock on a warm device.`,
      pitfalls: `Destroy on any load error. Copying sqlite without wal/shm. Complete protection on a store you load at launch. Two coordinators. Treating SQLITE_BUSY as corrupt. Loading on main until protection lifts, frozen splash. Logging only “migration.” Simulator-only tests (protection is different).`,
      alternatives: `SQLite DELETE journal mode if you truly cannot teach people to copy WAL — slower, still not an excuse to wipe. Delay all persistence until \`protectedDataAvailable\` and paint a shell. That is more UI work and fewer boot crashes. A second encrypted container for secrets only, store after unlock — splits the problem, does not remove WAL.`,
      tradeoffs: `AfterFirstUnlock: background work can run, a stolen locked phone can read the store after first unlock of that boot. Complete: safer at rest, hostile to launch and BGTasks. WAL: faster writes, three-file discipline. Wiping on error: always recovers the *process*, sometimes destroys the *product*.`,
      followups: [
        {
          q: 'Support still says reinstall. What do you give them instead?',
          a: 'A recovery screen, an export, a log of the *code* (257 vs corrupt vs schema). A hotfix that waits for protected data. Reinstall is last, and it is a data-loss acknowledgement.',
        },
        {
          q: 'Does SwiftData change WAL?',
          a: 'No. It is still SQLite files. ModelContainer load can still fail closed. Same sidecars, same protection.',
        },
        {
          q: 'Can the feed cache use Complete and destroy on 257?',
          a: 'Yes — it is disposable (problem 5). Drafts cannot. That is why they are not one file.',
        },
        {
          q: 'How does this interact with Keychain WhenUnlocked?',
          a: 'Same moment in the boot. If the store opens and the token does not, you look logged out with intact drafts. Align accessibility (problem 2).',
        },
      ],
      teaches: [
        'File protection is not a migration',
        'WAL means three files',
        'Classify load errors before wipe',
        'AfterFirstUnlock for boot and BGTasks',
        'Busy ≠ corrupt',
        'Do not load a protected store as a crash',
      ],
    },
    {
      id: 'd7-p9',
      title: 'SwiftData @Model on the wrong actor',
      difficulty: 'Expert',
      kind: 'Debug',
      prompt: `A \`@Model final class Draft\` is passed from a \`ModelActor\` to a \`@MainActor\` view model, mutated in a \`Task.detached\`, and saved. Runtime warns about crossing isolation. Sometimes you get a crash, sometimes a silent missed save, sometimes the UI shows a draft that the next fetch does not see. A teammate “fixes” it with \`@MainActor\` on the model class. Another uses \`nonisolated\` on every property.

How are SwiftData models isolated? What may leave the actor? How do you let SwiftUI observe without smuggling a live model into a detached task?`,
      think: [
        'Is @Model a UIKit-style managed object with a context thread rule, or a Sendable value?',
        'What does ModelActor actually serialise?',
        'If the VM holds the @Model instance, who is allowed to write it?',
        'What do you pass across isolation — the persistent identifier, a DTO, or the object?',
      ],
      solution: `Treat \`@Model\` like a Core Data managed object: **confined to the model container / actor that fetched it**. It is not \`Sendable\`. Do not mark the class \`@MainActor\` as a blanket fix; do not \`nonisolated\` the storage.

Pattern:

1. **Writes** go through a \`ModelActor\` (or a single writer context). The actor fetches by \`PersistentIdentifier\`, mutates, saves.
2. **UI** observes via \`@Query\` / a MainActor context, or receives an immutable **DTO** (\`DraftViewData\`) the actor publishes.
3. Crossing isolation: send \`PersistentIdentifier\` + values, never the live \`Draft\` into \`Task.detached\`. Detached work builds a DTO or a payload for the network, then asks the actor to save.

\`\`\`swift
actor DraftWriter: ModelActor {
    func appendBody(id: PersistentIdentifier, text: String) throws {
        guard let draft = self[id, as: Draft.self] else { return }
        draft.body += text
        try modelContext.save()
    }
}
\`\`\`

The VM holds \`id\` and \`DraftViewData\`. \`Task.detached\` may compute a thumbnail from a URL; it may not touch \`draft.imageData\`.

\`@MainActor\` on \`Draft\` ties every access to main, including saves that should not block the first frame (problem 1). It will also lie if the container’s executor is not main.`,
      explanation: `The Core Data rule was “do not touch this object on another queue.” SwiftData did not repeal it. \`@Model\` is a persistent object with an identity and a context. Isolation is how the compiler tries to say that. Passing the instance to a detached task is the old “performBlock and then use the object on main” bug in a new hat. Sometimes the runtime catches you. Sometimes you mutate a snapshot. Sometimes save runs on an actor that never saw the change. The missed save is the worst one: the UI was optimistic, the file was not.

\`@MainActor\` on the model is how you make every fetch and save a main-thread launch hitch, and how you still race if a ModelActor exists beside it. \`nonisolated\` on properties is how you tell the compiler to stop helping.

The senior shape matches problem 5’s split and Day 5’s ports: the actor owns the graph; the UI owns a value. Identifiers cross the boundary. That is also how you test: the writer actor gets a throwaway container; the VM never imports SwiftData if you are strict, or only imports it for \`PersistentIdentifier\`.

I would not fetch on main and write on a detached task “for performance.” I would fetch on the writer, produce a DTO for the list, and keep the heavy thumbnail work on a task that only sees \`Data\` / \`URL\`. The model object stays home.`,
      internals: `ModelContext is not Sendable. ModelActor provides a serial executor bound to a context. \`PersistentIdentifier\` is Sendable and is the handle.

\`@Query\` on a view uses a context from the environment (usually main). Fine for reads of a screen-sized set. Not an excuse to write from \`body\`.

Core Data equivalent: objectID, \`perform\`, never the NSManagedObject across queues (problem 12). SwiftData’s compiler warnings are that rule with types.

Autosave: convenient, easy to miss when you mutated on the wrong context. Explicit save in the actor after a write batch is clearer for drafts.`,
      testing: `A test container on the writer actor: appendBody, fetch, assert. A test that passing Draft into a detached task is not in the production API (the function takes PersistentIdentifier). UI test is optional; a unit test that save from the wrong isolation throws or is impossible to express is the point.

Do not \`@MainActor\` the test suite’s container and call that coverage of background write.`,
      pitfalls: `\`Task.detached\` + live model. Sharing one Draft instance between a Query and a writer actor. \`@MainActor\` on @Model. Turning off isolation with nonisolated. Saving on main after mutating on the actor (two contexts, two truths). Using object’s hash identity in ForEach instead of persistent id.`,
      alternatives: `Immutable structs persisted as JSON files per draft (problem 6) — no actor smuggling, you write your own index. Core Data with objectID + perform, same pattern, older spelling. A MainActor-only app with a tiny store — honest if you never background-write; still do not detach.`,
      tradeoffs: `DTO + id: extra mapping, clear isolation, testable writer. Live @Model in the VM: fewer types, isolation warnings, missed saves. Everything on MainActor: simple, hitchy at launch, still wrong if an extension writes. ModelActor as the only writer: serialised saves, extra hops for every keystroke — batch the body, do not save per character.`,
      followups: [
        {
          q: 'Can @Query bind to a Draft the writer is also mutating?',
          a: 'Same container, maybe. Two contexts, you will see stale UI until merge. Prefer one writer and let Query’s context receive saves via the stack’s merge, or refresh the DTO.',
        },
        {
          q: 'Where does the upload job from Day 6 sit?',
          a: 'The job reads a file URL. The actor updates Draft.state. The upload task does not hold the @Model.',
        },
        {
          q: 'Is PersistentIdentifier stable across migrations?',
          a: 'Treat it as stable for a store generation. After a destructive migration it is not. Do not put it on the server as a draft id; use your own UUID on the model.',
        },
        {
          q: 'SwiftData in a widget?',
          a: 'Tiny container, read-only, App Group (problem 6). Still no live model smuggled from the app process — different process, different context.',
        },
      ],
      teaches: [
        '@Model is context-isolated, not Sendable',
        'Cross actors with ids and DTOs',
        'ModelActor is the writer',
        '@MainActor on the class is not a fix',
        'Detached tasks see values, not live models',
        'Same rule as Core Data objectIDs',
      ],
    },
    {
      id: 'd7-p10',
      title: 'Schema expand, backfill, contract across two releases',
      difficulty: 'Senior',
      kind: 'Design',
      prompt: `You need \`User.tier\` required in the API and in the store. Problem 1 already taught you not to add a non-optional attribute in one shot. Product wants the field in analytics next week and non-optional in code next quarter.

Design the two-release (or three-release) path for **both** the JSON you decode and the Core Data / SwiftData schema. Include old clients, old stores, a failed backfill, and the moment you are allowed to delete the optional.`,
      think: [
        'What does an old client do with a new required JSON field, and a new client with an old payload?',
        'When does the store become non-optional relative to the decoder?',
        'Who runs the backfill — migration, a launch job, the server?',
        'What if 2% of rows cannot be inferred?',
      ],
      solution: `Expand, backfill, contract. Never expand-and-contract in the same binary if old rows exist.

**Release N (expand):**

* JSON: decode \`tier\` as \`String?\` (or default \`"free"\` in the decoder). Do not fail the whole \`User\` if the server omitted it.
* Store: add **optional** \`tier\` (or optional with a default in the model editor). Lightweight / inferred migration. No mapping model.
* Write path: always write \`tier\` when you have it (from API or \`"free"\`).
* Analytics: treat nil as \`"unknown"\`, not as a crash.

**Release N backfill (can be the same binary, a launch job):**

* For rows with nil, set \`"free"\` or fetch from API. Batch, off main, save in chunks (problem 11).
* Server should also backfill; clients cannot reach deleted users.

**Release N+1 (contract), only when analytics says nil rate is ~0 on live versions you still support:**

* JSON: still default on decode for one more version if old caches exist.
* Store: new model version, optional → non-optional with default, or a mapping that fills \`"free"\`. If you skip the default, you are problem 1 again.
* Then you may delete the launch backfill.

Failed backfill: leave optional, do not crash launch, do not wipe the store. Contract is a **gate**, not a date on a slide.`,
      explanation: `Required is a destination. The crash in problem 1 was trying to teleport there. The API team will flip \`tier\` to required in OpenAPI and generated clients will start throwing on old payloads. The store team will make the attribute non-optional because the struct is non-optional. Both happen in one PR if nobody owns the sequence. Old app + new server, new app + old store, old store + new model: three combinations, one of them was the launch crash.

Expand means the new thing can be absent. Backfill means you invent a value for the past. Contract means you stop allowing absent. That is how you change a production database, and your sqlite file is one. The decoder is a second schema. They must not contract on different weeks without a plan: a store that requires tier while GET /me still omits it will write nil or fail the map. A decoder that requires tier while the store is still optional is fine — you just cannot persist what you cannot parse.

The 2% you cannot infer are the point of the gate. If those rows are guests, maybe delete them. If they are paying users, you cannot contract. Analytics on nil is the test. A quarter is a calendar, not a measurement.`,
      internals: `Core Data: inferred migration can add optional attributes and, with a default in the model, sometimes add non-optional. Trust that only with a fixture of production-shaped rows. Mapping model for anything that computes a value from other columns.

SwiftData: VersionedSchema N, N+1, CustomMigrationStage for backfill. Same gate.

JSON: \`decodeIfPresent\` + default. Do not use forced \`decode(String.self)\` until contract, and even then keep a default if you read disk caches of old payloads.

Expand/contract also applies to **renames**: add new, write both, read new-or-old, stop writing old, delete old. Renaming ID in Core Data is the shortcut; still test it.

Server expand/contract is the same pattern. Client cannot contract before the server.`,
      testing: `Fixtures: vN-1 store with nil tier → N migrates, backfill sets free, fetch works. vN store already filled → N+1 contracts, fetch non-optional. JSON fixtures: missing tier, present tier, unknown extra fields (must not fail).

A gate test in CI: a query that counts nil tiers on a sample; the contract PR cannot merge if the fixture still has nils — that is theatre unless you also have production analytics.

Launch: backfill of 200k rows must not block first frame (problem 1, problem 8).`,
      pitfalls: `Making the Swift property non-optional while the model version is still optional, then force-unwrapping. Contracting because the OpenAPI spec changed. Backfill on main. Backfill that uses \`try?\` and skips errors, then contracting. Deleting the optional in the same release you added it. Testing only empty simulators.`,
      alternatives: `Keep tier optional forever in the store and default in a computed property. Honest if you never need a DB constraint. Server-only field, not persisted — fine for analytics, bad if you must show tier offline. Rebuild users from GET /me on each launch and skip the column — then you are a cache, problem 5.`,
      tradeoffs: `Two releases are slower than one PR and they do not crash. A mapping model is tedious and cheaper than Support. Default \`"free"\` can be wrong for the 2%; an explicit unknown and a delayed contract is more honest. Generated clients that require fields fight expand — wrap them in the adapter (Day 6 problem 12) so the VM still sees \`String?\` during expand.`,
      followups: [
        {
          q: 'Can we contract in N+1 if we only support N?',
          a: 'Only if you drop N in App Store and wait until its population is gone, *and* every N store has been backfilled. Dropping support does not rewrite files on disk until they launch N+1.',
        },
        {
          q: 'API required, client still optional — who is wrong?',
          a: 'Neither during expand. The adapter defaults. If the API 400s on missing tier on *write*, your write path must send it even while reads still default.',
        },
        {
          q: 'SwiftData default vs Core Data default in the editor?',
          a: 'Both are expand tools. Neither replaces a backfill if existing rows would otherwise violate a new non-optional without a default.',
        },
        {
          q: 'How does this interact with CloudKit (problem 7)?',
          a: 'The mirror has a schema too. Expand/backfill/contract there, or you will sync a required field the other device has never heard of.',
        },
      ],
      teaches: [
        'Expand, backfill, contract',
        'Decoder schema and store schema both version',
        'Contract is a measured gate',
        'Optional in N, required in N+1',
        'Backfill off the first frame',
        'Do not teleport to non-optional',
      ],
    },
    {
      id: 'd7-p11',
      title: 'NSFetchedResultsController versus SwiftUI, faults, and a derived count',
      difficulty: 'Senior',
      kind: 'Performance',
      prompt: `A UIKit feed uses \`NSFetchedResultsController\` on the main context. You add a SwiftUI screen that \`@Query\`s the same \`Post\` entity, plus a badge that shows \`post.comments.count\`, plus a search that sets a predicate on every keystroke. Scrolling hitches. Instruments shows faults firing, and \`comments\` relationship firing as the badge appears. A teammate wants to drop FRC and “just use SwiftData @Query everywhere.” Another adds \`includesPendingChanges\` and \`relationshipKeyPathsForPrefetching\` until the fetch is a 40 MB payload.

Make the list cheap. Where do FRC and @Query each belong? What is a derived attribute for, and when is counting comments in the cell a fetch storm?`,
      think: [
        'Does the cell need the comment objects, or a number?',
        'Who is the FRC delegate, and does SwiftUI’s Query sit on the same context?',
        'What does a fault cost at scroll time versus a prefetch of the whole graph?',
        'Is search-as-a-predicate on every keystroke a fetch, a filter in memory, or a debounce?',
      ],
      solution: `**UIKit lists that already work:** keep FRC. It is batching, sections, and diffs you understand. Do not rewrite the feed in SwiftUI to get a badge.

**SwiftUI lists:** \`@Query\` (SwiftData) or an FRC wrapped in \`@Observable\` / a fetched-results publisher. Do not mix FRC delegate callbacks and @Query on the same objects on two contexts without a merge plan.

**Badge count:** a **derived attribute** or a denormalised \`commentCount\` you maintain when comments change — not \`post.comments.count\` in \`body\` / \`cellForRow\`. Relationship count fires faults. Prefetching the whole \`comments\` graph to get a number is the 40 MB.

FRC: \`fetchBatchSize\` (e.g. 20–50), \`relationshipKeyPathsForPrefetching\` only for data you will **display in the first paint of the cell**, not the whole graph. Faults are a feature; a batch size of 0 is a full table load.

Search: debounce, minimum characters, predicate on indexed attributes. Do not refetch on every keystroke against an unindexed \`body CONTAINS\`.

SwiftData @Query is not a magic FRC. It still fetches. It still faults. A huge @Query with a sort and no limit is the hitch.`,
      explanation: `FRC is not legacy shame. It is a cursor over a result set with a delegate that tells UIKit what moved. SwiftUI @Query is a similar idea with a different subscriber. The hitch is not the three letters. The hitch is the work per row. \`comments.count\` on a to-many relationship is “load the relationship” in costume. Derived attributes exist because this bug is older than SwiftUI. You store a number, you update it when the relationship would have changed, you fetch the number with the row. The cell stays a row, not a graph.

Prefetch is the opposite overreaction. The teammate who relationship-prefetches comments made every scroll a JSON-sized object graph in memory. Faults were invented so you would not do that. Batch size brings in a window. Prefetch is for the avatar relationship you will definitely show, not for the comments you might.

Two UIs on one store is fine if they share a merge story (problem 12). Dropping FRC because the new screen is SwiftUI is a rewrite with a performance regression attached. Keep FRC for UIKit. Use Query for SwiftUI. Share the model, not the controller.`,
      internals: `NSFetchedResultsController: fetch request + cacheName (optional) + delegate. Main context for UI. \`controllerDidChangeContent\` / object diffs. Batch faults: \`fetchBatchSize\` turns the SQL into windows. \`returnsObjectsAsFaults\` defaults true.

Derived attributes: modeled, maintained by Core Data in some versions, or a value you write in willSave. Index them if you sort/filter on them.

SwiftData @Query: predicate, sort, animation. Runs in the view’s context. Too much work in \`body\` that touches relationships is Day 3’s invalidation plus this day’s faults.

Search: \`NSCompoundPredicate\`, indexes on the column, debounce 200–300 ms. \`CONTAINS[cd]\` on a large table is a scan unless you invested in a search index (Spotlight, FTS).`,
      testing: `Instruments: Time Profiler while flinging, look for relationship named fetches. A unit test: 10k posts, 50 comments each, fetch the feed request, assert objects faulted, assert commentCount is on the Post without firing comments. Search test: type 10 letters, assert fetch count is debounced, not 10.

Do not test this on 20 rows in a simulator and call it a feed.`,
      pitfalls: `\`post.comments.count\` in the cell. Prefetching the world. fetchBatchSize 0. @Query of all posts in a window. FRC on a background context feeding UIKit directly. Rewriting FRC mid-incident. Sorting on an unindexed derived field you just added without a migration (problem 1).`,
      alternatives: `A list DTO table (PostListRow) updated by the writer actor — the UI never sees Post. SQLite FTS for search. Server-side search if the corpus is huge. SwiftUI List with identifiers and a fetch-by-id detail, not a fully faulted graph in the list.`,
      tradeoffs: `Derived count: extra invariant to maintain, O(1) cells. Live relationship count: always true, always expensive. Prefetch: fewer faults, more memory. Small batch: more SQL, less RAM, the right default for feeds. One SwiftUI rewrite: uniform UI, you lose a working FRC and ship a hitch.`,
      followups: [
        {
          q: 'FRC cacheName in production?',
          a: 'Rarely worth it; invalidation bugs. Measure. Most apps skip it.',
        },
        {
          q: 'Does SwiftUI ForEach need objectID?',
          a: 'Stable identity: persistent identifier or your UUID, not array indices (Day 3). Faulting does not change identity. A derived count change should not recreate the row identity.',
        },
        {
          q: 'Widget showing unread count?',
          a: 'A tiny query or a denormalised file in the App Group (problem 6). Do not load the feed FRC in the widget.',
        },
        {
          q: 'When is @Query the wrong tool?',
          a: 'Huge unscoped fetches, work in body, writes. Use a store object that vends a page, like the feed cache blob, when you do not need live SQL for every keystroke.',
        },
      ],
      teaches: [
        'FRC stays for UIKit lists that work',
        'Count is a derived field, not a relationship fault',
        'fetchBatchSize and targeted prefetch',
        '@Query is still a fetch',
        'Debounce search predicates',
        'Do not prefetch the graph to paint a badge',
      ],
    },
    {
      id: 'd7-p12',
      title: 'perform, performAndWait, and the main context at launch',
      difficulty: 'Senior',
      kind: 'Review',
      prompt: `Code review of the persistence stack:

\`\`\`swift
persistentContainer.loadPersistentStores { _, error in
    // on the session’s queue, not necessarily main
    let view = self.persistentContainer.viewContext
    view.performAndWait {
        self.seedIfNeeded() // 4 000 rows
        try? view.save()
    }
    DispatchQueue.main.sync {
        self.window.rootViewController = FeedVC(context: view)
    }
}
func seedIfNeeded() {
    // uses viewContext directly
}
\`\`\`

\`FeedVC\` then writes likes on a background context *and* on \`viewContext\` from a URLSession callback. Deadlocks on some devices. First frame is 8 seconds on large stores. The author says \`performAndWait\` is “safer than perform.”

Review queue use, what belongs on main, and how this ties to problems 1, 8, and 9.`,
      think: [
        'Which queue is loadPersistentStores calling you on, and what happens if you sync to main from there?',
        'Is viewContext MainActor / main queue confined, and who may touch it?',
        'When is performAndWait a deadlock, and when is it a hitch?',
        'How many writers? How do likes from Day 6’s callback get into the store?',
      ],
      solution: `**viewContext** is for UI. Confine it to main. \`perform\` (async) to hop *to* it, never \`performAndWait\` *from* a queue that main might be waiting on, never \`DispatchQueue.main.sync\` from the load callback if main is blocked on that callback.

**Launch:** \`loadPersistentStores\` on a private queue (or accept the callback off-main). Do **not** seed 4 000 rows on the view context before first frame. Seed on a private context, save, merge to view. Paint a shell first (problem 1). \`performAndWait\` on main at launch is the 8-second splash.

**Writes:** one writer pattern — private queue context (or ModelActor, problem 9) for mutations (likes, drafts). Merge to view via \`automaticallyMergesChangesFromParent\` / notification. URLSession callbacks are not main and are not the view context. They send an id + payload to the writer (Day 6 problem 8’s job, problem 4’s 409 queue).

\`performAndWait\` is not safer. It is \`sync\`. Nested \`performAndWait\` on the same queue deadlocks. \`main.sync\` from the store callback deadlocks if main is waiting on load. That is problem 4’s URLSession deadlock wearing Core Data.

\`try?\` save remains a smell. Seed errors need logs. Wiping is still problem 5’s decision, not a background context’s.`,
      explanation: `The author wanted to be sure the seed finished before UI. \`AndWait\` did that by blocking. On a 200 MB store, “sure” was eight seconds of no first frame. On a device where main was already waiting for the window, \`main.sync\` from the load callback inverted the queues. Safer meant frozen.

Core Data’s rule is still: objects and contexts have queues. The view context is the main-queue context if you set it up that way (the default in NSPersistentContainer). Touching it from a URLSession delegate is undefined, often a crash, sometimes a deadlock if you then \`performAndWait\` back. Likes that write on both contexts are two truths until merge, and a 409 reconcile that cannot see the pending row.

The pattern that works is boring. Private writer, main reader, merge. Async \`perform\` to schedule work onto a context without waiting on the caller’s queue. Identifiers cross queues, not objects (problem 9). Launch does not seed on the view context. That is the review. “Safer” is a word people attach to \`sync\` when they are afraid of races. Races need isolation. \`sync\` needs a proof you cannot invert two queues. You usually cannot prove it at launch.`,
      internals: `NSPersistentContainer: \`viewContext\` (main by convention), \`newBackgroundContext()\` (private queue). \`perform\` enqueues. \`performAndWait\` runs now if already on the queue, otherwise syncs — nested wait on the same queue is deadlock.

\`loadPersistentStores\` completion is not promised on main. Always hop explicitly.

Merge: \`NSMergeByPropertyObjectTrumpMergePolicy\` vs store-trump. For a replica with pending likes (problem 4), pending local wins until confirmed — that is application merge, not only Core Data’s policy.

SwiftData: ModelActor instead of background context. Same “do not wait on main for a 4 000-row seed.” \`main.sync\` is still forbidden from the loader.

File protection (problem 8): if you \`performAndWait\` for protected data that is not available, you can hitch until unlock. Observe availability, then load.`,
      testing: `A launch test: first frame timestamp vs seed completion — frame must not wait for 4 000 rows. A deadlock test: from main, start load that tries \`main.sync\` — must not be the production path (timeout in DEBUG). Like from a fake URLSession queue: assert the writer context received it, view shows it after merge, no touch of viewContext on the session queue.

Thread sanitizer / Core Data concurrency debug (\`-com.apple.CoreData.ConcurrencyDebug 1\`) on a debug build; it should trip the old code.`,
      pitfalls: `performAndWait at launch on viewContext. main.sync from the load callback. URLSession writing the viewContext. Two background contexts as uncoordinated writers. try? save. Seeding in the view context so SwiftUI @Query “just works” on first frame. Nested performAndWait. Passing NSManagedObject to the session callback.`,
      alternatives: `NSBatchInsertRequest for the 4 000 seeds — faster, still off the first frame. A JSON feed cache (problem 5) instead of seeding Core Data with page 1. SwiftData ModelActor only, no viewContext spelling — still do not block launch.`,
      tradeoffs: `Async perform: first frame is honest, UI may briefly miss seed data (show cache or empty). AndWait: consistent seed, frozen splash, deadlock surface. One writer: simpler merge, a queue of mutations. Many contexts: parallelism you will not measure on a phone-sized sqlite, more merge bugs. ConcurrencyDebug: noisy, catches the bug in development, mandatory for this stack.`,
      followups: [
        {
          q: 'Is viewContext MainActor in Swift 6?',
          a: 'You can isolate it; Core Data’s older API is queue-based. Do not assume @MainActor on a method means the context was used on main — hop with perform, then touch objects.',
        },
        {
          q: 'Can the like queue (problem 4) be the same writer context?',
          a: 'Yes. One serial writer for mutations. The HTTP retry stays in Day 6. The store work is perform/ModelActor, not the session thread.',
        },
        {
          q: 'performAndWait in a unit test?',
          a: 'Acceptable to keep tests deterministic if you own the queue and cannot deadlock. Still not the production launch path.',
        },
        {
          q: 'How does this interact with coordinator leaks in Day 5?',
          a: 'Different graph. Do not put the NSPersistentContainer on a navigation coordinator that leaks (Day 5 problem 5) or you keep a store and 40 FRC delegates alive. Ownership of the stack is App, not the VC.',
        },
      ],
      teaches: [
        'viewContext is UI, private context writes',
        'performAndWait is sync, not safety',
        'Never main.sync from the load callback',
        'Seed off the first frame',
        'Cross queues with IDs, not objects',
        'URLSession is not a Core Data queue',
      ],
    },
  ],
}
