export interface TimeSlice {
  id: string;
  label: string;
  startTime: string; // "HH:mm" 0-23 hour
  endTime: string; // "HH:mm" — may equal "24:00" only as renderer convention; storage form normalizes to "00:00"
  color: string; // hex
  icon: string; // emoji char or lucide-id string
  textPosition: 'inside' | 'outside';
}
