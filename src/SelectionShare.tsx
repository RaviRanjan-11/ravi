import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

const SUBMIT_URL = 'https://formsubmit.co/ajax/r.ranjanchn@gmail.com'
const MAX_QUOTE = 1200

type Chip = { text: string; x: number; y: number; below: boolean }
type Status = 'idle' | 'chip' | 'form' | 'sending' | 'sent' | 'error'

function allowedPath(path: string) {
  return path === '/handbook' || path.startsWith('/handbook/') || path === '/prep' || path.startsWith('/prep/')
}

function quoteFromSelection(): Chip | null {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null

  const node = sel.anchorNode
  const el = node instanceof Element ? node : node?.parentElement
  if (el?.closest('input, textarea, [contenteditable="true"], .sel-share')) return null

  const text = sel.toString().replace(/\s+/g, ' ').trim()
  if (text.length < 2) return null

  const rect = sel.getRangeAt(0).getBoundingClientRect()
  if (!rect.width && !rect.height) return null

  const pad = 72
  const x = Math.min(Math.max(rect.left + rect.width / 2, pad), window.innerWidth - pad)
  const below = rect.top < 56
  const y = below ? rect.bottom + 10 : Math.max(rect.top - 10, 12)

  return { text: text.slice(0, MAX_QUOTE), x, y, below }
}

export function SelectionShare() {
  const { pathname } = useLocation()
  const enabled = allowedPath(pathname)
  const [chip, setChip] = useState<Chip | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const barRef = useRef<HTMLDivElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setChip(null)
    setStatus('idle')
  }, [pathname])

  useEffect(() => {
    if (!enabled) return

    let timer = 0

    const hide = () => {
      if (status === 'sending') return
      setChip(null)
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
        setChip(next)
        setStatus(next ? 'chip' : 'idle')
      }, 40)
    }

    const onPointerDown = (e: PointerEvent) => {
      if (barRef.current?.contains(e.target as Node)) return
      if (status === 'sending' || status === 'form') return
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
  }, [enabled, status])

  const send = async () => {
    if (!chip || !email.trim()) return
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
          quote: chip.text,
          note: note.trim() || '(no note)',
          message: `"${chip.text}"\n\nPage: ${window.location.href}\n\nNote: ${note.trim() || '(none)'}`,
        }),
      })
      if (!res.ok) throw new Error('send failed')
      setStatus('sent')
      window.setTimeout(() => {
        setChip(null)
        setStatus('idle')
        setNote('')
        setName('')
      }, 1800)
    } catch {
      setStatus('error')
    }
  }

  if (!enabled || !chip) return null

  const formOpen = status === 'form' || status === 'sending' || status === 'error' || status === 'sent'

  return (
    <div
      ref={barRef}
      className={`sel-share${chip.below ? ' below' : ''}${formOpen ? ' dock' : ''}`}
      role={formOpen ? 'dialog' : 'toolbar'}
      aria-label="Send a review of the selected text"
      style={formOpen ? undefined : { left: chip.x, top: chip.y }}
    >
      {status === 'chip' ? (
        <button
          className="sel-share-btn"
          type="button"
          onClick={() => {
            setStatus('form')
            window.setTimeout(() => emailRef.current?.focus(), 0)
          }}
        >
          Send review
        </button>
      ) : status === 'sent' ? (
        <p className="sel-share-done">Sent. Thanks.</p>
      ) : (
        <form
          className="sel-share-form"
          onSubmit={(e) => {
            e.preventDefault()
            void send()
          }}
        >
          <p className="sel-share-kicker">Review</p>
          <p className="sel-share-quote">“{chip.text}”</p>
          <label>
            Name
            <input name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
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
          {status === 'error' ? <p className="sel-share-err">Could not send. Try again.</p> : null}
          <div className="sel-share-actions">
            <button className="btn" type="submit" disabled={status === 'sending'}>
              {status === 'sending' ? 'Sending…' : 'Send'}
            </button>
            <button
              className="btn ghost"
              type="button"
              onClick={() => {
                setChip(null)
                setStatus('idle')
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
