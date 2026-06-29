const jwt = require("jsonwebtoken");

const protect = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const queryToken = req.query?.token;

    if (
      (!authHeader || !authHeader.startsWith("Bearer ")) &&
      !queryToken
    ) {
      return res.status(401).json({
        message: "No token provided",
      });
    }

    const token = queryToken || authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Not authorized",
    });
  }
};

module.exports = protect;
