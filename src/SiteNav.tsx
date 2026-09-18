import { useState } from 'react'
import { Link } from 'react-router-dom'

export function SiteNav({ home = false }: { home?: boolean }) {
  const [open, setOpen] = useState(false)
  const to = (hash: string) => (home ? hash : `/${hash}`)

  return (
    <header className={`nav-wrap ${open ? 'open' : ''}`}>
      <div className="shell nav">
        <Link className="mark" to="/" onClick={() => setOpen(false)}>
          <img className="nav-photo" src="/ravi.jpg" alt="" />
          RR
        </Link>
        <nav>
          <a href={to('#about')} onClick={() => setOpen(false)}>
            About
          </a>
          <a href={to('#craft')} onClick={() => setOpen(false)}>
            Engineering
          </a>
          <a href={to('#experience')} onClick={() => setOpen(false)}>
            Experience
          </a>
          <a href={to('#featured')} onClick={() => setOpen(false)}>
            Work
          </a>
          <a href={to('#writing')} onClick={() => setOpen(false)}>
            Writing
          </a>
          <Link to="/prep" onClick={() => setOpen(false)}>
            Prep
          </Link>
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
      </div>
    </header>
  )
}
