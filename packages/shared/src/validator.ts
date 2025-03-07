// packages/shared/src/validator.ts

import {
  Card,
  ValidatedMove,
  GameAction,
  GameActionType,
  PlayerState,
  GameError,
  GameErrorType,
} from "./types";
import { VALIDATION_MESSAGES, CARD_VALUES } from "./constants";

export class GameValidator {
  /**
   * Validates if it's the player's turn
   */
  static validatePlayerTurn(
    playerId: string,
    currentTurnPlayerId: string
  ): ValidatedMove {
    if (playerId !== currentTurnPlayerId) {
      return {
        isValid: false,
        message: VALIDATION_MESSAGES.TURN.INVALID_PLAYER,
      };
    }
    return { isValid: true };
  }

  /**
   * Validates a game action based on action type
   */
  static validateAction(
    action: GameAction,
    player: PlayerState,
    tableCards: Card[]
  ): ValidatedMove {
    if (!player.isCurrentTurn) {
      return {
        isValid: false,
        message: VALIDATION_MESSAGES.TURN.INVALID_PLAYER,
      };
    }

    switch (action.type) {
      case GameActionType.CAPTURE_CARDS:
        return this.validateCaptureAction(action, tableCards);

      case GameActionType.PLAY_CARD:
        return this.validatePlayCardAction(action);

      case GameActionType.KOOM:
        return this.validateKoomAction(action, tableCards);

      default:
        return { isValid: true };
    }
  }

  /**
   * Validates a capture action
   */
  private static validateCaptureAction(
    action: GameAction,
    tableCards: Card[]
  ): ValidatedMove {
    if (!action.card || !action.capturedCards || action.capturedCards.length === 0) {
      return {
        isValid: false,
        message: "Missing card or capture information",
      };
    }

    // Check if all captured cards are on the table
    const tableCardIds = new Set(tableCards.map(card => card.id));
    const allCapturedCardsOnTable = action.capturedCards.every(
      card => tableCardIds.has(card.id)
    );

    if (!allCapturedCardsOnTable) {
      return {
        isValid: false,
        message: "Some captured cards are not on the table",
      };
    }

    // Check if the player's card matches a card on the table (direct match)
    const hasDirectMatch = action.capturedCards.some(
      card => card.rank === action.card!.rank
    );

    if (hasDirectMatch) {
      return { 
        isValid: true,
        capturedCards: action.capturedCards
      };
    }

    // Check if the player's card can capture a combination of cards
    // that sum to the value of the played card
    const playedCardValue = CARD_VALUES[action.card.rank];
    const capturedValues = action.capturedCards.map(
      card => CARD_VALUES[card.rank]
    );
    
    const sumOfCapturedValues = capturedValues.reduce((sum, val) => sum + val, 0);
    
    if (sumOfCapturedValues === playedCardValue) {
      return { 
        isValid: true,
        capturedCards: action.capturedCards
      };
    }

    return {
      isValid: false,
      message: VALIDATION_MESSAGES.CAPTURE.INVALID_COMBINATION,
    };
  }

  /**
   * Validates playing a card to the table
   */
  private static validatePlayCardAction(action: GameAction): ValidatedMove {
    if (!action.card) {
      return {
        isValid: false,
        message: "No card selected to play",
      };
    }
    
    return { isValid: true };
  }

  /**
   * Validates a Koom action (capturing all remaining cards)
   */
  private static validateKoomAction(
    action: GameAction,
    tableCards: Card[]
  ): ValidatedMove {
    if (!action.card) {
      return {
        isValid: false,
        message: "No card selected for Koom",
      };
    }

    // Check if any card on the table matches the played card
    const hasMatch = tableCards.some(
      tableCard => tableCard.rank === action.card!.rank
    );

    if (hasMatch) {
      return { 
        isValid: true,
        capturedCards: tableCards 
      };
    }

    // Check if the card value can capture a combination of cards on the table
    const playedCardValue = CARD_VALUES[action.card.rank];
    
    // Check each possible combination of cards on the table
    // This is a simplified approach - for a complete solution,
    // we would need to check all possible subsets of tableCards
    
    // Find all combinations that sum to the card value
    const possibleCaptures = this.findCombinationsThatSumTo(
      tableCards, 
      playedCardValue
    );
    
    if (possibleCaptures.length > 0) {
      // Return the first valid combination
      return { 
        isValid: true,
        capturedCards: possibleCaptures[0]
      };
    }

    return {
      isValid: false,
      message: VALIDATION_MESSAGES.KOOM.INVALID,
    };
  }

