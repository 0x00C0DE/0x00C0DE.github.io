export function configureProxyTrust(app, value) {
    const proxies = value?.trim() ? value.split(',').map(proxy => proxy.trim()) : false;
    if (proxies && proxies.some(proxy => !proxy || /^\d+$/.test(proxy))) {
        throw new Error('TRUSTED_PROXIES must contain explicit proxy IP addresses or CIDR subnets.');
    }
    app.set('trust proxy', proxies);
}
