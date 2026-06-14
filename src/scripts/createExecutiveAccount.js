require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const ExecutiveAccount = require("../models/executiveAccountModel");

const allowedRoles = ["principal", "chairman"];

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    const username = process.env.EXECUTIVE_USERNAME?.trim().toLowerCase();
    const password = process.env.EXECUTIVE_PASSWORD;
    const role = process.env.EXECUTIVE_ROLE;

    if (!username || !password || password.length < 8) {
      throw new Error(
        "EXECUTIVE_USERNAME and EXECUTIVE_PASSWORD with at least 8 characters are required"
      );
    }

    if (!allowedRoles.includes(role)) {
      throw new Error(
        `EXECUTIVE_ROLE must be one of: ${allowedRoles.join(", ")}`
      );
    }

    const existingAccount = await ExecutiveAccount.findOne({ username });

    if (existingAccount) {
      throw new Error("Executive username already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await ExecutiveAccount.create({
      username,
      password: hashedPassword,
      role
    });

    console.log(`${role} account created`);

    process.exit();
  })
  .catch((error) => {
    console.log(error);
    process.exit(1);
  });
