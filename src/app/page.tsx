"use client";

import {
    BundlerClient,
    createBundlerClient,
    createWebAuthnCredential,
    toCoinbaseSmartAccount,
    toWebAuthnAccount
} from 'viem/account-abstraction'
import {
    createPublicClient,
    createWalletClient,
    encodeFunctionData,
    formatEther,
    Hex,
    http,
    pad,
    parseEther
} from "viem";
import {arbitrumSepolia} from "viem/chains";
import {useEffect, useState} from "react";
import type {SmartAccount, WebAuthnAccount} from "viem/account-abstraction/accounts/types";
import {privateKeyToAccount} from "viem/accounts";
import type {PrivateKeyAccount} from "viem/accounts/types";
import {CoinbaseSmartWalletAbi} from "@/abi/CoinbaseSmartWallet.abi";
const loadCredential = () => JSON.parse(localStorage.getItem('webauthnCredential'));
const saveCredential = (credential: any) => localStorage.setItem('webauthnCredential', JSON.stringify(credential));

enum WalletType {
    DEFAULT = 'DEFAULT',
    EOA = 'EOA',
    PASSKEY = 'PASSKEY',
    NONE = 'NONE'
}

enum ChangeOwnerType {
    ADD = 'ADD',
    REMOVE = 'REMOVE'
}

