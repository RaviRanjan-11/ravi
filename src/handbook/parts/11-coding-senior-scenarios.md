# PART XI — Coding

iOS interviews still include DSA, usually in Swift. Write clean Swift, talk complexity, handle empty inputs, and mention integer overflow when it is relevant.

The communication is the round as much as the code. Restate the problem. Give an example. Sketch brute force so they know you can solve it. Optimise. Code. Then walk edge cases — empty, one element, duplicates, negatives — out loud, not as a comment you hope they will not ask.

## Swift Coding Problems

The problems below are the ones that actually show up. I would practise them out loud, with a timer, until the first sentence is automatic.

---

## Arrays and hashing

### Two Sum

Given an array of integers and a target, return the indices of two numbers that add up to the target. I would ask whether there is always a pair, whether I may use the same element twice, and whether the array is sorted — because sorted would change the answer.

```swift
func twoSum(_ nums: [Int], _ target: Int) -> [Int] {
    var seen: [Int: Int] = [:]
    for (i, n) in nums.enumerated() {
        if let j = seen[target - n] {
            return [j, i]
        }
        seen[n] = i
    }
    return []
}
```

How I’d talk this. “Brute force is a nested loop, O(n²). I will walk once and remember what I have seen. For each number I ask whether `target - n` is already in the dictionary. If it is, those two indices are the answer. If not, I record this number’s index. That is O(n) time and O(n) space. Nested loops are fine for tiny n; I would not lead with them.” Follow-up they love: three sum, or two pointers if I am allowed to sort — sorting loses the original indices unless I keep them.

### Contains duplicate

True if any value appears twice. Hash set, walk once, return on the first failed insert.

```swift
func containsDuplicate(_ nums: [Int]) -> Bool {
    var seen = Set<Int>()
    for n in nums {
        if !seen.insert(n).inserted { return true }
    }
    return false
}
```

How I’d talk this. “I could sort and compare neighbours — O(n log n), no extra average space if we sort in place. The set is O(n) time and O(n) space, and it fails fast. `insert` returns `(inserted: Bool, …)` so I do not look up twice.” Empty array: false. One element: false.

### Product of array except self

For each index, the product of every other element. They often add: no division, O(n) time.

```swift
func productExceptSelf(_ nums: [Int]) -> [Int] {
    let n = nums.count
    var out = Array(repeating: 1, count: n)
    var left = 1
    for i in 0..<n {
        out[i] = left
        left *= nums[i]
    }
    var right = 1
    for i in stride(from: n - 1, through: 0, by: -1) {
        out[i] *= right
        right *= nums[i]
    }
    return out
}
```

How I’d talk this. “If I may divide, product of all over `nums[i]` — zeros break that, so I would special-case zeros anyway. Without division I prefix from the left, then multiply a right suffix on the way back. Extra memory besides the output is O(1). I will mention zeros out loud so they know I saw them.”

### Maximum subarray (Kadane)

Largest sum of a contiguous subarray. The array can hold negatives.

```swift
func maxSubArray(_ nums: [Int]) -> Int {
    var best = nums[0]
    var cur = nums[0]
    for n in nums.dropFirst() {
        cur = max(n, cur + n)
        best = max(best, cur)
    }
    return best
}
```

How I’d talk this. “At each index I decide whether to extend the streak or start again at this element. That is Kadane. O(n) time, O(1) space. Empty is undefined here so I start from `nums[0]` — I would confirm the array is non-empty. Divide and conquer is the follow-up if they want O(n log n) on purpose.”

---

## Two pointers / sliding window

### Valid palindrome (alphanumeric)

Ignore case and ignore anything that is not a letter or a number. Two pointers from the ends.

```swift
func isPalindrome(_ s: String) -> Bool {
    let chars = Array(s.lowercased().filter { $0.isLetter || $0.isNumber })
    var i = 0, j = chars.count - 1
    while i < j {
        if chars[i] != chars[j] { return false }
        i += 1; j -= 1
    }
    return true
}
```

