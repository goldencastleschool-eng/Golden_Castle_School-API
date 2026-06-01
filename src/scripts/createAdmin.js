require("dotenv").config();

const mongoose = require("mongoose");

const bcrypt = require("bcryptjs");

const Admin = require("../models/adminModel");

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {

    const username = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_PASSWORD;

    if (!username || !password || password.length < 8) {
      throw new Error(
        "ADMIN_USERNAME and ADMIN_PASSWORD with at least 8 characters are required"
      );
    }

    const existingAdmin = await Admin.findOne({ username });

    if (existingAdmin) {
      throw new Error("Admin username already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await Admin.create({
      username,
      password: hashedPassword,
      role: "admin"
    });

    console.log("Admin created");

    process.exit();

  })
  .catch((error) => {
    console.log(error);
  });
