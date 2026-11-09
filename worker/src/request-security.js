const encoder = new TextEncoder();

async function signingKey(secret) {
    return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

function encode(bytes) {
    return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function decode(value) {
    return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), character => character.charCodeAt(0));
}

export async function signValue(secret, purpose, value) {
    const signature = await crypto.subtle.sign('HMAC', await signingKey(secret), encoder.encode(JSON.stringify([purpose, value])));
    return encode(new Uint8Array(signature));
}

export async function verifyValue(secret, purpose, value, signature) {
    if (!secret || typeof signature !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(signature)) return false;
    return crypto.subtle.verify('HMAC', await signingKey(secret), decode(signature), encoder.encode(JSON.stringify([purpose, value])));
}

export async function issueGrant(secret, purpose, lifetimeMs, now = Date.now()) {
    const payload = encode(encoder.encode(JSON.stringify({ id: crypto.randomUUID(), expiresAt: now + lifetimeMs })));
    return { token: payload + '.' + await signValue(secret, purpose, payload), expiresAt: now + lifetimeMs };
}

export async function readGrant(secret, purpose, token, now = Date.now()) {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{1,160}\.[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const [payload, signature] = token.split('.');
    if (!await verifyValue(secret, purpose, payload, signature)) return null;
    const grant = JSON.parse(new TextDecoder().decode(decode(payload)));
    return grant.expiresAt > now ? grant : null;
}

export async function verifyTurnstile(secret, token, ip, allowedOrigin, action) {
    if (!secret || typeof token !== 'string' || !token || token.length > 2048) return false;
    const expectedHostname = new URL(allowedOrigin).hostname;
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: new URLSearchParams({ secret, response: token, ...(ip && ip !== 'unknown' ? { remoteip: ip } : {}) }),
        signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return false;
    const result = await response.json();
    return result.success === true && result.hostname === expectedHostname && result.action === action;
}

export async function digestVisitId(visitorId, visitId, visitSecret) {
    return encode(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(JSON.stringify([visitorId, visitId, visitSecret])))));
}
