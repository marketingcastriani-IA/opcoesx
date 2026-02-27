import { useState, useCallback, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import Header from '@/components/Header';
import LegForm from '@/components/LegForm';
import LegsTable from '@/components/LegsTable';
import PayoffChart from '@/components/PayoffChart';
import MetricsCards from '@/components/MetricsCards';
import CDIComparison from '@/components/CDIComparison';
import ImageUpload from '@/components/ImageUpload';
import { Leg } from '@/lib/types';
import { generatePayoffCurve, calculateMetrics, calculateCDIReturn } from '@/lib/payoff';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Sparkles, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const monthMapCalls = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
const monthMapPuts = ['M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X'];

const expiryCalendar2026: Record<number, string> = {
  1: '2026-01-16',
  2: '2026-02-20',
  3: '2026-03-20',
  4: '2026-04-17',
  5: '2026-05-15',
  6: '2026-06-19',
  7: '2026-07-17',
  8: '2026-08-21',
  9: '2026-09-18',
  10: '2026-10-16',
  11: '2026-11-19',
  12: '2026-12-18',
};

const bankHolidays2026 = new Set([
  '2026-01-01',
  '2026-02-16',
  '2026-02-17',
  '2026-04-03',
  '2026-04-21',
  '2026-05-01',
  '2026-06-04',
  '2026-09-07',
  '2026-10-12',
  '2026-11-02',
  '2026-11-15',
  '2026-12-25',
]);

const formatDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const countBusinessDays = (from: Date, to: Date) => {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  if (end <= start) return 0;
  let count = 0;
  const current = new Date(start);
  while (current < end) {
    current.setDate(current.getDate() + 1);
    const day = current.getDay();
    const key = formatDateKey(current);
    if (day !== 0 && day !== 6 && !bankHolidays2026.has(key)) {
      count += 1;
    }
  }
  return count;
};

const getExpiryFromTicker = (ticker: string) => {
  const letter = ticker?.[4]?.toUpperCase() || '';
  const callIndex = monthMapCalls.indexOf(letter);
  const putIndex = monthMapPuts.indexOf(letter);
  const month = callIndex >= 0 ? callIndex + 1 : putIndex >= 0 ? putIndex + 1 : null;
  if (!month) return null;
  const expiryDate = expiryCalendar2026[month];
  return expiryDate ? new Date(expiryDate) : null;
};

const detectCollar = (legs: Leg[]) => {
  const stock = legs.find(l => l.option_type === 'stock' && l.side === 'buy');
  const put = legs.find(l => l.option_type === 'put' && l.side === 'buy');
  const call = legs.find(l => l.option_type === 'call' && l.side === 'sell');
  if (!stock || !put || !call) return false;
  const root = stock.asset.slice(0, 4);
  const putRoot = put.asset.slice(0, 4);
  const callRoot = call.asset.slice(0, 4);
  const putExpiry = getExpiryFromTicker(put.asset);
  const callExpiry = getExpiryFromTicker(call.asset);
  return root && root === putRoot && root === callRoot && !!putExpiry && !!callExpiry;
};

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const [legs, setLegs] = useState<Leg[]>([]);
  const [analysisName, setAnalysisName] = useState('');
  const [cdiRate, setCdiRate] = useState(14.90);
  const [daysToExpiry, setDaysToExpiry] = useState(0);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);
  const [saving, setSaving] = useState(false);

  const metrics = useMemo(() => calculateMetrics(legs), [legs]);
  const payoffData = useMemo(() => generatePayoffCurve(legs), [legs]);

  const inferredExpiry = useMemo(() => {
    const leg = legs.find(l => l.option_type !== 'stock');
    return leg ? getExpiryFromTicker(leg.asset) : null;
  }, [legs]);

  const strategyTag = useMemo(() => (detectCollar(legs) ? 'Collar (Financiamento com Proteção)' : ''), [legs]);

  useEffect(() => {
    if (inferredExpiry) {
      const today = new Date();
      setDaysToExpiry(countBusinessDays(today, inferredExpiry));
    }
  }, [inferredExpiry]);

  const cdiReturn = useMemo(() => {
    if (!cdiRate || daysToExpiry <= 0) return 0;
    const invested = Math.max(Math.abs(metrics.netCost || 0), 1);
    return calculateCDIReturn(invested, cdiRate, daysToExpiry, false);
  }, [metrics.netCost, cdiRate, daysToExpiry]);

  const addLeg = useCallback((leg: Leg) => {
    setLegs(prev => [...prev, leg]);
  }, []);

  const removeLeg = useCallback((index: number) => {
    setLegs(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateLeg = useCallback((index: number, leg: Leg) => {
    setLegs(prev => prev.map((item, i) => (i === index ? leg : item)));
  }, []);

  const handleLegsFromImage = useCallback((extractedLegs: Leg[]) => {
    setLegs(prev => [...prev, ...extractedLegs]);
  }, []);

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  const getAISuggestion = async () => {
    if (legs.length === 0) {
      toast.error('Adicione pelo menos uma perna para obter sugestão.');
      return;
    }
    setLoadingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-structure', {
        body: { legs, metrics, cdiRate, daysToExpiry },
      });
      if (error) throw error;
      setAiSuggestion(data.suggestion || 'Sem sugestão disponível.');
    } catch (err: any) {
      toast.error('Erro ao obter sugestão: ' + (err.message || 'Tente novamente'));
    } finally {
      setLoadingAI(false);
    }
  };

  const saveAnalysis = async () => {
    if (legs.length === 0) {
      toast.error('Adicione pelo menos uma perna.');
      return;
    }
    setSaving(true);
    try {
      const { data: analysis, error: aError } = await supabase
        .from('analyses')
        .insert({
          user_id: user.id,
          name: analysisName || 'Análise sem nome',
          underlying_asset: legs[0]?.asset || null,
          cdi_rate: cdiRate || null,
          days_to_expiry: daysToExpiry || null,
          ai_suggestion: aiSuggestion || null,
        })
        .select()
        .single();
      if (aError) throw aError;

      const legsToInsert = legs.map(l => ({
        analysis_id: analysis.id,
        side: l.side,
        option_type: l.option_type,
        asset: l.asset,
        strike: l.strike,
        price: l.price,
        quantity: l.quantity,
      }));
      const { error: lError } = await supabase.from('legs').insert(legsToInsert);
      if (lError) throw lError;

      toast.success('Análise salva com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err.message || 'Tente novamente'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-6 space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">Nova Análise</h1>
              {strategyTag && (
                <span className="text-xs px-2 py-1 rounded-full border border-primary/40 text-primary font-medium">
                  {strategyTag}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">Monte sua estrutura de opções e analise os riscos</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={getAISuggestion} disabled={loadingAI || legs.length === 0}>
              {loadingAI ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Sugestão IA
            </Button>
            <Button onClick={saveAnalysis} disabled={saving || legs.length === 0}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Nome da análise</Label>
          <Input value={analysisName} onChange={e => setAnalysisName(e.target.value)} placeholder="Ex: Trava de alta PETR4" className="max-w-md" />
        </div>

        <Tabs defaultValue="manual" className="w-full">
          <TabsList>
            <TabsTrigger value="manual">Entrada Manual</TabsTrigger>
            <TabsTrigger value="image">Upload de Imagem</TabsTrigger>
          </TabsList>
          <TabsContent value="manual" className="space-y-4 mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Adicionar Perna</CardTitle></CardHeader>
              <CardContent><LegForm onAdd={addLeg} /></CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="image" className="mt-4">
            <ImageUpload onLegsExtracted={handleLegsFromImage} />
          </TabsContent>
        </Tabs>

        <LegsTable legs={legs} onRemove={removeLeg} onUpdate={updateLeg} />

        {legs.length > 0 && (
          <>
            <MetricsCards metrics={metrics} cdiReturn={cdiReturn} daysToExpiry={daysToExpiry} />
            <Card>
              <CardHeader><CardTitle className="text-base">Gráfico de Payoff</CardTitle></CardHeader>
              <CardContent>
                <PayoffChart data={payoffData} breakevens={metrics.breakevens} cdiRate={cdiRate} daysToExpiry={daysToExpiry} netCost={metrics.netCost} />
              </CardContent>
            </Card>
            <CDIComparison metrics={metrics} cdiRate={cdiRate} setCdiRate={setCdiRate} daysToExpiry={daysToExpiry} setDaysToExpiry={setDaysToExpiry} />
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
          </>
        )}
      </main>
    </div>
  );
}
