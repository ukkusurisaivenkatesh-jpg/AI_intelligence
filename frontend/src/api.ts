const BASE = "/api";
export function token(): string | null { return localStorage.getItem("admitwise_token"); }
async function request(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  if (token()) headers.set("Authorization", `Bearer ${token()}`);
  const response = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}
export const api = {
  login: (email: string, password: string) => request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  register: (full_name: string, email: string, password: string) => request("/auth/register", { method: "POST", body: JSON.stringify({ full_name, email, password }) }),
  dashboard: () => request("/students/me/dashboard"),
  profile: () => request("/students/me/profile"),
  saveProfile: (profile: unknown) => request("/students/me/profile", { method: "PUT", body: JSON.stringify(profile) }),
  programmes: () => request("/programmes"),
  recommendations: () => request("/recommendations"),
  eligibility: () => request("/eligibility/evaluate", { method: "POST" }),
  whatIf: (changes: unknown) => request("/what-if", { method: "POST", body: JSON.stringify(changes) }),
  careers: () => request("/careers"),
  graph: () => request("/knowledge/graph"),
  frames: () => request("/knowledge/frames"),
  rules: () => request("/knowledge/rules"),
  forward: (facts: unknown) => request("/knowledge/forward-chain", { method: "POST", body: JSON.stringify({ facts }) }),
  backward: (goal: unknown, facts: unknown) => request("/knowledge/backward-chain", { method: "POST", body: JSON.stringify({ goal, facts }) }),
  shortlist: () => request("/shortlist"),
  save: (id: number) => request(`/shortlist/${id}`, { method: "POST" }),
  removeShortlist: (id: number) => request(`/shortlist/${id}`, { method: "DELETE" }),
  compare: (ids: number[]) => request("/compare", { method: "POST", body: JSON.stringify({ programme_ids: ids }) }),
  counsellor: (message: string) => request("/counsellor", { method: "POST", body: JSON.stringify({ message }) }),
  admin: () => request("/admin/overview"),
};
