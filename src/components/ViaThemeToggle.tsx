import { Moon, Sun } from "lucide-react";
import { useTheme } from "@viverdeia/design-system";
import { Button } from "@/components/ui/button";

export function ViaThemeToggle() {
  const { theme, toggle } = useTheme();
  const nextTheme = theme === "dark" ? "claro" : "escuro";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-9 w-9 rounded-full"
      onClick={toggle}
      aria-label={`Ativar tema ${nextTheme}`}
      title={`Ativar tema ${nextTheme}`}
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4" aria-hidden="true" />
      )}
    </Button>
  );
}
