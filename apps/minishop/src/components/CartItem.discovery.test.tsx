import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { CartItem } from "./CartItem";
import { useCartStore } from "../store/cartStore";
afterEach(() => useCartStore.getState().clearCart());
it("exposes the cart line amount without requiring the shop product card", () => {
  useCartStore.setState({ items: [{ id: 1, name: "Keyboard", price: 10, quantity: 2 }] });
  render(<CartItem productId={1} />);
  expect(screen.getByTestId("cart-item-total-1")).toHaveTextContent("$20.00");
});
