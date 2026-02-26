# Melhorias no OpçõesX: OCR, Payoff com CDI e UX

## Problemas identificados

1. **OCR faltando perna**: A primeira linha da imagem (Compra PETR4 a 39,55) nao tem Call/Put (e o campo "-"), e o OCR descarta porque exige `option_type`. Essa e uma perna de ativo-objeto (compra/venda do ativo diretamente), que precisa ser tratada como tipo especial.
2. **Sem botao X para limpar imagem**: Nao tem como remover a imagem carregada e trocar por outra sem clicar de novo.
3. **Grafico de payoff sem linha CDI**: Falta a linha laranja do CDI para comparacao visual.
4. **CDI base padrao**: Deveria comecar com 14,90% e nao 0.
5. **Destaque da diferenca vs CDI**: Falta mostrar em destaque o % acima/abaixo do CDI.

---

## Plano de implementacao

&nbsp;

## 📅 Regra de Vencimento de Opções (B3)

Para calcular a data correta, o sistema deve cruzar o **mês/tipo** (identificado pela letra no código da opção) com o calendário vigente.

### 1. Tabela de Identificação por Letras

O código da opção (ticker) possui uma letra que indica o mês e se é uma **Call** (Compra) ou **Put** (Venda).


|           |          |         |
| --------- | -------- | ------- |
| **Mês**   | **Call** | **Put** |
| Janeiro   | **A**    | **M**   |
| Fevereiro | **B**    | **N**   |
| Março     | **C**    | **O**   |
| Abril     | **D**    | **P**   |
| Maio      | **E**    | **Q**   |
| Junho     | **F**    | **R**   |
| Julho     | **G**    | **S**   |
| Agosto    | **H**    | **T**   |
| Setembro  | **I**    | **U**   |
| Outubro   | **J**    | **V**   |
| Novembro  | **K**    | **W**   |
| Dezembro  | **L**    | **X**   |


---

### 2. Lógica do Cálculo (Algoritmo)

Para o seu app retornar a data exata, ele deve seguir este fluxo:

1. **Identificar o Mês:** Leia a 5ª letra do ticker (Ex: PETR**E**123 -> Letra E = Maio).
2. **Identificar o Ano:** Geralmente o ano vigente (ou o próximo, se a letra for de um mês já passado).
3. **Encontrar a 3ª Sexta-feira:** * Vá para o dia 01 do mês identificado.
  - Conte as sextas-feiras até chegar na terceira.
  - **Atenção:** Se a 3ª sexta-feira for feriado, o vencimento é antecipado para o dia útil anterior.

---

### 3. Exemplo de Texto para a Interface do Usuário

> "As opções da B3 vencem mensalmente na **terceira sexta-feira do mês**. A letra no código do ativo identifica o mês de expiração e o tipo da opção. Por exemplo, uma opção com a letra **'A'** vence em Janeiro e é uma **Call**, enquanto a letra **'M'** também vence em Janeiro, mas é uma **Put**."

---

### Dica para o Desenvolvedor

Se você estiver programando em Python ou JavaScript, não tente "chutar" o dia 15 ou 20. Use bibliotecas de calendário para encontrar o `weekday == 4` (sexta-feira) e conte a terceira ocorrência.

&nbsp;

ara o seu app funcionar perfeitamente em **2026**, aqui estão as datas exatas de vencimento das opções mensais da B3.

Como a regra é a **terceira sexta-feira do mês**, em meses onde esse dia cai em um feriado, o vencimento é **antecipado** para o dia útil anterior (quinta-feira).

### 📅 Calendário de Vencimento 2026


|               |          |         |                        |                                                |
| ------------- | -------- | ------- | ---------------------- | ---------------------------------------------- |
| **Mês**       | **Call** | **Put** | **Data de Vencimento** | **Observação**                                 |
| **Janeiro**   | A        | M       | **16/01/2026**         | &nbsp;                                         |
| **Fevereiro** | B        | N       | **20/02/2026**         | &nbsp;                                         |
| **Março**     | C        | O       | **20/03/2026**         | &nbsp;                                         |
| **Abril**     | D        | P       | **17/04/2026**         | &nbsp;                                         |
| **Maio**      | E        | Q       | **14/05/2026**         | Antecipado (15/05 é feriado de Maio*)          |
| **Junho**     | F        | R       | **19/06/2026**         | &nbsp;                                         |
| **Julho**     | G        | S       | **17/07/2026**         | &nbsp;                                         |
| **Agosto**    | H        | T       | **21/08/2026**         | &nbsp;                                         |
| **Setembro**  | I        | U       | **18/09/2026**         | &nbsp;                                         |
| **Outubro**   | J        | V       | **16/10/2026**         | &nbsp;                                         |
| **Novembro**  | K        | W       | **19/11/2026**         | Antecipado (20/11 é feriado Consciência Negra) |
| **Dezembro**  | L        | X       | **18/12/2026**         | &nbsp;                                         |


