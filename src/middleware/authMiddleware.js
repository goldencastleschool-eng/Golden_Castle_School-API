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
    const cookieToken = getCookieValue(
      req.headers.cookie,
      process.env.AUTH_COOKIE_NAME || "gcs_auth_token"
    );

    if (!cookieToken) {
      return res.status(401).json({
        message: "No auth session provided",
      });
    }

    const decoded = jwt.verify(
      cookieToken,
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
