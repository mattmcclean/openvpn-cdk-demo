import json
import boto3

client = boto3.client('ec2')

def lambda_handler(event, context):
    # check that instanceId in request
    if not event['instanceId']:
        return {
        'statusCode': 400,
        'body': 'Parameter "InstanceId" not found in event'
    }
    print(f'InstanceId is {event["instanceId"]}')

    # get thet instance state
    response = client.describe_instances(InstanceIds=[
        event["instanceId"],
    ])
    print(response)

    # get the public IP address from the instance
    publicip = response['Reservations'][0]['Instances'][0]['PublicIpAddress']
    print(f'Successfully got IP address {publicip}')

    return {
        'status': 200,
        'body': 'Successfully got response',
        'publicIp': publicip
    }