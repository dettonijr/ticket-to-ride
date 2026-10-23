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
export const BOARD_HEIGHT = 900;
const PAD = 70;
const TWIN_OFFSET = 9;

/** Fill colours for each printed route colour. */
export const ROUTE_FILL: Record<RouteColour, string> = {
  purple: '#8e44ad',
  blue: '#2b6cb0',
  orange: '#dd6b20',
  white: '#f1f3f5',
  green: '#2f855a',
  yellow: '#d69e2e',
  black: '#1a202c',
  red: '#c53030',
  grey: '#a0aec0',
};

/** Fill colours for the five player colours, used for claimed routes. */
export const PLAYER_FILL: Record<PlayerColour, string> = {
  blue: '#1d4ed8',
  red: '#dc2626',
  green: '#16a34a',
  yellow: '#eab308',
  black: '#111827',
};

export function cityPosition(cityId: string): { x: number; y: number } {
  const city = CITY_BY_ID.get(cityId);
  if (!city) throw new Error(`unknown city ${cityId}`);
  return { x: PAD + city.x * (BOARD_WIDTH - 2 * PAD), y: PAD + city.y * (BOARD_HEIGHT - 2 * PAD) };
}

/** Geometry for drawing one route, offset sideways when it has a twin. */
export function routeGeometry(route: Route): {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  length: number;
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
  };
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
      <rect width={BOARD_WIDTH} height={BOARD_HEIGHT} className="board-bg" />
      <g className="routes">
        {ROUTES.map((route) => {
          const g = routeGeometry(route);
          const owner = claimed[route.id];
          const ownerColour = owner ? playerColours[owner] : undefined;
          const fill = ownerColour ? PLAYER_FILL[ownerColour] : ROUTE_FILL[route.colour];
          const dash = g.length / route.length;
          const isClaimable = claimable?.has(route.id) ?? false;
          const classes = [
            'route',
            owner ? 'route-claimed' : '',
            isClaimable ? 'route-claimable' : '',
          ]
            .filter(Boolean)
            .join(' ');
          const mx = (g.x1 + g.x2) / 2;
          const my = (g.y1 + g.y2) / 2;
          return (
            <g
              key={route.id}
              className={classes}
              data-route-id={route.id}
              data-testid={`route-${route.id}`}
              onClick={isClaimable && onRouteClick ? () => onRouteClick(route.id) : undefined}
            >
              <line
                x1={g.x1}
                y1={g.y1}
                x2={g.x2}
                y2={g.y2}
                className="route-edge"
                strokeWidth={10}
              />
              <line
                x1={g.x1}
                y1={g.y1}
                x2={g.x2}
                y2={g.y2}
                stroke={fill}
                strokeWidth={7}
                strokeDasharray={`${dash - 5} 5`}
              />
              <text
                x={mx}
                y={my}
                className="route-length"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {route.length}
              </text>
            </g>
          );
        })}
      </g>
      <g className="cities">
        {CITIES.map((city) => {
          const p = cityPosition(city.id);
          return (
            <g key={city.id} className="city" data-testid={`city-${city.id}`}>
              <circle cx={p.x} cy={p.y} r={9} className="city-dot" />
              <text x={p.x} y={p.y - 14} textAnchor="middle" className="city-label">
                {city.name}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
