const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  role: "admin" | "merchant";
  walletAddress: string | null;
  status: "active" | "blocked";
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
}

async function request<T>(path: string, options: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? "Something went wrong");
  return json.data as T;
}

export async function loginApi(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function signupApi(name: string, email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
}

export async function getMeApi(token: string): Promise<{ user: AuthUser }> {
  return request<{ user: AuthUser }>("/api/auth/me", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
}
