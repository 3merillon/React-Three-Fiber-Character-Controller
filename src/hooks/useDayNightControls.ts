import { useControls, button } from 'leva';
import { useDayNight } from '../contexts/DayNightContext';

export function useDayNightControls() {
  const { timeOfDay, timeSpeed, setTimeSpeed, setTime } = useDayNight();
  
  return useControls('Day/Night Cycle', {
    currentTime: {
      value: `${timeOfDay.hours.toString().padStart(2, '0')}:${timeOfDay.minutes.toString().padStart(2, '0')}`,
      disabled: true,
    },
    timeSpeed: {
      value: timeSpeed,
      min: 0.1,
      max: 3600,
      step: 0.1,
      onChange: (value: number) => setTimeSpeed(value),
    },
    // Correct button syntax - no label property
    'Set to Sunrise': button(() => setTime(6, 0)),
    'Set to Noon': button(() => setTime(12, 0)),
    'Set to Sunset': button(() => setTime(18, 0)),
    'Set to Midnight': button(() => setTime(0, 0)),
  });
}