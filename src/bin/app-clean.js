#!/usr/bin/env babel-node

import commander from 'commander';
commander.parse(process.argv);

import { clean } from '../lib';

clean();
