const API_ORIGIN = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
const BASE = `${API_ORIGIN}/api`;

export type User = { id: number; email: string; full_name: string; role: "student" | "admin" | string };
export type Profile = {
  qualification?: string | null;
  aggregate_marks?: number | null;
  subject_marks: Record<string, number>;
  entrance_scores: Record<string, number | { score?: number; rank?: number }>;
  interests: string[];
  aptitude: Record<string, number>;
  skills: string[];
  preferred_location?: string | null;
  annual_budget?: number | null;
  profile?: Record<string, unknown>;
};
export type University = {
  id: number;
  name: string;
  location: string | null;
  region?: string | null;
  institution_type?: string | null;
  state?: string | null;
  city?: string | null;
  website?: string | null;
  recognition_info?: string | null;
  source_url?: string | null;
  source_title?: string | null;
  verification_status?: string;
  academic_year?: string | null;
  verified_at?: string | null;
  last_updated?: string | null;
  data_notes?: string | null;
};
export type Programme = {
  id: number;
  name: string;
  discipline: string | null;
  duration_years: number | null;
  annual_fee: number | null;
  minimum_percentage: number | null;
  required_subjects: string[];
  subject_minimums: Record<string, number>;
  entrance_exams: string[];
  entrance_requirements: Record<string, { minimum_score?: number; maximum_rank?: number }>;
  career_ids: number[];
  data_status: string;
  source: string | null;
  source_url?: string | null;
  source_title?: string | null;
  verification_status?: string;
  minimum_qualification?: string | null;
  additional_admission_conditions?: Array<Record<string, unknown>>;
  criteria_complete?: boolean;
  academic_year?: string | null;
  verified_at?: string | null;
  last_updated?: string | null;
  data_notes?: string | null;
  fee_academic_year?: string | null;
  fee_source_url?: string | null;
  fee_source_title?: string | null;
  fee_verification_status?: string;
  fee_verified_at?: string | null;
  fee_last_updated?: string | null;
  fee_data_notes?: string | null;
  other_academic_fees?: Array<Record<string, unknown>>;
  last_verified: string | null;
  university: University | null;
};
export type EligibilityResult = {
  programme: Programme;
  status: string;
  academic_year?: string | null;
  verification_status?: string;
  affordability?: { status: "unknown" | "affordable" | "over_budget"; annual_fee: number | null; academic_year: string | null };
  satisfied: string[];
  unsatisfied: string[];
  missing: string[];
  trace: Array<Record<string, unknown>>;
};
export type Recommendation = EligibilityResult & {
  suitability: { score: number; factors: Record<string, number>; explanation: string[] };
};
export type Career = {
  id: number;
  name: string;
  description: string;
  technical_skills: string[];
  soft_skills: string[];
  certifications: string[];
  roadmap: string[];
  source_url?: string | null;
  source_title?: string | null;
  verification_status?: string;
  academic_year?: string | null;
  verified_at?: string | null;
  last_updated?: string | null;
  data_notes?: string | null;
};
export type ChatHistoryItem = { id: number; message: string; response: string; created_at: string; engine?: string; scenario?: boolean; recommendations?: Recommendation[] };
export type SemanticNetwork = {
  available: boolean;
  academic_year: string | null;
  nodes: Array<{
    id: string;
    label: string;
    name: string;
    verification_status?: string | null;
    academic_year?: string | null;
    source_url?: string | null;
  }>;
  edges: Array<{ id: string; source: string; target: string; label: string }>;
};
export type AdminUniversity = University & {
  verification_status: string;
  data_status: string;
};

export function currentAcademicYear(now = new Date()): string {
  const start = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export function token(): string | null {
  return localStorage.getItem("admitwise_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const accessToken = token();
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, { ...options, headers });
  } catch {
    throw new ApiError("Could not reach the service. Check your connection and try again.", 0);
  }
  const text = await response.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  if (!response.ok) {
    const body = payload as { detail?: unknown; message?: string } | null;
    let detail = typeof body?.detail === "string" ? body.detail : body?.message;
    if (!detail && Array.isArray(body?.detail)) {
      const messages = body.detail.flatMap(item => {
        if (!item || typeof item !== "object") return [];
        const validation = item as { loc?: unknown; msg?: unknown };
        if (typeof validation.msg !== "string") return [];
        const location = Array.isArray(validation.loc)
          ? validation.loc.filter((part): part is string | number => typeof part === "string" || typeof part === "number").filter(part => part !== "body").join(".")
          : "";
        return [location ? `${location}: ${validation.msg}` : validation.msg];
      });
      if (messages.length) detail = `Please check: ${messages.join("; ")}`;
    }
    if (response.status === 401) {
      localStorage.removeItem("admitwise_token");
      window.dispatchEvent(new Event("admitwise:unauthorized"));
    }
    throw new ApiError(detail || `Request failed (${response.status}).`, response.status);
  }
  return payload as T;
}

