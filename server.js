require("dotenv").config();
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI;
const app = require("./src/app");
const { ensureFeeStructureIndexes } = require("./src/utils/feeStructureIndexes");



const PORT = process.env.PORT || 5000;
const requiredEnv = [
  "MONGO_URI",
  "JWT_SECRET"
];

const missingEnv = requiredEnv.filter(
  (key) => !process.env[key]
);

if (missingEnv.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnv.join(", ")}`
  );
}

mongoose.connect(MONGO_URI).then(async () => {

    console.log("Connected to MongoDB");
    await ensureFeeStructureIndexes();

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}).catch((error) => {
    console.error("Error connecting to MongoDB:", error);
});
