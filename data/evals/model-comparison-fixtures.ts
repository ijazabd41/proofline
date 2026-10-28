import type { ReportSnapshot } from "../../services/api/src/reproduction/contracts";
export interface ComparisonFixture {
  id: string; label: "bug" | "control"; report: ReportSnapshot;
  expectedTarget: string; expectedValue: string | number;
  defects: Array<{ relativePath: string; fixedContent: string; buggyContent: string }>;
}
const report = (title: string, steps: string[], expected: string, actual: string): ReportSnapshot => ({
  title, description: `${expected} ${actual}`, steps, expected, actual, startPath: "/", context: "Fresh page and empty cart; no other changes.",
});
// Controlled comparison cases, not an unseen held-out reliability benchmark.
export const comparisonFixtures: ComparisonFixture[] = [
  {
    id: "cmp-usb-price", label: "bug", expectedTarget: "product-price-3", expectedValue: 15,
    report: report("USB Hub catalog price is two dollars too high", ["Open the shop", "Read the USB Hub price without adding anything"], "The USB Hub catalog price should be $15.00.", "Its catalog card displays $17.00."),
    defects: [{ relativePath: "src/components/ProductCard.tsx", fixedContent: "${product.price.toFixed(2)}", buggyContent: "${(product.price + (product.id === 3 ? 2 : 0)).toFixed(2)}" }],
  },
  {
    id: "cmp-webcam-quantity", label: "bug", expectedTarget: "cart-item-quantity-4", expectedValue: "×1",
    report: report("Adding Webcam once creates three units", ["Open the shop", "Click Webcam Add to Cart once", "Read the Webcam cart quantity"], "The Webcam quantity should be ×1.", "The Webcam quantity shows ×3 after one click."),
    defects: [{ relativePath: "src/components/ProductCard.tsx", fixedContent: "onClick={() => addItem(product)}", buggyContent: "onClick={() => { addItem(product); if (product.id === 4) { addItem(product); addItem(product); } }}" }],
  },
  {
    id: "cmp-webcam-name", label: "bug", expectedTarget: "cart-item-name-4", expectedValue: "Webcam",
    report: report("Webcam cart line is incorrectly named USB Hub", ["Open the shop", "Add one Webcam", "Read the item name in the cart sidebar"], "The cart line name should be Webcam.", "The cart line is named USB Hub."),
    defects: [{ relativePath: "src/components/CartItem.tsx", fixedContent: "{item.name}</span>", buggyContent: '{item.id === 4 ? "USB Hub" : item.name}</span>' }],
  },
  {
    id: "cmp-control-usb-name", label: "control", expectedTarget: "product-name-3", expectedValue: "USB Hub", defects: [],
    report: report("Check the USB Hub catalog label", ["Open the shop", "Read the USB Hub product name"], "The catalog name should be USB Hub.", "The catalog name is USB Hub; no defect is observed."),
  },
  {
    id: "cmp-control-webcam-price", label: "control", expectedTarget: "product-price-4", expectedValue: 35, defects: [],
    report: report("Check the Webcam catalog price", ["Open the shop", "Read the Webcam product price"], "The Webcam catalog price should be $35.00.", "The catalog price is $35.00; no defect is observed."),
  },
];
