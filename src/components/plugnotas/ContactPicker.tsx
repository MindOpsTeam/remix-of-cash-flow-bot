/**
 * Combobox de contatos da empresa, com criação inline opcional.
 * Selecionar pré-preenche document, razão social, email e endereço.
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
import { formatDocument } from "@/lib/plugnotas";

export interface ContactOption {
  id: string;
  name: string;
  document: string | null;
  email: string | null;
  state_registration?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
}

interface Props {
  value?: string;
  onSelect: (c: ContactOption) => void;
  type?: "customer" | "supplier" | "both" | "any";
  placeholder?: string;
}

export function ContactPicker({ value, onSelect, type = "any", placeholder = "Buscar contato..." }: Props) {
  const { company } = useCompany();
  const [open, setOpen] = useState(false);

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts-picker", company?.id, type],
    enabled: !!company,
    queryFn: async () => {
      let q = (supabase as any)
        .from("contacts")
        .select("id, name, document, email, state_registration, street, number, complement, neighborhood, city, state, zip_code, type")
        .eq("company_id", company!.id)
        .eq("active", true)
        .order("name")
        .limit(200);
      if (type !== "any") {
        q = q.in("type", type === "both" ? ["customer", "supplier", "both"] : [type, "both"]);
      }
      const { data } = await q;
      return (data || []) as (ContactOption & { type: string })[];
    },
  });

  const selected = contacts.find((c) => c.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          type="button"
        >
          <span className="truncate text-left">
            {selected ? `${selected.name}${selected.document ? ` · ${formatDocument(selected.document)}` : ""}` : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar por nome, CNPJ ou CPF..." />
          <CommandList>
            <CommandEmpty>Nenhum contato encontrado.</CommandEmpty>
            <CommandGroup>
              {contacts.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.name} ${c.document ?? ""}`}
                  onSelect={() => {
                    onSelect(c);
                    setOpen(false);
                  }}
                >
                  <Check className={`mr-2 h-4 w-4 ${value === c.id ? "opacity-100" : "opacity-0"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {c.document ? formatDocument(c.document) : "sem documento"}
                      {c.city && c.state && ` · ${c.city}/${c.state}`}
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
