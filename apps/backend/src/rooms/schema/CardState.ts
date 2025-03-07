// apps/backend/src/rooms/schema/CardState.ts

import { Schema, type } from "@colyseus/schema";
import { Card, Suit, Rank } from "@chkobba/shared";

export class CardState extends Schema {
  @type("string") id = "";
  @type("string") suit: Suit = "carreau";
  @type("string") rank: Rank = "A";

  constructor(card?: Card) {
    super();
    if (card) {
      this.id = card.id;
      this.suit = card.suit;
      this.rank = card.rank;
    }
  }
}