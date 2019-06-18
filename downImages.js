const request = require("request");
const fs = require("fs");
const image = require("./test");
const answer_js = {};

for (const dir_name in image) {
	fs.mkdirSync(`./images/${dir_name}`);
	const images = image[dir_name];
	const keys = Object.keys(images);
	answer_js[dir_name] = {};
	for (let i = 0, len = keys.length; i<len; i++) {
		const answer = keys[i];
		const url = images[answer];
		const isJpg = url.indexOf(".jpg");
		const image_name = isJpg ? "jpg" : "png";
		downImage(url, dir_name, `${i + 1}.${image_name}`);
		answer_js[dir_name][i + 1] = answer;
	}
}

fs.writeFileSync(`./answer2.json`, JSON.stringify(answer_js));

function downImage(url, dir_name, name) {
	request(url).pipe(fs.createWriteStream(`./images/${dir_name}/${name}`));
}