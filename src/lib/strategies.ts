// Strategy auto-detection module (Collar, Covered Call, etc.)

import { Leg } from './types';
import { getUnderlyingRoot, getMonthFromLetter } from './b3-calendar';

export interface StrategyInfo {
  type: string;
  label: string;
  montageTotal: number;
  breakeven: number;
  maxProfit: number | 'Ilimitado';
  maxLoss: number | 'Ilimitado';
  isRiskFree: boolean;
}

function getExpiryMonth(ticker: string): number | null {
  if (!ticker || ticker.length < 5) return null;
  return getMonthFromLetter(ticker[4]);
}

export function detectStrategy(legs: Leg[]): StrategyInfo | null {
  if (legs.length < 2) return null;

  const stockBuy = legs.find(l => l.option_type === 'stock' && l.side === 'buy');
  const callSell = legs.find(l => l.option_type === 'call' && l.side === 'sell');
  const putBuy = legs.find(l => l.option_type === 'put' && l.side === 'buy');

  // ─── Compra Coberta (Covered Call): Ativo comprado + Call vendida ───────────
  if (stockBuy && callSell && !putBuy && legs.length === 2) {
    const qty = Math.min(stockBuy.quantity, callSell.quantity);
    // Custo de montagem: preço do ativo - prêmio recebido da call
    const montageTotal = (stockBuy.price * qty) - (callSell.price * qty);
    const breakeven = montageTotal / qty;

    // Lucro máximo: ativo sobe até o strike da call
    // Acima do strike, o lucro é travado (call vendida limita o upside)
    const maxProfit = (callSell.strike - breakeven) * qty;

    // Risco máximo: ativo vai a zero → perde o custo de montagem
    const maxLoss = -montageTotal;

    const isRiskFree = false;

    return {
      type: 'CoveredCall',
      label: 'Op. Compra Coberta',
      montageTotal: Math.round(montageTotal * 100) / 100,
      breakeven: Math.round(breakeven * 100) / 100,
      maxProfit: Math.round(maxProfit * 100) / 100,
      maxLoss: Math.round(maxLoss * 100) / 100,
      isRiskFree,
    };
  }

  // ─── Collar: Ativo comprado + Put comprada + Call vendida ────────────────────
  if (stockBuy && putBuy && callSell && legs.length >= 3) {
    const root = getUnderlyingRoot(stockBuy.asset);
    const putRoot = getUnderlyingRoot(putBuy.asset);
    const callRoot = getUnderlyingRoot(callSell.asset);

    if (!root || root !== putRoot || root !== callRoot) return null;

    const putMonth = getExpiryMonth(putBuy.asset);
    const callMonth = getExpiryMonth(callSell.asset);

    if (!putMonth || !callMonth || putMonth !== callMonth) return null;

    const qty = stockBuy.quantity;
    // Custo de montagem: preço do ativo + prêmio da put - prêmio da call
    const montageTotal = (stockBuy.price * qty) + (putBuy.price * qty) - (callSell.price * qty);
    const breakeven = montageTotal / qty;

    // Lucro máximo: ativo sobe até o strike da call
    const maxProfit = (callSell.strike - breakeven) * qty;
    // Risco máximo: ativo cai até o strike da put
    const maxLoss = (breakeven - putBuy.strike) * qty;
    const isRiskFree = putBuy.strike >= breakeven;

    return {
      type: 'Collar',
      label: 'Collar (Financiamento com Proteção)',
      montageTotal: Math.round(montageTotal * 100) / 100,
      breakeven: Math.round(breakeven * 100) / 100,
      maxProfit: Math.round(maxProfit * 100) / 100,
      maxLoss: isRiskFree ? 0 : Math.round(maxLoss * 100) / 100,
      isRiskFree,
    };
  }

  return null;
}
