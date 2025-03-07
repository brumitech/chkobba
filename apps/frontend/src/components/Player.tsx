"use client";

import { useDroppable } from "@dnd-kit/core";
import { Card as CardType } from "@chkobba/shared";
import Card from "./Card";
import { motion } from "framer-motion";

interface PlayerProps {
  name: string;
  hand: CardType[];
  captured: CardType[];
  score: number;
  isCurrentPlayer: boolean;
  isLocalPlayer: boolean;
  position: "top" | "right" | "bottom" | "left";
  onSelectCard: (cardId: string) => void;
  selectedCardId: string | null;
  lastCapture?: boolean;
}

function CardDropZone({
  cardId,
  children,
}: {
  cardId: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: "card-" + cardId,
  });
  const style = {
    border: isOver ? "2px dashed yellow" : undefined,
    display: "inline-block",
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children}
    </div>
  );
}

export default function Player({
  name,
  hand,
  captured,
  score,
  isCurrentPlayer,
  isLocalPlayer,
  position,
  onSelectCard,
  selectedCardId,
  lastCapture = false,
}: PlayerProps) {
  // Only show cards for the local player
  const shouldShowCards = isLocalPlayer;

  const getPositionClasses = () => {
    switch (position) {
      case "bottom":
        return "absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center";
      case "top":
        return "absolute top-8 left-1/2 -translate-x-1/2 flex flex-col items-center";
      case "left":
        return "absolute left-8 top-1/2 -translate-y-1/2 flex flex-col items-center";
      case "right":
        return "absolute right-8 top-1/2 -translate-y-1/2 flex flex-col items-center";
      default:
        return "";
    }
  };

  // Determine overlap for card display based on hand size
  const getCardOverlap = () => {
    if (hand.length <= 5) return "-ml-2";
    if (hand.length <= 8) return "-ml-6";
    if (hand.length <= 10) return "-ml-10";
    return "-ml-14";
  };

  const cardOverlap = getCardOverlap();

  return (
    <motion.div
      className={getPositionClasses()}
      initial={{
        opacity: 0,
        y: position === "bottom" ? 50 : position === "top" ? -50 : 0,
        x: position === "left" ? -50 : position === "right" ? 50 : 0,
      }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {/* Player name with active indicator and score */}
      <div
        className={`
          mb-2 px-4 py-1.5 rounded-full text-white font-medium
          flex items-center gap-2 shadow-lg
          transition-all duration-300
          ${
            isCurrentPlayer
              ? "bg-gradient-to-r from-red-600 to-red-700 ring-2 ring-red-400 ring-opacity-50"
              : "bg-gradient-to-r from-gray-700 to-gray-800"
          }
        `}
      >
        {isCurrentPlayer && (
          <span className="w-2.5 h-2.5 bg-red-400 rounded-full animate-pulse"></span>
        )}
        <span>{name}</span>
        <span className="text-xs opacity-70">({hand.length})</span>
        
        {/* Score display */}
        <span className="ml-2 px-2 py-0.5 bg-black/30 rounded-full text-sm font-bold">
          {score} pts
        </span>
        
        {/* Last capture indicator */}
        {lastCapture && (
          <span className="ml-1 px-2 py-0.5 bg-yellow-500 text-black rounded-full text-xs font-bold">
            Last Capture
          </span>
        )}
      </div>

      {/* Hand row */}
      <div className="flex items-start gap-2">
        <div
          className={`flex flex-row items-center ${shouldShowCards ? "flex-nowrap" : ""}`}
          style={{ maxWidth: "80vw" }}
        >
          {shouldShowCards ? (
            // Local player's visible hand
            <div className="flex">
              {hand.map((card, index) => {
                const isSelected = selectedCardId === card.id;
                // Fallback if card.id is empty:
                const fallbackKey = `hand-${index}`;
                const key =
                  card.id && card.id.trim() !== "" ? card.id : fallbackKey;

                return (
                  <div
                    key={key}
                    className={`${index === 0 ? "" : cardOverlap} transition-transform duration-200`}
                    style={{
                      zIndex: isSelected ? 10 : index,
                    }}
                  >
                    <CardDropZone cardId={key}>
                      <Card
                        card={card}
                        faceDown={false}
                        selected={isSelected}
                        onClick={() => onSelectCard(card.id)}
                        isDraggable={true}
                        className={
                          isSelected ? "ring-2 ring-yellow-400 shadow-lg" : ""
                        }
                      />
                    </CardDropZone>
                  </div>
                );
              })}
            </div>
          ) : (
            // Opponent's face-down hand
            <motion.div
              className="relative"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              {hand.length > 0 && (
                <>
                  {hand.length > 1 && (
                    <div className="absolute -right-1 -top-1 w-20 h-28 bg-gray-800/30 rounded-md transform rotate-3"></div>
                  )}
                  {hand.length > 2 && (
                    <div className="absolute -left-1 -bottom-1 w-20 h-28 bg-gray-800/30 rounded-md transform -rotate-3"></div>
                  )}
                  <div className="relative w-20 h-28">
                    <Card faceDown />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="font-bold text-xl text-white bg-black/50 px-2 py-0.5 rounded-full">
                        {hand.length}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* Captured cards indicator */}
      {captured.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 flex items-center gap-2 bg-black/40 rounded-full px-3 py-1 text-white text-sm"
        >
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          Captured: {captured.length} cards
        </motion.div>
      )}
    </motion.div>
  );
}