const article = require("./article.json");
const {
    getContent,
    getAnswerName,
    getUserName,
    randomFloor,
    randomCeil,
    getUserNameByName,
    games,
    delHtmlTag
} = require("../utils");
const human = {};
const robotName = "小小机器人。";
const stolenPersonRegex = /偷@(\S*)/;
const almsRegex = /求求施舍点东西吧@(\S*)/;
let stealing = 0;
const cooling = {
    "查看物品": getArticle,
    "结算": endSteal
};
const steal_name = games["偷盗"].name;
const time = 2;
const rule = {};

module.exports = {
    steal(msg, bot) {
        const needInit = !human[msg.FromUserName] || Object.keys(human[msg.FromUserName]).length === 0;
        if (needInit) {
            init(msg, bot);
        }
        const content = getContent(msg);
        if (content === steal_name) {
            startSteal();
            let result = `${steal_name}游戏开始，每${time}秒可以偷盗一次，所有玩家初始物品为:\n`;
            for (const article_name in article) {
                const _article = article[article_name];
                result += `     ${_article.number}${_article.unit}${article_name}，一个价值${_article.price}元\n`;
            }

            result += `\n说明：当物品被偷盗完可以向他人乞讨。\n例如：求求施舍点东西吧@xxxx`;
            bot.sendMsg(
                result, 
                msg.FromUserName
            );
        }
        else if (stealing) {
            if (cooling[content]) {
                cooling[content](msg, bot);
            }
            else {
                _steal(msg, bot);
                alms(msg, bot);
            }
        }
    },
}

function init(msg, bot) {
    const fromUserName = msg.FromUserName;
    const contact = bot.contacts[fromUserName];
    const memberList = contact.MemberList;
    if (memberList) {
        human[fromUserName] = {};
        for (const member of memberList) {
            if (member.NickName !== robotName) {
                human[fromUserName][member.UserName] = {
                    NickName: delHtmlTag(member.DisplayName) || delHtmlTag(member.NickName),
                    articles: JSON.parse(JSON.stringify(article))
                };
            }
        }
    }
}

function _steal(msg, bot) {
    const content = getContent(msg);
    const isSteal = stolenPersonRegex.test(content);
    const FromUserName = msg.FromUserName;
    if (isSteal) {
        const stolen_person = content.match(stolenPersonRegex)[1];
        const answer_name = getAnswerName(msg, bot);
        const UserName = getUserName(msg);

        if (rule[UserName] === undefined || rule[UserName] < Date.now()) {
            rule[UserName] = Date.now() + (time * 1000);

            if (stolen_person === robotName) {
                const random_article = randomArticle(FromUserName, UserName);
                const miss_number = missArticle(FromUserName, UserName, random_article.name);
                bot.sendMsg(
                    `@${answer_name} 攻击法官，丧心病狂，法官决定毁掉你的${miss_number}${random_article.unit}${random_article.name}，价值【${random_article.price * miss_number}】元。`, 
                    FromUserName
                );
            }
            else {
                const person = human[FromUserName];
                const stolen_person_UserName = getUserNameByName(person, stolen_person);
                const random_article =  randomArticle(FromUserName, stolen_person_UserName);
    
                if (!random_article) {
                    return bot.sendMsg(
                        `@${answer_name} 你偷盗的${stolen_person}已经是穷光蛋了，放过这个乞丐吧~~~`, 
                        FromUserName
                    );
                }
    
                const miss_number = missArticle(FromUserName, stolen_person_UserName, random_article.name);
                human[FromUserName][UserName].articles[random_article.name].number += miss_number;
    
                bot.sendMsg(
                    `@${stolen_person} 你被偷窃了，丢失了${miss_number}${random_article.unit}${random_article.name}，价值【${random_article.price * miss_number}】元。`, 
                    FromUserName
                );
            }
        }
        else {
            bot.sendMsg(
                `【${answer_name}】还有${Math.ceil(((Date.now() + (time * 1000)) - rule[UserName]) / 1000)}秒才能偷盗。`,
                FromUserName
            );
        }
    }
}

