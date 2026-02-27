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
  const hasStrategy = !!metrics.strategyType;
  const isCoveredCall = metrics.strategyType === 'CoveredCall';
  const isCollar = metrics.strategyType === 'Collar';
  const isBullCallSpread = metrics.strategyType === 'BullCallSpread';
  const isBearPutSpread = metrics.strategyType === 'BearPutSpread';

  // Custo de montagem: para estratégias detectadas usa montageTotal, senão netCost
  const montageValue = hasStrategy
    ? (metrics.montageTotal ?? metrics.netCost)
    : metrics.netCost;

  // Breakeven: usa o breakeven real da estratégia se disponível
  const breakeven = hasStrategy && metrics.realBreakeven != null
    ? (Array.isArray(metrics.realBreakeven) ? metrics.realBreakeven : [metrics.realBreakeven])
    : null;

  // Lucro máximo
  const maxGainValue = metrics.maxGain === 'Ilimitado'
    ? null
    : (typeof metrics.maxGain === 'number' ? metrics.maxGain : null);

  // Risco máximo
  const maxLossValue = metrics.maxLoss === 'Ilimitado'
    ? null
    : (typeof metrics.maxLoss === 'number' ? metrics.maxLoss : null);

  // Eficiência vs CDI
  const efficiency = cdiReturn > 0 && maxGainValue !== null && maxGainValue > 0
    ? (maxGainValue / cdiReturn) * 100
    : null;

  // Rótulos dinâmicos por estratégia
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
    ? '(Strike Call - Breakeven) × Qtd — ganho limitado pelo strike da call vendida'
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
    ? 'Preço do ativo onde a operação não dá lucro nem prejuízo: Custo de Montagem ÷ Qtd'
    : isCollar
      ? 'Custo Total de Montagem ÷ Quantidade'
      : isBullCallSpread
        ? 'Strike da Call Comprada + Débito Líquido por ação'
        : isBearPutSpread
          ? 'Strike da Put Comprada - Débito Líquido por ação'
          : 'Preço do ativo onde a operação não dá lucro nem prejuízo.';

  // Removed: legs is not part of AnalysisMetrics
  const assetPrice = 0;
  const assetName = '';

  const items = [
    ...(assetPrice > 0 ? [{
      title: `PRECO DO ATIVO (${assetName})`,
      value: `R$ ${assetPrice.toFixed(2)}`,
      icon: DollarSign,
      color: 'text-primary',
      glowColor: 'shadow-[0_0_30px_-8px_hsl(var(--primary)/0.4)]',
      tip: `Preco unitario da acao ${assetName} na montagem da estrutura.`,
      badge: 'BASE',
      badgeColor: 'bg-primary/25 text-primary border-primary/40',
    }] : []),
    {
      title: costLabel,
      value: `R$ ${Math.abs(montageValue).toFixed(2)}`,
      icon: DollarSign,
      color: 'text-muted-foreground',
      glowColor: '',
      tip: costTip,
      badge: null as string | null,
      badgeColor: '',
    },
    {
      title: 'Lucro Máximo',
      value: maxGainValue !== null ? `R$ ${maxGainValue.toFixed(2)}` : '∞',
      icon: TrendingUp,
      color: 'text-success',
      glowColor: 'shadow-[0_0_20px_-4px_hsl(var(--success)/0.3)]',
      tip: maxGainTip,
      badge: null,
      badgeColor: '',
    },
    {
      title: 'Risco Máximo',
      value: metrics.isRiskFree
        ? 'R$ 0,00'
        : (maxLossValue !== null ? `R$ ${Math.abs(maxLossValue).toFixed(2)}` : '∞'),
      icon: metrics.isRiskFree ? Shield : TrendingDown,
      color: metrics.isRiskFree ? 'text-success' : 'text-destructive',
      glowColor: metrics.isRiskFree
        ? 'shadow-[0_0_20px_-4px_hsl(var(--success)/0.3)]'
        : 'shadow-[0_0_20px_-4px_hsl(var(--destructive)/0.3)]',
      tip: maxLossTip,
      badge: metrics.isRiskFree ? 'RISCO ZERO' : null,
      badgeColor: 'bg-success text-success-foreground',
    },
    {
      title: breakevenLabel,
      value: breakeven !== null
        ? breakeven.map(b => `R$ ${b.toFixed(2)}`).join(' | ')
        : (metrics.breakevens.length > 0
          ? metrics.breakevens.map(b => `R$ ${b.toFixed(2)}`).join(' | ')
          : 'N/A'),
      icon: Target,
      color: 'text-warning',
      glowColor: 'shadow-[0_0_20px_-4px_hsl(var(--warning)/0.3)]',
      tip: breakevenTip,
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
