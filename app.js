'use strict'
const Wechat  = require('wechat4u');
// const qrcode  = require('qrcode-terminal');
const request = require('request');
const koa     = require("koa");
const app     = new koa();
const render  = require("koa-ejs");
const path    = require("path");
const fs      = require("fs");
const tuling  = require("./src/tuLingConfig.json");
let questions = {};
let counts = {};
const answer = require("./answer.json");
const topic = ["成语", "人物", "明星", "品牌", "国家", "城市", "动漫", "球队", "电影"];

render(app, {
    root: path.join(__dirname, 'view'),
    layout: 'index',
    viewExt: 'html',
    cache: false
});
let bot;
let syncData = null;
let start = 0;

app.use(async (ctx, next) => {
    if (!start) {
        start = 1;

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
         * 登录成功事件
         */
        bot.on('login', () => {
            console.log('登录成功');
            // 保存数据，将数据序列化之后保存到任意位置
            syncData = JSON.stringify(bot.botData);
            for (const id in bot.contacts) {
                questions[id] = {};
                counts[id] = {};
            }
        });

        let i = 0;
        bot.on("contacts-updated", (contacts) => {
            for (const contact of contacts) {
                bot.contacts[contact.UserName] = contact;
            }
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
            // console.log(msg);
            switch (msg.MsgType) {
                case bot.CONF.MSGTYPE_TEXT:
                    /**
                     * 文本消息
                     */
                    guessPicture(msg);
                    autoReply(msg);

                    break;
                default:
                    break
            }
        });
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
});
app.on("error", (err) => {
    console.log(err);
});

app.listen(8000);
console.log("服务启动");

function guessPicture(msg) {
    let question = questions[msg.FromUserName];
    const count = counts[msg.FromUserName];
    const content = getContent(msg);
    const answerName = getAnswerName(msg);
    const type = content.substr(1);
    const isGuessPicture = topic.includes(type);
    if (isGuessPicture) {
        const total = Object.keys(answer[type]).length;
        const random = randomFun(type, total, msg.FromUserName);
        let img = `./images/${type}/${random}`;
        const exist = fs.existsSync(`${img}.jpg`);
        if (exist) {
            img += ".jpg";
        }
        else {
            img += ".png";
        }
        bot.uploadMedia(fs.createReadStream(img))
            .then(res => {
                return bot.sendPic(res.mediaId, msg.FromUserName);
            })
            .catch(err => {
                console.log(`有问题图片:${img}`);
                console.log(err);
            });
    }
    else {
        const now = Date.now();
        const question_time = question.time;
        const overtime = now > question_time;
        if (overtime) {
            let result_msg = "";
            const users = [];
            for (const name in count) {
                users.push({
                    name,
                    count: count[name]
                });
            }
            users.sort((a, b) => {return b.count - a.count;});
            for (let i = 0, len = users.length; i < len; i++) {
                result_msg += `第${i + 1}名: ${users[i].name}答对${users[i].count}题。\n`;
            }
            bot.sendMsg(result_msg, msg.FromUserName);
            questions[msg.FromUserName] = {};
            counts[msg.FromUserName] = {};
        }
        else {
            const is_answer = content === question.answer;
            if (is_answer) {
                if (count[answerName]) {
                    count[answerName] += 1;
                }
                else {
                    count[answerName] = 1;
                }
                delete question.answer;
                bot.sendMsg(`恭喜${answerName}答对`, msg.FromUserName);
                guessPicture(setContent(msg, `猜${question.type}`));
            }
            else if (now > question.hint_time && !question.hint) {
                bot.sendMsg(`答案字数为${question.answer.length}`, msg.FromUserName);
                question.hint = true;
            }
            else if (now > question.hint_answer_time && !question.hint_answer) {
                bot.sendMsg(`答案第一个字为${question.answer.substr(0, 1)}`, msg.FromUserName);
                question.hint_answer = true;
            }
        }
    }
}

function randomFun(type, total, fromUserName) {
    const random = Math.floor(Math.random() * total);
    let question = questions[fromUserName];
    if (answer[type][random]) {
        questions[fromUserName] = {
            time: question.time || Date.now() + (5 * 60 * 1000),
            answer: answer[type][random],
            running: 1,
            type: type,
            hint_time: Date.now() + (10 * 1000),
            hint: false,
            hint_answer_time: Date.now() + (30 * 1000),
            hint_answer: false
        };
        return random;
    }

    randomFun(type, total, fromUserName);
}

function autoReply(msg) {
    const content = getContent(msg);
    const _key = "@小小机器人。";
    const can_auto_reply = content.indexOf(_key) !== -1;
    if (can_auto_reply) {
        const chat_content = content.replace(_key, "");

        request.post({
            url: "http://www.tuling123.com/openapi/api",
            form: {
                key: tuling.APIkey,
                info: chat_content,
                userid: msg.ToUserName
            }
        }, (err, res, body) => {
            const data = JSON.parse(body);
            if(!err) {
                bot.sendMsg(data.text, msg.FromUserName);
            }
        });
    }
}

function getContent(msg) {
    const is_group = msg.FromUserName.indexOf("@@") !== -1;

    let content;
    if (is_group) {
        content = msg.OriginalContent.split("<br/>")[1];
    }
    else {
        content = msg.Content;
    }

    return content;
}

function setContent(msg, content) {
    const is_group = msg.FromUserName.indexOf("@@") !== -1;

    if (is_group) {
        const _content = msg.OriginalContent.split("<br/>")[0];
        msg.OriginalContent = `${_content}<br/>${content}`;
    }
    else {
        msg.Content = content;
    }

    return msg;
}

function getAnswerName(msg) {
    if (bot.contacts) {
        const answer_id = msg.OriginalContent.split(":")[0];
        const user = bot.contacts[msg.FromUserName];
        for (const member of user.MemberList) {
            if (member.UserName === answer_id) {
                return member.DisplayName;
            }
        }
    }

    return "";
}