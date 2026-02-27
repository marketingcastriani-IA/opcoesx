import { AnalysisMetrics } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Target, DollarSign, Percent, Shield } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface MetricsCardsProps {
  metrics: AnalysisMetrics;
  cdiReturn?: number;
  daysToExpiry?: number;
}

export default function MetricsCards({ metrics, cdiReturn = 0 }: MetricsCardsProps) {
  const hasStrategy = !!metrics.strategyType;
  const isCoveredCall = metrics.strategyType === 'CoveredCall';
  const isCollar = metrics.strategyType === 'Collar';
  const isBullCallSpread = metrics.strategyType === 'BullCallSpread';
  const isBearPutSpread = metrics.strategyType === 'BearPutSpread';

  const montageValue = hasStrategy
    ? (metrics.montageTotal ?? metrics.netCost)
    : metrics.netCost;

  const breakeven = hasStrategy && metrics.realBreakeven != null
    ? (Array.isArray(metrics.realBreakeven) ? metrics.realBreakeven : [metrics.realBreakeven])
    : null;

  const maxGainValue = metrics.maxGain === 'Ilimitado'
    ? null
    : (typeof metrics.maxGain === 'number' ? metrics.maxGain : null);

  const maxLossValue = metrics.maxLoss === 'Ilimitado'
    ? null
    : (typeof metrics.maxLoss === 'number' ? metrics.maxLoss : null);

  const efficiency = cdiReturn > 0 && maxGainValue !== null && maxGainValue > 0
    ? (maxGainValue / cdiReturn) * 100
    : null;

  const costLabel = isCoveredCall || isCollar || isBullCallSpread || isBearPutSpread
    ? 'Custo de Montagem'
    : 'Custo Líquido';

  const costTip = isCoveredCall
    ? 'Desembolso total: (Preço Ativo - Prêmio Call) × Qtd'
    : isCollar
      ? 'Desembolso total: (Ativo + Put - Call) × Qtd'
      : isBullCallSpread
        ? 'Débito líquido: (Prêmio Call Comprada - Prêmio Call Vendida) × Qtd'
        : isBearPutSpread
          ? 'Débito líquido: (Prêmio Put Comprada - Prêmio Put Vendida) × Qtd'
          : 'Valor líquido recebido (+) ou pago (-) ao montar a estrutura.';

  const maxGainTip = isCoveredCall
    ? '(Strike Call - Breakeven) × Qtd'
    : isCollar
      ? '(Strike Call - Breakeven) × Qtd'
      : isBullCallSpread
        ? '(Strike Call Vendida - Strike Call Comprada - Débito Líquido por ação) × Qtd'
        : isBearPutSpread
          ? '(Strike Put Comprada - Strike Put Vendida - Débito Líquido por ação) × Qtd'
          : 'Maior lucro possível no vencimento.';

  const maxLossTip = metrics.isRiskFree
    ? 'Strike da Put ≥ Breakeven: lucro garantido em qualquer cenário.'
    : isCoveredCall
      ? 'Custo de montagem total (ativo vai a zero)'
      : isCollar
        ? '(Breakeven - Strike Put) × Qtd'
        : isBullCallSpread
          ? 'Débito Líquido Total'
          : isBearPutSpread
            ? 'Débito Líquido Total'
            : 'Maior prejuízo possível no vencimento.';

  const breakevenLabel = hasStrategy ? 'Breakeven Real' : 'Breakeven';
  const breakevenTip = isCoveredCall
    ? 'Preço do ativo onde a operação não dá lucro nem prejuízo'
    : isCollar
      ? 'Custo Total de Montagem ÷ Quantidade'
      : isBullCallSpread
        ? 'Strike da Call Comprada + Débito Líquido por ação'
        : isBearPutSpread
          ? 'Strike da Put Comprada - Débito Líquido por ação'
          : 'Preço do ativo onde a operação não dá lucro nem prejuízo.';

  type CardTheme = 'blue' | 'green' | 'red' | 'yellow' | 'white' | 'purple';

  const themeClasses: Record<CardTheme, { card: string; icon: string; text: string; badge: string }> = {
    blue: {
      card: 'border-info/30 bg-gradient-to-br from-info/10 via-card to-card hover:border-info/50 hover:shadow-[0_0_30px_-8px_hsl(var(--info)/0.35)]',
      icon: 'bg-info/15 text-info',
      text: 'text-info',
      badge: 'bg-info/20 text-info border-info/40',
    },
    green: {
      card: 'border-success/30 bg-gradient-to-br from-success/10 via-card to-card hover:border-success/50 hover:shadow-[0_0_30px_-8px_hsl(var(--success)/0.35)]',
      icon: 'bg-success/15 text-success',
      text: 'text-success',
      badge: 'bg-success text-success-foreground',
    },
    red: {
      card: 'border-destructive/30 bg-gradient-to-br from-destructive/10 via-card to-card hover:border-destructive/50 hover:shadow-[0_0_30px_-8px_hsl(var(--destructive)/0.35)]',
      icon: 'bg-destructive/15 text-destructive',
      text: 'text-destructive',
      badge: 'bg-destructive text-destructive-foreground',
    },
    yellow: {
      card: 'border-warning/30 bg-gradient-to-br from-warning/10 via-card to-card hover:border-warning/50 hover:shadow-[0_0_30px_-8px_hsl(var(--warning)/0.35)]',
      icon: 'bg-warning/15 text-warning',
      text: 'text-warning',
      badge: 'bg-warning text-warning-foreground',
    },
    white: {
      card: 'border-border/50 bg-gradient-to-br from-foreground/5 via-card to-card hover:border-border hover:shadow-[0_0_30px_-8px_hsl(var(--foreground)/0.15)]',
      icon: 'bg-muted text-muted-foreground',
      text: 'text-muted-foreground',
      badge: 'bg-muted text-muted-foreground',
    },
    purple: {
      card: 'border-accent/30 bg-gradient-to-br from-accent/10 via-card to-card hover:border-accent/50 hover:shadow-[0_0_30px_-8px_hsl(var(--accent)/0.35)]',
      icon: 'bg-accent/15 text-accent',
      text: 'text-accent',
      badge: 'bg-accent/20 text-accent border-accent/40',
    },
  };

  const items: {
    title: string;
    value: string;
    icon: typeof DollarSign;
    theme: CardTheme;
    tip: string;
    badge?: string | null;
  }[] = [
    {
      title: costLabel,
      value: `R$ ${Math.abs(montageValue).toFixed(2)}`,
      icon: DollarSign,
      theme: 'white',
      tip: costTip,
    },
    {
      title: 'Lucro Máximo',
      value: maxGainValue !== null ? `R$ ${maxGainValue.toFixed(2)}` : '∞',
      icon: TrendingUp,
      theme: 'green',
      tip: maxGainTip,
    },
    {
      title: 'Risco Máximo',
      value: metrics.isRiskFree
        ? 'R$ 0,00'
        : (maxLossValue !== null ? `R$ ${Math.abs(maxLossValue).toFixed(2)}` : '∞'),
      icon: metrics.isRiskFree ? Shield : TrendingDown,
      theme: metrics.isRiskFree ? 'green' : 'red',
      tip: maxLossTip,
      badge: metrics.isRiskFree ? 'RISCO ZERO' : null,
    },
    {
      title: breakevenLabel,
      value: breakeven !== null
        ? breakeven.map(b => `R$ ${b.toFixed(2)}`).join(' | ')
        : (metrics.breakevens.length > 0
          ? metrics.breakevens.map(b => `R$ ${b.toFixed(2)}`).join(' | ')
          : 'N/A'),
      icon: Target,
      theme: 'yellow',
      tip: breakevenTip,
    },
    {
      title: 'Eficiência vs CDI',
      value: efficiency !== null ? `${efficiency.toFixed(0)}%` : 'N/A',
      icon: Percent,
      theme: efficiency !== null && efficiency >= 100 ? 'blue' : 'purple',
      tip: 'Lucro máximo da estrutura como % do rendimento CDI no mesmo período.',
      badge: efficiency !== null && efficiency >= 100 ? 'VENCE O CDI' : null,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {items.map(item => {
        const t = themeClasses[item.theme];
        return (
          <Tooltip key={item.title}>
            <TooltipTrigger asChild>
              <Card className={cn(
                'cursor-help group relative overflow-hidden transition-all duration-300 hover:scale-[1.02]',
                t.card
              )}>
                <CardContent className="relative p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{item.title}</span>
                    <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg transition-colors', t.icon)}>
                      <item.icon className="h-4 w-4" />
                    </div>
                  </div>
                  <p className={cn('text-xl font-bold font-mono tracking-tight', t.text)}>{item.value}</p>
                  {item.badge && (
                    <Badge className={cn('mt-2 text-[10px] font-semibold tracking-wider animate-pulse', t.badge)}>
                      {item.badge}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent className="max-w-[250px]"><p>{item.tip}</p></TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
