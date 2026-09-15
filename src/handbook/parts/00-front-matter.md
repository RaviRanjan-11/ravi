# iOS & SwiftUI Interview Handbook

**A complete reference for learning Swift, building iOS apps, and passing iOS interviews — from first principles to staff-level engineering judgment.**

Edition: 2026  
Language baseline: **Swift 6.2**  
UI baseline: **SwiftUI (iOS 26 / modern Observation)**  
Also covered: UIKit, Combine, Core Data, and other APIs you will still meet in production and interviews

---

## Copyright and use

This handbook is a study and teaching document. Use it to learn, revise, interview, and teach. Code samples are illustrative, not copy-paste production architecture. Always verify against Apple’s current documentation for the OS version you ship.

---

## Table of Contents

- [How to Use This Book](#how-to-use-this-book)
- [Experience-Level Roadmap](#experience-level-roadmap)
- [Filtering System](#filtering-system)
- [Legend](#legend)

**PART I — Swift**
- [Swift Fundamentals](#swift-fundamentals)
- [Optionals](#optionals)
- [Control Flow](#swift-control-flow)
- [Functions](#functions)
- [Closures](#closures)
- [Structs, Classes, Enums, and Properties](#structs-classes-enums-and-properties)
- [Protocol-Oriented Programming](#protocol-oriented-programming)
- [Generics](#generics)
- [Error Handling](#error-handling)
- [Memory Management](#memory-management)
- [Advanced Swift](#advanced-swift)
- [Swift Concurrency](#swift-concurrency)

**PART II — iOS**
- [iOS Architecture and App Lifecycle](#ios-architecture-and-app-lifecycle)
- [UIKit](#uikit)
- [Networking](#networking)
- [Persistence](#persistence)
- [Security](#security)
- [Notifications and Background Work](#notifications-and-background-work)

**PART III — SwiftUI**
- [SwiftUI Fundamentals](#swiftui-fundamentals)
- [Views](#views)
- [SwiftUI View Catalog](#swiftui-view-catalog-remaining-primitives)
- [Modifiers](#swiftui-modifiers)
- [Layout](#layout)
- [State Management](#swiftui-state-management)
- [Observation](#observation)
- [View Lifecycle and Rendering](#swiftui-view-lifecycle-and-rendering)
- [Navigation](#swiftui-navigation)
- [Lists, Forms, Gestures, Animations](#lists-forms-gestures-animations)
- [Sheets and Presentation](#sheets-and-presentation)
- [Accessibility](#accessibility)
- [Advanced SwiftUI](#advanced-swiftui)

**PART IV — Architecture**
- [MVC, MVVM, MVP, VIPER, Clean Architecture, TCA](#architecture)
- [Dependency Injection](#dependency-injection)
- [Coordinators, Repositories, Modularisation](#coordinators-repositories-modularisation)

**PART V — Combine**
- [Combine](#combine)

**PART VI — Data (deep dive)**
- [UserDefaults, Keychain, Core Data, SwiftData, Caching, Offline-first](#part-vi--data)

**PART VII — Testing**
- [Testing](#testing)

**PART VIII — Performance**
- [Performance](#performance)

**PART IX — System Design**
- [iOS System Design](#ios-system-design)

**PART X — Interview Questions**
- [Interview Questions by Level](#interview-questions)

**PART XI — Coding**
- [Swift Coding Problems](#swift-coding-problems)

**PART XII — Senior iOS Engineering**
- [Senior and Staff Topics](#senior-ios-engineering)

**PART XIII — Real-World Scenarios**
- [Real-World Engineering Scenarios](#real-world-engineering-scenarios)

**PART XIV — Interviewer's Perspective**
- [What Interviewers Expect](#what-interviewers-expect-at-each-level)

**Additional depth**
- [Combine, Testing, Accessibility, Gestures, Animations](#additional-depth--combine-testing-accessibility-gestures-animations)

**FINAL**
- [Interview Roadmap](#final-interview-roadmap)
- [Master Cheat Sheet](#final--interview-cheat-sheet)
- [30-Day Preparation Plan](#30-day-preparation-plan)

---

## How to Use This Book

This is not a list of definitions. Every important idea is explained from first principles:

1. What it is
2. Why it exists
3. Why we use it
4. When to use it
5. When **not** to use it
6. Syntax, broken down token by token
7. How it works internally
8. What happens if you do **not** use it
9. Common mistakes
10. Interview traps
11. Practical examples (basic, production, interview)
12. Comparisons with alternatives
13. Performance, memory, and thread-safety implications
14. Interview questions, expected answers, and follow-ups

### If you are learning SwiftUI from scratch

Read in this order:

1. Swift Fundamentals → Optionals → Functions → Closures
2. Structs vs Classes → Protocols (lightly)
3. SwiftUI Fundamentals → Views → Modifiers → State (`@State`, `@Binding`)
4. Networking (URLSession + Codable)
5. Then come back for concurrency, architecture, and Observation

Do not start with VIPER, actors, or system design. Those topics assume you can already explain why a view updates.

### If you have 0–2 years of professional experience

Your interviews mostly test **correctness and vocabulary**:

- Can you explain optionals, structs vs classes, and ARC at a whiteboard?
- Can you build a screen in SwiftUI and fetch JSON?
- Can you avoid retain cycles in closures?
- Can you say what `@State` owns versus what `@Binding` borrows?

Read every section tagged **Experience: 0–2**. Skim 2–4 sections so you are not surprised, but do not pretend mastery you do not have. Interviewers prefer a clean junior explanation over a confused senior vocabulary.

### If you have 2–4 years of experience

Your interviews test **ownership, data flow, and production judgment**:

- Who owns this object? Who observes it? What happens on rotation, backgrounding, or navigation pop?
- Why is this list janky? Why did this view lose state?
- How do you cancel work when the user leaves the screen?
- How do you test a network layer without hitting the network?

Read 2–4 sections in full. Use 4+ sections as stretch goals. You should be able to compare alternatives, not just name them.

### If you have 4+ years of experience

Your interviews test **systems thinking**:

- Trade-offs, failure modes, observability, modularisation, Swift 6 isolation
- SwiftUI identity and rendering, not just property wrappers
- Security, offline, pagination, and “what breaks at 10× data”
- Mentoring: can you explain the same idea at three altitudes?

Read the 4+ tags, system design, senior scenarios, and the interviewer’s perspective. You will be asked “why not the other way?” more often than “what is this API?”

### If you are an interviewer

Use the experience tags as a scoring rubric, not a checklist. A strong 1-year candidate who reasons clearly about `@State` is more hireable than a 5-year candidate who recites TCA slogans. Each major concept includes:

- What a junior must say
- What a mid-level must add
- What a senior must add
- Follow-up questions that reveal depth

### How to convert this Markdown later

This file is written with:

- ATX headings (`#`, `##`, `###`)
- Fenced Swift code
- ASCII diagrams
- Tables for comparisons and cheat sheets
- Consistent metadata blocks for filtering

Pandoc, GitHub, and most static-site generators can turn it into PDF or HTML. Keep heading levels stable if you split chapters later.

---

## Experience-Level Roadmap

| Experience | What you must know | What interviewers actually test |
| ---------- | ------------------- | ------------------------------ |
| **0–2 years** | Swift fundamentals, optionals, structs vs classes, ARC basics, UIKit lifecycle awareness, SwiftUI views and modifiers, `@State` / `@Binding`, URLSession + Codable, UserDefaults, basic MVVM, XCTest or Swift Testing at a unit-test level | Can you write correct code, explain what you wrote, and not leak or crash on obvious optional/memory mistakes? |
| **2–4 years** | Protocol-oriented design, generics in real APIs, concurrency (`async`/`await`, `Task`, cancellation), Combine *or* modern Observation, SwiftUI data flow (`@StateObject` legacy + `@Observable` modern), navigation, persistence choices, DI, testing doubles, Instruments literacy | Can you own a feature end-to-end: architecture, threading, testing, and performance of a screen? |
| **4+ years** | Actor isolation, Sendable, Swift 6 language mode, SwiftUI identity/rendering internals, modularisation, offline-first, security, system design, observability, engineering trade-offs | Can you design a system, defend trade-offs, debug production, and raise the quality of other people’s code? |

### Why these buckets exist

Years of experience are a **proxy**, not a law. The buckets exist because interview loops are structured that way:

- **0–2** loops are short. Interviewers need signal from fundamentals.
- **2–4** loops add a take-home or a feature-design round. Interviewers need signal from data flow and testing.
- **4+** loops add system design and behavioural rounds. Interviewers need signal from judgment under incomplete information.

A concept is tagged **0–2** when a competent junior is expected to use it correctly on the job.  
A concept is tagged **2–4** when you must understand **ownership, lifetime, or failure modes**, not just syntax.  
A concept is tagged **4+** when you must understand **runtime/compiler behaviour, isolation, or system-level trade-offs**.

Many concepts span levels. Example:

```text
@State
Level: 0–2          → it stores view-owned value state; mutating it refreshes the view
Advanced: 2–4       → storage lives outside the struct; identity controls lifetime
Deep: 4+            → how invalidation, dependency tracking, and animation transactions interact
```

---

## Filtering System

Every important concept uses the same metadata block:

```text
Experience: 0–2 | 2–4 | 4+
Category: Swift | SwiftUI | UIKit | Concurrency | Networking | Persistence | Architecture | Testing | Security | Performance | System Design
Difficulty: Beginner | Intermediate | Advanced | Expert
Importance: Critical | High | Medium | Low
```

**How to filter while reading**

- Preparing for a **junior** role: read `Experience: 0–2` and `Importance: Critical` or `High`.
- Preparing for a **mid** role: add `Experience: 2–4`.
- Preparing for a **senior/staff** role: add `Experience: 4+` and every **System Design** / **Performance** chapter.
- Teaching a topic: start at Beginner, then use the “Junior vs experienced” subsections.

**Importance** means “how often this appears in interviews and production bugs,” not “how hard it is.” `@State` is Beginner and **Critical**. Associated types with type erasure are Advanced and High for senior loops, Medium for junior loops.

---

## Legend

| Marker | Meaning |
| ------ | ------- |
| 🟢 | 0–2 years — fundamental |
| 🟡 | 2–4 years — professional depth |
| 🔴 | 4+ years — senior depth |
| ✅ | Preferred / correct in modern code |
| ❌ | Common mistake or interview trap |
| legacy → modern | Evolution of an API you must still recognise |

**Version policy used throughout**

```text
Legacy approach
        ↓
Modern approach
        ↓
Why Apple introduced the change
        ↓
What an interview candidate should know
```

This book never presents a deprecated API as the thing you should reach for first. It still teaches deprecated and legacy APIs because **real codebases and interviewers still use them**.

| Status | Meaning | Example |
| ------ | ------- | ------- |
| **Current best practice** | Use this in new code targeting modern OS versions | `NavigationStack`, `@Observable`, `async/await`, SwiftData (when it fits) |
| **Still-supported legacy** | Know it, maintain it, migrate when cheap | `ObservableObject` + `@Published`, Core Data, Combine |
| **Deprecated** | Do not start new work here; still answer interview questions | `NavigationView`, `UIWebView`, `async` Grand-Central-Dispatch-as-the-only-model |
| **Interview-critical legacy** | You will be asked even if you never write it | MVC, delegates, `weak self`, `NSNotificationCenter` |

---

## A note on SwiftUI versus UIKit in interviews

SwiftUI is the centre of this book because that is where new iOS UI work is going. UIKit remains mandatory interview knowledge because:

- Most large apps are hybrid
- UIKit lifecycle questions are easy for interviewers to ask with precision
- Collection views, cell reuse, and responder chain still appear
- Many performance and memory bugs are UIKit-shaped even inside SwiftUI (`UIViewRepresentable`)

If a job description says “SwiftUI,” still revise UIKit lifecycle and Auto Layout. If it says “UIKit,” still revise SwiftUI state and identity — interviewers increasingly use both.

---

## How to read a concept page

Every major keyword is taught in the same shape. Internalise this shape; it is also how you should answer in interviews.

```text
What it is
Why it exists
Why we write it
What happens if we don't write it
When we should write it
When we should avoid it
Syntax breakdown
Internal model
Memory / threads / performance
Mistakes and traps
Examples (basic, real-world, interview)
Junior vs mid vs senior expected answer
Follow-up questions
```

If you can fill that template for `@State`, `actor`, `Task`, and `struct` vs `class`, you are already ahead of most candidates.

---
