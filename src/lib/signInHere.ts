/**
 * Signing in on this computer, with whichever GatoPago passkey the person picks. It carries the
 * signing code, so the login page loads it only after it shows the QR.
 */
import { createPublicClient, fallback, http, type Address, type Hex } from 'viem';
import { toWebAuthnAccount } from 'viem/account-abstraction';
import { createSiweMessage } from 'viem/siwe';
import { walletContracts, walletNetwork } from '@gatopago/shared/networks';
import {
  capturingWebAuthnClient,
  isPrfUnavailable,
  meraEvmKey,
  meraSeed,
  passkeyAccount,
  type AccountApprovals,
} from '@gatopago/shared/passkey';
import { gatopagoAccountFactoryAbi, keyOwner, toGatoPagoAccount } from '@gatopago/shared/wallet';
import { createSecp256k1SigningSession, getPasskeyPrfOutput } from '@category-labs/mera';
import { toViemAccount } from '@category-labs/mera/viem';
import { api, ApiError } from './api';
import type { ClientSettings } from './settings';
import type { Session } from './session';
import { remember, type SessionResponse } from './signIn';

const client = (settings: ClientSettings) => {
  const url = settings.rpcUrls[settings.homeNetwork];
  return createPublicClient({
    chain: walletNetwork(settings.homeNetwork).chain,
    transport: url ? fallback([http(url), http()]) : http(),
  });
};
type Reader = ReturnType<typeof client>;

/** How accounts are found: the factory's address for some owners, and what Wallet Core knows. */
const lookup = (settings: ClientSettings, reader: Reader) => ({
  accountOf: (owners: readonly Hex[]) =>
    reader.readContract({
      address: walletContracts.factory,
      abi: gatopagoAccountFactoryAbi,
      functionName: 'getAddress',
      args: [owners, 0n],
    }),
  approvals: (address: Address) =>
    api<AccountApprovals>(settings.apiOrigin, `/app/v1/approvals/${address}`).catch(
      (error: unknown) => {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      },
    ),
});

/**
 * Signs in with whichever GatoPago passkey the person picks, on this computer or on a phone through
 * the browser's own QR, as the app does: one prompt gives the passkey's PRF output, from which
 * Mera's key derives, and its signature, from which the passkey's own key is recovered. A Mera
 * account then signs the SIWE message for Business in memory; a passkey account asks once more.
 */
export async function signInHere(settings: ClientSettings): Promise<Session> {
  const reader = client(settings);
  const accounts = lookup(settings, reader);
  const { client: webAuthnClient, seen } = capturingWebAuthnClient();
  let prf = false;
  try {
    const { prfOutput } = await getPasskeyPrfOutput({
      rpId: settings.passkeyRpId,
      webAuthnClient,
    });
    prf = true;
    const session = await signInWithMera(settings, reader, accounts, prfOutput);
    if (session) return session;
  } catch (error) {
    if (!seen.asserted || !isPrfUnavailable(error)) throw error;
  }
  const found = await passkeyAccount(seen.asserted!, accounts);
  // Without PRF a Mera account cannot be told apart: it is reported, not mistaken for another.
  if (!found) throw new ApiError(404, prf ? 'ACCOUNT_NOT_FOUND' : 'PASSKEY_WITHOUT_PRF');
  return finishSignIn(
    settings,
    await toGatoPagoAccount({
      client: reader,
      owner: toWebAuthnAccount({
        credential: { id: found.credentialId, publicKey: found.publicKey },
        rpId: settings.passkeyRpId,
      }),
      contracts: walletContracts,
      initialOwners: found.initialOwners,
    }),
  );
}

/**
 * Signs in the Mera account of a PRF output, with the same recipe as the app
 * (`@gatopago/shared/passkey`), or returns null when no member's account is owned by that key. The
 * signing session ends as soon as the console is signed in; the key never leaves memory.
 */
async function signInWithMera(
  settings: ClientSettings,
  reader: Reader,
  accounts: ReturnType<typeof lookup>,
  prfOutput: Uint8Array,
): Promise<Session | null> {
  const seed = meraSeed(prfOutput);
  prfOutput.fill(0);
  const privateKey = meraEvmKey(seed);
  seed.fill(0);
  const signing = createSecp256k1SigningSession({ privateKey });
  privateKey.fill(0);
  try {
    const owner = toViemAccount(signing);
    const initialOwners = [keyOwner(owner.address)];
    const address = await accounts.accountOf(initialOwners);
    if (!(await accounts.approvals(address))) return null;
    return await finishSignIn(
      settings,
      await toGatoPagoAccount({ client: reader, owner, contracts: walletContracts, initialOwners }),
    );
  } finally {
    signing.end();
  }
}

/** The account signs a SIWE message for this console; Wallet Core answers with a Business session. */
async function finishSignIn(
  settings: ClientSettings,
  account: { address: Address; signMessage: (input: { message: string }) => Promise<Hex> },
) {
  const { nonce } = await api<{ nonce: string }>(settings.apiOrigin, '/app/v1/auth/nonce', {
    method: 'POST',
  });
  const message = createSiweMessage({
    domain: new URL(settings.businessOrigin).host,
    uri: settings.businessOrigin,
    address: account.address,
    chainId: walletNetwork(settings.homeNetwork).chain.id,
    nonce,
    version: '1',
    issuedAt: new Date(),
    statement: 'Sign in to GatoPago Business.',
  });
  return remember(
    await api<SessionResponse>(settings.apiOrigin, '/app/v1/auth/session', {
      body: { message, signature: await account.signMessage({ message }) },
    }),
  );
}
