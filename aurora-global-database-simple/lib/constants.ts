import * as aws_rds from 'aws-cdk-lib/aws-rds'

export const clusterEngine = aws_rds.DatabaseClusterEngine.auroraMysql({
    version: aws_rds.AuroraMysqlEngineVersion.VER_3_08_0,
});
