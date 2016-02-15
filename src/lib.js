import fs from 'fs';

import targz from 'tar.gz';
import moment from 'moment-timezone';
import { CronJob } from 'cron';
import Bluebird from 'bluebird';
import _ from 'lodash';

import gcloud from 'gcloud';
import File from 'gcloud/lib/storage/file';
import Bucket from 'gcloud/lib/storage/bucket';
Bluebird.promisifyAll(File.prototype);
Bluebird.promisifyAll(Bucket.prototype);

import config from '../config';

if (!_.includes(moment.tz.names(), config.timezone)) {
    console.error(`${config.timezone} is not one of the allowed timezones. See [docs]`);
    process.exit(1);
}
moment.tz.setDefault(config.timezone);

_.defaults(config, {
    timezone: 'UTC',
    keyFilename: './keyfile.json',
});

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

export function clean() {
    return listFiles().then(files => {
        const filesToPurge = findFilesToPurge(files);

        return Bluebird.map(filesToPurge, file => {
            return file.deleteAsync();
        });
    });
}

export function listFiles() {
    return bucket.getFilesAsync();
}

export function findFilesToPurge(fileList) {
    let filesToPurge = [];

    let min, max = moment();
    _.reduce(config.plans, (list, plan, i) => {
        let min = plan.keep === 'forever' ? 'forever' : moment().subtract(plan.keep).startOf('m');

        console.log(`Purging files created between ${min === 'forever' ? 'the start of time' : min.format(format)} and ${max.format(format)} that don't match ${plan.frequency}`);

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
        console.log(`  Found ${purge.length} files to purge`);

        max = min;

        return _.without(list, ...purge);
    }, fileList);

    console.log(`Purging a total of ${filesToPurge.length} files`);

    return filesToPurge;
}

export function backup(isOneOff = false) {
    let timestamp = moment();
    if (!isOneOff) {
        timestamp.add({ minutes: 5 }).startOf('h');
    }
    timestamp = timestamp.format(format);

    const archiveReadStream = targz().createReadStream(config.backupDir);

    const storageWriteStream = bucket.file(`${timestamp}.tar.gz`).createWriteStream();

    console.log(`Uploading ${timestamp}.tar.gz...`);
    archiveReadStream
        .on('error', error => console.error(`There was an error: ${error}`))
        .on('end', () => isOneOff || clean());

    archiveReadStream.pipe(storageWriteStream);
}

export function runCronJob() {
    const job = new CronJob({
        cronTime: cronPatterns[config.plans[0].frequency],
        onTick: backup,
        start: true,
        timeZone: config.timezone,
    });
}
