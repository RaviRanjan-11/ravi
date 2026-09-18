import type { PrepDay } from './types'

export const day1: PrepDay = {
  id: 'day-1',
  title: 'Day 1 — Swift + Memory',
  kicker: 'Ownership, not syntax',
  intro:
    'You popped a screen forty times and Allocations still has forty of them. That is the kind of day this is — not a quiz on keywords, a walk through the ownership graph of real UIKit and SwiftUI code. By the evening you should be able to sit with Instruments, a capture list, and a protocol witness table without reaching for a definition.',
  problems: [
    {
      id: 'd1-p1',
      title: 'Detail screen never deallocates',
      difficulty: 'Senior',
      kind: 'Incident',
      prompt: `A navigation stack pushes \`DetailViewController\`. After opening and closing it 40 times, Allocations shows 40 living instances. The engineer says: "Nothing holds the VC globally, so it cannot be a retain cycle."

Here is the relevant code:

\`\`\`swift
final class DetailViewController: UIViewController {
    private let loader = ImageLoader()
    var onClose: (() -> Void)?

    override func viewDidLoad() {
        super.viewDidLoad()
        loader.start(url: heroURL) { [self] image in
            self.heroView.image = image
        }
        closeButton.addAction(UIAction { _ in
            self.onClose?()
            self.navigationController?.popViewController(animated: true)
        }, for: .touchUpInside)
    }
}

final class ImageLoader {
    func start(url: URL, completion: @escaping (UIImage?) -> Void) {
        URLSession.shared.dataTask(with: url) { data, _, _ in
            completion(data.flatMap(UIImage.init(data:)))
        }.resume()
    }
}
\`\`\`

The coordinator sets \`detail.onClose = { self.refreshFeed() }\` without a capture list.

Find every ownership bug, explain why the instance never hits \`deinit\`, fix it, and say how you would prove the fix.`,
      think: [
        'Who still owns the completion handler after the view controller is popped?',
        'What does a capture list that names self actually do to the reference count?',
        'Does UIAction keep its handler alive, and does that handler keep the controller alive?',
        'If the coordinator stores the child and the child stores onClose, what does the graph look like?',
      ],
      solution: `Three independent lifetime bugs, any one of which is enough to keep the screen around.

1. \`[self]\` is a **strong** capture. Combined with URLSession retaining the escaping completion, the view controller stays alive until the request finishes — and if \`ImageLoader\` stored that closure as a property, it would stay alive forever.
2. \`UIAction\` retains its closure; the closure strongly captures \`self\`. The button lives in the view hierarchy the controller owns. That loop never ends on its own.
3. Coordinator \`onClose = { self.refreshFeed() }\` strongly captures the coordinator. Coordinators almost always retain the child they just pushed. That is a third cycle.

Fix the captures, and cancel the work so a popped screen does not keep downloading:

\`\`\`swift
loader.start(url: heroURL) { [weak self] image in
    self?.heroView.image = image
}

closeButton.addAction(UIAction { [weak self] _ in
    self?.onClose?()
    self?.navigationController?.popViewController(animated: true)
}, for: .touchUpInside)

// Coordinator
detail.onClose = { [weak self] in self?.refreshFeed() }
\`\`\`

Store the \`URLSessionTask\` (or a \`Task\`) on the controller and cancel it in \`deinit\` or \`viewDidDisappear\`. Weak capture stops the cycle; cancel stops the wasted work.`,
      explanation: `You popped the screen. The navigation controller no longer lists it. The engineer is right that nothing in the app delegate holds a \`DetailViewController\`. And yet Allocations, after forty push-pop cycles, still shows forty living instances. The runtime never got the memo that the user went back — because it does not read navigation stacks. It counts strong references, and this view controller still has several.

Walk the graph from \`viewDidLoad\`. \`ImageLoader.start\` takes an escaping completion. The capture list says \`[self]\`. That looks like someone thought about ownership. It is a strong capture of the view controller, the same as writing \`self.heroView\` with no list at all. URLSession keeps the task until the bytes arrive or you cancel. The task keeps the completion. The completion keeps the view controller. Pop does not cancel the request, so even if this were the only bug you would keep a controller alive for the whole round trip — and if \`ImageLoader\` stored the closure as a property, you would keep it forever.

The close button is the second cycle, and it does not wait for a network. \`UIAction\` retains its handler. The handler closes over \`self\`. The button lives in the view hierarchy the controller owns. That loop is permanent: there is no request to finish and break it. Forty visits means forty controllers sitting in memory with their entire view trees, which is exactly what Allocations is trying to tell you.

The coordinator is the third. \`detail.onClose = { self.refreshFeed() }\` captures the coordinator strongly. The coordinator almost certainly retained the child it just pushed, because that is how most stacks are written. You now have a triangle that outlives the pop. The user thinks they left the screen. The process still has it, its image loader, and a coordinator that cannot die either.

The fix is not a slogan about weak references. It is: every escaping closure that can outlive the screen captures \`[weak self]\`, the coordinator does the same for \`onClose\`, and you cancel the session task when the screen goes away so a popped controller does not keep downloading a hero image nobody will see.`,
      internals: `The runtime only asks one question: is the strong retain count still above zero? A popped view controller is eligible for \`deinit\` only when every strong edge is gone. Closures are objects. An escaping closure that mentions \`self\` without \`weak\` or \`unowned\` is a strong edge, same as a stored property.

\`\`\`text
DetailVC ──strong──► UIButton ──strong──► UIAction closure ──strong──► DetailVC
DetailVC ──strong──► ImageLoader / URLSession ──strong──► completion ──strong──► DetailVC
Coordinator ──strong──► DetailVC ──strong──► onClose ──strong──► Coordinator
\`\`\`

URLSession holds the task until it completes or is cancelled. The task holds the completion. A strong \`self\` in that completion keeps the controller for the network round trip even after pop — that is a lifetime bug even when it is not a permanent cycle. \`[self]\` in a capture list is not a spell that makes the capture temporary. It means "retain this object for the life of the closure," written out loud. \`[weak self]\` stores an optional zeroing reference. \`[unowned self]\` stores an unsafe unowned reference that becomes a dangling pointer if the object dies first.

UIAction is easy to miss because it does not look like you stored a closure on \`self\`. You stored it on the control, and the control is in your view tree, so you still own it. The coordinator cycle is the same shape with different names: parent owns child, child owns a callback that owns parent.`,
      testing: `Proof is a \`deinit\` you can see, not a code review that says "we used weak." Put \`print("deinit Detail")\` behind a flag, or better, a test double that records deallocation. Push, pop, and assert the record arrives before a short timeout. If it does not, you still have an edge.

After ten push/pop cycles, open the Memory Graph Debugger and search for \`DetailViewController\`. The count should be zero. Instruments Allocations should not show a persistent growth line for that class; Leaks may stay quiet if the objects are still reachable, which is why Allocations and the graph matter more than the leak detector here.

Exercise the in-flight path: start the image request, pop before it returns, and assert the completion does not touch UI. With \`[weak self]\`, \`self\` is nil and you skip the assignment. Also cancel the task and assert the session actually dropped it — otherwise you still pay for the download, even if you no longer leak the controller forever.`,
      pitfalls: `The tempting swap is \`[unowned self]\` on the image completion. The user can pop while the request is in flight. The controller deinits, the callback runs, and you crash on a dangling pointer. Weak is the right capture for anything that outlives the screen by a network round trip.

Cancelling the task but leaving the \`UIAction\` cycle means \`deinit\` still never runs. The button loop does not care that the image finished. Fixing only the loader and leaving the coordinator's \`onClose\` strong has the same shape: you patched the bug you found in Instruments this morning and shipped the one you will find next week.

A subtler miss is storing the task and forgetting to nil it out after completion, or cancelling in \`viewDidDisappear\` and then restarting in \`viewDidAppear\` without noticing that a tab switch disappeared the view. Lifetime of work has to match the lifetime you actually want, which is not always "the view is visible."`,
      alternatives: `If you can leave UIKit completion handlers, prefer \`URLSession.data(for:)\` inside a \`Task\` stored on the controller and cancelled in \`deinit\`. The cancellation story is the same, but you get one handle instead of a session task plus a closure. Combine subscribers need the same \`[weak self]\` and a \`cancellables\` bag that dies with the screen.

In SwiftUI, \`.task\` is cancelled when the view disappears, which is the structured version of what you are hand-rolling here. For the button, you can avoid a closure on the control entirely: a target-action pair with \`#selector\` does not capture \`self\` in a heap closure, though you still have to be careful with any other escaping work you start from that selector.

If the coordinator pattern keeps producing these triangles, invert it: the child reports a delegate with \`weak var delegate\`, or the parent observes a stream it owns. The callback property on the child is convenient and is how this bug gets written the first time.`,
      tradeoffs: `Weak everywhere is not free. You write \`guard let self else { return }\` and you accept that a late callback becomes a no-op. That is the correct product behaviour for a popped details screen. Unowned is shorter and is wrong the moment the callback can outlive the object.

Cancelling work on disappear is the part that is easy to skip once the cycle is gone. You save battery, you avoid applying a hero image to a controller that is already gone, and you stop holding a 3 MB image buffer for a screen the user left. The cost is that a quick push-pop-push may restart the request. Cache the image separately if that bothers you; do not keep the view controller alive as your cache.

Coordinator callbacks versus \`weak\` delegates is a taste choice until the first leak. After that, the rule is simple: if the child outlives the setup line, the parent must not be strongly captured from it.`,
      followups: [
        {
          q: 'Why not unowned on the image completion?',
          a: 'The view controller can die while the request is in flight. Unowned would crash on the callback. Weak is correct for session completions.',
        },
        {
          q: 'Can this still leak after the three capture-list fixes?',
          a: 'Yes. NotificationCenter observers, Timer.scheduledTimer(withTimeInterval:repeats:block:), and a Combine sink stored on self that captures self strongly will all keep the controller alive.',
        },
        {
          q: 'How do you catch this in production?',
          a: 'Memory Graph in debug, Allocations on a TestFlight build, and MetricKit memory spikes correlated with opening that screen. Persistent growth of one class after repeated push/pop is the signature.',
        },
        {
          q: 'Does SwiftUI @StateObject have this class of bug?',
          a: 'The framework keeps the object for the view identity, which is a different clock. An unstructured Task started from onAppear still outlives the screen if you do not cancel it, so the leak moves from the view controller to the work it started.',
        },
        {
          q: 'Does [self] ever make sense on a class?',
          a: 'Rarely. It is explicit about capturing the instance, but it is still strong. Use it when the closure must keep the object alive and you have a hard bound on how long the closure lives — not for a button or a network callback.',
        },
      ],
      teaches: [
        'Reference counts, not globals',
        'Escaping closures and URLSession lifetime',
        '[self] vs [weak self] vs [unowned self]',
        'UIAction / control ownership',
        'Coordinator callback cycles',
        'Proving deinit with Memory Graph',
      ],
    },
    {
      id: 'd1-p2',
      title: 'This mutation copies a 40 MB buffer',
      difficulty: 'Senior',
      kind: 'Predict',
      prompt: `What prints, and why does Instruments show a huge allocation on the line \`b[0] = 1\`?

\`\`\`swift
func load() -> [UInt8] { Array(repeating: 0, count: 40_000_000) }

var a = load()
let extra = a
var b = a
b[0] = 1
print(a[0], b[0], extra[0])
\`\`\`

Then: a colleague stores \`a\` in an escaping analytics closure "just in case." Does \`b[0] = 1\` still copy? Explain copy-on-write with \`isKnownUniquelyReferenced\`.`,
      think: [
        'Is Array a value type, and does assignment copy the 40 MB immediately?',
        'How many live names still point at the same buffer just before the mutation?',
        'What does capturing that array in an escaping closure do to uniqueness?',
      ],
      solution: `Prints \`0 1 0\`. \`a\` and \`extra\` still share the original buffer. \`b[0] = 1\` is the first mutation of \`b\` while that buffer is **not uniquely referenced**, so Swift copies about 40 MB and then writes the 1 into the copy.

If an escaping analytics closure captures \`a\`, that is another live reference to the same buffer. Mutation through \`b\` still copies. Uniqueness is a runtime check on the buffer object, not a compiler wish and not something that cares about the variable names you used.

\`\`\`text
before mutation:  a, extra, b  →  buffer#1  (3 refs)
b[0] = 1:         copy 40 MB → buffer#2 owned by b
                  a, extra     → buffer#1  (unchanged zeros)
\`\`\``,
      explanation: `You did not write a loop that allocates. You wrote \`b[0] = 1\`, which looks like touching one byte, and Instruments shows a 40 MB spike on that line. Assignment of \`a\` into \`extra\` and \`b\` did not copy the buffer. Array is a value type with a heap buffer behind a copy-on-write box. Those three names are three plus-ones on the same storage. The mutation is the moment the value-type story has to become true: \`b\` must look different from \`a\`, so if anyone else still holds the buffer, Swift clones it first.

That is why people walk away from this example with two opposite wrong feelings. One is "structs always copy," which would have made \`var b = a\` expensive up front and would have made the mutation cheap. The other is "copy-on-write means copies are free," which is true until the first shared mutation, and then you pay the whole buffer at the worst possible time — often on the main thread, often in a tight scroll, often in a function that does not look like it allocates.

The analytics closure is how this dies in production. You finished the load, you thought you were the unique owner, you mutated in place to stamp a header byte, and some logger had captured the array "just in case we need it later." The capture is a retain. \`isKnownUniquelyReferenced\` returns false. You copy 40 MB to flip one byte, the logger still has the old buffer, and your memory graph now has two of them until the closure dies.

Value semantics are the API you wanted: mutating \`b\` must not change \`a\`. Copy-on-write is the implementation that makes the common path cheap. The bill arrives when uniqueness is lost, and uniqueness is lost by anything that retains the buffer — another variable, an element in a collection, or a closure that outlives the line you are staring at.`,
      internals: `Array, String, and Dictionary store a reference to a heap buffer. Assignment retains that buffer and copies a tiny header. Mutation goes through a uniqueness check, the same family of check you can call yourself with \`isKnownUniquelyReferenced(&box)\` on a class instance. If the buffer's refcount says unique, the write happens in place. If not, the runtime allocates a new buffer, memcpy's the bytes, points this array's header at the new storage, and then writes.

\`\`\`text
a, extra, b  ──►  buffer#1  (refcount 3)
b[0] = 1
        ──►  copy buffer#2  (b is unique now)
a, extra ──►  buffer#1      (still zeros)
\`\`\`

The check is dynamic. The compiler will not "know" that \`extra\` is unused after a certain line unless ARC actually releases it. An escaping closure that captured \`a\` is a retain that lasts until the closure is released, which may be "never" if you stored it on a singleton logger. \`inout\` through a generic preserves the existing buffer more often; wrapping the same value in an existential tends to introduce another owner, which is why the next problems in this day keep coming back to boxing.`,
      testing: `A unit test can lock the semantics: mutate \`b\`, assert \`a[0]\` is still 0 and \`b[0]\` is 1. That test will not catch the 40 MB spike. For the spike, use Instruments Allocations, pin the allocation to the mutation line, and look at the persistent versus transient size. Transient is still a hitch if you do it while scrolling.

Microbenchmarks lie here because they often run with a unique array. If you want a bench, share the array across two names first, then mutate, and measure. A regression test in CI is harder; a memory test that asserts peak dirty memory under a fixture of "share then stamp" is worth it for a video-frame or download path.

When the analytics closure is in play, assert that the logger's captured value does not change when you mutate your working copy, and separately assert that the mutation path does not double peak memory if you can arrange unique ownership (copy the bytes you need for analytics, then mutate).`,
      pitfalls: `Passing the array through an \`any Collection\` or \`any RangeReplaceableCollection\` box is a classic way to lose uniqueness without an obvious extra variable. The existential holds its own copy of the value, which is another retain, and mutation through the box often copies even when you thought you had \`inout\` to the original.

Do not depend on the optimizer killing \`a\` early so that \`b\` becomes unique. Lifetime of values is not a contract you can ship on. If you need in-place mutation, do not share. If you must share, copy explicitly at the boundary where you decide "this one is mine to stamp."

Also watch functions that take the array as a non-\`inout\` argument and then mutate a local \`var copy = input\`. That local may still share until the first write, which is fine, but if you then pass \`copy\` into two children you are back to the three-name picture.`,
      alternatives: `For a buffer you know is huge and must be mutated uniquely — a decoded frame, a file you are checksumming — wrap it in a class you own, or use \`ManagedBuffer\` / \`UnsafeMutableBufferPointer\` with an explicit owner. Then sharing is visible: it is a reference type, and mutation is either exclusive or you lock.

If the analytics team needs a snapshot, give them \`Data(a)\` or a prefix they actually log, not the live array. That copy is honest and happens once, at a moment you chose, instead of later on a random mutation.

\`ContiguousArray\` does not save you from copy-on-write; it only tightens element layout. The uniqueness story is the same.`,
      tradeoffs: `Copy-on-write is the right default for Array on an API surface. Callers get value semantics, and the cheap path is a retain. It is the wrong mental model for a 4K frame you thread through five layers and a logger. There the honest design is either "unique owner, mutate in place" or "immutable snapshot, never stamp."

Making everything a class so you never copy sounds senior until two screens mutate the same buffer and you spend a day on a torn image. Making everything copy on assignment sounds safe until you cannot scroll. The senior move is to know which buffers are large, keep them unique at the mutation site, and treat every escaping capture as a potential extra retain on that uniqueness check.`,
      followups: [
        {
          q: 'Does let a = load(); var b = a; b[0] = 1 copy?',
          a: 'Yes if a is still alive, because the buffer has two owners. If a has already been released and b is the unique remaining reference, the write can happen in place — do not depend on that optimization.',
        },
        {
          q: 'Why do protocol existentials hurt copy-on-write?',
          a: 'Boxing stores another owner of the value. Mutation through the existential often fails the uniqueness check and copies, even with inout.',
        },
        {
          q: 'Is String the same story?',
          a: 'Yes. Bridging to NSString can add another owner, so a mutation that looked unique in Swift may copy after you touched Objective-C.',
        },
        {
          q: 'How do you prove uniqueness in a test?',
          a: 'You usually prove it negatively: share, mutate, measure a large allocation. There is no stable public API on Array that says "I am unique" for you to assert in XCTest.',
        },
      ],
      teaches: [
        'Value semantics vs eager copies',
        'Copy-on-write buffers',
        'isKnownUniquelyReferenced',
        'Escaping captures vs uniqueness',
      ],
    },
    {
      id: 'd1-p3',
      title: 'Code review: protocol extension dispatch',
      difficulty: 'Senior',
      kind: 'Review',
      prompt: `A teammate writes:

\`\`\`swift
protocol Drawable {
    func draw()
}

extension Drawable {
    func draw() { print("default") }
    func debug() { print("debug-default") }
}

struct Circle: Drawable {
    func draw() { print("circle") }
    func debug() { print("debug-circle") }
}

let d: Drawable = Circle()
d.draw()
d.debug()
\`\`\`

What prints? Why is this a production foot-gun in a module you ship to other teams? How do you fix the API?`,
      think: [
        'Which of these methods are actually protocol requirements?',
        'When you call a method that exists only in an extension, which type decides the implementation?',
        'What do clients in another module see if they only hold a Drawable?',
      ],
      solution: `Prints:

\`\`\`text
circle
debug-default
\`\`\`

\`draw()\` is a protocol requirement, so the call through \`Drawable\` is dynamic and \`Circle.draw\` wins. \`debug()\` is **not** a requirement. \`Circle.debug()\` is a separate method on the concrete type. Through the protocol type, Swift binds the extension's \`debug()\` at compile time.

Fix the API so customisation is intentional:

\`\`\`swift
protocol Drawable {
    func draw()
    func debug()
}

extension Drawable {
    func debug() { print("debug-default") }
}
\`\`\`

Now \`debug()\` is a requirement with a default, and \`Circle.debug()\` wins through the protocol. If you do not want it overridable, do not put it on the protocol — name the helper \`defaultDebug()\` or keep it \`fileprivate\` so nobody thinks they overrode it.`,
      explanation: `You shipped a drawable, a teammate implemented \`debug()\` on \`Circle\`, the analytics path calls \`debug()\` on a \`Drawable\`, and the logs still say \`debug-default\`. The override is sitting right there in the struct. Nobody lied. They implemented a method that the protocol call will never see.

The difference is not style, it is whether the method is in the protocol's requirement list. \`draw()\` is. Calls through the protocol go through a witness table, which is a bag of function pointers filled in by \`Circle\`. \`debug()\` lives only on the extension and on the concrete type as two different functions that happen to share a name. The compiler looks at the static type of \`d\`, which is \`Drawable\`, and emits a direct call to the extension. \`Circle.debug\` is as unreachable from that call site as a private helper would be.

In an app target this bites you as a confusing log. In a module you ship, it is an evolution trap. You add \`debug()\` on the extension in 1.2 because it is convenient and source-compatible. Clients "override" it on their types. Nothing happens. To make it overridable you must add a requirement, which is an API change: old clients still compile against the default, new clients can customise, and you have just grown the witness table. If you add the requirement without a default, you break every conformer.

That is why a review comment that says "put it on the protocol or rename it" is not pedantry. It is choosing whether the method is part of the customisation surface. Names that look like overridable behaviour and are not will be "overridden" by the next team, and they will blame Swift, then you.`,
      internals: `A protocol requirement becomes an entry in the witness table for each conforming type. Calling \`d.draw()\` where \`d\` has static type \`Drawable\` (or \`any Drawable\`) loads that entry and jumps. The concrete type can be decided at runtime; the slot cannot — the slot exists because you declared the requirement.

A method that exists only in a protocol extension is a concrete function. The call is resolved from the compile-time type. \`Circle().debug()\` prints \`debug-circle\`. \`d.debug()\` prints \`debug-default\`. \`any Drawable\` does not change this: existentials still only expose requirements plus extension methods of the protocol, and those extension methods are still statically bound.

\`some Drawable\` is an opaque concrete type, but the static type at the call site is still "some Drawable," not \`Circle\`. Without a requirement, you still cannot reach \`Circle.debug\`. Opening the existential with \`as Circle\` would, which is an admission that the protocol surface was wrong.

Default implementations of requirements *are* in the witness table. The conforming type can replace the pointer. That is the case people mean when they say "default in an extension is overridable." It is only true for requirements.`,
      testing: `Write the call the way production writes it, through the protocol:

\`\`\`swift
func capture(_ body: () -> Void) -> String { /* redirect stdout or inject a logger */ }

let d: Drawable = Circle()
XCTAssertEqual(capture { d.draw() }, "circle")
XCTAssertEqual(capture { d.debug() }, "debug-circle")
\`\`\`

Today the second assertion fails. That failing test is the spec you wanted. After you add \`debug()\` to the protocol, it passes. Also test a type that does *not* implement \`debug\` and confirm the default still runs, so you do not break conformers when you promote the method to a requirement.

If this is a public SDK, add a compiler test or a small client fixture in another module: a struct that conforms and overrides, called through \`any Drawable\`. Same-module tests can hide dispatch surprises because of inlining and because you accidentally used the concrete type.`,
      pitfalls: `People confuse "there is a default in an extension" with "this is always static." Default implementations of requirements are dynamic. Only methods that never made it onto the protocol are static. The review has to look at the protocol block, not at the extension.

Another miss: adding the requirement in a library without a default, then watching every client fail to compile. Or adding it with a default that captures the wrong behaviour, which every existing conformer now silently inherits through the protocol even if they had a same-named method on the concrete type — that same-named method still will not run until they recompile with a proper implementation of the new requirement.

\`@objc\` protocols and optional requirements are a different dispatch world. Do not mix that explanation into a Swift-native protocol review; you will "fix" the wrong table.`,
      alternatives: `If \`debug()\` is really only for \`Circle\`, keep it off the protocol and take \`Circle\` at the call site, or use a generic \`func inspect<D: Drawable>(_ d: D)\` plus a second protocol \`Debuggable\`. Generics specialise, but they still will not call a non-requirement \`Circle.debug\` through a \`Drawable\` constraint alone.

For a closed app module, adding the requirement is cheap and is usually the right fix. For a public SDK, consider a new protocol \`DrawableDebugging\` that refines \`Drawable\`, so old conformers stay valid and new clients opt in. That is more types; it is also a change you can ship without breaking binary clients of the old protocol.

Renaming the extension helper to something that does not look overridable (\`writeDefaultDebugLine()\`) is a valid way of saying "this is not a hook."`,
      tradeoffs: `Every requirement is a customisation point you must keep stable. More slots mean more flexibility for clients and a larger ABI, more to document, more to test through the protocol type. For an app target, add the requirement and a default. For a shipped SDK, that is a versioning decision: defaulted new requirement in a minor, or a refined protocol if you need to stay cautious.

Static extension methods are not free of cost either. They are a foot-gun that looks like polymorphism. If your team keeps "overriding" them, the extra witness-table slot is cheaper than the next production incident where analytics still prints \`debug-default\`.`,
      followups: [
        {
          q: 'What does d.debug() do if you add debug() to the protocol with a default?',
          a: 'It becomes a requirement. Circle fills that witness slot, and the call through Drawable prints debug-circle.',
        },
        {
          q: 'Does some Drawable change the debug() result?',
          a: 'No. The opaque type still does not expose Circle.debug unless debug is a requirement or you cast to Circle.',
        },
        {
          q: 'Why did Circle().debug() print debug-circle in a playground but production printed debug-default?',
          a: 'The playground called through the concrete type. Production stored the value as Drawable and used static dispatch to the extension.',
        },
        {
          q: 'Is this related to retroactive conformance?',
          a: 'It can be. A conformance in another module can fill requirement slots; it cannot replace a non-requirement extension method of the original protocol.',
        },
      ],
      teaches: [
        'Protocol requirements vs extension methods',
        'Witness tables',
        'Static vs dynamic dispatch',
        'Library evolution of protocols',
      ],
    },
    {
      id: 'd1-p4',
      title: 'some View vs any View in a hot body',
      difficulty: 'Senior',
      kind: 'Debug',
      prompt: `A feed row is written as:

\`\`\`swift
struct Row: View {
    let item: Item
    var body: some View {
        let content: any View = item.isAd
            ? AnyView(AdView(item: item))
            : AnyView(PostView(item: item))
        return content.padding()
    }
}
\`\`\`

Scrolling 1 000 rows hitches. A junior says AnyView is required because the two branches have different types. What is actually wrong, what is the SwiftUI identity cost, and how do you write this without boxing?`,
      think: [
        'What type does an if/else inside ViewBuilder actually become?',
        'What information does AnyView throw away that the layout system wanted?',
        'How does SwiftUI decide whether a row is the same view after a refresh?',
      ],
      solution: `Do not erase. Use \`ViewBuilder\` \`if/else\` so the type is a conditional view, returned as opaque \`some View\`:

\`\`\`swift
struct Row: View {
    let item: Item
    var body: some View {
        Group {
            if item.isAd {
                AdView(item: item)
            } else {
                PostView(item: item)
            }
        }
        .padding()
    }
}
\`\`\`

Or apply padding inside each branch. \`AnyView\` / \`any View\` boxes the concrete type, blocks specialisation, and weakens identity — SwiftUI treats updates more pessimistically. Different branches already have different identity; you do not need a box on top.

The hitch is extra allocation and lost specialised layout on a path that runs as often as a list scrolls, not "1 000 views exist."`,
      explanation: `You are scrolling a feed and the frame time falls apart on \`Row.body\`. The junior is not crazy: \`AdView\` and \`PostView\` are different types, and \`body\` has to return one type because \`some View\` means "there is a concrete type here, I am just not naming it." \`AnyView\` is how you smash two types into one box. It compiles. It also throws away the thing SwiftUI is good at: knowing exactly which layout it is running, and knowing when a child is the same child as last time.

\`ViewBuilder\` already solved the two-branch problem. An \`if/else\` becomes a generic sum type, historically \`_ConditionalContent<AdView, PostView>\`. That is still one concrete type. It is opaque to you as \`some View\`. It is not an existential. There is no heap box that says "I might be anything." The modifier \`.padding()\` attaches to that sum type and stays specialised.

\`any View\` / \`AnyView\` is a different beast. You allocate a box, store a metadata pointer, and ask the runtime to bounce every layout and update through the existential. Identity gets fuzzier because two \`AnyView\`s do not carry the branch type in the SwiftUI view graph the way the conditional type does. Updates look more like "replace this child" than "update AdView in place." On a screen with ten rows you would not notice. On a thousand-row fling, body runs constantly, and you pay the box every time.

The rule that falls out of the hitch is simple: \`some View\` is the contract of \`body\`. Existential erasure is for a plugin you truly cannot name, or a heterogeneous array you should probably not have stored as views in the first place. A boolean on a row is not that.`,
      internals: `\`some View\` is an opaque type: at runtime there is exactly one concrete type, known to the compiler, hidden from the source. \`ViewBuilder\` encodes control flow as generic types — conditionals, tuples, \`EmptyView\` — so the opaque type can still be a single specialised struct. Layout and equality stay in the static world.

\`AnyView\` stores an object that holds the wrapped view and type metadata. Each construction can allocate. Each update may have to open the box. List diffing prefers stable concrete types because it can match "this is still \`PostView\` for item 42." Type-erased children tend to get more conservative invalidation: the framework is less sure it can reuse the previous renderer.

\`any View\` as a local variable is the language-level existential. Assigning \`AdView\` into it boxes. Returning \`any View\` from \`body\` is not even the usual signature — \`body\` wants \`some View\` — which is why the snippet builds a local existential and then hopes modifiers still compose. They do, through the existential, which is the slow path.

Identity in SwiftUI is type plus explicit \`.id\`. You already have different types on the two branches, which is a perfectly good identity change when a row flips from post to ad. Boxing both as \`AnyView\` hides that distinction and then sometimes you compensate with \`.id(UUID())\`, which is how you make the hitch worse.`,
      testing: `Instruments Time Profiler and the SwiftUI instrument while flinging the list: you want \`Row.body\` cheaper, and you want to see \`AdView\` / \`PostView\` rather than a pile of \`AnyView\` updates. Hitch rate before and after is the product metric; a screenshot of a cleaner call tree is the engineering one.

In a debug build, log \`type(of: body)\` on a sample row. After the fix you should see a conditional / modified content type, not \`AnyView\`. XCTest will not assert SwiftUI identity for you in a satisfying way; a snapshot of one row is fine for visuals and useless for this hitch.

If you have a scroll-performance UI test, pin it to this feed. The failure mode is not a crash, it is a dropped frame budget, so the test has to measure, not just exist.`,
      pitfalls: `Type-erasing to store \`[any View]\` in a model is the same bug moved to data. Keep models as data. Let \`ViewBuilder\` switch in the view layer. A heterogeneous array of views is almost always a sign that an enum of row models should have been the source of truth.

Wrapping only one branch in \`AnyView\` "to make the types match" still boxes that branch every time. Use \`if/else\` or \`switch\` and let the builder produce the sum type.

\`Group\` is not always required; it is a way to attach a modifier to both branches. If identity of the modifier matters, prefer putting \`.padding()\` inside each branch so you do not introduce an extra container you did not mean to.

\`.id(UUID())\` on the row to "force refresh" destroys identity on every body invocation: state resets, images reload, and you will blame \`AnyView\` while the UUID is the larger fire.`,
      alternatives: `An enum on \`Item\` plus \`switch item.kind\` in \`body\` is the same idea as \`if item.isAd\`, and it scales when you add a third row type. Each case stays a concrete view. Still no erasure.

If you truly have a plugin API where the app cannot name the view type, \`AnyView\` at that boundary is acceptable. Do the erasure once, at the plugin seam, not inside the hottest row of the home feed.

\`@ViewBuilder\` on a helper that returns \`some View\` is a good extraction. \`@ViewBuilder\` on a helper that returns \`any View\` is a way to launder the box through a prettier function.`,
      tradeoffs: `Erasure is a legitimate tool at a module boundary you cannot name. It is not a legitimate tool for a boolean in a scrolling row. The compile-time pain of "these two views have different types" is \`ViewBuilder\` doing its job. If you silence that pain with \`AnyView\`, you pay at runtime on every frame.

Opaque \`some View\` keeps specialised layout and a stable type identity. The cost is that the returned type becomes part of the function's ABI in the opaque sense — you cannot casually change which concrete view you return without it being a different opaque type. For \`body\`, that is what you want. For a public helper in an SDK, you may still choose erasure, and you should choose it once, on purpose, with a comment that says why the hot path was not an option.`,
      followups: [
        {
          q: 'Why is Group { if } used at all?',
          a: 'To apply a modifier to both branches, or to satisfy ViewBuilder in older compilers. If identity of each branch matters, apply the modifier inside the branches instead.',
        },
        {
          q: 'Does @ViewBuilder on a function returning any View help?',
          a: 'No. You still returned an existential. Return some View and let the builder produce a concrete conditional type.',
        },
        {
          q: 'When is AnyView actually justified?',
          a: 'A plugin or third-party seam where you cannot name the view type, and the view is not in a tight scroll path. Even then, erase once at the boundary.',
        },
        {
          q: 'Does type erasure also cost copy-on-write the way any Collection does?',
          a: 'The view is boxed as an existential payload. You pay allocation and lost specialisation. It is the same family of cost as any versus generic, applied to the view graph.',
        },
      ],
      teaches: [
        'some View vs any View',
        'AnyView allocation and identity',
        'ViewBuilder conditionals',
        'SwiftUI identity in lists',
      ],
    },
    {
      id: 'd1-p5',
      title: 'unowned self crashes after pop',
      difficulty: 'Expert',
      kind: 'Incident',
      prompt: `Crashlytics: \`EXC_BAD_ACCESS\` in a URLSession completion after users leave a profile screen quickly. The leak from this morning is "fixed." The new code:

\`\`\`swift
final class ProfileViewController: UIViewController {
    private let loader = AvatarLoader()

    override func viewDidLoad() {
        super.viewDidLoad()
        loader.start(url: user.avatarURL) { [unowned self] image in
            self.avatarView.image = image
        }
    }

    deinit {
        // loader is not cancelled
    }
}

final class AvatarLoader {
    func start(url: URL, completion: @escaping (UIImage?) -> Void) {
        URLSession.shared.dataTask(with: url) { data, _, _ in
            DispatchQueue.main.async {
                completion(data.flatMap(UIImage.init(data:)))
            }
        }.resume()
    }
}
\`\`\`

Why did the leak go away, why is this a crash, and what is the correct capture and lifetime for this callback?`,
      think: [
        'What happens to an unowned reference when the view controller deinits before the callback?',
        'Does hopping to the main queue make the controller live longer?',
        'If you cancel the request in deinit, do you still want unowned?',
      ],
      solution: `The leak went away because \`unowned\` does not retain. The controller can now deinit on pop. URLSession still holds the completion. The completion still mentions \`self\`. After deinit, that mention is a dangling pointer. The main-queue hop does not keep the controller alive; it only delays the crash until the next main run loop.

Use \`[weak self]\`, and cancel the task so you do not keep the callback at all:

\`\`\`swift
final class ProfileViewController: UIViewController {
    private let loader = AvatarLoader()
    private var avatarTask: URLSessionDataTask?

    override func viewDidLoad() {
        super.viewDidLoad()
        avatarTask = loader.start(url: user.avatarURL) { [weak self] image in
            self?.avatarView.image = image
        }
    }

    deinit {
        avatarTask?.cancel()
    }
}
\`\`\`

\`unowned\` is for a relationship where the closure cannot outlive the object — a nested helper owned by \`self\`, not a network callback.`,
      explanation: `You popped the profile, the leak graph went quiet, and then Crashlytics started lighting up on a URLSession path. That is not a new mystery. It is yesterday's retain cycle with the retain removed and the lifetime left unchanged. The closure still exists after the screen is gone. It still talks to \`self\`. \`unowned\` promised the runtime that this would never happen. The user popped during a slow avatar download, and the promise broke.

Think about the sequence as a person leaving a room. The view controller is the room. \`unowned self\` is a note on the door that says "the occupant is always in here, do not check." Weak would have been a note that says "maybe they left, look first." You tore down the room in \`deinit\`, URLSession walked in a moment later on a background thread, bounced to main, and tried to set \`avatarView.image\` through a pointer that is now leftover memory. \`EXC_BAD_ACCESS\` is that walk.

The main-queue hop fools people into thinking they serialized lifetime. They serialized UI work. Lifetime is still "whoever retains the closure." URLSession does. Dispatch does, until the block runs. Nobody retains the view controller anymore, which was the whole point of the leak fix. You cannot have "does not retain" and "is definitely alive in a callback that outlives the screen" at the same time.

The right picture is the one from the first problem, finished: weak capture so a late callback is a no-op, and cancel so the callback usually never runs. Unowned is a performance and convenience tool for inner closures whose owner is the same object that owns the closure. A session callback is not inner. It belongs to the network stack.`,
      internals: `\`weak\` is an optional that the runtime zeros when the object deinits, via the side table. Accessing it after deinit is safe: you get nil. \`unowned\` is a non-optional unsafe reference. In the Swift native case it still participates in the lifetime tracking enough to trap in debug when you use it after deinit; in practice, a URLSession completion hopping through GCD often shows up in production as a raw bad access, especially if the memory was reused.

The closure object is allocated when you call \`start\`. It captures the unowned reference as a pointer. The session task retains the Objective-C block wrapping your completion. Popping the controller drops the last strong ref. \`deinit\` runs. The task is still in flight. Later, \`URLSession\` calls the block, \`DispatchQueue.main.async\` retains that inner block until main runs it, and then you load from the unowned pointer.

Cancel in \`deinit\` races with the completion: cancel can still let an in-flight callback run, or the main hop can already be queued. That is why cancel is necessary and not sufficient. Weak is the last guard on the other side of the hop.`,
      testing: `The crash is timing-dependent, so write a test that forces the order instead of hoping a UI test pops "fast enough." Fake the loader: start, release the controller, then fire the completion on main. With \`unowned\`, the test should crash or hit a precondition — do not ship that. With \`weak\`, assert the completion returns without touching UI, and assert \`deinit\` already ran.

A second test: cancel is called, and the fake session records \`cancel()\` on the task. A third: completion arrives before pop, image is set. Those three orders are the whole state machine.

In Instruments, you now expect zero leftover \`ProfileViewController\` instances *and* no zombie access. Zombies in debug will shout if you still have unowned and a late callback.`,
      pitfalls: `\`[unowned self]\` on a main-thread-only callback is still wrong if the object can deinit first. Main-thread is not a lifetime. \`DispatchQueue.main.async\` after deinit is a scheduled crash, not a safe hop.

Cancelling without weak: the completion can already be sitting on the main queue. You cancel, \`deinit\` finishes, the queued block runs, crash. Weak without cancel: no crash, but you still download avatars for screens nobody is looking at, and you still retain the large \`Data\` until the request finishes.

\`unowned(unsafe)\` is worse: it opts out of even the debug traps. There is no reason to use it on a view controller callback.

If a strong cycle still exists (UIAction, coordinator), you will not crash and you will think \`unowned\` is fine. Then someone fixes the cycle, and the crash appears in the next release. That is why this incident shows up the week after a "memory fix."`,
      alternatives: `\`Task\` + \`URLSession.data(for:)\` with \`[weak self]\` and cancel in \`deinit\` is the structured version. SwiftUI \`.task\` cancels on disappear, which removes the unowned temptation entirely because the task is not supposed to outlive the view.

A completion that captures a weak view and a strong \`UUID\` token is the UIKit cell pattern: even if the controller is still alive, you ignore stale images. That is complementary to weak, not a substitute for it.

If you truly have a nested closure owned by \`self\` (a \`lazy var\` formatter that never escapes), \`unowned\` can be reasonable. Draw that line at "does this closure get stored in URLSession, NotificationCenter, or a control." If yes, weak.`,
      tradeoffs: `Unowned avoids optional unwrapping and a side-table registration. On a hot inner loop that would matter. On an avatar download it is a rounding error next to the network, and the failure mode is a crash. Weak plus cancel is the product-correct pair: no crash, no leaked controller, occasional wasted bandwidth if cancel races, which you can still tighten with a generation token.

The cultural tradeoff is real. Teams that "ban weak" because they hate \`self?\` will reach for unowned and generate this crash. Teams that "weak everything" will write \`guard let self\` in places where the closure is a child of \`self\` and cannot outlive it. Teach the lifetime, not the keyword.`,
      followups: [
        {
          q: 'If we cancel in viewDidDisappear, is unowned safe?',
          a: 'No. A completion may already be queued on main. Weak is still required as the last check.',
        },
        {
          q: 'Why did this not crash when we first switched to unowned?',
          a: 'Another strong cycle was still keeping the controller alive. The crash appeared when that cycle was removed.',
        },
        {
          q: 'Does [unowned self] plus hopping to MainActor change anything?',
          a: 'No. Isolation hops schedule work; they do not extend the lifetime of an unowned reference.',
        },
        {
          q: 'Is unowned acceptable inside a lazy var initializer on the same object?',
          a: 'Often yes, if that closure cannot escape. The moment you pass it to URLSession, it is no longer that case.',
        },
        {
          q: 'How do you explain this in a postmortem without blaming ARC?',
          a: 'The callback outlived the screen. Unowned asserted it would not. Cancel and weak are the two layers that make that assertion unnecessary.',
        },
      ],
      teaches: [
        'unowned vs weak lifetimes',
        'URLSession outliving the screen',
        'Main-queue hop is not ownership',
        'Cancel plus weak as two layers',
      ],
    },
    {
      id: 'd1-p6',
      title: '@Published sink keeps the view model forever',
      difficulty: 'Senior',
      kind: 'Debug',
      prompt: `A profile screen's view model never deinits after pop. Combine looks "correct": the sink is stored in \`cancellables\`.

\`\`\`swift
final class ProfileVM: ObservableObject {
    @Published var name: String
    @Published var query: String = ""
    private var cancellables = Set<AnyCancellable>()
    private let analytics: Analytics

    init(name: String, analytics: Analytics) {
        self.name = name
        self.analytics = analytics
        $query
            .dropFirst()
            .debounce(for: .milliseconds(300), scheduler: RunLoop.main)
            .sink { value in
                self.analytics.trackSearch(value)
                self.refreshSuggestions(for: value)
            }
            .store(in: &cancellables)
    }

    func refreshSuggestions(for query: String) { /* hits the network */ }
}
\`\`\`

The SwiftUI view uses \`@StateObject var vm: ProfileVM\`. Why is the object immortal, and how do you break the cycle without losing the debounce?`,
      think: [
        'Who retains the AnyCancellable, and who does the sink closure retain?',
        'Does @Published itself create a cycle, or is it the sink?',
        'What happens to cancellables when the view model deinits — and can it deinit?',
      ],
      solution: `\`ProfileVM\` strongly retains \`cancellables\`. Each \`AnyCancellable\` retains the subscription. The \`sink\` closure strongly captures \`self\`. That is a cycle. \`@Published\` is not the villain; the escaping sink is. \`@StateObject\` will happily keep the object for the view's identity, and when the view goes away the cycle still holds the view model on its own.

\`\`\`swift
$query
    .dropFirst()
    .debounce(for: .milliseconds(300), scheduler: RunLoop.main)
    .sink { [weak self] value in
        guard let self else { return }
        self.analytics.trackSearch(value)
        self.refreshSuggestions(for: value)
    }
    .store(in: &cancellables)
\`\`\`

If \`analytics\` is a class and you only need it in the sink, you can capture \`[weak self, analytics]\` or a weak proxy, but \`refreshSuggestions\` needs the view model, so \`[weak self]\` is the honest fix. Cancel explicitly in \`deinit\` if you have other long-lived subscriptions, but breaking the capture is what allows \`deinit\` to run.`,
      explanation: `You left the profile screen and expected \`@StateObject\` to drop the view model. SwiftUI did drop its hold. The view model did not die, because it is holding itself through Combine. That sentence sounds cute until you draw it: \`self.cancellables\` owns the \`AnyCancellable\`, the cancellable owns the subscription, the subscription owns your sink closure, the sink owns \`self\`. There is no way into that loop from the outside once the view is gone, and there is no way out from the inside because \`deinit\` is what would call \`cancellables.removeAll()\`, and \`deinit\` will not run.

\`@Published\` makes a publisher that lives on the object. Subscribing to \`$query\` is fine. Storing the subscription on the same object is the usual pattern and is also fine. The part that is not fine is a closure that strongly captures the object and is then stored on the object. Debounce does not change the graph; it only means the closure still exists 300 ms after the last keystroke, which is another way the work can outlive a quick pop even after you go weak.

This is the same ownership conversation as \`UIAction\`, wearing Combine's types. The bag is a stored property. The sink is an escaping closure. The capture list is the only thing that decides whether the bag is a child of the view model or a leash around it. People trust \`.store(in: &cancellables)\` the way they trusted "nothing holds this globally." The bag is the holder.`,
      internals: `\`@Published\` wraps the property and exposes \`$name\` as a publisher that emits after the value changes (and can emit the current value on subscribe). The publisher holds a weak-ish relationship to its subscribers, but the \`AnyCancellable\` you get from \`sink\` is a token that keeps the subscription alive. You put that token in a \`Set\` on \`self\`. Strong.

The sink's closure is \`(String) -> Void\` and, with no capture list, closes over \`self\` to reach \`analytics\` and \`refreshSuggestions\`. Closures are heap objects with strong captures by default for classes. You now have:

\`\`\`text
ProfileVM ──strong──► Set<AnyCancellable> ──strong──► subscription ──strong──► sink ──strong──► ProfileVM
\`\`\`

\`ObservableObject\`'s \`objectWillChange\` is a different publisher. You can build the same cycle with \`objectWillChange.sink { self.objectWillChange.send() }\` if you try hard enough. The published property is just the one that shows up in this screen.

When the cycle breaks (\`[weak self]\`), the weak ref does not keep the VM. SwiftUI dropping \`StateObject\` drops the last external strong ref. \`deinit\` runs, the \`Set\` deinits, cancellables cancel, the subscription tears down. Order matters: weak is what makes that sequence reachable.`,
      testing: `Give \`ProfileVM\` a deinit flag in tests. Create it, subscribe (init already does), release it, assert deinit. With the strong sink, the assertion fails. With \`[weak self]\`, it passes.

Also test behaviour: fire a burst of \`query\` changes, assert you get one analytics event after 300 ms with the latest value, and assert that releasing the VM before the debounce fires does not crash and does not call into a zombie. That last part is why weak is not only a leak fix; it is a late-callback fix.

Memory Graph after pop should show zero \`ProfileVM\` nodes. If you still see one, look at the Combine objects holding it — the graph is quite readable for this cycle.`,
      pitfalls: `\`[unowned self]\` in the sink has the same crash as the URLSession problem if the debounce fires after deinit. Debounce is literally a delayed callback. Weak.

Capturing \`self.analytics\` strongly without capturing \`self\` can still leak if analytics retains a closure back into the VM, but more commonly you then cannot call \`refreshSuggestions\` without \`self\` anyway. Do not split the capture to be clever; weaken \`self\` and keep the code obvious.

Assigning \`cancellables.removeAll()\` in \`onDisappear\` without weakening the sink: you can break the cycle at disappear if you remember to do it, and then a second appear has no subscription. The capture list is the fix that still works if disappear does not run (the VM is used from UIKit, or the view identity did not tear down the way you thought).

\`assign(to: \\.name, on: self)\` is a famous Combine cycle. Prefer \`assign(to: &$name)\` on \`@Published\`, which is designed not to retain \`self\` that way — and still read the capture lists on every \`sink\`.`,
      alternatives: `Swift observation (\`@Observable\`, \`withObservationTracking\`) avoids Combine bags entirely for UI binding, but if you still debounce search you will have a \`Task\` you must cancel — same lifetime problem, different types.

An unstructured \`Task\` in \`init\` that \`for await\`s \`query\` via a stream is fine if the task is stored on \`self\` and cancelled in \`deinit\`, and if the task does not strongly capture \`self\` without a weak break. You can also put the pipeline on the view: \`.onChange(of: vm.query)\` plus a \`.task(id:)\`. Then the view owns the work, which matches "work should die with the screen" even more closely, at the cost of putting more behaviour in the view.

RxSwift \`DisposeBag\` is the same graph. The lesson is not Combine-specific.`,
      tradeoffs: `Storing subscriptions on the view model is convenient: the pipeline starts in \`init\` and UI stays dumb. The price is that every closure in that pipeline is a potential cycle, and debounce/throttle add delayed callbacks that make \`unowned\` unsafe. Moving the pipeline to the view with \`.task(id: query)\` pushes lifetime onto SwiftUI, which cancels for you, but makes the view model harder to test as a single unit.

\`[weak self]\` in a debounce sink means a pop mid-keystroke drops the last analytics event. That is usually what you want. If it is not — you must flush analytics even after pop — capture the analytics client strongly and the view model weakly, and let the client outlive the screen for that one event. That is a deliberate ownership split, not a reason to capture \`self\` strongly again.`,
      followups: [
        {
          q: 'Does store(in:) retain self by itself?',
          a: 'It retains the cancellable on self. The cycle appears when the cancellable also retains a closure that retains self.',
        },
        {
          q: 'Is @Published a class wrapping the value?',
          a: 'The wrapper sits on the instance and its publisher can retain subscribers. The leak in this problem is the sink capture, not the property wrapper existing.',
        },
        {
          q: 'Why is assign(to:on:) dangerous?',
          a: 'assign(to: \\.property, on: self) strongly retains the object. assign(to: &$property) on a Published is the API meant to avoid that.',
        },
        {
          q: 'Would cancellables.removeAll() in deinit help?',
          a: 'deinit will not run while the cycle holds. Break the capture; then deinit can cancel whatever remains.',
        },
      ],
      teaches: [
        'Combine sink retain cycles',
        '@Published vs the subscription bag',
        'Debounce as a delayed callback',
        'weak self in stored subscriptions',
      ],
    },
    {
      id: 'd1-p7',
      title: 'generic mutation vs any existential boxing',
      difficulty: 'Expert',
      kind: 'Performance',
      prompt: `A photo editor stamps a header byte on large buffers. Two helpers exist. Instruments: the existential path allocates a second 40 MB buffer; the generic path does not when the array was unique.

\`\`\`swift
protocol Stampable {
    mutating func stampHeader()
}

extension Array: Stampable where Element == UInt8 {
    mutating func stampHeader() {
        if !isEmpty { self[0] = 0xFF }
    }
}

func stampAny(_ buffer: inout any Stampable) {
    buffer.stampHeader()
}

func stampGeneric<B: Stampable>(_ buffer: inout B) {
    buffer.stampHeader()
}

var pixels = Array(repeating: UInt8(0), count: 40_000_000)
stampGeneric(&pixels) // cheap if unique
stampAny(&pixels)     // expensive
\`\`\`

Why does \`any Stampable\` copy? What does boxing do to \`isKnownUniquelyReferenced\`? When is \`any\` still the right API?`,
      think: [
        'Where does the existential store the array value?',
        'How many owners of the 40 MB buffer exist during stampAny?',
        'What can a generic inout function do that an existential cannot?',
      ],
      solution: `\`stampGeneric\` receives \`inout\` to the caller's \`Array\`. If that array uniquely owns the buffer, \`stampHeader\` mutates in place.

\`stampAny\` takes \`inout any Stampable\`. The existential **boxes** the array: a heap container that holds the value and a witness table. That box is another owner of the buffer. Inside \`stampHeader\`, the array is no longer uniquely referenced, so copy-on-write allocates a second 40 MB, stamps the copy, and writes the copy back into the box.

Use the generic (or a concrete \`inout [UInt8]\`) on the hot path. Keep \`any Stampable\` for heterogeneous collections of small values, plugin boundaries, or when you truly need a mixed array of stampables.

\`\`\`swift
func stampPixels(_ pixels: inout [UInt8]) {
    guard !pixels.isEmpty else { return }
    pixels[0] = 0xFF
}
\`\`\`

If you must use an existential, copy explicitly at a boundary you control, or redesign so the existential holds a class-backed buffer whose uniqueness you manage.`,
      explanation: `You already paid for copy-on-write once today when three names shared an array. This is the same check, triggered by a type you cannot see in the source of \`stampHeader\`. The generic function is a transparent window onto \`pixels\`. The existential is a suitcase you put \`pixels\` into, and the suitcase counts as someone holding the bag.

\`any Stampable\` exists because you wanted to talk about "anything that can stamp" without naming the type. That is a real need at a plugin boundary. It is also a second owner. The value inside the box is a full \`Array\` header pointing at the same 40 MB. Your local \`pixels\` still points at it too — you passed \`inout\`, so the existential is mutating in place *from the caller's point of view*, but internally Swift has to put the value into a box that can represent any conformer. That box retains the buffer. \`stampHeader\` asks "am I unique?" and the answer is no. Forty megabytes later, the header byte is stamped on the clone.

Generics keep the type \`B\` as \`Array<UInt8>\`. There is no box. \`inout\` is a borrowed address of the caller's array. The uniqueness check sees one owner if you did not share \`pixels\` elsewhere. That is why the same one-line mutation is free or catastrophic depending on the function signature.

The production lesson is not "never use any." It is: existentials are a heap story. On a large copy-on-write value, the heap story includes a silent copy. Name the type, or genericise, when the payload is big.`,
      internals: `An existential \`any P\` is a container: in-line storage for small values, heap allocation when the payload does not fit, plus a witness table pointer for \`P\`'s requirements. \`Array\` does not fit in the tiny inline buffer once you look at its buffer pointer and count — and even if the header did, the heap buffer of elements is still reference-counted. Putting the array into the existential retains that buffer.

\`inout any Stampable\` therefore means: write the value into an existential box (retain), mutate through the witness table, write back. Mutation of \`Array\` goes through COW. The extra retain makes \`isKnownUniquelyReferenced\` false. You copy.

A generic \`<B: Stampable>(_ buffer: inout B)\` monomorphises (or uses a thin witness without boxing the value). \`B\` is \`[UInt8]\` at this call site. \`inout\` is the address of \`pixels\`. No second array header needs to exist.

This is the same family as \`any View\` versus \`some View\`. Opaque and generic keep a concrete type. Existential erases it and, for COW types, often copies on mutate. \`any Collection\` plus mutation is a well-known performance trap for the same reason.`,
      testing: `Two micro-fixtures with Allocations, not a unit assert on a byte:

1. \`var a = bigUnique(); stampGeneric(&a)\` — no 40 MB copy, \`a[0] == 0xFF\`.
2. \`var a = bigUnique(); stampAny(&a)\` — a 40 MB allocation, same functional result.

Also share first: \`let extra = pixels; stampGeneric(&pixels)\` should copy even on the generic path, which proves you are measuring uniqueness and not "generics are magic."

A CI test can use a smaller buffer (a few MB) and a high-water memory metric if you have one. Functional XCTest only asserts the header byte; it will pass on both paths and hide the incident.`,
      pitfalls: `Changing \`Stampable\` to a class-bound protocol (\`AnyObject\`) so the existential holds a reference sounds like a fix and then you share a mutable class across editors. You traded a copy for a data race. If you go that way, the class must be uniquely owned or isolated.

Writing \`func stampAny(_ buffer: any Stampable)\` without \`inout\` will not even mutate the caller's array; you will stamp a box that you then throw away. The compiler may warn. People add \`inout\` to make it compile and then hit the copy.

Existentials in arrays — \`[any Stampable]\` — box every element. Fine for three small structs. Catastrophic for three photo buffers.

\`some Stampable\` as a parameter is not valid in older Swift in the same way; \`some\` in parameter position is an implicit generic. That implicit generic is what you wanted.`,
      alternatives: `Concrete \`inout [UInt8]\` is the most honest API for a pixel stamp. A generic protocol constraint is the honest API if you have several buffer types (Data, ContiguousArray, a custom \`ImageBuffer\`) and they are all large COW or uniquely owned.

A class-backed \`PixelStorage: Stampable\` with an explicit \`copy()\` method makes sharing visible. Mutation does not surprise you with a 40 MB spike; you either mutate the class or you copied on purpose.

If the existential is required at a plugin boundary, stamp inside the plugin on a generic path, and only erase the *result* (a small thumbnail view, a status enum), not the buffer.`,
      tradeoffs: `Generics specialise and preserve uniqueness, at the cost of more code in the binary and a heavier type-checker story when overused. Existentials make mixed collections and plugin APIs easy, at the cost of boxing and COW copies. For a 40 MB editor buffer the generic/concrete path wins without discussion. For a stream of small commands (\`any Command\`), the existential is the architecture you actually want.

\`some\` / generic parameters are the middle: you hide the name from the caller but keep a concrete type. Use that when the caller should not care which buffer they have, but you still mutate it on a hot path.`,
      followups: [
        {
          q: 'Does inout on the existential avoid the copy?',
          a: 'It avoids copying at the Swift call-semantics level (the caller sees their variable updated). It does not avoid the extra retain inside the box that breaks COW uniqueness.',
        },
        {
          q: 'Is this why any View was slow in the feed row?',
          a: 'Same family: erasure boxes a concrete type and loses specialisation. Views pay layout and identity; arrays pay COW copies.',
        },
        {
          q: 'Would making Stampable refine AnyObject fix the allocation?',
          a: 'The existential would then hold a class reference, so no COW copy of an array — because you would have moved the pixels into a class. You must then handle sharing of that class.',
        },
        {
          q: 'some Stampable as a return type — does returning copy?',
          a: 'Returning a large array copies the header and retains the buffer (COW). That is cheap. Returning any Stampable may heap-box the header. Still cheap compared to mutating a shared buffer.',
        },
      ],
      teaches: [
        'Existential boxing',
        'Generics preserve COW uniqueness',
        'any vs some vs generic',
        'When existentials are the right API',
      ],
    },
    {
      id: 'd1-p8',
      title: 'Two-phase init, IUO, and a callback into half-built self',
      difficulty: 'Expert',
      kind: 'Review',
      prompt: `Code review this UIKit screen. It compiles. It sometimes crashes in \`apply(state:)\` during construction, and Instruments occasionally shows the controller leaking.

\`\`\`swift
final class EditorViewController: UIViewController {
    private var viewModel: EditorViewModel!
    private let session: Session

    init(documentID: String, session: Session) {
        self.session = session
        super.init(nibName: nil, bundle: nil)
        self.viewModel = EditorViewModel(documentID: documentID) { [self] state in
            self.apply(state)
        }
        session.addObserver(self)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:)") }

    func apply(_ state: EditorState) {
        title = state.title
        // touches other properties set only after this init returns
    }
}

final class EditorViewModel {
    init(documentID: String, onChange: @escaping (EditorState) -> Void) {
        // sometimes loads from a cache synchronously and calls onChange
        if let cached = Cache.shared.instant(documentID) {
            onChange(cached)
        }
    }
}
\`\`\`

What rules of Swift initialisation did this code dodge, and how should ownership and setup be ordered?`,
      think: [
        'Why is viewModel an IUO instead of a let set before super.init?',
        'Can onChange run before init has returned?',
        'What does [self] mean here, and does session.addObserver retain the controller?',
      ],
      solution: `Two-phase init forbids using \`self\` until all stored properties are set and \`super.init\` has run. \`EditorViewModel\` needs a callback into \`self\`, so the author deferred \`viewModel\` as an IUO, called \`super.init\` first, then built the view model. That compiles. It also means \`onChange\` can run **during** \`EditorViewModel.init\`, while you are still inside \`EditorViewController.init\`, before you have finished configuring the object and before \`session.addObserver\` has run. \`apply\` then touches a half-built controller.

\`[self]\` is a strong capture. If the view model stores \`onChange\` (it almost certainly does, for later updates), you have a cycle: controller → viewModel → closure → controller. \`session.addObserver(self)\` may be a second strong edge if the session does not hold a weak observer list.

Order it so the object is fully initialised before any callback can fire, and weaken the callback:

\`\`\`swift
final class EditorViewController: UIViewController {
    private let viewModel: EditorViewModel
    private let session: Session

    init(documentID: String, session: Session) {
        self.session = session
        self.viewModel = EditorViewModel(documentID: documentID)
        super.init(nibName: nil, bundle: nil)
        viewModel.onChange = { [weak self] state in
            self?.apply(state)
        }
        viewModel.start() // cache / network after the callback is set and self is complete
        session.addObserver(self) // observer list must be weak
    }
}
\`\`\`

Do not use \`!\` to smuggle \`self\` into a value that escapes during construction.`,
      explanation: `Swift initialisation is two-phase because it refuses to let you use an object before it is an object. Stored properties first, \`super.init\`, then you may call methods on \`self\`. That rule is annoying the moment a child object needs a callback into its owner. The IUO is how people silence the compiler: leave \`viewModel\` empty, finish phase one, then fill it in. The compiler is happy. The cache in \`EditorViewModel.init\` is not party to that story. It calls \`onChange\` immediately, the closure uses \`[self]\`, and \`apply\` runs while you are still on the line that is constructing the view model. Title gets set, maybe, and then you touch a view that is not loaded, or a property you were about to set on the next line.

The leak is the same closure after construction. \`[self]\` keeps the controller for as long as the view model stores the callback, which is "until the editor dies," which is "until the callback releases the controller." Cycle. You have seen this shape three times today; here it is installed in \`init\` because that is when you had \`self\` in your hand and a closure to fill.

The IUO adds a third failure mode: any path that reads \`viewModel\` before that assignment — an override of a \`super.init\` hook, a notification fired from \`addObserver\`, \`viewDidLoad\` in a bizarre test — traps on unwrap. You did not make the dependency optional in the domain sense. You made it unsafe to dodge phase one.

A clean init builds values that do not need \`self\`, calls \`super.init\`, then wires callbacks with \`[weak self]\`, then starts work that might be synchronous. Split "construct" from "start" on the view model so construction cannot call back.`,
      internals: `Class initialisation: all stored properties of the subclass are assigned, \`super.init\` runs (and may call overridable methods — another foot-gun), then the instance is ready. Using \`self\` in a closure *before* that point is a compile error because the closure could run immediately. Using \`self\` in a closure *after* \`super.init\` compiles even if the closure runs immediately, because the compiler does not prove whether \`onChange\` is escaping-and-sync. It only checks that \`self\` exists.

IUO (\`EditorViewModel!\`) is a stored optional with force-unwrap sugar. Until you assign it, the value is nil. The type system pretends it is not. That is why it is a favourite workaround for "I need this property to mention self."

If \`EditorViewModel.init\` stores \`onChange\` and then synchronously calls it, the call stack is still inside \`EditorViewController.init\`. \`apply\` is an ordinary method; it can run. \`view\` may not exist. Other lets may. \`session.addObserver\` has not run. You are in a state no other method of this class was written to expect.

Observer lists that retain \`self\` are a second graph. If \`Session\` holds observers strongly, the controller never dies even after you weaken the view model callback. Observer APIs should take \`weak\` or a token you invalidate in \`deinit\`.`,
      testing: `A unit test with a cache hit is the crash: \`Cache.shared\` returns instantly, init should complete, \`apply\` should run only after a start method, and \`deinit\` should fire when you release the controller.

Force the synchronous callback:

\`\`\`swift
func testInitDoesNotApplyBeforeReturn() {
    let recorder = ApplyRecorder()
    _ = EditorViewController(documentID: "cached", session: FakeSession(), applyHook: recorder)
    XCTAssertFalse(recorder.calledDuringInit)
}
\`\`\`

You will need a small hook or subclass to observe that; the point is to make the cache-hit path deterministic. A second test: no cache, start async, release the VC, assert the late callback does not crash (weak). A third: Memory Graph / deinit after pop with the session still alive — observer must not retain.`,
      pitfalls: `Calling overridable methods from \`init\` (including \`super.init\` of UIViewController, which can trigger view loading in some paths) is the UIKit version of "callback during init." Do not load the view in \`init\`. Do not start network in \`init\` if the callback touches \`view\`.

\`lazy var viewModel = EditorViewModel { [unowned self] in ... }\` delays construction until first use, which may be during \`init\` of something else, and unowned is still a crash if the lazy runs after deinit — rare, but the capture should still be weak if it is stored.

\`required init?(coder:)\` as \`fatalError\` is fine for a programmatic screen; do not then sneak a storyboard instantiation in a test and wonder why you trapped.

Using \`self\` in a default property value (\`let id = UUID(); let handler = { self.foo() }\`) is a compile error for a reason. Moving that into \`init\` with an IUO does not make the reason go away; it only makes it runtime.`,
      alternatives: `Make the view model own no callback. The controller observes a \`@Published\` / stream / \`AsyncStream\` it subscribes to after \`super.init\`, with \`[weak self]\`. Construction of the view model takes only \`documentID\`.

Factory method: \`static func make(...) -> EditorViewController\` that fully inits, then calls \`start()\`. Reviewers can see the two-phase dance in one place.

For pure Swift types (not UIViewController), assign all lets first, including a view model that does not callback in \`init\`. If two objects must point at each other, one edge is weak. That is the whole rule.`,
      tradeoffs: `IUOs make UIKit init look like Objective-C: create, then configure. They compile. They push invariant violations to runtime and they invite escaping closures to run against a half-built object. A two-step API (\`init\` + \`start\`) is uglier at the call site and is the one that cannot call back too early.

Synchronous cache hits are a gift for UX and a curse for init. Keep the gift; move the delivery to \`start()\` after wiring weak callbacks. You pay one extra line at every construction site and you stop crashing on the cached path, which is ironically the fast path testers hit least and users hit most.`,
      followups: [
        {
          q: 'Why not pass self into EditorViewModel.init after super.init without weak?',
          a: 'Because the view model will store it. That is a cycle unless the stored reference is weak. A callback property is the same cycle wearing a closure.',
        },
        {
          q: 'Can super.init call viewDidLoad before your init body continues?',
          a: 'If something loads the view during super.init, yes, in nasty UIKit paths. Do not assume the rest of your init has run. Do not start escaping work that needs a fully configured object until your init returns, or at least until all of your assignments are done.',
        },
        {
          q: 'Is implicitly unowned self different from IUO properties?',
          a: 'Yes. unowned is a capture of an object you claim is alive. IUO is a stored optional you claim is already set. Both trap when the claim is false, at different times.',
        },
        {
          q: 'How do you initialise two objects that need each other?',
          a: 'Create both without callbacks, then wire one weak edge. Or introduce a third owner that holds both strongly and connects them.',
        },
      ],
      teaches: [
        'Two-phase initialization',
        'IUO as an init workaround',
        'Synchronous callbacks during init',
        'Weaken callbacks after construction',
      ],
    },
    {
      id: 'd1-p9',
      title: 'open vs public: the override that never shipped',
      difficulty: 'Senior',
      kind: 'Judgment',
      prompt: `You maintain \`AcmeUI\`, a Swift module used by four app targets. A product team subclasses \`AcmeScreen\` in the app to swap the hero layout. Their override never runs. They can override \`viewDidAppear\`. They cannot override \`configureHero()\` — it does not compile. Another method, \`layoutMetrics()\`, compiles as an override in the app but the module still runs its own implementation when it calls \`self.layoutMetrics()\` internally.

\`\`\`swift
// Module AcmeUI
open class AcmeScreen: UIViewController {
    public func configureHero() {
        // app wants to override this
    }

    public func layoutMetrics() -> Metrics {
        Metrics.standard
    }

    open func reload() {
        let m = layoutMetrics()
        configureHero()
        apply(m)
    }
}

// App target
final class CampaignScreen: AcmeScreen {
    // override func configureHero() { ... }  // compile error
    override func layoutMetrics() -> Metrics { Metrics.campaign } // compiles?
}
\`\`\`

Explain the access-control rules across modules, what you would change in 2.0, and what you would not open just to make a subclass happy.`,
      think: [
        'Which keyword allows subclassing across modules, and which allows overriding a method?',
        'If the module calls layoutMetrics() on self, whose implementation runs?',
        'What is the ABI / support cost of opening a method you cannot test in every client?',
      ],
      solution: `Across modules:

* \`public class\` is subclassable only inside the defining module. \`open class\` is subclassable from other modules.
* \`public func\` is not overridable outside the module. \`open func\` is.
* \`viewDidAppear\` comes from UIKit as \`open\`, so the app can override it.
* \`configureHero()\` is \`public\` on an \`open\` class: visible, not overridable. That is the compile error.
* If \`layoutMetrics()\` is only \`public\`, an \`override\` in another module should not compile. If it does, you are in the same module, or the method is actually \`open\`. If the library calls \`self.layoutMetrics()\` and you expected a subclass hook, it must be \`open\` and the library must actually dispatch to that hook (a requirement you test with a subclass in a second test target).

For 2.0, promote only the hooks you are willing to support:

\`\`\`swift
open class AcmeScreen: UIViewController {
    open func configureHero() { /* default */ }
    open func layoutMetrics() -> Metrics { .standard }
    public func reload() { /* calls the open hooks */ }
}
\`\`\`

Do not open \`reload()\` if you need to keep sequencing. Document the hooks. Add a test target that subclasses from outside the module.`,
      explanation: `The app team did the reasonable thing: they subclassed your screen and tried to override the method that looks like a hook. \`configureHero\` is public, the class is open, UIKit lets them override \`viewDidAppear\`, so this should work. It does not, because \`public\` and \`open\` split "you can see this" from "you can replace this" at the module boundary. Inside \`AcmeUI\`, \`public\` methods are overridable by other types in that module. The app is not that module. The compiler is not being precious. It is enforcing a promise you never made: this method is not a supported customisation point.

That promise matters more than the keyword trivia. The moment you mark \`configureHero()\` \`open\`, every app target may depend on call order, on \`super\` being required or not, on you never inlining a different implementation, on you never calling it from a background queue. You just grew your API surface in the most expensive direction — behaviour subclassers can observe internally — without a protocol, without a test, and without a note in the changelog.

\`layoutMetrics()\` is the quieter version of the same story. If the library calls it on \`self\` and it is a true overridable hook, the subclass in the app should win. If it is \`public\` and the call is internal, the library's implementation always runs, and the app's method is a different function that nobody in the module will call. You have a method that looks like an override and is actually dead. Shipping that is worse than a compile error, because the campaign layout never appears and the compiler said nothing.

The judgment call is which methods are actually the product customisation surface. Open those, test them from a second module, and keep the rest public or internal. Opening the whole class "because UIViewController is open" is how you inherit a decade of subclassing bugs.`,
      internals: `Swift access control is per module. \`internal\` is the default: same module. \`public\` is visible outside, and for members of a class it does not grant override permission across the boundary. \`open\` is the extra bit: subclass and override from another module. \`final\` is the opposite extra bit: never override, even inside the module.

Dispatch for \`open\` methods is the class's vtable (or equivalent witness) in a way clients can extend. The library call \`self.layoutMetrics()\` is dynamic if the method is overridable; a subclass slot can replace it. If the method is not overridable from the client's point of view, the client cannot even put a slot there.

UIKit's \`viewDidAppear\` is \`open\` because UIKit is in the subclassing business. Your \`configureHero\` is not UIKit. It is a convenience you happened to put on a UIViewController subclass. Visibility leaked; customisation did not, until you choose it.

Binary stability: adding \`open\` later is a source-compatible relaxation. Removing \`open\` is a break. Adding a new \`open\` method is a new hook you must keep. This is why "just open everything" is an ABI and support decision, not a courtesy to the first client who asked.`,
      testing: `A unit test in the same module can subclass and override \`public\` methods, and will lie to you. You need a second test target that imports \`AcmeUI\` as a client:

* \`configureHero\` override compiles only after you mark it \`open\`.
* Calling \`reload()\` from the test subclass asserts the subclass hero ran, and asserts metrics came from the subclass if that is a hook.
* A test that does *not* override still gets defaults.

If you cannot run a second-module test in CI, you will ship the "override compiles but never runs" variant. That is the one the campaign team just hit.

Also test that you still call the hooks from \`reload\` after a refactor. Open methods that nothing in the library calls are dead API.`,
      pitfalls: `Marking the class \`open\` and leaving methods \`public\` is the exact trap in the prompt. It looks subclassable. It is, but only for the \`open\` members (and inherited UIKit ones).

Opening \`reload()\` so people can replace sequencing means you can never tidy sequencing. Prefer open hooks and a public non-overridable pipeline.

\`@inlinable\` on a method that calls an open hook can freeze a call into the default implementation from another module's point of view depending on how you inlined. Be conservative: keep the pipeline in a non-inlinable function so subclass dispatch stays dynamic.

Do not use \`open\` on a \`final\` class; it will not compile. Do not use \`public\` on a type you meant to subclass across SPM packages — SPM modules are real module boundaries, same as frameworks.`,
      alternatives: `Composition instead of subclassing: \`AcmeScreen\` takes a \`HeroRendering\` protocol (or a SwiftUI \`hero\` view builder) at init. Apps inject behaviour without entering your vtable. That is usually the better 2.0. You can keep the class \`public\` (or even \`final\`) and still let campaigns swap the hero.

If you are already in a subclass world, a dedicated \`open\` subclass hook type (\`AcmeScreenHooks\`) with three methods is easier to document than opening twelve methods over three releases.

For SwiftUI-first clients, do not expose a UIViewController to subclass at all. Expose configuration and a representable.`,
      tradeoffs: `Subclassing across modules is powerful and cheap to demo. It is expensive to support: call order becomes API, super becomes ritual, and you cannot rename a hook without a migration. Protocols and injected views are more lines in 2.0 and fewer angry slack threads in 2.4.

\`open\` is correct for a small number of documented hooks on a screen you truly intend as a template. \`public\` is correct for things clients call but must not replace. \`internal\` is correct for the rest, even on an open class. The campaign team's compile error is Swift asking you to make that distinction on purpose.`,
      followups: [
        {
          q: 'Why can they override viewDidAppear but not configureHero?',
          a: 'viewDidAppear is open on UIViewController in UIKit. configureHero is public in your module, so it is not overridable from the app.',
        },
        {
          q: 'Is public class subclassable from another module?',
          a: 'No. You can see it, you can use it, you cannot subclass it. open class is the subclassable one.',
        },
        {
          q: 'How do you test open hooks honestly?',
          a: 'From a test target that is not the defining module, so access control matches clients.',
        },
        {
          q: 'Should reload be open?',
          a: 'Only if replacing the whole pipeline is supported. Otherwise keep it public or final and open the small hooks it calls.',
        },
        {
          q: 'Does this apply to protocol requirements?',
          a: 'Protocols use public/open differently: a public protocol can be conformed to from another module. The open-versus-public distinction is a class inheritance story.',
        },
      ],
      teaches: [
        'open vs public across modules',
        'Overridable hooks as supported API',
        'Testing from a client module',
        'Composition as an alternative to subclassing',
      ],
    },
    {
      id: 'd1-p10',
      title: 'A property wrapper that owns an escaping closure',
      difficulty: 'Expert',
      kind: 'Architecture',
      prompt: `A teammate builds a tiny \`@Observed\` wrapper "like \`@Published\` but lighter" and a clamp wrapper for volume. Both leak or surprise. Review the ownership.

\`\`\`swift
@propertyWrapper
final class Observed<Value> {
    var wrappedValue: Value {
        didSet { handler?(wrappedValue) }
    }
    var handler: ((Value) -> Void)?
    init(wrappedValue: Value) { self.wrappedValue = wrappedValue }
}

@propertyWrapper
struct Clamped<Value: Comparable> {
    private var value: Value
    private let range: ClosedRange<Value>
    var onChange: ((Value) -> Void)?
    var wrappedValue: Value {
        get { value }
        set {
            value = min(max(newValue, range.lowerBound), range.upperBound)
            onChange?(newValue)
        }
    }
    init(wrappedValue: Value, _ range: ClosedRange<Value>) {
        self.range = range
        self.value = min(max(wrappedValue, range.lowerBound), range.upperBound)
    }
}

final class MixerVM {
    @Observed var name = "mix"
    @Clamped(0...100) var volume = 50

    init() {
        _name.handler = { new in
            self.analytics.track(new)
        }
        _volume.onChange = { new in
            self.engine.setVolume(new)
        }
    }
}
\`\`\`

What cycles exist, what does mutating a struct wrapper inside a class do, and how would you design a wrapper that is safe to store on a view model?`,
      think: [
        'Is Observed a class stored on MixerVM, and does the handler capture MixerVM?',
        'Where is the Clamped struct stored, and what happens when you assign onChange?',
        'If onChange fires with newValue before clamping, is that a second bug?',
      ],
      solution: `\`@Observed\` is a **class** stored in \`_name\`. \`MixerVM\` retains it. The handler strongly captures \`self\`. Cycle: VM → wrapper → handler → VM. Same graph as the Combine sink, hidden in a wrapper.

\`@Clamped\` is a **struct**. \`_volume\` lives inline in the class. Assigning \`_volume.onChange = { self... }\` can work if you mutate the wrapper in place, but it is fragile: any copy of the wrapper copies the closure; the closure still strongly captures \`self\`; and the setter calls \`onChange?(newValue)\` **before** clamping, so the engine can see 150 when the stored value is 100.

A safer wrapper does not store a closure on itself, or it stores a weak box:

\`\`\`swift
final class WeakBox<T: AnyObject> {
    weak var value: T?
    init(_ value: T) { self.value = value }
}

@propertyWrapper
struct Clamped<Value: Comparable> {
    private var value: Value
    private let range: ClosedRange<Value>
    var wrappedValue: Value {
        get { value }
        set { value = min(max(newValue, range.lowerBound), range.upperBound) }
    }
    var projectedValue: Value { wrappedValue }
    init(wrappedValue: Value, _ range: ClosedRange<Value>) { /* clamp in init */ }
}
\`\`\`

Observation belongs outside: the view model uses Combine / Observation / an explicit \`didSet\` on a private property. If you insist on a handler, take \`[weak self]\` at the assignment site and fire \`onChange?(clamped)\` **after** the clamp. Do not invent \`@Published\` unless you are prepared to own the subscription graph.`,
      explanation: `You reached for a property wrapper because the syntax is nice: \`@Clamped(0...100) var volume\`. The leak does not care about the syntax. \`@Observed\` is a class sitting in a hidden stored property \`_name\`. You hung a closure on that class that talks to \`self\`. The view model owns the wrapper, the wrapper owns a closure, the closure owns the view model. We have been drawing this triangle all day. Putting it inside \`@propertyWrapper\` just hides \`_name\` from the first glance at Instruments.

\`Clamped\` is a different kind of sharp edge. It is a struct, so there is no extra heap object by default. Mutating \`volume\` mutates the wrapper in place on the class, which is what you want for the number. Then someone stores \`onChange\` on the wrapper. That closure is now part of the struct's value. Copy the struct, copy the closure. Assign the wrapper, think about COW — there is none here unless you add it. The class holds one copy, the handler captures the class strongly, and you can still cycle if anything about that assignment boxes or re-stores the wrapper in a way that lasts. Even without a cycle, \`onChange?(newValue)\` uses the incoming number, not the clamped one. The engine hears 150, the UI shows 100, and you will debug that as a mixer bug for an afternoon.

Property wrappers are stored properties with makeup on. They can hold resources, they can be classes, they can capture \`self\` if you hand them a closure in \`init\` of the enclosing type. The enclosing \`init\` has \`self\` and looks like the right place to wire observation. That is exactly when you should reach for \`[weak self]\`, or refuse to let the wrapper own a callback at all.

The design you actually want for clamping is a wrapper that only clamps. Side effects live in \`didSet\` on the view model, or in a pipeline the view model already knows how to cancel. Rebuilding \`@Published\` is a product; treat it like one.`,
      internals: `A property wrapper desugars to a stored \`_property\` of the wrapper type. \`wrappedValue\` is the sugar. \`projectedValue\` is the \`$property\` sugar. If the wrapper is a class, the enclosing type holds a reference. If it is a struct, the enclosing type holds the struct inline (or in the class's heap layout).

\`Observed\` as a class means identity: everyone who has the wrapper object sees the same \`wrappedValue\`. The \`handler\` is stored on that object. A strong handler to the enclosing class is a cycle through a hidden property. Weakening the handler is the same fix as Combine, with worse tooling, because you wrote the bag yourself.

\`Clamped\` as a struct means mutation of \`wrappedValue\` is a mutating setter on a property of the class. Swift will call that in place. The bug in the setter — notifying with \`newValue\` instead of \`value\` after clamp — is ordinary, not ownership, and it will fail any test that assigns 150 and spies on \`onChange\`.

If the wrapper's \`init()\` captured the enclosing \`self\`, you would also be back in two-phase init: wrappers initialise before the enclosing \`init\` body, and they must not run escaping callbacks into a half-built owner. \`@Published\` avoids this by not calling out until someone subscribes later.`,
      testing: `Deinit the view model with a flag. With the class wrapper and strong handler, deinit never runs. After \`[weak self]\` (or removing the handler), it does.

Assign \`volume = 150\`. Assert stored wrapped value is 100, and assert the engine received 100, not 150. That test fails on the current setter.

Copy a \`Clamped\` into a local, set \`onChange\` on the copy, assign the copy back — or do not, if you remove \`onChange\` from the wrapper. If you keep it, tests should show you understand whether the closure lives on the copy or the original.

Memory Graph: look for \`Observed<String>\` holding a closure holding \`MixerVM\`. The wrapper's type will show up under the underscored storage name.`,
      pitfalls: `A class wrapper that is not a reference you wanted: every assignment of \`wrappedValue\` goes through \`didSet\` and fires the handler. A mass update can re-enter the view model, mutate again, and stack-overflow. \`@Published\` has the same re-entrancy flavour if you set properties from a sink without care.

Putting \`weak\` inside the wrapper as \`weak var owner: MixerVM?\` couples the wrapper to a concrete owner type and fights generic reuse. Prefer the assignment site to capture weakly.

\`@Clamped\` on a struct view model copies the wrapper when the outer struct copies. On a SwiftUI \`View\` that is a struct, that can mean onChange is sitting on a throwaway copy. Wrappers with side effects do not belong on view structs.

Firing \`onChange\` from \`init\` of the wrapper will hit the enclosing object during its init. Do not.`,
      alternatives: `A plain private \`var volume: Int { didSet { engine.setVolume(clamped) } }\` with a clamp function is twenty years old and leaks nothing. The wrapper is justified when you have many properties and want a single clamp policy in the type system.

\`@Published\` plus a pipeline with \`[weak self]\` is the wrapper you already have in the SDK, with years of edge cases handled. "Lighter than Published" usually means "missing the edge cases."

Projected value \`$volume\` as a publisher (not a stored closure) lets callers subscribe with their own lifetime. The wrapper holds no handler; the subscriber does. That is the \`@Published\` shape, and it is the one that composes.`,
      tradeoffs: `Property wrappers are a user-facing API. If they store escaping work, they inherit every ownership rule from this day: weak for outliving callbacks, no unowned across async, no strong self into stored closures, no side effects during enclosing init. You can design that once, in a shared wrapper, and get it right for the whole app. You can also in-line clamp and \`didSet\` and never hide a class behind an \`@\`.

Class wrappers give identity and shared mutation; they are reference cycles waiting for a handler. Struct wrappers give value semantics; they copy closures if you store them, and they surprise SwiftUI views that are themselves values. The conservative architecture is: wrappers transform values, they do not observe. Observation is a separate object with an explicit lifetime.`,
      followups: [
        {
          q: 'Where is @Observed stored on MixerVM?',
          a: 'In the hidden _name property, as a reference to the Observed class instance.',
        },
        {
          q: 'Why did the engine see 150?',
          a: 'onChange was called with newValue before the clamp was applied. Notify after writing the clamped value.',
        },
        {
          q: 'Can a struct wrapper still keep MixerVM alive?',
          a: 'Yes, if it stores a closure that strongly captures self. The wrapper does not need to be a class to participate in a cycle.',
        },
        {
          q: 'How does @Published avoid this if it also sits on self?',
          a: 'The danger is not the wrapper existing; it is a subscriber closure stored on self that captures self strongly. assign(to: &$property) is designed to avoid that. sink is not.',
        },
        {
          q: 'Should Clamped fire onChange during init?',
          a: 'No. The enclosing object may still be initialising. Clamp silently in init; notify only on later sets.',
        },
      ],
      teaches: [
        'Property wrappers are stored properties',
        'Class wrappers and handler cycles',
        'Struct wrappers copying closures',
        'Side effects vs value transforms',
        'weak at the assignment site',
      ],
    },
    {
      id: 'd1-p11',
      title: 'Hashable synthesis plus a UUID nonce empties the cache',
      difficulty: 'Expert',
      kind: 'Incident',
      prompt: `Image decode is on a hot path. After a "make keys unique for ForEach" change, the memory cache never hits. The same URL at the same size is decoded every time, and the dictionary grows without bound.

\`\`\`swift
struct ImageRequest: Hashable {
    var url: URL
    var pixelWidth: Int
    var pixelHeight: Int
    /// ForEach identity, and "avoids hash collisions."
    let nonce = UUID()
}

actor ImageCache {
    private var map: [ImageRequest: UIImage] = [:]

    func image(for url: URL, size: CGSize) async -> UIImage {
        let key = ImageRequest(url: url, pixelWidth: Int(size.width), pixelHeight: Int(size.height))
        if let hit = map[key] { return hit }
        let image = await decode(url, size)
        map[key] = image
        return image
    }
}
\`\`\`

A follow-up patch customises \`==\` to ignore \`nonce\` and leaves \`Hashable\` synthesized. What breaks in the first version, what breaks in the second, and how should identity and lookup be modelled?`,
      think: [
        'Which stored properties does synthesized Equatable/Hashable actually include?',
        'If two ImageRequest values mean the same download, can cache[key] ever hit after a fresh init?',
        'If == ignores nonce but hash(into:) still mixes it in, what does Dictionary assume?',
      ],
      solution: `Synthesized \`==\` and \`hash(into:)\` walk **every stored property**, including \`nonce\`. Each \`ImageRequest(...)\` mints a new UUID, so the key you store is never the key you look up. The map is a log of one-shot identities, not a cache.

Do not put ForEach identity on a dictionary key. Split the types. If you must keep a nonce on the same struct, \`==\` and \`hash(into:)\` have to ignore the same fields — synthesis will not do that for you:

\`\`\`swift
struct ImageRequest: Hashable {
    var url: URL
    var pixelWidth: Int
    var pixelHeight: Int
}

struct ImageRow: Identifiable, Hashable {
    let id: UUID
    let request: ImageRequest
}

actor ImageCache {
    private var map: [ImageRequest: UIImage] = [:]

    func image(for request: ImageRequest) async -> UIImage {
        if let hit = map[request] { return hit }
        let image = await decode(request)
        map[request] = image
        return image
    }
}
\`\`\`

The follow-up \`==\` that ignores \`nonce\` while \`hash(into:)\` stays synthesized is an invariant violation: \`a == b\` can be true with \`hash(a) != hash(b)\`. \`Set\` / \`Dictionary\` may miss a key equality says is present, or store two "equal" entries. Customise both, or synthesise both.`,
      explanation: `You added a UUID nonce to \`ImageRequest\` so \`ForEach\` would stop complaining about duplicate identities, and so a teammate would stop worrying about hash collisions. The image cache then missed on every call. Charles showed the same URL coming back from disk. Allocations showed decode after decode. The dictionary was healthy. Every lookup constructed a new \`ImageRequest\`, synthesis included \`nonce\`, and you were asking the map for a key that had never been inserted.

Hashable and Equatable synthesis is not a convenience that "makes the type work in a Set." It is a generated pair of functions that walk every stored property: \`url\`, \`pixelWidth\`, \`pixelHeight\`, \`nonce\`. Two requests that mean the same download are not equal. Their hashes differ. Set union never coalesces them. The cache grows one entry per call. That is identity pretending to be a value. A dictionary key is a value: same meaning, same bytes in \`hash(into:)\`, same \`==\`. A \`ForEach\` identity is an identity: a stable id for a row. Those are opposite jobs. One UUID field cannot do both.

The second incident is the "fix." Someone writes a custom \`==\` that ignores \`nonce\` and leaves Hashable synthesized. Swift will still hash all stored properties, including the UUID. Now \`a == b\` can be true while the hashes differ. Set and Dictionary assume the invariant. You will fail to find a key that equality says is present, or you will store two "equal" keys in a Set. The language will not save you at runtime. The rule is mechanical: if you exclude a property from \`==\`, exclude it from \`hash(into:)\`, and if the property is only there for UI identity, it does not belong on a cache key type at all.

Split the types. \`ImageRequest\` is url plus size, fully synthesized, used as the dictionary key. \`RowID\` is a UUID on the model the list displays. Do not sprinkle nonce on a value you intend to look up twice.`,
      internals: `The compiler's Hashable synthesis is a \`hash(into:)\` that \`combine\`s each stored property in declaration order, plus an \`==\` that compares them all. There is no "primary key" inference. \`let nonce = UUID()\` is a stored property with a default; it participates. A computed \`var id: UUID { nonce }\` would not, which is why moving identity to \`Identifiable\` on a *different* type is the clean split.

\`Dictionary\` finds a bucket with the hash, then uses \`==\` among keys in that bucket. If hashes differ, equal keys never meet. If hashes collide and \`==\` is true, you get one entry — the honest cache. If hashes differ and \`==\` is true, you have lied to the hash table. Misses and duplicates are both legal outcomes of that lie; do not write a test that only covers one of them and call the type Hashable.

\`UUID()\` in a default stored property runs at initialisation, not at first use of the key in a Set. \`ForEach\` wants a stable \`id\` across body invocations. A nonce minted in the cache lookup is a new identity every call, which is also a SwiftUI identity bug if you used this type as \`Identifiable\`. Two incidents, one field.

\`CGSize\` / \`URL\` / \`Int\` are fine Hashable components. The nonce is the only property that should not be there.`,
      testing: `Construct two \`ImageRequest\` values with the same url and size, no shared storage. Assert they compare equal and that a \`Hasher\` over both produces the same finalize — that fails on the original type. Insert under the first, look up with the second, assert a hit — that fails on the original type.

After a custom \`==\` that ignores nonce, generate many pairs that are \`==\` and assert matching hashes. A loop of a few thousand random nonces will catch the invariant break that a single pair might luckily pass if you only asserted \`Set\` count.

Growth: call \`image(for:size:)\` 100 times with the same arguments. Assert \`map\` count is 1, not 100. That is the production incident in a unit test.

Do not test Hashable by printing \`hashValue\` once in a playground. Hashers seed per-process; compare two values with the same \`Hasher\` recipe, or compare dictionary behaviour.`,
      pitfalls: `Implementing \`==\` and forgetting \`hash(into:)\` is the second-incident shape. Implementing \`hash(into:)\` on a subset and leaving \`==\` synthesized is the mirror image: unequal keys can share a hash, which is allowed, but then you also need \`==\` to distinguish them — usually you just forgot to exclude the same field from both.

Using this struct as a \`Set\` element *and* as \`ForEach\` \`id:\` pushes you to keep the nonce. That is how the cache and the list fight. Two types.

Mutating a property that participates in the hash after the value is inside a Set/Dictionary is undefined for collections: the value sits in the wrong bucket. With a nonce you never mutate, the more common bug is constructing a fresh value.

\`@unchecked Hashable\` or a constant \`hash(into:)\` that combines nothing "to make collisions impossible" is nonsense. Collisions are fine. Broken \`==\`/hash pairs are not.

Defaulted \`let nonce = UUID()\` also breaks \`ImageRequest(url:width:height:)\` memberwise equality in tests: you cannot construct two equal keys without a custom init that takes a shared nonce, which you should not need if nonce is not part of the key.`,
      alternatives: `A string cache key you format yourself (\`url.absoluteString + "\\(w)x\\(h)"\`) works and is how a lot of image pipelines started. It is easy to forget a field. A synthesized Hashable struct without extra stored identity is the typed version of that string.

NSCache with the URL as key and size as a variant in a small wrapper, plus a cost based on byte size, if you want eviction under memory pressure. Dictionary will not evict for you.

If ForEach really has duplicate \`ImageRequest\` rows (two cells, same URL and size), give the *row* a model id from the backend, not a random UUID at lookup time. Random UUIDs make identity worse: every redraw is a new row.`,
      tradeoffs: `One type that is both a cache key and a list identity is fewer files and a guaranteed production incident. Two types is a few extra lines and a cache that hits. That is the trade.

Custom \`==\` / \`hash(into:)\` on a four-field struct is how you keep a nonce "for debugging" on the key. You will forget a field when you add \`scale\` or \`darkMode\`. Synthesis on a type that only contains lookup fields cannot forget a field. Prefer synthesis. Put the UUID next door.

Hash collisions are not a reason to add entropy. SHA-ish fear is leftover from other domains. Swift's \`Hasher\` is for in-process tables. Extra UUID entropy only destroys lookup.`,
      followups: [
        {
          q: 'Does synthesized Hashable skip properties with default values?',
          a: 'No. Every stored property is included, defaults and all. nonce is stored, so it is hashed and compared.',
        },
        {
          q: 'If I write == myself, do I still get hash(into:) for free?',
          a: 'You can still get synthesis of hash(into:) over all stored properties, which is exactly how you break the ==/hash invariant if your == is narrower.',
        },
        {
          q: 'Why did ForEach want a UUID in the first place?',
          a: 'It wants a stable identity per row. That is Identifiable on the row model, not entropy on the cache key you construct inside a lookup.',
        },
        {
          q: 'Can two different URLs legally share a hash?',
          a: 'Yes. Collisions are expected. Equality then distinguishes them. You do not add UUID to "avoid collisions."',
        },
        {
          q: 'What happens if I mutate pixelWidth after inserting into the dictionary?',
          a: 'The key sits in the wrong bucket. Do not mutate hashed properties of a value that is already in a Set or Dictionary. Use a fresh key.',
        },
      ],
      teaches: [
        'Hashable synthesis includes every stored property',
        'UUID nonce destroys dictionary lookup',
        '== and hash(into:) must agree',
        'Split Identifiable identity from cache keys',
        'Collisions are not a reason for entropy',
      ],
    },
    {
      id: 'd1-p12',
      title: 'weak struct delegate, unowned nested Heart, Timer crash',
      difficulty: 'Expert',
      kind: 'Debug',
      prompt: `After a retain-cycle fix, \`PulseViewController\` deinits on pop. A second later Crashlytics traps inside a nested \`Heart\` timer. The original review also tried \`weak var delegate\` and the compiler refused.

\`\`\`swift
protocol PulseDelegate {
    mutating func pulseFired()
}

struct AnalyticsPulse: PulseDelegate {
    var count = 0
    mutating func pulseFired() {
        count += 1
        Analytics.log(count)
    }
}

final class PulseViewController: UIViewController {
    // weak var delegate: PulseDelegate?
    // error: 'weak' may only be applied to class and class-bound protocol types
    var delegate: PulseDelegate? = AnalyticsPulse()

    final class Heart {
        unowned let owner: PulseViewController
        var timer: Timer?

        init(owner: PulseViewController) { self.owner = owner }

        func start() {
            timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [unowned self] _ in
                self.owner.delegate?.pulseFired()
                self.owner.view.backgroundColor = .systemPink
            }
        }
    }

    lazy var heart = Heart(owner: self)

    override func viewDidLoad() {
        super.viewDidLoad()
        heart.start()
    }
}
\`\`\`

Why can the struct not be \`weak\`? What actually owns \`Heart\` after pop? When is \`unowned\` legal on a nested class, and what is the fix?`,
      think: [
        'What does weak require of a type, and does a struct or a non-class-bound protocol have that?',
        'Who retains a repeating Timer, and does that keep Heart or only the closure?',
        'If Heart is only named nested, does that tie its lifetime to PulseViewController?',
      ],
      solution: `\`weak\` is a zeroing optional to a **class instance**. \`AnalyticsPulse\` is a struct. \`PulseDelegate\` is not \`AnyObject\`-constrained. There is no object for the runtime to zero. Make the delegate a class-bound protocol, or do not use a delegate.

Nested \`Heart\` is just a class. \`unowned let owner\` promises Heart dies first. \`Timer.scheduledTimer\` retains the timer on the run loop, the timer retains the block, the block holds an unowned Heart. On pop, the VC drops Heart, Heart deinits, the timer still fires, \`[unowned self]\` is a dangling pointer.

\`\`\`swift
protocol PulseDelegate: AnyObject {
    func pulseFired()
}

final class AnalyticsPulse: PulseDelegate {
    private var count = 0
    func pulseFired() {
        count += 1
        Analytics.log(count)
    }
}

final class PulseViewController: UIViewController {
    weak var delegate: PulseDelegate?

    final class Heart {
        weak var owner: PulseViewController?
        private var timer: Timer?

        func start() {
            timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
                guard let owner = self?.owner else {
                    self?.stop()
                    return
                }
                owner.delegate?.pulseFired()
                owner.view.backgroundColor = .systemPink
            }
        }

        func stop() {
            timer?.invalidate()
            timer = nil
        }
    }

    private let heart = Heart()

    override func viewDidLoad() {
        super.viewDidLoad()
        heart.owner = self
        heart.start()
    }

    deinit { heart.stop() }
}
\`\`\`

\`unowned\` on Heart→owner is only honest if Heart cannot escape: no Timer, no URLSession, no NotificationCenter. A nested name does not give you that.`,
      explanation: `You popped \`PulseViewController\` and Crashlytics started trapping in Heart's timer callback. The leak ticket was closed last week when someone replaced a strong owner with \`unowned\`. The timer ticket is this week. Same object graph, opposite symptom.

\`weak\` is a zeroing optional to a class instance. The runtime can only zero a side table for a reference type. \`AnalyticsPulse\` is a struct. \`PulseDelegate\` is not \`AnyObject\`-constrained. \`weak var delegate: PulseDelegate?\` is a compile error because there is no object to weakly hold. Storing the struct strongly in an existential copies a value. There is no cycle through a struct delegate, and also no shared identity: a mutating \`pulseFired()\` on a protocol existential is easy to get wrong, and you still cannot limp-weak it. You cannot "try to be weak" as a struct. You become a class-bound protocol, or you stop being a delegate and become a function the owner calls.

The nested class did not create a scope. Heart is a heap object with a fancy name. \`unowned let owner\` promises Heart will not outlive the view controller. \`Timer.scheduledTimer\` registers with the run loop. The run loop retains the Timer. The Timer retains the block. The block captures \`unowned\` Heart. The view controller strongly owns Heart. On pop, the VC drops Heart, Heart deinits, the Timer is still on the run loop, the next second the block loads a dangling Heart, and \`unowned\` traps. Nested does not mean "child lifetime." Repeating timers outlive whoever scheduled them unless you invalidate.

\`unowned\` was the wrong tool for a callback the run loop owns. \`weak\` Heart in the timer, \`invalidate\` in \`deinit\`, and a class-bound \`weak var delegate\` are three separate fixes people try to get from one keyword.`,
      internals: `Swift \`weak\` storage is optional and participates in ARC's side table. When the last strong ref dies, weak loads become nil. Structs have no ARC identity. Existentials of a non-class-bound protocol may hold a struct in the value buffer or on the heap; either way there is nothing to zero, so the attribute is rejected.

\`unowned\` stores a non-optional reference and does not +1. Native Swift objects still have debug traps on use-after-free; hopping through a Timer into UIKit often shows up as \`EXC_BAD_ACCESS\` in production. \`unowned(unsafe)\` drops even the debug trap.

A nested \`final class Heart\` is compiled as an independent class (with a mangled name). It does not capture \`self\` of the outer type unless you write it. \`lazy var heart = Heart(owner: self)\` is an ordinary strong property. The nesting only affects access control and naming.

Repeating \`Timer\` is retained by \`RunLoop.main\` (for a main-thread scheduled timer) until \`invalidate()\`. Storing \`timer\` on Heart does not create a cycle if the block uses \`[unowned self]\` or \`[weak self]\`; the run loop is the extra owner you forgot. Invalidating in \`Heart.deinit\` only helps if Heart actually deinits before the next fire. If the block captured Heart strongly, you get a cycle instead of a crash: VC → Heart → timer → block → Heart, and the view controller never deinits. Switching that capture to \`unowned\` is how the leak ticket became a crash ticket.`,
      testing: `Force the order: load the VC, call \`viewDidLoad\`, release the VC, then fire the timer (a fake clock / a test Timer subclass that you invoke). With \`unowned\` Heart, this should be a trap — do not ship a test that crashes; rewrite to \`weak\` and assert the callback is a no-op and that \`deinit\` of the VC already ran.

Assert the Timer is invalidated: after pop, a spy run loop should not still hold it. That is the leak you get if you only switch to \`weak\` and never \`invalidate\`.

Delegate: a struct \`AnalyticsPulse\` stored in \`var delegate: PulseDelegate?\` — mutate \`count\` via \`pulseFired()\` and assert whether \`count\` actually persisted. Then switch to a class-bound weak delegate, release the analytics object, fire the timer, assert no crash and no log.

Memory Graph before the unowned change: look for VC → Heart → Timer → Heart. After unowned: zero VCs, still a Timer, then a crash on fire.`,
      pitfalls: `\`weak var delegate: any PulseDelegate?\` is still illegal unless the protocol is class-bound. \`any\` does not add identity.

Making \`AnalyticsPulse\` a struct and capturing it in the timer closure \`[delegate]\` copies the struct once; \`count\` on the property and \`count\` in the closure diverge. That looks like "delegate is not firing" and is a value-semantics bug next to the crash.

\`[unowned self]\` on the timer because "Heart is nested so it cannot outlive the VC" is the comment that ships this. Nesting is not ownership.

Invalidating the timer in \`viewDidDisappear\` but not in \`deinit\` misses teardown paths that skip disappear. Invalidate in both, or only in a \`stop()\` that both call.

\`unowned\` from Heart to owner *is* reasonable for a purely owned helper that never escapes — a nested decoder object you never hand to Timer. Draw the line at "does this pointer get stored in the run loop, a session, or a center."`,
      alternatives: `No Heart class. The view controller owns the Timer, uses \`[weak self]\` in the block, invalidates in \`deinit\`. Fewer objects, fewer unowned promises.

A Combine \`Timer.publish\` stored in a bag on the VC, with \`[weak self]\`. Lifetime is the bag.

A function \`var onPulse: (() -> Void)?\` on a small owner, assigned with \`[weak self]\` from the VC. That is a delegate without a protocol. Still a class-shaped callback.

Do not use \`unowned\` to silence a compiler error about a struct. The compiler error is the design review.`,
      tradeoffs: `Class-bound \`weak\` delegates are the UIKit house style: extra heap object, shared identity, zeroing on death. Struct "delegates" are values: cheap, copied, impossible to weaken. Pick one. Mixing them is how you get a compile error and then a strong existential you never meant to keep.

\`unowned\` is a performance and ergonomics choice (no optional) for relationships the type system cannot express, like a child object whose only strong owner is \`self\` and whose closures do not escape. The moment a Timer, a URLSession, or an unstructured Task holds that child, the promise is false and the crash is delayed by one callback. Weak plus invalidate is slower to type and is the one that survives pop.`,
      followups: [
        {
          q: 'Why did weak var delegate: PulseDelegate fail to compile?',
          a: 'PulseDelegate is not class-bound, and AnalyticsPulse is a struct. weak needs a class instance to zero.',
        },
        {
          q: 'Does nesting Heart inside the VC keep Heart alive only while the VC is alive?',
          a: 'No. Nesting is naming. Anyone who retains Heart — the run loop via Timer — can outlive the VC.',
        },
        {
          q: 'If the timer block uses [weak self] on Heart but Heart still has unowned owner, is that safe?',
          a: 'Only if Heart cannot outlive the VC. A run-loop-retained Heart whose owner already deinited will crash on owner when the weak Heart is still non-nil. Invalidate, and make owner weak too.',
        },
        {
          q: 'When is unowned let owner on a nested class legitimate?',
          a: 'When the nested instance cannot escape: no stored closures in timers, sessions, or centers. The outer object is the unique strong owner, and the inner dies in the outer deinit before any callback.',
        },
        {
          q: 'Can I weak a struct by wrapping it in a class box?',
          a: 'You can weak the box. The struct inside is still a value. You have invented a class delegate with extra steps. Prefer a class-bound protocol.',
        },
      ],
      teaches: [
        'weak requires class or AnyObject protocols',
        'Structs cannot be weak delegates',
        'Nested class is not a lifetime scope',
        'RunLoop retains repeating Timers',
        'unowned crashes when the callback outlives the object',
      ],
    },
  ],
}
