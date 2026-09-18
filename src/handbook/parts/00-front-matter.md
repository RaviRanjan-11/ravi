# iOS & SwiftUI Interview Handbook

Written the way you would explain it to a teammate the night before a loop — Swift, SwiftUI, UIKit, architecture, and the questions people actually ask.

Edition: 2026. Language: **Swift 6.2**. UI: **SwiftUI** (modern Observation), plus UIKit, Combine, and Core Data because that is what production still looks like.

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

This is not a glossary you recite. It is closer to sitting with someone who has run the loop and will stop you when you are about to say “it stores state.”

Every important idea is taught the way you should answer it in a room: what the thing actually is, why Apple (or the language) bothered, what breaks if you skip it, and the trap that sounds confident until the follow-up. Syntax is there so you can write it. Internals are there so you can defend it. Examples are there so you can point at something concrete instead of waving.

You do not need to finish the book in order. You do need to stop treating a chapter as done when you can name the API. Done is when you can explain the failure mode without looking.

### If you are learning SwiftUI from scratch

Start with the language, not the architecture posters. `let` and optionals, then functions and closures, then structs versus classes. After that, SwiftUI views, modifiers, and the difference between `@State` (this view owns it) and `@Binding` (someone else does). Fetch JSON with `URLSession` and `Codable` so you have a screen that does something.

Then come back for concurrency, Observation, and architecture. VIPER, actors, and system design assume you can already say why a view updated. If you cannot, those chapters will feel like vocabulary, and vocabulary without a mental model fails the first follow-up.

### If you have 0–2 years of professional experience

Your interviews mostly test whether you write correct Swift and can talk about it. Optionals, structs versus classes, ARC on a whiteboard. A SwiftUI screen that fetches JSON. Closures that do not leak. `@State` as ownership, `@Binding` as a borrow.

Read the 0–2 material until you can teach it. Skim the 2–4 chapters so a mid-level question does not panic you, but do not fake mastery you do not have. Interviewers would rather hear a clean junior explanation than a confused senior word salad.

### If you have 2–4 years of experience

Now the room cares who owns the object, who observes it, and what happens on rotation, backgrounding, or a navigation pop. Why is this list janky. Why did this view lose state. How do you cancel work when the user leaves. How do you test a network layer without hitting the network.

Read the 2–4 chapters in full. Use 4+ as stretch, not as a costume. You should be able to compare two approaches and pick one, not just name both.

### If you have 4+ years of experience

They will ask “why not the other way?” more often than “what is this API?” Trade-offs, failure modes, observability, modularisation, Swift 6 isolation. SwiftUI identity and rendering, not just property wrappers. Security, offline, pagination, and what breaks at 10× data. Mentoring: can you explain the same idea at three altitudes without talking down.

Read the 4+ material, system design, the senior scenarios, and the interviewer’s chapter. If you cannot teach `@State` to a junior and then argue identity with a staff engineer, you are not finished.

### If you are an interviewer

Use the experience bands as a scoring rubric, not a checklist. A strong one-year candidate who reasons clearly about `@State` is more hireable than a five-year candidate who recites TCA slogans. For each major idea, listen for what a junior must get right, what a mid-level must add, and what a senior must add. The follow-ups in this book exist to reveal whether the first answer was a sentence or a model.

### How to convert this Markdown later

Headings are ATX (`#`, `##`, `###`). Code is fenced Swift. Diagrams are ASCII. Comparisons and cheat sheets are tables.

Pandoc, GitHub, and most static-site generators will turn that into PDF or HTML. Keep heading levels stable if you split chapters later — the table of contents above is a map of those anchors.

---

## Experience-Level Roadmap

| Experience | What you must know | What interviewers actually test |
| ---------- | ------------------- | ------------------------------ |
| **0–2 years** | Swift fundamentals, optionals, structs vs classes, ARC basics, UIKit lifecycle awareness, SwiftUI views and modifiers, `@State` / `@Binding`, URLSession + Codable, UserDefaults, basic MVVM, XCTest or Swift Testing at a unit-test level | Can you write correct code, explain what you wrote, and not leak or crash on obvious optional/memory mistakes? |
| **2–4 years** | Protocol-oriented design, generics in real APIs, concurrency (`async`/`await`, `Task`, cancellation), Combine *or* modern Observation, SwiftUI data flow (`@StateObject` legacy + `@Observable` modern), navigation, persistence choices, DI, testing doubles, Instruments literacy | Can you own a feature end-to-end: architecture, threading, testing, and performance of a screen? |
| **4+ years** | Actor isolation, Sendable, Swift 6 language mode, SwiftUI identity/rendering internals, modularisation, offline-first, security, system design, observability, engineering trade-offs | Can you design a system, defend trade-offs, debug production, and raise the quality of other people’s code? |

