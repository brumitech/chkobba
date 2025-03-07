// apps/frontend/store/chkobbaStore.ts
import create from 'zustand';
import { Room } from 'colyseus.js';
import { Card, GameState, PlayerState } from '@chkobba/shared';

interface ChkobbaStore {
  room: Room | null;
  gameState: GameState | null;
  playerId: string | null;
  isConnected: boolean;
  isCapturing: boolean;
  selectedCard: Card | null;
  selectedTableCards: Card[];
  
  // Connection actions
  setRoom: (room: Room) => void;
  
  // Game actions
  playCard: (card: Card) => void;
  selectCardForCapture: (card: Card) => void;
  selectTableCard: (card: Card) => void;
  confirmCapture: () => void;
  cancelCapture: () => void;
  setReady: () => void;
  startGame: () => void;
}

export const useChkobbaStore = create<ChkobbaStore>((set, get) => ({
  room: null,
  gameState: null,
  playerId: null,
  isConnected: false,
  isCapturing: false,
  selectedCard: null,
  selectedTableCards: [],
  
  setRoom: (room) => {
    // Set the room and listen for state changes
    set({ room, playerId: room.sessionId, isConnected: true });
    
    // Listen for room state changes
    room.onStateChange((state: unknown) => {
      set({ gameState: state as unknown as GameState });
    });
    
    // Listen for room leave
    room.onLeave((code) => {
      set({ isConnected: false });
    });
  },
  
  playCard: (card: { rank: string; id: any; }) => {
    const { room, gameState } = get();
    if (!room || !gameState) return;
    
    // Check if the card can possibly capture any table cards
    const { tableCards } = gameState;
    
    // If there are matching rank cards or possible combinations, enter capture mode
    const hasMatchingRank = tableCards.some((tableCard: { rank: any; }) => tableCard.rank === card.rank);
    const cardValue = parseInt(card.rank, 10);
    
    // Simple check for possible sum combinations (this is simplified)
    // For a more accurate check, you'd need to implement the findPossibleCaptures function
    const hasPossibleCapture = tableCards.some((tableCard: { rank: string; }) => parseInt(tableCard.rank, 10) <= cardValue);
    
    if ((hasMatchingRank || hasPossibleCapture) && tableCards.length > 0) {
      // Enter capture mode
      set({
        isCapturing: true,
        selectedCard: card,
        selectedTableCards: []
      });
    } else {
      // Just play the card without capture
      room.send('playCard', { cardId: card.id });
    }
  },
  
  selectCardForCapture: (card: any) => {
    set({
      isCapturing: true,
      selectedCard: card,
      selectedTableCards: []
    });
  },
  
  selectTableCard: (card: { id: any; }) => {
    const { selectedTableCards } = get();
    
    // Toggle card selection
    if (selectedTableCards.some((c: { id: any; }) => c.id === card.id)) {
      set({
        selectedTableCards: selectedTableCards.filter((c: { id: any; }) => c.id !== card.id)
      });
    } else {
      set({
        selectedTableCards: [...selectedTableCards, card]
      });
    }
  },
  
  confirmCapture: () => {
    const { room, selectedCard, selectedTableCards } = get();
    if (!room || !selectedCard || selectedTableCards.length === 0) return;
    
    // Send capture action to the server
    room.send('captureCards', {
      cardId: selectedCard.id,
      capturedCardIds: selectedTableCards.map(card => card.id)
    });
    
    // Reset capture state
    set({
      isCapturing: false,
      selectedCard: null,
      selectedTableCards: []
    });
  },
  
  cancelCapture: () => {
    set({
      isCapturing: false,
      selectedCard: null,
      selectedTableCards: []
    });
  },
  
  setReady: () => {
    const { room } = get();
    if (!room) return;
    room.send('ready');
  },
  
  startGame: () => {
    const { room } = get();
    if (!room) return;
    room.send('startGame');
  }
}));