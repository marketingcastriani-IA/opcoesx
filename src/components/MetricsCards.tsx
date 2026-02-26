import { AnalysisMetrics } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Target, DollarSign } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface MetricsCardsProps {
  metrics: AnalysisMetrics;
}

export default function MetricsCards({ metrics }: MetricsCardsProps) {
  const items = [
    {
      title: 'Ganho Máximo',
      value: metrics.maxGain === 'Ilimitado' ? '∞' : `R$ ${Number(metrics.maxGain).toFixed(2)}`,
      icon: TrendingUp,
      color: 'text-success',
      tip: 'Maior lucro possível no vencimento, considerando todos os cenários de preço do ativo.',
    },
    {
      title: 'Perda Máxima',
      value: metrics.maxLoss === 'Ilimitado' ? '-∞' : `R$ ${Number(metrics.maxLoss).toFixed(2)}`,
      icon: TrendingDown,
      color: 'text-destructive',
      tip: 'Maior prejuízo possível no vencimento. Valores negativos significam perda.',
    },
    {
      title: 'Breakeven',
      value: metrics.breakevens.length > 0 ? metrics.breakevens.map(b => `R$ ${b.toFixed(2)}`).join(' | ') : 'N/A',
      icon: Target,
      color: 'text-warning',
      tip: 'Preço do ativo onde a operação não dá lucro nem prejuízo.',
    },
    {
      title: 'Custo Líquido',
      value: `R$ ${metrics.netCost.toFixed(2)}`,
      icon: DollarSign,
      color: 'text-muted-foreground',
      tip: 'Valor líquido recebido (positivo) ou pago (negativo) ao montar a estrutura.',
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(item => (
        <Tooltip key={item.title}>
          <TooltipTrigger asChild>
            <Card className="cursor-help transition-colors hover:border-primary/30">
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
