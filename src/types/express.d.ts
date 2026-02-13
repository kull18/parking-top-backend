import { IAuthTokenPayload } from './interfaces';

declare global {
  namespace Express {
    interface Request {
      user?: IAuthTokenPayload;
    }
  }
}