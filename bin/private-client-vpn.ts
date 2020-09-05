#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/core');
import { Schedule } from '@aws-cdk/aws-events';
import { PrivateClientVpnStack } from '../lib/private-client-vpn-stack';

const app = new cdk.App();

new PrivateClientVpnStack(app, 'PrivateClientVpnStack', {
    env: { 
        account: process.env.CDK_DEFAULT_ACCOUNT, 
        region: 'eu-west-2',
        //region: 'ap-south-1',     // Mumbai
        //region: 'eu-west-2',      // London
        //region: 'ap-southeast-1', // Singapore
    },
    desiredAsgCapacity: 1,
    //addCapacitySchedule: Schedule.cron({ minute: '0', hour: '20' }),
    //removeCapacitySchedule: Schedule.cron({ minute: '0', hour: '1' }),
});
