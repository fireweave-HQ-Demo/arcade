import type { GameEngine } from "@arcade/game-core";
import type { MatchResult, MatchStatus, PublicUser, Role, ScoreRow } from "@arcade/shared";

export type UserRecord = PublicUser & { passwordHash: string };

export type EmitActionInput = {
  event: string;
  traceId?: string;
  parentSpanId?: string;
  user?: string;
  gameId?: string;
  matchId?: number;
  metrics?: Array<{
    name: string;
    value: number;
    labels?: Record<string, string>;
    type?: "counter" | "gauge" | "histogram";
  }>;
  logLevel?: "debug" | "info" | "warn" | "error";
  logFields?: Record<string, unknown>;
  spanAttributes?: Record<string, string | number | boolean>;
  statusCode?: 0 | 1 | 2;
  statusMessage?: string;
};

export type MatchRecord = {
  id: number;
  userId: number;
  gameId: string;
  state: unknown;
  status: MatchStatus;
  winner: MatchResult;
  /** Null means the bot that shipped before the difficulty picker. */
  difficulty: "easy" | "mid" | "hard" | "nightmare" | null;
};

export type MatchEvent = {
  matchId: number;
  actor: "human" | "bot" | "system";
  move: unknown;
  traceId?: string;
  /** Board after this ply. Present only when match replay snapshots are on. */
  state?: unknown;
};

export type FinishedMatchRow = {
  id: number;
  gameId: string;
  status: string;
  winner: MatchResult;
  createdAt: string;
};

export type StoredMatchEvent = {
  actor: "human" | "bot" | "system";
  move: unknown;
  state: unknown | null;
};

export type TraceCtx = {
  traceId?: string;
  parentSpanId?: string;
};

export interface UserRepository {
  create(username: string, passwordHash: string, role?: Role): Promise<PublicUser>;
  findByUsername(username: string): Promise<UserRecord | null>;
  findById(id: number): Promise<PublicUser | null>;
  ensureAdmin(username: string, passwordHash: string): Promise<void>;
}

export interface SessionRepository {
  create(token: string, userId: number, expiresAt: Date): Promise<void>;
  delete(token: string): Promise<void>;
  findUserByToken(token: string): Promise<(PublicUser & { token: string }) | null>;
}

export interface MatchRepository {
  findActive(userId: number, gameId: string): Promise<MatchRecord | null>;
  create(
    userId: number,
    gameId: string,
    state: unknown,
    difficulty?: "easy" | "mid" | "hard" | "nightmare" | null,
  ): Promise<MatchRecord>;
  update(match: MatchRecord): Promise<MatchRecord>;
  abandonActive(userId: number, gameId: string): Promise<void>;
  addEvent(event: MatchEvent): Promise<void>;
  listFinished(userId: number, limit?: number): Promise<FinishedMatchRow[]>;
  findForUser(userId: number, matchId: number): Promise<(MatchRecord & { createdAt: string }) | null>;
  listEvents(matchId: number): Promise<StoredMatchEvent[]>;
  scoreboardForUser(userId: number): Promise<ScoreRow[]>;
  globalScoreboard(limit?: number): Promise<
    Array<{ username: string; played: number; wins: number; losses: number; draws: number }>
  >;
  popularity(): Promise<
    Array<{
      gameId: string;
      plays: number;
      humanWins: number;
      botWins: number;
      draws: number;
      plays24h: number;
    }>
  >;
  recentMatches(limit?: number): Promise<
    Array<{
      id: number;
      username: string;
      gameId: string;
      status: string;
      winner: MatchResult;
      createdAt: string;
    }>
  >;
}

export interface EngineCatalog {
  list(): GameEngine[];
  require(id: string): GameEngine;
}

export interface ObservabilityPort {
  log(
    level: "debug" | "info" | "warn" | "error",
    message: string,
    fields?: Record<string, unknown>,
    ctx?: { traceId?: string; spanId?: string },
  ): Promise<unknown>;
  metric(
    name: string,
    value: number,
    labels?: Record<string, string>,
    type?: "counter" | "gauge" | "histogram",
  ): Promise<unknown>;
  span(input: {
    name: string;
    traceId?: string;
    parentSpanId?: string;
    attributes?: Record<string, string | number | boolean>;
    statusCode?: 0 | 1 | 2;
    statusMessage?: string;
  }): Promise<{ traceId: string; spanId: string }>;
  emitAction(input: EmitActionInput): Promise<{ traceId: string; spanId: string }>;
}
