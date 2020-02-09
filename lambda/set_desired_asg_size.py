import json
import boto3
import os

DESIRED_ASG_SIZE = os.environ['DESIRED_ASG_SIZE']
ASG_GROUP_NAME = os.environ['ASG_GROUP_NAME']

print(f'DESIRED_ASG_SIZE is {DESIRED_ASG_SIZE}')
print(f'ASG_GROUP_NAME is {ASG_GROUP_NAME}')

as_client = boto3.client('autoscaling')

def lambda_handler(event, context):
    print("Received event: " + json.dumps(event, indent=2))

    response = as_client.update_auto_scaling_group(
        AutoScalingGroupName=ASG_GROUP_NAME,
        DesiredCapacity=int(DESIRED_ASG_SIZE)
    )
    print(response)

    print("Successfully processed event!")

    return {
        'status': 200,
        'body': 'Successfully processed event',
    }