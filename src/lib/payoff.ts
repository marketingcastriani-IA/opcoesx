import { Leg, PayoffPoint, AnalysisMetrics } from './types';
import { detectStrategy } from './strategies';

export function calculatePayoffAtExpiry(legs: Leg[], spotPrice: number): number {
  let total = 0;
  for (const leg of legs) {
    const multiplier = leg.side === 'buy' ? 1 : -1;
    if (leg.option_type === 'stock') {
      total += multiplier * (spotPrice - leg.strike) * leg.quantity;
    } else {
      let intrinsic = 0;
      if (leg.option_type === 'call') {
        intrinsic = Math.max(0, spotPrice - leg.strike);
      } else {
        intrinsic = Math.max(0, leg.strike - spotPrice);
      }
      total += multiplier * (intrinsic - leg.price) * leg.quantity;
    }
  }
  return total;
}

export function generatePayoffCurve(legs: Leg[], numPoints = 200): PayoffPoint[] {
  if (legs.length === 0) return [];

  const strikes = legs.map(l => l.strike);
  const minStrike = Math.min(...strikes);
  const maxStrike = Math.max(...strikes);
  const range = maxStrike - minStrike || maxStrike * 0.2;
  const padding = range * 0.5;
  const start = Math.max(0, minStrike - padding);
  const end = maxStrike + padding;
  const step = (end - start) / numPoints;

  const points: PayoffPoint[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const price = start + step * i;
    points.push({
      price: Math.round(price * 100) / 100,
      profitAtExpiry: Math.round(calculatePayoffAtExpiry(legs, price) * 100) / 100,
      profitToday: 0,
    });
  }
  return points;
}

export function calculateMetrics(legs: Leg[]): AnalysisMetrics {
  if (legs.length === 0) return { maxGain: 0, maxLoss: 0, breakevens: [], netCost: 0 };

  const curve = generatePayoffCurve(legs, 1000);
  const profits = curve.map(p => p.profitAtExpiry);
  const maxProfit = Math.max(...profits);
  const minProfit = Math.min(...profits);

  // Find breakevens
  const breakevens: number[] = [];
  for (let i = 1; i < curve.length; i++) {
    const prev = curve[i - 1].profitAtExpiry;
    const curr = curve[i].profitAtExpiry;
    if ((prev <= 0 && curr >= 0) || (prev >= 0 && curr <= 0)) {
      const ratio = Math.abs(prev) / (Math.abs(prev) + Math.abs(curr));
      const be = curve[i - 1].price + ratio * (curve[i].price - curve[i - 1].price);
      breakevens.push(Math.round(be * 100) / 100);
    }
  }

  // Net cost
  let netCost = 0;
  for (const leg of legs) {
    const multiplier = leg.side === 'buy' ? -1 : 1;
    netCost += multiplier * leg.price * leg.quantity;
  }

  // Unlimited check
  const lastProfit = profits[profits.length - 1];
  const firstProfit = profits[0];
  const isGainUnlimited = maxProfit === lastProfit || maxProfit === firstProfit;
  const isLossUnlimited = minProfit === lastProfit || minProfit === firstProfit;

  const result: AnalysisMetrics = {
    maxGain: isGainUnlimited && maxProfit > 0 ? 'Ilimitado' : Math.round(maxProfit * 100) / 100,
    maxLoss: isLossUnlimited && minProfit < 0 ? 'Ilimitado' : Math.round(minProfit * 100) / 100,
    breakevens,
    netCost: Math.round(netCost * 100) / 100,
  };

  // Enrich with strategy detection
  const strategy = detectStrategy(legs);
  if (strategy) {
    result.strategyType = strategy.type;
    result.strategyLabel = strategy.label;
    result.montageTotal = strategy.montageTotal;
    result.realBreakeven = strategy.breakeven;
    result.isRiskFree = strategy.isRiskFree;
    // Override maxGain/maxLoss with precise Collar values
    result.maxGain = strategy.maxProfit;
    result.maxLoss = strategy.isRiskFree ? 0 : -Math.abs(strategy.maxLoss);
  }

  return result;
}

export function calculateCDIReturn(
  principal: number,
  cdiRate: number,
  days: number,
  withIR: boolean
): number {
  const dailyRate = Math.pow(1 + cdiRate / 100, 1 / 252) - 1;
  const grossReturn = principal * (Math.pow(1 + dailyRate, days) - 1);
  if (!withIR) return Math.round(grossReturn * 100) / 100;

  let irRate = 0.225;
  if (days > 720) irRate = 0.15;
  else if (days > 360) irRate = 0.175;
  else if (days > 180) irRate = 0.20;

  return Math.round(grossReturn * (1 - irRate) * 100) / 100;
}

export function calculateCDIOpportunityCost(
  capital: number,
  annualRate: number,
  businessDays: number
): number {
  if (capital <= 0 || annualRate <= 0 || businessDays <= 0) return 0;
  const result = capital * (Math.pow(1 + annualRate / 100, businessDays / 252) - 1);
  return Math.round(result * 100) / 100;
}
