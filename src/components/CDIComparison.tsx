import { useState } from 'react';
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

export default function CDIComparison({ metrics, cdiRate, setCdiRate, daysToExpiry, setDaysToExpiry }: CDIComparisonProps) {
  const [withIR, setWithIR] = useState(false);

  const investedCapital = Math.abs(metrics.netCost) || 100;
  const cdiReturn = calculateCDIReturn(investedCapital, cdiRate, daysToExpiry, withIR);
  const optionReturn = typeof metrics.maxGain === 'number' ? metrics.maxGain : investedCapital * 2;
  const optionReturnWithIR = withIR ? optionReturn * 0.85 : optionReturn; // 15% IR simplificado para opções

  const winner = optionReturnWithIR > cdiReturn ? 'Opções' : 'CDI';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Comparativo com CDI</CardTitle>
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
          <div className="flex items-end gap-2 pb-1">
            <Switch checked={withIR} onCheckedChange={setWithIR} id="ir-switch" />
            <Label htmlFor="ir-switch" className="text-xs">Com IR</Label>
          </div>
        </div>

        {cdiRate > 0 && daysToExpiry > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground mb-1">Retorno CDI {withIR ? '(líq. IR)' : '(bruto)'}</p>
              <p className="text-lg font-bold font-mono">R$ {cdiReturn.toFixed(2)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground mb-1">Ganho Máx. Opções {withIR ? '(líq. IR)' : ''}</p>
              <p className="text-lg font-bold font-mono">R$ {optionReturnWithIR.toFixed(2)}</p>
            </div>
            <div className="sm:col-span-2 rounded-lg bg-muted p-3 text-center">
              <p className="text-sm">
                Vantagem: <span className="font-bold text-primary">{winner}</span>
                {winner === 'Opções'
                  ? ` (+R$ ${(optionReturnWithIR - cdiReturn).toFixed(2)})`
                  : ` (+R$ ${(cdiReturn - optionReturnWithIR).toFixed(2)})`}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
