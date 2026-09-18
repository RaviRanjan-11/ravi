import type { PrepDay } from './types'

export const day3: PrepDay = {
  id: 'day-3',
  title: 'Day 3 — UIKit',
  kicker: 'Lifecycle, reuse, and who still owns the cell',
  intro:
    'A cell is a slot in a pool, a view controller is a state machine, and Auto Layout is an equation system you can poison from layoutSubviews. Today is UIKit — appearance, reuse, snapshots, the keyboard — not Observation, not ViewBuilder. If you can walk prepareForReuse and addChild without reaching for a SwiftUI body, you are ready for that framework tomorrow.',
  problems: [
    {
      id: 'd3-p1',
      title: 'Wrong image after fast scroll',
      difficulty: 'Senior',
      kind: 'Incident',
      prompt: `A UICollectionView of avatars. Cells show the previous user's photo for about 200 ms, then the correct one. Fast fling: some wrong avatars stick until you scroll them off and back.

\`cellForItemAt\` starts a download into \`cell.imageView\`. There is no \`prepareForReuse\` work. Completions hop to main and assign \`imageView.image\`. Prefetch is not implemented.

Fix the reuse bug and the in-flight request bug. Say why \`indexPath\` in the completion is the next production incident, and what must still be true if this cell is later hosted from SwiftUI.`,
      think: [
        'What does reuse mean for the UIImageView instance — new view, or last row\'s view?',
        'Can a completion from request A land on a cell now bound to item B?',
        'When does prepareForReuse run relative to cellForItem, and what must it cancel?',
        'Why is the item id a better token than the index path?',
      ],
      solution: `Treat the cell as a pool slot, not as "the view for this user."

\`\`\`swift
final class AvatarCell: UICollectionViewCell {
    private var itemID: UserID?
    private var task: Task<Void, Never>?
    let imageView = UIImageView()

    override func prepareForReuse() {
        super.prepareForReuse()
        task?.cancel()
        task = nil
        itemID = nil
        imageView.image = .placeholder
    }

    func configure(user: User, loader: ImageLoading) {
        itemID = user.id
        imageView.image = .placeholder
        let capturedID = user.id
        task = Task { [weak self] in
            let image = try? await loader.avatar(for: user.id)
            guard let self, self.itemID == capturedID, !Task.isCancelled else { return }
            imageView.image = image
        }
    }
}
\`\`\`

In \`cellForItem\`, only \`configure\`. Never start work without a matching cancel in \`prepareForReuse\`.

Prefetch upcoming index paths with \`UICollectionViewDataSourcePrefetching\`, still keyed by item id, and cancel in \`cancelPrefetching\` (problem 7). Downsample to the avatar size. Use a diffable data source with stable item identifiers so inserts do not shuffle the identities your completions are guarding on.

A SwiftUI wrapper does not cancel URLSession for you. Reuse still has to cancel here; representable identity is a Day 4 problem.`,
      explanation: `A designer sends a screenshot of the wrong person next to a name, and support files it as a cache bug. You can reproduce it on a fast fling: cell 12 was Priya, it came out as cell 40 for Omar, and Priya's JPEG landed 200 ms later. Nobody allocated a new \`UIImageView\`. You got last row's view. The completion does not know it was rebound unless you taught it.

That is cell reuse. UIKit keeps a handful of cell instances because creating views is expensive. \`prepareForReuse\` is the moment the slot is about to mean someone else. If you do not reset the image, Omar sees Priya until the new download finishes — the 200 ms flash. If you do not cancel the download, Priya's completion can arrive after you have bound Omar, and the wrong photo *sticks*. Both bugs are the same identity mistake: you keyed the work to a view instance instead of to a model id.

The completion is an asynchronous handoff, the same shape as Day 2's stale search result. Last finish wins, not last start. \`guard self.itemID == capturedID\` is the belt; cancelling in \`prepareForReuse\` is the suspenders. You want both. Cancelling without the guard still loses a race if the completion is already on the main queue. The guard without cancel still wastes bandwidth and can briefly assign before the next configure runs.

\`indexPath\` in the completion is how this ships and then explodes during an insert at row 0. Index paths move. Item ids do not. Diffable data sources make that identity honest for the collection view; they do not assign images for you. Prefetch hides latency, and it is another in-flight request that must die when the user flings the other way.`,
      internals: `\`prepareForReuse\` runs before the cell is returned from \`dequeueReusableCell\` for a new index path. \`cellForItemAt\` then configures. If you only reset in \`cellForItem\` after starting a new request, an already-queued completion from the previous item can still run in between, or after, depending on the run loop.

URLSession (or your loader) retains the completion until the task finishes or is cancelled. That is the Day 1 lifetime lesson sitting inside a cell. \`[weak self]\` stops a cell that left the screen from leaking via the task; it does not stop a *reused* cell from applying a stale image, because \`self\` is still alive — it is Omar's cell now.

Diffable snapshots identify items. The collection view can move a cell from index 5 to index 6 without calling \`prepareForReuse\` if it decides it is the same item. That is another reason to key off \`item.id\`, not the path: a move should not restart the download, and a different item at the same path must.`,
      testing: `Unit-test the cell loader with a fake that you complete by hand. Configure A, immediately configure B, complete A's request, assert the image is B's or the placeholder — never A's. Then complete B, assert B.

A second test: configure A, call \`prepareForReuse\`, complete A, assert placeholder and no crash if \`self\` was weakly captured.

Do not lean on a UI test that flings the collection view. It is flaky and it will not tell you which race you lost. Prefetch tests: assert cancelled indexes never assign.

Memory Graph after a long fling: no pile of cancelled-but-retained tasks, no cells retained only by a loader.`,
      pitfalls: `Using \`indexPath\` in the completion after an insert — you write into the wrong row, sometimes out of bounds. Resetting the image in \`cellForItem\` but not cancelling, so the flash is gone and the stuck-wrong-photo remains. A shared \`UIImageView\` animation that is not cancelled in reuse. Caching full-resolution originals under the avatar URL so the hitch moves from network to decode.

Swallowing cancellation errors and assigning \`nil\` on a cell that already shows B. Check the id *and* cancellation before touching the view.`,
      alternatives: `Nuke, Kingfisher, or SDWebImage if you accept a library — they cancel on reuse if you use their cell helpers, and they still need a placeholder and a downsample size. A tiny in-house loader with NSCache cost limits is enough for avatars. Do not build a new image framework in the interview; build the cancel-and-guard contract.`,
      tradeoffs: `Aggressive prefetch uses memory and radio for rows the user may never see. Cancel aggressively on reuse and on \`cancelPrefetching\`. Under-prefetch and avatars pop in late. There is no universal number; measure on a mid-phone on LTE.

Placeholders make reuse honest and make slow networks look emptier. A tiny cached thumb is better than a grey box, if you have one. Showing the previous person is the one option that is never acceptable.`,
      followups: [
        {
          q: 'Diffable versus reloadData — does it fix the image race?',
          a: 'No. It reduces "inconsistent state" crashes and helps animations. Completions still have to guard on item id. You still need prepareForReuse.',
        },
        {
          q: 'What if configure is called twice for the same id without reuse?',
          a: 'Cancel the previous task in configure as well, or de-dupe in the loader. Self-reuse without prepareForReuse happens on reload of the same items.',
        },
        {
          q: 'Main-thread decode of a 3 000 px avatar in the completion?',
          a: 'Downsample off main, assign a small UIImage on main. The race guard still applies to the downsampled result. Decode in body is a Day 4 problem; decode in a cell completion is the same hitch with a UIKit costume.',
        },
        {
          q: 'UITableView versus UICollectionView here?',
          a: 'Identical reuse contract. prepareForReuse, cancel, guard on id. Prefetch APIs exist on both.',
        },
        {
          q: 'How do you prove a stuck-wrong-photo in a PR?',
          a: 'The fake-loader unit test: complete A after binding B. A screenshot of a fling is not a proof.',
        },
      ],
      teaches: [
        'Cells are a pool, not a view per model',
        'prepareForReuse cancels and resets',
        'Stale completions guard on item id, not indexPath',
        'Prefetch is more in-flight work to cancel',
        'Diffable identity does not assign images',
      ],
    },
    {
      id: 'd3-p2',
      title: 'viewDidAppear fires twice, analytics double-counts',
      difficulty: 'Senior',
      kind: 'Incident',
      prompt: `Product: screen_view for Checkout is almost exactly 2× sessions, and funnels look like every user bounced and came back. Engineering cannot reproduce in a simple push, but it happens on the real tab: a \`CheckoutContainerViewController\` embeds \`CheckoutViewController\`, and the same flow is also reachable from SwiftUI via a hosted view controller.

Relevant sketch:

\`\`\`swift
final class CheckoutContainerViewController: UIViewController {
    let child = CheckoutViewController()

    override func viewDidLoad() {
        super.viewDidLoad()
        addChild(child)
        view.addSubview(child.view)
        child.didMove(toParent: self)
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        child.viewWillAppear(animated)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        child.viewDidAppear(animated)
        Analytics.track("screen_view", ["name": "checkout"])
    }
}

final class CheckoutViewController: UIViewController {
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        Analytics.track("screen_view", ["name": "checkout"])
    }
}
\`\`\`

The container is itself inside a \`UINavigationController\`. The SwiftUI path recreates the hosted controller when a header binding changes.

Why do appearance methods run twice? Where should analytics live? What is the correct containment contract, and how do \`viewDidLoad\` / \`viewWillAppear\` / \`viewDidAppear\` / \`viewWillDisappear\` differ when a VC is added as a child versus pushed?`,
      think: [
        'If you addChild and also manually forward viewWillAppear, who else is already forwarding?',
        'Does the child firing and the parent firing both log screen_view for the same logical screen?',
        'What does unstable hosting identity do to appearance?',
        'Which lifecycle method is safe for "the user can see this" versus "the view hierarchy exists"?',
      ],
      solution: `UIKit already forwards appearance to children that were added with \`addChild\` / \`didMove(toParent:)\`. The manual \`child.viewWillAppear\` / \`viewDidAppear\` is a second, synthetic call. That is double fire number one.

Both container and child logging \`screen_view\` for the same product name is double fire number two, even after you stop forwarding.

Fix containment:

\`\`\`swift
override func viewDidLoad() {
    super.viewDidLoad()
    addChild(child)
    view.addSubview(child.view)
    child.view.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([/* pin to edges */])
    child.didMove(toParent: self)
}

override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    // do not forward to child
}
\`\`\`

Log analytics **once**, for the logical screen, in one place — usually the child if the child *is* checkout, or the container if the child is a reusable pager. Guard with a flag if a known framework double-call still exists, and reset it in \`viewDidDisappear\`.

If SwiftUI hosts this controller, stable identity on the representable (Day 4). \`makeUIViewController\` once. Appearance methods on a VC that is being inserted and immediately replaced will fire in pairs.

Do not start analytics in \`viewDidLoad\` — the view is not on screen, and load can happen in a container that is never shown. Do not start them in \`viewWillAppear\` if you care about "visible" — the user has not seen it yet, and will-appear can run without did-appear if a transition cancels.`,
      explanation: `Growth comes over and asks why checkout is the most viewed screen in the app by a factor of two, and also why the funnel says everyone left. Nobody left. You counted walking through the door twice.

A custom container feels like you should "tell the child it appeared," because that is what a tutorial did in 2014 before \`addChild\` was the contract. Once you call \`addChild\` and \`didMove(toParent:)\`, you have opted into UIKit's containment. The parent appearing *is* the child's appearance, forwarded by the framework, including animated transitions. Calling \`child.viewDidAppear(true)\` yourself is not a courtesy. It is a second invocation of the same method, with whatever side effects you put there: analytics, \`viewModel.onAppear()\`, a second network refresh, a second \`becomeFirstResponder\`.

The second doubling is product identity. Container and child both think they *are* checkout. If they sit in the same window at the same time, that is one screen. Log one event. If the container is a pager, log when the *page* becomes the selected child, not when the pager's \`viewDidAppear\` runs.

Hosting from SwiftUI piles on a third copy. Unstable identity tears the controller down and builds another. You see \`viewDidDisappear\` then \`viewDidAppear\` for a header tick. Analytics looks like a bounce. Same instinct as destroying a map in \`updateUIView\` — update was treated as create. That bridge is Day 4; the appearance math is still this screen's.

Lifecycle is a state machine, not a bag of callbacks. \`viewDidLoad\` means the view exists. \`viewWillAppear\` means a transition toward visible has started. \`viewDidAppear\` means it finished. Disappear runs when you push something on top, not only when you pop. A child added while the parent is already visible gets appearance immediately as part of \`didMove(toParent:)\` — which is why adding a child in the parent's \`viewDidAppear\` can look like a double if you also log there.`,
      internals: `UIKit tracks \`isViewLoaded\`, appearance transitions, and parent/child relationships on the controller, not on the UIView. \`beginAppearanceTransition(_:animated:)\` / \`endAppearanceTransition()\` are what containers use when they are doing custom presentation. \`addChild\` plus \`didMove(toParent:)\` is the happy path that does this for you. Calling the \`viewWill*\` methods directly skips the bookkeeping and desynchronises \`isMovingToParent\` / \`isAppearing\`.

A \`UINavigationController\` is itself a container. Your container inside a nav stack is a child of the nav, which is a child of the tab, which is a child of the window. Each layer forwards. You do not forward.

A hosted UIKit controller is still a child of a SwiftUI-owned parent. That parent appearing forwards into your VC. If the host discards you, you get a full disappear/appear cycle. \`viewDidLoad\` does not run again on the same instance; a new instance loads again. That distinction is how you tell "double forward on one instance" from "identity created two instances."`,
      testing: `A unit test is awkward; an integration test with a window is honest. Host the container in a window, appear once, assert \`screen_view\` count == 1. Then: push a details VC and pop, assert a second count if that is the product rule, not a third.

Override appearance methods with counters in DEBUG. Fail a debug assert if \`viewDidAppear\` runs twice without an intervening \`viewDidDisappear\`.

For the hosted path: toggle the header binding in a test harness, assert you still have one controller instance and analytics did not fire again.

Do not validate this with production dashboards two weeks later. The 2× is the test.`,
      pitfalls: `Removing \`super.viewDidAppear\` so you "control it" — now transitions and children break. Logging in both \`viewWillAppear\` and \`viewDidAppear\` "to be safe." Starting a network call in \`viewWillAppear\` without cancelling in \`viewWillDisappear\`, then doubling it with the extra call. Using \`viewDidLoad\` for analytics because it ran once in a simple push demo — it also runs when the VC is instantiated in a pager that the user never opens.

\`automaticallyForwardAppearanceMethods\` — know it exists, do not turn it off and then forward by hand unless you are a pager that is lying about which child is visible. If you are that pager, forward only the selected child, and write a test.`,
      alternatives: `A single \`AnalyticsScreenTracker\` that hooks one VC and is documented as the only logger. For SwiftUI-first screens, \`.onAppear\` / \`.task\` — still double-fires if identity is unstable (Day 4).

For containers that hide and show children (tabs, pagers), call \`beginAppearanceTransition\` on the incoming and outgoing children yourself *instead of* relying on the parent appear, because the parent did not disappear. That is the case where manual forwarding is correct — between siblings, not from parent to child on the parent's appear. Problem 9 is the containment pairing that makes this possible.`,
      tradeoffs: `One analytics call site per logical screen is slightly less "complete" (you might miss a chrome-only container) and infinitely more trustworthy. Guarding with \`hasTracked\` flags hides framework bugs and also hides real double appears you wanted to know about. Prefer fixing containment; use a flag only at a known hosting seam, and comment why.

Hosting everything in SwiftUI \`.onAppear\` to avoid UIKit lifecycle is not simpler once you embed controllers. You now have both clocks.`,
      followups: [
        {
          q: 'viewDidLoad versus viewDidAppear for starting a refresh?',
          a: 'Appear, and cancel on disappear, if the refresh is for the user seeing the screen. Load is for building the hierarchy. A VC can load and never appear.',
        },
        {
          q: 'Why does pushing a modal not always disappear the presenter?',
          a: 'Over-fullscreen does. Sheets and some custom presentations keep the presenter appeared. Analytics "time on screen" cannot assume disappear == left.',
        },
        {
          q: 'addChild without didMove(toParent:)?',
          a: 'The child is in a half-state. Appearance forwarding is unreliable, layout is weird, and you will invent manual forwarding to compensate. Always pair addChild with didMove, and removeFromParent with willMove(toParent: nil). That pairing is problem 9.',
        },
        {
          q: 'Will SwiftUI onAppear replace viewDidAppear if the screen is a hosted controller?',
          a: 'You will get both unless you pick one. Pick the UIKit VC if it owns the screen, and do not also log in the SwiftUI wrapper.',
        },
        {
          q: 'Tab switch: willAppear on the tab already loaded?',
          a: 'Yes. viewDidLoad does not run again. If you only refresh in load, tab content goes stale. If you refresh in every appear without cancelling, you hammer the API.',
        },
      ],
      teaches: [
        'addChild already forwards appearance',
        'Do not call viewWillAppear on children yourself',
        'One analytics event per logical screen',
        'viewDidLoad is not visibility',
        'Unstable hosting identity causes appear/disappear pairs',
        'Pager siblings are the case for manual forwarding',
      ],
    },
    {
      id: 'd3-p3',
      title: 'Unsatisfiable constraints after rotate',
      difficulty: 'Senior',
      kind: 'Debug',
      prompt: `A UICollectionView cell lays out a title, a subtitle, and a thumbnail. On launch, fine. Rotate the phone: console floods with \`Unable to simultaneously satisfy constraints\`, the cell jumps, and after a few rotations the vertical stack is stretched or clipped. Instruments shows layout work climbing.

\`\`\`swift
final class FeedCell: UICollectionViewCell {
    let title = UILabel()
    let thumb = UIImageView()
    private var added = false

    override func layoutSubviews() {
        super.layoutSubviews()
        if thumb.superview == nil {
            contentView.addSubview(thumb)
            contentView.addSubview(title)
        }
        NSLayoutConstraint.activate([
            thumb.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            thumb.widthAnchor.constraint(equalToConstant: 72),
            thumb.heightAnchor.constraint(equalToConstant: 72),
            title.leadingAnchor.constraint(equalTo: thumb.trailingAnchor, constant: 12),
            title.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),
            title.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            contentView.heightAnchor.constraint(equalToConstant: traitCollection.verticalSizeClass == .compact ? 56 : 88),
        ])
    }
}
\`\`\`

Self-sizing cells. Compositional layout estimated size. After rotate, a height of 88 and a height of 56 both exist. Why? Where should constraints be installed, what belongs in \`traitCollectionDidChange\` / \`layoutSubviews\`, and how does reuse make this worse?`,
      think: [
        'How many times does layoutSubviews run during a rotation, and what does activate do on the second pass?',
        'Can you have two height constraints of different constants on the same view if you never deactivate the old one?',
        'Is contentView.heightAnchor the right way to size a self-sizing cell?',
        'What happens when this cell is reused for a row that had a different trait-driven height?',
      ],
      solution: `Install the **invariant** constraints once, when you build the hierarchy. Mutate constants or activate/deactivate *named* constraints when traits change. Never \`activate\` a fresh set in \`layoutSubviews\`.

\`\`\`swift
final class FeedCell: UICollectionViewCell {
    private let thumb = UIImageView()
    private let title = UILabel()
    private var heightConstraint: NSLayoutConstraint!

    override init(frame: CGRect) {
        super.init(frame: frame)
        contentView.addSubview(thumb)
        contentView.addSubview(title)
        thumb.translatesAutoresizingMaskIntoConstraints = false
        title.translatesAutoresizingMaskIntoConstraints = false
        heightConstraint = contentView.heightAnchor.constraint(equalToConstant: 88)
        heightConstraint.priority = .defaultHigh
        NSLayoutConstraint.activate([
            thumb.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            thumb.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            thumb.widthAnchor.constraint(equalToConstant: 72),
            thumb.heightAnchor.constraint(equalToConstant: 72),
            title.leadingAnchor.constraint(equalTo: thumb.trailingAnchor, constant: 12),
            title.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),
            title.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            heightConstraint,
        ])
    }

    override func traitCollectionDidChange(_ previous: UITraitCollection?) {
        super.traitCollectionDidChange(previous)
        heightConstraint.constant = traitCollection.verticalSizeClass == .compact ? 56 : 88
    }

    override func prepareForReuse() {
        super.prepareForReuse()
        // reset content, not constraints
    }
}
\`\`\`

Better than a fixed height on \`contentView\`: let the labels and image define intrinsic height, use Auto Layout, and tell the collection view to self-size. A required 88-point height *and* an estimated layout size that disagrees is how you get unsatisfiable logs even with a single constraint set.

\`layoutSubviews\` is for applying frames when you are not using Auto Layout, or for cheap work that depends on \`bounds.size\` (gradient frames, corner radius). It is not a constraint factory. Adding constraints there runs every layout pass, including the passes Auto Layout *itself* triggers — a loop. Problem 5 is the hitch version of that loop even after you stop duplicating equations.`,
      explanation: `The console message is easy to ignore until a cell looks drunk after a rotate. "Unable to simultaneously satisfy" means you asked Auto Layout for two things that cannot both be true. In this cell the two things are often "height is 88" and "height is 56," and they are both still active because each \`layoutSubviews\` *added* a new height constraint without removing the last one.

Rotation is a stress test of layout. Bounds change, traits change, the collection view invalidates, every visible cell lays out, estimated sizes are asked again, and \`layoutSubviews\` may run several times per cell. \`NSLayoutConstraint.activate\` does not upsert. It appends. After three rotations you have a pile of 72-point widths (those happen to agree) and a pile of heights (those do not). Unsatisfiable, then a runtime choice to break one, then a jump. Reuse makes it historical: a cell that lived through three rotations carries six extra constraints into the next index path, even if that row never rotated in front of the user.

The deeper mistake is using \`layoutSubviews\` as \`viewDidLoad\` for a cell. Cells do not have \`viewDidLoad\`. They have \`init(frame:)\` / \`awakeFromNib\`, \`configure\`, \`prepareForReuse\`, and trait callbacks. Hierarchy and constraints belong in init. Content belongs in configure. Resetting images and cancelling work belongs in prepareForReuse (problem 1). Trait-dependent *constants* belong in \`traitCollectionDidChange\`, or in a small \`updateConstraintsForTraits()\` that you also call from configure so a reused cell picks up the current traits without waiting for a change callback that will not fire.

Pinning \`contentView\` to a constant height fights self-sizing. The collection view wants to ask the cell how tall it is. You already answered 88, then the layout estimated 56 in compact, then the image's intrinsic 72 disagreed. Pick one sizing model: intrinsic content with estimatedItemSize / compositional estimated dimension, *or* a fixed size in the layout object — not both, and not a new required height every pass.`,
      internals: `Auto Layout builds an equation system. Each constraint is an equation. Duplicate equal-to-constant heights with different constants are unsatisfiable; duplicate identical ones are redundant and cost solver time. Unsatisfiable constraints are dropped at runtime with a log; the leftover system may still layout, which is why the bug looks "intermittent" until it does not.

\`layoutSubviews\` is called because bounds changed or \`setNeedsLayout\` was set. Activating constraints inside it calls \`setNeedsUpdateConstraints\` / layout on the same view, which can schedule another pass. That is the climbing layout work in Instruments.

\`translatesAutoresizingMaskIntoConstraints\` defaults to \`true\` for views you allocate in code. Combined with explicit constraints you get a second, implicit set of equations from the current frame. Set it to \`false\` when you opt into Auto Layout. Forgetting that on \`contentView\` itself is a classic cell foot-gun — you usually do not pin the cell; you pin inside \`contentView\`, and the cell's size comes from the layout object.

\`traitCollectionDidChange\` is deprecated in favour of registering for trait changes on newer OS versions, but the idea is the same: react to the trait, do not poll it in every layout pass. Problem 8 is what happens when the thing you cache off the trait is an image rather than a constant.`,
      testing: `A snapshot or layout test: host the cell at a compact height and a regular height, assert no unsatisfiable log (you can hook \`UIView\` alert or check constraint counts). Assert \`contentView.constraints.count\` is stable across 10 layout passes and a trait change.

Rotate a collection view in a UI test and assert the cell's image view width is still 72, not 144. Constraint count on a reused cell after rotation should match a freshly dequeued cell.

Debug: breakpoint on \`UIViewAlertForUnsatisfiableConstraints\`. The log's two lists tell you which height you forgot to deactivate.`,
      pitfalls: `\`updateConstraints\` that always activates without a flag — same bug, different method. Setting frames and constraints on the same views. Required 1 000-point-wide constraints copied from a storyboard that assumed iPhone 8, then unsatisfiable on iPhone SE after rotate to landscape.

Fixing the log by lowering every priority to 999 so the solver always "succeeds" while the layout is still wrong. The log is a gift. Do not mute it.

Adding constraints in \`configure\` every time without a "already installed" guard — reuse will duplicate even if you left \`layoutSubviews\` alone.`,
      alternatives: `UIStackView inside the cell for the horizontal pair, with spacing, and one height model. Manual frame layout in \`layoutSubviews\` for a cell this simple is valid and fast. Pick a religion per cell; do not mix frames for the thumb and constraints for the title unless you enjoy debugging.`,
      tradeoffs: `Self-sizing looks right for long titles and costs you estimated-size passes and jumpiness if the estimate is a lie (problem 6). Fixed-height cells are honest and clip. For a feed of avatars, fixed height is usually enough. For chat bubbles, self-size and invest in estimates.

Installing constraints once is more code in \`init\` and less in the hot path. That is the correct direction. Trait-specific *constraints* (not just constants) — hiding a view in compact — should activate/deactivate named constraints, not rebuild the set.`,
      followups: [
        {
          q: 'Should you override updateConstraints instead?',
          a: 'Only if constraints truly depend on state that changes. Call setNeedsUpdateConstraints from configure. Still mutate, do not append blindly. layoutSubviews remains the wrong factory.',
        },
        {
          q: 'contentView versus the cell for constraints?',
          a: 'Always inside contentView. UICollectionView owns the cell size. Fighting that with cell.widthAnchor required constraints is a conflict with the layout object.',
        },
        {
          q: 'Why is the image 72×72 visually but unsatisfiable after rotate?',
          a: 'Widths agreed so the broken constraint was height. The log still fires. Visuals can look fine while the solver throws away a height you needed for the next size class.',
        },
        {
          q: 'Does prepareForReuse need to remove constraints?',
          a: 'No, if they are the invariant set. Reset content. If a rare cell variant needs a different constraint set, swap named constraints, do not rebuild from scratch each reuse.',
        },
        {
          q: 'Compositional layout estimated dimension still jumping?',
          a: 'Estimates that do not match intrinsic height cause a second layout pass when the cell is created. Make the estimate close, or use a fixed size. The duplicate-constraint bug makes the jump much worse; fix that first. Then see problem 6.',
        },
      ],
      teaches: [
        'layoutSubviews is not for adding constraints',
        'activate appends; rotation duplicates equations',
        'Cells: init installs, configure fills, reuse resets content',
        'Self-sizing versus fixed height is one choice',
        'translatesAutoresizingMaskIntoConstraints',
        'Trait changes mutate constants, they do not rebuild',
      ],
    },
    {
      id: 'd3-p4',
      title: 'Diffable snapshot crash, two applies in flight',
      difficulty: 'Expert',
      kind: 'Architecture',
      prompt: `Production crash:

\`\`\`text
NSInternalInconsistencyException
Invalid update: invalid number of items in section 0.
The number of items contained in an existing section after the update (42)
must be equal to the number of items contained in that section before the update (40),
plus or minus the number of items inserted or deleted from that section (3 inserted, 0 deleted)
and plus or minus the number of items moved into or out of that section (0 moved in, 0 moved out).
\`\`\`

The feed applies snapshots from two places: a pull-to-refresh \`Task\`, and a websocket \`@MainActor\` handler that inserts a new post. Sometimes both run after a background fetch hops back. There is also a \`collectionView.reloadData()\` "just in case" in \`viewWillAppear\`. A junior suggests \`DispatchQueue.main.async\` around every apply.

Design how snapshots are applied so two updates cannot race, what must never be mixed with diffable applies, and how this relates to cell identity from problem 1.`,
      think: [
        'Who owns the source of truth — the snapshot, the VM array, or the collection view?',
        'What happens if apply(animatingDifferences: true) is called again before the first apply finishes?',
        'Why does reloadData next to a snapshot corrupt counts?',
        'Is hopping to main enough if two Tasks both hop to main?',
      ],
      solution: `One pipeline. One source of truth. Applies are serial and only from that pipeline.

\`\`\`swift
@MainActor
final class FeedViewController: UIViewController {
    private let dataSource: UICollectionViewDiffableDataSource<Section, Post.ID>
    private var posts: [Post] = []
    private var applyTask: Task<Void, Never>?

    func setPosts(_ new: [Post], animating: Bool) {
        posts = new
        applyTask?.cancel()
        applyTask = Task {
            var snap = NSDiffableDataSourceSnapshot<Section, Post.ID>()
            snap.appendSections([.main])
            snap.appendItems(new.map(\\.id), uniquingIDsWith: { a, _ in a })
            await dataSource.apply(snap, animatingDifferences: animating)
        }
    }
}
\`\`\`

Rules:

1. **The snapshot is derived from the model.** Websocket and refresh both mutate \`posts\` (or a store), then ask for \`setPosts\`. They never each build a snapshot from a stale copy.
2. **Serialise applies.** \`apply\` is async in the modern API; it can still be in flight when you call it again. Cancel-and-replace, or an actor / a single Task queue that awaits the previous apply. \`DispatchQueue.main.async\` does **not** serialise two already-main tasks.
3. **Never \`reloadData()\`** on a collection view owned by a diffable data source. Never \`insertItems(at:)\` either. You opted out of that API.
4. **Stable identifiers.** \`Post.ID\`, not \`IndexPath\`, not a struct without \`Hashable\` identity. Duplicate ids in one snapshot are their own crash.
5. **Main actor.** Snapshot apply touches UIKit. Build the snapshot from Sendable model data; apply on main.

If animation is the thing racing, apply the second snapshot with \`animatingDifferences: false\` when an apply is already running, or coalesce to the latest model and skip intermediate frames.`,
      explanation: `The crash text is long so people stop reading. It is saying: the collection view believed it had 40 items, you told it a diff that implies 43, and after the animation the data source reports 42. Someone updated the world twice, and the two stories do not add up.

Diffable data source is a contract. You hand it a snapshot of identities. It diffs against the last snapshot *it applied*, and it talks to the collection view with insert/delete/move. If a second apply starts while the first is still animating, or if \`reloadData()\` resets the collection view's idea of counts without resetting the data source's last snapshot, the next diff is computed against a lie. That is an inconsistent snapshot. It is not a random UIKit bug. It is two writers.

Pull-to-refresh and a websocket are two writers. Both hop to main, so "we are on the main thread" feels safe. Main is concurrent in the sense that two Tasks can interleave at await points. \`apply(animatingDifferences:)\` awaits the animation. The websocket's apply starts in the gap. You now have two diffs in flight against moving counts. \`DispatchQueue.main.async\` just enqueues another writer.

The architecture is the same as Day 2's search: **join or cancel-and-replace**, do not start independent updates. The model (\`posts\`) is the source of truth. The snapshot is a projection. The collection view is not a store. \`reloadData()\` in \`viewWillAppear\` is a third writer that says "throw away your cells" without telling the diffable source, which is how you get 40 versus 42 versus 43.

Stable ids tie this to the avatar race. If your item identifier is a poorly hashed \`Post\` value that changes when the like count changes, the snapshot thinks that row was deleted and a new one inserted. The cell is new, \`prepareForReuse\` may not run the way you think, and images flash. Identifiers are identity, again.`,
      internals: `\`UICollectionViewDiffableDataSource.apply\` computes a difference between snapshots and submits a performBatchUpdates-style update. Nested batch updates, or a reload in the middle, trip an internal consistency check: \`new = old + inserts - deletes + moves\`. The numbers in the exception are that equation failing.

The newer \`apply(_:animatingDifferences:completion:)\` and the async variant still mutate the same data source. Cancellation of a Task that has already started \`apply\` may not abort UIKit's animation; that is why coalescing to the latest model and applying once is more reliable than hoping cancel is surgical.

Diffable identifiers must be unique in the snapshot. Using the whole \`Post\` as the identifier without a stable \`id\` component means equality includes like counts. Using \`IndexPath\` as an identifier is a category error: paths are positions.

Background threads: even constructing UIKit cells is main-only. You can build the array of ids off main; you apply on main. A data source closure (\`cellProvider\`) runs on main when the collection view asks.`,
      testing: `A fake clock and two call sites: refresh completes with 40 posts, websocket inserts one in the same run loop turn, assert a single apply ran with 41 ids and no crash. XCTest with a real \`UICollectionView\` in a window is worth it for this; you are testing UIKit's consistency check.

Duplicate id test: snapshot with two of the same \`Post.ID\` should be caught by your uniquing, not by a crash in production.

A test that \`viewWillAppear\` does not call \`reloadData\`. That is a grep test and a code review rule, and it prevents the third writer.

Do not "test" this by adding \`sleep\` in the websocket handler.`,
      pitfalls: `Applying from a background queue because decoding happened there. Mixing \`NSDiffableDataSourceSnapshot\` with \`reloadSections\`. Recreating the \`UICollectionViewDiffableDataSource\` when the VC reloads — you lose the last snapshot. Using \`animatingDifferences: true\` for a full refresh of 1 000 rows (slow, more time to race). Swallowing the exception.

Hashing \`Post\` with a UUID generated in the mapper every decode — every refresh is a complete delete+insert, cells all reuse as different identities, and you paid for diffable to do \`reloadData\` with extra steps.`,
      alternatives: `A serial \`AsyncStream\` of feed events consumed by one loop that applies. An actor store that publishes \`[Post]\` and a single \`sink\` on main applies. UITableView diffable is the same contract.

If the team cannot stop calling \`reloadData\`, they are not ready for diffable. Stay on reload until the writers are unified; a crashy diffable feed is worse than a blunt one.`,
      tradeoffs: `Coalescing to the latest snapshot drops intermediate animations (you might not see the single-row insert if a full refresh is in flight). That is usually what you want on a feed. A chat transcript may want the opposite: queue the inserts so messages animate in order. Serial queue, no cancel, still one writer.

\`animatingDifferences: false\` is the cheap apply and the honest one for large diffs. Use animation for small, user-meaningful changes.`,
      followups: [
        {
          q: 'apply versus applySnapshotUsingReloadData?',
          a: 'Reload-style apply resets without a diff — safer when you know everything changed, still must be the only writer. It does not make mixing reloadData legal.',
        },
        {
          q: 'Can the cellProvider close over a [Post] copied at apply time?',
          a: 'It can, and it will go stale. Look up the post by id from the store when configuring. The snapshot stores ids, not the payloads, unless you use a snapshot that includes them.',
        },
        {
          q: 'Websocket on a background thread inserts into posts then apply on main — enough?',
          a: 'Mutating posts must be isolated (actor or main). If two mutations interleave, the snapshot can still skip an item. Isolate the model, then apply.',
        },
        {
          q: 'How does this show up in SwiftUI?',
          a: 'ForEach + List has its own diff (Day 4). Two @Published writes of the whole array is usually OK because it is one source on the VM. Two stores both writing the array is the same two-writer bug without the NSException — you get flicker and identity resets.',
        },
        {
          q: 'Should identifiers be UUIDs from the server?',
          a: 'Yes if they are stable. A client-generated UUID per decode is a new identity every refresh. Client ids are for optimistic inserts, replaced by server ids in a later snapshot — carefully, with a mapping, or you animate a delete+insert of the same message.',
        },
      ],
      teaches: [
        'Diffable snapshots have one writer',
        'apply can be in flight across await',
        'reloadData and snapshots cannot mix',
        'Main-thread is not a queue of one',
        'Item identity is Hashable id, not the row value',
        'Model is source of truth; snapshot is a projection',
      ],
    },
    {
      id: 'd3-p5',
      title: 'layoutSubviews invalidates itself every frame',
      difficulty: 'Senior',
      kind: 'Performance',
      prompt: `A profile header under a stretching nav bar hitches while you drag. Time Profiler is a wall of \`layoutSubtreeIfNeeded\`. Color Blended Layers is fine. The header looks innocent:

\`\`\`swift
final class ProfileHeaderView: UIView {
    let name = UILabel()
    let badge = UILabel()
    let card = UIView()
    private let badgeWidth = NSLayoutConstraint()

    override func layoutSubviews() {
        super.layoutSubviews()
        badgeWidth.constant = badge.intrinsicContentSize.width + 16
        name.preferredMaxLayoutWidth = bounds.width - 32
        card.layer.shadowPath = UIBezierPath(roundedRect: card.bounds, cornerRadius: 12).cgPath
        if bounds.width < 360 {
            stack.axis = .vertical
        } else {
            stack.axis = .horizontal
        }
        invalidateIntrinsicContentSize()
    }
}
\`\`\`

Constraints were installed once in \`init\` — problem 3 is "fixed." Why is layout still looping, and what is legal to do in \`layoutSubviews\`?`,
      think: [
        'Which of these lines can schedule another layout pass on the same view?',
        'Does preferredMaxLayoutWidth changing every pass count as a new intrinsic size?',
        'When is writing shadowPath cheap, and when does it dirty the layer tree?',
        'Is changing UIStackView.axis inside layout a bounds-dependent input or a new layout request?',
      ],
      solution: `\`layoutSubviews\` may read \`bounds\` and apply geometry that does **not** ask for another layout. It may not change the inputs Auto Layout will use to compute those bounds.

\`\`\`swift
final class ProfileHeaderView: UIView {
    private var lastSize: CGSize = .zero
    private let badgeWidth: NSLayoutConstraint

    override func layoutSubviews() {
        super.layoutSubviews()
        let size = bounds.size
        guard size != lastSize else { return }
        lastSize = size
        card.layer.shadowPath = UIBezierPath(roundedRect: card.bounds, cornerRadius: 12).cgPath
    }

    override func updateConstraints() {
        badgeWidth.constant = badge.intrinsicContentSize.width + 16
        super.updateConstraints()
    }

    func configure(name: String, compact: Bool) {
        self.name.text = name
        self.name.preferredMaxLayoutWidth = 0
        stack.axis = compact ? .vertical : .horizontal
        setNeedsUpdateConstraints()
    }
}
\`\`\`

Rules:

1. **Guard on \`bounds.size\`** for shadow paths, gradient frames, corner radius that tracks size. No guard means you rebuild a \`CGPath\` every pass, which is work, and sometimes a dirty.
2. **Never \`invalidateIntrinsicContentSize()\` unconditionally from \`layoutSubviews\`.** That is "please layout me again" written in API.
3. **\`preferredMaxLayoutWidth\`** is an Auto Layout input. Set it when the width *constraint* is known (after a pass you control, or from the collection view's item width in \`configure\`), not as a side effect of every layout.
4. **Stack \`axis\`** belongs in configure / trait callback, not in layout. Changing axis invalidates the stack's constraints.
5. **Constraint constants** belong in \`updateConstraints\` or in the code that knows the badge text changed. Call \`setNeedsUpdateConstraints()\` from there.

Problem 3 was duplicate equations. This is a well-formed system that never reaches equilibrium because layout keeps rewriting its own inputs.`,
      explanation: `You already stopped activating constraints in \`layoutSubviews\`. The unsatisfiable log is gone. Instruments still says the header is laying out several times per frame while the user drags a stretchy navigation bar. That drag changes \`bounds\` a lot, which is fair. What is not fair is that each pass *asks for another pass*.

Auto Layout's contract is: we will call \`layoutSubviews\` when your bounds are decided. You may position things that Auto Layout does not own (a CAGradientLayer's frame, a shadow path that must match the rounded rect). You may not, from inside that call, change a constraint constant, an intrinsic size, a stack axis, or a label's preferred max width, because those are inputs to the *next* solve. The engine dirty-flags the view, schedules another layout, and if the new constant still does not match what you will write next time, you loop until the run loop gives up or you hitch.

\`invalidateIntrinsicContentSize()\` is the loud version. \`preferredMaxLayoutWidth = bounds.width - 32\` is the quiet version: the label's intrinsic height depends on that width, so the header's intrinsic height changes, so the collection view asks again. Changing \`UIStackView.axis\` rebuilds the stack's constraints. A badge-width constant that tracks \`intrinsicContentSize\` every pass will jitter if the font has not finished applying, which during a rotation it has not.

The senior instinct is the same as reuse: \`layoutSubviews\` is not \`configure\`. It is "bounds are now this." If the work you want needs a different width, do it when you *learn* the width — \`viewDidLayoutSubviews\` on the controller once, with a last-width guard, or a collection view layout that already knows the item size. If you need a shadow path, cache the size you built it for.`,
      internals: `UIView layout is a dirty-flag machine: \`setNeedsLayout\` / \`setNeedsUpdateConstraints\` / \`invalidateIntrinsicContentSize\` mark bits. The next \`layoutIfNeeded\` (or the run loop's CA commit) walks the tree. Writing a constraint constant calls \`setNeedsUpdateConstraints\` on the affected views. \`UIStackView\` axis changes replace constraints. \`UILabel.preferredMaxLayoutWidth\` participates in intrinsic content size.

\`layoutSubviews\` after \`super\` sees the bounds Auto Layout just applied. Creating a new \`UIBezierPath\` every time is CPU; assigning \`shadowPath\` is usually the right way to *avoid* offscreen shadow rendering (problem 12), but only when the path actually changed.

Nested layoutIfNeeded from inside layoutSubviews is how you get "layout while layout is happening" warnings and re-entrant constraint solves. The stretching header is a worst case because the scroll view changes bounds on every tick of the pan.`,
      testing: `A unit-ish layout test: set the header's bounds to 390×120, call \`layoutIfNeeded\`, count constraint updates or hook \`setNeedsLayout\` with a test double. A second \`layoutIfNeeded\` with the same bounds must not dirty layout again.

Instruments: Core Animation → Color Offscreen-Rendered Yellow is a different issue. Here you want Time Profiler samples in \`layoutSubtreeIfNeeded\` to drop when you drag. A counter in \`layoutSubviews\` printed with bounds: after the fix, same bounds → no extra calls.

UI test that stretches the header must not assert frame-time; use the counter in DEBUG.`,
      pitfalls: `Fixing the loop by removing \`super.layoutSubviews()\`. Setting \`translatesAutoresizingMaskIntoConstraints = true\` *and* Auto Layout on the same view so frame writes fight the solver. Calling \`layoutIfNeeded\` on \`superview\` from the header to "finish" — you just re-entered the parent.

Putting the size guard in the wrong place so rotation never updates \`shadowPath\`. Guard on size, not on "have I ever laid out."`,
      alternatives: `Manual frame layout for the header if it is truly a stretching parallax thing — scroll-driven frames belong in \`scrollViewDidScroll\`, not in Auto Layout at all. A compositional boundary supplementary with a fixed height so the header is not self-sizing during the pan.

\`viewDidLayoutSubviews\` on the view controller with a last-size guard is often the right place to push a width into a child that still needs \`preferredMaxLayoutWidth\`.`,
      tradeoffs: `A last-size guard misses subpixel churn if you compare \`CGSize\` with equality during a rubber-band; comparing rounded widths is usually enough. Updating constraints in \`updateConstraints\` is the textbook API and easy to forget to call \`setNeedsUpdateConstraints\` from configure. Configure-time constants are less "pure" and much harder to loop.`,
      followups: [
        {
          q: 'Is viewDidLayoutSubviews safer than layoutSubviews for constraint constants?',
          a: 'Slightly — the tree has settled — and it can still loop if you invalidate from there. Same guard. Prefer configure / updateConstraints for constants.',
        },
        {
          q: 'Why did shadowPath belong in layoutSubviews at all?',
          a: 'It is derived from bounds, not an Auto Layout input. Rebuilding it is geometry, not a new equation. Guard on size so you do not pay CGPath every frame.',
        },
        {
          q: 'preferredMaxLayoutWidth = 0?',
          a: 'Lets the label use the width Auto Layout already gave it (iOS has gotten better at this). Setting it from bounds inside layout is the old UITableView cell trick and the loop source.',
        },
        {
          q: 'How is this different from problem 3?',
          a: 'Problem 3 appends equations until they contradict. This keeps one honest system and never lets it rest. Both show up as layout time in Instruments.',
        },
      ],
      teaches: [
        'layoutSubviews must not rewrite Auto Layout inputs',
        'invalidateIntrinsicContentSize from layout is a loop',
        'Guard shadowPath and frames on bounds.size',
        'Stack axis and preferredMaxLayoutWidth are configure-time',
        'updateConstraints mutates; layoutSubviews applies',
      ],
    },
    {
      id: 'd3-p6',
      title: 'estimatedRowHeight, then the feed jumps',
      difficulty: 'Senior',
      kind: 'Incident',
      prompt: `A UITableView of chat bubbles. \`rowHeight = automaticDimension\`, \`estimatedRowHeight = 44\`. Most rows are 80–220 pt. Scrolling down is mostly fine. Scrolling *up* from the latest message, or jumping to a timestamp, the content jumps. \`contentOffset\` after a reload is wrong. Self-sizing collection cells with a compositional \`NSCollectionLayoutDimension.estimated(44)\` do the same thing on rotate (problem 3's leftover).

The cell is Auto Layout, labels wrap, an image has no height constraint until the download finishes. A junior sets \`estimatedRowHeight = 200\` globally. Another caches \`CGFloat\` heights in a dictionary keyed by \`IndexPath\`.

Why does the table jump, what is the estimate actually for, and how do you size rows whose media arrives late without fighting the offset?`,
      think: [
        'What does UITableView use estimatedRowHeight for before the cell exists?',
        'Why does a too-short estimate make scrolling up worse than scrolling down?',
        'Is IndexPath a stable key for a height cache after an insert at 0?',
        'When the image arrives and the cell grows, who is responsible for not shoving the user?',
      ],
      solution: `The estimate is a *placeholder for off-screen rows* so the scroll view can compute content size without dequeuing the world. If it is a lie, the table corrects when the cell is actually measured, and \`contentOffset\` has to move to keep the same cells on screen — that is the jump.

\`\`\`swift
tableView.rowHeight = UITableView.automaticDimension
tableView.estimatedRowHeight = 120 // median bubble, not 44, not 2000

final class ChatViewController: UIViewController, UITableViewDelegate {
    private var heightByID: [Message.ID: CGFloat] = [:]

    func tableView(_ tableView: UITableView, estimatedHeightForRowAt indexPath: IndexPath) -> CGFloat {
        let id = store.id(at: indexPath)
        return heightByID[id] ?? 120
    }

    func tableView(_ tableView: UITableView, willDisplay cell: UITableViewCell, forRowAt indexPath: IndexPath) {
        heightByID[store.id(at: indexPath)] = cell.bounds.height
    }
}
\`\`\`

Rules:

1. **Estimate the median, not the minimum.** 44 is a subtitle cell. Chat is not. A close estimate reduces corrections.
2. **Cache by item id**, not \`IndexPath\`. Inserts at 0 are the chat case. Same instinct as problem 1.
3. **Give images a reserved height** (aspect ratio constraint from the known pixel size, or a placeholder aspect) *before* the bitmap arrives. Growing a row after display is a jump even with a perfect estimate.
4. **Do not \`reloadData()\` to "recompute heights."** Invalidate one row (\`reconfigureRows\` / \`reloadRows\` with a height cache already primed) or use diffable with a new snapshot that does not change ids.
5. **Inverted chat** (\`transform = CGAffineTransform(scaleX: 1, y: -1)\` on table and cells) makes estimate errors feel like the floor moving. Get estimates right first; inversion is optional sugar.

Compositional lists: \`NSCollectionLayoutDimension.estimated\` is the same contract. \`absolute\` / \`fractionalHeight\` if the row is actually fixed. Mixing estimated with a required height constraint on \`contentView\` is problem 3 again.`,
      explanation: `The report is "the table is possessed." You are reading old messages, a new one arrives at the bottom, and the bubble you were looking at slides. Or you tap "scroll to date" and land three rows off. Nobody wrote \`setContentOffset\` in the wrong place. The table view *thought* the content was shorter than it is.

\`estimatedRowHeight\` exists so UITableView does not have to instantiate every cell to know how tall the document is. It multiplies estimate × remaining rows, plus measured heights of visible ones, and that sum is \`contentSize\`. When a cell appears and Auto Layout says 180 instead of 44, the table inserts 136 points into the document. If those points are *above* the viewport — you are scrolling up through history — the offset is adjusted and you feel a jump. Scrolling down, the extra height is still off-screen below, so you notice less. That is why "it only happens going up" is a clue, not a second bug.

Late media is a second correction. The cell laid out at placeholder height, then the JPEG arrived, the image view's intrinsic size changed, the row grew. The estimate was not the villain; the missing aspect constraint was. You would see the same jump in a collection view with estimated supplementary views.

Caching heights in an \`IndexPath: CGFloat\` dictionary is how you ship a slightly faster version of the same jump after an insert. Paths move. Ids do not. Measuring in \`willDisplay\` and returning it from \`estimatedHeightForRowAt\` is the boring fix that works. Prefetching (problem 7) does not measure Auto Layout for you; it is for data, not for heights.`,
      internals: `UITableView keeps a height cache internally once a row has been displayed. \`estimatedHeightForRowAt\` is consulted for rows that have not. \`reloadData\` throws that cache away. \`beginUpdates\`/\`endUpdates\` with a height change on a visible row animates the correction; without it, the jump is abrupt.

Self-sizing uses the cell's Auto Layout system against the table width. If the cell needs \`preferredMaxLayoutWidth\` (problem 5) or has an ambiguous height, the measured height is wrong once, then "corrects" later — another jump. \`systemLayoutSizeFitting\` in \`sizeThatFits\` on a collection cell is the equivalent measurement.

Compositional layout estimated dimensions trigger a second layout pass when the actual size differs. The collection view invalidates the layout for that item. Do that for 40 visible estimated items on rotate and you dropped frames even if constraints are unique.`,
      testing: `A table in a test window, 50 rows of known heights 80/120/200, estimate 120. Scroll to row 0 from row 49, assert the first cell's minY is stable across a run loop turn after display (not drifted by 50×(120-80)).

Insert a row at 0 with a cached height, assert visible message id did not change.

Image-arrival: configure a cell with a 4:3 placeholder constraint, complete the load with that aspect, assert bounds.height unchanged. Then complete with a different aspect and decide if product wants a grow; if not, crop.

Do not UI-test "feels jumpy." Measure offset.`,
      pitfalls: `\`UITableView.automaticDimension\` for \`estimatedRowHeight\` itself — illegal / ignored depending on OS, not a solution. \`heightByID\` never evicted, so a 10 000-message cache holds heights for deleted threads. Calling \`invalidateIntrinsicContentSize\` on the image view when the bitmap is the same size.

Forcing \`layoutIfNeeded\` in \`cellForRow\` to "prime the cache" — you just paid layout on the hot path for every dequeue (problem 12).`,
      alternatives: `Fixed row heights for a feed of identical cards. Prototype cells in a storyboard whose size is the estimate. Texture / Texture-style async layout if you are already in that religion — not an interview default.

A collection view compositional list section is UITableView with extra steps; the estimate contract does not go away because you changed classes.`,
      tradeoffs: `A high estimate wastes empty content size (rubber-band feels long) and still jumps down. A low estimate jumps up. Median plus id-cache is the practical middle. Reserving image height can show letterboxing until load; growing the row is smoother visually and ruder to the offset. Chat usually reserves.`,
      followups: [
        {
          q: 'scrollToRow(at:.bottom) after reload lands short. Why?',
          a: 'Reload threw estimated heights at the problem. contentSize is still a guess. Layout the table, or scroll after willDisplay has measured the last rows, or seed the cache.',
        },
        {
          q: 'Should estimatedHeightForRowAt do Auto Layout?',
          a: 'No. That is cellForRow without a cell. Return a cache hit or a constant. Measuring here makes scroll hitch like problem 12.',
        },
        {
          q: 'UICollectionViewFlowLayout estimatedItemSize = automaticSize?',
          a: 'Same idea, worse stories on rotate. Prefer compositional with explicit estimated or absolute per item type.',
        },
        {
          q: 'Does diffable fix jumps?',
          a: 'No. It fixes identity. Heights are a layout cache. A snapshot apply that reloads every item throws measurements away.',
        },
        {
          q: 'Inverted table for chat — still estimates?',
          a: 'Yes. You flipped drawing, not math. Bad estimates now jump the "bottom," which is the top of the scroll view. Still cache by id.',
        },
      ],
      teaches: [
        'estimatedRowHeight is a contentSize guess',
        'Corrections above the viewport feel like jumps',
        'Cache heights by item id, not IndexPath',
        'Reserve media aspect so late loads do not grow the row',
        'reloadData throws the height cache away',
      ],
    },
    {
      id: 'd3-p7',
      title: 'Prefetch fills RAM, cancel never runs',
      difficulty: 'Senior',
      kind: 'Debug',
      prompt: `The avatar collection from problem 1 still flashes on a fast fling, and after a minute Allocations has hundreds of in-flight \`URLSessionTask\`s. Prefetch was "added":

\`\`\`swift
func collectionView(_ collectionView: UICollectionView,
                    prefetchItemsAt indexPaths: [IndexPath]) {
    for path in indexPaths {
        let user = users[path.item]
        loader.warm(url: user.avatarURL) { _ in }
    }
}

func collectionView(_ collectionView: UICollectionView,
                    willDisplay cell: UICollectionViewCell,
                    forItemAt indexPath: IndexPath) {
    loader.warm(url: users[indexPath.item].avatarURL) { image in
        (cell as? AvatarCell)?.imageView.image = image
    }
}
\`\`\`

\`cancelPrefetchingItemsAt\` is unimplemented. \`cellForItem\` also starts a load (the problem 1 code). The loader de-dupes by URL only while the first request is in flight; completed images sit in an unbounded NSCache.

What is prefetch for, what must be cancelled, and why is assigning in \`willDisplay\` a reuse bug even with prefetch?`,
      think: [
        'Does prefetch run for cells that will never appear?',
        'Who calls cancelPrefetching, and does a fling the other way generate those calls?',
        'If willDisplay captures cell and a completion, is that prepareForReuse?',
        'Should prefetch decode to the avatar pixel size, or just download bytes?',
      ],
      solution: `Prefetch is a hint that those index paths are *likely* to appear. It is not a license to bind a cell, and it is not fire-and-forget.

\`\`\`swift
func collectionView(_ cv: UICollectionView, prefetchItemsAt indexPaths: [IndexPath]) {
    for path in indexPaths {
        guard let id = dataSource.itemIdentifier(for: path) else { continue }
        loader.prefetch(id: id, url: store.avatarURL(id), size: avatarPixels)
    }
}

func collectionView(_ cv: UICollectionView, cancelPrefetchingItemsAt indexPaths: [IndexPath]) {
    for path in indexPaths {
        guard let id = dataSource.itemIdentifier(for: path) else { continue }
        loader.cancelPrefetch(id: id)
    }
}
\`\`\`

The cell still \`configure\`s in \`cellForItem\` / the diffable provider, with prepareForReuse cancel (problem 1). Prefetch fills a sized cache. Configure is a cache hit or a start. Completions never capture the cell from \`willDisplay\` or prefetch.

Rules:

1. **Implement cancel.** UIKit will ask you to drop work for paths the user flung past. Ignore that and you download the whole list.
2. **Key by item id**, from the diffable identifier, not \`users[path.item]\` after an insert.
3. **Prefetch downloads and downsamples.** It does not touch UIKit views. Decode off main to avatar size (problem 1 follow-up).
4. **One owner for in-flight work per id.** Cell task *or* prefetch task, with a loader that coalesces. Three starts (prefetch, willDisplay, cellForItem) is how you get hundreds of tasks.
5. **Bound the cache.** Cost is decoded bytes, not entry count.

\`isPrefetchingEnabled = false\` if you cannot cancel. A broken prefetch is worse than none.`,
      explanation: `Prefetch looks like a performance win in a WWDC slide. On a fast fling it is a request amplifier. UIKit looks ahead — sometimes dozens of index paths — and calls \`prefetchItemsAt\`. If the user reverses, it calls \`cancelPrefetchingItemsAt\` for the ones that will not appear. Your code started the work and never listened for the cancel, so the radio and the decoder kept going. Allocations is not leaking cells. It is leaking tasks, image buffers, and URLSession's appetite.

\`willDisplay\` assigning onto \`cell\` is problem 1 in a different method. \`willDisplay\` is not exclusive to one item for the life of the cell instance. The cell will be reused. The closure you started there still holds that instance. Prefetch made it worse by starting even earlier, with no cell at all, and then \`willDisplay\` started *again* and wrote into whatever cell happened to be passing by.

De-dupe-by-URL-while-in-flight is necessary and insufficient. After the first avatar completes, the next prefetch of the same URL might be a cache hit — good — or a new decode because you stored the original 3 000 px JPEG. Unbounded NSCache is a polite leak: the system will evict under pressure, and on a 3 GB phone mid-fling it will evict the avatars you are about to show, so you download them again.

The senior contract is boring: prefetch warms a sized cache keyed by id; the cell reads the cache and starts a fetch only on miss; both paths cancel when the id is no longer needed. Prefetch is not configure.`,
      internals: `\`UICollectionViewDataSourcePrefetching\` is advisory. The window size depends on velocity, layout, and OS. You can get prefetch for items that never appear, and you can get \`cellForItem\` without a prior prefetch (slow drag, first paint). Code must be correct in both orders.

\`cancelPrefetchingItemsAt\` is not \`prepareForReuse\`. It is about index paths that left the lookahead window. The cell for that item may never have existed. Cancelling prefetch must not cancel a *visible* cell's configure task for the same id — the loader should refcount or distinguish prefetch vs display, or the cell's task is the one that owns display and prefetch is cache-only.

UITableView has the same prefetch API. Compositional layout does not change it. \`prefetchingEnabled\` on the collection view is the kill switch.`,
      testing: `Fake loader with a counter of starts and cancels. Drive prefetch for paths 20–40, cancel 20–30, assert only 31–40 still in flight (or cached). Never assign an image in the prefetch completion — assert the loader API cannot see a UIView.

Reuse test from problem 1 still passes with prefetch enabled: bind A, prefetch B, complete A, cell shows A until configure B.

Memory: fling a 2 000-item list, Instruments Allocations persistent should plateau. If it climbs with unique URLs forever, the cache has no cost limit.`,
      pitfalls: `Using \`indexPathsForVisibleItems\` inside prefetch to "be safe" and then starting work for visible cells twice. Prefetching full-screen images for a 36 pt avatar. Starting prefetch from a background queue and hopping to main per item (thundering herd of blocks). Implementing cancel as \`loader.cancelAll()\`.

Capturing \`IndexPath\` in the prefetch completion to find the cell later with \`cellForItem(at:)\` — the path moved, or the cell is nil because it was never displayed, and you create a cell as a side effect.`,
      alternatives: `Let Kingfisher/Nuke prefetch with their cancel APIs. A small in-house \`PrefetchController\` that owns a budget (max 8 decodes) and drops lowest priority on cancel.

If the list is short, skip prefetch. It exists for long, fast, homogeneous lists.`,
      tradeoffs: `Aggressive lookahead feels instant on Wi-Fi and murders LTE plus RAM. A budget of N in-flight prefetches plus cancel is the adult version. Decoding in prefetch uses CPU before the user sees the cell — good when you would have hitched in configure, wasteful when they fling past. Measure on device.`,
      followups: [
        {
          q: 'cellForItem vs prefetch vs willDisplay — who assigns the image?',
          a: 'Configure (cellForItem / cell provider). Prefetch warms cache. willDisplay is for animations, not downloads.',
        },
        {
          q: 'Do you cancel prefetch when the cell appears?',
          a: 'The display task takes over that id. Cancel the prefetch handle only if it is a distinct task; better, one coalesced request the cell adopts.',
        },
        {
          q: 'Diffable identifier nil in prefetch?',
          a: 'Can happen around applies (problem 4). Skip. Do not crash. Do not fall back to a stale array index.',
        },
        {
          q: 'isPrefetchingEnabled = false as a fix?',
          a: 'Valid if you cannot implement cancel this week. It is a rollback, not an architecture.',
        },
      ],
      teaches: [
        'Prefetch is lookahead, not configure',
        'cancelPrefetchingItemsAt is part of the API',
        'Never bind a cell from a prefetch completion',
        'Coalesce in-flight work by item id',
        'Bound decoded cache cost',
      ],
    },
    {
      id: 'd3-p8',
      title: 'Dark mode, still the light-mode bitmap',
      difficulty: 'Senior',
      kind: 'Incident',
      prompt: `Users on iOS 17 toggle Dark Appearance. Most of the app flips. A few UIImageViews keep light-mode assets: chat bubbles with a white cap, a template chevron that was tinted once, a snapshot of a map pin, a cached avatar with a baked white background. \`overrideUserInterfaceStyle\` is not set.

\`\`\`swift
final class BubbleCell: UITableViewCell {
    static let cap = UIImage(named: "bubble-cap")!
    static let chevron: UIImage = {
        UIImage(named: "chevron")!.withTintColor(.label, renderingMode: .alwaysOriginal)
    }()

    override func traitCollectionDidChange(_ previous: UITraitCollection?) {
        super.traitCollectionDidChange(previous)
        // empty — "dynamic colors already update"
    }

    func configure(message: Message) {
        capView.image = Self.cap
        accessory.image = Self.chevron
        avatar.image = ImageCache.shared.image(for: message.sender)
    }
}
\`\`\`

\`ImageCache\` stores \`UIImage\` keyed by URL. The first time a user is seen, we draw a placeholder with \`UIGraphicsImageRenderer\` using \`UIColor.systemBackground\`.

What actually updates when the trait collection changes, what is a snapshot, and where do you register for trait changes now that \`traitCollectionDidChange\` is deprecated?`,
      think: [
        'Is a UIImage loaded from an asset catalog dynamically color-aware, or resolved once?',
        'What does withTintColor(.label, renderingMode: .alwaysOriginal) bake?',
        'Does UIColor.systemBackground inside a renderer record a dynamic color, or the current CGColor?',
        'Will a reused cell that never got a trait callback show the wrong cap after a mode switch?',
      ],
      solution: `Dynamic *colors* on layers and tinted views update when the trait collection changes. **Bitmaps do not.** A \`UIImage\` is a bag of pixels (or a vector already rendered). Static lets, \`alwaysOriginal\` tints, and renderer output are snapshots of the trait at creation time.

\`\`\`swift
final class BubbleCell: UITableViewCell {
    private let capView = UIImageView()
    private let accessory = UIImageView()

    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        accessory.image = UIImage(named: "chevron")?.withRenderingMode(.alwaysTemplate)
        accessory.tintColor = .label
        registerForTraitChanges([UITraitUserInterfaceStyle.self]) { (self: BubbleCell, _) in
            self.reapplyDynamicImages()
        }
    }

    func configure(message: Message) {
        capView.image = UIImage(named: "bubble-cap") // catalog, Any/Dark
        avatar.image = ImageCache.shared.image(for: message.sender) // bytes, not a placeholder baked with systemBackground
        reapplyDynamicImages()
    }

    private func reapplyDynamicImages() {
        let cap = UIImage(named: "bubble-cap")
        capView.image = cap
    }
}
\`\`\`

Rules:

1. **Asset catalog Any Appearance / Dark Appearance** for the cap, loaded as a new image when style changes if the cache held the light one. Prefer template + \`tintColor\` for single-color glyphs.
2. **Never \`alwaysOriginal\` with \`.label\`.** That samples the label color now and stamps it. Template + \`tintColor = .label\` stays live.
3. **Renderers see the current trait.** Pass \`UITraitCollection.current\` / the view's trait into the renderer, or do not cache the output across style changes. Key the cache by \`(url, userInterfaceStyle, scale)\` if you must bake.
4. **\`layer.borderColor = UIColor.separator.cgColor\`** is also a snapshot. Re-set it in the trait callback. \`cgColor\` has no dynamic provider unless you use the (limited) dynamic CGColor APIs.
5. **Register for trait changes** on modern OS. Still re-apply in \`configure\` — a cell that sat in the reuse pool during the toggle may not have received a callback the way you think.

Avatars from the network are photos. They should not flip. Placeholders drawn with \`systemBackground\` should.`,
      explanation: `The user is not wrong: they switched the phone to dark, and one bubble stayed white. Dynamic Color marketing made the team believe every \`UIColor.system*\` would chase the trait. It does — as a color sitting on a \`UIView.backgroundColor\` or a \`UILabel.textColor\`. The moment you ask for \`cgColor\`, or you draw into a bitmap, or you tint a \`UIImage\` with \`.alwaysOriginal\`, you took a photograph of the current style. Photographs do not update.

Static \`let cap = UIImage(named:)\` is resolved once, often at first use in light mode in the lab. Asset catalogs *can* hold dark variants, but a process-wide static UIImage may already be the light variant. \`withTintColor(.label, .alwaysOriginal)\` is worse: \`.label\` was white or black *that afternoon*, and \`.alwaysOriginal\` means UIImageView will not re-tint from \`tintColor\`. Template images plus \`tintColor = .label\` are the UIKit-native way to have a chevron that follows appearance.

The cache is the production amplifier. The first placeholder was drawn on a light table. Every later configure for that sender reuses a white circle. Keying only by URL made "correctness" a function of who appeared first after launch. Reuse (problem 1) then ferries that bitmap into a dark cell that never ran the trait callback, because the *image object* did not change, only the window's style did.

\`traitCollectionDidChange\` is the old hook; \`registerForTraitChanges\` is the new one. Neither rescues a static snapshot you refuse to rebuild. Map snapshots, \`drawHierarchy\`, and \`UIGraphicsImageRenderer\` are all in this family.`,
      internals: `\`UIColor\` can be a dynamic provider: when resolved against a trait collection it returns a different CGColor. \`UIView\` resolves colors when rendering. \`CGColor\` stored on \`CALayer\` is a concrete color. \`UIImage\` from the catalog can be an asset with appearance variants; \`imageAsset?.image(with: trait)\` is the explicit resolve. \`resolvedColor(with:)\` is the color equivalent.

\`UIGraphicsImageRenderer\` uses the current trait collection of the thread / view. There is \`UIGraphicsImageRendererFormat.preferredRange\` and you can set \`preferredTraitCollection\` on some drawing paths — do not assume the cache key.

A cell in the reuse queue is still in the window's hierarchy or not depending on implementation; do not rely on trait callbacks for off-screen cells. Configure is the reliable re-apply.`,
      testing: `Host the cell in a window, \`overrideUserInterfaceStyle = .dark\` on the window, assert the cap's pixel at a known point is not the light fill, and the chevron's tint matches \`.label\` in that trait. Then dequeue a cell that was configured in light without appearing during the toggle, configure it, assert dark.

Cache test: insert a placeholder under light, switch style, fetch same URL, assert the placeholder was not the light bake (either missed cache or keyed by style).

A UI test that toggles appearance is slow; a window override in XCTest is enough.`,
      pitfalls: `\`UIImage(named:in:compatibleWith: trait)\` once in init, stored forever. \`cgColor\` on border set only in init. \`UIButton.setImage\` with an original-tinted asset. Snapshot tests that only run in light, so CI never saw the white bubble.

Clearing the entire image cache on every trait change — correct and brutal. Key by style instead.`,
      alternatives: `SF Symbols with palette / hierarchical rendering, which are built for this. PDF template assets. For photos, do nothing. For generated placeholders, draw in the cell with \`UIBezierPath\` and \`UIColor.secondarySystemFill\` as *colors on a view*, not as a cached bitmap.`,
      tradeoffs: `Re-resolving catalog images on every trait change is cheap. Re-decoding network images to re-letterbox them is not — don't. Baking dark and light placeholders doubles cache memory and makes the product look native. A single translucent placeholder that works on both is less pretty and has no trait bug.`,
      followups: [
        {
          q: 'Why did UILabel text flip but the bubble cap not?',
          a: 'textColor is a dynamic UIColor on a view. The cap is a UIImage snapshot. Different pipes.',
        },
        {
          q: 'layer.shadowColor = UIColor.label.cgColor?',
          a: 'Snapshot. Re-assign in the trait callback, or avoid shadows (problem 12).',
        },
        {
          q: 'Does registerForTraitChanges replace configure-time reapply?',
          a: 'No. You want both. Callbacks cover on-screen views; configure covers reuse after the world already flipped.',
        },
        {
          q: 'Asset catalog "Render As: Template" versus alwaysTemplate in code?',
          a: 'Either works if the image view tints. alwaysOriginal in code undoes the catalog.',
        },
        {
          q: 'SwiftUI Image and dark mode?',
          a: 'Day 4. Asset catalog variants still work; a UIImage you passed in is still a snapshot.',
        },
      ],
      teaches: [
        'Dynamic colors update; bitmaps do not',
        'alwaysOriginal tints are snapshots of .label',
        'Renderers and cgColor bake the current trait',
        'Cache keys must include appearance if the bytes depend on it',
        'registerForTraitChanges plus reapply in configure',
      ],
    },
    {
      id: 'd3-p9',
      title: 'Child view controller containment, done halfway',
      difficulty: 'Senior',
      kind: 'Review',
      prompt: `Code review. A pager "container" that is not \`UIPageViewController\`:

\`\`\`swift
final class PagerVC: UIViewController {
    private var current: UIViewController?

    func show(_ next: UIViewController) {
        current?.view.removeFromSuperview()
        current = next
        view.addSubview(next.view)
        next.view.frame = view.bounds
        addChild(next)
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        current?.view.frame = view.bounds
    }
}
\`\`\`

Bugs reported: child's \`deinit\` never runs after paging away; \`viewDidAppear\` on the hidden page still fires when the pager appears (problem 2); after rotate the child is full-screen wrong under the nav bar; a second \`show\` without leaving the screen leaks both. The author says they called \`addChild\`.

Write the containment contract, including appearance for a pager that does not disappear, and what SwiftUI hosting does not forgive.`,
      think: [
        'What is the paired teardown for addChild, and where is willMove(toParent:)?',
        'If the parent stays appeared, does the outgoing child get viewWillDisappear automatically?',
        'Why is frame = bounds wrong under a navigation bar or safe area?',
        'Does removeFromSuperview remove the child controller relationship?',
      ],
      solution: `Containment is a **controller** relationship that you pair, plus a **view** relationship that you pin, plus **appearance** you forward only when the parent is lying about which child is visible.

\`\`\`swift
func show(_ incoming: UIViewController) {
    let outgoing = current

    incoming.willMove(toParent: self)
    addChild(incoming)
    view.addSubview(incoming.view)
    incoming.view.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([
        incoming.view.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
        incoming.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
        incoming.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        incoming.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
    ])

    if let outgoing {
        outgoing.willMove(toParent: nil)
        transition(from: outgoing, to: incoming, duration: 0.2, options: .transitionCrossDissolve, animations: nil) { _ in
            outgoing.removeFromParent()
            incoming.didMove(toParent: self)
        }
        // transition(from:to:) already adds/removes views and forwards appearance
    } else {
        incoming.didMove(toParent: self)
    }
    current = incoming
}
\`\`\`

If you cannot use \`transition(from:to:)\`, you must:

1. \`addChild\` → add view → \`didMove(toParent:)\` for incoming.
2. \`willMove(toParent: nil)\` → remove view → \`removeFromParent()\` for outgoing.
3. If the pager itself stays appeared, call \`beginAppearanceTransition(_:animated:)\` / \`endAppearanceTransition()\` on both children, or \`automaticallyForwardAppearanceMethods = false\` and forward only the selected child (problem 2).

Never \`removeFromSuperview\` as the teardown. That orphans a parent pointer. Never \`addChild\` twice. Pin to the layout guide you mean, not \`view.bounds\` of a controller whose view extends under the nav bar.`,
      explanation: `\`addChild\` without the rest of the ritual is how you get a view that looks nested and a controller that still thinks it is root. The outgoing page's view is gone, so the user is happy, but the child still has \`parent == pager\`, the pager still owns it in \`children\`, and \`deinit\` waits for the pager to die. Two visits to the same tab later Allocations is a stack of forgotten pages.

Appearance is the second half. Problem 2 was forwarding appear *into* a child when UIKit already did. Here the pager stays on screen, so UIKit will *not* send disappear to a child you only \`removeFromSuperview\`'d. The hidden page is still a child, still "appeared," still running a timer you started in \`viewDidAppear\`. Or the opposite: you never \`didMove\`, UIKit never forwarded, and the visible page never starts. Pagers are the case where manual appearance is correct — between siblings — and only after the parent/child graph is honest.

Frames are the third lie. \`next.view.frame = view.bounds\` is the pre–Auto Layout container tutorial. The pager's view is probably \`edgesForExtendedLayout\` under the navigation bar. The child lays out full screen, its safe area is wrong, and rotate uses the last frame until \`viewDidLayoutSubviews\` catches up — if it does. Constraints to the safe area (or to a content layout guide you own) are the containment version of problem 3: install once, not on every layout.

SwiftUI will host this pager as one controller. If you leak children, you leak them under a representable that may also recreate the pager (Day 4). Fix the UIKit graph first.`,
      internals: `\`children\` is UIKit's list. \`parent\` is the back pointer. \`addChild\` sets both and begins appearance bookkeeping. \`didMove(toParent:)\` completes it. \`willMove(toParent: nil)\` then \`removeFromParent()\` is the inverse. Skipping \`willMove\` is undefined for appearance and for \`isMovingFromParent\`.

\`transition(from:to:duration:options:animations:completion:)\` requires both controllers to be children. It moves the views and forwards appearance. \`transition(from:)\` when \`from\` is not a child is a crash.

\`automaticallyForwardAppearanceMethods\`: when true (default), parent appear forwards to all children that are in the graph and not otherwise hidden by a custom container that overrides this. A pager that keeps off-screen children in \`children\` must stop automatic forwarding and drive \`beginAppearanceTransition\` itself, or remove off-screen children from the graph.

Safe area: a child's \`safeAreaInsets\` depend on its view being in the hierarchy and the parent's guides. A frame-equal-to-bounds child under an opaque nav bar will draw under the bar unless you accounted for it.`,
      testing: `XCTest with a window: \`show(A)\`, assert \`A.parent === pager\`, \`pager.children == [A]\`. \`show(B)\`, assert \`A.parent == nil\`, \`A.view.superview == nil\`, \`A\` deallocates (a flag in \`deinit\`). Assert \`B.viewDidAppear\` count == 1 and \`A.viewDidDisappear\` == 1 while pager stayed appeared.

Rotate: assert B's view maxY equals pager.view.safeAreaLayoutGuide layout frame, not the nav bar.

Leak: three shows, Memory Graph zero of A and the first B.`,
      pitfalls: `\`addChild\` after adding the view (order is documented; appearance can glitch). Adding the child in \`viewWillAppear\` every time without a "already contained" guard. Embedding via storyboard container segue *and* \`addChild\` in code. Using \`present\` for a page turn.

Forgetting to set \`translatesAutoresizingMaskIntoConstraints = false\` (problem 3) so the frame and the pins fight.`,
      alternatives: `\`UIPageViewController\` if you actually want paging. \`UITabBarController\` / \`UINavigationController\` if you are reinventing them. A single VC with swapped subviews if the "pages" have no navigation or analytics of their own — then they should not have been VCs.

SwiftUI pager as the parent, UIKit children via representable — only if each child is contained with this contract inside the representable's UIViewController.`,
      tradeoffs: `Keeping off-screen children alive is faster to swipe back and costs memory plus appearance complexity. Removing them is honest and you pay \`viewDidLoad\` again. For checkout steps, remove. For a camera plus a tiny preview page, maybe keep, but then you *must* own appearance forwarding.`,
      followups: [
        {
          q: 'willMove versus didMove — which is first on add?',
          a: 'addChild, add the view, didMove(toParent: self). willMove(toParent: self) is implicit in addChild. On remove: willMove(nil), remove view, removeFromParent.',
        },
        {
          q: 'Why did the hidden child’s timer keep running?',
          a: 'It was still a child of an appeared parent, so it never disappeared. Teardown the graph or forward disappear.',
        },
        {
          q: 'Can the child pin to the pager’s view.safeAreaLayoutGuide?',
          a: 'Yes if the pager’s view is the right container. Pinning to the window or to the nav bar’s view is how you fight rotations.',
        },
        {
          q: 'UIHostingController as a child?',
          a: 'Same contract. If you skip didMove, SwiftUI onAppear is late or doubled. Day 4 will also care about the hosting identity.',
        },
        {
          q: 'Is addChild in viewDidLoad enough for a single child?',
          a: 'Yes, with didMove and constraints. Problem 2 is the extra forwarding. This problem is the missing teardown when there is more than one.',
        },
      ],
      teaches: [
        'addChild / didMove and willMove / removeFromParent are pairs',
        'removeFromSuperview is not containment teardown',
        'Pagers must forward appearance between siblings',
        'Pin child views to guides, not a one-shot frame',
        'Orphaned children never deinit',
      ],
    },
    {
      id: 'd3-p10',
      title: 'Custom presentation, then the screen never dies',
      difficulty: 'Senior',
      kind: 'Debug',
      prompt: `A card modal. After open/close 30 times, Allocations still has 30 \`PaySheetViewController\`s and 30 \`CardTransition\` objects. Sometimes the second present crashes: \`Application tried to present modally an active controller\`. Interactive dismiss, dragged halfway and cancelled, occasionally leaves the card invisible but still \`presentedViewController\`.

\`\`\`swift
final class CardTransition: NSObject,
    UIViewControllerTransitioningDelegate,
    UIViewControllerAnimatedTransitioning,
    UIViewControllerInteractiveTransitioning {
    let sheet: PaySheetViewController
    weak var driver: UIPercentDrivenInteractiveTransition?

    init(sheet: PaySheetViewController) {
        self.sheet = sheet
        super.init()
        sheet.transitioningDelegate = self
        sheet.modalPresentationStyle = .custom
    }

    func animationController(forPresented presented: UIViewController, presenting: UIViewController, source: UIViewController) -> UIViewControllerAnimatedTransitioning? { self }
    func animationController(forDismissed dismissed: UIViewController) -> UIViewControllerAnimatedTransitioning? { self }
    func interactionControllerForDismissal(using animator: UIViewControllerAnimatedTransitioning) -> UIViewControllerInteractiveTransitioning? { self }
    // animateTransition / startInteractiveTransition omitted
}

// call site
let sheet = PaySheetViewController()
let transition = CardTransition(sheet: sheet)
present(sheet, animated: true)
\`\`\`

Who retains whom? Why is \`transitioningDelegate\` a trap, and what must a cancelled interactive dismiss guarantee?`,
      think: [
        'Does UIKit retain transitioningDelegate, or is it weak?',
        'If CardTransition strongly owns the sheet, and the sheet’s transitioningDelegate points at CardTransition, what is the cycle?',
        'The call site does not keep transition — so how does the first present work at all?',
        'After a cancelled pan, which object must reset, and is the sheet still presented?',
      ],
      solution: `UIKit holds \`transitioningDelegate\` **weak**. The animator objects it *returns* it may retain for the duration of a transition, not for the life of the presented controller. Two failure modes:

1. **Dangle:** \`let t = CardTransition(...); present(...)\` and \`t\` dies at the end of the scope. Delegate zeros. You get a default present, a crash, or a half-set custom presentation.
2. **Cycle:** \`CardTransition\` owns \`sheet\`, \`sheet.transitioningDelegate = self\`. If anything strongly retains the transition (the sheet via an extra strong property, a presentation controller, a gesture target), the sheet never deallocates after dismiss.

Fix ownership:

\`\`\`swift
final class PaySheetViewController: UIViewController {
    private let transition = CardAnimator() // owned by the VC, not the reverse

    override init(nibName: String?, bundle: Bundle?) {
        super.init(nibName: nibName, bundle: bundle)
        modalPresentationStyle = .custom
        transitioningDelegate = transition
        transition.owner = self // weak
    }
}

final class CardAnimator: NSObject, UIViewControllerTransitioningDelegate {
    weak var owner: PaySheetViewController?
    let driver = UIPercentDrivenInteractiveTransition()
    // return self / driver from delegate methods
}
\`\`\`

Keep \`CardAnimator\` alive by the **presented** VC (or the presenter, one owner). It must not strongly own the VC.

On interactive dismiss: if the pan crosses the finish threshold, \`finish()\`. If not, \`cancel()\`. In \`animationEnded(_ transitionCompleted:)\`, if \`!completed\`, the sheet must still be presented and user-visible. Never \`dismiss\` in the gesture if the interactive controller is driving. Never present again until \`presentingViewController\` is nil.

Prefer \`.pageSheet\` / \`.formSheet\` with \`UISheetPresentationController\` unless you truly need a custom card.`,
      explanation: `Custom transitions are where UIKit ownership gets folkloric. People remember that \`delegate\` pointers are weak, then they store the transition object in a local variable and wonder why the second present uses the default animation. Or they remember the local dying, so they let the animator own the sheet "to keep it around," and then dismiss does not free anything because the sheet and the animator formed a cycle through \`transitioningDelegate\` plus a strong \`sheet\` property.

The crash \`tried to present modally an active controller\` is the cycle showing up as a zombie presentation. Dismiss ran the animation, the view went away, the controller never left the presenter's \`presentedViewController\` because the transition did not complete in UIKit's bookkeeping — classic cancelled interactive dismiss where you called \`dismiss(animated:)\` *and* \`percentDriver.finish()\`, or where you forgot \`cancel()\` and the system still thinks a transition is in flight.

\`UIViewControllerTransitioningDelegate\` is a factory: UIKit asks it for an animator at present/dismiss time. The factory must outlive those calls, which means it must outlive the presented controller's presentation, which means the presented (or presenting) controller should own it. The factory must not own the controller. That is the same graph as Day 1's coordinator \`onClose\`: one direction is a parent, the other is weak.

Interactive dismiss is a state machine. \`UIPercentDrivenInteractiveTransition\` updates a fraction. Cancel must run the animation backwards and leave the VC presented. If your animator removes the view from the hierarchy on the way down and does not put it back on cancel, you have an invisible presented VC — present again and you crash.`,
      internals: `\`transitioningDelegate\` is weak on \`UIViewController\`. \`transitioningDelegate\` for presentation controllers: \`presentationController(forPresented:presenting:source:)\` — \`UIPresentationController\` is retained by the presentation machinery for the life of the presentation. If your custom presentation controller strongly retains the presented VC extra, another cycle.

\`modalPresentationStyle = .custom\` requires a presentation controller that defines the frame. Returning nil gets you full screen and still asks for animators.

\`UIPercentDrivenInteractiveTransition\` must be the same instance you return from \`interactionControllerForDismissal\` for that gesture. Creating a new driver per call resets progress. \`completionSpeed\` / \`cancel()\` / \`finish()\` are the API; mixing with \`dismiss(animated:)\` from the pan handler double-drives.

Memory: after a successful dismiss, presented VC should dealloc if nothing else retains it. A lingering animator with a strong back pointer is enough to keep thirty copies.`,
      testing: `Present and dismiss 20 times in a unit-ish UI test with a window. Assert a \`deinit\` counter on \`PaySheetViewController\` is 20. Repeat with a pan that cancels: count stays 0 deallocs until a real dismiss, and the sheet is still hit-testable.

Present while already presenting: should be impossible from UI after dismiss completes; assert \`presentedViewController\` is nil in \`dismiss\` completion before the test presents again.

Do not test this only on the happy swipe-to-dismiss path.`,
      pitfalls: `Setting \`transitioningDelegate\` on the *presenter* and expecting dismiss of the child to find it. Using \`unowned\` for the sheet inside the animator — cancelled dismiss plus a real dealloc order will crash. Starting a new present from \`viewDidDisappear\` of the sheet. Forgetting \`modalPresentationStyle = .custom\` so the delegate is ignored.

A gesture recogniser on the presenter that strongly captures the sheet.`,
      alternatives: `\`UISheetPresentationController\` detents. \`UIViewControllerTransitioningDelegate\` only for branded full-screen takes. SwiftUI \`.sheet\` with a representable inside — then Day 4 owns item identity, and you still do not write a custom interactive UIKit transition unless you must.`,
      tradeoffs: `Custom cards look like the brand and cost you an ownership model plus an interactive state machine. System sheets are less pretty and they dismiss without leaking. In an interview, prefer the system sheet unless the question is this ownership graph.`,
      followups: [
        {
          q: 'Who should own the transitioningDelegate object?',
          a: 'The presented VC (or the presenter), strongly. UIKit’s property is weak. The delegate must not strongly own the VC.',
        },
        {
          q: 'Why did the local CardTransition work on the first present?',
          a: 'The present call is synchronous enough that the animator is asked before the autorelease pool drains — until it is not, on a different OS, or on dismiss later when the local is already dead.',
        },
        {
          q: 'Cancelled interactive dismiss: finish or cancel?',
          a: 'cancel() if below threshold. The VC stays presented. animationEnded(false) must restore the view.',
        },
        {
          q: 'presentationController retain cycle?',
          a: 'UIPresentationController has presentedViewController. Do not also store the sheet strongly on the animator and on a custom presentation controller.',
        },
        {
          q: 'Does dismiss(animated:completion:) run deinit in the completion?',
          a: 'Often after the completion, on the next turn. Assert deinit with an expectation, not at the first line of the completion.',
        },
      ],
      teaches: [
        'transitioningDelegate is weak',
        'The animator must not own the presented VC',
        'Custom + interactive dismiss is a state machine',
        'Cancelled transitions must restore presentation',
        'System sheets beat custom cards unless you must',
      ],
    },
    {
      id: 'd3-p11',
      title: 'Keyboard avoidance applied three times',
      difficulty: 'Senior',
      kind: 'Debug',
      prompt: `A form in a UITableView. Focusing the last field, the keyboard covers it, or there is a huge empty gap above the keyboard, or after rotate-with-keyboard the inset is doubled. iPad undocked keyboard is nonsense. Hardware keyboard on iPad still pads 300 pt.

\`\`\`swift
NotificationCenter.default.addObserver(
    self, selector: #selector(onKeyboard),
    name: UIResponder.keyboardWillChangeFrameNotification, object: nil)

@objc func onKeyboard(_ n: Notification) {
    let frame = n.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as! CGRect
    let height = frame.height
    additionalSafeAreaInsets.bottom = height
    tableView.contentInset.bottom = height
    tableView.verticalScrollIndicatorInsets.bottom = height
    tableView.scrollToRow(at: lastFieldPath, at: .bottom, animated: true)
}

override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    lastField.becomeFirstResponder()
}
\`\`\`

IQKeyboardManager is in the Podfile, unused in this VC, still swizzling. What is the overlap between keyboard frame, safe area home indicator, \`keyboardLayoutGuide\`, and \`contentInsetAdjustmentBehavior\`, and where should first responder start?`,
      think: [
        'Is keyboardFrameEndUserInfoKey in screen coordinates, and does it include the home indicator?',
        'If the table already adjusts for the safe area, what does additionalSafeAreaInsets.bottom += keyboard height do?',
        'What is the frame when the keyboard is hidden, or undocked, or a hardware keyboard?',
        'viewDidAppear + becomeFirstResponder: is the window’s safe area settled?',
      ],
      solution: `Pick **one** avoidance mechanism. Convert the keyboard frame into this view. Inset by the overlap with *this* view, not by \`frame.height\`.

Modern:

\`\`\`swift
override func viewDidLoad() {
    super.viewDidLoad()
    tableView.keyboardDismissMode = .interactive
    NSLayoutConstraint.activate([
        tableView.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor)
    ])
    // table pinned to remaining edges; no keyboard observer
}
\`\`\`

If you must support old OS or a scroll view you cannot pin:

\`\`\`swift
@objc func onKeyboard(_ n: Notification) {
    guard let end = n.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect else { return }
    let inView = view.convert(end, from: nil)
    let overlap = max(0, view.bounds.maxY - inView.minY - view.safeAreaInsets.bottom)
    // if you use additionalSafeAreaInsets for the keyboard, do not also pad contentInset
    additionalSafeAreaInsets.bottom = overlap
}
\`\`\`

Rules:

1. **One of:** \`keyboardLayoutGuide\`, *or* \`additionalSafeAreaInsets\`, *or* \`contentInset\` — not two. \`contentInsetAdjustmentBehavior = .automatic\` already consumes safe area; adding the full keyboard height on top of that double-counts the home indicator.
2. **Convert from screen.** \`frame.height\` of a hidden keyboard on iPad is not 0; the frame is off-screen. Overlap with your view is the truth. Undocked and floating keyboards have small frames. Hardware keyboard: overlap often 0; input accessory view may still need a small inset.
3. **Do not \`scrollToRow\` on every frame change.** Let the table keep first responder visible, or scroll once in \`keyboardWillShow\` after adjusting inset.
4. **First responder in \`viewDidAppear\`**, not \`viewWillAppear\` / \`viewDidLoad\`. Load has no window; will-appear can still be mid-transition so insets are wrong (problem 2).
5. **Ban IQKeyboardManager** in any VC you are hand-tuning, or ban hand-tuning. Two authors will triple-inset.

Interactive dismiss of the keyboard needs the scroll view to be the one receiving the pan — layout guide handles that better than a one-shot inset.`,
      explanation: `The screenshot is either a field hiding under the keyboard or a form floating in a white void. Both are the same arithmetic error. The notification gives a keyboard CGRect in *screen* space. Using \`height\` assumes the keyboard is glued to the bottom of *this* view and that the height is the overlap. On iPhone it is often close. On rotate, the height is the keyboard's other edge. On iPad the keyboard is not the full width and may not touch the bottom of your view. When hidden, you still receive a frame — off the bottom — and if you take \`.height\` you pad 300 points of ghost keyboard.

Safe area already includes the home indicator. The keyboard frame also extends to the physical bottom of the screen. If you add \`frame.height\` to \`additionalSafeAreaInsets.bottom\`, you stacked the home indicator twice, then \`contentInset.bottom = height\` stacked it a third time because the table also respects safe area. IQKeyboardManager is out there doing a fourth. The gap is not a mystery. It is addition.

\`keyboardLayoutGuide\` is UIKit admitting this was too hard. Pin the scroll view's bottom to the guide's top and stop observing. The remaining skill is first responder timing: becoming first responder before the view is in a window, or in \`viewWillAppear\` while the transition has not applied the final safe area, sends a keyboard notification against the wrong bounds. You record a bad inset and then rotate, which sends another notification, which adds rather than sets. Always *set* the inset to the current overlap, never increment.`,
      internals: `\`UIResponder.keyboardWillChangeFrameNotification\` fires for show, hide, undock, undo. User info keys: frame begin/end, duration, curve. Convert with \`view.convert(_:from: nil)\`. Intersection with \`view.bounds\` is the overlap; subtract any part you already inset (safe area) if you are writing \`contentInset\` rather than additional safe area.

\`UIView.keyboardLayoutGuide\` (iOS 15+) tracks the keyboard and, with \`keyboardDismissPadding\`, accessories. It participates in Auto Layout, so it is a constraint input (problem 5: do not also poke constants from the notification).

\`contentInsetAdjustmentBehavior\`: \`.automatic\` on a table in a nav stack is already adjusted for bars and home indicator. \`adjustedContentInset\` is the sum you actually get. Logging it during a keyboard show is the debugging tool.

\`becomeFirstResponder\` in \`viewDidLoad\` fails or delays; the run loop presents the keyboard later against a different layout.`,
      testing: `Host the form in a phone window and a pad window. Show keyboard, assert the last field's maxY is above the converted keyboard minY by a margin, and \`adjustedContentInset.bottom\` is not greater than overlap + slack.

Hide keyboard: inset back to the non-keyboard baseline (safe area only). Rotate while focused: inset matches the new overlap, not 2×.

Hardware keyboard / undock: overlap near 0, field still tappable. First responder after appear: one notification, not a will-appear plus did-appear pair.`,
      pitfalls: `Adding observer in \`viewDidLoad\` and never removing — fine with block observers tied to \`self\`, leaks with old \`addObserver(self)\` if you expected \`deinit\` (Day 1). Using \`keyboardWillShow\` only and missing hide. \`IQKeyboardManager.shared.enable = true\` globally. \`scrollToRow\` fighting interactive keyboard dismiss.

Applying the inset to \`tableView.frame\` instead of inset — the table no longer underlaps, and the nav bar behaviour breaks.`,
      alternatives: `Pin with \`keyboardLayoutGuide\`. A \`UICollectionView\` compositional list with the same guide. SwiftUI \`safeAreaInset\` / \`scrollDismissesKeyboard\` for SwiftUI forms (Day 4) — do not mix a UIKit observer with a SwiftUI keyboard ignore.

Input accessory views: include their height in the overlap or pin to \`keyboardLayoutGuide\` with the accessory as a sibling.`,
      tradeoffs: `\`additionalSafeAreaInsets\` flows to all children (good for a form of many views, easy to double with a table). \`contentInset\` on the table is local and easy to forget the indicator insets. Layout guide is the least arithmetic and the least portable to iOS 14. For a current app, layout guide.`,
      followups: [
        {
          q: 'Why is the gap exactly the home indicator height?',
          a: 'You added full keyboard height on top of safe-area adjustment. The overlap already included the indicator.',
        },
        {
          q: 'keyboardLayoutGuide versus additionalSafeAreaInsets?',
          a: 'Guide is a constraint. additionalSafeAreaInsets is a numeric inset on the VC. Use one. Mixing is double.',
        },
        {
          q: 'becomeFirstResponder in viewDidLoad?',
          a: 'No window, no honest keyboard frame. Appear, then become. Problem 2: not in a doubled didAppear.',
        },
        {
          q: 'Interactive dismiss still covered?',
          a: 'keyboardWillChangeFrame fires as the keyboard tracks the finger if you use the system interactive dismiss. Set inset to current overlap each time; do not animate separately against a stale curve.',
        },
        {
          q: 'IQKeyboardManager in a UIKit interview?',
          a: 'Say you would remove it from this screen. Swizzling plus your observer is the triple gap.',
        },
      ],
      teaches: [
        'Keyboard frame is screen coordinates; convert then overlap',
        'One avoidance mechanism, never stack them',
        'Safe area plus keyboard height double-counts the home indicator',
        'keyboardLayoutGuide is the modern pin',
        'First responder after appear, inset is a set not a +=',
      ],
    },
    {
      id: 'd3-p12',
      title: 'UITableView, compositional, or a faster cellForItem',
      difficulty: 'Expert',
      kind: 'Judgment',
      prompt: `A feed: mostly text and thumbnails, occasional 16:9 video, ads, a sticky date header. Hitching on a mid-phone. Two RFCs are open: "rewrite in UICollectionViewCompositionalLayout" and "stay on UITableView, we know it." Instruments on the current UITableView:

- Time Profiler: \`cellForRowAt\` decoding JSON leftover from the mapper, plus \`UIImage(data:)\` of full-res thumbs
- Core Animation: Color Blended Layers red on every label; Offscreen-Rendered yellow on cells with \`cornerRadius\` + \`masksToBounds\` + \`shadow\`
- \`cell.layer.shouldRasterize = true\` and \`drawsAsynchronously = true\` added last week "for FPS"
- \`isOpaque = false\` on the cell and the contentView

A third voice says SwiftUI \`List\` (Day 4). Pick a container, and name the drawing and work you would do *before* a rewrite. When is compositional layout actually the reason, not a fashion?`,
      think: [
        'What work is illegal in cellForRow regardless of UITableView vs UICollectionView?',
        'Does shouldRasterize help a cell that changes every reuse?',
        'When does UITableView simply cannot express the layout?',
        'Is opaque + no offscreen shadow a bigger win than switching classes?',
      ],
      solution: `Do the hot-path work first. Then pick the container for *layout capability*, not FPS mythology.

**Before any rewrite**

1. **\`cellForRow\` / \`cellProvider\` is bind-only.** No JSON, no full-res decode, no date-format locale construction. Mapper and image pipeline already ran (problems 1 and 7). The cell sets text, image, hidden flags.
2. **Opaque.** Cell, contentView, and background views \`isOpaque = true\` with an actual background color, not clear. Labels can stay non-opaque; the cell should not.
3. **Shadows and rounded corners.** \`masksToBounds + shadow\` is offscreen rendering. \`shadowPath\` (problem 5) *without* masking the same layer, or a pre-rendered background image, or no shadow. Corner radius on an opaque \`CALayer\` with a solid fill is cheaper than clipping a subtree.
4. **\`shouldRasterize\`** is for a complex *static* subtree. A reused feed cell is not static; you rasterize every bind, often on the main thread. Turn it off unless you have measured a win on a cell that does not change.
5. **\`drawsAsynchronously\`** is not a feed cell lever. Ignore it until a drawing specialist says otherwise.
6. **Self-sizing estimates** (problem 6) so you are not laying out the world. Diffable one writer (problem 4).

**Then pick**

- **UITableView** if it is a single-column feed, headers/footers, swipe actions, prefetch, and you already have it. Compositional list *sections* are this with more code.
- **UICollectionView compositional** if you need orthogonal scrolling (horizontal shelves), grids mixed with lists, pinned decorative headers that are not \`tableHeaderView\`, or independent item sizes in one scroll view. Video cells with a custom layout that is not a row.
- **SwiftUI List / LazyVStack** if the row is cheap SwiftUI and you will police identity (Day 4). Not if you already own a player layer UIKit is keeping alive.

The rewrite is justified when the *layout* cannot be said in UITableView (a shelf, a grid, a badge pinned in a way supplementary items exist for). It is not justified because Instruments was red and someone had a WWDC tab open.`,
      explanation: `Teams rewrite feeds the way they rewrite architectures: to feel in control of hitching they have not measured. The profiler already named the guilty functions. \`cellForRow\` is doing yesterday's networking homework. Blended layers are clear backgrounds stacked four deep because the cell was copied from a prototype that sat on a photo. Offscreen rendering is a shadow and a clip on the same layer. \`shouldRasterize = true\` was a blog-post lucky charm: UIKit makes a bitmap of the cell, and then you throw the bitmap away on every reuse because the username changed.

UITableView versus compositional is a vocabulary question. UITableView is a specialised column. It is extremely good at that column. Compositional layout is a language for sections with different geometries. If your feed is a column of bubbles, compositional will not make \`UIImage(data:)\` faster. If your feed is a column plus a horizontal carousel plus a 2-across ad tile, UITableView will make you nest a collection view in a cell, which is a second scroll view, a second prefetch, a second reuse pool, and a nest of gesture recognisers. That is when compositional earns the migration: one scroll view, one data source, supplementary items for the sticky date.

SwiftUI is the third container, not a performance strategy. A SwiftUI row that decodes JPEG in \`body\` (Day 4, problem 1) loses to a UIKit cell that binds a downsampled image. A UIKit cell that rasterizes and blends loses to a SwiftUI row that does not. The senior answer in the room is: make the cell cheap and opaque, then choose the layout engine that can express the product without nested scroll views.`,
      internals: `Offscreen rendering: the GPU renders a layer tree to a texture, then composites. Triggers include shadows without \`shadowPath\`, \`masksToBounds\` plus group opacity, visual effects, and some corner-radius + mask combinations. Instruments Core Animation overlay is the map.

Blended layers: anything with alpha over anything else. \`UILabel\` is often blended; you live with that. A full-cell clear \`contentView\` over a clear cell over a table background is paying blend for no reason. Set opaque colors.

\`cellForItem\` runs on the main thread when the collection view needs a cell *now*. Heavy work there is a dropped frame. Prefetch (problem 7) is the place to decode, not a second \`cellForItem\`.

Compositional layout: \`NSCollectionLayoutSection\` + items + supplementaries + orthogonal scrolling. Diffable data source is the usual partner (problem 4). Nested \`UICollectionView\` in a cell is two \`contentOffset\`s and a nightmare of \`isScrollEnabled\` hacks.`,
      testing: `Core Animation instrument on device, not simulator: blended and offscreen overlays should drop after opaque + shadowPath. Time Profiler: \`cellForRow\` under a millisecond bind. Hitch rate in a scroll test before/after, same data set.

A nested-scroll prototype versus a compositional shelf: gesture conflict test (vertical fling on the shelf must not steal). If you cannot pass that in a week, you were not ready for the rewrite.

Do not A/B FPS in the simulator.`,
      pitfalls: `\`layer.drawsAsynchronously = true\` on a cell. \`isOpaque = true\` with a clear background (you lied; blending remains). Rasterize at \`rasterizationScale = 1\` on a 3× device (blurry). Rewriting to compositional while leaving \`reloadData\` in \`viewWillAppear\` (problem 4). Nesting a table in a collection "as a first step."

Using \`UIView.animate\` in \`cellForRow\` to fade images — every reuse animates, scrolling stutters. Fade in \`willDisplay\` only on cache miss.`,
      alternatives: `Texture / IGListKit if the team already has them — not a greenfield interview default. A single compositional list section as a migration *off* UITableView when you know a shelf is coming next quarter, not because list sections are fashionable.

SwiftUI \`UIViewControllerRepresentable\` wrapping the *current* table while the rest of the screen is SwiftUI (Day 4) — a seam, not a double implementation of the feed.`,
      tradeoffs: `UITableView: fastest path to a column, swipe actions, editing, well-known estimate bugs (problem 6). Compositional: one scroll view for mixed geometry, more layout code, easier to overdraw if every section is estimated. Nested collection: ships a shelf this week and costs you years of gesture bugs.

Opaque cells look slightly less "layered" if designers wanted translucency. Translucency is a measured tax. Pay it on the hero header, not on 12 cells.`,
      followups: [
        {
          q: 'When is shouldRasterize actually correct?',
          a: 'A complex badge that does not change, scrolled as a static snapshot. Not a feed row with a changing like count.',
        },
        {
          q: 'UITableViewDiffableDataSource versus collection compositional + diffable?',
          a: 'Same snapshot contract (problem 4). The layout object is what changes. Diffable is not a reason to switch containers.',
        },
        {
          q: 'Sticky date header: table section header or supplementary?',
          a: 'tableView(_:viewForHeaderInSection:) pins in a limited way. Compositional sticky supplementary is the real pin. If that is the product, it is a reason to move.',
        },
        {
          q: 'Video in the feed — UIKit or SwiftUI?',
          a: 'Keep the player in a UIKit cell / AVPlayerLayer you reuse. SwiftUI will fight identity (Day 4). Container around it can still be compositional.',
        },
        {
          q: 'Does isOpaque fix offscreen yellow?',
          a: 'No. Opaque is blending. Yellow is offscreen passes (shadow/mask). Different overlays, both worth clearing.',
        },
        {
          q: 'cellForItem work versus willDisplay?',
          a: 'Bind in cellForItem. willDisplay is appear-side effects (start player, fade). Heavy decode belongs in prefetch/cache, not either.',
        },
      ],
      teaches: [
        'cellForItem is bind, not decode',
        'Opaque versus offscreen versus rasterize are different taxes',
        'shouldRasterize on a reused cell is usually a loss',
        'Pick UITableView vs compositional for layout, not FPS folklore',
        'Nested scroll views are the real reason to go compositional',
        'SwiftUI List is a third container with its own identity rules',
      ],
    },
  ],
}
