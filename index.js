const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const Book = require("./models/book.model.js");
const User = require("./models/user.model.js");
const e = require("express");
const bcrypt = require("bcryptjs");
const app = express();
require("dotenv").config();

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send("Hello from Node API Server Updated");
});

// test credentials
app.post("/api/test-password", async (req, res) => {
  const { plainPassword, hashedPassword } = req.body;

  try {
    const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
    res.json({ match: isMatch });
  } catch (error) {
    console.error("Error comparing passwords:", error);
    res.status(500).json({ message: "Error comparing passwords" });
  }
});

// create a new user
app.post("/api/users/signup", async (req, res) => {
  try {
    const { fullname, email, password } = req.body;

    //check if all fields are filled
    if (!fullname || !email || !password) {
      return res.status(400).json({ message: "Please enter all fields" });
    }

    // Check for existing email (separate check)
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const newUser = new User({ fullname, email, password });
    await newUser.save();

    res.status(200).json({ message: "User created successfully" }, newUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// login route
app.post("/api/users/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    //check if user is in the database
    const user = await User.findOne({
      email: email,
    });

    if (!user) {
      return res.status(400).json({ message: "User does not exist" });
    }

    //validate password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }

    // loggedIn successfully
    res.json({
      message: "Login successful",
      user: {
        id: user._id,
        fullname: user.fullname,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
    return "Login failed";
  }
});

//get all users from database
app.get("/api/users", async (req, res) => {
  try {
    // Fetch all users
    const users = await User.find().populate("books");
    res.status(200).json({
      message: "Users fetched successfully",
      users,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      message: "Failed to fetch users",
      error: error.message,
    });
  }
});

// check if user exists with email
app.post("/api/users/check", async (req, res) => {
  const email = req.body.email;
  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res
        .status(404)
        .json({ message: "User doesn't exist. Please create an account" });
    }

    res.status(200).json({ message: "User does exist" });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// route for resetting password
app.post("/api/users/password-reset", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email: email });

    if (!user) {
      return res.status(404).json({ message: "User doesn't exist" });
    }

    // Hash the new password
    console.log("Plain password:", password);
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("Hashed password before saving:", hashedPassword);

    // Set the hashed password
    user.password = hashedPassword;
    user.passwordReset = true; // Mark that the password has been reset

    await user.save();

    return res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// get all books for loggedInUser from database
app.get("/api/users/books/:id", async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId).populate("books");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res
      .status(200)
      .json({ message: "Books fetched successfully", books: user.books });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//add a book for loggedInUser according to id
app.post("/api/users/books/:id", async (req, res) => {
  const userId = req.params.id;
  const { title, author, publishedYear, genre } = req.body;
  try {
    const newBook = new Book({ title, author, publishedYear, genre });
    const savedBook = await newBook.save();

    const user = await User.findByIdAndUpdate(
      userId,
      { $push: { books: savedBook._id } },
      { new: true } // Return the updated user
    );

    if (!user) {
      res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "Book added successfully",
      book: {
        _id: savedBook._id,
        title: savedBook.title,
        author: savedBook.author,
        publishedYear: savedBook.publishedYear,
        genre: savedBook.genre,
        read: 0,
        createdAt: savedBook.createdAt,
        updatedAt: savedBook.updatedAt,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//Deleting a book for loggedInUser from the database
app.delete("/api/users/:userId/books/:bookId", async (req, res) => {
  const { userId, bookId } = req.params;

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const bookIndex = user.books.findIndex(
      (book) => book.toString() === bookId
    );

    if (bookIndex === -1) {
      return res
        .status(404)
        .json({ message: "Book not found in user's books" });
    }

    const result = await User.updateOne(
      { _id: new mongoose.Types.ObjectId(userId) },
      { $pull: { books: new mongoose.Types.ObjectId(bookId) } }
    );

    if (!mongoose.Types.ObjectId.isValid(bookId)) {
      return res.status(400).json({ message: "Invalid book ID format" });
    }

    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: "Book not found" });
    }

    await Book.findByIdAndDelete(bookId);

    res.status(200).json({ message: "Book deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// change the readingStatus for user
app.put("/api/users/:userId/books/:bookId", async (req, res) => {
  const { userId, bookId } = req.params;
  const { read } = req.body;

  try {
    const user = await User.findById(userId);

    if (!userId) {
      return res.status(404).json({ message: "User not found" });
    }

    const bookIndex = user.books.findIndex(
      (book) => book._id.toString() === bookId
    );

    if (bookIndex === -1) {
      return res.status(404).json({ message: "book not found" });
    }

    user.books[bookIndex].read = read;
    await user.save();

    return res.status(200).json({ message: `bookStatus: ${read}` });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// add friend to user's schema route
app.post("/api/users/:userId/friends/:friendId", async (req, res) => {
  const { userId, friendId } = req.params;

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const friend = await User.findById(friendId).populate("books");

    if (!friend) {
      return res.status(404).json({ message: "Friend doesn't exist" });
    }

    //check to see if they are friends already
    const isAlreadyFriend = user.friends.some(
      (f) => f.id.toString() === friendId
    );

    if (isAlreadyFriend) {
      return res.status(400).json({ message: "User is already a friend" });
    }

    user.friends.push(friend._id);

    await user.save();

    res.status(200).json({
      message: "Friend added successfully",
      friend: friend, // Friend object with populated books
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// delete friend from user's schema route
app.delete("/api/users/:userId/friends/:friendId", async (req, res) => {
  const { userId, friendId } = req.params;
  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if the friend exists in the user's friends list
    const friendIndex = user.friends.findIndex(
      (f) => f.toString() === friendId
    );

    if (friendIndex === -1) {
      return res
        .status(400)
        .json({ message: "Friend not found in user's list" });
    }

    const friend = await User.findById(friendId).populate("books");

    user.friends.splice(friendIndex, 1);

    await user.save();

    res
      .status(200)
      .json({ message: "Friend removed successfully", deletedFriend: friend });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// get user info
app.get("/api/users/:id", async (req, res) => {
  const userId = req.params.id;
  try {
    const user = await User.findById(userId).populate("books");

    if (!user) {
      return res.status(404).json({ message: "User doesn't exist" });
    }

    const userData = {
      name: user.fullname,
      books: user.books,
    };

    return res.status(200).json({ user: userData });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// return books for each friend
app.get("/api/users/friends/books/:id", async (req, res) => {
  const userId = req.params.id;
  try {
    const user = await User.findById(userId).populate({
      path: "friends", // Populate the friends field
      populate: {
        path: "books", // Then populate the books field for each friend
        model: "Book",
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User doesn't exist" });
    }

    const friendsBooks = user.friends.map((friend) => ({
      friendId: friend._id,
      friendName: friend.fullname,
      books: friend.books || [], // Ensure that books are always an array
    }));

    res.status(200).json({ friendsBooks });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error.message);
  });
