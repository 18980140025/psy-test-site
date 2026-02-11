import base64, json, time, hashlib

# 必须与 gate.js 里的 secret 完全一致
SECRET = "lylyjlylyjlylyjlylyjlylyjlylyjlylyjlylyj"

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")

def sha256_hex(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

def hex_to_bytes(h: str) -> bytes:
    return bytes.fromhex(h)

def make_token(hours=24) -> str:
    now = int(time.time() * 1000)
    exp = now + int(hours * 60 * 60 * 1000)
    nonce = hashlib.sha256(f"{now}".encode()).hexdigest()[:16]  # 16位随机标识
    payload = {"nonce": nonce, "iat": now, "exp": exp}
    payload_b64 = b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))

    sig_hex = sha256_hex(payload_b64 + "." + SECRET)
    sig_b64 = b64url(hex_to_bytes(sig_hex))
    return f"{payload_b64}.{sig_b64}"

if __name__ == "__main__":
    token = make_token(24)
    print(token)
