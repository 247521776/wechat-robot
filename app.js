'use strict'
const Wechat  = require('wechat4u');
const request = require('request');
const koa     = require("koa");
const app     = new koa();
const render  = require("koa-ejs");
const path    = require("path");
const fs      = require("fs");
const tuling  = require("./src/tuLingConfig.json");
const weapon  = require("./weapon.json");
let questions = {};
let counts = {};
const needInit = {};
const useFunctions = {};
const answer = require("./answer.json");
const topic = Object.keys(answer);
const robotName = "小小机器人。";
const weapons = Object.keys(weapon);
const matchWeapon = /^使用(\S*)攻击/;
const matchInjuredPerson = /.*@(\S*)/;
const initBlood = 5;
const lookWeapon = "查看武器";
const lookBlood = "查看血量";
const lookAnswer = "查看答题数";

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
                useFunctions[id] = {};
                needInit[id] = 1;
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
                    const content = getContent(msg);
                    if (content === "猜图") {
                        const reply = `猜图: ${topic.join("、")}`;
                        bot.sendMsg(reply, msg.FromUserName);
                        return;
                    }
                    const isFirst = needInit[msg.FromUserName];
                    if (isFirst) {
                        initMember(msg);
                    }
                    getBloodList(msg);
                    guessPicture(msg);
                    attack(msg);
                    autoReply(msg);
                    getWeaponList(msg);

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
        useFunctions[msg.FromUserName].guessPicture = 1;
        sendImage(msg, type);
    }
    else if (useFunctions[msg.FromUserName].guessPicture) {
        if (content === "结算") {
            settlement(msg);
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
}

function randomImage(type, fromUserName) {
    const total = Object.keys(answer[type]).length;
    const random = Math.ceil(Math.random() * total);
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
                return delHtmlTag(member.DisplayName) || delHtmlTag(member.NickName);
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
        bot.sendMsg(
            "开始猜图游戏，限时五分钟，看看谁五分钟之内答对最多！答对题可攻击其他玩家。\n\n" +
            `回复【${lookWeapon}】可查看武器列表\n` +
            `回复【${lookBlood}】可查看血量\n` +
            "回复【使用xxx攻击@xxx】即可攻击其他玩家",
            msg.FromUserName
        );
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
    const answerName = getAnswerName(msg);
    const now = Date.now();
    const question_time = question.time;
    const overtime = now > question_time;
    if (overtime) {
        settlement(msg);
    }
    else {
        const is_answer = content === question.answer;
        const UserName = msg.OriginalContent.split(":")[0];
        if (is_answer) {
            counts[msg.FromUserName][UserName].count += 1;
            delete question.answer;
            bot.sendMsg(`恭喜【${answerName}】答对`, msg.FromUserName);
            guessPicture(setContent(msg, `猜${question.type}`));
        }
    }
}

function settlement(msg) {
    const count = counts[msg.FromUserName];
    let result_msg = "本轮成绩是\n";
    const users = [];
    for (const UserName in count) {
        const user = count[UserName];
        users.push({
            name: user.NickName,
            count: user.count
        });
    }
    users.sort((a, b) => {return b.count - a.count;});
    let zeroNumber = 0;
    const len = users.length;
    for (let i = 0; i < len; i++) {
        result_msg += `第${i + 1}名: 【${users[i].name}】答对${users[i].count}题。\n`;
        if (zeroNumber === 0) {
            zeroNumber = i;
        }
    }
    const randomPerson = Math.ceil(Math.random() * (len - zeroNumber));

    result_msg += `\n\n@${users[len - randomPerson].name} ${randomWordSettlement()}`
    bot.sendMsg(result_msg, msg.FromUserName);
    questions[msg.FromUserName] = {};
    counts[msg.FromUserName] = {};
    needInit[msg.FromUserName] = 1;
    useFunctions[msg.FromUserName].guessPicture = 0;
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

function initMember(msg) {
    needInit[msg.FromUserName] = 0;
    const fromUserName = msg.FromUserName;
    const contact = bot.contacts[fromUserName];
    const memberList = contact.MemberList;
    if (memberList) {
        counts[fromUserName] = {};
        for (const member of memberList) {
            if (member.NickName !== robotName) {
                counts[fromUserName][member.UserName] = {
                    NickName: delHtmlTag(member.DisplayName) || delHtmlTag(member.NickName),
                    count: 0,
                    blood: initBlood,
                    consume: 0
                };
            }
        }
    }
}

function delHtmlTag(str){
    return str.replace(/<[^>]+>/g,""); //去掉所有的html标记
}

function getWeapon(str) {
    return str.match(matchWeapon)[1];
}

function attack(msg) {
    const content = getContent(msg);
    const IsAttach = matchWeapon.test(content);
    if (IsAttach && useFunctions[msg.FromUserName].guessPicture) {
        const _weapon = getWeapon(content);
        if (weapons.includes(_weapon)) {
            const UserName = msg.OriginalContent.split(":")[0];
            const group = counts[msg.FromUserName];
            const user = group[UserName];
            const canConsume = (user.count - user.consume) >= weapon[_weapon].answers;
            if (canConsume) {
                const injuredPerson = content.match(matchInjuredPerson)[1];
                for (const name in group) {
                    if (group[name].NickName === injuredPerson) {
                        if (group[name].blood <= 0) {
                            bot.sendMsg(
                                `@${group[name].NickName} ${randomWordWeapon()}, 换个人打吧!`, 
                                msg.FromUserName
                            );
                        }
                        else {
                            const hurt = weapon[_weapon].hurt
                            group[name].blood = group[name].blood > hurt ? 
                                group[name].blood - hurt :
                                0;
                            user.consume += weapon[_weapon].answers;
                            bot.sendMsg(
                                `【${user.NickName}】攻击 @${group[name].NickName} 成功，【${group[name].NickName}】剩余血量${group[name].blood}`, 
                                msg.FromUserName
                            );
                        }
                    }
                }
            }
            else {
                const replyMsg = `使用武器${_weapon}需要消耗答题数${weapon[_weapon].answers}, @${user.NickName} 可消耗答题数为${user.count - user.consume}`;
                bot.sendMsg(replyMsg, msg.FromUserName);
            }
        }
    }
}

function randomWordWeapon() {
    const word = [
        "已经被打的想找妈妈了",
        "已经被打出翔了"
    ];
    const random = Math.floor(Math.random * word.length);
    return word[random];
}

function randomWordSettlement() {
    const word = [
        "答对这么少，脑子里都是屎嘛！",
        "就这水平，低能儿啊！",
        "快把这个人踢出群，严重拉低智商水平线！",
        "来一头猪都能答对比你多",
        "恭喜此人获得诺贝尔傻逼奖",
        "被大家甩了几街，还不着急？"
    ];

    const random = Math.floor(Math.random() * word.length);

    return word[random];
}

function getBloodList(msg) {
    const content = getContent(msg);
    if (content === lookBlood && useFunctions[msg.FromUserName].guessPicture) {
        const count = counts[msg.FromUserName];
        let result_msg = "";
        const users = [];
        for (const UserName in count) {
            const user = count[UserName];
            users.push({
                name: user.NickName,
                blood: user.blood,
                answers: user.count - user.consume
            });
        }
        users.sort((a, b) => {return b.blood - a.blood;});
        const len = users.length;
        for (let i = 0; i < len; i++) {
            result_msg += `【${users[i].name}】
            剩余答题数: ${users[i].answers}
            剩余血量: ${users[i].blood}。\n`;
        }
    
        result_msg += `\n\n@${users[0].name} 血量最多，大家赶快一起来干他吧！！！`
        bot.sendMsg(result_msg, msg.FromUserName);
    }
}

function getWeaponList(msg) {
    const content = getContent(msg);
    if (content === lookWeapon) {
        let weaponList = "武器列表\n";
        for (let weaponName in weapon) {
            const _weapon = weapon[weaponName];
            weaponList += `武器【${weaponName}】: 攻击系数:${_weapon.hurt}, 所需答题数:${_weapon.answers}\n`;
        }
        weaponList += "\n说明: 攻击系数为1的武器可消耗人一格血。"
        bot.sendMsg(weaponList, msg.FromUserName);
    }
}

function randomAttackWord() {
    const word = [
        "被打掉了一条内裤",
        ""
    ];

}