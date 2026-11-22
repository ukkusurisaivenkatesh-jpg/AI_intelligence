import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import ReactFlow, { Background, BaseEdge, Controls, EdgeLabelRenderer, getBezierPath, Handle, Position, type EdgeProps, type NodeProps } from "reactflow";
import "reactflow/dist/style.css";
import {
  ArrowDownRight, ArrowRight, Award, BookOpen, Bookmark, BriefcaseBusiness, Check,
  ChevronLeft, ChevronRight, CircleHelp, Compass, GraduationCap, Home, LayoutDashboard,
  LoaderCircle, LogOut, Menu, MessageCircle, Moon, Network, Search, ShieldCheck,
  SlidersHorizontal, Sparkles, Sun, UserRound, Users, X,
} from "lucide-react";
import { api, currentAcademicYear, token, type Career, type ChatHistoryItem, type EligibilityResult, type Profile, type Programme, type Recommendation, type User } from "./api";

type View = "dashboard" | "profile" | "explore" | "eligibility" | "recommendations" | "what-if" | "careers" | "compare" | "graph" | "chat" | "saved" | "admin";
type NavigationItem = { id: View; label: string; icon: typeof Home };

const navigation: NavigationItem[] = [
  { id: "dashboard", label: "Home", icon: Home },
  { id: "profile", label: "Academic profile", icon: UserRound },
  { id: "explore", label: "Explore programmes", icon: Search },
  { id: "eligibility", label: "Eligibility", icon: ShieldCheck },
  { id: "recommendations", label: "Recommendations", icon: Compass },
  { id: "what-if", label: "What-if simulator", icon: SlidersHorizontal },
  { id: "careers", label: "Career explorer", icon: BriefcaseBusiness },
  { id: "compare", label: "Compare programmes", icon: ArrowDownRight },
  { id: "graph", label: "Knowledge graph", icon: Network },
  { id: "chat", label: "Counselling demo", icon: MessageCircle },
  { id: "saved", label: "Saved programmes", icon: Bookmark },
  { id: "admin", label: "Admin", icon: ShieldCheck },
];

const moreViews: View[] = ["profile", "recommendations", "what-if", "compare", "graph", "chat", "saved", "admin"];
const graphNodeTypes = { knowledge: KnowledgeGraphNode };
const graphEdgeTypes = { knowledge: KnowledgeGraphEdge };
const mobileViews: Array<{ id: View | "more"; label: string; icon: typeof Home }> = [
  { id: "dashboard", label: "Home", icon: Home },
  { id: "explore", label: "Explore", icon: Search },
  { id: "eligibility", label: "Eligibility", icon: ShieldCheck },
  { id: "careers", label: "Career", icon: BriefcaseBusiness },
  { id: "more", label: "More", icon: Menu },
];

function useRemote<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await loader());
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [loader]);
  useEffect(() => { void reload(); }, [reload]);
  return { data, loading, error, reload };
}

function errorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "Something went wrong. Please try again.";
}

function Loading({ label = "Loading…" }: { label?: string }) {
  return <div className="state state-loading" role="status"><LoaderCircle className="spin" size={20} />{label}</div>;
}

function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return <div className="state state-error" role="alert"><CircleHelp size={22} /><div><strong>We couldn’t load this information.</strong><p>{message}</p><button className="button button-secondary" onClick={retry}>Try again</button></div></div>;
}

function EmptyState({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return <div className="state state-empty"><CircleHelp size={22} /><div><strong>{title}</strong><p>{message}</p>{action}</div></div>;
}

function PageTitle({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return <div className="page-title"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="title-actions">{actions}</div>}</div>;
}

function AcademicYearField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return <form className="year-field" onSubmit={event => { event.preventDefault(); onChange(draft.trim()); }}><label>Academic year<input value={draft} maxLength={20} placeholder="e.g. 2026-27" onChange={event => setDraft(event.target.value)} /></label><button className="button button-secondary">Apply</button></form>;
}