  /**
   * Find all combinations of cards that sum to a target value
   */
  private static findCombinationsThatSumTo(
    cards: Card[],
    targetSum: number
  ): Card[][] {
    // This is a simplified version - a real implementation would
    // need to handle the subset sum problem (NP-complete)
    const results: Card[][] = [];
    
    // Try each card by itself
    cards.forEach(card => {
      if (CARD_VALUES[card.rank] === targetSum) {
        results.push([card]);
      }
    });
    
    // Try pairs of cards
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        if (CARD_VALUES[cards[i].rank] + CARD_VALUES[cards[j].rank] === targetSum) {
          results.push([cards[i], cards[j]]);
        }
      }
    }
    
    // For a complete solution, we would need to check all subsets
    // which would require more complex logic
    
    return results;
  }

  /**
   * Check if a player can make a capture with a given card
   */
  static canCapture(card: Card, tableCards: Card[]): {
    canCapture: boolean;
    capturedCards: Card[];
  } {
    // Check direct matches
    const directMatches = tableCards.filter(
      tableCard => tableCard.rank === card.rank
    );
    
    if (directMatches.length > 0) {
      return {
        canCapture: true,
        capturedCards: directMatches
      };
    }
    
    // Check combinations
    const cardValue = CARD_VALUES[card.rank];
    const possibleCaptures = this.findCombinationsThatSumTo(
      tableCards, 
      cardValue
    );
    
    if (possibleCaptures.length > 0) {
      return {
        canCapture: true,
        capturedCards: possibleCaptures[0]
      };
    }
    
    return {
      canCapture: false,
      capturedCards: []
    };
  }

  /**
   * Check if a player can make a "Koom" (capture all remaining cards)
   */
  static canKoom(card: Card, tableCards: Card[], isLastCard: boolean): boolean {
    // Koom can only be made with the last card in hand
    if (!isLastCard) {
      return false;
    }
    
    // Check if the card matches any card on the table
    const hasMatch = tableCards.some(
      tableCard => tableCard.rank === card.rank
    );
    
    if (hasMatch) {
      return true;
    }
    
    // Check if the card can capture a combination
    const { canCapture } = this.canCapture(card, tableCards);
    return canCapture;
  }

  /**
   * Calculate the score at the end of a round
   */
  static calculateScore(playersCaptured: Record<string, Card[]>): Record<string, number> {
    const scores: Record<string, number> = {};
    
    // Initialize scores to 0
    Object.keys(playersCaptured).forEach(playerId => {
      scores[playerId] = 0;
    });
    
    // Find player with most cards
    let maxCards = 0;
    let playerWithMostCards = '';
    
    Object.entries(playersCaptured).forEach(([playerId, cards]) => {
      if (cards.length > maxCards) {
        maxCards = cards.length;
        playerWithMostCards = playerId;
      }
    });
    
    if (playerWithMostCards) {
      scores[playerWithMostCards] += 1; // Point for most cards
    }
    
    // Count coins and find 7 of coins
    const coinsCount: Record<string, number> = {};
    let playerWithSevenOfCoins = '';
    
    Object.entries(playersCaptured).forEach(([playerId, cards]) => {
      coinsCount[playerId] = 0;
      
      cards.forEach(card => {
        if (card.suit === 'carreau') {
          coinsCount[playerId]++;
          
          if (card.rank === '7') {
            playerWithSevenOfCoins = playerId;
          }
        }
      });
    });
    
    // Award points for most coins
    let maxCoins = 0;
    let playerWithMostCoins = '';
    
    Object.entries(coinsCount).forEach(([playerId, count]) => {
      if (count > maxCoins) {
        maxCoins = count;
        playerWithMostCoins = playerId;
      }
    });
    
    if (playerWithMostCoins) {
      scores[playerWithMostCoins] += 2; // 2 Points for most coins
    }
    
    // Award point for 7 of coins
    if (playerWithSevenOfCoins) {
      scores[playerWithSevenOfCoins] += 1;
    }
    
    return scores;
  }
}