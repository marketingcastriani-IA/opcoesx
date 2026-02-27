import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Trash2, Plus, Calendar, DollarSign, Loader2, BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClosedOperation {
  id: string;
  name: string;
  asset: string;
  entryDate: string;
  exitDate: string;
  profitLoss: number;
  percentage: number;
  strategy: string;
}

export default function Portfolio() {
  const { user, loading: authLoading } = useAuth();
  const [operations, setOperations] = useState<ClosedOperation[]>(() => {
    try {
      const saved = localStorage.getItem('portfolio_operations');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    asset: '',
    entryDate: '',
    exitDate: '',
    profitLoss: 0,
    strategy: '',
  });

  const stats = {
    totalPL: operations.reduce((sum, op) => sum + op.profitLoss, 0),
    wins: operations.filter(op => op.profitLoss > 0).length,
    losses: operations.filter(op => op.profitLoss < 0).length,
    winRate: operations.length > 0 ? ((operations.filter(op => op.profitLoss > 0).length / operations.length) * 100).toFixed(1) : '0',
    avgWin: operations.length > 0 ? (operations.filter(op => op.profitLoss > 0).reduce((sum, op) => sum + op.profitLoss, 0) / Math.max(operations.filter(op => op.profitLoss > 0).length, 1)).toFixed(2) : '0',
    avgLoss: operations.length > 0 ? (operations.filter(op => op.profitLoss < 0).reduce((sum, op) => sum + op.profitLoss, 0) / Math.max(operations.filter(op => op.profitLoss < 0).length, 1)).toFixed(2) : '0',
  };

  const handleAddOperation = () => {
    if (!formData.name || !formData.asset || formData.profitLoss === 0) return;

    const newOp: ClosedOperation = {
      id: Date.now().toString(),
      name: formData.name,
      asset: formData.asset,
      entryDate: formData.entryDate,
      exitDate: formData.exitDate,
      profitLoss: formData.profitLoss,
      percentage: ((formData.profitLoss / Math.abs(formData.profitLoss)) * 2.5),
      strategy: formData.strategy,
    };

    const updatedOperations = [...operations, newOp];
    setOperations(updatedOperations);
    localStorage.setItem('portfolio_operations', JSON.stringify(updatedOperations));
    setFormData({ name: '', asset: '', entryDate: '', exitDate: '', profitLoss: 0, strategy: '' });
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Tem certeza que deseja deletar esta operação?')) return;
    setDeleting(id);
    setTimeout(() => {
      const updatedOperations = operations.filter(op => op.id !== id);
      setOperations(updatedOperations);
      localStorage.setItem('portfolio_operations', JSON.stringify(updatedOperations));
      setDeleting(null);
    }, 300);
  };

  useEffect(() => {
    localStorage.setItem('portfolio_operations', JSON.stringify(operations));
  }, [operations]);

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-background pb-16">
      <Header />
      <main className="container py-6 space-y-6 animate-fade-in">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">Portfólio de Operações</h1>
          <p className="text-lg text-muted-foreground">Acompanhe suas operações encerradas, lucros e performance</p>
        </div>

        {/* Stats Cards - Premium Layout */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {/* Total P&L */}
          <Card className={cn(
            "relative overflow-hidden border-2 lg:col-span-2",
            stats.totalPL >= 0 
              ? "border-success/40 bg-gradient-to-br from-success/10 to-card" 
              : "border-destructive/40 bg-gradient-to-br from-destructive/10 to-card"
          )}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">Total P&L</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className={cn(
                  "text-3xl font-black",
                  stats.totalPL >= 0 ? "text-success" : "text-destructive"
                )}>
                  R$ {Math.abs(stats.totalPL).toFixed(2)}
                </div>
                <div className="flex items-center gap-2">
                  {stats.totalPL >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-success" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-destructive" />
                  )}
                  <span className={cn(
                    "text-xs font-semibold",
                    stats.totalPL >= 0 ? "text-success" : "text-destructive"
                  )}>
                    {stats.totalPL >= 0 ? '+' : ''}{((stats.totalPL / Math.max(Math.abs(stats.totalPL), 1)) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Win Rate */}
          <Card className="relative overflow-hidden border-2 border-blue-500/40 bg-gradient-to-br from-blue-500/10 to-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">Taxa de Acerto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-3xl font-black text-blue-500">{stats.winRate}%</div>
                <div className="text-xs text-muted-foreground">{stats.wins}W / {stats.losses}L</div>
              </div>
            </CardContent>
          </Card>

          {/* Avg Win */}
          <Card className="relative overflow-hidden border-2 border-success/40 bg-gradient-to-br from-success/10 to-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">Ganho Médio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-3xl font-black text-success">R$ {stats.avgWin}</div>
                <div className="text-xs text-muted-foreground">{stats.wins} operações</div>
              </div>
            </CardContent>
          </Card>

          {/* Avg Loss */}
          <Card className="relative overflow-hidden border-2 border-destructive/40 bg-gradient-to-br from-destructive/10 to-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">Perda Média</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-3xl font-black text-destructive">R$ {Math.abs(parseFloat(stats.avgLoss as string)).toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">{stats.losses} operações</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Add Operation Button */}
        <div className="flex justify-end">
          <Button 
            onClick={() => setShowForm(!showForm)}
            className="gap-2 shadow-lg shadow-primary/50"
          >
            <Plus className="h-4 w-4" />
            Nova Operação
          </Button>
        </div>

        {/* Add Operation Form */}
        {showForm && (
          <Card className="border-2 border-primary/40 bg-gradient-to-br from-primary/5 to-card">
            <CardHeader>
              <CardTitle>Registrar Nova Operação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome da Operação</Label>
                  <Input 
                    placeholder="Ex: Compra Coberta PETR4"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ativo</Label>
                  <Input 
                    placeholder="Ex: PETR4"
                    value={formData.asset}
                    onChange={e => setFormData({...formData, asset: e.target.value.toUpperCase()})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data de Entrada</Label>
                  <Input 
                    type="date"
                    value={formData.entryDate}
                    onChange={e => setFormData({...formData, entryDate: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data de Saída</Label>
                  <Input 
                    type="date"
                    value={formData.exitDate}
                    onChange={e => setFormData({...formData, exitDate: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Lucro/Prejuízo (R$)</Label>
                  <Input 
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.profitLoss || ''}
                    onChange={e => setFormData({...formData, profitLoss: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estratégia</Label>
                  <Input 
                    placeholder="Ex: Covered Call"
                    value={formData.strategy}
                    onChange={e => setFormData({...formData, strategy: e.target.value})}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button onClick={handleAddOperation}>Adicionar</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Operations Table */}
        <Card className="border-2 border-border/40 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Histórico de Operações
            </CardTitle>
          </CardHeader>
          <CardContent>
            {operations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma operação registrada ainda
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40">
                      <th className="text-left py-3 px-4 font-semibold">Operação</th>
                      <th className="text-left py-3 px-4 font-semibold">Ativo</th>
                      <th className="text-left py-3 px-4 font-semibold">Estratégia</th>
                      <th className="text-left py-3 px-4 font-semibold">Entrada</th>
                      <th className="text-left py-3 px-4 font-semibold">Saída</th>
                      <th className="text-right py-3 px-4 font-semibold">P&L</th>
                      <th className="text-center py-3 px-4 font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operations.map(op => (
                      <tr 
                        key={op.id}
                        className={cn(
                          "border-b border-border/20 hover:bg-primary/5 transition-colors",
                          deleting === op.id && "opacity-50"
                        )}
                      >
                        <td className="py-3 px-4 font-semibold">{op.name}</td>
                        <td className="py-3 px-4"><Badge variant="outline">{op.asset}</Badge></td>
                        <td className="py-3 px-4 text-xs text-muted-foreground">{op.strategy}</td>
                        <td className="py-3 px-4 text-xs">{new Date(op.entryDate).toLocaleDateString('pt-BR')}</td>
                        <td className="py-3 px-4 text-xs">{new Date(op.exitDate).toLocaleDateString('pt-BR')}</td>
                        <td className={cn(
                          "py-3 px-4 text-right font-black",
                          op.profitLoss >= 0 ? "text-success" : "text-destructive"
                        )}>
                          {op.profitLoss >= 0 ? '+' : ''}R$ {op.profitLoss.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(op.id)}
                            disabled={deleting === op.id}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            {deleting === op.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
