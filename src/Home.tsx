import { useEffect } from 'react'
import { Link } from 'react-router-dom'
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
    title: 'Senior iOS Engineer · SDE3',
    when: 'Present',
    detail:
      'Own native iOS for Physics Wallah and PW Meded: authentication, onboarding, IAP, and release quality on high-traffic education products.',
    impact:
      'Auth flows used by 70k+ users. Mentoring, reviews, architecture. PW Talk: iOS for AI-assisted English conversation — no confidential DAU or latency figures.',
  },
  {
    company: 'Spyne.AI',
    title: 'Senior iOS Developer',
    when: 'Previous',
    detail:
      'Automotive capture SDK, AR video, and offline-first upload pipelines for dealer and inspection workflows.',
    impact: 'Shipped Spyne Automotive on the App Store; focused on reliability when the network drops mid-capture.',
  },
  {
    company: 'Oodles Technologies',
    title: 'iOS Developer',
    when: 'Previous',
    detail: 'Wethio Wallet and Coachable Analysis — auth, marketplace, and sports analytics on iOS.',
    impact: 'Client delivery across wallet security and performance-sensitive list/analytics screens.',
  },
  {
    company: 'TechGropse',
    title: 'iOS Developer',
    when: 'Earlier',
    detail: 'Native iOS across UIKit, networking, and App Store delivery.',
    impact: 'Foundation years: shipping, debugging, and learning production iOS end to end.',
  },
]

const craft = [
  {
    title: 'iOS',
    items: ['Swift', 'SwiftUI', 'UIKit', 'Combine', 'Concurrency', 'Core Data'],
  },
  {
    title: 'Architecture',
    items: ['MVVM', 'Modularization', 'DI', 'Clean boundaries'],
  },
  {
    title: 'Backend',
    items: ['Node.js', 'REST', 'MongoDB', 'WebSockets'],
  },
  {
    title: 'AI / realtime',
    items: ['LLM surfaces', 'Streaming', 'Voice-adjacent iOS'],
  },
  {
    title: 'Engineering',
    items: ['Performance', 'CI/CD', 'XCTest', 'Analytics'],
  },
]

const featured = [
  {
    kicker: 'EdTech · Physics Wallah',
    name: 'PW Talk',
    problem:
      'Learners need spoken English practice that feels like a conversation, not a worksheet — on a phone, under real network conditions.',
    role: 'iOS engineering for conversation and assessment surfaces: performance-critical UI, session flows, and release quality. No proprietary internals here.',
    architecture: 'Swift · SwiftUI / UIKit · MVVM · networking · realtime-adjacent session work',
    result: 'Shipped on a high-traffic education product. Confidential latency and DAU numbers stay internal.',
    href: 'https://apps.apple.com/in/app/physics-wallah/id1641443555',
    link: 'App Store →',
  },
  {
    kicker: 'EdTech · Physics Wallah',
    name: 'Auth at consumer scale',
    problem: 'Students must sign in and onboard without silent failure on a product they open every day.',
    role: 'Owned authentication and onboarding paths: reliability, main-thread UI, crash-aware unwrapping, App Store delivery.',
    architecture: 'Swift · UIKit / SwiftUI · MVVM · REST · Keychain for secrets',
    result: '70k+ users on those auth flows — the only public number I will quote.',
    href: 'https://apps.apple.com/in/app/physics-wallah/id1641443555',
    link: 'App Store →',
  },
  {
    kicker: 'Open source',
    name: 'RVNetwork',
    problem: 'URLSession copied into every view model, untestable and inconsistent.',
    role: 'Designed a protocol-oriented client: routes own method/path/task; the service returns Result.',
    architecture: 'Swift · URLSession · protocols · generics · injectable client',
    result: 'Teams can fake the client in tests and keep encoding in one pipeline.',
    href: 'https://github.com/RaviRanjan-11/RVNetwork',
    link: 'GitHub →',
  },
  {
    kicker: 'Product · Oodles',
    name: 'Wethio Wallet',
    problem: 'Wallet and marketplace flows where a failed auth or a stale screen is not acceptable.',
    role: 'iOS for authentication, transaction surfaces, and delivery to the App Store.',
    architecture: 'Swift · UIKit · networking · auth',
    result: 'Shipped on the App Store. Reliability over novelty.',
    href: 'https://apps.apple.com/in/app/wethio-wallet/id1506566578',
    link: 'App Store →',
  },
]

