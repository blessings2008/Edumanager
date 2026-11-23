import { useState } from "react";
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
type StaffMember = { id: string; name: string; role: string; department: string; focus: string; status: "Active" | "On leave"; employment: string };

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
          {page === "Students" && <Students students={students} query={query} setQuery={setQuery} onAdd={() => setShowAddStudent(true)} />}
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
  const [classFilter, setClassFilter] = useState("All classes");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const classes = Array.from(new Set(students.map((student) => student.className))).sort();
  const visibleStudents = students.filter((student) =>
    [student.name, student.id, student.className, student.guardian].join(" ").toLowerCase().includes(query.toLowerCase()) &&
    (classFilter === "All classes" || student.className === classFilter) &&
    (statusFilter === "All statuses" || student.status === statusFilter)
  );
  const clearFilters = () => { setQuery(""); setClassFilter("All classes"); setStatusFilter("All statuses"); };

  return <>
    <PageHeading eyebrow="SCHOOL RECORDS" title="Students" description="Manage enrolment records and keep student information organised." action={<button className="button-primary" onClick={onAdd}><Plus size={16} /> Register student</button>} />
    <div className="stats-grid compact-stats"><StatCard label="Enrolled students" value="1,248" change="+8.2%" sub="this year" icon={Users} tone="blue" /><StatCard label="New this term" value="86" change="+14%" sub="vs last term" icon={UserRound} tone="green" /><StatCard label="Pending review" value="12" change="Needs attention" sub="applications" icon={Clock3} tone="amber" /></div>
    <section className="panel list-panel">
      <div className="list-toolbar student-toolbar">
        <div className="search-box"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, student ID, class or guardian..." aria-label="Search students" /></div>
        <select className="select-control" value={classFilter} onChange={(e) => setClassFilter(e.target.value)} aria-label="Filter by class"><option>All classes</option>{classes.map((className) => <option key={className}>{className}</option>)}</select>
        <select className="select-control" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by student status"><option>All statuses</option><option>Active</option><option>Pending</option></select>
        <button className="secondary-button" onClick={clearFilters}><SlidersHorizontal size={15} /> Clear</button>
        <button className="secondary-button" onClick={() => window.print()}><Download size={15} /> Export</button>
      </div>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>STUDENT</th><th>STUDENT ID</th><th>CLASS</th><th>GUARDIAN</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>
        {visibleStudents.map((student) => <tr key={student.id}><td><div className="person-cell"><span className="table-avatar">{initials(student.name)}</span><strong>{student.name}</strong></div></td><td className="muted-cell">{student.id}</td><td>{student.className}</td><td>{student.guardian}</td><td><StatusPill status={student.status} /></td><td><button className="secondary-button compact-button" onClick={() => setSelectedStudent(student)}>View record</button></td></tr>)}
        {visibleStudents.length === 0 && <tr><td colSpan={6} className="empty-state">No students match these filters. Try clearing them or changing your search.</td></tr>}
      </tbody></table></div>
      <div className="table-pagination"><span>Showing {visibleStudents.length} of {students.length} sample records</span><div><button disabled><ChevronLeft size={15} /></button><button className="current-page">1</button><button disabled><ChevronRight size={15} /></button></div></div>
      <div className="attendance-disclaimer"><ShieldCheck size={15} /> Student records and filter changes are temporary preview data, not saved school records.</div>
    </section>
    {selectedStudent && <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedStudent(null); }}>
      <section className="modal student-detail-modal" role="dialog" aria-modal="true" aria-labelledby="student-detail-title">
        <div className="modal-heading"><div><span className="page-eyebrow">STUDENT PROFILE · SAMPLE</span><h2 id="student-detail-title">{selectedStudent.name}</h2><p>{selectedStudent.id} · {selectedStudent.className}</p></div><button className="icon-button" onClick={() => setSelectedStudent(null)} aria-label="Close student profile"><X size={19} /></button></div>
        <div className="student-detail-status"><span className="student-detail-avatar">{initials(selectedStudent.name)}</span><span><strong>Enrolment status</strong><small>Current sample record</small></span><StatusPill status={selectedStudent.status} /></div>
        <div className="student-detail-grid">
          <div><span>Student ID</span><strong>{selectedStudent.id}</strong></div>
          <div><span>Assigned class</span><strong>{selectedStudent.className}</strong></div>
          <div><span>Parent / guardian</span><strong>{selectedStudent.guardian}</strong></div>
          <div><span>Guardian phone</span><strong>{selectedStudent.phone || "Not provided"}</strong></div>
        </div>
        <div className="modal-note"><ShieldCheck size={15} /> This profile is illustrative. Editing, enrolment history and guardian verification require authenticated school records.</div>
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setSelectedStudent(null)}>Close profile</button></div>
      </section>
    </div>}
  </>;
}
function Attendance({ attendance, setAttendance, presentCount, absentCount, lateCount }: { attendance: typeof initialAttendance; setAttendance: React.Dispatch<React.SetStateAction<typeof initialAttendance>>; presentCount: number; absentCount: number; lateCount: number }) {
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("All classes");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [date, setDate] = useState("2026-11-19");
  const [session, setSession] = useState("Morning session");
  const classes = Array.from(new Set(attendance.map((student) => student.className))).sort();
  const visible = attendance.filter((student) =>
    [student.name, student.id, student.className].join(" ").toLowerCase().includes(query.toLowerCase()) &&
    (classFilter === "All classes" || student.className === classFilter) &&
    (statusFilter === "All statuses" || student.status === statusFilter)
  );
  const updateStatus = (id: string, status: "Present" | "Absent" | "Late") =>
    setAttendance((current) => current.map((student) => student.id === id ? { ...student, status } : student));
  const clearFilters = () => { setQuery(""); setClassFilter("All classes"); setStatusFilter("All statuses"); };
  const formattedDate = new Date(date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const total = attendance.length;
  const rate = total ? Math.round((presentCount / total) * 100) : 0;

  return <>
    <PageHeading eyebrow="DAILY REGISTER" title="Attendance" description="Record, filter and review daily attendance across your school." action={<button className="secondary-button" onClick={() => window.print()}><Download size={15} /> Export register</button>} />
    <div className="attendance-datebar attendance-controls">
      <div className="attendance-date-fields">
        <label><span>Register date</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <label><span>Session</span><select value={session} onChange={(event) => setSession(event.target.value)}><option>Morning session</option><option>Afternoon session</option><option>Full day</option></select></label>
      </div>
      <span className="live-indicator"><i /> Preview register</span>
    </div>
    <div className="stats-grid compact-stats">
      <StatCard label="Present" value={String(presentCount)} change={rate + "% of register"} sub="sample records" icon={CheckCircle2} tone="green" />
      <StatCard label="Absent" value={String(absentCount)} change="Follow up" sub="sample records" icon={AlertCircle} tone="amber" />
      <StatCard label="Late" value={String(lateCount)} change="Arrived late" sub="sample records" icon={Clock3} tone="purple" />
    </div>
    <section className="panel list-panel">
      <div className="list-toolbar attendance-toolbar">
        <div><h2 className="toolbar-title">Student register</h2><p className="toolbar-subtitle">{formattedDate} · {session} · {total} illustrative records</p></div>
        <div className="attendance-bulk-actions"><button className="secondary-button" onClick={() => setAttendance((current) => current.map((student) => ({ ...student, status: "Present" })))}><CheckCircle2 size={15} /> Mark all present</button></div>
      </div>
      <div className="attendance-filter-row">
        <div className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search student, ID or class..." aria-label="Search attendance register" /></div>
        <select className="select-control" value={classFilter} onChange={(event) => setClassFilter(event.target.value)} aria-label="Filter attendance by class"><option>All classes</option>{classes.map((item) => <option key={item}>{item}</option>)}</select>
        <select className="select-control" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter attendance by status"><option>All statuses</option><option>Present</option><option>Absent</option><option>Late</option></select>
        <button className="secondary-button" onClick={clearFilters}><SlidersHorizontal size={15} /> Clear</button>
      </div>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>STUDENT</th><th>STUDENT ID</th><th>CLASS</th><th>ATTENDANCE STATUS</th><th>UPDATE STATUS</th></tr></thead><tbody>
        {visible.map((student) => <tr key={student.id}><td><div className="person-cell"><span className="table-avatar">{initials(student.name)}</span><strong>{student.name}</strong></div></td><td className="muted-cell">{student.id}</td><td>{student.className}</td><td><StatusPill status={student.status} /></td><td><select className="select-control attendance-status-select" aria-label={"Set attendance for " + student.name} value={student.status} onChange={(event) => updateStatus(student.id, event.target.value as "Present" | "Absent" | "Late")}><option>Present</option><option>Absent</option><option>Late</option></select></td></tr>)}
        {visible.length === 0 && <tr><td colSpan={5} className="empty-state">No attendance records match these filters. Try clearing them or changing your search.</td></tr>}
      </tbody></table></div>
      <div className="attendance-register-footer"><span>Showing {visible.length} of {total} sample records</span><span>{presentCount} present · {absentCount} absent · {lateCount} late</span></div>
      <div className="attendance-disclaimer"><ShieldCheck size={15} /> Date, session and status changes are temporary preview interactions. No attendance record is saved to a school database.</div>
    </section>
  </>;
}
function Academics({onNotify}:{onNotify:(s:string)=>void}) {
  const [section,setSection]=useState<"Overview"|"Classes"|"Subjects"|"Assessments">("Overview");
  const [classFilter,setClassFilter]=useState("All levels");
  const classes=[
    {name:"Standard 6",level:"Primary",students:42,teacher:"Mrs. T. Kamanga",subjects:8,room:"Block A · 06"},
    {name:"Standard 7",level:"Primary",students:41,teacher:"Mr. P. Mbewe",subjects:8,room:"Block A · 07"},
    {name:"Form 1 North",level:"Secondary",students:38,teacher:"Mr. P. Mbewe",subjects:8,room:"Block B · 01"},
    {name:"Form 1 South",level:"Secondary",students:36,teacher:"Mrs. L. Zulu",subjects:8,room:"Block B · 02"},
    {name:"Form 2 North",level:"Secondary",students:34,teacher:"Mr. J. Banda",subjects:9,room:"Block B · 03"},
    {name:"Form 2 South",level:"Secondary",students:32,teacher:"Mrs. E. Phiri",subjects:9,room:"Block B · 04"},
    {name:"Form 3 North",level:"Secondary",students:29,teacher:"Mr. C. Chirwa",subjects:10,room:"Block B · 05"},
  ];
  const subjects=[
    {name:"English",code:"ENG",level:"Primary & Secondary",teacher:"Mrs. L. Zulu",classes:18},
    {name:"Mathematics",code:"MAT",level:"Primary & Secondary",teacher:"Mr. P. Mbewe",classes:18},
    {name:"Integrated Science",code:"SCI",level:"Primary",teacher:"Mr. J. Banda",classes:8},
    {name:"Biology",code:"BIO",level:"Secondary",teacher:"Mrs. E. Phiri",classes:6},
    {name:"Chemistry",code:"CHE",level:"Secondary",teacher:"Mr. C. Chirwa",classes:4},
    {name:"Physics",code:"PHY",level:"Secondary",teacher:"Mr. C. Chirwa",classes:4},
    {name:"Chichewa",code:"CHI",level:"Primary & Secondary",teacher:"Mrs. T. Kamanga",classes:18},
    {name:"Agriculture",code:"AGR",level:"Secondary",teacher:"Mr. J. Banda",classes:6},
  ];
  const assessments=[
    {name:"Continuous assessment",subject:"All subjects",date:"10–21 November",type:"Coursework",status:"In progress"},
    {name:"End-of-term examinations",subject:"All subjects",date:"23 November – 2 December",type:"Examination",status:"Upcoming"},
    {name:"Practical assessment",subject:"Sciences",date:"16–18 November",type:"Practical",status:"Completed"},
    {name:"Project submission",subject:"Agriculture",date:"27 November",type:"Project",status:"Upcoming"},
  ];
  const visibleClasses=classes.filter(item=>classFilter==="All levels"||item.level===classFilter);
  const tabs=["Overview","Classes","Subjects","Assessments"] as const;
  return <>
    <PageHeading eyebrow="TEACHING & LEARNING" title="Academics" description="Organise the school year, class structure, curriculum and assessment activity." action={<button className="button-primary" onClick={()=>onNotify("Academic setup is a preview only. No school records were changed.")}><Plus size={16}/> Add academic item</button>}/>
    <div className="academic-session"><div><span className="module-label">CURRENT ACADEMIC SESSION</span><h2>2026 Academic Year</h2><p>Term 3 · 7 September – 4 December 2026 · 11 teaching weeks</p></div><span className="status-pill active"><i/>In progress</span></div>
    <div className="academic-tabs" role="tablist" aria-label="Academic sections">{tabs.map(tab=><button key={tab} type="button" role="tab" aria-selected={section===tab} className={section===tab?"selected":""} onClick={()=>setSection(tab)}>{tab}{tab==="Classes"&&<span>18</span>}{tab==="Subjects"&&<span>24</span>}</button>)}</div>
    {section==="Overview"&&<>
      <div className="stats-grid compact-stats"><StatCard label="Active classes" value="18" change="Across 2 sections" sub="primary & secondary" icon={School} tone="blue"/><StatCard label="Curriculum subjects" value="24" change="School-defined" sub="configured subjects" icon={BookOpen} tone="green"/><StatCard label="Assessments" value="12" change="This term" sub="scheduled activities" icon={ClipboardCheck} tone="purple"/></div>
      <div className="dashboard-grid">
        <section className="panel"><div className="panel-heading"><div><h2>Academic year timeline</h2><p>Illustrative school calendar · 2026</p></div><span className="report-unit">3 TERMS</span></div><div className="term-list">
          {[{term:"Term 1",dates:"12 January – 10 April",state:"Completed",width:"100%"},{term:"Term 2",dates:"4 May – 7 August",state:"Completed",width:"100%"},{term:"Term 3",dates:"7 September – 4 December",state:"In progress",width:"82%"}].map(t=><div className="term-item" key={t.term}><div><strong>{t.term}</strong><span>{t.dates}</span><StatusPill status={t.state}/></div><div className="term-track"><i style={{width:t.width}}/></div></div>)}
        </div></section>
        <section className="panel"><div className="panel-heading"><div><h2>Assessment activity</h2><p>Upcoming academic checkpoints</p></div><button className="text-button" onClick={()=>setSection("Assessments")}>View schedule <ArrowUpRight size={14}/></button></div><div className="academic-upcoming">{assessments.slice(0,3).map(item=><div key={item.name}><span className="calendar-tile"><CalendarDays size={16}/></span><span><strong>{item.name}</strong><small>{item.date} · {item.subject}</small></span><StatusPill status={item.status}/></div>)}</div></section>
      </div>
      <section className="panel"><div className="panel-heading"><div><h2>Class structure</h2><p>Selected classes across primary and secondary sections</p></div><button className="text-button" onClick={()=>setSection("Classes")}>Manage classes <ArrowUpRight size={14}/></button></div><div className="class-card-grid">{classes.slice(0,4).map(item=><article className="class-mini-card" key={item.name}><span>{item.level}</span><h3>{item.name}</h3><p>{item.students} sample learners · {item.subjects} subjects</p><small>Class teacher: {item.teacher}</small></article>)}</div></section>
    </>}
    {section==="Classes"&&<section className="panel list-panel"><div className="list-toolbar"><div><h2 className="toolbar-title">Classes & streams</h2><p className="toolbar-subtitle">Illustrative class groups, class teachers and room assignments.</p></div><select className="select-control" value={classFilter} onChange={e=>setClassFilter(e.target.value)}><option>All levels</option><option>Primary</option><option>Secondary</option></select><button className="secondary-button" onClick={()=>onNotify("Class creation will be enabled after school-scoped academic persistence is implemented.")}><Plus size={15}/> Add class</button></div><div className="table-wrap"><table className="data-table"><thead><tr><th>CLASS / STREAM</th><th>LEVEL</th><th>LEARNERS</th><th>CLASS TEACHER</th><th>SUBJECTS</th><th>ROOM</th></tr></thead><tbody>{visibleClasses.map(c=><tr key={c.name}><td><strong>{c.name}</strong></td><td>{c.level}</td><td>{c.students}</td><td>{c.teacher}</td><td>{c.subjects}</td><td>{c.room}</td></tr>)}</tbody></table></div><div className="attendance-disclaimer"><ShieldCheck size={15}/> Class assignments shown here are illustrative and are not persisted school records.</div></section>}
    {section==="Subjects"&&<section className="panel list-panel"><div className="list-toolbar"><div><h2 className="toolbar-title">Subject catalogue</h2><p className="toolbar-subtitle">A configurable curriculum; schools define their own subject combinations.</p></div><button className="secondary-button" onClick={()=>onNotify("Subject creation is a preview only.")}><Plus size={15}/> Add subject</button></div><div className="subject-grid">{subjects.map(s=><article className="subject-card" key={s.code}><div><span className="subject-code">{s.code}</span><span className="subject-count">{s.classes} classes</span></div><h3>{s.name}</h3><p>{s.level}</p><small>Lead teacher · {s.teacher}</small></article>)}</div></section>}
    {section==="Assessments"&&<section className="panel list-panel"><div className="list-toolbar"><div><h2 className="toolbar-title">Assessment schedule</h2><p className="toolbar-subtitle">Term 3 activities and their current planning status.</p></div><button className="secondary-button" onClick={()=>onNotify("Assessment scheduling is a preview only; no dates have been saved.")}><Plus size={15}/> Schedule assessment</button></div><div className="table-wrap"><table className="data-table"><thead><tr><th>ASSESSMENT</th><th>SUBJECT / SCOPE</th><th>DATE</th><th>TYPE</th><th>STATUS</th></tr></thead><tbody>{assessments.map(a=><tr key={a.name}><td><strong>{a.name}</strong></td><td>{a.subject}</td><td>{a.date}</td><td>{a.type}</td><td><StatusPill status={a.status}/></td></tr>)}</tbody></table></div><div className="attendance-disclaimer"><AlertCircle size={15}/> No marks, grades or learner results are being stored or calculated in this preview.</div></section>}
    <div className="notice-panel"><ShieldCheck size={18}/><div><strong>School-configurable academic structure</strong><p>Academic years, terms, classes, subject combinations and assessment rules will be scoped to each school. Teacher assignments and learner enrolments must be explicit school-owned relationships; this preview does not grant access or persist those relationships.</p></div></div>
  </>;
}
function Finance({onNotify}:{onNotify:(s:string)=>void}) {
  const [section, setSection] = useState<"Overview" | "Fee structures" | "Student statements" | "Payments">("Overview");
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("All classes");
  const [balanceFilter, setBalanceFilter] = useState("All balances");
  const [period, setPeriod] = useState("Term 3 · 2026");
  const statements = [
    { id: "EDU-0018", name: "Chisomo Banda", className: "Form 2 North", billed: 285000, paid: 200000, due: "30 Nov 2026" },
    { id: "EDU-0017", name: "Tadala Phiri", className: "Form 1 South", billed: 260000, paid: 260000, due: "30 Nov 2026" },
    { id: "EDU-0016", name: "Thoko Kamanga", className: "Standard 7", billed: 225000, paid: 105000, due: "30 Nov 2026" },
    { id: "EDU-0015", name: "Mphatso Chirwa", className: "Form 3 North", billed: 310000, paid: 150000, due: "30 Nov 2026" },
    { id: "EDU-0014", name: "Pempho Zulu", className: "Form 2 South", billed: 285000, paid: 285000, due: "30 Nov 2026" },
    { id: "EDU-0013", name: "Dalitso Mbewe", className: "Standard 6", billed: 225000, paid: 75000, due: "30 Nov 2026" },
  ];
  const payments = [
    { ref: "PAY-2026-0486", name: "Chisomo Banda", id: "EDU-0018", date: "19 Nov 2026", method: "Bank transfer", amount: 85000 },
    { ref: "PAY-2026-0485", name: "Tadala Phiri", id: "EDU-0017", date: "18 Nov 2026", method: "Cash", amount: 65000 },
    { ref: "PAY-2026-0484", name: "Thoko Kamanga", id: "EDU-0016", date: "18 Nov 2026", method: "Mobile money", amount: 120000 },
    { ref: "PAY-2026-0483", name: "Pempho Zulu", id: "EDU-0014", date: "17 Nov 2026", method: "Bank transfer", amount: 95000 },
  ];
  const feeStructures = [
    { level: "Primary", classes: "Standard 1–8", tuition: 180000, development: 25000, activities: 20000 },
    { level: "Secondary", classes: "Form 1–4", tuition: 240000, development: 35000, activities: 30000 },
  ];
  const withBalances = statements.map((student) => ({ ...student, balance: Math.max(0, student.billed - student.paid) }));
  const totalBilled = withBalances.reduce((sum, student) => sum + student.billed, 0);
  const totalPaid = withBalances.reduce((sum, student) => sum + student.paid, 0);
  const totalOutstanding = withBalances.reduce((sum, student) => sum + student.balance, 0);
  const classes = Array.from(new Set(statements.map((student) => student.className))).sort();
  const visibleStatements = withBalances.filter((student) =>
    [student.name, student.id, student.className].join(" ").toLowerCase().includes(query.toLowerCase()) &&
    (classFilter === "All classes" || student.className === classFilter) &&
    (balanceFilter === "All balances" || (balanceFilter === "Outstanding" ? student.balance > 0 : student.balance === 0))
  );
  const tabs = ["Overview", "Fee structures", "Student statements", "Payments"] as const;
  const openStatements = () => setSection("Student statements");

  return <>
    <PageHeading eyebrow="SCHOOL FINANCE" title="Finance" description="Review fee structures, student balances and payment activity." action={<button className="button-primary" onClick={() => onNotify("Payment recording is disabled in this preview. Connect an authorised, audited finance ledger before recording real payments.")}><Plus size={16}/> Record payment</button>} />
    <div className="finance-period-row"><label>Academic period <select className="select-control" value={period} onChange={(event) => setPeriod(event.target.value)}><option>Term 3 · 2026</option><option>Term 2 · 2026</option><option>Term 1 · 2026</option></select></label><span><ShieldCheck size={14}/> Sample finance workspace</span></div>
    <div className="stats-grid compact-stats">
      <StatCard label="Fees billed" value={money(totalBilled)} change="6 sample statements" sub="selected period" icon={FileBarChart} tone="blue"/>
      <StatCard label="Collected" value={money(totalPaid)} change={Math.round(totalPaid / Math.max(totalBilled, 1) * 100) + "% of billed"} sub="sample payments" icon={CircleDollarSign} tone="green"/>
      <StatCard label="Outstanding" value={money(totalOutstanding)} change={withBalances.filter((student) => student.balance > 0).length + " learners"} sub="sample balances" icon={Wallet} tone="amber"/>
    </div>
    <div className="academic-tabs finance-tabs" role="tablist" aria-label="Finance sections">
      {tabs.map((tab) => <button key={tab} className={section === tab ? "selected" : ""} role="tab" aria-selected={section === tab} onClick={() => setSection(tab)}>{tab}{tab === "Student statements" && <span>{withBalances.filter((student) => student.balance > 0).length}</span>}</button>)}
    </div>
    {section === "Overview" && <>
      <div className="finance-overview-grid">
        <section className="panel finance-collection-panel">
          <div className="panel-heading"><div><h2>Collection progress</h2><p>{period} · illustrative figures</p></div><span className="report-unit">{Math.round(totalPaid / Math.max(totalBilled, 1) * 100)}%</span></div>
          <div className="finance-progress-track"><span style={{width: (totalPaid / Math.max(totalBilled, 1) * 100) + "%"}}/></div>
          <div className="finance-progress-legend"><span><i className="legend-collected"/>Collected <strong>{money(totalPaid)}</strong></span><span><i className="legend-outstanding"/>Outstanding <strong>{money(totalOutstanding)}</strong></span></div>
          <button className="text-button" onClick={openStatements}>Review student balances <ArrowUpRight size={14}/></button>
        </section>
        <section className="panel finance-shortcuts">
          <div className="panel-heading"><div><h2>Finance workspace</h2><p>Common finance tasks</p></div></div>
          <button onClick={() => setSection("Fee structures")}><span className="quick-icon quick-blue"><FileBarChart size={17}/></span><span><strong>Fee structures</strong><small>Review charges by school level</small></span><ChevronRight size={16}/></button>
          <button onClick={openStatements}><span className="quick-icon quick-amber"><Wallet size={17}/></span><span><strong>Student statements</strong><small>Find balances and payment progress</small></span><ChevronRight size={16}/></button>
          <button onClick={() => setSection("Payments")}><span className="quick-icon quick-green"><CreditCard size={17}/></span><span><strong>Payment history</strong><small>Review illustrative transactions</small></span><ChevronRight size={16}/></button>
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading"><div><h2>Students with outstanding fees</h2><p>Sample statements with a remaining balance</p></div><button className="text-button" onClick={openStatements}>View all <ArrowUpRight size={14}/></button></div>
        <div className="table-wrap"><table className="data-table"><thead><tr><th>STUDENT</th><th>CLASS</th><th>BILLED</th><th>PAID</th><th>BALANCE</th></tr></thead><tbody>{withBalances.filter((student) => student.balance > 0).slice(0,4).map((student) => <tr key={student.id}><td><div className="person-cell"><span className="table-avatar">{initials(student.name)}</span><span><strong>{student.name}</strong><small>{student.id}</small></span></div></td><td>{student.className}</td><td>{money(student.billed)}</td><td>{money(student.paid)}</td><td><strong className="finance-balance">{money(student.balance)}</strong></td></tr>)}</tbody></table></div>
      </section>
    </>}
    {section === "Fee structures" && <>
      <section className="panel">
        <div className="panel-heading"><div><h2>Fee schedules</h2><p>Illustrative charges by school level · {period}</p></div><button className="secondary-button" onClick={() => onNotify("Fee structure editing is not available until school-scoped finance permissions and audited persistence are implemented.")}><Plus size={15}/> Add fee structure</button></div>
        <div className="fee-structure-grid">{feeStructures.map((fee) => <article className="fee-structure-card" key={fee.level}><div><span className="subject-code">{fee.level.toUpperCase()}</span><span className="fee-class-label">{fee.classes}</span></div><h3>{money(fee.tuition + fee.development + fee.activities)} <small>/ learner</small></h3><div className="fee-line"><span>Tuition</span><strong>{money(fee.tuition)}</strong></div><div className="fee-line"><span>Development levy</span><strong>{money(fee.development)}</strong></div><div className="fee-line"><span>Activities</span><strong>{money(fee.activities)}</strong></div><div className="fee-total"><span>Term total</span><strong>{money(fee.tuition + fee.development + fee.activities)}</strong></div></article>)}</div>
      </section>
      <div className="notice-panel"><ShieldCheck size={18}/><div><strong>Illustrative fee schedules</strong><p>These sample amounts are not approved school charges and cannot be assigned to real learners.</p></div></div>
    </>}
    {section === "Student statements" && <>
      <section className="panel list-panel">
        <div className="list-toolbar finance-list-toolbar"><div><h2 className="toolbar-title">Student fee statements</h2><p className="toolbar-subtitle">Billed amount, payments received and remaining balance.</p></div><button className="secondary-button" onClick={() => onNotify("Statement export is unavailable because these are sample records.")}><Download size={15}/> Export</button></div>
        <div className="attendance-filter-row finance-filter-row"><div className="search-box"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search student, ID or class..." aria-label="Search student statements"/></div><select className="select-control" value={classFilter} onChange={(event) => setClassFilter(event.target.value)} aria-label="Filter statements by class"><option>All classes</option>{classes.map((item) => <option key={item}>{item}</option>)}</select><select className="select-control" value={balanceFilter} onChange={(event) => setBalanceFilter(event.target.value)} aria-label="Filter by balance"><option>All balances</option><option>Outstanding</option><option>Paid in full</option></select><button className="secondary-button" onClick={() => {setQuery("");setClassFilter("All classes");setBalanceFilter("All balances");}}><SlidersHorizontal size={15}/> Clear</button></div>
        <div className="table-wrap"><table className="data-table"><thead><tr><th>STUDENT</th><th>CLASS</th><th>BILLED</th><th>PAID</th><th>BALANCE</th><th>DUE DATE</th></tr></thead><tbody>{visibleStatements.map((student) => <tr key={student.id}><td><div className="person-cell"><span className="table-avatar">{initials(student.name)}</span><span><strong>{student.name}</strong><small>{student.id}</small></span></div></td><td>{student.className}</td><td>{money(student.billed)}</td><td>{money(student.paid)}</td><td><strong className={student.balance > 0 ? "finance-balance" : "finance-paid"}>{money(student.balance)}</strong></td><td>{student.due}</td></tr>)}{visibleStatements.length === 0 && <tr><td colSpan={6} className="empty-state">No statements match these filters. Try clearing the search or filters.</td></tr>}</tbody></table></div>
        <div className="attendance-register-footer"><span>Showing {visibleStatements.length} of {withBalances.length} sample statements</span><span>{visibleStatements.filter((student) => student.balance > 0).length} with outstanding balances</span></div>
      </section>
    </>}
    {section === "Payments" && <>
      <section className="panel">
        <div className="panel-heading"><div><h2>Recent payment activity</h2><p>Illustrative transactions · {period}</p></div><button className="secondary-button" onClick={() => onNotify("Payment export is unavailable because no live finance ledger is connected.")}><Download size={15}/> Export</button></div>
        <div className="table-wrap"><table className="data-table"><thead><tr><th>REFERENCE</th><th>STUDENT</th><th>DATE</th><th>METHOD</th><th>AMOUNT</th><th>STATUS</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.ref}><td className="muted-cell">{payment.ref}</td><td><strong>{payment.name}</strong><div className="staff-focus">{payment.id}</div></td><td>{payment.date}</td><td>{payment.method}</td><td><strong>{money(payment.amount)}</strong></td><td><StatusPill status="Paid"/></td></tr>)}</tbody></table></div>
      </section>
    </>}
    <div className="notice-panel"><ShieldCheck size={18}/><div><strong>Finance preview only — no real payments</strong><p>All amounts, fee schedules, balances and transaction references are fictional sample data. No receipts are issued, no money is collected, and no finance records are saved. Live finance requires school-scoped access, an auditable ledger and verified reconciliation controls.</p></div></div>
  </>;
}
function Staff({onNotify}:{onNotify:(s:string)=>void}) {
  const people: StaffMember[] = [
    { id: "STF-001", name: "Grace Phiri", role: "Head teacher", department: "Leadership", focus: "Academic leadership", status: "Active", employment: "Full-time" },
    { id: "STF-002", name: "Peter Mbewe", role: "Teacher", department: "Teaching", focus: "Mathematics · Physics", status: "Active", employment: "Full-time" },
    { id: "STF-003", name: "Lydia Zulu", role: "Teacher", department: "Teaching", focus: "English · Chichewa", status: "Active", employment: "Full-time" },
    { id: "STF-004", name: "James Banda", role: "Bursar", department: "Finance", focus: "Finance & payments", status: "Active", employment: "Full-time" },
    { id: "STF-005", name: "Memory Kamanga", role: "Administrator", department: "Administration", focus: "Student administration", status: "On leave", employment: "Full-time" },
  ];
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("All departments");
  const [status, setStatus] = useState("All statuses");
  const [selectedPerson, setSelectedPerson] = useState<StaffMember | null>(null);
  const departments = Array.from(new Set(people.map((person) => person.department))).sort();
  const visiblePeople = people.filter((person) =>
    [person.name, person.id, person.role, person.department, person.focus].join(" ").toLowerCase().includes(query.toLowerCase()) &&
    (department === "All departments" || person.department === department) &&
    (status === "All statuses" || person.status === status)
  );
  const clearFilters = () => { setQuery(""); setDepartment("All departments"); setStatus("All statuses"); };

  return <>
    <PageHeading eyebrow="PEOPLE & ACCESS" title="Staff" description="Explore the staff directory, departments and responsibilities across the school." action={<button className="button-primary" onClick={()=>onNotify("Staff invitations will be enabled after authentication and school-scoped permissions are connected.")}><Plus size={16}/> Add staff member</button>}/>
    <div className="stats-grid compact-stats">
      <StatCard label="Total staff" value="64" change="+3" sub="this academic year" icon={Users} tone="blue"/>
      <StatCard label="Teaching staff" value="48" change="75% of team" sub="teachers" icon={GraduationCap} tone="green"/>
      <StatCard label="Support staff" value="16" change="Across departments" sub="administration & support" icon={UserRound} tone="purple"/>
    </div>
    <section className="panel list-panel">
      <div className="list-toolbar staff-toolbar">
        <div><h2 className="toolbar-title">Staff directory</h2><p className="toolbar-subtitle">Illustrative staff profiles and school responsibilities.</p></div>
        <div className="staff-filter-row">
          <div className="search-box"><Search size={16}/><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search staff, role or subject..." aria-label="Search staff"/></div>
          <select className="select-control" value={department} onChange={(event)=>setDepartment(event.target.value)} aria-label="Filter by department"><option>All departments</option>{departments.map((item)=><option key={item}>{item}</option>)}</select>
          <select className="select-control" value={status} onChange={(event)=>setStatus(event.target.value)} aria-label="Filter by staff status"><option>All statuses</option><option>Active</option><option>On leave</option></select>
          <button className="secondary-button" onClick={clearFilters}><SlidersHorizontal size={15}/> Clear</button>
          <button className="secondary-button" onClick={()=>onNotify("Staff directory export will be available when verified school records are connected.")}><Download size={15}/> Export</button>
        </div>
      </div>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>STAFF MEMBER</th><th>EMPLOYEE ID</th><th>ROLE</th><th>DEPARTMENT / FOCUS</th><th>STATUS</th><th/></tr></thead><tbody>
        {visiblePeople.map((person)=><tr key={person.id}><td><div className="person-cell"><span className="table-avatar">{initials(person.name)}</span><strong>{person.name}</strong></div></td><td className="muted-cell">{person.id}</td><td>{person.role}</td><td><strong>{person.department}</strong><div className="staff-focus">{person.focus}</div></td><td><StatusPill status={person.status}/></td><td><button className="icon-button small-icon" onClick={()=>setSelectedPerson(person)} aria-label={"View " + person.name}><ChevronRight size={16}/></button></td></tr>)}
        {visiblePeople.length===0&&<tr><td colSpan={6} className="empty-state">No staff members match these filters. Try clearing them or changing your search.</td></tr>}
      </tbody></table></div>
      <div className="table-pagination"><span>Showing {visiblePeople.length} of {people.length} illustrative profiles</span><div><button disabled><ChevronLeft size={15}/></button><button className="current-page">1</button><button disabled><ChevronRight size={15}/></button></div></div>
      <div className="attendance-disclaimer"><ShieldCheck size={15}/> Staff profiles and filter results are sample data; they are not connected to school records or user accounts.</div>
    </section>
    <div className="notice-panel"><ShieldCheck size={18}/><div><strong>Access follows school roles</strong><p>Staff invitations, sign-in and permissions will only be enabled after authentication and school-scoped authorisation are implemented.</p></div></div>
    {selectedPerson&&<div className="modal-backdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget)setSelectedPerson(null);}}>
      <section className="modal staff-detail-modal" role="dialog" aria-modal="true" aria-labelledby="staff-detail-title">
        <div className="modal-heading"><div><span className="page-eyebrow">STAFF PROFILE · SAMPLE</span><h2 id="staff-detail-title">{selectedPerson.name}</h2><p>{selectedPerson.id} · {selectedPerson.department}</p></div><button className="icon-button" onClick={()=>setSelectedPerson(null)} aria-label="Close staff profile"><X size={19}/></button></div>
        <div className="student-detail-status"><span className="student-detail-avatar">{initials(selectedPerson.name)}</span><span><strong>{selectedPerson.role}</strong><small>{selectedPerson.employment}</small></span><StatusPill status={selectedPerson.status}/></div>
        <div className="student-detail-grid">
          <div><span>Employee ID</span><strong>{selectedPerson.id}</strong></div>
          <div><span>Department</span><strong>{selectedPerson.department}</strong></div>
          <div><span>Role</span><strong>{selectedPerson.role}</strong></div>
          <div><span>Responsibilities / subjects</span><strong>{selectedPerson.focus}</strong></div>
        </div>
        <div className="modal-note"><ShieldCheck size={15}/> This profile is illustrative. Employment history, payroll, personal contacts, account access and permission changes require verified school records and authorised workflows.</div>
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={()=>setSelectedPerson(null)}>Close profile</button></div>
      </section>
    </div>}
  </>;
}
function Reports({onNotify}:{onNotify:(s:string)=>void}) {
  const months=[["Jul",62],["Aug",71],["Sep",78],["Oct",74],["Nov",86]];
  return <><PageHeading eyebrow="INSIGHTS & OVERSIGHT" title="Reports" description="A snapshot of enrolment, attendance and fee collection performance." action={<button className="secondary-button" onClick={()=>onNotify("Report export is a preview action. No live school data is connected.")}><Download size={15}/> Export report</button>}/><div className="stats-grid"><StatCard label="Enrolment" value="1,248" change="+8.2%" sub="year on year" icon={Users} tone="blue"/><StatCard label="Average attendance" value="91.4%" change="+2.1%" sub="this term" icon={ClipboardCheck} tone="green"/><StatCard label="Fee collection" value="74.6%" change="+12.5%" sub="of term target" icon={Wallet} tone="amber"/><StatCard label="Assessment completion" value="88%" change="+5.4%" sub="this term" icon={FileBarChart} tone="purple"/></div><div className="dashboard-grid"><section className="panel report-panel"><div className="panel-heading"><div><h2>Attendance trend</h2><p>Average daily attendance · Term 3 sample</p></div><span className="report-unit">PERCENT</span></div><div className="bar-chart">{months.map(([month,value])=><div className="bar-column" key={month}><strong>{value}%</strong><div className="bar-track"><i style={{height:`${value}%`}}/></div><span>{month}</span></div>)}</div></section><section className="panel"><div className="panel-heading"><div><h2>Fee collection progress</h2><p>Term 3 · 2026</p></div></div><div className="report-donut"><div><strong>74.6%</strong><span>Collected</span></div></div><div className="report-legend"><span><i className="legend-collected"/>Collected <b>MK 18.64m</b></span><span><i className="legend-outstanding"/>Outstanding <b>MK 6.36m</b></span></div></section></div><div className="notice-panel"><AlertCircle size={18}/><div><strong>Illustrative reporting data</strong><p>Charts and figures demonstrate the intended reporting experience. They are not calculated from actual school records.</p></div></div></>;
}
function SettingsPage({onNotify}:{onNotify:(s:string)=>void}) { return <><PageHeading eyebrow="WORKSPACE CONFIGURATION" title="Settings" description="Manage school profile preferences and workspace configuration."/><div className="settings-grid"><section className="panel settings-panel"><div className="settings-heading"><span className="settings-icon"><School size={18}/></span><div><h2>School profile</h2><p>Basic information about this school workspace.</p></div></div><label>School name<input value="Greenfield Academy" readOnly/></label><label>School location<input value="Lilongwe, Malawi" readOnly/></label><label>Academic year<input value="2026" readOnly/></label><button className="secondary-button" onClick={()=>onNotify("School profile editing will be enabled with authenticated school settings.")}>Edit school profile</button></section><section className="panel settings-panel"><div className="settings-heading"><span className="settings-icon"><ShieldCheck size={18}/></span><div><h2>Security & access</h2><p>Access settings planned for the secure school workspace.</p></div></div><div className="setting-row"><span><strong>Role-based access</strong><small>Permissions by school role</small></span><StatusPill status="Planned"/></div><div className="setting-row"><span><strong>Audit history</strong><small>Trace sensitive changes</small></span><StatusPill status="Planned"/></div><div className="setting-row"><span><strong>School data isolation</strong><small>Separate records for each school</small></span><StatusPill status="Planned"/></div><button className="secondary-button" onClick={()=>onNotify("Security controls are not yet connected to a live identity provider.")}>Review access settings</button></section></div></>; }

