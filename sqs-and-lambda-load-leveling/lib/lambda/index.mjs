export const handler = async (event) => {
  console.log('processing: ', event.Records.length);
  await new Promise((resolve) => setTimeout(resolve, 500));

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Message processed successfully' }),
  };
};
