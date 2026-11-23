import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Plus, Search, ShieldCheck, Users, X } from "lucide-react";

type Lesson = {
  id: number;
  day: string;
  start: string;
  end: string;
  className: string;
  subject: string;
  teacher: string;
  room: string;
  tone: string;
};

const initialLessons: Lesson[] = [
  { id: 1, day: "Monday", start: "07:30", end: "08:20", className: "Form 2 North", subject: "Mathematics", teacher: "Peter Mbewe", room: "Room 04", tone: "blue" },
  { id: 2, day: "Monday", start: "08:30", end: "09:20", className: "Form 2 North", subject: "Physics", teacher: "Peter Mbewe", room: "Lab 01", tone: "violet" },
  { id: 3, day: "Monday", start: "09:40", end: "10:30", className: "Form 1 South", subject: "English", teacher: "Lydia Zulu", room: "Room 02", tone: "green" },
  { id: 4, day: "Tuesday", start: "07:30", end: "08:20", className: "Form 2 North", subject: "Biology", teacher: "Grace Phiri", room: "Lab 02", tone: "green" },
  { id: 5, day: "Tuesday", start: "08:30", end: "09:20", className: "Form 1 South", subject: "Mathematics", teacher: "Peter Mbewe", room: "Room 03", tone: "blue" },
  { id: 6, day: "Wednesday", start: "07:30", end: "08:20", className: "Form 2 North", subject: "English", teacher: "Lydia Zulu", room: "Room 04", tone: "green" },
  { id: 7, day: "Wednesday", start: "08:30", end: "09:20", className: "Form 3 North", subject: "Chemistry", teacher: "Grace Phiri", room: "Lab 01", tone: "amber" },
  { id: 8, day: "Thursday", start: "07:30", end: "08:20", className: "Form 1 South", subject: "Geography", teacher: "Memory Kamanga", room: "Room 05", tone: "amber" },
  { id: 9, day: "Thursday", start: "08:30", end: "09:20", className: "Form 2 North", subject: "Physics", teacher: "Peter Mbewe", room: "Lab 01", tone: "violet" },
  { id: 10, day: "Friday", start: "07:30", end: "08:20", className: "Form 3 North", subject: "Biology", teacher: "Grace Phiri", room: "Lab 02", tone: "green" },
];

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const classes = ["All classes", "Form 1 South", "Form 2 North", "Form 3 North"];
const teachers = ["All teachers", "Peter Mbewe", "Lydia Zulu", "Grace Phiri", "Memory Kamanga"];
const subjects = ["Mathematics", "English", "Physics", "Chemistry", "Biology", "Geography", "Chichewa", "Computer Studies"];
const times = ["07:30", "08:30", "09:40", "10:30", "11:20", "12:10", "13:30", "14:20"];

