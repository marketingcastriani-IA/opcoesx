// Strategy auto-detection module (Collar, etc.)

import { Leg } from './types';
import { getUnderlyingRoot, getMonthFromLetter } from './b3-calendar';

export interface StrategyInfo {
  type: string;
  label: string;
  montageTotal: number;
  breakeven: number;
  maxProfit: number;
  maxLoss: number;
  isRiskFree: boolean;
}

function getExpiryMonth(ticker: string): number | null {
  if (!ticker || ticker.length < 5) return null;
  return getMonthFromLetter(ticker[4]);
}

export function detectStrategy(legs: Leg[]): StrategyInfo | null {
  if (legs.length < 3) return null;

  // Collar: Stock (buy) + Put (buy) + Call (sell), same underlying, same expiry month
  const stock = legs.find(l => l.option_type === 'stock' && l.side === 'buy');
  const put = legs.find(l => l.option_type === 'put' && l.side === 'buy');
  const call = legs.find(l => l.option_type === 'call' && l.side === 'sell');

  if (!stock || !put || !call) return null;

  const root = getUnderlyingRoot(stock.asset);
  const putRoot = getUnderlyingRoot(put.asset);
  const callRoot = getUnderlyingRoot(call.asset);

  if (!root || root !== putRoot || root !== callRoot) return null;

  const putMonth = getExpiryMonth(put.asset);
  const callMonth = getExpiryMonth(call.asset);

  if (!putMonth || !callMonth || putMonth !== callMonth) return null;

  // Collar detected — calculate metrics
  const qty = stock.quantity;
  const montageTotal = (stock.strike * qty) + (put.price * qty) - (call.price * qty);
  const breakeven = montageTotal / qty;
  const maxProfit = (call.strike - breakeven) * qty;
  const maxLoss = (breakeven - put.strike) * qty;
  const isRiskFree = put.strike >= breakeven;

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
