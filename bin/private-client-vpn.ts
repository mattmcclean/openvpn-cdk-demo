#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/core');
import { PrivateClientVpnStack } from '../lib/private-client-vpn-stack';

const app = new cdk.App();
new PrivateClientVpnStack(app, 'PrivateClientVpnStack');