export function Timetable({ onNotify }: { onNotify: (message: string) => void }) {
  const [lessons, setLessons] = useState(initialLessons);
  const [day, setDay] = useState("Monday");
  const [classFilter, setClassFilter] = useState("All classes");
  const [teacherFilter, setTeacherFilter] = useState("All teachers");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Lesson | null>(null);
  const [draft, setDraft] = useState({ day: "Monday", start: "10:30", end: "11:20", className: "Form 2 North", subject: "Mathematics", teacher: "Peter Mbewe", room: "Room 04" });
  const [error, setError] = useState("");

  const visible = useMemo(() => lessons.filter((lesson) =>
    lesson.day === day &&
    (classFilter === "All classes" || lesson.className === classFilter) &&
    (teacherFilter === "All teachers" || lesson.teacher === teacherFilter) &&
    [lesson.subject, lesson.teacher, lesson.className, lesson.room].join(" ").toLowerCase().includes(search.toLowerCase())
  ).sort((a,b) => a.start.localeCompare(b.start)), [lessons, day, classFilter, teacherFilter, search]);

  const dayCount = lessons.filter((lesson) => lesson.day === day).length;
  const openSlots = Math.max(0, 8 - dayCount);

  function addLesson(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (draft.start >= draft.end) {
      setError("The lesson end time must be after its start time.");
      return;
    }
    const collision = lessons.some((lesson) => lesson.day === draft.day &&
      (lesson.className === draft.className || lesson.teacher === draft.teacher || lesson.room === draft.room) &&
      draft.start < lesson.end && draft.end > lesson.start);
    if (collision) {
      setError("This class, teacher or room already has a lesson during that time.");
      return;
    }
    const tones = ["blue", "violet", "green", "amber"];
    setLessons((current) => [...current, { ...draft, id: Math.max(0, ...current.map((item) => item.id)) + 1, tone: tones[current.length % tones.length] }]);
    setDay(draft.day);
    setClassFilter("All classes");
    setTeacherFilter("All teachers");
    setSearch("");
    setShowForm(false);
    onNotify("Sample lesson added to this browser preview.");
  }

  return <>
    <div className="page-heading timetable-heading">
      <div><span className="page-eyebrow">ACADEMIC PLANNING</span><h1>Timetable</h1><p>Plan the school week and review class, teacher and room allocations.</p></div>
      <div className="heading-actions"><button className="button-primary" onClick={() => { setError(""); setShowForm(true); }}><Plus size={16}/> Add lesson</button></div>
    </div>
    <div className="stats-grid compact-stats timetable-stats">
      <article className="stat-card"><div className="stat-card-top"><span>Scheduled lessons</span><span className="stat-icon blue"><CalendarDays size={18}/></span></div><div className="stat-value">{lessons.length}</div><div className="stat-foot"><span>Sample entries</span><span>Weekly view</span></div></article>
      <article className="stat-card"><div className="stat-card-top"><span>Classes covered</span><span className="stat-icon green"><Users size={18}/></span></div><div className="stat-value">{new Set(lessons.map((item) => item.className)).size}</div><div className="stat-foot"><span>Across the week</span><span>Illustrative</span></div></article>
      <article className="stat-card"><div className="stat-card-top"><span>Open slots today</span><span className="stat-icon amber"><Clock3 size={18}/></span></div><div className="stat-value">{openSlots}</div><div className="stat-foot"><span>{day}</span><span>Out of 8 periods</span></div></article>
    </div>
    <section className="panel timetable-panel">
      <div className="timetable-toolbar">
        <div><div className="toolbar-title">Weekly schedule</div><p className="toolbar-subtitle">Select a day to inspect its lessons.</p></div>
        <div className="timetable-filters">
          <label><span>Class</span><select className="select-control" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>{classes.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>Teacher</span><select className="select-control" value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)}>{teachers.map((item) => <option key={item}>{item}</option>)}</select></label>
        </div>
      </div>
      <div className="timetable-day-tabs" role="tablist" aria-label="Weekday">
        {days.map((item) => <button key={item} role="tab" aria-selected={day === item} className={day === item ? "selected" : ""} onClick={() => setDay(item)}><span>{item.slice(0,3)}</span><small>{lessons.filter((lesson) => lesson.day === item).length} lessons</small></button>)}
      </div>
      <div className="timetable-search"><Search size={16}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search subject, teacher, class or room..." aria-label="Search timetable"/></div>
      <div className="timetable-list">
        {visible.map((lesson) => <button className="timetable-lesson" key={lesson.id} onClick={() => setSelected(lesson)}>
          <span className="lesson-time"><strong>{lesson.start}</strong><small>{lesson.end}</small></span>
          <span className={"lesson-color " + lesson.tone}/>
          <span className="lesson-main"><strong>{lesson.subject}</strong><small>{lesson.className} · {lesson.teacher}</small></span>
          <span className="lesson-room">{lesson.room}</span><ChevronRight size={16}/>
        </button>)}
        {visible.length === 0 && <div className="empty-state timetable-empty">No lessons match this day and these filters. Try another day or clear a filter.</div>}
      </div>
      <div className="timetable-footer"><span>{visible.length} lessons shown · {day}</span><span>Sample timetable · Not saved</span></div>
    </section>
    <div className="notice-panel"><ShieldCheck size={18}/><div><strong>Preview scheduling only</strong><p>Lessons are stored in this browser session only. Teacher availability, room capacity, school calendar rules, substitutions, publishing and database persistence are not connected. The form checks basic time overlaps within this sample schedule; it is not a substitute for server-side validation.</p></div></div>

    {selected && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section className="modal lesson-detail-modal" role="dialog" aria-modal="true" aria-labelledby="lesson-detail-title"><div className="modal-heading"><div><span className="page-eyebrow">{selected.day.toUpperCase()} · LESSON DETAILS</span><h2 id="lesson-detail-title">{selected.subject}</h2><p>{selected.start}–{selected.end} · {selected.room}</p></div><button className="icon-button" onClick={() => setSelected(null)} aria-label="Close"><X size={18}/></button></div><div className="student-detail-grid"><div><span>Class / stream</span><strong>{selected.className}</strong></div><div><span>Teacher</span><strong>{selected.teacher}</strong></div><div><span>Day</span><strong>{selected.day}</strong></div><div><span>Room</span><strong>{selected.room}</strong></div></div><div className="modal-actions"><button className="secondary-button" onClick={() => setSelected(null)}>Close</button></div></section></div>}

    {showForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false); }}><section className="modal lesson-form-modal" role="dialog" aria-modal="true" aria-labelledby="lesson-form-title"><div className="modal-heading"><div><span className="page-eyebrow">WEEKLY SCHEDULE</span><h2 id="lesson-form-title">Add a lesson</h2><p>Create an illustrative timetable entry.</p></div><button className="icon-button" onClick={() => setShowForm(false)} aria-label="Close"><X size={18}/></button></div>
      <form onSubmit={addLesson}>
        <div className="lesson-form-grid">
          <label>Day<select required value={draft.day} onChange={(e) => setDraft({...draft, day:e.target.value})}>{days.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Class<select required value={draft.className} onChange={(e) => setDraft({...draft, className:e.target.value})}>{classes.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Subject<select required value={draft.subject} onChange={(e) => setDraft({...draft, subject:e.target.value})}>{subjects.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Teacher<select required value={draft.teacher} onChange={(e) => setDraft({...draft, teacher:e.target.value})}>{teachers.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Start time<select required value={draft.start} onChange={(e) => setDraft({...draft, start:e.target.value})}>{times.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>End time<select required value={draft.end} onChange={(e) => setDraft({...draft, end:e.target.value})}>{times.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="lesson-room-field">Room<input required maxLength={30} value={draft.room} onChange={(e) => setDraft({...draft, room:e.target.value})}/></label>
        </div>
        {error && <p className="lesson-form-error" role="alert">{error}</p>}
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="button-primary">Add to preview</button></div>
      </form>
    </section></div>}
  </>;
}
