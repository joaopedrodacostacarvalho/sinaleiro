import { Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import * as admin from 'firebase-admin'
import { DecodedIdToken } from 'firebase-admin/auth';

@Injectable()
export class AuthService implements OnModuleInit {
  onModuleInit() {
    if (!admin.getApps().length) {
      admin.initializeApp({
        credential: admin.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    }
  }

  async verifyToken(token: String): Promise<DecodedIdToken> {
    try {
      return await this.verifyToken(token)
    } catch (error) {
      throw new UnauthorizedException("Invalid or expired Firebase token");
    }
  }
}
