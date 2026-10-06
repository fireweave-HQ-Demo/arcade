export type User = { id: number; username: string };
export type Board = Array<"X" | "O" | "">;
export type Game = {
  id: number;
  board: Board;
  status: string;
  winner: "X" | "O" | "draw" | null;
};
export type Stats = {
  played: number;
  wins: number;
  losses: number;
  draws: number;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "request failed");
  return data as T;
}

export const api = {
  me: () => request<{ user: User | null }>("/api/auth/me"),
  login: (username: string, password: string) =>
    request<{ user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  register: (username: string, password: string) =>
    request<{ user: User }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  game: () => request<Game>("/api/game"),
  newGame: () => request<Game>("/api/game/new", { method: "POST" }),
  move: (index: number) =>
    request<Game>("/api/game/move", {
      method: "POST",
      body: JSON.stringify({ index }),
    }),
  stats: () => request<Stats>("/api/stats"),
};
