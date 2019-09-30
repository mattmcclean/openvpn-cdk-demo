import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import cdk = require('@aws-cdk/core');
import PrivateClientVpn = require('../lib/private-client-vpn-stack');

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new PrivateClientVpn.PrivateClientVpnStack(app, 'MyTestStack', {  
      hostedZoneId: "Z1IXXNDZB9AOTE",
      zoneName: "hyper-ski.com",
      password: "^055h*j9CUHnO!xT",
      keyname: "awskey" 
    });
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});