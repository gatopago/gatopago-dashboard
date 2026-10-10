/**
 * Signing in on this computer, with whichever GatoPago passkey the person picks. It carries the
 * signing code, so the login page loads it only after it shows the QR.
 */
import { createPublicClient, fallback, http, type Address, type Hex } from 'viem';
import { createSiweMessage } from 'viem/siwe';
import { walletContracts, walletNetwork } from '@gatopago/shared/networks';
import {
  capturingWebAuthnClient,
  findAccount,
  isPrfUnavailable,
  meraEvmKey,
  meraSeed,
  PASSKEY_PROMPT_MS,
  type AccountApprovals,
} from '@gatopago/shared/passkey';
import { gatopagoAccountFactoryAbi, toGatoPagoAccount } from '@gatopago/shared/wallet';
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
 * the browser's own QR, as the app does: one prompt gives the passkey's PRF output, from which the
 * Mera key that owns the account derives, and `findAccount` finds that account by its verified
 * owners (the same recipe as the app, `@gatopago/shared/passkey`). The key signs the SIWE message
 * for Business in memory and is wiped right after.
 */
export async function signInHere(settings: ClientSettings): Promise<Session> {
  const reader = client(settings);
  const { client: webAuthnClient, seen } = capturingWebAuthnClient();
  const { prfOutput } = await getPasskeyPrfOutput({
    rpId: settings.passkeyRpId,
    webAuthnClient,
    timeout: PASSKEY_PROMPT_MS,
  }).catch((error: unknown) => {
    throw isPrfUnavailable(error) ? new ApiError(400, 'PASSKEY_WITHOUT_PRF') : error;
  });
  const seed = meraSeed(prfOutput);
  prfOutput.fill(0);
  const privateKey = meraEvmKey(seed);
  seed.fill(0);
  const signing = createSecp256k1SigningSession({ privateKey });
  privateKey.fill(0);
  try {
    const owner = toViemAccount(signing);
    const found = await findAccount(reader, {
      contracts: walletContracts,
      assertion: seen.asserted!,
      owner: owner.address,
      lookup: lookup(settings, reader),
    });
    if (!found) throw new ApiError(404, 'ACCOUNT_NOT_FOUND');
    return await finishSignIn(
      settings,
      await toGatoPagoAccount({
        client: reader,
        owner,
        contracts: walletContracts,
        initialOwners: found.initialOwners,
      }),
    );
  } finally {
    signing.end();
  }
}

/** The account signs a SIWE message for this console; Wallet Core answers with a Business session. */
async function finishSignIn(
  settings: ClientSettings,
  account: {
    address: Address;
    initialOwners: readonly Hex[];
    signMessage: (input: { message: string }) => Promise<Hex>;
  },
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
      // Its initial owners: Wallet Core checks the signer against the account's owners now.
      body: {
        message,
        signature: await account.signMessage({ message }),
        initial_owners: account.initialOwners,
      },
    }),
  );
}
