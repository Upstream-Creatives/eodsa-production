'use client';

import { useState, useEffect } from 'react';

interface CountdownTimerProps {
  deadline: string;
}

interface TimeLeft {
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
}

const CountdownTimer = ({ deadline }: CountdownTimerProps) => {
  const calculateTimeLeft = (): TimeLeft => {
    const difference = +new Date(deadline) - +new Date();
    let timeLeft: TimeLeft = {};

    if (difference > 0) {
      timeLeft = {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    }

    return timeLeft;
  };

  const [timeLeft, setTimeLeft] = useState<TimeLeft>(calculateTimeLeft());

  useEffect(() => {
    const timer = setTimeout(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearTimeout(timer);
  });

  const timerComponents: JSX.Element[] = [];

  (Object.keys(timeLeft) as Array<keyof TimeLeft>).forEach((interval) => {
    if (!timeLeft[interval]) {
      return;
    }

    timerComponents.push(
      <div key={interval} className="text-center">
        <div className="text-2xl font-bold">{timeLeft[interval]}</div>
        <div className="text-xs uppercase">{interval}</div>
      </div>
    );
  });

  if (!timerComponents.length) {
    return <div className="text-center text-red-500 font-bold">Registration Closed</div>;
  }

  return (
    <div className="grid grid-cols-4 gap-2 text-white font-mono">
      {timerComponents}
    </div>
  );
};

export default CountdownTimer;
