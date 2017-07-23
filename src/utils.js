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