type CoinbaseSmartAccountDetails = {
    isDeployed: boolean,
    isFetched?: boolean,
    owners?: string[],
    balance?: number,
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
    const [ownerDefaultAccount, setOwnerDefaultAccount] = useState<PrivateKeyAccount>(null)
    const [ownerRecoveryAccount, setOwnerRecoveryAccount] = useState<PrivateKeyAccount>(null)
    const [ownerPasskeyAccount, setOwnerPasskeyAccount] = useState<WebAuthnAccount>(null)
    const [smartAccount, setSmartAccount] = useState<SmartAccount>(null)
    const [currentWalletType, setCurrentWalletType] = useState<WalletType>(WalletType.NONE);
    // const [bundlerClient, setBundlerClient] = useState<BundlerClient>(createBundlerClient({
    //     client,
    //     transport: http(process.env.BUNDLER_ENDPOINT as string),
    // }))
    // const [passkeyPublicKey, setPasskeyPublicKey] = useState<string>('')
    // const [defaultWalletAddress, setDefaultWalletAddress] = useState<string>('')
    // const [recoveryWalletAddress, setRecoveryWalletAddress] = useState<string>('')
    const [transactionHistory, setTransactionHistory] = useState<string[]>([])
    const [smartAccountDetails, setSmartAccountDetails] = useState<CoinbaseSmartAccountDetails>({isDeployed: false})

    useEffect(() => {
        init().catch(console.error);
    }, [])

    async function init() {
        await initEoaWallet(WalletType.DEFAULT)
        await initEoaWallet(WalletType.EOA)
        await initPasskeyWallet()
        await setActiveWallet(WalletType.DEFAULT)
    }

    async function initEoaWallet(walletType: WalletType) {
        if(walletType === WalletType.EOA) {
            const owner = privateKeyToAccount(process.env.NEXT_PUBLIC_RECOVERY_PRIVATE_KEY as string as Hex);
            // setRecoveryWalletAddress(owner.address)
            setOwnerRecoveryAccount(owner)
        } else {
            const owner = privateKeyToAccount(process.env.NEXT_PUBLIC_DEFAULT_PRIVATE_KEY as string as Hex);
            // setDefaultWalletAddress(owner.address)
            setOwnerDefaultAccount(owner)
        }
    }

    async function initPasskeyWallet() {
        let credential = loadCredential();

        // If no credential exists, create a new one and save it
        if (!credential) {
            credential = await createWebAuthnCredential({ name: 'Wallet' });
            saveCredential(credential);
        }

        const owner = toWebAuthnAccount({ credential })
        // setPasskeyPublicKey(owner.publicKey)
        setOwnerPasskeyAccount(owner)
    }


    async function setActiveWallet(walletType: WalletType) {
        let owner;
        if(walletType === WalletType.EOA) {
            owner = ownerRecoveryAccount;
        } else if(walletType === WalletType.DEFAULT) {
            owner = ownerDefaultAccount;
        } else if(walletType === WalletType.PASSKEY) {
            owner = ownerPasskeyAccount;
        } else {
            console.error('Invalid wallet type');
            return;
        }
        const account = await toCoinbaseSmartAccount({
            client,
            owners: [owner],
        })
        setSmartAccount(account)
        setCurrentWalletType(walletType)
        setSmartAccountDetails({
            isDeployed: false,
        })
    }

    async function fetchCoinbaseSmartAccountDetails() {
        if (!smartAccount) {
            console.error('Smart account is not initialized')
            return
        }
        const code = await client.getCode({ address: smartAccount.address })
        console.log('code: ', code)
        if(!code) {
            setSmartAccountDetails({
                isDeployed: false,
                isFetched: true
            })
            return
        }
        const ownerCount = await client.readContract({
            address: smartAccount.address,
            abi: CoinbaseSmartWalletAbi,
            functionName: 'ownerCount',
            args: [],
        })
        console.log('ownerCount: ', ownerCount)
        const owners: string[] = []
        for (let i = 0; i < Number(ownerCount); i++) {
            const owner = await client.readContract({
                address: smartAccount.address,
                abi: CoinbaseSmartWalletAbi,
                functionName: 'ownerAtIndex',
                args: [i],
            })
            console.log('owner: ', owner)
            owners.push(owner as string)
        }

        const balance = await client.getBalance({ address: smartAccount.address })

        setSmartAccountDetails({
            isDeployed: true,
            owners,
            balance: Number(balance)
        })
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

    async function addOwner(changeOwnerType: ChangeOwnerType) {
        if (!smartAccount) {
            console.error('Smart account is not initialized')
            return
        }
        // 0x53c603f21A212463c0F7C3C6C71B2b69CE40EC2d
        let calls;
        if(changeOwnerType === ChangeOwnerType.ADD) {
            calls = [{
                to: smartAccount.address,
                value: 0,
                data: encodeFunctionData({
                    abi: CoinbaseSmartWalletAbi,
                    functionName: 'addOwnerAddress',
                    // args: [ownerRecoveryAccount.address],
                    args: ['0x53c603f21A212463c0F7C3C6C71B2b69CE40EC2d'],
                })
            }]
        // } else if(changeOwnerType === ChangeOwnerType.REMOVE) {
        //     callData = encodeFunctionData({
        //         abi: CoinbaseSmartWalletAbi,
        //         functionName: 'removeOwnerAtIndex',
        //         args: [1, pad(ownerRecoveryAccount.address)],
        //     })
        } else {
            console.error('Invalid change owner type')
            return
        }
        const hash = await bundlerClient.sendUserOperation({
            account: smartAccount,
            calls,
        })
        console.log('hash: ', hash)
        const receipt = await bundlerClient.waitForUserOperationReceipt({
            hash
        })

        console.log('receipt: ', receipt)
        setTransactionHistory([...transactionHistory, receipt.receipt.transactionHash])
    }

    async function justAddOwner() {
        const walletClient = createWalletClient({
            chain: currentChain,
            transport: http(),
            account: ownerRecoveryAccount,
        })
        const hash = await walletClient.writeContract({
            address: smartAccount.address,
            abi: CoinbaseSmartWalletAbi,
            functionName: 'addOwnerAddress',
            args: ['0xF4402fE2B09da7c02504DC308DBc307834CE56fE'],
        });
        console.log('hash: ', hash)
    }

  return (
      <div className="container mx-auto">
          <div className="grid grid-rows-3 grid-flow-col gap-4">
            <div className="row-span-3 ...">
                <h2>Current chain:</h2>
                <h3>{currentChain.name}</h3>

                <h2>Smart account:</h2>
                {smartAccount ? (
                    <div>
                        <a href={'https://sepolia.arbiscan.io/address/'+ smartAccount.address} target='_blank'>{smartAccount.address}</a>
                        <br/>
                        <button className="btn-primary" onClick={() => fetchCoinbaseSmartAccountDetails()}>Fetch
                            details
                        </button>
                        <br/>
                        {smartAccountDetails.isDeployed ? (
                            <div>
                                <h3>Deployed</h3>
                                {smartAccountDetails.balance && (<p>Balance: {formatEther(smartAccountDetails.balance.toString())} ETH</p>)}
                                {smartAccountDetails.owners && (<p>Owners: {smartAccountDetails.owners.join(', ')}</p>)}
                            </div>
                        ) : (
                            <div>
                                {smartAccountDetails.isFetched && <h3>Not deployed</h3>}
                            </div>
                        )}
                    </div>
                ) : (<h3>Not initialized</h3>)}
                <button className="btn-primary" onClick={() => createTransaction()}>Create transaction</button>
                <br/>
                <button className="btn-primary" onClick={() => addOwner(ChangeOwnerType.ADD)}>Add recovery as owner</button>
                <br/>
                <button className="btn-primary" onClick={() => addOwner(ChangeOwnerType.REMOVE)}>Remove recovery as owner</button>
            </div>
              <div className="col-span-2 ...">Default wallet:
                  <br/>
                  {currentWalletType === WalletType.DEFAULT && <h3>Active</h3>}
                  <br/>
                  {ownerDefaultAccount && <h3>Address: {ownerDefaultAccount.address}</h3>}
                  <br/>
                  <button className="btn-primary" onClick={() => setActiveWallet(WalletType.DEFAULT)}>Use wallet</button>
              </div>
              <div className="col-span-2 ...">Recovery wallet:
                  <br/>
                    {currentWalletType === WalletType.EOA && <h3>Active</h3>}
                    <br/>
                    {ownerRecoveryAccount && <h3>Address: {ownerRecoveryAccount.address}</h3>}
                    <br/>
                  <button className="btn-primary" onClick={()=> setActiveWallet(WalletType.EOA)}>Use wallet</button>
              </div>
              <div className="col-span-2 ...">Passkey:
                  <br/>
                    {currentWalletType === WalletType.PASSKEY && <h3>Active</h3>}
                  <br/>
                    {ownerPasskeyAccount && <h3>Public key: {ownerPasskeyAccount.publicKey}</h3>}
                    <br/>
                  <button className="btn-primary" onClick={() => setActiveWallet(WalletType.PASSKEY)}>Use wallet</button>
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
