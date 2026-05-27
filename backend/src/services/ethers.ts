import { ethers } from 'ethers';
import config from '../config/index';

let provider: ethers.Provider | null = null;
let signer: ethers.Wallet | null = null;

export function getProvider(): ethers.Provider {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(config.mantle.rpcUrl);
  }
  return provider;
}

export function getSigner(): ethers.Wallet {
  if (!signer) {
    const privKey = config.mantle.privateKey;
    if (!privKey) throw new Error('PRIVATE_KEY not configured');
    signer = new ethers.Wallet(privKey, getProvider());
  }
  return signer;
}

export function getContract(address: string, abi: ethers.InterfaceAbi): ethers.Contract {
  return new ethers.Contract(address, abi, getSigner());
}
