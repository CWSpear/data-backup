#!/usr/bin/env babel-node

import commander from 'commander';
commander.parse(process.argv);

import { backup } from '../lib';

backup(true);
