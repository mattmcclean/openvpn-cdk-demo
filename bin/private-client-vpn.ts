#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/core');
import { PrivateClientVpnStack } from '../lib/private-client-vpn-stack';

const app = new cdk.App();
new PrivateClientVpnStack(app, 'PrivateClientVpnStack', {
    env: { 
        account: process.env.CDK_DEFAULT_ACCOUNT, 
        region: process.env.CDK_DEFAULT_REGION || process.env.AWS_DEFAULT_REGION
    },
    hostedZoneId: "Z1IXXNDZB9AOTE",
    zoneName: "hyper-ski.com",
    password: "8mgHRag6BXCe",
    keyname: "awskey",
});
