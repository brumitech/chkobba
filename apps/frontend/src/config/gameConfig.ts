// apps/frontend/src/config/gameConfig.ts
import { GAME_CONSTANTS, VALIDATION_MESSAGES } from "@chkobba/shared";

export const DEFAULT_GAME_CONFIG = {
  initialCards: GAME_CONSTANTS.PLAYERS.INITIAL_CARDS,
  tableInitialCards: GAME_CONSTANTS.TABLE.INITIAL_CARDS,
  timePerTurn: GAME_CONSTANTS.TIMING.TURN_DURATION / 1000, // Convert to seconds for frontend
  pointsToWin: 11, // First player to reach 11 points wins
  playerLimits: {
    min: GAME_CONSTANTS.PLAYERS.MIN_PLAYERS,
    max: GAME_CONSTANTS.PLAYERS.MAX_PLAYERS,
  },
  scoring: {
    mostCards: GAME_CONSTANTS.SCORING.MOST_CARDS,
    mostCoins: GAME_CONSTANTS.SCORING.MOST_COINS,
    sevenOfCoins: GAME_CONSTANTS.SCORING.SEVEN_OF_COINS,
    lastCapture: GAME_CONSTANTS.SCORING.KOOM,
  }
} as const;

export const GAME_ERRORS = {
  INVALID_CAPTURE: {
    code: "INVALID_CAPTURE",
    message: VALIDATION_MESSAGES.CAPTURE.NO_MATCH,
  },
  INVALID_COMBINATION: {
    code: "INVALID_COMBINATION",
    message: VALIDATION_MESSAGES.CAPTURE.INVALID_COMBINATION,
  },
  INVALID_KOOM: {
    code: "INVALID_KOOM",
    message: VALIDATION_MESSAGES.KOOM.INVALID,
  },
  INVALID_TURN: {
    code: "INVALID_TURN",
    message: "It is not your turn to play.",
  },
} as const;

// Card values for matching in Chkobba (copied from shared constants for easy access)
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

// Special cards with their point values (for reference in UI)
export const SPECIAL_CARDS = {
  SEVEN_OF_COINS: {
    suit: "carreau",
    rank: "7",
    points: 1,
    description: "Worth 1 point at the end of a round"
  }
} as const;

// Game rules description for help/tutorial
export const GAME_RULES = {
  objective: "Capture cards from the table to score points. First player to reach 11 points wins.",
  setup: "Each player receives 3 cards. 4 cards are placed face-up on the table.",
  turn: "On your turn, you must play one card from your hand to either capture cards or add to the table.",
  capture: [
    "You can capture cards that match the rank of your played card",
    "You can capture multiple cards if their values sum to your card's value",
    "Capturing all remaining cards with your last card is called 'Koom'"
  ],
  scoring: [
    "Most cards: 1 point",
    "Most coins: 2 points",
    "Seven of coins: 1 point",
    "Last capture: 1 point"
  ],
  cardValues: "A=1, 2=2, 3=3, 4=4, 5=5, 6=6, 7=7, J=8, Q=9, K=10"
} as const;