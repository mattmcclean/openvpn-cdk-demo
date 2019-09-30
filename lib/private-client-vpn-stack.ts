import cdk = require('@aws-cdk/core');
import ec2 = require('@aws-cdk/aws-ec2');
import autoscaling = require('@aws-cdk/aws-autoscaling');
import iam = require('@aws-cdk/aws-iam');
import lambda = require('@aws-cdk/aws-lambda');
import sns = require('@aws-cdk/aws-sns');

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

    // create an elastic ip address
    const eip = new ec2.CfnEIP(this, 'ElasticIp', {
      domain: "vpc"
    });

    // create the user data scripts
    var userdatacommands: string[] = [
      "set +x",
      "apt-get update",
      "apt-get install -y awscli jq",
      `aws ec2 associate-address --instance-id $(curl -s http://169.254.169.254/latest/meta-data/instance-id) --allocation-id ${eip.attrAllocationId} --allow-reassociation --region ${cdk.Stack.of(this).region}`,
      `aws ec2 modify-instance-attribute --instance-id $(curl -s http://169.254.169.254/latest/meta-data/instance-id) --no-source-dest-check --region ${cdk.Stack.of(this).region}`,
      `echo "openvpn:${props.password}" | chpasswd`,
    ];

    const userData = ec2.UserData.forLinux({
      shebang: "#!/bin/bash"
    });
    userData.addCommands(...userdatacommands);

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
    });
    asg.addSecurityGroup(sg);

    // add policy so that EC2 instance can allocte elastic IP
    asg.role.addToPolicy(new iam.PolicyStatement({
      resources: ['*'],
      actions: [ "ec2:DescribeAddresses", "ec2:AllocateAddress", "ec2:DescribeInstances", "ec2:AssociateAddress", "ec2:ModifyInstanceAttribute" ],
    }));

    new cdk.CfnOutput(this, 'OpenVPNUrl', { value: `https://${cdk.Stack.of(this).region}.vpn.${props.zoneName}/admin` });
  }
}
