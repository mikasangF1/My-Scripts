/**
 * ========================================
 * Auto CK Sync - 通用自动抓取CK至青龙脚本 (多账号增强版)
 * ========================================
 * * 功能：自动从请求/响应中提取出符合要求的 Cookie/Token 并上传到青龙面板
 * 修改：已集成多账号共存逻辑，自动判断是"更新旧号"还是"新增新号"
 * * @author Levi & Modified for Multi-Account
 * @version 1.0.2
 * @date 2025-12-27
 * * ========================================
 * ⚙️ 配置说明 (BoxJS / 脚本首选项)
 * ========================================
 * * 1. ql_base_url      : 青龙面板地址 (例如: http://192.168.1.5:5700)
 * 2. ql_client_id     : 青龙应用 ID (系统设置 -> 应用设置 -> 新建应用 -> 权限选"环境变量")
 * 3. ql_client_secret : 青龙应用密钥
 * 4. ql_rules_url     : 远程规则文件 URL (可选，留空使用默认配置)
 * * ========================================
 */

const $ = new Env('自动同步CK至青龙');

// ================================================
// 配置读取 (支持 BoxJS)
// ================================================
const DEFAULT_CONFIG = {
    baseUrl: "http://192.168.1.100:5700",
    clientId: "",
    clientSecret: "",
    debug: true,
    notification: true
};

const getConfig = () => {
    let config = { ...DEFAULT_CONFIG };
    config.baseUrl = $.getdata('ql_base_url') || DEFAULT_CONFIG.baseUrl;
    config.clientId = $.getdata('ql_client_id') || DEFAULT_CONFIG.clientId;
    config.clientSecret = $.getdata('ql_client_secret') || DEFAULT_CONFIG.clientSecret;
    config.debug = $.getdata('ql_debug') !== 'false';
    config.notification = $.getdata('ql_notification') !== 'false';
    return config;
};

const QL_CONFIG = getConfig();

// ================================================
// 规则配置
// ================================================
const DEFAULT_RULES_URL = 'https://gist.githubusercontent.com/czy13724/205199bef2ecc499eabc4bcc68e24365/raw/config.json';
const RULES_URL = $.getdata('ql_rules_url') || DEFAULT_RULES_URL;

async function loadRules() {
    $.log(`从远程加载规则: ${RULES_URL}`);
    try {
        const response = await $.http.get({
            url: RULES_URL,
            headers: { 'User-Agent': 'Auto-CK-Sync/1.0' },
            timeout: 10000
        });
        const rules = $.toObj(response.body);
        if (Array.isArray(rules) && rules.length > 0) {
            $.log(`✅ 远程规则加载成功，共 ${rules.length} 条`);
            return rules;
        } else {
            $.log('❌ 远程规则格式错误或为空');
            return [];
        }
    } catch (error) {
        $.log(`❌ 远程规则加载失败: ${error.message}`);
        return [];
    }
}

let RULES = [];

// ================================================
// 工具函数
// ================================================
const Utils = {
    getValueByPath(obj, path) {
        if (!path) return null;
        const keys = path.split('.');
        let value = obj;
        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return null;
            }
        }
        return value;
    },
    getHeaderValue(headers, key) {
        if (!headers || !key) return null;
        if (headers[key]) return headers[key];
        const lowerKey = key.toLowerCase();
        for (const [k, v] of Object.entries(headers)) {
            if (k.toLowerCase() === lowerKey) return v;
        }
        return null;
    },
    getUrlParam(url, param) {
        const match = url.match(new RegExp(`[?&]${param}=([^&]+)`));
        return match ? match[1] : null;
    },
    getCookieValue(headers, cookieName) {
        if (!headers || !cookieName) return null;
        let setCookies = headers['set-cookie'] || headers['Set-Cookie'];
        if (!setCookies) return null;
        if (typeof setCookies === 'string') setCookies = [setCookies];
        for (const cookieStr of setCookies) {
            const match = cookieStr.match(new RegExp(`${cookieName}=([^;]+)`));
            if (match) return decodeURIComponent(match[1]);
        }
        return null;
    },
    parseCookieValue(cookieHeader, cookieName) {
        if (!cookieHeader || !cookieName) return null;
        const cookies = cookieHeader.split(';');
        for (const cookie of cookies) {
            const trimmed = cookie.trim();
            const [name, ...valueParts] = trimmed.split('=');
            if (name === cookieName) {
                const value = valueParts.join('=');
                try { return decodeURIComponent(value); } catch (e) { return value; }
            }
        }
        return null;
    },
    maskValue(str) {
        if (!str || str.length < 8) return '******';
        return str.substring(0, 4) + '******' + str.substring(str.length - 4);
    }
};

