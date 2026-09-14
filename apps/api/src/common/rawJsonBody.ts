import express, { type Request } from 'express';

export interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

export const rawJsonBodyParser = express.json({
  verify: (request, _response, body) => {
    (request as RawBodyRequest).rawBody = Buffer.from(body);
  },
});