import express from 'express';

const router = express.Router();

// Simplest parameterized view
router.get("/", (req, res) => {
  res.render("index", { title: "Hello!!!!!" })
})

// Facts list
const facts = [
  "There are more stars in the universe than grains of sand on all the beaches on Earth. That's at least a billion trillion!",
  "Singapore is home to more than 390 species of birds and at least 2,100 native vascular plants, of which more than 1,500 species are classified as extant in Singapore.",
  "Mangroves have great capacity to take carbon out of the atmosphere. A patch of mangroves could absorb as much as 10 times the carbon of a similarly sized patch of terrestrial forest, mitigating the effects of sea level rise.",
  "Quantum physics teaches us that everything is energy at the most fundamental levels. Reality is merely an illusion, although a very persistent one.",
  "The word vaccine comes from the cowpox virus vaccinia which derives from the Latin word vacca for cow."
];

let factIndex = 0;

// Serve the next fact each time, looping back to start
router.get("/fact", (req, res) => {
  const currentFact = facts[factIndex];
  const currentNumber = factIndex + 1;
  factIndex = (factIndex + 1) % facts.length;
  res.render("fact", { fact: currentFact, number: currentNumber });
})

// 7 Boom game
router.get("/7boom", (req, res) => {
  const num = Number(req.query.num);

  if (isNaN(num) || num < 0 || num > 100) {
    return res.status(400).send("Please provide a num query parameter between 0 and 100.");
  }

  const isBoom = (num % 7 === 0) || String(num).includes("7");
  res.render("7boom", { num, isBoom });
});

export default router;
