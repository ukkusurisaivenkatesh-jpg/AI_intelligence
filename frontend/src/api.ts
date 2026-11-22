const API_ORIGIN = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
const BASE = `${API_ORIGIN}/api`;

export type User = { id: number; email: string; full_name: string; role: "student" | "admin" | string };
export type Profile = {
  qualification?: string | null;
  aggregate_marks?: number | null;
  subject_marks: Record<string, number>;
  entrance_scores: Record<string, number>;
  interests: string[];
  aptitude: Record<string, number>;
  skills: string[];
  preferred_location?: string | null;
  annual_budget?: number | null;
};
export type University = { id: number; name: string; location: string | null; region?: string | null };
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
  entrance_requirements: Record<string, { minimum_score?: number }>;
  career_ids: number[];
  data_status: string;
  source: string | null;
  last_verified: string | null;
  university: University | null;
};
export type EligibilityResult = {
  programme: Programme;
  status: string;
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
};
export type ChatHistoryItem = { id: number; message: string; response: string; created_at: string };

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
    const detail = typeof body?.detail === "string" ? body.detail : body?.message;
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
  dashboard: () => request<{ student: { name: string; email: string }; profile: Profile; recommendations: Recommendation[]; shortlist_count: number }>("/students/me/dashboard"),
  profile: () => request<Profile>("/students/me/profile"),
  saveProfile: (profile: Profile) => request<Profile>("/students/me/profile", { method: "PUT", body: JSON.stringify(profile) }),
  programmes: () => request<Programme[]>("/programmes"),
  recommendations: () => request<Recommendation[]>("/recommendations"),
  eligibility: () => request<EligibilityResult[]>("/eligibility/evaluate", { method: "POST" }),
  whatIf: (changes: Partial<Profile>) => request<{ newly_eligible: EligibilityResult[]; no_longer_eligible: Programme[]; simulated: Recommendation[] }>("/what-if", { method: "POST", body: JSON.stringify(changes) }),
  careers: () => request<Career[]>("/careers"),
  graph: () => request<{ available: boolean; nodes: Array<{ id: string; label: string; name: string }>; edges: Array<{ source: string; target: string; label: string }>; message?: string }>("/knowledge/graph"),
  frames: () => request<Record<string, unknown>>("/knowledge/frames"),
  rules: () => request<Array<Record<string, unknown>>>("/knowledge/rules"),
  forward: (facts: unknown) => request<{ facts: Record<string, unknown>; trace: unknown[] }>("/knowledge/forward-chain", { method: "POST", body: JSON.stringify({ facts }) }),
  backward: (goal: unknown, facts: unknown) => request<Record<string, unknown>>("/knowledge/backward-chain", { method: "POST", body: JSON.stringify({ goal, facts }) }),
  shortlist: () => request<Programme[]>("/shortlist"),
  save: (id: number) => request<{ saved: boolean }>(`/shortlist/${id}`, { method: "POST" }),
  removeShortlist: (id: number) => request<{ saved: boolean }>(`/shortlist/${id}`, { method: "DELETE" }),
  compare: (ids: number[]) => request<Programme[]>("/compare", { method: "POST", body: JSON.stringify({ programme_ids: ids }) }),
  counsellor: (message: string) => request<{ answer: string; recommendations: Recommendation[]; missing: string[]; source: string }>("/counsellor", { method: "POST", body: JSON.stringify({ message }) }),
  counsellorHistory: () => request<ChatHistoryItem[]>("/counsellor/history"),
  admin: () => request<{ universities: number; programmes: number; careers: number; rules: number; students: number }>("/admin/overview"),
};
