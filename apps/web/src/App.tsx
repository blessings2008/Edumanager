import { useMemo, useState } from "react";
import type * as React from "react";
import {
  ArrowUpRight, Bell, BookOpen, CalendarDays, CheckCircle2, ChevronDown,
  ChevronLeft, ChevronRight, CircleHelp, ClipboardCheck, CreditCard, Download,
  FileBarChart, GraduationCap, LayoutDashboard, Menu, MoreHorizontal, Plus,
  Search, Settings, ShieldCheck, SlidersHorizontal, UserRound, Users, Wallet,
  X, Clock3, AlertCircle, CircleDollarSign, School, Sparkles,
} from "lucide-react";

type Page = "Overview" | "Students" | "Attendance" | "Academics" | "Finance" | "Staff" | "Reports" | "Settings";
type Student = { id: string; name: string; className: string; guardian: string; phone: string; status: "Active" | "Pending" };

const initialStudents: Student[] = [
  { id: "EDU-0018", name: "Chisomo Banda", className: "Form 2 North", guardian: "Grace Banda", phone: "+265 888 120 441", status: "Active" },
  { id: "EDU-0017", name: "Tadala Phiri", className: "Form 1 South", guardian: "Peter Phiri", phone: "+265 999 210 763", status: "Active" },
  { id: "EDU-0016", name: "Thoko Kamanga", className: "Standard 7", guardian: "Memory Kamanga", phone: "+265 881 330 124", status: "Active" },
  { id: "EDU-0015", name: "Mphatso Chirwa", className: "Form 3 North", guardian: "James Chirwa", phone: "+265 888 404 912", status: "Pending" },
  { id: "EDU-0014", name: "Pempho Zulu", className: "Form 2 South", guardian: "Agnes Zulu", phone: "+265 999 510 204", status: "Active" },
  { id: "EDU-0013", name: "Dalitso Mbewe", className: "Standard 6", guardian: "John Mbewe", phone: "+265 881 712 332", status: "Active" },
];

const initialAttendance = [
  { id: "EDU-0018", name: "Chisomo Banda", className: "Form 2 North", status: "Present" },
  { id: "EDU-0017", name: "Tadala Phiri", className: "Form 1 South", status: "Present" },
  { id: "EDU-0016", name: "Thoko Kamanga", className: "Standard 7", status: "Absent" },
  { id: "EDU-0015", name: "Mphatso Chirwa", className: "Form 3 North", status: "Late" },
  { id: "EDU-0014", name: "Pempho Zulu", className: "Form 2 South", status: "Present" },
  { id: "EDU-0013", name: "Dalitso Mbewe", className: "Standard 6", status: "Present" },
];

const navItems: { label: Page; icon: typeof LayoutDashboard; group: string }[] = [
  { label: "Overview", icon: LayoutDashboard, group: "WORKSPACE" },
  { label: "Students", icon: Users, group: "WORKSPACE" },
  { label: "Attendance", icon: ClipboardCheck, group: "WORKSPACE" },
  { label: "Academics", icon: BookOpen, group: "WORKSPACE" },
  { label: "Finance", icon: Wallet, group: "MANAGEMENT" },
  { label: "Staff", icon: UserRound, group: "MANAGEMENT" },
  { label: "Reports", icon: FileBarChart, group: "MANAGEMENT" },
  { label: "Settings", icon: Settings, group: "SYSTEM" },
];

const money = (amount: number) => new Intl.NumberFormat("en-MW", { style: "currency", currency: "MWK", maximumFractionDigits: 0 }).format(amount);

