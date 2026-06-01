const jwt = require("jsonwebtoken");

const getCookieToken = (cookieHeader = "") => {
  return cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith("auth_token="))
    ?.split("=")[1];
};

const protect = (req, res, next) => {

  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {

    try {

      token = req.headers.authorization.split(" ")[1];

    } catch (error) {

      return res.status(401).json({
        message: "Not authorized"
      });
    }

  }

  if (!token) {
    token = getCookieToken(req.headers.cookie);
  }

  if (!token) {
    return res.status(401).json({
      message: "No token provided"
    });
  }

  try {
    const decoded = jwt.verify(
      decodeURIComponent(token),
      process.env.JWT_SECRET
    );

    req.user = decoded;

    return next();

  } catch (error) {
    return res.status(401).json({
      message: "Not authorized"
    });
  }
};

module.exports = protect;
