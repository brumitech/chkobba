"use client";

import { Card as CardType } from "@chkobba/shared";
import Card from "./Card";
import { motion } from "framer-motion";

interface TableCardsProps {
  cards: CardType[];
  onSelectCard: (cardId: string) => void;
  selectedCardIds: string[];
}

export default function TableCards({ 
  cards, 
  onSelectCard, 
  selectedCardIds 
}: TableCardsProps) {
  // Function to distribute cards in a nice layout
  const getCardPosition = (index: number, total: number) => {
    if (total <= 4) {
      // Simple grid layout for few cards
      const row = Math.floor(index / 2);
      const col = index % 2;
      return {
        x: (col - 0.5) * 90,
        y: (row - 0.5) * 90,
        rotate: Math.random() * 10 - 5
      };
    }
    
    // Fan layout for many cards
    const angle = (index / total) * 360;
    const radius = Math.min(150, 80 + total * 5); // Larger radius for more cards
    const x = Math.cos(angle * (Math.PI / 180)) * radius;
    const y = Math.sin(angle * (Math.PI / 180)) * radius;
    return {
      x,
      y,
      rotate: Math.random() * 20 - 10
    };
  };

  if (cards.length === 0) {
    return (
      <div className="w-full flex flex-col items-center justify-center">
        <motion.div
          className="w-48 h-48 border-2 border-dashed border-white/30 rounded-full flex items-center justify-center text-white/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <span>No cards on table</span>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative w-96 h-96 flex items-center justify-center">
      <motion.span
        className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-8 text-sm font-medium text-white/90 bg-black/40 px-4 py-1.5 rounded-full backdrop-blur-sm shadow-sm"
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
      >
        Table Cards ({cards.length})
      </motion.span>
      
      {/* Cards spread across the table */}
      {cards.map((card, index) => {
        const isSelected = selectedCardIds.includes(card.id);
        const position = getCardPosition(index, cards.length);
        
        return (
          <motion.div
          key={card.id || `card-${index}-${Date.now()}`}
            className="absolute"
            initial={{ scale: 0, opacity: 0 }}
            animate={{
              scale: 1,
              opacity: 1,
              x: position.x,
              y: position.y,
              rotate: position.rotate
            }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 20,
              delay: index * 0.05
            }}
          >
            <Card
              card={card}
              onClick={() => onSelectCard(card.id)}
              selected={isSelected}
              className={`hover:shadow-lg transform transition-transform ${
                isSelected ? "ring-2 ring-yellow-400 shadow-lg" : ""
              }`}
            />
          </motion.div>
        );
      })}
    </div>
  );
}