#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/core');
import { PrivateClientVpnStack } from '../lib/private-client-vpn-stack';

const app = new cdk.App();

new PrivateClientVpnStack(app, 'PrivateClientVpnStack', {
    env: { 
        account: "934676248949", 
        //region: 'us-east-1',      // N. Virginia (USA)
        // region: 'eu-north-1',    // Stockholm
        //region: 'ap-south-1',     // Mumbai
        //region: 'eu-west-2',      // London
        //region: 'ap-southeast-1', // Singapore
        //region: 'eu-south-1',     // Milan
    },
    desiredAsgCapacity: 1,
    //addCapacitySchedule: Schedule.cron({ minute: '0', hour: '20' }),
    //removeCapacitySchedule: Schedule.cron({ minute: '0', hour: '1' }),
});