// ================================================
// 青龙 API (已魔改：支持多账号)
// ================================================
const QLClient = {
    token: null,
    tokenExpireAt: 0,

    async getToken() {
        const now = Date.now();
        if (this.token && now < this.tokenExpireAt) return this.token;
        if (!QL_CONFIG.clientId || !QL_CONFIG.clientSecret) throw new Error('未配置 Client ID 或 Client Secret');
        
        $.log('获取新的 Token...');
        const response = await $.http.get({
            url: `${QL_CONFIG.baseUrl}/open/auth/token?client_id=${QL_CONFIG.clientId}&client_secret=${QL_CONFIG.clientSecret}`,
            headers: { 'Content-Type': 'application/json' }
        });
        const result = $.toObj(response.body);
        if (result.code === 200 && result.data && result.data.token) {
            this.token = result.data.token;
            this.tokenExpireAt = now + (30 * 60 * 1000);
            return this.token;
        } else {
            throw new Error(`获取 Token 失败: ${result.message || '未知错误'}`);
        }
    },

    async getEnvCount(name) {
        const envs = await this.getEnvs(name);
        return envs.filter(env => env.name === name).length;
    },

    async getEnvs(searchValue = '') {
        const token = await this.getToken();
        const response = await $.http.get({
            url: `${QL_CONFIG.baseUrl}/open/envs?searchValue=${encodeURIComponent(searchValue)}`,
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        const result = $.toObj(response.body);
        return result.code === 200 ? (result.data || []) : [];
    },

    async addEnv(name, value, remarks = '') {
        const token = await this.getToken();
        const requestBody = [{ name: name, value: value, remarks: remarks }];
        const response = await $.http.post({
            url: `${QL_CONFIG.baseUrl}/open/envs`,
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        const result = $.toObj(response.body);
        if (result.code === 200) {
            $.log(`✅ 环境变量 ${name} 新增成功`);
            return true;
        }
        throw new Error(`新增失败: ${result.message}`);
    },

    async updateEnv(id, name, value, remarks = '') {
        const token = await this.getToken();
        const envs = await this.getEnvs(name);
        const targetEnv = envs.find(env => env.id === id || env._id === id);
        if (!targetEnv) throw new Error(`找不到 ID 为 ${id} 的环境变量`);

        const requestBody = { name: name, value: value, remarks: remarks, id: targetEnv.id || targetEnv._id };
        const response = await $.http.put({
            url: `${QL_CONFIG.baseUrl}/open/envs`,
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        const result = $.toObj(response.body);
        if (result.code === 200) {
            $.log(`✅ 环境变量 ${name} 更新成功`);
            return true;
        }
        throw new Error(`更新失败: ${result.message}`);
    },

    async enableEnv(id) {
        const token = await this.getToken();
        await $.http.post({
            url: `${QL_CONFIG.baseUrl}/open/envs/enable`,
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify([id])
        });
    },

    // 核心修改逻辑：智能判断新增或更新
    async syncEnv(name, newValue, remarks = '', options = {}) {
        // 0. 特殊模式：合并变量 (保持原脚本逻辑)
        if (options.mergeMode) {
             return await this.handleMergeMode(name, newValue, remarks, options);
        }

        $.log(`\n🔍 开始匹配账号...`);
        const existingEnvs = await this.getEnvs(name);
        const targetEnvs = existingEnvs.filter(env => env.name === name);
        
        // 1. 去重检测：如果值完全一样，直接跳过
        const sameValueEnv = targetEnvs.find(env => env.value === newValue);
        if (sameValueEnv) {
            $.log(`⚠️ 检测到重复CK，值已存在 (ID: ${sameValueEnv.id || sameValueEnv._id})`);
            $.log(`👉 动作: 跳过上传，仅确保启用`);
            if (options.autoEnable && sameValueEnv.status === 1) { // 1为禁用
                await this.enableEnv(sameValueEnv.id || sameValueEnv._id);
            }
            return { action: 'skip', message: '值未变化 (已存在)' };
        }

        // 2. 智能匹配：通过备注中的"唯一标识"查找旧账号
        // 优先匹配 options.remarkValue (通常是手机号或用户名)
        let envToUpdate = null;
        let matchReason = "";

        if (options.remarkValue) {
            // 检查现有备注是否包含这个手机号
            envToUpdate = targetEnvs.find(env => env.remarks && env.remarks.includes(options.remarkValue));
            if (envToUpdate) matchReason = `备注包含标识 "${options.remarkValue}"`;
        }

        // 3. 兜底匹配：如果没有唯一标识，尝试匹配完全相同的备注
        if (!envToUpdate) {
            envToUpdate = targetEnvs.find(env => env.remarks === remarks);
            if (envToUpdate) matchReason = `备注完全一致`;
        }

        // 4. 执行逻辑
        if (envToUpdate) {
            // ---> 找到旧账号：更新
            const envId = envToUpdate.id || envToUpdate._id;
            $.log(`🔄 匹配到旧账号 (ID: ${envId})`);
            $.log(`👉 原因: ${matchReason}`);
            $.log(`👉 动作: 执行更新覆盖`);
            
            await this.updateEnv(envId, name, newValue, remarks);
            if (options.autoEnable) await this.enableEnv(envId);
            return { action: 'update', message: `更新旧账号 (${options.remarkValue || '备注匹配'})` };
        } else {
            // ---> 没找到旧账号：新增 (多账号支持)
            $.log(`➕ 未找到匹配的旧账号 (视为新号)`);
            $.log(`👉 动作: 新建环境变量`);
            
            await this.addEnv(name, newValue, remarks);
            return { action: 'add', message: `新增新账号 (${options.remarkValue || 'New'})` };
        }
    },

    // 处理特殊的合并模式 (JSON数组)
    async handleMergeMode(name, newValue, remarks, options) {
        const existingEnvs = await this.getEnvs(name);
        const targetEnvs = existingEnvs.filter(env => env.name === name);
        const mergedEnv = targetEnvs.length > 0 ? targetEnvs[0] : null;

        if (mergedEnv) {
            let accountsArray = [];
            try { accountsArray = JSON.parse(mergedEnv.value); if (!Array.isArray(accountsArray)) accountsArray = [accountsArray]; } catch (e) { accountsArray = []; }
            
            const mergeValue = options.accountData[options.mergeKey];
            const existingIndex = accountsArray.findIndex(item => item && item[options.mergeKey] === mergeValue);

            if (existingIndex >= 0) { accountsArray[existingIndex] = options.accountData; } else { accountsArray.push(options.accountData); }
            
            await this.updateEnv(mergedEnv.id || mergedEnv._id, mergedEnv.name, JSON.stringify(accountsArray), mergedEnv.remarks || remarks);
            return { action: existingIndex >= 0 ? 'update' : 'add', message: `合并模式成功 (当前${accountsArray.length}个)` };
        } else {
            await this.addEnv(name, JSON.stringify([options.accountData]), remarks);
            return { action: 'add', message: '合并模式新增成功' };
        }
    }
};

// ================================================
// 数据提取引擎 (保持不变)
// ================================================
const ExtractEngine = {
    extractFields(rule, context) {
        const { request, response, url } = context;
        const extracted = {};
        $.log(`========== 开始提取字段 ==========`);
        
        for (const [fieldName, path] of Object.entries(rule.fields)) {
            let value = null;
            if (path.startsWith('responseBody.') || path.startsWith('body.')) {
                const prefixLength = path.startsWith('responseBody.') ? 13 : 5;
                value = Utils.getValueByPath($.toObj(response.body), path.substring(prefixLength));
            } else if (path.startsWith('responseCookie.')) {
                value = Utils.getCookieValue(response.headers, path.substring(15));
            } else if (path.startsWith('requestCookie.')) {
                value = Utils.parseCookieValue(request.headers['Cookie'] || request.headers['cookie'] || '', path.substring(14));
            } else if (path.startsWith('responseHeader.')) {
                value = Utils.getHeaderValue(response.headers, path.substring(15));
            } else if (path.startsWith('requestHeader.')) {
                value = Utils.getHeaderValue(request.headers, path.substring(14));
            } else if (path.startsWith('requestBody.')) {
                const jsonPath = path.substring(12);
                let bodyObj = request.body;
                if (typeof bodyObj === 'string') {
                    try { bodyObj = JSON.parse(bodyObj); } catch (e) {
                        const params = {};
                        bodyObj.split('&').forEach(p => { const i = p.indexOf('='); if(i>-1) params[p.substring(0, i)] = decodeURIComponent(p.substring(i+1)); });
                        bodyObj = params;
                    }
                }
                value = Utils.getValueByPath(bodyObj, jsonPath);
            } else if (path.startsWith('urlParam.')) {
                value = Utils.getUrlParam(url, path.substring(9));
            }

            if (value !== null && value !== undefined) {
                if (rule.regexReplace && rule.regexReplace[fieldName]) {
                    try { value = String(value).replace(new RegExp(rule.regexReplace[fieldName][0]), rule.regexReplace[fieldName][1]); } catch (e) {}
                }
                extracted[fieldName] = value;
                $.log(`✅ 提取字段 ${fieldName}: ${Utils.maskValue(String(value))}`);
            }
        }

        if (rule.postProcess) {
            try { this.applyPostProcess(extracted, rule.postProcess); } catch (e) {}
        }
        return extracted;
    },

    applyPostProcess(extracted, postProcessConfig) {
        for (const [newField, config] of Object.entries(postProcessConfig)) {
            if (config.type === 'jwt' && extracted[config.source]) {
                try {
                    const parts = extracted[config.source].split('.');
                    if (parts.length === 3) {
                        const payload = JSON.parse(this.base64UrlDecode(parts[1]));
                        const val = payload.hasOwnProperty(config.path) ? payload[config.path] : Utils.getValueByPath(payload, config.path);
                        if (val) extracted[newField] = String(val);
                    }
                } catch (e) {}
            }
        }
    },

    base64UrlDecode(str) {
        str = str.replace(/-/g, '+').replace(/_/g, '/');
        while (str.length % 4) str += '=';
        try {
            if (typeof Buffer !== 'undefined') return Buffer.from(str, 'base64').toString('utf8');
            return decodeURIComponent(escape(atob(str)));
        } catch (e) { return ''; }
    },

    formatOutput(extracted, rule) {
        const dataToFormat = { ...extracted };
        Object.keys(dataToFormat).forEach(key => { if (key.startsWith('_')) delete dataToFormat[key]; });

        if (rule.format === 'json-array') return JSON.stringify([dataToFormat]);
        if (rule.format === 'json-object') return JSON.stringify(dataToFormat);
        if (rule.format === 'string') return Object.values(dataToFormat).join(rule.separator || '#');
        if (rule.format === 'template') {
            let result = rule.template || '';
            for (const [key, value] of Object.entries(extracted)) {
                result = result.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
            }
            return result;
        }
        return JSON.stringify(dataToFormat);
    }
};

// ================================================
// 主处理流程
// ================================================
!(async () => {
    try {
        const REQUEST_BODY_CACHE_KEY = 'auto_ck_sync_request_body_cache';
        const isRequestPhase = typeof $request !== 'undefined' && typeof $response === 'undefined';
        const isResponsePhase = typeof $response !== 'undefined';
        let context = { request: typeof $request !== 'undefined' ? $request : {}, response: typeof $response !== 'undefined' ? $response : {}, url: typeof $request !== 'undefined' ? $request.url : '' };

        if (isRequestPhase && context.request.body) {
            $.setdata(JSON.stringify({ url: context.url, body: context.request.body, timestamp: Date.now() }), REQUEST_BODY_CACHE_KEY);
        }
        if (isResponsePhase && !context.request.body) {
            const cachedData = $.getdata(REQUEST_BODY_CACHE_KEY);
            if (cachedData) {
                const cache = JSON.parse(cachedData);
                if (cache.url === context.url && (Date.now() - cache.timestamp) < 5000) context.request.body = cache.body;
            }
        }

        $.log(`Auto CK Sync 开始处理: ${context.url}`);
        RULES = await loadRules();
        if (!RULES || RULES.length === 0) { $.done(); return; }

        let matchedRule = null;
        for (const rule of RULES) {
            if (new RegExp(rule.url).test(context.url)) {
                const needsResp = rule.type === 'response-body' || (rule.fields && Object.values(rule.fields).some(f => f.includes('response')));
                if (needsResp && !context.response.body) continue;
                matchedRule = rule;
                break;
            }
        }

        if (!matchedRule) { $.log('未匹配规则'); $.done(); return; }

        const extracted = ExtractEngine.extractFields(matchedRule, context);
        if (Object.keys(extracted).length === 0) { $.done(); return; }

        const currentCount = await QLClient.getEnvCount(matchedRule.qlVar);
        extracted['_index'] = currentCount + 1;

        // 生成备注：如果规则里指定了 remarkKey (如 phone)，就用它；否则用 Index
        let remarks = '';
        if (matchedRule.remarkKey && extracted[matchedRule.remarkKey]) {
            const identifier = extracted[matchedRule.remarkKey];
            remarks = `${matchedRule.name}-${identifier}`;
        } else {
            remarks = `${matchedRule.name} ${extracted['_index']} - 自动抓取`;
        }

        $.log('开始同步...');
        let syncResult;

        if (matchedRule.mergeMode) {
             const accountData = { ...extracted }; Object.keys(accountData).forEach(k => { if (k.startsWith('_')) delete accountData[k]; });
             syncResult = await QLClient.syncEnv(matchedRule.qlVar, '', remarks, { mergeMode: true, mergeKey: matchedRule.mergeKey || matchedRule.remarkKey, accountData, autoEnable: matchedRule.autoEnable !== false });
        } else {
            const formattedValue = ExtractEngine.formatOutput(extracted, matchedRule);
            syncResult = await QLClient.syncEnv(
                matchedRule.qlVar,
                formattedValue,
                remarks,
                {
                    // 传递 remarkValue 给 syncEnv，用于多账号匹配
                    remarkKey: matchedRule.remarkKey,
                    remarkValue: extracted[matchedRule.remarkKey], 
                    uniqueValue: matchedRule.uniqueKey ? extracted[matchedRule.uniqueKey] : null,
                    autoEnable: matchedRule.autoEnable !== false
                }
            );
        }

        $.log(`🎉 ${syncResult.message}`);
        if (QL_CONFIG.notification) {
            const id = extracted[matchedRule.remarkKey] || extracted[matchedRule.uniqueKey] || '未知';
            $.msg('🔄 AutoSync', `【${matchedRule.name}】${syncResult.action === 'add' ? '新增' : '更新'}成功`, `账号: ${id}\n变量: ${matchedRule.qlVar}`);
        }

    } catch (e) {
        $.log(`❌ 错误: ${e.message}`);
        if (QL_CONFIG.notification) $.msg($.name, '❌ 处理失败', e.message);
    } finally {
        $.done();
    }
})();

$.http.put = function (options) {
    return new Promise((resolve, reject) => {
        options.method = 'PUT';
        if (typeof $task !== 'undefined') {
            $task.fetch(options).then(resp => { resolve({ status: resp.statusCode, statusCode: resp.statusCode, headers: resp.headers, body: resp.body }); }, err => reject(err));
        } else if (typeof $httpClient !== 'undefined') {
            $httpClient.put(options, (err, resp, body) => { if (err) reject(err); else { resp.body = body; resolve(resp); } });
        } else { reject(new Error('Unsupported environment')); }
    });
};

// prettier-ignore
function Env(t, e) { class s { constructor(t) { this.env = t } send(t, e = "GET") { t = "string" == typeof t ? { url: t } : t; let s = this.get; return "POST" === e && (s = this.post), new Promise((e, i) => { s.call(this, t, (t, s, r) => { t ? i(t) : e(s) }) }) } get(t) { return this.send.call(this.env, t) } post(t) { return this.send.call(this.env, t, "POST") } } return new class { constructor(t, e) { this.name = t, this.http = new s(this), this.data = null, this.dataFile = "box.dat", this.logs = [], this.isMute = !1, this.isNeedRewrite = !1, this.logSeparator = "\n", this.encoding = "utf-8", this.startTime = (new Date).getTime(), Object.assign(this, e), this.log("", `🔔${this.name}, 开始!`) } getEnv() { return "undefined" != typeof $environment && $environment["surge-version"] ? "Surge" : "undefined" != typeof $environment && $environment["stash-version"] ? "Stash" : "undefined" != typeof module && module.exports ? "Node.js" : "undefined" != typeof $task ? "Quantumult X" : "undefined" != typeof $loon ? "Loon" : "undefined" != typeof $rocket ? "Shadowrocket" : void 0 } isNode() { return "Node.js" === this.getEnv() } isQuanX() { return "Quantumult X" === this.getEnv() } isSurge() { return "Surge" === this.getEnv() } isLoon() { return "Loon" === this.getEnv() } isShadowrocket() { return "Shadowrocket" === this.getEnv() } isStash() { return "Stash" === this.getEnv() } toObj(t, e = null) { try { return JSON.parse(t) } catch { return e } } toStr(t, e = null) { try { return JSON.stringify(t) } catch { return e } } getjson(t, e) { let s = e; const i = this.getdata(t); if (i) try { s = JSON.parse(this.getdata(t)) } catch { } return s } setjson(t, e) { try { return this.setdata(JSON.stringify(t), e) } catch { return !1 } } getScript(t) { return new Promise(e => { this.get({ url: t }, (t, s, i) => e(i)) }) } runScript(t, e) { return new Promise(s => { let i = this.getdata("@chavy_boxjs_userCfgs.httpapi"); i = i ? i.replace(/\n/g, "").trim() : i; let r = this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout"); r = r ? 1 * r : 20, r = e && e.timeout ? e.timeout : r; const [o, n] = i.split("@"), a = { url: `http://${n}/v1/scripting/evaluate`, body: { script_text: t, mock_type: "cron", timeout: r }, headers: { "X-Key": o, Accept: "*/*" }, timeout: r }; this.post(a, (t, e, i) => s(i)) }).catch(t => this.logErr(t)) } loaddata() { if (!this.isNode()) return {}; { this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path"); const t = this.path.resolve(this.dataFile), e = this.path.resolve(process.cwd(), this.dataFile), s = this.fs.existsSync(t), i = !s && this.fs.existsSync(e); if (!s && !i) return {}; { const i = s ? t : e; try { return JSON.parse(this.fs.readFileSync(i)) } catch (t) { return {} } } } } writedata() { if (this.isNode()) { this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path"); const t = this.path.resolve(this.dataFile), e = this.path.resolve(process.cwd(), this.dataFile), s = this.fs.existsSync(t), i = !s && this.fs.existsSync(e), r = JSON.stringify(this.data); s ? this.fs.writeFileSync(t, r) : i ? this.fs.writeFileSync(e, r) : this.fs.writeFileSync(t, r) } } lodash_get(t, e, s) { const i = e.replace(/\[(\d+)\]/g, ".$1").split("."); let r = t; for (const t of i) if (r = Object(r)[t], void 0 === r) return s; return r } lodash_set(t, e, s) { return Object(t) !== t || (Array.isArray(e) || (e = e.toString().match(/[^.[\]]+/g) || []), e.slice(0, -1).reduce((t, s, i) => Object(t[s]) === t[s] ? t[s] : t[s] = Math.abs(e[i + 1]) >> 0 == +e[i + 1] ? [] : {}, t)[e[e.length - 1]] = s), t } getdata(t) { let e = this.getval(t); if (/^@/.test(t)) { const [, s, i] = /^@(.*?)\.(.*?)$/.exec(t), r = s ? this.getval(s) : ""; if (r) try { const t = JSON.parse(r); e = t ? this.lodash_get(t, i, "") : e } catch (t) { e = "" } } return e } setdata(t, e) { let s = !1; if (/^@/.test(e)) { const [, i, r] = /^@(.*?)\.(.*?)$/.exec(e), o = this.getval(i), n = i ? "null" === o ? null : o || "{}" : "{}"; try { const e = JSON.parse(n); this.lodash_set(e, r, t), s = this.setval(JSON.stringify(e), i) } catch (e) { const o = {}; this.lodash_set(o, r, t), s = this.setval(JSON.stringify(o), i) } } else s = this.setval(t, e); return s } getval(t) { switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": return $persistentStore.read(t); case "Quantumult X": return $prefs.valueForKey(t); case "Node.js": return this.data = this.loaddata(), this.data[t]; default: return this.data && this.data[t] || null } } setval(t, e) { switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": return $persistentStore.write(t, e); case "Quantumult X": return $prefs.setValueForKey(t, e); case "Node.js": return this.data = this.loaddata(), this.data[e] = t, this.writedata(), !0; default: return this.data && this.data[e] || null } } initGotEnv(t) { this.got = this.got ? this.got : require("got"), this.cktough = this.cktough ? this.cktough : require("tough-cookie"), this.ckjar = this.ckjar ? this.ckjar : new this.cktough.CookieJar, t && (t.headers = t.headers ? t.headers : {}, void 0 === t.headers.Cookie && void 0 === t.cookieJar && (t.cookieJar = this.ckjar)) } get(t, e = (() => { })) { switch (t.headers && (delete t.headers["Content-Type"], delete t.headers["Content-Length"], delete t.headers["content-type"], delete t.headers["content-length"]), t.params && (t.url += "?" + this.queryStr(t.params)), this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": default: this.isSurge() && this.isNeedRewrite && (t.headers = t.headers || {}, Object.assign(t.headers, { "X-Surge-Skip-Scripting": !1 })), $httpClient.get(t, (t, s, i) => { !t && s && (s.body = i, s.statusCode = s.status ? s.status : s.statusCode, s.status = s.statusCode), e(t, s, i) }); break; case "Quantumult X": this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, { hints: !1 })), $task.fetch(t).then(t => { const { statusCode: s, statusCode: i, headers: r, body: o, bodyBytes: n } = t; e(null, { status: s, statusCode: i, headers: r, body: o, bodyBytes: n }, o, n) }, t => e(t && t.error || "UndefinedError")); break; case "Node.js": let s = require("iconv-lite"); this.initGotEnv(t), this.got(t).on("redirect", (t, e) => { try { if (t.headers["set-cookie"]) { const s = t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString(); s && this.ckjar.setCookieSync(s, null), e.cookieJar = this.ckjar } } catch (t) { this.logErr(t) } }).then(t => { const { statusCode: i, statusCode: r, headers: o, rawBody: n } = t, a = s.decode(n, this.encoding); e(null, { status: i, statusCode: r, headers: o, rawBody: n, body: a }, a) }, t => { const { message: i, response: r } = t; e(i, r, r && s.decode(r.rawBody, this.encoding)) }); break } } post(t, e = (() => { })) { const s = t.method ? t.method.toLocaleLowerCase() : "post"; switch (t.body && t.headers && !t.headers["Content-Type"] && !t.headers["content-type"] && (t.headers["content-type"] = "application/x-www-form-urlencoded"), t.headers && (delete t.headers["Content-Length"], delete t.headers["content-length"]), this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": default: this.isSurge() && this.isNeedRewrite && (t.headers = t.headers || {}, Object.assign(t.headers, { "X-Surge-Skip-Scripting": !1 })), $httpClient[s](t, (t, s, i) => { !t && s && (s.body = i, s.statusCode = s.status ? s.status : s.statusCode, s.status = s.statusCode), e(t, s, i) }); break; case "Quantumult X": t.method = s, this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, { hints: !1 })), $task.fetch(t).then(t => { const { statusCode: s, statusCode: i, headers: r, body: o, bodyBytes: n } = t; e(null, { status: s, statusCode: i, headers: r, body: o, bodyBytes: n }, o, n) }, t => e(t && t.error || "UndefinedError")); break; case "Node.js": let i = require("iconv-lite"); this.initGotEnv(t); const { url: r, ...o } = t; this.got[s](r, o).then(t => { const { statusCode: s, statusCode: r, headers: o, rawBody: n } = t, a = i.decode(n, this.encoding); e(null, { status: s, statusCode: r, headers: o, rawBody: n, body: a }, a) }, t => { const { message: s, response: r } = t; e(s, r, r && i.decode(r.rawBody, this.encoding)) }); break } } time(t, e = null) { const s = e ? new Date(e) : new Date; let i = { "M+": s.getMonth() + 1, "d+": s.getDate(), "H+": s.getHours(), "m+": s.getMinutes(), "s+": s.getSeconds(), "q+": Math.floor((s.getMonth() + 3) / 3), S: s.getMilliseconds() }; /(y+)/.test(t) && (t = t.replace(RegExp.$1, (s.getFullYear() + "").substr(4 - RegExp.$1.length))); for (let e in i) new RegExp("(" + e + ")").test(t) && (t = t.replace(RegExp.$1, 1 == RegExp.$1.length ? i[e] : ("00" + i[e]).substr(("" + i[e]).length))); return t } queryStr(t) { let e = ""; for (const s in t) { let i = t[s]; null != i && "" !== i && ("object" == typeof i && (i = JSON.stringify(i)), e += `${s}=${i}&`) } return e = e.substring(0, e.length - 1), e } msg(e = t, s = "", i = "", r) { const o = t => { switch (typeof t) { case void 0: return t; case "string": switch (this.getEnv()) { case "Surge": case "Stash": default: return { url: t }; case "Loon": case "Shadowrocket": return t; case "Quantumult X": return { "open-url": t }; case "Node.js": return }case "object": switch (this.getEnv()) { case "Surge": case "Stash": case "Shadowrocket": default: { let e = t.url || t.openUrl || t["open-url"]; return { url: e } } case "Loon": { let e = t.openUrl || t.url || t["open-url"], s = t.mediaUrl || t["media-url"]; return { openUrl: e, mediaUrl: s } } case "Quantumult X": { let e = t["open-url"] || t.url || t.openUrl, s = t["media-url"] || t.mediaUrl, i = t["update-pasteboard"] || t.updatePasteboard; return { "open-url": e, "media-url": s, "update-pasteboard": i } } case "Node.js": return }default: return } }; if (!this.isMute) switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": default: $notification.post(e, s, i, o(r)); break; case "Quantumult X": $notify(e, s, i, o(r)); break; case "Node.js": break }if (!this.isMuteLog) { let t = ["", "==============📣系统通知📣=============="]; t.push(e), s && t.push(i), console.log(t.join("\n")), this.logs = this.logs.concat(t) } } log(...t) { t.length > 0 && (this.logs = [...this.logs, ...t]), console.log(t.join(this.logSeparator)) } logErr(t, e) { switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": case "Quantumult X": default: this.log("", `❗️${this.name}, 错误!`, t); break; case "Node.js": this.log("", `❗️${this.name}, 错误!`, t.stack) } } wait(t) { return new Promise(e => setTimeout(e, t)) } done(t = {}) { const e = (new Date).getTime(), s = (e - this.startTime) / 1e3; switch (this.log("", `🔔${this.name}, 结束! 🕛 ${s} 秒`), this.log(), this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": case "Quantumult X": default: $done(t); break; case "Node.js": process.exit(1) } } }(t, e) }
