import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import PayoffChart from '@/components/PayoffChart';
import MetricsCards from '@/components/MetricsCards';
import CDIComparison from '@/components/CDIComparison';
import { supabase } from '@/integrations/supabase/client';
import { Leg, AnalysisMetrics } from '@/lib/types';
import { generatePayoffCurve, calculateMetrics, calculateCDIOpportunityCost } from '@/lib/payoff';
import { getExpiryFromTicker, countBusinessDays } from '@/lib/b3-calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Loader2, ArrowLeft, Save, XCircle, Sparkles,
  TrendingUp, TrendingDown, AlertTriangle, Clock, CheckCircle2, ShieldAlert
} from 'lucide-react';

interface DbLeg {
  id: string;
  side: string;
  option_type: string;
  asset: string;
  strike: number;
  price: number;
  quantity: number;
  current_price: number | null;
}

interface DbAnalysis {
  id: string;
  name: string;
  underlying_asset: string | null;
  status: string;
  cdi_rate: number | null;
  days_to_expiry: number | null;
  ai_suggestion: string | null;
  created_at: string;
}

function ExitAdvisorCard({
  currentPnL, metrics, daysRemaining, cdiReturn
}: {
  currentPnL: number;
  metrics: AnalysisMetrics;
  daysRemaining: number;
  cdiReturn: number;
}) {
  const signals: { icon: React.ReactNode; text: string; type: 'success' | 'warning' | 'danger' }[] = [];

  const maxGainNum = typeof metrics.maxGain === 'number' ? metrics.maxGain : Infinity;
  const maxLossNum = typeof metrics.maxLoss === 'number' ? metrics.maxLoss : -Infinity;

  if (currentPnL > 0 && maxGainNum !== Infinity && currentPnL >= maxGainNum * 0.8) {
    const pct = Math.round((currentPnL / maxGainNum) * 100);
    signals.push({
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-400" />,
      text: `Já capturou ${pct}% do ganho máximo. Considere encerrar para travar o lucro.`,
      type: 'success',
    });
  }

  if (currentPnL > 0 && cdiReturn > 0 && currentPnL > cdiReturn) {
    signals.push({
      icon: <TrendingUp className="h-5 w-5 text-emerald-400" />,
      text: `Operação já superou o CDI (R$${currentPnL.toFixed(2)} vs R$${cdiReturn.toFixed(2)}). Encerrar trava o lucro acima do benchmark.`,
      type: 'success',
    });
  }

  if (currentPnL < 0 && maxLossNum !== -Infinity && currentPnL <= maxLossNum * 0.5) {
    const pct = Math.round((currentPnL / maxLossNum) * 100);
    signals.push({
      icon: <AlertTriangle className="h-5 w-5 text-amber-400" />,
      text: `Prejuízo atingiu ${pct}% da perda máxima. Avalie stop loss.`,
      type: 'warning',
    });
  }

  if (daysRemaining > 0 && daysRemaining < 5) {
    signals.push({
      icon: <Clock className="h-5 w-5 text-amber-400" />,
      text: `Faltam apenas ${daysRemaining} dias úteis para o vencimento. Avalie encerramento para evitar exercício.`,
      type: 'warning',
    });
  }

  if (signals.length === 0 && currentPnL >= 0) {
    signals.push({
      icon: <TrendingUp className="h-5 w-5 text-muted-foreground" />,
      text: 'Posição dentro da faixa normal. Continue monitorando.',
      type: 'success',
    });
  }
  if (signals.length === 0 && currentPnL < 0) {
    signals.push({
      icon: <TrendingDown className="h-5 w-5 text-muted-foreground" />,
      text: 'Posição negativa mas dentro dos limites. Continue monitorando.',
      type: 'warning',
    });
  }

  return (
    <Card className="border-primary/40 bg-gradient-to-br from-card to-primary/5">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-primary" />
          Assistente de Saída — Devo Encerrar?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {signals.map((s, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border border-border/50">
            {s.icon}
            <p className="text-sm">{s.text}</p>
          </div>
        ))}
        <div className="pt-2 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            P&L Atual: <span className={currentPnL >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
              R$ {currentPnL.toFixed(2)}
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AnalysisDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [analysis, setAnalysis] = useState<DbAnalysis | null>(null);
  const [dbLegs, setDbLegs] = useState<DbLeg[]>([]);
  const [currentPrices, setCurrentPrices] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [cdiRate, setCdiRate] = useState(14.90);
  const [daysToExpiry, setDaysToExpiry] = useState(0);

  useEffect(() => {
    if (!user || !id) return;
    Promise.all([
      supabase.from('analyses').select('*').eq('id', id).single(),
      supabase.from('legs').select('*').eq('analysis_id', id),
    ]).then(([aRes, lRes]) => {
      if (aRes.data) {
        const a = aRes.data as unknown as DbAnalysis;
        setAnalysis(a);
        setCdiRate(a.cdi_rate ?? 14.90);
        setDaysToExpiry(a.days_to_expiry ?? 0);
        setAiSuggestion(a.ai_suggestion ?? '');
      }
      if (lRes.data) {
        const legs = lRes.data as unknown as DbLeg[];
        setDbLegs(legs);
        const prices: Record<string, string> = {};
        legs.forEach(l => { prices[l.id] = l.current_price?.toString() ?? ''; });
        setCurrentPrices(prices);
      }
      setLoading(false);
    });
  }, [user, id]);

  const legs: Leg[] = useMemo(() => dbLegs.map(l => ({
    id: l.id,
    side: l.side as 'buy' | 'sell',
    option_type: l.option_type as 'call' | 'put' | 'stock',
    asset: l.asset,
    strike: l.strike,
    price: l.price,
    quantity: l.quantity,
  })), [dbLegs]);

  const metrics = useMemo(() => calculateMetrics(legs), [legs]);
  const payoffData = useMemo(() => generatePayoffCurve(legs), [legs]);

  const investedCapital = useMemo(() => {
    if (metrics.montageTotal) return Math.abs(metrics.montageTotal);
    return Math.max(Math.abs(metrics.netCost || 0), 1);
  }, [metrics]);

  const cdiReturn = useMemo(() => {
    if (!cdiRate || daysToExpiry <= 0) return 0;
    return calculateCDIOpportunityCost(investedCapital, cdiRate, daysToExpiry);
  }, [investedCapital, cdiRate, daysToExpiry]);

  const currentPnL = useMemo(() => {
    let total = 0;
    for (const leg of dbLegs) {
      const cp = parseFloat(currentPrices[leg.id] || '');
      if (isNaN(cp)) continue;
      const multiplier = leg.side === 'buy' ? 1 : -1;
      total += multiplier * (cp - leg.price) * leg.quantity;
    }
    return total;
  }, [dbLegs, currentPrices]);

  const hasCurrentPrices = useMemo(() =>
    dbLegs.some(l => currentPrices[l.id] && !isNaN(parseFloat(currentPrices[l.id]))),
  [dbLegs, currentPrices]);

  const updateCurrentPrice = useCallback((legId: string, value: string) => {
    setCurrentPrices(prev => ({ ...prev, [legId]: value }));
  }, []);

  const saveCurrentPrices = async () => {
    setSaving(true);
    try {
      for (const leg of dbLegs) {
        const cp = parseFloat(currentPrices[leg.id] || '');
        await supabase.from('legs').update({
          current_price: isNaN(cp) ? null : cp,
        } as any).eq('id', leg.id);
      }
      toast.success('Preços atualizados!');
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const closeOperation = async () => {
    setClosing(true);
    try {
      await supabase.from('analyses').update({ status: 'closed' } as any).eq('id', id!);
      setAnalysis(prev => prev ? { ...prev, status: 'closed' } : prev);
      toast.success('Operação encerrada!');
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    } finally {
      setClosing(false);
    }
  };

  const getAISuggestion = async () => {
    setLoadingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-structure', {
        body: {
          legs,
          metrics: { ...metrics, cdiReturn },
          cdiRate,
          daysToExpiry,
          currentPrices: dbLegs.map(l => ({
            asset: l.asset,
            original: l.price,
            current: parseFloat(currentPrices[l.id] || '') || null,
          })),
        },
      });
      if (error) throw error;
      setAiSuggestion(data.suggestion || 'Sem sugestão.');
    } catch (err: any) {
      toast.error('Erro IA: ' + err.message);
    } finally {
      setLoadingAI(false);
    }
  };

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin" /></div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-12 text-center">
          <p className="text-muted-foreground">Análise não encontrada.</p>
          <Button className="mt-4" onClick={() => navigate('/history')}>Voltar</Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-6 space-y-6 animate-fade-in pb-20">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/history')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{analysis.name}</h1>
                <Badge variant={analysis.status === 'active' ? 'default' : 'secondary'}>
                  {analysis.status === 'active' ? 'Ativa' : 'Encerrada'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {analysis.underlying_asset} · {new Date(analysis.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={getAISuggestion} disabled={loadingAI}>
              {loadingAI ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Sugestão IA
            </Button>
            {analysis.status === 'active' && (
              <Button variant="destructive" size="sm" onClick={closeOperation} disabled={closing}>
                {closing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                Encerrar Operação
              </Button>
            )}
          </div>
        </div>

        {/* Legs with editable current prices */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pernas da Estratégia — Preços Atuais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-muted-foreground text-xs">
                    <th className="text-left py-2">Ativo</th>
                    <th className="text-left py-2">Tipo</th>
                    <th className="text-left py-2">Lado</th>
                    <th className="text-right py-2">Strike</th>
                    <th className="text-right py-2">Preço Original</th>
                    <th className="text-right py-2">Preço Atual</th>
                    <th className="text-right py-2">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {dbLegs.map(leg => {
                    const cp = parseFloat(currentPrices[leg.id] || '');
                    const pnl = !isNaN(cp)
                      ? (leg.side === 'buy' ? 1 : -1) * (cp - leg.price) * leg.quantity
                      : null;
                    return (
                      <tr key={leg.id} className="border-b border-border/30">
                        <td className="py-2 font-medium">{leg.asset}</td>
                        <td className="py-2">
                          <Badge variant="outline" className="text-[10px]">
                            {leg.option_type.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="py-2">
                          <Badge variant={leg.side === 'buy' ? 'default' : 'secondary'} className="text-[10px]">
                            {leg.side === 'buy' ? 'Compra' : 'Venda'}
                          </Badge>
                        </td>
                        <td className="py-2 text-right">{leg.strike.toFixed(2)}</td>
                        <td className="py-2 text-right">{leg.price.toFixed(2)}</td>
                        <td className="py-2 text-right">
                          <Input
                            type="number"
                            step="0.01"
                            value={currentPrices[leg.id] || ''}
                            onChange={e => updateCurrentPrice(leg.id, e.target.value)}
                            className="w-24 h-8 text-right text-sm ml-auto"
                            placeholder="0.00"
                            disabled={analysis.status !== 'active'}
                          />
                        </td>
                        <td className="py-2 text-right font-medium">
                          {pnl !== null ? (
                            <span className={pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                              {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {hasCurrentPrices && (
                  <tfoot>
                    <tr className="font-bold">
                      <td colSpan={6} className="py-2 text-right">P&L Total:</td>
                      <td className="py-2 text-right">
                        <span className={currentPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                          R$ {currentPnL >= 0 ? '+' : ''}{currentPnL.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            {analysis.status === 'active' && (
              <div className="flex justify-end mt-4">
                <Button size="sm" onClick={saveCurrentPrices} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Salvar Preços Atuais
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Exit Advisor */}
        {hasCurrentPrices && (
          <ExitAdvisorCard
            currentPnL={currentPnL}
            metrics={metrics}
            daysRemaining={daysToExpiry}
            cdiReturn={cdiReturn}
          />
        )}

        {/* Metrics + Chart + CDI */}
        <MetricsCards metrics={metrics} cdiReturn={cdiReturn} daysToExpiry={daysToExpiry} />

        <Card>
          <CardHeader><CardTitle className="text-base">Gráfico de Payoff</CardTitle></CardHeader>
          <CardContent>
            <PayoffChart
              data={payoffData}
              breakevens={metrics.realBreakeven ? [metrics.realBreakeven] : metrics.breakevens}
              cdiRate={cdiRate}
              daysToExpiry={daysToExpiry}
              netCost={metrics.netCost}
              montageTotal={metrics.montageTotal}
            />
          </CardContent>
        </Card>

        <CDIComparison
          metrics={metrics}
          cdiRate={cdiRate}
          setCdiRate={setCdiRate}
          daysToExpiry={daysToExpiry}
          setDaysToExpiry={setDaysToExpiry}
        />

        {aiSuggestion && (
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Sugestão da IA
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{aiSuggestion}</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