function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "accent" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = mode === "register"
        ? await api.register(fullName.trim(), email.trim(), password)
        : await api.login(email.trim(), password);
      localStorage.setItem("admitwise_token", result.access_token);
      onLogin(await api.me());
    } catch (reason) {
      localStorage.removeItem("admitwise_token");
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };
  return <main className="auth-page"><div className="auth-layout">
    <section className="auth-intro"><div className="brand"><span className="brand-mark"><GraduationCap size={22} /></span><span>AdmitWise <small>AI</small></span></div>
      <span className="eyebrow">Student guidance platform</span><h1>Make informed decisions about your next step.</h1>
      <p>Explore Indian higher-education programmes with transparent, criteria-based guidance.</p>
      <ul><li><ShieldCheck size={17} />Eligibility uses documented, year-specific criteria.</li><li><Network size={17} />Recommendations explain the factors behind each result.</li><li><BookOpen size={17} />Unverified information stays clearly marked.</li></ul>
    </section>
    <form className="auth-card" onSubmit={submit}>
    <span className="eyebrow">{mode === "register" ? "Create student account" : "Student access"}</span><h2>{mode === "register" ? "Get started" : "Welcome back"}</h2><p>{mode === "register" ? "Create an account to build your academic profile and explore options." : "Sign in to continue to your admission workspace."}</p>
    {error && <div className="notice notice-error" role="alert">{error}</div>}
    {mode === "register" && <label htmlFor="register-name">Full name<input id="register-name" autoComplete="name" required maxLength={100} value={fullName} onChange={event => setFullName(event.target.value)} /></label>}
    <label htmlFor="login-email">Email address</label><input id="login-email" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} />
    <label htmlFor="login-password">Password<input id="login-password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={mode === "register" ? 12 : 1} maxLength={72} required value={password} onChange={event => setPassword(event.target.value)} /></label>
    {mode === "register" && <small className="data-note">Use at least 12 characters. Passwords are never displayed or sent to the browser's storage.</small>}
    <button className="button button-primary button-wide" disabled={busy}>{busy ? "Please wait…" : mode === "register" ? "Create account" : "Sign in"}</button>
    <button type="button" className="text-button auth-switch" onClick={() => { setMode(mode === "register" ? "login" : "register"); setError(""); }}>{mode === "register" ? "Already registered? Sign in" : "New to AdmitWise? Create an account"}</button>
    </form>
  </div></main>;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [view, setView] = useState<View>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [comparisonIds, setComparisonIds] = useState<number[]>([]);

  useEffect(() => {
    if (!token()) {
      setAuthLoading(false);
      return;
    }
    api.me().then(setUser).catch(reason => {
      localStorage.removeItem("admitwise_token");
      setAuthError(errorMessage(reason));
    }).finally(() => setAuthLoading(false));
  }, []);
  useEffect(() => {
    const handleUnauthorized = () => setUser(null);
    window.addEventListener("admitwise:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("admitwise:unauthorized", handleUnauthorized);
  }, []);

  const visibleNavigation = navigation.filter(item => item.id !== "admin" || user?.role === "admin");
  const navigate = (next: View) => {
    setView(next);
    setMoreOpen(false);
  };
  const signOut = () => {
    localStorage.removeItem("admitwise_token");
    setUser(null);
    setView("dashboard");
  };
  const setForCompare = (id: number) => {
    setComparisonIds(previous => previous.includes(id) ? previous : [...previous, id]);
    navigate("compare");
  };

  if (authLoading) return <Loading label="Checking your session…" />;
  if (!user) return <><Login onLogin={setUser} />{authError && <div className="auth-session-error" role="status">{authError}</div>}</>;

  return <div className={`app-shell${dark ? " theme-dark" : ""}${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
    <aside className="sidebar" aria-label="Main navigation">
      <div className="sidebar-brand"><div className="brand"><span className="brand-mark"><GraduationCap size={22} /></span><span className="brand-name">AdmitWise</span></div><button className="icon-button sidebar-toggle" aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setSidebarCollapsed(value => !value)}>{sidebarCollapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button></div>
      <div className="sidebar-section-label">Workspace</div>
      <nav className="desktop-nav">{visibleNavigation.map(item => <NavigationButton key={item.id} item={item} active={view === item.id} collapsed={sidebarCollapsed} onClick={() => navigate(item.id)} />)}</nav>
      <div className="sidebar-bottom"><div className="user-chip"><span className="avatar">{user.full_name.slice(0, 1).toUpperCase()}</span><div className="user-chip-text"><strong>{user.full_name}</strong><small>{user.role === "admin" ? "Administrator" : "Student"}</small></div></div><button className="nav-button" onClick={signOut}><LogOut size={18} /><span>Sign out</span></button></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="topbar-copy"><span className="eyebrow">{user.role === "admin" ? "Administrator workspace" : "Student workspace"}</span><strong>{navigation.find(item => item.id === view)?.label}</strong></div><button className="icon-button" aria-label={dark ? "Use light theme" : "Use dark theme"} onClick={() => setDark(value => !value)}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button></header>
      <div className="page-container">
        {view === "dashboard" && <Dashboard user={user} onNavigate={navigate} />}
        {view === "profile" && <ProfilePage />}
        {view === "explore" && <ExplorePage onCompare={setForCompare} />}
        {view === "eligibility" && <EligibilityPage />}
        {view === "recommendations" && <RecommendationsPage onCompare={setForCompare} onNavigate={navigate} />}
        {view === "what-if" && <WhatIfPage />}
        {view === "careers" && <CareersPage />}
        {view === "compare" && <ComparePage initialIds={comparisonIds} />}
        {view === "graph" && <GraphPage />}
        {view === "chat" && <ChatPage />}
        {view === "saved" && <SavedPage />}
        {view === "admin" && <AdminPage user={user} />}
      </div>
    </main>
    <nav className="mobile-nav" aria-label="Mobile navigation">{mobileViews.map(item => {
      const Icon = item.icon;
      const active = item.id === "more" ? moreOpen || moreViews.includes(view) : view === item.id;
      return <button key={item.id} className={`mobile-nav-item${active ? " active" : ""}`} aria-current={item.id === view ? "page" : undefined} aria-expanded={item.id === "more" ? moreOpen : undefined} onClick={() => item.id === "more" ? setMoreOpen(value => !value) : navigate(item.id)}><Icon size={19} /><span>{item.label}</span></button>;
    })}</nav>
    {moreOpen && <><button className="more-backdrop" aria-label="Close more menu" onClick={() => setMoreOpen(false)} /><nav className="more-menu" aria-label="More navigation"><div className="more-menu-heading"><strong>More tools</strong><button className="icon-button" aria-label="Close menu" onClick={() => setMoreOpen(false)}><X size={17} /></button></div>{visibleNavigation.filter(item => moreViews.includes(item.id)).map(item => <NavigationButton key={item.id} item={item} active={view === item.id} onClick={() => navigate(item.id)} />)}<button className="nav-button more-signout" aria-label="Sign out" onClick={signOut}><LogOut size={18} /><span>Sign out</span></button></nav></>}
  </div>;
}

function NavigationButton({ item, active, collapsed = false, onClick }: { item: NavigationItem; active: boolean; collapsed?: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return <button className={`nav-button${active ? " active" : ""}`} aria-label={item.label} aria-current={active ? "page" : undefined} title={collapsed ? item.label : undefined} onClick={onClick}><Icon size={18} /><span>{item.label}</span></button>;
}

function Dashboard({ user, onNavigate }: { user: User; onNavigate: (view: View) => void }) {
  const academicYear = useMemo(() => currentAcademicYear(), []);
  const dashboardLoader = useCallback(() => api.dashboard(academicYear), [academicYear]);
  const eligibilityLoader = useCallback(() => api.eligibility(academicYear), [academicYear]);
  const dashboard = useRemote(dashboardLoader);
  const eligibility = useRemote(eligibilityLoader);
  const careers = useRemote(api.careers);
  const history = useRemote(api.counsellorHistory);
  if (dashboard.loading) return <Loading label="Loading your dashboard…" />;
  if (dashboard.error || !dashboard.data) return <ErrorState message={dashboard.error || "Dashboard data is unavailable."} retry={() => void dashboard.reload()} />;
  const { profile, recommendations, shortlist_count: savedCount } = dashboard.data;
  const completionFields = [profile.qualification, profile.aggregate_marks != null, Object.keys(profile.subject_marks || {}).length > 0, (profile.interests || []).length > 0, profile.annual_budget != null];
  const completion = Math.round(completionFields.filter(Boolean).length / completionFields.length * 100);
  const eligibleCount = eligibility.data?.filter(item => item.status === "Eligible").length;
  const topCareers = (careers.data || []).map(career => ({
    career,
    matches: career.technical_skills.filter(skill => (profile.skills || []).some(profileSkill => profileSkill.toLowerCase() === skill.toLowerCase())),
  })).sort((left, right) => right.matches.length - left.matches.length).slice(0, 3);
  return <div className="page-stack">
    <section className="welcome-panel"><div><span className="eyebrow">Your guidance overview · {academicYear}</span><h1>Welcome, {user.full_name.split(" ")[0]}</h1><p>Explore your academic options with transparent, criteria-based guidance.</p><div className="welcome-actions"><button className="button button-primary" onClick={() => onNavigate("explore")}>Explore programmes <ArrowRight size={16} /></button><button className="button button-secondary" onClick={() => onNavigate("profile")}>Update profile</button></div></div><div className="completion-ring" style={{ "--completion": `${completion}%` } as React.CSSProperties}><div><strong>{completion}%</strong><span>profile complete</span></div></div></section>
    <div className="metric-grid"><Metric label="Profile completion" value={`${completion}%`} icon={<UserRound size={18} />} onClick={() => onNavigate("profile")} /><Metric label="Eligible programmes" value={eligibility.loading ? "…" : String(eligibleCount ?? "—")} icon={<ShieldCheck size={18} />} onClick={() => onNavigate("eligibility")} /><Metric label="Saved programmes" value={String(savedCount)} icon={<Bookmark size={18} />} onClick={() => onNavigate("saved")} /><Metric label="Recommendations" value={String(recommendations.length)} icon={<Compass size={18} />} onClick={() => onNavigate("recommendations")} /></div>
    <section className="dashboard-grid">
      <article className="card"><div className="section-heading"><div><span className="eyebrow">Academic snapshot</span><h2>Performance & interests</h2></div><button className="text-button" onClick={() => onNavigate("profile")}>Edit profile <ArrowRight size={14} /></button></div><div className="snapshot-grid"><div className="snapshot-stat"><span>Overall marks</span><strong>{profile.aggregate_marks == null ? "Not provided" : `${profile.aggregate_marks}%`}</strong></div><div className="snapshot-stat"><span>Qualification</span><strong>{profile.qualification || "Not provided"}</strong></div><div className="snapshot-stat"><span>Annual budget</span><strong>{profile.annual_budget == null ? "Not provided" : `₹${profile.annual_budget.toLocaleString("en-IN")}`}</strong></div></div><h3 className="subheading">Subjects</h3><div className="chip-list">{Object.entries(profile.subject_marks || {}).length ? Object.entries(profile.subject_marks).map(([name, value]) => <Badge key={name}>{name}: {value}%</Badge>) : <span className="muted">No subject marks added yet.</span>}</div><h3 className="subheading">Interests & skills</h3><div className="chip-list">{[...(profile.interests || []), ...(profile.skills || [])].length ? [...(profile.interests || []), ...(profile.skills || [])].map((item, index) => <Badge key={`${item}-${index}`} tone={index < (profile.interests || []).length ? "accent" : "neutral"}>{item}</Badge>) : <span className="muted">Add interests and skills to your profile.</span>}</div></article>
      <article className="card"><div className="section-heading"><div><span className="eyebrow">Next steps</span><h2>Eligibility overview</h2></div><button className="text-button" onClick={() => onNavigate("eligibility")}>View details <ArrowRight size={14} /></button></div>{eligibility.loading ? <Loading label="Evaluating criteria…" /> : eligibility.error ? <InlineError message={eligibility.error} retry={() => void eligibility.reload()} /> : <div className="eligibility-summary"><strong>{eligibleCount ?? 0}</strong><span>programmes currently marked eligible</span><p>Some catalogue information is pending or unverified. Review each programme’s year-specific reasoning and source before relying on it.</p></div>}</article>
      <article className="card"><div className="section-heading"><div><span className="eyebrow">Based on your profile</span><h2>Programme recommendations</h2></div><button className="text-button" onClick={() => onNavigate("recommendations")}>View all <ArrowRight size={14} /></button></div>{recommendations.length ? <div className="compact-list">{recommendations.slice(0, 3).map(item => <div className="compact-row" key={item.programme.id}><div><strong>{item.programme.name}</strong><span>{item.programme.university?.name}</span></div><Badge tone="accent">{item.suitability.score}% match</Badge></div>)}</div> : <EmptyState title="No verified recommendations yet" message="The engine recommends only when complete, verified criteria for this academic year establish eligibility. Suitability is not admission probability." action={<button className="text-button" onClick={() => onNavigate("eligibility")}>Review eligibility <ArrowRight size={14} /></button>} />}</article>
      <article className="card"><div className="section-heading"><div><span className="eyebrow">Based on your listed skills</span><h2>Career pathway suggestions</h2></div><button className="text-button" onClick={() => onNavigate("careers")}>Explore careers <ArrowRight size={14} /></button></div>{careers.loading ? <Loading label="Loading career pathways…" /> : careers.error ? <InlineError message={careers.error} retry={() => void careers.reload()} /> : topCareers.length ? <div className="compact-list">{topCareers.map(({ career, matches }) => <div className="compact-row" key={career.id}><div><strong>{career.name}</strong><span>{matches.length ? `Profile skill match: ${matches.join(", ")}` : profile.skills.length ? career.technical_skills.slice(0, 3).join(" · ") : "Add skills to see profile matches"}</span></div><BriefcaseBusiness size={18} /></div>)}</div> : <EmptyState title="No verified career pathways found" message="Career suggestions are displayed only when provenance requirements are verified." />}</article>
      <article className="card"><div className="section-heading"><div><span className="eyebrow">Recent activity</span><h2>Counselling history</h2></div><button className="text-button" onClick={() => onNavigate("chat")}>Open counsellor <ArrowRight size={14} /></button></div>{history.loading ? <Loading label="Loading counselling history…" /> : history.error ? <InlineError message={history.error} retry={() => void history.reload()} /> : history.data?.length ? <div className="compact-list">{history.data.slice(-3).reverse().map(item => <div className="activity-row" key={item.id}><MessageCircle size={16} /><div><strong>{item.message}</strong><span>{new Date(item.created_at).toLocaleString()}</span></div></div>)}</div> : <EmptyState title="No counselling activity yet" message="Your questions and grounded responses will appear here after your first chat." />}</article>
    </section>
  </div>;
}

function Metric({ label, value, icon, onClick }: { label: string; value: string; icon: ReactNode; onClick: () => void }) {
  return <button className="metric-card" onClick={onClick}><span className="metric-icon">{icon}</span><span className="metric-label">{label}</span><strong>{value}</strong><ArrowRight className="metric-arrow" size={16} /></button>;
}

function ProfilePage() {
  const resource = useRemote(api.profile);
  const [profile, setProfile] = useState<Profile>(emptyProfile());
  const [subjectNames, setSubjectNames] = useState(["Physics", "Mathematics", "Chemistry"]);
  const [examNames, setExamNames] = useState(["JEE Main", "CUET"]);
  const [newSubject, setNewSubject] = useState("");
  const [newExam, setNewExam] = useState("");
  const [profileFacts, setProfileFacts] = useState("{}");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (resource.data) {
      const normalized = normalizeProfile(resource.data);
      setProfile(normalized);
      setProfileFacts(JSON.stringify(normalized.profile || {}, null, 2));
      setSubjectNames(previous => [...new Set([...previous, ...Object.keys(normalized.subject_marks)])]);
      setExamNames(previous => [...new Set([...previous, ...Object.keys(normalized.entrance_scores)])]);
    }
  }, [resource.data]);
  const updateSubjectMark = (subject: string, value: string) => {
    const number = value === "" ? undefined : Number(value);
    setProfile(previous => {
      const next = { ...previous.subject_marks };
      if (number === undefined) delete next[subject]; else next[subject] = number;
      return { ...previous, subject_marks: next };
    });
  };
  const updateExamResult = (exam: string, field: "score" | "rank", value: string) => {
    const number = value === "" ? undefined : Number(value);
    setProfile(previous => {
      const previousResult = previous.entrance_scores[exam];
      const result = typeof previousResult === "number" ? { score: previousResult } : { ...previousResult };
      if (number === undefined) delete result[field]; else result[field] = number;
      const next = { ...previous.entrance_scores };
      if (Object.keys(result).length) next[exam] = result;
      else delete next[exam];
      return { ...previous, entrance_scores: next };
    });
  };
  const completion = profileCompletion(profile);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (profile.aggregate_marks != null && (profile.aggregate_marks < 0 || profile.aggregate_marks > 100)) return setError("Overall marks must be between 0 and 100.");
    if (Object.values(profile.subject_marks).some(mark => !Number.isFinite(mark) || mark < 0 || mark > 100)) return setError("Subject marks must be between 0 and 100.");
    if (Object.values(profile.entrance_scores).some(result => {
      const values = typeof result === "number" ? [result] : Object.values(result);
      return values.some(value => !Number.isFinite(value) || value < 0);
    })) return setError("Entrance scores and ranks must be non-negative numbers.");
    if (profile.annual_budget != null && profile.annual_budget < 0) return setError("Annual budget cannot be negative.");
    let additionalFacts: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(profileFacts);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Expected an object");
      additionalFacts = parsed as Record<string, unknown>;
    } catch {
      return setError("Additional admission facts must be a valid JSON object.");
    }
    setSaving(true);
    try {
      const saved = await api.saveProfile({ ...profile, profile: additionalFacts });
      setProfile(normalizeProfile(saved));
      setProfileFacts(JSON.stringify(saved.profile || {}, null, 2));
      setNotice("Your academic profile has been saved.");
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  };
  if (resource.loading) return <Loading label="Loading your academic profile…" />;
  if (resource.error) return <ErrorState message={resource.error} retry={() => void resource.reload()} />;
  return <div className="page-stack"><PageTitle eyebrow="Student profile" title="Academic profile" description="Keep your details current so the inference engine can evaluate programme criteria against your profile." />
    <div className="progress-card"><div><strong>Profile completeness</strong><span>{completion}% complete</span></div><div className="progress-track"><span style={{ width: `${completion}%` }} /></div></div>
    {notice && <div className="notice notice-success" role="status"><Check size={17} />{notice}</div>}{error && <div className="notice notice-error" role="alert">{error}</div>}
    <form className="profile-form" onSubmit={submit}>
      <section className="card form-card"><div className="section-heading"><div><span className="eyebrow">01 · Academics</span><h2>Academic background</h2></div></div><div className="form-grid">
        <label>Highest qualification <span className="required">*</span><select required value={profile.qualification || ""} onChange={event => setProfile(previous => ({ ...previous, qualification: event.target.value }))}><option value="">Select qualification</option><option>12th Grade</option><option>10th Grade</option><option>Diploma</option><option>Undergraduate</option><option>Other</option></select></label>
        <label>Overall marks (%) <span className="required">*</span><input type="number" min="0" max="100" step="0.1" required value={profile.aggregate_marks ?? ""} onChange={event => setProfile(previous => ({ ...previous, aggregate_marks: event.target.value === "" ? null : Number(event.target.value) }))} /></label>
      </div><h3 className="subheading">Subject marks (%)</h3><div className="form-grid three-columns">{subjectNames.map(subject => <label key={subject}>{subject}<input type="number" min="0" max="100" step="0.1" value={profile.subject_marks[subject] ?? ""} onChange={event => updateSubjectMark(subject, event.target.value)} /></label>)}</div>
      <div className="inline-actions"><input aria-label="Add another subject" placeholder="Add another subject" maxLength={100} value={newSubject} onChange={event => setNewSubject(event.target.value)} /><button type="button" className="button button-secondary" disabled={!newSubject.trim()} onClick={() => { const name = newSubject.trim(); setSubjectNames(previous => previous.includes(name) ? previous : [...previous, name]); setNewSubject(""); }}>Add subject</button></div>
      <h3 className="subheading">Entrance examination results</h3><p className="field-hint">Enter a score, rank, or both. The applicable unit depends on the examination; unknown admission thresholds remain unverified.</p>{examNames.map(exam => {
        const result = profile.entrance_scores[exam];
        const score = typeof result === "number" ? result : result?.score;
        const rank = typeof result === "object" ? result.rank : undefined;
        return <div className="exam-result-row" key={exam}><strong>{exam}</strong><label>Score<input aria-label={`${exam} score`} type="number" min="0" step="any" value={score ?? ""} onChange={event => updateExamResult(exam, "score", event.target.value)} /></label><label>Rank<input aria-label={`${exam} rank`} type="number" min="0" step="1" value={rank ?? ""} onChange={event => updateExamResult(exam, "rank", event.target.value)} /></label></div>;
      })}<div className="inline-actions"><input aria-label="Add another entrance examination" placeholder="Add another examination" maxLength={100} value={newExam} onChange={event => setNewExam(event.target.value)} /><button type="button" className="button button-secondary" disabled={!newExam.trim()} onClick={() => { const name = newExam.trim(); setExamNames(previous => previous.includes(name) ? previous : [...previous, name]); setNewExam(""); }}>Add exam</button></div></section>
      <section className="card form-card"><div className="section-heading"><div><span className="eyebrow">02 · Preferences</span><h2>Interests & planning</h2></div></div><div className="form-grid">
        <label>Preferred location<input value={profile.preferred_location || ""} onChange={event => setProfile(previous => ({ ...previous, preferred_location: event.target.value }))} placeholder="City, state or region" /></label>
        <label>Annual tuition budget (₹)<input type="number" min="0" step="1000" value={profile.annual_budget ?? ""} onChange={event => setProfile(previous => ({ ...previous, annual_budget: event.target.value === "" ? null : Number(event.target.value) }))} /></label>
        <label className="form-full">Interests <span className="field-hint">Separate items with commas</span><textarea value={profile.interests.join(", ")} onChange={event => setProfile(previous => ({ ...previous, interests: splitList(event.target.value) }))} placeholder="Technology, research, design" /></label>
        <label className="form-full">Skills <span className="field-hint">Separate items with commas</span><textarea value={profile.skills.join(", ")} onChange={event => setProfile(previous => ({ ...previous, skills: splitList(event.target.value) }))} placeholder="Programming, communication, problem solving" /></label>
        <label className="form-full">Additional admission facts <span className="field-hint">Optional JSON used only when an official programme rule asks for a matching fact. Example: {"{\"category\":\"OBC-NCL\"}"}</span><textarea value={profileFacts} maxLength={10000} onChange={event => setProfileFacts(event.target.value)} rows={5} /></label>
        <div className="form-full"><h3 className="subheading">Aptitude ratings (1–10)</h3><div className="form-grid three-columns">{["logical", "analytical"].map(key => <label key={key}>{capitalize(key)}<input type="number" min="1" max="10" step="0.5" value={profile.aptitude[key] || ""} onChange={event => setProfile(previous => { const aptitude = { ...previous.aptitude }; if (event.target.value === "") delete aptitude[key]; else aptitude[key] = Number(event.target.value); return { ...previous, aptitude }; })} /></label>)}</div></div>
      </div><button className="button button-primary" disabled={saving}>{saving ? "Saving…" : "Save academic profile"}</button></section>
    </form>
  </div>;
}

function ExplorePage({ onCompare }: { onCompare: (id: number) => void }) {
  const [academicYear, setAcademicYear] = useState(currentAcademicYear);
  const loader = useCallback(() => api.programmes(academicYear), [academicYear]);
  const resource = useRemote(loader);
  const [query, setQuery] = useState("");
  const [savedIds, setSavedIds] = useState<number[]>([]);
  const [actionError, setActionError] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const items = (resource.data || []).filter(item => `${item.name} ${item.discipline || ""} ${item.university?.name || ""}`.toLowerCase().includes(query.toLowerCase()));
  const save = async (id: number) => {
    setSavingId(id); setActionError("");
    try { await api.save(id); setSavedIds(previous => [...previous, id]); }
    catch (reason) { setActionError(errorMessage(reason)); }
    finally { setSavingId(null); }
  };
  return <div className="page-stack"><PageTitle eyebrow="Explore" title="Explore programmes" description="Search programmes with verified criteria for the selected academic year. Verify admissions information with each institution." actions={<AcademicYearField value={academicYear} onChange={setAcademicYear} />} />
    <div className="search-field"><Search size={18} /><input aria-label="Search programmes" placeholder="Search programmes, subjects or universities" value={query} onChange={event => setQuery(event.target.value)} /></div>
    {actionError && <div className="notice notice-error">{actionError}</div>}
    {resource.loading ? <Loading label="Loading programme catalogue…" /> : resource.error ? <ErrorState message={resource.error} retry={() => void resource.reload()} /> : !resource.data?.length ? <EmptyState title="No programmes are available" message="The programme catalogue returned no records. Retry or contact the administrator." action={<button className="button button-secondary" onClick={() => void resource.reload()}>Retry</button>} /> : items.length ? <div className="programme-grid">{items.map(programme => <ProgrammeCard key={programme.id} programme={programme} actions={<><button className="button button-secondary" onClick={() => onCompare(programme.id)}>Compare</button><button className="button button-primary" disabled={savingId === programme.id || savedIds.includes(programme.id)} onClick={() => void save(programme.id)}>{savedIds.includes(programme.id) ? <><Check size={15} /> Saved</> : <><Bookmark size={15} /> {savingId === programme.id ? "Saving…" : "Save"}</>}</button></>} />)}</div> : <EmptyState title="No matching programmes" message="Try a different programme, subject or university name." />}
  </div>;
}

function EligibilityPage() {
  const [academicYear, setAcademicYear] = useState(currentAcademicYear);
  const loader = useCallback(() => api.eligibility(academicYear), [academicYear]);
  const resource = useRemote(loader);
  const counts = useMemo(() => {
    const items = resource.data || [];
    return { eligible: items.filter(item => item.status === "Eligible").length, conditional: items.filter(item => item.status === "Conditionally Eligible").length, review: items.filter(item => item.status === "Insufficient Information" || item.status === "Criteria Not Verified").length, notEligible: items.filter(item => item.status === "Not Eligible").length };
  }, [resource.data]);
  return <div className="page-stack"><PageTitle eyebrow="Knowledge engine" title="Eligibility evaluation" description={`Each result shows the criteria evaluated by the backend inference engine for ${academicYear || "no selected academic year"}. Demo or unverified criteria are not presented as confirmed admissions facts.`} actions={<AcademicYearField value={academicYear} onChange={setAcademicYear} />} />
    {resource.loading ? <Loading label="Evaluating programme criteria…" /> : resource.error ? <ErrorState message={resource.error} retry={() => void resource.reload()} /> : resource.data?.length ? <>
      <div className="status-summary"><StatusCount label="Eligible" count={counts.eligible} tone="success" /><StatusCount label="Conditional" count={counts.conditional} tone="warning" /><StatusCount label="Needs information" count={counts.review} tone="neutral" /><StatusCount label="Not eligible" count={counts.notEligible} tone="danger" /></div>
      <div className="result-list">{resource.data.map(item => <EligibilityCard key={item.programme.id} result={item} />)}</div>
    </> : <EmptyState title="No eligibility results" message="No programme records were returned for evaluation." action={<button className="button button-secondary" onClick={() => void resource.reload()}>Retry</button>} />}
  </div>;
}

function StatusCount({ label, count, tone }: { label: string; count: number; tone: "success" | "warning" | "neutral" | "danger" }) {
  return <div className="status-count"><Badge tone={tone}>{label}</Badge><strong>{count}</strong></div>;
}

function EligibilityCard({ result }: { result: EligibilityResult }) {
  const tone = result.status === "Eligible" ? "success" : result.status === "Conditionally Eligible" ? "warning" : result.status === "Not Eligible" ? "danger" : "neutral";
  const affordability = result.affordability?.status || "unknown";
  return <article className="card result-card"><div className="result-heading"><div><h2>{result.programme.name}</h2><p>{result.programme.university?.name || "University not provided"} · {result.programme.university?.location || "Location not provided"}</p></div><Badge tone={tone}>{result.status}</Badge></div>
    <small className="data-note">Academic year: {result.academic_year || "not selected"} · Criteria: {result.verification_status || result.programme.verification_status || "unknown"} · {result.programme.source_title || "No official source title"}{result.programme.source_url && <> · <a href={result.programme.source_url} target="_blank" rel="noreferrer">Source</a></>}</small>
    <div className="affordability"><strong>Affordability (separate from eligibility)</strong><Badge tone={affordability === "affordable" ? "success" : affordability === "over_budget" ? "warning" : "neutral"}>{affordability === "affordable" ? "Verified fee is within budget" : affordability === "over_budget" ? "Verified fee exceeds budget" : "Unknown — fee or budget not verified"}</Badge>{result.affordability?.academic_year && <small className="data-note">Fee year: {result.affordability.academic_year}</small>}</div>
    {affordability !== "unknown" && result.programme.fee_source_url && <SourceLink url={result.programme.fee_source_url} title={result.programme.fee_source_title} label="Fee source" />}
    <div className="reason-columns"><ReasonList title="Satisfied" values={result.satisfied} /><ReasonList title="Not satisfied" values={result.unsatisfied} /><ReasonList title="Missing / unverified" values={result.missing} /></div>
  </article>;
}

function ReasonList({ title, values }: { title: string; values: string[] }) {
  return <div><h3>{title}</h3>{values.length ? <ul>{values.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul> : <span className="muted">None reported</span>}</div>;
}

function RecommendationsPage({ onCompare, onNavigate }: { onCompare: (id: number) => void; onNavigate: (view: View) => void }) {
  const [academicYear, setAcademicYear] = useState(currentAcademicYear);
  const recommendationLoader = useCallback(() => api.recommendations(academicYear), [academicYear]);
  const recommendations = useRemote(recommendationLoader);
  const profile = useRemote(api.profile);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState<number | null>(null);
  const save = async (id: number) => {
    setSaving(id); setNotice("");
    try { await api.save(id); setNotice("Programme saved to your shortlist."); }
    catch (reason) { setNotice(errorMessage(reason)); }
    finally { setSaving(null); }
  };
  return <div className="page-stack"><PageTitle eyebrow="Personalized guidance" title="Programme recommendations" description={`Eligibility is evaluated separately from suitability for ${academicYear || "no selected academic year"}. A high suitability score is not an admission guarantee.`} actions={<AcademicYearField value={academicYear} onChange={setAcademicYear} />} />
    {notice && <div className="notice notice-info" role="status">{notice}</div>}
    {recommendations.loading || profile.loading ? <Loading label="Ranking programmes against your profile…" /> : recommendations.error ? <ErrorState message={recommendations.error} retry={() => void recommendations.reload()} /> : profile.error ? <ErrorState message={profile.error} retry={() => void profile.reload()} /> : recommendations.data?.length ? <div className="programme-grid">{recommendations.data.map(item => <RecommendationCard key={item.programme.id} recommendation={item} budget={profile.data?.annual_budget ?? null} onCompare={onCompare} onSave={save} saving={saving === item.programme.id} />)}</div> : <EmptyState title="No verified recommendations for this academic year" message="Only programmes with complete, source-backed criteria for the selected year can produce a definitive eligibility result or be recommended." action={<div className="inline-actions"><button className="button button-secondary" onClick={() => onNavigate("eligibility")}>Review eligibility</button><button className="button button-primary" onClick={() => onNavigate("profile")}>Update profile</button></div>} />}
  </div>;
}

function RecommendationCard({ recommendation, budget, onCompare, onSave, saving }: { recommendation: Recommendation; budget: number | null; onCompare: (id: number) => void; onSave: (id: number) => void; saving: boolean }) {
  const programme = recommendation.programme;
  const affordable = budget == null || programme.annual_fee == null ? null : programme.annual_fee <= budget;
  const statusTone = recommendation.status === "Eligible" ? "success" : "warning";
  return <article className="card recommendation-card"><div className="recommendation-top"><Badge tone={statusTone}>{recommendation.status}</Badge><div className="score-pill"><strong>{recommendation.suitability.score}%</strong><span>suitability</span></div></div>
    <h2>{programme.name}</h2><p className="university-line">{programme.university?.name || "University not provided"}</p>
    <div className="programme-facts"><span><BookOpen size={15} />{programme.discipline || "Discipline not specified"}</span><span><span aria-hidden="true">₹</span>{programme.annual_fee == null ? "Fee not listed" : `₹${programme.annual_fee.toLocaleString("en-IN")} / year`}</span><span><Compass size={15} />{programme.university?.location || "Location not listed"}</span></div>
    <div className="affordability"><strong>Affordability</strong>{recommendation.affordability?.status === "affordable" ? <Badge tone="success">Verified fee is within your budget</Badge> : recommendation.affordability?.status === "over_budget" ? <Badge tone="warning">Verified fee is above your budget</Badge> : <Badge>Unknown — {budget == null ? "budget not provided" : "fee not verified for this year"}</Badge>}</div>
    <div className="recommendation-explanation"><h3>Why it appears here</h3><ul>{recommendation.suitability.explanation.map((reason, index) => <li key={`${reason}-${index}`}>{reason}</li>)}</ul></div>
    <div className="eligibility-explanation"><h3>Eligibility reasoning</h3><ReasonList title="Satisfied" values={recommendation.satisfied} /><ReasonList title="Outstanding" values={[...recommendation.unsatisfied, ...recommendation.missing]} /></div>
    <small className="data-note">{programme.verification_status || "UNVERIFIED"} · academic year {programme.academic_year || "unknown"}{programme.source_url && <> · <a href={programme.source_url} target="_blank" rel="noreferrer">{programme.source_title || "Official source"}</a></>}{programme.fee_verification_status !== "VERIFIED" && " · fee not verified"}</small>
    {programme.fee_verification_status === "VERIFIED" && <SourceLink url={programme.fee_source_url} title={programme.fee_source_title} label={`Fee source · ${programme.fee_academic_year || "year unknown"}`} />}
    <div className="card-actions"><button className="button button-secondary" onClick={() => onCompare(programme.id)}>Compare</button><button className="button button-primary" disabled={saving} onClick={() => onSave(programme.id)}><Bookmark size={15} />{saving ? "Saving…" : "Save programme"}</button></div>
  </article>;
}

function WhatIfPage() {
  const profileResource = useRemote(api.profile);
  const [changes, setChanges] = useState<Partial<Profile> & { academic_year: string }>({ academic_year: currentAcademicYear() });
  const [profileFacts, setProfileFacts] = useState("{}");
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.whatIf>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (profileResource.data) {
      setChanges(previous => ({ ...previous, aggregate_marks: profileResource.data!.aggregate_marks, annual_budget: profileResource.data!.annual_budget, preferred_location: profileResource.data!.preferred_location }));
      setProfileFacts(JSON.stringify(profileResource.data.profile || {}, null, 2));
    }
  }, [profileResource.data]);
  const run = async () => {
    setLoading(true); setError("");
    try {
      const facts: unknown = JSON.parse(profileFacts);
      if (!facts || typeof facts !== "object" || Array.isArray(facts)) throw new Error("Additional admission facts must be a valid JSON object.");
      setResult(await api.whatIf({ ...changes, profile: facts as Record<string, unknown> }));
    }
    catch (reason) { setError(errorMessage(reason)); }
    finally { setLoading(false); }
  };
  if (profileResource.loading) return <Loading label="Loading profile for simulation…" />;
  if (profileResource.error) return <ErrorState message={profileResource.error} retry={() => void profileResource.reload()} />;
  return <div className="page-stack"><PageTitle eyebrow="Scenario planning" title="What-if simulator" description="Explore how changes to your profile affect the inference engine’s eligibility and suitability results. Simulated values are not saved." />
    <section className="card form-card"><div className="form-grid three-columns"><label>Academic year<input value={changes.academic_year} maxLength={20} onChange={event => setChanges(previous => ({ ...previous, academic_year: event.target.value }))} /></label><label>Overall marks (%)<input type="number" min="0" max="100" value={changes.aggregate_marks ?? ""} onChange={event => setChanges(previous => ({ ...previous, aggregate_marks: event.target.value === "" ? null : Number(event.target.value) }))} /></label><label>Annual budget (₹)<input type="number" min="0" value={changes.annual_budget ?? ""} onChange={event => setChanges(previous => ({ ...previous, annual_budget: event.target.value === "" ? null : Number(event.target.value) }))} /></label><label>Preferred location<input value={changes.preferred_location || ""} onChange={event => setChanges(previous => ({ ...previous, preferred_location: event.target.value }))} /></label><label className="form-full">Additional admission facts (JSON)<textarea value={profileFacts} maxLength={10000} rows={4} onChange={event => setProfileFacts(event.target.value)} /></label></div><button className="button button-primary" disabled={loading} onClick={() => void run()}>{loading ? "Recalculating…" : "Run simulation"} <ArrowRight size={15} /></button></section>
    {error && <div className="notice notice-error" role="alert">{error}<button className="text-button" onClick={() => void run()}>Retry</button></div>}
    {result && <div className="simulation-results"><section className="card"><div className="section-heading"><div><span className="eyebrow">Scenario result</span><h2>Newly eligible</h2></div></div>{result.newly_eligible.length ? result.newly_eligible.map(item => <EligibilityCard key={item.programme.id} result={item} />) : <EmptyState title="No new eligible programmes" message="Changing these values did not make any additional programme eligible under its current criteria." />}</section><section className="card"><div className="section-heading"><div><span className="eyebrow">Scenario result</span><h2>Programmes no longer recommended</h2></div></div>{result.no_longer_eligible.length ? result.no_longer_eligible.map(item => <div className="compact-row" key={item.id}><strong>{item.name}</strong><Badge tone="warning">No longer ranked</Badge></div>) : <EmptyState title="No recommendation changes" message="The simulated profile did not remove any current recommendations." />}</section></div>}
  </div>;
}

function CareersPage() {
  const resource = useRemote(api.careers);
  return <div className="page-stack"><PageTitle eyebrow="Career planning" title="Career explorer" description="Explore the career pathways and skills returned by the guidance service." />
    {resource.loading ? <Loading label="Loading career pathways…" /> : resource.error ? <ErrorState message={resource.error} retry={() => void resource.reload()} /> : resource.data?.length ? <div className="programme-grid">{resource.data.map(career => <CareerCard career={career} key={career.id} />)}</div> : <EmptyState title="No career pathways available" message="The careers endpoint returned no records. Retry later or ask an administrator to review the catalogue." action={<button className="button button-secondary" onClick={() => void resource.reload()}>Retry</button>} />}
  </div>;
}

function CareerCard({ career }: { career: Career }) {
  return <article className="card career-card"><span className="card-icon"><BriefcaseBusiness size={20} /></span><h2>{career.name}</h2><p>{career.description}</p><h3>Technical skills</h3><div className="chip-list">{career.technical_skills.length ? career.technical_skills.map(skill => <Badge key={skill}>{skill}</Badge>) : <span className="muted">Not listed</span>}</div><h3>People skills</h3><div className="chip-list">{career.soft_skills.length ? career.soft_skills.map(skill => <Badge key={skill}>{skill}</Badge>) : <span className="muted">Not listed</span>}</div><h3>Learning roadmap</h3>{career.roadmap.length ? <ol className="roadmap-list">{career.roadmap.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}</ol> : <span className="muted">No roadmap provided.</span>}{career.source_url && <p className="data-note">{career.verification_status} · {career.academic_year || "year not specified"} · <a href={career.source_url} target="_blank" rel="noreferrer">{career.source_title || "Source"}</a></p>}</article>;
}

function ComparePage({ initialIds }: { initialIds: number[] }) {
  const [academicYear, setAcademicYear] = useState(currentAcademicYear);
  const loader = useCallback(() => api.programmes(academicYear), [academicYear]);
  const resource = useRemote(loader);
  const [selected, setSelected] = useState<number[]>(initialIds);
  const [compared, setCompared] = useState<Programme[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => { if (initialIds.length) setSelected(previous => Array.from(new Set([...previous, ...initialIds]))); }, [initialIds]);
  const toggle = (id: number) => setSelected(previous => previous.includes(id) ? previous.filter(value => value !== id) : previous.length < 4 ? [...previous, id] : previous);
  const run = async () => {
    setError(""); setLoading(true);
    try { setCompared(await api.compare(selected, academicYear)); }
    catch (reason) { setError(errorMessage(reason)); }
    finally { setLoading(false); }
  };
  return <div className="page-stack"><PageTitle eyebrow="Side-by-side analysis" title="Compare programmes" description={`Compare catalogue details for ${academicYear || "no selected academic year"}.`} actions={<AcademicYearField value={academicYear} onChange={setAcademicYear} />} />
    {resource.loading ? <Loading label="Loading programme catalogue…" /> : resource.error ? <ErrorState message={resource.error} retry={() => void resource.reload()} /> : <>
      <section className="card"><div className="section-heading"><div><h2>Select programmes</h2><p className="muted">Choose 2–4 programmes to compare. {selected.length}/4 selected.</p></div></div><div className="selection-grid">{resource.data?.map(programme => <label className={`selection-item${selected.includes(programme.id) ? " selected" : ""}`} key={programme.id}><input type="checkbox" checked={selected.includes(programme.id)} disabled={!selected.includes(programme.id) && selected.length >= 4} onChange={() => toggle(programme.id)} /><span><strong>{programme.name}</strong><small>{programme.university?.name}</small></span></label>)}</div><button className="button button-primary" disabled={selected.length < 2 || loading} onClick={() => void run()}>{loading ? "Comparing…" : "Compare selected programmes"}</button>{error && <div className="notice notice-error" role="alert">{error}<button className="text-button" onClick={() => void run()}>Retry</button></div>}</section>
      {compared && (compared.length ? <ComparisonTable programmes={compared} /> : <EmptyState title="No comparison results" message="The API returned no matching programme records. Check your selection and retry." action={<button className="button button-secondary" onClick={() => void run()}>Retry comparison</button>} />)}
      {!compared && selected.length < 2 && <EmptyState title="Select programmes to begin" message="Choose at least two programmes above. Results will appear here." />}
    </>}
  </div>;
}

function ComparisonTable({ programmes }: { programmes: Programme[] }) {
  const rows: Array<[string, (programme: Programme) => ReactNode]> = [
    ["University", programme => programme.university?.name || "Not listed"],
    ["Location", programme => programme.university?.location || "Not listed"],
    ["Discipline", programme => programme.discipline || "Not listed"],
    ["Annual fee", programme => programme.annual_fee == null ? "Not listed" : `₹${programme.annual_fee.toLocaleString("en-IN")}`],
    ["Duration", programme => programme.duration_years == null ? "Not listed" : `${programme.duration_years} years`],
    ["Minimum marks", programme => programme.minimum_percentage == null ? "Not listed" : `${programme.minimum_percentage}%`],
    ["Required subjects", programme => programme.required_subjects.join(", ") || "Not listed"],
    ["Entrance exams", programme => programme.entrance_exams.join(", ") || "Not listed"],
    ["Admission criteria status", programme => <Badge tone={programme.verification_status === "VERIFIED" ? "success" : "warning"}>{programme.verification_status || "unknown"} · {programme.academic_year || "year unknown"}</Badge>],
    ["Fee status", programme => <Badge tone={programme.fee_verification_status === "VERIFIED" ? "success" : "warning"}>{programme.fee_verification_status || "unknown"} · {programme.fee_academic_year || "year unknown"}</Badge>],
    ["Admission source", programme => <SourceLink url={programme.source_url} title={programme.source_title} />],
    ["Fee source", programme => <SourceLink url={programme.fee_source_url} title={programme.fee_source_title} />],
  ];
  return <div className="comparison-table-wrap"><table className="comparison-table"><thead><tr><th>Criteria</th>{programmes.map(programme => <th key={programme.id}>{programme.name}</th>)}</tr></thead><tbody>{rows.map(([label, value]) => <tr key={label}><th>{label}</th>{programmes.map(programme => <td key={programme.id}>{value(programme)}</td>)}</tr>)}</tbody></table><p className="data-note">Catalogue comparisons are informational. Confirm current fees and admission criteria with the institution.</p></div>;
}

function GraphPage() {
  const academicYear = useMemo(() => currentAcademicYear(), []);
  const graphLoader = useCallback(() => api.graph(academicYear), [academicYear]);
  const graph = useRemote(graphLoader);
  if (graph.loading) return <Loading label="Loading knowledge network…" />;
  if (graph.error || !graph.data) return <ErrorState message={graph.error || "Knowledge network data is unavailable."} retry={() => void graph.reload()} />;
  const nodes = graph.data.nodes.map((node, index) => ({
    id: node.id,
    type: "knowledge",
    data: {
      category: node.label,
      name: node.name,
      verificationStatus: node.verification_status,
      academicYear: node.academic_year,
      sourceUrl: node.source_url,
    },
    position: { x: (index % 4) * 230, y: Math.floor(index / 4) * 150 },
    className: "graph-node",
  }));
  const edges = graph.data.edges.map((edge, index) => ({
    id: edge.id || `semantic-${index}`,
    type: "knowledge",
    source: edge.source,
    target: edge.target,
    label: edge.label,
    animated: false,
  }));
  return <div className="page-stack"><PageTitle eyebrow="Connected knowledge" title="Knowledge graph" description="Explore semantic relationships assembled from your profile and PostgreSQL catalogue records." />
    <div className="notice notice-info" role="status"><Network size={18} /><span>Relationships are built from application data for {graph.data.academic_year || "the selected academic year"}. Admission requirements are linked only when verified for that year.</span></div>
    {nodes.length ? <div className="graph-canvas"><ReactFlow nodes={nodes} edges={edges} nodeTypes={graphNodeTypes} edgeTypes={graphEdgeTypes} fitView fitViewOptions={{ padding: 0.2 }} nodesDraggable nodesConnectable={false} elementsSelectable><Background color="#dbe2ef" gap={22} /><Controls /></ReactFlow></div> : <EmptyState title="No graph relationships to display" message="Add subjects, entrance examinations, interests, and skills to your profile or check the application catalogue." />}
    <div className="graph-legend"><span>Student</span><span>Subject</span><span>Entrance exam</span><span>University</span><span>Programme</span><span>Interest</span><span>Skill</span><span>Career</span><span>Source document</span></div>
  </div>;
}

function KnowledgeGraphNode({ data }: NodeProps<{ category: string; name: string; verificationStatus?: string | null; academicYear?: string | null; sourceUrl?: string | null }>) {
  return <><Handle type="target" position={Position.Left} /><div className="graph-node-content"><span>{data.category}</span><strong>{data.name}</strong>{(data.verificationStatus || data.academicYear) && <small>{[data.verificationStatus, data.academicYear].filter(Boolean).join(" · ")}</small>}{data.sourceUrl && <a href={data.sourceUrl} target="_blank" rel="noreferrer">Source</a>}</div><Handle type="source" position={Position.Right} /></>;
}

function KnowledgeGraphEdge(props: EdgeProps) {
  const [path, labelX, labelY] = getBezierPath(props);
  return <>
    <BaseEdge id={props.id} path={path} markerEnd={props.markerEnd} style={props.style} />
    <EdgeLabelRenderer><div className="graph-edge-label" style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}>{props.label}</div></EdgeLabelRenderer>
  </>;
}

function ChatPage() {
  const history = useRemote(api.counsellorHistory);
  const [messages, setMessages] = useState<ChatHistoryItem[]>([]);
  const [draft, setDraft] = useState("");
  const [academicYear, setAcademicYear] = useState(currentAcademicYear());
  const [scenario, setScenario] = useState({
    aggregate_marks: "",
    annual_budget: "",
    preferred_location: "",
    subject_marks: "",
    entrance_scores: "",
    interests: "",
    skills: "",
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (history.data) setMessages(history.data); }, [history.data]);
  const send = async (value = draft) => {
    const message = value.trim();
    if (!message || sending) return;
    setDraft(""); setError(""); setSending(true);
    try {
      const changes: Partial<Profile> = {};
      if (scenario.aggregate_marks.trim()) {
        const marks = Number(scenario.aggregate_marks);
        if (!Number.isFinite(marks) || marks < 0 || marks > 100) throw new Error("Overall marks must be between 0 and 100.");
        changes.aggregate_marks = marks;
      }
      if (scenario.annual_budget.trim()) {
        const budget = Number(scenario.annual_budget);
        if (!Number.isFinite(budget) || budget < 0) throw new Error("Annual budget must be a non-negative number.");
        changes.annual_budget = budget;
      }
      if (scenario.preferred_location.trim()) changes.preferred_location = scenario.preferred_location.trim();
      if (scenario.subject_marks.trim()) {
        const marks: unknown = JSON.parse(scenario.subject_marks);
        if (!marks || typeof marks !== "object" || Array.isArray(marks) || Object.values(marks).some(mark => typeof mark !== "number" || !Number.isFinite(mark) || mark < 0 || mark > 100)) {
          throw new Error("Subject marks must be a JSON object with values from 0 to 100.");
        }
        changes.subject_marks = marks as Record<string, number>;
      }
      if (scenario.entrance_scores.trim()) {
        const scores: unknown = JSON.parse(scenario.entrance_scores);
        if (!scores || typeof scores !== "object" || Array.isArray(scores) || Object.values(scores).some(result => {
          const values = typeof result === "number" ? [result] : result && typeof result === "object" && !Array.isArray(result) ? Object.values(result) : [];
          return !values.length || values.some(score => typeof score !== "number" || !Number.isFinite(score) || score < 0);
        })) {
          throw new Error("Entrance scores must be a JSON object with non-negative numeric scores or ranks.");
        }
        changes.entrance_scores = scores as Profile["entrance_scores"];
      }
      if (scenario.interests.trim()) changes.interests = scenario.interests.split(",").map(item => item.trim()).filter(Boolean);
      if (scenario.skills.trim()) changes.skills = scenario.skills.split(",").map(item => item.trim()).filter(Boolean);
      const response = await api.counsellor(message, academicYear, changes);
      setMessages(previous => [...previous, {
        id: Date.now(),
        message,
        response: response.answer,
        created_at: new Date().toISOString(),
        engine: response.engine,
        scenario: response.scenario,
        recommendations: response.recommendations,
      }]);
    } catch (reason) {
      setDraft(message);
      setError(errorMessage(reason));
    } finally {
      setSending(false);
    }
  };
  return <div className="page-stack"><PageTitle eyebrow="Grounded guidance" title="Rule-Based Counselling Demo" description="Personalized responses use your profile, the catalogue, and deterministic eligibility rules. No external AI model is used." />
    <section className="chat-card"><div className="chat-history" aria-live="polite">
      {history.loading ? <Loading label="Loading conversation history…" /> : history.error ? <InlineError message={history.error} retry={() => void history.reload()} /> : messages.length ? messages.map(item => <div className="chat-exchange" key={item.id}><div className="chat-message user-message"><span>You</span><p>{item.message}</p><time>{new Date(item.created_at).toLocaleString()}</time></div><div className="chat-message assistant-message"><span><Sparkles size={14} />{item.engine === "rule-based-demo" ? "Rule-Based Counselling Demo" : "Saved counselling response"}</span><p>{item.response}</p>{item.recommendations?.map(recommendation => <div className="chat-source" key={recommendation.programme.id}><strong>{recommendation.programme.name}</strong><span>Eligibility: {recommendation.status} · Fee status: {recommendation.affordability?.status || "unknown"}</span>{recommendation.programme.source_url && <a href={recommendation.programme.source_url} target="_blank" rel="noreferrer">{recommendation.programme.source_title || "Official programme source"}</a>}</div>)}</div></div>) : <div className="chat-welcome"><span className="chat-welcome-icon"><MessageCircle size={22} /></span><h2>How can I help you plan?</h2><p>Ask about programme eligibility, profile information, fees or career pathways. Responses use available backend data only.</p><div className="suggested-prompts">{["What information is missing from my profile?", "Which programmes fit my profile?", "Explain my eligibility results", "Suggest career pathways", "Are any fees verified?"].map(question => <button className="prompt-chip" key={question} onClick={() => void send(question)}>{question}<ArrowRight size={14} /></button>)}</div></div>}
      {sending && <div className="chat-message assistant-message" role="status"><span><LoaderCircle size={14} className="spin" /> Rule-based counselling</span><p>Checking your profile against verified programme criteria…</p></div>}
    </div><form className="chat-composer" onSubmit={event => { event.preventDefault(); void send(); }}>{error && <div className="notice notice-error" role="alert">{error}<button type="button" className="text-button" onClick={() => void send(draft)}>Retry</button></div>}<div><input aria-label="Ask the counsellor" maxLength={2000} value={draft} onChange={event => setDraft(event.target.value)} placeholder="Ask a question about your options…" /><button className="button button-primary" disabled={!draft.trim() || sending}>{sending ? "Sending…" : "Send"} <ArrowRight size={15} /></button></div><label className="chat-year">Academic year<input value={academicYear} maxLength={20} onChange={event => setAcademicYear(event.target.value)} /></label><details className="chat-scenario"><summary>Try a what-if scenario</summary><p>Only filled fields override your saved profile for this response. Changes are not saved to your account.</p><div className="chat-scenario-grid"><label>Overall marks (%)<input type="number" min="0" max="100" value={scenario.aggregate_marks} onChange={event => setScenario(previous => ({ ...previous, aggregate_marks: event.target.value }))} /></label><label>Annual budget (₹)<input type="number" min="0" value={scenario.annual_budget} onChange={event => setScenario(previous => ({ ...previous, annual_budget: event.target.value }))} /></label><label>Preferred location<input value={scenario.preferred_location} onChange={event => setScenario(previous => ({ ...previous, preferred_location: event.target.value }))} /></label><label>Interests (comma-separated)<input value={scenario.interests} onChange={event => setScenario(previous => ({ ...previous, interests: event.target.value }))} /></label><label>Skills (comma-separated)<input value={scenario.skills} onChange={event => setScenario(previous => ({ ...previous, skills: event.target.value }))} /></label><label>Subject marks (JSON)<textarea rows={2} placeholder='{"Mathematics": 85}' value={scenario.subject_marks} onChange={event => setScenario(previous => ({ ...previous, subject_marks: event.target.value }))} /></label><label>Entrance scores / ranks (JSON)<textarea rows={2} placeholder='{"JEE Main": {"score": 90, "rank": 1200}}' value={scenario.entrance_scores} onChange={event => setScenario(previous => ({ ...previous, entrance_scores: event.target.value }))} /></label></div></details><div className="suggested-prompts">{["Recommend programmes", "Explain eligibility", "Suggest career pathways", "Show alternatives"].map(question => <button type="button" className="prompt-chip" key={question} disabled={sending} onClick={() => void send(question)}>{question}<ArrowRight size={14} /></button>)}</div></form></section>
  </div>;
}

function SavedPage() {
  const resource = useRemote(api.shortlist);
  const [error, setError] = useState("");
  const remove = async (id: number) => {
    setError("");
    try { await api.removeShortlist(id); await resource.reload(); }
    catch (reason) { setError(errorMessage(reason)); }
  };
  return <div className="page-stack"><PageTitle eyebrow="Your shortlist" title="Saved programmes" description="Programmes saved to your account for later review." />
    {error && <div className="notice notice-error" role="alert">{error}</div>}
    {resource.loading ? <Loading label="Loading saved programmes…" /> : resource.error ? <ErrorState message={resource.error} retry={() => void resource.reload()} /> : resource.data?.length ? <div className="programme-grid">{resource.data.map(programme => <ProgrammeCard key={programme.id} programme={programme} actions={<button className="button button-danger" onClick={() => void remove(programme.id)}>Remove from saved</button>} />)}</div> : <EmptyState title="No saved programmes yet" message="Save a programme from Explore or Recommendations to keep it in your shortlist." />}
  </div>;
}

function AdminPage({ user }: { user: User }) {
  const overview = useRemote(api.admin);
  const universities = useRemote(api.adminUniversities);
  const programmes = useRemote(api.adminProgrammes);
  const careers = useRemote(api.adminCareers);
  const auditLogs = useRemote(api.adminAuditLogs);
  if (user.role !== "admin") return <EmptyState title="Administrator access required" message="Your account does not have the administrator role. Admin permissions are enforced by the backend." />;
  return <div className="page-stack"><PageTitle eyebrow="Administration" title="Catalogue review" description="Inspect source documents, verification status, academic year and audit history. New catalogue records remain pending until officially reviewed." />
    {overview.loading ? <Loading label="Loading administration overview…" /> : overview.error ? <ErrorState message={overview.error} retry={() => void overview.reload()} /> : overview.data ? <div className="metric-grid admin-metrics"><StaticMetric label="Universities" value={overview.data.universities} icon={<GraduationCap size={18} />} /><StaticMetric label="Programmes" value={overview.data.programmes} icon={<BookOpen size={18} />} /><StaticMetric label="Career pathways" value={overview.data.careers} icon={<BriefcaseBusiness size={18} />} /><StaticMetric label="Students" value={overview.data.students} icon={<Users size={18} />} /><StaticMetric label="Rules" value={overview.data.rules} icon={<Award size={18} />} /></div> : null}
    <AdminDataSection title="Institutions" count={universities.data?.length} loading={universities.loading} error={universities.error} retry={() => void universities.reload()}>
      {universities.data?.map(item => <article className="admin-record" key={item.id}><div className="admin-record-heading"><div><h3>{item.name}</h3><span>{item.institution_type || "Type unavailable"} · {[item.city, item.state].filter(Boolean).join(", ") || item.location || "Location unavailable"}</span></div><Badge tone={item.verification_status === "VERIFIED" ? "success" : "warning"}>{item.verification_status}</Badge></div><p>{item.recognition_info || "Recognition details unavailable."}</p><small className="data-note">Academic year: {item.academic_year || "not specified"} · Last updated: {item.last_updated || "not recorded"}{item.data_notes ? ` · ${item.data_notes}` : ""}</small><SourceLink url={item.source_url} title={item.source_title} /><small className="data-note">Website: {item.website || "not provided"}</small></article>)}
    </AdminDataSection>
    <AdminDataSection title="Programmes and admission criteria" count={programmes.data?.length} loading={programmes.loading} error={programmes.error} retry={() => void programmes.reload()}>
      {programmes.data?.map(item => <article className="admin-record" key={item.id}><div className="admin-record-heading"><div><h3>{item.name}</h3><span>{item.university?.name || "Institution unavailable"} · {item.discipline || "Discipline unavailable"}</span></div><Badge tone={item.verification_status === "VERIFIED" ? "success" : "warning"}>{item.verification_status || "UNVERIFIED"}</Badge></div><p>Criteria year: {item.academic_year || "not specified"} · Complete: {item.criteria_complete ? "yes" : "no"} · Fee status: {item.fee_verification_status || "unknown"} · Fee year: {item.fee_academic_year || "not specified"}</p><small className="data-note">{item.minimum_qualification || "Qualification unavailable"} · Minimum percentage: {item.minimum_percentage ?? "unknown"} · Subjects: {item.required_subjects.join(", ") || "not specified"} · Entrance exams: {item.entrance_exams.join(", ") || "not specified"}</small><SourceLink url={item.source_url} title={item.source_title} /><SourceLink url={item.fee_source_url} title={item.fee_source_title} label="Fee source" /><small className="data-note">{item.data_notes || item.fee_data_notes || "No review notes."}</small></article>)}
    </AdminDataSection>
    <AdminDataSection title="Career pathways" count={careers.data?.length} loading={careers.loading} error={careers.error} retry={() => void careers.reload()}>
      {careers.data?.map(item => <article className="admin-record" key={item.id}><div className="admin-record-heading"><h3>{item.name}</h3><Badge tone={item.verification_status === "VERIFIED" ? "success" : "warning"}>{item.verification_status || "UNVERIFIED"}</Badge></div><p>{item.description}</p><small className="data-note">Academic year: {item.academic_year || "not specified"} · Skills: {item.technical_skills.join(", ") || "not listed"}</small><SourceLink url={item.source_url} title={item.source_title} /></article>)}
    </AdminDataSection>
    <AdminDataSection title="Audit log" count={auditLogs.data?.length} loading={auditLogs.loading} error={auditLogs.error} retry={() => void auditLogs.reload()}>
      {auditLogs.data?.map(entry => <article className="admin-record" key={entry.id}><div className="admin-record-heading"><h3>{entry.action} · {entry.entity_type} {entry.entity_id}</h3><small>{entry.created_at ? new Date(entry.created_at).toLocaleString() : "Time unavailable"}</small></div><p>Actor: {entry.actor || "unknown"}</p><pre className="audit-payload">{JSON.stringify(entry.payload, null, 2)}</pre></article>)}
    </AdminDataSection>
  </div>;
}

function AdminDataSection({ title, count, loading, error, retry, children }: { title: string; count?: number; loading: boolean; error: string; retry: () => void; children: ReactNode }) {
  return <section className="card admin-section"><div className="section-heading"><div><span className="eyebrow">Catalogue validation</span><h2>{title}{count != null ? ` · ${count}` : ""}</h2></div></div>{loading ? <Loading label={`Loading ${title.toLowerCase()}…`} /> : error ? <InlineError message={error} retry={retry} /> : count === 0 ? <EmptyState title={`No ${title.toLowerCase()} records`} message="No records were returned by the administration API." /> : <div className="admin-record-list">{children}</div>}</section>;
}

function SourceLink({ url, title, label = "Official source" }: { url?: string | null; title?: string | null; label?: string }) {
  return url ? <p className="admin-source"><span>{label}: {title || "Source document"}</span><a href={url} target="_blank" rel="noreferrer">Open source</a></p> : <small className="data-note">{label}: unavailable</small>;
}

function StaticMetric({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return <div className="metric-card static-metric"><span className="metric-icon">{icon}</span><span className="metric-label">{label}</span><strong>{value}</strong></div>;
}

function ProgrammeCard({ programme, actions }: { programme: Programme; actions: ReactNode }) {
  return <article className="card programme-card"><div className="programme-card-top"><span className="card-icon"><GraduationCap size={20} /></span><Badge tone={programme.verification_status === "VERIFIED" ? "success" : "warning"}>{programme.verification_status || "UNVERIFIED"}</Badge></div><h2>{programme.name}</h2><p className="university-line">{programme.university?.name || "University not provided"}</p><div className="programme-facts"><span><Compass size={15} />{programme.university?.location || "Location not listed"}</span><span><span aria-hidden="true">₹</span>{programme.annual_fee == null ? "Fee not verified" : `₹${programme.annual_fee.toLocaleString("en-IN")} / year`}</span></div><small className="data-note">Academic year: {programme.academic_year || "not specified"} · Fee status: {programme.fee_verification_status || "unknown"}</small><SourceLink url={programme.source_url} title={programme.source_title} /><div className="card-actions">{actions}</div></article>;
}

function InlineError({ message, retry }: { message: string; retry: () => void }) {
  return <div className="inline-error" role="alert"><span>{message}</span><button className="text-button" onClick={retry}>Retry</button></div>;
}

function emptyProfile(): Profile {
  return { subject_marks: {}, entrance_scores: {}, interests: [], aptitude: {}, skills: [], profile: {} };
}

function normalizeProfile(profile: Profile): Profile {
  return { ...emptyProfile(), ...profile, subject_marks: profile.subject_marks || {}, entrance_scores: profile.entrance_scores || {}, interests: profile.interests || [], aptitude: profile.aptitude || {}, skills: profile.skills || [], profile: profile.profile || {} };
}

function profileCompletion(profile: Profile) {
  const fields = [Boolean(profile.qualification), profile.aggregate_marks != null, Object.keys(profile.subject_marks).length > 0, profile.interests.length > 0, profile.annual_budget != null];
  return Math.round(fields.filter(Boolean).length / fields.length * 100);
}

function splitList(value: string) {
  return value.split(",").map(item => item.trim()).filter(Boolean);
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
