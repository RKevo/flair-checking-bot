const Snoowrap = require("snoowrap");
const {
	CommentStream,
	SubmissionStream
} = require("snoostorm");
const Pool = require("pg").Pool;
const colors = require("colors");

require("dotenv").config();

const botReplies = require("./replies.js");
const BOT_START = Date.now() / 1000;
const connectionString = `postgresql://${process.env.PG_USER}:${process.env.PG_PASSWORD}@${process.env.PG_HOST}:${process.env.PG_PORT}/${process.env.PG_DATABASE}`;
const log = console.log;

let currentFlairedCount = 0;
let remindedCount = 0;
let userUNFLAIRED_remindedCount = 0;
let unflairedCheckQueue = [];


const pool = new Pool({
	connectionString: connectionString,
	ssl: {
		rejectUnauthorized: false,
	},
});
const client = new Snoowrap({
	userAgent: process.env.REDDIT_USERAGENT,
	clientId: process.env.REDDIT_CLIENTID,
	clientSecret: process.env.REDDIT_CLIENTSECRET,
	username: process.env.REDDIT_USERNAME,
	password: process.env.REDDIT_PASSWORD,
});

// - Init
pool.query(`SELECT * FROM BotVariable;`, (err, res) => {
	if (err) {
		console.log(err);
	} else {
		for (let botVar of res.rows) {
			switch (botVar.var_name) {
				case 'FlairedCount':
					currentFlairedCount = parseInt(botVar.var_value);
					break;
				case 'FlairRemindedCount':
					remindedCount = parseInt(botVar.var_value);
					break;
				case 'UserUNFLAIRED-remindedCount':
					userUNFLAIRED_remindedCount = parseInt(botVar.var_value);
					break;
				default:
					break;
			}
		}
	}
});

const canSummon = msg => {
	return msg.toLowerCase().includes('u/flair-checking-bot')
};

const comments = new CommentStream(client, {
	subreddit: 'PoliticalCompassMemes',
	limit: 10,
	pollTime: 12000
});

const posts = new SubmissionStream(client, {
	subreddit: 'PoliticalCompassMemes',
	limit: 5,
	pollTime: 15000
});

posts.on('item', async (item) => {
	if (item.author.name == "--UNFLAIRED--") {
		if (!item.author_flair_text) {
			userUNFLAIRED_remindedCount += 1;
			item.reply(`u\\/ --UNFLAIRED-- Despite posting quite a lot of quality posts, should not be respected due to his being a filthy unflaired. \n\n > He has been reminded for ${userUNFLAIRED_remindedCount} times.`);
			pool.query(`
		UPDATE BotVariable
			SET var_value = '${userUNFLAIRED_remindedCount}'
			WHERE var_name = 'UserUNFLAIRED-remindedCount';
		`, (err, res) => {
				console.log(err, res);
			});
		} else {
			userUNFLAIRED_remindedCount += 1;
			item.reply(`> u/--UNFLAIRED-- has finally flaired :D. \n\n \`\`\` \n\n 	This \`else\` block is never gonna be used smh. \n\n \`\`\` `);
			pool.query(`
		UPDATE BotVariable
			SET var_value = '${remindedCount}'
			WHERE var_name = 'UserUNFLAIRED-remindedCount';
		`, (err, res) => {
				console.log(err, res);
			});
		}
	} else {
		return;
	}
})

