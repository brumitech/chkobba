// apps/backend/src/rooms/ChkobbaRoom.ts

import { Room, Client } from "colyseus";
import { ChkobbaState } from "./schema/ChkobbaState";
import { PlayerState } from "./schema/PlayerState";
import { CardState } from "./schema/CardState";
import { ArraySchema } from "@colyseus/schema";
import {
  DeckManager,
  GameValidator,
  GameUtils,
  GAME_CONSTANTS,
  CARD_VALUES,
  Card,
  ValidatedMove,
} from "@chkobba/shared";

export class ChkobbaRoom extends Room<ChkobbaState> {
  private turnTimer: NodeJS.Timeout | null = null;

  onCreate() {
    this.setState(new ChkobbaState());
    this.maxClients = GAME_CONSTANTS.PLAYERS.MAX_PLAYERS;
    this.verifyGameConstants();
    // Listen for front-end messages
    this.onMessage("playCard", (client, { cardId }) =>
      this.handlePlayCard(client, cardId)
    );
    this.onMessage("captureCards", (client, { cardId, capturedCardIds }) =>
      this.handleCaptureCards(client, cardId, capturedCardIds)
    );
    this.onMessage("koom", (client, { cardId }) =>
      this.handleKoom(client, cardId)
    );
    this.onMessage("reorderHand", (client, { newHand }) =>
      this.handleReorderHand(client, newHand)
    );
    // Patch at ~20fps + check turn timeouts
    this.setPatchRate(1000 / 20);

    this.setSimulationInterval(() => {
      const now = Date.now();
      for (const [key, capture] of this.pendingCaptures.entries()) {
        if (now - capture.captureTime > 10000) {  // 10 seconds
          this.pendingCaptures.delete(key);
        }
      }
    }, 60000);
  }

  onJoin(client: Client, options: { name: string }) {
    const player = new PlayerState(client.sessionId, options.name);
    this.state.players.push(player);

    // Notify everyone that a player joined
    this.broadcast("playerJoin", {
      id: client.sessionId,
      name: options.name,
    });

    // If enough players are in, start automatically
    if (this.state.players.length >= GAME_CONSTANTS.PLAYERS.MIN_PLAYERS) {
      this.startGame();
    }
  }

  onLeave(client: Client, consented: boolean) {
    const player = this.state.players.find((p) => p.id === client.sessionId);
    if (!player) return;

    // Notify everyone about the player leaving
    this.broadcast("playerLeave", {
      id: client.sessionId,
      name: player?.name,
    });

    if (consented) {
      // Player intentionally left -> remove them immediately
      const idx = this.state.players.findIndex(
        (p) => p.id === client.sessionId
      );
      if (idx !== -1) {
        this.state.players.splice(idx, 1);
      }
    } else {
      // Player disconnected (involuntarily)
      player.connected = false;

      // After 40 seconds, if still disconnected, remove the player
      const reconnectionTimeout = setTimeout(() => {
        const stillHere = this.state.players.find(
          (p) => p.id === client.sessionId
        );
        if (stillHere && !stillHere.connected) {
          const i = this.state.players.findIndex(
            (p) => p.id === client.sessionId
          );
          if (i !== -1) {
            this.state.players.splice(i, 1);
            this.checkGameStatus();
          }
        }
      }, 40000 /* 40 seconds in ms */);

      // Make an idempotent reconnect handler
      const reconnectHandler = (reconnectClient: Client) => {
        // If it's not the same session, ignore
        if (reconnectClient.sessionId !== client.sessionId) return;

        // Check if this player still exists in state
        const rejoiner = this.state.players.find(
          (p) => p.id === client.sessionId
        );
        if (!rejoiner) {
          // They were removed; can't rejoin
          reconnectClient.send("error", {
            message: "You are no longer in the game.",
          });
          return;
        }

        // If the player is already reconnected, do nothing
        if (rejoiner.connected) {
          return;
        }

        // Mark them reconnected and clear the timeout
        rejoiner.connected = true;
        clearTimeout(reconnectionTimeout);
      };

      // Listen for a "reconnect" message
      this.onMessage("reconnect", reconnectHandler);
    }

    this.checkGameStatus();
  }

