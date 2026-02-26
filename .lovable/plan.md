# App de Análise de Estruturas de Opções 📊

## Visão Geral

Aplicativo para analisar estruturas de opções do mercado brasileiro, com entrada via imagem (OCR com IA) ou formulário manual, dashboard de análise com gráfico de payoff e comparativo com CDI.

---

## 1. Autenticação e Conta

- Tela de login/cadastro com email e senha
- Perfil do usuário com preferência de tema (claro/escuro)
- Histórico de análises salvas no banco de dados

## 2. Entrada de Dados (duas opções)

- **Upload de imagem / Ctrl+V**: Colar ou arrastar screenshot da plataforma de opções → a IA (Lovable AI) faz a leitura e extrai as pernas da estrutura automaticamente
- **Entrada manual**: Formulário para adicionar pernas (Compra/Venda, Call/Put, Ativo, Strike, Preço, Quantidade)
- Após a leitura, mostrar os dados extraídos para o usuário confirmar/editar antes de analisar
- E PERMITIR EDITAR AS PERNAS E OU INCLUIR NOVA PERNAS 

## 3. Dashboard de Análise

- **Tabela da Estrutura**: Exibição das pernas como na tela de referência (lado, call/put, ativo, strike, preço, quantidade)
- **Métricas principais em cards**: Ganho Máximo, Perda Máxima, Breakeven, Delta, Theta, POP
- **Explicação em texto** de cada métrica para o usuário entender os riscos
- **Sugestão da IA**: Recomendação se vale a pena ou não montar a estrutura

## 4. Gráfico de Payoff

- Gráfico interativo mostrando lucro/prejuízo por preço do ativo
- Linhas "Hoje" e "No Vencimento" como na referência
- Tema escuro ou claro conforme preferência

## 5. Comparativo com CDI

- Usuário digita a taxa CDI atual e o prazo até o vencimento
- Comparativo do retorno da estrutura vs CDI no período
- Opção de comparar **com** e **sem** Imposto de Renda (tanto no CDI quanto nas opções)
- Tabela/gráfico mostrando qual alternativa é mais vantajosa

## 6. Histórico

- Lista de análises anteriores salvas
- Possibilidade de reabrir e revisar análises passadas

## Infraestrutura

- **Lovable Cloud** com Supabase para autenticação, banco de dados e edge functions
- **Lovable AI** (Gemini) para OCR das imagens e geração de sugestões
- Tema claro/escuro com toggle

7-   E QUANDO SALVAR A ESTRATEGIA , PERMITIR EDITAR  PARA VER SE ESTA VALENDO A PENA ENCERRAR A OPERAÇÃO OU NÃO DE ACORDO COM OS NOVOS VALORES  DAS PERNAS.

&nbsp;

SUGIRA UM NOME PARA O APLICATIVO PARA SER O MAIOR DIFERENCIAL DO MERCADO BRASILEIRO 

&nbsp;