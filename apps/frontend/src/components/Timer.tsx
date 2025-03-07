"use client";

import { useEffect, useState } from "react";
import { GAME_CONSTANTS } from "@chkobba/shared";

interface TimerProps {
  onTimeout: () => void;
  active?: boolean;
}

export default function Timer({ onTimeout, active = false }: TimerProps) {
  const [timeLeft, setTimeLeft] = useState(
    GAME_CONSTANTS.TIMING.TURN_DURATION / 1000
  );

  useEffect(() => {
    if (!active) {
      setTimeLeft(GAME_CONSTANTS.TIMING.TURN_DURATION / 1000);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [active, onTimeout]);

  // Format the time as MM:SS
  const minutes = Math.floor(timeLeft / 60);
  const seconds = Math.floor(timeLeft % 60);
  const formattedTime = `${minutes}:${seconds.toString().padStart(2, "0")}`;
  
  // Calculate percentage for visual timer
  const percentageLeft = (timeLeft / (GAME_CONSTANTS.TIMING.TURN_DURATION / 1000)) * 100;
  
  // Determine color based on time left
  const getTimerColor = () => {
    if (timeLeft < 10) return "bg-red-600";
    if (timeLeft < 15) return "bg-amber-500";
    return "bg-green-600";
  };

  return (
    <div className="bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full text-white shadow-lg border border-white/10 relative overflow-hidden">
      {/* Background progress bar */}
      <div 
        className={`absolute left-0 top-0 bottom-0 ${getTimerColor()} transition-all duration-1000 ease-linear`}
        style={{ width: `${percentageLeft}%`, opacity: 0.3 }}
      ></div>
      
      {/* Timer text */}
      <div className="relative font-mono font-bold">
        {formattedTime}
      </div>
    </div>
  );
}