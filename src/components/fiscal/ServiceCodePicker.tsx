import { useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LC116, cTribNacDeLC116 } from "@/lib/lc116";

export interface CodigoServicoEscolhido {
  item: string;       // item da lista LC 116 (ex.: "1.07")
  cTribNac: string;   // código de tributação nacional derivado (ex.: "010700")
  descricao: string;
}

/**
 * Combobox de busca sobre a lista oficial de serviços (LC 116/2003). Ao escolher,
 * devolve o item da lista, o código de tributação nacional (derivado) e a descrição,
 * para preencher os cadastros/emissões sem digitar o código na mão.
 */
export function ServiceCodePicker({
  onSelect,
  placeholder = "Buscar serviço na lista LC 116...",
}: {
  onSelect: (e: CodigoServicoEscolhido) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal" type="button">
          <span className="truncate text-left">{placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Digite o código ou o serviço..." />
          <CommandList>
            <CommandEmpty>Nenhum serviço encontrado.</CommandEmpty>
            <CommandGroup>
              {LC116.map((s) => (
                <CommandItem
                  key={s.codigo}
                  value={`${s.codigo} ${s.descricao}`}
                  onSelect={() => {
                    onSelect({ item: s.codigo, cTribNac: cTribNacDeLC116(s.codigo), descricao: s.descricao });
                    setOpen(false);
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug">
                      <span className="font-mono text-primary">{s.codigo}</span> {s.descricao}
                    </p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
