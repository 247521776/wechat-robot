'use strict'
const Wechat  = require('wechat4u');
const qrcode  = require('qrcode-terminal');
const request = require('request');
const koa     = require("koa");
const app     = new koa();
const render  = require("koa-ejs");
const path    = require("path");
const tuling  = require("./src/tuLingConfig.json");

render(app, {
    root: path.join(__dirname, 'view'),
    layout: 'index',
    viewExt: 'html',
    cache: false
});

app.use(async (ctx, next) => {
    let bot;
    let syncData = null;
    /**
     * 尝试获取本地登录数据，免扫码
     * 这里演示从本地文件中获取数据
     */
    try {
        bot = new Wechat(syncData)
    } catch (e) {
        bot = new Wechat()
    }
    /**
     * 启动机器人
     */
    if (bot.PROP.uin) {
        // 存在登录数据时，可以随时调用restart进行重启
        bot.restart();
    } else {
        bot.start();
    }
    /**
     * uuid事件，参数为uuid，根据uuid生成二维码
     */
    await ctx.render("index", {
        qrcode: await uuid()
    });
    function uuid() {
        return new Promise((resolve, reject) => {
            bot.on('uuid', (uuid) => {
                resolve(`https://login.weixin.qq.com/l/${uuid}`);
            });
        });
    }
    /**
     * 登录成功事件
     */
    bot.on('login', () => {
        console.log('登录成功');
        // 保存数据，将数据序列化之后保存到任意位置
        syncData = JSON.stringify(bot.botData);
    });
    /**
     * 登出成功事件
     */
    bot.on('logout', () => {
        console.log('登出成功');
        // 清除数据
        syncData = null;
    });
    /**
     * 错误事件，参数一般为Error对象
     */
    bot.on('error', err => {
        console.error('错误：', err)
    });
    /**
     * 如何处理会话消息
     */
    bot.on('message', msg => {
        /**
         * 判断消息类型
         */
        console.log(msg);
        switch (msg.MsgType) {
            case bot.CONF.MSGTYPE_TEXT:
                /**
                 * 文本消息
                 */
                const userName = msg.FromUserName;
                request.post({
                    url: "http://www.tuling123.com/openapi/api",
                    form: {
                        key: tuling.APIkey,
                        info: msg.Content,
                        userid: userName
                    }
                }, (err, res, body) => {
                    const data = JSON.parse(body);
                    if(!err) {
                        bot.sendMsg(body.info, userName);
                    }
                });
                break;
            default:
                break
        }
    });
});

app.on("error", (err) => {
    console.log(err);
});

app.listen(8000);