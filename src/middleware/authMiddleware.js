const jwt = require("jsonwebtoken");

const getCookieValue = (cookieHeader = "", cookieName = "") => {
  if (!cookieHeader || !cookieName) {
    return "";
  }

  const cookie = cookieHeader
    .split(";")
    .map((cookiePart) => cookiePart.trim())
    .find((cookiePart) => cookiePart.startsWith(`${cookieName}=`));

  return cookie ? decodeURIComponent(cookie.split("=").slice(1).join("=")) : "";
};

const protect = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const queryToken = req.query?.token;
    const cookieToken = getCookieValue(
      req.headers.cookie,
      process.env.AUTH_COOKIE_NAME || "gcs_auth_token"
    );

    if (
      (!authHeader || !authHeader.startsWith("Bearer ")) &&
      !queryToken &&
      !cookieToken
    ) {
      return res.status(401).json({
        message: "No token provided",
      });
    }

    const headerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : "";
    const token = cookieToken || queryToken || headerToken;

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
