// packages/shared/src/types.ts

// Card-related types
export type Suit = "carreau" | "coeur" | "pique" | "trèfle";
export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "J" | "Q" | "K";

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
}

// Game State types
export enum GameStatus {
  WAITING = "waiting",
  STARTING = "starting",
  PLAYING = "playing",
  FINISHED = "finished",
}

export type GameMode = "1v1" | "2v2";

export interface PlayerState {
  id: string;
  name: string;
  hand: Card[];
  captured: Card[];
  isCurrentTurn: boolean;
  score: number;
  lastCapture: boolean;
  connected: boolean;
}

// Game Actions (moves a player can make)
export enum GameActionType {
  DRAW_CARD = "draw_card",
  PLAY_CARD = "play_card",
  CAPTURE_CARDS = "capture_cards",
  KOOM = "koom", // Special move to capture all remaining cards (if possible)
}

export interface GameAction {
  type: GameActionType;
  playerId: string;
  card?: Card;
  capturedCards?: Card[];
  timestamp: number;
}

// Validation types
export interface ValidatedMove {
  isValid: boolean;
  message?: string;
  capturedCards?: Card[];
}

// Game configuration types
export interface GameOptions {
  turnTimeLimit: number;
  maxPlayers: number;
  minPlayers: number;
  cardsPerPlayer: number;
}

// Game Events
export enum GameEventType {
  TURN_TIMEOUT = "turn_timeout",
  PLAYER_JOINED = "player_joined",
  PLAYER_LEFT = "player_left",
  GAME_STARTED = "game_started",
  GAME_ENDED = "game_ended",
  CARDS_CAPTURED = "cards_captured",
  CARD_PLAYED = "card_played",
  CARD_DRAWN = "card_drawn",
  KOOM_PLAYED = "koom_played",
}

export interface GameEvent {
  type: GameEventType;
  playerId?: string;
  data?: any;
  message?: string;
}

// Error types
export enum GameErrorType {
  INVALID_TURN = "invalid_turn",
  INVALID_MOVE = "invalid_move",
  INVALID_CAPTURE = "invalid_capture",
  TIMEOUT = "timeout",
  PLAYER_DISCONNECTED = "player_disconnected",
}

export class GameError extends Error {
  constructor(
    public type: GameErrorType,
    message: string
  ) {
    super(message);
    this.name = "GameError";
  }
}