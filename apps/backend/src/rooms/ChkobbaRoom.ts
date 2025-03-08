// apps/backend/src/rooms/ChkobbaRoom.ts

import { Room, Client } from "colyseus";
import { ChkobbaState } from "./schema/ChkobbaState";
import { PlayerState } from "./schema/PlayerState";
import { CardState } from "./schema/CardState";
import { TeamState } from "./schema/TeamState"; // New schema for team play
import { ArraySchema } from "@colyseus/schema";
import {
  DeckManager,
  GameValidator,
  GameUtils,
  GAME_CONSTANTS,
  CARD_VALUES,
  Card,
  ValidatedMove,
  GameMode,
} from "@chkobba/shared";

export class ChkobbaRoom extends Room<ChkobbaState> {
  private turnTimer: NodeJS.Timeout | null = null;
  private pendingCaptures: Map<string, {
    playerId: string;
    playedCardId: string;
    capturedCardIds: string[];
    captureTime: number;
  }> = new Map();

  onCreate(options: { gameMode?: GameMode }) {
    this.setState(new ChkobbaState());
    
    // Set game mode based on options, default to 1v1
    this.state.gameMode = options.gameMode || "1v1";
    this.state.currentTurn = ""; // Ensure empty string not undefined
    this.state.gamePhase = "waiting";
    this.state.turnStartTime = Date.now();
    this.state.turnNumber = 0;
    this.state.winner = "";
    this.state.round = 1;
    this.state.lastCapturePlayerId = "";
    this.state.winningTeam = "";
    // Set max clients based on game mode
    this.maxClients = this.state.gameMode === "2v2" 
      ? 4 
      : GAME_CONSTANTS.PLAYERS.MAX_PLAYERS;
    
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
    this.onMessage("selectTeam", (client, { teamId }) =>
      this.handleSelectTeam(client, teamId)
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

  onJoin(client: Client, options: { name: string, teamId?: string }) {
    const player = new PlayerState(client.sessionId, options.name);
    
    // Handle team assignment for 2v2 mode
    if (this.state.gameMode === "2v2") {
      if (!this.state.teams.length) {
        // Initialize teams if they don't exist
        this.createTeams();
      }
      
      if (options.teamId) {
        // Player has selected a team
        this.assignPlayerToTeam(player, options.teamId);
      } else {
        // Auto-assign to the team with fewer players
        this.autoAssignPlayerToTeam(player);
      }
    }
    
    this.state.players.push(player);

    // Notify everyone that a player joined
    this.broadcast("playerJoin", {
      id: client.sessionId,
      name: options.name,
      teamId: player.teamId,
    });

    // If enough players are in, start automatically
    if (this.canStartGame()) {
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
        // If in team mode, update the team member count
        if (this.state.gameMode === "2v2" && player.teamId) {
          const team = this.state.teams.find(t => t.id === player.teamId);
          if (team) {
            team.memberCount--;
          }
        }
        
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
          // If in team mode, update the team member count
          if (this.state.gameMode === "2v2" && stillHere.teamId) {
            const team = this.state.teams.find(t => t.id === stillHere.teamId);
            if (team) {
              team.memberCount--;
            }
          }
          
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
    
    // If we're in team mode, broadcast a team message about the Koom
    if (this.state.gameMode === "2v2" && player.teamId) {
      const team = this.state.teams.find(t => t.id === player.teamId);
      if (team) {
        this.broadcast("teamKoom", {
          playerId: player.id,
          playerName: player.name,
          teamId: player.teamId,
          teamName: team.name
        });
      }
    }
    
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
   * Handle player selecting a team
   */
  private handleSelectTeam(client: Client, teamId: string) {
    if (this.state.gamePhase !== "waiting") {
      client.send("error", { message: "Cannot change team after game has started." });
      return;
    }
    
    if (this.state.gameMode !== "2v2") {
      client.send("error", { message: "Team selection is only available in 2v2 mode." });
      return;
    }
    
    const player = this.state.players.find(p => p.id === client.sessionId);
    if (!player) return;
    
    // If player is already on a team, decrement that team's count
    if (player.teamId) {
      const oldTeam = this.state.teams.find(t => t.id === player.teamId);
      if (oldTeam) {
        oldTeam.memberCount--;
      }
    }
    
    // Assign to the new team
    this.assignPlayerToTeam(player, teamId);
    
    // Notify everyone about the team change
    this.broadcast("teamChange", {
      playerId: player.id,
      playerName: player.name,
      teamId: player.teamId
    });
    
    // Check if we can start the game now
    if (this.canStartGame()) {
      this.startGame();
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
   * Check game status - if fewer than minimum players, end the game
   */
  private checkGameStatus() {
    const connectedPlayers = this.state.players.filter((p) => p.connected);
    
    if (this.state.gamePhase !== "playing") {
      return;
    }
    
    if (this.state.gameMode === "2v2") {
      // For team mode, check if any team has less than required players
      const teamPlayerCounts: Record<string, number> = {};
      
      // Count connected players per team
      for (const player of connectedPlayers) {
        if (player.teamId) {
          teamPlayerCounts[player.teamId] = (teamPlayerCounts[player.teamId] || 0) + 1;
        }
      }
      
      // Check if any team has less than the minimum (1) player
      const anyTeamInsufficient = this.state.teams.some(team => 
        !teamPlayerCounts[team.id] || teamPlayerCounts[team.id] < 1
      );
      
      if (anyTeamInsufficient) {
        this.state.gamePhase = "finished";
        this.broadcast("gameEnd", { reason: "insufficient_team_players" });
        
        if (this.turnTimer) {
          clearTimeout(this.turnTimer);
          this.turnTimer = null;
        }
      }
    } else {
      // For 1v1 mode, use standard player count check
      if (connectedPlayers.length < GAME_CONSTANTS.PLAYERS.MIN_PLAYERS) {
        this.state.gamePhase = "finished";
        this.broadcast("gameEnd", { reason: "insufficient_players" });
        
        if (this.turnTimer) {
          clearTimeout(this.turnTimer);
          this.turnTimer = null;
        }
      }
    }
  }

  /**
   * Create teams for 2v2 mode
   */
  private createTeams() {
    // Initialize team 1
    const team1 = new TeamState("team1", "Team 1");
    // Initialize team 2
    const team2 = new TeamState("team2", "Team 2");
    
    this.state.teams.push(team1);
    this.state.teams.push(team2);
  }

  /**
   * Assign player to a specific team
   */
  private assignPlayerToTeam(player: PlayerState, teamId: string) {
    const team = this.state.teams.find(t => t.id === teamId);
    
    if (!team) {
      // Team not found, fallback to auto-assign
      this.autoAssignPlayerToTeam(player);
      return;
    }
    
    if (team.memberCount >= 2) {
      // Team is full, assign to the other team
      const otherTeam = this.state.teams.find(t => t.id !== teamId);
      if (otherTeam && otherTeam.memberCount < 2) {
        player.teamId = otherTeam.id;
        otherTeam.memberCount++;
      } else {
        // Both teams are full or something went wrong
        // Auto-assign as a fallback
        this.autoAssignPlayerToTeam(player);
      }
    } else {
      // Assign to the selected team
      player.teamId = team.id;
      team.memberCount++;
    }
  }

  /**
   * Auto-assign player to a team based on balancing
   */
  private autoAssignPlayerToTeam(player: PlayerState) {
    // Find the team with fewer members
    const team1 = this.state.teams.find(t => t.id === "team1");
    const team2 = this.state.teams.find(t => t.id === "team2");
    
    if (!team1 || !team2) {
      console.error("Teams not properly initialized");
      return;
    }
    
    if (team1.memberCount <= team2.memberCount && team1.memberCount < 2) {
      player.teamId = team1.id;
      team1.memberCount++;
    } else if (team2.memberCount < 2) {
      player.teamId = team2.id;
      team2.memberCount++;
    } else {
      console.error("Both teams are full, cannot assign player");
    }
  }
/**
   * Check if the game can start based on player count and game mode
   */
 private canStartGame(): boolean {
  if (this.state.gameMode === "1v1") {
    return this.state.players.length >= GAME_CONSTANTS.PLAYERS.MIN_PLAYERS;
  } else if (this.state.gameMode === "2v2") {
    // Need 4 players, with 2 on each team
    return this.state.players.length >= 4 && 
           this.state.teams.every(team => team.memberCount === 2);
  }
  return false;
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

  
  
  // For 2v2 mode, set up turn order to alternate between teams
  if (this.state.gameMode === "2v2") {
    this.setupTeamTurnOrder();
    
    // Double check that currentTurn is set
    if (this.state.turnOrder.length > 0) {
      this.state.currentTurn = this.state.turnOrder[0];
    } else if (this.state.players.length > 0) {
      // Fallback if turnOrder is empty for some reason
      this.state.currentTurn = this.state.players[0].id;
    }
  } else {
    // For 1v1 mode
    if (this.state.players.length > 0) {
      this.state.currentTurn = this.state.players[0].id;
    }
  }

  this.state.gamePhase = "playing";
  
  this.state.turnStartTime = Date.now();
  this.startTurnTimer();

  // Notify all clients that the game has started
  this.broadcast("gameStart", { gameMode: this.state.gameMode });
}

/**
 * Setup turn order for team mode to alternate between teams
 */
private setupTeamTurnOrder() {
  // Create an array to hold the turn order
  this.state.turnOrder = new ArraySchema<string>();
  
  // Get players from each team
  const team1Players = this.state.players.filter(p => p.teamId === "team1");
  const team2Players = this.state.players.filter(p => p.teamId === "team2");
  
  // Alternate players from each team
  for (let i = 0; i < 2; i++) {
    if (team1Players[i]) this.state.turnOrder.push(team1Players[i].id);
    if (team2Players[i]) this.state.turnOrder.push(team2Players[i].id);
  }
  
  // Set the first player's turn
  if (this.state.turnOrder.length > 0) {
    this.state.currentTurn = this.state.turnOrder[0];
    const firstPlayer = this.state.players.find(p => p.id === this.state.currentTurn);
    if (firstPlayer) {
      firstPlayer.isCurrentTurn = true;
    }
  }
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
  
  // Reset the current player's turn status
  const currentPlayer = this.state.players.find(p => p.id === this.state.currentTurn);
  if (currentPlayer) {
    currentPlayer.isCurrentTurn = false;
  }
  
  // Determine the next player based on game mode
  let nextPlayerId: string;
  
  if (this.state.gameMode === "2v2" && this.state.turnOrder.length > 0) {
    // In team mode, use the predefined turn order
    const currentTurnIndex = this.state.turnOrder.findIndex(id => id === this.state.currentTurn);
    const nextTurnIndex = (currentTurnIndex + 1) % this.state.turnOrder.length;
    nextPlayerId = this.state.turnOrder[nextTurnIndex];
  } else {
    // In 1v1 mode, use the standard turn logic
    const currentPlayerIndex = this.state.players.findIndex(p => p.id === this.state.currentTurn);
    // Calculate the next player index (simple increment with wrap-around)
    const nextPlayerIndex = (currentPlayerIndex + 1) % this.state.players.length;
    nextPlayerId = this.state.players[nextPlayerIndex]?.id || "";
  }
  
  // Get the next player
  const nextPlayer = this.state.players.find(p => p.id === nextPlayerId);
  if (!nextPlayer) {
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
    teamId: nextPlayer.teamId,
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
  if (this.state.gameMode === "2v2") {
    this.endTeamRound();
  } else {
    this.endIndividualRound();
  }
}

/**
 * End round for 1v1 mode
 */
private endIndividualRound() {
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
 * End round for 2v2 mode
 */
private endTeamRound() {
  // Convert player captured cards to the format expected by the validator
  const playersCaptured: Record<string, Card[]> = {};
  
  this.state.players.forEach(player => {
    const capturedCards = player.captured.map(card => this.convertCardState(card))
                                        .filter((card): card is Card => card !== null);
    playersCaptured[player.id] = capturedCards;
  });
  
  // Calculate individual scores
  const roundScores = GameValidator.calculateScore(playersCaptured);
  
  // Add points for last capture
  this.state.players.forEach(player => {
    if (player.lastCapture) {
      roundScores[player.id] = (roundScores[player.id] || 0) + 1;
    }
  });
  
  // Aggregate scores by team
  const teamScores: Record<string, number> = {};
  
  this.state.players.forEach(player => {
    if (player.teamId && roundScores[player.id]) {
      teamScores[player.teamId] = (teamScores[player.teamId] || 0) + roundScores[player.id];
    }
  });
  
  // Update team scores in state
  this.state.teams.forEach(team => {
    if (teamScores[team.id]) {
      team.score += teamScores[team.id];
    }
  });
  
  // Update individual player scores
  this.state.players.forEach(player => {
    if (roundScores[player.id]) {
      player.score += roundScores[player.id];
    }
  });
  
  // Check if any team has won (reached 11 points)
  const winningTeam = this.state.teams.find(team => team.score >= 11);
  
  if (winningTeam) {
    this.endTeamGame(winningTeam.id);
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
  
  // Reset turn order for team mode
  if (this.state.gameMode === "2v2") {
    this.setupTeamTurnOrder();
  } else {
    // For 1v1, set the first player's turn
    if (this.state.players.length > 0) {
      this.state.currentTurn = this.state.players[0].id;
      this.state.players[0].isCurrentTurn = true;
      
      // Reset other players
      for (let i = 1; i < this.state.players.length; i++) {
        this.state.players[i].isCurrentTurn = false;
      }
    }
  }
  
  this.state.turnStartTime = Date.now();
  
  // Notify clients about the new round
  this.broadcast("newRound", { round: this.state.round });
}

/**
 * End the game with an individual winner (1v1 mode)
 */
private endGame(winnerId: string) {
  this.state.gamePhase = "finished";
  this.state.winner = winnerId;
  
  const winner = this.state.players.find(p => p.id === winnerId);
  
  this.broadcast("gameEnd", {
    winner: winnerId,
    playerName: winner?.name || "Unknown",
    teamId: null
  });
  
  if (this.turnTimer) {
    clearTimeout(this.turnTimer);
    this.turnTimer = null;
  }
}

/**
 * End the game with a team winner (2v2 mode)
 */
private endTeamGame(teamId: string) {
  this.state.gamePhase = "finished";
  this.state.winningTeam = teamId;
  
  const team = this.state.teams.find(t => t.id === teamId);
  const teamMembers = this.state.players.filter(p => p.teamId === teamId);
  
  this.broadcast("gameEnd", {
    winningTeam: teamId,
    teamName: team?.name || "Unknown Team",
    teamMembers: teamMembers.map(p => ({ id: p.id, name: p.name }))
  });
  
  if (this.turnTimer) {
    clearTimeout(this.turnTimer);
    this.turnTimer = null;
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
    
    // Also check captured cards
    for (const card of player.captured) {
      if (card.id === id) return card;
    }
  }
  
  return null;
}

/**
 * Verify game constants are properly set
 */
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
}
