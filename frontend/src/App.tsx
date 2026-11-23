import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import ReactFlow, { Background, BaseEdge, Controls, EdgeLabelRenderer, getBezierPath, Handle, Position, ReactFlowProvider, useReactFlow, type Edge, type EdgeProps, type Node, type NodeProps } from "reactflow";
import "reactflow/dist/style.css";
import {
  ArrowDownRight, ArrowRight, Award, BookOpen, Bookmark, BriefcaseBusiness, Check,
  ChevronLeft, ChevronRight, CircleHelp, Compass, GraduationCap, Home, LayoutDashboard,
  LoaderCircle, LogOut, Menu, MessageCircle, Moon, Network, Search, ShieldCheck,
  SlidersHorizontal, Sparkles, Sun, UserRound, Users, X,
} from "lucide-react";
import { api, currentAcademicYear, token, type Career, type ChatHistoryItem, type EligibilityResult, type ExploreSuggestion, type Profile, type Programme, type ProgrammeComparison, type Recommendation, type User } from "./api";
import { buildDemoSemanticNetwork, demoProgrammesForCareer, DEMO_PROGRAMMES, filterDemoProgrammes, rankDemoProgrammes, selectDemoProgrammes, semanticNetworkWithDemo, type DemoProgramme } from "./demoCatalogue";

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

