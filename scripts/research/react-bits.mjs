const registryUrl = 'https://reactbits.dev/r/registry.json';

export async function collectReactBits(fetchPage = fetch) {
    const response = await fetchPage(registryUrl, {
        redirect: 'error', signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok || !response.body) throw new Error('React Bits registry request failed: ' + response.status);
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
        size += chunk.byteLength;
        if (size > 2_000_000) throw new Error('React Bits registry exceeded size limit');
        chunks.push(chunk);
    }
    const { items } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!Array.isArray(items)) throw new Error('React Bits registry is missing items');
    const designs = new Map();
    for (const item of items) {
        // Styled variants represent visual components; the unsuffixed styles are audio tools.
        const match = /^([a-z0-9]+)-(?:JS|TS)-(?:CSS|TW)$/i.exec(item?.name);
        if (item?.type !== 'registry:component' || !match) continue;
        const id = match[1];
        if (!designs.has(id)) {
            if (typeof item.description !== 'string' || !item.description.trim()) {
                throw new Error('React Bits component lacks a description: ' + id);
            }
            designs.set(id, { id, description: item.description.trim().slice(0, 500) });
        }
    }
    if (designs.size < 2) throw new Error('React Bits registry has insufficient visual components');
    return [...designs.values()];
}

export function verifyReactBits(catalog, evaluation) {
    const ids = new Set(catalog.map(design => design.id));
    const reviewed = evaluation.reactBitsReviewed;
    if (!Array.isArray(reviewed) || reviewed.length !== ids.size
        || new Set(reviewed).size !== ids.size || reviewed.some(id => !ids.has(id))) {
        throw new Error('Incomplete or invalid React Bits catalog coverage');
    }
    for (const feature of evaluation.features ?? []) {
        const components = feature.reactBitsComponents;
        if (feature.repository?.toLowerCase() !== 'davidhdev/react-bits' || !Array.isArray(components)
            || components.length < 2 || new Set(components).size !== components.length
            || components.some(id => !ids.has(id))) {
            throw new Error('Invalid React Bits component combination: ' + feature.title);
        }
    }
}
