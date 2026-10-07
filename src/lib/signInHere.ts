/**
 * Signing in on this computer, with a passkey or a Mera key. It carries the signing code, so the
 * login page loads it only after it shows the QR.
 */
import { P256, PublicKey, WebAuthnP256 } from 'ox';
import {
  bytesToHex,
  concat,
  createPublicClient,
  fallback,
  getAddress,
  http,
  sha256,
  stringToHex,
  type Address,
  type Hex,
} from 'viem';
import { toWebAuthnAccount } from 'viem/account-abstraction';
import { createSiweMessage } from 'viem/siwe';
import { walletContracts, walletNetwork } from '@gatopago/shared/networks';
import {
  gatopagoAccountFactoryAbi,
  keyOwner,
  ownersAfter,
  passkeyOwner,
  toGatoPagoAccount,
} from '@gatopago/shared/wallet';
import { createSecp256k1SigningSession, getPasskeyPrfOutput } from '@category-labs/mera';
import { toViemAccount } from '@category-labs/mera/viem';
import { HDKey } from '@scure/bip32';
import { entropyToMnemonic, mnemonicToSeedSync } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { api, ApiError } from './api';
import type { ClientSettings } from './settings';
import type { Session } from './session';
import { remember, type SessionResponse } from './signIn';

const random = (size: number) => crypto.getRandomValues(new Uint8Array(size));

/** The passkeys' domain is the app's: this console is a subdomain of it. */
const passkeyDomain = (settings: ClientSettings) => new URL(settings.webOrigin).hostname;

const client = (settings: ClientSettings) => {
  const url = settings.rpcUrls[settings.homeNetwork];
  return createPublicClient({
    chain: walletNetwork(settings.homeNetwork).chain,
    transport: url ? fallback([http(url), http()]) : http(),
  });
};

/** The two P-256 public keys (64-byte hex) a WebAuthn assertion signature can come from. */
function recoverPublicKeys(
  metadata: { authenticatorData: Hex; clientDataJSON: string },
  signature: { r: bigint; s: bigint },
): Hex[] {
  const payload = sha256(
    concat([metadata.authenticatorData, sha256(stringToHex(metadata.clientDataJSON))]),
  );
  return [0, 1].map((yParity) =>
    PublicKey.toHex(P256.recoverPublicKey({ payload, signature: { ...signature, yParity } }), {
      includePrefix: false,
    }),
  );
}

/**
 * Signs in with a GatoPago passkey on this computer, or on a phone through the browser's own QR.
 * WebAuthn does not return the public key, so it is recovered from a first signature and matched
 * against the owners of a member's account; the account then signs a SIWE message for Business.
 */
export async function signInWithPasskey(settings: ClientSettings): Promise<Session> {
  const rpId = passkeyDomain(settings);
  const reader = client(settings);
  const { id, metadata, signature, raw } = await WebAuthnP256.sign({
    challenge: bytesToHex(random(32)),
    rpId,
  });
  const handle = (raw.response as AuthenticatorAssertionResponse).userHandle;
  const backupOf =
    handle?.byteLength === 20 ? getAddress(bytesToHex(new Uint8Array(handle))) : null;

  for (const publicKey of recoverPublicKeys(metadata, signature)) {
    const owner = passkeyOwner(walletContracts.webAuthnVerifier, publicKey);
    const address =
      backupOf ??
      (await reader.readContract({
        address: walletContracts.factory,
        abi: gatopagoAccountFactoryAbi,
        functionName: 'getAddress',
        args: [[owner], 0n],
      }));
    const state = await api<{ initial_owners: Hex[] | null; approvals: { call: Hex }[] }>(
      settings.apiOrigin,
      `/app/v1/approvals/${address}`,
    ).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    });
    if (!state) continue;
    const initialOwners = state.initial_owners ?? (backupOf ? [] : [owner]);
    const owners = ownersAfter(
      initialOwners,
      state.approvals.map((approval) => approval.call),
    );
    if (!owners.some((value) => value.toLowerCase() === owner.toLowerCase())) continue;

    return finishSignIn(
      settings,
      await toGatoPagoAccount({
        client: reader,
        owner: toWebAuthnAccount({ credential: { id, publicKey }, rpId }),
        contracts: walletContracts,
        initialOwners,
      }),
    );
  }
  throw new ApiError(404, 'ACCOUNT_NOT_FOUND');
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

/**
 * Signs in a Mera account: its passkey's PRF output derives the Ethereum key that owns it, exactly
 * as the app derives it (BIP-39 entropy, then `m/44'/60'/0'/0/0`). The signing session ends as soon
 * as the console is signed in; the key never leaves memory.
 */
export async function signInWithMera(settings: ClientSettings): Promise<Session> {
  const { prfOutput } = await getPasskeyPrfOutput({ rpId: passkeyDomain(settings) });
  const seed = mnemonicToSeedSync(entropyToMnemonic(prfOutput, wordlist));
  const node = HDKey.fromMasterSeed(seed).derive("m/44'/60'/0'/0/0");
  seed.fill(0);
  prfOutput.fill(0);
  if (!node.privateKey) throw new Error('MERA_DERIVATION_FAILED');
  const signing = createSecp256k1SigningSession({ privateKey: node.privateKey });
  node.wipePrivateData();
  try {
    const owner = toViemAccount(signing);
    const reader = client(settings);
    const initialOwners = [keyOwner(owner.address)];
    const address = await reader.readContract({
      address: walletContracts.factory,
      abi: gatopagoAccountFactoryAbi,
      functionName: 'getAddress',
      args: [initialOwners, 0n],
    });
    // Only a member's account: Wallet Core knows its approvals.
    await api(settings.apiOrigin, `/app/v1/approvals/${address}`).catch((error: unknown) => {
      throw error instanceof ApiError && error.status === 404
        ? new ApiError(404, 'ACCOUNT_NOT_FOUND')
        : error;
    });
    return await finishSignIn(
      settings,
      await toGatoPagoAccount({ client: reader, owner, contracts: walletContracts, initialOwners }),
    );
  } finally {
    signing.end();
  }
}
