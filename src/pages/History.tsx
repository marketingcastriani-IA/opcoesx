import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Archive, ArrowRight, CheckCircle2, PlusCircle, Trash2, Eye, LogOut } from 'lucide-react';
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
  const [closing, setClosing] = useState<string | null>(null);
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
    if (!confirm('Tem certeza que deseja deletar esta estrutura?')) return;

    setDeleting(id);
    try {
      await supabase.from('legs').delete().eq('analysis_id', id);
      const { error } = await supabase.from('analyses').delete().eq('id', id);
      if (error) throw error;

      setAnalyses(analyses.filter(a => a.id !== id));
      toast.success('Estrutura deletada com sucesso');
    } catch (err: any) {
      toast.error('Erro ao deletar', {
        description: err.message || 'Tente novamente',
      });
    } finally {
      setDeleting(null);
    }
  };

  const handleCloseOperation = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (!confirm(`Deseja encerrar a operação "${name}" e movê-la para o Portfólio?`)) return;

    setClosing(id);
    try {
      // Atualizar status para 'closed'
      const { error } = await supabase
        .from('analyses')
        .update({ status: 'closed' })
        .eq('id', id);
      
      if (error) throw error;

      // Buscar dados completos da operação para salvar no Portfólio
      const { data: analysisData } = await supabase
        .from('analyses')
        .select('*')
        .eq('id', id)
        .single();

      if (analysisData) {
        // Preparar dados para o Portfólio
        const portfolioOperation = {
          id: analysisData.id,
          name: analysisData.name || 'Operação sem nome',
          asset: analysisData.underlying_asset || 'N/A',
          entryDate: new Date(analysisData.created_at).toLocaleDateString('pt-BR'),
          exitDate: new Date().toLocaleDateString('pt-BR'),
          profitLoss: 0, // Será preenchido pelo usuário se necessário
          percentage: 0,
          strategy: 'Operação encerrada',
        };

        // Salvar no localStorage do Portfólio
        try {
          const saved = localStorage.getItem('portfolio_operations');
          const portfolioOps = saved ? JSON.parse(saved) : [];
          const updated = [...portfolioOps, portfolioOperation];
          localStorage.setItem('portfolio_operations', JSON.stringify(updated));
        } catch (storageErr) {
          console.error('Erro ao salvar no localStorage:', storageErr);
        }
      }

      // Atualizar lista local
      setAnalyses(analyses.map(a => 
        a.id === id ? { ...a, status: 'closed' } : a
      ));
      
      toast.success('Operação encerrada e movida para o Portfólio!');
    } catch (err: any) {
      toast.error('Erro ao encerrar', {
        description: err.message || 'Tente novamente',
      });
    } finally {
      setClosing(null);
    }
  };

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  const activeAnalyses = analyses.filter(a => a.status === 'active');
  const closedAnalyses = analyses.filter(a => a.status === 'closed');

  return (
    <div className="min-h-screen bg-background pb-16">
      <Header />
      <main className="container py-6 space-y-8 animate-fade-in">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight">Estruturas Salvas</h1>
            <p className="text-lg text-muted-foreground">Gerencie suas operações ativas e encerradas</p>
          </div>
          <Button onClick={() => navigate('/dashboard')} className="text-base h-11 px-6 shadow-[0_0_30px_-8px_hsl(var(--primary)/0.4)]">
            <PlusCircle className="mr-2 h-5 w-5" /> Nova Estrutura
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : analyses.length === 0 ? (
          <Card className="border-dashed border-2 border-muted-foreground/30">
            <CardContent className="py-16 text-center space-y-4">
              <Archive className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <div>
                <p className="text-lg font-bold">Nenhuma estrutura salva</p>
                <p className="text-sm text-muted-foreground">Crie sua primeira estrutura para começar</p>
              </div>
              <Button onClick={() => navigate('/dashboard')}>
                <PlusCircle className="mr-2 h-4 w-4" /> Criar Estrutura
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Estruturas Ativas */}
            {activeAnalyses.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-1 w-8 bg-gradient-to-r from-success to-success/50 rounded-full" />
                  <h2 className="text-2xl font-black text-success">Operações Ativas</h2>
                  <Badge className="bg-success/20 text-success border-success/30">{activeAnalyses.length}</Badge>
                </div>
                <div className="grid gap-3">
                  {activeAnalyses.map(a => (
                    <Card
                      key={a.id}
                      className="group relative overflow-hidden border-2 border-success/30 transition-all hover:shadow-lg hover:border-success/60 cursor-pointer bg-gradient-to-br from-success/5 to-success/2"
                      onClick={() => navigate(`/analysis/${a.id}`)}
                    >
                      <CardContent className="flex items-start justify-between py-5 px-5 gap-4">
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-lg font-bold">{a.name}</p>
                            {a.underlying_asset && (
                              <Badge className="bg-success/20 text-success border-success/30">
                                {a.underlying_asset}
                              </Badge>
                            )}
                            <Badge className="bg-success/20 text-success border-success/30">
                              🟢 Ativa
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
                            <p className="text-sm text-foreground line-clamp-2 pt-2 border-t border-success/10">
                              <span className="font-semibold text-xs uppercase tracking-wider text-success">IA:</span> {a.ai_suggestion}
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
                            disabled={closing === a.id}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-success hover:text-success"
                            onClick={(e) => handleCloseOperation(e, a.id, a.name)}
                          >
                            {closing === a.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <LogOut className="h-4 w-4" />
                            )}
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
              </div>
            )}

            {/* Estruturas Encerradas */}
            {closedAnalyses.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-1 w-8 bg-gradient-to-r from-warning to-warning/50 rounded-full" />
                  <h2 className="text-2xl font-black text-warning">Operações Encerradas</h2>
                  <Badge className="bg-warning/20 text-warning border-warning/30">{closedAnalyses.length}</Badge>
                </div>
                <div className="grid gap-3">
                  {closedAnalyses.map(a => (
                    <Card
                      key={a.id}
                      className="group relative overflow-hidden border-2 border-warning/30 transition-all hover:shadow-lg hover:border-warning/60 cursor-pointer bg-gradient-to-br from-warning/5 to-warning/2"
                      onClick={() => navigate(`/analysis/${a.id}`)}
                    >
                      <CardContent className="flex items-start justify-between py-5 px-5 gap-4">
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-lg font-bold">{a.name}</p>
                            {a.underlying_asset && (
                              <Badge className="bg-warning/20 text-warning border-warning/30">
                                {a.underlying_asset}
                              </Badge>
                            )}
                            <Badge className="bg-warning/20 text-warning border-warning/30">
                              ⏹️ Encerrada
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
                            <p className="text-sm text-foreground line-clamp-2 pt-2 border-t border-warning/10">
                              <span className="font-semibold text-xs uppercase tracking-wider text-warning">IA:</span> {a.ai_suggestion}
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
                            Editar
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
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
