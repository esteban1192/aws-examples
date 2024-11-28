import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

const s3 = new S3Client();

export const handler = async (event) => {
	console.log("This is the event", JSON.stringify(event));
	const originalsBucket = event.Records[0].s3.bucket.name;
	const key = event.Records[0].s3.object.key;

	try {
		// Fetch the image from S3
		const getObjectCommand = new GetObjectCommand({ Bucket: originalsBucket, Key: key });
		const data = await s3.send(getObjectCommand);

		// Convert the S3 body stream to a buffer
		const imageBuffer = await streamToBuffer(data.Body);

		// Define the sizes for the thumbnails
		const sizes = [
			{ name: 'small', width: 100, height: 100 },
			{ name: 'medium', width: 300, height: 300 },
			{ name: 'large', width: 600, height: 600 },
		];

		// Process and save each thumbnail
		for (const size of sizes) {
			const thumbnailBuffer = await sharp(imageBuffer)
				.resize(size.width, size.height)
				.toBuffer();

			const thumbnailKey = `thumbnails/${key}/${size.name}`;

			// Save the thumbnail back to S3
			const putObjectCommand = new PutObjectCommand({
				Bucket: process.env.BUCKET_NAME,
				Key: thumbnailKey,
				Body: thumbnailBuffer,
				ContentType: 'image/jpeg', // Assuming the original image is JPEG
			});
			await s3.send(putObjectCommand);

			console.log(`Thumbnail created: ${thumbnailKey}`);
		}

		console.log('All thumbnails generated successfully');
	} catch (err) {
		console.error('Error processing the image', err);
		throw err;
	}
};

// Helper function to convert a readable stream to a buffer
const streamToBuffer = async (stream) => {
	const chunks = [];
	for await (const chunk of stream) {
		chunks.push(chunk);
	}
	return Buffer.concat(chunks);
};