function App() {
  const [page, setPage] = useState<Page>("Overview");
  const [students, setStudents] = useState(initialStudents);
  const [attendance, setAttendance] = useState(initialAttendance);
  const [query, setQuery] = useState("");
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [notice, setNotice] = useState("");
  const [period, setPeriod] = useState("This term");

  const filteredStudents = useMemo(() => students.filter((student) =>
    [student.name, student.id, student.className, student.guardian].join(" ").toLowerCase().includes(query.toLowerCase())
  ), [students, query]);

  const presentCount = attendance.filter((item) => item.status === "Present").length;
  const absentCount = attendance.filter((item) => item.status === "Absent").length;
  const lateCount = attendance.filter((item) => item.status === "Late").length;

  const go = (next: Page) => { setPage(next); setQuery(""); setMobileNav(false); setNotice(""); };
  const announce = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 3200); };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <span className="brand-symbol"><GraduationCap size={21} /></span>
          <span className="brand-name">edu<span>manager</span></span>
          <button className="icon-button mobile-close" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>
        <button className="school-switcher" onClick={() => announce("School switching will be available when school accounts are connected.")}>
          <span className="school-avatar"><School size={17} /></span>
          <span className="school-switch-text"><strong>Greenfield Academy</strong><small>School workspace</small></span>
          <ChevronDown size={15} />
        </button>
        <nav className="side-nav" aria-label="Main navigation">
          {(["WORKSPACE", "MANAGEMENT", "SYSTEM"] as const).map((group) => (
            <div className="nav-group" key={group}>
              <span className="nav-group-label">{group}</span>
              {navItems.filter((item) => item.group === group).map(({ label, icon: Icon }) => (
                <button key={label} className={`nav-item ${page === label ? "active" : ""}`} onClick={() => go(label)}>
                  <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
                  {label === "Attendance" && <span className="nav-count">2</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><span className="help-icon"><CircleHelp size={17} /></span><strong>Need a hand?</strong><p>Find your way around the workspace.</p><button onClick={() => announce("Help centre is not connected in this preview.")}>Visit help centre <ArrowUpRight size={13} /></button></div>
          <button className="profile-row" onClick={() => go("Settings")}><span className="profile-avatar">BM</span><span><strong>Brian Moyo</strong><small>School administrator</small></span><MoreHorizontal size={17} /></button>
        </div>
      </aside>

      {mobileNav && <button className="mobile-scrim" onClick={() => setMobileNav(false)} aria-label="Close menu" />}
      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left"><button className="icon-button mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={20} /></button><div className="breadcrumbs"><span>Greenfield Academy</span><ChevronRight size={14} /><strong>{page}</strong></div></div>
          <div className="topbar-actions"><span className="today-label"><CalendarDays size={15} /> Thursday, 19 November 2026</span><button className="icon-button notification-button" onClick={() => announce("You're all caught up. No new notifications.")} aria-label="Notifications"><Bell size={18} /><i /></button><span className="topbar-divider" /><button className="top-avatar" onClick={() => go("Settings")}>BM</button></div>
        </header>
        <div className="page-content">
          <div className="preview-banner"><span><Sparkles size={14} /> INTERACTIVE PRODUCT PREVIEW</span><p>You're exploring sample school data. Changes stay in this browser session and are not saved to a school database.</p><button onClick={() => announce("Preview mode keeps sample data separate from real school records.")} aria-label="About preview mode"><CircleHelp size={15} /></button></div>
          {notice && <div className="toast" role="status"><CheckCircle2 size={16} />{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={14} /></button></div>}
          {page === "Overview" && <Overview students={students} attendance={attendance} presentCount={presentCount} absentCount={absentCount} lateCount={lateCount} period={period} setPeriod={setPeriod} onNavigate={go} onAdd={() => setShowAddStudent(true)} />}
          {page === "Students" && <Students students={filteredStudents} query={query} setQuery={setQuery} onAdd={() => setShowAddStudent(true)} />}
          {page === "Attendance" && <Attendance attendance={attendance} setAttendance={setAttendance} presentCount={presentCount} absentCount={absentCount} lateCount={lateCount} />}
          {page === "Academics" && <Academics onNotify={announce} />}
          {page === "Finance" && <Finance onNotify={announce} />}
          {page === "Staff" && <Staff onNotify={announce} />}
          {page === "Reports" && <Reports onNotify={announce} />}
          {page === "Settings" && <SettingsPage onNotify={announce} />}
          <footer className="app-footer"><span>© 2026 EduManager</span><span><span className="footer-status-dot" /> Preview environment · Sample data only</span><span>Built for schools in Malawi</span></footer>
        </div>
      </main>
      {showAddStudent && <AddStudent onClose={() => setShowAddStudent(false)} onSave={(student) => { setStudents((current) => [student, ...current]); setShowAddStudent(false); setPage("Students"); announce("Sample student added to this preview."); }} />}
    </div>
  );
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div><span className="page-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action && <div className="heading-actions">{action}</div>}</div>;
}

function StatCard({ label, value, change, icon: Icon, tone, sub }: { label: string; value: string; change: string; icon: typeof Users; tone: string; sub: string }) {
  return <article className="stat-card"><div className="stat-card-top"><span>{label}</span><span className={`stat-icon ${tone}`}><Icon size={18} /></span></div><div className="stat-value">{value}</div><div className="stat-foot"><span className="stat-change"><ArrowUpRight size={13} />{change}</span><span>{sub}</span></div></article>;
}

function Overview({ students, attendance, presentCount, absentCount, lateCount, period, setPeriod, onNavigate, onAdd }: { students: Student[]; attendance: typeof initialAttendance; presentCount: number; absentCount: number; lateCount: number; period: string; setPeriod: (v: string) => void; onNavigate: (p: Page) => void; onAdd: () => void }) {
  const total = attendance.length;
  const attendanceRate = total ? Math.round((presentCount / total) * 100) : 0;
  return <>
    <PageHeading eyebrow="SCHOOL OVERVIEW" title="Good morning, Brian" description="Here's what's happening at Greenfield Academy today." action={<><select className="select-control" value={period} onChange={(e) => setPeriod(e.target.value)}><option>This term</option><option>This month</option><option>This year</option></select><button className="button-primary" onClick={onAdd}><Plus size={16} /> Add student</button></>} />
    <div className="stats-grid">
      <StatCard label="Total students" value="1,248" change="+8.2%" sub="vs last term" icon={Users} tone="blue" />
      <StatCard label="Attendance today" value={`${attendanceRate}%`} change="+2.4%" sub="vs yesterday" icon={ClipboardCheck} tone="green" />
      <StatCard label="Fees collected" value="MK 18.6m" change="+12.5%" sub="this term" icon={Wallet} tone="amber" />
      <StatCard label="Teaching staff" value="64" change="+3" sub="this academic year" icon={GraduationCap} tone="purple" />
    </div>
    <div className="dashboard-grid">
      <section className="panel attendance-panel"><div className="panel-heading"><div><h2>Attendance overview</h2><p>Daily student attendance at a glance</p></div><button className="text-button" onClick={() => onNavigate("Attendance")}>View register <ArrowUpRight size={14} /></button></div>
        <div className="attendance-summary"><div><strong>{attendanceRate}%</strong><span>Present today</span></div><div className="attendance-legend"><span><i className="legend-present" />Present <b>{presentCount}</b></span><span><i className="legend-absent" />Absent <b>{absentCount}</b></span><span><i className="legend-late" />Late <b>{lateCount}</b></span></div></div>
        <div className="progress-track"><span style={{ width: `${attendanceRate}%` }} /><i style={{ left: `${Math.min(100, attendanceRate + (absentCount / Math.max(total, 1) * 100))}%` }} /></div>
        <div className="attendance-note"><span><Clock3 size={14} /> Register last updated at 08:45 AM</span><span>{total} sample records</span></div>
      </section>
      <section className="panel collection-panel"><div className="panel-heading"><div><h2>Fee collection</h2><p>Term 3 · 2026</p></div><button className="icon-button" onClick={() => onNavigate("Finance")} aria-label="Open finance"><ArrowUpRight size={17} /></button></div><div className="collection-total">MK 18,640,000</div><div className="collection-caption">Collected of MK 25,000,000 target</div><div className="collection-bar"><span /></div><div className="collection-foot"><span>74.6% collected</span><strong>MK 6.36m remaining</strong></div></section>
    </div>
    <div className="dashboard-grid lower-grid">
      <section className="panel"><div className="panel-heading"><div><h2>Recent student activity</h2><p>Latest updates from your school</p></div><button className="text-button" onClick={() => onNavigate("Students")}>All students <ArrowUpRight size={14} /></button></div><div className="table-wrap"><table><thead><tr><th>STUDENT</th><th>CLASS</th><th>STATUS</th><th /></tr></thead><tbody>{students.slice(0,4).map((student) => <tr key={student.id}><td><div className="person-cell"><span className="table-avatar">{initials(student.name)}</span><span><strong>{student.name}</strong><small>{student.id}</small></span></div></td><td>{student.className}</td><td><StatusPill status={student.status} /></td><td><button className="icon-button small-icon" onClick={() => onNavigate("Students")} aria-label={`View ${student.name}`}><ChevronRight size={16} /></button></td></tr>)}</tbody></table></div></section>
      <section className="panel quick-panel"><div className="panel-heading"><div><h2>Quick actions</h2><p>Common school tasks</p></div></div><div className="quick-actions"><button onClick={onAdd}><span className="quick-icon quick-blue"><UserRound size={17} /></span><span><strong>Register a student</strong><small>Add a new learner record</small></span><ChevronRight size={16} /></button><button onClick={() => onNavigate("Attendance")}><span className="quick-icon quick-green"><ClipboardCheck size={17} /></span><span><strong>Take attendance</strong><small>Open today's class register</small></span><ChevronRight size={16} /></button><button onClick={() => onNavigate("Finance")}><span className="quick-icon quick-amber"><CreditCard size={17} /></span><span><strong>Record a payment</strong><small>Update a fee payment</small></span><ChevronRight size={16} /></button><button onClick={() => onNavigate("Reports")}><span className="quick-icon quick-purple"><FileBarChart size={17} /></span><span><strong>View school reports</strong><small>Review school performance</small></span><ChevronRight size={16} /></button></div></section>
    </div>
  </>;
}

function initials(name: string) { return name.split(" ").map((part) => part[0]).slice(0,2).join("").toUpperCase(); }
function StatusPill({ status }: { status: string }) { return <span className={`status-pill ${status.toLowerCase().replace(" ", "-")}`}><i />{status}</span>; }

function Students({ students, query, setQuery, onAdd }: { students: Student[]; query: string; setQuery: (v: string) => void; onAdd: () => void }) {
  return <><PageHeading eyebrow="SCHOOL RECORDS" title="Students" description="Manage enrolment records and keep student information organised." action={<button className="button-primary" onClick={onAdd}><Plus size={16} /> Register student</button>} />
    <div className="stats-grid compact-stats"><StatCard label="Enrolled students" value="1,248" change="+8.2%" sub="this year" icon={Users} tone="blue" /><StatCard label="New this term" value="86" change="+14%" sub="vs last term" icon={UserRound} tone="green" /><StatCard label="Pending review" value="12" change="Needs attention" sub="applications" icon={Clock3} tone="amber" /></div>
    <section className="panel list-panel"><div className="list-toolbar"><div className="search-box"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, student ID or class..." /></div><button className="secondary-button" onClick={() => setQuery("")}><SlidersHorizontal size={15} /> Clear filters</button><button className="secondary-button" onClick={() => window.print()}><Download size={15} /> Export</button></div><div className="table-wrap"><table className="data-table"><thead><tr><th>STUDENT</th><th>STUDENT ID</th><th>CLASS</th><th>GUARDIAN</th><th>STATUS</th><th /></tr></thead><tbody>{students.map((student) => <tr key={student.id}><td><div className="person-cell"><span className="table-avatar">{initials(student.name)}</span><strong>{student.name}</strong></div></td><td className="muted-cell">{student.id}</td><td>{student.className}</td><td>{student.guardian}</td><td><StatusPill status={student.status} /></td><td><button className="icon-button small-icon" aria-label={`More options for ${student.name}`}><MoreHorizontal size={17} /></button></td></tr>)}{students.length===0 && <tr><td colSpan={6} className="empty-state">No students match that search.</td></tr>}</tbody></table></div><div className="table-pagination"><span>Showing {students.length} sample records</span><div><button disabled><ChevronLeft size={15} /></button><button className="current-page">1</button><button disabled><ChevronRight size={15} /></button></div></div></section>
  </>;
}

function Attendance({ attendance, setAttendance, presentCount, absentCount, lateCount }: { attendance: typeof initialAttendance; setAttendance: React.Dispatch<React.SetStateAction<typeof initialAttendance>>; presentCount: number; absentCount: number; lateCount: number }) {
  const [filter, setFilter] = useState("All");
  const visible = attendance.filter((student) => filter === "All" || student.status === filter);
  const cycle = (id: string) => setAttendance((current) => current.map((student) => student.id === id ? { ...student, status: student.status === "Present" ? "Absent" : student.status === "Absent" ? "Late" : "Present" } : student));
  return <><PageHeading eyebrow="DAILY REGISTER" title="Attendance" description="Record and review daily attendance across your school." action={<button className="secondary-button" onClick={() => window.print()}><Download size={15} /> Export register</button>} />
    <div className="attendance-datebar"><div><CalendarDays size={17} /><strong>Thursday, 19 November 2026</strong><span>·</span><span>Morning session</span></div><span className="live-indicator"><i /> Today's register</span></div>
    <div className="stats-grid compact-stats"><StatCard label="Present" value={String(presentCount)} change="Marked present" sub="sample records" icon={CheckCircle2} tone="green" /><StatCard label="Absent" value={String(absentCount)} change="Follow up" sub="sample records" icon={AlertCircle} tone="amber" /><StatCard label="Late" value={String(lateCount)} change="Arrived late" sub="sample records" icon={Clock3} tone="purple" /></div>
    <section className="panel list-panel"><div className="list-toolbar"><div><h2 className="toolbar-title">Student register</h2><p className="toolbar-subtitle">Select a status to update a sample attendance record.</p></div><div className="filter-tabs">{["All","Present","Absent","Late"].map((item) => <button key={item} className={filter===item?"selected":""} onClick={() => setFilter(item)}>{item}</button>)}</div></div><div className="table-wrap"><table className="data-table"><thead><tr><th>STUDENT</th><th>STUDENT ID</th><th>CLASS</th><th>ATTENDANCE STATUS</th><th>ACTION</th></tr></thead><tbody>{visible.map((student) => <tr key={student.id}><td><div className="person-cell"><span className="table-avatar">{initials(student.name)}</span><strong>{student.name}</strong></div></td><td className="muted-cell">{student.id}</td><td>{student.className}</td><td><StatusPill status={student.status} /></td><td><button className="secondary-button compact-button" onClick={() => cycle(student.id)}>Change status</button></td></tr>)}</tbody></table></div><div className="attendance-disclaimer"><ShieldCheck size={15} /> Updates are temporary preview interactions and are not saved to a school record.</div></section>
  </>;
}

function ModulePlaceholder({ icon: Icon, eyebrow, title, description, items, onNotify }: { icon: typeof BookOpen; eyebrow: string; title: string; description: string; items: string[]; onNotify: (s:string)=>void }) {
  return <><PageHeading eyebrow={eyebrow} title={title} description={description} action={<button className="button-primary" onClick={() => onNotify(`${title} setup is a preview interaction. Backend workflows are not connected yet.`)}><Plus size={16} /> Add new</button>} /><div className="module-overview"><div className="module-icon"><Icon size={26} /></div><div><span className="module-label">MODULE PREVIEW</span><h2>Your {title.toLowerCase()} workspace</h2><p>This screen shows the structure of the {title.toLowerCase()} module. Live records and saved workflows will be connected after the secure school data layer is ready.</p></div></div><div className="module-card-grid">{items.map((item,index)=><article className="module-card" key={item}><span className="module-card-number">0{index+1}</span><h3>{item}</h3><p>Designed to fit your school's day-to-day workflow.</p><span className="module-planned"><i /> Preview structure</span></article>)}</div><div className="notice-panel"><ShieldCheck size={18} /><div><strong>Secure by design</strong><p>These areas are not connected to real student or financial records. Authentication, school-level access controls and database-backed workflows must be completed before live use.</p></div></div></>;
}

function Academics({onNotify}:{onNotify:(s:string)=>void}) { return <ModulePlaceholder icon={BookOpen} eyebrow="TEACHING & LEARNING" title="Academics" description="Set up the academic structure that supports classes, subjects and assessment." items={["Academic years & terms","Classes & streams","Subjects & teacher assignments","Assessments & grading"]} onNotify={onNotify} />; }
function Finance({onNotify}:{onNotify:(s:string)=>void}) { return <><PageHeading eyebrow="SCHOOL FINANCE" title="Finance" description="A clearer view of fee collection, balances and payment activity." action={<button className="button-primary" onClick={()=>onNotify("Payment recording is not connected to a live finance ledger.")}><Plus size={16}/> Record payment</button>} /><div className="stats-grid compact-stats"><StatCard label="Collected this term" value="MK 18.64m" change="+12.5%" sub="vs last term" icon={CircleDollarSign} tone="green"/><StatCard label="Outstanding fees" value="MK 6.36m" change="25.4% of target" sub="remaining" icon={Wallet} tone="amber"/><StatCard label="Payments recorded" value="486" change="+32" sub="this term" icon={CreditCard} tone="blue"/></div><section className="panel"><div className="panel-heading"><div><h2>Recent payment activity</h2><p>Illustrative transactions · Term 3, 2026</p></div><button className="secondary-button" onClick={()=>onNotify("Export is available when finance records are connected.")}><Download size={15}/> Export</button></div><div className="table-wrap"><table className="data-table"><thead><tr><th>REFERENCE</th><th>STUDENT</th><th>DATE</th><th>METHOD</th><th>AMOUNT</th><th>STATUS</th></tr></thead><tbody>{[{ref:"PAY-2026-0486",name:"Chisomo Banda",date:"19 Nov 2026",method:"Bank transfer",amount:85000},{ref:"PAY-2026-0485",name:"Tadala Phiri",date:"18 Nov 2026",method:"Cash",amount:65000},{ref:"PAY-2026-0484",name:"Thoko Kamanga",date:"18 Nov 2026",method:"Mobile money",amount:120000},{ref:"PAY-2026-0483",name:"Pempho Zulu",date:"17 Nov 2026",method:"Bank transfer",amount:95000}].map((p)=><tr key={p.ref}><td className="muted-cell">{p.ref}</td><td><strong>{p.name}</strong></td><td>{p.date}</td><td>{p.method}</td><td><strong>{money(p.amount)}</strong></td><td><StatusPill status="Paid"/></td></tr>)}</tbody></table></div></section><div className="notice-panel"><ShieldCheck size={18}/><div><strong>Preview transactions only</strong><p>These payment entries are illustrative and are not receipts or evidence of actual payments.</p></div></div></>; }
function Staff({onNotify}:{onNotify:(s:string)=>void}) { return <ModulePlaceholder icon={Users} eyebrow="PEOPLE & ACCESS" title="Staff" description="Organise staff records, school responsibilities and role assignments." items={["Staff directory","Roles & permissions","Teacher assignments","Leave & availability"]} onNotify={onNotify}/>; }
function Reports({onNotify}:{onNotify:(s:string)=>void}) { return <ModulePlaceholder icon={FileBarChart} eyebrow="INSIGHTS & OVERSIGHT" title="Reports" description="Review school activity through clear operational and academic summaries." items={["Enrolment reports","Attendance summaries","Academic performance","Fee collection reports"]} onNotify={onNotify}/>; }
function SettingsPage({onNotify}:{onNotify:(s:string)=>void}) { return <><PageHeading eyebrow="WORKSPACE CONFIGURATION" title="Settings" description="Manage school profile preferences and workspace configuration."/><div className="settings-grid"><section className="panel settings-panel"><div className="settings-heading"><span className="settings-icon"><School size={18}/></span><div><h2>School profile</h2><p>Basic information about this school workspace.</p></div></div><label>School name<input value="Greenfield Academy" readOnly/></label><label>School location<input value="Lilongwe, Malawi" readOnly/></label><label>Academic year<input value="2026" readOnly/></label><button className="secondary-button" onClick={()=>onNotify("School profile editing will be enabled with authenticated school settings.")}>Edit school profile</button></section><section className="panel settings-panel"><div className="settings-heading"><span className="settings-icon"><ShieldCheck size={18}/></span><div><h2>Security & access</h2><p>Access settings planned for the secure school workspace.</p></div></div><div className="setting-row"><span><strong>Role-based access</strong><small>Permissions by school role</small></span><StatusPill status="Planned"/></div><div className="setting-row"><span><strong>Audit history</strong><small>Trace sensitive changes</small></span><StatusPill status="Planned"/></div><div className="setting-row"><span><strong>School data isolation</strong><small>Separate records for each school</small></span><StatusPill status="Planned"/></div><button className="secondary-button" onClick={()=>onNotify("Security controls are not yet connected to a live identity provider.")}>Review access settings</button></section></div></>; }

function AddStudent({onClose,onSave}:{onClose:()=>void;onSave:(s:Student)=>void}) {
  const [name,setName]=useState(""); const [className,setClassName]=useState("Form 1 North"); const [guardian,setGuardian]=useState(""); const [phone,setPhone]=useState("");
  const submit=(e:React.FormEvent)=>{e.preventDefault();if(!name.trim()||!guardian.trim())return;onSave({id:`DEMO-${String(Date.now()).slice(-5)}`,name:name.trim(),className,guardian:guardian.trim(),phone,status:"Pending"});};
  return <div className="modal-backdrop" role="presentation" onMouseDown={(e)=>{if(e.target===e.currentTarget)onClose();}}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><span className="page-eyebrow">STUDENT ENROLMENT</span><h2 id="modal-title">Register a student</h2><p>Add a sample learner to this preview.</p></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={19}/></button></div><form onSubmit={submit}><label>Student full name<input autoFocus value={name} onChange={(e)=>setName(e.target.value)} placeholder="e.g. Thoko Banda" required/></label><label>Class<select value={className} onChange={(e)=>setClassName(e.target.value)}><option>Form 1 North</option><option>Form 1 South</option><option>Form 2 North</option><option>Form 2 South</option><option>Form 3 North</option><option>Standard 6</option><option>Standard 7</option></select></label><label>Parent / guardian name<input value={guardian} onChange={(e)=>setGuardian(e.target.value)} placeholder="Guardian's full name" required/></label><label>Guardian phone number<input value={phone} onChange={(e)=>setPhone(e.target.value)} placeholder="+265 ..."/></label><div className="modal-note"><AlertCircle size={15}/> This creates a temporary sample record only. It will not be stored in a school database.</div><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="button-primary"><Plus size={15}/> Add sample student</button></div></form></section></div>;
}

export default App;
