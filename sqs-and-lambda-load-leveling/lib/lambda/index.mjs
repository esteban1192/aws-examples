export const handler = async (event) => {
  console.log('Received event:', JSON.stringify(event));

  try {
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Message processed successfully' }),
    };
  } catch (error) {
    console.error('Error processing message:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to process message' }),
    };
  }
};
