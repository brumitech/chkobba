// apps/frontend/src/components/game/Card.tsx
"use client";

import { useDraggable } from "@dnd-kit/core";
import { Card as CardType } from "@chkobba/shared";
import Image from "next/image";

interface CardProps {
  card?: CardType;
  faceDown?: boolean;
  selected?: boolean;
  onClick?: () => void;
  small?: boolean;
  isDraggable?: boolean;
  className?: string;
}

export default function Card({
  card,
  faceDown,
  selected,
  onClick,
  small = false,
  isDraggable = false,
  className = "",
}: CardProps) {
  // Use a stable ID for dnd-kit
  const cardId = card?.id || "face-down";

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: "card-" + cardId, // e.g. "card-abc123"
      disabled: !isDraggable,
    });

  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    zIndex: isDragging ? 999 : "auto",
  };

  const cardSizeClass = small ? "w-12 h-16" : "w-20 h-28";

  function getCardImage() {
    if (faceDown) return "/Back.png";
    if (!card) return "/cards/card-placeholder.png";

    // Map rank to the appropriate name for the image
    const rankMap: Record<string, string> = {
      "A": "01",
      "2": "02",
      "3": "03",
      "4": "04",
      "5": "05",
      "6": "06",
      "7": "07",
      "J": "08",
      "Q": "09",
      "K": "10"
    };
    
    // Convert suit names to match image naming
    const suitMap: Record<string, string> = {
      "carreau": "carreau",
      "coeur": "coeur",
      "pique": "pique",
      "trèfle": "trèfle"
    };

    const rankStr = rankMap[card.rank] || card.rank;
    const suitStr = suitMap[card.suit] || card.suit;
    
    return `/chkobba/Chkobba_${suitStr}_${rankStr}.svg.png`;
  }

  const imageAlt = faceDown 
    ? "Card back" 
    : card ? `${card.rank} of ${card.suit}` : "Card placeholder";
  
  const imageSrc = getCardImage();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        relative 
        ${cardSizeClass}
        ${isDragging ? "opacity-70" : ""}
        ${className}
        ${onClick ? "cursor-pointer" : isDraggable ? "cursor-grab" : ""}
        ${selected ? "ring-2 ring-yellow-400 shadow-lg transform -translate-y-2" : ""}
        transition-all duration-200
      `}
      onClick={onClick}
      {...attributes}
      {...listeners}
    >
      <div className="w-full h-full relative overflow-hidden rounded-lg shadow-md">
        <Image
          src={imageSrc}
          alt={imageAlt}
          className="object-contain select-none"
          draggable={false}
          fill
          sizes={small ? "(max-width: 48px) 100vw" : "(max-width: 80px) 100vw"}
          priority={!small}
        />
        
        {/* Highlight effect when selected */}
        {selected && (
          <div className="absolute inset-0 bg-yellow-400 opacity-20 pointer-events-none"></div>
        )}
      </div>
    </div>
  );
}