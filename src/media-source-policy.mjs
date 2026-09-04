const TRUSTED_EXTERNAL_MEDIA_HOSTS = new Set([
    '0x00c0de-blog-append.0x00c0de.workers.dev',
    'i.imgur.com',
    'imgur.com',
    'quickchart.io',
    'raw.githubusercontent.com'
]);

const SAFE_IMAGE_DATA_URL_PATTERN = /^data:image\/(?:gif|jpeg|jpg|png|webp);base64,[a-z0-9+/]+={0,2}$/i;

function normalizeBaseUrl(baseHref) {
    try {
        const baseUrl = new URL(String(baseHref || ''));
        if (baseUrl.protocol === 'http:' || baseUrl.protocol === 'https:') {
            return baseUrl;
        }
    } catch {
        // Invalid bases cannot establish a trusted origin.
    }

    return null;
}

export function normalizeTrustedMediaSource(source, baseHref) {
    if (typeof source !== 'string') {
        return '';
    }

    const candidate = source.trim();
    if (!candidate) {
        return '';
    }

    if (SAFE_IMAGE_DATA_URL_PATTERN.test(candidate)) {
        return candidate;
    }

    const baseUrl = normalizeBaseUrl(baseHref);
    if (!baseUrl) {
        return '';
    }

    try {
        const parsed = new URL(candidate, baseUrl);
        if (parsed.username || parsed.password) {
            return '';
        }

        if (parsed.protocol === 'blob:') {
            return parsed.origin === baseUrl.origin ? parsed.toString() : '';
        }

        if (parsed.origin === baseUrl.origin) {
            return parsed.protocol === 'http:' || parsed.protocol === 'https:'
                ? parsed.toString()
                : '';
        }

        if (
            parsed.protocol === 'https:'
            && TRUSTED_EXTERNAL_MEDIA_HOSTS.has(parsed.hostname.toLowerCase())
        ) {
            return parsed.toString();
        }
    } catch {
        // Malformed or unsupported sources are blocked.
    }

    return '';
}
