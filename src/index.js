/**
 * Created by boom on 2017/7/22.
 * 微信机器人
 */
const request = require("request");
const utils   = require("./utils");
const config  = require("./config");
const EventEmitter = require("events");
const _       = require("lodash");

class robot {
    constructor(data) {
        this.wx = data.wx;
        this.heartBeat = data.heartBeat;
        this.cookie = "";
        _.extend(this, EventEmitter);
    }

    async init() {
        this.UUID = await this.getUUID();
    }

    async getUUID() {
        return new Promise((reject, resolve) => {
            request.get(config.getUUID, (err, res, body) => {
                if (err) {
                    err.msg = "获取uuid失败!";
                    reject(err);
                }

                resolve(utils.getUUID(body));
            });
        });
    }

    async showQrCode() {
        return new Promise((reject, resolve) => {
            request.post({
                url: `${config.showQrCode}/${this.UUID}`
            }, (err, res, body) => {
                if(err) {
                    err.msg = "获取二维码失败!";
                    reject(err);
                }

                resolve(body);
            });
        });
    }

    async waitForLogin() {
        return new Promise((reject, resolve) => {
            request.get(`${config.waitForLogin}/uuid=${this.UUID}`, (err, res, body) => {
                if(err) {
                    err.msg = "等待登录失败!";
                    reject(err);
                }

                const data = {
                    code: utils.getCode(body)
                }
            });
        });
    }
}