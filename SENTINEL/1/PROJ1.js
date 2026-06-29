
import express from "express";
 
const PORT = 80;
 
const app = express();
 
// Prices
const PRICES = {
  size: { s: 10, l: 15, xl: 20 },
  topping: 2,
  extra_cheese: 3,
  cheese_crust: 3,
};
 
// Valid topping choices
const validToppings = ["Onion", "Tempeh", "Olives", "Pineapple", "Durian"];
 
// Homepage
app.get("/", (req, res) => {
  res.send("Hello from Express Pizza");
});
 
// Route to handle pizza orders
app.get("/order", (req, res) => {
  // 1. Read the order details from the query string
  const { size, topping1, topping2, extra_cheese, cheese_crust } = req.query;

  // 2. Validate size
  if (!size || !Object.keys(PRICES.size).includes(size)) {
    return res.status(400).send("invalid size");
  }

  // 3. Validate topping1 (optional)
  if (topping1 && !validToppings.includes(topping1)) {
    return res.status(400).send("invalid topping1");
  }

  // 4. Validate topping2 (optional)
  if (topping2 && !validToppings.includes(topping2)) {
    return res.status(400).send("invalid topping2");
  }

  // 5. Validate extra_cheese (optional)
  if (extra_cheese && extra_cheese !== "1" && extra_cheese !== "0") {
    return res.status(400).send("invalid extra_cheese");
  }

  // 6. Validate cheese_crust (optional)
  if (cheese_crust && cheese_crust !== "1" && cheese_crust !== "0") {
    return res.status(400).send("invalid cheese_crust");
  }

  // 7. Calculate the total price
  let total = PRICES.size[size];
  if (topping1) total += PRICES.topping;
  if (topping2) total += PRICES.topping;
  if (extra_cheese === "1") total += PRICES.extra_cheese;
  if (cheese_crust === "1") total += PRICES.cheese_crust;

  // 8. Send the response
  res.send(`Thank you for ordering from Express Pizza! Your total is: $${total}`);
});
 
// Test order: /order?size=s&topping1=Onion&extra_cheese=1&cheese_crust=1
// Test invalid order: /order?size=m
 
// Start the server
app.listen(PORT, () => {
  console.log(`Pizza ordering server running on port ${PORT}`);
});
 