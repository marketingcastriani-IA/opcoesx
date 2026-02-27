
import { Leg } from './types';
import { getUnderlyingRoot, getMonthFromLetter } from './b3-calendar';

export interface StrategyInfo {
  type: string;
  label: string;
  montageTotal: number;
  breakeven: number | number[];
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

  // Sort legs by strike for easier processing of spreads
  const sortedLegs = [...legs].sort((a, b) => a.strike - b.strike);

  const stockBuy = sortedLegs.find(l => l.option_type === 'stock' && l.side === 'buy');
  const callSell = sortedLegs.find(l => l.option_type === 'call' && l.side === 'sell');
  const putBuy = sortedLegs.find(l => l.option_type === 'put' && l.side === 'buy');

  // ─── Compra Coberta (Covered Call): Ativo comprado + Call vendida ───────────
  if (stockBuy && callSell && !putBuy && sortedLegs.length === 2) {
    const qty = Math.min(stockBuy.quantity, callSell.quantity);
    const montageTotal = (stockBuy.price * qty) - (callSell.price * qty);
    const breakeven = montageTotal / qty;
    const maxProfit = (callSell.strike - breakeven) * qty;
    const maxLoss = montageTotal; // If stock goes to zero

    return {
      type: 'CoveredCall',
      label: 'Op. Compra Coberta',
      montageTotal: Math.round(montageTotal * 100) / 100,
      breakeven: Math.round(breakeven * 100) / 100,
      maxProfit: Math.round(maxProfit * 100) / 100,
      maxLoss: Math.round(maxLoss * 100) / 100,
      isRiskFree: false,
    };
  }

