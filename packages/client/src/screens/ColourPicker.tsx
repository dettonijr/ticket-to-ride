import { PLAYER_COLOURS, type PlayerColour } from '@railyard/engine';
import { PLAYER_FILL } from '../board/Board';

export function ColourPicker({
  value,
  onChange,
  taken,
}: {
  value: PlayerColour;
  onChange: (c: PlayerColour) => void;
  taken: readonly PlayerColour[];
}) {
  return (
    <fieldset className="colours">
      <legend>Train colour</legend>
      {PLAYER_COLOURS.map((c) => {
        const disabled = taken.includes(c);
        return (
          <label
            key={c}
            className={`colour ${value === c ? 'selected' : ''}`}
            title={disabled ? 'taken' : c}
          >
            <input
              type="radio"
              name="colour"
              value={c}
              checked={value === c}
              disabled={disabled}
              onChange={() => onChange(c)}
            />
            <span className="swatch" style={{ background: PLAYER_FILL[c] }} aria-hidden />
            <span>{c}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
