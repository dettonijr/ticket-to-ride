import {
  CITIES,
  CITY_BY_ID,
  ROUTES,
  type PlayerColour,
  type PlayerId,
  type Route,
  type RouteColour,
} from '@railyard/engine';

export const BOARD_WIDTH = 1400;
export const BOARD_HEIGHT = 860;
const PAD = 90;
/** Width of one wooden piece across the route. */
const PIECE = 17;
/** Gap between two pieces along the route. */
const GAP = 6;
/** Clearance between a city dot and the first piece. */
const CITY_CLEARANCE = 24;
/** Sideways offset of each twin of a double route. */
const TWIN_OFFSET = 12;
const CITY_RADIUS = 11;

/** Fill colours for each printed route colour. */
export const ROUTE_FILL: Record<RouteColour, string> = {
  purple: '#9b6bd6',
  blue: '#4d8fe0',
  orange: '#ff9b42',
  white: '#fdfaf4',
  green: '#5cb86a',
  yellow: '#ffd25a',
  black: '#5a5250',
  red: '#f06060',
  grey: '#d9cdb8',
};

/** Fill colours for the five player colours, used for trains and swatches. */
// Deeper than the route colours so a train reads as a different object from
// the wooden piece it sits on.
export const PLAYER_FILL: Record<PlayerColour, string> = {
  blue: '#2f6fc9',
  red: '#d94848',
  green: '#3f9a4f',
  yellow: '#e8b400',
  black: '#3a3331',
};

