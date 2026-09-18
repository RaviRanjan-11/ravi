import type { PrepDay } from './types'

export const day4: PrepDay = {
  id: 'day-4',
  title: 'Day 4 — SwiftUI',
  kicker: 'Identity and state, not the happy path',
  intro:
    'This is a full SwiftUI interview day, not a sidebar on a UIKit list. A view is a value, storage is keyed by identity, and body is a function of what you read. You will walk Observation, bindings, representables, navigation path, and the layout loop the way Day 3 walked reuse — from an incident, not from a modifier cheat sheet.',
  problems: [
    {
      id: 'd4-p1',
      title: '1 000-row feed, body never sleeps',
      difficulty: 'Expert',
      kind: 'Performance',
      prompt: `A SwiftUI feed of 1 000 posts ships in TestFlight. Scrolling hitching is the top complaint. The layout looks innocent:

\`\`\`swift
ScrollView {
    LazyVStack {
        ForEach(posts) { post in
            PostRow(post: post, feed: feedVM)
        }
    }
}

struct PostRow: View {
    let post: Post
    @ObservedObject var feed: FeedVM

    var body: some View {
        HStack {
            Image(uiImage: UIImage(data: post.fullResJPEG) ?? .placeholder)
            VStack(alignment: .leading) {
                Text(post.author)
                Text(feed.relativeDate(post.createdAt, now: feed.tick))
                Text("\\(feed.likeCount(for: post.id)) likes")
            }
        }
    }
}
\`\`\`

Instruments: \`PostRow.body\` runs for rows that left the screen two screens ago. A like on one post redraws every row. Diagnose the invalidation, the image work, and redesign the row so a like on post 47 does not wake post 900.`,
      think: [
        'What does PostRow actually subscribe to when it takes the whole FeedVM as ObservedObject?',
        'Does LazyVStack still help if the parent invalidates every child?',
        'Where is the JPEG decoded, and on which thread, relative to layout?',
        'If you migrate to @Observable, what happens if the row still reads vm.tick?',
      ],
      solution: `Stop broadcasting the whole feed into every row. Pass a value, or a tiny per-row model.

\`\`\`swift
struct PostRow: View {
    let post: Post
    let likeCount: Int
    let relativeDate: String

    var body: some View {
        HStack {
            PostThumbnail(url: post.thumbURL)
            VStack(alignment: .leading) {
                Text(post.author)
                Text(relativeDate)
                Text("\\(likeCount) likes")
            }
        }
    }
}
\`\`\`

Rules that actually move the needle:

1. **Narrow inputs.** \`PostRow\` must not hold \`FeedVM\`. A like updates one \`Post\` (or one row model). Observation / \`objectWillChange\` on the screen VM must not be a dependency of 1 000 bodies.
2. **Keep \`body\` cheap.** Relative dates and like strings are computed in the model or a formatter cache, not by walking the VM during layout. No \`AnyView\` (Day 1). No \`.id(UUID())\`.
3. **Decode off the main thread, to the pixel size of the row.** Never \`UIImage(data: fullResJPEG)\` in \`body\`. Downsample to \`rowSize * scale\`. Show a placeholder until the thumbnail is ready.
4. **Stable identity.** \`ForEach(posts)\` with \`id: \\.id\`, never \`ForEach(posts.indices)\`. Prefer \`List\` for a standard iOS feed; keep \`LazyVStack\` only when you need custom stacking.
5. **If you use \`@Observable\`, still do not read \`vm.tick\` in the row.** Fine-grained Observation is not a substitute for a narrow view. Problem 6 is the migration that forgets this.

You do not open with a UICollectionView rewrite unless you have a video layer SwiftUI keeps murdering. Day 3's cell is the last resort, not the opening move.`,
      explanation: `You sit down with Instruments because the hitching made it to TestFlight. Time Profiler is a wall of \`PostRow.body\`. Bodies for rows that left the screen three flings ago are still running. Someone says LazyVStack is supposed to be lazy, so this must be an image-decode problem. They are half right. The JPEGs are expensive. They are not why every row is awake.

A SwiftUI view is a value the framework is allowed to recreate whenever it wants. \`body\` is a function of whatever that value read last time it ran. \`@ObservedObject var feed: FeedVM\` is not a convenient way to pass data down. It is a subscription to \`objectWillChange\`. One like-count on post 47 fires that publisher. Every \`PostRow\` subscribed, so every \`PostRow.body\` runs. LazyVStack can skip *creating* off-screen children on first layout. It cannot save you if the parent invalidates the world and you handed every child a reason to redraw.

That is Observation granularity — the same instinct as following retain counts on Day 1, and as following cell reuse on Day 3. You do not ask whether you used the fashionable property wrapper. You ask what this view actually read, and who else is listening to the same object. \`@Observable\` tracks property reads instead of blasting a single publisher, which is better, and it still will not help a row that reads \`vm.posts\` and \`vm.tick\`. Pass a \`Post\` value into the row. Format dates before \`body\`. Decode images off main, to the size of the thumbnail.

Identity is the other half of the incident. \`ForEach(posts.indices)\` and \`.id(UUID())\` tell SwiftUI this row is a new view every time \`body\` runs. State resets, images refetch, players restart. Stable \`id: \\.id\` is how the framework decides this is the same post as last frame. \`List\` is usually the right container for a text-and-thumbnail feed. Keep LazyVStack when you need the stacking, not as a performance strategy by itself.

The redesign is boring on purpose: cheap bodies, narrow inputs, stable identity, work that is not layout on the main thread.`,
      internals: `\`ObservableObject\` is one \`objectWillChange\` publisher. Any \`@Published\` mutation, or a manual send, invalidates every view that holds that object as \`@ObservedObject\` or \`@StateObject\`. The framework then re-invokes \`body\` on those views and diffs the new tree against the old one. Diffing is cheaper than UIKit layout, and it is not free at 1 000 rows with a decoded bitmap in each body.

\`@Observable\` (the Observation framework) records which properties \`body\` read, and only invalidates readers of the properties that changed. That is why migrating the VM and then reading \`vm.tick\` in every row reproduces the old world with new syntax (problem 6). Reads in \`body\`, in \`onAppear\`, and in computed properties that \`body\` touches all count.

\`Image(uiImage:)\` holds a decoded bitmap. A 12-megapixel JPEG becomes tens of megabytes uncompressed. Doing that decode during \`body\` on the main thread is both a hitch and a memory cliff. Lazy stacks still have to encode the view values for off-screen rows they have created; "lazy" is about *realizing* the view, not about isolating Observation.

SwiftUI identity lives in the explicit \`.id\` and in the structural position in the tree. Change either, and stored \`@State\` / \`@StateObject\` / representables are discarded and recreated. That is the same "create once, update many" rule you will hit again with \`UIViewRepresentable\` in problem 3.`,
      testing: `Add a DEBUG counter that increments inside \`PostRow.body\` and print it while you like a single post. Before the fix it climbs by ~1 000. After, it climbs by 1 (plus whatever parent chrome redraws).

Time Profiler and the SwiftUI instrument on a device, not the simulator: confirm \`body\` time drops and that image decode is off the main thread. Allocations while flinging the list: persistent bytes should plateau, not climb with every full-res JPEG.

A unit test on the row model: mutating \`likeCount\` for id 47 does not copy or recreate the other 999 posts if you designed it that way. Do not try to XCTest body invocation counts as a merge gate — they are a diagnostic, not an API.`,
      pitfalls: `Putting \`NavigationLink\` destinations in the row so every row builds a detail view eagerly. Heavy \`onAppear\` that starts a network call without cancellation when the row is recycled (problem 8). Wrapping the row in \`AnyView\` to "erase" generic pain, which also erases a lot of the diff. Fixing hitching by replacing LazyVStack with a VStack of 1 000 rows. Using \`.drawingGroup()\` as perfume on a body that still decodes a bitmap.

The sneaky one after a partial fix: you stop passing FeedVM, but the parent \`FeedView.body\` still reads \`vm.tick\` and rebuilds the entire \`ForEach\` every second. The rows are values, so they get recreated even if they no longer *observe* the VM — their \`body\` may still run because the parent asked for a new tree. Move the ticking date label out of the list, or snapshot the formatted string into the row model on a coarse timer.`,
      alternatives: `UICollectionView (or UITableView) with a diffable data source when the row has a player, a map, or any UIView that is expensive to recreate — Day 3. SwiftUI \`List\` for the standard text-plus-thumbnail case — it brings cell reuse that LazyVStack only approximates.

Kingfisher, Nuke, or a small in-house downsampler that you own. The library is not the architecture; the contract is "decode off main, to the view size, cancel on disappear."

A per-row \`@Observable\` \`PostRowModel\` owned by the screen, keyed by post id, if the row has real local state (like a follow button in flight). That is still narrower than the feed VM.`,
      tradeoffs: `Passing \`Post\` structs copies on write. That is cheaper than 1 000 view invalidations, and it is not free if \`Post\` embeds a 4 MB JPEG. Keep blobs out of the value you pass into the row; pass an id and a thumb URL.

\`List\` gives you reuse and some iOS polish, and it fights you on custom separators, sticky headers, and nested scroll views. LazyVStack gives you control and will happily keep work alive if you subscribe widely.

Rewriting the feed in UIKit is the right call for video, and it is a quarter the team for a year if you do it because SwiftUI "is slow." Measure body counts first. The senior answer in the room is the narrow row, then the image pipeline, then identity. UICollectionView is a last resort you can still choose without shame.`,
      followups: [
        {
          q: 'StateObject versus ObservedObject for the feed VM itself?',
          a: 'The screen owns it: @StateObject, or @State plus @Observable. Rows must not own it and must not observe it. Two children can share a parent-owned model; neither allocates.',
        },
        {
          q: 'Why did .id(UUID()) on the row make hitching worse?',
          a: 'New identity every body: SwiftUI destroys the view, drops @State, recreates representables, and refetches images. You turned a redraw into a rebuild.',
        },
        {
          q: 'Does Equatable on PostRow skip body?',
          a: 'With EquatableView or .equatable(), SwiftUI may skip body if the inputs did not change. It does not help if the input is the whole VM, because that input "changed" whenever objectWillChange fired. Narrow the inputs first; Equatable is a polish pass.',
        },
        {
          q: 'Where should relative timestamps live if they must tick?',
          a: 'A coarse timer on the screen that rewrites a formatted string into visible row models, or a tiny DateLabel view whose identity is the post id and whose only job is the ticking text. Do not put feed.tick in the row that also draws the image.',
        },
        {
          q: 'List versus LazyVStack versus UICollectionView — pick one for this feed.',
          a: 'List if it is text and thumbnails. LazyVStack if you need custom stack layout and you have already narrowed Observation. UICollectionView if you own players, interactive cells, or prefetch that SwiftUI will not let you budget (Day 3).',
        },
      ],
      teaches: [
        'SwiftUI invalidation is a subscription graph',
        'Observation granularity: what body actually read',
        'Lazy stacks are not isolation',
        'Image decode size versus view size',
        'Stable identity versus .id(UUID())',
        'Pass values into rows, not the screen VM',
      ],
    },
    {
      id: 'd4-p2',
      title: 'Form state resets on every keystroke',
      difficulty: 'Senior',
      kind: 'Debug',
      prompt: `A profile editor:

\`\`\`swift
struct EditUser: View {
    @ObservedObject var vm = UserVM()

    var body: some View {
        TextField("Name", text: $vm.name)
    }
}

struct ProfileScreen: View {
    @State private var now = Date()
    var body: some View {
        VStack {
            Text(now, style: .timer)
            EditUser()
        }
        .onReceive(Timer.publish(every: 1, on: .main, in: .common).autoconnect()) { now = $0 }
    }
}
\`\`\`

The parent refreshes on a timer, on keyboard, on an unrelated \`@State\`. The text field clears after a second or two of typing. Why? What is the Observation-era equivalent of the fix? What happens if two tabs each write \`EditUser()\` with that same initializer?`,
      think: [
        'When is UserVM actually initialised — once per screen lifetime, or once per EditUser struct value?',
        'Does @ObservedObject own the object, or only subscribe to it?',
        'What does SwiftUI keep, and discard, when ProfileScreen.body runs again?',
        'If you switch to @Observable, which wrapper restores ownership?',
      ],
      solution: `\`@ObservedObject var vm = UserVM()\` **allocates a new VM every time the \`EditUser\` struct is initialised**. Parent refresh recreates that struct → new VM → empty \`name\` → the field looks like it "cleared."

\`@ObservedObject\` means "I am borrowing an object someone else owns." The \`= UserVM()\` still ran. You borrowed a throwaway.

Fix — pick one ownership story:

\`\`\`swift
// Classic: the child owns the VM for this identity
struct EditUser: View {
    @StateObject var vm = UserVM()
    var body: some View {
        TextField("Name", text: $vm.name)
    }
}

// Better for sharing: parent owns, child borrows
struct ProfileScreen: View {
    @StateObject private var vm = UserVM()
    var body: some View {
        EditUser(vm: vm)
    }
}

struct EditUser: View {
    @ObservedObject var vm: UserVM
    // ...
}

// Observation era
@Observable final class UserVM { var name = "" }

struct ProfileScreen: View {
    @State private var vm = UserVM()
    var body: some View {
        EditUser(vm: vm)
    }
}

struct EditUser: View {
    @Bindable var vm: UserVM
    var body: some View {
        TextField("Name", text: $vm.name)
    }
}
\`\`\`

Never initialise an observed object inline in a child that the parent is allowed to recreate. If two tabs need the same draft, one owner — the parent, a store, a navigation destination's \`@State\` — and everyone else borrows.`,
      explanation: `The report comes in as "the text field is broken." You type three letters, the timer in the header ticks, and the name snaps back to empty. It feels like keyboard avoidance or a focus bug. It is neither. It is ownership.

SwiftUI views are values. \`ProfileScreen.body\` running again is normal and frequent — a timer, a keyboard height, an unrelated \`@State\`. That re-creates the \`EditUser()\` value. Initialisers of view structs run often, the way copying a struct runs often. \`@ObservedObject var vm = UserVM()\` does exactly what it says in Swift: construct a \`UserVM\`, wrap it. There is no hidden "first time only" for ObservedObject. The wrapper subscribes to whichever instance you handed it. You handed it a new one.

\`@StateObject\` exists because this incident was so common. On first init for a given view identity, the framework stores the object and reuses it. Later inits of the same identity throw the new allocation away. That is ugly, and it is also why \`@StateObject var vm = UserVM()\` is legal and \`@ObservedObject var vm = UserVM()\` is a trap. ObservedObject never promised storage. It promised a subscription.

The Observation-era version is the same story with less magic: \`@State private var vm = UserVM()\` on the owner, pass the instance down, \`@Bindable\` in the child if you need bindings. \`@State\` is the storage. \`@Observable\` is the invalidation. Mixing them up — \`@State\` on a non-observable class, or an observable class created as a local \`let\` in \`body\` — reproduces the reset.

Two tabs that each write \`EditUser()\` with an inline VM are two drafts. That might be what you want. If it is not, the parent of the tabs owns one \`UserVM\` and passes it in. Same rule as the feed row: the person who allocates is the person who owns, and identity in the tree is how long that ownership lasts.`,
      internals: `View identity in SwiftUI is structural (where you sit in the tree) plus any explicit \`.id\`. Storage for \`@State\`, \`@StateObject\`, and \`@FocusState\` is keyed by that identity, not by the Swift value of the struct. When \`body\` of the parent runs, SwiftUI compares the new child value to the stored one. For \`@ObservedObject\`, there is nothing to compare against except the instance you pass this time — so a freshly allocated VM is a freshly observed VM, and the old one deallocates with whatever the user typed.

\`@StateObject\`'s first-wins rule is implemented as: if storage for this identity is empty, take this instance; otherwise ignore the new instance and keep the stored one. That is why putting a parameter in the \`UserVM(user:)\` initialiser of a \`@StateObject\` is also a trap — updates to \`user\` do not recreate the object. Inject values through \`body\` or a method, not through a StateObject initialiser you expect to re-run.

\`@Observable\` + \`@State\` stores the instance in the same identity table. \`@Bindable\` does not own; it projects bindings into an already-owned observable. A local \`let vm = UserVM()\` inside \`body\` is a new instance every body, Observation or not.`,
      testing: `Type two characters. Trigger the parent timer (or any parent \`@State\` toggle). Assert the text is still those two characters. Without the fix it resets.

UI test: focus the field, type, wait two seconds with the header timer running, assert \`Name\` value. That test is the regression you want in CI because this bug feels intermittent to humans.

For the two-tab case: type in tab A, switch to tab B, switch back. If they were supposed to share a draft, A's text is still there only when the owner outlives the tab switch.`,
      pitfalls: `Fixing the symptom with \`.id(vm.name)\` on the text field — you destroy the field identity on every keystroke and the cursor jumps. Using \`@StateObject\` in a view that is itself created with \`.id(UUID())\` higher up — you still reset, you just moved the identity bug. Passing \`UserVM()\` as a default argument in \`init(vm: UserVM = UserVM())\` — default arguments run at the call site, which is still every parent body.

\`unowned\` / assuming the VM is a singleton because "it's a class." Classes are reference types; you still allocated two of them.`,
      alternatives: `\`@Bindable\` with a parent-owned \`@Observable\` model is the current default. A \`@State\` struct \`EditUserDraft\` with an explicit \`save()\` is even simpler if you do not need a class. An editor presented as \`navigationDestination(item:)\` can own the draft in the destination's \`@State\`, which is a clean lifetime: the draft lives as long as the screen (problem 7).

Do not reach for Combine just to hold a string.`,
      tradeoffs: `Child-owned \`@StateObject\` is convenient for a truly private editor and awkward the moment a sibling needs the same draft or you want to prefill from a network call. Parent-owned is an extra parameter and a clearer lifetime. On a form this size, parent-owned wins.

\`@Observable\` + \`@State\` removes the StateObject / ObservedObject foot-gun, and it introduces a new one: creating the observable as a member of a view that has unstable identity. Ownership did not get easier. The wrappers got renamed.`,
      followups: [
        {
          q: 'Can two children share one VM?',
          a: 'Yes — parent owns, both take ObservedObject or a let / @Bindable. Neither child writes = UserVM().',
        },
        {
          q: 'Why does @StateObject { UserVM(user: user) } ignore later user changes?',
          a: 'First init wins for that identity. The closure is not a dependency tracker. Update with .onChange(of: user) or pass user into body.',
        },
        {
          q: 'Is @ObservedObject always wrong?',
          a: 'No. It is correct when you are borrowing. It is wrong when you allocate in the same line.',
        },
        {
          q: 'What does .id(user.id) on EditUser do to a StateObject inside it?',
          a: 'When user.id changes, SwiftUI treats it as a new view, discards the stored VM, and you get a fresh draft. That is correct for "we opened a different user" and a bug for "the same user object was reassigned."',
        },
        {
          q: 'Observation: @State vs @StateObject on an @Observable class?',
          a: '@State is the one you want. @StateObject is for ObservableObject. Using StateObject on an Observable type is mixing generations; do not.',
        },
      ],
      teaches: [
        'View structs are values; inits run often',
        'ObservedObject subscribes, it does not store',
        'StateObject / @State + @Observable are ownership',
        'Identity keys SwiftUI storage',
        'Default arguments allocate at the call site',
      ],
    },
    {
      id: 'd4-p3',
      title: 'UIViewRepresentable recreates the map every update',
      difficulty: 'Senior',
      kind: 'Review',
      prompt: `Code review on a SwiftUI screen that embeds a map:

\`\`\`swift
struct MapView: UIViewRepresentable {
    @Binding var region: MKCoordinateRegion
    var annotations: [Shop]

    func makeUIView(context: Context) -> MKMapView {
        MKMapView()
    }

    func updateUIView(_ uiView: MKMapView, context: Context) {
        let map = MKMapView()
        map.region = region
        map.addAnnotations(annotations.map(ShopAnnotation.init))
        uiView.subviews.forEach { $0.removeFromSuperview() }
        uiView.addSubview(map)
        map.frame = uiView.bounds
    }

    func makeCoordinator() -> Coordinator { Coordinator() }
}
\`\`\`

The map flickers. The camera resets as the user pans, because parent \`body\` runs (a banner, a timer, an annotation count). Write the rules for representable updates. Where do delegates live, how do you avoid a region feedback loop, and when do you stay in UIKit instead of bridging?`,
      think: [
        'How many times should makeUIView run for a given SwiftUI identity?',
        'Must updateUIView be idempotent? What does "apply the diff" mean for region and annotations?',
        'If the coordinator is the MKMapViewDelegate, who owns the coordinator, and can it capture the View struct?',
        'What happens if you set region in updateUIView from a value that the delegate just wrote back into the binding?',
      ],
      solution: `\`makeUIView\` creates the \`MKMapView\` **once**. \`updateUIView\` applies a diff to *that* instance. Never replace the UIView.

\`\`\`swift
func updateUIView(_ map: MKMapView, context: Context) {
    context.coordinator.parent = self

    if context.coordinator.isUserDriven { return }

    if map.region.center.latitude != region.center.latitude ||
       abs(map.region.span.latitudeDelta - region.span.latitudeDelta) > 0.0001 {
        map.setRegion(region, animated: false)
    }

    let existing = Set(map.annotations.compactMap { ($0 as? ShopAnnotation)?.id })
    let desired = Set(annotations.map(\\.id))
    // remove gone, add new...
}

final class Coordinator: NSObject, MKMapViewDelegate {
    var parent: MapView
    var isUserDriven = false
    init(parent: MapView) { self.parent = parent }

    func mapView(_ mapView: MKMapView, regionDidChangeAnimated animated: Bool) {
        parent.region = mapView.region
    }
}
\`\`\`

Coordinator owns the delegate. Do not capture the SwiftUI \`View\` value in a long-lived way that assumes it is a class — update \`parent\` each \`updateUIView\`. Use a binding or a callback owned by the parent VM to send taps out.

If \`updateUIView\` is 200 lines of map policy, the honest move is: keep the map in a UIKit view controller and overlay SwiftUI chrome.`,
      explanation: `You can feel this one in your hands. You pan the map, a SwiftUI banner above it ticks, and the camera jumps back to San Francisco. Or it flickers, tiles reload, annotations pop. The reviewer looks at \`updateUIView\` and sees a second \`MKMapView()\` constructed as if this function were \`makeUIView\` with a confusing name. That is the bug. Representable is a bridge, not a factory you call on every frame.

SwiftUI will run \`updateUIView\` a lot. Parent \`body\` ran; inputs might have changed; they might not. The UIView is stored with the representable's identity, the same table that keeps \`@State\` (problem 2). \`makeUIView\` is the first-wins allocation. Everything after that is "here are the new inputs, please mutate in place." If you destroy the map, you destroy camera, tiles, the user's gesture, and any transient UIKit state you did not persist in SwiftUI. You are fighting the framework the same way \`@ObservedObject var vm = UserVM()\` fights it: create once, update many.

The region binding is the second half of the flicker. The user pans, the delegate writes \`parent.region\`, SwiftUI re-renders, \`updateUIView\` sets \`map.region\` to the value you just wrote, which may not be bit-identical to what MapKit has mid-gesture, which fires the delegate again. You get a feedback loop — the same shape as problem 4's dual onChange, and as Day 3's layoutSubviews writing constraint constants. A flag for "this update came from the user," or only setting region when the SwiftUI side changed from *your* code (a search result, a "re-center" button), breaks the loop.

Annotations are a diff, not a rebuild. \`removeAll\` plus \`add\` every update resets selection and animates pins in from nowhere. Key them by shop id, the same instinct as cell reuse on Day 3.

When the representable grows a coordinator, a gesture recogniser, clustering, and a callout that presents a sheet, you are no longer bridging. You are smuggling a view controller into SwiftUI one \`updateUIView\` at a time. Stay in UIKit for that map, and put SwiftUI around it. Interop is a seam, not a destination.`,
      internals: `The representable's UIView (or UIViewController, for \`UIViewControllerRepresentable\`) is stored by SwiftUI identity. \`makeCoordinator\` also runs once per identity. The coordinator is a class so MapKit can keep a weak-or-strong delegate pointer; MapKit does not know about your \`View\` struct.

\`updateUIView\` is called with the *same* UIView instance on subsequent updates. Creating a new map and adding it as a subview leaves the old MKMapView alive if you forget \`removeFromSuperview\`, or kills it if you remember — either way you have thrown away the object MapKit spent time warming. Frame-setting by hand also fights Auto Layout; if you must embed, constrain the map once in \`makeUIView\`.

\`UIViewControllerRepresentable\` has the same split: \`makeUIViewController\` once, \`updateUIViewController\` many. Appearance callbacks on that child are a Day 3 problem — if SwiftUI tears the representable down because identity was unstable, you will see \`viewDidAppear\` twice and your analytics will lie.`,
      testing: `A UI test that pans, waits for an unrelated SwiftUI state change (a banner), and asserts the camera did not jump. That is the flicker regression.

Unit-test a small wrapper around the diff: two \`updateUIView\` calls with the same region must not call \`setRegion\` again. Two calls with the same annotation ids must not remove and re-add. Inject a fake map if you do not want to boot MapKit in unit tests — a protocol with \`setRegion\` and \`addAnnotations\` is enough.

Debug: a counter in \`makeUIView\`. It should be 1 for the life of the screen. If it climbs, identity is broken (\`.id(UUID())\` on the representable, or a parent that destroys you).`,
      pitfalls: `Setting \`region\` in \`updateUIView\` from delegate-driven changes until the stack overflows or the camera fights the finger. Strongly capturing \`self\` View in the coordinator — it is a struct; you capture a stale copy, and if you capture a class wrapper carelessly you can cycle. Forgetting \`dismantleUIView\` to drop the delegate so MapKit does not call a coordinator whose parent is gone.

Putting \`MKMapView\` in \`body\` via representable *and* giving it \`.id(region)\` so every pan rebuilds the world. That one is common and disastrous.`,
      alternatives: `Keep the map in a UIKit \`MapViewController\` and use a SwiftUI overlay for the banner and the sheet. \`Map\` (SwiftUI) for simple pin-and-region cases on OS versions where it does what you need. A snapshot image of the map on a list row, pushing a real map on tap — often the right product for a feed.

Do not wrap MapKit "because the rest of the screen is SwiftUI." Interop is allowed to be a one-way door.`,
      tradeoffs: `A thin representable is fine: create once, diff region and annotations, coordinator for delegate. A 2 000-line \`updateUIView\` is a smell that the map is the screen. UIKit-first costs you a second language in the file and saves you the feedback loops.

Animated \`setRegion\` from SwiftUI updates looks nice and fights the user. Animated from a "jump to shop" button is correct. The trade-off is not animation, it is who is driving.`,
      followups: [
        {
          q: 'How do you pass a pin tap back to SwiftUI?',
          a: 'Coordinator calls a Binding, a callback, or a method on a parent-owned VM. The coordinator must not present UIKit alerts if the rest of the screen is SwiftUI state.',
        },
        {
          q: 'UIViewControllerRepresentable versus UIViewRepresentable for a map?',
          a: 'Prefer the view if you do not need VC lifecycle. Use the VC when you need containment, child VCs, or you already own a MapViewController. Appearance forwarding is Day 3 either way.',
        },
        {
          q: 'Why did the map recreate after rotating the phone?',
          a: 'If identity depended on size/region, or the parent used a new .id, SwiftUI discarded the representable. Rotation should hit updateUIView, not makeUIView.',
        },
        {
          q: 'Where do you put MKMapViewDelegate methods that present a callout?',
          a: 'Coordinator. Then bounce the intent to SwiftUI (selectedShop id) and let SwiftUI present the sheet (problem 10). Two presentation stacks is how you get stuck modals.',
        },
      ],
      teaches: [
        'makeUIView once, updateUIView many',
        'Idempotent diffs, not rebuilds',
        'Coordinator as delegate owner',
        'Region binding feedback loops',
        'When to stop bridging and stay in UIKit',
      ],
    },
    {
      id: 'd4-p4',
      title: 'Child writes that fight the parent',
      difficulty: 'Senior',
      kind: 'Design',
      prompt: `A settings screen. The parent owns the user's display name. A child editor is supposed to edit it. After a few keystrokes the field jumps, or the parent's "Remaining characters" label disagrees with the field, or saving writes a stale string.

Three attempts exist in the codebase:

\`\`\`swift
// A — child copies into @State
struct NameEditor: View {
    let initial: String
    var onSave: (String) -> Void
    @State private var draft: String = ""
    var body: some View {
        TextField("Name", text: $draft)
            .onAppear { draft = initial }
            .onChange(of: initial) { draft = $1 }
        Button("Save") { onSave(draft) }
    }
}

// B — child takes @Binding
struct NameEditor: View {
    @Binding var name: String
    var body: some View {
        TextField("Name", text: $name)
    }
}

// C — child takes @Binding and also keeps @State
struct NameEditor: View {
    @Binding var name: String
    @State private var draft: String = ""
    var body: some View {
        TextField("Name", text: $draft)
            .onAppear { draft = name }
            .onChange(of: draft) { name = $1 }
            .onChange(of: name) { draft = $1 }
    }
}
\`\`\`

The parent does:

\`\`\`swift
@State var name = "Ada"
@State var autosaveTick = 0
var body: some View {
    NameEditor(/* wired variously */)
    Text("\\(20 - name.count) left")
    .onReceive(timer) { _ in
        autosaveTick += 1
        name = name.trimmingCharacters(in: .whitespaces) // "normalize"
    }
}
\`\`\`

Design the data flow. When is \`@Binding\` correct, when is a local \`@State\` draft correct, and why does C livelock? Tie this to SwiftUI identity: what happens if the parent also passes \`.id(name)\`?`,
      think: [
        'Who is the source of truth for the string in the text field right now?',
        'What does a parent write during typing do to a Binding versus to a copied State?',
        'Why do two onChange handlers writing to each other loop?',
        'Is trimming on a timer a parent write the child should see live?',
      ],
      solution: `Pick **one** source of truth for the live keystrokes.

**Live binding (B)** when the parent must reflect every character (character count, enable Save, sibling preview):

\`\`\`swift
struct SettingsView: View {
    @State private var name = "Ada"
    var body: some View {
        NameEditor(name: $name)
        Text("\\(max(0, 20 - name.count)) left")
        Button("Save") { persist(name) }
    }
}
\`\`\`

Do not "normalize" \`name\` on a timer while the user is focused. Normalize on commit (Save, \`onSubmit\`, \`onDisappear\` if that is the product). Parent writes during typing fight the cursor.

**Local draft (A, done properly)** when the child is a modal editor with Cancel / Save, and the parent must not see half-typed state:

\`\`\`swift
struct NameEditor: View {
    @State private var draft: String
    var onSave: (String) -> Void
    var onCancel: () -> Void

    init(initial: String, onSave: @escaping (String) -> Void, onCancel: @escaping () -> Void) {
        _draft = State(initialValue: initial)
        self.onSave = onSave
        self.onCancel = onCancel
    }

    var body: some View {
        TextField("Name", text: $draft)
        Button("Save") { onSave(draft) }
        Button("Cancel") { onCancel() }
    }
}
\`\`\`

Do not \`onChange(of: initial)\` back into the draft unless the *identity* of the editor changed (a different user). If the parent reloads the same user from the network while you type, you must decide: discard the draft (hostile) or ignore the parent until Save (usually right).

**Never C.** Two sources writing each other: TextField → draft → name → onChange → draft, plus the parent's trim. You get cursor jumps, extra renders, and in the worst case a loop until the stack dies.

Never \`.id(name)\` on the field or the editor. That destroys identity every character (problem 2).`,
      explanation: `This one shows up as a possessed text field. You type a space, the parent trims it, the binding writes back, the cursor jumps to the end. Or you type into a "draft" that onAppear keeps resetting because the parent rebuilt the child. People reach for both \`@State\` *and* \`@Binding\` to "keep them in sync," which is how you get version C, two sources of truth in a knife fight.

\`@State\` is storage owned by this view identity. \`@Binding\` is a hole punched into someone else's storage. They are not two ways to write a string. They answer "who owns the live value?" If the character count outside the field must update as you type, the parent owns it and the child binds. If Cancel must throw away the edit, the child owns a draft and the parent only hears about Save. Both are valid products. Mixing them means every keystroke has two writers.

Version A with \`onAppear { draft = initial }\` is almost a draft, until the parent body re-runs and the child identity is unstable, or until \`onChange(of: initial)\` treats a trim as a new initial and overwrites the user's next character. \`onAppear\` is not "once in the app's life." It is "this view appeared," which SwiftUI is allowed to do more than once — Day 3's \`viewDidAppear\` in a different costume. Initialising \`@State\` from \`initial\` in \`init\` is the once-per-identity move, the same first-wins idea as \`@StateObject\`.

Version C's dual \`onChange\` is a feedback loop, the map region loop from problem 3. TextField writes draft, you write name, parent trims name, you write draft, TextField sees a new value, cursor policy kicks in. Bindings are live. They are not a merge algorithm.

The senior design in the interview is to say the ownership out loud, then pick A or B, then make parent writes during editing either impossible or explicit (an "external update, discard draft?" alert). Identity stays on the user id, not on the string.`,
      internals: `A \`Binding<String>\` is get/set closures. The TextField calls set on every character. That set is the parent's \`name = \`. Parent \`body\` re-runs. The child is recreated as a value; \`@Binding\` is re-wired to the same storage; \`@State draft\` is *not* reset if identity held. If identity did not hold (\`.id(name)\`, or the editor in a \`ForEach\` without id), \`@State\` is new and the field clears — problem 2 wearing a Binding hat.

\`onChange\` of a value that you yourself just wrote fires for your own write. Two onChanges that assign to each other are recursive updates. SwiftUI will try to coalesce; it will not save you from cursor resets.

TextField's internal selection state lives with the field's identity. Changing the bound string to a trimmed copy is a new value; selection usually snaps. That is why normalize-on-type is hostile even with a clean Binding.`,
      testing: `Type "Ada " with a trailing space. Assert the field still shows the space while focused, and that Save persists the trimmed value if that is the rule. Assert the remaining-character label matches the field *if* you chose live binding.

For the draft editor: type, tap Cancel, reopen, assert original. Type, have the parent apply a network refresh of \`initial\`, assert the draft is not overwritten (or that you showed a prompt — whatever you specced).

A test that \`.id(name)\` is not on the tree — snapshot the view hierarchy in a preview test, or just code review. The cursor-jump is the user-facing test.`,
      pitfalls: `Defaulting \`@State draft = initial\` as a property initializer when \`initial\` is a \`let\` that will change — property initializers cannot see \`self\` that way for bindings, and for \`let initial\` the \`= initial\` in the property wrapper is the init path; later changes to initial do not flow. Mixing that with onChange "to be safe."

Using \`@Binding\` for an optional and writing \`TextField(..., text: $name)\` where name is \`String?\` with a default — you need a custom Binding that maps nil. People then add State again.

Autosave-on-timer that writes the same string back through a formatter (\`PersonNameComponents\`) producing a slightly different unicode form. That is a trim-shaped fight even without spaces.`,
      alternatives: `\`@Observable\` draft model owned by the parent, passed Bindable to the child — still one source. UIKit \`UITextField\` in a representable if you need selection-level control; then you must not reset \`text\` in \`updateUIView\` unless the change came from outside (problem 3's idempotent update).

A reducer (TCA) with \`BindingReducer\` is a formal version of B. It is not required for a name field.`,
      tradeoffs: `Live binding is less code and worse for "Cancel should discard" unless the parent keeps an \`originalName\` copy. Draft State is more code and a stale-parent problem (the character count outside does not move until Save). Product should decide; architecture should not silently pick both.

Normalising on commit is slightly uglier UX (the space sits there until Save) and it does not fight the cursor. Normalising on every character looks tidy in a demo and fails in an interview the moment they type a combining mark.`,
      followups: [
        {
          q: 'Parent has @State name and passes name without $ to the child. What happens?',
          a: 'The child gets a copy (String is a value). Edits stay local or do not compile if the child expected Binding. You must pass $name for live writes.',
        },
        {
          q: 'Two children bound to the same $name?',
          a: 'Fine. One source. Both fields show the same string. Watch focus: typing in one updates the other live, which can move its cursor. Sometimes you still want a draft per field.',
        },
        {
          q: '@Bindable versus @Binding on an @Observable model?',
          a: '@Bindable projects Bindings into the model ($vm.name). @Binding is a single hole. Same ownership rule: the model is the source.',
        },
        {
          q: 'Should remaining-character count live in the child?',
          a: 'If only the editor cares, yes, and then a draft State is enough. If the parent chrome shows it, the parent needs the live value — Binding, or lift the draft to the parent.',
        },
        {
          q: 'onChange(of: initial) to reset the draft when opening a different user?',
          a: 'Use identity: NameEditor(...).id(user.id). State resets because it is a new view. That is cleaner than onChange of the string, which also fires for trims.',
        },
      ],
      teaches: [
        '@State owns, @Binding borrows',
        'One source of truth for live keystrokes',
        'Dual onChange is a feedback loop',
        'Normalize on commit, not on each character',
        '.id(name) destroys the field every keystroke',
        'Draft versus live is a product choice',
      ],
    },
    {
      id: 'd4-p5',
      title: 'Missing EnvironmentObject versus @Environment',
      difficulty: 'Senior',
      kind: 'Predict',
      prompt: `What happens at runtime for each of these, and which ones fail at compile time?

\`\`\`swift
@MainActor
final class Session: ObservableObject {
    @Published var user: User?
}

@Observable
final class Theme {
    var accent: Color = .blue
}

struct Avatar: View {
    @EnvironmentObject var session: Session
    var body: some View { Text(session.user?.name ?? "Guest") }
}

struct ScreenA: View {
    var body: some View {
        Avatar()
        // no .environmentObject
    }
}

struct ScreenB: View {
    @StateObject var session = Session()
    var body: some View {
        NavigationStack {
            Avatar()
        }
        .environmentObject(session)
    }
}

struct ScreenC: View {
    @StateObject var session = Session()
    var body: some View {
        NavigationStack {
            Avatar()
                .toolbar {
                    NavigationLink("Edit") { EditAvatar() }
                }
        }
        .environmentObject(session)
    }
}

struct EditAvatar: View {
    @EnvironmentObject var session: Session
    var body: some View { Text(session.user?.name ?? "") }
}

struct AccentDot: View {
    @Environment(\\.colorScheme) var scheme
    @Environment(Theme.self) var theme: Theme?
    var body: some View {
        Circle().fill(theme?.accent ?? .gray)
    }
}

struct ScreenD: View {
    var body: some View { AccentDot() } // no environment set
}
\`\`\`

The crash report from ScreenA is \`Thread 1: Fatal error: No ObservableObject of type Session found\`. A teammate "fixes" it by making \`Session.shared\`. Predict ScreenC's Edit screen. Predict ScreenD. Then design injection so a preview, a unit test, and a pushed destination all see a session without a singleton.`,
      think: [
        'Is @EnvironmentObject optional? What happens if the object is missing?',
        'Does a NavigationLink destination sit under the same environment as the view that created the link?',
        'How is @Environment(Theme.self) different from @EnvironmentObject, and from @Environment(\\.colorScheme)?',
        'Why does a singleton fix the crash and destroy tests?',
      ],
      solution: `**ScreenA:** crashes on first \`body\` of \`Avatar\`. \`@EnvironmentObject\` is a forced lookup. Missing means \`fatalError\`, not an empty user.

**ScreenB:** works. The object is inserted above \`Avatar\`.

**ScreenC:** historically a trap. A \`NavigationLink\` destination may be instantiated **outside** the tree you think, or in a way that drops custom environment depending on OS and whether you use the value-based \`navigationDestination\`. On modern APIs, putting \`.environmentObject(session)\` on the \`NavigationStack\` usually flows into pushed destinations — but \`toolbar { NavigationLink { EditAvatar() } }\` has been a known hole: the destination is constructed in a different part of the tree. Predict: **EditAvatar can crash the same way as ScreenA** even though ScreenB looked fine. Fix by attaching \`.environmentObject(session)\` to the destination, or using \`navigationDestination(isPresented:)\` / value-based navigation with the environment on the stack, and verifying on the OS you ship. Problem 7 is that path identity in detail.

**ScreenD:** does **not** crash. \`@Environment(\\.colorScheme)\` has a default from the system. \`@Environment(Theme.self) var theme: Theme?\` is optional; you used \`nil\` as gray. If you had written \`var theme: Theme\` without optional, Observation's environment lookup **crashes** similarly to EnvironmentObject when missing.

Design:

\`\`\`swift
@main
struct App: App {
    @StateObject private var session = Session()
    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
        }
    }
}

#Preview {
    Avatar().environmentObject(Session.preview)
}

// tests
let view = Avatar().environmentObject(Session.stubbed(user: .ada))
\`\`\`

Prefer \`@Environment(Session.self)\` with an optional or a dedicated \`SessionKey\` if you want a preview fallback. Do not use \`Session.shared\` to silence the crash. That is a hidden composition root in a process-wide singleton, and every test now shares login state.

\`@Environment(\\.dismiss)\`, \`\\.colorScheme\`, \`\\.locale\` are **keys with defaults**. \`@EnvironmentObject\` and a non-optional \`@Environment(MyType.self)\` are **required dependencies**. Treat the latter like constructor injection that SwiftUI performs, and fail in previews immediately if you forgot.`,
      explanation: `The crash is always a surprise because the screen worked in one navigation path. You open Avatar from the profile tab, fine. You open it from a toolbar link, death. The message says no \`ObservableObject\` of type \`Session\` was found. It is a missing argument. \`@EnvironmentObject\` is dependency injection through the tree, not a global lookup. If nobody above you called \`.environmentObject\`, there is no object. The wrapper does not synthesise a default \`Session()\`.

\`@Environment(\\.colorScheme)\` feels similar and is not. System keys have values at the root of every window. Your \`Session\` does not. That is why a teammate can "use Environment instead of EnvironmentObject" and still crash: the Observation-era \`@Environment(Session.self)\` is the same required lookup when the type is non-optional. The optional form is the one that lets a preview render a gray dot instead of dying, which is a deliberate degraded mode, not a free pass to forget injection in production.

Navigation is where this becomes an interview problem. Environment flows down the tree *as actually built*. Toolbars, sheets, and some \`NavigationLink\` destination closures have a long history of being constructed in a parallel place that did not inherit your modifiers. You inject at the \`NavigationStack\` and assume the universe received it. The destination did not. The fix is not a singleton. The fix is to put the object on the \`WindowGroup\`, prefer value-based destinations, and **open the destination in a preview and in the real navigation path before you call it done**. Sheets need the environment attached to the sheet content if you hit a version that does not inherit (problem 10).

Singletons silence the crash because lookup never fails. They also couple every preview, every test, and every extension target to one session. You cannot present "logged-out Avatar" next to "logged-in Avatar" without mutating a global. That is the same gravity well as \`URLSession.shared\` in a view model. Environment is the SwiftUI-shaped composition root. Use it like one: explicit at the app entry, explicit in previews, absent in the row that only needed a \`User\` value.`,
      internals: `\`@EnvironmentObject\` stores a key based on the object's type. Lookup walks ancestors. Failure is \`fatalError\` on access, which is usually first \`body\`. It is not optional internally; the optional variant people invent with a custom EnvironmentKey is a different wrapper.

\`@Environment(\\.keyPath)\` uses \`EnvironmentValues\`, a collection of keys with default values. You can add your own key with a default of \`nil\` or a stub. That default is how ScreenD's color scheme works.

\`@Environment(Theme.self)\` (Observation) looks up the type in the environment. Optional versus non-optional is the crash switch. \`.environment(theme)\` inserts it. This is the replacement for EnvironmentObject when the type is \`@Observable\` rather than \`ObservableObject\`. Mixing EnvironmentObject with an \`@Observable\` class is the wrong wrapper.

Sheets and navigation destinations are separate presentations. Inheritance improved across iOS versions and is still worth a test. \`environmentObject\` must be re-applied when a framework bug drops it; that is ugly and better than a singleton.`,
      testing: `A preview for \`Avatar()\` without environment should fail in development if you want the crash to be loud — or you provide \`Session.preview\` so designers can work. Both are valid; pick one and make CI use the same entry.

UI test: navigate through the toolbar link, assert the edit screen shows the name. That path is the one that crashes.

Unit test: \`let s = Session(); s.user = .ada; let v = Avatar().environmentObject(s)\` and inspect, or test the VM not the view. Do not boot the app singleton in unit tests.

A debug helper in DEBUG: if session is missing, \`assertionFailure\` with a message that names the screen, before production \`fatalError\`. You still want the crash in prod if injection is wrong; a silent Guest is a security bug on a payments screen.`,
      pitfalls: `\`Session.shared\` as the fix. Injecting in \`ScreenB\` but not at \`App\`, so a new \`WindowGroup\` (iPad, shortcut) crashes. Using \`@EnvironmentObject\` in a UIKit-hosted \`UIHostingController\` without \`hostingController.rootView.environmentObject(session)\`. Creating a new \`Session()\` in the preview every keystroke via a View that allocates in body.

Optional environment that returns a stub Session in production, so you never notice the real one was not injected and you show Guest on a screen that can spend money.`,
      alternatives: `Pass \`session\` as an \`@ObservedObject\` parameter. It is more honest, noisier at every call site, and cannot fall out of a NavigationLink as easily — unless the link's destination is a type that allocated its own. Constructor injection for SwiftUI is still allowed.

A small \`AppEnvironment\` struct of values (not one god object) in a custom EnvironmentKey, if you are passing four things. Not a replacement for the session's observable invalidation.`,
      tradeoffs: `EnvironmentObject reduces parameter noise on deep trees and makes missing injection a crash instead of a compile error. Parameters make the dependency visible in the type. For a session used by 40 screens, environment at the window is the practical choice; for a single editor, pass the VM.

Optional environment is safer for previews and easier to ship a silent wrong UI. Non-optional is louder. Payments, session, and permissions should be loud. Theme accent can be gray.`,
      followups: [
        {
          q: 'Why did the preview work and the toolbar destination crash?',
          a: 'The preview injected. The destination did not inherit. Previews are not the navigation path.',
        },
        {
          q: '@StateObject in the App versus in the root View?',
          a: 'App-level @StateObject (or @State + @Observable) outlives the root view identity. Root-level is fine if the root identity is stable. A root that resets on login flicker will drop the session.',
        },
        {
          q: 'Can you environmentObject two objects of the same type?',
          a: 'No — keyed by type. You get the nearest one. Need two sessions? Wrapper types, or do not use EnvironmentObject.',
        },
        {
          q: 'UIViewControllerRepresentable inside Avatar — does the UIKit child see Session?',
          a: 'Not automatically. Environment is SwiftUI. Pass what you need into makeUIViewController, or read it in the representable and forward. Interop is explicit (problem 3).',
        },
        {
          q: '@Environment(\\.self) tricks to copy all values into a sheet?',
          a: 'There are workarounds to pass EnvironmentValues into presentations. Prefer attaching the specific objects you need. Copying everything hides the dependency again.',
        },
      ],
      teaches: [
        'EnvironmentObject is required DI, not a global',
        'System Environment keys have defaults',
        '@Environment(Type.self) can still crash if non-optional',
        'Navigation and sheets can drop environment',
        'Singletons hide the crash and poison tests',
        'Inject at the window, verify the destination path',
      ],
    },
    {
      id: 'd4-p6',
      title: 'Migrated to @Observable, rows still redraw',
      difficulty: 'Expert',
      kind: 'Performance',
      prompt: `You migrate the feed VM off \`ObservableObject\` because problem 1 taught the team that \`objectWillChange\` is a broadcast.

\`\`\`swift
@Observable
final class FeedVM {
    var posts: [Post] = []
    var tick: Date = .now
    var likes: [Post.ID: Int] = [:]

    init() {
        Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            self?.tick = .now
        }
    }
}

struct FeedView: View {
    @State var vm = FeedVM()
    var body: some View {
        List(vm.posts) { post in
            PostRow(vm: vm, post: post)
        }
    }
}

struct PostRow: View {
    var vm: FeedVM
    let post: Post
    var body: some View {
        VStack(alignment: .leading) {
            Text(post.author)
            Text(post.createdAt, format: .relative(tick: vm.tick))
            Text("\\(vm.likes[post.id] ?? 0) likes")
            Image(uiImage: post.decodedFullRes) // still here
        }
    }
}
\`\`\`

Instruments: every second, every \`PostRow.body\` runs. A like on one post still invalidates more than one row. The team says Observation is broken.

Explain what each view *read*, why that registers a dependency, how this differs from \`ObservableObject\`, and redesign so \`tick\` can move without decoding 1 000 images. When is \`@Observable\` worth the migration, and when is it a fashion?`,
      think: [
        'Which properties of FeedVM did PostRow.body read?',
        'Does List(vm.posts) also subscribe FeedView to posts, and what happens when likes change?',
        'If PostRow did not touch vm.tick, would the timer still redraw the row?',
        'Where should decodedFullRes live if Observation is not a magic barrier?',
      ],
      solution: `Observation is working. You subscribed every row to \`tick\` and to the whole \`likes\` dictionary.

Redesign:

\`\`\`swift
@Observable
final class PostRowModel {
    var post: Post
    var likeCount: Int
    var relative: String
}

@Observable
final class FeedVM {
    var rows: [PostRowModel] = []
    private var timer: Timer?

    func like(_ id: Post.ID) {
        guard let row = rows.first(where: { $0.post.id == id }) else { return }
        row.likeCount += 1
    }

    func startTicking() {
        timer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            self?.rows.forEach { $0.relative = format($0.post.createdAt, relativeTo: .now) }
        }
    }
}

struct PostRow: View {
    var model: PostRowModel
    var body: some View {
        VStack(alignment: .leading) {
            Text(model.post.author)
            Text(model.relative)
            Text("\\(model.likeCount) likes")
            PostThumbnail(url: model.post.thumbURL)
        }
    }
}
\`\`\`

Rules:

1. **A view depends on what \`body\` reads.** \`vm.tick\` in the row means every tick invalidates that row. Remove the read, lose the dependency.
2. **Reading \`vm.likes[post.id]\` still observes the \`likes\` property** (the dictionary). Mutating any key can invalidate every reader of \`likes\`. Store the count on the row model.
3. **\`List(vm.posts)\` in the parent observes \`posts\`.** Replacing the array redraws the list structure. Mutating a field inside a class in the array is a different story than replacing the array — prefer row models that are themselves observable, so a like does not rebuild the \`List\` input.
4. **Images still do not belong in \`body\`.** Observation does not downsample JPEGs.
5. **Tick at the granularity you need.** "2m ago" can update every 30 seconds, and only the text, not the thumbnail.

Migrate to \`@Observable\` when you have wide objects and you are willing to *narrow reads*. Migrating and passing the same god VM into every row is fashion.`,
      explanation: `The team did the migration, Instruments still looks like problem 1, and trust in the new framework falls through the floor. This is the hour you earn in the interview. Observation did not fail. You asked it, politely, to wake every row every second.

\`ObservableObject\` was a smoke alarm for the whole building: any \`@Published\` fire, every listener's \`body\` runs. \`@Observable\` is a smoke alarm per room — per property — but only for rooms you walked into. \`body\` is how you walk in. \`Text(..., tick: vm.tick)\` walks into the \`tick\` room. A timer that writes \`tick\` every second is a fire in that room. Every row that read \`tick\` redraws. That is correct. It is also the old broadcast, with a smaller wire, because you ran the wire into every row on purpose.

The likes dictionary is the less obvious walk. You wanted \`likes[post.id]\`. The language does not give you a subscription to "this key." You touched the \`likes\` property. A like on someone else's post mutates that property. Readers redraw. Fine-grained Observation is not fine-grained *inside* a dictionary or an array of structs unless you design types that way. An observable \`PostRowModel\` per row is that design: writing \`row.likeCount\` invalidates the row that read \`likeCount\`, not the neighbour.

The parent still matters. \`List(vm.posts)\` reads \`posts\`. If \`like\` also replaces \`posts\` with a new array, the list rebuilds even when rows are perfect. Classes as row models give you reference semantics Observation can track field-by-field. Structs are nicer if the parent passes \`likeCount\` as a value so the row never meets the VM.

You still decode a full-res JPEG in \`body\`, so even a legitimate redraw is expensive. Observation reduces how often \`body\` runs. It does not make \`body\` free. Stop reading \`tick\` in the heavy view, put the image in a view that does not read the timer, then decide if the VM should be \`@Observable\` at all. A screen VM with two properties often wanted a value passed down, not a new framework.`,
      internals: `The Observation framework records accesses while a view's \`body\` (or a tracking scope) runs, via \`withObservationTracking\`. Each read of a stored property on an \`@Observable\` class registers the current observer. Writes to that property notify those observers. There is no \`objectWillChange\` unless you still mix in \`ObservableObject\`.

Access patterns:

* \`vm.tick\` — depends on \`tick\`.
* \`vm.likes[id]\` — depends on \`likes\` (the whole value).
* \`vm.posts[i].title\` if \`Post\` is a struct inside an array — typically depends on \`posts\`, because the struct is not itself observable.
* \`row.likeCount\` if \`row\` is an \`@Observable\` class — depends on that instance's \`likeCount\`.

\`@State var vm = FeedVM()\` owns the instance (problem 2). Passing \`vm\` into \`PostRow\` as \`var vm: FeedVM\` does not copy the class; it passes a reference. The child's \`body\` reads are what matter, not the wrapper on the parent.

Timer retains its target. \`[weak self]\` is required or the VM never dies (Day 1). Invalidate the timer when the screen goes away or you tick in the background forever.`,
      testing: `DEBUG body counters on \`PostRow\` and on a tiny \`RelativeTimeLabel\` sibling. After the fix, the timer increments the label counter, not the row counter. A like on id 47 increments one row counter.

The SwiftUI instrument: attribute updates to \`tick\` versus \`likeCount\`. If everything still attributes to \`tick\`, you missed a read — a helper like \`format(post, vm: vm)\` that touches \`tick\` inside.

A unit test on \`PostRowModel\`: mutate neighbour's likeCount, assert this model's likeCount unchanged and (if you have a tracking test harness) this observer did not fire. Do not unit-test the Observation runtime itself; unit-test your boundaries.`,
      pitfalls: `Computed properties on the VM that read \`tick\` and \`likes\` and \`posts\`, then the row reads \`vm.rowViewModel(for: post)\` — you just subscribed to everything the computed touched. Computed reads count.

\`@Bindable var vm\` in the row "for convenience." Same reads.

Leaving \`decodedFullRes\` as a stored property on \`Post\` that you rebuild when likes change because \`Post\` is a new struct each time. You moved the decode to the mapper and still do it too often.

Timer on 1 second for relative dates that display in minutes. You paid 60× the invalidations for no user-visible change.`,
      alternatives: `Do not migrate. Keep \`ObservableObject\`, stop passing it into rows, pass values. That already fixes problem 1. \`@Observable\` is worth it when many views legitimately share one object and read disjoint properties (a chrome bar reads \`banner\`, the list does not).

A dedicated \`RelativeTimeLabel: View\` with \`TimelineView(.periodic(from:by:))\` so SwiftUI owns the cadence and only that subtree updates. Often cleaner than a VM timer.

UICollectionView if the row is still a video player after the Observation work (Day 3). Different problem.`,
      tradeoffs: `Per-row observable models: more objects, more memory, precise invalidation, slightly harder identity (the model must live as long as the row, owned by the VM, not allocated in \`body\`). Passing values: fewer objects, redraw when the parent passes a new struct even for an unchanged row — Equatable rows can skip \`body\`. For a like count integer, values are enough. For a row with in-flight follow requests, a small class is calmer.

Migrating a huge \`ObservableObject\` graph to \`@Observable\` in one PR is a fashion release. Migrating the feed VM when you are already rewriting the row boundary is a rounding error.`,
      followups: [
        {
          q: 'Will @Observable fix objectWillChange in UIKit still observing the VM?',
          a: 'UIKit does not auto-subscribe. You still use withObservationTracking or Observation.Apply to poke setNeedsLayout. Migration is not a UIKit free lunch.',
        },
        {
          q: 'Why did likes[post.id] redraw a row that did not like?',
          a: 'The row observed the dictionary property, not a per-key publisher. Split the value onto a per-row model or pass the Int in.',
        },
        {
          q: 'List(vm.posts) versus List { ForEach(vm.rows) }?',
          a: 'Both read the collection from the parent. Prefer ForEach over identifiable row models so the parent is not also reading a giant struct array of JPEGs.',
        },
        {
          q: 'Is reading vm in onAppear a dependency?',
          a: 'onAppear is not body. It does not subscribe the same way. A timer you start in onAppear still needs to write something body reads, or nothing redraws — which is how people then stuff tick into body. Prefer .task (problem 8).',
        },
        {
          q: 'Should tick live in the environment?',
          a: 'An environment Date that updates every second recreates the problem for every view that reads it. Environment is not a bypass of Observation granularity. Keep time in the smallest view that displays it.',
        },
        {
          q: 'When is ObservableObject still the right wrapper?',
          a: 'When you already have Combine pipelines and @Published and the object is not passed into lists. Do not migrate for the blog post. Migrate when you need per-property reads and you will police those reads in review.',
        },
      ],
      teaches: [
        'Observation tracks property reads in body',
        'Reading tick in a heavy row is a broadcast you opted into',
        'Dictionary and array reads are coarse',
        'Per-row models isolate likes from neighbours',
        '@Observable is not a substitute for cheap body',
        'Migrate when you will narrow reads, not for fashion',
      ],
    },
    {
      id: 'd4-p7',
      title: 'NavigationStack path, then the wrong screen is still there',
      difficulty: 'Senior',
      kind: 'Debug',
      prompt: `A shop app. Tapping a product pushes \`ProductDetail\`. Deep link to a product sometimes no-ops. After login, the stack resets to root even though \`path\` still has values. \`@State\` inside \`ProductDetail\` (selected SKU) resets when the product's stock count updates from a websocket.

\`\`\`swift
enum Route: Hashable {
    case product(Product)
    case cart
}

struct Shop: View {
    @State var path = NavigationPath()
    @State var products: [Product] = []

    var body: some View {
        NavigationStack(path: $path) {
            List(products) { p in
                NavigationLink(value: Route.product(p)) { Text(p.name) }
            }
            .navigationDestination(for: Route.self) { route in
                switch route {
                case .product(let p): ProductDetail(product: p)
                case .cart: CartView()
                }
            }
        }
        .onChange(of: products) { _, new in
            // "keep the path honest"
            path = NavigationPath(new.prefix(path.count).map { Route.product($0) })
        }
    }
}

struct ProductDetail: View {
    let product: Product
    @State private var sku: SKU?
    var body: some View { /* picker bound to sku */ }
}
\`\`\`

\`Product\` is \`Hashable\` by all fields, including \`stock\`. Login sets \`products = []\` then reloads. What is the identity of a pushed screen, where must \`navigationDestination\` live, and why did rewriting \`path\` pop people?`,
      think: [
        'If Product’s Hashable includes stock, what happens to a Route.product in the path when stock changes?',
        'Does navigationDestination on the List apply to views already pushed, or only to that List’s identity?',
        'What does replacing NavigationPath do to the pushed views’ @State?',
        'Value-based NavigationLink versus NavigationLink { Destination() } — which builds the destination early?',
      ],
      solution: `Navigate by **stable ids**, not by whole models. Register destinations on the **stack**, not on a child that can disappear. Do not rebuild \`path\` unless you intend to pop.

\`\`\`swift
enum Route: Hashable {
    case product(Product.ID)
    case cart
}

struct Shop: View {
    @State private var path: [Route] = []
    @State private var store = CatalogStore()

    var body: some View {
        NavigationStack(path: $path) {
            List(store.products) { p in
                NavigationLink(p.name, value: Route.product(p.id))
            }
            .navigationDestination(for: Route.self) { route in
                switch route {
                case .product(let id):
                    ProductDetail(productID: id, store: store)
                case .cart:
                    CartView()
                }
            }
        }
    }
}

struct ProductDetail: View {
    let productID: Product.ID
    var store: CatalogStore
    @State private var sku: SKU?

    var body: some View {
        let product = store.product(id: productID)
        // sku state lives with this view identity, which is the Route, which is the id
    }
}
\`\`\`

Rules:

1. **Path values are identity.** If \`Hashable\` / \`==\` of a route changes (stock on \`Product\`), SwiftUI may treat it as a different destination: pop + push, \`@State\` gone, \`.task\` cancelled (problem 8).
2. **Typed \`[Route]\`** over type-erased \`NavigationPath\` when you own the routes. Easier to debug, log, and restore. \`NavigationPath\` is for mixed modules.
3. **\`navigationDestination(for:)\` on the stack's root**, stable. Nested destinations on a row vanish when the row leaves a lazy stack — push then fails, or the destination closure is the wrong one.
4. **Do not reconstruct \`path\` from \`products\`.** Login emptying the catalog is not a pop. Update the store; leave the path as ids.
5. **Deep links append ids** you can resolve. If the product is not loaded yet, push a placeholder route and resolve in the detail's \`.task(id:)\`, do not no-op because \`products\` was empty in \`onChange\`.

Eager \`NavigationLink { ProductDetail(product: p) }\` still exists and still builds destinations too early in lists. Prefer \`value:\`.`,
      explanation: `The websocket updates stock, and the SKU picker snaps back to nil. It feels like problem 2, because it is problem 2: identity changed. You put a whole \`Product\` in the path. \`Hashable\` included \`stock\`. The path's value is no longer equal to what is on the stack. SwiftUI's navigation identity is that value. It tears down \`ProductDetail\` and builds another. \`@State sku\` dies with it. You did not pop. The stack did a replace that looks like a reset.

Rewriting \`path\` on every \`products\` change is the second, louder version. Login sets \`products = []\`, \`onChange\` builds a new \`NavigationPath\` from an empty prefix, and everyone is at root. The values you thought you preserved were not the same instances, and \`prefix(path.count)\` on an empty array is empty. Path is not a derived property of the catalog. It is user history. Treat it like a back stack, not like a snapshot of the table.

Destination registration is the deep-link no-op. \`navigationDestination\` attached to a \`List\` inside a lazy container is easy to get wrong: the modifier's lifetime is the root content, which is usually fine, until someone moves it onto a row or a tab child that is not in the tree when the path is restored. The stack asks for a destination for \`Route\` and nobody is listening. Path has values, UI shows root. Same class of bug as problem 5's toolbar \`NavigationLink\` dropping environment: the destination is not where you think in the tree.

Stable ids in the path, models in a store, state in the destination keyed by that id. That is the whole design.`,
      internals: `\`NavigationStack(path:)\` diffs the path. Each element is a pushed layer. Equality of the element is the identity of that layer. \`NavigationPath\` boxes \`Hashable\` existentials; two boxes of different types can coexist, and logging is miserable. A typed array is a normal \`Equatable\` value.

\`navigationDestination(for: Route.self)\` is a registry on a view in the stack's content. The stack looks up the type of the next path element. Missing registry: no push. Two registries for the same type: last / inner wins depending on OS — do not.

\`NavigationLink(value:)\` writes into the path. \`NavigationLink(destination:)\` is the old eager tree. In a 1 000-row list (problem 1) eager destinations are a body tax and a state tax.

State restoration: you can Codable the typed path if the cases are ids. You cannot Codable a \`Product\` with a live image blob and call it a route.`,
      testing: `Push a product, mutate \`stock\` on the store, assert the detail's SKU \`@State\` is intact and \`makeUIView\` counters on any representable inside stay 1.

Login: empty then fill \`products\`, assert \`path\` still equals the ids you had.

Deep link before catalog load: set path to \`[.product(id)]\`, then load products, assert detail appears and does not pop.

UI test: toolbar / nested destination still pushes (problem 5's path).`,
      pitfalls: `\`path.append(product)\` where product is a class without \`Hashable\` by id — identity is pointer, websocket replacement is a new object, same pop. Using \`NavigationPath()\` in \`body\` as a \`let\` instead of \`@State\`. \`navigationDestination\` inside a \`sheet\` that you expected the stack to see. Mixing \`NavigationView\` and \`NavigationStack\`.

\`.id(product.stock)\` on the detail "to refresh" — you opted into the reset.`,
      alternatives: `Coordinator / router object that owns \`[Route]\` and is injected (problem 5). UIKit \`UINavigationController\` when the stack is deep, mixed with representables, and you are tired — Day 3 containment, not a SwiftUI sin.

\`navigationDestination(item: $selectedProduct)\` for a single optional push without a full path, still keyed by id.`,
      tradeoffs: `Ids in the path mean the detail must look up a model that might be gone (deleted product). Handle missing. Whole models in the path mean you can show stale data offline and you will reset on any field you hashed. Ids win.

Typed arrays cannot mix module-unknown destinations. \`NavigationPath\` can. Use the eraser at a module boundary, not inside Shop.`,
      followups: [
        {
          q: 'Why did programmatic path.append not push?',
          a: 'No navigationDestination for that type in the current tree, or you appended a type the switch does not handle. Log the path types.',
        },
        {
          q: 'NavigationLink in a List versus button { path.append }?',
          a: 'Both are valid. Button is easier to debug. Link gives you row chevrons. Same path identity rules.',
        },
        {
          q: 'Does popping via path.removeLast cancel .task on the detail?',
          a: 'Yes. Disappear cancels .task. That is why problem 8 exists. State is gone too unless you lifted it.',
        },
        {
          q: 'Split view / column navigation?',
          a: 'NavigationSplitView has its own selection identity. Still use ids. Do not share a NavigationPath between column and stack without a design.',
        },
        {
          q: 'Hashable on Route.product(Product) using only id, but Product still Equatable by all fields?',
          a: 'Hashable and Equatable must agree. If == uses stock and hash uses id, you have a Hashable contract bug and mysterious set behaviour. Hash and equal the id only, or do not put Product in the route.',
        },
      ],
      teaches: [
        'Path values are the identity of pushed screens',
        'Hashable routes must be stable ids, not live models',
        'navigationDestination lives on the stack',
        'Do not derive path from a catalog reload',
        'Eager NavigationLink destinations tax lists',
      ],
    },
    {
      id: 'd4-p8',
      title: '.task(id:) versus onAppear { Task }',
      difficulty: 'Senior',
      kind: 'Debug',
      prompt: `A profile screen loads the user, then a second request loads orders. Fast taps through a list of users: orders from user A appear on user B. Popping mid-load still writes to the VM. Instruments shows overlapping \`URLSession\` tasks.

\`\`\`swift
struct Profile: View {
    let userID: User.ID
    @ObservedObject var vm: ProfileVM

    var body: some View {
        List(vm.orders) { order in Text(order.sku) }
            .onAppear {
                Task {
                    await vm.loadUser(userID)
                    await vm.loadOrders(userID)
                }
            }
            .onChange(of: userID) { _, id in
                Task { await vm.loadOrders(id) }
            }
    }
}
\`\`\`

The VM is parent-owned and reused across users (good, problem 2). Rewrite the lifecycle so work is cancelled on disappear *and* when \`userID\` changes. Why is \`.task { }\` not enough, and what does \`.task(id: UUID())\` do?`,
      think: [
        'Does a Task created in onAppear cancel when the view disappears?',
        'If userID changes without a disappear, is onAppear called again?',
        'What does SwiftUI cancel when the id of .task(id:) changes?',
        'If the VM is shared, is cancellation enough, or can a late finish still write?',
      ],
      solution: `\`onAppear { Task { } }\` starts unstructured work that **SwiftUI will not cancel**. \`.task { }\` cancels on disappear, but **not** when \`userID\` changes on the same identity. \`.task(id: userID)\` is the one that matches "this screen means this user."

\`\`\`swift
struct Profile: View {
    let userID: User.ID
    @ObservedObject var vm: ProfileVM

    var body: some View {
        List(vm.orders) { order in Text(order.sku) }
            .task(id: userID) {
                await vm.load(userID)
            }
    }
}

@MainActor
final class ProfileVM: ObservableObject {
    private var loadedID: User.ID?
    var orders: [Order] = []

    func load(_ id: User.ID) async {
        loadedID = id
        orders = []
        let user = try? await api.user(id)
        guard loadedID == id, !Task.isCancelled else { return }
        let orders = (try? await api.orders(id)) ?? []
        guard loadedID == id, !Task.isCancelled else { return }
        self.orders = orders
    }
}
\`\`\`

Rules:

1. **\`.task(id:)\`** is appear + change + cancel. Use it for loads bound to an identity.
2. **Still guard the write** with the id and \`Task.isCancelled\`. Cancellation is cooperative; a finish can race the next task the way Day 2's search races, and the way Day 3's avatar completion races.
3. **Do not \`.task(id: UUID())\`.** That is \`.id(UUID())\` for work: cancel and restart every body.
4. **\`.task { }\` without id** is correct for "once per appearance of this identity" (start a stream, stop on pop). It is wrong for a reused view with a new \`userID\`.
5. **onAppear** for things that are not tasks (analytics you already de-duplicated on Day 3). Not for network.

If the parent passes a new \`Profile(userID:vm:)\` with the same identity (no \`.id(userID)\` on Profile), \`.task(id: userID)\` still restarts. That is the point. You do not need to destroy the view's \`@State\` to reload.`,
      explanation: `You flicked from Ada to Omar. Ada's orders request was slower. It landed second. The list is Ada's on Omar's header. Day 2, in a SwiftUI costume. The extra twist is lifecycle: \`onAppear\` ran for Ada. Navigating to Omar on the *same* \`Profile\` identity — path replaced the id (problem 7) without popping the view — does not appear again. \`onChange\` started a second \`Task\` and left the first one running. Two writers, one VM.

\`.task\` was added because this incident was a national sport. SwiftUI starts a task when the view appears and **cancels the task when the view disappears**. That is the structured concurrency hook UIKit never had on \`viewDidDisappear\`. It is not a dependency tracker. Change \`userID\` on a view that stayed appeared, and the original \`.task { }\` keeps going with the captured id. \`.task(id: userID)\` cancels that task and starts another. The \`id\` is the same idea as cell reuse: the slot is the view, the meaning is the id.

Cancellation is not a fence around your VM. \`await\` returns with \`CancellationError\` if you check, or it returns a value if the request ignored cancel. URLSession tasks are cancellable if you used the structured API; a detached \`Task.detached\` in the VM is not. Guard \`loadedID == id\` on every hop back to MainActor, the same \`itemID == capturedID\` as Day 3 problem 1.

\`.task(id: UUID())\` is how you DDoS yourself. Body runs, new UUID, cancel the load, start the load, body runs again. Hitching plus never-finished requests.`,
      internals: `\`.task\` uses the view's lifetime in the graph. Appear starts; disappear cancels via \`Task.cancel()\`. \`.task(id:)\` additionally tracks the \`Equatable\` id with the same storage table as \`onChange\`. Changing id is cancel-then-start, not overlap, unless the previous task ignores cancel.

\`onAppear\` / \`onDisappear\` can fire more than once for a given identity (lazy stacks, tab switches, some navigation). Pairing them with unstructured \`Task\` is how you double-load and never cancel. \`.task\` is coalesced to the actual presence in the graph more reliably, and still not a place to skip the id guard.

The action of \`.task\` is not a subscription the way \`body\` reads are. It will not re-run because an \`@Observable\` property changed unless that property is the \`id\` you passed. Do not stuff \`vm.tick\` into the task id.`,
      testing: `Fake API with a controllable continuation. Appear as Ada, start load, switch to Omar, complete Ada, assert orders are Omar's or empty — never Ada's. Pop while in flight, complete, assert VM was not written (or was cleared on cancel — spec it).

Assert cancel is called on the fake session when id changes.

A test that \`.task(id: UUID())\` is not in the tree — code review — plus a body-counter that would otherwise loop.`,
      pitfalls: `\`Task { await vm.load() }\` inside \`.task { }\` — nested unstructured, inner is not cancelled. \`Task.detached\` in the VM. Using \`onDisappear { Task { cancel } }\` that starts *more* work.

Putting the load in \`init\` of the view struct — inits run often (problem 2). Putting it in \`init\` of a \`@StateObject\` VM that is not recreated for the new user — stale user, the inverse bug.`,
      alternatives: `\`.onChange(of: userID) { Task ... }\` plus \`onAppear\` is the pre-\`.task(id:)\` spelling and easy to get overlapping. A VM \`start(id:)\` that cancels its own \`Task\` internally (Day 2 search). Both can work; \`.task(id:)\` keeps the lifetime next to the view that owns the meaning.

UIKit: cancel in \`viewWillDisappear\` / \`prepareForReuse\`. Same contract, different hook.`,
      tradeoffs: `Restarting the whole load on every id change is correct and can flicker a placeholder. Debouncing id changes (search field as id) is a product choice. Sharing one VM across users is less allocation and more guard. A VM per user identity is problem 2's child-owned object and resets cleanly; you still cancel the network.`,
      followups: [
        {
          q: '.task versus .onAppear for analytics?',
          a: 'Analytics wants once per logical screen (Day 3). .task can re-run if the view reappears. Use a dedicated tracker, not a network-shaped task.',
        },
        {
          q: 'Does .task(id: userID) re-run if the same id is set again?',
          a: 'No. Equatable equal, no restart. Push a refresh with .refreshable or an explicit Task from a button.',
        },
        {
          q: 'Two .task(id:) modifiers on one view?',
          a: 'Both run. Fine for independent streams. Do not start the same load twice.',
        },
        {
          q: 'List row .task { load thumbnail }?',
          a: 'Cancels when the row leaves the lazy container — good. Still downsample off main, still id-guard. Prefer an image pipeline with reuse cancel (Day 3) if you need a budget.',
        },
        {
          q: 'refreshable plus .task(id:)?',
          a: 'refreshable is a separate task from a gesture. Share the VM load method; both must cancel-and-replace, not stack.',
        },
      ],
      teaches: [
        'onAppear Task is unstructured and not cancelled',
        '.task cancels on disappear, not on input change',
        '.task(id:) is identity-shaped cancellation',
        'Still guard writes; cancel is cooperative',
        '.task(id: UUID()) restarts every body',
      ],
    },
    {
      id: 'd4-p9',
      title: 'GeometryReader writes a PreferenceKey until layout explodes',
      difficulty: 'Senior',
      kind: 'Incident',
      prompt: `A card that should be "as tall as its image, plus a caption." In production it grows until the scroll view is megapoints tall, or it flickers between two heights, or Instruments shows layout looping (Day 3 problem 5, in SwiftUI).

\`\`\`swift
struct HeightKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}

struct Card: View {
    @State private var height: CGFloat = 0
    var body: some View {
        GeometryReader { geo in
            VStack {
                Image(.hero).resizable().scaledToFit()
                Text("caption")
            }
            .frame(width: geo.size.width)
            .background(
                GeometryReader { inner in
                    Color.clear.preference(key: HeightKey.self, value: inner.size.height)
                }
            )
        }
        .frame(height: height)
        .onPreferenceChange(HeightKey.self) { height = $0 + 16 }
    }
}
\`\`\`

Why does this loop? What does \`GeometryReader\` propose, what does a PreferenceKey do during layout, and what is the 2024 way to measure without a feedback cycle?`,
      think: [
        'What size does GeometryReader take if the parent does not constrain it?',
        'If onPreferenceChange writes @State, does that invalidate body and start layout again?',
        'When is reduce called with multiple children, and is 0 a safe default?',
        'Is writing height = $0 + 16 a fixed point, or does it grow forever?',
      ],
      solution: `\`GeometryReader\` is greedy: it takes all space the parent offers. You then set the parent's height from a child measurement that *includes* the padding you add in \`onPreferenceChange\`. Next pass, the reader has more height, reports more, you add 16 again. That is not a fixed point. It is a loop.

Also: \`GeometryReader\` as the outer card makes the card expand in the scroll view's unbounded height, so the first reported height is already "everything," not the image.

Do not drive \`@State\` height from a preference that depends on that height.

\`\`\`swift
struct Card: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(.hero)
                .resizable()
                .scaledToFit()
            Text("caption")
        }
        .padding(.bottom, 16)
    }
}
\`\`\`

If you truly must measure (align several cards to the tallest):

\`\`\`swift
struct HeightKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = max(value, nextValue())
    }
}

// Child reports, parent applies as minHeight on a *different* view, or once
.background {
    GeometryReader { geo in
        Color.clear.preference(key: HeightKey.self, value: geo.size.height)
    }
}
.onPreferenceChange(HeightKey.self) { measured in
    if abs(measured - height) > 0.5 { height = measured }
}
\`\`\`

Rules:

1. **Prefer intrinsic layout.** Stacks and \`scaledToFit\` already size the card. Measurement is for alignment across siblings, not for the card to learn its own height.
2. **Never add a constant on every preference callback** that the next layout will include.
3. **Guard \`onPreferenceChange\`** with a threshold so floating layout does not chatter \`@State\`.
4. **\`reduce\` must be commutative.** Overwriting with \`nextValue()\` drops siblings; \`max\` is the usual height-report.
5. **\`Layout\` protocol / \`containerRelativeFrame\` / \`visualEffect\`** on modern OS for many measurement hacks. \`ViewThatFits\` when you are choosing a size class, not inventing one.

\`background { GeometryReader }\` is the safe *reader* because it proposes the child's already-chosen size. Outer \`GeometryReader\` is the greedy *taker*.`,
      explanation: `The scroll view got longer every frame until the process died or the user gave up. PreferenceKey tutorials taught a generation to measure views by writing height into \`@State\`. That is a feedback loop with extra steps — problem 4's dual onChange, problem 3's region binding, Day 3's \`layoutSubviews\` invalidating itself. Layout produces a preference, preference writes state, state changes the layout inputs, layout runs again.

\`GeometryReader\` makes it explosive because of what it *proposes*. In a \`VStack\` or a \`ScrollView\`, height is often unbounded. The reader expands to fill, reports a huge number, you lock the frame to that huge number, and you have a full-screen card that thought it was wrapping an image. Putting a second reader in the background to "get the real height" still reports a value that you then pad and feed back. \`height = $0 + 16\` cannot converge if the 16 is inside the thing you measure.

The senior move is to ask why you are measuring at all. An image with \`scaledToFit\` and a caption in a \`VStack\` already has a height. You measure when *another* view needs that number — equal-height cards in a row, a sticky header that matches content. Then the preference must be a report, and the state write must not change the reported view's size, or must converge (set \`minHeight\` to max of siblings, not \`height += 16\`).

A PreferenceKey is not a global. It is a bottom-up value collected during layout. \`onPreferenceChange\` is a side effect after layout. Side effects that dirty layout are Day 3 problem 5. SwiftUI will not save you because the API looks declarative.`,
      internals: `Layout in SwiftUI is a proposal/response: parent proposes a size, child responds with a size it wants. \`GeometryReader\` responds with the proposed size (min of that and its child, historically taking all). That is why it breaks wrapping.

Preferences are collected from children after they layout, \`reduce\`d, and pushed to ancestors. Changing \`@State\` in \`onPreferenceChange\` invalidates the view and schedules another layout pass. Without a fixed point, you loop until the system caps it (you see "onPreferenceChange trying to update multiple times per frame" in the console).

\`Layout\` protocol gives you a \`placeSubviews\` where you can measure children with \`sizeThatFits\` without round-tripping through \`@State\`. That is the replacement for many PreferenceKey height hacks.`,
      testing: `Host the card in a \`ScrollView\` in a 390-wide preview. Assert after two run loop turns the card height is image-aspect + caption, not thousands of points. A DEBUG counter on \`onPreferenceChange\`: after the first settle, it must not increment every frame.

Equal-height cards: two cards, one with a long caption, assert both minHeights match the max intrinsic, and the counter settled.

Console: no "multiple times per frame" warning.`,
      pitfalls: `\`reduce\` that sums heights by accident (\`value += next\`) so two children explode the parent. Reading preference in the same view that writes the frame without a guard. \`GeometryReader\` in a \`List\` row making every row full-screen tall (problem 1 hitching as a bonus).

Using \`.id(height)\` on the card so each measurement is a new identity — problem 2 plus a loop.`,
      alternatives: `Intrinsic stacks. \`Layout\` protocol. A UIKit cell that sizes with Auto Layout (Day 3) if the card is actually a table row with estimated heights. \`overlay(alignment:)\` with a reader that does not change the offered size.

For "match the image width," \`scaledToFit\` plus a max-width constraint from the parent, not a reader.`,
      tradeoffs: `PreferenceKey measurement is flexible and easy to loop. \`Layout\` is more code and one pass. Intrinsic is least code and least control. Start intrinsic. Measure only across siblings. Never measure yourself to tell yourself your height plus padding.`,
      followups: [
        {
          q: 'Why did the console say onPreferenceChange multiple times per frame?',
          a: 'Your callback wrote state that changed the preference. SwiftUI detected the loop. Guard or stop feeding the value back into the measured view.',
        },
        {
          q: 'background GeometryReader versus overlay?',
          a: 'Both can read the child’s size. background does not affect hit testing the same way. Neither should be the outer greedy reader.',
        },
        {
          q: 'PreferenceKey defaultValue 0 — first pass?',
          a: 'Ancestors may see 0 before the child lays out. Do not treat 0 as "hide the view" or you flicker. Wait for a real measurement, or use intrinsic.',
        },
        {
          q: 'Is this the same as Day 3 layoutSubviews loop?',
          a: 'Yes, different API. Layout must not rewrite its own inputs without a fixed point.',
        },
        {
          q: 'anchorPreference for a popover arrow?',
          a: 'Valid. You read a rect in a coordinate space. Still do not write a frame that changes that rect every pass.',
        },
      ],
      teaches: [
        'GeometryReader takes the proposed size, often all of it',
        'PreferenceKey plus @State is a layout side effect',
        'Adding padding into a measured height never converges',
        'Measure siblings, not yourself',
        'Layout protocol / intrinsic beat reader hacks',
      ],
    },
    {
      id: 'd4-p10',
      title: 'sheet(item:) resets the editor every websocket tick',
      difficulty: 'Senior',
      kind: 'Debug',
      prompt: `A shop admin. Tap a product, a sheet editor opens. After a few seconds of typing, the draft clears. Sometimes the sheet dismisses itself. A \`fullScreenCover\` path does the same on iPad.

\`\`\`swift
struct Product: Identifiable, Equatable {
    var id: UUID
    var name: String
    var stock: Int
}

struct Admin: View {
    @State var products: [Product]
    @State var selected: Product?

    var body: some View {
        List(products) { p in
            Button(p.name) { selected = p }
        }
        .sheet(item: $selected) { product in
            Editor(product: product)
        }
        .onReceive(websocket) { update in
            if let i = products.firstIndex(where: { $0.id == update.id }) {
                products[i] = update
                if selected?.id == update.id { selected = update }
            }
        }
    }
}

struct Editor: View {
    let product: Product
    @State private var draft: String = ""
    var body: some View {
        TextField("Name", text: $draft)
            .onAppear { draft = product.name }
    }
}
\`\`\`

\`Product.id\` is stable. Why does the editor still reset? What is the identity of a \`sheet(item:)\`, and how do you pass live stock into the sheet without destroying \`@State\`?`,
      think: [
        'What Equatable / Identifiable contract does sheet(item:) use to decide this is the same presentation?',
        'If selected is replaced with a new Product value, is that a new item?',
        'Does onAppear run again when the item identity flickers?',
        'fullScreenCover(item:) — same rules?',
      ],
      solution: `\`sheet(item:)\` presents while the optional is non-nil. The **item's \`id\`** (Identifiable) is the identity of that presentation. If you also rebuild the *content* by passing a whole new value whose identity SwiftUI treats as changed, or if you set \`selected = nil\` briefly, the sheet is a new view. \`@State draft\` dies. \`onAppear\` runs again.

If \`Identifiable.id\` were a new \`UUID()\` each websocket decode, the sheet would dismiss and re-present. Here \`id\` is stable, but you still **replace \`selected\` with \`update\`**, and \`Editor(product:)\` is recreated. That alone does not reset \`@State\` *if identity holds*. The reset happens because:

1. You wrote \`selected = update\` *and* \`products[i] = update\` while \`Product: Equatable\` by all fields — some OS / sheet implementations treat the item as changed when the value is not equal, not only when \`id\` changes; and
2. \`onAppear { draft = product.name }\` runs whenever the sheet content reappears, including some identity flickers, stuffing the incoming name over the draft (problem 4, version A).

Fix: path by id, model in the store, draft owned by the editor identity.

\`\`\`swift
.sheet(item: $selectedID) { id in
    Editor(productID: id, store: store)
}

struct Editor: View {
    let productID: Product.ID
    var store: CatalogStore
    @State private var draft: String
    @State private var didInit = false

    init(productID: Product.ID, store: CatalogStore) {
        self.productID = productID
        self.store = store
        _draft = State(initialValue: store.product(id: productID)?.name ?? "")
    }

    var body: some View {
        let stock = store.product(id: productID)?.stock ?? 0
        TextField("Name", text: $draft)
        Text("stock \\(stock)") // live, not identity
        Button("Save") { store.rename(productID, to: draft) }
    }
}
\`\`\`

\`selectedID\` stays the same UUID while stock ticks. The sheet stays. Stock is a read from the store in \`body\`. Draft is \`@State\` initialised once per presentation.

\`fullScreenCover(item:)\` is the same contract. \`.sheet(isPresented:)\` plus a leftover \`product\` in an optional is easy to desync; \`item:\` is better if the id is stable.`,
      explanation: `The websocket is trying to be helpful. Stock changed, so you updated the product, including the one in \`selected\`. The sheet's *item* is that struct. Depending on the OS, SwiftUI uses \`id\` to decide whether this is the same presentation, but the *content closure* still runs with a new \`Product\`. If anything in that pipeline treats the non-equal struct as a new item — or if you nil the selection and set it again — the editor is a new identity. \`@State\` is empty. \`onAppear\` copies \`product.name\` from the server over the three letters the user typed.

This is problem 2 and problem 7 wearing a modal. Sheets are a navigation stack of size one. The item is the path element. You would not put a mutating \`Product\` in a \`NavigationPath\` (problem 7). Do not put it in \`sheet(item:)\` either. Put the id. Read the live fields from a store. Initialise draft in \`State(initialValue:)\`, not in \`onAppear\`, so a later appear does not clobber.

Dismissing itself is the \`id\` changing. A mapper that creates a new UUID per decode is the classic. \`Identifiable\` on a struct with \`var id = UUID()\` as a stored property that is not in the decoder is the same bug as Day 3's diffable identities.`,
      internals: `\`sheet(item:)\` requires \`Identifiable\`. When the binding becomes non-nil, SwiftUI presents. When it becomes nil, it dismisses. When \`id\` changes from A to B without nil, you get a replace: dismiss A, present B. \`@State\` on the content is keyed by that presentation identity.

The content closure is not \`makeUIView\`. It can run often. That is why \`let product\` as a value in the editor is fine for display if you do not key identity on it, and why \`onAppear\` is a trap.

Environment in sheets: historically dropped (problem 5). Attach \`.environmentObject\` to the sheet content if the editor needs the store and you are on an OS that does not inherit.`,
      testing: `Open editor, type "x", fire a websocket stock update, assert the field still has "x" and the stock label moved. Fire an update that *renames* on the server while the user is editing: assert you did not clobber (or that you showed a conflict — spec it).

Change \`id\` in the update: assert dismiss. That is the test that Identifiable is the presentation key.

UI test on iPad \`fullScreenCover\` as well as phone sheet; they are different presenters and both reset state the same way.`,
      pitfalls: `\`sheet(isPresented: $on) { Editor(product: selected!) }\` with a force unwrap that is nil for a frame during dismiss. \`.id(selected.stock)\` on the editor. Using \`Product\` as Identifiable where \`id\` is \`name.hashValue\`.

Resetting draft in \`onChange(of: product)\` "to stay in sync" — problem 4 version C.`,
      alternatives: `A dedicated \`EditorDraft: Identifiable\` with a stable \`sessionID\` created at tap time, independent of the product. Heavier, makes "discard / save" obvious.

UIKit form sheet (Day 3) if the editor is a representable that already owns a text field — then \`updateUIView\` must not stomp text (problem 3).`,
      tradeoffs: `Id-in-the-binding means the product can be deleted while the sheet is up; you must render missing. Whole-model-in-the-binding means you can edit a snapshot offline and you will fight live updates. For admin stock ticks, id plus store. For a compose-new-email sheet, a draft object created at tap is the identity.`,
      followups: [
        {
          q: 'sheet(item:) versus sheet(isPresented:)?',
          a: 'item is "present this identity." isPresented is a boolean you will desync from which product. Prefer item with a stable id.',
        },
        {
          q: 'Two sheets, item and confirmationDialog?',
          a: 'One presentation at a time from the same view is safer. Stacking is OS-dependent. Present confirmation from inside the editor.',
        },
        {
          q: 'Does Equatable on Product matter if Identifiable.id is stable?',
          a: 'It should not for "is this the same sheet." In practice, replacing the bound value every tick has caused content resets. Bind the id; do not test this only on one OS.',
        },
        {
          q: 'popover(item:) on iPad?',
          a: 'Same item identity. Anchor identity is extra: a popover from a list row can mis-anchor if the row identity moved.',
        },
      ],
      teaches: [
        'sheet(item:) identity is Identifiable.id',
        'Do not put a mutating model in the item binding',
        'onAppear will clobber drafts on reappear',
        'Read live fields from a store; keep draft in @State',
        'fullScreenCover is the same contract',
      ],
    },
    {
      id: 'd4-p11',
      title: 'withAnimation wakes every row, twice',
      difficulty: 'Senior',
      kind: 'Performance',
      prompt: `A like button on the feed from problem 1. After they narrowed Observation, a like still hitchs. The SwiftUI instrument shows \`PostRow.body\` for every visible row, and a second wave as the animation completes. Unrelated chrome (a banner) also animates.

\`\`\`swift
struct FeedView: View {
    @State var vm = FeedVM()
    var body: some View {
        List(vm.rows) { row in
            PostRow(model: row)
        }
        .animation(.spring) // "make likes feel nice"
        .onReceive(vm.bannerPublisher) { _ in vm.banner = Banner.random() }
    }
}

struct PostRow: View {
    var model: PostRowModel
    var body: some View {
        HStack {
            Text(model.post.author)
            Button("♥ \\(model.likeCount)") {
                withAnimation(.spring) { model.likeCount += 1 }
            }
        }
    }
}
\`\`\`

\`PostRowModel\` is \`@Observable\`. Why did implicit animation plus \`withAnimation\` invalidate neighbours, and how do you animate *one* number without a transaction on the List?`,
      think: [
        'What does .animation(.spring) without a value: parameter attach to?',
        'Does withAnimation wrap only likeCount, or every state write in that turn including banner?',
        'Will animating a List data change interpolate identity and re-run bodies?',
        'What does a transaction with animation: nil do on a subtree?',
      ],
      solution: `Animate the **smallest animatable data**, with an explicit \`value:\`, inside the view that displays it. Do not put a blanket \`.animation(.spring)\` on a \`List\`. Do not \`withAnimation\` around a model write that other views will read.

\`\`\`swift
struct PostRow: View {
    var model: PostRowModel
    var body: some View {
        HStack {
            Text(model.post.author)
            Button("♥ \\(model.likeCount)") {
                model.likeCount += 1
            }
            .contentTransition(.numericText())
            .animation(.spring, value: model.likeCount)
        }
    }
}

// banner updates must not inherit the like's transaction
.banner(vm.banner)
    .transaction { $0.animation = nil }
\`\`\`

Rules:

1. **\`.animation(.spring)\` on the List** is an implicit animation for *any* animatable change in the subtree, including inserts, banner text, and neighbour like counts if those writes happen in the same transaction. It is a tax.
2. **\`withAnimation\` on the write** puts the animation in the transaction. Every view invalidating from that write *and* any other writes in the same turn (banner publisher on the same run loop) will try to animate. Scope the write: increment on the row model, animate locally with \`value: model.likeCount\`.
3. **Identity changes do not interpolate.** If a like replaced the row's \`id\`, you would get a fade/insert of a new row, which is a body rebuild, not a count animation (problems 1 and 7).
4. **Second wave of body** is often the completion of the animation (final values) plus a second invalidation from a parent that used implicit animation. The SwiftUI instrument's "two pulses" are a clue you have two transactions, not a GPU mystery.
5. **\`transaction { $0.animation = nil }\`** on chrome that must not participate. \`withTransaction\` for a programmatic scroll that should not animate the list.

Likes are numbers. \`contentTransition(.numericText())\` is the product. \`withAnimation { vm.rows = newRows }\` is how you animate a stampede.`,
      explanation: `They did the Observation homework. A like writes one \`likeCount\`. Neighbours still wake, and the banner slides as if it were a like. The missing piece is the **transaction**. SwiftUI does not only care what you read. It cares whether this invalidation is supposed to animate. A modifier \`.animation(.spring)\` on the List says: whenever something in here changes and can animate, spring it. List data changing, even a field on a row model the List is watching, becomes an animated update. Visible rows re-run \`body\` to produce interpolatable views. That is more work than a discrete like, and it runs again when the spring settles.

\`withAnimation\` on the button is the same transaction from the other end: you marked the *write*. Any other write in that turn inherits the animation. The banner publisher firing in the same run loop is enough. You wanted a heart to bounce. You got a feed-wide animated transaction plus a chrome animation, then a second layout when the transaction completed.

This is still granularity, like problem 6, with time as a second axis. Narrow the read *and* narrow the transaction. Animate \`value: model.likeCount\` on the button. Keep the List's data changes discrete unless you are inserting a row the user should see slide in. A spring on insert of one row is a product. A spring on a like count broadcasting through implicit animation is a hitch.`,
      internals: `A \`Transaction\` rides along with a state change. \`withAnimation\` sets \`transaction.animation\`. The \`.animation(_:value:)\` modifier compares the value and, on change, applies an animation to that subtree. The older \`.animation(_:)\` without \`value:\` applies to all downstream changes — the foot-gun.

Animating \`List\` / \`ForEach\` diffs interpolates positions when identity is stable. When identity is not stable, it is a removal and insertion. Body runs for affected rows. Implicit animation can mark *all* of them affected.

\`contentTransition\` is a render-side interpolation of text / numeric glyphs; it still wants a targeted animation, not a list-wide one.

Each animation frame is not necessarily a SwiftUI \`body\` invocation — the render server can interpolate. The extra \`body\` pulses in the instrument are the start and end of the transaction plus any parent that re-evaluated. If you see \`body\` every frame, you are invalidating every frame (a timer, a preference loop from problem 9, or animating something that is not animatable so SwiftUI rebuilds instead of interpolating).`,
      testing: `DEBUG body counters on PostRow and Banner. Like post 47: row 47 increments, neighbours do not, banner does not. Before the fix, neighbours and banner increment, often twice.

SwiftUI instrument: one short transaction attributed to likeCount, not a List diff.

A UI test that likes and asserts other rows' like labels did not flash an animation (hard); prefer the counter.`,
      pitfalls: `\`.animation(.spring, value: vm.rows)\` — any row change animates the whole array identity. \`withAnimation\` around a network completion that assigns 1 000 posts. Animating \`.id\`. Pairing implicit animation with \`GeometryReader\` height state (problem 9) — now the loop is visible as a spring.

\`animation(nil)\` on the List to "fix FPS" and then wondering why inserts do not animate. Be specific, do not nuke.`,
      alternatives: `UIKit \`UIView.animate\` in a representable like button if you need a bounce the system numeric transition cannot do — isolate it, do not \`withAnimation\` the store. Day 3 cells animate in \`willDisplay\`, not in \`cellForItem\`.

\`Animatable\` / \`animatableData\` on a tiny HeartView so the row body does not run as the heart scales.`,
      tradeoffs: `Local \`.animation(value:)\` is more modifiers and correct. List-wide implicit animation is one line and expensive. Animating inserts is worth a discrete \`withAnimation\` around *that* append, not a modifier that catches likes too.`,
      followups: [
        {
          q: 'Why twice?',
          a: 'Start of the animated transaction and the settling invalidation, or two modifiers both applying animations (withAnimation plus .animation on the List).',
        },
        {
          q: 'Does Equatable PostRow skip animated body?',
          a: 'It may skip if inputs did not change. Neighbours whose inputs did not change should already skip if you narrowed Observation. Animation does not give them a reason to read likeCount.',
        },
        {
          q: 'transaction versus withAnimation?',
          a: 'withAnimation is sugar for a transaction with an animation. Use transaction to set animation nil, disablesAnimations, or custom keys.',
        },
        {
          q: 'MatchedGeometryEffect on the heart?',
          a: 'Needs stable identity across the two views. A like that changes the row id will not match. Do not matchedGeometry the whole row.',
        },
      ],
      teaches: [
        '.animation without value: is a subtree tax',
        'withAnimation marks the write; other writes in the turn inherit it',
        'Animate the smallest value, not the List',
        'Identity changes cannot interpolate; they rebuild',
        'Two body pulses often mean two transactions',
      ],
    },
    {
      id: 'd4-p12',
      title: '@Query invalidates the whole screen on every store write',
      difficulty: 'Senior',
      kind: 'Incident',
      prompt: `SwiftData. A home screen uses \`@Query\` for today's orders. Typing in a search field hitchs. Saving a *completed* order on a background screen hitchs home too. A relative-time label on home ticks and the query seems to refetch.

\`\`\`swift
struct Home: View {
    @Query(sort: \\Order.createdAt, order: .reverse) var orders: [Order]
    @State private var q = ""
    @State private var now = Date()

    var body: some View {
        let filtered = orders.filter { $0.name.localizedStandardContains(q) || q.isEmpty }
        List {
            Text(now, style: .relative)
            ForEach(filtered) { order in
                OrderRow(order: order)
            }
        }
        .onReceive(Timer.publish(every: 1, on: .main, in: .common).autoconnect()) { now = $0 }
        .searchable(text: $q)
    }
}

struct OrderRow: View {
    let order: Order
    var body: some View {
        Text(order.name)
        Text(order.createdAt, format: .relative(tick: Date.now))
    }
}
\`\`\`

The \`@Query\` has no predicate. \`OrderRow\` reads \`Date.now\` in \`body\`. Explain what invalidates \`@Query\`, why a parent timer redraws the query's view, and how to keep a SwiftData list cheap in an interview-sized answer.`,
      think: [
        'Does @Query live in the view that owns body, and what does a store save do to that view?',
        'Is filtering in body a substitute for a FetchDescriptor predicate?',
        'Date.now in a row body — Observation, or a query refetch?',
        'Should @Query sit on Home or on a subtree that does not tick?',
      ],
      solution: `\`@Query\` subscribes the **view it is declared on** to the store. Any relevant insert/update/delete invalidates that view's \`body\`. There is no per-row Observation miracle: you fetched an array of models, you sit on the array.

\`\`\`swift
struct Home: View {
    @State private var q = ""
    var body: some View {
        VStack {
            RelativeClock() // ticks alone
            OrderList(search: q)
        }
        .searchable(text: $q)
    }
}

struct OrderList: View {
    var search: String
    @Query private var orders: [Order]

    init(search: String) {
        self.search = search
        let trimmed = search.trimmingCharacters(in: .whitespaces)
        _orders = Query(
            filter: trimmed.isEmpty ? nil : #Predicate<Order> { order in
                order.name.localizedStandardContains(trimmed)
            },
            sort: \\Order.createdAt,
            order: .reverse
        )
    }

    var body: some View {
        List(orders) { order in
            OrderRow(order: order)
        }
    }
}

struct OrderRow: View {
    let order: Order
    var body: some View {
        Text(order.name)
        RelativeTimeLabel(date: order.createdAt) // no Date.now in the row that also draws chrome
    }
}
\`\`\`

Rules:

1. **Put \`@Query\` on the smallest view** that needs the array. A timer on the same view is problem 1: every tick re-runs \`body\`, which re-filters 1 000 orders in process even if the store did not change.
2. **Filter in the fetch**, not in \`body\`, when the search is the predicate. Changing \`search\` rebuilds the \`Query\` (new identity of the descriptor) — that is a real refetch, and it is cheaper than fetching everything and filtering in Swift if the store is large.
3. **Saves on other screens still invalidate** if the predicate matches those rows (or if you fetched everything). Tighten the predicate (\`status == .open\`, \`day == today\`). "Today" must not be \`Date.now\` inside the predicate if that makes the descriptor a new one every second — snapshot the day start.
4. **\`Date.now\` in \`OrderRow.body\`** invalidates nothing from SwiftData; it just makes every row's body depend on "now" whenever the parent asks for a new tree. Combined with a parent tick, you decode the whole list every second. Problem 6.
5. **Do not \`@Query\` in the \`App\` or a tab root** that also hosts unrelated chrome.

This is interview-level SwiftData: the property wrapper is a fetch + a subscription, not a magic granular store.`,
      explanation: `SwiftData in a SwiftUI interview is not a Core Data stack diagram. It is: who invalidates, and what did \`body\` do with the result. \`@Query\` on \`Home\` means Home is the observer. A completed order saved on a detail screen updates the store. Home's query includes that row (there is no predicate), so Home's body runs. You filter in Swift for the search string. You also tick \`now\` every second for a relative clock in the same view. Three reasons to walk 1 000 orders: store write, keystroke, timer. The team will blame SwiftData. Two of the three are your view graph.

\`Date.now\` inside \`OrderRow.body\` is especially dishonest. It looks like a relative timestamp and it is a value that changes continuously, but it only *re-reads* when the row's body runs. The timer on Home is what runs the row. You built problem 1 again: a cheap wrapper (\`@Query\` instead of \`@ObservedObject\`) around a wide invalidation.

Predicates are the store's version of narrow reads. If Home only needs open orders, do not fetch completed ones and then ignore them. If search is the filter, put it in \`Query(filter:)\` so typing does not fetch the world and then allocate a filtered array in \`body\`. Changing the search string creates a new query; that is expected. Changing \`Date.now\` inside a predicate every second would create a new query every second — snapshot "today" as a stable \`Date\` start.

Keep the ticking clock in a tiny sibling. Keep the query in a child that does not tick. Pass \`Order\` values into rows that do not read the clock. Same architecture as the feed, with a fetch descriptor instead of a VM array.`,
      internals: `\`@Query\` is backed by a fetch descriptor and a SwiftData persistent model context. Store changes that affect the result set notify the query. The view invalidates as a whole; there is no \`objectWillChange\` per \`Order\` field unless you then observe each model. SwiftData models are observable in some configurations; reading \`order.name\` in a row can subscribe to that instance, but the **List's identity of the array** still comes from the query on the parent. A parent body that re-filters still recreates row values.

\`#Predicate\` is compiled and sent to the store. Closures that capture changing values (search text, start of day) are parameters of the descriptor. New descriptor, new fetch.

\`Date.now\` / \`.now\` in \`body\` is not a SwiftData invalidation. It is just a bad constant that you re-evaluate when something else invalidates you.`,
      testing: `Insert a completed order while Home is visible with a predicate on open: Home's DEBUG body counter must not move. Insert an open order: counter +1, list count +1.

Type in search: assert the fetch descriptor's predicate matches (or assert filtered count), and the timer view's counter can move without the list counter moving.

A test that the day predicate uses a frozen start-of-day, not \`Date.now\` in the \`Query\` initializer called from a ticking view.`,
      pitfalls: `\`@Query\` in every row for "the order with this id" — N fetches, N subscriptions. Pass the model. \`sort: \\.createdAt\` plus filtering in body "to keep the query simple" on 50k rows. Main-context writes from a background import that should have been a background context + merge — hitch plus threading (keep it light: one context on main for UI queries).

Putting \`now\` in the \`Query\` initializer: \`Query(filter: #Predicate { $0.createdAt > now })\` captured in \`Home.body\` next to the timer — refetch every second.`,
      alternatives: `A fetch in \`.task\` into an \`@State\` array if the screen is a snapshot, not live. Observable \`@Model\` passed from a parent that already queried. UIKit + \`NSFetchedResultsController\` when the list is huge and you already live in Day 3 — FRC is the ancestor of this invalidation story.

For search, debounce the string that feeds \`Query(filter:)\` so you do not refetch per keystroke (Day 2).`,
      tradeoffs: `Live \`@Query\` is always-fresh and easy to over-invalidate. Snapshot fetch is stale until the next \`.task\` and cheap. Predicates in the store are more work to write (\`#Predicate\` limitations) and save the filter-in-body tax. For an interview home screen, a tight predicate plus a split-out clock is the answer. For a 50k-row admin table, you are in pagination, not in a single \`@Query\`.`,
      followups: [
        {
          q: 'Does @Query replace @FetchRequest?',
          a: 'Same seat in the view. Same instinct: the wrapper invalidates the view that declared it. Narrow that view.',
        },
        {
          q: 'Why did a save on a detail hitch Home?',
          a: 'The query predicate still matched (or there was no predicate). The home view owned the query and a fat body.',
        },
        {
          q: 'Can a row @Bindable var order: Order and edit in place?',
          a: 'SwiftData models can be mutated and saved. That write invalidates queries that include the row. Do not also tick the parent.',
        },
        {
          q: 'Predicate captures search: new Query every keystroke. Costly?',
          a: 'Yes if the fetch is heavy. Debounce. Empty search as nil predicate versus a match-all — measure. Still better than fetch-all plus localizedStandardContains in body on 50k rows.',
        },
        {
          q: 'TimelineView instead of a timer on Home?',
          a: 'Better for the clock if it is a sibling. If TimelineView wraps the List, you are back to ticking the query’s view.',
        },
      ],
      teaches: [
        '@Query invalidates the view that declared it',
        'Split ticking chrome from the fetch',
        'Filter in the descriptor, not in a fat body',
        'Snapshot "today"; do not refetch every second',
        'Date.now in a row is not a query, but a parent tick makes it one',
        'SwiftData in an interview is invalidation granularity',
      ],
    },
  ],
}
