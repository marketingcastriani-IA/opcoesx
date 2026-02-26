import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Clock, ArrowRight, ShieldAlert, PlusCircle } from 'lucide-react';

interface AnalysisSummary {
  id: string;
  name: string;
  underlying_asset: string | null;
  status: string;
  created_at: string;
}

export default function History() {
  const { user, loading: authLoading } = useAuth();
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    supabase
      .from('analyses')
      .select('id, name, underlying_asset, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setAnalyses((data as AnalysisSummary[]) || []);
        setLoading(false);
      });
  }, [user]);

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-background pb-16">
      <Header />
      <main className="container py-6 space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Histórico de Análises</h1>
            <p className="text-sm text-muted-foreground">Gerencie suas operações salvas</p>
          </div>
          <Button onClick={() => navigate('/dashboard')} size="sm">
            <PlusCircle className="mr-2 h-4 w-4" /> Nova Análise
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : analyses.length === 0 ? (
          <Card className="border-dashed border-2 border-border/60">
            <CardContent className="py-16 text-center space-y-4">
              <Clock className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <div>
                <p className="text-lg font-medium">Nenhuma análise salva</p>
                <p className="text-sm text-muted-foreground">Crie sua primeira análise para começar a monitorar</p>
              </div>
              <Button onClick={() => navigate('/dashboard')}>
                <PlusCircle className="mr-2 h-4 w-4" /> Criar Análise
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {analyses.map(a => (
              <Card
                key={a.id}
                className="group hover:border-primary/30 hover:shadow-[0_0_30px_-10px_hsl(var(--primary)/0.15)] transition-all duration-300 cursor-pointer bg-card/50 backdrop-blur-sm"
                onClick={() => navigate(`/analysis/${a.id}`)}
              >
                <CardContent className="flex items-center justify-between py-4 px-5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{a.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {a.underlying_asset || 'Sem ativo'} · {new Date(a.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    {a.status === 'active' && (
                      <Button variant="outline" size="sm" className="hidden sm:flex text-xs gap-1.5" onClick={e => { e.stopPropagation(); navigate(`/analysis/${a.id}`); }}>
                        <ShieldAlert className="h-3.5 w-3.5" /> Avaliar Saída
                      </Button>
                    )}
                    <Badge variant={a.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
                      {a.status === 'active' ? 'Ativa' : 'Encerrada'}
                    </Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
