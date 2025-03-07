// packages/shared/src/utils.ts

import {
  Card,
  PlayerState,
  GameStatus,
  GameAction,
  GameActionType,
} from "./types";
import { CARD_VALUES, GAME_CONSTANTS } from "./constants";
import { GameValidator } from "./validator";

export class GameUtils {
  /**
   * Card comparison utilities
   */
  static compareCards(a: Card, b: Card): number {
    if (a.suit !== b.suit) {
      return a.suit.localeCompare(b.suit);
    }
    return CARD_VALUES[a.rank] - CARD_VALUES[b.rank];
  }

  /**
   * Game state utilities
   */
  static canStartGame(players: PlayerState[]): boolean {
    return (
      players.length >= GAME_CONSTANTS.PLAYERS.MIN_PLAYERS &&
      players.length <= GAME_CONSTANTS.PLAYERS.MAX_PLAYERS &&
      players.every((player) => player.connected)
    );
  }

  static getNextPlayerIndex(
    currentIndex: number,
    players: PlayerState[]
  ): number {
    let nextIndex = (currentIndex + 1) % players.length;
    // Skip disconnected players
    while (!players[nextIndex].connected) {
      nextIndex = (nextIndex + 1) % players.length;
      // Safety check to avoid infinite loop
      if (nextIndex === currentIndex) break;
    }
    return nextIndex;
  }

  static isGameOver(
    players: PlayerState[],
    deckEmpty: boolean,
    tableEmpty: boolean
  ): boolean {
    // Game is over when deck is empty and all players have no cards left
    // or if there are fewer than 2 connected players
    const allPlayersHandsEmpty = players.every(player => player.hand.length === 0);
    const connectedPlayersCount = players.filter(player => player.connected).length;
    
    return (
      (deckEmpty && allPlayersHandsEmpty && tableEmpty) ||
      connectedPlayersCount < GAME_CONSTANTS.PLAYERS.MIN_PLAYERS
    );
  }

  /**
   * Turn management utilities
   */
  static canPerformAction(
    action: GameAction,
    player: PlayerState,
    gameStatus: GameStatus,
    tableCards: Card[]
  ): boolean {
    if (gameStatus !== GameStatus.PLAYING || !player.isCurrentTurn) {
      return false;
    }

    switch (action.type) {
      case GameActionType.PLAY_CARD:
        return player.hand.length > 0;

      case GameActionType.CAPTURE_CARDS:
        if (!action.card || !action.capturedCards) return false;
        return this.isCardInHand(action.card, player.hand);

      case GameActionType.KOOM:
        if (!action.card) return false;
        return (
          this.isCardInHand(action.card, player.hand) &&
          player.hand.length === 1 &&
          GameValidator.canKoom(action.card, tableCards, true)
        );

      default:
        return true;
    }
  }

  static getRemainingTurnTime(turnStartTime: number): number {
    const elapsed = Date.now() - turnStartTime;
    return Math.max(0, GAME_CONSTANTS.TIMING.TURN_DURATION - elapsed);
  }

  /**
   * Card validation utilities
   */
  static isCardInHand(card: Card, hand: Card[]): boolean {
    return hand.some(handCard => handCard.id === card.id);
  }

  /**
   * Find which cards on the table can be captured by a card
   */
  static findPossibleCaptures(
    card: Card,
    tableCards: Card[]
  ): Card[][] {
    const result: Card[][] = [];
    
    // Check for direct rank matches
    const directMatches = tableCards.filter(
      tableCard => tableCard.rank === card.rank
    );
    
    if (directMatches.length > 0) {
      result.push(directMatches);
    }
    
    // Check for combinations that sum to the card value
    const cardValue = CARD_VALUES[card.rank];
    
    // Check pairs
    for (let i = 0; i < tableCards.length; i++) {
      for (let j = i + 1; j < tableCards.length; j++) {
        const sum = CARD_VALUES[tableCards[i].rank] + CARD_VALUES[tableCards[j].rank];
        if (sum === cardValue) {
          result.push([tableCards[i], tableCards[j]]);
        }
      }
    }
    
    // Check triplets
    for (let i = 0; i < tableCards.length; i++) {
      for (let j = i + 1; j < tableCards.length; j++) {
        for (let k = j + 1; k < tableCards.length; k++) {
          const sum = CARD_VALUES[tableCards[i].rank] + 
                     CARD_VALUES[tableCards[j].rank] + 
                     CARD_VALUES[tableCards[k].rank];
          if (sum === cardValue) {
            result.push([tableCards[i], tableCards[j], tableCards[k]]);
          }
        }
      }
    }
    
    // Checking more combinations would be computationally expensive
    // A more complete solution would use a dynamic programming approach
    
    return result;
  }

  /**
   * Game state analysis
   */
  static analyzeGameState(players: PlayerState[]): {
    connectedPlayers: number;
    averageCardsInHand: number;
    averageScore: number;
  } {
    const connectedPlayers = players.filter((p) => p.connected).length;
    const totalCards = players.reduce((sum, p) => sum + p.hand.length, 0);
    const totalScore = players.reduce((sum, p) => sum + p.score, 0);

    return {
      connectedPlayers,
      averageCardsInHand: connectedPlayers > 0 ? totalCards / connectedPlayers : 0,
      averageScore: connectedPlayers > 0 ? totalScore / connectedPlayers : 0,
    };
  }
}