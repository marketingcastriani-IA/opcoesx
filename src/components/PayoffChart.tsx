import { PayoffPoint } from '@/lib/types';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis, Line } from 'recharts';
import { calculateCDIReturn } from '@/lib/payoff';

interface PayoffChartProps {
  data: PayoffPoint[];
  breakevens: number[];
  cdiRate?: number;
  daysToExpiry?: number;
  netCost?: number;
}

const chartConfig = {
  profitAtExpiry: { label: 'No Vencimento', color: 'hsl(var(--chart-profit))' },
  cdiReturn: { label: 'CDI', color: 'hsl(30 100% 50%)' },
};

export default function PayoffChart({ data, breakevens, cdiRate = 0, daysToExpiry = 0, netCost = 0 }: PayoffChartProps) {
  if (data.length === 0) return null;

  const investedCapital = Math.max(Math.abs(netCost), 100);
  const cdiValue = cdiRate > 0 && daysToExpiry > 0
    ? calculateCDIReturn(investedCapital, cdiRate, daysToExpiry, false)
    : null;

  const chartData = cdiValue !== null
    ? data.map(p => ({ ...p, cdiReturn: Math.round(cdiValue * 100) / 100 }))
    : data;

  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--chart-profit))" stopOpacity={0.3} />
            <stop offset="100%" stopColor="hsl(var(--chart-profit))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="price" tickFormatter={v => v.toFixed(0)} className="text-xs" />
        <YAxis tickFormatter={v => v.toFixed(0)} className="text-xs" />
        <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
        {breakevens.map((be, i) => (
          <ReferenceLine key={i} x={be} stroke="hsl(var(--warning))" strokeDasharray="4 4" label={{ value: `BE ${be.toFixed(2)}`, position: 'top', fill: 'hsl(var(--warning))', fontSize: 11 }} />
        ))}
        {cdiValue !== null && (
          <ReferenceLine y={cdiValue} stroke="hsl(30 100% 50%)" strokeWidth={2} strokeDasharray="6 3" label={{ value: `CDI R$${cdiValue.toFixed(2)}`, position: 'right', fill: 'hsl(30 100% 50%)', fontSize: 11 }} />
        )}
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          type="monotone"
          dataKey="profitAtExpiry"
          stroke="hsl(var(--chart-profit))"
          fill="url(#profitGradient)"
          strokeWidth={2}
          dot={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}
