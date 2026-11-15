import { ArrowUpRight, BookOpen, CalendarDays, GraduationCap, ShieldCheck, Users } from "lucide-react";

const pillars = [
  { icon: Users, title: "One school, one workspace", description: "Bring learners, staff, classes and guardians into one organised school record." },
  { icon: BookOpen, title: "Academic operations", description: "Build a clear foundation for terms, subjects, assessments and report cards." },
  { icon: ShieldCheck, title: "Privacy by design", description: "Every school will have its own protected workspace and carefully scoped access." },
];

function App() {
  return (
    <main className="page-shell">
      <nav className="topbar">
        <a className="brand" href="/" aria-label="EduManager home"><span className="brand-mark"><GraduationCap size={21} /></span><span>edu<span className="brand-accent">manager</span></span></a>
        <span className="topbar-note"><span className="status-dot" /> Platform foundation</span>
      </nav>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><CalendarDays size={15} /> BUILT FOR THE WAY SCHOOLS WORK</div>
          <h1>Less paperwork.<br /><span>More room to teach.</span></h1>
          <p className="hero-description">A clearer way to manage school operations, support teachers and keep families connected — starting with the needs of schools in Malawi.</p>
          <div className="hero-actions"><a className="primary-button" href="#foundation">Explore the foundation <ArrowUpRight size={17} /></a><span className="quiet-label">A school-first platform</span></div>
        </div>
        <div className="hero-card" aria-label="EduManager platform preview">
          <div className="card-topline"><span>YOUR SCHOOL, IN ONE PLACE</span><span className="live-pill">IN DEVELOPMENT</span></div>
          <div className="preview-title">Good morning.</div><div className="preview-subtitle">Your school workspace is taking shape.</div>
          <div className="preview-stats">
            <div><span className="stat-icon purple"><Users size={17} /></span><strong>People</strong><small>Students & staff</small></div>
            <div><span className="stat-icon green"><BookOpen size={17} /></span><strong>Learning</strong><small>Classes & results</small></div>
          </div>
          <div className="preview-footer"><span className="footer-line" /><span>Designed around your school</span></div>
        </div>
      </section>
      <section className="foundation" id="foundation">
        <div className="section-heading"><span className="eyebrow">THE FOUNDATION</span><h2>School management should feel <span>connected.</span></h2><p>EduManager is being built around three principles that guide every feature.</p></div>
        <div className="pillar-grid">{pillars.map(({ icon: Icon, title, description }, index) => <article className="pillar-card" key={title}><span className="pillar-number">0{index + 1}</span><span className="pillar-icon"><Icon size={20} /></span><h3>{title}</h3><p>{description}</p></article>)}</div>
      </section>
      <footer className="footer"><span>© {new Date().getFullYear()} EduManager</span><span>Thoughtfully built for schools in Malawi.</span></footer>
    </main>
  );
}

export default App;