export const api = {
  login: (email: string, password: string) => request<{ access_token: string; token_type: string; role: User["role"] }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  register: (full_name: string, email: string, password: string) => request<{ access_token: string; token_type: string; role: User["role"] }>("/auth/register", { method: "POST", body: JSON.stringify({ full_name, email, password }) }),
  me: () => request<User>("/auth/me"),
  dashboard: (academicYear: string) => request<{ student: { name: string; email: string }; profile: Profile; recommendations: Recommendation[]; shortlist_count: number; academic_year: string | null }>(`/students/me/dashboard?academic_year=${encodeURIComponent(academicYear)}`),
  profile: () => request<Profile>("/students/me/profile"),
  saveProfile: (profile: Profile) => request<Profile>("/students/me/profile", { method: "PUT", body: JSON.stringify(profile) }),
  programmes: (academicYear: string) => request<Programme[]>(`/programmes?academic_year=${encodeURIComponent(academicYear)}`),
  recommendations: (academicYear: string) => request<Recommendation[]>(`/recommendations?academic_year=${encodeURIComponent(academicYear)}`),
  eligibility: (academicYear: string) => request<EligibilityResult[]>(`/eligibility/evaluate?academic_year=${encodeURIComponent(academicYear)}`, { method: "POST" }),
  whatIf: (changes: Partial<Profile> & { academic_year: string }) => request<{ newly_eligible: EligibilityResult[]; no_longer_eligible: Programme[]; simulated: Recommendation[] }>("/what-if", { method: "POST", body: JSON.stringify(changes) }),
  careers: () => request<Career[]>("/careers"),
  graph: (academicYear: string) => request<SemanticNetwork>(`/knowledge/graph?academic_year=${encodeURIComponent(academicYear)}`),
  frames: () => request<Record<string, unknown>>("/knowledge/frames"),
  rules: () => request<Array<Record<string, unknown>>>("/knowledge/rules"),
  forward: (facts: unknown) => request<{ facts: Record<string, unknown>; trace: unknown[] }>("/knowledge/forward-chain", { method: "POST", body: JSON.stringify({ facts }) }),
  backward: (goal: unknown, facts: unknown) => request<Record<string, unknown>>("/knowledge/backward-chain", { method: "POST", body: JSON.stringify({ goal, facts }) }),
  shortlist: () => request<Programme[]>("/shortlist"),
  save: (id: number) => request<{ saved: boolean }>(`/shortlist/${id}`, { method: "POST" }),
  removeShortlist: (id: number) => request<{ saved: boolean }>(`/shortlist/${id}`, { method: "DELETE" }),
  compare: (ids: number[], academicYear: string) => request<Programme[]>("/compare", { method: "POST", body: JSON.stringify({ programme_ids: ids, academic_year: academicYear }) }),
  counsellor: (message: string, academicYear: string, profileChanges?: Partial<Profile>) => request<{ answer: string; recommendations: Recommendation[]; missing: string[]; source: string; engine: string; scenario: boolean }>("/counsellor", { method: "POST", body: JSON.stringify({ message, academic_year: academicYear, ...(profileChanges && Object.keys(profileChanges).length ? { profile_changes: profileChanges } : {}) }) }),
  counsellorHistory: () => request<ChatHistoryItem[]>("/counsellor/history"),
  admin: () => request<{ universities: number; programmes: number; careers: number; rules: number; students: number }>("/admin/overview"),
  adminUniversities: () => request<AdminUniversity[]>("/admin/universities"),
  adminProgrammes: () => request<Programme[]>("/admin/programmes"),
  adminCareers: () => request<Career[]>("/admin/careers"),
  adminAuditLogs: () => request<Array<{ id: number; actor: string; action: string; entity_type: string; entity_id: string; payload: Record<string, unknown>; created_at: string | null }>>("/admin/audit-logs"),
};
