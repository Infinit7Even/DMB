const { Command } = require("discord.js-commando");
const backup = require("../../utils/backup");

module.exports = class BackupCommand extends Command {
    constructor(client) {
        super(client, {
            name: 'backup',
            aliases: ["bup"],
            group: 'util',
            memberName: "backup",
            description: "Backups one or more channels",
            userPermissions: ["ADMINISTRATOR"],
            clientPermissions: ["VIEW_CHANNEL", "READ_MESSAGE_HISTORY", "ATTACH_FILES", "EMBED_LINKS"],
            args: [
                {
                    key: "messages",
                    type: "integer",
                    prompt: "How many messages should I backup?",
                    min: 1,
                    max: 400,
                    default: 50
                },
                {
                    key: "channel",
                    default: msg => msg.channel,
                    type: "channel|string",
                    prompt: "Which channel dhould I backup (`all` for every channel)"
                    // isEmpty: () => false,
                    // validate(val, ) {
                    //     console.log(val);
                    //     if (val.toLowerCase() == "all")
                    //         return true;
                    //     return msg.client.types.get("channel").validate(val, msg, args)
                    // },
                    // parse(val, msg, args) {
                    //     if (val.toLowerCase() == "all")
                    //         return "all";
                    //     return msg.client.types.get("channel").parse(val, msg, args) || msg.channel;
                    // },
                    // default: msg => msg.channel
                }
            ],
            throttling: {
                usages: 1,
                duration: 1800
            }
        });
    }

    /**
     * @param {import("discord.js-commando").CommandoMessage} msg
     * @param {{ channel: "all" | import("discord.js").TextChannel }} args
     */
    async run(msg, args) {
        const channel = args.channel;
        const num = args.messages;
        if (typeof channel == "string" && channel != "all") {
            return msg.reply("You must use `all` if you're not specifying a channel.");
        }
        
        const m = await msg.channel.send(`🔁 | Backing up! This may take some time, so grab a coffee and/or a snack.`);

        msg.channel.startTyping();

        const guild = msg.guild;
        console.log(0);

        /** @type {import("discord.js").TextChannel[]} */
        const channels = channel == "all" ?
            Array.from(guild.channels.cache.values()).filter(c => {
                const perms = c.permissionsFor(client.user.id);

                console.log(.5);

                return (c.type == "text" ||
                    c.type == "news") &&
                    perms.has("readMessageHistory") &&
                    perms.has("readMessages")
            }) : [channel];

        async function getMany(channel, limit = num) {
            let out = []
            if (limit <= 100) {
                let messages = await channel.messages.fetch({ limit: limit })
                out.push(...messages.array())
            } else {
                let rounds = (limit / 100) + (limit % 100 ? 1 : 0)
                let last_id = ""
                for (let x = 0; x < rounds; x++) {
                    const options = {
                        limit: 100
                    }
                    if (last_id.length > 0) {
                        options.before = last_id
                    }
                    const messages = await channel.messages.fetch(options)
                    out.push(...messages.array())
                    last_id = [...messages.array()][(messages.array().length - 1)].id
                }
            }
            return out
        }

        console.log(1);

        /** @type {import("discord.js-commando").CommandoMessage[][]} */
        const messages = await Promise.all(channels.map(c => getMany(c, num)));
        console.log(2);

        const file = await backup(...messages.map(msgs => {
            if (!msgs.length)
                return;
            return msgs.concat([...msgs[msgs.length - 1].channel.messages.cache.values()].filter(msg => msg.deleted)).sort((m1, m2) => {
                return m1.createdAt - m2.createdAt;
            })
        }));

        // const file = await ctx.guild.backup(channel || ctx.message.channel, +(ctx.args.messages));

        msg.channel.stopTyping();

        if (file.file.length >= 8e7) // 8 MB
            return m.edit(`❌ | The resulting backup is larger than what Discord allows. Please backup less messages or less channels at once.`);

        await m.edit(`✅ | Done! Here's your backup.`);
        m.channel.send("", {
            files: [{
                attachment: file.file,
                name: file.name
            }]
        });
    }
}