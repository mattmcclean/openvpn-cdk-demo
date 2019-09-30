import json
import boto3
import os

HOSTED_ZONE = os.environ['HOSTED_ZONE']
DNS_NAME = os.environ['DNS_NAME']

print(f'HOSTED_ZONE is {HOSTED_ZONE}')
print(f'DNS_NAME is {DNS_NAME}')

ec2_client = boto3.client('ec2')
r53_client = boto3.client('route53')

def lambda_handler(event, context):
    print("Received event: " + json.dumps(event, indent=2))
    # check that the InstanceID is in the SNS notification
    if event['Records']:
        asg_notification_msg = json.loads(event['Records'][0]['Sns']['Message'])
        print("Received msg: " + json.dumps(asg_notification_msg, indent=2))
        if (asg_notification_msg['Event'] == 'autoscaling:EC2_INSTANCE_LAUNCH'):
            instanceid = asg_notification_msg['EC2InstanceId']
            print(f'InstanceID is {instanceid}')
        else:
            print(f'Ignoring event: {asg_notification_msg["Event"]}')
            return {
                'statusCode': 200,
                'body': 'Event ignored. Not EC2_INSTANCE_LAUNCH'
            }
    
    # check that instanceId in request
    if not instanceid:
        return {
            'statusCode': 400,
            'body': 'Parameter "InstanceId" not found in event'
        }

    # get thet instance state
    print('Calling ec2.describe_instances')
    response = ec2_client.describe_instances(InstanceIds=[
        instanceid,
    ])
    print(response)

    # get the public IP address from the instance
    if response['Reservations'][0]['Instances'][0]['PublicIpAddress']:
        publicip = response['Reservations'][0]['Instances'][0]['PublicIpAddress']
        print(f'Successfully got IP address {publicip}')
    
    else:
        return {
            'status': 500,
            'body': 'Did not yet receive the Public IP address'
        }

    # update the instance property
    print('Calling ec2.modify_instance_attribute')
    response = ec2_client.modify_instance_attribute(
        InstanceId=instanceid,
        SourceDestCheck={
            'Value': False
        }
    )
    print("Got ec2.modify_instance_attribute response:")
    print(response)

    # update the DNS record
    print('Calling route53.change_resource_record_sets')
    response = r53_client.change_resource_record_sets(
        HostedZoneId=HOSTED_ZONE,
        ChangeBatch={
            "Comment": "Automatic DNS update",
            "Changes": [
                {
                    "Action": "UPSERT",
                    "ResourceRecordSet": {
                        "Name": DNS_NAME,
                        "Type": "A",
                        "TTL": 180,
                        "ResourceRecords": [
                            {
                                "Value": publicip
                            },
                        ],
                    }
                },
            ]
        }
    )
    print("Got route53.change_resource_record_sets response:")
    print(response)    

    print("Successfully processed event!")

    return {
        'status': 200,
        'body': 'Successfully processed event',
    }