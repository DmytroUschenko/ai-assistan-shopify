declare namespace Express {
  export interface Request {
    shopDomain?: string;
    rawBody?: Buffer;
  }
}
