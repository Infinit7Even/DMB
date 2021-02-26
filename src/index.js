const { Client, SQLiteProvider } = require('discord.js-commando');
const { open } = require('sqlite');
const { Database } = require('sqlite3');
const dotenv = require("dotenv");
const { join } = require('path');
const { env } = require('process');
dotenv.config();

const client = new Client({
    owner: env.OWNER,
    commandPrefix: env.PREFIX
});


client.registry
    // Registers your custom command groups
    .registerGroups([
        ['fun', 'Fun commands'],
        ['some', 'Some group'],
        ['other', 'Some other group']
    ])

    // Registers all built-in groups, commands, and argument types
    .registerDefaults()

    // Registers all of your commands in the ./commands/ directory
    .registerCommandsIn(join(__dirname, 'commands'));

client.setProvider(
    open({ filename: 'database.db', driver: Database }).then(db => new SQLiteProvider(db))
).catch(console.error);

client.login(process.env.DISCORD_TOKEN);