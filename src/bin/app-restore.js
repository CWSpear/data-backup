#!/usr/bin/env babel-node

import commander from 'commander';
import chalk from 'chalk';

let backup;
commander
    .arguments('<backup>')
    .action(_backup => {
        backup = _backup;
    })
    .parse(process.argv);

if (!backup) {
    console.error(chalk.red('<backup> is required'));
    commander.help();
    process.exit(1);
}

// import { listFiles } from '../lib';

console.log(backup);
console.log('NYI');