How I’d talk this. “I would rather skip in place than allocate a filtered array, but allocating is easier to get right on a whiteboard and fine at interview n. Empty string is a palindrome. I will mention that Swift `Character` is not a UTF-16 code unit, in case they poke Unicode.”

### Reverse string in place

The input is a mutable array of characters. Swap from both ends until the pointers meet.

```swift
func reverse(_ s: inout [Character]) {
    var i = 0, j = s.count - 1
    while i < j {
        s.swapAt(i, j)
        i += 1; j -= 1
    }
}
```

How I’d talk this. “O(1) extra space is the point. I will not reverse via `String` concatenation. Odd length: the middle character stays.”

### Longest substring without repeating characters

Length of the longest substring with all unique characters. Sliding window, last-seen index.

```swift
func lengthOfLongestSubstring(_ s: String) -> Int {
    var last = [Character: Int]()
    var start = 0
    var best = 0
    for (i, ch) in Array(s).enumerated() {
        if let p = last[ch], p >= start {
            start = p + 1
        }
        last[ch] = i
        best = max(best, i - start + 1)
    }
    return best
}
```

How I’d talk this. “The window is `[start, i]`. When I see a character already in the window, I move `start` past its last index. O(n) time. `Array(s)` is honest on a whiteboard; I would mention Character versus Unicode scalar if they care about grapheme clusters. All unique: n. All the same: 1.”

### Container with most water

Heights of vertical lines. Pick two lines that trap the most water with the x-axis.

```swift
func maxArea(_ h: [Int]) -> Int {
    var i = 0, j = h.count - 1, best = 0
    while i < j {
        best = max(best, min(h[i], h[j]) * (j - i))
        if h[i] < h[j] { i += 1 } else { j -= 1 }
    }
    return best
}
```

How I’d talk this. “Width is largest at the ends, so I start there. Area is min height times width. I move the shorter pointer, because moving the taller one cannot increase the min. O(n). Brute force every pair is O(n²) and I would say that first so they see I can solve it.”

---

## Stack / queue

### Valid parentheses

`()`, `[]`, `{}` — nested, mixed, must close in order.

```swift
func isValid(_ s: String) -> Bool {
    var stack: [Character] = []
    let pair: [Character: Character] = [")": "(", "]": "[", "}": "{"]
    for ch in s {
        if let open = pair[ch] {
            guard stack.popLast() == open else { return false }
        } else {
            stack.append(ch)
        }
    }
    return stack.isEmpty
}
```

How I’d talk this. “Opens go on a stack. A close must match the most recent open. Leftover opens at the end are invalid. `popLast` on empty is nil, so a close with an empty stack fails. This is the problem I would use to show I know a stack is just an array with append and pop.”

### Min stack

Push, pop, top, and get-minimum, all O(1).

```swift
final class MinStack {
    private var values: [Int] = []
    private var mins: [Int] = []

    func push(_ val: Int) {
        values.append(val)
        mins.append(min(val, mins.last ?? val))
    }
    func pop() {
        _ = values.popLast()
        _ = mins.popLast()
    }
    func top() -> Int { values.last! }
    func getMin() -> Int { mins.last! }
}
```

How I’d talk this. “One stack is not enough for O(1) min after pops. I keep a parallel stack of the min so far. Each push stores `min(val, currentMin)`. Space is O(n). I force-unwrap `top` and `getMin` the way LeetCode does; in production I would make them optional or trap on empty.”

### Implement queue with stacks

Enqueue and dequeue using only stacks. Amortised O(1) dequeue.

```swift
struct Queue<T> {
    private var inStack: [T] = []
    private var outStack: [T] = []

    mutating func enqueue(_ x: T) { inStack.append(x) }

    mutating func dequeue() -> T? {
        if outStack.isEmpty {
            while let x = inStack.popLast() { outStack.append(x) }
        }
        return outStack.popLast()
    }
}
```

