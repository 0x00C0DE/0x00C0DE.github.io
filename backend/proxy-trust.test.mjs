import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { configureProxyTrust } from './proxy-trust.mjs';

test('direct clients cannot spoof their address with forwarded headers', () => {
    const app = express();
    configureProxyTrust(app, undefined);
    const request = Object.create(app.request);
    request.app = app;
    request.socket = { remoteAddress: '198.51.100.2' };
    request.headers = { 'x-forwarded-for': '192.0.2.99' };
    assert.equal(request.ip, '198.51.100.2');
});

test('only explicitly trusted proxy addresses may forward client IPs', () => {
    const app = express();
    configureProxyTrust(app, '127.0.0.1, ::1');
    const request = Object.create(app.request);
    request.app = app;
    request.socket = { remoteAddress: '127.0.0.1' };
    request.headers = { 'x-forwarded-for': '192.0.2.99, 198.51.100.2' };
    assert.equal(request.ip, '198.51.100.2');
});

test('invalid proxy configuration fails at startup', () => {
    for (const value of ['true', '1', 'bad-address', '127.0.0.1,']) {
        assert.throws(() => configureProxyTrust(express(), value));
    }
});

test('mapped IPv6 prefixes cannot accidentally trust every IPv4 client', () => {
    const app = express();
    app.set('trust proxy', ['::ffff:10.0.0.0/8']);
    assert.equal(app.get('trust proxy fn')('198.51.100.2'), false);
    app.set('trust proxy', ['::ffff:10.0.0.0/104']);
    const trust = app.get('trust proxy fn');
    assert.equal(trust('10.1.2.3'), true);
    assert.equal(trust('198.51.100.2'), false);
});
