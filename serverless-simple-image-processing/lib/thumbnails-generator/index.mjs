import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import path from 'path';

const s3 = new S3Client();

export const handler = async (event) => {
	const originalsBucket = event.Records[0].s3.bucket.name;
	const key = event.Records[0].s3.object.key.replace(/\+/g, ' ');
	console.log(`notified about object ${key}`)

	try {
		const getObjectCommand = new GetObjectCommand({ Bucket: originalsBucket, Key: key });
		const data = await s3.send(getObjectCommand);

		const imageBuffer = await streamToBuffer(data.Body);

		const extension = path.extname(key).toLowerCase();

		const contentType = getContentType(extension);
		if (!contentType) {
			throw new Error(`Unsupported file extension: ${extension}`);
		}

		const sizes = [
			{ name: 'small', width: 100, height: 100 },
			{ name: 'medium', width: 300, height: 300 },
			{ name: 'large', width: 600, height: 600 },
		];

		for (const size of sizes) {
			const thumbnailBuffer = await sharp(imageBuffer)
				.resize(size.width, size.height)
				.toBuffer();
			const thumbnailKey = `${key}/${size.name}${extension}`;

			const putObjectCommand = new PutObjectCommand({
				Bucket: process.env.BUCKET_NAME,
				Key: thumbnailKey,
				Body: thumbnailBuffer,
				ContentType: contentType,
			});
			await s3.send(putObjectCommand);
			console.log(`uploaded thumbnail of size ${size.name}`)
		}
	} catch (err) {
		console.error('Error processing the image', err);
		throw err;
	}
};

const streamToBuffer = async (stream) => {
	const chunks = [];
	for await (const chunk of stream) {
		chunks.push(chunk);
	}
	return Buffer.concat(chunks);
};

const getContentType = (extension) => {
	switch (extension) {
		case '.jpg':
		case '.jpeg':
			return 'image/jpeg';
		case '.png':
			return 'image/png';
		case '.webp':
			return 'image/webp';
		case '.tiff':
			return 'image/tiff';
		default:
			return null;
	}
};
