import { Express } from 'express';
import initializeApp from '../server/index';

let app: Express;

export default async function handler(req: any, res: any) {
  if (!app) {
    app = await initializeApp();
  }
  
  return app(req, res);
} 