import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { TrendingUp, BarChart3, Shield, Zap, ArrowRight } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export default function Index() {
  const { user, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="container flex items-center justify-between py-4">
        <div className="flex items-center gap-2 font-bold text-lg">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <TrendingUp className="h-4 w-4 text-primary-foreground" />
          </div>
          OpçõesX
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="outline" onClick={() => navigate('/auth')}>Entrar</Button>
        </div>
      </header>

      <main className="container py-20 animate-fade-in">
        <section className="max-w-2xl mx-auto text-center space-y-6">
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight tracking-tight">
            Analise suas estruturas de opções com{' '}
            <span className="text-primary">inteligência</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto">
            Cole um print da sua plataforma ou monte manualmente. Payoff, breakeven, comparativo com CDI e sugestão da IA em segundos.
          </p>
          <Button size="lg" className="text-base" onClick={() => navigate('/auth')}>
            Começar agora <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </section>

        <section className="grid sm:grid-cols-3 gap-6 mt-20 max-w-3xl mx-auto">
          {[
            { icon: Zap, title: 'OCR Inteligente', desc: 'Cole um print e a IA extrai automaticamente as pernas da estrutura.' },
            { icon: BarChart3, title: 'Gráfico de Payoff', desc: 'Visualize lucro e prejuízo em cada cenário de preço do ativo.' },
            { icon: Shield, title: 'Gestão de Risco', desc: 'Compare com CDI, veja breakeven e receba sugestões da IA.' },
          ].map(f => (
            <div key={f.title} className="text-center space-y-3 p-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <f.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
