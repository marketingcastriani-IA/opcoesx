import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import AnalysisDetail from "./pages/AnalysisDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/history" element={<History />} />
              <Route path="/analysis/:id" element={<AnalysisDetail />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          <footer className="fixed bottom-0 left-0 right-0 border-t border-border/60 bg-background/95 px-4 py-2 text-[10px] text-muted-foreground backdrop-blur">
            AVISO LEGAL: Este aplicativo é uma ferramenta de simulação algorítmica baseada nas regras de calendário e letras de vencimento da B3 (A-L para Calls, M-X para Puts). Os dados apresentados não constituem recomendação de investimento, compra ou venda de ativos. O cálculo de CDI é uma projeção. Verifique os dados com sua corretora antes de operar.
          </footer>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
