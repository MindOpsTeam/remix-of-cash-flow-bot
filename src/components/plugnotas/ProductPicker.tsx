/**
 * Combobox de produtos/serviços da empresa.
 * Pré-preenche descrição, NCM, CFOP, unidade e preço.
 */

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";

export interface ProductOption {
  id: string;
  name: string;
  description: string | null;
  type: "product" | "service";
  sku: string | null;
  unit: string;
  sell_price: number;
  ncm: string | null;
  cfop: string | null;
  tax_origin: string | null;
  cclasstrib: string | null;
}

interface Props {
  productType?: "product" | "service" | "any";
  onSelect: (p: ProductOption) => void;
  placeholder?: string;
}

export function ProductPicker({ productType = "any", onSelect, placeholder = "Selecionar produto..." }: Props) {
  const { company } = useCompany();
  const [open, setOpen] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ["products-picker", company?.id, productType],
    enabled: !!company,
    queryFn: async () => {
      let q = (supabase as any)
        .from("products")
        .select("id, name, description, type, sku, unit, sell_price, ncm, cfop, tax_origin, cclasstrib, active")
        .eq("company_id", company!.id)
        .eq("active", true)
        .order("name")
        .limit(200);
      if (productType !== "any") q = q.eq("type", productType);
      const { data } = await q;
      return (data || []) as ProductOption[];
    },
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal" type="button">
          <span className="truncate text-left">{placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar por nome ou SKU..." />
          <CommandList>
            <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
            <CommandGroup>
              {products.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.name} ${p.sku ?? ""}`}
                  onSelect={() => {
                    onSelect(p);
                    setOpen(false);
                  }}
                >
                  <Check className="mr-2 h-4 w-4 opacity-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {p.sku ? `SKU ${p.sku}` : "sem SKU"} · {p.unit} · R$ {Number(p.sell_price).toFixed(2)}
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
