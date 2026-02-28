import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Lock, Mail, LogOut, Shield, Database, Copy, Check } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

export default function Settings() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);

  const schemaSQL = `-- ============================
-- OpçõesX - Schema SQL Completo
-- ============================

-- Enum de roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Tabela: analyses
CREATE TABLE public.analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Análise sem nome',
  underlying_asset TEXT,
  cdi_rate NUMERIC,
  days_to_expiry INTEGER,
  ai_suggestion TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own analyses" ON public.analyses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own analyses" ON public.analyses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own analyses" ON public.analyses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own analyses" ON public.analyses FOR DELETE USING (auth.uid() = user_id);

-- Tabela: legs
CREATE TABLE public.legs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID NOT NULL REFERENCES public.analyses(id),
  side TEXT NOT NULL,
  option_type TEXT NOT NULL,
  asset TEXT NOT NULL,
  strike NUMERIC NOT NULL,
  price NUMERIC NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  current_price NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.legs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view legs of own analyses" ON public.legs FOR SELECT
  USING (EXISTS (SELECT 1 FROM analyses WHERE analyses.id = legs.analysis_id AND analyses.user_id = auth.uid()));
CREATE POLICY "Users can insert legs to own analyses" ON public.legs FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM analyses WHERE analyses.id = legs.analysis_id AND analyses.user_id = auth.uid()));
CREATE POLICY "Users can update legs of own analyses" ON public.legs FOR UPDATE
  USING (EXISTS (SELECT 1 FROM analyses WHERE analyses.id = legs.analysis_id AND analyses.user_id = auth.uid()));
CREATE POLICY "Users can delete legs of own analyses" ON public.legs FOR DELETE
  USING (EXISTS (SELECT 1 FROM analyses WHERE analyses.id = legs.analysis_id AND analyses.user_id = auth.uid()));

-- Tabela: profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  display_name TEXT,
  theme_preference TEXT NOT NULL DEFAULT 'dark',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Tabela: user_access
CREATE TABLE public.user_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  trial_days INTEGER NOT NULL DEFAULT 0,
  approved_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own access" ON public.user_access FOR SELECT
  USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert access" ON public.user_access FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin') OR (auth.uid() = user_id));
CREATE POLICY "Admins can update access" ON public.user_access FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete access" ON public.user_access FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- Tabela: user_roles
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR (auth.uid() = user_id));
CREATE POLICY "Only admins can insert roles" ON public.user_roles FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins can update roles" ON public.user_roles FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins can delete roles" ON public.user_roles FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- Funções
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.has_active_access(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_access
    WHERE user_id = _user_id AND status = 'approved' AND (expires_at IS NULL OR expires_at > now())
  ) OR public.has_role(_user_id, 'admin')
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user_access()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.user_access (user_id, status) VALUES (NEW.id, 'pending');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;`;

  const handleCopySQL = async () => {
    try {
      await navigator.clipboard.writeText(schemaSQL);
      setSqlCopied(true);
      toast.success('SQL copiado para a área de transferência!');
      setTimeout(() => setSqlCopied(false), 2000);
    } catch {
      toast.error('Erro ao copiar SQL');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || !confirmPassword) {
      toast.error('Preencha todos os campos');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('As senhas não conferem');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success('Senha alterada com sucesso!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error('Erro ao alterar senha', {
        description: err.message || 'Tente novamente',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/auth');
      toast.success('Desconectado com sucesso');
    } catch (err: any) {
      toast.error('Erro ao desconectar', {
        description: err.message || 'Tente novamente',
      });
    }
  };

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-background pb-16">
      <Header />
      <main className="container py-6 space-y-6 animate-fade-in">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight">Configurações</h1>
          <p className="text-lg text-muted-foreground">Gerencie sua conta e preferências</p>
        </div>

        {/* Account Info */}
        <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/[0.08] to-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Informações da Conta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/50 border border-muted-foreground/20">
                <p className="text-sm font-medium flex-1">{user.email}</p>
                <Badge className="bg-success/20 text-success border-success/30 text-xs">Verificado</Badge>
              </div>
            </div>
            <div className="space-y-2">
              <Label>ID da Conta</Label>
              <div className="px-4 py-2 rounded-lg bg-muted/50 border border-muted-foreground/20">
                <p className="text-xs font-mono text-muted-foreground">{user.id}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Membro desde</Label>
              <p className="text-sm text-muted-foreground">
                {new Date(user.created_at || '').toLocaleDateString('pt-BR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card className="border-2 border-warning/30 bg-gradient-to-br from-warning/[0.08] to-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-warning" />
              Alterar Senha
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova Senha</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar Senha</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirme a nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
              <Button 
                type="submit" 
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Alterando...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Alterar Senha
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* SQL Schema */}
        <Card className="border-2 border-info/30 bg-gradient-to-br from-info/[0.08] to-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Database className="h-5 w-5 text-info" />
                SQL das Tabelas
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopySQL}
                className="border-info/30 hover:bg-info/10"
              >
                {sqlCopied ? (
                  <><Check className="mr-1 h-4 w-4 text-success" /> Copiado!</>
                ) : (
                  <><Copy className="mr-1 h-4 w-4" /> Copiar SQL</>
                )}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              readOnly
              value={schemaSQL}
              className="font-mono text-xs leading-relaxed h-80 resize-y bg-muted/30 border-muted-foreground/20"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Use este SQL para recriar todas as tabelas, políticas RLS e funções em outro projeto.
            </p>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-2 border-destructive/30 bg-gradient-to-br from-destructive/[0.08] to-card">
          <CardHeader>
            <CardTitle className="text-destructive">Zona de Perigo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Você será desconectado de sua conta em todos os dispositivos.
              </p>
              <Button 
                onClick={handleLogout}
                variant="destructive"
                className="w-full"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Desconectar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Info */}
        <Card className="border-dashed border-2 border-muted-foreground/30">
          <CardContent className="p-6 space-y-2">
            <p className="text-sm font-semibold text-foreground">OpçõesX Pro</p>
            <p className="text-xs text-muted-foreground">
              Versão 1.0.0 • Acesso até 2028 • Suporte 24/7
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

// Badge component inline
function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}
