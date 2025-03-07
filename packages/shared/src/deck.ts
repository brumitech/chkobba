// packages/shared/src/deck.ts

import { Card, Suit, Rank, GameOptions, PlayerState } from "./types";
import { GAME_CONSTANTS, CARD_VALUES } from "./constants";
import { v4 as uuidv4 } from "uuid";

export class DeckManager {
  private static readonly SUITS: Suit[] = [
    "carreau",
    "coeur",
    "pique",
    "trèfle",
  ];

  private static readonly RANKS: Rank[] = [
    "A",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "J",
    "Q",
    "K",
  ];

  static generateDeck(): Card[] {
    const deck: Card[] = [];

    // Generate standard 40-card deck (no 8s, 9s, or 10s)
    for (const suit of this.SUITS) {
      for (const rank of this.RANKS) {
        deck.push({
          id: uuidv4(),
          suit,
          rank,
        });
      }
    }

    return deck;
  }

  static shuffleDeck(deck: Card[]): Card[] {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  static dealCards(deck: Card[], players: PlayerState[]): {
    updatedPlayers: PlayerState[];
    remainingDeck: Card[];
    tableCards: Card[];
  } {
    const cardsToDeal = GAME_CONSTANTS.PLAYERS.INITIAL_CARDS;
    const updatedPlayers = [...players];
    const remainingDeck = [...deck];
    
    // Deal cards to each player
    for (let i = 0; i < cardsToDeal; i++) {
      for (const player of updatedPlayers) {
        const card = remainingDeck.pop();
        if (card) {
          player.hand.push(card);
        }
      }
    }

    // Place initial cards on the table
    const tableCards = remainingDeck.splice(
      remainingDeck.length - GAME_CONSTANTS.TABLE.INITIAL_CARDS,
      GAME_CONSTANTS.TABLE.INITIAL_CARDS
    );

    return {
      updatedPlayers,
      remainingDeck,
      tableCards
    };
  }

  static drawCard(deck: Card[]): { card: Card; remainingDeck: Card[] } {
    if (deck.length === 0) {
      throw new Error("No cards left in the deck");
    }
    const remainingDeck = [...deck];
    const card = remainingDeck.pop()!;
    return { card, remainingDeck };
  }

  static drawCards(deck: Card[], count: number): { 
    cards: Card[]; 
    remainingDeck: Card[] 
  } {
    if (deck.length < count) {
      throw new Error("Not enough cards in the deck");
    }
    const remainingDeck = [...deck];
    const cards = remainingDeck.splice(-count);
    return { cards, remainingDeck };
  }

  static getRankValue(rank: Rank): number {
    return CARD_VALUES[rank];
  }

  static sortCards(cards: Card[]): Card[] {
    return [...cards].sort((a, b) => {
      if (a.suit !== b.suit) {
        return this.SUITS.indexOf(a.suit) - this.SUITS.indexOf(b.suit);
      }
      return this.getRankValue(a.rank) - this.getRankValue(b.rank);
    });
  }
}