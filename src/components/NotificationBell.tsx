import { Bell } from "lucide-react";
import { EmptyState } from "@viverdeia/design-system";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function NotificationBell() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Notificações">
          <Bell className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-4 py-3">
          <h4 className="text-sm font-semibold">Notificações</h4>
        </div>
        <EmptyState
          className="border-0 py-8 shadow-none"
          variant="soft"
          icon={<Bell size={18} strokeWidth={1.8} />}
          title="Tudo em dia"
          description="Novos alertas financeiros aparecem aqui."
        />
      </PopoverContent>
    </Popover>
  );
}