comments.on('item', async (item) => {
	if (item.created_utc < BOT_START) return;
	if (item.author.name == "AutoModerator" || item.author.name == "eazeaze") return;

	log('[CMT]'.bgBlack.cyan.bold, item.author.name.italic, item.author_flair_text ? item.author_flair_text.yellow.italic : item.author_flair_text, item.body);

	// - Check for the unflaired.
	let checkStr = item.author.name + "@" + item.subreddit.display_name;
	if (!item.author_flair_text && !unflairedCheckQueue.includes(checkStr)) {
		log(checkStr.green);
		let repUnflair = botReplies.unflaired;
		let replyNo = Math.floor(Math.random() * repUnflair.length)
		let ownComment = item.reply(">" + repUnflair[replyNo] + '\n\n***\n\n [**[[Guide]]**](https://imgur.com/gallery/IkTAlF2) ^^|| ^( *beep boop. Reply with good bot if you think I\'m doing well :D, bad bot otherwise*)');
		unflairedCheckQueue.push(checkStr);
		let thenCmt;
		ownComment.then(value => {
			thenCmt = value;
			setTimeout(() => checkFlairAddition(thenCmt, repUnflair[replyNo]), 300 * 1000);
			setTimeout(() => checkFlairAddition(thenCmt, repUnflair[replyNo]), 600 * 1000);
			setTimeout(() => checkFlairAddition(thenCmt, repUnflair[replyNo]), 1200 * 1000);
			setTimeout(() => checkFlairAdditionFinal(thenCmt, repUnflair[replyNo]), 2400 * 1000);
			setTimeout(() => {
				unflairedCheckQueue = unflairedCheckQueue.filter(x => x != checkStr)
			}, 3600 * 1000);
			log("Replied: ".magenta.bold, repUnflair[replyNo]);
		}, (reason) => console.log(reason));

	}


	/*
	TODO: commands. maybe for reporting and suggesting, i dont have any damn plans
	*/
});

/**
 * @param  {Snoowrap.Comment} cmtId User's comment.
 * @param  {Snoowrap} client Client Object.
 * @param  {Snoowrap.Comment} ownsItemId Replied own's comment.
 * @description Check if user currently has a flair on a subreddit after getting reminded. Send a congrats message if so, otherwise ignore.
 */
function checkFlairAddition(ownsItemId, replyTo) {
	let ownsItem = client.getComment(ownsItemId.id);
	client.getComment(ownsItemId.parent_id).fetch().then((item) => {
		let parentItem = item;
		if (typeof parentItem.author_flair_text == 'string') {
			let author = parentItem.author;

			var currentdate = new Date();

			console.log("flair:: ".blue, parentItem.author_flair_text);
			ownsItem.edit(`
			> ${replyTo}   
			
			***	
			^(User has flaired up! 😃) ^^|| [**[[Guide]]**](https://imgur.com/gallery/IkTAlF2)
			`.replace(/\t/g, ''));
		} else {
			console.log("flair:: ".blue, parentItem.author_flair_text);
			ownsItem.edit(`
			> ${replyTo} 		
			
			***
			^(User hasn't flaired up yet... 😔) ^^|| [**[[Guide]]**](https://imgur.com/gallery/IkTAlF2)
			`.replace(/\t/g, ''));
		}
	});
}

function checkFlairAdditionFinal(ownsItemId, replyTo) {
	let ownsItem = client.getComment(ownsItemId.id);
	client.getComment(ownsItemId.parent_id).fetch().then((item) => {
		let parentItem = item;
		if (typeof parentItem.author_flair_text == 'string') {
			let author = parentItem.author;

			var currentdate = new Date();

			console.log("flair:: ".blue, parentItem.author_flair_text);
			remindedCount += 1;
			currentFlairedCount += 1;
			ownsItem.edit(`
			> ${replyTo} 
			
			***
			^(User has flaired up! 😃) ${currentFlairedCount} / ${remindedCount} ^^|| [**[[Guide]]**](https://imgur.com/gallery/IkTAlF2)
			`.replace(/\t/g, ''));
		} else {
			console.log("flair:: ".blue, parentItem.author_flair_text);
			remindedCount += 1;
			ownsItem.edit(`
			> ${replyTo} 
			
			***
			^(User hasn't flaired up yet... 😔) ${currentFlairedCount} / ${remindedCount} ^^|| [**[[Guide]]**](https://imgur.com/gallery/IkTAlF2)
			`.replace(/\t/g, ''));
		}
		log(`Current count:: ${currentFlairedCount}/${remindedCount}`);
		pool.query(`
		UPDATE BotVariable
			SET var_value = '${currentFlairedCount}'
			WHERE var_name = 'FlairedCount';
		UPDATE BotVariable 
			SET var_value = '${remindedCount}'
			WHERE var_name = 'FlairRemindedCount';
		`, (err, res) => {
			console.log(err, res);
		})
	});
}

process.on('exit', () => {
	pool.end(() => {
		log('pool ended :}')
	});
});