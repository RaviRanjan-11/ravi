import { useState } from 'react'
import { Link } from 'react-router-dom'

export function SiteNav({ home = false }: { home?: boolean }) {
  const [open, setOpen] = useState(false)
  const to = (hash: string) => (home ? hash : `/${hash}`)

  return (
    <div className="shell">
      <header className={`nav ${open ? 'open' : ''}`}>
        <Link className="mark" to="/" onClick={() => setOpen(false)}>
          <img className="nav-photo" src="/ravi.jpg" alt="" />
          RR
        </Link>
        <nav>
          <Link to="/" onClick={() => setOpen(false)}>
            Home
          </Link>
          <a href={to('#about')} onClick={() => setOpen(false)}>
            About
          </a>
          <a href={to('#work')} onClick={() => setOpen(false)}>
            Work
          </a>
          <Link to="/handbook" onClick={() => setOpen(false)}>
            Handbook
          </Link>
          <a href="/Ravi-Ranjan-iOS.pdf" onClick={() => setOpen(false)}>
            Resume
          </a>
          <a href={to('#contact')} onClick={() => setOpen(false)}>
            Contact
          </a>
        </nav>
        <button className="burger" type="button" onClick={() => setOpen((v) => !v)}>
          Menu
        </button>
      </header>
    </div>
  )
}
