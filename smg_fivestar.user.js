// ==UserScript==
// @name             收看SMGTV电视节目
// @namespace        http://tampermonkey.net/
// @version          0.20
// @description      收看SMGTV，并解除页面部分限制
// @author           https://github.com/Popukok
// @match            *://*.kankanews.com/huikan*
// @icon             https://live.kankanews.com/favicon.ico
// @updateURL        https://raw.githubusercontent.com/Popukok/smg_live/refs/heads/main/smg_fivestar.user.js
// @downloadURL      https://raw.githubusercontent.com/Popukok/smg_live/refs/heads/main/smg_fivestar.user.js
// @run-at           document-start
// @grant            GM_xmlhttpRequest
// @grant            unsafeWindow
// @connect          kapi.kankanews.com
// ==/UserScript==
(function() {
    'use strict';
    const UW = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
    const LS = (() => { try { return UW.localStorage || localStorage; } catch (e) { return localStorage; } })();
    const STYLE_ID = 'smgtv-unlock-style';
    const VIDEO_READY_CLASS = 'smgtv-video-ready';
    const FULLSCREEN_FALLBACK_CLASS = 'smgtv-fallback-fullscreen';
    const FULLSCREEN_TARGET_CLASS = 'smgtv-fallback-fullscreen-target';
    const FULLSCREEN_BUTTON_SELECTOR = '.xgplayer-fullscreen';
    const VIDEO_READY_EVENTS = ['loadeddata', 'canplay', 'playing', 'timeupdate', 'progress'];
    const VIDEO_RESET_EVENTS = ['loadstart', 'waiting', 'stalled', 'emptied'];
    const watchedVideos = new WeakSet();
    const streamAddressCache = Object.create(null);
    const channelShiftBaseCache = Object.create(null);
    const channelLiveBaseCache = Object.create(null);
    const SMG_API_SECRET = '28c8edde3d61a0411511d3b1866f0636';
    const SMG_API_VERSION = '2.42.23';
    const SMG_PUBKEY = '-----BEGIN PUBLIC KEY-----\n' +
          'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDP5hzPUW5RFeE2xBT1ERB3hHZI\n' +
          'Votn/qatWhgc1eZof09qKjElFN6Nma461ZAwGpX4aezKP8Adh4WJj4u2O54xCXDt\n' +
          'wzKRqZO2oNZkuNmF2Va8kLgiEQAAcxYc8JgTN+uQQNpsep4n/o1sArTJooZIF17E\n' +
          'tSqSgXDcJ7yDj5rc7wIDAQAB\n' +
          '-----END PUBLIC KEY-----';
    function parseJwtExp(url) {
        try {
            const token = new URL(url).searchParams.get('token');
            if (!token) return null;
            const payload = token.split('.')[1];
            if (!payload) return null;
            const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
            const padded = b64 + '='.repeat((4 - b64.length % 4) % 4);
            const json = JSON.parse(atob(padded));
            return typeof json.exp === 'number' ? json.exp * 1000 : null;
        } catch (e) {
            return null;
        }
    }
    function smgMd5(str) {
        function rl(n, c) { return (n << c) | (n >>> (32 - c)); }
        function add(x, y) {
            var l = (x & 0xffff) + (y & 0xffff);
            var m = (x >> 16) + (y >> 16) + (l >> 16);
            return (m << 16) | (l & 0xffff);
        }
        function cmn(q, a, b, x, s, t) {
            a = add(add(a, q), add(x, t));
            return add(rl(a, s), b);
        }
        function ff(a, b, c, d, x, s, t) { return cmn((b & c) | ((~b) & d), a, b, x, s, t); }
        function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & (~d)), a, b, x, s, t); }
        function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
        function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | (~d)), a, b, x, s, t); }
        function binl(s) {
            var b = [];
            var m = (1 << 8) - 1;
            for (var i = 0; i < s.length * 8; i += 8) b[i >> 5] |= (s.charCodeAt(i / 8) & m) << (i % 32);
            return b;
        }
        function binl2hex(b) {
            var h = "0123456789abcdef";
            var s = "";
            for (var i = 0; i < b.length * 4; i++) {
                s += h.charAt((b[i >> 2] >> ((i % 4) * 8 + 4)) & 0xf) + h.charAt((b[i >> 2] >> ((i % 4) * 8)) & 0xf);
            }
            return s;
        }
        str = unescape(encodeURIComponent(str));
        var x = binl(str);
        x[str.length >> 2] |= 0x80 << ((str.length % 4) << 3);
        x[(((str.length + 8) >> 6) << 4) + 14] = str.length * 8;
        var a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
        for (var i = 0; i < x.length; i += 16) {
            var oa = a, ob = b, oc = c, od = d;
            a = ff(a, b, c, d, x[i], 7, -680876936); d = ff(d, a, b, c, x[i + 1], 12, -389564586);
            c = ff(c, d, a, b, x[i + 2], 17, 606105819); b = ff(b, c, d, a, x[i + 3], 22, -1044525330);
            a = ff(a, b, c, d, x[i + 4], 7, -176418897); d = ff(d, a, b, c, x[i + 5], 12, 1200080426);
            c = ff(c, d, a, b, x[i + 6], 17, -1473231341); b = ff(b, c, d, a, x[i + 7], 22, -45705983);
            a = ff(a, b, c, d, x[i + 8], 7, 1770035416); d = ff(d, a, b, c, x[i + 9], 12, -1958414417);
            c = ff(c, d, a, b, x[i + 10], 17, -42063); b = ff(b, c, d, a, x[i + 11], 22, -1990404162);
            a = ff(a, b, c, d, x[i + 12], 7, 1804603682); d = ff(d, a, b, c, x[i + 13], 12, -40341101);
            c = ff(c, d, a, b, x[i + 14], 17, -1502002290); b = ff(b, c, d, a, x[i + 15], 22, 1236535329);
            a = gg(a, b, c, d, x[i + 1], 5, -165796510); d = gg(d, a, b, c, x[i + 6], 9, -1069501632);
            c = gg(c, d, a, b, x[i + 11], 14, 643717713); b = gg(b, c, d, a, x[i], 20, -373897302);
            a = gg(a, b, c, d, x[i + 5], 5, -701558691); d = gg(d, a, b, c, x[i + 10], 9, 38016083);
            c = gg(c, d, a, b, x[i + 15], 14, -660478335); b = gg(b, c, d, a, x[i + 4], 20, -405537848);
            a = gg(a, b, c, d, x[i + 9], 5, 568446438); d = gg(d, a, b, c, x[i + 14], 9, -1019803690);
            c = gg(c, d, a, b, x[i + 3], 14, -187363961); b = gg(b, c, d, a, x[i + 8], 20, 1163531501);
            a = gg(a, b, c, d, x[i + 13], 5, -1444681467); d = gg(d, a, b, c, x[i + 2], 9, -51403784);
            c = gg(c, d, a, b, x[i + 7], 14, 1735328473); b = gg(b, c, d, a, x[i + 12], 20, -1926607734);
            a = hh(a, b, c, d, x[i + 5], 4, -378558); d = hh(d, a, b, c, x[i + 8], 11, -2022574463);
            c = hh(c, d, a, b, x[i + 11], 16, 1839030562); b = hh(b, c, d, a, x[i + 14], 23, -35309556);
            a = hh(a, b, c, d, x[i + 1], 4, -1530992060); d = hh(d, a, b, c, x[i + 4], 11, 1272893353);
            c = hh(c, d, a, b, x[i + 7], 16, -155497632); b = hh(b, c, d, a, x[i + 10], 23, -1094730640);
            a = hh(a, b, c, d, x[i + 13], 4, 681279174); d = hh(d, a, b, c, x[i], 11, -358537222);
            c = hh(c, d, a, b, x[i + 3], 16, -722521979); b = hh(b, c, d, a, x[i + 6], 23, 76029189);
            a = hh(a, b, c, d, x[i + 9], 4, -640364487); d = hh(d, a, b, c, x[i + 12], 11, -421815835);
            c = hh(c, d, a, b, x[i + 15], 16, 530742520); b = hh(b, c, d, a, x[i + 2], 23, -995338651);
            a = ii(a, b, c, d, x[i], 6, -198630844); d = ii(d, a, b, c, x[i + 7], 10, 1126891415);
            c = ii(c, d, a, b, x[i + 14], 15, -1416354905); b = ii(b, c, d, a, x[i + 5], 21, -57434055);
            a = ii(a, b, c, d, x[i + 12], 6, 1700485571); d = ii(d, a, b, c, x[i + 3], 10, -1894986606);
            c = ii(c, d, a, b, x[i + 10], 15, -1051523); b = ii(b, c, d, a, x[i + 1], 21, -2054922799);
            a = ii(a, b, c, d, x[i + 8], 6, 1873313359); d = ii(d, a, b, c, x[i + 15], 10, -30611744);
            c = ii(c, d, a, b, x[i + 6], 15, -1560198380); b = ii(b, c, d, a, x[i + 13], 21, 1309151649);
            a = ii(a, b, c, d, x[i + 4], 6, -145523070); d = ii(d, a, b, c, x[i + 11], 10, -1120210379);
            c = ii(c, d, a, b, x[i + 2], 15, 718787259); b = ii(b, c, d, a, x[i + 9], 21, -343485551);
            a = add(a, oa); b = add(b, ob); c = add(c, oc); d = add(d, od);
        }
        return binl2hex([a, b, c, d]);
    }
    function smgSignParams(params) {
        const n = {
            platform: 'pc',
            version: SMG_API_VERSION,
            nonce: Math.random().toString(36).slice(-8),
            timestamp: Math.floor(Date.now() / 1000),
            'Api-Version': 'v1'
        };
        const merged = {};
        Object.keys(params).forEach(k => { merged[k] = params[k]; });
        Object.keys(n).forEach(k => { merged[k] = n[k]; });
        let s = '';
        Object.keys(merged).sort().forEach(k => {
            if (merged[k] != null) s += k + '=' + merged[k] + '&';
        });
        merged.sign = smgMd5(smgMd5(s + SMG_API_SECRET));
        return merged;
    }
    function shortUrl(url) { return url.split('kankanews.com')[1] || ''; }
    function gmApiGet(url, headers) {
        let gmHeaders = headers;
        try {
            const ua = (UW.navigator && UW.navigator.userAgent) || navigator.userAgent;
            if (ua) gmHeaders = Object.assign({}, headers, { 'User-Agent': ua });
        } catch (e) {}
        return new Promise((resolve) => {
            try {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    headers: gmHeaders,
                    timeout: 15000,
                    onload: function(response) {
                        try {
                            if (response.status !== 200) {
                                console.warn('[SMGTV] GM接口异常 status=', response.status, shortUrl(url));
                            }
                            resolve(JSON.parse(response.responseText));
                        } catch (e) {
                            console.warn('[SMGTV] GM响应解析失败 status=', response.status, shortUrl(url));
                            resolve(null);
                        }
                    },
                    onerror: function() { console.warn('[SMGTV] GM请求失败', shortUrl(url)); resolve(null); },
                    ontimeout: function() { console.warn('[SMGTV] GM请求超时', shortUrl(url)); resolve(null); }
                });
            } catch (e) {
                console.warn('[SMGTV] GM调用异常', e);
                resolve(null);
            }
        });
    }
    function smgApiGet(path, params) {
        const signed = smgSignParams(params || {});
        const q = Object.keys(params || {}).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k])).join('&');
        const headers = { Accept: 'application/json, text/plain, */*' };
        Object.keys(signed).forEach(hk => { headers[hk] = signed[hk]; });
        headers['M-Uuid'] = LS.getItem('uuid') || '';
        const url = 'https://kapi.kankanews.com' + path + (q ? '?' + q : '');
        let pageFetch;
        try {
            pageFetch = UW.fetch(url, { headers: headers });
        } catch (e) {
            return gmApiGet(url, headers);
        }
        return pageFetch
            .then(res => {
                if (!res || !res.ok) {
                    console.warn('[SMGTV] 接口异常 status=', res && res.status, shortUrl(url));
                }
                return res.text();
            })
            .then(txt => JSON.parse(txt))
            .catch(e => {
                console.warn('[SMGTV] 页面fetch失败, 转GM兜底:', shortUrl(url), e && e.message);
                return gmApiGet(url, headers);
            });
    }
    function hexToBase64(hexStr) {
        try {
            const bytes = hexStr.replace(/\s+/g, '').match(/[\da-fA-F]{2}/g) || [];
            if (!bytes.length) return '';
            return btoa(bytes.map(b => String.fromCharCode(parseInt(b, 16))).join(''));
        } catch (e) {
            return '';
        }
    }
    function decryptRsaChunks(encryptedBase64, onReady) {
        let done = false;
        const finish = result => {
            if (done) return;
            done = true;
            onReady(result);
        };
        const tryDecrypt = () => {
            if (typeof UW.JSEncrypt === 'undefined') return false;
            try {
                const encrypt = new UW.JSEncrypt();
                encrypt.setPublicKey(SMG_PUBKEY);
                let hexStr;
                try {
                    const binary = atob(encryptedBase64);
                    hexStr = Array.from(binary, ch => ('0' + ch.charCodeAt(0).toString(16)).slice(-2)).join('').toUpperCase();
                } catch (e) {
                    finish('');
                    return true;
                }
                let out = '';
                for (let i = 0; i < hexStr.length;) {
                    const chunk = hexStr.slice(i, i + 256);
                    i += 256;
                    const b64 = hexToBase64(chunk);
                    if (!b64) continue;
                    const decrypted = encrypt.decrypt(b64);
                    if (decrypted) out += decrypted;
                }
                if (out) {
                    finish(out);
                    return true;
                }
            } catch (e) {}
            return false;
        };
        if (tryDecrypt()) return;
        let tries = 0;
        const timer = setInterval(() => {
            tries += 1;
            if (tryDecrypt()) {
                clearInterval(timer);
            } else if (tries > 50) {
                clearInterval(timer);
                console.warn('[SMGTV] RSA解密失败(JSEncrypt不可用或密文异常)');
                finish('');
            }
        }, 200);
    }
    let fullscreenFallbackTarget = null;
    let cssFullscreenFallbackPlayer = null;
    let lastFullscreenActionAt = 0;
    const logThrottle = Object.create(null);
    function throttleLog(key, intervalMs, fn) {
        const now = Date.now();
        if ((logThrottle[key] || 0) + intervalMs > now) {
            return;
        }
        logThrottle[key] = now;
        fn();
    }
    function rememberStreamAddresses(channelId, liveAddress, shiftAddress) {
        if (channelId == null || channelId === '') {
            return;
        }
        const key = String(channelId);
        const prev = streamAddressCache[key] || { live_address: '', shift_address: '' };
        streamAddressCache[key] = {
            live_address: liveAddress || prev.live_address || '',
            shift_address: shiftAddress || prev.shift_address || ''
        };
    }
    function fillStreamAddresses(target, channelId) {
        if (!target) {
            return false;
        }
        const cached = streamAddressCache[String(channelId)] || {};
        const channelLiveAddress = cached.live_address || cached.shift_address;
        const channelShiftAddress = cached.shift_address || cached.live_address;
        if (channelLiveAddress && !target.live_address) {
            target.live_address = channelLiveAddress;
        }
        if (channelShiftAddress && !target.shift_address) {
            target.shift_address = channelShiftAddress;
        }
    }
    function getResultChannelId(result) {
        return result?.channel_id || result?.channel_info?.id || result?.id;
    }
    function forceOpenProgram(program) {
        if (!program) {
            return;
        }
        program.is_shield = 0;
        program.can_review = 1;
        program.is_review = 1;
    }
    function forceOpenProgramList(component) {
        if (!component) {
            return;
        }
        ['currentProgramList', 'playingProgramList', 'slitProgramList'].forEach(key => {
            const list = component[key];
            if (!Array.isArray(list)) {
                return;
            }
            list.forEach(program => {
                if (program && (program.is_shield !== 0 || program.can_review !== 1 || program.is_review !== 1)) {
                    forceOpenProgram(program);
                }
            });
        });
        const detailPrograms = component.programDetail?.program_list;
        if (Array.isArray(detailPrograms)) {
            detailPrograms.forEach(program => forceOpenProgram(program));
        }
    }
    function ensurePlayableStream(component) {
        if (!component) {
            return;
        }
        forceOpenProgram(component.programObj);
        const channelDetail = component.currChannelDetail;
        if (channelDetail) {
            rememberStreamAddresses(channelDetail.id, channelDetail.live_address, channelDetail.shift_address);
        }
        const detail = component.programDetail;
        if (!detail) {
            return;
        }
        forceOpenProgram(detail);
        if (detail.is_exist_pad && !(detail.pad_video_info && detail.pad_video_info.play_url)) {
            detail.is_exist_pad = 0;
            detail.pad_src = '';
        }
        const channelInfo = detail.channel_info || (detail.channel_info = {});
        const channelId = getResultChannelId(detail) || channelDetail?.id;
        if (channelDetail) {
            if (channelDetail.live_address) {
                channelInfo.live_address = channelDetail.live_address;
            }
            if (channelDetail.shift_address) {
                channelInfo.shift_address = channelDetail.shift_address;
            }
        }
        fillStreamAddresses(channelInfo, channelId);
    }
    function stripTimeWindow(url) {
        try {
            const u = new URL(url);
            u.searchParams.delete('start');
            u.searchParams.delete('end');
            return u.toString();
        } catch (e) {
            return url
                .replace(/&start=\d+&end=\d+(?=&|$)/g, '')
                .replace(/\?start=\d+&end=\d+(?=&|$)/g, '?')
                .replace(/\?$/, '');
        }
    }
    function isMobileSite() {
        try { return /^m\./.test(location.hostname); } catch (e) { return false; }
    }
    function getCompChannelId(component) {
        if (!component) return null;
        if (component.currChannel?.id != null) return component.currChannel.id;
        if (component.currChannelDetail?.id != null) return component.currChannelDetail.id;
        if (component.programDetail?.channel_info?.id != null) return component.programDetail.channel_info.id;
        if (component.id != null && /^\d+$/.test(String(component.id))) return component.id;
        if (component.programObj?.channel_id != null) return component.programObj.channel_id;
        return null;
    }
    function resolveBaseOk(channelId) {
        const now = Date.now();
        if (channelId == null) return '';
        const shiftEntry = channelShiftBaseCache[channelId];
        if (shiftEntry && shiftEntry.exp > now) return shiftEntry.url;
        const liveEntry = channelLiveBaseCache[channelId];
        if (liveEntry && liveEntry.exp > now) return liveEntry.url;
        return '';
    }
    function installReplayUrlPatch(component) {
        const XGPlayer = component.$xgplayer;
        if (!XGPlayer || component.__smgReplayPatchInstalled) {
            return;
        }
        component.__smgReplayPatchInstalled = true;
        component.$xgplayer = new Proxy(XGPlayer, {
            construct(target, args) {
                const config = args[0] || {};
                const program = component.programObj;
                const channelId = getCompChannelId(component);
                let url = (config.url && typeof config.url === 'string') ? config.url : '';
                if (channelId != null && /\.m3u8/.test(url)) {
                    const base = stripTimeWindow(url);
                    if (base) {
                        const fromShift = /[?&]start=\d+/.test(url);
                        const store = fromShift ? channelShiftBaseCache : channelLiveBaseCache;
                        const exp = parseJwtExp(url);
                        if (exp != null) {
                            store[channelId] = { url: base, exp: exp };
                        }
                        if (fromShift) {
                            console.log('[SMGTV] 已抓取回看源');
                        } else {
                            console.log('[SMGTV] 已抓取直播源');
                        }
                    }
                }
                const baseOk = resolveBaseOk(channelId);
                const isReplay = config.isLive === false;
                const hasStream = /\.m3u8/.test(url);
                const hasWindow = /\bstart=\d/.test(url);
                if (isReplay && hasWindow) {
                    return new target(...args);
                }
                if (isReplay && hasStream && !hasWindow && program?.start_time && program?.end_time) {
                    config.url = url + (url.includes('?') ? '&' : '?') +
                        'start=' + program.start_time + '&end=' + program.end_time;
                } else if (isReplay && !hasStream && program?.start_time && program?.end_time) {
                    if (baseOk) {
                        config.url = baseOk + '&start=' + program.start_time + '&end=' + program.end_time;
                        console.log('[SMGTV] 已注入回放 频道' + channelId);
                    } else {
                        component.__smgNeedShiftBase = true;
                    }
                } else if (!isReplay && !hasStream) {
                    if (baseOk) {
                        config.url = baseOk;
                        console.log('[SMGTV] 已注入直播 频道' + channelId);
                    } else {
                        component.__smgNeedShiftBase = true;
                    }
                }
                return new target(...args);
            }
        });
    }
    function wrapMobileInitPlayer(component) {
        if (!isMobileSite()) return;
        const original = component?.initPlayer;
        if (!original || original.__smgMobileWrapped) return;
        const wrapped = function (opts) {
            if (opts && typeof opts === 'object' && 'url' in opts && !opts.url) {
                const program = this?.programObj;
                const channelId = getCompChannelId(this);
                const base = resolveBaseOk(channelId);
                if (base && program?.start_time && program?.end_time) {
                    const isReplay = opts.isLive === false;
                    if (isReplay) {
                        opts.url = base + (base.includes('?') ? '&' : '?') +
                            'start=' + program.start_time + '&end=' + program.end_time;
                    } else {
                        opts.url = base;
                    }
                    console.log('[SMGTV] 已注入' + (isReplay ? '回放' : '直播') + ' 频道' + channelId);
                } else if (channelId != null) {
                    component.__smgNeedShiftBase = true;
                }
            }
            return original.apply(this, arguments);
        };
        wrapped.__smgMobileWrapped = true;
        component.initPlayer = wrapped;
    }
    function dateStrOffset(daysAgo) {
        const d = new Date(Date.now() - daysAgo * 86400000);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    function findTodayDonorId(component) {
        const lists = [component?.currentProgramList, component?.playingProgramList];
        const isEnded = p => p && p.id && p.isOutDate === 0 && p.play === 0;
        for (const list of lists) {
            if (!Array.isArray(list)) continue;
            for (const p of list) {
                if (isEnded(p) && typeof p.name === 'string' && p.name.indexOf('体育新闻') !== -1) return p.id;
            }
        }
        for (const list of lists) {
            if (!Array.isArray(list)) continue;
            for (const p of list) {
                if (isEnded(p) && p.is_review === 1) return p.id;
            }
        }
        return null;
    }
    function findDonorIdFromList(list) {
        if (!Array.isArray(list)) return null;
        const news = list.find(p => p && p.is_review === 1 && p.id &&
                               typeof p.name === 'string' && p.name.indexOf('体育新闻') !== -1);
        if (news) return news.id;
        const any = list.find(p => p && p.is_review === 1 && p.id);
        return any ? any.id : null;
    }
    function fetchShiftByDonor(channelId, donorId) {
        return smgApiGet('/content/pc/tv/program/detail', { channel_program_id: donorId })
            .then(res => {
            const detail = res && res.result;
            const enc = detail && detail.channel_info && detail.channel_info.shift_address;
            if (!enc) return null;
            return new Promise(resolve => {
                decryptRsaChunks(enc, url => {
                    if (!url) return resolve(null);
                    try {
                        const u = new URL(url);
                        u.searchParams.delete('start');
                        u.searchParams.delete('end');
                        const base = u.toString();
                        const exp = parseJwtExp(url);
                        channelShiftBaseCache[channelId] = { url: base, exp: exp || (Date.now() + 12 * 3600 * 1000) };
                        console.log('[SMGTV] 已获取回看源');
                        resolve(base);
                    } catch (e) {
                        resolve(null);
                    }
                });
            });
        });
    }
    function acquireShiftBase(channelId, component) {
        let candidate;
        if (component) {
            const todayId = findTodayDonorId(component);
            if (todayId) candidate = todayId;
        }
        if (!candidate) {
            const listPromise = smgApiGet('/content/pc/tv/programs', { channel_id: channelId, date: dateStrOffset(0) });
            return listPromise.then(res => {
                const id = findDonorIdFromList(res && res.result && res.result.programs);
                if (id) return fetchShiftByDonor(channelId, id).then(url => url || scanPast(channelId, 1));
                return scanPast(channelId, 1);
            });
        }
        return fetchShiftByDonor(channelId, candidate).then(url => url || scanPast(channelId, 1));
    }
    function scanPast(channelId, daysAgo) {
        if (daysAgo > 7) {
            console.warn('[SMGTV] 7天内未找到可用的回看源');
            return Promise.resolve(null);
        }
        return smgApiGet('/content/pc/tv/programs', { channel_id: channelId, date: dateStrOffset(daysAgo) })
            .then(res => {
            const id = findDonorIdFromList(res && res.result && res.result.programs);
            if (!id) return scanPast(channelId, daysAgo + 1);
            return fetchShiftByDonor(channelId, id).then(url => {
                if (url) return url;
                return scanPast(channelId, daysAgo + 1);
            });
        });
    }
    function maybeAutoCaptureShift(component, fromMonitor) {
        if (!component || !component.__smgPatched || !component.__smgNeedShiftBase || !fromMonitor) {
            return;
        }
        const chId = getCompChannelId(component);
        if (chId == null) {
            return;
        }
        const now = Date.now();
        const hasBase = !!(channelShiftBaseCache[chId] && channelShiftBaseCache[chId].exp > now) ||
              !!(channelLiveBaseCache[chId] && channelLiveBaseCache[chId].exp > now);
        if (hasBase) {
            component.__smgNeedShiftBase = false;
            return;
        }
        if (String(chId) !== '10') {
            component.__smgNeedShiftBase = false;
            return;
        }
        const cooldownKey = '__smgShiftCooldown';
        if (now - (component[cooldownKey] || 0) < 60000) {
            return;
        }
        component[cooldownKey] = now;
        if (component.__smgAcquiring) {
            return;
        }
        component.__smgAcquiring = true;
        acquireShiftBase(chId, component).then(ok => {
            component.__smgAcquiring = false;
            if (ok) {
                component.__smgNeedShiftBase = false;
                component.__smgAcquireFails = 0;
                if (component && typeof component.initPlayer === 'function') {
                    if (isMobileSite()) {
                        const prog = component.programObj;
                        component.initPlayer({ url: '', isLive: !!(prog && prog.play === 1), autoplay: true });
                    } else {
                        component.initPlayer({ changeCurrentList: false, isPlay: true, trigger: 'click' });
                    }
                }
            } else {
                component.__smgAcquireFails = (component.__smgAcquireFails || 0) + 1;
                if (component.__smgAcquireFails >= 3) {
                    component[cooldownKey] = now + 10 * 60 * 1000;
                    console.warn('[SMGTV] 暂无可用播放源');
                }
            }
        });
    }
    function recoverPlayerIfNeeded(component) {
        if (!component || typeof component.initPlayer !== 'function' || component.__smgRecovering) {
            return;
        }
        const video = getPlayerVideo(component);
        const mediaError = video?.error;
        if (!(component.player && mediaError && mediaError.code === 4)) {
            return;
        }
        ensurePlayableStream(component);
        const hasLive = !!(component.programDetail?.channel_info?.live_address ||
                           component.currChannelDetail?.live_address);
        if (!hasLive) {
            if (component.__smgNeedShiftBase) {
                component.__smgRecovering = true;
                maybeAutoCaptureShift(component, true);
                setTimeout(() => {
                    component.__smgRecovering = false;
                }, 2000);
            }
            return;
        }
        component.__smgRecoverCount = (component.__smgRecoverCount || 0) + 1;
        if (component.__smgRecoverCount > 3) {
            return;
        }
        component.__smgRecovering = true;
        component.initPlayer({ changeCurrentList: false, isPlay: true, trigger: 'click' });
        setTimeout(() => {
            component.__smgRecovering = false;
        }, 2000);
    }
    function injectStyle(cssText) {
        const appendStyle = () => {
            if (document.getElementById(STYLE_ID)) {
                return;
            }
            const style = document.createElement('style');
            style.id = STYLE_ID;
            style.textContent = cssText;
            (document.head || document.documentElement).appendChild(style);
        };
        if (document.head || document.documentElement) {
            appendStyle();
        } else {
            document.addEventListener('DOMContentLoaded', appendStyle, { once: true });
        }
    }
    function ensureViewportFitCover() {
        const apply = () => {
            try {
                const meta = document.querySelector('meta[name="viewport"]');
                if (meta) {
                    const content = meta.getAttribute('content') || '';
                    if (!/viewport-fit\s*=\s*cover/i.test(content)) {
                        meta.setAttribute('content', content ? content + ', viewport-fit=cover' : 'viewport-fit=cover');
                    }
                    return;
                }
                const created = document.createElement('meta');
                created.setAttribute('name', 'viewport');
                created.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');
                (document.head || document.documentElement).appendChild(created);
            } catch (e) {
                throttleLog('viewport-error', 5000, () => console.warn('[SMGTV] 设置 viewport-fit 失败:', e));
            }
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', apply, { once: true });
        } else {
            apply();
        }
    }
    function getVueInstance(el) {
        return el?.__vue__ || el?.__vueParentComponent?.proxy || null;
    }
    function isTVComponent(instance) {
        return !!instance && (
            typeof instance.initPlayer === 'function' ||
            typeof instance.playProgram === 'function' ||
            typeof instance.setLiveTimer === 'function' ||
            ('isLoading' in instance && 'player' in instance)
        );
    }
    function findComponentFromElement(el) {
        let current = el;
        while (current) {
            const instance = getVueInstance(current);
            if (isTVComponent(instance)) {
                return instance;
            }
            current = current.parentElement;
        }
        return null;
    }
    function findTVComponent() {
        const selectors = ['.huikan', '.live-container', '.live-box', '.live-player', '.tv', '.player-box'];
        for (const selector of selectors) {
            const component = findComponentFromElement(document.querySelector(selector));
            if (component) {
                return component;
            }
        }
        return null;
    }
    function getPlayerVideo(component) {
        const player = component?.player;
        return player?.video ||
            player?.media ||
            player?.root?.querySelector?.('video') ||
            component?.$refs?.livePlayer?.querySelector?.('video') ||
            document.querySelector('.live-player video, .player-box video, .xgplayer video, video');
    }
    function isVideoReady(video) {
        return !!video && !video.error && (
            video.readyState >= 2 ||
            (!video.paused && video.currentTime > 0)
        );
    }
    function setVideoReadyClass(isReady) {
        const target = document.body || document.documentElement;
        target?.classList?.toggle(VIDEO_READY_CLASS, isReady);
    }
    function syncLoadingState(component) {
        forceOpenProgramList(component);
        maybeAutoCaptureShift(component, false);
        recoverPlayerIfNeeded(component);
        const video = getPlayerVideo(component);
        if (video) {
            watchPlayerVideo(component, video);
        }
        const isReady = isVideoReady(video);
        setVideoReadyClass(isReady);
        if (isReady && component && component.isLoading) {
            component.isLoading = false;
        }
        return isReady;
    }
    function watchPlayerVideo(component, video) {
        if (!video || watchedVideos.has(video)) {
            return;
        }
        watchedVideos.add(video);
        const markReady = () => syncLoadingState(component);
        const resetReady = () => {
            if (!isVideoReady(video)) {
                setVideoReadyClass(false);
            }
        };
        VIDEO_READY_EVENTS.forEach(eventName => {
            video.addEventListener(eventName, markReady, { passive: true });
        });
        VIDEO_RESET_EVENTS.forEach(eventName => {
            video.addEventListener(eventName, resetReady, { passive: true });
        });
        video.addEventListener('webkitbeginfullscreen', () => syncFullscreenButtonState(component, true), { passive: true });
        video.addEventListener('webkitendfullscreen', () => syncFullscreenButtonState(component, false), { passive: true });
        markReady();
    }
    function cleanupComponent(component) {
        if (!component) {
            return;
        }
        if (component.__smgLoadingMonitor) {
            clearInterval(component.__smgLoadingMonitor);
            component.__smgLoadingMonitor = null;
        }
        if (component.__smgLoadingObserver) {
            component.__smgLoadingObserver.disconnect();
            component.__smgLoadingObserver = null;
        }
        if (component.pageVisibilityChange) {
            document.removeEventListener('visibilitychange', component.pageVisibilityChange);
        }
    }
    function startLoadingMonitor(component) {
        if (!component || component.__smgLoadingMonitor) {
            return;
        }
        component.__smgLoadingMonitor = setInterval(() => {
            const rootEl = component.$el;
            if (rootEl && !rootEl.isConnected) {
                cleanupComponent(component);
                initComponentPatch();
                return;
            }
            maybeAutoCaptureShift(component, true);
            syncLoadingState(component);
        }, 500);
        if (component.$refs?.livePlayer && !component.__smgLoadingObserver) {
            component.__smgLoadingObserver = new MutationObserver(() => syncLoadingState(component));
            component.__smgLoadingObserver.observe(component.$refs.livePlayer, {
                childList: true,
                subtree: true
            });
        }
    }
    function getBrowserFullscreenElement() {
        return document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement ||
            null;
    }
    function requestElementFullscreen(el) {
        if (!el) {
            return Promise.reject(new Error('missing fullscreen target'));
        }
        const request =
              el.requestFullscreen ||
              el.webkitRequestFullscreen ||
              el.webkitRequestFullScreen ||
              el.mozRequestFullScreen ||
              el.msRequestFullscreen;
        if (!request) {
            return Promise.reject(new Error('fullscreen api unavailable'));
        }
        try {
            const result = request.call(el);
            return result && typeof result.then === 'function' ? result : Promise.resolve();
        } catch (e) {
            return Promise.reject(e);
        }
    }
    function exitBrowserFullscreen() {
        const exit =
              document.exitFullscreen ||
              document.webkitExitFullscreen ||
              document.webkitCancelFullScreen ||
              document.mozCancelFullScreen ||
              document.msExitFullscreen;
        if (!exit) {
            return Promise.resolve();
        }
        try {
            const result = exit.call(document);
            return result && typeof result.then === 'function' ? result : Promise.resolve();
        } catch (e) {
            return Promise.reject(e);
        }
    }
    function getFullscreenTarget(component, button) {
        return component?.player?.root ||
            button?.closest?.('.xgplayer') ||
            component?.$refs?.livePlayer?.querySelector?.('.xgplayer') ||
            component?.$refs?.livePlayer ||
            document.querySelector('.live-player .xgplayer, .player-box .xgplayer, .xgplayer, .live-player, .player-box');
    }
    function syncFullscreenButtonState(component, isFullscreen) {
        document.querySelectorAll(FULLSCREEN_BUTTON_SELECTOR).forEach(button => {
            button.setAttribute('data-state', isFullscreen ? 'full' : 'normal');
        });
    }
    function enterFallbackFullscreen(target, component) {
        if (!target) {
            return;
        }
        const player = component?.player;
        if (player && typeof player.getCssFullscreen === 'function') {
            try {
                player.getCssFullscreen(target);
                cssFullscreenFallbackPlayer = player;
                syncFullscreenButtonState(component, true);
                return;
            } catch (e) {
                console.warn('[SMGTV] xgplayer CSS 全屏失败，使用样式兜底', e);
            }
        }
        exitFallbackFullscreen(component);
        fullscreenFallbackTarget = target;
        target.classList.add(FULLSCREEN_TARGET_CLASS);
        document.body?.classList.add(FULLSCREEN_FALLBACK_CLASS);
        syncFullscreenButtonState(component, true);
    }
    function exitFallbackFullscreen(component) {
        const player = component?.player || cssFullscreenFallbackPlayer;
        if (cssFullscreenFallbackPlayer && player && typeof player.exitCssFullscreen === 'function') {
            try {
                player.exitCssFullscreen();
            } catch (e) {
                console.warn('[SMGTV] 退出 xgplayer CSS 全屏失败', e);
            }
        }
        cssFullscreenFallbackPlayer = null;
        if (fullscreenFallbackTarget) {
            fullscreenFallbackTarget.classList.remove(FULLSCREEN_TARGET_CLASS);
            fullscreenFallbackTarget = null;
        }
        document.body?.classList.remove(FULLSCREEN_FALLBACK_CLASS);
        syncFullscreenButtonState(component, false);
    }
    function isFallbackFullscreen() {
        return !!document.body?.classList.contains(FULLSCREEN_FALLBACK_CLASS) ||
            !!cssFullscreenFallbackPlayer?.cssfullscreen ||
            !!cssFullscreenFallbackPlayer?.isCssfullScreen;
    }
    function callFullscreenMethod(fn) {
        try {
            const result = fn();
            return result && typeof result.then === 'function' ? result : Promise.resolve();
        } catch (e) {
            return Promise.reject(e);
        }
    }
    function enterNativeVideoFullscreen(component) {
        const video = getPlayerVideo(component);
        if (!video || typeof video.webkitEnterFullscreen !== 'function') {
            return false;
        }
        try {
            video.webkitEnterFullscreen();
            syncFullscreenButtonState(component, true);
            return true;
        } catch (e) {
            console.warn('[SMGTV] iOS 原生视频全屏失败，使用 CSS 兜底', e);
            return false;
        }
    }
    function enterFullscreen(component, target) {
        const player = component?.player;
        const enterNative = callFullscreenMethod(() => (
            player && typeof player.getFullscreen === 'function' ?
            player.getFullscreen(target) :
            requestElementFullscreen(target)
        ));
        Promise.resolve(enterNative)
            .then(() => syncFullscreenButtonState(component, true))
            .catch(() => {
            if (!enterNativeVideoFullscreen(component)) {
                enterFallbackFullscreen(target, component);
            }
        });
    }
    function exitFullscreen(component) {
        const player = component?.player;
        if (isFallbackFullscreen()) {
            exitFallbackFullscreen(component);
            return;
        }
        const exitNative = callFullscreenMethod(() => (
            player && typeof player.exitFullscreen === 'function' ?
            player.exitFullscreen() :
            exitBrowserFullscreen()
        ));
        Promise.resolve(exitNative)
            .catch(exitBrowserFullscreen)
            .then(
            () => syncFullscreenButtonState(component, false),
            () => syncFullscreenButtonState(component, false)
        );
    }
    function handleFullscreenControl(event) {
        const button = event.target?.closest?.(FULLSCREEN_BUTTON_SELECTOR);
        if (!button) {
            return;
        }
        const now = Date.now();
        if (now - lastFullscreenActionAt < 300) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation?.();
            return;
        }
        lastFullscreenActionAt = now;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        const component = findTVComponent();
        const target = getFullscreenTarget(component, button);
        syncLoadingState(component);
        const video = getPlayerVideo(component);
        if (getBrowserFullscreenElement() || isFallbackFullscreen()) {
            exitFullscreen(component);
        } else if (video && video.webkitDisplayingFullscreen) {
            try {
                if (typeof video.webkitExitFullscreen === 'function') {
                    video.webkitExitFullscreen();
                }
            } catch (e) {
                console.warn('[SMGTV] 退出 iOS 原生全屏失败', e);
            }
            syncFullscreenButtonState(component, false);
        } else {
            enterFullscreen(component, target);
        }
    }
    function handleFullscreenChange() {
        if (getBrowserFullscreenElement()) {
            if (isFallbackFullscreen()) {
                exitFallbackFullscreen(findTVComponent());
            }
            syncFullscreenButtonState(findTVComponent(), true);
        } else if (!isFallbackFullscreen()) {
            syncFullscreenButtonState(findTVComponent(), false);
        }
    }
    function initFullscreenPatch() {
        document.addEventListener('click', handleFullscreenControl, true);
        document.addEventListener('touchend', handleFullscreenControl, true);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && isFallbackFullscreen()) {
                exitFallbackFullscreen(findTVComponent());
            }
        });
    }
    function wrapComponentMethod(component, methodName, after) {
        const original = component?.[methodName];
        if (typeof original !== 'function' || original.__smgWrapped) {
            return;
        }
        const wrapped = function() {
            const programId = this.programObj?.id;
            if (programId && programId !== this.__smgRecoverProgramId) {
                this.__smgRecoverProgramId = programId;
                this.__smgRecoverCount = 0;
            }
            ensurePlayableStream(this);
            const result = original.apply(this, arguments);
            const runAfter = () => {
                ensurePlayableStream(this);
                setTimeout(() => after(this), 0);
                setTimeout(() => after(this), 250);
                setTimeout(() => after(this), 1000);
            };
            if (result && typeof result.then === 'function') {
                result.then(runAfter, runAfter);
            } else {
                runAfter();
            }
            return result;
        };
        wrapped.__smgWrapped = true;
        wrapped.__smgOriginal = original;
        component[methodName] = wrapped;
    }
    function patchComponent(component) {
        if (!component) {
            return;
        }
        startLoadingMonitor(component);
        if (component.__smgPatched) {
            syncLoadingState(component);
            return;
        }
        component.__smgPatched = true;
        if (typeof component.countdown === 'number') {
            component.countdown = 99999999;
        }
        component.showOpenApp = false;
        component.showFlag = false;
        component.startCountdown = function() {};
        if (component.liveTimer) {
            clearTimeout(component.liveTimer);
            component.liveTimer = null;
        }
        if (!component.player && component.programObj?.id && typeof component.playProgram === 'function') {
            component.playProgram();
        }
        if (typeof component.pageVisibilityChange === 'function') {
            document.removeEventListener('visibilitychange', component.pageVisibilityChange);
            component.pageVisibilityChange = function() {};
            document.addEventListener('visibilitychange', component.pageVisibilityChange);
        }
        if (component._handlerUnload) {
            UW.removeEventListener('unload', component._handlerUnload);
            component._handlerUnload = null;
        }
        ['initPlayer', 'initNoProgramPlayer', 'initPadPlayer', 'changeProgram', 'changeChannel', 'getProgramDetail'].forEach(methodName => {
            wrapComponentMethod(component, methodName, syncLoadingState);
        });
        installReplayUrlPatch(component);
        wrapMobileInitPlayer(component);
        ensurePlayableStream(component);
        const handleProgramList = component.handleProgramList;
        if (typeof handleProgramList === 'function' && !handleProgramList.__smgWrapped) {
            const wrappedList = function(...args) {
                const result = handleProgramList.apply(this, args);
                if (Array.isArray(result)) {
                    result.forEach(program => forceOpenProgram(program));
                }
                return result;
            };
            wrappedList.__smgWrapped = true;
            component.handleProgramList = wrappedList;
        }
        forceOpenProgramList(component);
        syncLoadingState(component);
        if (component.player && !component.player.config?.isPad && component.programObj?.play === 0) {
            const playerUrl = component.player?.config?.url || '';
            if (!/\bstart=\d/.test(playerUrl)) {
                component.initPlayer({ changeCurrentList: false, isPlay: true, trigger: 'auto' });
            }
        }
    }
    let scanning = false;
    function initComponentPatch() {
        if (scanning) {
            return;
        }
        scanning = true;
        let attempts = 0;
        const maxAttempts = 50;
        const timer = setInterval(() => {
            const component = findTVComponent();
            if (component) {
                clearInterval(timer);
                scanning = false;
                patchComponent(component);
                return;
            }
            attempts += 1;
            if (attempts >= maxAttempts) {
                clearInterval(timer);
                scanning = false;
                console.warn('[SMGTV] 未找到播放器组件实例');
            }
        }, 200);
    }
    injectStyle(`
    .video-tip {
        display: none !important;
    }
    body.${VIDEO_READY_CLASS} .loading-mask {
        display: none !important;
        pointer-events: none !important;
    }
    body.${FULLSCREEN_FALLBACK_CLASS} {
        overflow: hidden !important;
    }
    .${FULLSCREEN_TARGET_CLASS} {
        background: #000 !important;
        bottom: 0 !important;
        box-sizing: border-box !important;
        height: 100vh !important;
        height: 100dvh !important;
        inset: 0 !important;
        left: 0 !important;
        margin: 0 !important;
        max-height: none !important;
        max-width: none !important;
        min-height: 100vh !important;
        min-height: 100dvh !important;
        min-width: 100vw !important;
        min-width: 100dvw !important;
        padding: 0 !important;
        position: fixed !important;
        right: 0 !important;
        top: 0 !important;
        transform: none !important;
        width: 100vw !important;
        width: 100dvw !important;
        z-index: 2147483647 !important;
    }
    .${FULLSCREEN_TARGET_CLASS}.xgplayer,
    .${FULLSCREEN_TARGET_CLASS} .xgplayer {
        height: 100% !important;
        inset: 0 !important;
        margin: 0 !important;
        max-height: none !important;
        max-width: none !important;
        padding: 0 !important;
        padding-top: 0 !important;
        position: absolute !important;
        transform: none !important;
        width: 100% !important;
    }
    .${FULLSCREEN_TARGET_CLASS} .xgplayer-screen-container,
    .${FULLSCREEN_TARGET_CLASS} xg-video-container.xg-video-container,
    .${FULLSCREEN_TARGET_CLASS} .xg-video-container {
        bottom: 0 !important;
        display: block !important;
        height: 100% !important;
        inset: 0 !important;
        position: absolute !important;
        width: 100% !important;
    }
    .${FULLSCREEN_TARGET_CLASS} video,
    .${FULLSCREEN_TARGET_CLASS} canvas,
    .${FULLSCREEN_TARGET_CLASS} live-video {
        bottom: 0 !important;
        height: 100% !important;
        left: 0 !important;
        max-height: none !important;
        max-width: none !important;
        object-fit: contain !important;
        position: absolute !important;
        right: 0 !important;
        top: 0 !important;
        transform: none !important;
        width: 100% !important;
    }
    .${FULLSCREEN_TARGET_CLASS} .xgplayer-controls,
    .${FULLSCREEN_TARGET_CLASS} .xg-top-bar {
        z-index: 2147483647 !important;
    }
    .${FULLSCREEN_TARGET_CLASS} .xgplayer-controls {
        padding-bottom: env(safe-area-inset-bottom, 0px) !important;
    }
    .${FULLSCREEN_TARGET_CLASS} .xg-top-bar {
        padding-top: env(safe-area-inset-top, 0px) !important;
    }
    `);
