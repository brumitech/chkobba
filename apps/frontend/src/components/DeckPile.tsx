"use client";

import { Card as CardType } from "@chkobba/shared";
import Card from "./Card";
import { motion } from "framer-motion";

interface DeckPileProps {
  cards: CardType[];
}

export default function DeckPile({ cards }: DeckPileProps) {
  return (
    <div className="flex flex-col items-center gap-1 mx-4">
      <motion.span
        className="text-sm font-medium text-white/90 bg-black/40 px-4 py-1.5 rounded-full backdrop-blur-sm shadow-sm"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        Deck ({cards.length})
      </motion.span>
      <div className="relative">
        {cards.length > 0 ? (
          <>
            <Card faceDown />
            {cards.length > 1 && (
              <div className="absolute -bottom-1 -left-1 -right-1 h-2 bg-gradient-to-b from-black/0 to-black/40 rounded-b-lg"></div>
            )}

            {/* Card stack effect based on pile size */}
            {cards.length > 10 && (
              <>
                <div className="absolute -z-10 -top-0.5 -left-0.5 w-20 h-28 bg-black/20 rounded-md transform rotate-1"></div>
                <div className="absolute -z-20 -top-1 -left-1 w-20 h-28 bg-black/20 rounded-md transform rotate-2"></div>
                {cards.length > 20 && (
                  <div className="absolute -z-30 -top-1.5 -left-1.5 w-20 h-28 bg-black/20 rounded-md transform rotate-3"></div>
                )}
              </>
            )}

            {/* Counter badge for large piles */}
            {cards.length > 5 && (
              <motion.div
                className="absolute top-0 right-0 -mt-2 -mr-2 bg-blue-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow-md border border-blue-400"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
              >
                {cards.length}
              </motion.div>
            )}
          </>
        ) : (
          <div className="w-20 h-28 border-2 border-dashed border-white/40 rounded-md bg-white/5 flex items-center justify-center text-white/50 text-xs">
            Empty
          </div>
        )}
      </div>
    </div>
  );
}