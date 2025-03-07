"use client";

import { motion, AnimatePresence } from "framer-motion";

interface ActionButtonsProps {
  onPlayCard: () => void;
  onCaptureCards: () => void;
  onKoom: () => void;
  onResetSelection: () => void;
  canCapture: boolean;
  canKoom: boolean;
  selectedHandCard: boolean;
  selectedTableCards: boolean;
  isMyTurn: boolean;
}

export default function ActionButtons({
  onPlayCard,
  onCaptureCards,
  onKoom,
  onResetSelection,
  canCapture,
  canKoom,
  selectedHandCard,
  selectedTableCards,
  isMyTurn,
}: ActionButtonsProps) {
  if (!isMyTurn) return null;

  return (
    <AnimatePresence>
      {isMyTurn && (
        <motion.div
          className="fixed bottom-8 right-8 z-20 flex flex-col gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
        >
          {/* Cancel selection button */}
          {(selectedHandCard || selectedTableCards) && (
            <motion.button
              className="px-3 py-2 bg-gray-600 text-white rounded-full shadow-lg hover:bg-gray-500 transition-colors"
              onClick={onResetSelection}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              whileTap={{ scale: 0.95 }}
            >
              Cancel Selection
            </motion.button>
          )}

          {/* Play card button */}
          {selectedHandCard && !selectedTableCards && (
            <motion.button
              className="px-6 py-3 bg-blue-600 text-white text-lg font-bold rounded-lg shadow-lg hover:bg-blue-500 transition-colors transform hover:scale-105"
              onClick={onPlayCard}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              whileTap={{ scale: 0.95 }}
            >
              PLAY CARD
            </motion.button>
          )}

          {/* Capture cards button */}
          {selectedHandCard && selectedTableCards && canCapture && (
            <motion.button
              className="px-6 py-3 bg-green-600 text-white text-lg font-bold rounded-lg shadow-lg hover:bg-green-500 transition-colors transform hover:scale-105"
              onClick={onCaptureCards}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              whileTap={{ scale: 0.95 }}
            >
              CAPTURE CARDS
            </motion.button>
          )}

          {/* Koom button */}
          {canKoom && (
            <motion.button
              className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-red-500 text-white text-lg font-bold rounded-lg shadow-lg hover:from-yellow-400 hover:to-red-400 transition-colors"
              onClick={onKoom}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1, rotate: [0, -1, 1, -1, 0] }}
              transition={{ 
                rotate: { repeat: Infinity, repeatType: "mirror", duration: 1.5 } 
              }}
              whileTap={{ scale: 0.95 }}
            >
              KOOM!
            </motion.button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}