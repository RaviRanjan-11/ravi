import { useEffect, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { SiteNav } from '../SiteNav'
import { mockInterview } from './mock'
import { prepDays } from './index'
import type { Difficulty, Problem } from './types'

const md = { remarkPlugins: [remarkGfm] }

const difficultyLabel: Record<Difficulty, string> = {
  Intermediate: '🟢 Intermediate',
  Advanced: '🟡 Advanced',
  Senior: '🔴 Senior',
  Expert: '🔥 Expert',
}

function ProblemCard({ problem, mock = false }: { problem: Problem; mock?: boolean }) {
  const [open, setOpen] = useState(false)

  return (
    <article className="prep-problem" id={problem.id}>
      <header className="prep-problem-head">
        <p className="prep-meta">
          <span>{difficultyLabel[problem.difficulty]}</span>
          <span>{problem.kind}</span>
        </p>
        <h3>{problem.title}</h3>
      </header>

      <h4>🔴 Interview problem</h4>
      <div className="md prep-md">
        <Markdown {...md}>{problem.prompt}</Markdown>
      </div>

      <h4>🧠 Think first</h4>
      <ul className="prep-think">
        {problem.think.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      {open ? (
        <div className="prep-reveal">
          <h4>{mock ? '💡 Expected answer' : '💡 Solution'}</h4>
          <div className="md prep-md">
            <Markdown {...md}>{problem.solution}</Markdown>
          </div>

          <h4>🔍 Deep explanation</h4>
          <div className="md prep-md">
            <Markdown {...md}>{problem.explanation}</Markdown>
          </div>

          <h4>⚙️ What happens internally?</h4>
          <div className="md prep-md">
            <Markdown {...md}>{problem.internals}</Markdown>
          </div>

          <h4>🧪 How would you test it?</h4>
          <div className="md prep-md">
            <Markdown {...md}>{problem.testing}</Markdown>
          </div>

          <h4>⚠️ What can go wrong?</h4>
          <div className="md prep-md">
            <Markdown {...md}>{problem.pitfalls}</Markdown>
          </div>

          <h4>🔄 Alternative solutions</h4>
          <div className="md prep-md">
            <Markdown {...md}>{problem.alternatives}</Markdown>
          </div>

          <h4>{mock ? '🎯 Senior evaluation' : '🎯 Senior-level trade-offs'}</h4>
          <div className="md prep-md">
            <Markdown {...md}>{problem.tradeoffs}</Markdown>
          </div>

          <h4>🔥 Follow-up interview questions</h4>
          <ol className="prep-followups">
            {problem.followups.map((fu) => (
              <li key={fu.q}>
                <p className="prep-fq">{fu.q}</p>
                <p className="prep-fa">{fu.a}</p>
              </li>
            ))}
          </ol>

          <h4>🧩 What this problem teaches</h4>
          <ul className="prep-teaches">
            {problem.teaches.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>

          <button className="btn ghost" type="button" onClick={() => setOpen(false)}>
            Hide solution
          </button>
        </div>
      ) : (
        <button className="btn" type="button" onClick={() => setOpen(true)}>
          {mock ? 'Reveal expected answer' : 'Reveal solution'}
        </button>
      )}
    </article>
  )
}

const toc = [
  ...prepDays.map((d) => ({ id: d.id, label: d.title })),
  { id: mockInterview.id, label: mockInterview.title },
]

export function Prep() {
  const [active, setActive] = useState(() => {
    const hash = window.location.hash.replace('#', '')
    if (prepDays.some((d) => d.id === hash) || hash === mockInterview.id) return hash
    return prepDays[0]?.id ?? 'day-1'
  })
  const day = prepDays.find((d) => d.id === active)
  const isMock = active === mockInterview.id

  const select = (id: string) => {
    setActive(id)
    window.history.replaceState(null, '', `#${id}`)
    window.scrollTo({ top: 0 })
  }

  return (
    <section className="section handbook prep">
      <p className="kicker">10-day interview prep</p>
      <h2>Real senior iOS interviews.</h2>
      <p className="lede prep-lede">
        Twelve problems a day, each one a real interview — including a full SwiftUI day, not a sidebar
        on UIKit. You sit with the question first. The solution is how you actually learn the
        concept.
      </p>
      <p className="prep-note">
        Aimed at four-plus years. No “what is a class.” Most items are senior or expert. Read the
        think list out loud, then reveal. Select a line to email a review.
      </p>
      <div className="handbook-reader prep-reader">
        <nav className="handbook-toc" aria-label="Prep days">
          {toc.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === active ? 'is-on' : ''}
              onClick={() => select(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="prep-panel">
          {day ? (
            <>
              <p className="kicker">{day.kicker}</p>
              <h3 className="prep-day-title">{day.title}</h3>
              <p className="lede">{day.intro}</p>
              {day.problems.map((problem) => (
                <ProblemCard key={problem.id} problem={problem} />
              ))}
            </>
          ) : null}
          {isMock && !day ? (
            <>
              <p className="kicker">{mockInterview.kicker}</p>
              <h3 className="prep-day-title">{mockInterview.title}</h3>
              <p className="lede">{mockInterview.intro}</p>
              <p className="prep-mock-banner">
                Do not reveal until you have answered. A loop is 45–60 minutes; pick a section or sit
                the whole set.
              </p>
              {mockInterview.sections.map((section) => (
                <div key={section.id} className="prep-section">
                  <h3 className="prep-section-title">
                    {section.title}
                    <span>{section.countLabel}</span>
                  </h3>
                  {section.problems.map((problem) => (
                    <ProblemCard key={problem.id} problem={problem} mock />
                  ))}
                </div>
              ))}
            </>
          ) : null}
        </div>
      </div>
    </section>
  )
}

export function PrepPage() {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="site">
      <SiteNav />
      <main>
        <div className="shell prep-shell">
          <Prep />
        </div>
      </main>
    </div>
  )
}
