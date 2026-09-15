# PART XI — Coding

```text
Experience: mixed (tagged per problem)
Category: Coding
Difficulty: Easy / Medium / Hard
Importance: High
```

iOS interviews still include DSA, usually in **Swift**. Write clean Swift, talk complexity, handle empty inputs, and mention integer overflow when relevant.

Interview communication: restate, example, brute force, optimise, code, test edge cases.

---

## Arrays and hashing

### Two Sum

```text
Experience: 0–2
Difficulty: Easy
```

Return indices of two numbers that add to `target`.

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

Time O(n), space O(n).  
**Trap:** nested loops O(n²) only for tiny n.  
**Follow-up:** Three sum; sorted two pointers if allowed to sort.

### Contains duplicate

```text
Experience: 0–2
Difficulty: Easy
```

```swift
func containsDuplicate(_ nums: [Int]) -> Bool {
    var seen = Set<Int>()
    for n in nums {
        if !seen.insert(n).inserted { return true }
    }
    return false
}
```

O(n) time, O(n) space.

### Product of array except self

```text
Experience: 2–4
Difficulty: Medium
```

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

O(n) time, O(1) extra besides output.

### Maximum subarray (Kadane)

```text
Experience: 2–4
Difficulty: Medium
```

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

O(n) time, O(1) space.

---

## Two pointers / sliding window

### Valid palindrome (alphanumeric)

```text
Experience: 0–2
Difficulty: Easy
```

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

### Reverse string in place

```text
Experience: 0–2
Difficulty: Easy
```

```swift
func reverse(_ s: inout [Character]) {
    var i = 0, j = s.count - 1
    while i < j {
        s.swapAt(i, j)
        i += 1; j -= 1
    }
}
```

### Longest substring without repeating characters

```text
Experience: 2–4
Difficulty: Medium
```

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

O(n) time. **Note:** `Array(s)` is fine for interviews; mention Character vs Unicode.

### Container with most water

```text
Experience: 2–4
Difficulty: Medium
```

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

---

## Stack / queue

### Valid parentheses

```text
Experience: 0–2
Difficulty: Easy
```

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

### Min stack

```text
Experience: 2–4
Difficulty: Medium
```

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

### Implement queue with stacks

```text
Experience: 2–4
Difficulty: Easy
```

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

Amortised O(1).

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

### Reverse linked list

```text
Experience: 0–2
Difficulty: Easy
```

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

### Merge two sorted lists

```text
Experience: 0–2
Difficulty: Easy
```

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

### Detect cycle (Floyd)

```text
Experience: 2–4
Difficulty: Easy
```

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

Reference equality `===` matters. Lists are classes.

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

```text
Experience: 0–2
Difficulty: Easy
```

```swift
func maxDepth(_ root: TreeNode?) -> Int {
    guard let root else { return 0 }
    return 1 + max(maxDepth(root.left), maxDepth(root.right))
}
```

### Invert binary tree

```text
Experience: 0–2
Difficulty: Easy
```

```swift
func invert(_ root: TreeNode?) -> TreeNode? {
    guard let root else { return nil }
    let l = invert(root.left)
    root.left = invert(root.right)
    root.right = l
    return root
}
```

### Level order

```text
Experience: 2–4
Difficulty: Medium
```

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

`removeFirst()` on `Array` is O(n); mention `Deque` or index pointer in a senior follow-up.

### Number of islands (DFS)

```text
Experience: 2–4
Difficulty: Medium
```

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

### Clone graph (BFS)

```text
Experience: 2–4
Difficulty: Medium
```

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

---

## Recursion / backtracking / DP

### Fibonacci (DP)

```text
Experience: 0–2
Difficulty: Easy
```

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

O(n) time, O(1) space. Recursive exponential is the trap.

### Climbing stairs

```text
Experience: 0–2
Difficulty: Easy
```

Same recurrence as fib.

### Coin change

```text
Experience: 2–4
Difficulty: Medium
```

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

O(amount * coins) time.

### House robber

```text
Experience: 2–4
Difficulty: Medium
```

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

### Subsets (backtracking)

```text
Experience: 2–4
Difficulty: Medium
```

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

---

## Sorting / searching

### Binary search

```text
Experience: 0–2
Difficulty: Easy
```

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

**Trap:** `lo + hi` overflow; use `lo + (hi - lo) / 2`.

### Merge intervals

```text
Experience: 2–4
Difficulty: Medium
```

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

---

## iOS-flavoured coding

### Deduplicate posts keeping order

```text
Experience: 0–2
Difficulty: Easy
```

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

### Throttle tap (token bucket simplified)

```text
Experience: 2–4
Difficulty: Medium
```

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

### Parse query items

```text
Experience: 0–2
Difficulty: Easy
```

```swift
func query(_ url: URL) -> [String: String] {
    URLComponents(url: url, resolvingAgainstBaseURL: false)?
        .queryItems?
        .reduce(into: [:]) { dict, item in
            dict[item.name] = item.value ?? ""
        } ?? [:]
}
```

---

## Complexity cheat (say this in interviews)

| Structure | Get | Insert | Notes |
| --- | --- | --- | --- |
| Array | O(1) index | O(n) middle | Append amortised O(1) |
| Dictionary / Set | O(1) avg | O(1) avg | Hashable |
| Linked list | O(n) | O(1) at head | |
| Binary heap | O(1) min | O(log n) | |

---

# PART XII — Senior iOS Engineering

```text
Experience: 4+
Category: Architecture
Difficulty: Expert
Importance: High
```

## Production architecture

- **Composition root** at `@main`
- Feature modules with public APIs
- Domain independent of SwiftUI
- Side effects at the edges (network, disk, analytics)
- Feature flags
- A single **session** object (auth) with explicit logout teardown

