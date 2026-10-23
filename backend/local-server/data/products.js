export const products = [
  { id: "p1", name: "Classic Tee", price: 19.99, stock: 25 },
  { id: "p2", name: "Canvas Tote Bag", price: 24.0, stock: 12 },
  { id: "p3", name: "Ceramic Mug", price: 14.5, stock: 40 },
  { id: "p4", name: "Wool Beanie", price: 22.0, stock: 8 },
  { id: "p5", name: "Enamel Pin Set", price: 9.99, stock: 60 },
  // Keep stock at 0 to deliberately trigger the insufficient-inventory
  // failure path from the UI's "Simulate failure" checkout option.
  { id: "p6", name: "Limited Hoodie (sold out demo)", price: 54.0, stock: 0 },
];

export function findProduct(id) {
  return products.find((p) => p.id === id);
}
