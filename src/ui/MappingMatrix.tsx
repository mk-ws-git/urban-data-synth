import type { Channel, MappingMatrix as Matrix, SoundParam } from "../data/types";
import { PARAM_LABELS, SOUND_PARAMS } from "../data/types";

interface Props {
  channels: Channel[];
  matrix: Matrix;
  onCycle: (channelId: string, param: SoundParam) => void;
}

type CellState = "off" | "on" | "inv";

function stateOf(matrix: Matrix, channelId: string, param: SoundParam): CellState {
  const r = matrix.find((x) => x.channelId === channelId && x.param === param);
  if (!r) return "off";
  return r.invert ? "inv" : "on";
}

export function MappingMatrix({ channels, matrix, onCycle }: Props) {
  return (
    <table className="matrix">
      <thead>
        <tr>
          <th style={{ textAlign: "left" }}>Channel</th>
          {SOUND_PARAMS.map((p) => (
            <th key={p}>{PARAM_LABELS[p]}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {channels.map((c) => (
          <tr key={c.id}>
            <td className="ch">
              {c.label} <span className="src">· {c.source}</span>
            </td>
            {SOUND_PARAMS.map((p) => {
              const st = stateOf(matrix, c.id, p);
              return (
                <td key={p}>
                  <button
                    className="cell"
                    aria-label={`${c.label} to ${PARAM_LABELS[p]}: ${st}`}
                    onClick={() => onCycle(c.id, p)}
                  >
                    <span className={`dot ${st}`} />
                  </button>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
