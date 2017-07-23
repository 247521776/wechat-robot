/**
 * Created by boom on 2017/7/22.
 * 网页版微信 路由信息
 */

module.exports = {
    //获取UUID GET
    getUUID: "https://login.weixin.qq.com/jslogin",
    //显示二维码 POST
    showQrCode: "https://login.weixin.qq.com/qrcode/",
    //等待登录 GET
    waitForLogin: "https://login.weixin.qq.com/cgi-bin/mmwebwx-bin/login",
    //登录获取Cookie GET
    getCookie: "https://wx2.qq.com/cgi-bin/mmwebwx-bin/webwxnewloginpage",
    //微信初始化 POST
    WXInit: "https://wx2.qq.com/cgi-bin/mmwebwx-bin/webwxinit",
    //开启微信状态通知 POST
    wxStatusNotify: "https://wx2.qq.com/cgi-bin/mmwebwx-bin/webwxstatusnotify",
    //获取联系人列表 POST
    getContact: "https://wx2.qq.com/cgi-bin/mmwebwx-bin/webwxgetcontact",
    //消息检查 GET
    syncCheck: "https://webpush2.weixin.qq.com/cgi-bin/mmwebwx-bin/synccheck",
    //获取最新消息 POST
    webWXSync: "https://wx2.qq.com/cgi-bin/mmwebwx-bin/webwxsync",
    //发送消息 POST
    webWXSendMsg: "https://wx2.qq.com/cgi-bin/mmwebwx-bin/webwxsendmsg"
};