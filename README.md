# 个人微信机器人
## 原理
1. 通过微信接口获取`uuid`，并储存
2. 登录接口+`uuid`，获得登录二维码
3. 通过控制台或者页面扫描二维码登录
4. 通过接口获取联系人等信息
5. 通过心跳查询接收消息
6. 回复信息  

[部分接口信息](./src/config.js)