How I’d talk this. “Inbound stack receives pushes. When I dequeue and the outbound stack is empty, I pour inbound into outbound — that reverses order, which is what a queue wants. Each element moves at most twice, so amortised O(1). Worst-case dequeue is O(n) on a pour. I would say that before they ask.”

---

## Linked list

```swift
final class ListNode {
    var val: Int
    var next: ListNode?
    init(_ val: Int, _ next: ListNode? = nil) {
        self.val = val
        self.next = next
    }
}
```

Lists are classes. Identity is `===`. I would write the node type first so we agree on the API.

### Reverse linked list

Iterative: three pointers, walk once.

```swift
func reverseList(_ head: ListNode?) -> ListNode? {
    var prev: ListNode?
    var cur = head
    while let node = cur {
        let next = node.next
        node.next = prev
        prev = node
        cur = next
    }
    return prev
}
```

How I’d talk this. “I hold previous, current, and the next I am about to lose. Flip `next`, advance. Empty list and single node fall out of the loop. Recursive is pretty and uses O(n) stack; I would mention it, then ship iterative.”

### Merge two sorted lists

Dummy head so I do not special-case the first node.

```swift
func merge(_ a: ListNode?, _ b: ListNode?) -> ListNode? {
    let dummy = ListNode(0)
    var tail = dummy
    var a = a, b = b
    while let x = a, let y = b {
        if x.val < y.val {
            tail.next = x; a = x.next
        } else {
            tail.next = y; b = y.next
        }
        tail = tail.next!
    }
    tail.next = a ?? b
    return dummy.next
}
```

How I’d talk this. “Walk both, splice the smaller node, hang the remainder when one list empties. Dummy head keeps the code honest. I am mutating the existing nodes, not allocating copies — I would confirm that is allowed.”

### Detect cycle (Floyd)

Slow pointer, fast pointer. If they meet, there is a cycle.

```swift
func hasCycle(_ head: ListNode?) -> Bool {
    var slow = head
    var fast = head
    while let f = fast?.next {
        slow = slow?.next
        fast = f.next
        if slow === fast { return true }
    }
    return false
}
```

How I’d talk this. “Reference equality, `===`, not `==`. Fast moves two, slow moves one. Meeting proves a loop. Fast hitting nil proves none. Follow-up is finding the entrance: reset one pointer to head, walk both one step at a time, they meet at the start of the cycle.”

---

## Trees / graphs

```swift
final class TreeNode {
    var val: Int
    var left: TreeNode?
    var right: TreeNode?
    init(_ val: Int, _ left: TreeNode? = nil, _ right: TreeNode? = nil) {
        self.val = val
        self.left = left
        self.right = right
    }
}
```

### Max depth

Empty tree is depth 0. Otherwise one plus the deeper child.

```swift
func maxDepth(_ root: TreeNode?) -> Int {
    guard let root else { return 0 }
    return 1 + max(maxDepth(root.left), maxDepth(root.right))
}
```

How I’d talk this. “This is the definition. I would mention the iterative BFS version if they worry about stack depth on a degenerate tree. Balanced: O(log n) frames. Skewed: O(n).”

### Invert binary tree

Swap the children, recurse. The meme, and still asked.

```swift
func invert(_ root: TreeNode?) -> TreeNode? {
    guard let root else { return nil }
    let l = invert(root.left)
    root.left = invert(root.right)
    root.right = l
    return root
}
```

How I’d talk this. “I have to stash one child before I overwrite it. In-place is fine. I would not clone the tree unless they ask.”

### Level order

BFS. Queue of nodes, drain a level at a time.

```swift
func levelOrder(_ root: TreeNode?) -> [[Int]] {
    guard let root else { return [] }
    var q = [root]
    var out: [[Int]] = []
    while !q.isEmpty {
        var level: [Int] = []
        for _ in 0..<q.count {
            let n = q.removeFirst()
            level.append(n.val)
            if let l = n.left { q.append(l) }
            if let r = n.right { q.append(r) }
        }
        out.append(level)
    }
    return out
}
```

