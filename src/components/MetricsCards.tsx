import { AnalysisMetrics } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Target, DollarSign, Percent } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface MetricsCardsProps {
  metrics: AnalysisMetrics;
  cdiReturn?: number;
  daysToExpiry?: number;
}

export default function MetricsCards({ metrics, cdiReturn = 0 }: MetricsCardsProps) {
  const maxGainValue = metrics.maxGain === 'Ilimitado' ? null : Number(metrics.maxGain);
  const maxLossValue = metrics.maxLoss === 'Ilimitado' ? null : Number(metrics.maxLoss);
  const efficiency = cdiReturn > 0 && maxGainValue !== null
    ? ((maxGainValue - cdiReturn) / cdiReturn) * 100
    : null;

  const items = [
    {
      title: 'Custo Líquido',
      value: `R$ ${metrics.netCost.toFixed(2)}`,
      icon: DollarSign,
      color: 'text-muted-foreground',
      tip: 'Valor líquido recebido (positivo) ou pago (negativo) ao montar a estrutura.',
    },
    {
      title: 'Lucro Máximo',
      value: metrics.maxGain === 'Ilimitado' ? '∞' : `R$ ${Number(metrics.maxGain).toFixed(2)}`,
      icon: TrendingUp,
      color: 'text-success',
      tip: 'Maior lucro possível no vencimento, considerando todos os cenários de preço do ativo.',
    },
    {
      title: 'Risco Máximo',
      value: metrics.maxLoss === 'Ilimitado' ? '∞' : `R$ ${Number(metrics.maxLoss).toFixed(2)}`,
      icon: TrendingDown,
      color: 'text-destructive',
      tip: 'Maior prejuízo possível no vencimento. Valores positivos indicam perda absoluta.',
    },
    {
      title: 'Breakeven',
      value: metrics.breakevens.length > 0 ? metrics.breakevens.map(b => `R$ ${b.toFixed(2)}`).join(' | ') : 'N/A',
      icon: Target,
      color: 'text-warning',
      tip: 'Preço do ativo onde a operação não dá lucro nem prejuízo.',
    },
    {
      title: 'Eficiência vs CDI',
      value: efficiency === null ? 'N/A' : `${efficiency.toFixed(1)}%`,
      icon: Percent,
      color: efficiency !== null && efficiency >= 0 ? 'text-success' : 'text-destructive',
      tip: 'Comparativo entre o lucro máximo e o rendimento estimado do CDI no mesmo período.',
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {items.map(item => (
        <Tooltip key={item.title}>
          <TooltipTrigger asChild>
            <Card className="cursor-help transition-colors hover:border-primary/30 bg-muted/20 border-border/60">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">{item.title}</CardTitle>
                <item.icon className={`h-4 w-4 ${item.color}`} />
              </CardHeader>
              <CardContent>
                <p className={`text-lg font-bold font-mono ${item.color}`}>{item.value}</p>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent className="max-w-[250px]"><p>{item.tip}</p></TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
