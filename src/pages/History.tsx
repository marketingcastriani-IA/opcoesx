import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Clock, ArrowRight } from 'lucide-react';

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
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-6 space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold">Histórico de Análises</h1>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : analyses.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Clock className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Nenhuma análise salva ainda.</p>
              <Button className="mt-4" onClick={() => navigate('/dashboard')}>Criar Análise</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {analyses.map(a => (
              <Card key={a.id} className="hover:border-primary/30 transition-colors cursor-pointer" onClick={() => navigate(`/analysis/${a.id}`)}>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.underlying_asset || 'Sem ativo'} · {new Date(a.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs rounded-full px-2 py-0.5 ${a.status === 'active' ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}`}>
                      {a.status === 'active' ? 'Ativa' : 'Encerrada'}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
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
