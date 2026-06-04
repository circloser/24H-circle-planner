import { cn } from '@/lib/utils';

// 12 palette chips — the 6 required (gray, amber, blue, violet, pink, emerald)
// plus 6 more for variety
const PALETTE_COLORS: { name: string; hex: string }[] = [
  { name: 'gray', hex: '#9ca3af' },       // gray-400
  { name: 'red', hex: '#f87171' },        // red-400
  { name: 'orange', hex: '#fb923c' },     // orange-400
  { name: 'amber', hex: '#fbbf24' },      // amber-400 (required)
  { name: 'lime', hex: '#a3e635' },       // lime-400
  { name: 'emerald', hex: '#34d399' },    // emerald-400 (required)
  { name: 'teal', hex: '#2dd4bf' },       // teal-400
  { name: 'sky', hex: '#38bdf8' },        // sky-400
  { name: 'blue', hex: '#60a5fa' },       // blue-400 (required)
  { name: 'violet', hex: '#a78bfa' },     // violet-400 (required)
  { name: 'pink', hex: '#f472b6' },       // pink-400 (required)
  { name: 'fuchsia', hex: '#e879f9' },    // fuchsia-400
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
