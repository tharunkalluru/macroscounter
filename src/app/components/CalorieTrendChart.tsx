import {
  Area,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DayTotal } from '../../domain/history/averages'
import { isDarkFamily } from '../../domain/theme/resolveTheme'
import { brand, neutral, surface, surfaceDark } from '../../theme/tokens'
import { useTheme } from '../shell/ThemeContext'

interface Props {
  data: DayTotal[]
  /** Latest target calories, if a target has been set — draws a dashed reference line. */
  targetKcal: number | null
}

export default function CalorieTrendChart({ data, targetKcal }: Props) {
  const { resolvedTheme } = useTheme()
  const isDark = isDarkFamily(resolvedTheme)
  const gridStroke = isDark ? neutral[700] : neutral[200]
  const tickColor = isDark ? neutral[400] : neutral[500]

  const chartData = data.map((d) => ({ ...d, label: d.date.slice(5) }))

  return (
    <div
      className="mb-4 h-48 rounded-card bg-white dark:bg-surface-dark-card p-4 shadow-card"
      data-testid="calorie-trend-chart"
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData}>
          <defs>
            <linearGradient id="calorieTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={brand[500]} stopOpacity={0.3} />
              <stop offset="100%" stopColor={brand[500]} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: tickColor }}
            axisLine={{ stroke: gridStroke }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: tickColor }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? surfaceDark.card : surface.card,
              borderColor: isDark ? neutral[700] : neutral[200],
              borderRadius: 12,
              color: isDark ? neutral[100] : neutral[900],
            }}
            labelStyle={{ color: isDark ? neutral[300] : neutral[600] }}
            formatter={(value: number) => [`${Math.round(value)} kcal`, 'Calories']}
          />
          {targetKcal !== null && (
            <ReferenceLine
              y={targetKcal}
              stroke={neutral[400]}
              strokeDasharray="4 4"
              label={{ value: 'Target', position: 'insideTopRight', fill: tickColor, fontSize: 11 }}
            />
          )}
          <Area
            type="monotone"
            dataKey="kcal"
            stroke={brand[600]}
            strokeWidth={2.5}
            fill="url(#calorieTrendFill)"
            dot={{ r: 2 }}
            name="Calories"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
