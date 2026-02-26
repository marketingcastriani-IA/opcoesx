import { AnalysisMetrics } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Target, DollarSign, Percent, Shield } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

interface MetricsCardsProps {
  metrics: AnalysisMetrics;
  cdiReturn?: number;
  daysToExpiry?: number;
}

export default function MetricsCards({ metrics, cdiReturn = 0 }: MetricsCardsProps) {
  const isCollar = !!metrics.strategyType;
  const montageValue = isCollar ? metrics.montageTotal ?? 0 : metrics.netCost;
  const breakeven = isCollar && metrics.realBreakeven ? metrics.realBreakeven : null;

  const maxGainValue = isCollar
    ? (typeof metrics.maxGain === 'number' ? metrics.maxGain : null)
    : (metrics.maxGain === 'Ilimitado' ? null : Number(metrics.maxGain));

  const maxLossValue = isCollar
    ? (typeof metrics.maxLoss === 'number' ? metrics.maxLoss : null)
    : (metrics.maxLoss === 'Ilimitado' ? null : Number(metrics.maxLoss));

  const efficiency = cdiReturn > 0 && maxGainValue !== null && maxGainValue > 0
    ? (maxGainValue / cdiReturn) * 100
    : null;

  const items = [
    {
      title: isCollar ? 'Custo de Montagem' : 'Custo Líquido',
      value: `R$ ${montageValue.toFixed(2)}`,
      icon: DollarSign,
      color: 'text-muted-foreground',
      tip: isCollar
        ? 'Desembolso total: (Ativo + Put - Call) × Qtd'
        : 'Valor líquido recebido (+) ou pago (-) ao montar a estrutura.',
      badge: null as string | null,
    },
    {
      title: 'Lucro Máximo',
      value: maxGainValue !== null ? `R$ ${maxGainValue.toFixed(2)}` : '∞',
      icon: TrendingUp,
      color: 'text-success',
      tip: isCollar
        ? '(Strike Call - Breakeven) × Qtd'
        : 'Maior lucro possível no vencimento.',
      badge: null,
    },
    {
      title: 'Risco Máximo',
      value: metrics.isRiskFree
        ? 'R$ 0,00'
        : (maxLossValue !== null ? `R$ ${maxLossValue.toFixed(2)}` : '∞'),
      icon: metrics.isRiskFree ? Shield : TrendingDown,
      color: metrics.isRiskFree ? 'text-success' : 'text-destructive',
      tip: metrics.isRiskFree
        ? 'Strike da Put > Breakeven: lucro garantido em qualquer cenário.'
        : isCollar
          ? '(Breakeven - Strike Put) × Qtd'
          : 'Maior prejuízo possível no vencimento.',
      badge: metrics.isRiskFree ? 'RISCO ZERO' : null,
    },
    {
      title: isCollar ? 'Breakeven Real' : 'Breakeven',
      value: breakeven
        ? `R$ ${breakeven.toFixed(2)}`
        : (metrics.breakevens.length > 0
          ? metrics.breakevens.map(b => `R$ ${b.toFixed(2)}`).join(' | ')
          : 'N/A'),
      icon: Target,
      color: 'text-warning',
      tip: isCollar
        ? 'Custo Total de Montagem ÷ Quantidade'
        : 'Preço do ativo onde a operação não dá lucro nem prejuízo.',
      badge: null,
    },
    {
      title: 'Eficiência vs CDI',
      value: efficiency !== null ? `${efficiency.toFixed(0)}% do CDI` : 'N/A',
      icon: Percent,
      color: efficiency !== null && efficiency >= 100 ? 'text-success' : 'text-destructive',
      tip: 'Lucro máximo da estrutura como % do rendimento CDI no mesmo período.',
      badge: efficiency !== null && efficiency >= 100 ? 'VENCE O CDI' : null,
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
                {item.badge && (
                  <Badge variant="default" className="mt-1 text-[10px] bg-success text-success-foreground">
                    {item.badge}
                  </Badge>
                )}
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent className="max-w-[250px]"><p>{item.tip}</p></TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
