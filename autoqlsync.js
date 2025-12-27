#!name=通用自动抓取CK至青龙
#!desc=自动抓取所有支持的应用Cookie/Token并同步至青龙面板
#!author=Levi
#!date=2025-12-12 13:29:06
#!category=QingLong
#!homepage=https://github.com/czy13724
#!icon=https://raw.githubusercontent.com/czy13724/LeviIcons/main/leviicons/QingLong.png

[Script]
# ----------------- czy13724 -------------------

成都天府绿道 = type=http-request,pattern=^https:\/\/app-cdc\.tfgreenroad\.com\/vip\/member\/v1\/api\/memberBaseInfo$,requires-body=0,script-path=https://raw.githubusercontent.com/mikasangF1/My-Scripts/main/qlsync.js
铛铛一下回收 = type=http-request,pattern=^https:\/\/vues\.dd1x\.cn\/api\/v2\/member\/bind_more_member_by_tel,requires-body=0,script-path=https://raw.githubusercontent.com/mikasangF1/My-Scripts/main/qlsync.js
迪卡侬 = type=http-response,pattern=^https:\/\/mpm-store\.decathlon\.com\.cn\/wcc_bff\/api\/v1\/wechat\/member\/member_point\/query,requires-body=1,script-path=https://raw.githubusercontent.com/mikasangF1/My-Scripts/main/qlsync.js
杜蕾斯会员中心 = type=http-response,pattern=^https:\/\/vip\.ixiliu\.cn\/mp\/user\/info$,requires-body=1,script-path=https://raw.githubusercontent.com/mikasangF1/My-Scripts/main/qlsync.js
快鱼心选 = type=http-response,pattern=^https:\/\/mp-api\.fastfish\.com\/common\/front\/user\/userInfo\/getCurrentUserInfo,requires-body=1,script-path=https://raw.githubusercontent.com/mikasangF1/My-Scripts/main/qlsync.js
霖久智服 = type=http-response,pattern=^https:\/\/linjiucloud-api\.ysservice\.com\.cn\/base\/uniapp\/uaa\/member\/mp\/auth\/quick,requires-body=1,script-path=https://raw.githubusercontent.com/mikasangF1/My-Scripts/main/qlsync.js
绿芽积分 = type=http-response,pattern=^https:\/\/sc\.lvyajifen\.com\/api\/auth\/info\/,requires-body=1,script-path=https://raw.githubusercontent.com/mikasangF1/My-Scripts/main/qlsync.js
噗呲生活 = type=http-response,pattern=^https:\/\/puci\.robertspace\.cn\/api\/system\/user\/user_info\/,requires-body=1,script-path=https://raw.githubusercontent.com/mikasangF1/My-Scripts/main/qlsync.js
七彩虹商城 = type=http-response,pattern=^https:\/\/interface\.skycolorful\.com\/api\/User\/DecryptPhoneNumber,requires-body=1,script-path=https://raw.githubusercontent.com/mikasangF1/My-Scripts/main/qlsync.js
瑞幸即享 = type=http-response,pattern=^https:\/\/mall-api\.luckincoffeeshop\.com\/p\/user\/userInfo$,requires-body=1,script-path=https://raw.githubusercontent.com/mikasangF1/My-Scripts/main/qlsync.js
漱玉平民浇水 = type=http-response,pattern=^https:\/\/mall\.sypm\.cn\/portal\/farm-plant-stage\/getData,requires-body=1,script-path=https://raw.githubusercontent.com/mikasangF1/My-Scripts/main/qlsync.js
TopSpace = type=http-response,pattern=^https://m\.sda\.changan\.com\.cn/app-apigw/appauth/sda-app/api/v[34]/user/refresh-token.*,requires-body=1,script-path=https://raw.githubusercontent.com/mikasangF1/My-Scripts/main/qlsync.js
无忧行 = type=http-request,pattern=^https:\/\/app\.jegotrip\.com\.cn\/api\/service\/.+\?.*token=.+,requires-body=0,script-path=https://raw.githubusercontent.com/mikasangF1/My-Scripts/main/qlsync.js

# ----------------- hex-ci ---------------------
什么值得买 = type=http-response,pattern=^https:\/\/user-api\.smzdm\.com\/(vip|info).*,requires-body=1,script-path=https://raw.githubusercontent.com/mikasangF1/My-Scripts/main/qlsync.js

# ----------------- xzxxn777 -------------------
IQOO社区 = type=http-request,pattern=^https:\/\/bbs-api\.iqoo\.com\/api\/v3\/user,requires-body=0,script-path=https://raw.githubusercontent.com/mikasangF1/My-Scripts/main/qlsync.js
网易严选 = type=http-request,pattern=^https:\/\/act\.you\.163\.com\/act-attendance\/task\/attendanceTask,requires-body=0,script-path=https://raw.githubusercontent.com/mikasangF1/My-Scripts/main/qlsync.js
网易严选 = type=http-response,pattern=^https:\/\/act\.you\.163\.com\/act\/pub\/St6C7RQWgv\/index\.html,requires-body=1,script-path=https://raw.githubusercontent.com/mikasangF1/My-Scripts/main/qlsync.js

# ----------------- 未知作者 --------------------

中国联通获取token = type=http-request,pattern=^https:\/\/(m\.client|loginxhm)\.10010\.com\/mobileService\/onLine\.htm,requires-body=1,script-path=https://raw.githubusercontent.com/mikasangF1/My-Scripts/main/qlsync.js
中国联通获取手机号 = type=http-response,pattern=^https:\/\/(m\.client|loginxhm)\.10010\.com\/mobileService\/onLine\.htm,requires-body=1,script-path=https://raw.githubusercontent.com/mikasangF1/My-Scripts/main/qlsync.js

[MITM]
hostname = %APPEND% app-cdc.tfgreenroad.com, vues.dd1x.cn, mpm-store.decathlon.com.cn, vip.ixiliu.cn, mp-api.fastfish.com, linjiucloud-api.ysservice.com.cn, sc.lvyajifen.com, puci.robertspace.cn, interface.skycolorful.com, mall-api.luckincoffeeshop.com, mall.sypm.cn, m.sda.changan.com.cn, app.jegotrip.com.cn, user-api.smzdm.com, bbs-api.iqoo.com, act.you.163.com, m.client.10010.com, loginxhm.10010.com
