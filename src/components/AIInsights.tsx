import { useMemo } from 'react';
import { AnalysisMetrics } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, TrendingUp, AlertCircle, CheckCircle2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIInsightsProps {
  metrics: AnalysisMetrics;
  suggestion: string;
  cdiReturn?: number;
  daysToExpiry?: number;
  loading?: boolean;
}

export default function AIInsights({ 
  metrics, 
  suggestion, 
  cdiReturn = 0, 
  daysToExpiry = 0,
  loading = false,
}: AIInsightsProps) {
  
  const insights = useMemo(() => {
    const result = [];

    // Análise de Risco
    if (metrics.isRiskFree) {
      result.push({
        type: 'success',
        icon: CheckCircle2,
        title: 'Operação com Risco Zero',
        description: 'Esta estrutura garante lucro em qualquer cenário de preço. Excelente para carteira conservadora.',
        badge: 'SEGURA',
      });
    } else if (typeof metrics.maxLoss === 'number' && metrics.maxLoss < 0) {
      const riskPercent = cdiReturn > 0 ? Math.abs((metrics.maxLoss / cdiReturn) * 100) : 0;
      result.push({
        type: 'warning',
        icon: AlertCircle,
        title: 'Risco Limitado',
        description: `Perda máxima é R$ ${Math.abs(metrics.maxLoss).toFixed(2)}, equivalente a ${riskPercent.toFixed(0)}% do retorno CDI.`,
        badge: 'CONTROLADO',
      });
    } else if (metrics.maxLoss === 'Ilimitado') {
      result.push({
        type: 'destructive',
        icon: AlertCircle,
        title: 'Risco Ilimitado',
        description: 'Esta estrutura possui risco potencial ilimitado. Use com cautela e sempre com stop-loss.',
        badge: 'ALTO RISCO',
      });
    }

    // Análise de Ganho
    if (typeof metrics.maxGain === 'number' && cdiReturn > 0) {
      const efficiency = (metrics.maxGain / cdiReturn) * 100;
      if (efficiency >= 150) {
        result.push({
          type: 'success',
          icon: TrendingUp,
          title: 'Ganho Excepcional',
          description: `Retorno máximo é ${efficiency.toFixed(0)}% do CDI. Estrutura muito atrativa.`,
          badge: 'EXCELENTE',
        });
      } else if (efficiency >= 100) {
        result.push({
          type: 'success',
          icon: TrendingUp,
          title: 'Supera o CDI',
          description: `Retorno máximo é ${efficiency.toFixed(0)}% do CDI. Melhor que renda fixa.`,
          badge: 'VANTAJOSA',
        });
      } else {
        result.push({
          type: 'warning',
          icon: AlertCircle,
          title: 'Abaixo do CDI',
          description: `Retorno máximo é apenas ${efficiency.toFixed(0)}% do CDI. Considere renda fixa.`,
          badge: 'REVISAR',
        });
      }
    }

    // Análise de Estratégia
    if (metrics.strategyType) {
      const strategyInsights: Record<string, string> = {
        CoveredCall: 'Estratégia defensiva: ganho limitado, mas protegido por prêmio. Ideal para mercado lateral.',
        Collar: 'Estratégia de proteção: ganho limitado, risco controlado. Excelente para proteger posição.',
        BullCallSpread: 'Estratégia otimista: ganho limitado, risco controlado. Use quando espera alta moderada.',
        BearPutSpread: 'Estratégia defensiva: ganho limitado, risco controlado. Use quando espera estabilidade.',
      };

      if (strategyInsights[metrics.strategyType]) {
        result.push({
          type: 'primary',
          icon: Zap,
          title: `${metrics.strategyLabel || metrics.strategyType}`,
          description: strategyInsights[metrics.strategyType],
          badge: 'ESTRATÉGIA',
        });
      }
    }

    return result;
  }, [metrics, cdiReturn]);

  const typeColors = {
    success: 'from-success/10 to-success/5 border-success/20',
    warning: 'from-warning/10 to-warning/5 border-warning/20',
    destructive: 'from-destructive/10 to-destructive/5 border-destructive/20',
    primary: 'from-primary/10 to-primary/5 border-primary/20',
  };

  const badgeColors = {
    success: 'bg-success/20 text-success hover:bg-success/30',
    warning: 'bg-warning/20 text-warning hover:bg-warning/30',
    destructive: 'bg-destructive/20 text-destructive hover:bg-destructive/30',
    primary: 'bg-primary/20 text-primary hover:bg-primary/30',
  };

  return (
    <div className="space-y-4">
      {/* IA Suggestion Card */}
      <Card className="relative overflow-hidden border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card shadow-[0_0_40px_-8px_hsl(var(--primary)/0.2)]">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16" />
        
        <CardHeader className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-xl">Análise da IA</CardTitle>
          </div>
        </CardHeader>

        <CardContent className="relative space-y-4">
          {loading ? (
            <div className="flex items-center gap-3 py-4">
              <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
              <p className="text-sm text-muted-foreground">Analisando estrutura...</p>
            </div>
          ) : suggestion ? (
            <div className="space-y-3">
              <p className="text-base leading-relaxed text-foreground">{suggestion}</p>
              <div className="pt-2 border-t border-primary/10">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Período de análise: {daysToExpiry} dias úteis
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">Clique em "Sugestão IA" para obter uma análise.</p>
          )}
        </CardContent>
      </Card>

      {/* Insights Grid */}
      {insights.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {insights.map((insight, idx) => {
            const Icon = insight.icon;
            const bgClass = typeColors[insight.type as keyof typeof typeColors];
            const badgeClass = badgeColors[insight.type as keyof typeof badgeColors];

            return (
              <Card
                key={idx}
                className={cn(
                  'relative overflow-hidden border transition-all duration-300 hover:shadow-[0_10px_30px_-8px_hsl(var(--primary)/0.15)]',
                  `bg-gradient-to-br ${bgClass}`
                )}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50">
                      <Icon className={cn(
                        'h-4 w-4',
                        insight.type === 'success' && 'text-success',
                        insight.type === 'warning' && 'text-warning',
                        insight.type === 'destructive' && 'text-destructive',
                        insight.type === 'primary' && 'text-primary',
                      )} />
                    </div>
                    <Badge className={badgeClass} variant="secondary" style={{ fontSize: '0.65rem' }}>
                      {insight.badge}
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <h3 className="font-semibold text-sm leading-tight">{insight.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{insight.description}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
