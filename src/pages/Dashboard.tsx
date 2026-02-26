import { useState, useCallback, useMemo } from 'react';
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
import { generatePayoffCurve, calculateMetrics } from '@/lib/payoff';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Sparkles, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const [legs, setLegs] = useState<Leg[]>([]);
  const [analysisName, setAnalysisName] = useState('');
  const [cdiRate, setCdiRate] = useState(0);
  const [daysToExpiry, setDaysToExpiry] = useState(0);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);
  const [saving, setSaving] = useState(false);

  const metrics = useMemo(() => calculateMetrics(legs), [legs]);
  const payoffData = useMemo(() => generatePayoffCurve(legs), [legs]);

  const addLeg = useCallback((leg: Leg) => {
    setLegs(prev => [...prev, leg]);
  }, []);

  const removeLeg = useCallback((index: number) => {
    setLegs(prev => prev.filter((_, i) => i !== index));
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
            <h1 className="text-2xl font-bold">Nova Análise</h1>
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

        <LegsTable legs={legs} onRemove={removeLeg} />

        {legs.length > 0 && (
          <>
            <MetricsCards metrics={metrics} />
            <Card>
              <CardHeader><CardTitle className="text-base">Gráfico de Payoff</CardTitle></CardHeader>
              <CardContent>
                <PayoffChart data={payoffData} breakevens={metrics.breakevens} />
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