  // ─── Collar: Ativo comprado + Put comprada + Call vendida ────────────────────
  if (stockBuy && putBuy && callSell && sortedLegs.length === 3) {
    const root = getUnderlyingRoot(stockBuy.asset);
    const putRoot = getUnderlyingRoot(putBuy.asset);
    const callRoot = getUnderlyingRoot(callSell.asset);

    if (!root || root !== putRoot || root !== callRoot) return null;

    const putMonth = getExpiryMonth(putBuy.asset);
    const callMonth = getExpiryMonth(callSell.asset);

    if (!putMonth || !callMonth || putMonth !== callMonth) return null;

    const qty = stockBuy.quantity;
    const montageTotal = (stockBuy.price * qty) + (putBuy.price * qty) - (callSell.price * qty);
    const breakeven = montageTotal / qty;
    const maxProfit = (callSell.strike - breakeven) * qty;
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

  // ─── Trava de Alta com Call (Bull Call Spread): Compra Call K1 + Venda Call K2 (K1 < K2) ───
  const buyCall1 = sortedLegs.find(l => l.option_type === 'call' && l.side === 'buy' && l.strike < sortedLegs[sortedLegs.length - 1].strike);
  const sellCall2 = sortedLegs.find(l => l.option_type === 'call' && l.side === 'sell' && l.strike > sortedLegs[0].strike);

  if (buyCall1 && sellCall2 && sortedLegs.length === 2 && buyCall1.quantity === sellCall2.quantity) {
    const qty = buyCall1.quantity;
    const montageTotal = (buyCall1.price - sellCall2.price) * qty; // Débito
    const breakeven = buyCall1.strike + (montageTotal / qty);
    const maxProfit = (sellCall2.strike - buyCall1.strike - (montageTotal / qty)) * qty;
    const maxLoss = montageTotal;

    return {
      type: 'BullCallSpread',
      label: 'Trava de Alta com Call',
      montageTotal: Math.round(montageTotal * 100) / 100,
      breakeven: Math.round(breakeven * 100) / 100,
      maxProfit: Math.round(maxProfit * 100) / 100,
      maxLoss: Math.round(maxLoss * 100) / 100,
      isRiskFree: false,
    };
  }

  // ─── Trava de Baixa com Put (Bear Put Spread): Compra Put K1 + Venda Put K2 (K1 > K2) ───
  const buyPut1 = sortedLegs.find(l => l.option_type === 'put' && l.side === 'buy' && l.strike > sortedLegs[0].strike);
  const sellPut2 = sortedLegs.find(l => l.option_type === 'put' && l.side === 'sell' && l.strike < sortedLegs[sortedLegs.length - 1].strike);

  if (buyPut1 && sellPut2 && sortedLegs.length === 2 && buyPut1.quantity === sellPut2.quantity) {
    const qty = buyPut1.quantity;
    const montageTotal = (buyPut1.price - sellPut2.price) * qty; // Débito
    const breakeven = buyPut1.strike - (montageTotal / qty);
    const maxProfit = (buyPut1.strike - sellPut2.strike - (montageTotal / qty)) * qty;
    const maxLoss = montageTotal;

    return {
      type: 'BearPutSpread',
      label: 'Trava de Baixa com Put',
      montageTotal: Math.round(montageTotal * 100) / 100,
      breakeven: Math.round(breakeven * 100) / 100,
      maxProfit: Math.round(maxProfit * 100) / 100,
      maxLoss: Math.round(maxLoss * 100) / 100,
      isRiskFree: false,
    };
  }

  // ─── Straddle: Compra Call + Compra Put no mesmo Strike ───────────────────────
  const straddleCall = sortedLegs.find(l => l.option_type === 'call' && l.side === 'buy');
  const straddlePut = sortedLegs.find(l => l.option_type === 'put' && l.side === 'buy');
  
  if (straddleCall && straddlePut && sortedLegs.length === 2 && 
      Math.abs(straddleCall.strike - straddlePut.strike) < 0.01 &&
      straddleCall.quantity === straddlePut.quantity) {
    const qty = straddleCall.quantity;
    const strike = straddleCall.strike;
    const montageTotal = (straddleCall.price + straddlePut.price) * qty;
    const breakevens = [
      Math.round((strike - (montageTotal / qty)) * 100) / 100,
      Math.round((strike + (montageTotal / qty)) * 100) / 100
    ];
    const maxLoss = montageTotal;

    return {
      type: 'Straddle',
      label: 'Straddle (Volatilidade Alta)',
      montageTotal: Math.round(montageTotal * 100) / 100,
      breakeven: breakevens,
      maxProfit: 'Ilimitado',
      maxLoss: Math.round(maxLoss * 100) / 100,
      isRiskFree: false,
    };
  }

  // ─── Strangle: Compra Call (K2) + Compra Put (K1) com K1 < K2 ─────────────────
  const strangleCall = sortedLegs.find(l => l.option_type === 'call' && l.side === 'buy');
  const stranglePut = sortedLegs.find(l => l.option_type === 'put' && l.side === 'buy');
  
  if (strangleCall && stranglePut && sortedLegs.length === 2 && 
      stranglePut.strike < strangleCall.strike &&
      strangleCall.quantity === stranglePut.quantity) {
    const qty = strangleCall.quantity;
    const montageTotal = (strangleCall.price + stranglePut.price) * qty;
    const breakevens = [
      Math.round((stranglePut.strike - (montageTotal / qty)) * 100) / 100,
      Math.round((strangleCall.strike + (montageTotal / qty)) * 100) / 100
    ];
    const maxLoss = montageTotal;

    return {
      type: 'Strangle',
      label: 'Strangle (Volatilidade)',
      montageTotal: Math.round(montageTotal * 100) / 100,
      breakeven: breakevens,
      maxProfit: 'Ilimitado',
      maxLoss: Math.round(maxLoss * 100) / 100,
      isRiskFree: false,
    };
  }

  // ─── Iron Condor: Venda Call K2 + Compra Call K3 + Venda Put K1 + Compra Put K0 ────
  const ironCondorLegs = sortedLegs.filter(l => ['call', 'put'].includes(l.option_type));
  const callLegs = ironCondorLegs.filter(l => l.option_type === 'call').sort((a, b) => a.strike - b.strike);
  const putLegs = ironCondorLegs.filter(l => l.option_type === 'put').sort((a, b) => a.strike - b.strike);

  if (callLegs.length === 2 && putLegs.length === 2 && sortedLegs.length === 4) {
    const sellCall = callLegs[0];
    const buyCall = callLegs[1];
    const sellPut = putLegs[1];
    const buyPut = putLegs[0];

    if (sellCall.side === 'sell' && buyCall.side === 'buy' &&
        sellPut.side === 'sell' && buyPut.side === 'buy' &&
        sellCall.quantity === buyCall.quantity && buyPut.quantity === sellPut.quantity) {
      const qty = sellCall.quantity;
      const montageTotal = (sellCall.price + sellPut.price - buyCall.price - buyPut.price) * qty;
      const maxProfit = montageTotal;
      const maxLoss = Math.min(
        (sellCall.strike - buyCall.strike) * qty - montageTotal,
        (sellPut.strike - buyPut.strike) * qty - montageTotal
      );

      return {
        type: 'IronCondor',
        label: 'Iron Condor (Renda Neutra)',
        montageTotal: Math.round(montageTotal * 100) / 100,
        breakeven: [
          Math.round((sellPut.strike + (montageTotal / qty)) * 100) / 100,
          Math.round((sellCall.strike - (montageTotal / qty)) * 100) / 100
        ],
        maxProfit: Math.round(maxProfit * 100) / 100,
        maxLoss: Math.round(Math.abs(maxLoss) * 100) / 100,
        isRiskFree: false,
      };
    }
  }

  return null;
}
