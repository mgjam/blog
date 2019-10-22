import cdk = require('@aws-cdk/core');
import s3 = require('@aws-cdk/aws-s3');
import iam = require('@aws-cdk/aws-iam');

export class S3 {
    public static create(scope: cdk.Construct) {
        const user = this.createUser(scope);
        const accessKey = this.createAccessKey(scope, user);
        const s3Bucket = this.createS3Bucket(scope, user);

        this.createAccessKeyOutputs(scope, accessKey);
        this.createS3BucketOutputs(scope, s3Bucket);
    }

    private static createUser(scope: cdk.Construct): iam.User {
        const name = 'User';

        return new iam.User(scope, name, {
            userName: name
        });
    }

    private static createAccessKey(
        scope: cdk.Construct,
        javascriptArtifactsS3User: iam.User
    ): iam.CfnAccessKey {
        const name = 'UserAccessKey'

        return  new iam.CfnAccessKey(scope, name, {
            userName: javascriptArtifactsS3User.userName
        });
    }
    
    private static createS3Bucket(scope: cdk.Construct, user: iam.User): s3.Bucket {
        const name = 'bucket';

        const bucket = new s3.Bucket(scope, name, {
            bucketName: name,
            accessControl: s3.BucketAccessControl.PUBLIC_READ,
            cors: [{
                allowedOrigins: [ '*' ],
                allowedMethods: [ s3.HttpMethods.GET ],
                allowedHeaders: [ '*' ]
            }]
        });

        bucket.grantWrite(user);

        return bucket;
    }    
    
    private static createAccessKeyOutputs(scope: cdk.Construct, accessKey: iam.CfnAccessKey) {
        new cdk.CfnOutput(scope, 'UserAccessKeyId', {
            value: accessKey.ref
        });
        new cdk.CfnOutput(scope, 'UserSecretAccessKey', {
            value: accessKey.attrSecretAccessKey
        });
    }

    private static createS3BucketOutputs(scope: cdk.Construct, s3Bucket: s3.Bucket) {
        const name = 'BucketName';

        new cdk.CfnOutput(scope, name, {
            value: s3Bucket.bucketName
        });
    }
}
