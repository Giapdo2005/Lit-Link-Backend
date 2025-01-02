const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Book = require("./book.model");

const userSchema = new mongoose.Schema({
  fullname: {
    type: String,
    required: [true, "Please enter fullname"],
  },
  email: {
    type: String,
    required: [true, "Please enter email"],
    trim: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  books: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Book", // Reference to Book model
    },
  ],
  friends: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
});

userSchema.pre("save", async function (next) {
  // Only hash the password if it's new, modified, or not a password reset
  if (!this.isModified("password") || this.passwordReset) {
    return next(); // Skip hashing if the password is not modified or if it's a reset
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    return next(error); // Pass the error to the next middleware
  }
});

const User = mongoose.model("User", userSchema);

module.exports = User;
