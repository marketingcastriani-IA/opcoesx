import { Leg } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2 } from 'lucide-react';

interface LegsTableProps {
  legs: Leg[];
  onRemove: (index: number) => void;
  onUpdate: (index: number, leg: Leg) => void;
}

export default function LegsTable({ legs, onRemove, onUpdate }: LegsTableProps) {
  if (legs.length === 0) return null;

  const updateField = (index: number, field: keyof Leg, value: string | number) => {
    const current = legs[index];
    const updated: Leg = {
      ...current,
      [field]: value,
    } as Leg;
    onUpdate(index, updated);
  };

  return (
    <div className="rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Lado</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Ativo</TableHead>
            <TableHead className="text-right">Strike</TableHead>
            <TableHead className="text-right">Preço</TableHead>
            <TableHead className="text-right">Qtd</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {legs.map((leg, i) => (
            <TableRow key={i}>
              <TableCell>
                <select
                  value={leg.side}
                  onChange={(e) => updateField(i, 'side', e.target.value as 'buy' | 'sell')}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="buy">Compra</option>
                  <option value="sell">Venda</option>
                </select>
              </TableCell>
              <TableCell>
                <select
                  value={leg.option_type}
                  onChange={(e) => updateField(i, 'option_type', e.target.value as 'call' | 'put' | 'stock')}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="call">Call</option>
                  <option value="put">Put</option>
                  <option value="stock">Ativo</option>
                </select>
              </TableCell>
              <TableCell>
                <Input
                  value={leg.asset}
                  onChange={(e) => updateField(i, 'asset', e.target.value.toUpperCase())}
                  className="h-8 font-mono"
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  step="0.01"
                  value={leg.strike}
                  onChange={(e) => updateField(i, 'strike', parseFloat(e.target.value) || 0)}
                  className="h-8 text-right font-mono"
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  step="0.01"
                  value={leg.price}
                  onChange={(e) => updateField(i, 'price', parseFloat(e.target.value) || 0)}
                  className="h-8 text-right font-mono"
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  min={1}
                  value={leg.quantity}
                  onChange={(e) => updateField(i, 'quantity', parseInt(e.target.value) || 1)}
                  className="h-8 text-right font-mono"
                />
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRemove(i)}>
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

