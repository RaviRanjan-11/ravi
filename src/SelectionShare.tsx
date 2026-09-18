import { useEffect, useRef, useState } from 'react'

const SUBMIT_URL = 'https://formsubmit.co/ajax/r.ranjanchn@gmail.com'
const MAX_QUOTE = 1200

type Pop = { text: string; x: number; y: number; below: boolean }
type Status = 'idle' | 'form' | 'sending' | 'sent' | 'error'

function quoteFromSelection(): Pop | null {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null

  const node = sel.anchorNode
  const el = node instanceof Element ? node : node?.parentElement
  if (el?.closest('input, textarea, [contenteditable="true"], .sel-share')) return null

  const text = sel.toString().replace(/\s+/g, ' ').trim()
  if (text.length < 2) return null

  const rect = sel.getRangeAt(0).getBoundingClientRect()
  if (!rect.width && !rect.height) return null

  const pad = 160
  const x = Math.min(Math.max(rect.left + rect.width / 2, pad), window.innerWidth - pad)
  const below = rect.top < 72
  const y = below ? rect.bottom + 10 : Math.max(rect.top - 10, 12)

  return { text: text.slice(0, MAX_QUOTE), x, y, below }
}

export function SelectionShare() {
  const [pop, setPop] = useState<Pop | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const barRef = useRef<HTMLDivElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let timer = 0

    const hide = () => {
      if (status === 'sending') return
      setPop(null)
      setStatus('idle')
      setNote('')
      setName('')
    }

    const show = (e: Event) => {
      if (barRef.current?.contains(e.target as Node)) return
      if (status === 'form' || status === 'sending') return
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const next = quoteFromSelection()
        setPop(next)
        if (next) {
          setStatus('form')
          window.setTimeout(() => emailRef.current?.focus(), 0)
        } else {
          setStatus('idle')
        }
      }, 40)
    }

    const onPointerDown = (e: PointerEvent) => {
      if (barRef.current?.contains(e.target as Node)) return
      if (status === 'sending') return
      hide()
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide()
    }

    const onScroll = () => {
      if (status === 'form' || status === 'sending') return
      hide()
    }

    document.addEventListener('mouseup', show)
    document.addEventListener('touchend', show, { passive: true })
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    document.addEventListener('scroll', onScroll, true)

    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('mouseup', show)
      document.removeEventListener('touchend', show)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('scroll', onScroll, true)
    }
  }, [status])

  const send = async () => {
    if (!pop || !email.trim()) return
    setStatus('sending')
    try {
      const res = await fetch(SUBMIT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          _subject: `Selection review — ${new URL(window.location.href).pathname || '/'}`,
          _captcha: 'false',
          _template: 'box',
          name: name.trim() || 'Anonymous',
          email: email.trim(),
          page: window.location.href,
          quote: pop.text,
          note: note.trim() || '(no note)',
          message: `"${pop.text}"\n\nPage: ${window.location.href}\n\nNote: ${note.trim() || '(none)'}`,
        }),
      })
      if (!res.ok) throw new Error('send failed')
      setStatus('sent')
      window.setTimeout(() => {
        setPop(null)
        setStatus('idle')
        setNote('')
        setName('')
      }, 1800)
    } catch {
      setStatus('error')
    }
  }

  if (!pop) return null

  return (
    <div
      ref={barRef}
      className={`sel-share open${pop.below ? ' below' : ''}`}
      role="dialog"
      aria-label="Send a review of the selected text"
      style={{ left: pop.x, top: pop.y }}
    >
      {status === 'sent' ? (
        <p className="sel-share-done">Sent. Thanks.</p>
      ) : (
        <form
          className="sel-share-form"
          onSubmit={(e) => {
            e.preventDefault()
            void send()
          }}
        >
          <p className="sel-share-quote">“{pop.text}”</p>
          <label>
            Name
            <input
              name="name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Email
            <input
              ref={emailRef}
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Message
            <textarea
              name="note"
              rows={3}
              placeholder="What is wrong, unclear, or worth keeping?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          {status === 'error' ? (
            <p className="sel-share-err">Could not send. Try again.</p>
          ) : null}
          <button className="btn" type="submit" disabled={status === 'sending'}>
            {status === 'sending' ? 'Sending…' : 'Send'}
          </button>
        </form>
      )}
    </div>
  )
}
