const { authenticatedUser, sendError } = require("./_shared");

function cookie(req, name) {
  const raw = req.headers.cookie || "";
  const match = raw.split(";").map(item => item.trim()).find(item => item.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

module.exports = async function handler(req, res) {
  if (req.method === "POST") {
    try {
      const accessToken = req.body?.accessToken;
      if (!accessToken) return res.status(400).json({ error: "Access token is required." });
      req.headers.authorization = `Bearer ${accessToken}`;
      const user = await authenticatedUser(req);
      if (!user) return res.status(401).json({ error: "Invalid or expired session." });
      const secure = process.env.PUBLIC_APP_URL?.startsWith("https://") ? "; Secure" : "";
      res.setHeader("Set-Cookie", `visual_pro_session=${encodeURIComponent(accessToken)}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=3600`);
      return res.status(200).json({ signedIn: true, userId: user.id });
    } catch (error) {
      return sendError(res, error);
    }
  }

  if (req.method === "DELETE") {
    res.setHeader("Set-Cookie", "visual_pro_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
    return res.status(200).json({ signedIn: false });
  }

  return res.status(405).json({ error: "Method not allowed." });
};

module.exports.readSessionCookie = cookie;
