import { cn } from '@/lib/utils';

// 12 soft pastel palette chips (Tailwind *-300 tones). Pastel fills keep the
// chart calm; slice label text is darkened separately to stay readable.
const PALETTE_COLORS: { name: string; hex: string }[] = [
  { name: 'gray', hex: '#d1d5db' },       // gray-300
  { name: 'red', hex: '#fca5a5' },        // red-300
  { name: 'orange', hex: '#fdba74' },     // orange-300
  { name: 'amber', hex: '#fcd34d' },      // amber-300 (required)
  { name: 'lime', hex: '#bef264' },       // lime-300
  { name: 'emerald', hex: '#6ee7b7' },    // emerald-300 (required)
  { name: 'teal', hex: '#5eead4' },       // teal-300
  { name: 'sky', hex: '#7dd3fc' },        // sky-300
  { name: 'blue', hex: '#93c5fd' },       // blue-300 (required)
  { name: 'violet', hex: '#c4b5fd' },     // violet-300 (required)
  { name: 'pink', hex: '#f9a8d4' },       // pink-300 (required)
  { name: 'fuchsia', hex: '#f0abfc' },    // fuchsia-300
];

export interface ColorSwatchProps {
  selectedColor: string;
  onPick: (hex: string) => void;
}

export function ColorSwatch({ selectedColor, onPick }: ColorSwatchProps) {
  const normalizedSelected = selectedColor.toLowerCase();

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PALETTE_COLORS.map(({ name, hex }) => {
        const isSelected = normalizedSelected === hex.toLowerCase();
        return (
          <button
            key={name}
            type="button"
            title={name}
            aria-label={`색상 ${name}`}
            aria-pressed={isSelected}
            onClick={() => onPick(hex)}
            className={cn(
              'w-6 h-6 rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              isSelected && 'ring-2 ring-offset-2 ring-foreground scale-110',
            )}
            style={{ backgroundColor: hex }}
          />
        );
      })}
      {/* Custom hex picker */}
      <label className="relative w-6 h-6 cursor-pointer" title="직접 선택">
        <span className="sr-only">직접 색상 선택</span>
        <div className="w-6 h-6 rounded-full border border-dashed border-muted-foreground flex items-center justify-center text-xs text-muted-foreground hover:border-foreground transition-colors">
          +
        </div>
        <input
          type="color"
          value={selectedColor}
          onChange={(e) => onPick(e.target.value)}
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
        />
      </label>
    </div>
  );
}