function Login({ onLogin, onDemo }: { onLogin: (user: User) => void; onDemo: () => void }) {
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
    <button type="button" className="button button-secondary button-wide demo-entry-button" onClick={onDemo}>Explore read-only demo</button>
    </form>
  </div></main>;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const [view, setView] = useState<View>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [comparisonIds, setComparisonIds] = useState<number[]>([]);
  const [demoComparisonIds, setDemoComparisonIds] = useState<string[]>([]);

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
  const setDemoForCompare = (id: string) => {
    setDemoComparisonIds(previous => previous.includes(id) || previous.length >= 4 ? previous : [...previous, id]);
    navigate("compare");
  };

  if (authLoading) return <Loading label="Checking your session…" />;
  if (demoMode) return <DemoWorkspace onExit={() => setDemoMode(false)} />;
  if (!user) return <><Login onLogin={setUser} onDemo={() => setDemoMode(true)} />{authError && <div className="auth-session-error" role="status">{authError}</div>}</>;

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
        {view === "explore" && <ExplorePage onCompare={setForCompare} onDemoCompare={setDemoForCompare} />}
        {view === "eligibility" && <EligibilityPage />}
        {view === "recommendations" && <RecommendationsPage onCompare={setForCompare} onDemoCompare={setDemoForCompare} onNavigate={navigate} />}
        {view === "what-if" && <WhatIfPage />}
        {view === "careers" && <CareersPage />}
        {view === "compare" && <ComparePage initialIds={comparisonIds} initialDemoIds={demoComparisonIds} />}
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
      <article className="card"><div className="section-heading"><div><span className="eyebrow">Based on your profile</span><h2>Verified eligible programmes</h2></div><button className="text-button" onClick={() => onNavigate("recommendations")}>View guidance <ArrowRight size={14} /></button></div>{recommendations.length ? <div className="compact-list">{recommendations.slice(0, 3).map(item => <div className="compact-row" key={item.programme.id}><div><strong>{item.programme.name}</strong><span>{item.programme.university?.name}</span></div><Badge tone="success">Eligible under verified criteria</Badge></div>)}</div> : <EmptyState title="No verified eligible programmes yet" message="You can still explore catalogue suggestions, but only complete, verified criteria for the selected year can establish eligibility." action={<button className="text-button" onClick={() => onNavigate("recommendations")}>Explore suggestions <ArrowRight size={14} /></button>} />}</article>
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

function ExplorePage({ onCompare, onDemoCompare }: { onCompare: (id: number) => void; onDemoCompare: (id: string) => void }) {
  const [academicYear, setAcademicYear] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [institution, setInstitution] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");
  const filters = useMemo(
    () => ({ q: query, status, institution, location, category }),
    [query, status, institution, location, category],
  );
  const loader = useCallback(
    () => api.programmes(academicYear, { ...filters, limit: 30 }),
    [academicYear, filters],
  );
  const resource = useRemote(loader);
  const [additional, setAdditional] = useState<Programme[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState("");
  const [savedIds, setSavedIds] = useState<number[]>([]);
  const [actionError, setActionError] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  useEffect(() => { setAdditional([]); setMoreError(""); }, [academicYear, filters]);
  const items = [...(resource.data?.items || []), ...additional];
  const categories = Array.from(new Set([
    ...items.map(item => item.discipline),
    ...DEMO_PROGRAMMES.map(item => item.discipline),
  ].filter((value): value is string => Boolean(value)))).sort();
  const demoItems = filterDemoProgrammes(DEMO_PROGRAMMES, {
    query,
    institution,
    location,
    discipline: category,
    status,
  });
  const loadMore = async () => {
    if (!resource.data || loadingMore) return;
    setLoadingMore(true);
    setMoreError("");
    try {
      const page = await api.programmes(academicYear, {
        ...filters,
        offset: items.length,
        limit: 30,
      });
      setAdditional(previous => [...previous, ...page.items]);
    } catch (reason) {
      setMoreError(errorMessage(reason));
    } finally {
      setLoadingMore(false);
    }
  };
  const save = async (id: number) => {
    setSavingId(id); setActionError("");
    try { await api.save(id); setSavedIds(previous => [...previous, id]); }
    catch (reason) { setActionError(errorMessage(reason)); }
    finally { setSavingId(null); }
  };
  return <div className="page-stack"><PageTitle eyebrow="Explore" title="Explore programmes" description="Browse catalogue listings, including pending records. Pending or unavailable information is not verified admission guidance." actions={<AcademicYearField value={academicYear} onChange={setAcademicYear} />} />
    <div className="search-field"><Search size={18} /><input aria-label="Search programmes, institutions, subjects or locations" placeholder="Search programmes, institutions, subjects or locations" value={query} onChange={event => setQuery(event.target.value)} /></div>
    <div className="catalogue-filters">
      <label>Verification status<select value={status} onChange={event => setStatus(event.target.value)}><option value="">All statuses</option><option value="VERIFIED">Verified criteria</option><option value="PENDING_VERIFICATION">Pending verification</option><option value="UNAVAILABLE">Unavailable</option><option value="EXPIRED">Expired</option><option value="NOT_CURRENT_FOR_YEAR">Not current for selected year</option></select></label>
      <label>Institution<input value={institution} onChange={event => setInstitution(event.target.value)} placeholder="Filter institution" /></label>
      <label>Location<input value={location} onChange={event => setLocation(event.target.value)} placeholder="Filter city or state" /></label>
      <label>Programme category<select value={category} onChange={event => setCategory(event.target.value)}><option value="">All categories</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
    </div>
    {actionError && <div className="notice notice-error">{actionError}</div>}
    {resource.loading ? <Loading label="Loading programme catalogue…" /> : <>
      {resource.error && <ErrorState message={resource.error} retry={() => void resource.reload()} />}
      {!!resource.data?.total && <>
        <section className="recommendation-section">
          <div className="section-heading"><div><h2>Actual catalogue records</h2><p className="muted">Catalogue entries retain their own source and verification status.</p></div></div>
          <p className="data-note">Showing {items.length} of {resource.data.total} matching catalogue records.</p>
          <div className="programme-grid">{items.map(programme => <ProgrammeCard key={programme.id} programme={programme} actions={<><button className="button button-secondary" onClick={() => onCompare(programme.id)}>Compare</button><button className="button button-primary" disabled={savingId === programme.id || savedIds.includes(programme.id)} onClick={() => void save(programme.id)}>{savedIds.includes(programme.id) ? <><Check size={15} /> Saved</> : <><Bookmark size={15} /> {savingId === programme.id ? "Saving…" : "Save"}</>}</button></>} />)}</div>
          {moreError && <div className="notice notice-error" role="alert">{moreError}<button className="text-button" onClick={() => void loadMore()}>Retry</button></div>}
          {items.length < resource.data.total && <button className="button button-secondary load-more" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? "Loading…" : "Load more programmes"}</button>}
        </section>
      </>}
      {demoItems.length > 0 && <section className="recommendation-section" aria-label="Demonstration programme catalogue">
        <div className="section-heading"><div><span className="eyebrow">Separate from the official catalogue</span><h2>{resource.data?.total ? "Illustrative demonstration programmes" : "Demonstration programme catalogue"}</h2><p className="muted">These locally maintained examples are not stored in or treated as official admission records.</p></div></div>
        <div className="notice notice-warning" role="status">Demonstration data — not official admission information</div>
        <div className="programme-grid">{demoItems.map(programme => <DemoProgrammeCard key={programme.id} programme={programme} onCompare={onDemoCompare} />)}</div>
      </section>}
      {!resource.data?.total && !demoItems.length && <EmptyState title="No programmes match these filters" message="Try clearing the academic year or filters. Demonstration programmes are shown when they match the selected search and filters." action={<button className="button button-secondary" onClick={() => { setAcademicYear(""); setQuery(""); setStatus(""); setInstitution(""); setLocation(""); setCategory(""); }}>Clear filters</button>} />}
    </>}
  </div>;
}

function DemoProgrammeCard({ programme, onCompare }: { programme: DemoProgramme; onCompare: (id: string) => void }) {
  return <article className="card programme-card demo-programme-card">
    <div className="programme-card-top"><span className="card-icon"><GraduationCap size={20} /></span><Badge tone="warning">DEMO_ONLY</Badge></div>
    <h2>{programme.name}</h2>
    <p className="university-line">{programme.institutionName} · {programme.degreeLevel}</p>
    <p>{programme.description}</p>
    <div className="programme-facts"><span><Compass size={15} />{programme.location}</span><span><BookOpen size={15} />{programme.duration}</span></div>
    <small className="data-note">Academic year: {programme.academicYear} · Source: {programme.dataSource}</small>
    <p className="demo-eligibility">Demo data — official eligibility criteria unavailable.</p>
    <div className="demo-card-details"><strong>Related subjects</strong><span>{programme.relatedSubjects.join(", ")}</span><strong>Related skills</strong><span>{programme.relatedSkills.join(", ")}</span><strong>Illustrative career pathways</strong><span>{programme.careerPathways.join(", ")}</span></div>
    <div className="card-actions"><button className="button button-secondary" onClick={() => onCompare(programme.id)}>Compare demo programme</button></div>
  </article>;
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

function RecommendationsPage({ onCompare, onDemoCompare, onNavigate }: { onCompare: (id: number) => void; onDemoCompare: (id: string) => void; onNavigate: (view: View) => void }) {
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
  const categories = recommendations.data;
  const demoSuggestions = useMemo(
    () => profile.data ? rankDemoProgrammes(profile.data) : [],
    [profile.data],
  );
  return <div className="page-stack"><PageTitle eyebrow="Personalized guidance" title="Programme recommendations" description={`Verified recommendations require complete criteria for ${academicYear || "the selected academic year"}. Explore suggestions are relevance matches, not eligibility or admission predictions.`} actions={<AcademicYearField value={academicYear} onChange={setAcademicYear} />} />
    {notice && <div className="notice notice-info" role="status">{notice}</div>}
    {recommendations.loading || profile.loading ? <Loading label="Checking your profile against catalogue records…" /> : recommendations.error ? <ErrorState message={recommendations.error} retry={() => void recommendations.reload()} /> : profile.error ? <ErrorState message={profile.error} retry={() => void profile.reload()} /> : <>
      <section className="recommendation-section"><div className="section-heading"><div><span className="eyebrow">Verified criteria only</span><h2>Verified recommendations</h2><p className="muted">Only complete and source-backed criteria can establish eligibility.</p></div></div>{categories?.verified_recommendations.length ? <div className="programme-grid">{categories.verified_recommendations.map(item => <RecommendationCard key={item.programme.id} recommendation={item} onCompare={onCompare} onSave={save} saving={saving === item.programme.id} />)}</div> : <EmptyState title="No programmes can currently be confirmed eligible" message="This does not mean there are no relevant programmes. Review the exploratory suggestions and verify requirements with their official sources." action={<button className="button button-secondary" onClick={() => onNavigate("eligibility")}>Review eligibility results</button>} />}</section>
      <section className="recommendation-section"><div className="section-heading"><div><span className="eyebrow">Relevance matches, not admissions advice</span><h2>Explore suggestions</h2><p className="muted">These catalogue records align with profile details. Pending or unavailable requirements must be checked with the institution.</p></div></div>{categories?.explore_suggestions.length ? <div className="programme-grid">{categories.explore_suggestions.map(item => <ExploreSuggestionCard key={item.programme.id} suggestion={item} onCompare={onCompare} onSave={save} saving={saving === item.programme.id} />)}</div> : <EmptyState title="No profile-based suggestions yet" message="Add interests, skills, subject marks, a career goal, or a location preference to your profile. You can also browse all catalogue records in Explore." action={<div className="inline-actions"><button className="button button-secondary" onClick={() => onNavigate("profile")}>Complete profile</button><button className="button button-primary" onClick={() => onNavigate("explore")}>Browse catalogue</button></div>} />}</section>
      <section className="recommendation-section"><div className="section-heading"><div><span className="eyebrow">Illustrative matches only</span><h2>Exploratory programme suggestions</h2><p className="muted">Ranked from your saved interests, subjects, skills, and career preferences. These are illustrative suggestions, not verified admission recommendations.</p></div></div><div className="notice notice-warning" role="status">Demonstration data — not official admission information</div><div className="programme-grid">{demoSuggestions.map(({ programme, reasons }) => <DemoSuggestionCard key={programme.id} programme={programme} reasons={reasons} onCompare={onDemoCompare} />)}</div></section>
    </>}
  </div>;
}

function DemoSuggestionCard({ programme, reasons, onCompare }: { programme: DemoProgramme; reasons: string[]; onCompare: (id: string) => void }) {
  const explanation = reasons.length
    ? reasons
    : ["No matching profile details were found; this is a general illustrative option."];
  return <article className="card recommendation-card demo-programme-card">
    <div className="recommendation-top"><Badge tone="warning">Illustrative suggestion</Badge><Badge>DEMO_ONLY</Badge></div>
    <h2>{programme.name}</h2><p className="university-line">{programme.institutionName} · {programme.location}</p>
    <div className="programme-facts"><span><BookOpen size={15} />{programme.discipline}</span><span>{programme.duration}</span></div>
    <div className="recommendation-explanation"><h3>Why it appears</h3><ul>{explanation.map((reason, index) => <li key={`${reason}-${index}`}>{reason}</li>)}</ul></div>
    <p className="demo-eligibility">Illustrative suggestion only — not a verified admission recommendation.</p>
    <small className="data-note">{programme.academicYear} · {programme.dataSource}</small>
    <div className="card-actions"><button className="button button-secondary" onClick={() => onCompare(programme.id)}>Compare demo programme</button></div>
  </article>;
}

function RecommendationCard({ recommendation, onCompare, onSave, saving }: { recommendation: Recommendation; onCompare: (id: number) => void; onSave: (id: number) => void; saving: boolean }) {
  const programme = recommendation.programme;
  return <article className="card recommendation-card"><div className="recommendation-top"><Badge tone="success">Eligible under verified criteria</Badge></div>
    <h2>{programme.name}</h2><p className="university-line">{programme.university?.name || "University not provided"}</p>
    <div className="programme-facts"><span><BookOpen size={15} />{programme.discipline || "Discipline not specified"}</span><span><span aria-hidden="true">₹</span>{programme.annual_fee == null ? "Fee not verified" : `₹${programme.annual_fee.toLocaleString("en-IN")} / year`}</span><span><Compass size={15} />{programme.university?.location || "Location not listed"}</span></div>
    <div className="affordability"><strong>Affordability</strong>{recommendation.affordability?.status === "affordable" ? <Badge tone="success">Verified fee is within your budget</Badge> : recommendation.affordability?.status === "over_budget" ? <Badge tone="warning">Verified fee is above your budget</Badge> : <Badge>Unknown — fee or budget not verified</Badge>}</div>
    <div className="recommendation-explanation"><h3>Profile matches</h3><ul>{recommendation.relevance_reasons.map((reason, index) => <li key={`${reason}-${index}`}>{reason}</li>)}</ul></div>
    <div className="eligibility-explanation"><h3>Eligibility reasoning</h3><ReasonList title="Satisfied" values={recommendation.satisfied} /><ReasonList title="Outstanding" values={[...recommendation.unsatisfied, ...recommendation.missing]} /></div>
    <small className="data-note">{programme.criteria_status || programme.verification_status || "UNVERIFIED"} · academic year {programme.academic_year || "unknown"}{programme.source_url && <> · <a href={programme.source_url} target="_blank" rel="noreferrer">{programme.source_title || "Official source"}</a></>}</small>
    {programme.fee_verification_status === "VERIFIED" && <SourceLink url={programme.fee_source_url} title={programme.fee_source_title} label={`Fee source · ${programme.fee_academic_year || "year unknown"}`} />}
    <div className="card-actions"><button className="button button-secondary" onClick={() => onCompare(programme.id)}>Compare</button><button className="button button-primary" disabled={saving} onClick={() => onSave(programme.id)}><Bookmark size={15} />{saving ? "Saving…" : "Save programme"}</button></div>
  </article>;
}

function ExploreSuggestionCard({ suggestion, onCompare, onSave, saving }: { suggestion: ExploreSuggestion; onCompare: (id: number) => void; onSave: (id: number) => void; saving: boolean }) {
  const programme = suggestion.programme;
  return <article className="card recommendation-card"><div className="recommendation-top"><Badge tone="warning">Explore suggestion · verify details</Badge><Badge>{suggestion.eligibility_status}</Badge></div>
    <h2>{programme.name}</h2><p className="university-line">{programme.university?.name || "Institution not available"}</p>
    <div className="programme-facts"><span><BookOpen size={15} />{programme.discipline || "Category unavailable"}</span><span><Compass size={15} />{programme.university?.location || "Location unavailable"}</span><span>{programme.academic_year || "Academic year not specified"}</span></div>
    <div className="recommendation-explanation"><h3>Why it may be relevant</h3><ul>{suggestion.relevance_reasons.map((reason, index) => <li key={`${reason}-${index}`}>{reason}</li>)}</ul></div>
    <div className="eligibility-explanation"><ReasonList title="Missing / unverified" values={suggestion.missing.length ? suggestion.missing : ["Eligibility is not established by this relevance suggestion."]} /><ReasonList title="Unsatisfied verified criteria" values={suggestion.unsatisfied} /></div>
    <div className="affordability"><strong>Affordability</strong><Badge>{suggestion.affordability?.status === "unknown" ? "Unknown — fee or budget not verified" : suggestion.affordability?.status}</Badge></div>
    <small className="data-note">{programme.criteria_status || programme.verification_status || "UNVERIFIED"} · criteria year {programme.academic_year || "not specified"} · fee {programme.fee_verification_status || "unknown"}{programme.source_url && <> · <a href={programme.source_url} target="_blank" rel="noreferrer">{programme.source_title || "Catalogue source"}</a></>}</small>
    <div className="card-actions"><button className="button button-secondary" onClick={() => onCompare(programme.id)}>Compare</button><button className="button button-primary" disabled={saving} onClick={() => onSave(programme.id)}><Bookmark size={15} />{saving ? "Saving…" : "Save suggestion"}</button></div>
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
  const profile = useRemote(api.profile);
  const careers = useMemo(() => {
    const records = resource.data || [];
    if (!profile.data) return records;
    const profileTerms = [
      ...Object.keys(profile.data.subject_marks || {}),
      ...(profile.data.interests || []),
      ...(profile.data.skills || []),
    ].map(term => term.toLocaleLowerCase());
    const goal = profile.data.profile?.career_goal;
    const goals = (Array.isArray(goal) ? goal : typeof goal === "string" ? [goal] : [])
      .filter((term): term is string => typeof term === "string")
      .map(term => term.toLocaleLowerCase());
    const matches = (career: Career) => {
      const searchable = [
        career.name,
        career.description,
        ...(career.related_subjects || []),
        ...(career.technical_skills || []),
        ...(career.soft_skills || []),
        ...(career.learning_areas || []),
      ].join(" ").toLocaleLowerCase();
      return [...profileTerms, ...goals].filter(term => term && searchable.includes(term)).length;
    };
    return [...records].sort((left, right) => matches(right) - matches(left));
  }, [resource.data, profile.data]);
  return <div className="page-stack"><PageTitle eyebrow="Career planning" title="Career explorer" description="Illustrative career pathways are local examples, not employment guarantees. Verified catalogue career records are labeled separately." />
    {profile.error && <div className="notice notice-info" role="status">Personalization is unavailable because the profile could not be loaded. The career catalogue remains available.</div>}
    {resource.loading ? <Loading label="Loading career pathways…" /> : resource.error ? <ErrorState message={resource.error} retry={() => void resource.reload()} /> : careers.length ? <div className="programme-grid">{careers.map(career => <CareerCard career={career} key={career.id} />)}</div> : <EmptyState title="No career pathways available" message="The career catalogue returned no records. Retry later or ask an administrator to review the catalogue." action={<button className="button button-secondary" onClick={() => void resource.reload()}>Retry</button>} />}
  </div>;
}

function CareerCard({ career }: { career: Career }) {
  const demoProgrammes = demoProgrammesForCareer(career.name, career.related_disciplines || []);
  return <article className="card career-card"><div className="career-heading"><span className="card-icon"><BriefcaseBusiness size={20} /></span><Badge tone={career.illustrative ? "warning" : "success"}>{career.illustrative ? "Illustrative pathway" : career.verification_status || "Verified catalogue"}</Badge></div><h2>{career.name}</h2><p>{career.description}</p>{career.illustrative && <p className="notice notice-info">Illustrative information only. This pathway does not guarantee employment or describe salary or placement outcomes.</p>}<h3>Related academic subjects</h3><div className="chip-list">{career.related_subjects?.length ? career.related_subjects.map(subject => <Badge key={subject}>{subject}</Badge>) : <span className="muted">Not listed</span>}</div><h3>Relevant skills</h3><div className="chip-list">{[...career.technical_skills, ...career.soft_skills].length ? [...career.technical_skills, ...career.soft_skills].map(skill => <Badge key={skill}>{skill}</Badge>) : <span className="muted">Not listed</span>}</div><h3>Suggested learning areas</h3>{(career.learning_areas || career.roadmap).length ? <ul className="roadmap-list">{(career.learning_areas || career.roadmap).map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}</ul> : <span className="muted">Not listed</span>}<h3>Typical responsibilities</h3>{career.responsibilities?.length ? <ul className="roadmap-list">{career.responsibilities.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}</ul> : <span className="muted">Not listed</span>}{career.related_programmes?.length ? <><h3>Related catalogue programmes</h3><div className="chip-list">{career.related_programmes.map(programme => <Badge key={programme.id}>{programme.name} · {programme.verification_status}</Badge>)}</div></> : null}{demoProgrammes.length > 0 && <><h3>Illustrative demo programmes</h3><p className="data-note">These are illustrative relationships only; they do not imply admission or employment outcomes.</p><div className="chip-list">{demoProgrammes.map(programme => <Badge key={programme.id} tone="warning">{programme.name} · DEMO_ONLY</Badge>)}</div></>}{career.source_url ? <p className="data-note">{career.verification_status} · {career.academic_year || "year not specified"} · <a href={career.source_url} target="_blank" rel="noreferrer">{career.source_title || "Source"}</a></p> : career.illustrative ? <p className="data-note">{career.source_title} · {career.data_notes}</p> : null}</article>;
}

function ComparePage({ initialIds, initialDemoIds }: { initialIds: number[]; initialDemoIds: string[] }) {
  const [academicYear, setAcademicYear] = useState("");
  const loader = useCallback(() => api.programmes(academicYear, { limit: 500 }), [academicYear]);
  const resource = useRemote(loader);
  const [selected, setSelected] = useState<number[]>(initialIds);
  const [selectedDemo, setSelectedDemo] = useState<string[]>(initialDemoIds);
  const [compared, setCompared] = useState<ProgrammeComparison[] | null>(null);
  const [demoCompared, setDemoCompared] = useState<DemoProgramme[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => { if (initialIds.length) setSelected(previous => Array.from(new Set([...previous, ...initialIds]))); }, [initialIds]);
  useEffect(() => { if (initialDemoIds.length) setSelectedDemo(previous => Array.from(new Set([...previous, ...initialDemoIds]))); }, [initialDemoIds]);
  const toggle = (id: number) => setSelected(previous => previous.includes(id) ? previous.filter(value => value !== id) : previous.length < 4 ? [...previous, id] : previous);
  const toggleDemo = (id: string) => {
    setDemoCompared(null);
    setSelectedDemo(previous => previous.includes(id) ? previous.filter(value => value !== id) : previous.length < 4 ? [...previous, id] : previous);
  };
  const run = async () => {
    setError(""); setLoading(true);
    try { setCompared(await api.compare(selected, academicYear)); }
    catch (reason) { setError(errorMessage(reason)); }
    finally { setLoading(false); }
  };
  const runDemoComparison = () => {
    setDemoCompared(selectDemoProgrammes(selectedDemo));
  };
  return <div className="page-stack"><PageTitle eyebrow="Side-by-side analysis" title="Compare programmes" description="Official catalogue comparisons retain their verification details. Demo comparisons use only illustrative subjects, skills, duration, and pathways." actions={<AcademicYearField value={academicYear} onChange={setAcademicYear} />} />
    {resource.loading ? <Loading label="Loading programme catalogue…" /> : <>
      {resource.error && <ErrorState message={resource.error} retry={() => void resource.reload()} />}
      {!!resource.data?.total && <>
        <section className="card"><div className="section-heading"><div><h2>Official catalogue programmes</h2><p className="muted">Choose 2–4 verified or pending catalogue records. {selected.length}/4 selected.</p></div></div><div className="selection-grid">{resource.data.items.map(programme => <label className={`selection-item${selected.includes(programme.id) ? " selected" : ""}`} key={programme.id}><input type="checkbox" checked={selected.includes(programme.id)} disabled={!selected.includes(programme.id) && selected.length >= 4} onChange={() => toggle(programme.id)} /><span><strong>{programme.name}</strong><small>{programme.university?.name || "Institution unavailable"} · {programme.criteria_status || programme.verification_status}</small></span></label>)}</div><button className="button button-primary" disabled={selected.length < 2 || loading} onClick={() => void run()}>{loading ? "Comparing…" : "Compare selected official programmes"}</button>{error && <div className="notice notice-error" role="alert">{error}<button className="text-button" onClick={() => void run()}>Retry</button></div>}</section>
        {compared && (compared.length ? <ComparisonTable programmes={compared} /> : <EmptyState title="No comparison results" message="The API returned no matching programme records. Check your selection and retry." action={<button className="button button-secondary" onClick={() => void run()}>Retry comparison</button>} />)}
      </>}
      <section className="recommendation-section" aria-label="Demonstration programme comparison">
        <div className="section-heading"><div><span className="eyebrow">Not official admissions data</span><h2>Compare demonstration programmes</h2><p className="muted">Select 2–4 illustrative records. Demo programmes are compared locally and are never sent to or stored in the catalogue database. {selectedDemo.length}/4 selected.</p></div></div>
        <div className="notice notice-warning" role="status">Demonstration data — not official admission information</div>
        <div className="selection-grid">{DEMO_PROGRAMMES.map(programme => <label className={`selection-item${selectedDemo.includes(programme.id) ? " selected" : ""}`} key={programme.id}><input type="checkbox" checked={selectedDemo.includes(programme.id)} disabled={!selectedDemo.includes(programme.id) && selectedDemo.length >= 4} onChange={() => toggleDemo(programme.id)} /><span><strong>{programme.name}</strong><small>{programme.discipline} · DEMO_ONLY</small></span></label>)}</div>
        <button className="button button-primary" disabled={selectedDemo.length < 2} onClick={runDemoComparison}>Compare selected demo programmes</button>
        {demoCompared && (demoCompared.length >= 2 ? <DemoComparisonTable programmes={demoCompared} /> : <div className="notice notice-info" role="status">Select at least two demonstration programmes to compare.</div>)}
      </section>
      {!resource.data?.total && !selectedDemo.length && <EmptyState title="Select programmes to begin" message="Choose two or more demonstration programmes above, or use the official catalogue comparison if records are available." />}
    </>}
  </div>;
}

function DemoComparisonTable({ programmes }: { programmes: DemoProgramme[] }) {
  const rows: Array<[string, (programme: DemoProgramme) => ReactNode]> = [
    ["Discipline", programme => programme.discipline],
    ["Degree level", programme => programme.degreeLevel],
    ["Duration", programme => programme.duration],
    ["Related subjects", programme => programme.relatedSubjects.join(", ")],
    ["Related skills", programme => programme.relatedSkills.join(", ")],
    ["Career pathways", programme => programme.careerPathways.join(", ")],
    ["Verification status", programme => <Badge tone="warning">{programme.verificationStatus}</Badge>],
  ];
  return <div className="comparison-table-wrap"><table className="comparison-table"><thead><tr><th>Attribute</th>{programmes.map(programme => <th key={programme.id}>{programme.name}</th>)}</tr></thead><tbody>{rows.map(([label, value]) => <tr key={label}><th>{label}</th>{programmes.map(programme => <td key={programme.id}>{value(programme)}</td>)}</tr>)}</tbody></table><p className="data-note">No fees, cutoffs, or eligibility conclusions are included in demo comparisons.</p></div>;
}

type DemoWorkspaceView = "explore" | "suggestions" | "compare" | "careers" | "graph";

const EMPTY_DEMO_PROFILE: Profile = {
  subject_marks: {},
  entrance_scores: {},
  interests: [],
  aptitude: {},
  skills: [],
  profile: {},
};

function DemoWorkspace({ onExit }: { onExit: () => void }) {
  const [view, setView] = useState<DemoWorkspaceView>("explore");
  const [query, setQuery] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compared, setCompared] = useState<DemoProgramme[] | null>(null);
  const [graphQuery, setGraphQuery] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const suggestions = useMemo(() => rankDemoProgrammes(EMPTY_DEMO_PROFILE), []);
  const programmes = filterDemoProgrammes(DEMO_PROGRAMMES, { query, discipline });
  const disciplines = Array.from(new Set(DEMO_PROGRAMMES.map(programme => programme.discipline))).sort();
  const network = useMemo(() => buildDemoSemanticNetwork(), []);
  const careerPathways = useMemo(() => Array.from(new Set(DEMO_PROGRAMMES.flatMap(programme => programme.careerPathways))).sort(), []);
  const chooseForComparison = (id: string) => {
    setSelectedIds(previous => previous.includes(id) || previous.length >= 4 ? previous : [...previous, id]);
    setCompared(null);
    setView("compare");
  };
  const toggleComparison = (id: string) => {
    setCompared(null);
    setSelectedIds(previous => previous.includes(id)
      ? previous.filter(selected => selected !== id)
      : previous.length < 4 ? [...previous, id] : previous);
  };
  const matchingIds = new Set(network.nodes.filter(node =>
    node.name.toLocaleLowerCase().includes(graphQuery.trim().toLocaleLowerCase()),
  ).map(node => node.id));
  const visibleIds = new Set(matchingIds);
  if (graphQuery.trim()) {
    for (const edge of network.edges) {
      if (matchingIds.has(edge.source)) visibleIds.add(edge.target);
      if (matchingIds.has(edge.target)) visibleIds.add(edge.source);
    }
  }
  const graphNodes = network.nodes.filter(node => visibleIds.has(node.id));
  const graphEdges = network.edges.filter(edge => visibleIds.has(edge.source) && visibleIds.has(edge.target));
  const rowsByCategory = new Map<string, number>();
  const categories = Array.from(new Set(graphNodes.map(node => node.label)));
  const flowNodes: Node<GraphNodeData>[] = graphNodes.map(node => {
    const row = rowsByCategory.get(node.label) || 0;
    rowsByCategory.set(node.label, row + 1);
    return {
      id: node.id,
      type: "knowledge",
      data: {
        category: node.label,
        name: node.name,
        verificationStatus: node.verification_status,
        academicYear: node.academic_year,
        dataSource: node.data_source,
      },
      position: { x: categories.indexOf(node.label) * 330, y: row * 145 },
    };
  });
  const flowEdges: Edge[] = graphEdges.map(edge => ({
    id: edge.id,
    type: "knowledge",
    source: edge.source,
    target: edge.target,
    label: edge.label,
  }));
  const selectedNode = network.nodes.find(node => node.id === selectedNodeId);
  const demoCompared = selectDemoProgrammes(selectedIds);

  return <div className="demo-workspace">
    <header className="demo-workspace-header"><div className="brand"><span className="brand-mark"><GraduationCap size={22} /></span><span>AdmitWise <small>Demo</small></span></div><div className="demo-header-actions"><Badge tone="warning">Read-only demo</Badge><button className="button button-secondary" onClick={onExit}>Return to sign in</button></div></header>
    <div className="notice notice-warning demo-workspace-notice" role="status">Demonstration data — not official admission information. This workspace uses local examples only; no account, profile, admin, or backend data is accessed.</div>
    <nav className="demo-workspace-nav" aria-label="Demo workspace navigation">
      {([
        ["explore", "Explore programmes"],
        ["suggestions", "Exploratory suggestions"],
        ["compare", "Compare"],
        ["careers", "Career explorer"],
        ["graph", "Knowledge graph"],
      ] as Array<[DemoWorkspaceView, string]>).map(([id, label]) => <button key={id} className={`button ${view === id ? "button-primary" : "button-secondary"}`} aria-current={view === id ? "page" : undefined} onClick={() => setView(id)}>{label}</button>)}
    </nav>
    <main className="demo-workspace-content">
      {view === "explore" && <div className="page-stack">
        <PageTitle eyebrow="Read-only demo" title="Explore programmes" description="Browse fictitious, locally bundled examples separate from the official catalogue." />
        <div className="search-field"><Search size={18} /><input aria-label="Search demo programmes" placeholder="Search programmes, subjects, skills or pathways" value={query} onChange={event => setQuery(event.target.value)} /></div>
        <label className="demo-discipline-filter">Programme discipline<select value={discipline} onChange={event => setDiscipline(event.target.value)}><option value="">All disciplines</option>{disciplines.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <div className="programme-grid">{programmes.map(programme => <DemoProgrammeCard key={programme.id} programme={programme} onCompare={chooseForComparison} />)}</div>
        {!programmes.length && <EmptyState title="No demo programmes match" message="Try a different search or select all disciplines." action={<button className="button button-secondary" onClick={() => { setQuery(""); setDiscipline(""); }}>Clear filters</button>} />}
      </div>}
      {view === "suggestions" && <div className="page-stack">
        <PageTitle eyebrow="Read-only demo" title="Exploratory programme suggestions" description="General illustrative examples only. This demo has no student profile and makes no verified admission recommendations." />
        <div className="notice notice-warning" role="status">Suggestions are not personalized, eligibility results, suitability scores, or admission probabilities.</div>
        <div className="programme-grid">{suggestions.map(({ programme, reasons }) => <DemoSuggestionCard key={programme.id} programme={programme} reasons={reasons} onCompare={chooseForComparison} />)}</div>
      </div>}
      {view === "compare" && <div className="page-stack">
        <PageTitle eyebrow="Read-only demo" title="Compare programmes" description="Compare two to four local demonstration records. Selections are not saved or sent to a service." />
        <div className="notice notice-warning" role="status">No fees, cutoffs, eligibility conclusions, or verified admission claims are included.</div>
        <section className="card"><div className="section-heading"><div><h2>Select 2–4 demonstration programmes</h2><p className="muted">{selectedIds.length}/4 selected</p></div></div><div className="selection-grid">{DEMO_PROGRAMMES.map(programme => <label className={`selection-item${selectedIds.includes(programme.id) ? " selected" : ""}`} key={programme.id}><input type="checkbox" checked={selectedIds.includes(programme.id)} disabled={!selectedIds.includes(programme.id) && selectedIds.length >= 4} onChange={() => toggleComparison(programme.id)} /><span><strong>{programme.name}</strong><small>{programme.discipline} · DEMO_ONLY</small></span></label>)}</div><button className="button button-primary" disabled={selectedIds.length < 2} onClick={() => setCompared(demoCompared)}>Compare selected demo programmes</button></section>
        {compared && compared.length >= 2 && <DemoComparisonTable programmes={compared} />}
      </div>}
      {view === "careers" && <div className="page-stack">
        <PageTitle eyebrow="Read-only demo" title="Career explorer" description="Illustrative career pathway labels connected to demonstration programmes; no job or salary outcomes are implied." />
        <div className="notice notice-warning" role="status">Illustrative pathways only — no job guarantees, salaries, or placement claims.</div>
        <div className="programme-grid">{careerPathways.map(pathway => {
          const related = DEMO_PROGRAMMES.filter(programme => programme.careerPathways.includes(pathway));
          return <article className="card career-card" key={pathway}><div className="career-heading"><span className="card-icon"><BriefcaseBusiness size={20} /></span><Badge tone="warning">Illustrative pathway</Badge></div><h2>{pathway}</h2><p>This is a demonstration career label, not a verified career outcome.</p><h3>Related demonstration programmes</h3><div className="chip-list">{related.map(programme => <Badge key={programme.id} tone="warning">{programme.name} · DEMO_ONLY</Badge>)}</div></article>;
        })}</div>
      </div>}
      {view === "graph" && <div className="page-stack">
        <PageTitle eyebrow="Read-only demo" title="Knowledge graph" description="Relationships are descriptive links from illustrative data only; they do not represent verified admissions facts." />
        <div className="notice notice-warning" role="status">All nodes are marked DEMO_ONLY. No eligibility or admission relationships are present.</div>
        <div className="search-field"><Search size={18} /><input aria-label="Search demo knowledge graph" placeholder="Find a demo node" value={graphQuery} onChange={event => setGraphQuery(event.target.value)} /></div>
        {flowNodes.length ? <GraphCanvas nodes={flowNodes} edges={flowEdges} onNodeSelect={setSelectedNodeId} /> : <EmptyState title="No graph nodes match" message="Try a different search." action={<button className="button button-secondary" onClick={() => setGraphQuery("")}>Clear search</button>} />}
        {selectedNode && <aside className="card graph-node-details"><span className="eyebrow">{selectedNode.label}</span><h2>{selectedNode.name}</h2><small className="data-note">Verification: DEMO_ONLY · Source: Illustrative demonstration data</small></aside>}
      </div>}
    </main>
  </div>;
}

function ComparisonTable({ programmes }: { programmes: ProgrammeComparison[] }) {
  const criteriaValue = (programme: Programme, value: string | number | null | undefined) => {
    if (value != null && value !== "") return value;
    return programme.criteria_status === "VERIFIED" ? "Not available" : "Not verified";
  };
  const rows: Array<[string, (programme: ProgrammeComparison) => ReactNode]> = [
    ["University", programme => programme.university?.name || "Not listed"],
    ["Location", programme => programme.university?.location || "Not listed"],
    ["Discipline", programme => programme.discipline || "Not listed"],
    ["Academic year", programme => programme.academic_year || "Not specified"],
    ["Eligibility status", programme => <><Badge>{programme.eligibility_status}</Badge>{programme.eligibility_missing.length > 0 && <small className="data-note">{programme.eligibility_missing.join("; ")}</small>}</>],
    ["Annual fee", programme => programme.annual_fee == null ? criteriaValue(programme, null) : `₹${programme.annual_fee.toLocaleString("en-IN")}`],
    ["Duration", programme => programme.duration_years == null ? "Not listed" : `${programme.duration_years} years`],
    ["Minimum marks", programme => programme.minimum_percentage == null ? criteriaValue(programme, null) : `${programme.minimum_percentage}%`],
    ["Required subjects", programme => programme.required_subjects.length ? programme.required_subjects.join(", ") : criteriaValue(programme, null)],
    ["Entrance exams", programme => programme.entrance_exams.length ? programme.entrance_exams.join(", ") : criteriaValue(programme, null)],
    ["Admission criteria status", programme => <Badge tone={programme.criteria_status === "VERIFIED" ? "success" : "warning"}>{criteriaStatusLabel(programme.criteria_status || programme.verification_status)}</Badge>],
    ["Fee status", programme => <Badge tone={programme.fee_verification_status === "VERIFIED" ? "success" : "warning"}>{programme.fee_verification_status || "unknown"} · {programme.fee_academic_year || "year unknown"}</Badge>],
    ["Admission source", programme => <SourceLink url={programme.source_url} title={programme.source_title} />],
    ["Fee source", programme => <SourceLink url={programme.fee_source_url} title={programme.fee_source_title} />],
    ["Career pathways", programme => programme.career_pathways.length ? programme.career_pathways.map(career => `${career.name} (${career.verification_status})`).join(", ") : "Not available"],
  ];
  return <div className="comparison-table-wrap"><table className="comparison-table"><thead><tr><th>Criteria</th>{programmes.map(programme => <th key={programme.id}>{programme.name}</th>)}</tr></thead><tbody>{rows.map(([label, value]) => <tr key={label}><th>{label}</th>{programmes.map(programme => <td key={programme.id}>{value(programme)}</td>)}</tr>)}</tbody></table><p className="data-note">Catalogue comparisons are informational. Confirm current fees and admission criteria with the institution.</p></div>;
}

function GraphPage() {
  const academicYear = useMemo(() => currentAcademicYear(), []);
  const graphLoader = useCallback(() => api.graph(academicYear), [academicYear]);
  const graph = useRemote(graphLoader);
  const [includeDemo, setIncludeDemo] = useState(false);
  const [query, setQuery] = useState("");
  const [nodeType, setNodeType] = useState("");
  const [relationship, setRelationship] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const combinedGraph = useMemo(
    () => graph.data ? semanticNetworkWithDemo(graph.data, includeDemo) : null,
    [graph.data, includeDemo],
  );
  if (graph.loading) return <Loading label="Loading knowledge network…" />;
  if (graph.error || !combinedGraph) return <ErrorState message={graph.error || "Knowledge network data is unavailable."} retry={() => void graph.reload()} />;
  const graphNodes = combinedGraph.nodes;
  const graphEdges = combinedGraph.edges;
  const nodeTypes = Array.from(new Set(graphNodes.map(node => node.label))).sort();
  const relationTypes = Array.from(new Set(graphEdges.map(edge => edge.label))).sort();
  const matchingIds = new Set(
    graphNodes
      .filter(node => (!nodeType || node.label === nodeType) && node.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
      .map(node => node.id),
  );
  const visibleIds = new Set(matchingIds);
  if (query.trim()) {
    for (const edge of graphEdges) {
      if (matchingIds.has(edge.source)) visibleIds.add(edge.target);
      if (matchingIds.has(edge.target)) visibleIds.add(edge.source);
    }
  }
  const visibleNodes = graphNodes.filter(node =>
    visibleIds.has(node.id) && (!nodeType || node.label === nodeType),
  );
  const visibleEdges = graphEdges.filter(edge =>
    visibleIds.has(edge.source)
    && visibleIds.has(edge.target)
    && (!relationship || edge.label === relationship),
  );
  const categoryOrder = Array.from(new Set(visibleNodes.map(node => node.label))).sort();
  const categoryRows = new Map<string, number>();
  const connectedIds = new Set<string>();
  for (const edge of visibleEdges) {
    if (edge.source === selectedNodeId) connectedIds.add(edge.target);
    if (edge.target === selectedNodeId) connectedIds.add(edge.source);
  }
  const nodes: Node<GraphNodeData>[] = visibleNodes.map(node => {
    const row = categoryRows.get(node.label) || 0;
    categoryRows.set(node.label, row + 1);
    return {
      id: node.id,
      type: "knowledge",
      data: {
        category: node.label,
        name: node.name,
        verificationStatus: node.verification_status,
        academicYear: node.academic_year,
        sourceUrl: node.source_url,
        dataSource: node.data_source,
      },
      position: { x: categoryOrder.indexOf(node.label) * 340, y: row * 150 },
      className: node.id === selectedNodeId ? "graph-node graph-node-selected" : connectedIds.has(node.id) ? "graph-node graph-node-connected" : "graph-node",
    };
  });
  const edges: Edge[] = visibleEdges.map(edge => ({
    id: edge.id,
    type: "knowledge",
    source: edge.source,
    target: edge.target,
    label: edge.label,
    style: selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId)
      ? { stroke: "#5146d8", strokeWidth: 2 }
      : { stroke: "#aeb8c9", strokeWidth: 1 },
  }));
  const selectedNode = graphNodes.find(node => node.id === selectedNodeId);
  return <div className="page-stack"><PageTitle eyebrow="Connected knowledge" title="Knowledge graph" description="Explore semantic relationships assembled from your profile and PostgreSQL catalogue records." />
    <div className="notice notice-info" role="status"><Network size={18} /><span>{includeDemo ? "The demonstration view adds DEMO_ONLY programme, subject, skill, and illustrative career nodes. Its relationships are descriptive only; no admission facts are represented." : `Relationships are built from application data for ${combinedGraph.academic_year || "the selected academic year"}. Admission requirements are linked only when verified for that year.`}</span></div>
    <div className="graph-filters"><label><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a node by name" aria-label="Search knowledge graph nodes" /></label><label>Node type<select value={nodeType} onChange={event => setNodeType(event.target.value)}><option value="">All node types</option>{nodeTypes.map(type => <option key={type}>{type}</option>)}</select></label><label>Relationship<select value={relationship} onChange={event => setRelationship(event.target.value)}><option value="">All relationships</option>{relationTypes.map(type => <option key={type}>{type}</option>)}</select></label><label className="demo-graph-toggle"><input type="checkbox" checked={includeDemo} onChange={event => { setIncludeDemo(event.target.checked); setSelectedNodeId(""); }} /><span>Include demonstration catalogue view</span></label></div>
    {nodes.length ? <GraphCanvas nodes={nodes} edges={edges} onNodeSelect={setSelectedNodeId} /> : <EmptyState title="No graph relationships match these filters" message="Clear the filters or add profile facts to build more semantic relationships." action={<button className="button button-secondary" onClick={() => { setQuery(""); setNodeType(""); setRelationship(""); }}>Clear filters</button>} />}
    {selectedNode && <aside className="card graph-node-details" aria-live="polite"><div className="section-heading"><div><span className="eyebrow">{selectedNode.label}</span><h2>{selectedNode.name}</h2></div><button className="button button-secondary" onClick={() => setSelectedNodeId("")}>Clear selection</button></div><p>Connected relationships: {visibleEdges.filter(edge => edge.source === selectedNode.id || edge.target === selectedNode.id).length}</p><small className="data-note">Verification: {selectedNode.verification_status || "not applicable"} · Academic year: {selectedNode.academic_year || "not specified"}{selectedNode.data_source ? ` · Source: ${selectedNode.data_source}` : ""}</small>{selectedNode.source_url && <SourceLink url={selectedNode.source_url} title={selectedNode.name} />}</aside>}
    <div className="graph-legend"><span>Student</span><span>Subject</span><span>Entrance exam</span><span>University</span><span>Programme</span><span>Interest</span><span>Skill</span><span>Career</span><span>Source document</span></div>
  </div>;
}

type GraphNodeData = { category: string; name: string; verificationStatus?: string | null; academicYear?: string | null; sourceUrl?: string | null; dataSource?: string | null };

function GraphCanvas({ nodes, edges, onNodeSelect }: { nodes: Node<GraphNodeData>[]; edges: Edge[]; onNodeSelect: (id: string) => void }) {
  return <ReactFlowProvider><GraphCanvasContents nodes={nodes} edges={edges} onNodeSelect={onNodeSelect} /></ReactFlowProvider>;
}

function GraphCanvasContents({ nodes, edges, onNodeSelect }: { nodes: Node<GraphNodeData>[]; edges: Edge[]; onNodeSelect: (id: string) => void }) {
  const { fitView } = useReactFlow();
  return <div className="graph-canvas"><ReactFlow nodes={nodes} edges={edges} nodeTypes={graphNodeTypes} edgeTypes={graphEdgeTypes} fitView fitViewOptions={{ padding: 0.25 }} nodesDraggable={false} nodesConnectable={false} elementsSelectable onNodeClick={(_, node) => onNodeSelect(node.id)}><Background color="#dbe2ef" gap={22} /><Controls /></ReactFlow><button className="button button-secondary graph-fit" onClick={() => void fitView({ padding: 0.25, duration: 250 })}>Fit to screen</button></div>;
}

function KnowledgeGraphNode({ data }: NodeProps<GraphNodeData>) {
  return <><Handle type="target" position={Position.Left} /><div className="graph-node-content"><span>{data.category}</span><strong>{data.name}</strong>{(data.verificationStatus || data.academicYear) && <small>{[data.verificationStatus, data.academicYear].filter(Boolean).join(" · ")}</small>}{data.dataSource && <small>{data.dataSource}</small>}{data.sourceUrl && <a href={data.sourceUrl} target="_blank" rel="noreferrer">Source</a>}</div><Handle type="source" position={Position.Right} /></>;
}

function KnowledgeGraphEdge(props: EdgeProps) {
  const [path, labelX, labelY] = getBezierPath(props);
  return <>
    <BaseEdge id={props.id} path={path} markerEnd={props.markerEnd} style={props.style} />
    {props.selected && <EdgeLabelRenderer><div className="graph-edge-label" style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}>{props.label}</div></EdgeLabelRenderer>}
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
  const criteriaStatus = programme.criteria_status || programme.verification_status;
  return <article className="card programme-card"><div className="programme-card-top"><span className="card-icon"><GraduationCap size={20} /></span><Badge tone={criteriaStatus === "VERIFIED" ? "success" : "warning"}>{criteriaStatusLabel(criteriaStatus)}</Badge></div><h2>{programme.name}</h2><p className="university-line">{programme.university?.name || "University not provided"}</p><div className="programme-facts"><span><Compass size={15} />{programme.university?.location || "Location not listed"}</span><span><span aria-hidden="true">₹</span>{programme.annual_fee == null ? "Fee not verified" : `₹${programme.annual_fee.toLocaleString("en-IN")} / year`}</span></div><small className="data-note">Academic year: {programme.academic_year || "not specified"} · Fee status: {programme.fee_verification_status || "unknown"}</small><SourceLink url={programme.source_url} title={programme.source_title} /><div className="card-actions">{actions}</div></article>;
}

function criteriaStatusLabel(status?: string | null) {
  switch (status) {
    case "VERIFIED": return "Verified";
    case "EXPIRED": return "Expired";
    case "UNAVAILABLE": return "Unavailable";
    case "NOT_CURRENT_FOR_YEAR": return "Not current for selected year";
    case "PENDING_VERIFICATION": return "Pending verification";
    default: return status || "Unknown";
  }
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
