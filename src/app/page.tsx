"use client";

import {
    BundlerClient,
    createBundlerClient,
    createWebAuthnCredential,
    toCoinbaseSmartAccount,
    toWebAuthnAccount
} from 'viem/account-abstraction'
import {createPublicClient, http} from "viem";
import {arbitrumSepolia} from "viem/chains";
import {useState} from "react";
import type {SmartAccount} from "viem/account-abstraction/accounts/types";
const loadCredential = () => JSON.parse(localStorage.getItem('webauthnCredential'));
const saveCredential = (credential: any) => localStorage.setItem('webauthnCredential', JSON.stringify(credential));

enum WalletType {
    DEFAULT = 'DEFAULT',
    EOA = 'EOA',
    PASSKEY = 'PASSKEY',
    NONE = 'NONE'
}
export default function Home() {
    const currentChain = arbitrumSepolia
    const client = createPublicClient({
        chain: currentChain,
        transport: http(),
        // transport: http(process.env.BUNDLER_ENDPOINT as string),

    })
    const bundlerClient = createBundlerClient({
        client,
        transport: http(process.env.NEXT_PUBLIC_BUNDLER_ENDPOINT as string),
    })

    const [smartAccount, setSmartAccount] = useState<SmartAccount>(null)
    const [currentWalletType, setCurrentWalletType] = useState<WalletType>(WalletType.NONE);
    // const [bundlerClient, setBundlerClient] = useState<BundlerClient>(createBundlerClient({
    //     client,
    //     transport: http(process.env.BUNDLER_ENDPOINT as string),
    // }))
    const [passkeyPublicKey, setPasskeyPublicKey] = useState<string>('')
    const [transactionHistory, setTransactionHistory] = useState<string[]>([])
    async function initPasskeyWallet() {
        let credential = loadCredential();

        // If no credential exists, create a new one and save it
        if (!credential) {
            credential = await createWebAuthnCredential({ name: 'Wallet' });
            saveCredential(credential);
        }

        const owner = toWebAuthnAccount({ credential })
        setPasskeyPublicKey(owner.publicKey)

        const account = await toCoinbaseSmartAccount({
            client,
            owners: [owner],
        })
        console.log('account: ', account.address)
        setSmartAccount(account)
        setCurrentWalletType(WalletType.PASSKEY)
        // setBundlerClient(createBundlerClient(
        //     {
        //         client,
        //         transport: http(process.env.BUNDLER_ENDPOINT as string),
        //         account,
        //     }
        // ));
    }

    async function createTransaction() {
        if (!smartAccount) {
            console.error('Smart account is not initialized')
            return
        }
        const hash = await bundlerClient.sendUserOperation({
            account: smartAccount,
            calls: [{
                to: '0xeaBcd21B75349c59a4177E10ed17FBf2955fE697',
                value: 0,
            }],
        })
        console.log('hash: ', hash)
        const receipt = await bundlerClient.waitForUserOperationReceipt({
            hash
        })

        console.log('receipt: ', receipt)
        setTransactionHistory([...transactionHistory, receipt.receipt.transactionHash])
    }

  return (
      <div className="container mx-auto">
          <div className="grid grid-rows-3 grid-flow-col gap-4">
            <div className="row-span-3 ...">
                <h2>Current chain:</h2>
                <h3>{currentChain.name}</h3>

                <h2>Smart account:</h2>
                {smartAccount ? (<h3>{smartAccount.address}</h3>) : (<h3>Not initialized</h3>)}
                <button className="btn-primary" onClick={() => createTransaction()}>Create transaction</button>
            </div>
              <div className="col-span-2 ...">Default wallet:
                  <br/>
                  <button className="btn-primary">Use wallet</button>
              </div>
              <div className="col-span-2 ...">Existed EOA:
                  <br/>
                  <button className="btn-primary">Use wallet</button>
              </div>
              <div className="col-span-2 ...">Passkey:
                  <br/>
                    {passkeyPublicKey && <h3>Public key: {passkeyPublicKey}</h3>}
                  <br/>
                  <button className="btn-primary" onClick={() => initPasskeyWallet()}>Use wallet</button>
              </div>
          </div>
          <div>
              Transaction history:
              <br/>
                <table>
                    <tr>
                        <th>Transaction hash</th>
                    </tr>
                    {transactionHistory.map((hash) => (
                        <tr key={hash}>
                            <td><a href={'https://sepolia.arbiscan.io/tx/'+ hash} target="_blank">{hash}</a></td>
                        </tr>
                    ))}
                </table>
          </div>
      </div>
  );
}
