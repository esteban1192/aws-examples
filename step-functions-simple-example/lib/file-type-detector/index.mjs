export const handler = async (event) => {
    console.log("this is the event", event);
    
    return {
        contentType: 'image/png', //mock
    };
};
