import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const LINE_COLOR = '#2564F8';
const MUTED = '#9CA3AF';
const GRIDLINE = '#E5E7EB';

function TrendDot({ cx, cy }) {
  return <circle cx={cx} cy={cy} r={4} fill={LINE_COLOR} stroke="#fff" strokeWidth={2} />;
}

const LABEL_WIDTH = 46;
const LABEL_HEIGHT = 24;
const LABEL_GAP = 10;

function ActiveTrendDot({ cx, cy, payload }) {
  const fitsAbove = cy - LABEL_GAP - LABEL_HEIGHT >= 4;
  const boxY = fitsAbove ? cy - LABEL_GAP - LABEL_HEIGHT : cy + LABEL_GAP;

  return (
    <g>
      <circle cx={cx} cy={cy} r={5} fill={LINE_COLOR} stroke="#fff" strokeWidth={2} />
      <rect
        x={cx - LABEL_WIDTH / 2}
        y={boxY}
        width={LABEL_WIDTH}
        height={LABEL_HEIGHT}
        rx={6}
        fill={LINE_COLOR}
      />
      <text
        x={cx}
        y={boxY + LABEL_HEIGHT / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={14}
        fontWeight={700}
        fill="#fff"
      >
        {payload.gpa.toFixed(2)}
      </text>
    </g>
  );
}

export default function GPATrendChart({ data }) {
  if (!data || data.length < 2) {
    return (
      <p className="text-sm text-gray-400">
        Add modules with a semester across at least two semesters to see your GPA trend.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 24, right: 20, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={GRIDLINE} strokeDasharray="0" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: MUTED, fontSize: 11 }}
          axisLine={{ stroke: '#D1D5DB' }}
          tickLine={false}
        />
        <YAxis
          domain={[0, 5]}
          ticks={[0, 1, 2, 3, 4, 5]}
          tick={{ fill: MUTED, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={28}
        />
        <Tooltip content={() => null} cursor={{ stroke: '#D1D5DB', strokeWidth: 1 }} />
        <Line
          type="monotone"
          dataKey="gpa"
          stroke={LINE_COLOR}
          strokeWidth={2}
          dot={<TrendDot />}
          activeDot={<ActiveTrendDot />}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
