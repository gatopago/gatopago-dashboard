/**
 * Signing in on this computer, with whichever GatoPago passkey the person picks. It carries the
 * signing code, so the login page loads it only after it shows the QR.
 */
import { bytesToHex, type Hex } from 'viem';
import {
  BUSINESS_KEY_SALT,
  businessKey,
  businessSignInMessage,
  isPrfUnavailable,
  PASSKEY_PROMPT_MS,
} from '@gatopago/shared/passkey';
import { createEd25519SigningSession, getPasskeyPrfOutput } from '@category-labs/mera';
import { api, ApiError } from './api';
import type { ClientSettings } from './settings';
import type { Session } from './session';
import { remember, type SessionResponse } from './signIn';

/** A Business key the account has not approved yet: the console asks for the QR with it. */
export class UnapprovedKey extends Error {
  constructor(readonly publicKey: Hex) {
    super('BUSINESS_KEY_UNKNOWN');
  }
}

/**
 * Signs in with whichever GatoPago passkey the person picks, on this computer or on a phone through
 * the browser's own QR: one prompt gives the passkey's PRF output under the Business salt, from
 * which its Business key derives (`businessKey`), never the keys that move the account's money.
 * The key signs Wallet Core's single-use challenge in memory and is wiped right after.
 */
export async function signInHere(settings: ClientSettings): Promise<Session> {
  const { prfOutput } = await getPasskeyPrfOutput({
    rpId: settings.passkeyRpId,
    prfSalt: BUSINESS_KEY_SALT,
    timeout: PASSKEY_PROMPT_MS,
  }).catch((error: unknown) => {
    throw isPrfUnavailable(error) ? new ApiError(400, 'PASSKEY_WITHOUT_PRF') : error;
  });
  const privateKey = await businessKey(prfOutput);
  prfOutput.fill(0);
  const signing = createEd25519SigningSession({ privateKey });
  privateKey.fill(0);
  try {
    const publicKey = bytesToHex(signing.publicKey);
    const { nonce } = await api<{ nonce: string }>(settings.apiOrigin, '/app/v1/auth/nonce', {
      method: 'POST',
    });
    const message = businessSignInMessage(settings.businessOrigin, nonce);
    const signature = bytesToHex(await signing.signMessage(message));
    return remember(
      await api<SessionResponse>(settings.apiOrigin, '/app/v1/business-login/key', {
        body: { public_key: publicKey, nonce, signature },
      }).catch((error: unknown) => {
        if (error instanceof ApiError && error.code === 'BUSINESS_KEY_UNKNOWN')
          throw new UnapprovedKey(publicKey);
        throw error;
      }),
    );
  } finally {
    signing.end();
  }
}