const originalOpen = UW.XMLHttpRequest.prototype.open;
function isTargetTVApi(url) {
    try {
        return new URL(String(url), location.href).pathname.includes('/content/pc/tv/');
    } catch (e) {
        return String(url).includes('/content/pc/tv/');
    }
}
function rewriteTvApiResponse(requestUrl, response) {
    let modified = false;
    if (!response || typeof response !== 'object') {
        return false;
    }
    if (requestUrl.includes('/channel/detail') && response.result) {
        rememberStreamAddresses(
            response.result.id,
            response.result.live_address,
            response.result.shift_address
        );
    }
    if (requestUrl.includes('/program/detail') && response.result) {
        forceOpenProgram(response.result);
        const channelInfo = response.result.channel_info || (response.result.channel_info = {});
        forceOpenProgram(channelInfo);
        const channelId = getResultChannelId(response.result);
        fillStreamAddresses(channelInfo, channelId);
        modified = true;
    }
    if (requestUrl.includes('/programs') && response.result?.programs) {
        response.result.programs.forEach(program => {
            forceOpenProgram(program);
            modified = true;
        });
    }
    return modified;
}
function replaceXhrResponse(xhr, body) {
    try {
        Object.defineProperty(xhr, 'responseText', {
            value: body,
            writable: false,
            configurable: true
        });
        Object.defineProperty(xhr, 'response', {
            value: xhr.responseType === 'json' ? JSON.parse(body) : body,
            writable: false,
            configurable: true
        });
    } catch (e) {
        throttleLog('rewrite-error', 5000, () => console.error('[SMGTV] 重写接口响应失败:', e));
    }
}
UW.XMLHttpRequest.prototype.open = function(method, url) {
    this.__smgRequestUrl = String(url);
    if (isTargetTVApi(this.__smgRequestUrl)) {
        if (!this.__smgHooked) {
            this.__smgHooked = true;
            this.addEventListener('readystatechange', function() {
                if (this.readyState !== 4) {
                    return;
                }
                const requestUrl = this.__smgRequestUrl;
                try {
                    let response;
                    let rawText = null;
                    try {
                        rawText = this.responseText;
                    } catch (e) {
                        rawText = null;
                    }
                    if (typeof rawText === 'string' && rawText) {
                        response = JSON.parse(rawText);
                    } else if (this.response && typeof this.response === 'object') {
                        response = this.response;
                    } else {
                        return;
                    }
                    if (rewriteTvApiResponse(requestUrl, response)) {
                        replaceXhrResponse(this, JSON.stringify(response));
                    }
                } catch (e) {
                    throttleLog('parse-error', 5000, () => console.error('[SMGTV] 解析接口响应失败:', e));
                }
            });
        }
    }
    return originalOpen.apply(this, arguments);
};
const originalFetch = UW.fetch;
if (typeof originalFetch === 'function') {
    UW.fetch = function(input, init) {
        const requestUrl = String(typeof input === 'string' ? input : (input && input.url) || '');
        const request = originalFetch.apply(this, arguments);
        if (!isTargetTVApi(requestUrl)) {
            return request;
        }
        return request.then(res => {
            if (!res) {
                return res;
            }
            try {
                return res.clone().text().then(raw => {
                    try {
                        const response = JSON.parse(raw);
                        if (!rewriteTvApiResponse(requestUrl, response)) {
                            return res;
                        }
                        return new UW.Response(JSON.stringify(response), {
                            status: res.status,
                            statusText: res.statusText,
                            headers: res.headers
                        });
                    } catch (e) {
                        throttleLog('parse-error', 5000, () => console.error('[SMGTV] 解析接口响应失败:', e));
                        return res;
                    }
                }).catch(() => res);
            } catch (e) {
                throttleLog('rewrite-error', 5000, () => console.error('[SMGTV] 重写接口响应失败:', e));
                return res;
            }
        });
    };
}
ensureViewportFitCover();
initComponentPatch();
initFullscreenPatch();
})();
