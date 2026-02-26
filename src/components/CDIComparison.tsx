import { useMemo, useState } from 'react';
import { calculateCDIReturn } from '@/lib/payoff';
import { AnalysisMetrics } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface CDIComparisonProps {
  metrics: AnalysisMetrics;
  cdiRate: number;
  setCdiRate: (v: number) => void;
  daysToExpiry: number;
  setDaysToExpiry: (v: number) => void;
}

const formatMoney = (value: number) => `R$ ${value.toFixed(2)}`;

export default function CDIComparison({ metrics, cdiRate, setCdiRate, daysToExpiry, setDaysToExpiry }: CDIComparisonProps) {
  const [applyIRCDI, setApplyIRCDI] = useState(false);
  const [applyIROptions, setApplyIROptions] = useState(false);

  const investedCapital = Math.max(Math.abs(metrics.netCost), 100);
  const cdiReturn = calculateCDIReturn(investedCapital, cdiRate, daysToExpiry, applyIRCDI);

  const optionMaxGainRaw = typeof metrics.maxGain === 'number' ? metrics.maxGain : Number.POSITIVE_INFINITY;
  const optionMaxLossRaw = typeof metrics.maxLoss === 'number' ? metrics.maxLoss : Number.NEGATIVE_INFINITY;

  const optionMaxGain = Number.isFinite(optionMaxGainRaw)
    ? (applyIROptions ? optionMaxGainRaw * 0.85 : optionMaxGainRaw)
    : optionMaxGainRaw;

  const optionMaxLoss = Number.isFinite(optionMaxLossRaw)
    ? (applyIROptions ? optionMaxLossRaw * 0.85 : optionMaxLossRaw)
    : optionMaxLossRaw;

  const comparison = useMemo(() => {
    if (cdiRate <= 0 || daysToExpiry <= 0) return null;

    const optionBetter = Number.isFinite(optionMaxGain) && optionMaxGain > cdiReturn;
    const spread = Number.isFinite(optionMaxGain) ? optionMaxGain - cdiReturn : Number.POSITIVE_INFINITY;

    let verdict = 'Dados insuficientes para concluir.';
    if (!Number.isFinite(optionMaxGain)) {
      verdict = 'Estrutura com ganho potencial ilimitado: avalie o risco antes de comparar apenas por retorno.';
    } else if (!Number.isFinite(optionMaxLoss)) {
      verdict = optionBetter
        ? 'Retorno potencial maior que CDI, mas risco de perda ilimitada: estratégia agressiva.'
        : 'Mesmo sem teto de perda, o retorno não supera o CDI no cenário máximo informado.';
    } else if (optionBetter && Math.abs(optionMaxLoss) <= optionMaxGain) {
      verdict = 'Vale considerar: retorno máximo supera CDI com relação risco/retorno aceitável.';
    } else if (optionBetter) {
      verdict = 'Pode valer a pena, mas o risco máximo é elevado para o retorno projetado.';
    } else {
      verdict = 'No cenário informado, CDI está mais competitivo que a estrutura.';
    }

    return { optionBetter, spread, verdict };
  }, [cdiRate, daysToExpiry, cdiReturn, optionMaxGain, optionMaxLoss]);

  const cdiRoi = investedCapital > 0 ? (cdiReturn / investedCapital) * 100 : 0;
  const optionRoi = Number.isFinite(optionMaxGain) && investedCapital > 0 ? (optionMaxGain / investedCapital) * 100 : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Comparativo completo: Estratégia vs CDI</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs">Taxa CDI (% a.a.)</Label>
            <Input type="number" step="0.01" value={cdiRate || ''} onChange={e => setCdiRate(parseFloat(e.target.value) || 0)} placeholder="13.65" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Dias até vencimento</Label>
            <Input type="number" min={1} value={daysToExpiry || ''} onChange={e => setDaysToExpiry(parseInt(e.target.value) || 0)} placeholder="30" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Capital base da comparação</Label>
            <Input value={formatMoney(investedCapital)} readOnly className="font-mono" />
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={applyIRCDI} onCheckedChange={setApplyIRCDI} id="ir-cdi-switch" />
            <Label htmlFor="ir-cdi-switch" className="text-xs">Aplicar IR no CDI</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={applyIROptions} onCheckedChange={setApplyIROptions} id="ir-opcoes-switch" />
            <Label htmlFor="ir-opcoes-switch" className="text-xs">Aplicar IR nas opções (simplificado)</Label>
          </div>
        </div>

        {cdiRate > 0 && daysToExpiry > 0 && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground mb-1">Retorno CDI</p>
                <p className="text-lg font-bold font-mono">{formatMoney(cdiReturn)}</p>
                <p className="text-xs text-muted-foreground">ROI: {cdiRoi.toFixed(2)}%</p>
              </div>

              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground mb-1">Ganho máximo da estrutura</p>
                <p className="text-lg font-bold font-mono text-success">
                  {Number.isFinite(optionMaxGain) ? formatMoney(optionMaxGain) : 'Ilimitado'}
                </p>
                <p className="text-xs text-muted-foreground">
                  ROI: {optionRoi !== null ? `${optionRoi.toFixed(2)}%` : 'Ilimitado'}
                </p>
              </div>

              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground mb-1">Perda máxima da estrutura</p>
                <p className="text-lg font-bold font-mono text-destructive">
                  {Number.isFinite(optionMaxLoss) ? formatMoney(optionMaxLoss) : 'Ilimitada'}
                </p>
              </div>

              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground mb-1">Breakeven(s)</p>
                <p className="text-sm font-mono">
                  {metrics.breakevens.length > 0
                    ? metrics.breakevens.map(v => v.toFixed(2)).join(' | ')
                    : 'N/A'}
                </p>
              </div>
            </div>

            {comparison && (
              <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                {/* Highlight % difference */}
                <div className="text-center">
                  {optionRoi !== null && Number.isFinite(optionRoi) ? (
                    <div className={`text-3xl font-extrabold ${optionRoi - cdiRoi >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {optionRoi - cdiRoi >= 0 ? '+' : ''}{(optionRoi - cdiRoi).toFixed(2)}%
                      <span className="text-sm font-medium ml-1">vs CDI</span>
                    </div>
                  ) : (
                    <div className="text-3xl font-extrabold text-success">
                      ∞ <span className="text-sm font-medium ml-1">potencial ilimitado vs CDI</span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Estrutura: {optionRoi !== null ? `${optionRoi.toFixed(2)}%` : '∞'} ROI | CDI: {cdiRoi.toFixed(2)}% ROI
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Diferença: {Number.isFinite(comparison.spread)
                      ? `${comparison.spread >= 0 ? '+' : ''}${formatMoney(comparison.spread)}`
                      : 'Acima do CDI'}
                  </p>
                  <p className="text-sm font-medium mt-1">{comparison.verdict}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