### Why these buckets exist

Years of experience are a proxy, not a law. Loops are just structured that way. A 0–2 loop is short, so interviewers hunt for fundamentals. A 2–4 loop often adds a take-home or a feature-design round, so they hunt for data flow and testing. A 4+ loop adds system design and behavioural rounds, so they hunt for judgment when the spec is incomplete.

A topic is “0–2” when a competent junior is expected to use it correctly on the job. It becomes “2–4” when you must understand ownership, lifetime, or failure modes, not just syntax. It becomes “4+” when you must understand runtime or compiler behaviour, isolation, or system-level trade-offs.

Most ideas span levels. `@State` is a good example. At 0–2 you should say it stores view-owned value state and that mutating it refreshes the view. At 2–4 you should add that the storage lives outside the struct and that identity controls the lifetime. At 4+ you should be able to talk about invalidation, dependency tracking, and animation transactions. Same keyword, three altitudes.

---

## Filtering System

There is no search box in a Markdown file. Filter with intent.

If you are preparing for a junior role, stay on the fundamentals until you can teach them. If you are preparing for a mid role, add Observation, cancellation, dependency injection, and tests. If you are preparing for senior or staff, add system design, performance, and the “why not the other way” chapters. If you are teaching, start at the beginner explanation, then walk the same idea at the next altitude.

Importance here means “how often this shows up in interviews and production bugs,” not “how hard it is.” `@State` is beginner and still the most important SwiftUI idea in the building. Associated types with type erasure are a senior-loop topic and a distraction for junior ones.

The coloured markers in the legend are a faster version of the same map. Use them when you are skimming the night before, not as a substitute for reading the failure modes.

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

This book never presents a deprecated API as the thing you should reach for first. It still teaches deprecated and legacy APIs because real codebases and interviewers still use them. The pattern is always the same: here is what people used to write, here is what you write now, here is why Apple changed it, here is what a candidate should still be able to recognise.

| Status | Meaning | Example |
| ------ | ------- | ------- |
| **Current best practice** | Use this in new code targeting modern OS versions | `NavigationStack`, `@Observable`, `async/await`, SwiftData (when it fits) |
| **Still-supported legacy** | Know it, maintain it, migrate when cheap | `ObservableObject` + `@Published`, Core Data, Combine |
| **Deprecated** | Do not start new work here; still answer interview questions | `NavigationView`, `UIWebView`, `async` Grand-Central-Dispatch-as-the-only-model |
| **Interview-critical legacy** | You will be asked even if you never write it | MVC, delegates, `weak self`, `NSNotificationCenter` |

---

## A note on SwiftUI versus UIKit in interviews

SwiftUI is the centre of this book because that is where new iOS UI work is going. UIKit remains mandatory interview knowledge because most large apps are hybrid, because lifecycle questions are easy to ask with precision, and because collection views, cell reuse, and the responder chain still appear. Plenty of performance and memory bugs are UIKit-shaped even when the screen is SwiftUI — `UIViewRepresentable` is how they sneak in.

If a job description says “SwiftUI,” still revise UIKit lifecycle and Auto Layout. If it says “UIKit,” still revise SwiftUI state and identity. Interviewers increasingly use both.

---

## How to read a concept page

A good page, and a good spoken answer, has the same shape even when the headings differ. Start from a situation (“the view reset when I navigated back”). Name the mechanism. Say what you would write, and what you would not. Mention memory, threads, or identity if they matter. Then give the trap that sounds right in the first thirty seconds.

If you can do that for `@State`, `actor`, `Task`, and `struct` versus `class`, you are already ahead of most candidates. The rest of the book is more situations, more mechanisms, and the questions people actually ask after your first sentence.
