#!/usr/bin/env babel-node

import chalk from 'chalk';
import config from '../../config';
import commander from 'commander';
commander.parse(process.argv);

import { runCronJob } from '../lib';

console.log(`Starting cron job with the ${chalk.red(config.cleaningStrategy)} cleaning strategy`);
runCronJob();
