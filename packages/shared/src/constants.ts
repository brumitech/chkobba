// packages/shared/src/constants.ts

import { GameErrorType, GameStatus, GameEventType } from "./types";

export const GAME_CONSTANTS = {
  TIMING: {
    TURN_DURATION: 30000, // 30 seconds in milliseconds
    GAME_START_DELAY: 3000, // 3 seconds delay before game starts
    CARD_ANIMATION_DURATION: 300, // Animation duration for card movements
  },
  PLAYERS: {
    MIN_PLAYERS: 2,
    MAX_PLAYERS: 4,
    INITIAL_CARDS: 3, // Each player starts with 3 cards
  },
  DECK: {
    TOTAL_CARDS: 40, // Spanish deck without 8s, 9s, and 10s
  },
  TABLE: {
    INITIAL_CARDS: 4, // 4 cards are placed on the table at the start
  },
  SCORING: {
    MOST_CARDS: 1, // Point for having the most cards
    MOST_COINS: 2, // Points for having the most coins
    SEVEN_OF_COINS: 1, // Point for having the seven of coins
    KOOM: 1, // Point for the last capture
  },
  GAME_STATES: {
    INITIAL: GameStatus.WAITING,
    PLAYING: GameStatus.PLAYING,
    FINISHED: GameStatus.FINISHED,
  },
} as const;

// Card values for matching in Chkobba
export const CARD_VALUES = {
  A: 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  J: 8,
  Q: 9,
  K: 10,
} as const;

// Error messages mapped to error types
export const ERROR_MESSAGES = {
  [GameErrorType.INVALID_TURN]: "It's not your turn to play",
  [GameErrorType.INVALID_MOVE]: "Invalid move attempted",
  [GameErrorType.INVALID_CAPTURE]: "Invalid card capture",
  [GameErrorType.TIMEOUT]: "Turn time limit exceeded",
  [GameErrorType.PLAYER_DISCONNECTED]: "Player disconnected from the game",
} as const;

// Validation messages
export const VALIDATION_MESSAGES = {
  CAPTURE: {
    NO_MATCH: "Selected card doesn't match any cards on the table",
    INVALID_COMBINATION: "Selected combination is invalid",
  },
  KOOM: {
    INVALID: "Cannot perform Koom with this card",
  },
  TURN: {
    INVALID_PLAYER: "Not your turn to play",
    TIMEOUT: "Turn time limit exceeded",
  },
} as const;

// Event messages
export const EVENT_MESSAGES = {
  [GameEventType.TURN_TIMEOUT]: "Player's turn timed out",
  [GameEventType.PLAYER_JOINED]: "Player joined the game",
  [GameEventType.PLAYER_LEFT]: "Player left the game",
  [GameEventType.GAME_STARTED]: "Game has started",
  [GameEventType.GAME_ENDED]: "Game has ended",
  [GameEventType.CARDS_CAPTURED]: "Cards captured",
  [GameEventType.CARD_PLAYED]: "Card played to the table",
  [GameEventType.CARD_DRAWN]: "Card drawn",
  [GameEventType.KOOM_PLAYED]: "Koom! All cards captured",
} as const;

// Default game options based on constants
export const DEFAULT_GAME_OPTIONS = {
  turnTimeLimit: GAME_CONSTANTS.TIMING.TURN_DURATION,
  maxPlayers: GAME_CONSTANTS.PLAYERS.MAX_PLAYERS,
  minPlayers: GAME_CONSTANTS.PLAYERS.MIN_PLAYERS,
  cardsPerPlayer: GAME_CONSTANTS.PLAYERS.INITIAL_CARDS,
} as const;