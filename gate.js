// gate.js —— 单设备 + 24小时访问控制（前端版，base64url 统一版）

(function () {
  const BRAND_NAME = "你这样的人";
  const SECRET = "lylyjlylyjlylyjlylyjlylyjlylyjlylyjlylyj";

  function qs(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function block(title, message) {
    document.documentElement.innerHTML = `
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
        <style>
          body{margin:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto;background:#0f1220;color:#fff}
          .wrap{min-height:100vh;display:flex;align-items:center;justify-content:center}
          .card{max-width:420px;background:#1b1f3b;border-radius:16px;padding:24px;box-shadow:0 20px 40px rgba(0,0,0,.4)}
          h1{margin:0 0 12px;font-size:20px}
          p{margin:0;color:#cfd3ff;line-height:1.6}
          .brand{font-weight:700;margin-bottom:8px;opacity:.8}
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="card">
            <div class="brand">${BRAND_NAME}</div>
            <h1>${title}</h1>
            <p>${message}</p>
          </div>
        </div>
      </body>
    `;
  }

  function getDeviceId() {
    const key = "psy_device_id_v1";
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  }

  // ✅ base64url -> base64（给 atob 用）
  function b64urlToB64(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    // 补齐 padding
    const pad = s.length % 4;
    if (pad) s += "=".repeat(4 - pad);
    return s;
  }

  // ✅ base64 -> base64url（去掉=，替换+/）
  function b64ToB64url(s) {
    return s.replace(/=+$/,"").replace(/\+/g, "-").replace(/\//g, "_");
  }

  function parseToken(token) {
    try {
      const parts = token.split(".");
      if (parts.length !== 2) return null;

      const payloadB64url = parts[0];
      const sig = parts[1];

      // ✅ 用 base64url 解 payload
      const payloadJson = atob(b64urlToB64(payloadB64url));
      const payload = JSON.parse(payloadJson);

      if (!payload.exp || Date.now() > payload.exp) return "expired";

      // ✅ 签名校验：sig === base64url( btoa( payloadB64url + "." + SECRET ) )
      const raw = payloadB64url + "." + SECRET;
      const expected = b64ToB64url(btoa(raw));
      if (sig !== expected) return "invalid";

      return payload;
    } catch {
      return null;
    }
  }

  const token = qs("t");
  if (!token) {
    block("无法访问", "请通过购买后获得的专属链接进入。");
    return;
  }

  const result = parseToken(token);
  if (result === "expired") {
    block("链接已过期", "该链接已超过 24 小时有效期，请重新获取。");
    return;
  }
  if (!result || result === "invalid") {
    block("链接无效", "该访问链接无效或已被篡改。");
    return;
  }

  const bindKey = "psy_bind_" + result.nonce;
  const deviceId = getDeviceId();
  const record = localStorage.getItem(bindKey);

  if (!record) {
    localStorage.setItem(bindKey, deviceId);
    return;
  }

  if (record !== deviceId) {
    block("设备不匹配", "该链接已绑定到另一台设备，24 小时内仅支持首次打开的设备访问。");
    return;
  }
})();
