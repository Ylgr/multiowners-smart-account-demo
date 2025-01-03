"use client";

import {
    BundlerClient,
    createBundlerClient,
    createWebAuthnCredential,
    toCoinbaseSmartAccount,
    toWebAuthnAccount
} from 'viem/account-abstraction'
import {
    Address,
    createPublicClient,
    createWalletClient, custom,
    encodeFunctionData,
    formatEther,
    Hex, hexToBytes,
    http,
    pad,
    parseEther
} from "viem";
import {arbitrumSepolia} from "viem/chains";
import {useEffect, useState} from "react";
import type {SmartAccount, WebAuthnAccount} from "viem/account-abstraction/accounts/types";
import {privateKeyToAccount, sign, toAccount} from "viem/accounts";
import type {PrivateKeyAccount} from "viem/accounts/types";
import {CoinbaseSmartWalletAbi} from "@/abi/CoinbaseSmartWallet.abi";
import {useAccount, usePublicClient, useWalletClient, useConnectorClient, createConfig} from "wagmi";
import {getWalletClient, signMessage} from '@wagmi/core'
// import { signMessage } from '@wagmi/core'
import { getAccount } from '@wagmi/core'
import { useSignMessage, useSignTypedData } from 'wagmi'
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {ethers} from "ethers";

// const loadCredential = () => JSON.parse(localStorage.getItem('webauthnCredential'));
// const saveCredential = (credential: any) => localStorage.setItem('webauthnCredential', JSON.stringify(credential));

enum WalletType {
    DEFAULT = 'DEFAULT',
    EOA = 'EOA',
    PASSKEY = 'PASSKEY',
    WAGMI = 'WAGMI',
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
    const { signMessageAsync } = useSignMessage({})

    // const wagmiClient = getWalletClient({
    //     chain: currentChain,
    //     transport: http(),
    // })

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

    const externalAccount = useAccount();
    useEffect(() => {
        init().catch(console.error);
    }, [])

    async function init() {
        await initEoaWallet(WalletType.DEFAULT)
        await initEoaWallet(WalletType.EOA)
        // await initPasskeyWallet()
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
        // let credential = loadCredential();
        let credential = null;

        // If no credential exists, create a new one and save it
        if (!credential) {
            credential = await createWebAuthnCredential({ name: 'Wallet' });
            saveCredential(credential);
        }

        const owner = toWebAuthnAccount({ credential })
        // setPasskeyPublicKey(owner.publicKey)
        setOwnerPasskeyAccount(owner)
    }

    // const connector = useConnectorClient()

