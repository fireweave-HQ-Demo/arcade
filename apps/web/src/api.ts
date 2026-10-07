export type User = { id: number; username: string; role: "user" | "admin" };
export type GameInfo = { id: string; name: string; description: string; rules: string };
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
  favored: {
    gameId: string;
    name: string;
    plays: number;
    plays24h: number;
  } | null;
  recent: Array<{
    id: number;
    username: string;
    gameId: string;
    status: string;
    winner: string | null;
    createdAt: string;
  }>;
  leaderboard: Scoreboard["leaderboard"];
  totals: { plays: number; plays24h: number; players: number };
};

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code = "") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

/** Wire session expiry → clear client auth (once per app boot). */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  onUnauthorized = handler;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers,
  });

  let data: { error?: string; code?: string } = {};
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text) as { error?: string; code?: string };
    } catch {
      data = { error: text.slice(0, 120) || "request failed" };
    }
  }

  if (res.status === 401) {
    // login/register use 401 for bad credentials — do not treat as session expiry
    if (path !== "/api/auth/login" && path !== "/api/auth/register") {
      onUnauthorized?.();
    }
    throw new ApiError(data.error ?? "unauthorized", 401, data.code ?? "unauthorized");
  }
  if (!res.ok) {
    throw new ApiError(data.error ?? "request failed", res.status, data.code ?? "request_failed");
  }
  return data as T;
}

export type HistoryMatch = {
  id: number;
  gameId: string;
  name: string;
  winner: Match["winner"];
  createdAt: string;
};
export type Replay = {
  id: number;
  gameId: string;
  name: string;
  winner: Match["winner"];
  createdAt: string;
  frames: Array<{ index: number; actor: "human" | "bot" | "system"; state: unknown }>;
};

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
  pins: () => request<{ gameIds: string[] }>("/api/pins"),
  pin: (gameId: string) =>
    request<{ gameIds: string[] }>(`/api/games/${gameId}/pin`, { method: "POST" }),
  unpin: (gameId: string) =>
    request<{ gameIds: string[] }>(`/api/games/${gameId}/pin`, { method: "DELETE" }),
  match: (gameId: string) => request<Match>(`/api/games/${gameId}/match`),
  newMatch: (gameId: string) =>
    request<Match>(`/api/games/${gameId}/match/new`, { method: "POST" }),
  move: (gameId: string, body: unknown) =>
    request<Match>(`/api/games/${gameId}/match/move`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  scoreboard: () => request<Scoreboard>("/api/scoreboard"),
  history: () => request<{ matches: HistoryMatch[] }>("/api/matches"),
  replay: (matchId: number) => request<Replay>(`/api/matches/${matchId}/replay`),
  adminInsights: () => request<AdminInsights>("/api/admin/insights"),
};
