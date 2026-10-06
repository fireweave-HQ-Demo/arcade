import type { GameEngine } from "@arcade/game-core";
import type { MatchResult, MatchStatus, PublicUser, Role, ScoreRow } from "@arcade/shared";

export type UserRecord = PublicUser & { passwordHash: string };

export type MatchRecord = {
  id: number;
  userId: number;
  gameId: string;
  state: unknown;
  status: MatchStatus;
  winner: MatchResult;
};

export type MatchEvent = {
  matchId: number;
  actor: "human" | "bot" | "system";
  move: unknown;
  traceId?: string;
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
  create(userId: number, gameId: string, state: unknown): Promise<MatchRecord>;
  update(match: MatchRecord): Promise<MatchRecord>;
  abandonActive(userId: number, gameId: string): Promise<void>;
  addEvent(event: MatchEvent): Promise<void>;
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
    type?: "counter" | "gauge",
  ): Promise<unknown>;
  span(input: {
    name: string;
    traceId?: string;
    attributes?: Record<string, string | number | boolean>;
  }): Promise<{ traceId: string; spanId: string }>;
}
