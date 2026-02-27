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
    const isStock = leg.option_type === 'stock';
    const hasStrike = isStock ? true : leg.strike > 0;
    const hasPrice = isStock ? leg.price > 0 : leg.price >= 0;
    if (!leg.asset || !hasStrike || !hasPrice || leg.quantity <= 0) return;
    onAdd({ ...leg });
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
        <Select value={leg.option_type} onValueChange={v => setLeg(p => ({ ...p, option_type: v as 'call' | 'put' | 'stock' }))}>
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
        <Input type="number" step="0.01" value={leg.strike || ''} onChange={e => setLeg(p => ({ ...p, strike: parseFloat(e.target.value) || 0 }))} placeholder="30.00" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Preço</Label>
        <Input type="number" step="0.01" value={leg.price || ''} onChange={e => setLeg(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))} placeholder="1.50" />
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
