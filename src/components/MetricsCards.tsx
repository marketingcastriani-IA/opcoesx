import { AnalysisMetrics } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
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
      glowColor: '',
      tip: isCollar
        ? 'Desembolso total: (Ativo + Put - Call) × Qtd'
        : 'Valor líquido recebido (+) ou pago (-) ao montar a estrutura.',
      badge: null as string | null,
      badgeColor: '',
    },
    {
      title: 'Lucro Máximo',
      value: maxGainValue !== null ? `R$ ${maxGainValue.toFixed(2)}` : '∞',
      icon: TrendingUp,
      color: 'text-success',
      glowColor: 'shadow-[0_0_20px_-4px_hsl(var(--success)/0.3)]',
      tip: isCollar
        ? '(Strike Call - Breakeven) × Qtd'
        : 'Maior lucro possível no vencimento.',
      badge: null,
      badgeColor: '',
    },
    {
      title: 'Risco Máximo',
      value: metrics.isRiskFree
        ? 'R$ 0,00'
        : (maxLossValue !== null ? `R$ ${maxLossValue.toFixed(2)}` : '∞'),
      icon: metrics.isRiskFree ? Shield : TrendingDown,
      color: metrics.isRiskFree ? 'text-success' : 'text-destructive',
      glowColor: metrics.isRiskFree
        ? 'shadow-[0_0_20px_-4px_hsl(var(--success)/0.3)]'
        : 'shadow-[0_0_20px_-4px_hsl(var(--destructive)/0.3)]',
      tip: metrics.isRiskFree
        ? 'Strike da Put > Breakeven: lucro garantido em qualquer cenário.'
        : isCollar
          ? '(Breakeven - Strike Put) × Qtd'
          : 'Maior prejuízo possível no vencimento.',
      badge: metrics.isRiskFree ? 'RISCO ZERO' : null,
      badgeColor: 'bg-success text-success-foreground',
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
      glowColor: 'shadow-[0_0_20px_-4px_hsl(var(--warning)/0.3)]',
      tip: isCollar
        ? 'Custo Total de Montagem ÷ Quantidade'
        : 'Preço do ativo onde a operação não dá lucro nem prejuízo.',
      badge: null,
      badgeColor: '',
    },
    {
      title: 'Eficiência vs CDI',
      value: efficiency !== null ? `${efficiency.toFixed(0)}%` : 'N/A',
      icon: Percent,
      color: efficiency !== null && efficiency >= 100 ? 'text-success' : 'text-destructive',
      glowColor: efficiency !== null && efficiency >= 100
        ? 'shadow-[0_0_20px_-4px_hsl(var(--success)/0.3)]'
        : '',
      tip: 'Lucro máximo da estrutura como % do rendimento CDI no mesmo período.',
      badge: efficiency !== null && efficiency >= 100 ? 'VENCE O CDI' : null,
      badgeColor: 'bg-success text-success-foreground',
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {items.map(item => (
        <Tooltip key={item.title}>
          <TooltipTrigger asChild>
            <Card className={`cursor-help group relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:border-primary/40 bg-card/50 backdrop-blur-sm border-border/40 ${item.glowColor}`}>
              {/* Subtle gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              <CardContent className="relative p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{item.title}</span>
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50 ${item.color} transition-colors group-hover:bg-muted`}>
                    <item.icon className="h-4 w-4" />
                  </div>
                </div>
                <p className={`text-xl font-bold font-mono tracking-tight ${item.color}`}>{item.value}</p>
                {item.badge && (
                  <Badge className={`mt-2 text-[10px] font-semibold tracking-wider animate-pulse ${item.badgeColor}`}>
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
