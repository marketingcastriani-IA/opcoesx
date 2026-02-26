
# Refatoracao Institucional Completa do OpcoesX

## Resumo

Transformar o app em ferramenta de nivel profissional com: OCR preciso para BTG/Profit, motor de calendario B3 2026, calculo de Collar com custo real de montagem, comparativo CDI como custo de oportunidade, e grafico de payoff com 3 zonas de cor (vermelho/laranja/verde).

---

## 1. Novo modulo: `src/lib/b3-calendar.ts`

Centralizar toda logica de calendario e identificacao de tickers:

- **Tabela de letras B3**: A-L (Calls Jan-Dez), M-X (Puts Jan-Dez)
- **Vencimentos 2026 hardcoded**: 16/01, 20/02, 20/03, 17/04, 15/05, 19/06, 17/07, 21/08, 18/09, 16/10, 19/11, 18/12
- **Feriados bancarios 2026**: para calculo de dias uteis
- **`getExpiryFromTicker(ticker)`**: extrai 5a letra, retorna data de vencimento e tipo (call/put)
- **`countBusinessDays(from, to)`**: calcula dias uteis excluindo fins de semana e feriados
- **`getOptionTypeFromLetter(letter)`**: retorna "call" ou "put" baseado na letra
- Remover duplicacao dessas funcoes do Dashboard.tsx e CDIComparison.tsx

---

## 2. Novo modulo: `src/lib/strategies.ts`

Auto-deteccao de estrategias:

- **`detectStrategy(legs)`**: Retorna objeto com tipo da estrategia e metricas especificas
- **Collar**: Stock (buy) + Put (buy) + Call (sell), mesmo ativo-base, mesmo vencimento
  - Custo de montagem: `(preco_ativo * qty) + (premio_put * qty) - (premio_call * qty)`
  - Breakeven real: `custo_total / qty`
  - Lucro max: `(strike_call - breakeven) * qty`
  - Perda max: `(breakeven - strike_put) * qty` -- se negativo, "Risco Zero"
  - Exemplo do print: `(39.41*100) + (1.53*100) - (1.82*100) = R$ 3.912,00` -> breakeven = 39.12
- Retorna `{ type: "Collar", label: "Collar (Financiamento com Protecao)", montageTotal, breakeven, maxProfit, maxLoss, isRiskFree }`

---

## 3. OCR: Edge Function `analyze-options-image`

Refinar o prompt do Gemini para leitura precisa do BTG/Profit:

- **Regra estrita de sinais**: "C" (botao verde) = "buy", "V" (botao roxo/vermelho) = "sell"
- **Ativo-objeto**: Quando coluna Call/Put mostra "-", e o ticker e tipo base (PETR4, VALE3), extrair como `option_type: "stock"`, `side: "buy"`, `price: 0`, `strike: preco_unitario`
- **Identificacao por letra do ticker**: PETRP... = Put (P = Abril), PETRD... = Call (D = Abril)
- **Instrucao de dupla verificacao**: "Conte as linhas da tabela. Se a imagem tem 3 linhas, voce DEVE retornar exatamente 3 pernas"
- **Valores em BRL**: normalizar "BRL 39,41" -> 39.41, "BRL 1,53" -> 1.53
- Na normalizacao backend: garantir `quantity` sempre positivo, `side` determina direcao

---

## 4. Atualizar `src/lib/types.ts`

Adicionar campos ao `AnalysisMetrics`:

```text
strategyType?: string
strategyLabel?: string
montageTotal?: number
realBreakeven?: number
isRiskFree?: boolean
cdiReturn?: number
cdiEfficiency?: number  // % do CDI (ex: 166%)
```

---

## 5. Atualizar `src/lib/payoff.ts`

- **`calculateMetrics`**: Integrar `detectStrategy()` para enriquecer metricas com dados do Collar
- **`calculateCollarNetCost`**: Funcao especifica: `(stock.strike * qty) + (put.price * qty) - (call.price * qty)`
- **CDI no payoff**: Exportar funcao `calculateCDIOpportunityCost(capital, rate, businessDays)` usando formula `capital * ((1 + rate/100)^(days/252) - 1)`
- Manter `netCost` generico para estruturas que nao sao Collar

---

