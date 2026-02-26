import { PayoffPoint } from '@/lib/types';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from 'recharts';

interface PayoffChartProps {
  data: PayoffPoint[];
  breakevens: number[];
}

const chartConfig = {
  profitAtExpiry: { label: 'No Vencimento', color: 'hsl(var(--chart-profit))' },
};

export default function PayoffChart({ data, breakevens }: PayoffChartProps) {
  if (data.length === 0) return null;

  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
