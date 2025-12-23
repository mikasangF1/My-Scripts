/*
脚本名称：鸿星尔克自动抓包 (多账号合并版)
脚本作者：Assistant
功能说明：
1. 自动抓取鸿星尔克账号参数。
2. 支持多账号：抓取不同账号时，会自动合并到同一个列表中。
3. 输出格式直接为青龙变量 ERKE_JSON 可用的 JSON 数组。

[rewrite_local]
# 注意：请确保 GitHub 上的文件名和这里引用的文件名一致
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
            const pairs = body.split('&');
            pairs.forEach(pair => {
                const [key, value] = pair.split('=');
                if (key) params[key] = decodeURIComponent(value || "");
            });
        }

        // 提取核心数据
        const currentAccount = {
            "account_name": `账号_${params.memberId || 'Unknown'}`, // 默认用ID做备注，可手动改
            "member_id": params.memberId,
            "enterprise_id": params.enterpriseId,
            "unionid": params.unionid,
            "openid": params.openid,
            "wx_openid": params.wxOpenid || params.wx_openid
        };

        if (currentAccount.member_id && currentAccount.openid) {
            // === 核心逻辑：读取旧缓存并合并 ===
            // 读取之前的账号列表
            let historyList = [];
            const historyStr = $.getdata('ERKE_TOKEN_LIST');
            if (historyStr) {
                try {
                    historyList = JSON.parse(historyStr);
                } catch (e) {}
            }

            // 检查是否已存在（通过 member_id 判断），存在则更新，不存在则追加
            const index = historyList.findIndex(u => u.member_id === currentAccount.member_id);
            if (index > -1) {
                historyList[index] = currentAccount; // 更新
                console.log(`更新账号: ${currentAccount.member_id}`);
            } else {
                historyList.push(currentAccount); // 新增
                console.log(`新增账号: ${currentAccount.member_id}`);
            }

            // 保存回缓存
            $.setdata(JSON.stringify(historyList), 'ERKE_TOKEN_LIST');

            // === 生成通知 ===
            const finalJSON = JSON.stringify(historyList); // 压缩成一行，方便复制
            
            // 打印日志（格式化显示，方便检查）
            console.log(`\n🔔 当前已存储 ${historyList.length} 个账号:\n${JSON.stringify(historyList, null, 2)}`);

            // 发送通知
            $.msg(
                `鸿星尔克抓包: 第 ${historyList.length} 个`, 
                `已存入缓存，请复制下方完整 JSON`, 
                finalJSON
            );
        }
    } catch (e) {
        console.log("❌ 解析失败: " + e);
    }
}

// 简易环境适配类 (包含存储功能)
function Env(t,e){class s{constructor(t){this.env=t}write(t,e){switch(this.env){case"Quantumult X":$prefs.setValueForKey(t,e);break;case"Loon":$persistentStore.write(t,e);break;case"Surge":$persistentStore.write(t,e);break;case"Shadowrocket":$persistentStore.write(t,e)}}read(t){switch(this.env){case"Quantumult X":return $prefs.valueForKey(t);case"Loon":return $persistentStore.read(t);case"Surge":return $persistentStore.read(t);case"Shadowrocket":return $persistentStore.read(t)}}}return new class{constructor(t,e){this.name=t,this.http=new s(this.determineEnv()),this.logs=[],this.startTime=(new Date).getTime(),Object.assign(this,e)}determineEnv(){return"undefined"!=typeof $prefs?"Quantumult X":"undefined"!=typeof $persistentStore?"Loon":"undefined"!=typeof $task?"Shadowrocket":"Node"}getdata(t){return this.http.read(t)}setdata(t,e){return this.http.write(t,e)}msg(e,s,i){if("Quantumult X"===this.determineEnv()&&($notify(e,s,i),console.log(`${e}\n${s}\n${i}`)),"Surge"===this.determineEnv()||"Loon"===this.determineEnv()){$notification.post(e,s,i)}}logErr(t){console.log(`❌ ${this.name} 错误: ${t}`)}done(){const t=(new Date).getTime();console.log(`\n🔔 ${this.name} 运行结束, 耗时 ${(t-this.startTime)/1e3} 秒`),"undefined"!=typeof $done&&$done()}}(t,e)}