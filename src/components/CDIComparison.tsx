import { useMemo, useState, useEffect } from 'react';
import { calculateCDIReturn } from '@/lib/payoff';
import { AnalysisMetrics } from '@/lib/types';
import { getExpiryOptions } from '@/lib/b3-calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { countBusinessDays } from '@/lib/b3-calendar';

interface CDIComparisonProps {
  metrics: AnalysisMetrics;
  cdiRate: number;
  setCdiRate: (v: number) => void;
  daysToExpiry: number;
  setDaysToExpiry: (v: number) => void;
}

const formatMoney = (value: number) => `R$ ${value.toFixed(2)}`;

const parseDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const calculateDaysFromDate = (value: string) => {
  if (!value) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return countBusinessDays(today, parseDate(value));
};

export default function CDIComparison({ metrics, cdiRate, setCdiRate, daysToExpiry, setDaysToExpiry }: CDIComparisonProps) {
  const [applyIRCDI, setApplyIRCDI] = useState(false);
  const [applyIROptions, setApplyIROptions] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const expiryOptions = useMemo(() => getExpiryOptions(selectedYear), [selectedYear]);

  const isCollar = !!metrics.strategyType;
  const investedCapital = isCollar && metrics.montageTotal
    ? Math.abs(metrics.montageTotal)
    : Math.max(Math.abs(metrics.netCost), 100);

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
    const efficiency = cdiReturn > 0 && Number.isFinite(optionMaxGain)
      ? (optionMaxGain / cdiReturn) * 100
      : null;

    let verdict = 'Dados insuficientes para concluir.';
    if (metrics.isRiskFree && optionBetter) {
      verdict = 'Estrutura com risco zero e retorno acima do CDI. Excelente oportunidade.';
    } else if (!Number.isFinite(optionMaxGain)) {
      verdict = 'Estrutura com ganho potencial ilimitado: avalie o risco antes de comparar.';
    } else if (optionBetter) {
      verdict = 'Retorno máximo supera o CDI no período.';
    } else {
      verdict = 'No cenário informado, CDI está mais competitivo que a estrutura.';
    }

    return { optionBetter, spread, verdict, efficiency };
  }, [cdiRate, daysToExpiry, cdiReturn, optionMaxGain, optionMaxLoss, metrics.isRiskFree]);

  const cdiRoi = investedCapital > 0 ? (cdiReturn / investedCapital) * 100 : 0;
  const optionRoi = Number.isFinite(optionMaxGain) && investedCapital > 0 ? (optionMaxGain / investedCapital) * 100 : null;

  const handleExpiryChange = (value: string) => {
    setExpiryDate(value);
    setDaysToExpiry(calculateDaysFromDate(value));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          Comparativo: Estratégia vs CDI
          {comparison?.efficiency !== null && comparison?.efficiency !== undefined && (
            <Badge
              variant={comparison.efficiency >= 100 ? 'default' : 'destructive'}
              className={comparison.efficiency >= 100 ? 'bg-success text-success-foreground' : ''}
            >
              {comparison.efficiency.toFixed(0)}% do CDI
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs">Taxa CDI (% a.a.)</Label>
            <Input type="number" step="0.01" value={cdiRate || ''} onChange={e => setCdiRate(parseFloat(e.target.value) || 0)} placeholder="14.90" className="font-mono" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Dias úteis até vencimento</Label>
            <Input type="number" min={1} value={daysToExpiry || ''} onChange={e => setDaysToExpiry(parseInt(e.target.value) || 0)} placeholder="30" className="font-mono" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ano</Label>
            <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0, 1, 2].map(offset => {
                  const y = new Date().getFullYear() + offset;
                  return <SelectItem key={y} value={String(y)}>{y}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Vencimento B3</Label>
            <Select value={expiryDate} onValueChange={handleExpiryChange}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {expiryOptions.map(item => (
                  <SelectItem key={item.date} value={item.date}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Capital investido</Label>
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
            <Label htmlFor="ir-opcoes-switch" className="text-xs">Aplicar IR nas opções</Label>
          </div>
        </div>

        {cdiRate > 0 && daysToExpiry > 0 && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border p-3 bg-muted/20">
                <p className="text-xs text-muted-foreground mb-1">Retorno CDI</p>
                <p className="text-lg font-bold font-mono">{formatMoney(cdiReturn)}</p>
                <p className="text-xs text-muted-foreground font-mono">ROI: {cdiRoi.toFixed(2)}%</p>
              </div>

              <div className="rounded-lg border p-3 bg-muted/20">
                <p className="text-xs text-muted-foreground mb-1">Ganho máximo da estrutura</p>
                <p className="text-lg font-bold font-mono text-success">
                  {Number.isFinite(optionMaxGain) ? formatMoney(optionMaxGain) : 'Ilimitado'}
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  ROI: {optionRoi !== null ? `${optionRoi.toFixed(2)}%` : '∞'}
                </p>
              </div>

              <div className="rounded-lg border p-3 bg-muted/20">
                <p className="text-xs text-muted-foreground mb-1">Perda máxima da estrutura</p>
                <p className={`text-lg font-bold font-mono ${metrics.isRiskFree ? 'text-success' : 'text-destructive'}`}>
                  {metrics.isRiskFree ? 'Risco Zero' : (Number.isFinite(optionMaxLoss) ? formatMoney(optionMaxLoss) : 'Ilimitada')}
                </p>
              </div>

              <div className="rounded-lg border p-3 bg-muted/20">
                <p className="text-xs text-muted-foreground mb-1">Breakeven</p>
                <p className="text-sm font-mono">
                  {metrics.realBreakeven
                    ? `R$ ${metrics.realBreakeven.toFixed(2)}`
                    : (metrics.breakevens.length > 0
                      ? metrics.breakevens.map(v => `R$ ${v.toFixed(2)}`).join(' | ')
                      : 'N/A')}
                </p>
              </div>
            </div>

            {comparison && (
              <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                <div className="text-center">
                  {comparison.efficiency !== null ? (
                    <div className={`text-3xl font-extrabold font-mono ${comparison.efficiency >= 100 ? 'text-success' : 'text-destructive'}`}>
                      {comparison.efficiency.toFixed(0)}%
                      <span className="text-sm font-medium ml-1">do CDI</span>
                    </div>
                  ) : (
                    <div className="text-3xl font-extrabold text-success font-mono">
                      ∞ <span className="text-sm font-medium ml-1">potencial ilimitado</span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1 font-mono">
                    Estrutura: {optionRoi !== null ? `${optionRoi.toFixed(2)}%` : '∞'} ROI | CDI: {cdiRoi.toFixed(2)}% ROI
                  </p>
                </div>
                <p className="text-sm font-medium text-center">{comparison.verdict}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
