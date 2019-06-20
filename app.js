'use strict'
const Wechat  = require('wechat4u');
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
const topic = Object.keys(answer);
const robotName = "小小机器人。";

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
                    const count = counts[msg.FromUserName];
                    const isFirst = !count[msg.FromUserName] || Object.keys(count[msg.FromUserName]).length === 0;
                    if (isFirst) {
                        initMember(msg);
                    }
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
    const content = getContent(msg);
    const type = content.substr(1);
    const isGuessPicture = topic.includes(type);
    if (isGuessPicture) {
        sendImage(msg, type);
    }
    else if (content === "结算") {
        settlement(msg, counts[msg.FromUserName]);
    }
    else if (content === "过") {
        guessPicture(setContent(msg, `猜${questions[msg.FromUserName].type}`));
    }
    else if (content === "提示") {
        getTip(msg, questions[msg.FromUserName]);
    }
    else {
        checkAnswerAndNext(msg, content);
    }
}

function randomImage(type, fromUserName) {
    const total = Object.keys(answer[type]).length;
    const random = Math.floor(Math.random() * total);
    let question = questions[fromUserName];
    if (random && answer[type][random]) {
        questions[fromUserName] = {
            time: question.time || Date.now() + (5 * 60 * 1000),
            answer: answer[type][random],
            running: 1,
            type: type,
            hint: false,
            hint_answer: false
        };
        return random;
    }

    randomImage(type, fromUserName);
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
                return delHtmlTag(member.NickName);
            }
        }
    }

    return "";
}

function sendImage(msg, type) {
    const isFirst = Object.keys(questions[msg.FromUserName]).length === 0;
    const random = randomImage(type, msg.FromUserName);
    let img = `./images/${type}/${random}`;
    const exist = fs.existsSync(`${img}.jpg`);
    if (exist) {
        img += ".jpg";
    }
    else {
        img += ".png";
    }

    if (isFirst) {
        bot.sendMsg("开始猜图游戏，限时五分钟，看看谁五分钟之内答对最多！加油呦", msg.FromUserName);
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

function checkAnswerAndNext(msg, content) {
    let question = questions[msg.FromUserName];
    const count = counts[msg.FromUserName];
    const answerName = getAnswerName(msg);
    const now = Date.now();
    const question_time = question.time;
    const overtime = now > question_time;
    if (overtime) {
        settlement(msg, count);
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
    }
}

function settlement(msg, count) {
    let result_msg = "本轮成绩是\n";
    const users = [];
    for (const name in count) {
        users.push({
            name,
            count: count[name]
        });
    }
    users.sort((a, b) => {return b.count - a.count;});
    const len = users.length;
    for (let i = 0; i < len; i++) {
        result_msg += `第${i + 1}名: ${users[i].name}答对${users[i].count}题。\n`;
    }

    result_msg += `\n\n@${users[len - 1].name}被大家甩了几街，还不着急？`
    bot.sendMsg(result_msg, msg.FromUserName);
    questions[msg.FromUserName] = {};
    counts[msg.FromUserName] = {};
}

function getTip(msg, question) {
    if (!question.hint) {
        bot.sendMsg(`答案字数为${question.answer.length}`, msg.FromUserName);
        question.hint = true;
    }
    else if (!question.hint_answer) {
        bot.sendMsg(`答案第一个字为${question.answer.substr(0, 1)}`, msg.FromUserName);
        question.hint_answer = true;
    }
    else {
        const lastWord = question.answer.length - 1;
        let encryptionInfo = "";
        for (let i = 0; i < lastWord - 1; i++) {
            encryptionInfo += "*";
        }
        bot.sendMsg(`答案为${question.answer.substr(0, 1)}${encryptionInfo}${question.answer.substr(lastWord, 1)}`, msg.FromUserName);
    }
}

function delHtmlTag(str){
    return str.replace(/<[^>]+>/g,""); //去掉所有的html标记
}

function initMember(msg) {
    const fromUserName = msg.FromUserName;
    const contact = bot.contacts[fromUserName];
    const memberList = contact.MemberList;
    if (memberList) {
        counts[fromUserName] = {};
        for (const member of memberList) {
            const nickName = delHtmlTag(member.NickName);
            if (nickName !== robotName) {
                counts[fromUserName][nickName] = 0;
            }
        }
    }
}
