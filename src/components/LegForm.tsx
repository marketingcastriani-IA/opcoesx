import { useState } from 'react';
import { Leg } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';

interface LegFormProps {
  onAdd: (leg: Leg) => void;
}

export default function LegForm({ onAdd }: LegFormProps) {
  const [leg, setLeg] = useState<Leg>({
    side: 'buy',
    option_type: 'call',
    asset: '',
    strike: 0,
    price: 0,
    quantity: 1,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leg.asset) return;
    if (leg.quantity <= 0) return;
    if (leg.price < 0) return;
    if (leg.option_type !== 'stock' && leg.strike <= 0) return;

    const strike = leg.option_type === 'stock' && leg.strike <= 0 ? leg.price : leg.strike;
    onAdd({ ...leg, strike });
    setLeg(prev => ({ ...prev, strike: 0, price: 0, quantity: 1 }));
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-6 items-end">
      <div className="space-y-1">
        <Label className="text-xs">Lado</Label>
        <Select value={leg.side} onValueChange={v => setLeg(p => ({ ...p, side: v as 'buy' | 'sell' }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="buy">Compra</SelectItem>
            <SelectItem value="sell">Venda</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Tipo</Label>
        <Select value={leg.option_type} onValueChange={v => setLeg(p => {
          const option_type = v as 'call' | 'put' | 'stock';
          return option_type === 'stock'
            ? { ...p, option_type, strike: p.price || 0 }
            : { ...p, option_type };
        })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="call">Call</SelectItem>
            <SelectItem value="put">Put</SelectItem>
            <SelectItem value="stock">Ativo</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Ativo</Label>
        <Input value={leg.asset} onChange={e => setLeg(p => ({ ...p, asset: e.target.value.toUpperCase() }))} placeholder="PETR4" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Strike</Label>
        <Input
          type="number"
          step="0.01"
          value={leg.option_type === 'stock' ? (leg.price || '') : (leg.strike || '')}
          onChange={e => setLeg(p => ({ ...p, strike: parseFloat(e.target.value) || 0 }))}
          placeholder="30.00"
          disabled={leg.option_type === 'stock'}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Preço</Label>
        <Input
          type="number"
          step="0.01"
          value={leg.price || ''}
          onChange={e => setLeg(p => {
            const price = parseFloat(e.target.value) || 0;
            return p.option_type === 'stock'
              ? { ...p, price, strike: price }
              : { ...p, price };
          })}
          placeholder="1.50"
        />
      </div>
      <div className="flex gap-2 items-end">
        <div className="space-y-1 flex-1">
          <Label className="text-xs">Qtd</Label>
          <Input type="number" min={1} value={leg.quantity} onChange={e => setLeg(p => ({ ...p, quantity: parseInt(e.target.value) || 1 }))} />
        </div>
        <Button type="submit" size="icon" className="shrink-0">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
