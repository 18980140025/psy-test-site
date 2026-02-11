// gate.js —— 单设备 + 24小时访问控制（前端版）
// 适合：低价内容 / 心理测试 / 非强安全场景

(function () {
  // ================== 可配置区域（你只需要看这里） ==================
  const BRAND_NAME = "你这样的人"; // 拦截页面显示的品牌名
  const SECRET = "lylyjlylyjlylyjlylyjlylyjlylyjlylyjlylyj"; 
  // ↑↑↑ 很重要：改成你自己的任意一串字符（30位以上，字母数字都行）
  // ====================================================================

  /* ---------- 工具函数 ---------- */
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

  /* ---------- token 校验 ---------- */
  function parseToken(token) {
    try {
      const parts = token.split(".");
      if (parts.length !== 2) return null;

      const payload = JSON.parse(atob(parts[0]));
      const sig = parts[1];

      // 校验过期时间
      if (!payload.exp || Date.now() > payload.exp) return "expired";

      // 简单签名校验（弱安全，但足够）
      const raw = parts[0] + "." + SECRET;
      const expected = btoa(raw).replace(/=+$/, "");
      if (sig !== expected) return "invalid";

      return payload;
    } catch (e) {
      return null;
    }
  }

  /* ---------- 主逻辑 ---------- */
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
    // 第一次访问：绑定设备
    localStorage.setItem(bindKey, deviceId);
    return;
  }

  if (record !== deviceId) {
    block(
      "设备不匹配",
      "该链接已绑定到另一台设备，24 小时内仅支持首次打开的设备访问。"
    );
    return;
  }

  // 同设备，放行
})();