function randomArticle(FromUserName, UserName) {
    const user_article = human[FromUserName][UserName].articles;
    const articles = [];
    for (const _article in user_article) {
        const hasArticle = user_article[_article].number > 0;
        if (hasArticle) {
            articles.push(_article);
        }
    }
    if (articles.length === 0) {
        return null;
    }
    const _random = randomFloor(articles.length);
    const article_name = articles[_random];
    return {
        name: article_name,
        unit: user_article[article_name].unit,
        price: user_article[article_name].price
    };
}

function missArticle(FromUserName, UserName, article_name) {
    const _article = human[FromUserName][UserName].articles[article_name];
    const article_number = _article.number;
    const _random = randomCeil(article_number);
    _article.number -= _random;

    return _random;
}

function startSteal() {
    stealing = 1;
}

function endSteal(msg, bot) {
    const FromUserName = msg.FromUserName;
    stealing = 0;
    const persons = human[FromUserName];
    human[FromUserName] = null;
    let result = `总资产信息:\n`;
    const array_result = [];

    for (const UserName in persons) {
        const articles = persons[UserName].articles;
        let total_price = 0;

        for (const article_name in articles) {
            const _article = articles[article_name];
            total_price += _article.number * _article.price;
        }

        array_result.push({
            NickName: persons[UserName].NickName,
            total_price
        });
    }

    array_result.sort((a, b) => {return b.total_price - a.total_price;});

    for (const item of array_result) {
        result += `         【${item.NickName}】总资产：${item.total_price}元\n`;
    }

    const first = array_result[0];
    result += `\n恭喜 @${first.NickName} 资产最高，${randomWord()}`;

    bot.sendMsg(
        result,
        FromUserName
    );
}

function alms(msg, bot) {
    const content = getContent(msg);
    const is_alms = almsRegex.test(content);
    if (is_alms) {
        const FromUserName = msg.FromUserName;
        const UserName = getUserName(msg);
        const person = human[FromUserName][UserName];
        const _article = person.article;
        for (const article_name in _article) {
            if (_article[article_name].number > 0) {
                return bot.sendMsg(
                    `@${person.NickName} 还有物品，就这么喜欢乞讨嘛？`, 
                    FromUserName
                );
            }
        }
        const alms_person = content.match(almsRegex)[1];
        const alms_UserName = getUserNameByName(person, alms_person);
        const random_article = randomArticle(FromUserName, alms_UserName);
        const miss_number = missArticle(FromUserName, alms_UserName, random_article.name);
        _article[random_article.name].number += miss_number
        bot.sendMsg(
            `${person.NickName}向 @${alms_person} 乞讨到了${miss_number}${random_article.unit}${random_article.name}，价值【${random_article.price * miss_number}】元`, 
            FromUserName
        );
    }
}

function getArticle(msg, bot) {
    const UserName = getUserName(msg);
    const FromUserName = msg.FromUserName;
    const user = human[FromUserName][UserName];
    const articles = user.articles;
    let result = `【${user.NickName}】拥有的物品如下：\n`;
    let hasArticle = false;
    let total_price = 0;
    for (const article_name in articles) {
        if (articles[article_name].number > 0) {
            hasArticle = true;
            total_price += articles[article_name].number * articles[article_name].price;
            result += `         ${articles[article_name].number}${articles[article_name].unit}${article_name}\n`;
        }
    }
    result += `\n总价值为${total_price}元。`;

    if (hasArticle) {
        bot.sendMsg(
            result,
            FromUserName
        );
    }
    else {
        bot.sendMsg(
            `【${user.NickName}】你已经是穷光蛋了，快去乞讨吧~~~`,
            FromUserName
        );
    }
}

function randomWord() {
    const word = [
        "赶快去买彩票去吧。",
        "能力棒棒呦。",
        "才子呀，绝世才子呀！",
        "以后绝对是富豪，快来抱TA的大腿吧。",
        "这么会偷盗，是个偷二代吧。",
        "绝世神偷，厉害呀~~~"
    ];

    const random = Math.floor(Math.random() * word.length);

    return word[random];
}
