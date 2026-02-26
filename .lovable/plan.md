
# Correcao do Salvamento + Edicao de Estrategias + Assistente de Saida

## Problema 1: Erro ao salvar
A constraint `legs_option_type_check` no banco so permite `'call'` e `'put'`, mas o app envia `'stock'` para pernas de ativo-objeto.

**Solucao**: Migracao SQL para atualizar a constraint incluindo `'stock'`.

## Problema 2: Nao permite editar estrategias salvas
A pagina History lista as analises mas navega para `/analysis/:id` que nao existe. Nao ha como editar valores de mercado atuais para reavaliar a posicao.

## Problema 3: Nao ha assistente de saida
O usuario quer saber se deve encerrar a operacao no momento, com base nos precos atuais de mercado vs. o que foi montado.

---

## Plano de Implementacao

### 1. Migracao SQL
- Dropar constraint `legs_option_type_check`
- Recriar com `CHECK (option_type IN ('call', 'put', 'stock'))`

### 2. Nova pagina: `src/pages/AnalysisDetail.tsx`
Pagina completa para visualizar e editar uma analise salva:

- Carregar analise + pernas do banco pelo `id` da URL
- Exibir todos os componentes do Dashboard (MetricsCards, PayoffChart, CDIComparison)
- **Campos editaveis "Precos Atuais"**: Para cada perna, um input de "Preco Atual" ao lado do preco original
- Calculo automatico de P&L parcial: `(precoAtual - precoOriginal) * qty * multiplicador`
- **Card "Devo Sair?"** com logica:
  - Se lucro atual > 80% do lucro maximo -> "Considere encerrar: ja capturou X% do ganho maximo"
  - Se lucro atual > CDI do periodo restante -> "Operacao ja superou o CDI. Encerrar trava o lucro"
  - Se prejuizo atual > 50% da perda maxima -> "Atencao: prejuizo significativo. Avalie stop"
  - Se dias restantes < 5 -> "Vencimento proximo. Avalie encerramento para evitar exercicio"
- Botao "Encerrar Operacao" que muda status para "closed" no banco
- Botao "Atualizar Valores" que salva os novos precos no banco (update legs)
- Botao "Pedir Sugestao IA" que envia os dados atualizados para a edge function

### 3. Rota no App.tsx
- Adicionar rota `/analysis/:id` apontando para `AnalysisDetail`

### 4. Melhorias na History
- Mostrar badge de P&L se houver precos atuais salvos
- Botao rapido "Avaliar Saida" ao lado de cada analise ativa

### 5. Coluna `current_price` na tabela `legs`
- Adicionar coluna opcional `current_price numeric` na tabela `legs` para salvar o preco atual de mercado quando o usuario atualizar

---

## Arquivos

| Arquivo | Acao |
|---|---|
| Migracao SQL | Corrigir constraint + adicionar coluna current_price |
| `src/pages/AnalysisDetail.tsx` | **NOVO** - Visualizar, editar e avaliar saida |
| `src/App.tsx` | Adicionar rota `/analysis/:id` |
| `src/pages/History.tsx` | Melhorar com badges e botao de avaliar saida |
| `src/pages/Dashboard.tsx` | Apos salvar, redirecionar para a pagina da analise |
