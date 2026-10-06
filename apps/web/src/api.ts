export type User = { id: number; username: string; role: "user" | "admin" };
export type GameInfo = { id: string; name: string; description: string };
export type Match = {
  id: number;
  gameId: string;
  state: unknown;
  status: string;
  winner: "human_win" | "bot_win" | "draw" | null;
};
export type Scoreboard = {
  me: {
    global: { played: number; wins: number; losses: number; draws: number };
    byGame: Array<{
      gameId: string;
      played: number;
      wins: number;
      losses: number;
      draws: number;
    }>;
  };
  leaderboard: Array<{
    username: string;
    played: number;
    wins: number;
    losses: number;
    draws: number;
  }>;
};
export type AdminInsights = {
  popularity: Array<{
    gameId: string;
    name: string;
    plays: number;
    humanWins: number;
    botWins: number;
    draws: number;
    plays24h: number;
  }>;
  recent: Array<{
    id: number;
    username: string;
    gameId: string;
    status: string;
    winner: string | null;
    createdAt: string;
  }>;
  leaderboard: Scoreboard["leaderboard"];
  totals: { plays: number; plays24h: number };
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
  games: () => request<{ games: GameInfo[] }>("/api/games"),
  match: (gameId: string) => request<Match>(`/api/games/${gameId}/match`),
  newMatch: (gameId: string) =>
    request<Match>(`/api/games/${gameId}/match/new`, { method: "POST" }),
  move: (gameId: string, body: unknown) =>
    request<Match>(`/api/games/${gameId}/match/move`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  scoreboard: () => request<Scoreboard>("/api/scoreboard"),
  adminInsights: () => request<AdminInsights>("/api/admin/insights"),
};
