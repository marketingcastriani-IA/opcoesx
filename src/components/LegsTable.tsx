import { Leg } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

interface LegsTableProps {
  legs: Leg[];
  onRemove: (index: number) => void;
}

export default function LegsTable({ legs, onRemove }: LegsTableProps) {
  if (legs.length === 0) return null;

  return (
    <div className="rounded-lg border">
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
                <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${leg.side === 'buy' ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}`}>
                  {leg.side === 'buy' ? 'C' : 'V'}
                </span>
              </TableCell>
              <TableCell className="font-mono text-xs uppercase">{leg.option_type}</TableCell>
              <TableCell className="font-mono font-medium">{leg.asset}</TableCell>
              <TableCell className="text-right font-mono">{leg.strike.toFixed(2)}</TableCell>
              <TableCell className="text-right font-mono">{leg.price.toFixed(2)}</TableCell>
              <TableCell className="text-right font-mono">{leg.quantity}</TableCell>
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
