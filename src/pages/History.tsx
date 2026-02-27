import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Clock, ArrowRight, ShieldAlert, PlusCircle, Trash2, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnalysisSummary {
  id: string;
  name: string;
  underlying_asset: string | null;
  status: string;
  created_at: string;
  ai_suggestion: string | null;
}

export default function History() {
  const { user, loading: authLoading } = useAuth();
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    supabase
      .from('analyses')
      .select('id, name, underlying_asset, status, created_at, ai_suggestion')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setAnalyses((data as AnalysisSummary[]) || []);
        setLoading(false);
      });
  }, [user]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Tem certeza que deseja deletar esta análise?')) return;

    setDeleting(id);
    try {
      // Deletar legs primeiro
      await supabase.from('legs').delete().eq('analysis_id', id);
      
      // Depois deletar análise
      const { error } = await supabase.from('analyses').delete().eq('id', id);
      if (error) throw error;

      setAnalyses(analyses.filter(a => a.id !== id));
      toast.success('Análise deletada com sucesso');
    } catch (err: any) {
      toast.error('Erro ao deletar', {
        description: err.message || 'Tente novamente',
      });
    } finally {
      setDeleting(null);
    }
  };

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-background pb-16">
      <Header />
      <main className="container py-6 space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight">Histórico</h1>
            <p className="text-lg text-muted-foreground">Suas estruturas salvas e análises anteriores</p>
          </div>
          <Button onClick={() => navigate('/dashboard')} className="text-base h-11 px-6 shadow-[0_0_30px_-8px_hsl(var(--primary)/0.4)]">
            <PlusCircle className="mr-2 h-5 w-5" /> Nova Análise
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : analyses.length === 0 ? (
          <Card className="border-dashed border-2 border-muted-foreground/30">
            <CardContent className="py-16 text-center space-y-4">
              <Clock className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <div>
                <p className="text-lg font-bold">Nenhuma análise salva</p>
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
                className="group relative overflow-hidden border-2 transition-all hover:shadow-lg hover:border-primary/40 cursor-pointer bg-gradient-to-br from-card/80 to-card/40"
                onClick={() => navigate(`/analysis/${a.id}`)}
              >
                <CardContent className="flex items-start justify-between py-5 px-5 gap-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-lg font-bold">{a.name}</p>
                      {a.underlying_asset && (
                        <Badge className="bg-primary/20 text-primary border-primary/30">
                          {a.underlying_asset}
                        </Badge>
                      )}
                      <Badge 
                        variant={a.status === 'active' ? 'default' : 'secondary'} 
                        className={cn(
                          'text-xs font-semibold',
                          a.status === 'active' && 'bg-success/20 text-success border-success/30'
                        )}
                      >
                        {a.status === 'active' ? '🟢 Ativa' : '⏹️ Encerrada'}
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-muted-foreground">
                      {new Date(a.created_at).toLocaleDateString('pt-BR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>

                    {a.ai_suggestion && (
                      <p className="text-sm text-foreground line-clamp-2 pt-2 border-t border-muted-foreground/10">
                        <span className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">IA:</span> {a.ai_suggestion}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/analysis/${a.id}`);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Ver
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={deleting === a.id}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => handleDelete(e, a.id)}
                    >
                      {deleting === a.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-destructive" />
                      )}
                    </Button>
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
