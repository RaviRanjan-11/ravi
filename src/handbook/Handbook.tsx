import { isValidElement, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { chapters } from './chapters'

function slugify(raw: string) {
  return raw
    .toLowerCase()
    .trim()
    .replace(/&/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function aliasSlugs(title: string) {
  const slugs = [slugify(title)]
  const stripped = title
    .replace(/^PART [IVXLCDM]+ — /i, '')
    .replace(/^FINAL — /i, '')
    .replace(/^Additional Depth — /i, '')
  if (stripped !== title) slugs.push(slugify(stripped))
  return [...new Set(slugs.filter(Boolean))]
}

function headingText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(headingText).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) return headingText(node.props.children)
  return ''
}

const headingIndex = (() => {
  const map = new Map<string, { chapter: string; id: string }>()
  const heading = /^(#{1,6})\s+(.+)$/gm
  for (const ch of chapters) {
    heading.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = heading.exec(ch.body))) {
      const title = match[2].replace(/#+\s*$/, '').trim()
      const id = slugify(title)
      for (const slug of aliasSlugs(title)) {
        if (!map.has(slug)) map.set(slug, { chapter: ch.id, id })
      }
    }
  }
  return map
})()

export function Handbook() {
  const [active, setActive] = useState(chapters[0]?.id ?? '')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const articleRef = useRef<HTMLElement>(null)
  const current = chapters.find((c) => c.id === active) ?? chapters[0]

  const jump = (raw: string) => {
    const slug = slugify(decodeURIComponent(raw))
    const hit = headingIndex.get(slug) ?? headingIndex.get(raw)
    if (!hit) return
    if (hit.chapter === active) {
      articleRef.current?.querySelector(`#${CSS.escape(hit.id)}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
      return
    }
    setActive(hit.chapter)
    setPendingId(hit.id)
  }

  useEffect(() => {
    if (!pendingId) return
    const id = pendingId
    const frame = requestAnimationFrame(() => {
      articleRef.current?.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
      setPendingId(null)
    })
    return () => cancelAnimationFrame(frame)
  }, [active, pendingId, current?.body])

  const components = useMemo(
    () => ({
      h1: ({ children }: { children?: ReactNode }) => {
        const id = slugify(headingText(children))
        return <h1 id={id}>{children}</h1>
      },
      h2: ({ children }: { children?: ReactNode }) => {
        const id = slugify(headingText(children))
        return <h2 id={id}>{children}</h2>
      },
      h3: ({ children }: { children?: ReactNode }) => {
        const id = slugify(headingText(children))
        return <h3 id={id}>{children}</h3>
      },
      h4: ({ children }: { children?: ReactNode }) => {
        const id = slugify(headingText(children))
        return <h4 id={id}>{children}</h4>
      },
      a: ({ href, children }: { href?: string; children?: ReactNode }) => {
        if (href?.startsWith('#')) {
          return (
            <a
              href={href}
              onClick={(e) => {
                e.preventDefault()
                jump(href.slice(1))
              }}
            >
              {children}
            </a>
          )
        }
        return (
          <a href={href} target="_blank" rel="noreferrer">
            {children}
          </a>
        )
      },
    }),
    [active],
  )

  return (
    <section className="section handbook">
      <p className="kicker">Handbook</p>
      <h2>iOS &amp; SwiftUI Interview Handbook</h2>
      <p className="lede">
        Full text from Learn27 — Swift, SwiftUI, UIKit, architecture, interviews, and cheat sheets.
        Use the table of contents or the chapter list; links jump to the matching section.
      </p>
      <div className="handbook-reader">
        <nav className="handbook-toc" aria-label="Handbook chapters">
          {chapters.map((ch) => (
            <button
              key={ch.id}
              type="button"
              className={ch.id === current.id ? 'is-on' : ''}
              onClick={() => {
                setPendingId(null)
                setActive(ch.id)
                  articleRef.current?.scrollIntoView({ block: 'start' })
              }}
            >
              {ch.title}
            </button>
          ))}
        </nav>
        <article className="md" ref={articleRef}>
          {current ? (
            <Markdown remarkPlugins={[remarkGfm]} components={components}>
              {current.body}
            </Markdown>
          ) : null}
        </article>
      </div>
    </section>
  )
}