## Scalability (client)

- Lists: pagination, diffing, image pipeline
- Startup: lazy SDK init
- Teams: module ownership, CODEOWNERS, architecture decision records
- Build: incremental compilation, preview targets

## Observability

`Logger(subsystem:category:)`, signposts around sync, breadcrumb without PII, crash grouping, hang detection (MetricKit), network correlation IDs from backend.

## Performance culture

Budgets: 16.7ms frames, launch p95, crash-free 99.x%. Measure in CI where possible (launch tests).

## Security culture

Threat model per feature. Secrets from backend. Dependency scanning. Least privilege entitlements.

## Engineering trade-offs (the staff vocabulary)

Every “we should rewrite” needs: cost, risk, incremental path, metrics of success. Every “new framework” needs: team skill, Apple’s direction, escape hatch.

---

# Real-World Engineering Scenarios

For each: junior / mid / senior answers.

### The API sometimes returns duplicate data. How would you handle it?

**Junior:** `Set` the IDs, or filter in `ForEach`.  
**Mid:** Deduplicate at repository; stable identity; find why the API duplicates (pagination overlap).  
**Senior:** Cursor vs offset; server bug ticket; idempotent merge; metrics on duplicate rate.

### The screen is rendering too many times. How would you investigate?

**Junior:** Print in `body` (not ideal).  
**Mid:** Instruments SwiftUI, check Observation granularity, split views.  
**Senior:** Identity churn, environment thrash, animation transactions, Equatable, whether parent invalidates the world.

### The app crashes only in production.

**Junior:** Look at Crashlytics line number.  
**Mid:** dSYM, reproduce with prod-like data, threading, force unwraps, dictionary `!`.  
**Senior:** Release vs debug optimisation, bit-identical flags, specific device, memory jetsam vs crash, metric kit, symbolicate correctly, feature-flagged code.

### Memory usage keeps increasing.

**Junior:** I don’t know Instruments.  
**Mid:** Graph + leaks; images; cycles in closures.  
**Senior:** Caches without limits, abandoned URLSession tasks, hidden retain from Timer/Combine, SwiftUI identity resetting vs leaking objects, dirty COW.

### A network request continues after leaving the screen.

**Junior:** I would cancel in `onDisappear`.  
**Mid:** `.task` cancellation; store `Task`.  
**Senior:** Ensure the async function actually honours cancel; don’t use detached; cancel uploads policy (should a send-message finish?).

### A SwiftUI list is slow.

**Junior:** Use `List`.  
**Mid:** Lazy, images, IDs.  
**Senior:** Profiling, cell complexity, UIKit interop, prefetch, downsample, avoid nested stacks.

### A view unexpectedly loses its state.

**Junior:** Use `@State`.  
**Mid:** Identity: `.id`, `if/else`, `ForEach` indices.  
**Senior:** Parent recreation with new explicit id; Navigation stack pop; `@StateObject` vs observed; Observation instance not in `@State`.

### Two screens need to share the same state.

**Junior:** `@EnvironmentObject`.  
**Mid:** Lift state, pass bindings, or shared `@Observable` session.  
**Senior:** Lifetime of the shared object (app vs scene vs feature); avoid globals; test seams.

### The application must support offline mode.

**Junior:** UserDefaults cache.  
**Mid:** Local store + sync flag.  
**Senior:** Queue, conflicts, auth expiry offline, UX for stale data, background sync budget.

### Multiple API calls need to run concurrently.

**Junior:** Two `Task`s.  
**Mid:** `async let` / `TaskGroup`.  
**Senior:** Limit parallelism, cancellation, partial failure (`Result` per child), don’t block MainActor.

### An API call should be cancelled when the user leaves the screen.

Covered above — this is the `.task` question. Seniors mention composed child tasks.

### Duplicate `onAppear` in List rows.

**Junior:** Confused.  
**Mid:** Prefetch / appear is not visibility. Use `.task(id:)`.  
**Senior:** Don’t start exclusive resources per row appear.

---

# What Interviewers Expect at Each Level

## 0–2 Years

- Correct Swift: optionals, structs, basic ARC, closures without cycles in simple cases
- A SwiftUI screen with `@State`/`@Binding`, List, navigation
- Fetch + decode JSON with error handling
- Honesty: “I haven’t used actors in production” is better than fiction
- Clean code on a whiteboard

They are **not** testing whether you can design WhatsApp.

## 2–4 Years

- You own a feature: architecture, tests, cancellation, loading/error/empty
- You explain `@StateObject` vs observed vs Observation
- You can Instruments a hang
- You know UIKit lifecycle even if you write SwiftUI
- You discuss trade-offs (List vs LazyVStack) with a recommendation

## 4+ Years

- Systems: sync, security, modularisation, performance budgets
- Swift 6 isolation and Sendable as design tools
- Mentoring and migration, not only greenfield
- “It depends” **with a decision**

## What separates a 2-year from a 4-year developer?

Not the number of frameworks. The 4-year engineer:

- Draws an ownership diagram before coding
- Cancels work
- Tests the seam
- Debugs with tools
- Knows what will hurt at 10× data

The 2-year engineer can build the happy path. The 4-year engineer can explain the failure path.

## What separates a 4-year from senior/staff?

- Senior: raises the quality of **features and people** on the team; designs subsystems
- Staff: changes **how the organisation builds iOS** (architecture, reliability, platform direction) and makes the right bets against Apple’s evolving stack

Staff is not “knows TCA and VIPER.” Staff is “picks a boring architecture the team can ship, and invests in the few sharp edges that matter (sync, media, security).”

---
