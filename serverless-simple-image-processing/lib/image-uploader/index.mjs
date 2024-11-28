import AWS from 'aws-sdk';

const s3 = new AWS.S3();

export const handler = async (event) => {
    const body = JSON.parse(event.body);
    const { imageName, imageContent } = body;

    if (!imageName || !imageContent) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: 'Missing imageName or imageContent' }),
        };
    }

    const buffer = Buffer.from(imageContent, 'base64');

    try {
        await s3.putObject({
            Bucket: process.env.BUCKET_NAME,
            Key: imageName,
            Body: buffer,
            ContentType: 'image/jpeg', // Adjust based on content type
        }).promise();

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Image uploaded successfully!' }),
        };
    } catch (err) {
        console.error(err);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Failed to upload image', error: err.message }),
        };
    }
};
