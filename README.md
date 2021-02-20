
# Setup Steps

Follow the steps below to setup a new OpenVPN server.

1. Setup a new Route53 hosted zone and register with a domain name. Get the domain name and hosted zone id.

2. Upload SSM parameters to the approprivate cloud with the following commands:

```
# update the Route53 Hosted Zone ID
aws ssm put-parameter --name "openvpn-hosted-zone" --value <hosted-zone-value> --type String 

# update the Route53 domain name
aws ssm put-parameter --name "openvpn-zone-name" --value <domain-name-value> --type String 

# update the openvpn admin password
aws ssm put-parameter --name "openvpn-admin-passwd" --value <admin-password> --type String

# update the EC2 keyname for SSH access
aws ssm put-parameter --name "openvpn-keyname" --value <keyname> --type String

# update the openvpn username
aws ssm put-parameter --name "openvpn-user-name" --value <user-name> --type String

# update the openvpn user password
aws ssm put-parameter --name "openvpn-user-passwd" --value <user-password> --type String
```
3.  Accept OpenVpn [license agreement](https://aws.amazon.com/marketplace/pp/B00MI40CAE/) if not already accepted.

4.  Run the CDK deploy commands: ```cdk deploy```
