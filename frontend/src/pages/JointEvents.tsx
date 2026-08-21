import type { Page } from '../types';
import AllEvents from './AllEvents';

interface JointEventsProps {
  navigate: (page: Page, eventId?: string) => void;
}

export default function JointEvents({ navigate }: JointEventsProps) {
  return <AllEvents navigate={navigate} filterDept="BOTH" title="Joint Events — BOTH (IT + AIDS)" />;
}
