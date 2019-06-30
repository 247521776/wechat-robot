/**
 * Created by boom on 2017/7/22.
 * 辅助函数
 */

exports.getUUID = (string = "") => {
    return string.match(/([A-z0-9_])+==/gm);
};

exports.getCode = (string = "") => {
    return string.match(/([0-9]){3}/gm)[0];
};

exports.games = {
    "猜图": {
        name: "猜图",
        desc: "输入【猜图】可以查看能猜的类型"
    },
    "偷盗": {
        name: "偷盗",
        desc: "输入【偷盗】可以进入偷盗游戏"
    }
};

exports.getContent = function (msg) {
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

exports.setContent = function (msg, content) {
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

exports.getAnswerName = function (msg, bot) {
    if (bot.contacts) {
        const answer_id = msg.OriginalContent.split(":")[0];
        const user = bot.contacts[msg.FromUserName];
        for (const member of user.MemberList) {
            if (member.UserName === answer_id) {
                return exports.delHtmlTag(member.DisplayName) || exports.delHtmlTag(member.NickName);
            }
        }
    }

    return "";
}

exports.getUserName = (msg) => {
    return msg.OriginalContent.split(":")[0];
}

exports.randomFloor = (number) => {
    return Math.floor(Math.random() * number);
}

exports.randomCeil = (number) => {
    return Math.ceil(Math.random() * number);
}

exports.getUserNameByName = (object, NickName) => {
    for (const UserName in object) {
        if (object[UserName].NickName === NickName) {
            return UserName;
        }
    }
}

exports.delHtmlTag = function (str){
    return str.replace(/<[^>]+>/g,""); //去掉所有的html标记
}