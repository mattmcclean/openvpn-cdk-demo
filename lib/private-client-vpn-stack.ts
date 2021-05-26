import cdk = require('@aws-cdk/core');
import ec2 = require('@aws-cdk/aws-ec2');
import autoscaling = require('@aws-cdk/aws-autoscaling');
import iam = require('@aws-cdk/aws-iam');
import lambda = require('@aws-cdk/aws-lambda');
import sns = require('@aws-cdk/aws-sns');
import ssm = require('@aws-cdk/aws-ssm');

import { Rule, Schedule } from '@aws-cdk/aws-events';
import { LambdaFunction } from '@aws-cdk/aws-events-targets';

import { SnsEventSource } from '@aws-cdk/aws-lambda-event-sources';

import fs = require('fs');

export interface PrivateClientVpnStackProps extends cdk.StackProps {

  readonly instanceType?: ec2.InstanceType;

  readonly desiredAsgCapacity?: number;

  readonly addCapacitySchedule?: Schedule;

  readonly removeCapacitySchedule?: Schedule;
}


export class PrivateClientVpnStack extends cdk.Stack {


  constructor(scope: cdk.Construct, id: string, props: PrivateClientVpnStackProps) {
    super(scope, id, props);

    // get parameters from SSM
    const hostedZone = ssm.StringParameter.valueForStringParameter(this, "openvpn-hosted-zone");
    const zoneName = ssm.StringParameter.valueForStringParameter(this, "openvpn-zone-name");
    const adminPassword = ssm.StringParameter.valueForStringParameter(this, "openvpn-admin-passwd");
    const keyname = ssm.StringParameter.valueForStringParameter(this, "openvpn-keyname");

    // get the VPN username and password
    const vpnUsername = ssm.StringParameter.valueForStringParameter(this, "openvpn-user-name");
    const vpnPassword = ssm.StringParameter.valueForStringParameter(this, "openvpn-user-passwd");

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
      'us-east-1': 'ami-0acd966a5ea6b1b5f',
      'eu-west-1': 'ami-073378a1210b802e8',
      'eu-west-2': 'ami-04f6f64e951610775',
      'ap-south-1': 'ami-07ec40bd7c315379b',
      'ap-southeast-1': 'ami-0581e1a14abd56b73',
      'eu-central-1': 'ami-03dbe587c22d7aa42',
      'eu-north-1': 'ami-067349b5a5143523d',
      'eu-south-1': 'ami-0b6d15c993d405ed4',
      // ...
    });

    // create the user data scripts
    var userdatacommands: string[] = [
      `echo "openvpn:${adminPassword}" | chpasswd`,
      "/usr/local/openvpn_as/scripts/sacli --key \"vpn.client.routing.reroute_gw\" --value \"true\" ConfigPut",
      `/usr/local/openvpn_as/scripts/sacli --user ${vpnUsername} --key "type" --value "user_connect" UserPropPut`,
      `/usr/local/openvpn_as/scripts/sacli --user ${vpnUsername} --key "prop_autologin" --value "true" UserPropPut`,
      `/usr/local/openvpn_as/scripts/sacli --user ${vpnUsername} --new_pass ${vpnPassword} SetLocalPassword`,
      "/usr/local/openvpn_as/scripts/sacli start",
      "echo 'Updated OpenVPN config successfully'"
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
      instanceType: props.instanceType ? props.instanceType 
              : ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
      machineImage: openVpnImage,
      keyName: keyname,
      maxCapacity: 1,
      minCapacity: 0,
      desiredCapacity: props.desiredAsgCapacity ? props.desiredAsgCapacity : 1,
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
        HOSTED_ZONE: hostedZone,
        DNS_NAME: `${cdk.Stack.of(this).region}.vpn.${zoneName}`,
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

    if (props.addCapacitySchedule && props.removeCapacitySchedule) {

      // create the lambda function to set ASG to 0
      const setAsgToZeroFn = new lambda.Function(this, 'SetAsgToZeroFunction', {
        code: new lambda.InlineCode(fs.readFileSync('lambda/set_desired_asg_size.py', { encoding: 'utf-8' })),
        handler: 'index.lambda_handler',
        timeout: cdk.Duration.seconds(10),
        runtime: lambda.Runtime.PYTHON_3_7,
        environment: {
          DESIRED_ASG_SIZE: '0',
          ASG_GROUP_NAME: asg.autoScalingGroupName,
        }
      });
      setAsgToZeroFn.addToRolePolicy(new iam.PolicyStatement({ resources: [asg.autoScalingGroupArn], actions: [ "autoscaling:UpdateAutoScalingGroup" ] }));  

      // create the lambda function to set ASG to 0
      const setAsgToOneFn = new lambda.Function(this, 'SetAsgToOneFunction', {
        code: new lambda.InlineCode(fs.readFileSync('lambda/set_desired_asg_size.py', { encoding: 'utf-8' })),
        handler: 'index.lambda_handler',
        timeout: cdk.Duration.seconds(10),
        runtime: lambda.Runtime.PYTHON_3_7,
        environment: {
          DESIRED_ASG_SIZE: '1',
          ASG_GROUP_NAME: asg.autoScalingGroupName,
        }
      });
      setAsgToOneFn.addToRolePolicy(new iam.PolicyStatement({ resources: [asg.autoScalingGroupArn], actions: [ "autoscaling:UpdateAutoScalingGroup" ] }));

      // add scheduled rule to run every week on Sat at 8am
      new Rule(this, 'AddCapacityRule', {
        enabled: true,
        schedule: props.addCapacitySchedule,
        targets: [new LambdaFunction(setAsgToOneFn)],
      });

      // add scheduled rule to run every week on Sun at 11pm
      new Rule(this, 'RemoveCapacityRule', {
        enabled: true,
        schedule: props.removeCapacitySchedule,
        targets: [new LambdaFunction(setAsgToZeroFn)],
      });    
    }

    new cdk.CfnOutput(this, 'OpenVPNUrl', { value: `https://${cdk.Stack.of(this).region}.vpn.${zoneName}/admin` });
  }
}