How I’d talk this. “`removeFirst()` on `Array` is O(n). At interview n it does not matter. On a senior follow-up I would use an index pointer or a deque. Snapshot `q.count` before the inner loop so the level stays a level.”

### Number of islands (DFS)

Grid of `'1'` land and `'0'` water. Count connected components, four-directional.

```swift
func numIslands(_ grid: [[Character]]) -> Int {
    var g = grid
    let rows = g.count
    guard rows > 0 else { return 0 }
    let cols = g[0].count
    var count = 0

    func dfs(_ r: Int, _ c: Int) {
        guard r >= 0, c >= 0, r < rows, c < cols, g[r][c] == "1" else { return }
        g[r][c] = "0"
        dfs(r + 1, c); dfs(r - 1, c); dfs(r, c + 1); dfs(r, c - 1)
    }

    for r in 0..<rows {
        for c in 0..<cols where g[r][c] == "1" {
            count += 1
            dfs(r, c)
        }
    }
    return count
}
```

How I’d talk this. “Each unvisited land starts an island. DFS sinks the island by flipping to water so I do not recount. I copy the grid so I am not mutating the caller’s data — I would ask if in-place is allowed. BFS with a queue is the same idea and safer on a huge island if recursion depth worries them.”

### Clone graph (BFS)

Nodes have values and neighbours. Deep copy, including cycles.

```swift
final class Node {
    var val: Int
    var neighbors: [Node]
    init(_ val: Int) { self.val = val; neighbors = [] }
}

func cloneGraph(_ node: Node?) -> Node? {
    guard let node else { return nil }
    var map: [ObjectIdentifier: Node] = [:]
    var q = [node]
    map[ObjectIdentifier(node)] = Node(node.val)
    var i = 0
    while i < q.count {
        let cur = q[i]; i += 1
        let copy = map[ObjectIdentifier(cur)]!
        for n in cur.neighbors {
            let id = ObjectIdentifier(n)
            if map[id] == nil {
                map[id] = Node(n.val)
                q.append(n)
            }
            copy.neighbors.append(map[id]!)
        }
    }
    return map[ObjectIdentifier(node)]
}
```

How I’d talk this. “The map is original-to-clone. I must create the clone before I walk neighbours, or a cycle loops forever. `ObjectIdentifier` because values are not unique. Index-based queue so I do not `removeFirst`. Empty input: nil.”

---

## Recursion / backtracking / DP

### Fibonacci (DP)

The nth Fibonacci number. Linear, constant space.

```swift
func fib(_ n: Int) -> Int {
    if n < 2 { return n }
    var a = 0, b = 1
    for _ in 2...n {
        (a, b) = (b, a + b)
    }
    return b
}
```

How I’d talk this. “Naive recursion is exponential — that is the trap, and I would say so before I write it. Two variables rolling forward is O(n) time, O(1) space. I would mention overflow if n is large; Swift `Int` will trap in debug.”

### Climbing stairs

n stairs, 1 or 2 at a time. Number of ways. Same recurrence as Fibonacci.

How I’d talk this. “Ways(n) = ways(n-1) + ways(n-2). I would write the same loop as `fib` and say that out loud so they know I recognised it. Base: one stair is one way, two stairs is two.”

### Coin change

Fewest coins to make `amount`. Unlimited supply of each denomination. −1 if impossible.

```swift
func coinChange(_ coins: [Int], _ amount: Int) -> Int {
    var dp = Array(repeating: amount + 1, count: amount + 1)
    dp[0] = 0
    for a in 1...amount {
        for c in coins where c <= a {
            dp[a] = min(dp[a], dp[a - c] + 1)
        }
    }
    return dp[amount] > amount ? -1 : dp[amount]
}
```

How I’d talk this. “`dp[a]` is fewest coins for amount `a`. Unreachable starts as `amount + 1`, a sentinel bigger than any answer. Bottom-up so I do not fight recursion limits. Time is amount times number of coins. Greedy is wrong for arbitrary denominations — I would not lead with greedy unless they constrain the coin set.”

### House robber

Houses in a line, cannot rob adjacent, maximise money.

