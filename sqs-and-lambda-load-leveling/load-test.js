import http from 'k6/http';

export const options = {
  vus: 10,
  iterations: 360
};

export default function () {
  http.post('https://gquj95end1.execute-api.us-east-1.amazonaws.com/prod/messages');
}
