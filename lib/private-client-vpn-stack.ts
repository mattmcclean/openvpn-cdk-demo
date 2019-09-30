import cdk = require('@aws-cdk/core');
import ec2 = require('@aws-cdk/aws-ec2');
import autoscaling = require('@aws-cdk/aws-autoscaling');
import iam = require('@aws-cdk/aws-iam');
import lambda = require('@aws-cdk/aws-lambda');
import sns = require('@aws-cdk/aws-sns');
import { SnsEventSource } from '@aws-cdk/aws-lambda-event-sources';

import fs = require('fs');

export interface PrivateClientVpnStackProps extends cdk.StackProps {

  readonly hostedZoneId: string;

  readonly zoneName: string;

  readonly password: string;

  readonly keyname: string;
}

export class PrivateClientVpnStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: PrivateClientVpnStackProps) {
    super(scope, id, props);

    // Create the VPC with 2 public subnets
    const vpc = new ec2.Vpc(this, "ClientVpnVpc", {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'ingress',
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ]
    });

    // Modify the default security group
    const sg = new ec2.SecurityGroup(this, 'OpenVPNSg', {
      vpc,
    });

    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22));
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(943));
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443));
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.udp(1194));

    // The OpenVPN AMI map
    const openVpnImage = new ec2.GenericLinuxImage({
      'us-east-1': 'ami-056907df001eeca0e',
      'eu-west-1': 'ami-0063fa0451e11ca13',
      'eu-west-2': 'ami-0d885004ea1a5448e',
      'ap-south-1': 'ami-08140c4d18b490e59',
      'ap-southeast-1': 'ami-05f71a611e1c713a6',
      // ...
    });

    // create the user data scripts
    var userdatacommands: string[] = [
      "apt-get update",
      "apt-get upgrade -y",
      `echo "openvpn:${props.password}" | chpasswd`,
    ];

    const userData = ec2.UserData.forLinux({
      shebang: "#!/bin/bash"
    });
    userData.addCommands(...userdatacommands);

    const topic = new sns.Topic(this, "AsgTopic", {
      displayName: "Topic for Autoscaling notifications"
     })

    // create the autoscaling group
    const asg = new autoscaling.AutoScalingGroup(this, 'ASG', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.LARGE),
      machineImage: openVpnImage,
      keyName: props.keyname,
      maxCapacity: 1,
      minCapacity: 1,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      userData,
      notificationsTopic: topic
    });
    asg.addSecurityGroup(sg);

    // create the lambda function to describe instances
    const processEventFn = new lambda.Function(this, 'ProcessEventFunction', {
      code: new lambda.InlineCode(fs.readFileSync('lambda/process_event.py', { encoding: 'utf-8' })),
      handler: 'index.lambda_handler',
      timeout: cdk.Duration.seconds(30),
      runtime: lambda.Runtime.PYTHON_3_7,
      environment: {
        HOSTED_ZONE: props.hostedZoneId,
        DNS_NAME: `${cdk.Stack.of(this).region}.vpn.${props.zoneName}`,
      }
    });

    // add policy so that EC2 instance can allocte elastic IP
    if (processEventFn.role) {
      processEventFn.role.addToPolicy(new iam.PolicyStatement({
        resources: ['*'],
        actions: [  "ec2:DescribeInstances",  "ec2:ModifyInstanceAttribute", "route53:ChangeResourceRecordSets" ],
      }));
    }
    processEventFn.addEventSource(new SnsEventSource(topic)); 

    new cdk.CfnOutput(this, 'OpenVPNUrl', { value: `https://${cdk.Stack.of(this).region}.vpn.${props.zoneName}/admin` });
  }
}
