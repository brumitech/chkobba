// packages/shared/src/index.ts

// Export all constants
export {
    GAME_CONSTANTS,
    CARD_VALUES,
    VALIDATION_MESSAGES,
    ERROR_MESSAGES,
    EVENT_MESSAGES,
    DEFAULT_GAME_OPTIONS,
  } from "./constants";
  
  // Export all types
  export type {
    // Card related
    Suit,
    Rank,
    Card,
    // Game state related
    PlayerState,
    GameOptions,
    // Validation related
    ValidatedMove,
    // Action related
    GameAction,
    // Event related
    GameEvent,
  } from "./types";
  
  // Export enums
  export {
    GameStatus,
    GameActionType,
    GameEventType,
    GameErrorType,
  } from "./types";
  
  // Export error class
  export { GameError } from "./types";
  
  // Export deck manager
  export { DeckManager } from "./deck";
  
  // Export validators
  export { GameValidator } from "./validator";
  
  // Export utilities
  export { GameUtils } from "./utils";
  
  // Export default configurations
  export { DEFAULT_GAME_OPTIONS as GameDefaultOptions } from "./constants";