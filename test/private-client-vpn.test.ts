import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import cdk = require('@aws-cdk/core');
import ssm = require('@aws-cdk/aws-ssm');
import PrivateClientVpn = require('../lib/private-client-vpn-stack');

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new PrivateClientVpn.PrivateClientVpnStack(app, 'MyTestStack', {  
    });
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});