  onDispose() {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
    }
  }

  /**
   * Starts the game once we have enough players.
   */
  private startGame() {
    if (this.state.gamePhase !== "waiting") return;

    const deck = DeckManager.shuffleDeck(DeckManager.generateDeck());

    // Convert to CardState objects
    const deckState = new ArraySchema<CardState>(
      ...deck.map((c) => new CardState(c))
    );
    this.state.deck = deckState;

    // Deal initial cards
    this.dealCards();

    this.state.gamePhase = "playing";
    this.state.currentTurn = this.state.players[0]?.id || "";
    if (this.state.players[0]) {
      this.state.players[0].isCurrentTurn = true;
    }
    this.state.turnStartTime = Date.now();

    this.startTurnTimer();

    // Notify all clients that the game has started
    this.broadcast("gameStart", {});
  }

  /**
   * Deal cards to players and table
   */
  private dealCards() {
    const playerCount = this.state.players.length;
    const cardsPerPlayer = GAME_CONSTANTS.PLAYERS.INITIAL_CARDS;
    
    // Deal cards to players
    for (let i = 0; i < cardsPerPlayer; i++) {
      for (let j = 0; j < playerCount; j++) {
        const player = this.state.players[j];
        if (this.state.deck.length > 0 && player) {
          const card = this.state.deck.pop();
          if (card) {
            player.hand.push(card);
          }
        }
      }
    }
    
    // Place initial cards on the table
    for (let i = 0; i < GAME_CONSTANTS.TABLE.INITIAL_CARDS; i++) {
      if (this.state.deck.length > 0) {
        const card = this.state.deck.pop();
        if (card) {
          this.state.tableCards.push(card);
        }
      }
    }
  }

  private startTurnTimer() {
    if (this.turnTimer) clearTimeout(this.turnTimer);

    this.turnTimer = setTimeout(() => {
      // Auto-play for the timed-out player
      this.handleTimeout();
    }, GAME_CONSTANTS.TIMING.TURN_DURATION);
  }

  private checkTurnTimeout() {
    if (this.state.gamePhase !== "playing") return;
    const now = Date.now();
    const elapsed = now - this.state.turnStartTime;
    if (elapsed > GAME_CONSTANTS.TIMING.TURN_DURATION) {
      this.handleTimeout();
    }
  }

  private pendingCaptures: Map<string, {
    playerId: string;
    playedCardId: string;
    capturedCardIds: string[];
    captureTime: number;
  }> = new Map();
  /**
   * Handle a player's turn timeout by auto-playing a card
   */
  private handleTimeout() {
    const currentPlayer = this.state.players.find(
      (p) => p.id === this.state.currentTurn
    );
    
    if (!currentPlayer) {
      this.moveToNextTurn();
      return;
    }
    
    // Notify players about the timeout
    this.broadcast("playerTimeout", { playerId: currentPlayer.id });
    
    // Auto-play: Just play the first card in hand if possible
    if (currentPlayer.hand.length > 0) {
      const cardToPlay = currentPlayer.hand[0];
      
      // Check if this card can capture something
      const tableCards = this.getTableCards();
      const cardToPlayConverted = this.convertCardState(cardToPlay);
      
      if (cardToPlayConverted) {
        const { canCapture, capturedCards } = GameValidator.canCapture(
          cardToPlayConverted,
          tableCards
        );
        
        if (canCapture && capturedCards.length > 0) {
          // Auto-capture
          const capturedCardStates = capturedCards.map(c => this.findCardStateById(c.id))
            .filter((c): c is CardState => c !== null);
          
          if (cardToPlay) {
            this.performCapture(currentPlayer, cardToPlay, capturedCardStates);
          }
        } else {
          // Just play the card to the table
          const [played] = currentPlayer.hand.splice(0, 1);
          if (played) {
            this.state.tableCards.push(played);
          }
        }
      }
    }
    
    this.moveToNextTurn();
  }

  private moveToNextTurn() {
    // If game is already over, don't proceed
    if (this.state.gamePhase === "finished") {
      return;
    }
    
    // If all players are out of cards, deal new cards or end the round
    const allPlayersHandsEmpty = this.state.players.every(player => player.hand.length === 0);
    
    if (allPlayersHandsEmpty) {
      // If the deck is also empty, end the round
      if (this.state.deck.length === 0) {
        // If the table is empty, we're completely done
        if (this.state.tableCards.length === 0) {
          this.endRound();
          return;
        }
        
        // Give remaining table cards to the last player who made a capture
        if (this.state.lastCapturePlayerId) {
          const lastCapturer = this.state.players.find(
            p => p.id === this.state.lastCapturePlayerId
          );
          
          if (lastCapturer) {
            // Award all remaining table cards to this player
            while (this.state.tableCards.length > 0) {
              const card = this.state.tableCards.pop();
              if (card) {
                lastCapturer.captured.push(card);
              }
            }
            lastCapturer.lastCapture = true;
          }
        }
        
        this.endRound();
        return;
      }
      
      // Deal new cards to all players
      this.dealNewRound();
    }
    
    // Find the current player index
    const currentPlayerIndex = this.state.players.findIndex(
      p => p.id === this.state.currentTurn
    );
    
    // Reset the current player's turn status
    if (currentPlayerIndex !== -1) {
      const currentPlayer = this.state.players[currentPlayerIndex];
      if (currentPlayer) {
        currentPlayer.isCurrentTurn = false;
      }
    }
    
    // Calculate the next player index (simple increment with wrap-around)
    // This is a failsafe in case GameUtils.getNextPlayerIndex has issues
    let nextPlayerIndex = (currentPlayerIndex + 1) % this.state.players.length;
    
    // Also try the utility function
    try {
      // Convert to regular array for the utility function
      const playersArray = this.state.players.map(p => ({
        id: p.id,
        name: p.name,
        hand: p.hand.map(this.convertCardState).filter((c): c is Card => c !== null),
        captured: p.captured.map(this.convertCardState).filter((c): c is Card => c !== null),
        isCurrentTurn: p.isCurrentTurn,
        score: p.score,
        lastCapture: p.lastCapture,
        connected: p.connected
      }));
      
      const utilNextIndex = GameUtils.getNextPlayerIndex(
        currentPlayerIndex,
        playersArray
      );
      
      // Only use the utility result if it's valid
      if (utilNextIndex >= 0 && utilNextIndex < this.state.players.length) {
        nextPlayerIndex = utilNextIndex;
      }
    } catch (error) {
      // If there's an error in the utility, fall back to our simple calculation
      console.error("Error in getNextPlayerIndex, using fallback", error);
    }
    
    // Get the next player
    const nextPlayer = this.state.players[nextPlayerIndex];
    if (!nextPlayer) {
      // This should never happen with the fallback, but just in case
      console.error("Could not find next player, player count:", this.state.players.length);
      return;
    }
    
    // Update turn state
    nextPlayer.isCurrentTurn = true;
    this.state.currentTurn = nextPlayer.id;
    this.state.turnStartTime = Date.now();
    this.state.turnNumber++;
    
    // Broadcast turn change to all clients
    this.broadcast("turnChange", {
      playerId: nextPlayer.id,
      playerName: nextPlayer.name,
      turnNumber: this.state.turnNumber
    });
    
    this.startTurnTimer();
  }
  

  /**
   * Deal new cards to all players
   */
  private dealNewRound() {
    const playerCount = this.state.players.length;
    const cardsPerPlayer = GAME_CONSTANTS.PLAYERS.INITIAL_CARDS;
    
    // Deal cards to players
    for (let i = 0; i < cardsPerPlayer; i++) {
      for (let j = 0; j < playerCount; j++) {
        const player = this.state.players[j];
        if (this.state.deck.length > 0 && player) {
          const card = this.state.deck.pop();
          if (card) {
            player.hand.push(card);
          }
        }
      }
    }
  }

  /**
   * End the current round and calculate scores
   */
  private endRound() {
    // Convert player captured cards to the format expected by the validator
    const playersCaptured: Record<string, Card[]> = {};
    
    this.state.players.forEach(player => {
      const capturedCards = player.captured.map(card => this.convertCardState(card))
                                          .filter((card): card is Card => card !== null);
      playersCaptured[player.id] = capturedCards;
    });
    
    // Calculate scores
    const roundScores = GameValidator.calculateScore(playersCaptured);
    
    // Add points for last capture
    this.state.players.forEach(player => {
      if (player.lastCapture) {
        roundScores[player.id] = (roundScores[player.id] || 0) + 1;
      }
    });
    
    // Add round scores to players
    this.state.players.forEach(player => {
      if (roundScores[player.id]) {
        player.score += roundScores[player.id];
      }
    });
    
    // Check if any player has won the game (reached 11 points)
    const winner = this.state.players.find(player => player.score >= 11);
    
    if (winner) {
      this.endGame(winner.id);
    } else {
      // Reset for next round
      this.startNewRound();
    }
  }

  /**
   * Start a new round
   */
  private startNewRound() {
    // Reset game state for new round
    this.state.round++;
    this.state.tableCards.clear();
    this.state.lastCapturePlayerId = "";
    
    // Reset player hands and captures
    this.state.players.forEach(player => {
      player.hand.clear();
      player.captured.clear();
      player.lastCapture = false;
    });
    
    // Generate and shuffle a new deck
    const deck = DeckManager.shuffleDeck(DeckManager.generateDeck());
    this.state.deck = new ArraySchema<CardState>(
      ...deck.map((c) => new CardState(c))
    );
    
    // Deal cards for the new round
    this.dealCards();
    
    // Notify clients about the new round
    this.broadcast("newRound", { round: this.state.round });
  }

  /**
   * End the game with a winner
   */
  private endGame(winnerId: string) {
    this.state.gamePhase = "finished";
    this.state.winner = winnerId;
    
    const winner = this.state.players.find(p => p.id === winnerId);
    
    this.broadcast("gameEnd", {
      winner: winnerId,
      playerName: winner?.name || "Unknown",
    });
    
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
  }

  /**
   * Handle playing a card to the table (no capture)
   */
   private handlePlayCard(client: Client, cardId: string) {
    // Log the play attempt for debugging
    console.log(`Play attempt by ${client.sessionId}:`, {
      cardId,
      currentTurn: this.state.currentTurn,
      playerIds: this.state.players.map(p => p.id)
    });
    
    if (client.sessionId !== this.state.currentTurn) {
      client.send("error", { 
        message: `Not your turn. Current turn: ${this.state.currentTurn}` 
      });
      return;
    }
    
    const player = this.state.players.find((p) => p.id === client.sessionId);
    if (!player) return;
    
    const cardIndex = player.hand.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) {
      client.send("error", { message: "Card not in your hand." });
      return;
    }
    
    // Remove the card from the player's hand and add it to the table
    const [playedCard] = player.hand.splice(cardIndex, 1);
    if (playedCard) {
      this.state.tableCards.push(playedCard);
      
      // Send acknowledgment
      client.send("playSuccess", {
        cardId,
        cardName: `${playedCard.rank} of ${playedCard.suit}`,
      });
    }
    
    this.moveToNextTurn();
  }


  /**
   * Handle capturing cards from the table
   */
  // This implementation focuses specifically on making sure multiple card captures work correctly
