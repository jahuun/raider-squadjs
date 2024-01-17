import DiscordBasePlugin from './discord-base-plugin.js';
import { MessageAttachment, WebhookClient } from "discord.js";
import path from 'path';
import { createGzip } from 'zlib';
import { Stream, pipeline } from 'stream';
import fs from 'fs';
import crypto from 'crypto';
import util from 'util';

util.promisify.pipeline = util.promisify(pipeline);

export default class ConfigFileBackup extends DiscordBasePlugin {
    static get description() {
        return '';
    }

    static get defaultEnabled() {
        return true;
    }

    static get optionsSpecification() {
        return {
            ...DiscordBasePlugin.optionsSpecification,
            channelID: {
                required: true,
                description: 'The ID of the channel to send messages to.',
                default: '',
                example: '667741905228136459'
            }
        };
    }

    constructor(server, options, connectors) {
        super(server, options, connectors);

        this.doBackup = this.doBackup.bind(this);
        this.discordBackup = this.discordBackup.bind(this);

        this.configFilePath = process.argv[ 2 ] || './config.json';

        this.backupSent = false;
        this.lastChange = new Date(0);
        this.timeoutInt = null;
    }

    async mount() {
        this.verbose(1, 'Mounted')

        this.doBackup();
    }

    async unmount() { }

    async doBackup() {
        this.lastChange = Date.now();

        const filePath = path.resolve(this.configFilePath)

        const source = fs.createReadStream(filePath);
        const gzip = createGzip()

        const hash = crypto.createHash('sha1');

        const lastMessageInChannel = Array.from(await this.channel.messages.fetch({ max: 2 })).map(mSet => mSet[ 1 ])[ 1 ];

        source.on("data", (chunk) => {
            hash.update(chunk);
            gzip.write(chunk);
        })

        source.on("end", async () => {
            gzip.end();
            const compressedData = gzip._outBuffer;
            const sha1Hash = hash.digest("hex");

            this.verbose(1, 'Finished processing', sha1Hash, compressedData);

            if (lastMessageInChannel && lastMessageInChannel.embeds[ 0 ] && lastMessageInChannel.embeds[ 0 ].footer.text == sha1Hash)
                return;

            await this.discordBackup({ hash: sha1Hash, buffer: compressedData, fileName: `SquadJS_${this.server.serverName}.json.gz` });
        })
    }

    async discordBackup(file) {
        await this.sendDiscordMessage({
            embed: {
                title: `${this.server.serverName}`,
                color: '#00FF00',
                timestamp: (new Date()).toISOString(),
                footer: {
                    text: `${file.hash}`
                }
            }
        });

        await this.sendDiscordMessage({
            files: [
                new MessageAttachment(file.buffer, file.fileName.replace(/[^a-z\d\s\.\_]/gi, '').split(/\s/).filter(p => p != "").join('_'))
            ]
        });
    }
}