import { useEffect } from 'react'
import { SiteNav } from './SiteNav'
import { Handbook } from './handbook/Handbook'

export function HomePage() {
  const apps = [
    {
      name: 'Physics Wallah',
      role: 'Senior iOS · Physics Wallah',
      blurb: 'High-traffic education app. Auth, onboarding, IAP, and secure payments.',
      img: '/apps/physics-wallah.jpg',
      url: 'https://apps.apple.com/in/app/physics-wallah/id1641443555',
    },
    {
      name: 'PW MedEd',
      role: 'Senior iOS · Physics Wallah',
      blurb: 'Medical education product on the same iOS stack — modules, payments, release.',
      img: '/apps/pw-meded.jpg',
      url: 'https://apps.apple.com/in/app/pw-meded/id1665727467',
    },
    {
      name: 'Xylem Education',
      role: 'iOS · Physics Wallah',
      blurb: 'Education app on the App Store — native iOS delivery and iteration.',
      img: '/apps/xylem-education.jpg',
      url: 'https://apps.apple.com/in/app/xylem-education/id6474285321',
    },
    {
      name: 'Spyne Automotive',
      role: 'Senior iOS · Spyne.AI',
      blurb: 'Automotive capture SDK, AR video, and offline-first uploads.',
      img: '/apps/spyne-automotive.jpg',
      url: 'https://apps.apple.com/in/app/spyne-automotive/id1570801766',
    },
    {
      name: 'Wethio Wallet',
      role: 'iOS · Oodles',
      blurb: 'Blockchain wallet authentication and marketplace flows.',
      img: '/apps/wethio-wallet.jpg',
      url: 'https://apps.apple.com/in/app/wethio-wallet/id1506566578',
    },
    {
      name: 'Coachable Analysis',
      role: 'iOS · Oodles',
      blurb: 'Sports analytics on iOS — performance, caching, and tight delivery.',
      img: '/apps/coachable-analysis.jpg',
      url: 'https://apps.apple.com/in/app/coachable-analysis/id1602357403',
    },
  ]

  return (
    <div className="site">
      <SiteNav home />

      <section className="hero-band" id="top">
        <div className="shell hero">
          <div>
            <p className="eyebrow">Senior iOS Developer</p>
            <h1>
              <span>Ravi Ranjan</span>
            </h1>
            <p className="tagline">Swift • SwiftUI • UIKit • Combine • iOS</p>
            <p className="lede">
              Building and improving reliable iOS applications across authentication, onboarding,
              payments, and high-traffic consumer products.
            </p>
            <div className="hero-actions">
              <a className="btn" href="#work">
                Learn more
              </a>
              <a className="btn ghost" href="#contact">
                Get in touch
              </a>
            </div>
            <p className="social">
              <a href="https://github.com/RaviRanjan-11" target="_blank" rel="noreferrer">
                GitHub ›
              </a>
              <a href="https://www.linkedin.com/in/rranjanchchn/" target="_blank" rel="noreferrer">
                LinkedIn ›
              </a>
            </p>
          </div>
          <figure className="portrait">
            <img src="/ravi.jpg" alt="Ravi Ranjan" />
          </figure>
        </div>
      </section>

      <div className="shell">
        <section className="code-panel" aria-label="Stack">
          <div className="code-head">
            <span>RaviRanjan</span>
            <span>Portfolio.swift</span>
          </div>
          <pre>{`struct Portfolio {
    let role = "Senior iOS Developer"
    let stack = ["SwiftUI", "UIKit", "Combine"]
    let now = "Physics Wallah · PW Meded"

    func build() -> String {
        "Reliable iOS applications."
    }
}`}</pre>
        </section>

        <section className="section" id="about">
          <p className="kicker">About</p>
          <h2>About</h2>
          <p className="about-copy">
            Senior iOS Developer with 7+ years of experience building and improving applications
            across native iOS, SwiftUI and UIKit, authentication systems, in-app purchases, and
            high-traffic consumer platforms. Currently at Physics Wallah, working on Physics Wallah
            and PW Meded. Earlier roles at Spyne.AI, Oodles Technologies, and TechGropse. Working
            knowledge of Node.js for APIs and client–server integration. B.Tech in Computer Science,
            Dr APJ Abdul Kalam University.
          </p>
          <div className="tags">
            {['SwiftUI', 'UIKit', 'Combine', 'MVVM', 'Core Data', 'IAP', 'XCTest', 'Node.js'].map(
              (t) => (
                <span key={t}>{t}</span>
              ),
            )}
          </div>
          <div className="stats">
            <div>
              <strong>Noida, IN</strong>
              Based in
            </div>
            <div>
              <strong>7+ years</strong>
              Building for iOS
            </div>
            <div>
              <strong>70k+</strong>
              Users on PW auth
            </div>
            <div>
              <strong>B.Tech CSE</strong>
              Education
            </div>
          </div>
          <a className="text-link" href="/Ravi-Ranjan-iOS.pdf">
            View full resume ›
          </a>
        </section>

        <section className="section" id="work">
          <p className="kicker">Professional work</p>
          <h2>Apps I shipped on the App Store.</h2>
          <div className="app-grid">
            {apps.map((app) => (
              <a
                key={app.name}
                className="app-card"
                href={app.url}
                target="_blank"
                rel="noreferrer"
              >
                <img src={app.img} alt="" />
                <div>
                  <h3>{app.name}</h3>
                  <p className="app-role">{app.role}</p>
                  <p>{app.blurb}</p>
                  <span className="app-link">App Store ›</span>
                </div>
              </a>
            ))}
          </div>
        </section>

        <section className="section" id="resume">
          <p className="kicker">Resume</p>
          <h2>Resume</h2>
          <p className="about-copy">
            Senior iOS Developer with experience across Swift, SwiftUI, UIKit, Combine, Core Data,
            networking, architecture, testing, and App Store delivery — plus Node.js for backend
            services when the product needs it.
          </p>
          <a className="btn" href="/Ravi-Ranjan-iOS.pdf">
            View full resume
          </a>
        </section>

        <section className="section" id="contact">
          <p className="kicker">Contact</p>
          <h2>Get in touch</h2>
          <p className="about-copy">
            Open to iOS roles and product work. Building and improving reliable mobile applications
            across SwiftUI, UIKit, architecture, and release quality.
          </p>
          <p className="social">
            <a href="mailto:r.ranjanchn@gmail.com">r.ranjanchn@gmail.com</a>
            <a href="tel:+919711734151">+91 97117 34151</a>
          </p>
          <form action="https://formsubmit.co/r.ranjanchn@gmail.com" method="POST">
            <input type="hidden" name="_subject" value="Portfolio — Ravi Ranjan" />
            <input type="hidden" name="_captcha" value="false" />
            <input name="name" placeholder="Name" required />
            <input type="email" name="email" placeholder="Email" required />
            <textarea name="message" rows={4} placeholder="Message" required />
            <button className="btn" type="submit">
              Start a conversation
            </button>
          </form>
        </section>

        <footer>
          <span>Ravi Ranjan</span>
          <span>© {new Date().getFullYear()}</span>
        </footer>
      </div>
    </div>
  )
}

export function HandbookPage() {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="site">
      <SiteNav />
      <div className="shell">
        <Handbook />
      </div>
    </div>
  )
}
