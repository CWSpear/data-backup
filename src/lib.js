import { createHash } from 'crypto';

import targz from 'tar.gz';
import { PassThrough } from 'stream';
import moment from 'moment-timezone';
import { CronJob } from 'cron';
import Bluebird from 'bluebird';
import _ from 'lodash';
import chalk from 'chalk';

import gcloud from 'gcloud';
import File from 'gcloud/lib/storage/file';
import Bucket from 'gcloud/lib/storage/bucket';
Bluebird.promisifyAll(File.prototype);
Bluebird.promisifyAll(Bucket.prototype);

import config from '../config';

_.defaults(config, {
    timezone: 'UTC',
    keyFilename: './keyfile.json',
});

if (!_.includes(moment.tz.names(), config.timezone)) {
    console.error(`${config.timezone} is not one of the allowed timezones. See [docs]`);
    process.exit(1);
}
moment.tz.setDefault(config.timezone);

// --- //

const format = 'YYYY-MM-DD HH:mm';

const cronPatterns = {
    hourly: '0 * * * *',
    daily: '0 0 * * *',
    weekly: '0 0 * * 1',
    monthly: '0 0 1 * *',
};

const matchers = {
    hourly(m) {
        let m2 = moment(m);
        return m2.startOf('hour').isSame(m);
    },

    daily(m) {
        let m2 = moment(m);
        return m2.startOf('day').isSame(m);
    },

    weekly(m) {
        let m2 = moment(m);
        return m2.startOf('week').isSame(m);
    },

    monthly(m) {
        let m2 = moment(m);
        return m2.startOf('month').isSame(m);
    },
};

const gcs = gcloud.storage({
    projectId: config.projectId,
    keyFilename: config.keyFilename,
});

const bucket = gcs.bucket(config.backupBucket);

export const clean = Bluebird.coroutine(function* (files = false) {
    if (!files) {
        files = yield listFiles();
    }

    const filesToPurge = config.cleaningStrategy === 'time-machine' ? findFilesToPurgeForTimeMachinea(files) : findFilesToPurgeForKeepLast(files);

    return Bluebird.map(filesToPurge, file => {
        return file.deleteAsync();
    });
});

export const listFiles = Bluebird.coroutine(function* listFiles() {
    let fileList = yield bucket.getFilesAsync();
    return _.sortBy(fileList, 'name');
});

export function findFilesToPurgeForTimeMachine(fileList) {
    let filesToPurge = [];

    let min, max = moment();
    _.reduce(config.plans, (list, plan, i) => {
        let min = plan.keep === 'forever' ? 'forever' : moment().subtract(plan.keep).startOf('m');

        console.log(`Purging files created between ${chalk.yellow(min === 'forever' ? 'the start of time' : min.format(format))} and ${chalk.yellow(max.format(format))} that don't match ${chalk.green(plan.frequency)}`);

        let purge = _(list).map(file => {
            return [file, moment(file.name.replace('.tar.gz', '')).startOf('m')];
        }).filter(([file, date]) => {
            if (min === 'forever') {
                return date.isBefore(max, 'm')
            }

            return date.isSameOrBefore(max, 'm') && date.isAfter(min);
        }).reject(([file, date]) => {
            return matchers[plan.frequency](date);
        }).map(([file, date]) => file).value();

        filesToPurge = filesToPurge.concat(purge);
        console.log(`  Found ${chalk.blue(purge.length)} files to purge`);

        max = min;

        return _.without(list, ...purge);
    }, fileList);

    console.log(`\nPurging a total of ${chalk.blue(filesToPurge.length)} files`);

    return filesToPurge;
}

export function findFilesToPurgeForKeepLast(fileList) {
    console.log(`Keeping the ${chalk.blue(config.keepLast)} most recent files`);
    // fileList should already be sorted
    const filesToKeep = _.takeRight(fileList, config.keepLast);

    console.log(`Purging a total of ${chalk.blue(fileList.length - filesToKeep.length)} files`);

    return _.without(fileList, ...filesToKeep);
}

export const backup = Bluebird.coroutine(function* (isOneOff = false) {
    const files = yield listFiles()
    const md5sum = createHash('md5');

    const mostRecentFile = _.last(files);
    const mostRecentHash = mostRecentFile.metadata.md5Hash;

    let timestamp = moment();
    if (!isOneOff) {
        // ensure we get the closet whole hour
        timestamp.add({ minutes: 5 }).startOf('h');
    }
    timestamp = timestamp.format(format);

    let preflightStream = new PassThrough();

    const preArchiveReadStream = targz().createReadStream(config.backupDir);

    let totalSize = 0;
    preflightStream.on('data', function(d) {
        totalSize += d.length;
        md5sum.update(d);
    });

    preflightStream.on('end', function() {
        console.log(`Archived ${chalk.magenta(config.backupDir)}`);
        const currentHash = md5sum.digest('base64');
        if (mostRecentHash === currentHash) {
            console.log(`Archive has ${chalk.cyan('not changed')} since last backup. Not backing up.`);
            if (!isOneOff) clean();
            return;
        }

        const archiveReadStream = targz().createReadStream(config.backupDir);

        const storageWriteStream = bucket.file(`${timestamp}.tar.gz`).createWriteStream();

        console.log(`Uploading ${chalk.yellow(timestamp + '.tar.gz')}...`);
        let sizeUploaded = 0;
        archiveReadStream
            .on('data', chunk => process.stdout.write(_.padEnd(` Uploaded: ${_.round((sizeUploaded += chunk.length) / totalSize * 100, 1)}%` , process.stdout.columns) + '\r'))
            .on('error', error => console.error(`There was an error: ${error}`))
            .on('end', () => {
                console.log(`Uploaded ${chalk.yellow(timestamp + '.tar.gz')}`)
                if (!isOneOff) clean();
            });

        archiveReadStream.pipe(storageWriteStream);
    });

    console.log(`Archiving ${chalk.magenta(config.backupDir)}...`);
    preArchiveReadStream.pipe(preflightStream);
});

export function runCronJob() {
    return new CronJob({
        cronTime: config.cleaningStrategy === 'keep-last' ? cronPatterns[config.backupFrequency] : cronPatterns[config.plans[0].frequency],
        onTick: backup,
        start: true,
        timeZone: config.timezone,
    });
}