const recommendations = [
  {
    name: 'Sukhdeep kaur',
    role: '',
    href: 'https://www.linkedin.com/in/sukhdeep-kaur-582477101',
    img: '/recs/sukhdeep.jpg',
    quotes: [
      "I highly recommend Ravi as an iOS developer and team leader. We collaborated on a blockchain wallet application, and Ravi's skills in project execution and team management were truly impressive.",
      "Ravi's iOS development expertise ensured the success of our project. His attention to detail and ability to navigate complexities resulted in a high-quality application that surpassed client expectations.",
      "As a team leader, Ravi's strategic approach kept the project on track. His communication and problem-solving skills, coupled with a dedication to client satisfaction, make him an asset to any team.",
      "I confidently recommend Ravi for any iOS development or leadership role; he's an exceptional professional.",
    ],
  },
  {
    name: 'Shwetansh Srivastava',
    role: 'Computer Scientist II, Adobe',
    href: 'https://www.linkedin.com/in/shwetansh-srivastava',
    img: '/recs/shwetansh.jpg',
    quotes: [
      "I had the privilege of collaborating with Ravi Ranjan, an exceptional iOS developer and proficient team leader. Ravi's technical prowess in iOS development, including Swift, Objective-C, and React Native, is truly commendable; his coding skills consistently result in high-quality, efficient solutions.",
      'What distinguishes Ravi is his remarkable leadership acumen. As a team lead, he creates a collaborative and positive work culture, motivating team members to excel. Under his guidance, our team achieved unprecedented productivity and cohesion.',
      "Ravi's dedication and positive approach make him a pleasure to work with, and his commitment to staying abreast of industry trends showcases his passion for iOS development.",
      'I highly recommend Ravi for his outstanding skills and positive impact on both projects and teams.',
    ],
  },
  {
    name: 'Colleague',
    role: 'LinkedIn recommendation',
    href: '',
    img: '/recs/rec-hardworking.jpg',
    quotes: [
      "I know him as a hardworking & very serious team player. Result oriented, responsible & a person with strong ownership and driving for results all the time. He is an asset to any company that he's with.",
    ],
  },
  {
    name: 'Colleague',
    role: 'TechGropse',
    href: '',
    img: '/recs/rec-techgropse.jpg',
    quotes: [
      'I had the pleasure of working with Ravi in TechGropse. Ravi is a goal oriented professional with fantastic ideas and foresight with an ever growing market. I would recommend Ravi to anyone seeking his services.',
    ],
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
              <p className="kicker">SDE3 · Senior iOS Engineer</p>
              <h1>Ravi Ranjan</h1>
              <p className="hero-line">
                Senior iOS Engineer building scalable, high-performance mobile products.
              </p>
              <p className="lede">
                Swift · SwiftUI · UIKit · architecture · performance · AI / realtime. I own the
                hard paths — auth, payments, SDKs, conversation surfaces — and the trade-offs that
                keep a team shipping.
              </p>
              <p className="now">
                Physics Wallah · Exploring senior iOS roles in <strong>Germany / Europe</strong>
              </p>
              <div className="hero-actions">
                <a className="btn" href="/Ravi-Ranjan-iOS.pdf">
                  Download resume
                </a>
                <a className="btn ghost" href="#featured">
                  View work
                </a>
                <a className="btn ghost" href="#contact">
                  Contact
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
                <a href="https://medium.com/@r.ranjanchn" target="_blank" rel="noreferrer">
                  Medium
                </a>
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
                <h2>Who I am, and the problems I take on.</h2>
              </div>
              <div>
                <p className="lede">
                  Seven-plus years of native iOS — Swift, SwiftUI, UIKit — across authentication,
                  payments, SDKs, and consumer education at scale. I care about architecture,
                  networking, performance, and whether the team can still change the code in a year.
                  B.Tech CSE, Dr APJ Abdul Kalam University.
                </p>
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
                    <strong>EU</strong>
                    Open to Europe
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="section" id="craft">
            <p className="kicker">Engineering</p>
            <h2>What I work on.</h2>
            <p className="lede">
              Deep on iOS. Adjacent on backend, realtime, and AI when the product requires it — not
              a dump of every tool I have opened.
            </p>
            <div className="craft-grid">
              {craft.map((col) => (
                <div key={col.title} className="craft-col">
                  <h3>{col.title}</h3>
                  <ul>
                    {col.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section className="section" id="experience">
            <p className="kicker">Experience</p>
            <h2>What I actually did.</h2>
            <ol className="timeline">
              {roles.map((role) => (
                <li key={role.company}>
                  <p className="when">{role.when}</p>
                  <div>
                    <h3>{role.title}</h3>
                    <p className="company">{role.company}</p>
                    <p>{role.detail}</p>
                    <p className="impact">{role.impact}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="section" id="featured">
            <p className="kicker">Featured projects</p>
            <h2>Problem, ownership, result.</h2>
            <div className="feature-grid">
              {featured.map((p) => (
                <article className="feature-card" key={p.name}>
                  <p className="app-role">{p.kicker}</p>
                  <h3>{p.name}</h3>
                  <p>
                    <strong>Problem.</strong> {p.problem}
                  </p>
                  <p>
                    <strong>Role.</strong> {p.role}
                  </p>
                  <p>
                    <strong>Architecture.</strong> {p.architecture}
                  </p>
                  <p>
                    <strong>Result.</strong> {p.result}
                  </p>
                  <a className="app-link" href={p.href} target="_blank" rel="noreferrer">
                    {p.link}
                  </a>
                </article>
              ))}
            </div>
          </section>

          <section className="section" id="cases">
            <p className="kicker">Case studies</p>
            <h2>How I think through a problem.</h2>
            <div className="case-list">
              <article>
                <h3>01 · Scalable iOS architecture</h3>
                <p>
                  <strong>Problem.</strong> Feature velocity without a spaghetti view layer.{' '}
                  <strong>Approach.</strong> Feature modules, DI at the composition root, SwiftUI
                  or UIKit at the edge, domain kept testable.{' '}
                  <strong>Trade-off.</strong> Not VIPER on every screen. Ceremony only where the
                  graph is real.
                </p>
              </article>
              <article>
                <h3>02 · Networking you can test</h3>
                <p>
                  <strong>Problem.</strong> URLSession copied in every view model.{' '}
                  <strong>Approach.</strong> Route protocols, typed errors, injectable client —
                  the same idea as RVNetwork.{' '}
                  <strong>Result.</strong> Fakes in unit tests; production uses one pipeline for
                  auth headers and decoding.
                </p>
              </article>
              <article>
                <h3>03 · Education apps under load</h3>
                <p>
                  <strong>Problem.</strong> Auth, IAP, and release on products many students open
                  daily.{' '}
                  <strong>Approach.</strong> Own the user-facing reliability: cancellation, main-actor
                  UI, crash-aware unwraps.{' '}
                  <strong>Boundary.</strong> No internal APIs, diagrams, or confidential numbers
                  here.
                </p>
              </article>
            </div>
          </section>

          <section className="section" id="architecture">
            <p className="kicker">Architecture</p>
            <h2>How I prefer to split an iOS app.</h2>
            <p className="lede">
              UI describes state. View models coordinate. Use cases own rules. Data talks to REST
              or a socket. Dependencies point inward so tests do not boot UIKit. Simple before
              clever — not TCA on a settings screen.
            </p>
            <pre className="arch-diagram">{`SwiftUI / UIKit UI
        │
        ▼
    ViewModel
        │
        ▼
    Use cases
        │
   ┌────┴────┐
   ▼         ▼
API client  WebSocket
   │         │
Backend   Realtime / AI`}</pre>
          </section>

          <section className="section" id="work">
            <p className="kicker">App Store</p>
            <h2>Shipped products.</h2>
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

          <section className="section" id="writing">
            <p className="kicker">Technical writing</p>
            <h2>How I think, in public.</h2>
            <p className="lede">
              Short notes on Medium. The handbook is the long interview reference — concurrency,
              SwiftUI state, architecture.
            </p>
            <ul className="article-list">
              <li>Swift concurrency: async/await vs actors</li>
              <li>Architecting a large SwiftUI application</li>
              <li>Realtime / WebSocket patterns on iOS</li>
              <li>SwiftUI performance: common mistakes</li>
              <li>UIKit → SwiftUI without a rewrite weekend</li>
              <li>Protocol-oriented networking (RVNetwork)</li>
            </ul>
            <p className="social">
              <a href="https://medium.com/@r.ranjanchn" target="_blank" rel="noreferrer">
                Medium →
              </a>
              <Link to="/handbook">iOS handbook →</Link>
            </p>
          </section>

          <section className="section" id="philosophy">
            <p className="kicker">How I build</p>
            <h2>Three rules I actually use.</h2>
            <div className="quotes">
              <blockquote>
                <p>Simple before clever. Architectures should be easy to test and change.</p>
              </blockquote>
              <blockquote>
                <p>Measure before optimizing. Performance is a claim until Instruments agrees.</p>
              </blockquote>
              <blockquote>
                <p>Own the problem, not just the ticket. Senior work is the trade-off.</p>
              </blockquote>
            </div>
          </section>

          <section className="section" id="exploring">
            <p className="kicker">Now</p>
            <h2>Currently exploring.</h2>
            <p className="lede">
              Exploring senior iOS / mobile engineering in Europe, with particular interest in
              Germany. Deepening SwiftUI, Swift Concurrency, Observation, and modern app
              architecture — plus Node, MongoDB, and LLM surfaces when the product needs a server
              or an AI path.
            </p>
            <div className="tags">
              <span>SwiftUI Observation</span>
              <span>Swift Concurrency</span>
              <span>Node.js</span>
              <span>Backend APIs</span>
              <span>MongoDB</span>
              <span>AI / LLMs</span>
              <span>WebSockets</span>
              <span>Shipping independently</span>
            </div>
          </section>

          <section className="section" id="recommend">
            <p className="kicker">Recommendations</p>
            <h2>From LinkedIn.</h2>
            <div className="rec-scroller">
              {recommendations.map((rec) => (
                <article className="rec-card" key={rec.img}>
                  <header className="rec-head">
                    <img className="rec-photo" src={rec.img} alt={rec.name} />
                    <div>
                      <h3>
                        {rec.href ? (
                          <a href={rec.href} target="_blank" rel="noreferrer">
                            {rec.name}
                          </a>
                        ) : (
                          rec.name
                        )}
                      </h3>
                      {rec.role ? <p className="rec-role">{rec.role}</p> : null}
                    </div>
                  </header>
                  <blockquote>
                    {rec.quotes.map((q) => (
                      <p key={q.slice(0, 40)}>{q}</p>
                    ))}
                  </blockquote>
                </article>
              ))}
            </div>
          </section>

          <section className="section" id="contact">
            <div className="split">
              <div>
                <p className="kicker">Contact</p>
                <h2>Let’s build something.</h2>
                <p className="lede">
                  Open to Senior / Staff / Lead iOS and mobile engineering in Germany and Europe.
                </p>
                <p className="social">
                  <a href="mailto:r.ranjanchn@gmail.com">r.ranjanchn@gmail.com</a>
                  <a href="tel:+919711734151">+91 97117 34151</a>
                  <a href="/Ravi-Ranjan-iOS.pdf">Resume</a>
                  <a href="https://github.com/RaviRanjan-11" target="_blank" rel="noreferrer">
                    GitHub
                  </a>
                  <a href="https://www.linkedin.com/in/rranjanchchn/" target="_blank" rel="noreferrer">
                    LinkedIn
                  </a>
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
            <span>Ravi Ranjan · Senior iOS Engineer</span>
            <span className="social">
              <a href="/Ravi-Ranjan-iOS.pdf">Resume</a>
              <a href="https://github.com/RaviRanjan-11" target="_blank" rel="noreferrer">
                GitHub
              </a>
              <a href="https://www.linkedin.com/in/rranjanchchn/" target="_blank" rel="noreferrer">
                LinkedIn
              </a>
              <a href="mailto:r.ranjanchn@gmail.com">Email</a>
            </span>
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
