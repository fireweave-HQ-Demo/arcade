export type Role = "user" | "admin";

export type MatchStatus = "playing" | "finished" | "abandoned";
export type MatchResult = "human_win" | "bot_win" | "draw" | null;

export type PublicUser = {
  id: number;
  username: string;
  role: Role;
};

export type GameInfo = {
  id: string;
  name: string;
  description: string;
};

export type MatchDto = {
  id: number;
  gameId: string;
  state: unknown;
  status: MatchStatus;
  winner: MatchResult;
};

export type ScoreRow = {
  gameId: string;
  played: number;
  wins: number;
  losses: number;
  draws: number;
};

export type Scoreboard = {
  global: Omit<ScoreRow, "gameId">;
  byGame: ScoreRow[];
};

export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
    readonly code: string = "bad_request",
  ) {
    super(message);
    this.name = "AppError";
  }
}
