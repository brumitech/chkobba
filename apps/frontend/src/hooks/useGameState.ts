// apps/frontend/src/hooks/useGameState.ts

import { useState, useEffect, useCallback } from "react";
import { gameClient } from "../utils/gameClient";
import { useToast } from "@/ui/toast";
import { Card, EVENT_MESSAGES, ERROR_MESSAGES, CARD_VALUES ,GAME_CONSTANTS } from "@chkobba/shared";

/**
 * Shape of the room state we receive from the server.
 */
export interface GameState {
  gamePhase: "waiting" | "playing" | "finished";
  players: {
    id: string;
    name: string;
    isCurrentTurn: boolean;
    connected: boolean;
    hand: Card[];
    captured: Card[];
    score: number;
    lastCapture: boolean;
  }[];
  deck: Card[];
  tableCards: Card[];
  currentTurn: string;
  turnStartTime: number;
  turnNumber: number;
  winner: string;
  round: number;
  lastCapturePlayerId: string;
}

export function useGameState() {
  const { addToast } = useToast();

  // The current room state, or null if not joined
  const [gameState, setGameState] = useState<GameState | null>(null);

  // Our local player's ID (sessionId from Colyseus)
  const [playerId, setPlayerId] = useState<string | null>(null);

  // Selected card from player's hand
  const [selectedHandCardId, setSelectedHandCardId] = useState<string | null>(null);

  // Selected cards from the table (for capture)
  const [selectedTableCardIds, setSelectedTableCardIds] = useState<string[]>([]);

  // Track the previous turn to show a toast when it's now our turn
  const [prevTurn, setPrevTurn] = useState<string | null>(null);

  // Flag to determine if koom is possible
  const [canKoom, setCanKoom] = useState<boolean>(false);

  // When game state changes, check if Koom is possible
  useEffect(() => {
    if (!gameState || !playerId) return;

    const localPlayer = gameState.players.find((p) => p.id === playerId);
    if (!localPlayer || !localPlayer.isCurrentTurn) {
      setCanKoom(false);
      return;
    }

    // Check if the player has only one card left
    if (localPlayer.hand.length === 1 && selectedHandCardId) {
      const selectedCard = localPlayer.hand.find(card => card.id === selectedHandCardId);
      if (selectedCard) {
        // Check if this card can capture something on the table
        const hasDirectMatch = gameState.tableCards.some(
          tableCard => tableCard.rank === selectedCard.rank
        );
        
        setCanKoom(hasDirectMatch);
        // More complex combinations would need the validator
      }
    } else {
      setCanKoom(false);
    }
  }, [gameState, playerId, selectedHandCardId]);

  useEffect(() => {
    // Configure callbacks so the gameClient can notify us when the state changes
    gameClient.setCallbacks({
      onStateChange: (newState) => {
        if (!newState || !newState.players) return;

        // If the turn changed and it's now our turn, show a toast
        if (
          prevTurn &&
          prevTurn !== newState.currentTurn &&
          newState.currentTurn === playerId
        ) {
          addToast({
            title: "Your Turn",
            description: "It's your turn to play.",
            variant: "info",
          });
        }
        setPrevTurn(newState.currentTurn);

        // Force a new reference for state by creating a new object
        setGameState({
          ...newState,
          players: [...newState.players],
          deck: [...newState.deck],
          tableCards: [...newState.tableCards],
        });
      },

      onError: (errorMsg) => {
        addToast({
          title: "Error",
          description: errorMsg,
          variant: "destructive",
        });
      },

      onActionSuccess: (action, data) => {
        switch (action) {
          case "play":
            addToast({
              title: "Card Played",
              description: data.cardName
                ? `You played the ${data.cardName} to the table.`
                : "Your card was played to the table.",
              variant: "info",
            });
            setSelectedHandCardId(null);
            setSelectedTableCardIds([]);
            break;
            
          case "capture":
            addToast({
              title: "Cards Captured",
              description: `You captured ${data.capturedCount} cards with the ${data.cardName}.`,
              variant: "success",
            });
            setSelectedHandCardId(null);
            setSelectedTableCardIds([]);
            break;
            
          case "koom":
            addToast({
              title: "KOOM!",
              description: `You captured all remaining cards with the ${data.cardName}!`,
              variant: "success",
            });
            setSelectedHandCardId(null);
            setSelectedTableCardIds([]);
            break;
        }
      },

      onLeave: () => {
        setGameState(null);
        setPlayerId(null);
        setPrevTurn(null);
        setSelectedHandCardId(null);
        setSelectedTableCardIds([]);
        addToast({
          title: "Left Game",
          description: EVENT_MESSAGES.player_left,
          variant: "info",
        });
      },

      onPlayerJoin: (player) => {
        if (player.id !== playerId) {
          addToast({
            title: "Player Joined",
            description: `${player.name} ${EVENT_MESSAGES.player_joined}`,
            variant: "info",
          });
        }
      },

      onPlayerLeave: (player) => {
        addToast({
          title: "Player Left",
          description: `${player.name} ${EVENT_MESSAGES.player_left}`,
          variant: "warning",
        });
      },

      onNewRound: (roundNumber) => {
        addToast({
          title: "New Round",
          description: `Round ${roundNumber} has started!`,
          variant: "info",
        });
      },

      onGameStart: () => {
        addToast({
          title: "Game Started",
          description: EVENT_MESSAGES.game_started,
          variant: "info",
        });
      },

      onGameEnd: (data) => {
        if (data.winner) {
          const isLocalPlayerWinner = data.winner === playerId;
          addToast({
            title: "Game Over",
            description: isLocalPlayerWinner
              ? "Congratulations! You won the game!"
              : `Game over. ${data.playerName} has won.`,
            variant: isLocalPlayerWinner ? "success" : "info",
            duration: 8000,
          });
        } else if (data.reason) {
          addToast({
            title: "Game Ended",
            description: `${EVENT_MESSAGES.game_ended}: ${data.reason}.`,
            variant: "warning",
            duration: 8000,
          });
        }
      },

      onPlayerTimeout: (timeoutPlayerId) => {
        const isLocalPlayer = timeoutPlayerId === playerId;
        addToast({
          title: "Turn Timeout",
          description: isLocalPlayer
            ? ERROR_MESSAGES.timeout
            : EVENT_MESSAGES.turn_timeout,
          variant: "warning",
        });
      },
    });
  }, [addToast, playerId, prevTurn]);

  const joinGame = useCallback(
    async (playerName: string) => {
      try {
        const { sessionId } = await gameClient.joinGame(playerName);
        setPlayerId(sessionId);
        addToast({
          title: "Joined Game",
          description: `You've joined as ${playerName}.`,
          variant: "success",
        });
      } catch (error) {
        const eMsg = error instanceof Error ? error.message : String(error);
        addToast({ title: "Error", description: eMsg, variant: "destructive" });
      }
    },
    [addToast]
  );

  // Handle card selection from hand
  const handleHandCardSelect = useCallback((cardId: string) => {
    setSelectedHandCardId((prev) => (prev === cardId ? null : cardId));
  }, []);

  // Handle card selection from table
  const handleTableCardSelect = useCallback((cardId: string) => {
    setSelectedTableCardIds((prev) => {
      // If already selected, remove it
      if (prev.includes(cardId)) {
        return prev.filter(id => id !== cardId);
      }
      // Otherwise add it
      return [...prev, cardId];
    });
  }, []);

  // Determine if capture is possible
  // Replace the canCapture function in useGameState.ts with this implementation

const canCapture = useCallback(() => {
  if (!selectedHandCardId || selectedTableCardIds.length === 0 || !gameState) {
    return false;
  }
  
  const selectedCard = gameState.players
    .find(p => p.id === playerId)?.hand
    .find(card => card.id === selectedHandCardId);
    
  if (!selectedCard) return false;
  
  // Check if direct match (same rank)
  const allSameRank = selectedTableCardIds.every(id => {
    const tableCard = gameState.tableCards.find(card => card.id === id);
    return tableCard && tableCard.rank === selectedCard.rank;
  });
  
  if (allSameRank) return true;
  
  // Check if sum-based capture is valid
  const selectedCardValue = CARD_VALUES[selectedCard.rank];
  
  // Get the values of all selected table cards
  const selectedTableCardsSum = selectedTableCardIds.reduce((sum, id) => {
    const tableCard = gameState.tableCards.find(card => card.id === id);
    return sum + (tableCard ? CARD_VALUES[tableCard.rank] : 0);
  }, 0);
  
  // Valid capture if the sum equals the played card's value
  return selectedCardValue === selectedTableCardsSum;
}, [gameState, playerId, selectedHandCardId, selectedTableCardIds]);

  return {
    gameState,
    playerId,
    selectedHandCardId,
    selectedTableCardIds,
    canCapture: canCapture(),
    canKoom,
    actions: {
      joinGame,
      selectHandCard: handleHandCardSelect,
      selectTableCard: handleTableCardSelect,
      reorderHand: (newHand: Card[]) => {
        if (playerId) {
          gameClient.reorderHand(newHand);
        }
      },
      playCard: (cardId: string) => {
        gameClient.playCard(cardId);
        setSelectedHandCardId(null);
      },
      captureCards: (cardId: string, capturedCardIds: string[]) => {
        gameClient.captureCards(cardId, capturedCardIds);
        setSelectedHandCardId(null);
        setSelectedTableCardIds([]);
      },
      koom: (cardId: string) => {
        gameClient.koom(cardId);
        setSelectedHandCardId(null);
        setSelectedTableCardIds([]);
      },
      leaveGame: () => gameClient.leaveGame(),
      resetSelections: () => {
        setSelectedHandCardId(null);
        setSelectedTableCardIds([]);
      },
    },
  };
}