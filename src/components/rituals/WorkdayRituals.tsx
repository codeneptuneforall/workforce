import { BirthdayCelebration } from './BirthdayCelebration';
import { BreakReminder } from './BreakReminder';

/**
 * The small rituals that belong to a working day and are not tied to one page:
 * the five-minute break nudge and the birthday greeting. Mounted once in the
 * app shell so every portal gets them.
 */
export function WorkdayRituals() {
  return (
    <>
      <BreakReminder />
      <BirthdayCelebration />
    </>);
}
