/*
脚本名称：鸿星尔克自动抓包
脚本作者：Assistant
适用平台：Quantumult X, Loon, Surge, Shadowrocket
功能说明：
打开微信小程序“鸿星尔克”，点击“会员”或“积分明细”触发。
会自动抓取 member_id, enterprise_id, unionid, openid 等参数，
并格式化为青龙面板可用的 JSON 格式。

[rewrite_local]
^https:\/\/hope\.demogic\.com\/gic-wx-app\/.*(integral_record|member_sign)\.json url script-request-body https://raw.githubusercontent.com/mikasangF1/My-Scripts/main/hxerk_cookie.js

[mitm]
hostname = hope.demogic.com
*/

const $ = new Env("鸿星尔克抓包");

(async () => {
    if (typeof $request !== "undefined") {
        await captureCookie();
    }
})().catch((e) => $.logErr(e)).finally(() => $.done());

async function captureCookie() {
    const body = $request.body;
    if (!body) return;

    try {
        let params = {};
        
        // 解析请求体
        if (body.startsWith("{") && body.endsWith("}")) {
            params = JSON.parse(body);
        } else {
            // 处理 form-urlencoded
            const pairs = body.split('&');
            pairs.forEach(pair => {
                const [key, value] = pair.split('=');
                if (key) params[key] = decodeURIComponent(value || "");
            });
        }

        // 提取核心数据
        const accountInfo = {
            "account_name": "我的账号(请重命名)",
            "member_id": params.memberId,
            "enterprise_id": params.enterpriseId,
            "unionid": params.unionid,
            "openid": params.openid,
            "wx_openid": params.wxOpenid || params.wx_openid
        };

        // 验证关键数据是否存在
        if (accountInfo.member_id && accountInfo.openid) {
            const jsonString = JSON.stringify(accountInfo, null, 2);
            
            // 打印日志
            console.log(`\n🔔 鸿星尔克抓包数据:\n${jsonString}`);

            // 格式化通知内容，方便直接复制
            // 注意：QX 通知有字数限制，过长可能被截断，建议去日志复制
            const rawData = JSON.stringify([accountInfo]); // 包裹成数组方便直接填青龙
            
            $.msg("鸿星尔克抓包成功 🎉", "数据已生成，请查看日志或复制下方内容", rawData);
        }
    } catch (e) {
        console.log("❌ 解析失败: " + e);
    }
}

// 简易环境适配类
function Env(name) {
    return {
        msg: (title, subtitle, body) => {
            if (typeof $notify !== "undefined") $notify(title, subtitle, body);
            console.log(`\n===${name} 通知===\n${title}\n${subtitle}\n${body}`);
        },
        logErr: (err) => console.log(`\n❌ ${name} 错误:\n${err}`),
        done: () => { if (typeof $done !== "undefined") $done(); }
    };
}
