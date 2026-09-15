import { useEffect } from 'react'
import { SiteNav } from './SiteNav'
import { Handbook } from './handbook/Handbook'

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
    blurb: 'Medical education product — modules, payments, and App Store release.',
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

const roles = [
  {
    company: 'Physics Wallah',
    title: 'Senior iOS Developer',
    when: 'Present',
    detail: 'Physics Wallah and PW Meded — authentication, onboarding, IAP, and high-traffic release.',
  },
  {
    company: 'Spyne.AI',
    title: 'Senior iOS Developer',
    when: 'Previous',
    detail: 'Automotive capture SDK, AR video, and offline-first upload pipelines.',
  },
  {
    company: 'Oodles Technologies',
    title: 'iOS Developer',
    when: 'Previous',
    detail: 'Wethio Wallet and Coachable Analysis — auth, marketplace, and analytics on iOS.',
  },
  {
    company: 'TechGropse',
    title: 'iOS Developer',
    when: 'Earlier',
    detail: 'Native iOS product work across UIKit, networking, and App Store delivery.',
  },
]

export function HomePage() {
  return (
    <div className="site">
      <SiteNav home />

      <main>
        <section className="hero" id="top">
          <div className="shell split">
            <div className="hero-copy">
              <p className="kicker">Senior iOS Developer</p>
              <h1>Ravi Ranjan</h1>
              <p className="lede">
                I build and ship reliable iOS apps — Swift, SwiftUI, UIKit, Combine — across
                authentication, onboarding, payments, and high-traffic consumer products.
              </p>
              <p className="now">
                Currently at <strong>Physics Wallah</strong> · Noida
              </p>
              <div className="hero-actions">
                <a className="btn" href="#work">
                  View work
                </a>
                <a className="btn ghost" href="#contact">
                  Get in touch
                </a>
                <a className="btn ghost" href="/Ravi-Ranjan-iOS.pdf">
                  Resume
                </a>
              </div>
              <p className="social">
                <a href="https://github.com/RaviRanjan-11" target="_blank" rel="noreferrer">
                  GitHub
                </a>
                <a href="https://www.linkedin.com/in/rranjanchchn/" target="_blank" rel="noreferrer">
                  LinkedIn
                </a>
                <a href="mailto:r.ranjanchn@gmail.com">Email</a>
              </p>
            </div>
            <figure className="portrait">
              <img src="/ravi.jpg" alt="Ravi Ranjan" />
            </figure>
          </div>
        </section>

        <div className="shell">
          <section className="section" id="about">
            <div className="split">
              <div>
                <p className="kicker">About</p>
                <h2>Product-minded iOS, from architecture to App Store.</h2>
              </div>
              <div>
                <p className="lede">
                  Seven-plus years building native iOS across SwiftUI and UIKit: auth systems,
                  in-app purchases, and consumer platforms at scale. Working knowledge of Node.js
                  for APIs and client–server integration. B.Tech in Computer Science, Dr APJ Abdul
                  Kalam University.
                </p>
                <div className="tags">
                  {[
                    'Swift',
                    'SwiftUI',
                    'UIKit',
                    'Combine',
                    'MVVM',
                    'Core Data',
                    'IAP',
                    'XCTest',
                    'Node.js',
                  ].map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
                <div className="stats">
                  <div>
                    <strong>7+</strong>
                    Years on iOS
                  </div>
                  <div>
                    <strong>70k+</strong>
                    Users on PW auth
                  </div>
                  <div>
                    <strong>6</strong>
                    App Store products
                  </div>
                  <div>
                    <strong>IN</strong>
                    Based in Noida
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="section" id="experience">
            <p className="kicker">Experience</p>
            <h2>Where I have shipped.</h2>
            <ol className="timeline">
              {roles.map((role) => (
                <li key={role.company}>
                  <p className="when">{role.when}</p>
                  <div>
                    <h3>{role.title}</h3>
                    <p className="company">{role.company}</p>
                    <p>{role.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="section" id="work">
            <p className="kicker">Selected work</p>
            <h2>Apps on the App Store.</h2>
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
                    <span className="app-link">App Store →</span>
                  </div>
                </a>
              ))}
            </div>
          </section>

          <section className="section" id="contact">
            <div className="split">
              <div>
                <p className="kicker">Contact</p>
                <h2>Let’s work together.</h2>
                <p className="lede">
                  Open to iOS roles and product work. I care about architecture, release quality,
                  and shipping features people actually use.
                </p>
                <p className="social">
                  <a href="mailto:r.ranjanchn@gmail.com">r.ranjanchn@gmail.com</a>
                  <a href="tel:+919711734151">+91 97117 34151</a>
                </p>
              </div>
              <form action="https://formsubmit.co/r.ranjanchn@gmail.com" method="POST">
                <input type="hidden" name="_subject" value="Portfolio — Ravi Ranjan" />
                <input type="hidden" name="_captcha" value="false" />
                <label>
                  Name
                  <input name="name" required autoComplete="name" />
                </label>
                <label>
                  Email
                  <input type="email" name="email" required autoComplete="email" />
                </label>
                <label>
                  Message
                  <textarea name="message" rows={4} required />
                </label>
                <button className="btn" type="submit">
                  Send message
                </button>
              </form>
            </div>
          </section>

          <footer>
            <span>Ravi Ranjan · Senior iOS Developer</span>
            <span>© {new Date().getFullYear()}</span>
          </footer>
        </div>
      </main>
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
      <main>
        <div className="shell">
          <Handbook />
        </div>
      </main>
    </div>
  )
}
