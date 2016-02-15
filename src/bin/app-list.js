#!/usr/bin/env babel-node

import commander from 'commander';
import _ from 'lodash';

commander
    .option('-q, --quiet', `don't print empty message`)
    .parse(process.argv);

import { listFiles } from '../lib';

listFiles().then(files => {
    files = _.map(files, file => file.name.replace('.tar.gz', '')).join('\n');
    if (!files.length) {
        commander.quiet || console.log('No backups to list');
    } else {
        console.log(files);
    }
});
