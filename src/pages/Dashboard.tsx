import { useState, useCallback, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAccessControl } from '@/hooks/useAccessControl';
import AccessBlocked from '@/pages/AccessBlocked';
import Header from '@/components/Header';
import LegForm from '@/components/LegForm';
import LegsTable from '@/components/LegsTable';
import PayoffChart from '@/components/PayoffChart';
import MetricsCards from '@/components/MetricsCards';
import CDIComparison from '@/components/CDIComparison';
import ImageUpload from '@/components/ImageUpload';
import { Leg } from '@/lib/types';
import { generatePayoffCurve, calculateMetrics, calculateCDIReturn, calculateCDIOpportunityCost } from '@/lib/payoff';
import { getExpiryFromTicker, countBusinessDays } from '@/lib/b3-calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Sparkles, Loader2, ArrowRight, Camera, Keyboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProfessionalHeader, SectionDivider } from '@/components/ProfessionalLayout';
import AIInsights from '@/components/AIInsights';

type InputMode = null | 'manual' | 'image';

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const access = useAccessControl();
  const navigate = useNavigate();
  const [legs, setLegs] = useState<Leg[]>([]);
  const [analysisName, setAnalysisName] = useState('');
  const [cdiRate, setCdiRate] = useState(14.90);
  const [daysToExpiry, setDaysToExpiry] = useState(0);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>(null);

  const metrics = useMemo(() => calculateMetrics(legs), [legs]);
  const payoffData = useMemo(() => generatePayoffCurve(legs), [legs]);

  const inferredExpiry = useMemo(() => {
    const leg = legs.find(l => l.option_type !== 'stock');
    return leg ? getExpiryFromTicker(leg.asset) : null;
  }, [legs]);

  useEffect(() => {
    if (inferredExpiry) {
      const today = new Date();
      setDaysToExpiry(countBusinessDays(today, inferredExpiry));
    }
  }, [inferredExpiry]);

  const investedCapital = useMemo(() => {
    if (metrics.montageTotal) return Math.abs(metrics.montageTotal);
    return Math.max(Math.abs(metrics.netCost || 0), 1);
  }, [metrics]);

  const cdiReturn = useMemo(() => {
    if (!cdiRate || daysToExpiry <= 0) return 0;
    return calculateCDIOpportunityCost(investedCapital, cdiRate, daysToExpiry);
  }, [investedCapital, cdiRate, daysToExpiry]);

  const addLeg = useCallback((leg: Leg) => { setLegs(prev => [...prev, leg]); }, []);
  const removeLeg = useCallback((index: number) => { setLegs(prev => prev.filter((_, i) => i !== index)); }, []);
  const updateLeg = useCallback((index: number, leg: Leg) => { setLegs(prev => prev.map((item, i) => (i === index ? leg : item))); }, []);
  const handleLegsFromImage = useCallback((extractedLegs: Leg[]) => { setLegs(prev => [...prev, ...extractedLegs]); }, []);

  if (authLoading || access.status === 'loading') return null;
  if (!user) return <Navigate to="/auth" replace />;

  // Access gate
  if (access.status === 'pending' || access.status === 'rejected' || access.status === 'expired') {
    return <AccessBlocked status={access.status} />;
  }

  const getAISuggestion = async () => {
    if (legs.length === 0) { toast.error('Adicione pelo menos uma perna.'); return; }
    setLoadingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-structure', {
        body: {
          legs,
          metrics: { ...metrics, cdiReturn, cdiEfficiency: cdiReturn > 0 && typeof metrics.maxGain === 'number' ? Math.round((metrics.maxGain / cdiReturn) * 100) : null },
          cdiRate, daysToExpiry,
        },
      });
      if (error) throw error;
      setAiSuggestion(data.suggestion || 'Sem sugestão disponível.');
    } catch (err: any) {
      toast.error('Erro ao obter sugestão: ' + (err.message || 'Tente novamente'));
    } finally { setLoadingAI(false); }
  };

  const saveAnalysis = async () => {
    if (legs.length === 0) { toast.error('Adicione pelo menos uma perna.'); return; }
    setSaving(true);
    try {
      const { data: analysis, error: aError } = await supabase
        .from('analyses').insert({
          user_id: user.id, name: analysisName || 'Análise sem nome',
          underlying_asset: legs[0]?.asset || null, cdi_rate: cdiRate || null,
          days_to_expiry: daysToExpiry || null, ai_suggestion: aiSuggestion || null,
        }).select().single();
      if (aError) throw aError;

      const legsToInsert = legs.map(l => ({
        analysis_id: analysis.id, side: l.side, option_type: l.option_type,
        asset: l.asset, strike: l.strike, price: l.price, quantity: l.quantity,
      }));
      const { error: lError } = await supabase.from('legs').insert(legsToInsert);
      if (lError) throw lError;

      toast.success('Análise salva com sucesso!');
      navigate(`/analysis/${analysis.id}`);
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err.message || 'Tente novamente'));
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <Header />
      <main className="container py-6 space-y-6 animate-fade-in">
        {/* Access banner */}
        {access.daysRemaining !== null && access.daysRemaining <= 7 && (
          <div className="rounded-lg border border-warning/40 bg-warning/5 px-4 py-3 flex items-center gap-3">
            <Badge className="bg-warning text-warning-foreground text-[10px] shrink-0">TRIAL</Badge>
            <p className="text-sm text-warning">
              {access.daysRemaining === 0
                ? 'Seu período de acesso expira hoje!'
                : `Seu acesso expira em ${access.daysRemaining} dia(s).`}
            </p>
          </div>
        )}

        {/* Page title */}
        <ProfessionalHeader
          title="Nova Análise"
          subtitle="Monte sua estrutura de opções e analise os riscos em tempo real"
          badge={
            <div className="flex gap-2">
              {metrics.strategyLabel && (
                <Badge className="bg-primary/20 text-primary border-primary/30 text-xs font-semibold">{metrics.strategyLabel}</Badge>
              )}
              {metrics.isRiskFree && (
                <Badge className="bg-success/20 text-success border-success/30 text-xs font-semibold">RISCO ZERO</Badge>
              )}
            </div>
          }
        />
        <div className="flex gap-3 flex-wrap">
          <Button 
            onClick={getAISuggestion} 
            disabled={loadingAI || legs.length === 0} 
            className="text-base h-11 px-6 shadow-[0_0_30px_-8px_hsl(var(--primary)/0.4)]"
          >
            {loadingAI ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
            Sugestão IA
          </Button>
          <Button 
            onClick={saveAnalysis} 
            disabled={saving || legs.length === 0}
            variant="outline"
            className="text-base h-11 px-6"
          >
            {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
            Salvar Análise
          </Button>
        </div>

        {/* Analysis name */}
        <div className="space-y-2">
          <Label>Nome da análise</Label>
          <Input value={analysisName} onChange={e => setAnalysisName(e.target.value)} placeholder="Ex: Trava de alta PETR4" className="max-w-md" />
        </div>

        {/* Input Mode Selector */}
        {inputMode === null ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => setInputMode('image')}
              className="group relative overflow-hidden rounded-2xl border-2 border-dashed border-cyan-400/50 bg-gradient-to-br from-cyan-500/10 via-cyan-500/5 to-card p-8 text-left transition-all duration-300 hover:border-cyan-400/80 hover:shadow-[0_0_50px_-12px_hsl(186,100%,50%/0.3)] hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-400/10 rounded-full blur-3xl -translate-y-8 translate-x-8 group-hover:bg-cyan-400/15 transition-colors" />
              <div className="relative space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/20 to-cyan-500/10 text-cyan-400 group-hover:from-cyan-400/30 group-hover:to-cyan-500/20 transition-colors">
                    <Camera className="h-7 w-7" />
                  </div>
                  <div>
                    <Badge className="text-[9px] bg-cyan-500/20 text-cyan-400 border-cyan-400/40 mb-1">🤖 IA + OCR</Badge>
                    <h3 className="text-xl font-bold text-cyan-400">Upload de Imagem</h3>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Tire um <strong className="text-cyan-300">print da sua corretora</strong> (BTG, Profit, Clear) e a IA extrai automaticamente todas as pernas.
                </p>
                <div className="flex items-center gap-2 text-cyan-400 text-sm font-medium">
                  Começar com imagem <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </button>

            <button
              onClick={() => setInputMode('manual')}
              className="group relative overflow-hidden rounded-2xl border-2 border-dashed border-violet-400/50 bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-card p-8 text-left transition-all duration-300 hover:border-violet-400/80 hover:shadow-[0_0_50px_-12px_hsl(280,100%,50%/0.3)] hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-violet-400/10 rounded-full blur-3xl -translate-y-8 translate-x-8 group-hover:bg-violet-400/15 transition-colors" />
              <div className="relative space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-400/20 to-violet-500/10 text-violet-400 group-hover:from-violet-400/30 group-hover:to-violet-500/20 transition-colors">
                    <Keyboard className="h-7 w-7" />
                  </div>
                  <div>
                    <Badge className="text-[9px] bg-violet-500/20 text-violet-400 border-violet-400/40 mb-1">⚙️ PRECISO</Badge>
                    <h3 className="text-xl font-bold text-violet-400">Entrada Manual</h3>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Insira manualmente cada perna: <strong className="text-violet-300">ativo, strike, prêmio, quantidade</strong>. Controle total.
                </p>
                <div className="flex items-center gap-2 text-violet-400 group-hover:text-violet-300 text-sm font-medium transition-colors">
                  Inserir manualmente <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <button onClick={() => setInputMode('manual')} className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all', inputMode === 'manual' ? 'bg-violet-500/20 text-violet-400 border border-violet-400/40' : 'text-muted-foreground hover:text-violet-400 hover:bg-violet-500/10')}>
                <Keyboard className="h-4 w-4" /> Manual
              </button>
              <button onClick={() => setInputMode('image')} className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all', inputMode === 'image' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-400/40' : 'text-muted-foreground hover:text-cyan-400 hover:bg-cyan-500/10')}>
                <Camera className="h-4 w-4" /> Upload OCR
              </button>
            </div>
            {inputMode === 'manual' ? (
              <Card className="border-2 border-violet-400/30 bg-gradient-to-br from-violet-500/5 to-card backdrop-blur-sm">
                <CardHeader><CardTitle className="text-base text-violet-400">Adicionar Perna Manualmente</CardTitle></CardHeader>
                <CardContent><LegForm onAdd={addLeg} /></CardContent>
              </Card>
            ) : (
              <Card className="border-2 border-cyan-400/30 bg-gradient-to-br from-cyan-500/5 to-card backdrop-blur-sm">
                <CardHeader><CardTitle className="text-base text-cyan-400">Upload de Imagem (OCR)</CardTitle></CardHeader>
                <CardContent>
                  <ImageUpload 
                    onLegsExtracted={handleLegsFromImage}
                    onImageChange={() => setLegs([])}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <LegsTable legs={legs} onRemove={removeLeg} onUpdate={updateLeg} />

        {legs.length > 0 && (
          <>
            <MetricsCards metrics={metrics} cdiReturn={cdiReturn} daysToExpiry={daysToExpiry} />
            <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
              <CardHeader><CardTitle className="text-base">Gráfico de Payoff</CardTitle></CardHeader>
              <CardContent>
                <PayoffChart data={payoffData} breakevens={metrics.realBreakeven ? [metrics.realBreakeven] : metrics.breakevens} cdiRate={cdiRate} daysToExpiry={daysToExpiry} netCost={metrics.netCost} montageTotal={metrics.montageTotal} />
              </CardContent>
            </Card>
            <CDIComparison metrics={metrics} cdiRate={cdiRate} setCdiRate={setCdiRate} daysToExpiry={daysToExpiry} setDaysToExpiry={setDaysToExpiry} />
            {legs.length > 0 && (
              <>
                <SectionDivider title="Análise de IA" />
                <AIInsights 
                  metrics={metrics} 
                  suggestion={aiSuggestion} 
                  cdiReturn={cdiReturn}
                  daysToExpiry={daysToExpiry}
                  loading={loadingAI}
                />
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
