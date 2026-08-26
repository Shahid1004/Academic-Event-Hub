import type { Page } from '../types';
import AllEvents from './AllEvents';

interface JointEventsProps {
  navigate: (page: Page, eventId?: string) => void;
  academicYear?: string;
}

export default function JointEvents({ navigate, academicYear }: JointEventsProps) {
  return <AllEvents navigate={navigate} filterDept="BOTH" academicYear={academicYear} title="Joint Events — BOTH (IT + AIDS)" />;
}