```swift
func rob(_ nums: [Int]) -> Int {
    var prev2 = 0, prev1 = 0
    for n in nums {
        let cur = max(prev1, prev2 + n)
        prev2 = prev1
        prev1 = cur
    }
    return prev1
}
```

How I’d talk this. “At each house I skip it (keep prev1) or take it plus the best from two back. O(n) time, O(1) space. Empty: 0. Follow-up is houses in a circle — rob 0..n-2 or 1..n-1, take the max.”

### Subsets (backtracking)

All subsets of a distinct-integer array.

```swift
func subsets(_ nums: [Int]) -> [[Int]] {
    var out: [[Int]] = []
    var path: [Int] = []
    func dfs(_ i: Int) {
        if i == nums.count {
            out.append(path)
            return
        }
        dfs(i + 1)
        path.append(nums[i])
        dfs(i + 1)
        path.removeLast()
    }
    dfs(0)
    return out
}
```

How I’d talk this. “At each index I either skip or take, then undo the take. That undo is the backtracking. 2^n subsets, which I would say before they ask about the output size. Duplicates in the input is a different problem — sort and skip.”

---

## Sorting / searching

### Binary search

Sorted array, return index or −1.

```swift
func search(_ nums: [Int], _ target: Int) -> Int {
    var lo = 0, hi = nums.count - 1
    while lo <= hi {
        let mid = lo + (hi - lo) / 2
        if nums[mid] == target { return mid }
        if nums[mid] < target { lo = mid + 1 } else { hi = mid - 1 }
    }
    return -1
}
```

How I’d talk this. “`lo + hi` can overflow in other languages. I write `lo + (hi - lo) / 2` out of habit. Inclusive bounds, `lo <= hi`. Off-by-one is how this problem is actually failed. Empty array: −1.”

### Merge intervals

Array of `[start, end]`. Merge overlaps, return sorted disjoint intervals.

```swift
func merge(_ intervals: [[Int]]) -> [[Int]] {
    let sorted = intervals.sorted { $0[0] < $1[0] }
    var out: [[Int]] = []
    for i in sorted {
        if let last = out.last, last[1] >= i[0] {
            out[out.count - 1][1] = max(last[1], i[1])
        } else {
            out.append(i)
        }
    }
    return out
}
```

How I’d talk this. “Sort by start. If this interval overlaps the last one I kept, extend the end. Otherwise append. Touching endpoints: I treat `last[1] >= i[0]` as overlap — I would confirm whether `[1,2]` and `[2,3]` merge. Empty input: empty.”

---

## iOS-flavoured coding

These are the ones that feel like the job.

### Deduplicate posts keeping order

Pagination returned the same id twice. Keep first occurrence.

```swift
func uniqueIDs(_ ids: [String]) -> [String] {
    var seen = Set<String>()
    var out: [String] = []
    for id in ids where seen.insert(id).inserted {
        out.append(id)
    }
    return out
}
```

How I’d talk this. “Set for membership, array for order. `Set` alone would scramble. I would also say I want to know why the API duplicated — cursor versus offset — not just paper over it.”

### Throttle tap (token bucket simplified)

Ignore taps closer than `interval`. An actor so two taps cannot race.

```swift
actor TapGate {
    private var last = Date.distantPast
    private let interval: TimeInterval
    init(interval: TimeInterval) { self.interval = interval }

    func allow(now: Date = .now) -> Bool {
        guard now.timeIntervalSince(last) >= interval else { return false }
        last = now
        return true
    }
}
```

How I’d talk this. “The interesting bit is injecting `now` so a test does not sleep. Actor serialises the read-modify-write. This is debounce of a button, not a search box — I would not put this in a SwiftUI `body`.”

### Parse query items

Pull a dictionary of query names to values from a URL.

```swift
func query(_ url: URL) -> [String: String] {
    URLComponents(url: url, resolvingAgainstBaseURL: false)?
        .queryItems?
        .reduce(into: [:]) { dict, item in
            dict[item.name] = item.value ?? ""
        } ?? [:]
}
```

