import { useState, useEffect } from 'react';

export const useTimer = (startTime: number, endTime: number, pausedAt: number | null) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isFinishing, setIsFinishing] = useState(false); // <= 10 minutes

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = pausedAt || Date.now();
      const remaining = Math.max(0, endTime - now);
      
      setTimeLeft(remaining);
      setIsFinishing(remaining <= 10 * 60 * 1000); // 10 minutes in ms
    };

    calculateTimeLeft();
    
    // If paused, we don't need a ticking interval
    if (pausedAt) return;

    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [startTime, endTime, pausedAt]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return {
    timeLeft,
    formattedTime: formatTime(timeLeft),
    isFinishing,
    isExpired: timeLeft === 0
  };
};
