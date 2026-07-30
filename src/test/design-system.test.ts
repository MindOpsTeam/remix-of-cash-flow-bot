import { describe, expect, it } from "vitest";
import * as designSystem from "@viverdeia/design-system";

const componentExports = [
  "Accordion",
  "Alert",
  "Avatar",
  "Breadcrumb",
  "Button",
  "Calendar",
  "Card",
  "Carousel",
  "Checkbox",
  "ColorPicker",
  "Combobox",
  "Command",
  "ContextMenu",
  "DataTable",
  "DatePicker",
  "DateRangePicker",
  "Drawer",
  "DropdownMenu",
  "EmptyState",
  "HoverCard",
  "Icon",
  "Input",
  "Lightbox",
  "Modal",
  "MultiSelect",
  "OTPInput",
  "Pagination",
  "Pill",
  "Popover",
  "Progress",
  "RadioGroup",
  "Select",
  "Sheet",
  "Skeleton",
  "Slider",
  "Spinner",
  "Splitter",
  "Stepper",
  "Switch",
  "Tabs",
  "TagInput",
  "TimePicker",
  "ToastStack",
  "Tooltip",
  "TreeView",
  "VirtualList",
] as const;

describe("Viver de IA design system", () => {
  it("disponibiliza os 46 componentes oficiais no ERP", () => {
    expect(componentExports).toHaveLength(46);

    for (const exportName of componentExports) {
      expect(
        designSystem[exportName],
        `export ausente: ${exportName}`,
      ).toBeDefined();
    }
  });

  it("carrega o tema e os 188 tokens oficiais", () => {
    expect(designSystem.ThemeProvider).toBeDefined();
    expect(designSystem.useTheme).toBeDefined();
    expect(designSystem.tokensList).toHaveLength(188);
    expect(designSystem.tokens["via-navy"]).toBe("#0A1F3B");
    expect(designSystem.cssVar("via-radius-lg")).toBe("var(--via-radius-lg)");
  });
});
