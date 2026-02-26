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
  montageTotal?: number;
}

const chartConfig = {
  profitAtExpiry: { label: 'No Vencimento', color: 'hsl(var(--chart-profit))' },
  belowZero: { label: 'Prejuízo', color: 'hsl(var(--destructive))' },
  betweenZeroCdi: { label: 'Lucro < CDI', color: 'hsl(32 90% 55%)' },
  aboveCdi: { label: 'Lucro > CDI', color: 'hsl(var(--success))' },
  cdiReturn: { label: 'CDI', color: 'hsl(45 95% 55%)' },
};

export default function PayoffChart({ data, breakevens, cdiRate = 0, daysToExpiry = 0, netCost = 0, montageTotal }: PayoffChartProps) {
  if (data.length === 0) return null;

  const investedCapital = Math.max(Math.abs(montageTotal ?? netCost ?? 0), 1);
  const cdiValue = cdiRate > 0 && daysToExpiry > 0
    ? calculateCDIReturn(investedCapital, cdiRate, daysToExpiry, false)
    : null;

  const chartData = data.map((p) => {
    const profit = p.profitAtExpiry;
    const cdi = cdiValue ?? 0;
    const belowZero = profit < 0 ? profit : 0;
    const betweenZeroCdi = profit > 0 ? Math.min(profit, cdi > 0 ? cdi : profit) : 0;
    const aboveCdi = profit > (cdiValue ?? 0) ? profit - (cdiValue ?? 0) : 0;
    return {
      ...p,
      cdiReturn: cdiValue !== null ? Math.round(cdiValue * 100) / 100 : undefined,
      belowZero,
      betweenZeroCdi,
      aboveCdi,
    };
  });

  const prices = data.map((p) => p.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  const profits = data.map((p) => p.profitAtExpiry);
  const minProfit = Math.min(...profits, cdiValue ?? 0);
  const maxProfit = Math.max(...profits, cdiValue ?? 0);
  const padding = Math.max((maxProfit - minProfit) * 0.1, 1);

  return (
    <ChartContainer config={chartConfig} className="h-[320px] w-full">
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="lossGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.35} />
            <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="orangeGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(32 90% 55%)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="hsl(32 90% 55%)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.35} />
            <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          type="number"
          dataKey="price"
          domain={[minPrice, maxPrice]}
          tickFormatter={(v) => v.toFixed(2)}
          tickCount={8}
          interval="preserveStartEnd"
          className="text-xs"
        />
        <YAxis
          domain={[minProfit - padding, maxProfit + padding]}
          tickFormatter={(v) => v.toFixed(0)}
          className="text-xs"
        />
        <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
        {breakevens.map((be, i) => (
          <ReferenceLine key={i} x={be} stroke="hsl(var(--warning))" strokeDasharray="4 4" label={{ value: `BE ${be.toFixed(2)}`, position: 'top', fill: 'hsl(var(--warning))', fontSize: 11 }} />
        ))}
        {cdiValue !== null && (
          <ReferenceLine y={cdiValue} stroke="hsl(45 95% 55%)" strokeWidth={2} strokeDasharray="6 3" label={{ value: `CDI R$${cdiValue.toFixed(2)}`, position: 'right', fill: 'hsl(45 95% 55%)', fontSize: 11 }} />
        )}
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area type="monotone" dataKey="belowZero" stroke="hsl(var(--destructive))" fill="url(#lossGradient)" strokeWidth={1.5} dot={false} />
        <Area type="monotone" dataKey="betweenZeroCdi" stackId="pos" stroke="hsl(32 90% 55%)" fill="url(#orangeGradient)" strokeWidth={1.5} dot={false} />
        <Area type="monotone" dataKey="aboveCdi" stackId="pos" stroke="hsl(var(--success))" fill="url(#greenGradient)" strokeWidth={1.5} dot={false} />
        <Line type="monotone" dataKey="profitAtExpiry" stroke="hsl(var(--chart-profit))" strokeWidth={2} dot={false} />
      </AreaChart>
    </ChartContainer>
  );
}