> **Nota importante para o seu código:** Em 2026, o feriado de 1º de Maio cai em uma sexta-feira, mas o vencimento de maio é na **terceira** sexta (dia 15). Como dia 15 não é feriado nacional, a data padrão se mantém. O único ajuste crítico por feriado nacional na terceira sexta-feira em 2026 é em **Novembro** (Dia da Consciência Negra).

---

### 💡 Dica de Implementação (Lógica de Feriados)

Para o seu app ser robusto, não basta calcular a 3ª sexta-feira. Você deve incluir uma verificação de **calendário de feriados bancários da B3**.

&nbsp;

e sempre ficar atento ao ano vigente automaticamente 

&nbsp;

### 1. Melhorar OCR (Edge Function `analyze-options-image`)

- Adicionar ao prompt e ao schema o suporte para `option_type: "stock"` (ativo-objeto, sem call/put)
- Instrucao explicita: "Se a linha nao tem Call/Put ou mostra '-', trate como compra/venda do ativo-objeto com option_type='stock'"
- Na normalizacao, aceitar `option_type: "stock"` como valido
- Adicionar instrucao de dupla verificacao: "Conte o numero de linhas da tabela e garanta que o numero de pernas extraidas e igual"

### 2. Atualizar tipo `Leg` e logica de payoff

- Adicionar `'stock'` ao tipo `option_type` em `src/lib/types.ts`
- Em `src/lib/payoff.ts`, tratar `option_type === 'stock'` no calculo: payoff = (spotPrice - strike) * multiplier * quantity (sem subtrair price separadamente, ou tratar strike como preco de compra)
- Na LegsTable, adicionar opcao "Ativo" no dropdown de tipo

### 3. Botao X para limpar imagem (`ImageUpload.tsx`)

- Adicionar botao X sobre a preview da imagem
- Ao clicar, limpa o preview e permite novo upload
- Impedir que o click do X propague e abra o file picker

### 4. Linha CDI no grafico de payoff (`PayoffChart.tsx`)

- Receber `cdiRate` e `daysToExpiry` como props
- Calcular retorno CDI para o capital investido e plotar como linha horizontal laranja
- Adicionar legenda "CDI" ao grafico

### 5. CDI padrao 14,90% e destaque vs CDI

- Em `Dashboard.tsx`, inicializar `cdiRate` com `14.90` em vez de `0`
- No `CDIComparison.tsx`, mostrar em destaque grande: "X% acima do CDI" ou "X% abaixo do CDI" com cor verde/vermelha
- Calcular a diferenca percentual entre o ROI da estrategia e o ROI do CDI

### 6. Correcoes na LegsTable

- Adicionar opcao "Ativo" no select de tipo para pernas tipo `stock`

---

## Detalhes tecnicos

### Arquivos modificados


| Arquivo                                             | Alteracao                                     |
| --------------------------------------------------- | --------------------------------------------- |
| `supabase/functions/analyze-options-image/index.ts` | Prompt + schema com stock, dupla verificacao  |
| `src/lib/types.ts`                                  | `option_type: 'call' | 'put' | 'stock'`       |
| `src/lib/payoff.ts`                                 | Calculo payoff para stock                     |
| `src/components/ImageUpload.tsx`                    | Botao X para limpar                           |
| `src/components/PayoffChart.tsx`                    | Linha CDI laranja                             |
| `src/components/CDIComparison.tsx`                  | Destaque % vs CDI                             |
| `src/components/LegsTable.tsx`                      | Opcao "Ativo" no dropdown                     |
| `src/pages/Dashboard.tsx`                           | CDI padrao 14.90, passar props ao PayoffChart |
