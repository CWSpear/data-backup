#!/usr/bin/env babel-node

import commander from 'commander';
commander.parse(process.argv);

import { runCronJob } from '../lib';

runCronJob();