How I’d talk this. “I will not split on `?` and `&` by hand. `URLComponents` exists. Duplicate keys: last wins in this version; I would ask if they want arrays. Missing value becomes empty string rather than dropping the key.”

---

## Complexity cheat (say this in interviews)

| Structure | Get | Insert | Notes |
| --- | --- | --- | --- |
| Array | O(1) index | O(n) middle | Append amortised O(1) |
| Dictionary / Set | O(1) avg | O(1) avg | Hashable |
| Linked list | O(n) | O(1) at head | |
| Binary heap | O(1) min | O(log n) | |

Say the complexity before you finish typing. Interviewers are listening for it. Average versus worst for a hash table is a senior extra sentence, not a junior requirement.

---

# PART XII — Senior iOS Engineering

This is the chapter for people who already ship features and are now being asked how the app survives the next two years.

Production architecture starts at `@main`. That is the composition root: session, API client, stores, factories. Feature modules expose a public API and keep internals to themselves. Domain types do not import SwiftUI. Side effects live at the edges — network, disk, analytics — so a view model can be tested with fakes. Feature flags belong at the root, not sprinkled through payment signing. A single session object owns auth, and logout tears it down on purpose: cancel tasks, wipe Keychain, reset navigation paths per tab. A session that “just becomes nil” leaves listeners half-alive.

Client scalability is lists, startup, teams, and builds. Lists: pagination, diffing, an image pipeline that cancels. Startup: lazy SDK init so a third-party crash reporter does not own your first frame. Teams: module ownership, CODEOWNERS, architecture decision records so the next person knows why you did not pick TCA. Builds: incremental compilation, preview targets, not one app target of 400 screens if CI is twenty-eight minutes.

Observability is how you know any of that worked. `Logger(subsystem:category:)`, signposts around sync, breadcrumbs without PII, crash grouping, hang detection (MetricKit), network correlation IDs the backend already has. A senior who cannot say how they would find this bug in production is designing a demo.

Performance culture is budgets: 16.7 ms frames, a launch p95, crash-free 99.x%. Measure in CI where you can. Security culture is a threat model per feature, secrets from the backend, dependency scanning, least-privilege entitlements. “We pin ATS” is not a threat model.

Every “we should rewrite” needs a cost, a risk, an incremental path, and a metric of success. Every “new framework” needs team skill, Apple’s direction, and an escape hatch. Staff vocabulary is not “I like TCA.” It is “here is the bet, here is how we unwind it.”

---

# Real-World Engineering Scenarios

These are the debugging stories. Answer at the altitude they hired you for, then one step above so they know you can grow.

### The API sometimes returns duplicate data. How would you handle it?

On a junior loop I would filter in the UI — a `Set` of ids, or `ForEach` on unique items — so the list does not crash on identity. On a mid loop I would deduplicate in the repository so every screen sees the same merge, keep stable identity, and ask whether pagination is overlapping (offset versus cursor). On a senior loop I would treat duplicates as a signal: metric the rate, file the server bug, merge idempotently, and stop pretending the client should be the source of truth for membership.

### The screen is rendering too many times. How would you investigate?

Printing in `body` is how you confirm it, not how you finish. Instruments’ SwiftUI template, Observation granularity, split views so a slider does not invalidate the world. Seniors add identity churn, environment thrash, animation transactions, `EquatableView`, and whether the parent is invalidating everything because it read a fat model.

### The app crashes only in production.

Crashlytics plus a line number is the start. dSYM, reproduce with production-shaped data, threading, force unwraps, dictionary `!`. Release versus debug optimisation, bit-identical flags, a specific device, jetsam versus a real crash, MetricKit, feature-flagged code that only exists in some builds. Symbolicate correctly or you are reading fiction.

### Memory usage keeps increasing.

If you have never opened Allocations, say so and then open it. Graph plus leaks. Images. Cycles in closures. Then the senior layer: caches without limits, abandoned `URLSession` tasks, a `Timer` or Combine subscription that outlived the screen, SwiftUI identity resetting versus actually leaking, copy-on-write buffers that went dirty and stayed dirty.

