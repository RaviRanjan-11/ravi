import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { SiteNav } from './SiteNav'
import { Handbook } from './handbook/Handbook'

const apps = [
  {
    name: 'Physics Wallah',
    role: 'Senior iOS · Physics Wallah',
    blurb: 'Consumer education app. Auth, onboarding, IAP, and payments.',
    img: '/apps/physics-wallah.jpg',
    url: 'https://apps.apple.com/in/app/physics-wallah/id1641443555',
  },
  {
    name: 'PW MedEd',
    role: 'Senior iOS · Physics Wallah',
    blurb: 'Medical education — modules, payments, and App Store release.',
    img: '/apps/pw-meded.jpg',
    url: 'https://apps.apple.com/in/app/pw-meded/id1665727467',
  },
  {
    name: 'Xylem Education',
    role: 'iOS · Physics Wallah',
    blurb: 'Education app — native iOS shipping and ongoing iteration.',
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
    blurb: 'Sports analytics — lists, caching, and App Store delivery.',
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
      'Own authentication, onboarding, IAP, and App Store quality for Physics Wallah and PW MedEd. Mentor iOS engineers and review architecture.',
    impact:
      'Auth flows used by 70k+ users. Shipped iOS for PW Talk, an AI-powered English conversation product.',
  },
  {
    company: 'Spyne.AI',
    title: 'Senior iOS Developer',
    when: 'Previous',
    detail:
      'Shipped Spyne Automotive: capture SDK, AR video, and offline-first uploads for dealer and inspection workflows.',
    impact: 'Capture keeps going when the network drops mid-session.',
  },
  {
    company: 'Oodles Technologies',
    title: 'iOS Developer',
    when: 'Previous',
    detail:
      'Shipped Wethio Wallet (auth, marketplace) and Coachable Analysis (sports analytics) to the App Store.',
    impact: 'Wallet security and performance-sensitive list screens under client delivery pressure.',
  },
  {
    company: 'TechGropse',
    title: 'iOS Developer',
    when: 'Earlier',
    detail: 'Shipped native iOS with UIKit, networking, and App Store releases.',
    impact: 'Production iOS end to end — shipping, debugging, and owning what reached users.',
  },
]

const craft = [
  {
    title: 'iOS (deep)',
    items: ['Swift', 'SwiftUI', 'UIKit', 'Combine', 'Concurrency', 'Core Data'],
  },
  {
    title: 'Architecture',
    items: ['MVVM', 'Feature modules', 'Dependency injection', 'Testable layers'],
  },
  {
    title: 'Shipping',
    items: ['Performance', 'CI/CD', 'XCTest', 'App Store'],
  },
  {
    title: 'Backend (working)',
    items: ['Node.js', 'REST', 'MongoDB', 'WebSockets'],
  },
  {
    title: 'AI on iOS',
    items: ['Conversation UI', 'Streaming', 'Voice sessions'],
  },
]

const featured = [
  {
    kicker: 'EdTech · Physics Wallah',
    name: 'PW Talk',
    problem:
      'Spoken English practice has to feel like a conversation on a phone — including weak networks — not a worksheet.',
    role: 'iOS for conversation and assessment: session flows, performance-sensitive UI, and App Store release.',
    architecture: 'Swift · SwiftUI / UIKit · MVVM · networking · session-oriented client',
    result: 'Shipped inside Physics Wallah as an AI-powered English learning surface.',
    href: 'https://apps.apple.com/in/app/physics-wallah/id1641443555',
    link: 'App Store →',
  },
  {
    kicker: 'EdTech · Physics Wallah',
    name: 'PW authentication',
    problem: 'Students sign in and onboard every day. Silent failure here is a lost session, not a retry button.',
    role: 'Owned authentication and onboarding: reliability, main-thread UI, safe unwrapping, App Store delivery.',
    architecture: 'Swift · UIKit / SwiftUI · MVVM · REST · Keychain for secrets',
    result: '70k+ users on those auth flows.',
    href: 'https://apps.apple.com/in/app/physics-wallah/id1641443555',
    link: 'App Store →',
  },
  {
    kicker: 'Open source',
    name: 'RVNetwork',
    problem: 'URLSession copied into every view model — untestable and inconsistent.',
    role: 'Designed a protocol-oriented client: each route owns method, path, and task; the service returns Result.',
    architecture: 'Swift · URLSession · protocols · generics · injectable client',
    result: 'Fake the client in tests. Encoding and auth headers live in one pipeline.',
    href: 'https://github.com/RaviRanjan-11/RVNetwork',
    link: 'GitHub →',
  },
  {
    kicker: 'Product · Oodles',
    name: 'Wethio Wallet',
    problem: 'Wallet and marketplace flows cannot survive a failed auth or a stale screen.',
    role: 'iOS for authentication, transaction screens, and App Store delivery.',
    architecture: 'Swift · UIKit · networking · auth',
    result: 'Shipped on the App Store.',
    href: 'https://apps.apple.com/in/app/wethio-wallet/id1506566578',
    link: 'App Store →',
  },
]

