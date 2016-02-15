#!/usr/bin/env babel-node

import commander from 'commander';
import _ from 'lodash';

commander
    .version('0.0.1')
    .command('clean', 'remove old backups')
    .command('cron', 'start the cron service')
    .command('backup', 'create a backup now')
    .command('list', 'list all the backups')
    .command('restore <backup>', 'restore a backup');

commander.parse(process.argv);
