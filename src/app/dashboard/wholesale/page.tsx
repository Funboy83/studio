
import { Building } from 'lucide-react';

export default function WholesalePage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <Building className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">Wholesale</h1>
      </div>
      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm">
        <div className="flex flex-col items-center gap-1 text-center">
          <h3 className="text-2xl font-bold tracking-tight">
            Wholesale Dashboard Coming Soon
          </h3>
          <p className="text-sm text-muted-foreground">
            This section is under construction.
          </p>
        </div>
      </div>
    </div>
  );
}
