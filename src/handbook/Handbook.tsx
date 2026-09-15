import { useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { chapters } from './chapters'

export function Handbook() {
  const [active, setActive] = useState(chapters[0]?.id ?? '')
  const current = chapters.find((c) => c.id === active) ?? chapters[0]

  return (
    <section className="section handbook">
      <p className="kicker">Handbook</p>
      <h2>iOS &amp; SwiftUI Interview Handbook</h2>
      <p className="about-copy">
        Full text from Learn27 — Swift, SwiftUI, UIKit, architecture, interviews, and cheat sheets.
        Open a chapter on the left and read it here.
      </p>
      <div className="handbook-reader">
        <nav className="handbook-toc" aria-label="Handbook chapters">
          {chapters.map((ch) => (
            <button
              key={ch.id}
              type="button"
              className={ch.id === current.id ? 'is-on' : ''}
              onClick={() => setActive(ch.id)}
            >
              {ch.title}
            </button>
          ))}
        </nav>
        <article className="md">
          {current ? (
            <Markdown remarkPlugins={[remarkGfm]}>{current.body}</Markdown>
          ) : null}
        </article>
      </div>
    </section>
  )
}
