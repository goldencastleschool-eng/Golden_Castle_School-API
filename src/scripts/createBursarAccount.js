require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Admin = require("../models/adminModel");

const run = async () => {
  const username = process.env.BURSAR_USERNAME?.trim().toLowerCase();
  const password = process.env.BURSAR_PASSWORD;

  if (!username || !password || password.length < 8) {
    throw new Error(
      "BURSAR_USERNAME and BURSAR_PASSWORD (at least 8 characters) are required"
    );
  }

  await mongoose.connect(process.env.MONGO_URI);

  if (await Admin.exists({ username })) {
    throw new Error("That username is already in use");
  }

  await Admin.create({
    username,
    password: await bcrypt.hash(password, 10),
    role: "bursar"
  });

  console.log("Bursar account created");
};

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