// The city coordinates are normalised 0..1 but do not reach the edges; scale
// them to the data's own bounds so the map fills the board.
const bounds = (() => {
  const xs = CITIES.map((c) => c.x);
  const ys = CITIES.map((c) => c.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
})();

export function cityPosition(cityId: string): { x: number; y: number } {
  const city = CITY_BY_ID.get(cityId);
  if (!city) throw new Error(`unknown city ${cityId}`);
  const fx = (city.x - bounds.minX) / (bounds.maxX - bounds.minX);
  const fy = (city.y - bounds.minY) / (bounds.maxY - bounds.minY);
  return { x: PAD + fx * (BOARD_WIDTH - 2 * PAD), y: PAD + fy * (BOARD_HEIGHT - 2 * PAD) };
}

/** Geometry for drawing one route, offset sideways when it has a twin. */
export function routeGeometry(route: Route): {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  length: number;
  /** Direction in degrees, for rotating pieces along the route. */
  angle: number;
  /** Unit normal, pointing to the side labels go on. */
  nx: number;
  ny: number;
  /** Sideways offset applied for a twin. */
  offset: number;
} {
  const a = cityPosition(route.from);
  const b = cityPosition(route.to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  let offset = 0;
  if (route.twinId) {
    // Twin ids end in -1 and -2; put them on opposite sides of the centre line.
    offset = route.id.endsWith('-1') ? -TWIN_OFFSET : TWIN_OFFSET;
  }
  return {
    x1: a.x + nx * offset,
    y1: a.y + ny * offset,
    x2: b.x + nx * offset,
    y2: b.y + ny * offset,
    length,
    angle: (Math.atan2(dy, dx) * 180) / Math.PI,
    nx,
    ny,
    offset,
  };
}

/** One wooden piece per space; a claimed piece becomes a train in the owner's colour. */
function Pieces({ route, fill, owner }: { route: Route; fill: string; owner: boolean }) {
  const g = routeGeometry(route);
  const usable = g.length - 2 * CITY_CLEARANCE;
  const seg = usable / route.length;
  const h = PIECE;
  return (
    <g transform={`translate(${g.x1} ${g.y1}) rotate(${g.angle})`}>
      {Array.from({ length: route.length }, (_, s) => {
        const x = CITY_CLEARANCE + s * seg + GAP / 2;
        const w = Math.max(seg - GAP, 6);
        if (owner) {
          // A train: a taller body with a dark outline, a window strip and wheels.
          const bh = h + 5;
          return (
            <g key={s}>
              <rect
                x={x}
                y={-bh / 2}
                width={w}
                height={bh}
                rx={6}
                fill={fill}
                className="piece train"
                filter="url(#piece-shadow)"
              />
              <rect
                x={x + 3}
                y={-bh / 2 + 3}
                width={w - 6}
                height={bh * 0.32}
                rx={2}
                className="piece-shine"
              />
              <circle cx={x + 5} cy={bh / 2 + 1.5} r={3} className="wheel" />
              <circle cx={x + w - 5} cy={bh / 2 + 1.5} r={3} className="wheel" />
            </g>
          );
        }
        return (
          <g key={s}>
            <rect
              x={x}
              y={-h / 2}
              width={w}
              height={h}
              rx={5}
              fill={fill}
              className="piece"
              filter="url(#piece-shadow)"
            />
            <rect
              x={x + 3}
              y={-h / 2 + 2.5}
              width={w - 6}
              height={3}
              rx={1.5}
              className="piece-shine"
            />
          </g>
        );
      })}
    </g>
  );
}

export interface BoardProps {
  /** Route id to the id of the player who claimed it. */
  claimed: Record<string, PlayerId>;
  /** Player id to colour, for painting claimed routes. */
  playerColours: Record<PlayerId, PlayerColour>;
  /** Routes the viewer may claim right now; others are muted. */
  claimable?: ReadonlySet<string>;
  onRouteClick?: (routeId: string) => void;
}

/** The schematic USA board, drawn entirely from the engine's data. */
export function Board({ claimed, playerColours, claimable, onRouteClick }: BoardProps) {
  return (
    <svg
      className="board"
      viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
      role="img"
      aria-label="Railyard board: the USA map with 36 cities and 100 routes"
    >
      <defs>
        <pattern id="felt-dots" width="18" height="18" patternUnits="userSpaceOnUse">
          <circle cx="9" cy="9" r="1.4" fill="rgba(255,255,255,0.55)" />
        </pattern>
        <filter id="piece-shadow" x="-20%" y="-40%" width="140%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="1.4" floodColor="#000" floodOpacity="0.28" />
        </filter>
      </defs>
      <rect width={BOARD_WIDTH} height={BOARD_HEIGHT} rx="28" className="board-bg" />
      <rect width={BOARD_WIDTH} height={BOARD_HEIGHT} rx="28" fill="url(#felt-dots)" />
      <rect
        x="8"
        y="8"
        width={BOARD_WIDTH - 16}
        height={BOARD_HEIGHT - 16}
        rx="22"
        className="board-edge"
      />
      <g className="routes">
        {ROUTES.map((route) => {
          const g = routeGeometry(route);
          const owner = claimed[route.id];
          const ownerColour = owner ? playerColours[owner] : undefined;
          const fill = ownerColour ? PLAYER_FILL[ownerColour] : ROUTE_FILL[route.colour];
          const isClaimable = claimable?.has(route.id) ?? false;
          const classes = [
            'route',
            owner ? 'route-claimed' : '',
            isClaimable ? 'route-claimable' : '',
          ]
            .filter(Boolean)
            .join(' ');
          // One length label per city pair, on the outer side of twin "-1".
          const labelled = !route.twinId || route.id.endsWith('-1');
          const side = -(Math.abs(g.offset) + PIECE / 2 + 12);
          const lx = (g.x1 + g.x2) / 2 + g.nx * side - g.nx * g.offset;
          const ly = (g.y1 + g.y2) / 2 + g.ny * side - g.ny * g.offset;
          return (
            <g
              key={route.id}
              className={classes}
              data-route-id={route.id}
              data-testid={`route-${route.id}`}
              onClick={isClaimable && onRouteClick ? () => onRouteClick(route.id) : undefined}
            >
              {/* A wide invisible hit area so thin diagonal routes are easy to click. */}
              <line
                x1={g.x1}
                y1={g.y1}
                x2={g.x2}
                y2={g.y2}
                stroke="transparent"
                strokeWidth={PIECE + 10}
              />
              <Pieces route={route} fill={fill} owner={Boolean(owner)} />
              {labelled && (
                <>
                  <circle cx={lx} cy={ly} r={10} className="route-length-bg" />
                  <text
                    x={lx}
                    y={ly + 0.5}
                    className="route-length"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {route.length}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </g>
      <g className="cities">
        {CITIES.map((city) => {
          const p = cityPosition(city.id);
          const below = p.y < PAD + 10;
          const ly = below ? p.y + CITY_RADIUS + 16 : p.y - CITY_RADIUS - 13;
          const w = city.name.length * 8.4 + 16;
          return (
            <g key={city.id} className="city" data-testid={`city-${city.id}`}>
              <circle cx={p.x} cy={p.y + 2.5} r={CITY_RADIUS} className="city-shadow" />
              <circle cx={p.x} cy={p.y} r={CITY_RADIUS} className="city-dot" />
              <rect
                x={p.x - w / 2}
                y={ly - 11}
                width={w}
                height={22}
                rx={11}
                className="city-label-bg"
              />
              <text
                x={p.x}
                y={ly + 0.5}
                textAnchor="middle"
                dominantBaseline="middle"
                className="city-label"
              >
                {city.name}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
