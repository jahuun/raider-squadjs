import DiscordBasePlugin from './discord-base-plugin.js';
import { MessageAttachment, WebhookClient } from "discord.js";
import path from 'path';
import { createGzip } from 'zlib';
import { pipeline } from 'stream';
import fs from 'fs';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export default class LogSaver extends DiscordBasePlugin {
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
                description: 'The ID of the channel to send log messages to.',
                default: '',
                example: '667741905228136459'
            }
        };
    }

    constructor(server, options, connectors) {
        super(server, options, connectors);
        this.sendLogToDiscord = this.sendLogToDiscord.bind(this);
        this.gzipFile = this.gzipFile.bind(this);
        this.discordMessage = this.discordMessage.bind(this);

        this.lastRestartTime = Date.now();
    }

    async mount() {
        const logDir = this.server.options.logDir;
        fs.watch(logDir, (type, fileName) => {
            if (type != "rename") return
            if (!fileName.match(/\.log$/i) || fileName.match(/SquadGame.log/)) return;
            const filePath = path.join(logDir, fileName);
            if (!fs.existsSync(filePath)) return;
            this.sendLogToDiscord(filePath)
        })

        this.verbose(1, 'Mounted')
    }

    async unmount() { }

    async sendLogToDiscord(logFilePath) {
        await delay(1000)
        const gzFileName = path.basename(logFilePath) + '.gz';
        const logFileSize = fs.statSync(logFilePath).size / 1024 / 1024;
        this.verbose(1, 'New log file created:', logFilePath, logFileSize)

        if (logFileSize < 5) return;

        const buffer = await this.gzipFile(logFilePath);
        await this.discordMessage(gzFileName, buffer)
    }

    async gzipFile(filePath) {
        return new Promise((resolve, reject) => {
            const source = fs.createReadStream(filePath);
            const gzip = createGzip()
            const chunks = [];

            gzip.on('data', (chunk) => chunks.push(chunk));
            gzip.on('end', () => resolve(Buffer.concat(chunks)));
            gzip.on('error', (error) => reject(error));

            source.pipe(gzip);
        })
    }

    async discordMessage(fileName, buffer) {
        await this.sendDiscordMessage({
            embed: {
                title: `New log file found`,
                color: '#00FF00',
                timestamp: (new Date()).toISOString(),
                footer: {
                    text: `${this.server.serverName}`
                }
            }
        });
        await this.sendDiscordMessage({
            files: [
                new MessageAttachment(buffer, fileName)
            ]
        });
    }
}