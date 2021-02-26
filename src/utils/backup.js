const AdmZip = require("adm-zip");
const archiver = require("../archiver");

const ARCHIVER_URL = "https://archive.plum-bot.xyz";

/**
 * @typedef {object} ArchiverDataStructure
 * 
 * @prop {object} entities
 * @prop {{ avatar: string, username: string, discriminator: string, badge?: string }[]} entities.users
 * @prop {{ name: string, color: number }[]} entities.roles
 * @prop {{ name: string }[]} entities.channels
 * @prop {{ id: string, author: string, time: number, content: string, deleted: boolean, embeds: object[], attachments: { height: number, id: string, name: string, proxyURL: string, size, spoiler: boolean, url: string, width: number }[] }[]} messages
 * @prop {string} channel_name
 * @prop {string} channel_topic
 * @prop {string} channel_id
 * @prop {string} server_name
 */

/**
 * Converts an array of messages to the corresponding
 * data to feed to the archiver
 *
 * @param {import("discord.js").Message[][]} messagesArray
 */
async function messagesToData(messagesArray) {
    let dataList = [];
    for (const messages of messagesArray) {
        /** @type {ArchiverDataStructure} */
        const data = {
            entities: {
                users: {},
                channels: {},
                roles: {}
            },
            messages: [],
            channel_name: "",
            channel_topic: "",
            channel_id: "",
            server_name: ""
        }

        if (!(Array.isArray(messages) && messages.length)) {
            continue;
        }

        data.channel_name = messages[0].channel.name;
        data.channel_topic = messages[0].channel.topic;
        data.channel_id = messages[0].channel.id;
        data.server_name = messages[0].guild.name;

        for (let msg of messages) {
            msg.mentions.roles.forEach(mention => {
                if (!data.entities.roles[mention.id]) {
                    data.entities.roles[mention.id] = {
                        name: mention.name,
                        color: mention.color
                    }
                }
            });
            
            [msg.author, ...msg.mentions.users.values()].forEach(mention => {
                if (!data.entities.users[mention.id])
                    data.entities.users[mention.id] = {
                        avatar: mention.displayAvatarURL({ format: "png", dynamic: true }),
                        username: mention.username,
                        discriminator: mention.discriminator,
                        badge: mention.bot ? "BOT" : null
                    }
            });
            
            msg.mentions.channels.forEach(mention => {
                if (!data.entities.channels[mention.id]) {
                    data.entities.channels[mention.id] = {
                        name: mention.name ?? "deleted-channel",
                    }
                }
            });

            data.messages.push({
                id: msg.id,
                author: msg.author.id,
                time: msg.createdAt,
                content: msg.content,
                deleted: msg.deleted,
                embeds: msg.embeds.map(e => e),
                attachments: msg.attachments.map(attachment => {
                    return {
                        id: attachment.id,
                        filename: attachment.name,
                        proxy_url: attachment.proxyURL,
                        size: attachment.size,
                        url: attachment.url,
                    }
                })
            })
        }

        dataList.push(data);
    }

    return dataList;
}

/**
 * Requests the backed up page with 
 * previously constructed data.
 *
 * @param {ArchiverDataStructure[]} dataList
 * @returns {{ body: any; name: string; srv: string; id: string; }[]}
 */
async function requestPage(dataList) {
    let returns = [];
    
    for (let data of dataList) {
        let page = await archiver.generatePage(data);
    
        if (typeof(page) != "string")
            throw new Error(`HTTP Error ${page.code}${page.err ? ": " + page.err : ""}`);
    
        returns.push({
            body: page,
            name: data.channel_name,
            id: data.channel_id,
            srv: data.server_name
        });
    }

    return returns;
}

/**
 * Returns a Buffer with the page, or a .zip
 * file with all the pages.
 *
 * @param {{ body: any; name: string; srv: string; id: string; }[]} strings
 * @returns
 */
function zipPage(...strings) {
    if (!strings.length)
        return {
            file: Buffer.from(""),
            name: "empty_file.txt"
        };

    if (strings.length < 2) {
        return {
            file: Buffer.from(strings[0].body),
            name: `${strings[0].srv} - ${strings[0].id} - ${strings[0].name}.html`
        }
    } else {
        const zip = new AdmZip();
        for (let file of strings) {
            zip.addFile(file.id + " - " + file.name + ".html", Buffer.from(file.body), `Backup of #${file.name}`);
        }

        return {
            file: zip.toBuffer(),
            name: strings[0].srv + " - " + Date.now() +  ".zip"
        }
    }
}

/**
 * Converts an array of messages to a
 * sendable Attachment
 *
 * @param {import("discord.js").Message[][]} messages
 */
module.exports = async function(...messages) {
    const data = await messagesToData(messages);
    const res = await requestPage(data);
    return zipPage(...res);
}

module.exports.helpers = {
    ARCHIVER_URL,

    messagesToData,
    requestPage,
    zipPage
}