function AddStudent({onClose,onSave}:{onClose:()=>void;onSave:(s:Student)=>void}) {
  const [name,setName]=useState(""); const [className,setClassName]=useState("Form 1 North"); const [guardian,setGuardian]=useState(""); const [phone,setPhone]=useState("");
  const submit=(e:React.FormEvent)=>{e.preventDefault();if(!name.trim()||!guardian.trim())return;onSave({id:`DEMO-${String(Date.now()).slice(-5)}`,name:name.trim(),className,guardian:guardian.trim(),phone,status:"Pending"});};
  return <div className="modal-backdrop" role="presentation" onMouseDown={(e)=>{if(e.target===e.currentTarget)onClose();}}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><span className="page-eyebrow">STUDENT ENROLMENT</span><h2 id="modal-title">Register a student</h2><p>Add a sample learner to this preview.</p></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={19}/></button></div><form onSubmit={submit}><label>Student full name<input autoFocus value={name} onChange={(e)=>setName(e.target.value)} placeholder="e.g. Thoko Banda" required/></label><label>Class<select value={className} onChange={(e)=>setClassName(e.target.value)}><option>Form 1 North</option><option>Form 1 South</option><option>Form 2 North</option><option>Form 2 South</option><option>Form 3 North</option><option>Standard 6</option><option>Standard 7</option></select></label><label>Parent / guardian name<input value={guardian} onChange={(e)=>setGuardian(e.target.value)} placeholder="Guardian's full name" required/></label><label>Guardian phone number<input value={phone} onChange={(e)=>setPhone(e.target.value)} placeholder="+265 ..."/></label><div className="modal-note"><AlertCircle size={15}/> This creates a temporary sample record only. It will not be stored in a school database.</div><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="button-primary"><Plus size={15}/> Add sample student</button></div></form></section></div>;
}

export default App;
