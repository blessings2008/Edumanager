import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ClipboardCheck,
  GraduationCap,
  HeartHandshake,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";

const capabilities = [
  {
    icon: Users,
    number: "01",
    title: "People & enrolment",
    description:
      "Keep student, guardian and staff information organised, with clear school relationships.",
    status: "Planned for the school workspace",
  },
  {
    icon: BookOpen,
    number: "02",
    title: "Academic management",
    description:
      "Set up academic years, terms, classes, subjects and the structures behind learning.",
    status: "Planned for the school workspace",
  },
  {
    icon: ClipboardCheck,
    number: "03",
    title: "Attendance & results",
    description:
      "Build dependable workflows for attendance, assessment, review and report cards.",
    status: "Planned for the school workspace",
  },
  {
    icon: Wallet,
    number: "04",
    title: "Fees & accountability",
    description:
      "Work towards clearer fee records, payment history and traceable receipts.",
    status: "Planned for the school workspace",
  },
];

const principles = [
  {
    icon: ShieldCheck,
    title: "School-scoped by design",
    description:
      "Each school needs its own authorised workspace. A school name or web address is never a substitute for access control.",
  },
  {
    icon: HeartHandshake,
    title: "Built around real school roles",
    description:
      "Administrators, teachers, learners and guardians should each have a clear, appropriate experience.",
  },
  {
    icon: CalendarDays,
    title: "Designed for Malawi",
    description:
      "A mobile-conscious experience, Africa/Blantyre time and school-configurable academic structures.",
  },
];

function App() {
  return (
    <main>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-header">
        <div className="container header-inner">
          <a className="brand" href="#home" aria-label="EduManager home">
            <span className="brand-mark"><GraduationCap size={22} strokeWidth={2.2} /></span>
            <span className="brand-word">edu<span>manager</span></span>
          </a>
          <nav className="main-nav" aria-label="Main navigation">
            <a href="#platform">Platform</a>
            <a href="#how-it-works">Our approach</a>
            <a href="#about">About</a>
          </nav>
          <a className="header-link" href="#platform">Explore the platform <ArrowUpRight size={16} /></a>
        </div>
      </header>

      <section className="hero-section" id="home" aria-labelledby="hero-title">
        <div className="container hero-grid" id="main-content">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-dot" /> A SCHOOL MANAGEMENT PLATFORM</div>
            <h1 id="hero-title">Bring your school<br /><span>into focus.</span></h1>
            <p className="hero-lede">
              Less time chasing paperwork. More clarity across the people,
              learning and everyday work that keep a school moving.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#platform">Discover EduManager <ArrowRight size={17} /></a>
              <a className="text-link" href="#how-it-works">See what we're building</a>
            </div>
            <div className="hero-footnote"><span className="footnote-mark"><Check size={13} /></span> Designed with Malawian schools in mind</div>
          </div>

          <div className="product-visual" aria-label="Illustrative EduManager workspace preview">
            <div className="visual-orbit orbit-one" />
            <div className="visual-orbit orbit-two" />
            <div className="workspace-card">
              <div className="workspace-top">
                <div className="workspace-brand"><span className="mini-mark"><GraduationCap size={14} /></span><span>School workspace</span></div>
                <span className="preview-label">CONCEPT PREVIEW</span>
              </div>
              <div className="workspace-welcome">
                <span className="workspace-kicker">YOUR SCHOOL, MORE ORGANISED</span>
                <h2>A clearer view<br />of school life.</h2>
                <p>One considered place for the work that matters.</p>
              </div>
              <div className="workspace-tiles">
                <div className="workspace-tile tile-blue"><span className="tile-icon"><Users size={17} /></span><span className="tile-title">People</span><span className="tile-caption">Students · Staff · Families</span></div>
                <div className="workspace-tile tile-green"><span className="tile-icon"><BookOpen size={17} /></span><span className="tile-title">Academics</span><span className="tile-caption">Classes · Subjects · Terms</span></div>
                <div className="workspace-tile tile-gold"><span className="tile-icon"><ClipboardCheck size={17} /></span><span className="tile-title">School day</span><span className="tile-caption">Attendance · Assessments</span></div>
                <div className="workspace-tile tile-violet"><span className="tile-icon"><Wallet size={17} /></span><span className="tile-title">Finance</span><span className="tile-caption">Fees · Payments · Receipts</span></div>
              </div>
              <div className="workspace-bottom"><span className="bottom-line" /><span>Illustrative interface · Not connected to live school data</span></div>
            </div>
            <div className="floating-note"><span className="floating-icon"><ShieldCheck size={17} /></span><span><strong>Privacy matters</strong><small>Access designed around school roles</small></span></div>
          </div>
        </div>
      </section>

      <section className="trust-strip" aria-label="Product priorities">
        <div className="container trust-inner">
          <span>MADE FOR THE RHYTHM OF SCHOOL LIFE</span>
          <div><Users size={16} /> People first</div>
          <div><BookOpen size={16} /> Learning centred</div>
          <div><ShieldCheck size={16} /> Privacy conscious</div>
        </div>
      </section>

      <section className="section platform-section" id="platform">
        <div className="container">
          <div className="section-intro">
            <div>
              <span className="eyebrow">THE PLATFORM</span>
              <h2>One connected picture<br /><span>of your school.</span></h2>
            </div>
            <p>EduManager is being developed as a practical home for school administration and academic operations. These are the capabilities guiding the product—not a claim that every module is live today.</p>
          </div>
          <div className="capability-grid">
            {capabilities.map(({ icon: Icon, number, title, description, status }) => (
              <article className="capability-card" key={number}>
                <div className="capability-top"><span className="capability-icon"><Icon size={20} /></span><span className="capability-number">{number}</span></div>
                <h3>{title}</h3>
                <p>{description}</p>
                <span className="capability-status"><span />{status}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="approach-section" id="how-it-works">
        <div className="container approach-grid">
          <div className="approach-heading">
            <span className="eyebrow eyebrow-light">OUR APPROACH</span>
            <h2>Useful for the people<br />who make schools work.</h2>
            <p>Good school software should make everyday responsibilities easier to understand—not add another layer of complexity.</p>
            <a className="approach-link" href="#about">The thinking behind EduManager <ArrowUpRight size={16} /></a>
          </div>
          <div className="principle-list">
            {principles.map(({ icon: Icon, title, description }, index) => (
              <article className="principle-item" key={title}>
                <span className="principle-index">0{index + 1}</span>
                <span className="principle-icon"><Icon size={20} /></span>
                <div><h3>{title}</h3><p>{description}</p></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="closing-section" id="about">
        <div className="container closing-card">
          <div className="closing-symbol"><GraduationCap size={25} /></div>
          <span className="eyebrow">A BETTER SCHOOL WORKFLOW STARTS HERE</span>
          <h2>Thoughtfully built for<br /><span>what comes next.</span></h2>
          <p>EduManager is under active development. We're laying the foundations carefully, with the needs of Malawian schools at the centre.</p>
          <a className="button button-primary" href="#home">Back to the beginning <ArrowUpRight size={17} /></a>
        </div>
      </section>

      <footer className="site-footer">
        <div className="container footer-inner">
          <a className="brand footer-brand" href="#home"><span className="brand-mark"><GraduationCap size={20} /></span><span className="brand-word">edu<span>manager</span></span></a>
          <p>School management, made clearer.</p>
          <span>© {new Date().getFullYear()} EduManager. All rights reserved.</span>
        </div>
      </footer>
    </main>
  );
}

export default App;