### A network request continues after leaving the screen.

`onDisappear` cancel is the junior instinct and often works. `.task` cancellation is the mid-level one — store a `Task` if you started it yourself. Seniors ask whether the async function actually checks cancellation, refuse `Task.detached` for UI work, and decide policy: should a send-message finish after pop, or abort.

### A SwiftUI list is slow.

“Use `List`” is not an investigation. Lazy, images, stable ids. Then profile: cell complexity, UIKit interop, prefetch, downsample, nested stacks, work in `body`. The first three checks I actually run are full-resolution images on main, unstable identity, and a `VStack` of thousands of rows.

### A view unexpectedly loses its state.

`@State` is necessary and not sufficient. Identity: `.id`, `if/else` branches, `ForEach` on indices of a mutating array. Parent recreation with a new explicit id. Navigation pop. `@StateObject` versus something merely observed. An `@Observable` instance that was not held in `@State`, so each body made a new one.

### Two screens need to share the same state.

`@EnvironmentObject` is the junior button. Lift state, pass bindings, or share an `@Observable` session — and then say how long that object lives. App, scene, or feature. Globals are not a session. Tests need a seam.

### The application must support offline mode.

UserDefaults as a cache is a prototype. A local store plus a dirty flag is a feature. A queue, a conflict policy, auth that expires while you are in a tunnel, UX for stale data, and a background-sync budget is a product. Ask which of those they actually want.

### Multiple API calls need to run concurrently.

Two `Task`s will run. `async let` or a `TaskGroup` will run with structure. Limit parallelism so you do not open eighty image connections. Cancel the group when the screen goes. Partial failure: `Result` per child, not one throw that discards the successes. Do not sit on `MainActor` while you decode.

### An API call should be cancelled when the user leaves the screen.

This is the `.task` question. Structured child tasks cancel together. Unstructured `Task { }` in `onAppear` does not, unless you store and cancel it. Seniors mention composed children: the search task owns the decode task, and both die.

### Duplicate `onAppear` in List rows.

Appear is not visibility. Lists prefetch. `.task(id:)` is the tool; `onAppear` is the trap. Do not start exclusive resources — a player, a location stream — from row appear without an id that means “this row, this identity.”

---

# What Interviewers Expect at Each Level

## 0–2 Years

Correct Swift: optionals, structs, basic ARC, closures that do not cycle in the simple cases. A SwiftUI screen with `@State` and `@Binding`, a `List`, navigation. Fetch and decode JSON with an error path. Honesty: “I have not used actors in production” is better than a blog-post actor. Clean code on a whiteboard.

They are not asking you to design WhatsApp. They are asking whether you will crash on nil and whether you can talk about what you wrote.

## 2–4 Years

You own a feature: architecture, tests, cancellation, loading and error and empty. You can explain `@StateObject` versus observed versus Observation. You can Instruments a hang. You know UIKit lifecycle even if you write SwiftUI. You discuss `List` versus `LazyVStack` with a recommendation, not a coin flip.

## 4+ Years

Systems: sync, security, modularisation, performance budgets. Swift 6 isolation and `Sendable` as design tools, not as compiler noise. Mentoring and migration, not only greenfield. “It depends” only counts if a decision follows.

## What separates a 2-year from a 4-year developer?

Not the number of frameworks. The four-year engineer draws an ownership diagram before coding, cancels work, tests the seam, debugs with tools, and knows what will hurt at 10× data. The two-year engineer can build the happy path. The four-year engineer can explain the failure path.

## What separates a 4-year from senior/staff?

Senior raises the quality of features and of people on the team, and designs subsystems. Staff changes how the organisation builds iOS — architecture, reliability, platform direction — and makes bets against Apple’s evolving stack.

Staff is not “knows TCA and VIPER.” Staff is “picks a boring architecture the team can ship, and invests in the few sharp edges that matter: sync, media, security.”