    async function setActiveWallet(walletType: WalletType) {
        let owner;
        if(walletType === WalletType.EOA) {
            owner = ownerRecoveryAccount;
        } else if(walletType === WalletType.DEFAULT) {
            owner = ownerDefaultAccount;
        } else if(walletType === WalletType.PASSKEY) {
            owner = ownerPasskeyAccount;
        } else if(walletType === WalletType.WAGMI) {
            owner = ownerDefaultAccount;
        } else {
            console.error('Invalid wallet type');
            return;
        }
        console.log('owner: ', owner)
        let account = await toCoinbaseSmartAccount({
            client,
            owners: [owner],
        })
        console.log('account: ', account.address)
        console.log('externalAddress: ', externalAccount.address)

        if(walletType === WalletType.WAGMI) {

            const ownerAccount = {
                address: externalAccount.address,
                async sign({hash}): Promise<Hex> {
                    hash = '0x70d3286726ca603f7b935c32026203554a10316aa6f977346043e565fbd508d9'
                    console.log('hash: ', hash)

                    // const signResult = await signMessageAsync({message: hash})
                    // console.log('signResult: ', signResult);
                    // const signResultRaw = await signMessageAsync({message: {raw: hash}})
                    // console.log('signResultRaw: ', signResultRaw);
                    const result = await sign({
                        hash: hash,
                        privateKey: process.env.NEXT_PUBLIC_DEFAULT_PRIVATE_KEY as string as Hex,
                        to: 'hex'
                    })
                    console.log('result: ', result)
                    return result
                    // const viemWallet = createWalletClient({
                    //     chain: currentChain,
                    //     transport: custom(window.ethereum!),
                    //     account: externalAccount.address,
                    // });
                    // const result2 = await viemWallet.signMessage({hash})
                    // console.log('result2: ', result2)
                    // // return result2;

                    // const ethersProvider = new ethers.BrowserProvider(window.ethereum)
                    // const ethersWallet = await ethersProvider.getSigner(0)
                    // const result3 = await ethersWallet.signMessage(ethers.getBytes(hash))
                    // console.log('result3: ', result3)
                    // return result3;

                    // const result4 = await window.ethereum.request({ method: 'personal_sign', params: [ hash, externalAccount.address ] });
                    // console.log('result4: ', result4)
                    // return result4;
                    // return '0x00';
                }
            }
            account = await toCoinbaseSmartAccount({
                client,
                address: account.address,
                owners: [ownerAccount],
            });
        }
        console.log('account2: ', account.address)
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
        const balance = await client.getBalance({ address: smartAccount.address })

        const code = await client.getCode({ address: smartAccount.address })
        console.log('code: ', code)
        if(!code) {
            setSmartAccountDetails({
                isDeployed: false,
                isFetched: true,
                balance: Number(balance)
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
        // const uo = await bundlerClient.prepareUserOperation({
        //     account: smartAccount,
        //     calls: [{
        //         to: '0xeaBcd21B75349c59a4177E10ed17FBf2955fE697',
        //         value: 0,
        //     }],
        //     paymasterAndData: '0xe8afce87993bd475faf2aea62e0b008dc27ab81a',
        // })
        // console.log('uo: ', uo)
        const hash = await bundlerClient.sendUserOperation({
            account: smartAccount,
            calls: [{
                to: '0xeaBcd21B75349c59a4177E10ed17FBf2955fE697',
                value: 0,
            }],
            // paymasterAndData: '0xe8afce87993bd475faf2aea62e0b008dc27ab81a',
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
                    args: [ownerRecoveryAccount.address],
                    // args: ['0x53c603f21A2124 63c0F7C3C6C71B2b69CE40EC2d'],
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
                          <a href={'https://sepolia.arbiscan.io/address/' + smartAccount.address}
                             target='_blank'>{smartAccount.address}</a>
                          <br/>
                          <button className="btn-primary" onClick={() => fetchCoinbaseSmartAccountDetails()}>Fetch
                              details
                          </button>
                          <br/>
                          {smartAccountDetails.isDeployed ? (
                              <div>
                                  <h3>Deployed</h3>
                                  {smartAccountDetails.balance && (
                                      <p>Balance: {formatEther(smartAccountDetails.balance.toString())} ETH</p>)}
                                  {smartAccountDetails.owners && (
                                      <p>Owners: {smartAccountDetails.owners.join(', ')}</p>)}
                              </div>
                          ) : (
                              <div>
                                  {smartAccountDetails.isFetched && <h3>Not deployed</h3>}
                                  {smartAccountDetails.balance != null && (
                                      <p>Balance: {formatEther(smartAccountDetails.balance.toString())} ETH</p>)}
                              </div>
                          )}
                      </div>
                  ) : (<h3>Not initialized</h3>)}
                  <button className="btn-primary" onClick={() => createTransaction()}>Create transaction</button>
                  <br/>
                  <button className="btn-primary" onClick={() => addOwner(ChangeOwnerType.ADD)}>Add recovery as owner
                  </button>
                  <br/>
                  <button className="btn-primary" onClick={() => addOwner(ChangeOwnerType.REMOVE)}>Remove recovery as
                      owner
                  </button>
              </div>
              <div className="col-span-2 ...">Default wallet:
                  <br/>
                  {currentWalletType === WalletType.DEFAULT && <h3>Active</h3>}
                  <br/>
                  {ownerDefaultAccount && <h3>Address: {ownerDefaultAccount.address}</h3>}
                  <br/>
                  <button className="btn-primary" onClick={() => setActiveWallet(WalletType.DEFAULT)}>Use wallet
                  </button>
              </div>
              <div className="col-span-2 ...">Recovery wallet:
                  <br/>
                  {currentWalletType === WalletType.EOA && <h3>Active</h3>}
                  <br/>
                  {ownerRecoveryAccount && <h3>Address: {ownerRecoveryAccount.address}</h3>}
                  <br/>
                  <button className="btn-primary" onClick={() => setActiveWallet(WalletType.EOA)}>Use wallet</button>
              </div>
              <div className="col-span-2 ...">Passkey:
                  <br/>
                  {currentWalletType === WalletType.PASSKEY && <h3>Active</h3>}
                  <br/>
                  {ownerPasskeyAccount && <h3>Public key: {ownerPasskeyAccount.publicKey}</h3>}
                  <br/>
                  <button className="btn-primary" onClick={() => setActiveWallet(WalletType.PASSKEY)}>Use wallet
                  </button>
              </div>

          </div>
          <div>WAGMI:
              <br/>
              {currentWalletType === WalletType.WAGMI && <h3>Active</h3>}
              <br/>
              {externalAccount.isConnected && <h3>Address: {externalAccount.address}</h3>}
              <br/>
              {externalAccount.isConnected && <h3>Chain: {JSON.stringify(externalAccount.chain)}</h3>}
              <br/>
              <ConnectButton className="btn-primary"/>
              <br/>
              <button className="btn-primary" onClick={() => setActiveWallet(WalletType.WAGMI)}>Use wallet</button>
              <button className="btn-primary" onClick={async () => {
                  console.log('sadasda')
                  const result = await signMessageAsync({ message: {raw: '0xc80f8540d23b926f873309e183514e957f648a0a1b0ff01726a11040ea3cf373'}})
                  console.log('result: ', result);
              }}>Test sign message</button>
              <button className="btn-primary" onClick={async () => {
                  const owner = privateKeyToAccount(process.env.NEXT_PUBLIC_DEFAULT_PRIVATE_KEY as string as Hex)
                  const walletClient = createWalletClient({
                        chain: currentChain,
                        transport: http(),
                        account: owner,
                    })

                  const result = await walletClient.signMessage({ message: {raw: '0xc80f8540d23b926f873309e183514e957f648a0a1b0ff01726a11040ea3cf373'}})
                  console.log('result: ', result);
              }}>Test sign message with Private key</button>
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
                          <td><a href={'https://sepolia.arbiscan.io/tx/' + hash} target="_blank">{hash}</a></td>
                      </tr>
                  ))}
              </table>
          </div>
      </div>
  );
}