// It eliminates any dependencies on GameValidator to give us complete control

private handleCaptureCards(
  client: Client,
  cardId: string,
  capturedCardIds: string[]
) {
  console.log(`\n===== CAPTURE ATTEMPT =====`);
  console.log(`Player ${client.sessionId} is trying to capture with card ${cardId}`);
  console.log(`Attempting to capture: [${capturedCardIds.join(', ')}]`);
  
  if (client.sessionId !== this.state.currentTurn) {
    client.send("error", { message: "Not your turn." });
    return;
  }
  
  const player = this.state.players.find((p) => p.id === client.sessionId);
  if (!player) return;
  
  // Find the played card in player's hand
  const cardIndex = player.hand.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) {
    client.send("error", { message: "Card not in your hand." });
    return;
  }
  
  const playedCard = player.hand[cardIndex];
  if (!playedCard) {
    client.send("error", { message: "Card not found." });
    return;
  }
  
  const playedCardValue = CARD_VALUES[playedCard.rank];
  
  // Check if this is part of a pending capture
  const pendingCaptureKey = `${client.sessionId}:${cardId}`;
  let pendingCapture = this.pendingCaptures.get(pendingCaptureKey);
  
  // If no pending capture exists, create one
  if (!pendingCapture) {
    pendingCapture = {
      playerId: client.sessionId,
      playedCardId: cardId,
      capturedCardIds: [],
      captureTime: Date.now()
    };
    this.pendingCaptures.set(pendingCaptureKey, pendingCapture);
    console.log("Starting new pending capture");
  }
  
  // Add the new captured card(s) to the pending capture
  for (const capturedId of capturedCardIds) {
    // Check if card is on the table
    const tableCardIndex = this.state.tableCards.findIndex((c) => c.id === capturedId);
    if (tableCardIndex === -1) {
      client.send("error", { message: "One or more cards not on the table." });
      return;
    }
    
    // Check for duplicates in pending capture
    if (!pendingCapture.capturedCardIds.includes(capturedId)) {
      pendingCapture.capturedCardIds.push(capturedId);
    }
  }
  
  console.log(`Updated pending capture: [${pendingCapture.capturedCardIds.join(', ')}]`);
  
  // Get all the captured cards
  const capturedCards: CardState[] = [];
  for (const capturedId of pendingCapture.capturedCardIds) {
    const tableCard = this.state.tableCards.find((c) => c.id === capturedId);
    if (tableCard) {
      capturedCards.push(tableCard);
    }
  }
  
  // Validate the capture
  const allSameRank = capturedCards.length > 0 && 
                      capturedCards.every(card => card.rank === playedCard.rank);
  
  const sumOfCapturedValues = capturedCards.reduce(
    (sum, card) => sum + CARD_VALUES[card.rank], 0
  );
  
  console.log("Capture validation:");
  console.log(`- Played card: ${playedCard.rank} (${playedCardValue})`);
  console.log(`- Captured cards: ${capturedCards.map(c => c.rank).join(', ')}`);
  console.log(`- Captured values: ${capturedCards.map(c => CARD_VALUES[c.rank]).join(', ')}`);
  console.log(`- Capture by rank: ${allSameRank ? "VALID" : "INVALID"}`);
  console.log(`- Capture by sum: ${playedCardValue} vs ${sumOfCapturedValues}, ${playedCardValue === sumOfCapturedValues ? "VALID" : "INVALID"}`);
  
  // Check if the capture is valid
  const isValidCapture = allSameRank || (playedCardValue === sumOfCapturedValues);
  
  // If the capture is valid or the sum is greater than the played card value,
  // perform the capture (we assume the player is done selecting)
  if (isValidCapture || sumOfCapturedValues >= playedCardValue) {
    console.log("Processing final capture");
    
    if (!isValidCapture) {
      client.send("error", { 
        message: `Invalid capture. Cards must either all match the rank of ${playedCard.rank} or sum to ${playedCardValue}.` 
      });
      this.pendingCaptures.delete(pendingCaptureKey);
      return;
    }
    
    // Successful capture!
    console.log("CAPTURE SUCCESSFUL!");
    console.log(`Capturing ${capturedCards.length} cards with ${playedCard.rank} of ${playedCard.suit}`);
    
    // Remove played card from hand
    player.hand.splice(cardIndex, 1);
    
    // Remove captured cards from table
    for (const card of capturedCards) {
      const index = this.state.tableCards.findIndex((c) => c.id === card.id);
      if (index !== -1) {
        this.state.tableCards.splice(index, 1);
      }
    }
    
    // Add all cards to player's captured pile
    player.captured.push(playedCard);
    for (const card of capturedCards) {
      player.captured.push(card);
    }
    
    // Update the last capture player
    this.state.lastCapturePlayerId = player.id;
    
    // Clean up the pending capture
    this.pendingCaptures.delete(pendingCaptureKey);
    
    // Send acknowledgment
    client.send("captureSuccess", {
      cardId,
      cardName: `${playedCard.rank} of ${playedCard.suit}`,
      capturedCount: capturedCards.length,
    });
    
    // Move to next turn
    this.moveToNextTurn();
  } else {
    // The capture is not yet valid, but we'll keep the pending capture
    // and wait for more cards to be selected
    const pendingTimeMs = Date.now() - pendingCapture.captureTime;
    console.log(`Pending capture: ${pendingCapture.capturedCardIds.length} cards, ${pendingTimeMs}ms elapsed`);
    
    // If it's been more than 5 seconds, assume player is done selecting
    if (pendingTimeMs > 5000) {
      console.log("Pending capture expired");
      client.send("error", { 
        message: `Invalid capture. Cards must either all match the rank of ${playedCard.rank} or sum to ${playedCardValue}.` 
      });
      this.pendingCaptures.delete(pendingCaptureKey);
    } else {
      // Acknowledge the card selection
      client.send("cardSelected", {
        cardId: capturedCardIds[0],
        pendingSum: sumOfCapturedValues,
        targetValue: playedCardValue
      });
    }
  }
}
    /**
   * Validate a capture action
   */
   private validateCapture(
    playedCard: Card,
    capturedCards: Card[]
  ): ValidatedMove {
    // Get all cards on the table for context
    const tableCards = this.getTableCards();
    
    // Use the shared GameValidator that's used in the auto-play timeout handler
    const validationResult = GameValidator.canCapture(
      playedCard,
      tableCards
    );
    
    if (!validationResult.canCapture) {
      return {
        isValid: false,
        message: "This card cannot capture any cards on the table."
      };
    }
    
    // If no cards were selected to capture, that's invalid
    if (capturedCards.length === 0) {
      return {
        isValid: false,
        message: "You must select at least one card to capture."
      };
    }
    
    // Check if the selected cards are a valid subset of possible captures
    const selectedCardIds = new Set(capturedCards.map(card => card.id));
    
    // If capturing by rank, all captured cards should have the same rank as the played card
    if (capturedCards.some(card => card.rank === playedCard.rank)) {
      const validRankCards = tableCards.filter(card => card.rank === playedCard.rank);
      const validRankCardIds = new Set(validRankCards.map(card => card.id));
      
      // Check if all selected cards have the correct rank
      const allSelectedHaveCorrectRank = capturedCards.every(card => card.rank === playedCard.rank);
      
      // Check if all selected cards are on the table
      const allSelectedAreValid = [...selectedCardIds].every(id => validRankCardIds.has(id));
      
      if (!allSelectedHaveCorrectRank || !allSelectedAreValid) {
        return {
          isValid: false,
          message: "When capturing by rank, all selected cards must match the played card's rank."
        };
      }
      
      return { isValid: true };
    }
    
    // If capturing by sum, the sum of captured cards should equal the played card's value
    const playedCardValue = CARD_VALUES[playedCard.rank];
    const sumOfCapturedValues = capturedCards.reduce(
      (sum, card) => sum + CARD_VALUES[card.rank], 0
    );
    
    // Check if the selected cards sum to the played card's value
    if (sumOfCapturedValues !== playedCardValue) {
      return {
        isValid: false,
        message: `Selected cards must sum to ${playedCardValue} to match the played card's value.`
      };
    }
    
    // Check if all selected cards are on the table
    const allTableCardIds = new Set(tableCards.map(card => card.id));
    const allSelectedCardsOnTable = [...selectedCardIds].every(id => allTableCardIds.has(id));
    
    if (!allSelectedCardsOnTable) {
      return {
        isValid: false,
        message: "All selected cards must be on the table."
      };
    }
    
    return { isValid: true };
  }

  /**
   * Perform a capture action
   */
  private performCapture(
    player: PlayerState,
    playedCard: CardState,
    capturedCards: CardState[]
  ) {
    // Remove played card from hand
    const playedCardIndex = player.hand.findIndex((c) => c.id === playedCard.id);
    if (playedCardIndex !== -1) {
      player.hand.splice(playedCardIndex, 1);
    }
    
    // Remove captured cards from table
    for (const card of capturedCards) {
      const index = this.state.tableCards.findIndex((c) => c.id === card.id);
      if (index !== -1) {
        this.state.tableCards.splice(index, 1);
      }
    }
    
    // Add all cards to player's captured pile
    if (playedCard) {
      player.captured.push(playedCard);
    }
    
    for (const card of capturedCards) {
      player.captured.push(card);
    }
    
    // Update the last capture player
    this.state.lastCapturePlayerId = player.id;
  }

  /**
   * Handle "Koom" - capturing all remaining cards with the last card
   */
  private handleKoom(client: Client, cardId: string) {
    if (client.sessionId !== this.state.currentTurn) {
      client.send("error", { message: "Not your turn." });
      return;
    }
    
    const player = this.state.players.find((p) => p.id === client.sessionId);
    if (!player) return;
    
    // Check if this is the player's last card
    if (player.hand.length !== 1) {
      client.send("error", { message: "Koom can only be played with your last card." });
      return;
    }
    
    // Find the played card in player's hand
    const cardIndex = player.hand.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) {
      client.send("error", { message: "Card not in your hand." });
      return;
    }
    
    const playedCard = player.hand[cardIndex];
    if (!playedCard) {
      client.send("error", { message: "Card not found." });
      return;
    }
    
    const tableCards = this.state.tableCards.map(card => {
      const converted = this.convertCardState(card);
      return converted ? converted : null;
    }).filter((card): card is Card => card !== null);
    
    const playedCardConverted = this.convertCardState(playedCard);
    if (!playedCardConverted) {
      client.send("error", { message: "Invalid card data." });
      return;
    }
    
    // Check if Koom is valid for this card
    const canKoom = GameValidator.canKoom(
      playedCardConverted,
      tableCards,
      true
    );
    
    if (!canKoom) {
      client.send("error", { message: "This card cannot Koom." });
      return;
    }
    
    // Remove the card from player's hand
    player.hand.splice(cardIndex, 1);
    
    // Add the played card and all table cards to player's captured pile
    if (playedCard) {
      player.captured.push(playedCard);
    }
    
    while (this.state.tableCards.length > 0) {
      const card = this.state.tableCards.pop();
      if (card) {
        player.captured.push(card);
      }
    }
    
    // Set the last capture flag and player
    player.lastCapture = true;
    this.state.lastCapturePlayerId = player.id;
    
    // Send acknowledgment
    if (playedCard) {
      client.send("koomSuccess", {
        cardId,
        cardName: `${playedCard.rank} of ${playedCard.suit}`,
      });
    }
    
    this.moveToNextTurn();
  }

  /**
   * Handle reordering a player's hand
   */
  private handleReorderHand(client: Client, newHand: Card[]) {
    const player = this.state.players.find((p) => p.id === client.sessionId);
    if (!player) return;
    
    // Verify that the new hand contains the same cards
    if (newHand.length !== player.hand.length) {
      client.send("error", { message: "Invalid hand reordering." });
      return;
    }
    
    // Create a map of the current hand for validation
    const currentHandMap = new Map<string, CardState>();
    player.hand.forEach((card) => {
      currentHandMap.set(card.id, card);
    });
    
    // Check that all cards in the new order exist in the current hand
    for (const card of newHand) {
      if (!currentHandMap.has(card.id)) {
        client.send("error", { message: "Invalid card in reordered hand." });
        return;
      }
    }
    
    // Reorder the hand
    const newHandState = new ArraySchema<CardState>();
    newHand.forEach((card) => {
      const cardState = currentHandMap.get(card.id);
      if (cardState) {
        newHandState.push(cardState);
      }
    });
    
    player.hand = newHandState;
  }

  /**
   * Check game status - if fewer than minimum players, end the game
   */
  private checkGameStatus() {
    const connectedPlayers = this.state.players.filter((p) => p.connected);
    if (
      connectedPlayers.length < GAME_CONSTANTS.PLAYERS.MIN_PLAYERS && 
      this.state.gamePhase === "playing"
    ) {
      this.state.gamePhase = "finished";
      this.broadcast("gameEnd", { reason: "insufficient_players" });
      
      if (this.turnTimer) {
        clearTimeout(this.turnTimer);
        this.turnTimer = null;
      }
    }
  }

  /**
   * Utility method to get table cards as Card objects
   */
  private getTableCards(): Card[] {
    return this.state.tableCards
      .map(card => this.convertCardState(card))
      .filter((card): card is Card => card !== null);
  }

  /**
   * Convert CardState to Card
   */
  private convertCardState(cardState: CardState | undefined): Card | null {
    if (!cardState) return null;
    return {
      id: cardState.id,
      suit: cardState.suit,
      rank: cardState.rank
    };
  }

  private verifyGameConstants() {
    // Check if CARD_VALUES exists and has correct mappings
    if (!CARD_VALUES) {
      console.error("CARD_VALUES is undefined");
      return;
    }
    
    // Log card values for debugging
    console.log("CARD_VALUES:", JSON.stringify(CARD_VALUES));
    
    // Check for common card ranks
    const keysToCheck = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
    const missingKeys = keysToCheck.filter(key => !(key in CARD_VALUES));
    
    if (missingKeys.length > 0) {
      console.error("Missing card values for ranks:", missingKeys);
    }
  }

  /**
   * Find a CardState by id
   */
  private findCardStateById(id: string): CardState | null {
    // Check the table
    for (const card of this.state.tableCards) {
      if (card.id === id) return card;
    }
    
    // Check each player's hand
    for (const player of this.state.players) {
      for (const card of player.hand) {
        if (card.id === id) return card;
      }
    }
    
    return null;
  }
}