## 6. `src/components/PayoffChart.tsx` -- Grafico Profissional

Reescrever com 3 zonas de cor relativas ao CDI:

- **Vermelho** (area abaixo de zero): prejuizo
- **Laranja** (area entre zero e CDI): lucro, mas perde para renda fixa
- **Verde** (area acima do CDI): operacao vencedora
- **Linha CDI horizontal tracejada**: cor dourada (hsl 45 95% 55%), com label "CDI R$ X.XX"
- **Linha de payoff principal**: branca/clara, 2px
- **Breakeven markers**: linhas verticais tracejadas amarelas
- Receber `cdiReturn` calculado como prop para posicionar a linha corretamente

---

## 7. `src/components/MetricsCards.tsx` -- Cards Institucionais

5 cards com estilo terminal Bloomberg:

| Card | Calculo |
|---|---|
| Custo de Montagem | Para Collar: (Ativo + Put - Call) * Qty. Generico: netCost |
| Lucro Maximo | (Strike Call - Breakeven) * Qty ou metrica generica |
| Risco Maximo | (Breakeven - Strike Put) * Qty. Se negativo: "Risco Zero" |
| Breakeven Real | Custo Total / Qty |
| Eficiencia vs CDI | "166% do CDI" ou "+X.XX% acima do CDI" |

- Fonte monoesspacada (JetBrains Mono) em todos os valores
- Badge "RISCO ZERO" em verde quando strike da put > breakeven
- Badge "VENCE O CDI" quando eficiencia > 100%

---

## 8. `src/components/CDIComparison.tsx` -- Comparador Completo

- Manter inputs de CDI e dias uteis
- **Auto-preenchimento**: quando legs mudam, inferir vencimento pela letra do ticker e calcular dias uteis automaticamente
- **Card principal**: "Esta estrutura rende X% do CDI esperado"
- **Barras comparativas**: Retorno da Estrutura vs Retorno CDI no periodo
- Usar `countBusinessDays` do modulo centralizado `b3-calendar.ts`
- Remover duplicacao de funcoes de calendario

---

## 9. `src/pages/Dashboard.tsx` -- Integracao

- Importar `detectStrategy` e `b3-calendar`
- Remover funcoes duplicadas (calendar, holidays, countBusinessDays)
- Quando Collar detectado: mostrar badge "Collar (Financiamento com Protecao)" e card especifico com custo real
- Passar `strategyInfo` para MetricsCards e CDIComparison
- CDI padrao: 14.90%
- Auto-inferir vencimento e dias uteis dos tickers

---

## 10. `analyze-structure` Edge Function -- IA Objetiva

- Incluir dados do Collar no prompt: custo real, breakeven, se e risco zero
- Incluir comparativo CDI calculado no prompt
- Resposta mais curta e objetiva: veredito em 1 linha + justificativa em 2 linhas max
- Adicionar campo `cdi_efficiency` no schema de resposta

---

## 11. Visual Dark Mode Profissional

- Manter tema Slate/Zinc atual (ja esta bom)
- Garantir `font-mono` (JetBrains Mono) em TODOS os valores financeiros
- Cards com bordas sutis, fundo `bg-muted/20`
- Footer juridico ja existe -- manter

---

## Arquivos Modificados

| Arquivo | Acao |
|---|---|
| `src/lib/b3-calendar.ts` | **NOVO** -- calendario centralizado, dias uteis, feriados |
| `src/lib/strategies.ts` | **NOVO** -- deteccao de Collar e calculo de metricas especificas |
| `src/lib/types.ts` | Adicionar campos de estrategia ao AnalysisMetrics |
| `src/lib/payoff.ts` | Integrar strategies, CDI oportunidade |
| `supabase/functions/analyze-options-image/index.ts` | Prompt OCR refinado para BTG |
| `supabase/functions/analyze-structure/index.ts` | Prompt mais objetivo + dados Collar |
| `src/components/PayoffChart.tsx` | 3 zonas de cor + linha CDI dourada |
| `src/components/MetricsCards.tsx` | Cards estilo terminal com metricas Collar |
| `src/components/CDIComparison.tsx` | Comparador com eficiencia % do CDI |
| `src/pages/Dashboard.tsx` | Integrar modules, remover duplicacao |