const writing = [
  {
    title: 'Swift Combine — Publisher, Subscriber, Operators',
    href: 'https://medium.com/codex/swift-combine-understanding-publisher-subscriber-operator-e491112d0fad',
  },
  {
    title: 'iOS Interview: Struct vs Class',
    href: 'https://medium.com/codex/ios-interview-struct-vs-class-performance-metrics-which-one-is-faster-574bf3c8d9d4',
  },
  {
    title: 'iOS Interview: Background Fetch and Background Tasks',
    href: 'https://medium.com/codex/ios-interview-background-fetch-background-task-5ed92eb11997',
  },
  {
    title: 'Top 10 mistakes Swift developers do',
    href: 'https://medium.com/codex/top-10-mistakes-swift-developers-do-1c20e81f93c5',
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
              <p className="kicker">SDE3 · Senior iOS Engineer · Physics Wallah</p>
              <h1>Ravi Ranjan</h1>
              <p className="hero-line">
                Native iOS for education products people open every day — Swift, SwiftUI, UIKit.
              </p>
              <p className="lede">
                I own authentication, payments, SDKs, and App Store quality. Auth flows used by
                70k+ users. I design architecture a team can still change next year.
              </p>
              <p className="now">
                Open to Senior, Staff, and Lead iOS roles in <strong>Germany / Europe</strong>
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
                <h2>Who I am.</h2>
              </div>
              <div>
                <p className="lede">
                  Seven-plus years of native iOS — Swift, SwiftUI, UIKit — across authentication,
                  payments, SDKs, and consumer education apps. I care about architecture,
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
            <h2>iOS first.</h2>
            <p className="lede">
              Deep on iOS. Working knowledge of Node, MongoDB, and client-side AI when the product
              needs a server or a conversation surface.
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
            <h2>What shipped.</h2>
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
            <h2>Problem, role, result.</h2>
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
            <h2>How I think.</h2>
            <div className="case-list">
              <article>
                <h3>01 · Scalable iOS architecture</h3>
                <p>
                  <strong>Problem.</strong> Feature work outruns a tangled view layer.{' '}
                  <strong>Approach.</strong> Feature modules, dependency injection at the composition
                  root, SwiftUI or UIKit at the edge, domain kept testable.{' '}
                  <strong>Trade-off.</strong> Not VIPER on every screen. Structure only where the
                  dependency graph is real.
                </p>
              </article>
              <article>
                <h3>02 · Networking you can test</h3>
                <p>
                  <strong>Problem.</strong> URLSession copied in every view model.{' '}
                  <strong>Approach.</strong> Route protocols, typed errors, injectable client — the
                  same idea as RVNetwork.{' '}
                  <strong>Result.</strong> Fakes in unit tests; production uses one pipeline for
                  auth headers and decoding.
                </p>
              </article>
              <article>
                <h3>03 · Education apps under load</h3>
                <p>
                  <strong>Problem.</strong> Auth, IAP, and release quality on apps students open
                  daily.{' '}
                  <strong>Approach.</strong> Own user-facing reliability: request cancellation,
                  main-actor UI, fail closed on bad state.{' '}
                  <strong>Result.</strong> Production on Physics Wallah and PW MedEd. Public metric:
                  70k+ users on auth.
                </p>
              </article>
            </div>
          </section>

          <section className="section" id="architecture">
            <p className="kicker">Architecture</p>
            <h2>How I split an iOS app.</h2>
            <p className="lede">
              UI describes state. View models coordinate. Use cases own rules. Data talks to the
              network or disk. Dependencies point inward so tests do not boot UIKit. Simple before
              clever — not The Composable Architecture on a settings screen.
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
Network   Persistence`}</pre>
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
            <h2>In public.</h2>
            <p className="lede">
              Interview notes on Medium. The handbook is the longer reference — Swift concurrency,
              SwiftUI state, architecture.
            </p>
            <ul className="article-list">
              {writing.map((post) => (
                <li key={post.href}>
                  <a href={post.href} target="_blank" rel="noreferrer">
                    {post.title}
                  </a>
                </li>
              ))}
              <li>
                <Link to="/handbook">iOS handbook — concurrency, SwiftUI, architecture</Link>
              </li>
            </ul>
            <p className="social">
              <a href="https://medium.com/@r.ranjanchn" target="_blank" rel="noreferrer">
                All Medium posts →
              </a>
              <Link to="/handbook">iOS handbook →</Link>
            </p>
          </section>

          <section className="section" id="philosophy">
            <p className="kicker">How I build</p>
            <h2>Three rules.</h2>
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
            <h2>Open to Europe.</h2>
            <p className="lede">
              Looking for Senior, Staff, and Lead iOS roles in Germany and Europe. Deepening SwiftUI
              Observation, Swift Concurrency, and app architecture. Node, MongoDB, and LLM client
              work when a product needs a server or an AI path — working knowledge, not the
              headline.
            </p>
            <div className="tags">
              <span>SwiftUI Observation</span>
              <span>Swift Concurrency</span>
              <span>App architecture</span>
              <span>Node.js</span>
              <span>MongoDB</span>
              <span>AI on iOS</span>
              <span>WebSockets</span>
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
                <h2>Hiring iOS in Europe?</h2>
                <p className="lede">
                  Open to Senior, Staff, and Lead iOS roles in Germany and Europe.
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
