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

const getBearerToken = (authorizationHeader = "") => {
  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return "";
  }

  return token;
};

const protect = (req, res, next) => {
  try {
    const cookieToken = getCookieValue(
      req.headers.cookie,
      process.env.AUTH_COOKIE_NAME || "gcs_auth_token"
    );
    const bearerToken = getBearerToken(req.headers.authorization);
    const token = cookieToken || bearerToken;

    if (!token) {
      return res.status(401).json({
        message: "No auth session provided",
      });
    }

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
